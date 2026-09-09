/** Spring: an analytic damped oscillator. No clock, renderer or dependencies. */
export const VERSION = "0.1.0";
export const SPRING_DEFAULTS = Object.freeze({
  frequency: 2,
  dampingRatio: 0.65,
});
export const SPRING_LIMITS = Object.freeze({
  minFrequency: 0.01,
  maxFrequency: 100,
  maxDampingRatio: 10,
  maxDeltaTime: 60,
  maxMagnitude: 1e12,
});
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
function record(value, allowed, name) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new TypeError(`${name} must be a plain object`);
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new TypeError(`Unknown ${name} field: ${key}`);
}
function finite(
  value,
  name,
  min = -SPRING_LIMITS.maxMagnitude,
  max = SPRING_LIMITS.maxMagnitude,
) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`${name} must be finite in [${min}, ${max}]`);
  return value;
}
function vector(value, name) {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    ![0, 1, 2].every((i) => own(value, i))
  )
    throw new TypeError(`${name} must be a dense three-number array`);
  return [0, 1, 2].map((i) => finite(value[i], `${name}[${i}]`));
}
export function normalizeSpringOptions(options = {}) {
  record(options, ["frequency", "dampingRatio"], "options");
  return {
    frequency: finite(
      own(options, "frequency") ? options.frequency : SPRING_DEFAULTS.frequency,
      "frequency",
      SPRING_LIMITS.minFrequency,
      SPRING_LIMITS.maxFrequency,
    ),
    dampingRatio: finite(
      own(options, "dampingRatio")
        ? options.dampingRatio
        : SPRING_DEFAULTS.dampingRatio,
      "dampingRatio",
      0,
      SPRING_LIMITS.maxDampingRatio,
    ),
  };
}
function parameters(input) {
  const result = {};
  for (const key of ["frequency", "dampingRatio"])
    if (own(input, key)) result[key] = input[key];
  return normalizeSpringOptions(result);
}
function scalarState(input) {
  record(input, ["value", "velocity", "target"], "state");
  return {
    value: finite(input.value, "value"),
    velocity: finite(input.velocity, "velocity"),
    target: finite(input.target, "target"),
  };
}
function delta(dt) {
  return finite(dt, "dt", 0, SPRING_LIMITS.maxDeltaTime);
}

// exp(A dt) for y'' + 2ζω y' + ω²y = 0, where y = value - target.
// sinh is evaluated as a difference of decaying exponentials, avoiding overflow.
function coefficients(dt, { frequency, dampingRatio: zeta }) {
  const omega = 2 * Math.PI * frequency,
    decay = zeta * omega;
  let c, s;
  if (zeta < 1) {
    const b = omega * Math.sqrt((1 - zeta) * (1 + zeta)),
      angle = b * dt;
    const sinc =
      Math.abs(angle) < 1e-4
        ? 1 - (angle * angle) / 6 + angle ** 4 / 120
        : Math.sin(angle) / angle;
    const envelope = Math.exp(-decay * dt);
    c = envelope * Math.cos(angle);
    s = envelope * dt * sinc;
  } else if (zeta === 1) {
    c = Math.exp(-omega * dt);
    s = dt * c;
  } else {
    const root = Math.sqrt((zeta - 1) * (zeta + 1));
    const b = omega * root,
      slow = -omega / (zeta + root);
    const envelope = Math.exp(slow * dt),
      separation = -2 * b * dt;
    c = (envelope * (1 + Math.exp(separation))) / 2;
    s = (envelope * -Math.expm1(separation)) / (2 * b);
  }
  return [c + decay * s, s, -omega * omega * s, c - decay * s];
}
function evolve(state, matrix) {
  const offset = state.value - state.target;
  return {
    value: finite(
      state.target + matrix[0] * offset + matrix[1] * state.velocity,
      "result value",
    ),
    velocity: finite(
      matrix[2] * offset + matrix[3] * state.velocity,
      "result velocity",
    ),
    target: state.target,
  };
}

/** Exact constant-target step, up to floating-point rounding; returns detached state. */
export function stepSpring(state, dt, options = {}) {
  const current = scalarState(state),
    config = normalizeSpringOptions(options);
  delta(dt);
  return dt === 0 ? current : evolve(current, coefficients(dt, config));
}

export class Spring {
  #state;
  #config;
  #initial;
  constructor(options = {}) {
    record(
      options,
      ["value", "target", "velocity", "frequency", "dampingRatio"],
      "spring",
    );
    const value = own(options, "value") ? options.value : 0;
    this.#state = scalarState({
      value,
      target: own(options, "target") ? options.target : value,
      velocity: own(options, "velocity") ? options.velocity : 0,
    });
    this.#config = parameters(options);
    this.#initial = { state: { ...this.#state }, config: { ...this.#config } };
  }
  get value() {
    return this.#state.value;
  }
  get velocity() {
    return this.#state.velocity;
  }
  get target() {
    return this.#state.target;
  }
  get state() {
    return { ...this.#state };
  }
  get options() {
    return { ...this.#config };
  }
  step(dt) {
    delta(dt);
    if (dt !== 0)
      this.#state = evolve(this.#state, coefficients(dt, this.#config));
    return this.value;
  }
  setTarget(value) {
    this.#state.target = finite(value, "target");
    return this;
  }
  impulse(velocity) {
    finite(velocity, "impulse");
    this.#state.velocity = finite(this.velocity + velocity, "result velocity");
    return this;
  }
  configure(options) {
    record(options, ["frequency", "dampingRatio"], "options");
    this.#config = normalizeSpringOptions({ ...this.#config, ...options });
    return this;
  }
  snap(value = this.target) {
    finite(value, "value");
    this.#state = { value, target: value, velocity: 0 };
    return this;
  }
  reset() {
    this.#state = { ...this.#initial.state };
    this.#config = { ...this.#initial.config };
    return this;
  }
}

/** Three independent scalar axes sharing frequency/damping; values are plain XYZ tuples. */
export class VectorSpring {
  #state;
  #config;
  #initial;
  constructor(options = {}) {
    record(
      options,
      ["value", "target", "velocity", "frequency", "dampingRatio"],
      "vector spring",
    );
    const value = vector(
      own(options, "value") ? options.value : [0, 0, 0],
      "value",
    );
    this.#state = {
      value,
      target: vector(own(options, "target") ? options.target : value, "target"),
      velocity: vector(
        own(options, "velocity") ? options.velocity : [0, 0, 0],
        "velocity",
      ),
    };
    this.#config = parameters(options);
    this.#initial = { state: this.state, config: { ...this.#config } };
  }
  get value() {
    return [...this.#state.value];
  }
  get velocity() {
    return [...this.#state.velocity];
  }
  get target() {
    return [...this.#state.target];
  }
  get state() {
    return { value: this.value, target: this.target, velocity: this.velocity };
  }
  get options() {
    return { ...this.#config };
  }
  step(dt) {
    delta(dt);
    if (dt === 0) return this.value;
    const matrix = coefficients(dt, this.#config);
    const axes = [0, 1, 2].map((i) =>
      evolve(
        {
          value: this.#state.value[i],
          velocity: this.#state.velocity[i],
          target: this.#state.target[i],
        },
        matrix,
      ),
    );
    this.#state = {
      value: axes.map((a) => a.value),
      velocity: axes.map((a) => a.velocity),
      target: this.target,
    };
    return this.value;
  }
  setTarget(value) {
    this.#state.target = vector(value, "target");
    return this;
  }
  impulse(velocity) {
    const input = vector(velocity, "impulse");
    const next = input.map((v, i) =>
      finite(v + this.#state.velocity[i], `result velocity[${i}]`),
    );
    this.#state.velocity = next;
    return this;
  }
  configure(options) {
    record(options, ["frequency", "dampingRatio"], "options");
    this.#config = normalizeSpringOptions({ ...this.#config, ...options });
    return this;
  }
  snap(value = this.target) {
    const next = vector(value, "value");
    this.#state = { value: next, target: [...next], velocity: [0, 0, 0] };
    return this;
  }
  reset() {
    this.#state = {
      value: [...this.#initial.state.value],
      target: [...this.#initial.state.target],
      velocity: [...this.#initial.state.velocity],
    };
    this.#config = { ...this.#initial.config };
    return this;
  }
}
