import {
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

const KEYS = [
  "points",
  "closed",
  "segments",
  "width",
  "bank",
  "up",
  "uvScale",
  "borderWidth",
  "borderHeight",
];
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const LOOM_DEFAULTS = freeze({
  points: [
    [-8, 0, 0],
    [-3, 1, -3],
    [3, 0.5, 3],
    [8, 0, 0],
  ],
  closed: false,
  segments: 128,
  width: 1.8,
  bank: 0,
  up: [0, 1, 0],
  uvScale: 2,
  borderWidth: 0.09,
  borderHeight: 0.16,
});
function finite(value, name, min, max) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new RangeError(`${name} must be finite in [${min}, ${max}]`);
  return value;
}
function vector(value, name) {
  const array = value?.isVector3 ? value.toArray() : value;
  if (!Array.isArray(array) || array.length !== 3)
    throw new TypeError(`${name} must be a three-number tuple or Vector3`);
  return Array.from(array, (n) => finite(n, name, -1e6, 1e6));
}
function profile(value, name, min, max, closed) {
  if (typeof value === "number") return finite(value, name, min, max);
  if (!Array.isArray(value) || value.length < 2 || value.length > 128)
    throw new TypeError(`${name} must be a number or 2–128 { at, value } keys`);
  let previous = -1;
  const result = Array.from(value, (key) => {
    if (
      !key ||
      typeof key !== "object" ||
      Object.keys(key).some((k) => k !== "at" && k !== "value")
    )
      throw new TypeError(`${name} keys must contain only at and value`);
    const at = finite(key.at, `${name}.at`, 0, 1);
    if (at <= previous)
      throw new RangeError(`${name} key positions must strictly increase`);
    previous = at;
    return { at, value: finite(key.value, `${name}.value`, min, max) };
  });
  if (result[0].at !== 0 || result.at(-1).at !== 1)
    throw new RangeError(`${name} profiles must start at 0 and end at 1`);
  if (closed && result[0].value !== result.at(-1).value)
    throw new RangeError(`Closed ${name} profile endpoints must match`);
  return result;
}
export function normalizeLoomOptions(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw new TypeError("Options must be an object");
  for (const key of Object.keys(options))
    if (!KEYS.includes(key)) throw new TypeError(`Unknown Loom option: ${key}`);
  const merged = { ...LOOM_DEFAULTS, ...options };
  if (typeof merged.closed !== "boolean")
    throw new TypeError("closed must be boolean");
  if (
    !Array.isArray(merged.points) ||
    merged.points.length < (merged.closed ? 3 : 2) ||
    merged.points.length > 128
  )
    throw new RangeError(
      "Provide 2–128 points, or at least 3 for a closed route",
    );
  const points = Array.from(merged.points, (point, index) =>
    vector(point, `points[${index}]`),
  );
  for (let i = 0; i < points.length - (merged.closed ? 0 : 1); i++)
    if (
      new Vector3(...points[i]).distanceToSquared(
        new Vector3(...points[(i + 1) % points.length]),
      ) < 1e-10
    )
      throw new RangeError(
        "Consecutive points must be distinct; closed routes must not repeat the first point",
      );
  for (
    let i = merged.closed ? 0 : 1;
    i < points.length - (merged.closed ? 0 : 1);
    i++
  ) {
    const incoming = new Vector3(...points[i])
      .sub(new Vector3(...points[(i - 1 + points.length) % points.length]))
      .normalize();
    const outgoing = new Vector3(...points[(i + 1) % points.length])
      .sub(new Vector3(...points[i]))
      .normalize();
    if (incoming.dot(outgoing) < -0.99999)
      throw new RangeError(
        "Route has a degenerate tangent near a reversal; separate the return path",
      );
  }
  const segments = finite(merged.segments, "segments", 8, 4096);
  if (!Number.isInteger(segments))
    throw new RangeError("segments must be an integer");
  const up = vector(merged.up, "up");
  if (new Vector3(...up).lengthSq() < 1e-12)
    throw new RangeError("up must be nonzero");
  return freeze({
    points,
    closed: merged.closed,
    segments,
    width: profile(merged.width, "width", 0.001, 1000, merged.closed),
    bank: profile(merged.bank, "bank", -Math.PI, Math.PI, merged.closed),
    up: new Vector3(...up).normalize().toArray(),
    uvScale: finite(merged.uvScale, "uvScale", 0.001, 1e6),
    borderWidth: finite(merged.borderWidth, "borderWidth", 0, 100),
    borderHeight: finite(merged.borderHeight, "borderHeight", 0, 100),
  });
}
function valueAt(profile, u) {
  if (typeof profile === "number") return profile;
  for (let i = 1; i < profile.length; i++)
    if (u <= profile[i].at) {
      const a = profile[i - 1],
        b = profile[i];
      return a.value + (b.value - a.value) * ((u - a.at) / (b.at - a.at));
    }
  return profile.at(-1).value;
}
function projectedUp(up, tangent) {
  up.addScaledVector(tangent, -up.dot(tangent));
  if (up.lengthSq() < 1e-10) {
    const axes = [
      new Vector3(1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 1),
    ];
    axes.sort((a, b) => Math.abs(a.dot(tangent)) - Math.abs(b.dot(tangent)));
    up.copy(axes[0]).addScaledVector(tangent, -axes[0].dot(tangent));
  }
  return up.normalize();
}
export function createLoomSample() {
  return {
    u: 0,
    distance: 0,
    width: 0,
    bank: 0,
    position: new Vector3(),
    tangent: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
    quaternion: new Quaternion(),
  };
}
function sample(data, u, output) {
  finite(u, "sample position", -Number.MAX_VALUE, Number.MAX_VALUE);
  u = data.options.closed ? ((u % 1) + 1) % 1 : Math.max(0, Math.min(1, u));
  if (
    !output ||
    ![output.position, output.tangent, output.right, output.up].every(
      (v) => v?.isVector3,
    ) ||
    !output.quaternion?.isQuaternion
  )
    throw new TypeError("Sample target must come from createLoomSample()");
  const index = Math.min(
      data.options.segments - 1,
      Math.floor(u * data.options.segments),
    ),
    alpha = u * data.options.segments - index;
  output.u = u;
  output.distance = u * data.length;
  output.width = valueAt(data.options.width, u);
  output.bank = valueAt(data.options.bank, u);
  data.curve.getPointAt(u, output.position);
  data.curve.getTangentAt(u, output.tangent).normalize();
  output.quaternion.slerpQuaternions(
    data.frames[index],
    data.frames[index + 1],
    alpha,
  );
  output.up.set(0, 1, 0).applyQuaternion(output.quaternion);
  projectedUp(output.up, output.tangent).applyAxisAngle(
    output.tangent,
    output.bank,
  );
  output.right.crossVectors(output.up, output.tangent).normalize();
  output.up.crossVectors(output.tangent, output.right).normalize();
  output.quaternion.setFromRotationMatrix(
    data.matrix.makeBasis(output.right, output.up, output.tangent),
  );
  return output;
}
function createData(options) {
  const curve = new CatmullRomCurve3(
    options.points.map((p) => new Vector3(...p)),
    options.closed,
    "centripetal",
  );
  curve.arcLengthDivisions = Math.max(
    512,
    options.segments * 4,
    options.points.length * 32,
  );
  curve.updateArcLengths();
  const length = curve.getLength();
  if (!Number.isFinite(length) || length < 1e-5)
    throw new RangeError("Route length is degenerate");
  const tangents = [],
    ups = [],
    frames = [],
    turn = new Quaternion(),
    matrix = new Matrix4();
  for (let i = 0; i <= options.segments; i++) {
    const tangent = curve.getTangentAt(i / options.segments).normalize();
    if (tangent.lengthSq() < 0.99)
      throw new RangeError(
        "Route has a degenerate tangent; remove reversals or increase separation",
      );
    const up =
      i === 0
        ? new Vector3(...options.up)
        : ups[i - 1]
            .clone()
            .applyQuaternion(turn.setFromUnitVectors(tangents[i - 1], tangent));
    tangents.push(tangent);
    ups.push(projectedUp(up, tangent));
  }
  if (options.closed) {
    const twist = Math.atan2(
      tangents[0].dot(new Vector3().crossVectors(ups.at(-1), ups[0])),
      ups.at(-1).dot(ups[0]),
    );
    for (let i = 1; i <= options.segments; i++)
      ups[i].applyAxisAngle(tangents[i], (twist * i) / options.segments);
  }
  for (let i = 0; i <= options.segments; i++) {
    const right = new Vector3().crossVectors(ups[i], tangents[i]).normalize();
    frames.push(
      new Quaternion().setFromRotationMatrix(
        matrix.makeBasis(right, ups[i], tangents[i]),
      ),
    );
  }
  return { options, curve, length, frames, matrix };
}
function geometries(data) {
  const { options, length } = data,
    positions = [],
    normals = [],
    uvs = [],
    indices = [],
    rows = [],
    point = new Vector3();
  for (let i = 0; i <= options.segments; i++) {
    const row = sample(data, i / options.segments, createLoomSample());
    rows.push(row);
    for (const side of [-1, 1]) {
      point
        .copy(row.position)
        .addScaledVector(row.right, row.width * 0.5 * side);
      positions.push(...point.toArray());
      normals.push(...row.up.toArray());
      uvs.push(
        (side + 1) / 2,
        ((i / options.segments) * length) / options.uvScale,
      );
    }
    if (i < options.segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const surface = new BufferGeometry();
  surface.setAttribute("position", new Float32BufferAttribute(positions, 3));
  surface.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  surface.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  surface.setIndex(indices);
  surface.computeBoundingBox();
  surface.computeBoundingSphere();
  const borders = new BufferGeometry(),
    bp = [],
    buv = [];
  if (options.borderWidth > 0 && options.borderHeight > 0) {
    const corner = (row, side, x, y) =>
      row.position
        .clone()
        .addScaledVector(row.right, side * row.width * 0.5 + x)
        .addScaledVector(row.up, y);
    const corners = [
      [-options.borderWidth / 2, 0],
      [options.borderWidth / 2, 0],
      [options.borderWidth / 2, options.borderHeight],
      [-options.borderWidth / 2, options.borderHeight],
    ];
    const quad = (a, b, c, d, v0, v1) => {
      for (const [p, u, v] of [
        [a, 0, v0],
        [b, 1, v0],
        [c, 1, v1],
        [a, 0, v0],
        [c, 1, v1],
        [d, 0, v1],
      ]) {
        bp.push(...p.toArray());
        buv.push(u, v);
      }
    };
    for (const side of [-1, 1]) {
      for (let i = 0; i < options.segments; i++)
        for (let j = 0; j < 4; j++)
          quad(
            corner(rows[i], side, ...corners[j]),
            corner(rows[i], side, ...corners[(j + 1) % 4]),
            corner(rows[i + 1], side, ...corners[(j + 1) % 4]),
            corner(rows[i + 1], side, ...corners[j]),
            ((i / options.segments) * length) / options.uvScale,
            (((i + 1) / options.segments) * length) / options.uvScale,
          );
      if (!options.closed) {
        const start = corners.map((c) => corner(rows[0], side, ...c)),
          end = corners.map((c) => corner(rows.at(-1), side, ...c));
        quad(start[3], start[2], start[1], start[0], 0, 1);
        quad(end[0], end[1], end[2], end[3], 0, 1);
      }
    }
  }
  borders.setAttribute("position", new Float32BufferAttribute(bp, 3));
  borders.setAttribute("uv", new Float32BufferAttribute(buv, 2));
  borders.computeVertexNormals();
  borders.computeBoundingBox();
  borders.computeBoundingSphere();
  return { surface, borders };
}
export class Loom extends Group {
  constructor(options = {}, materials = {}) {
    super();
    if (
      !materials ||
      typeof materials !== "object" ||
      Array.isArray(materials) ||
      Object.keys(materials).some((k) => k !== "surface" && k !== "borders")
    )
      throw new TypeError("Materials must contain only surface and borders");
    for (const mat of Object.values(materials))
      if (mat !== undefined && !mat?.isMaterial)
        throw new TypeError("Supply Three.Material instances");
    this.name = "Loom";
    this._disposed = false;
    this._data = createData(normalizeLoomOptions(options));
    const geometry = geometries(this._data);
    this._ownedMaterials = [];
    const surfaceMaterial =
      materials.surface ??
      new MeshStandardMaterial({
        color: "#537271",
        roughness: 0.85,
        side: DoubleSide,
      });
    const borderMaterial =
      materials.borders ??
      new MeshStandardMaterial({
        color: "#e0bf83",
        metalness: 0.55,
        roughness: 0.38,
      });
    if (!materials.surface) this._ownedMaterials.push(surfaceMaterial);
    if (!materials.borders) this._ownedMaterials.push(borderMaterial);
    this.surface = new Mesh(geometry.surface, surfaceMaterial);
    this.surface.name = "Loom surface";
    this.borders = new Mesh(geometry.borders, borderMaterial);
    this.borders.name = "Loom borders";
    this.surface.receiveShadow = true;
    this.borders.castShadow = true;
    this.borders.receiveShadow = true;
    this.add(this.surface, this.borders);
  }
  get options() {
    return this._data.options;
  }
  get length() {
    return this._data.length;
  }
  get disposed() {
    return this._disposed;
  }
  _assertLive() {
    if (this._disposed) throw new Error("Loom has been disposed");
  }
  sample(u, target = createLoomSample()) {
    this._assertLive();
    return sample(this._data, u, target);
  }
  sampleDistance(distance, target = createLoomSample()) {
    this._assertLive();
    finite(distance, "distance", -Number.MAX_VALUE, Number.MAX_VALUE);
    const u = this.options.closed
      ? (distance % this.length) / this.length
      : Math.max(0, Math.min(this.length, distance)) / this.length;
    return sample(this._data, u, target);
  }
  configure(options) {
    this._assertLive();
    if (!options || typeof options !== "object" || Array.isArray(options))
      throw new TypeError("Options must be an object");
    const next = createData(
        normalizeLoomOptions({ ...this.options, ...options }),
      ),
      geometry = geometries(next),
      oldSurface = this.surface.geometry,
      oldBorders = this.borders.geometry;
    this.surface.geometry = geometry.surface;
    this.borders.geometry = geometry.borders;
    this._data = next;
    oldSurface.dispose();
    oldBorders.dispose();
    return this;
  }
  toRecipe() {
    this._assertLive();
    return {
      schema: "cranberry-forge.loom/1",
      options: JSON.parse(JSON.stringify(this.options)),
    };
  }
  static fromRecipe(recipe, materials) {
    if (typeof recipe === "string") recipe = JSON.parse(recipe);
    if (
      !recipe ||
      typeof recipe !== "object" ||
      Array.isArray(recipe) ||
      recipe.schema !== "cranberry-forge.loom/1" ||
      Object.keys(recipe).some((k) => k !== "schema" && k !== "options") ||
      !recipe.options
    )
      throw new TypeError("Expected an cranberry-forge.loom/1 recipe with options");
    return new Loom(recipe.options, materials);
  }
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.surface.geometry.dispose();
    this.borders.geometry.dispose();
    this._ownedMaterials.forEach((material) => material.dispose());
    this.removeFromParent();
    this.remove(this.surface, this.borders);
  }
}
