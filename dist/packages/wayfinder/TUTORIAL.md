# Build Moonpost-style navigation

The package decides which cells form a route. Your application decides how the route is displayed and how a courier moves. This separation keeps the same grid useful in Three.js, a tactical board, or a server-side planner.

## 1. Describe the playable rectangle

```js
import { Wayfinder } from '@cranberry-forge/wayfinder';

const grid = new Wayfinder({
  width: 12,
  height: 10,
  cellSize: 1.35,
  origin: { x: -8.1, z: -6.75 },
  diagonal: 'no-cut',
});
let courier = { x: 1, z: 8 };
let destination = { x: 10, z: 1 };
```

The grid spans 16.2 by 13.5 world units. Its origin is the minimum corner. Tile centers are half a cell inward. The `no-cut` rule allows diagonals while requiring both neighboring cardinal tiles to be clear. Model obstacles conservatively if your character needs clearance; the navigator treats it as a point.

## 2. Add barriers and costly terrain

```js
grid.setCells([
  { x: 3, z: 2, blocked: true },
  { x: 3, z: 3, blocked: true },
  { x: 5, z: 6, cost: 5 },
  { x: 6, z: 6, cost: 5 },
]);
```

Planters block cells. Lavender is passable but multiplies the cost of entering its cell by five. A* may choose a longer geometric route if its total weighted cost is lower. The package does not slow your actor automatically; planning cost and animation speed are separate choices. Moonpost uses constant geometric courier speed and uses lavender weights to choose the route.

Use one batch for an editor transaction. Invalid edits do not leave a partially modified map. Clear a cell with `grid.setCell(cell, { blocked: false, cost: 1 })`. Blocking a cell alone does not erase its stored cost.

## 3. Turn a Three.js raycast into a destination

```js
// raycaster and tileMeshes belong to your application.
const hit = raycaster.intersectObjects(tileMeshes)[0];
if (hit) {
  const cell = grid.worldToCell({ x: hit.point.x, z: hit.point.z });
  if (cell && !grid.getCell(cell).blocked) {
    destination = cell;
  }
}

const route = grid.findPath(courier, destination, { y: 1.05 });
```

Do not pass `hit.point` directly: it is a Three.js vector with Y and a custom prototype, while Wayfinder expects a plain XZ record. A search result has plain world points suitable for your own line geometry or actor controller. The showcase's pick meshes also carry `userData.cell`, which avoids floating-point boundary ambiguity when a pointer directly selects a rendered tile.

## 4. Handle every outcome

```js
switch (route.status) {
  case 'found':
    displayRoute(route.points);
    showCost(route.cost);
    break;
  case 'budget-exceeded':
    showMessage('Search budget reached. Try a larger budget.');
    break;
  default:
    displayRoute([]);
    showMessage('This destination is not currently reachable.');
}
```

`displayRoute`, `showCost`, and `showMessage` are application functions. An unsuccessful result contains no partial route. Do not animate toward an unreachable goal using a stale previous path. A same-cell result is valid with zero cost; your UI can treat it as already delivered.

## 5. Replan when the garden changes

```js
let currentRoute = grid.findPath(courier, destination);

function paintPlanter(cell) {
  // Application rule: protect the courier and destination from blocking edits.
  if ((cell.x === courier.x && cell.z === courier.z) ||
      (cell.x === destination.x && cell.z === destination.z)) return;
  grid.setCell(cell, { blocked: true });
  currentRoute = grid.findPath(courier, destination);
  displayRoute(currentRoute.points);
}
```

Wayfinder does not retain routes or invoke callbacks. A terrain edit increments its revision, which lets you recognize routes produced before that edit in the same history. The Moonpost demo cancels a courier's current trip when terrain changes and replans from its last completed delivery stop. A production movement controller may instead choose the current safe cell, finish the current segment, or pause until an authoritative update.

The API does not model collisions, moving crowds, acceleration, multiple floors, slopes, or stairs. The showcase keeps buildings, arcades, stairs, and satellite terraces beyond the playable rectangle so the visuals agree with the single-layer grid contract.

## 6. Save terrain and application state separately

```js
const save = {
  version: 1,
  grid: grid.snapshot(),
  courier,
  destination,
};
localStorage.setItem('my-courier-garden', JSON.stringify(save));

// At an application load boundary:
const input = JSON.parse(localStorage.getItem('my-courier-garden'));
const restoredGrid = Wayfinder.fromSnapshot(input.grid);
// Validate your own wrapper version, courier, and destination before committing.
restoredGrid.getCell(input.courier);
restoredGrid.getCell(input.destination);
```

The package validates its grid snapshot. Your wrapper must validate its own fields and gameplay requirements, including whether endpoints may be blocked. Validate everything before replacing live application state. Handle JSON and storage failures. The demo enforces a 2 MB input limit and its fixed scene dimensions; the runtime itself supports up to 16,384 cells. A reset or restored older save can reuse revision numbers, so use an application-owned map identity when comparing separate histories.

## 7. Use the renderer-free sample scene

The scene factory is separate showcase source (`dist/wayfinder-scene.js`), not part of the standalone npm runtime exports:

```js
import * as THREE from 'three';
import { Wayfinder } from './packages/wayfinder/index.js';
import { createWayfinderScene, MOONPOST_CONFIG, moonpostPreset }
  from './wayfinder-scene.js';

const grid = new Wayfinder(MOONPOST_CONFIG);
grid.setCells(moonpostPreset('garden'));
const result = grid.findPath({ x: 1, z: 8 }, { x: 10, z: 1 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 16 / 9, .1, 350);
const world = createWayfinderScene({ scene, camera, bloom: {} }, {
  snapshot: grid.snapshot(),
  route: result.points,
  reducedMotion: true,
});
```

The factory creates geometry/lights and configures the camera/background/fog, but creates no renderer, DOM, or animation loop. It expects the fixed Moonpost 12×10 configuration with cell size 1.35 and origin (−8.1, −6.75). The npm runtime has no such fixed scene requirement. `moonpostPreset()` returns edits for `garden`, `switchback`, `sealed`, or `clear`.

| Scene member | Purpose |
| --- | --- |
| `root`, `pickables`, `courier` | Scene group, cell pick meshes, and visible courier group. |
| `setGrid(snapshot)` | Reconcile terrain and stop any active journey. |
| `setRoute(points)` | Replace the route visualization with exact straight segments. |
| `setCourier(point)`, `setGoal(point)` | Place presentation objects at world XZ positions. |
| `travel(points, onArrive?)` | Follow a detached point list at a fixed geometric speed. |
| `stop()` / `delivering` | Cancel a trip / inspect whether a trip is active. |
| `update(dt, elapsed)` | Advance scene decoration and the courier; call from your render loop. |
| `dispose()` | Release owned scene resources and remove the group. |

With `reducedMotion: true`, decoration stays static and dispatch places the courier at its destination immediately. The browser honors the user's reduced-motion setting, provides a keyboard/touch map, and avoids disposing its renderer during a back/forward-cache transition. The demo uses actual Three.js 0.180.0. Trailmark, inventory, and other Cranberry Forge tools are not runtime dependencies of Wayfinder.
