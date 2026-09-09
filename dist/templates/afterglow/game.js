import { containsLocalPoint } from "@cranberry-forge/signal";

export const AFTERGLOW_DEFAULTS = Object.freeze({
  rounds: 3,
  roundDuration: 18,
  health: 3,
  arenaRadius: 8.8,
  moveSpeed: 4.8,
  dashSpeed: 18,
  dashDuration: 0.22,
  dashCooldown: 1.25,
});

const clone = (value) => structuredClone(value);
const EPS = 1e-9;

/** Exactly the same local XZ footprint as a Signal Telegraph rotated around Y. */
export function attackContains(attack, point) {
  if (
    !attack ||
    !point ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.z)
  )
    throw new TypeError("A finite XZ point and an attack are required");
  const x = point.x - attack.x,
    z = point.z - attack.z;
  const c = Math.cos(attack.rotation),
    s = Math.sin(attack.rotation);
  return containsLocalPoint(attack.options, c * x - s * z, s * x + c * z);
}

function configuration(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("Game options must be an object");
  for (const key of Object.keys(input))
    if (!Object.hasOwn(AFTERGLOW_DEFAULTS, key))
      throw new TypeError(`Unknown game option: ${key}`);
  const options = { ...AFTERGLOW_DEFAULTS, ...input };
  for (const [key, min, max] of [
    ["rounds", 1, 5],
    ["roundDuration", 12, 60],
    ["health", 1, 10],
    ["arenaRadius", 7, 12],
    ["moveSpeed", 1, 12],
    ["dashSpeed", 8, 30],
    ["dashDuration", 0.1, 0.5],
    ["dashCooldown", 0.5, 5],
  ]) {
    if (
      !Number.isFinite(options[key]) ||
      options[key] < min ||
      options[key] > max
    )
      throw new RangeError(`${key} must be finite in [${min}, ${max}]`);
  }
  if (!Number.isInteger(options.rounds) || !Number.isInteger(options.health))
    throw new TypeError("rounds and health must be integers");
  return Object.freeze(options);
}

/** A finite, deterministic survival controller. It creates no scene, renderer or DOM. */
export class AfterglowGame {
  #options;
  #state;
  #schedule;
  #cursor = 0;
  #dashDirection = { x: 0, z: -1 };
  constructor(options = {}) {
    this.#options = configuration(options);
    this.restart();
  }
  get options() {
    return this.#options;
  }
  get phase() {
    return this.#state.phase;
  }
  get view() {
    return clone(this.#state);
  }
  restart() {
    this.#state = {
      phase: "ready",
      time: 0,
      round: 1,
      health: this.#options.health,
      position: { x: 0, z: 4.5 },
      facing: { x: 0, z: -1 },
      dashRemaining: 0,
      cooldown: 0,
      invulnerability: 0,
      attacks: [],
      resolved: 0,
      avoided: 0,
      hits: 0,
      score: 0,
      duration: this.#options.rounds * this.#options.roundDuration,
    };
    this.#cursor = 0;
    this.#dashDirection = { x: 0, z: -1 };
    this.#schedule = [];
    for (let round = 1; round <= this.#options.rounds; round++) {
      [0.08, 0.24, 0.4, 0.56, 0.72, 0.84].forEach((fraction, index) => {
        this.#schedule.push({
          id: `r${round}-${index}`,
          round,
          index,
          at: (round - 1 + fraction) * this.#options.roundDuration,
        });
      });
    }
    return this.view;
  }
  start() {
    if (this.phase !== "ready") return false;
    this.#state.phase = "playing";
    return true;
  }
  pause() {
    if (this.phase !== "playing") return false;
    this.#state.phase = "paused";
    return true;
  }
  resume() {
    if (this.phase !== "paused") return false;
    this.#state.phase = "playing";
    return true;
  }
  #arm(spec, events) {
    const s = this.#state,
      radius = this.#options.arenaRadius;
    const warning = 1.65 - Math.min(spec.round - 1, 3) * 0.16;
    const common = {
      color: "#ff9473",
      opacity: 0.88,
      intensity: 1.35,
      segments: 48,
    };
    const attack = {
      id: spec.id,
      round: spec.round,
      x: 0,
      z: 0,
      rotation: 0,
      armedAt: spec.at,
      impactAt: spec.at + warning,
      duration: warning,
      options: { ...common, shape: "circle", radius: 2.6 },
    };
    switch (spec.index % 4) {
      case 0:
        attack.x = s.position.x;
        attack.z = s.position.z;
        attack.label = "Sunfall · leave the circle";
        break;
      case 1:
        attack.options = {
          ...common,
          shape: "cone",
          radius: radius * 2,
          angle: 58,
        };
        attack.rotation = Math.atan2(-s.position.x, -s.position.z);
        attack.label = "Solar fan · cross the edge";
        break;
      case 2: {
        attack.x = spec.round % 2 ? -radius : radius;
        attack.z = spec.round % 2 ? -2 : 2;
        attack.rotation = Math.atan2(
          attack.x - s.position.x,
          attack.z - s.position.z,
        );
        attack.options = {
          ...common,
          shape: "beam",
          width: 2.8,
          length: radius * 2.3,
        };
        attack.label = "Light lance · sidestep the lane";
        break;
      }
      case 3:
        attack.options = {
          ...common,
          shape: "circle",
          radius: radius + 1,
          innerRadius: radius * 0.55,
        };
        attack.label = "Corona · find the quiet center";
        break;
    }
    s.attacks.push(attack);
    events.push({ type: "armed", attack: clone(attack) });
    if (spec.round >= 3 && spec.index === 4) {
      const echo = clone(attack);
      echo.id += "-echo";
      echo.x = -attack.x * 0.65;
      echo.z = -attack.z * 0.65;
      echo.options.radius = 2.1;
      echo.label = "Twin sunfall · find the opening";
      s.attacks.push(echo);
      events.push({ type: "armed", attack: clone(echo) });
    }
  }
  #resolve(events) {
    const s = this.#state;
    const due = s.attacks.filter((a) => a.impactAt <= s.time + EPS);
    s.attacks = s.attacks.filter((a) => a.impactAt > s.time + EPS);
    for (const attack of due) {
      if (s.phase !== "playing") break;
      const inside = attackContains(attack, s.position);
      const protectedNow = s.dashRemaining > EPS || s.invulnerability > EPS;
      const damaged = inside && !protectedNow;
      s.resolved++;
      if (damaged) {
        s.health--;
        s.hits++;
        s.invulnerability = 0.75;
      } else s.avoided++;
      events.push({
        type: "impact",
        attack: clone(attack),
        inside,
        damaged,
        dashed: inside && s.dashRemaining > EPS,
      });
      if (s.health === 0) {
        s.phase = "lost";
        s.attacks = [];
        events.push({ type: "lost" });
      }
    }
  }
  /** x/z are world axes in [-1,1]; dash is a one-frame request. Returns lifecycle events. */
  step(dt, input = {}) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 0.25)
      throw new RangeError("dt must be finite in [0, 0.25] seconds");
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new TypeError("input must be an object");
    const { x = 0, z = 0, dash = false } = input;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      Math.abs(x) > 1 ||
      Math.abs(z) > 1 ||
      typeof dash !== "boolean"
    )
      throw new TypeError(
        "input requires finite x/z in [-1,1] and a boolean dash",
      );
    const events = [],
      s = this.#state,
      o = this.#options;
    if (s.phase !== "playing" || dt === 0) return events;
    const length = Math.hypot(x, z),
      scale = length > 1 ? 1 / length : 1;
    const direction = { x: x * scale, z: z * scale };
    if (length > 0.01) s.facing = { x: x / length, z: z / length };
    if (dash && s.cooldown <= EPS) {
      this.#dashDirection = { ...s.facing };
      s.dashRemaining = o.dashDuration;
      s.cooldown = o.dashCooldown;
      events.push({ type: "dash", position: { ...s.position } });
    }
    let remaining = Math.min(dt, s.duration - s.time);
    while (remaining > EPS && s.phase === "playing") {
      while (
        this.#cursor < this.#schedule.length &&
        this.#schedule[this.#cursor].at <= s.time + EPS
      )
        this.#arm(this.#schedule[this.#cursor++], events);
      this.#resolve(events);
      if (s.phase !== "playing") break;
      let h = Math.min(remaining, 1 / 120);
      const next = this.#schedule[this.#cursor];
      if (next && next.at > s.time + EPS) h = Math.min(h, next.at - s.time);
      for (const a of s.attacks)
        if (a.impactAt > s.time + EPS) h = Math.min(h, a.impactAt - s.time);
      if (s.dashRemaining > EPS) h = Math.min(h, s.dashRemaining);
      const movement = s.dashRemaining > EPS ? this.#dashDirection : direction;
      const speed = s.dashRemaining > EPS ? o.dashSpeed : o.moveSpeed;
      s.position.x += movement.x * speed * h;
      s.position.z += movement.z * speed * h;
      const distance = Math.hypot(s.position.x, s.position.z);
      if (distance > o.arenaRadius) {
        s.position.x *= o.arenaRadius / distance;
        s.position.z *= o.arenaRadius / distance;
      }
      s.dashRemaining = Math.max(0, s.dashRemaining - h);
      s.cooldown = Math.max(0, s.cooldown - h);
      s.invulnerability = Math.max(0, s.invulnerability - h);
      s.time += h;
      remaining -= h;
      this.#resolve(events);
    }
    const nextRound = Math.min(
      o.rounds,
      Math.floor((s.time + EPS) / o.roundDuration) + 1,
    );
    if (nextRound > s.round && s.phase === "playing") {
      s.round = nextRound;
      events.push({ type: "round", round: s.round });
    }
    if (s.time >= s.duration - EPS && s.phase === "playing") {
      s.time = s.duration;
      s.phase = "won";
      s.attacks = [];
      events.push({ type: "won" });
    }
    s.score =
      Math.floor(s.time * 10 + EPS) +
      s.avoided * 100 +
      (s.phase === "won" ? s.health * 250 : 0);
    return events;
  }
}
