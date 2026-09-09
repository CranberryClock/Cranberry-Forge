# Give a small object a little life

This tutorial uses native Three.js, but Spring works equally well with DOM styles, canvas drawings, or ordinary numeric state. Install the package from its local archive as described in [README.md](./README.md).

## 1. Keep the resting transform separate

Create a scalar spring whose zero means “no recoil.” Apply the output relative to a stable resting position; do not repeatedly add the output to the already animated transform.

```js
import { Spring } from "@cranberry-forge/spring";

const restY = mesh.position.y;
const recoil = new Spring({ frequency: 3.5, dampingRatio: 0.55 });

function onAction() {
  recoil.impulse(5); // additive velocity, not a new position
}

function update(dt) {
  mesh.position.y = restY + recoil.step(dt);
}
```

Your game calls `update`. Spring never starts a frame loop or installs an event listener. A second impulse stacks with the current velocity, producing continuous motion.

## 2. Move the destination while preserving momentum

Use targets for hover, focus, doors, floating UI, or follow-through. Start with critical damping when a target change from rest should approach without a bounce.

```js
const lift = new Spring({ value: 0, frequency: 2.5, dampingRatio: 1 });

function setHighlighted(highlighted) {
  lift.setTarget(highlighted ? 0.3 : 0);
}

function update(dt) {
  mesh.position.y = restY + lift.step(dt);
}
```

`setTarget` does not reset velocity. `configure({dampingRatio: 0.3})` also preserves the current state. For a sharp discontinuity, use `snap(position)` instead.

## 3. Follow an XYZ target

```js
import { VectorSpring } from "@cranberry-forge/spring";

const follow = new VectorSpring({
  value: [0, 1, 0],
  frequency: 2,
  dampingRatio: 0.8,
});

function update(dt, destination) {
  follow.setTarget([destination.x, destination.y, destination.z]);
  const [x, y, z] = follow.step(dt);
  follower.position.set(x, y, z);
}
```

The three components are independent scalar oscillators. This is not quaternion interpolation, collision detection, or angular wraparound. For angles crossing ±π, unwrap your target first or use a library designed for rotation interpolation.

## 4. Own pause, reset, and reduced motion

Pause by not stepping. Ignore decorative impulses while paused rather than accumulating surprise energy for resume.

```js
let paused = false;
let calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

function setTarget(value) {
  if (calm) recoil.snap(value);
  else recoil.setTarget(value);
}

function onAction() {
  if (!paused && !calm) recoil.impulse(5);
}

function update(dt) {
  if (!paused && !calm) recoil.step(dt);
  mesh.position.y = restY + recoil.value;
}
```

When reduced motion becomes enabled, call `recoil.snap()` once to settle at the existing target. When a level teleports an object, `snap(newPosition)` removes stale momentum. `reset()` restores the constructor’s complete original state and tuning; it does not mean “stop wherever I am.”

## 5. Understand the timing

Each call solves the ordinary damped oscillator analytically for a fixed target. `frequency` is cycles per second before damping; it is not a millisecond duration. The critical boundary is exactly `dampingRatio: 1`.

If input occurs between simulation times, split the interval there:

```js
recoil.step(0.04);
recoil.impulse(5);
recoil.step(0.06);
```

This describes the same input history at different frame subdivisions. Moving the impulse to the start of the interval describes a different history, so it should produce a different result.

The solver uses the classical constant-coefficient solutions taught in [MIT’s damped harmonic oscillator course material](https://ocw.mit.edu/courses/18-03sc-differential-equations-fall-2011/pages/unit-ii-second-order-constant-coefficient-linear-equations/damped-harmonic-oscillators/). The implementation is original; no course code or third-party animation implementation is copied.

## Jellyworks source tour

The hosted `/spring.html` lab keeps mechanics and presentation separate:

| File                        | Responsibility                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `/packages/spring/index.js` | Analytic scalar/XYZ state, finite validation, impulses and targets.                               |
| `/spring-scene.js`          | Renderer-free factory creating original procedural toys and applying spring output to transforms. |
| `/spring-app.js`            | Host frame loop, sliders, pause, reduced motion, pointer raycasts, and live SVG response trace.   |
| `/spring.css`               | Responsive visual presentation.                                                                   |

Mochi uses the selected damping ratio. Pip stays at `1`; Orbit stays at `1.8`. Frequency and the “Nudge all” action apply to all three. A pointer tap only nudges the selected toy. The graph shows exact scalar values; the toy assembly uses a bounded height mapping and squash/stretch so repeated nudges do not invert its mesh geometry. Demo impulses cap resulting primary velocity at 24 units/second, while the independent package does not impose that gameplay limit.

The public scene factory accepts `{scene, camera, bloom?}` and creates no renderer, DOM, or event listeners:

```js
const world = createSpringScene(stage);
world.kick(14);
world.update(0.13);
// Render stage.scene with stage.camera using your own renderer.
world.dispose();
```

Source-level scene construction and core math are testable without WebGL. Browser/GPU appearance is a separate validation step.
