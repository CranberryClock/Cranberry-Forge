# Wayfinder

**A little direction for worlds worth wandering.** `@cranberry-forge/wayfinder` is a bounded weighted XZ grid navigator. It combines deterministic A* search, world/cell mapping, atomic terrain edits, explicit corner policies, and validated JSON snapshots in a small independent runtime.

Version **0.1.0** · ESM · JavaScript + TypeScript declarations · Zero runtime dependencies · MIT

## Moonpost Dispatch

Run the repository locally and open `/wayfinder.html` to explore a floating tiled courier garden. Choose a delivery tile, paint blocking planters, or plant costly lavender. The route recalculates immediately and a small courier follows its cell-center points. Try the winding maze or the sealed garden, change diagonal policy, and export or import your arrangement. The keyboard/touch cell map offers the same controls as the 3D canvas. Decorative arches, stairs, buildings, and satellite terraces sit outside the navigable grid.

The showcase uses Three.js; the package does not. Its runtime imports no renderer, framework, storage provider, or other Cranberry Forge tool.

## Install

Run `npm pack ./dist/packages/wayfinder` from the repository and install the resulting archive in your game project:

```sh
npm install ./cranberry-forge-wayfinder-0.1.0.tgz
```

The archive is an installable npm package. This documentation does not assume publication to the public npm registry.

```js
import { Wayfinder } from '@cranberry-forge/wayfinder';

const garden = new Wayfinder({
  width: 12,
  height: 10,
  cellSize: 1.35,
  origin: { x: -8.1, z: -6.75 },
  diagonal: 'no-cut',
});

garden.setCells([
  { x: 3, z: 2, blocked: true },
  { x: 4, z: 3, cost: 5 },
]);

const route = garden.findPath({ x: 1, z: 8 }, { x: 10, z: 1 }, { y: 1.05 });
if (route.status === 'found') {
  console.log(route.cost, route.visited);
  console.log(route.cells);  // [{ x, z }, ...], including start and goal
  console.log(route.points); // [{ x, y, z }, ...], at cell centers
}
```

## The navigation contract

- One rectangular, single-layer XZ grid. Coordinates are zero-based `{ x, z }` integer indices. `origin` is the lower X/Z boundary, not the first cell center. World bounds include the lower edge and exclude the upper edge.
- Entering a neighboring cell costs its weight × `cellSize` × step length. Cardinal step length is 1; diagonal step length is √2. The starting cell's weight is not charged. Weights must be finite numbers in 1–1,000.
- `diagonal: 'never'` allows four neighbors. `'no-cut'`, the default, allows diagonals only when both adjacent cardinal cells are open. `'always'` allows diagonal movement past blocked corners. All policies still forbid entering blocked cells.
- A* uses Manhattan or octile distance with the minimum allowed weight of 1. Its heuristic remains admissible as terrain weights change. An indexed binary heap holds at most one open entry per cell.
- Ties compare total estimate `f`, then heuristic `h`, then row-major cell index. Equal-cost alternate parents do not replace the first parent. Repeating a search with the same grid and endpoints gives the same result in the same JavaScript numeric environment.
- A successful search returns an optimal weighted route on this graph, subject to ordinary floating-point arithmetic. An unsuccessful search returns an explicit status and no partial route. A bounded search may return `budget-exceeded` even when a route exists.

## Edit terrain and replan

```js
const previous = garden.findPath({ x: 1, z: 8 }, { x: 10, z: 1 });
garden.setCell({ x: 5, z: 4 }, { blocked: true });

if (previous.revision !== garden.revision) {
  // The old route describes an earlier terrain revision. Search again.
  const current = garden.findPath({ x: 1, z: 8 }, { x: 10, z: 1 });
}
```

`setCells()` validates the whole batch before changing any cell. Duplicate cell edits, sparse arrays, and malformed patches reject atomically. A changed batch increments revision once; an empty or unchanged batch does not increment it. Blocking a cell retains its cost until you change it. Clear both explicitly with `{ blocked: false, cost: 1 }` when that is the intended edit.

Routes are detached values, not live objects. Terrain edits do not automatically recompute old routes or stop an actor. Your game decides when to replan and how to move safely. A revision is local to a grid's history; loading an older snapshot or constructing a new grid can reuse an old revision number. It is not a globally unique map identity.

## World coordinates

```js
const cell = garden.worldToCell({ x: pointerWorldX, z: pointerWorldZ });
if (cell) {
  const center = garden.cellToWorld(cell, 1.05);
  console.log(center); // plain { x, y, z }
}

const route = garden.findWorldPath(
  { x: courier.position.x, z: courier.position.z },
  { x: destination.position.x, z: destination.position.z },
);
```

Pass plain XZ records, not `THREE.Vector3` instances. A world search maps its endpoints to containing cells; returned points are cell centers, not the exact input endpoints. Y is a chosen output height and does not affect navigation.

## Saves

```js
const text = JSON.stringify(garden.snapshot());
const restored = Wayfinder.fromSnapshot(JSON.parse(text));
garden.restore(JSON.parse(text)); // atomic; config must match this instance
```

Version 1 saves contain the complete normalized grid configuration, revision, and a dense row-major array of blocked flags and weights. Loading validates version, dimensions, limits, exact fields, and every cell before replacing the current terrain. Inputs and outputs do not expose mutable internal arrays. `fromSnapshot()` creates a grid from the saved configuration; `restore()` requires the current configuration to match. There is no automatic schema migration, merging, storage, or authentication. Snapshot validation checks structural validity, not whether an untrusted player earned a terrain change.

## Practical limits

| Item | Bound |
| --- | --- |
| Width / height | Integers 1–128 each |
| Total cells | At most 16,384 |
| Cell size | Finite 0.001–1,000 world units |
| Origin X/Z and output Y | Finite −1,000,000 to 1,000,000 |
| Traversal weight | Finite 1–1,000, including fractional values |
| Batch edits | At most one edit per grid cell |
| Search budget | 1–cell count expanded cells; default cell count |
| Revision | Safe integer; exhaustion throws before terrain changes |

Search uses O(N) bounded working storage and O(N log N) worst-case heap work for N cells on this constant-degree grid. It runs synchronously; repeated maximum-size searches can still block a UI thread. The maximum is a validation limit, not a frame-time guarantee. Put larger workloads behind an application-owned worker if needed. The package stores no route cache or search history. The demo displays 120 cells and rejects uploaded files larger than 2 MB.

## Where it fits

A* and weighted grids are established techniques. Wayfinder's value is the grid-specific integration contract: deterministic results, explicit diagonal semantics, world mapping, bounded edits/searches, and portable validated saves. It is not a new pathfinding algorithm or a general navigation mesh system.

| Tool | Documented focus | A useful fit |
| --- | --- | --- |
| [three-pathfinding](https://github.com/donmccurdy/three-pathfinding) | Paths on 3D navigation meshes, zones, and movement clamping for Three.js | Imported navigation geometry and movement over irregular walkable surfaces. |
| [Yuka](https://github.com/Mugen87/yuka) | Game AI including steering, agent design, graph search, navigation meshes, and JSON state | Projects needing a broader engine-independent AI system. |
| Wayfinder | Weighted single-layer XZ grids with small, explicit editing and save APIs | Tile gardens, tactical boards, floor layouts, and prototype worlds whose traversability is naturally cell based. |

Primary sources reviewed on September 8, 2026. This is a comparison of documented focus, not a feature-exclusivity claim or performance benchmark. Wayfinder does not handle slopes, multiple floors, agent radius, collision physics, path smoothing, crowd avoidance, steering, or navigation mesh generation. Reserve sufficient blocked-cell clearance for your actor and keep the visual movement consistent with the grid.

## Documentation and verification

- [API reference](./API.md)
- [Moonpost integration tutorial](./TUTORIAL.md)
- [MIT license](./LICENSE)

The Cranberry Forge repository includes nine meaningful runtime tests in `tests/wayfinder.test.mjs`, including comparison against an independent Dijkstra oracle on 45 seeded weighted grids across all diagonal policies. Other checks cover deterministic ties, entry costs, world boundaries, budgets/statuses, atomic edits, snapshots, sparse inputs, and revision exhaustion. Public declaration usage is checked in `tests/wayfinder-types.ts`.

```sh
node --test tests/wayfinder.test.mjs
```
