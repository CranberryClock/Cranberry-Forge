import {
  AdditiveBlending,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Color,
  Vector3,
} from "three";

export const SIGNAL_DEFAULTS = Object.freeze({
  shape: "circle",
  radius: 5,
  innerRadius: 0,
  angle: 70,
  length: 10,
  width: 3,
  segments: 48,
  color: "#ffb48a",
  opacity: 0.85,
  intensity: 1.7,
  edgeWidth: 0.055,
  offset: 0.045,
});
export function normalizeSignalOptions(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("options must be an object");
  const o = { ...SIGNAL_DEFAULTS, ...input };
  if (!["circle", "cone", "beam"].includes(o.shape))
    throw new TypeError("shape must be circle, cone or beam");
  const result = { shape: o.shape };
  for (const [key, min, max] of [
    ["radius", 0.01, 10000],
    ["innerRadius", 0, 10000],
    ["angle", 1, 359],
    ["length", 0.01, 10000],
    ["width", 0.01, 10000],
    ["segments", 2, 128],
    ["opacity", 0, 1],
    ["intensity", 0, 10],
    ["edgeWidth", 0.001, 0.3],
    ["offset", 0, 10],
  ]) {
    if (!Number.isFinite(o[key]) || o[key] < min || o[key] > max)
      throw new RangeError(`${key} must be finite in [${min},${max}]`);
    result[key] = o[key];
  }
  if (!Number.isInteger(o.segments))
    throw new RangeError("segments must be an integer");
  if (o.innerRadius >= o.radius)
    throw new RangeError("innerRadius must be smaller than radius");
  if (typeof o.color !== "string" || !/^#[0-9a-f]{6}$/i.test(o.color))
    throw new TypeError("color must be #rrggbb");
  result.color = o.color;
  return result;
}

/** Shape footprint in local XZ. Cones and beams point toward -Z. Boundaries inclusive. */
export function containsLocalPoint(options, x, z) {
  const o = normalizeSignalOptions(options);
  if (!Number.isFinite(x) || !Number.isFinite(z))
    throw new TypeError("point coordinates must be finite");
  if (o.shape === "beam")
    return (
      Math.abs(x) <= o.width / 2 + 1e-8 && z <= 1e-8 && z >= -o.length - 1e-8
    );
  const r = Math.hypot(x, z);
  if (r > o.radius + 1e-8 || r < o.innerRadius - 1e-8) return false;
  return (
    o.shape === "circle" ||
    r < 1e-8 ||
    Math.abs(Math.atan2(x, -z)) <= (o.angle * Math.PI) / 360 + 1e-8
  );
}
function geometryFor(o) {
  const g = new PlaneGeometry(
    o.shape === "beam" ? o.width : o.radius * 2,
    o.shape === "beam" ? o.length : o.radius * 2,
    o.segments,
    o.segments,
  );
  g.rotateX(-Math.PI / 2);
  if (o.shape === "beam") g.translate(0, 0, -o.length / 2);
  return g;
}

/** Reusable Y-up combat telegraph. Owns geometry/material. No renderer or game-loop dependency. */
export class Telegraph extends Mesh {
  constructor(options = {}) {
    const o = normalizeSignalOptions(options),
      g = geometryFor(o);
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
      uniforms: {
        shape: { value: ["circle", "cone", "beam"].indexOf(o.shape) },
        radius: { value: o.radius },
        innerRadius: { value: o.innerRadius },
        angle: { value: (o.angle * Math.PI) / 180 },
        length: { value: o.length },
        width: { value: o.width },
        color: { value: new Color(o.color) },
        opacity: { value: o.opacity },
        intensity: { value: o.intensity },
        edgeWidth: { value: o.edgeWidth },
        progress: { value: 0 },
        clock: { value: 0 },
      },
      vertexShader: `varying vec2 vPlane;void main(){vPlane=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform int shape;uniform float radius;uniform float innerRadius;uniform float angle;uniform vec3 color;uniform float opacity;uniform float intensity;uniform float edgeWidth;uniform float progress;uniform float clock;varying vec2 vPlane;
      void main(){
        vec2 p=(vPlane-.5)*2.*radius;float r=length(p);float edge=0.;float fill=0.;float stripes=0.;
        if(shape==2){
          float side=1.-abs(vPlane.x-.5)*2.;float ends=min(vPlane.y,1.-vPlane.y)*2.;
          edge=1.-smoothstep(0.,edgeWidth,min(side,ends));fill=step(vPlane.y,progress);
          stripes=pow(max(0.,cos(vPlane.y*85.-clock*2.)),20.)*.18;
        }else{
          if(r>radius||r<innerRadius)discard;
          float radial=min(radius-r,r-innerRadius)/radius;
          edge=1.-smoothstep(0.,edgeWidth,radial);
          if(innerRadius==0.)edge=1.-smoothstep(0.,edgeWidth,(radius-r)/radius);
          if(shape==1){
            float theta=abs(atan(p.x,p.y));if(theta>angle*.5&&r>.0001)discard;
            edge=max(edge,1.-smoothstep(0.,edgeWidth*2.,angle*.5-theta));
          }
          fill=step((r-innerRadius)/(radius-innerRadius),progress);
          stripes=pow(max(0.,cos(r/radius*75.-clock*2.)),24.)*.15;
        }
        float pulse=.88+.12*sin(clock*3.);float alpha=(edge*.85+fill*.17+stripes*.4+.055)*opacity;
        gl_FragColor=vec4(color*intensity*(1.+edge*.4)*pulse,alpha);
      }`,
    });
    super(g, material);
    this.name = "Signal telegraph";
    this.options = o;
    this._flat = new Float32Array(g.attributes.position.array);
    this._progress = 0;
    this._state = "idle";
    this._start = 0;
    this._duration = 1;
    this._clock = -Infinity;
    this._disposed = false;
    this._surface = null;
    this._scratch = new Vector3();
    this.renderOrder = 3;
    this.project(() => 0);
  }
  get progress() {
    return this._progress;
  }
  set progress(value) {
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw new RangeError("progress must be in [0,1]");
    this._progress = value;
    this.material.uniforms.progress.value = value;
  }
  get state() {
    return this._state;
  }
  arm(time, duration = 2) {
    if (this._disposed) throw new Error("Telegraph has been disposed");
    if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0)
      throw new RangeError("arm requires finite time and positive duration");
    this._start = time;
    this._duration = duration;
    this._clock = time;
    this._state = "charging";
    this.progress = 0;
    this.visible = true;
    this.dispatchEvent({ type: "armed" });
    return this;
  }
  update(time) {
    if (this._disposed) throw new Error("Telegraph has been disposed");
    if (!Number.isFinite(time) || time < this._clock)
      throw new RangeError("time must be finite and monotonic");
    this._clock = time;
    this.material.uniforms.clock.value = time;
    if (this._state === "charging") {
      this.progress = Math.min(
        1,
        Math.max(0, (time - this._start) / this._duration),
      );
      if (this.progress === 1) {
        this._state = "complete";
        this.dispatchEvent({ type: "complete" });
      }
    }
    return this;
  }
  cancel() {
    this._state = "cancelled";
    this.visible = false;
    return this;
  }
  /** Conform vertices to world-space height(x,z). Call again after moving/scaling/rotating. */
  project(surface) {
    if (typeof surface !== "function")
      throw new TypeError("surface must be a height function");
    this.updateWorldMatrix(true, false);
    const inverse = this.matrixWorld.clone().invert(),
      p = this.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      this._scratch.fromArray(this._flat, i * 3).applyMatrix4(this.matrixWorld);
      const h = surface(this._scratch.x, this._scratch.z);
      if (!Number.isFinite(h))
        throw new TypeError("surface must return finite heights");
      this._scratch.y = h + this.options.offset;
      this._scratch.applyMatrix4(inverse);
      p.setXYZ(i, this._scratch.x, this._scratch.y, this._scratch.z);
    }
    p.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();
    this._surface = surface;
    return this;
  }
  /** XZ gameplay footprint; deliberately ignores target altitude and lifecycle state. */
  containsPoint(worldPoint) {
    if (
      !worldPoint ||
      ![worldPoint.x, worldPoint.y, worldPoint.z].every(Number.isFinite)
    )
      throw new TypeError("worldPoint must be a finite Vector3");
    this.updateWorldMatrix(true, false);
    this._scratch.copy(worldPoint);
    this.worldToLocal(this._scratch);
    return containsLocalPoint(this.options, this._scratch.x, this._scratch.z);
  }
  configure(options = {}) {
    const next = normalizeSignalOptions({ ...this.options, ...options }),
      keys = [
        "shape",
        "radius",
        "innerRadius",
        "angle",
        "length",
        "width",
        "segments",
      ];
    const needsGeometry = keys.some((k) => next[k] !== this.options[k]);
    this.options = next;
    if (needsGeometry) {
      this.geometry.dispose();
      this.geometry = geometryFor(next);
      this._flat = new Float32Array(this.geometry.attributes.position.array);
    }
    for (const k of [
      "radius",
      "innerRadius",
      "length",
      "width",
      "opacity",
      "intensity",
      "edgeWidth",
    ])
      this.material.uniforms[k].value = next[k];
    this.material.uniforms.shape.value = ["circle", "cone", "beam"].indexOf(
      next.shape,
    );
    this.material.uniforms.angle.value = (next.angle * Math.PI) / 180;
    this.material.uniforms.color.value.set(next.color);
    if (this._surface) this.project(this._surface);
    return this;
  }
  toRecipe() {
    return { schema: "cranberry-forge.signal/1", options: { ...this.options } };
  }
  static fromRecipe(value) {
    const d = typeof value === "string" ? JSON.parse(value) : value;
    if (!d || d.schema !== "cranberry-forge.signal/1")
      throw new TypeError("invalid cranberry-forge.signal/1 recipe");
    return new Telegraph(d.options);
  }
  dispose() {
    if (this._disposed) return;
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this._disposed = true;
  }
}
