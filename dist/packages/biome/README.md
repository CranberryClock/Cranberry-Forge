# @cranberry-forge/biome

Deterministic terrain-aware scattering for native Three.js. Independent of Flux and the Cranberry Forge workbench.

## Install

This package is not published to npm. From the repository:

```sh
npm ci
npm pack ./dist/packages/biome
# In your own application:
npm install three@0.180.0 /path/to/cranberry-forge-biome-0.1.0.tgz
```

ES modules only. Three.js r180 is the tested peer version. Types are included; TypeScript users also need `@types/three` matching r180. The library creates native Three.js objects and does not create a renderer, canvas, or animation loop.

## Tutorial: a repeatable meadow

```js
import * as THREE from 'three';
import { scatter, createInstances, disposeInstances } from '@cranberry-forge/biome';

// Author the model bottom at Y=0; no model-specific dependency is required.
const geometry = new THREE.ConeGeometry(0.6, 2, 7);
geometry.translate(0, 1, 0);
const material = new THREE.MeshStandardMaterial({ color: '#527448' });

const height = (x, z) => Math.sin(x * 0.12) * Math.cos(z * 0.12) * 2;
const field = scatter({
  seed: 42,
  count: 800,
  radius: 30,
  minDistance: 1.4,
  maxSlope: 35,
  minHeight: -2,
  maxHeight: 2,
  scale: [0.8, 1.4],
  exclusions: [
    { type: 'circle', x: 0, z: 0, radius: 4 },
    { type: 'path', points: [[-25, -2], [0, 3], [25, 0]], width: 3 }
  ]
}, height);

const meadow = createInstances(field, [{ geometry, material }]);
scene.add(meadow); // Your scene must include lighting for standard materials.
console.log(field.stats); // Requested, placed, attempts, saturation, rejections.

// Later, release only instance buffers. You still own the prototype resources.
disposeInstances(meadow);
geometry.dispose();
material.dispose();
```

Your terrain mesh must use the same height function. Biome does not create or alter terrain geometry.

## API

### `scatter(options?, surface?, density?) → ScatterResult`

| Option | Default | Meaning |
| --- | --- | --- |
| `seed` | `42` | Unsigned 32-bit integer. Local PRNG; does not touch Math.random. |
| `count` | `600` | Requested integer count, 0–50,000. Actual placed count may be lower. |
| `radius` | `16` | Circular XZ domain in world units, centered on the origin. |
| `minDistance` | `0.8` | Minimum XZ center-to-center distance. Zero disables spacing checks. |
| `maxSlope` | `35` | Maximum slope in degrees from the positive Y axis. |
| `minHeight`, `maxHeight` | `-1000`, `1000` | Inclusive altitude limits. |
| `scale` | `[0.8, 1.3]` | Uniform per-placement scale interval. |
| `alignToNormal` | `false` | Tilt local Y to surface normal, then randomize local yaw. |
| `maxAttempts` | `60000` | Absolute proposal limit, up to 1,000,000. |
| `exclusions` | `[]` | Up to 256 circles/paths. Path width is the full corridor width. |

`surface(x,z)` returns a finite height or `{height, normal:[nx,ny,nz]}`. Missing/nonfinite heights reject a candidate. Provided normals are normalized; without one, central differences estimate slope, sampling just outside the circular bounds where needed. Your callback should therefore work in a small margin beyond the domain. `density(x,z,height)` returns a probability in [0,1] or throws validation. Zero means no placements. Supply deterministic callbacks for reproducible results.

Sampling is uniform over the XZ disk, not proportional to 3D surface area. Spacing uses a spatial hash to avoid checking every prior point. Tight constraints can exhaust the proposal budget; that is reported by `stats.saturated`, not an error or an infinite loop. Heightfield slope and exclusion tests precede spacing.

The returned plain object has schema `cranberry-forge.biome/1`, normalized `options`, `points`, and `stats`. Each point stores `{position:[x,y,z], normal:[nx,ny,nz], yaw, scale}`. `stats.rejected` counts first-failure reasons (not all failing rules for each point).

### `createInstances(result, parts) → THREE.Group`

Each part is `{geometry, material, matrix?, name?}`. A multipart asset uses one `InstancedMesh` per part. The optional Matrix4 represents a mesh's transform within the prototype; it is applied after the placement transform. A material array is supported for geometry groups. More parts/groups mean more draw calls. Instanced meshes compute bounds and cast/receive shadows.

The group starts at the origin. You can move the whole generated group, but collision/snapshot coordinates remain in its local frame. Results are expected to come from `scatter` or `parseScatter`; arbitrary unchecked point objects are not an input boundary.

### `parseScatter(jsonOrObject) → ScatterResult`

Validates an exported placement snapshot with at most 50,000 points. Does not execute code, resample terrain or trust supplied statistics. Restored diagnostics have `attempts: null` and `rejected: null` because generation did not run. To restore from the workbench's JSON, pass `recipe.placement`.

```js
import { parseScatter, createInstances } from '@cranberry-forge/biome';
const recipe = await (await fetch('/assets/meadow.json')).json();
const field = parseScatter(recipe.placement);
scene.add(createInstances(field, myPrototypeParts));
```

### `disposeInstances(group)`

Releases each InstancedMesh's owned buffers, removes the group from its parent, and empties it. Does not dispose borrowed geometries, materials or textures. The caller remains responsible for prototype resources.

### Utilities

`seededRandom(seed)`, `normalizeOptions(options)`, `distanceToSegment(x,z,a,b)`, `isExcluded(x,z,exclusions)`. Option validation throws `TypeError`/`RangeError`. Exclusion point coordinates are `[x,z]`. Boundaries are excluded inclusively.

## Workbench exports

- **Recipe JSON:** editable demo terrain settings and placement snapshot. Custom model binaries are not embedded; reimport the same asset to reproduce the appearance.
- **GLB:** baked landscape using `EXT_mesh_gpu_instancing`. Current Three.js GLTFLoader supports this extension. Other consumers must also support it. Animation, demo lighting and backdrop are omitted.
- **PNG:** current rendered view, without the workbench UI.

## Limits

This first release is synchronous; large or adversarial callback/constraint workloads can block a frame. Generate offline or in a worker for large terrains. Spacing is a center radius, not full mesh collision. No streaming, worker scheduler, arbitrary triangle-surface adapter, LOD manager, skeleton instancing or terrain editor is included. Geometry and material complexity can outweigh draw-call savings. No cross-device FPS claim is made.

Tested with Node 24 and Three.js 0.180.0. See repository tests for distribution, spacing, exclusions, surface grounding, snapshot validation and resource ownership checks.
