# Latch

**Actor-reachable contextual interactions for native Three.js.**

Register an object, aim at it, and press or hold. Latch finds the reachable root, explains why an action is blocked, tracks deliberate input, and returns events for your game to apply. It has no renderer, DOM, inventory, animation, or Cranberry Forge package dependency.

The accompanying **Meridian Observatory** is an original procedural island: collect an aether fuse, hold a clockwork crank, and ignite the dawn beacon. Open `/latch.html` in the Cranberry Forge showcase. Desktop supports pointer aiming, E, WASD, and orbit dragging. Station buttons walk and aim automatically; the large gold key supports touch press and hold. Raise the shutter to inspect occlusion.

## Install

Download `cranberry-forge-latch-0.1.0.tgz` from the showcase and install the local archive:

```sh
npm install ./cranberry-forge-latch-0.1.0.tgz three@0.180.0
```

```js
import { Latch } from "@cranberry-forge/latch";
```

This is an ESM package with complete TypeScript declarations. Its peer dependency is Three.js `>=0.180.0 <0.181.0`; validation uses `0.180.0`. The archive is independently usable. No other Cranberry Forge package is required. An npm registry publication is not required for archive installation.

In a browser without a bundler, serve the extracted package alongside Three and provide an import map before your module:

```html
<script type="importmap">
  {
    "imports": {
      "three": "/vendor/three/build/three.module.js",
      "@cranberry-forge/latch": "/packages/latch/index.js"
    }
  }
</script>
```

## Tutorial: a locked mechanism

Your host creates and renders the objects. A registered root can be a Group containing deeply nested meshes.

```js
import * as THREE from "three";
import { Latch } from "@cranberry-forge/latch";

const latch = new Latch({ reach: 3, focusTolerance: 0.015 });
const game = { hasFuse: false, charged: false };
// fuseRoot, crankRoot and wallRoot are your own Three.Object3D objects.
latch.register({ id: "fuse", root: fuseRoot, label: "Take fuse" });
latch.register({
  id: "crank",
  root: crankRoot,
  label: "Wind mechanism",
  mode: "hold",
  holdDuration: 1.8,
  condition: ({ context }) =>
    context.charged
      ? "Already wound"
      : context.hasFuse || "Find the fuse first",
});
latch.setOccluders([wallRoot]);

const aim = new THREE.Raycaster();
const actorPosition = new THREE.Vector3();
const pointerNDC = new THREE.Vector2();
let pressed = false;

function step(dt) {
  // Call after your movement and world transforms, before applying interactions.
  aim.setFromCamera(pointerNDC, camera);
  actor.getWorldPosition(actorPosition);
  actorPosition.y += 0.8; // Your chosen hand/body interaction origin.
  const result = latch.update({
    dt, // Elapsed seconds, never milliseconds.
    aimRay: aim.ray, // May originate at a distant third-person camera.
    actorPosition, // Reach is measured from this actor position.
    pressed, // Current physical button state.
    suspended: menuIsOpen,
    context: game,
    camera, // Needed for view-dependent raycasting, e.g. Sprites.
  });

  prompt.textContent = result.focus
    ? result.focus.available
      ? result.focus.label
      : result.focus.reason
    : "";
  progress.value = result.progress;

  // The traversal is finished. Apply gameplay changes here.
  for (const event of result.events) {
    if (event.type !== "activate") continue;
    if (event.target.id === "fuse") {
      game.hasFuse = true;
      latch.remove("fuse");
      fuseRoot.visible = false;
    }
    if (event.target.id === "crank") game.charged = true;
  }
}
```

`actor`, `camera`, scene roots, prompt, progress element, and `menuIsOpen` are host variables. Latch deliberately does not create them. The same loop works with a gamepad, touch button, first-person camera, or XR controller: supply a world-space ray and a current button state.

### Connect input without losing quick taps

Track a button's down/up state. Call `step(0)` at each transition as well as `step(dt)` in your frame loop so a tap completed between rendered frames is still observed. Use one source of elapsed time: transition updates receive zero seconds. For multiple devices, aggregate their down states with a Set, as the showcase does.

```js
window.addEventListener("keydown", (event) => {
  if (event.code !== "KeyE" || event.repeat) return;
  pressed = true;
  step(0);
});
window.addEventListener("keyup", (event) => {
  if (event.code !== "KeyE") return;
  pressed = false;
  step(0);
});
```

On blur, lost pointer capture, pointer cancellation, and hidden-page transitions, clear held input and call an update. For a menu or background state use `suspended: true`. Continue sending released input while suspended when possible. If the input remains held during suspension, it must be released before starting again after resumption. No DOM listeners or background timers are installed by the package.

### TypeScript

```ts
import { Latch, type InteractionEvent } from "@cranberry-forge/latch";

type GameState = { hasFuse: boolean; charged: boolean };
const latch = new Latch<GameState>();
latch.register({
  id: "door",
  root: doorRoot,
  condition: ({ context }) => context.hasFuse || "A fuse is required",
});
function consume(event: InteractionEvent) {
  if (event.type === "cancel") console.log(event.reason);
  if (event.type === "activate") console.log(event.target.id);
}
```

When a condition uses context, supply it on every update, including zero-time input and suspension updates. Install `@types/three` matching your Three version if your TypeScript project does not already provide Three declarations.

## API

### `new Latch(options?)`

| Option           | Default    | Meaning                                                                                                                              |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `reach`          | `3`        | Default maximum actor-to-hit surface distance, world units; finite and nonnegative.                                                  |
| `aimFar`         | `Infinity` | Maximum intersection distance from the aim origin; nonnegative. This is separate from actor reach.                                   |
| `focusTolerance` | `0.015`    | Keep current focus when its nearest eligible surface is within this many world units of the nearest aim hit. Finite and nonnegative. |

`options` is a read-only normalized snapshot. `size` is the current target count.

### `register(options): Target`

| Field          | Default          | Meaning                                                                     |
| -------------- | ---------------- | --------------------------------------------------------------------------- |
| `id`           | required         | Unique nonempty string.                                                     |
| `root`         | required         | Three.Object3D; an individual root can be registered once.                  |
| `label`        | `id`             | Prompt text.                                                                |
| `mode`         | `'press'`        | `'press'` or `'hold'`.                                                      |
| `holdDuration` | `1`              | Duration in seconds; finite and at least `0.000001`. Used for hold targets. |
| `reach`        | controller reach | Per-target finite nonnegative world-space reach.                            |
| `condition`    | always available | Pure synchronous predicate, described below.                                |

The returned frozen `Target` has the normalized fields above, including `condition` when supplied. Configuration is copied; scene objects remain host-owned references. To change registration settings, remove and register the target again. Re-registering the same id creates a new target and cancels an old hold on the next update.

`condition({ context, actorPosition, target, hit })` returns `true` to permit activation, `false` for a generic “Unavailable” reason, or a string describing the block. An empty string also produces “Unavailable”. The predicate receives a copy of actor position and a shallow intersection copy with a copied hit point. Treat all referenced host objects as read-only. Conditions may run multiple times per update, including immediately before completion. Do not consume inventory, change scene state, register/remove targets, or call `update()` from a condition. Reentrant controller mutation throws; predicate exceptions propagate to the host. If an update throws, Latch restores its prior interaction state, so a retry does not consume a press or silently lose a cancellation. Host-side predicate or custom-raycast side effects cannot be rolled back.

### Target and occluder lifecycle

| Method                     | Result                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `remove(id)`               | Returns whether a target was removed. Pending cancel/blur events are returned at the next update.                       |
| `clear()`                  | Unregisters all targets; cancellation/blur appears at the next update. Occluders and input history remain.              |
| `setOccluders(roots = [])` | Copies and deduplicates an array of Object3D roots; returns the controller. An empty array disables explicit occlusion. |

Removing a target never removes, hides, or disposes the corresponding scene object. Merely detaching an object from its scene does not unregister it: call `remove`, hide it, or clear its registration. To dispose a controller, stop sending updates and release it; it owns no GPU resources or DOM listeners. Release host geometry, materials, and listeners separately.

### `update(frame): InteractionResult`

| Frame field     | Requirement                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `dt`            | Finite, nonnegative elapsed seconds since the previous update.                                  |
| `aimRay`        | Three.Ray with finite origin and nonzero Vector3 direction. Direction is copied and normalized. |
| `actorPosition` | Finite Three.Vector3 in world coordinates.                                                      |
| `pressed`       | Boolean current button state; a press means a false-to-true transition.                         |
| `suspended`     | Optional boolean, default false. Cancels work and clears focus.                                 |
| `context`       | Optional host data for conditions; not copied or modified.                                      |
| `camera`        | Optional Three.Camera for view-dependent raycasting.                                            |

| Result field      | Meaning                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `focus`           | `Focus` snapshot or `null`.                                                          |
| `progress`        | Hold fraction from 0 to 1; resets to 0 after activation or cancellation.             |
| `holding`         | Whether a hold is currently in progress.                                             |
| `requiresRelease` | A held input cannot start another action until an update observes `pressed: false`.  |
| `events`          | Fresh ordered, frozen array of interaction events. Process after the update returns. |

`Focus` includes `id`, `root`, `label`, `mode`, `holdDuration`, `point`, `distance`, `available`, and `reason`. `point` is a copy in world space; `distance` is actor-to-hit distance. `reason` is `null` when available. Snapshot objects are shallow-frozen; Three vectors and host object references are not deep-frozen. Changing a snapshot's point does not change raycast geometry or the controller's hit point, but may change other references to that same snapshot.

### Events

Every event includes `type` and a `target: Focus` snapshot.

| Type       | Additional data | When returned                                                                        |
| ---------- | --------------- | ------------------------------------------------------------------------------------ |
| `focus`    | —               | A new reachable target is selected.                                                  |
| `blur`     | `reason`        | Previous focus is lost, removed, or suspended.                                       |
| `start`    | —               | A fresh press begins a hold.                                                         |
| `cancel`   | `reason`        | An in-progress hold is interrupted.                                                  |
| `activate` | —               | A press or a completed hold passes its final availability check.                     |
| `blocked`  | `reason`        | A fresh press attempts an unavailable target, or a press fails its completion check. |

Cancellation reasons are `'focus-lost'`, `'removed'`, `'suspended'`, `'released'`, and `'unavailable'`. Blur uses the first three. A target switch returns `cancel` if holding, then `blur`, then `focus`. A new hold returns `start`; a successful press returns `activate`. A hold that loses availability returns `cancel`, with the current blocked reason also available on `result.focus.reason`. No progress events are emitted; read the result once per frame.

## Selection and timing contract

1. Update registered roots, their ancestors, and occluder world matrices. Recursively raycast registered roots with Three's default layer 0.
2. Resolve each descendant hit to its **nearest registered ancestor**, so nested interaction roots remain distinct. Ignore objects hidden by themselves or an ancestor.
3. Keep surface hits within actor reach. Test explicit occluders along both the aim ray and the segment from actor origin to the target surface. The selected target's own descendants do not occlude it. Other scene objects are not implicit occluders; register actual collision scenery explicitly.
4. Choose the closest eligible aim hit. Preserve the previous target within `focusTolerance`; initial equal-distance ties use registration order. A blocked condition keeps focus, so the host can explain the reason instead of selecting through it.
5. Apply input transitions and evaluate availability. Return events; host mutations happen afterward.

The first observed `pressed: true` counts as a fresh press if a target is acquired immediately. Once input is held, acquiring or switching to another target cannot activate it. Switching directly from an existing focus on the same frame as a new press also requires a release. This prevents a replacement target from consuming the old gesture.

A hold starts at zero: its first pressed update receives **no** `dt` credit, because that elapsed time preceded the observed press. Later held updates accumulate the supplied time. Completion occurs once at or beyond the duration. Continuing to hold never repeats an activation. Release, aim loss, lost reach, occlusion, suspension, removal, and unavailable conditions cancel progress. Conditions are checked during focus updates and again immediately before completion. Input held through a condition change cannot automatically start again.

`dt` is not clamped internally. Supply your simulation's time policy. A long active update can complete a hold; suspend or clamp elapsed time in the host when opening menus, hiding the page, or recovering from a long stall. No wall-clock timestamps or timers are consulted, so a recorded sequence of inputs and geometry is reproducible.

## Ownership and limits

- **Latch owns:** registration records, previous focus, current held gesture, elapsed hold time, and release gating.
- **The host owns:** Three scene objects, input adapters, actor movement and collision, aim construction, rendering, UI, inventory, animation, saves, networking, and gameplay effects. Availability checks must be pure and synchronous.
- **Scope:** local contextual interactions, not a physics engine, pointer event propagation system, menu framework, or network authority. No automatic DOM binding, line-of-sight cache, aim assistance, or spatial index is included.
- **Raycasting:** normal Three mesh/material/layer rules apply, including face sidedness and custom `raycast()` behavior. Target roots can contain lines, sprites, or instanced meshes, but selection is by registered root; individual instances are not independent targets. Set a camera for Sprites. Alpha texture holes and visual transparency do not automatically become collision holes.
- **Geometry:** actor reach is measured to a hit surface, not a root pivot or a bounding sphere. Occlusion is a ray/segment test, not a capsule sweep or pathfinding test. The host chooses a sensible actor interaction origin and occluder geometry.
- **Performance:** each update raycasts registered geometry and explicit occluders; per-candidate actor visibility tests can be expensive in large scenes. Use simple interaction/collision meshes, register a local set, and profile your content. No allocation-free or large-scene performance claim is made.
- **Lifetime:** call `remove` for collected/destroyed targets. Preserve real physical button state across target changes. Apply `activate` events after `update` returns; Latch never calls an activation callback during scene traversal.

## Why this category

Three's official [InteractiveGroup](https://threejs.org/docs/pages/InteractiveGroup.html) groups objects and dispatches pointer, mouse, and XR selections to descendants. [THREE.Interactive](https://github.com/markuslerner/THREE.Interactive) provides a broader pointer/mouse/touch interaction manager and event dispatch for Three objects. These establish the familiar object interaction category. Latch concentrates on a gameplay-sized part of that category: actor reach, explicit occlusion, condition reasons, and cancellable press/hold actions returned as data.

The underlying geometric behavior follows Three's [Raycaster documentation](https://threejs.org/docs/pages/Raycaster.html): recursive intersections are distance-sorted and delegated to each object's `raycast` method. Those material, face, and object-specific rules remain visible in this toolkit. The implementation is original; the references are category and API research, not incorporated source code.

## Verification and showcase assets

From the Cranberry Forge source checkout, run:

```sh
node --test tests/latch.test.mjs
```

Tests cover actor reach independent of camera distance, parent transforms, nested roots, aim and actor occlusion, stable focus, repeated press gating, hold timing, release/focus/suspension/removal cancellation, completion availability, and host event processing.

`dist/latch-scene.js` exports `createLatchScene()`, a renderer-free factory using original procedural Three geometry. It returns the group, suggested camera vectors, registered target roots, aim points, walk stations, actor, occluders, an `update` function, and `dispose`. It is a showcase asset rather than a package runtime dependency. The scene can be constructed in Node and rendered with Three's official SVGRenderer for documentation previews; SVG rendering differs from the live WebGL lighting and bloom.

MIT © 2026 CranberryClock. See [LICENSE](./LICENSE).
