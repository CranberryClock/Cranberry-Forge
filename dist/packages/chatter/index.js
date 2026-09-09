const clone = (value) => structuredClone(value);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const id = (value) =>
  typeof value === "string" &&
  /^[a-z][a-z0-9_-]{0,63}$/.test(value) &&
  !["constructor", "prototype", "__proto__"].includes(value);
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
function scalar(value) {
  return (
    typeof value === "boolean" ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      Math.abs(value) <= 1e9) ||
    (typeof value === "string" && value.length <= 1000)
  );
}
function text(value, max = 8000) {
  if (typeof value !== "string" || value.length > max)
    throw new TypeError(`text must be a string of at most ${max} characters`);
  return value;
}

/** Validate a small, data-only dialogue graph. No eval, commands or remote fetches. */
export function validateStory(input) {
  if (
    !object(input) ||
    !id(input.id) ||
    !id(input.start) ||
    !object(input.nodes)
  )
    throw new TypeError("story requires id, start and a nodes object");
  const variables = input.variables ?? {};
  if (!object(variables) || Object.keys(variables).length > 64)
    throw new TypeError("at most 64 variables are supported");
  for (const [key, value] of Object.entries(variables))
    if (!id(key) || !scalar(value))
      throw new TypeError(
        "variables require safe identifiers and finite scalar values",
      );
  const nodeIds = Object.keys(input.nodes);
  if (
    !nodeIds.length ||
    nodeIds.length > 256 ||
    !nodeIds.every(id) ||
    !own(input.nodes, input.start)
  )
    throw new TypeError("story needs 1–256 valid nodes and an existing start");
  const checkVar = (key, value) => {
    if (
      !own(variables, key) ||
      !scalar(value) ||
      typeof variables[key] !== typeof value
    )
      throw new TypeError(`unknown variable or mismatched type: ${key}`);
  };
  const effects = (value) => {
    value ??= [];
    if (!Array.isArray(value) || value.length > 32)
      throw new TypeError("effects must contain at most 32 operations");
    return value.map((e) => {
      if (!object(e) || !["set", "add"].includes(e.op))
        throw new TypeError("effect must be set or add");
      checkVar(e.variable, e.value);
      if (e.op === "add" && typeof e.value !== "number")
        throw new TypeError("add requires a numeric variable");
      return { op: e.op, variable: e.variable, value: e.value };
    });
  };
  const conditions = (value) => {
    value ??= [];
    if (!Array.isArray(value) || value.length > 16)
      throw new TypeError("when must contain at most 16 conditions");
    return value.map((c) => {
      if (!object(c) || !["eq", "ne", "gt", "gte", "lt", "lte"].includes(c.op))
        throw new TypeError("invalid condition operator");
      checkVar(c.variable, c.value);
      if (!["eq", "ne"].includes(c.op) && typeof c.value !== "number")
        throw new TypeError("ordered comparisons require numbers");
      return { variable: c.variable, op: c.op, value: c.value };
    });
  };
  const target = (value) => {
    if (value === null) return null;
    if (!id(value) || !own(input.nodes, value))
      throw new TypeError(`missing target node: ${value}`);
    return value;
  };
  const nodes = {};
  for (const [key, node] of Object.entries(input.nodes)) {
    if (!object(node) || !Array.isArray(node.choices ?? []))
      throw new TypeError("node choices must be an array");
    const seen = new Set();
    if ((node.choices ?? []).length > 12)
      throw new TypeError("at most 12 choices per node");
    const choices = (node.choices ?? []).map((c) => {
      if (!object(c) || !id(c.id) || seen.has(c.id))
        throw new TypeError("choice IDs must be unique in each node");
      seen.add(c.id);
      if (c.once !== undefined && typeof c.once !== "boolean")
        throw new TypeError("once must be boolean");
      return {
        id: c.id,
        text: text(c.text, 500),
        target: target(c.target),
        once: c.once ?? false,
        when: conditions(c.when),
        effects: effects(c.effects),
      };
    });
    if (choices.length && node.next !== undefined && node.next !== null)
      throw new TypeError("a node uses choices or next, not both");
    nodes[key] = {
      speaker: text(node.speaker ?? "", 120),
      text: text(node.text),
      choices,
      next: node.next === undefined ? null : target(node.next),
      onEnter: effects(node.onEnter),
    };
    for (const line of [nodes[key].text, ...choices.map((c) => c.text)])
      for (const match of line.matchAll(/\{\{([a-z][a-z0-9_-]*)\}\}/g))
        if (!own(variables, match[1]))
          throw new TypeError(`unknown interpolation: ${match[1]}`);
  }
  return {
    id: input.id,
    start: input.start,
    variables: clone(variables),
    nodes,
  };
}
function signature(story) {
  let hash = 2166136261;
  for (const c of JSON.stringify(story)) {
    hash ^= c.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
function permitted(conditions, variables) {
  return conditions.every((c) => {
    const a = variables[c.variable],
      b = c.value;
    return {
      eq: () => a === b,
      ne: () => a !== b,
      gt: () => a > b,
      gte: () => a >= b,
      lt: () => a < b,
      lte: () => a <= b,
    }[c.op]();
  });
}

export class Conversation {
  #story;
  #signature;
  #variables;
  #node;
  #used = new Set();
  #visits = {};
  #ended = false;
  #listeners = new Set();
  constructor(story, options = {}) {
    if (!object(options)) throw new TypeError("options must be an object");
    this.#story = validateStory(story);
    this.#signature = signature(this.#story);
    this.#variables = clone(this.#story.variables);
    this.#node = this.#story.start;
    if (own(options, "snapshot")) this.#restore(options.snapshot);
    else this.#enter(this.#node, this.#variables, this.#visits);
  }
  #effects(effects, variables) {
    for (const e of effects) {
      const next = e.op === "add" ? variables[e.variable] + e.value : e.value;
      if (!scalar(next)) throw new RangeError("effect exceeds variable limits");
      variables[e.variable] = next;
    }
  }
  #enter(node, variables, visits) {
    this.#effects(this.#story.nodes[node].onEnter, variables);
    visits[node] = (visits[node] ?? 0) + 1;
    if (visits[node] > 1000000) throw new RangeError("visit limit exceeded");
  }
  get variables() {
    return clone(this.#variables);
  }
  get ended() {
    return this.#ended;
  }
  get nodeId() {
    return this.#node;
  }
  get view() {
    const node = this.#story.nodes[this.#node],
      interpolate = (line) =>
        line.replace(/\{\{([a-z][a-z0-9_-]*)\}\}/g, (_, key) =>
          String(this.#variables[key]),
        );
    return {
      nodeId: this.#node,
      speaker: node.speaker,
      text: interpolate(node.text),
      ended: this.#ended,
      canAdvance: !this.#ended && node.choices.length === 0,
      choices: node.choices
        .map((c) => ({
          ...c,
          text: interpolate(c.text),
          enabled:
            !this.#ended &&
            (!c.once || !this.#used.has(`${this.#node}/${c.id}`)) &&
            permitted(c.when, this.#variables),
        }))
        .map((c) => ({ id: c.id, text: c.text, enabled: c.enabled })),
    };
  }
  subscribe(listener) {
    if (typeof listener !== "function")
      throw new TypeError("listener must be a function");
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  #notify() {
    for (const listener of [...this.#listeners])
      try {
        listener(this.view);
      } catch (error) {
        console.error("Chatter subscriber error", error);
      }
  }
  setVariables(values) {
    if (!object(values)) throw new TypeError("values must be an object");
    const next = clone(this.#variables);
    for (const [key, value] of Object.entries(values)) {
      if (
        !own(this.#story.variables, key) ||
        !scalar(value) ||
        typeof value !== typeof this.#story.variables[key]
      )
        throw new TypeError(`unknown variable or type: ${key}`);
      next[key] = value;
    }
    this.#variables = next;
    this.#notify();
    return this;
  }
  #transition(target, effects = [], usedKey) {
    const variables = clone(this.#variables),
      visits = clone(this.#visits);
    this.#effects(effects, variables);
    if (target !== null) this.#enter(target, variables, visits);
    this.#variables = variables;
    this.#visits = visits;
    if (usedKey) this.#used.add(usedKey);
    if (target === null) this.#ended = true;
    else this.#node = target;
    this.#notify();
    return { ok: true };
  }
  choose(choiceId) {
    if (this.#ended) return { ok: false, reason: "ended" };
    const choice = this.#story.nodes[this.#node].choices.find(
      (c) => c.id === choiceId,
    );
    if (!choice) return { ok: false, reason: "not-found" };
    if (!this.view.choices.find((c) => c.id === choiceId).enabled)
      return { ok: false, reason: "unavailable" };
    return this.#transition(
      choice.target,
      choice.effects,
      choice.once ? `${this.#node}/${choice.id}` : undefined,
    );
  }
  advance() {
    if (this.#ended) return { ok: false, reason: "ended" };
    const node = this.#story.nodes[this.#node];
    if (node.choices.length) return { ok: false, reason: "choice-required" };
    return this.#transition(node.next);
  }
  end() {
    if (!this.#ended) {
      this.#ended = true;
      this.#notify();
    }
    return this;
  }
  toSnapshot() {
    return {
      schema: "cranberry-forge.chatter/1",
      storyId: this.#story.id,
      signature: this.#signature,
      nodeId: this.#node,
      variables: clone(this.#variables),
      usedChoices: [...this.#used],
      visits: clone(this.#visits),
      ended: this.#ended,
    };
  }
  #restore(value) {
    const s = typeof value === "string" ? JSON.parse(value) : value;
    if (
      !object(s) ||
      s.schema !== "cranberry-forge.chatter/1" ||
      s.storyId !== this.#story.id ||
      s.signature !== this.#signature ||
      !id(s.nodeId) ||
      !own(this.#story.nodes, s.nodeId) ||
      typeof s.ended !== "boolean"
    )
      throw new TypeError("snapshot does not match this story");
    if (
      !object(s.variables) ||
      Object.keys(s.variables).length !== Object.keys(this.#variables).length
    )
      throw new TypeError("snapshot variables are incomplete");
    for (const [key, value] of Object.entries(s.variables))
      if (
        !own(this.#variables, key) ||
        !scalar(value) ||
        typeof value !== typeof this.#variables[key]
      )
        throw new TypeError("invalid snapshot variable");
    if (
      !Array.isArray(s.usedChoices) ||
      s.usedChoices.length > 3072 ||
      new Set(s.usedChoices).size !== s.usedChoices.length
    )
      throw new TypeError("invalid used choices");
    for (const key of s.usedChoices) {
      if (typeof key !== "string") throw new TypeError("invalid choice key");
      const [node, choice, ...extra] = key.split("/");
      if (
        extra.length ||
        !own(this.#story.nodes, node) ||
        !this.#story.nodes[node].choices.some((c) => c.id === choice && c.once)
      )
        throw new TypeError("unknown one-time choice");
    }
    if (!object(s.visits) || Object.keys(s.visits).length > 256)
      throw new TypeError("invalid visits");
    for (const [node, count] of Object.entries(s.visits))
      if (
        !own(this.#story.nodes, node) ||
        !Number.isSafeInteger(count) ||
        count < 1 ||
        count > 1000000
      )
        throw new TypeError("invalid visit count");
    this.#variables = clone(s.variables);
    this.#node = s.nodeId;
    this.#used = new Set(s.usedChoices);
    this.#visits = clone(s.visits);
    this.#ended = s.ended;
  }
  static fromSnapshot(story, snapshot) {
    return new Conversation(story, { snapshot });
  }
}
