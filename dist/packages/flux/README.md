# @cranberry-forge/flux

A small world-space motion-ribbon system for Three.js. Independent of Biome, React and any particle engine.

## Install

Not published to npm. Pack this repository folder, then install the tarball:

```sh
npm ci
npm pack ./dist/packages/flux
# In your own project:
npm install three@0.180.0 /path/to/cranberry-forge-flux-0.1.0.tgz
```

ES modules and TypeScript declarations are included. TypeScript consumers also need compatible `@types/three`. Tested with Three.js r180 / WebGLRenderer. ShaderMaterial-based; WebGPU is not supported by this release.

## Tutorial: a projectile trail

```js
import * as THREE from 'three';
import { Trail } from '@cranberry-forge/flux';

const trail = new Trail({
  capacity: 256,
  lifetime: 2,
  width: 0.4,
  color: '#b2ffcd',
  tailColor: '#1d7392',
  intensity: 2.2,
  taper: 1.4
});
scene.add(trail);

const projectilePosition = new THREE.Vector3();
const cameraPosition = new THREE.Vector3();
const start = performance.now();

renderer.setAnimationLoop(() => {
  const time = (performance.now() - start) / 1000;
  // Move projectile in your own simulation before sampling it.
  projectile.getWorldPosition(projectilePosition);
  camera.getWorldPosition(cameraPosition);
  trail.push(projectilePosition, time);
  trail.update(time, cameraPosition);
  renderer.render(scene, camera);
});

// Stop emitting: omit push(), keep calling update() until the tail expires.
// Level exit:
// trail.dispose();
```

Add the trail directly to an untransformed scene root. Positions are world-space, so applying another object/parent transform double-transforms them. The trail must be updated for the camera used to render it. For multiple viewports/cameras, update immediately before rendering each view.

## API

### `new Trail(options?)`

Creates a `THREE.Mesh` that owns a dynamic BufferGeometry and additive ShaderMaterial. Allocates all geometry capacity upfront. Oldest points are overwritten once the ring buffer fills.

| Option | Default | Meaning |
| --- | --- | --- |
| `capacity` | `256` | Integer sample limit, 4–4096. Immutable after construction. |
| `lifetime` | `2` | Seconds until samples expire. |
| `width` | `0.4` | Full ribbon width in world units at the head. |
| `taper` | `1.25` | Age-based width exponent. Zero gives constant width. |
| `opacity` | `1` | 0–1 opacity. |
| `intensity` | `2.2` | Linear HDR color multiplier. |
| `color` | `#b6f5d8` | Head color as six-digit hex. |
| `tailColor` | `#237c92` | Tail color as six-digit hex. |
| `minDistance` | `0.025` | Avoid near-identical consecutive samples. |
| `maxJump` | `8` | Automatically break connections beyond this world-space distance. |

Use capacity ≥ expected samples-per-second × desired lifetime + 1. A small capacity deliberately truncates the tail sooner than lifetime. All numeric options are checked for finiteness/range. `normalizeTrailOptions()` validates a recipe without creating GPU objects.

### `push(position, time) → boolean`

Accepts a Vector3 or `[x,y,z]`, plus monotonic seconds. Copies the position, so callers can reuse temporary vectors. Returns false if a live last point is closer than `minDistance`. Time cannot go backwards relative to a prior push/update. A point after a long stationary pause is accepted to avoid preserving a stale head forever.

### `update(time, cameraWorldPosition) → this`

Expires samples and updates camera-facing triangle strips. Continue calling while the emitter is inactive so the tail fades. Camera position must be a finite Vector3. Geometry buffers retain their identity across updates. CPU work is O(live samples); geometry index/attribute arrays are updated in place.

### `break() → this`

The next accepted point starts a disconnected segment. Use for teleports, sword activation changes or respawns. The automatic `maxJump` break is a fallback.

### `clear() → this`

Clears history and resets the internal time guard, allowing a restarted simulation clock. Does not replace buffers.

### `configure(partialOptions) → this`

Changes colors, width, fade and sampling parameters. Changing capacity throws; construct a new trail instead. A configuration applies to existing samples as well as new ones. The object has readonly getters `sampleCount` and `capacity`. Do not mutate `options` directly.

### `toRecipe()`, `Trail.fromRecipe(jsonOrObject)`

Versioned plain data, schema `cranberry-forge.flux/1`. Saves configuration, not motion history, renderer settings or trajectories. `fromRecipe` validates input and creates a fresh Trail. Workbench **Trail recipe** exports this format; **Export recipe** instead saves all workbench settings and individual trail recipes.

### `dispose()`

Idempotent. Removes from parent and disposes owned geometry/material. Calling push/update afterward throws.

## Visual integration

The shader makes a soft edge and bright inner core. Standard output/tone-mapping choices still affect the scene. The showcase uses native Three.js EffectComposer, UnrealBloomPass and OutputPass. Bloom is optional and not included in the package. Additive transparency is intentionally luminous and can become saturated at overlaps. It does not provide opaque smoke, refractive ribbons, collision or particles.

## Performance and limits

One draw call per Trail; no batching between trails. GPU geometry buffers have fixed capacity, while CPU updates remain O(samples). At camera alignment singularities, a stable perpendicular fallback avoids NaNs; tightly reversed paths may twist. Sample at a reasonably steady simulation rate for comparable appearance across devices. The showcase clamps long frame gaps rather than simulating seconds of catch-up. No promised FPS, zero-allocation claim, WebGPU support or general VFX engine claim.
