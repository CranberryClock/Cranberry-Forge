# Wayfinder API · 0.1.0

Import every runtime export from `@cranberry-forge/wayfinder`. The package is native ESM, runs on Node.js 18+ and modern browsers, and has no runtime dependencies.

## Exports

| Export | Description |
| --- | --- |
| `Wayfinder` | Grid constructor and navigation API. |
| `WayfinderError` | Error subclass with stable `code`. |
| `VERSION` | `"0.1.0"`. |
| `SNAPSHOT_VERSION` | `1`. |
| `LIMITS` | Frozen public validation bounds. |

## Constructor and configuration

```ts
new Wayfinder({
  width: number,       // integer 1..128
  height: number,      // integer 1..128
  cellSize?: number,   // default 1; 0.001..1000
  origin?: { x: number; z: number }, // default { x: 0, z: 0 }
  diagonal?: 'never' | 'no-cut' | 'always', // default 'no-cut'
  defaultCost?: number // default 1; 1..1000
});
```

All cells initially have `blocked: false` and the configured `defaultCost`. Configuration is immutable for the lifetime of the instance. To change dimensions, scale, origin, default weight, or diagonal policy, construct a new grid and explicitly transfer the desired cell state. The showcase preserves terrain when switching movement policy and starts a new revision history.

| Property | Value |
| --- | --- |
| `config` | Detached normalized configuration, with all optional fields filled in. |
| `size` | Width × height. |
| `revision` | Current logical terrain revision, initially 0. |

Inputs are plain data records with only the documented fields. NaN, infinities, unsupported keys, custom prototypes, noninteger cell coordinates, and sparse arrays are rejected. Accessors and proxies are outside the JSON-data contract. Data passed from another JavaScript realm should be serialized/parsed into the receiving realm first.

## Cell access and atomic edits

### `getCell(cell: {x, z}): CellState`

Returns a detached `{ x, z, blocked, cost }`. Coordinates outside the grid throw `OUTSIDE_GRID`.

### `setCell(cell, patch): number`

`patch` has `blocked?: boolean` and/or `cost?: number`. At least one field is required. Returns the resulting revision. This is a one-entry atomic batch.

### `setCells(edits: readonly CellEdit[]): number`

Each edit is `{ x, z, blocked?, cost? }`. A batch can contain at most `size` entries; each cell may occur once. An empty array is allowed. The entire dense batch is validated before any mutation. One or more changed values increments revision once; an unchanged batch returns the existing revision. The original inputs are not stored as live state.

```js
grid.setCells([
  { x: 2, z: 4, blocked: true },
  { x: 3, z: 4, cost: 2.5 },
  { x: 4, z: 4, blocked: false, cost: 1 },
]);
```

Blocked cells retain weights. A failed batch never partly edits the grid. Revision exhaustion throws before applying changes; unchanged batches still succeed at the maximum revision.

## World mapping

### `worldToCell(point: {x, z}): Cell | null`

Maps a finite world XZ point into the cell containing it. The rectangle is `[origin.x, origin.x + width × cellSize)` by `[origin.z, origin.z + height × cellSize)`. Outside points return `null`. This is ordinary floating-point mapping without a configurable tolerance. Cell boundaries may inherit representation rounding for noninteger scales; keep gameplay points away from ambiguous boundaries when exact classification matters.

### `cellToWorld(cell, y = 0): {x, y, z}`

Returns the cell center. X is `origin.x + (cell.x + 0.5) × cellSize`; Z is analogous. Y must be finite and within ±1,000,000; it is a presentation height, not a navigated dimension. Outside cells throw.

## Search

### `findPath(start: Cell, goal: Cell, options?): RouteResult`

`options` supports `maxVisited?: number` (integer 1..size, default size) and `y?: number` (default 0). Search is synchronous and never mutates terrain/revision. All returned objects and arrays are detached.

```ts
interface RouteResult {
  status: 'found' | 'outside-grid' | 'blocked-start' | 'blocked-goal'
        | 'unreachable' | 'budget-exceeded';
  cells: { x: number; z: number }[];
  points: { x: number; y: number; z: number }[];
  cost: number | null;
  visited: number;
  revision: number;
}
```

| Status | Meaning |
| --- | --- |
| `found` | A complete route including both endpoints; cost is numeric. |
| `outside-grid` | At least one valid integer endpoint lies outside bounds. |
| `blocked-start` | Start cell is blocked; takes precedence if both endpoints are blocked. |
| `blocked-goal` | Goal cell is blocked. |
| `unreachable` | The reachable frontier was exhausted. |
| `budget-exceeded` | The expansion limit was reached while frontier work remained. A route may still exist. |

All unsuccessful statuses have empty `cells`/`points` and `cost: null`. Endpoint failures report `visited: 0`. A valid open start equal to goal is found with one cell, cost 0, and one visited cell. `visited` counts expanded heap entries, including the goal when found. `maxVisited` bounds search expansion; it is not elapsed time. There is no nearest reachable endpoint or partial path fallback.

Costs use **destination** weights. A route's cost is the sum over its edges of `destination.cost × cellSize × (diagonal ? √2 : 1)`. Weights need not be integers. Costs are directional: entering an expensive endpoint costs more than leaving it, and starting-cell weight is excluded.

`no-cut` checks both cardinal neighbors for diagonal clearance. `always` intentionally permits squeezing through diagonally touching blocked cells; use it only when that matches your game's movement rules. No policy accounts for actor radius.

Ties compare `g+h`, then `h`, then `z × width + x`. On equal tentative cost, the previous parent is retained. Neighbor enumeration is north, west, east, south, then northwest, northeast, southwest, southeast for diagonal policies. An indexed heap supports decrease-key without accumulating stale duplicate nodes. Closed cells are not reopened because the chosen lower-bound heuristic is consistent with allowed weights, subject to floating-point precision.

### `findWorldPath(start: WorldXZ, goal: WorldXZ, options?): RouteResult`

Maps both world endpoints using `worldToCell()` and delegates to cell search. Outside world points return `outside-grid`. Pass `{ x, z }` records; extra Y fields and Three.js instances are not accepted by this strict runtime. Output points are cell centers. The input's fractional in-cell offset is not retained.

## Snapshots

### `snapshot(): WayfinderSnapshot`

```ts
interface WayfinderSnapshot {
  version: 1;
  config: {
    width: number; height: number; cellSize: number;
    origin: { x: number; z: number };
    diagonal: 'never' | 'no-cut' | 'always';
    defaultCost: number;
  };
  revision: number;
  cells: { blocked: boolean; cost: number }[];
}
```

Cells are dense and row-major: index `z × width + x`. A snapshot stores terrain, not search internals, actors, cached routes, or history. The returned value is suitable for `JSON.stringify()` and safe to edit without affecting the grid.

### `restore(snapshot: unknown): this`

Checks schema, complete configuration, cell count, dense arrays, every blocked flag/weight, and revision bounds before replacing terrain. The normalized saved configuration must equal this instance's configuration. Unknown fields and missing snapshot fields reject. Failure leaves the current instance unchanged. Success restores the saved revision rather than incrementing it.

### `Wayfinder.fromSnapshot(snapshot: unknown): Wayfinder`

Constructs a new grid with the saved configuration, then runs the same restore validation. Use it when the current application has no matching grid yet. There is no implicit migration, format guessing, or integrity signature.

## Errors

`WayfinderError` has `name: 'WayfinderError'` and one of:

| Code | Cause |
| --- | --- |
| `INVALID_INPUT` | Malformed data, unknown/missing fields, sparse arrays, out-of-range values, duplicate edits, or invalid options. |
| `OUTSIDE_GRID` | An accessor/editor or `cellToWorld()` references an out-of-bounds cell. Search reports this condition as a result instead. |
| `INCOMPATIBLE_SNAPSHOT` | Unsupported schema version or a saved configuration different from the current grid. |
| `LIMIT_REACHED` | A changed edit would advance revision past `Number.MAX_SAFE_INTEGER`. |

Catch `code` rather than parsing message text. Application code owns file-size checks, JSON parsing, persistent storage, network transport, actor movement, collision safety, and presentation.
