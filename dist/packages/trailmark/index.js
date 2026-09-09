/** Trailmark — no renderer, storage, clock, or framework dependency. */
export const VERSION = "0.1.0";
export const SNAPSHOT_VERSION = 1;
export const LIMITS = Object.freeze({
  quests: 128,
  objectivesPerQuest: 64,
  objectives: 1024,
  prerequisites: 32,
  tags: 16,
  idLength: 96,
  target: 1_000_000_000,
  eventAmount: 1_000_000,
  dedupeCapacity: 10_000,
});

export class TrailmarkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TrailmarkError";
    this.code = code;
  }
}
const fail = (code, message) => {
  throw new TrailmarkError(code, message);
};
const copy = (value) => JSON.parse(JSON.stringify(value));
function object(value, name) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    fail("INVALID_INPUT", `${name} must be a plain object`);
}
function keys(value, allowed, name) {
  object(value, name);
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      fail("INVALID_INPUT", `${name}: unknown field ${key}`);
}
function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail("INVALID_INPUT", `${name} must be an integer in ${min}..${max}`);
  return value;
}
function string(value, name, max = LIMITS.idLength) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail(
      "INVALID_INPUT",
      `${name} must be a nonempty string of at most ${max} characters`,
    );
  return value;
}
function array(value, min, max, name) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    fail("INVALID_INPUT", `${name} must contain ${min}..${max} entries`);
  for (let i = 0; i < value.length; i++)
    if (!Object.hasOwn(value, i))
      fail("INVALID_INPUT", `${name} must not contain holes`);
  return value;
}
function strings(value, max, name) {
  const result = array(value, 0, max, name).map((v) => string(v, name));
  if (new Set(result).size !== result.length)
    fail("INVALID_INPUT", `${name} contains duplicates`);
  return result;
}
function definitions(input) {
  let total = 0;
  const result = array(input, 1, LIMITS.quests, "quests").map((q) => {
    keys(
      q,
      ["id", "title", "description", "prerequisites", "objectives"],
      "quest",
    );
    const objectives = array(
      q.objectives,
      1,
      LIMITS.objectivesPerQuest,
      "objectives",
    ).map((o) => {
      keys(o, ["id", "title", "type", "tags", "target"], "objective");
      return {
        id: string(o.id, "objective.id"),
        title: string(o.title ?? o.id, "objective.title", 160),
        type: string(o.type, "objective.type"),
        tags: strings(o.tags ?? [], LIMITS.tags, "objective.tags").sort(),
        target: integer(o.target, 1, LIMITS.target, "objective.target"),
      };
    });
    total += objectives.length;
    if (new Set(objectives.map((o) => o.id)).size !== objectives.length)
      fail("INVALID_DEFINITION", "Objective IDs must be unique within a quest");
    return {
      id: string(q.id, "quest.id"),
      title: string(q.title ?? q.id, "quest.title", 160),
      description:
        q.description === undefined
          ? ""
          : q.description === ""
            ? ""
            : string(q.description, "quest.description", 1000),
      prerequisites: strings(
        q.prerequisites ?? [],
        LIMITS.prerequisites,
        "quest.prerequisites",
      ).sort(),
      objectives,
    };
  });
  if (total > LIMITS.objectives)
    fail("INVALID_DEFINITION", "Too many objectives");
  const byId = new Map(result.map((q) => [q.id, q]));
  if (byId.size !== result.length)
    fail("INVALID_DEFINITION", "Quest IDs must be unique");
  const visiting = new Set(),
    visited = new Set();
  function visit(id) {
    if (visiting.has(id))
      fail("INVALID_DEFINITION", "Quest prerequisites contain a cycle");
    if (visited.has(id)) return;
    if (!byId.has(id)) fail("INVALID_DEFINITION", `Unknown prerequisite ${id}`);
    visiting.add(id);
    byId.get(id).prerequisites.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  result.forEach((q) => visit(q.id));
  return result;
}

/** Create a journal. Every mutation returns detached data; no implicit activation. */
export function createJournal(questDefinitions, options = {}) {
  keys(options, ["dedupeCapacity", "snapshot"], "options");
  const catalog = definitions(questDefinitions),
    catalogKey = JSON.stringify(catalog);
  const capacity = integer(
    options.dedupeCapacity ?? 2048,
    1,
    LIMITS.dedupeCapacity,
    "dedupeCapacity",
  );
  const byId = new Map(catalog.map((q) => [q.id, q]));
  let sequence = 0,
    recent = new Map();
  let states = new Map(
    catalog.map((q) => [
      q.id,
      {
        id: q.id,
        status: "idle",
        activatedAt: null,
        counters: q.objectives.map((o) => ({ id: o.id, count: 0 })),
        receipt: null,
      },
    ]),
  );
  const next = () => {
    if (sequence === Number.MAX_SAFE_INTEGER)
      fail("LIMIT_REACHED", "Sequence exhausted; create a new journal");
    return ++sequence;
  };
  const state = (id) => {
    if (!states.has(id)) fail("UNKNOWN_QUEST", `Unknown quest ${id}`);
    return states.get(id);
  };
  const missing = (id) =>
    byId.get(id).prerequisites.filter((p) => !states.get(p).receipt);
  function get(id) {
    const s = state(id),
      q = byId.get(id),
      blockers = missing(id);
    return {
      id,
      title: q.title,
      description: q.description,
      status:
        s.status === "idle"
          ? blockers.length
            ? "locked"
            : "available"
          : s.status,
      prerequisites: [...q.prerequisites],
      missingPrerequisites: blockers,
      activatedAt: s.activatedAt,
      objectives: q.objectives.map((o, i) => ({
        ...copy(o),
        count: s.counters[i].count,
        complete: s.counters[i].count === o.target,
      })),
      receipt: copy(s.receipt),
    };
  }
  function activate(id) {
    const s = state(id);
    if (s.status !== "idle")
      return { activated: false, reason: "already-started", quest: get(id) };
    if (missing(id).length)
      return { activated: false, reason: "prerequisites", quest: get(id) };
    s.activatedAt = next();
    s.status = "active";
    return { activated: true, reason: null, quest: get(id) };
  }
  function dispatch(input) {
    keys(input, ["id", "type", "tags", "amount"], "event");
    const event = {
      id: string(input.id, "event.id"),
      type: string(input.type, "event.type"),
      tags: strings(input.tags ?? [], LIMITS.tags, "event.tags"),
      amount: integer(input.amount ?? 1, 1, LIMITS.eventAmount, "event.amount"),
    };
    if (recent.has(event.id))
      return {
        accepted: false,
        duplicate: true,
        sequence,
        changes: [],
        completed: [],
      };
    const seq = next(),
      changes = [],
      completed = [],
      tags = new Set(event.tags);
    recent.set(event.id, seq);
    if (recent.size > capacity) recent.delete(recent.keys().next().value);
    for (const q of catalog) {
      const s = states.get(q.id);
      if (s.status !== "active") continue;
      q.objectives.forEach((o, i) => {
        const c = s.counters[i];
        if (
          o.type !== event.type ||
          !o.tags.every((tag) => tags.has(tag)) ||
          c.count === o.target
        )
          return;
        const before = c.count;
        c.count = Math.min(o.target, before + event.amount);
        changes.push({
          questId: q.id,
          objectiveId: o.id,
          before,
          after: c.count,
          target: o.target,
        });
      });
      if (s.counters.every((c, i) => c.count === q.objectives[i].target)) {
        s.status = "completed";
        s.receipt = {
          id: `${q.id}@${seq}`,
          questId: q.id,
          completedAt: seq,
          eventId: event.id,
          claimedAt: null,
        };
        completed.push(copy(s.receipt));
      }
    }
    return {
      accepted: true,
      duplicate: false,
      sequence: seq,
      changes,
      completed,
    };
  }
  function claim(id) {
    const s = state(id);
    if (s.status !== "completed") return null;
    s.receipt.claimedAt = next();
    s.status = "claimed";
    return copy(s.receipt);
  }
  function snapshot() {
    return {
      version: SNAPSHOT_VERSION,
      catalogKey,
      dedupeCapacity: capacity,
      sequence,
      recentEvents: [...recent].map(([id, sequence]) => ({ id, sequence })),
      quests: copy([...states.values()]),
    };
  }
  function restore(input) {
    // Validate into detached candidate structures. Nothing mutates until all gates pass.
    keys(
      input,
      [
        "version",
        "catalogKey",
        "dedupeCapacity",
        "sequence",
        "recentEvents",
        "quests",
      ],
      "snapshot",
    );
    if (input.version !== SNAPSHOT_VERSION)
      fail("INCOMPATIBLE_SNAPSHOT", "Unsupported snapshot version");
    if (input.catalogKey !== catalogKey || input.dedupeCapacity !== capacity)
      fail(
        "INCOMPATIBLE_SNAPSHOT",
        "Snapshot catalog or dedupe capacity differs",
      );
    const seq = integer(
      input.sequence,
      0,
      Number.MAX_SAFE_INTEGER,
      "snapshot.sequence",
    );
    const candidateRecent = new Map();
    let last = 0;
    for (const e of array(input.recentEvents, 0, capacity, "recentEvents")) {
      keys(e, ["id", "sequence"], "recent event");
      string(e.id, "recent event.id");
      integer(e.sequence, 1, seq, "recent event.sequence");
      if (e.sequence <= last || candidateRecent.has(e.id))
        fail(
          "INVALID_SNAPSHOT",
          "Retained event IDs and sequences must be unique and ordered",
        );
      candidateRecent.set(e.id, e.sequence);
      last = e.sequence;
    }
    const candidate = new Map(),
      exclusiveSequences = new Set();
    const reserve = (n) => {
      if (
        exclusiveSequences.has(n) ||
        [...candidateRecent.values()].includes(n)
      )
        fail(
          "INVALID_SNAPSHOT",
          "Activation/claim sequence cannot share another operation",
        );
      exclusiveSequences.add(n);
    };
    array(
      input.quests,
      catalog.length,
      catalog.length,
      "snapshot.quests",
    ).forEach((s, qi) => {
      keys(
        s,
        ["id", "status", "activatedAt", "counters", "receipt"],
        "quest state",
      );
      const q = catalog[qi];
      if (s.id !== q.id)
        fail(
          "INVALID_SNAPSHOT",
          "Quest states must match catalog order and IDs",
        );
      if (!["idle", "active", "completed", "claimed"].includes(s.status))
        fail("INVALID_SNAPSHOT", "Invalid quest status");
      array(
        s.counters,
        q.objectives.length,
        q.objectives.length,
        "counters",
      ).forEach((c, i) => {
        keys(c, ["id", "count"], "counter");
        if (c.id !== q.objectives[i].id)
          fail("INVALID_SNAPSHOT", "Counter IDs must match definition order");
        integer(c.count, 0, q.objectives[i].target, "counter.count");
      });
      const allDone = s.counters.every(
        (c, i) => c.count === q.objectives[i].target,
      );
      if (s.status === "idle") {
        if (
          s.activatedAt !== null ||
          s.receipt !== null ||
          s.counters.some((c) => c.count)
        )
          fail("INVALID_SNAPSHOT", "Idle quest contains progress");
      } else {
        integer(s.activatedAt, 1, seq, "activatedAt");
        reserve(s.activatedAt);
        if (s.status === "active") {
          if (allDone || s.receipt !== null)
            fail("INVALID_SNAPSHOT", "Active quest has completion data");
        } else {
          if (!allDone)
            fail(
              "INVALID_SNAPSHOT",
              "Completed quest contains incomplete counters",
            );
          const r = s.receipt;
          keys(
            r,
            ["id", "questId", "completedAt", "eventId", "claimedAt"],
            "receipt",
          );
          integer(r.completedAt, s.activatedAt + 1, seq, "completedAt");
          string(r.eventId, "receipt.eventId");
          if (r.questId !== q.id || r.id !== `${q.id}@${r.completedAt}`)
            fail("INVALID_SNAPSHOT", "Receipt identity does not match quest");
          if (
            candidateRecent.has(r.eventId) &&
            candidateRecent.get(r.eventId) < r.completedAt
          )
            fail(
              "INVALID_SNAPSHOT",
              "Retained event predates its completion receipt",
            );
          if (s.status === "completed" && r.claimedAt !== null)
            fail(
              "INVALID_SNAPSHOT",
              "Unclaimed completion has a claim sequence",
            );
          if (s.status === "claimed") {
            integer(r.claimedAt, r.completedAt + 1, seq, "claimedAt");
            reserve(r.claimedAt);
          }
        }
      }
      candidate.set(s.id, copy(s));
    });
    const completionEvents = new Map();
    for (const s of candidate.values()) {
      if (s.activatedAt !== null)
        for (const id of byId.get(s.id).prerequisites) {
          const prerequisite = candidate.get(id);
          if (
            !prerequisite.receipt ||
            prerequisite.receipt.completedAt >= s.activatedAt
          )
            fail(
              "INVALID_SNAPSHOT",
              "Quest activated before prerequisites completed",
            );
        }
      if (s.receipt) {
        const r = s.receipt;
        if (exclusiveSequences.has(r.completedAt))
          fail(
            "INVALID_SNAPSHOT",
            "Completion cannot share an activation/claim sequence",
          );
        const retained = [...candidateRecent].find(
          ([, n]) => n === r.completedAt,
        );
        if (retained && retained[0] !== r.eventId)
          fail(
            "INVALID_SNAPSHOT",
            "Completion event does not match retained event",
          );
        if (
          completionEvents.has(r.completedAt) &&
          completionEvents.get(r.completedAt) !== r.eventId
        )
          fail(
            "INVALID_SNAPSHOT",
            "Completions at one sequence must share an event",
          );
        completionEvents.set(r.completedAt, r.eventId);
      }
    }
    states = candidate;
    recent = candidateRecent;
    sequence = seq;
    return list();
  }
  function list() {
    return catalog.map((q) => get(q.id));
  }
  if (options.snapshot !== undefined) restore(options.snapshot);
  return Object.freeze({
    get,
    list,
    activate,
    dispatch,
    claim,
    snapshot,
    restore,
  });
}
