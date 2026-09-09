# @cranberry-forge/signal

Terrain-conforming combat telegraphs with matching gameplay footprints. Circles/rings, directional cones and beams. No dependency on Biome or Flux.

## Install

The package is not published on npm. Download the tarball from the workbench or run `npm pack ./dist/packages/signal` from the repository. In your game:

```sh
npm install three@0.180.0 /path/to/cranberry-forge-signal-0.1.0.tgz
```

ES modules, MIT license and TypeScript declarations. TypeScript consumers need compatible `@types/three`; targets r180 / WebGLRenderer. Uses ShaderMaterial, not WebGPU. See the root README for verification status.

## Tutorial: a boss cleave

```js
import * as THREE from 'three';
import { Telegraph } from '@cranberry-forge/signal';

const warning = new Telegraph({
  shape: 'cone', radius: 10, innerRadius: 0.5,
  angle: 75, color: '#a8a1ff', segments: 48
});
scene.add(warning);
warning.position.set(boss.position.x, 0, boss.position.z);
warning.rotation.y = boss.rotation.y;
warning.project((x,z) => terrain.getHeight(x,z));

const playerWorldPosition = new THREE.Vector3();
warning.addEventListener('complete', () => {
  player.getWorldPosition(playerWorldPosition);
  if (warning.containsPoint(playerWorldPosition)) {
    // Your game decides damage, vertical tolerance, teams and invulnerability.
    applyDamage(player, 10);
  }
  warning.visible = false;
});

warning.arm(elapsedSeconds, 3);
// Each frame, with a monotonically increasing clock in seconds:
warning.update(elapsedSeconds);
// On level cleanup: warning.dispose();
```

Run the repository server and open `/examples/signal.html` for a minimal standalone example: one warning, a heightfield and a moving target. The complete interactive workbench is `/signal.html`. Neither example requires another Cranberry Forge package.

## Options

| Field | Default | Meaning |
| --- | --- | --- |
| `shape` | `circle` | `circle`, `cone` or `beam`. |
| `radius` / `innerRadius` | `5` / `0` | Outer radius and safe center for circle/cone. Inner must be smaller. |
| `angle` | `70` | Cone opening in degrees, 1–359. |
| `length` / `width` | `10` / `3` | Beam dimensions in local world units. |
| `segments` | `48` | Terrain grid resolution, integer 2–128. |
| `color` | `#ffb48a` | Six-digit sRGB hex. |
| `opacity` / `intensity` | `0.85` / `1.7` | Additive alpha and HDR color intensity. |
| `edgeWidth` | `0.055` | Border width relative to footprint dimensions. |
| `offset` | `0.045` | World Y offset above sampled ground, to reduce z-fighting. |

### Geometry and heightfields

`project(surface)` updates the warning's geometry against world-space `surface(x,z) → height`. Call it after a transform or heightfield change. The surface must provide finite heights across the entire rectangular geometry domain, including masked parts outside a circle/cone. Projection is an authoring/update operation, not a screen-space decal pass.

The scene must be Y-up. Translation, yaw and positive nonzero scale are supported; pitch/roll and sheared parents are outside the contract. Cones and beams extend along local **−Z**. Positions/radii are local units, while `offset` is a world-space height. `configure()` reprojects against the last surface callback; shape dimension changes reallocate geometry.

### Timing

- `arm(time,duration)` sets visible, resets progress and starts a charge. Emits `armed`.
- `update(time)` advances progress and emits `complete` exactly once when progress reaches 1. It does not loop automatically. Times must be finite, monotonically increasing seconds after an arm.
- `progress` can be manually set from 0 to 1 for editor previews. An active arm overwrites it on the next update.
- `state`: `idle`, `charging`, `complete` or `cancelled`.
- `cancel()` sets cancelled and hides the mesh. Arm again to reuse it.
- Completion does not hide the warning; the game controls that behavior.

### Gameplay area tests

`containsPoint(worldVector3)` checks the full XZ footprint under the warning's current transform. It includes boundaries and honors ring holes. It intentionally ignores altitude, visibility, lifecycle state, progress, armor and physics. Use at the appropriate gameplay moment and apply your own vertical tolerance when an arena has overlapping floors. `containsLocalPoint(options,x,z)` exposes the same footprint for data-only calculations.

### Serialization and ownership

`toRecipe()` returns `{schema:'cranberry-forge.signal/1',options}`. `Telegraph.fromRecipe(jsonOrObject)` validates and creates a new warning. Recipes do not include transforms, surface functions, progress or timers. `normalizeSignalOptions()` validates without allocating geometry. `dispose()` releases owned geometry/material and removes the mesh from its parent; it is idempotent.

## Limits and visual tradeoffs

The footprint test is exact in XZ; the visible mesh approximates the surface with a grid. Increase segments for sharper terrain, within your budget. The warning is transparent, depth-tested, and additive. It can be hidden by occluders and may need a different offset at extreme scale. Multiple overlapping warnings brighten each other. Bloom is a showcase effect, not a dependency. No collision engine, navmesh, skill system, network authority or damage system is included.

See the main repository's research notes for existing decal/indicator approaches. This is a focused integration utility, not a claim that combat indicators are a new invention.
