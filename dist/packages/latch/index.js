import { Raycaster, Vector3 } from "three";

const EPSILON = 1e-6;
const finiteVector = (v) => v && [v.x, v.y, v.z].every(Number.isFinite);
function number(value, name, min = 0, allowInfinity = false) {
  if (
    (!Number.isFinite(value) && !(allowInfinity && value === Infinity)) ||
    value < min
  )
    throw new RangeError(`${name} must be a number >= ${min}`);
  return value;
}
function visible(object) {
  for (let node = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
}
function inside(object, root) {
  for (let node = object; node; node = node.parent)
    if (node === root) return true;
  return false;
}

/** A renderer-free, host-owned-input contextual interaction controller. */
export class Latch {
  constructor({ reach = 3, aimFar = Infinity, focusTolerance = 0.015 } = {}) {
    this.options = Object.freeze({
      reach: number(reach, "reach"),
      aimFar: number(aimFar, "aimFar", 0, true),
      focusTolerance: number(focusTolerance, "focusTolerance"),
    });
    this._targets = new Map();
    this._roots = new Map();
    this._occluders = [];
    this._raycaster = new Raycaster();
    this._visibilityRay = new Raycaster();
    this._direction = new Vector3();
    this._focus = null;
    this._holding = null;
    this._elapsed = 0;
    this._pressed = false;
    this._requiresRelease = false;
    this._order = 0;
    this._updating = false;
  }

  get size() {
    return this._targets.size;
  }

  _assertIdle() {
    if (this._updating)
      throw new Error(
        "Latch cannot be mutated or updated inside a condition or raycast",
      );
  }

  register({
    id,
    root,
    label = id,
    mode = "press",
    holdDuration = 1,
    reach = this.options.reach,
    condition,
  } = {}) {
    this._assertIdle();
    if (typeof id !== "string" || !id.trim())
      throw new TypeError("id must be a nonempty string");
    if (this._targets.has(id)) throw new Error(`Duplicate target id: ${id}`);
    if (!root?.isObject3D) throw new TypeError("root must be a Three.Object3D");
    if (this._roots.has(root))
      throw new Error("An Object3D root can only be registered once");
    if (typeof label !== "string")
      throw new TypeError("label must be a string");
    if (mode !== "press" && mode !== "hold")
      throw new TypeError("mode must be press or hold");
    number(holdDuration, "holdDuration", EPSILON);
    number(reach, "reach");
    if (condition !== undefined && typeof condition !== "function")
      throw new TypeError("condition must be a function");
    const target = Object.freeze({
      id,
      root,
      label,
      mode,
      holdDuration,
      reach,
      condition,
    });
    const record = { target, order: this._order++ };
    this._targets.set(id, record);
    this._roots.set(root, record);
    return target;
  }

  remove(id) {
    this._assertIdle();
    const record = this._targets.get(id);
    if (!record) return false;
    this._roots.delete(record.target.root);
    this._targets.delete(id);
    return true;
  }

  clear() {
    this._assertIdle();
    this._targets.clear();
    this._roots.clear();
  }

  setOccluders(roots = []) {
    this._assertIdle();
    if (!Array.isArray(roots) || roots.some((root) => !root?.isObject3D))
      throw new TypeError("occluders must be an array of Three.Object3D roots");
    this._occluders = [...new Set(roots)];
    return this;
  }

  _owner(object) {
    for (let node = object; node; node = node.parent) {
      const record = this._roots.get(node);
      if (record) return record;
    }
    return null;
  }

  _blocked(raycaster, distance, target) {
    if (distance <= EPSILON || this._occluders.length === 0) return false;
    raycaster.far = Math.max(0, distance - EPSILON);
    return raycaster
      .intersectObjects(this._occluders, true)
      .some(
        (hit) =>
          visible(hit.object) &&
          !inside(hit.object, target.root) &&
          hit.distance < distance - EPSILON,
      );
  }

  _pick(frame) {
    const { aimRay, actorPosition, camera = null } = frame;
    const raycaster = this._raycaster;
    raycaster.camera = camera;
    this._visibilityRay.camera = camera;
    this._direction.copy(aimRay.direction).normalize();
    raycaster.set(aimRay.origin, this._direction);
    raycaster.near = 0;
    raycaster.far = this.options.aimFar;
    // Update ancestors as well as descendants: registered roots may be nested in moving groups.
    const allRoots = [...this._roots.keys()];
    for (const root of [...allRoots, ...this._occluders])
      root.updateWorldMatrix(true, true);
    const roots = allRoots.filter((root) => {
      for (let node = root.parent; node; node = node.parent)
        if (this._roots.has(node)) return false;
      return true;
    });
    const candidates = new Map();
    for (const hit of raycaster.intersectObjects(roots, true)) {
      if (!visible(hit.object)) continue;
      const record = this._owner(hit.object);
      if (!record || candidates.has(record)) continue;
      const distance = actorPosition.distanceTo(hit.point);
      if (distance > record.target.reach + EPSILON) continue;
      if (this._blocked(raycaster, hit.distance, record.target)) continue;
      this._direction.subVectors(hit.point, actorPosition);
      this._visibilityRay.set(actorPosition, this._direction.normalize());
      if (this._blocked(this._visibilityRay, distance, record.target)) continue;
      candidates.set(record, { record, hit, distance });
    }
    const sorted = [...candidates.values()].sort(
      (a, b) =>
        a.hit.distance - b.hit.distance || a.record.order - b.record.order,
    );
    if (sorted.length === 0) return null;
    const closest = sorted[0].hit.distance;
    const stable = sorted.find(
      (candidate) =>
        candidate.record === this._focus?.record &&
        candidate.hit.distance <= closest + this.options.focusTolerance,
    );
    return stable || sorted[0];
  }

  _snapshot(candidate, frame) {
    const { target } = candidate.record;
    const result = target.condition
      ? target.condition({
          context: frame.context,
          actorPosition: frame.actorPosition.clone(),
          target,
          hit: { ...candidate.hit, point: candidate.hit.point.clone() },
        })
      : true;
    if (typeof result !== "boolean" && typeof result !== "string")
      throw new TypeError(
        "A target condition must return true, false, or a blocked-reason string",
      );
    const available = result === true;
    return Object.freeze({
      id: target.id,
      root: target.root,
      label: target.label,
      mode: target.mode,
      holdDuration: target.holdDuration,
      point: candidate.hit.point.clone(),
      distance: candidate.distance,
      available,
      reason: available
        ? null
        : typeof result === "string" && result
          ? result
          : "Unavailable",
    });
  }

  update(frame) {
    this._assertIdle();
    if (
      !frame ||
      !finiteVector(frame.actorPosition) ||
      !frame.actorPosition.isVector3
    )
      throw new TypeError(
        "actorPosition must be a finite Three.Vector3 in world coordinates",
      );
    if (
      !finiteVector(frame.aimRay?.origin) ||
      !finiteVector(frame.aimRay?.direction) ||
      frame.aimRay.direction.lengthSq() === 0
    )
      throw new TypeError(
        "aimRay must have a finite origin and nonzero Vector3 direction",
      );
    number(frame.dt, "dt");
    if (typeof frame.pressed !== "boolean")
      throw new TypeError("pressed must be boolean");
    const before = {
      _focus: this._focus,
      _holding: this._holding,
      _elapsed: this._elapsed,
      _pressed: this._pressed,
      _requiresRelease: this._requiresRelease,
    };
    this._updating = true;
    try {
      return this._update(frame);
    } catch (error) {
      // No result means the host received no events. Keep the gesture retryable.
      Object.assign(this, before);
      throw error;
    } finally {
      this._updating = false;
    }
  }

  _update(frame) {
    const events = [];
    const emit = (type, target, extra = {}) =>
      events.push(Object.freeze({ type, target, ...extra }));
    const cancel = (reason) => {
      if (this._holding) emit("cancel", this._holding.snapshot, { reason });
      this._holding = null;
      this._elapsed = 0;
    };
    const wasPressed = this._pressed;
    const rising = frame.pressed && !wasPressed;
    this._pressed = frame.pressed;
    if (!frame.pressed) this._requiresRelease = false;

    const previous = this._focus;
    const candidate = frame.suspended ? null : this._pick(frame);
    const changed = previous?.record !== candidate?.record;
    if (changed) {
      const removed =
        previous &&
        this._targets.get(previous.record.target.id) !== previous.record;
      const reason = removed
        ? "removed"
        : frame.suspended
          ? "suspended"
          : "focus-lost";
      cancel(reason);
      if (previous) emit("blur", previous.snapshot, { reason });
      if (frame.pressed && (wasPressed || previous))
        this._requiresRelease = true;
    }
    if (frame.suspended && frame.pressed) this._requiresRelease = true;
    this._focus = candidate
      ? { ...candidate, snapshot: this._snapshot(candidate, frame) }
      : null;
    if (changed && this._focus) emit("focus", this._focus.snapshot);
    if (!frame.pressed) cancel("released");
    if (this._holding && !this._focus?.snapshot.available) {
      cancel("unavailable");
      this._requiresRelease = frame.pressed;
    }

    let started = false;
    if (rising && !this._requiresRelease && this._focus) {
      if (!this._focus.snapshot.available) {
        emit("blocked", this._focus.snapshot, {
          reason: this._focus.snapshot.reason,
        });
        this._requiresRelease = true;
      } else if (this._focus.record.target.mode === "hold") {
        this._holding = this._focus;
        this._elapsed = 0;
        started = true;
        emit("start", this._focus.snapshot);
      } else {
        // Recheck immediately before an activation event; predicates must remain pure.
        this._focus.snapshot = this._snapshot(this._focus, frame);
        if (this._focus.snapshot.available)
          emit("activate", this._focus.snapshot);
        else
          emit("blocked", this._focus.snapshot, {
            reason: this._focus.snapshot.reason,
          });
        this._requiresRelease = true;
      }
    }
    if (this._holding && frame.pressed && !started) {
      this._elapsed += frame.dt;
      if (
        this._elapsed + Number.EPSILON >=
        this._holding.record.target.holdDuration
      ) {
        this._focus.snapshot = this._snapshot(this._focus, frame);
        if (this._focus.snapshot.available) {
          emit("activate", this._focus.snapshot);
          this._holding = null;
          this._elapsed = 0;
        } else cancel("unavailable");
        this._requiresRelease = true;
      }
    }
    return Object.freeze({
      focus: this._focus?.snapshot ?? null,
      progress: this._holding
        ? Math.min(1, this._elapsed / this._holding.record.target.holdDuration)
        : 0,
      holding: Boolean(this._holding),
      requiresRelease: this._requiresRelease,
      events: Object.freeze(events),
    });
  }
}
