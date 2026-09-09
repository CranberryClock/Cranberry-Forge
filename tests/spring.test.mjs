import test from "node:test";
import assert from "node:assert/strict";
import {
  Spring,
  VectorSpring,
  stepSpring,
  normalizeSpringOptions,
  SPRING_LIMITS,
} from "../dist/packages/spring/index.js";
const near = (a, b, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)),
    `${a} != ${b}`,
  );

test("all damping regimes have the analytic semigroup property across unequal timesteps", () => {
  for (const dampingRatio of [0, 0.3, 0.999999999, 1, 1.000000001, 2.5, 10]) {
    const config = { frequency: 1.7, dampingRatio };
    const state = { value: -1.4, target: 2.3, velocity: 3.7 };
    const single = stepSpring(state, 0.91, config);
    let split = { ...state };
    for (const dt of [0.017, 0.091, 0.3, 0.002, 0.5])
      split = stepSpring(split, dt, config);
    near(single.value, split.value);
    near(single.velocity, split.velocity);
  }
});
test("undamped spring matches cosine and conserves oscillator energy", () => {
  const spring = new Spring({
    value: 1,
    target: 0,
    frequency: 2,
    dampingRatio: 0,
  });
  const omega = 4 * Math.PI,
    energy = omega ** 2;
  for (let i = 1; i <= 240; i++) {
    spring.step(1 / 120);
    near(spring.value, Math.cos((omega * i) / 120));
    near(spring.velocity ** 2 + omega ** 2 * spring.value ** 2, energy);
  }
});
test("critical response matches the closed-form reference and overdamping stays monotone from rest", () => {
  const config = { frequency: 1, dampingRatio: 1 },
    dt = 0.37,
    omega = 2 * Math.PI;
  const result = stepSpring({ value: 0, target: 1, velocity: 0 }, dt, config);
  near(result.value, 1 - (1 + omega * dt) * Math.exp(-omega * dt));
  near(result.velocity, omega ** 2 * dt * Math.exp(-omega * dt));
  for (const dampingRatio of [1, 1.2, 10]) {
    const spring = new Spring({ target: 1, frequency: 2, dampingRatio });
    let previous = 0;
    for (let i = 0; i < 400; i++) {
      spring.step(0.02);
      assert.ok(spring.value >= previous - 1e-14 && spring.value <= 1 + 1e-14);
      previous = spring.value;
    }
  }
});
test("target changes preserve momentum; additive impulses preserve position", () => {
  const spring = new Spring({ target: 2 });
  spring.step(0.08);
  const before = spring.state;
  spring.setTarget(-1);
  assert.equal(spring.value, before.value);
  assert.equal(spring.velocity, before.velocity);
  spring.impulse(3).impulse(-1);
  near(spring.velocity, before.velocity + 2);
  assert.equal(spring.value, before.value);
  const expected = stepSpring(spring.state, 0.1, spring.options);
  spring.step(0.1);
  assert.deepEqual(spring.state, expected);
});
test("XYZ axes match scalar springs and inputs/outputs are detached", () => {
  const value = [1, -2, 3],
    target = [0, 4, -1],
    velocity = [2, 0, -3];
  const vector = new VectorSpring({
    value,
    target,
    velocity,
    dampingRatio: 1.6,
  });
  const axes = value.map(
    (v, i) =>
      new Spring({
        value: v,
        target: target[i],
        velocity: velocity[i],
        dampingRatio: 1.6,
      }),
  );
  value[0] = 900;
  target[1] = 900;
  velocity[2] = 900;
  vector.step(0.19);
  axes.forEach((axis, i) => {
    axis.step(0.19);
    near(vector.value[i], axis.value);
    near(vector.velocity[i], axis.velocity);
  });
  vector.state.value[0] = 999;
  vector.target[0] = 999;
  vector.options.frequency = 99;
  near(vector.value[0], axes[0].value);
  assert.equal(vector.target[0], 0);
  assert.equal(vector.options.frequency, 2);
});
test("snap stops at its target; reset restores constructor state and configuration", () => {
  for (const spring of [
    new Spring({ value: 2, target: 5, velocity: -1 }),
    new VectorSpring({
      value: [2, 3, 4],
      target: [5, 6, 7],
      velocity: [-1, 0, 2],
    }),
  ]) {
    const initial = spring.state,
      options = spring.options;
    spring.step(0.2);
    spring.configure({ dampingRatio: 2 });
    spring.snap();
    assert.deepEqual(spring.value, initial.target);
    assert.deepEqual(
      spring.velocity,
      typeof spring.value === "number" ? 0 : [0, 0, 0],
    );
    spring.reset();
    assert.deepEqual(spring.state, initial);
    assert.deepEqual(spring.options, options);
  }
});
test("zero time is unchanged and extreme valid parameters settle without NaN", () => {
  const state = { value: 2, target: -3, velocity: 4 };
  assert.deepEqual(stepSpring(state, 0), state);
  for (const dampingRatio of [0.999999999999, 1, 1.000000000001, 10]) {
    const result = stepSpring(state, 60, { frequency: 100, dampingRatio });
    assert.equal(result.value, -3);
    assert.equal(result.velocity, 0);
  }
});
test("invalid inputs and computed limit failures leave scalar and vector state unchanged", () => {
  const spring = new Spring({ value: 3, target: 1 });
  const before = spring.state;
  for (const dt of [-1, Infinity, NaN, 60.1])
    assert.throws(() => spring.step(dt), RangeError);
  assert.throws(() => spring.configure({ frequency: 4, dampingRatio: -1 }));
  assert.throws(() => spring.setTarget(Infinity));
  assert.throws(() => spring.impulse(NaN));
  assert.deepEqual(spring.state, before);
  assert.equal(spring.options.frequency, 2);
  const limit = SPRING_LIMITS.maxMagnitude;
  const extreme = new Spring({
    value: limit,
    target: -limit,
    frequency: 100,
    dampingRatio: 0,
  });
  const original = extreme.state;
  assert.throws(() => extreme.step(0.0025), RangeError);
  assert.deepEqual(extreme.state, original);
  const vector = new VectorSpring({ velocity: [0, limit, 0] });
  const snapshot = vector.state;
  assert.throws(() => vector.impulse([3, 1, 0]));
  assert.deepEqual(vector.state, snapshot);
  const extremeVector = new VectorSpring({
    value: [1, limit, 2],
    target: [0, -limit, 0],
    frequency: 100,
    dampingRatio: 0,
  });
  const originalVector = extremeVector.state;
  assert.throws(() => extremeVector.step(0.0025));
  assert.deepEqual(extremeVector.state, originalVector);
});
test("strict configuration and dense vector validation reject mistaken units and shapes", () => {
  for (const options of [
    null,
    [],
    { frequency: 0 },
    { frequency: 101 },
    { frequency: undefined },
    { dampingRatio: 11 },
    { stiffness: 50 },
  ])
    assert.throws(() => normalizeSpringOptions(options));
  for (const value of [[1, 2], [1, 2, NaN], new Array(3), { x: 1, y: 2, z: 3 }])
    assert.throws(() => new VectorSpring({ value }));
  assert.throws(() => new Spring({ target: undefined }));
  assert.throws(() => stepSpring({ value: 0, target: 1 }, 0.1));
});
