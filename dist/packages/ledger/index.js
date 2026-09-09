/** Explainable, deterministic stat arithmetic. No renderer, timers or shared state. */
const own = (o, k) => Object.hasOwn(o, k);
const id = (v, label) => {
  if (typeof v !== "string" || !v.trim())
    throw new TypeError(`${label} must be a nonempty string`);
};
const number = (v, label) => {
  if (!Number.isFinite(v)) throw new TypeError(`${label} must be finite`);
  return v;
};
const record = (v, label) => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new TypeError(`${label} must be an object`);
};
const order = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** (base + flat) × (1 + additivePercent) × multipliers; clamp, then round. */
export function evaluateStats({
  base,
  modifiers = [],
  bounds = {},
  rounding = null,
} = {}) {
  record(base, "base");
  record(bounds, "bounds");
  if (!Array.isArray(modifiers))
    throw new TypeError("modifiers must be an array");
  if (
    rounding !== null &&
    (!Number.isInteger(rounding) || rounding < 0 || rounding > 10)
  )
    throw new RangeError("rounding must be null or an integer from 0 to 10");
  const keys = Object.keys(base).sort();
  for (const k of keys) {
    id(k, "stat");
    number(base[k], k);
  }
  for (const [k, b] of Object.entries(bounds)) {
    if (!own(base, k)) throw new TypeError(`Unknown bounded stat: ${k}`);
    record(b, `bounds.${k}`);
    if (b.min !== undefined) number(b.min, "min");
    if (b.max !== undefined) number(b.max, "max");
    if ((b.min ?? -Infinity) > (b.max ?? Infinity))
      throw new RangeError(`Inverted bounds: ${k}`);
  }
  const ids = new Set();
  const sorted = Array.from(modifiers, (m) => {
    record(m, "modifier");
    id(m.id, "modifier.id");
    id(m.source, "modifier.source");
    id(m.stat, "modifier.stat");
    if (ids.has(m.id)) throw new TypeError(`Duplicate modifier ID: ${m.id}`);
    ids.add(m.id);
    if (!own(base, m.stat)) throw new TypeError(`Unknown stat: ${m.stat}`);
    if (!["flat", "additivePercent", "multiplier"].includes(m.kind))
      throw new TypeError(`Unknown modifier kind: ${m.kind}`);
    number(m.value, "modifier.value");
    return {
      id: m.id,
      source: m.source,
      stat: m.stat,
      kind: m.kind,
      value: m.value,
    };
  }).sort(order);
  const values = {},
    explanations = {};
  for (const key of keys) {
    const sources = sorted.filter((m) => m.stat === key);
    const sum = (kind) =>
      sources
        .filter((m) => m.kind === kind)
        .reduce((n, m) => number(n + m.value, "sum overflow"), 0);
    const flat = sum("flat"),
      additivePercent = sum("additivePercent");
    const multiplier = sources
      .filter((m) => m.kind === "multiplier")
      .reduce((n, m) => number(n * m.value, "product overflow"), 1);
    const afterFlat = number(base[key] + flat, "flat overflow");
    const afterAdditive = number(
      afterFlat * (1 + additivePercent),
      "additive overflow",
    );
    const raw = number(afterAdditive * multiplier, "stat overflow");
    const b = bounds[key] ?? {};
    const clamp = (n) =>
      Math.min(b.max ?? Infinity, Math.max(b.min ?? -Infinity, n));
    const clamped = clamp(raw);
    // Reapply bounds after decimal rounding so rounding cannot violate a cap.
    const value = clamp(
      rounding === null ? clamped : Number(clamped.toFixed(rounding)),
    );
    Object.defineProperty(values, key, { value, enumerable: true });
    Object.defineProperty(explanations, key, {
      value: {
        base: base[key],
        flat,
        additivePercent,
        multiplier,
        afterFlat,
        afterAdditive,
        raw,
        clamped,
        value,
        sources,
      },
      enumerable: true,
    });
  }
  return { values, explanations };
}

/** Stateful convenience; updates validate a candidate before changing live state. */
export class Ledger {
  #config;
  constructor(config) {
    evaluateStats(config);
    this.#config = structuredClone(config);
  }
  get result() {
    return evaluateStats(this.#config);
  }
  setModifier(modifier) {
    const next = {
      ...this.#config,
      modifiers: [
        ...(this.#config.modifiers ?? []).filter((m) => m.id !== modifier?.id),
        modifier,
      ],
    };
    const result = evaluateStats(next);
    this.#config = structuredClone(next);
    return result;
  }
  removeSource(source) {
    id(source, "source");
    this.#config.modifiers = (this.#config.modifiers ?? []).filter(
      (m) => m.source !== source,
    );
    return this.result;
  }
  snapshot() {
    return structuredClone(this.#config);
  }
}

/** Caller provides candidates. This does not search or rank an unbounded space. */
export function compareLoadouts(config, loadouts) {
  if (!Array.isArray(loadouts))
    throw new TypeError("loadouts must be an array");
  const ids = new Set();
  return Array.from(loadouts, (loadout) => {
    id(loadout.id, "loadout.id");
    if (ids.has(loadout.id))
      throw new TypeError(`Duplicate loadout ID: ${loadout.id}`);
    ids.add(loadout.id);
    if (!Array.isArray(loadout.modifiers))
      throw new TypeError("loadout.modifiers must be an array");
    return {
      id: loadout.id,
      ...evaluateStats({
        ...config,
        modifiers: [...(config.modifiers ?? []), ...loadout.modifiers],
      }),
    };
  });
}
