# Spring API · 0.1.0

All exports are available from `@cranberry-forge/spring`. The package has no runtime dependencies and performs no implicit work between calls.

## Types and defaults

```ts
interface SpringState {
  value: number;
  target: number;
  velocity: number;
}
type Vec3 = readonly [number, number, number];
interface SpringOptions {
  frequency?: number; // default 2 Hz
  dampingRatio?: number; // default 0.65
}
```

`frequency` means natural frequency before damping; `velocity` and `impulse` use value units per second. Damping ratio is dimensionless. XYZ axes are independent and share the same frequency and damping. VectorSpring does not interpret components as angles or normalize them.

| Export                                 | Meaning                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `VERSION`                              | `"0.1.0"`                                                                          |
| `SPRING_DEFAULTS`                      | Frozen default frequency and damping ratio.                                        |
| `SPRING_LIMITS`                        | Frozen numeric validation limits.                                                  |
| `normalizeSpringOptions(options = {})` | Validate options and return a fresh fully specified object. Unknown fields reject. |

## Pure function

```js
stepSpring({ value, target, velocity }, dt, (options = {}));
// → { value, velocity, target }
```

All three state fields are required. Returns a fresh state and does not mutate the input. The target stays constant during the step. `dt = 0` returns an equivalent detached state after validating both state and options.

This function is convenient for explicit game-state stores or worker messages:

```js
state.recoil = stepSpring(state.recoil, dt, {
  frequency: 4,
  dampingRatio: 0.8,
});
```

## Scalar class

```js
const spring = new Spring({
  value: 0, // default 0
  target: 1, // defaults to initial value
  velocity: 0, // default 0
  frequency: 2,
  dampingRatio: 0.65,
});
```

| Member                        | Result and behavior                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `value`, `velocity`, `target` | Read-only scalar getters.                                                                  |
| `state`                       | Fresh `{value, target, velocity}` object.                                                  |
| `options`                     | Fresh `{frequency, dampingRatio}` object.                                                  |
| `step(dt)`                    | Advance by seconds and return the new scalar value.                                        |
| `setTarget(value)`            | Change only the target; preserve value and velocity. Returns `this`.                       |
| `impulse(deltaVelocity)`      | Add velocity immediately; preserve position and target. Returns `this`.                    |
| `configure(options)`          | Merge and validate frequency/damping changes without changing state. Returns `this`.       |
| `snap(value = target)`        | Set both value and target to the supplied position; zero velocity. Returns `this`.         |
| `reset()`                     | Restore the original constructor state **and** original frequency/damping. Returns `this`. |

Do not assign to getter properties. To replace a full state, construct a new Spring using `{...savedState, ...settings}`; state serialization and storage remain the host’s responsibility.

## Vector class

```js
const spring = new VectorSpring({
  value: [0, 0, 0],
  target: [1, 2, 3], // defaults to value
  velocity: [0, 0, 0],
  frequency: 2,
  dampingRatio: 0.65,
});
```

It has the same methods and getters as Spring, using `[x,y,z]` arrays for value, target, velocity, impulses, and the return value of `step`. Arrays must contain exactly three own numeric entries. Sparse arrays, typed arrays, and `{x,y,z}` objects are deliberately not accepted. Convert a Three.js Vector3 with `.toArray()` or an explicit tuple.

All inputs are copied. All returned arrays are detached. If any axis fails validation or exceeds an output limit, no axis commits.

## Validation and limits

| Input                                    | Allowed range          |
| ---------------------------------------- | ---------------------- |
| `frequency`                              | Finite `0.01..100` Hz  |
| `dampingRatio`                           | Finite `0..10`         |
| `dt`                                     | Finite `0..60` seconds |
| State/impulse scalar or vector component | Finite `−1e12..1e12`   |
| Computed value/velocity component        | Finite `−1e12..1e12`   |

Objects must be plain objects. Unknown keys throw `TypeError`. Nonfinite or out-of-range numbers throw `RangeError`; wrong vector shape throws `TypeError`. An explicitly supplied `undefined` state/configuration field is invalid. Optional omitted fields use their documented defaults; omitted arguments to `snap()` use the current target.

There is no maximum-speed clamp or hidden rest epsilon. Large legal input displacement and frequency can produce an output velocity outside the numeric safety limit; that step throws atomically. This is a validation boundary, not a collision response.

## Timing contract

The target and coefficients are constant during a call. To apply an impulse 0.04 seconds into a 0.1-second frame, call `step(0.04)`, `impulse(...)`, then `step(0.06)`. Applying the impulse before the whole frame describes a different motion.

Sample a moving target at your chosen simulation times. Different sampling schedules for a moving target need not produce the same result. The analytic solver guarantees constant-coefficient evolution between those changes, not invariance to different input histories.

Repeated undamped motion keeps energy up to floating-point error. Damped motion approaches its target asymptotically and may eventually round to it. Use `snap()` explicitly when exact rest matters to your application.
