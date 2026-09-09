# Loom

**Spline ribbons, raised edge borders, and a shared placement frame for Three.js.**

Give Loom a sequence of points. It builds a flat swept surface and optional rectangular borders, then exposes the same distance-based route to trains, props, cameras, or other host objects. Width and bank can be constants or serializable profiles. The package has no dependency on another Cranberry Forge tool, a renderer, or the DOM.

The **Cloudline Railway** showcase at `/loom.html` demonstrates a floating island loop, canyon shuttle, and elevated figure eight. Every sleeper, trestle, and train carriage uses the public sampling API. Drag to orbit, change the track controls, and export or import a recipe. The train starts paused when reduced motion is requested.

## Install

Download `cranberry-forge-loom-0.1.0.tgz` from the showcase, then install the archive:

```sh
npm install ./cranberry-forge-loom-0.1.0.tgz three@0.180.0
```

```js
import { Loom, createLoomSample } from "@cranberry-forge/loom";
```

Loom is ESM with complete declarations. The supported peer range is `three >=0.180.0 <0.181.0`; testing uses `0.180.0`. Installation from the archive does not require an npm registry publication. TypeScript consumers should provide matching `@types/three` declarations.

For a browser without a bundler, extract the package, serve it alongside Three, and add an import map before your module:

```html
<script type="importmap">
  {
    "imports": {
      "three": "/vendor/three/build/three.module.js",
      "@cranberry-forge/loom": "/packages/loom/index.js"
    }
  }
</script>
```

## Tutorial: a moving object on a ribbon

```js
import * as THREE from "three";
import { Loom, createLoomSample } from "@cranberry-forge/loom";

const track = new Loom({
  points: [
    [-8, 0, 0],
    [-3, 1, -3],
    [3, 0.5, 3],
    [8, 0, 0],
  ],
  width: 1.4,
  segments: 160,
  bank: 0,
  borderWidth: 0.08,
  borderHeight: 0.12,
});
scene.add(track);

// The host owns its train mesh, clock, render loop, and travel policy.
const frame = createLoomSample();
let distance = 0;
function update(dt) {
  distance = Math.min(track.length, distance + dt * 2);
  track.sampleDistance(distance, frame);
  train.position.copy(frame.position).addScaledVector(frame.up, 0.1);
  train.quaternion.copy(frame.quaternion);
}
```

`scene` and `train` are host Three objects. This example assumes the train and track have the same parent and the track has an identity transform. The frame quaternion maps a model's local **+X to right, +Y to up, and +Z to forward**. Rotate an imported model inside a parent group when it uses a different forward axis.

Open routes clamp at their ends. Closed routes wrap fractions and distances, including negative values. The demonstration implements its own shuttle reversal on open routes; Loom does not own movement or elapsed time.

### Variable width and bank

Profiles use normalized **arc distance**, not control-point index or the raw Catmull–Rom parameter. Keys interpolate linearly. Bank is radians, using a right-handed rotation about the forward tangent.

```js
track.configure({
  width: [
    { at: 0, value: 1.4 },
    { at: 0.5, value: 2.2 },
    { at: 1, value: 1.4 },
  ],
  bank: [
    { at: 0, value: 0 },
    { at: 0.3, value: 0.2 },
    { at: 0.7, value: -0.2 },
    { at: 1, value: 0 },
  ],
});
```

For closed routes, the first and last value of each profile must match. Place keys at both `0` and `1`, with strictly increasing `at` values. Constants are valid for either open or closed routes. The optional borders follow the local width and bank automatically.

### Place things by distance

```js
for (let distance = 0; distance < track.length; distance += 0.5) {
  const frame = track.sampleDistance(distance);
  const sleeper = makeSleeper(frame.width + 0.3); // Your mesh factory.
  sleeper.position.copy(frame.position);
  sleeper.quaternion.copy(frame.quaternion);
  scene.add(sleeper);
}
```

Sampling always returns coordinates in Loom's **local space**. For a translated/rotated Loom and a train directly under an identity scene, use `track.localToWorld(frame.position)` and compose `track.getWorldQuaternion(worldQuaternion).multiply(frame.quaternion)`. The host must also transform distances/offsets when scaling the route. Prefer uniform scale: nonuniform scale does not preserve orthonormal frames or local arc-length distances in world space.

### Save and restore a route

```js
const json = JSON.stringify(track.toRecipe(), null, 2);
const restored = Loom.fromRecipe(json);
scene.add(restored);

// Rebuild an existing route while retaining mesh and material identity.
track.configure({ segments: 256, width: 1.7 });

// Remove and release the geometry when finished.
track.dispose();
restored.dispose();
```

`configure` validates and constructs the replacement before changing the existing route. Invalid input leaves the old geometry and sampling data usable. Successful rebuilds dispose the old geometries. The recipe is `{ schema: 'cranberry-forge.loom/1', options: ... }`, containing normalized plain JSON data. It excludes materials, scene transforms, train state, and workshop scenery.

## API

### `new Loom(options?, materials?)`

Loom extends `THREE.Group` and adds two meshes: `surface` and `borders`.

| Option         | Default            | Contract                                                                                                                |
| -------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `points`       | Four-point S curve | 2–128 tuples `[x,y,z]` or Three.Vector3 values; closed routes require at least 3. Coordinates are finite in ±1,000,000. |
| `closed`       | `false`            | Boolean. Closing is automatic; do not duplicate the first point at the end.                                             |
| `segments`     | `128`              | Integer from 8 to 4096. Surface subdivision and transported-frame resolution.                                           |
| `width`        | `1.8`              | Number or profile; each value is from 0.001 to 1000 world units.                                                        |
| `bank`         | `0`                | Number or profile; radians from −π to π.                                                                                |
| `up`           | `[0,1,0]`          | Finite nonzero tuple/Vector3 defining the preferred initial up direction. Normalized internally.                        |
| `uvScale`      | `2`                | World units per longitudinal UV repeat; finite from 0.001 to 1,000,000.                                                 |
| `borderWidth`  | `0.09`             | Rectangular border thickness across the ribbon, from 0 to 100 world units.                                              |
| `borderHeight` | `0.16`             | Border height above the ribbon, from 0 to 100. Zero width or height disables both borders.                              |

A profile contains 2–128 `{ at, value }` keys. Key positions must run strictly from `0` to `1`. Unknown option/profile keys, sparse arrays, NaN, infinities, duplicate adjacent points, and near-collinear reversals are rejected. Adjacent point separation must be at least `0.00001` units. A sampled zero tangent also rejects construction. No silent coercion is performed. Omitted options use defaults; explicit `undefined` is not treated as an omitted value.

The second argument accepts `{ surface?: THREE.Material, borders?: THREE.Material }`. If omitted, Loom creates a double-sided standard surface material and a metallic border material. A supplied material is shared by reference and remains **caller-owned**. Materials are never serialized in recipes. The two borders are one mesh; separate left/right materials are outside this version's scope.

### Properties and methods

| Member                                | Meaning                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `options`                             | Deep-frozen normalized options copied from input.                                                                                  |
| `length`                              | Approximate total centerline arc length in local world units.                                                                      |
| `surface`                             | Mesh with indexed ribbon geometry, position/normal/UV attributes, and bounds.                                                      |
| `borders`                             | Mesh containing both rectangular edge borders; an empty geometry when disabled. Open border ends are capped.                       |
| `disposed`                            | Whether disposal has occurred.                                                                                                     |
| `sample(u, target?)`                  | Sample by normalized arc length. Open routes clamp; closed routes wrap. Requires a finite number.                                  |
| `sampleDistance(distance, target?)`   | Sample by local centerline distance; same clamp/wrap policy.                                                                       |
| `configure(partialOptions)`           | Atomically replace route geometry/data while keeping the two mesh objects and materials; returns `this`.                           |
| `toRecipe()`                          | Independent JSON-compatible `{ schema, options }` copy.                                                                            |
| `Loom.fromRecipe(recipe, materials?)` | Construct from a recipe object or JSON string. Rejects unknown schemas or envelope properties. Missing option fields use defaults. |
| `dispose()`                           | Idempotent. Dispose owned geometries/default materials and detach the Loom group and its two meshes.                               |

After disposal, sampling, configuring, and recipe export throw. Caller-supplied materials remain valid. Arbitrary host children added to the group are neither disposed nor automatically reparented; the detached group still owns those children. The host owns those lifetimes. Do not replace the package-owned geometry references manually. Prefer recipes for copying; inherited `Object3D.clone/copy` are not Loom reconstruction APIs.

### Sampling result

`createLoomSample()` creates a reusable output object for `sample` or `sampleDistance`. Omitting the output creates a new one. Supplying a reusable output avoids allocating the result's vectors/quaternion; no allocation-free performance guarantee is made.

| Field           | Meaning                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| `u`             | Clamped or wrapped fraction in `[0,1]` for open routes, `[0,1)` for closed routes. |
| `distance`      | That fraction multiplied by route length, rather than an unwrapped travel counter. |
| `position`      | Centerline position in Loom local space.                                           |
| `tangent`       | Unit forward vector.                                                               |
| `right`, `up`   | Orthonormal frame vectors after banking.                                           |
| `quaternion`    | Orientation mapping model +X/right, +Y/up, +Z/forward into the frame.              |
| `width`, `bank` | Evaluated width and bank at the returned distance.                                 |

All returned vectors and the quaternion are independent mutable values. Changing them does not mutate Loom. Reusing the same sample object overwrites it, so copy values retained elsewhere.

### Other exports

- `LOOM_DEFAULTS`: deep-frozen normalized defaults.
- `normalizeLoomOptions(options?)`: validate and copy without generating GPU geometry; returns normalized frozen options.
- `LoomPoint`, `LoomProfile`, `ProfileKey`, `LoomOptions`, `NormalizedLoomOptions`, `LoomMaterials`, `LoomSample`, and `LoomRecipe`: declaration types.

## Geometry, frames, and limitations

The centerline is a centripetal Catmull–Rom curve. Loom uses Three's arc-length lookup with `max(512, segments × 4, pointCount × 32)` divisions. Mesh rows are equally spaced by this approximate centerline distance. Accuracy depends on curve complexity and sampling resolution; this is not an analytic arc-length solution.

The first up vector is projected perpendicular to the tangent. When that projection is nearly zero, Loom chooses a deterministic least-aligned axis. Subsequent frames use minimal tangent-to-tangent rotation and projection. Closed routes distribute residual frame twist across the loop before banking. Arbitrary samples interpolate stored orientations, then reproject against the sampled tangent. This keeps frames usable on vertical sections without requiring a global Y-up tangent cross-product at every point. It does not infer railway superelevation or physically correct roll from speed.

The ribbon is a zero-thickness strip, with transverse UV from `0` to `1` and longitudinal UV from `0` to `length / uvScale`. Surface normals follow the sampled up frames. Borders are rectangular prisms centered on each ribbon edge and rising along up; their faces have their own normals/UVs. The package does not build a solid roadbed, rail-wheel contact, sleepers, support columns, switches, terrain cuts, or junction meshes. Those in the showcase are host geometry placed through the public API.

Width, bank, and tight curvature can produce self-intersections or overlap between borders. Loom does not solve collisions, minimum bend radius, path clearance, topology repair, lane markings, navigation, physics, or train coupling. Rejecting degenerate inputs is not a proof that a route is physically traversable. The demo train uses kinematic placement, and its open-route carriage reversal is an illustration rather than a railway dynamics simulation.

Geometry rebuilds allocate new arrays and meshes' geometry resources. Update only when route settings change, reuse samples for moving objects, and profile large route counts. Never rebuild the route just to advance a train. The package has no workers, GPU compute dependency, event loop, timers, scene-wide traversal, network requests, or other Cranberry Forge dependencies.

## Existing tools and scope

Three's official [TubeGeometry](https://threejs.org/docs/pages/TubeGeometry.html) extrudes a round tube along a 3D curve. [ExtrudeGeometry](https://threejs.org/docs/pages/ExtrudeGeometry.html) supports shape extrusion along an `extrudePath`, including broader cross-section workflows. Use those when their established shape operations fit your task. Loom focuses on an open ribbon, rectangular edge borders, serializable width/bank profiles, and a matching public placement frame.

Three's [Curve documentation](https://threejs.org/docs/pages/Curve.html) describes arc-length sampling, cache resolution, tangent sampling, and frame computation. Loom builds on the official curve APIs with its own transport/frame and ribbon-generation code. These primary references establish the category; no novelty or replacement claim is made.

## Tests and renderer-free showcase

From the Cranberry Forge checkout:

```sh
node --test tests/loom.test.mjs
```

The tests cover straight-strip geometry/UVs, distance spacing on unequal control-point intervals, vertical/closed frames, width/bank profiles, recipe isolation, atomic rebuilding/material ownership, malformed inputs, and procedural scene motion. `tests/loom-types.ts` exercises the exported declarations.

`dist/loom-scene.js` exports `createLoomScene({ preset, options })` and `LOOM_PRESETS`. Presets are `skyloop`, `switchback`, and `overpass`. The returned object exposes `group`, `loom`, `train`, `coaches`, suggested `cameraPosition`/`cameraTarget`, `configure`, `setPreset`, `update(dt, { playing, speed, reducedMotion })`, and `dispose`. It creates only Three objects and original procedural geometry, so it can be constructed without DOM/WebGL and rendered using Three's official SVGRenderer for documentation. Offline SVG lighting differs from the live WebGL scene. This factory is a showcase file, not a package runtime dependency.

MIT © 2026 CranberryClock. See [LICENSE](./LICENSE).
