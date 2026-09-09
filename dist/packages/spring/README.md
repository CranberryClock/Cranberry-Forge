# Spring

**Analytic spring motion for the frame loop you already own.**

`@cranberry-forge/spring` provides a scalar spring, an XYZ vector spring, and a pure stepping function. Change a target without dropping momentum; add an impulse without teleporting. Use the output for camera recoil, UI motion, or secondary animation.

Spring has **zero runtime dependencies**. It imports no Three.js, React, DOM, clock, renderer, storage, or other Cranberry Forge package. The Jellyworks showcase uses ordinary Three.js meshes to display its values.

## Install

Download `cranberry-forge-spring-0.1.0.tgz` from the Spring page, then install the local archive:

```sh
npm install ./cranberry-forge-spring-0.1.0.tgz
```

The archive is an ES module with TypeScript declarations. You can also copy `index.js` into your project and import that file directly. This repository does not imply that the package is published to the public npm registry.

```js
import { Spring } from "@cranberry-forge/spring";

const recoil = new Spring({ frequency: 3, dampingRatio: 0.65 });

function onAction() {
  recoil.impulse(8); // velocity units per second
}

function update(dt) {
  mesh.position.y = restY + recoil.step(dt); // dt in seconds
}
```

## What the two controls mean

`frequency` is the **undamped natural frequency in hertz**, not a duration. `dampingRatio` is dimensionless:

| Ratio               | Motion                                                                    |
| ------------------- | ------------------------------------------------------------------------- |
| `0`                 | Undamped; oscillation continues.                                          |
| Between `0` and `1` | Underdamped; decaying oscillation.                                        |
| `1`                 | Critical damping. A target change from rest approaches without overshoot. |
| Above `1`           | Overdamped; two decaying modes, without sustained oscillation.            |

An existing velocity can carry even a critically damped or overdamped spring across the target. Spring preserves that velocity. It does not silently clamp crossings or snap at a hidden rest threshold.

The implementation evaluates the closed-form solution of `x″ + 2ζω x′ + ω²(x − target) = 0`, with `ω = 2π × frequency`. These are the standard damped-oscillator regimes described in [MIT OpenCourseWare’s damped harmonic oscillator lesson](https://ocw.mit.edu/courses/18-03sc-differential-equations-fall-2011/pages/unit-ii-second-order-constant-coefficient-linear-equations/damped-harmonic-oscillators/).

## Where it fits

Springs and damping are established tools; this package does not claim new physics or the absence of alternatives.

| Alternative                                                                              | Useful when                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [React Spring](https://www.react-spring.dev/docs/advanced/config)                        | You want its animation controllers, animated components, interpolation, and React integration. Its configuration already supports spring tuning and initial velocity.                                                 |
| `maath/easing` and its evolving [pmndrs/math repository](https://github.com/pmndrs/math) | You want an existing graphics-math toolkit. The former maath repository now redirects to math, whose `math/time` module includes scalar and vector spring utilities. Check the documentation for the version you use. |
| Spring                                                                                   | You want this small dependency-free ES module, explicit value/velocity/target state, additive velocity impulses, bounded validation, and a frame loop you control.                                                    |

The distinction is scope and API preference, not unique spring capability or a performance claim. Spring intentionally omits quaternion interpolation, framework bindings, animation scheduling, collision, maximum-speed clamps, and full rigid-body simulation.

## Guarantees and boundaries

- For a constant target and unchanged settings, one step and several steps totaling the same time agree up to floating-point rounding. If target changes or impulses happen between steps, split at those event times for equivalent results.
- Under-, critical-, and overdamping use analytic formulas. Near-critical damping uses stable `sinc`/`expm1` forms; overdamping avoids overflowing `sinh` intermediates.
- Scalar and XYZ operations validate finite inputs. Failed configuration, impulses, or numerical-limit checks preserve the previous state. XYZ stepping commits all three axes together.
- Getters return detached data. The object supplied to the pure `stepSpring` function is not mutated.
- Time steps are `0..60` seconds; frequency is `0.01..100` Hz; ratio is `0..10`. Each scalar value, target, velocity, and impulse component must have magnitude at most `1e12`. Computed states exceeding that limit throw rather than clip.
- Spring owns no resources to dispose. Stop calling `step` to pause. Call `snap()` when your product wants reduced motion, and stop applying decorative impulses.

Read the [API reference](./API.md) or follow the [integration tutorial](./TUTORIAL.md). The repository’s nine focused tests cover analytic reference values, energy, timestep equivalence, momentum, XYZ parity, resets, and atomic rejection.

## Optional local HTTP endpoint

The Cranberry Forge repository server also exposes `POST /api/v1/spring/step` for explicit numeric requests:

```json
{
  "state": { "value": 0, "target": 1, "velocity": 0 },
  "dt": 0.016,
  "options": { "frequency": 2, "dampingRatio": 0.65 }
}
```

It returns `{ "state": { "value": ..., "velocity": ..., "target": ... } }`. This optional repository service is separate from the standalone package; ordinary animation should step locally in its own frame loop. See the repository’s [HTTP API documentation](https://github.com/CranberryClock/Cranberry-Forge/blob/main/docs/HTTP_API.md).

Original implementation and Jellyworks procedural toys: MIT. No third-party animation code is bundled.
