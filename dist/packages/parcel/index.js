/** Parcel: deterministic flat loot tables. No renderer, storage, clocks or dependencies. */
export const VERSION = "0.1.0";
export const SNAPSHOT_VERSION = 1;
export const LIMITS = Object.freeze({
  entries: 256,
  weight: 1_000_000,
  quantity: 1_000_000,
  batch: 10_000,
  pity: 10_000,
  rolls: 1_000_000_000,
  draws: 4_294_967_295,
});
const UINT = 4_294_967_296,
  STEP = 0x6d2b79f5;
const clone = (value) => JSON.parse(JSON.stringify(value));
export class ParcelError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ParcelError";
    this.code = code;
  }
}
const fail = (code, message) => {
  throw new ParcelError(code, message);
};
function object(value, allowed, name) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    fail("INVALID_INPUT", `${name} must be a plain object`);
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      fail("INVALID_INPUT", `${name}: unknown field ${key}`);
}
function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail("INVALID_INPUT", `${name} must be an integer in ${min}..${max}`);
  return value;
}
function identifier(value, name) {
  if (
    typeof value !== "string" ||
    !/^[a-z][a-z0-9_-]{0,63}$/.test(value) ||
    ["constructor", "prototype", "__proto__"].includes(value)
  )
    fail(
      "INVALID_INPUT",
      `${name} must be a safe lowercase identifier (1–64 characters)`,
    );
  return value;
}
function list(value, min, max, name) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    fail("INVALID_INPUT", `${name} must contain ${min}..${max} entries`);
  for (let i = 0; i < value.length; i++)
    if (!Object.hasOwn(value, i))
      fail("INVALID_INPUT", `${name} must not contain holes`);
  return value;
}
export function validateTable(input) {
  object(input, ["id", "entries", "pity"], "table");
  const seen = new Set();
  const entries = list(input.entries, 1, LIMITS.entries, "entries").map(
    (entry) => {
      object(
        entry,
        ["id", "itemId", "label", "rarity", "weight", "min", "max"],
        "entry",
      );
      const id = identifier(entry.id, "entry.id"),
        min = integer(
          entry.min === undefined ? 1 : entry.min,
          1,
          LIMITS.quantity,
          "entry.min",
        );
      if (seen.has(id)) fail("INVALID_TABLE", "Entry IDs must be unique");
      seen.add(id);
      const label = entry.label === undefined ? id : entry.label;
      if (typeof label !== "string" || !label.trim() || label.length > 120)
        fail(
          "INVALID_INPUT",
          "label must be a nonblank string of at most 120 characters",
        );
      return {
        id,
        itemId: identifier(entry.itemId, "itemId"),
        label,
        rarity: identifier(entry.rarity, "rarity"),
        weight: integer(entry.weight, 0, LIMITS.weight, "weight"),
        min,
        max: integer(
          entry.max === undefined ? min : entry.max,
          min,
          LIMITS.quantity,
          "entry.max",
        ),
      };
    },
  );
  if (!entries.some((e) => e.weight > 0))
    fail("INVALID_TABLE", "At least one entry must have positive weight");
  let pity = null;
  if (input.pity !== undefined && input.pity !== null) {
    object(input.pity, ["after", "rarities"], "pity");
    const rarities = list(
      input.pity.rarities,
      1,
      LIMITS.entries,
      "pity.rarities",
    ).map((r) => identifier(r, "pity rarity"));
    if (new Set(rarities).size !== rarities.length)
      fail("INVALID_TABLE", "Pity rarities must be unique");
    if (
      rarities.some((r) => !entries.some((e) => e.rarity === r && e.weight > 0))
    )
      fail(
        "INVALID_TABLE",
        "Every pity rarity must have a positive-weight entry",
      );
    pity = {
      after: integer(input.pity.after, 1, LIMITS.pity, "pity.after"),
      rarities: rarities.sort(),
    };
  }
  return { id: identifier(input.id, "table.id"), entries, pity };
}

/** One weighted entry per roll. open(n) is atomic and equivalent to n roll() calls. */
export function createParcel(input, options = {}) {
  object(options, ["seed", "snapshot"], "options");
  const table = validateTable(input),
    tableKey = JSON.stringify(table);
  const seed = integer(
    options.seed === undefined ? 1 : options.seed,
    0,
    UINT - 1,
    "seed",
  );
  let state = { seed, rngState: seed, draws: 0, rolls: 0, misses: 0 };
  const normal = table.entries.filter((e) => e.weight > 0),
    total = normal.reduce((n, e) => n + e.weight, 0);
  const eligible = table.pity
    ? normal.filter((e) => table.pity.rarities.includes(e.rarity))
    : [];
  const eligibleWeight = eligible.reduce((n, e) => n + e.weight, 0);
  const forced = (s) => Boolean(table.pity && s.misses >= table.pity.after - 1);
  function word(draft) {
    if (draft.draws === LIMITS.draws)
      fail("LIMIT_REACHED", "Random draw limit reached");
    draft.draws++;
    draft.rngState = (draft.rngState + STEP) >>> 0;
    let t = draft.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  function uniform(draft, bound) {
    const ceiling = Math.floor(UINT / bound) * bound;
    for (let i = 0; i < 128; i++) {
      const value = word(draft);
      if (value < ceiling) return value % bound;
    }
    fail("LIMIT_REACHED", "Random rejection budget reached");
  }
  function snapshot() {
    return { version: SNAPSHOT_VERSION, tableKey, ...state };
  }
  function restore(value) {
    object(
      value,
      ["version", "tableKey", "seed", "rngState", "draws", "rolls", "misses"],
      "snapshot",
    );
    if (value.version !== SNAPSHOT_VERSION || value.tableKey !== tableKey)
      fail(
        "INCOMPATIBLE_SNAPSHOT",
        "Snapshot version or normalized table differs",
      );
    const next = {
      seed: integer(value.seed, 0, UINT - 1, "snapshot.seed"),
      rngState: integer(value.rngState, 0, UINT - 1, "snapshot.rngState"),
      draws: integer(value.draws, 0, LIMITS.draws, "snapshot.draws"),
      rolls: integer(value.rolls, 0, LIMITS.rolls, "snapshot.rolls"),
      misses: integer(
        value.misses,
        0,
        table.pity ? table.pity.after - 1 : 0,
        "snapshot.misses",
      ),
    };
    if (
      next.rngState !== (next.seed + Math.imul(next.draws, STEP)) >>> 0 ||
      next.draws < next.rolls * 2 ||
      next.draws > next.rolls * 256 ||
      next.misses > next.rolls ||
      (eligible.length === normal.length && next.misses !== 0)
    )
      fail("INVALID_SNAPSHOT", "Inconsistent PRNG, roll or pity counters");
    state = next;
    return snapshot();
  }
  function odds() {
    const guaranteed = forced(state),
      denominator = guaranteed ? eligibleWeight : total;
    return {
      guaranteed,
      misses: state.misses,
      remaining: table.pity ? table.pity.after - state.misses : null,
      entries: table.entries.map((e) => ({
        ...e,
        probability:
          guaranteed && !table.pity.rarities.includes(e.rarity)
            ? 0
            : e.weight / denominator,
        baseProbability: e.weight / total,
      })),
    };
  }
  function open(count = 1) {
    integer(count, 1, LIMITS.batch, "count");
    if (state.rolls + count > LIMITS.rolls)
      fail("LIMIT_REACHED", "Roll limit reached");
    const draft = { ...state },
      receipts = [];
    for (let i = 0; i < count; i++) {
      const guaranteed = forced(draft),
        pool = guaranteed ? eligible : normal,
        denominator = guaranteed ? eligibleWeight : total;
      let cursor = uniform(draft, denominator),
        selected = pool[pool.length - 1];
      for (const entry of pool) {
        if (cursor < entry.weight) {
          selected = entry;
          break;
        }
        cursor -= entry.weight;
      }
      const quantity =
          selected.min + uniform(draft, selected.max - selected.min + 1),
        missesBefore = draft.misses;
      draft.misses =
        !table.pity || table.pity.rarities.includes(selected.rarity)
          ? 0
          : draft.misses + 1;
      draft.rolls++;
      receipts.push({
        id: `${table.id}:${draft.rolls}`,
        roll: draft.rolls,
        entryId: selected.id,
        itemId: selected.itemId,
        label: selected.label,
        rarity: selected.rarity,
        quantity,
        guaranteed,
        probability: selected.weight / denominator,
        baseProbability: selected.weight / total,
        missesBefore,
        missesAfter: draft.misses,
      });
    }
    state = draft;
    return { receipts, snapshot: snapshot() };
  }
  function roll() {
    const result = open();
    return { receipt: result.receipts[0], snapshot: result.snapshot };
  }
  if (Object.hasOwn(options, "snapshot")) {
    restore(options.snapshot);
    if (Object.hasOwn(options, "seed") && state.seed !== seed)
      fail("INCOMPATIBLE_SNAPSHOT", "Supplied seed differs from saved seed");
  }
  return Object.freeze({ roll, open, odds, snapshot, restore });
}
