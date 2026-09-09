# Ledger

Explainable stats and loadout comparisons. Independent ES module, zero runtime dependencies, no renderer or clock.

## Install

Packages are distributed as source/archive, not published to npm.

```sh
npm pack ./dist/packages/ledger
npm install /path/to/cranberry-forge-ledger-0.1.0.tgz
```

Requires Node 22+ for Node examples, or a modern browser supporting structuredClone.

## API

`evaluateStats({ base, modifiers = [], bounds = {}, rounding = null })` returns `{ values, explanations }`. All calls are synchronous. Invalid inputs throw TypeError or RangeError.

- base: record of named finite numbers.
- modifier: `{ id, source, stat, kind, value }`. IDs must be unique. stat must exist in base. kind is flat, additivePercent, or multiplier. Percentages use fractions: 0.2 = 20%.
- bounds: per-stat `{ min?, max? }`, finite and ordered.
- rounding: null (no rounding) or 0–10 decimal places.

The arithmetic order is:

```text
(base + sum(flat)) × (1 + sum(additivePercent)) × product(multiplier)
→ clamp → optional decimal rounding → clamp again
```

The final clamp preserves non-rounded caps. Values can be negative or zero; game-specific restrictions belong in bounds or the host. Numeric overflow throws. Modifiers are sorted by ID using code-unit ordering for stable results independent of insertion order; floating-point arithmetic is not cross-language fixed-point simulation.

An explanation contains base, flat, additivePercent, multiplier, afterFlat, afterAdditive, raw, clamped, value, and sorted source modifiers. This is a calculation breakdown, not an attribution of nonlinear effects as independent additive amounts.

`new Ledger(config)` provides `.result`, `.setModifier(modifier)`, `.removeSource(source)` and `.snapshot()`. setModifier replaces an existing ID atomically. All modifiers stack through the documented formula unless their IDs are replaced. Snapshots and results are detached; construct a new Ledger from a snapshot to restore.

`compareLoadouts(config, [{ id, modifiers }])` evaluates caller-provided candidates in input order. Candidate modifiers combine with config.modifiers; duplicate modifier IDs throw. It does not enumerate or optimize all possible gear combinations.

## Example

```js
import { Ledger } from "@cranberry-forge/ledger";
const stats = new Ledger({ base: { attack: 50, speed: 3 }, rounding: 2 });
stats.setModifier({
  id: "blade:attack",
  source: "blade",
  stat: "attack",
  kind: "flat",
  value: 10,
});
console.log(stats.result.values.attack); // 60
stats.removeSource("blade"); // attack returns to 50
```

[Step-by-step tutorial](TUTORIAL.md) · [Runnable Node example](examples/demo.mjs)

## Boundaries

No damage model, ECS, timed effects, formula-string evaluation, or dependency on other Forge packages. The Three.js proving ground lives outside this package. MIT licensed.
