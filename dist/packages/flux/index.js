import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";

export const FLUX_DEFAULTS = Object.freeze({
  capacity: 256,
  lifetime: 2,
  width: 0.4,
  taper: 1.25,
  opacity: 1,
  intensity: 2.2,
  color: "#b6f5d8",
  tailColor: "#237c92",
  minDistance: 0.025,
  maxJump: 8,
});
export function normalizeTrailOptions(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("options must be an object");
  const o = { ...FLUX_DEFAULTS, ...input };
  const ranges = {
    capacity: [4, 4096],
    lifetime: [0.01, 120],
    width: [0.001, 100],
    taper: [0, 8],
    opacity: [0, 1],
    intensity: [0, 30],
    minDistance: [0, 100],
    maxJump: [0.001, 1e6],
  };
  const result = {};
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (!Number.isFinite(o[key]) || o[key] < min || o[key] > max)
      throw new RangeError(`${key} must be finite in [${min},${max}]`);
    result[key] = o[key];
  }
  if (!Number.isInteger(o.capacity))
    throw new RangeError("capacity must be an integer");
  for (const key of ["color", "tailColor"]) {
    if (typeof o[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(o[key]))
      throw new TypeError(`${key} must be #rrggbb`);
    result[key] = o[key];
  }
  return result;
}

/** Camera-facing world-space ribbon. Owns its geometry/material; keep object transform identity. */
export class Trail extends Mesh {
  constructor(options = {}) {
    const o = normalizeTrailOptions(options),
      geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(o.capacity * 6), 3).setUsage(
        DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "aLife",
      new BufferAttribute(new Float32Array(o.capacity * 2), 1).setUsage(
        DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "aSide",
      new BufferAttribute(new Float32Array(o.capacity * 2), 1),
    );
    const sides = geometry.attributes.aSide.array;
    for (let i = 0; i < o.capacity; i++) {
      sides[i * 2] = -1;
      sides[i * 2 + 1] = 1;
    }
    geometry.setIndex(
      new BufferAttribute(new Uint16Array((o.capacity - 1) * 6), 1).setUsage(
        DynamicDrawUsage,
      ),
    );
    geometry.setDrawRange(0, 0);
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
      uniforms: {
        headColor: { value: new Color(o.color) },
        tailColor: { value: new Color(o.tailColor) },
        opacity: { value: o.opacity },
        intensity: { value: o.intensity },
      },
      vertexShader: `attribute float aLife; attribute float aSide; varying float vLife; varying float vSide;
      void main(){vLife=aLife;vSide=aSide;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 headColor;uniform vec3 tailColor;uniform float opacity;uniform float intensity;varying float vLife;varying float vSide;
      void main(){float edge=pow(max(0.,1.-abs(vSide)),1.6);float fade=smoothstep(0.,.3,vLife);vec3 tint=mix(tailColor,headColor,pow(vLife,.7));float core=pow(max(0.,1.-abs(vSide)),12.);gl_FragColor=vec4((tint+core*.5)*intensity,edge*fade*opacity);}`,
    });
    super(geometry, material);
    this.name = "Flux trail";
    this.frustumCulled = false;
    this.options = o;
    this._points = new Float64Array(o.capacity * 3);
    this._times = new Float64Array(o.capacity);
    this._breaks = new Uint8Array(o.capacity);
    this._head = 0;
    this._count = 0;
    this._lastTime = -Infinity;
    this._clock = -Infinity;
    this._breakNext = false;
    this._disposed = false;
    this._tangent = new Vector3();
    this._view = new Vector3();
    this._side = new Vector3();
    this._fallback = new Vector3(0, 1, 0);
  }
  get sampleCount() {
    return this._count;
  }
  get capacity() {
    return this.options.capacity;
  }
  /** Add a world-space point at monotonic time in seconds. Returns whether it was stored. */
  push(position, time) {
    if (this._disposed) throw new Error("Trail has been disposed");
    const x = position.x ?? position[0],
      y = position.y ?? position[1],
      z = position.z ?? position[2];
    if (![x, y, z, time].every(Number.isFinite))
      throw new TypeError("position and time must be finite");
    if (time < this._lastTime || time < this._clock)
      throw new RangeError("time must be monotonic");
    const o = this.options,
      prev = (this._head - 1 + o.capacity) % o.capacity;
    let distance = 0;
    if (this._count) {
      const j = prev * 3;
      distance = Math.hypot(
        x - this._points[j],
        y - this._points[j + 1],
        z - this._points[j + 2],
      );
      if (
        !this._breakNext &&
        distance < o.minDistance &&
        time - this._times[prev] < o.lifetime
      )
        return false;
    }
    const i = this._head,
      j = i * 3;
    this._points[j] = x;
    this._points[j + 1] = y;
    this._points[j + 2] = z;
    this._times[i] = time;
    this._breaks[i] = this._breakNext || distance > o.maxJump ? 1 : 0;
    this._breakNext = false;
    this._head = (this._head + 1) % o.capacity;
    this._count = Math.min(o.capacity, this._count + 1);
    this._lastTime = time;
    return true;
  }
  /** Prevent connection to the next stored point (weapon toggle or teleport). */
  break() {
    this._breakNext = true;
    return this;
  }
  clear() {
    this._head = 0;
    this._count = 0;
    this._lastTime = -Infinity;
    this._clock = -Infinity;
    this._breakNext = false;
    this.geometry.setDrawRange(0, 0);
    return this;
  }
  /** Update lifespan and billboard geometry once per rendered frame. Camera position is world-space. */
  update(time, cameraPosition) {
    if (this._disposed) throw new Error("Trail has been disposed");
    if (!Number.isFinite(time) || time < this._clock || time < this._lastTime)
      throw new RangeError("update time must be finite and monotonic");
    if (
      !cameraPosition ||
      ![cameraPosition.x, cameraPosition.y, cameraPosition.z].every(
        Number.isFinite,
      )
    )
      throw new TypeError("cameraPosition must be a finite Vector3");
    this._clock = time;
    const o = this.options,
      c = o.capacity;
    while (
      this._count &&
      time - this._times[(this._head - this._count + c) % c] >= o.lifetime
    )
      this._count--;
    const position = this.geometry.attributes.position,
      life = this.geometry.attributes.aLife,
      index = this.geometry.index;
    const start = (this._head - this._count + c) % c;
    let used = 0;
    for (let k = 0; k < this._count; k++) {
      const i = (start + k) % c,
        j = i * 3,
        prev = ((start + Math.max(0, k - 1)) % c) * 3,
        next = ((start + Math.min(this._count - 1, k + 1)) % c) * 3;
      this._tangent.set(
        this._points[next] - this._points[prev],
        this._points[next + 1] - this._points[prev + 1],
        this._points[next + 2] - this._points[prev + 2],
      );
      if (this._tangent.lengthSq() < 1e-12) this._tangent.set(0, 1, 0);
      this._tangent.normalize();
      this._view
        .set(
          cameraPosition.x - this._points[j],
          cameraPosition.y - this._points[j + 1],
          cameraPosition.z - this._points[j + 2],
        )
        .normalize();
      this._side.crossVectors(this._tangent, this._view);
      if (this._side.lengthSq() < 1e-10) {
        this._fallback.set(
          Math.abs(this._tangent.y) < 0.9 ? 0 : 1,
          Math.abs(this._tangent.y) < 0.9 ? 1 : 0,
          0,
        );
        this._side.crossVectors(this._tangent, this._fallback);
      }
      const remaining = Math.max(0, 1 - (time - this._times[i]) / o.lifetime),
        width = o.width * 0.5 * Math.pow(remaining, o.taper);
      this._side.normalize().multiplyScalar(width);
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? -1 : 1;
        position.setXYZ(
          k * 2 + side,
          this._points[j] + sign * this._side.x,
          this._points[j + 1] + sign * this._side.y,
          this._points[j + 2] + sign * this._side.z,
        );
        life.setX(k * 2 + side, remaining);
      }
      if (k > 0 && !this._breaks[i]) {
        const a = (k - 1) * 2,
          b = k * 2;
        for (const v of [a, a + 1, b, a + 1, b + 1, b]) index.array[used++] = v;
      }
    }
    position.needsUpdate = true;
    life.needsUpdate = true;
    index.needsUpdate = true;
    this.geometry.setDrawRange(0, used);
    return this;
  }
  configure(options = {}) {
    const next = normalizeTrailOptions({ ...this.options, ...options });
    if (next.capacity !== this.options.capacity)
      throw new RangeError("capacity is fixed; create a new Trail to resize");
    this.options = next;
    this.material.uniforms.headColor.value.set(next.color);
    this.material.uniforms.tailColor.value.set(next.tailColor);
    this.material.uniforms.opacity.value = next.opacity;
    this.material.uniforms.intensity.value = next.intensity;
    return this;
  }
  toRecipe() {
    return { schema: "cranberry-forge.flux/1", options: { ...this.options } };
  }
  static fromRecipe(value) {
    const d = typeof value === "string" ? JSON.parse(value) : value;
    if (!d || d.schema !== "cranberry-forge.flux/1")
      throw new TypeError("invalid cranberry-forge.flux/1 recipe");
    return new Trail(d.options);
  }
  dispose() {
    if (this._disposed) return;
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this._disposed = true;
  }
}
