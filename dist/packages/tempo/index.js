const EPSILON = 1e-9;
const MAX_TIME = 1e9;
const MAX_DURATION = 86400;
const copy = (value) => structuredClone(value);
const progress = (remaining, duration) =>
  Math.max(0, Math.min(1, 1 - remaining / duration));

function record(value, label, allowed) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new TypeError(`${label} must be a plain object`);
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new TypeError(`Unknown ${label} field: ${key}`);
}
function number(value, label, min, max, integer = false) {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new RangeError(
      `${label} must be ${integer ? "an integer" : "finite"} in [${min}, ${max}]`,
    );
  return value;
}
function identifier(value) {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/.test(value) ||
    ["constructor", "prototype", "__proto__"].includes(value)
  )
    throw new TypeError("Ability id must be a safe 1–48 character identifier");
  return value;
}
function definitions(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 64)
    throw new RangeError("Provide 1–64 ability definitions");
  const seen = new Set();
  return Array.from(input, (value) => {
    record(value, "ability", [
      "id",
      "charges",
      "recharge",
      "cooldown",
      "usesGlobalCooldown",
    ]);
    const id = identifier(value.id);
    if (seen.has(id)) throw new TypeError(`Duplicate ability id: ${id}`);
    seen.add(id);
    const charges = number(
      value.charges === undefined ? 1 : value.charges,
      "charges",
      1,
      16,
      true,
    );
    const recharge = number(value.recharge, "recharge", 0.001, MAX_DURATION);
    const cooldown = number(
      value.cooldown === undefined ? 0 : value.cooldown,
      "cooldown",
      0,
      MAX_DURATION,
    );
    const usesGlobalCooldown =
      value.usesGlobalCooldown === undefined ? true : value.usesGlobalCooldown;
    if (typeof usesGlobalCooldown !== "boolean")
      throw new TypeError("usesGlobalCooldown must be boolean");
    return Object.freeze({
      id,
      charges,
      recharge,
      cooldown,
      usesGlobalCooldown,
    });
  });
}
function parseSnapshot(value) {
  if (typeof value === "string") {
    if (value.length > 131072)
      throw new RangeError("Snapshot must be at most 128 KiB of text");
    value = JSON.parse(value);
  }
  record(value, "snapshot", [
    "schema",
    "definitions",
    "globalCooldown",
    "time",
    "globalReadyAt",
    "abilities",
  ]);
  if (value.schema !== "cranberry-forge.tempo/1")
    throw new TypeError("Unsupported Tempo snapshot schema");
  // Clone once so validated input cannot later mutate restored state.
  return copy(value);
}

/** Dependency-free ability clocks. All durations and timestamps are seconds. */
export class Tempo {
  #definitions;
  #lookup;
  #globalCooldown;
  #time = 0;
  #globalReadyAt = null;
  #abilities;
  constructor(input, options = {}) {
    record(options, "options", ["globalCooldown"]);
    this.#definitions = definitions(input);
    this.#lookup = new Map(
      this.#definitions.map((definition, index) => [definition.id, index]),
    );
    this.#globalCooldown = number(
      options.globalCooldown === undefined ? 0 : options.globalCooldown,
      "globalCooldown",
      0,
      MAX_DURATION,
    );
    this.reset();
  }
  get definitions() {
    return copy(this.#definitions);
  }
  get time() {
    return this.#time;
  }
  get globalCooldown() {
    return this.#globalCooldown;
  }
  get state() {
    const globalRemaining = this.#remaining(this.#globalReadyAt);
    return {
      time: this.#time,
      globalRemaining,
      globalProgress:
        globalRemaining === 0
          ? 1
          : progress(globalRemaining, this.#globalCooldown),
      abilities: this.#definitions.map((definition) =>
        this.inspect(definition.id),
      ),
    };
  }
  #index(id) {
    identifier(id);
    const index = this.#lookup.get(id);
    if (index === undefined) throw new RangeError(`Unknown ability: ${id}`);
    return index;
  }
  #remaining(deadline) {
    return deadline === null ? 0 : Math.max(0, deadline - this.#time);
  }
  inspect(id) {
    const index = this.#index(id),
      definition = this.#definitions[index],
      ability = this.#abilities[index];
    const rechargeRemaining = this.#remaining(ability.rechargeAt),
      cooldownRemaining = this.#remaining(ability.cooldownUntil);
    const globalRemaining = definition.usesGlobalCooldown
      ? this.#remaining(this.#globalReadyAt)
      : 0;
    const reason =
      globalRemaining > 0
        ? "global-cooldown"
        : cooldownRemaining > 0
          ? "cooldown"
          : ability.charges === 0
            ? "no-charges"
            : null;
    return {
      id,
      charges: ability.charges,
      maxCharges: definition.charges,
      rechargeRemaining,
      rechargeProgress:
        ability.rechargeAt === null
          ? 1
          : progress(rechargeRemaining, definition.recharge),
      cooldownRemaining,
      globalRemaining,
      ready: reason === null,
      reason,
      retryAfter: Math.max(
        globalRemaining,
        cooldownRemaining,
        ability.charges === 0 ? rechargeRemaining : 0,
      ),
    };
  }
  tryUse(id) {
    const index = this.#index(id),
      before = this.inspect(id);
    if (!before.ready)
      return {
        ok: false,
        id,
        reason: before.reason,
        retryAfter: before.retryAfter,
        state: before,
        events: [],
      };
    const definition = this.#definitions[index],
      ability = this.#abilities[index];
    const rechargeAt =
      ability.charges === definition.charges
        ? this.#time + definition.recharge
        : ability.rechargeAt;
    const cooldownUntil =
      definition.cooldown > 0 ? this.#time + definition.cooldown : null;
    const globalReadyAt =
      definition.usesGlobalCooldown && this.#globalCooldown > 0
        ? this.#time + this.#globalCooldown
        : this.#globalReadyAt;
    for (const deadline of [rechargeAt, cooldownUntil, globalReadyAt])
      if (deadline !== null && deadline <= this.#time)
        throw new RangeError(
          "A positive duration is too small to represent at the current clock; use a larger duration or reset the clock",
        );
    ability.rechargeAt = rechargeAt;
    ability.charges--;
    ability.cooldownUntil = cooldownUntil;
    this.#globalReadyAt = globalReadyAt;
    return {
      ok: true,
      id,
      at: this.#time,
      state: this.inspect(id),
      events: [{ type: "used", id, at: this.#time, charges: ability.charges }],
    };
  }
  /** Advance only when the host's simulation advances; no wall-clock timers are used. */
  tick(dt) {
    number(dt, "dt", 0, MAX_DURATION);
    const end = number(this.#time + dt, "time", 0, MAX_TIME);
    if (dt === 0) return [];
    const events = [];
    if (this.#globalReadyAt !== null && this.#globalReadyAt <= end + EPSILON) {
      events.push({ type: "global-ready", at: this.#globalReadyAt });
      this.#globalReadyAt = null;
    }
    this.#abilities.forEach((ability, index) => {
      const definition = this.#definitions[index],
        id = definition.id;
      if (
        ability.cooldownUntil !== null &&
        ability.cooldownUntil <= end + EPSILON
      ) {
        events.push({ type: "cooldown-ready", id, at: ability.cooldownUntil });
        ability.cooldownUntil = null;
      }
      while (
        ability.rechargeAt !== null &&
        ability.rechargeAt <= end + EPSILON
      ) {
        const at = ability.rechargeAt;
        ability.charges++;
        events.push({ type: "recharged", id, at, charges: ability.charges });
        ability.rechargeAt =
          ability.charges < definition.charges
            ? at + definition.recharge
            : null;
      }
    });
    this.#time = end;
    const order = { "global-ready": 0, "cooldown-ready": 1, recharged: 2 };
    events.sort(
      (a, b) =>
        a.at - b.at ||
        order[a.type] - order[b.type] ||
        (this.#lookup.get(a.id) ?? -1) - (this.#lookup.get(b.id) ?? -1),
    );
    return events;
  }
  /** Fully refills all abilities, clears all cooldowns and resets simulation time to zero. */
  reset() {
    this.#time = 0;
    this.#globalReadyAt = null;
    this.#abilities = this.#definitions.map((definition) => ({
      id: definition.id,
      charges: definition.charges,
      rechargeAt: null,
      cooldownUntil: null,
    }));
    return this.state;
  }
  toSnapshot() {
    return {
      schema: "cranberry-forge.tempo/1",
      definitions: this.definitions,
      globalCooldown: this.#globalCooldown,
      time: this.#time,
      globalReadyAt: this.#globalReadyAt,
      abilities: copy(this.#abilities),
    };
  }
  /** Validate the entire save against this exact configuration before changing any state. */
  restore(value) {
    const snapshot = parseSnapshot(value);
    if (
      !Array.isArray(snapshot.definitions) ||
      snapshot.definitions.some(
        (definition) =>
          !definition ||
          ["id", "charges", "recharge", "cooldown", "usesGlobalCooldown"].some(
            (key) => !Object.hasOwn(definition, key),
          ),
      )
    )
      throw new TypeError(
        "Snapshot definitions must contain every normalized field",
      );
    const normalized = definitions(snapshot.definitions);
    if (JSON.stringify(normalized) !== JSON.stringify(this.#definitions))
      throw new TypeError(
        "Snapshot ability definitions do not match this Tempo",
      );
    number(snapshot.globalCooldown, "snapshot globalCooldown", 0, MAX_DURATION);
    if (snapshot.globalCooldown !== this.#globalCooldown)
      throw new TypeError("Snapshot global cooldown does not match this Tempo");
    const time = number(snapshot.time, "snapshot time", 0, MAX_TIME);
    function deadline(value, duration, label) {
      if (value === null) return null;
      number(value, label, 0, MAX_TIME + MAX_DURATION);
      if (duration === 0 || value <= time || value > time + duration + EPSILON)
        throw new RangeError(`${label} is outside its active duration`);
      return value;
    }
    const globalReadyAt = deadline(
      snapshot.globalReadyAt,
      this.#globalCooldown,
      "globalReadyAt",
    );
    if (
      !Array.isArray(snapshot.abilities) ||
      snapshot.abilities.length !== this.#definitions.length
    )
      throw new TypeError(
        "Snapshot must contain every ability exactly once in definition order",
      );
    const abilities = Array.from(snapshot.abilities, (ability, index) => {
      record(ability, "saved ability", [
        "id",
        "charges",
        "rechargeAt",
        "cooldownUntil",
      ]);
      const definition = this.#definitions[index];
      if (ability.id !== definition.id)
        throw new TypeError("Snapshot ability order or id does not match");
      const charges = number(
        ability.charges,
        "saved charges",
        0,
        definition.charges,
        true,
      );
      const rechargeAt = deadline(
        ability.rechargeAt,
        definition.recharge,
        "rechargeAt",
      );
      if ((charges === definition.charges) !== (rechargeAt === null))
        throw new TypeError(
          "Full charges require no recharge clock; missing charges require one",
        );
      const cooldownUntil = deadline(
        ability.cooldownUntil,
        definition.cooldown,
        "cooldownUntil",
      );
      return { id: definition.id, charges, rechargeAt, cooldownUntil };
    });
    this.#time = time;
    this.#globalReadyAt = globalReadyAt;
    this.#abilities = abilities;
    return this.state;
  }
  static fromSnapshot(value) {
    const snapshot = parseSnapshot(value);
    const tempo = new Tempo(snapshot.definitions, {
      globalCooldown: snapshot.globalCooldown,
    });
    tempo.restore(snapshot);
    return tempo;
  }
}
