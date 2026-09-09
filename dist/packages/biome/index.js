import {
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from "three";

/** Repeatable 32-bit PRNG. Does not modify Math.random. */
export function seededRandom(seed = 1) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)
    throw new RangeError("seed must be a uint32");
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function number(value, name, min, max) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new RangeError(`${name} must be finite in [${min}, ${max}]`);
  return value;
}
function pair(value, name, min, max) {
  if (!Array.isArray(value) || value.length !== 2)
    throw new TypeError(`${name} must be a pair`);
  value.forEach((v) => number(v, name, min, max));
  if (value[0] > value[1]) throw new RangeError(`${name} must be ascending`);
  return [...value];
}

export const DEFAULTS = Object.freeze({
  seed: 42,
  count: 600,
  radius: 16,
  minDistance: 0.8,
  maxSlope: 35,
  minHeight: -1000,
  maxHeight: 1000,
  scale: Object.freeze([0.8, 1.3]),
  alignToNormal: false,
  maxAttempts: 60000,
});

/** Validate and copy a serializable scatter recipe. Unknown fields are ignored. */
export function normalizeOptions(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("options must be an object");
  const o = { ...DEFAULTS, ...input };
  if (!Number.isInteger(o.seed) || o.seed < 0 || o.seed > 4294967295)
    throw new RangeError("seed must be a uint32");
  if (!Number.isInteger(o.count))
    throw new RangeError("count must be an integer");
  number(o.count, "count", 0, 50000);
  number(o.radius, "radius", 0.01, 100000);
  number(o.minDistance, "minDistance", 0, 100000);
  number(o.maxSlope, "maxSlope", 0, 90);
  number(o.minHeight, "minHeight", -1e6, 1e6);
  number(o.maxHeight, "maxHeight", o.minHeight, 1e6);
  if (!Number.isInteger(o.maxAttempts))
    throw new RangeError("maxAttempts must be an integer");
  number(o.maxAttempts, "maxAttempts", 1, 1000000);
  if (typeof o.alignToNormal !== "boolean")
    throw new TypeError("alignToNormal must be a boolean");
  const scale = pair(o.scale, "scale", 0.001, 1000);
  const exclusions = input.exclusions ?? [];
  if (!Array.isArray(exclusions) || exclusions.length > 256)
    throw new RangeError("up to 256 exclusions supported");
  const clean = exclusions.map((e) => {
    if (!e || typeof e !== "object") throw new TypeError("invalid exclusion");
    if (e.type === "circle")
      return {
        type: "circle",
        x: number(e.x, "x", -1e6, 1e6),
        z: number(e.z, "z", -1e6, 1e6),
        radius: number(e.radius, "exclusion radius", 0, 1e6),
      };
    if (e.type === "path") {
      if (
        !Array.isArray(e.points) ||
        e.points.length < 2 ||
        e.points.length > 512
      )
        throw new RangeError("path needs 2–512 points");
      return {
        type: "path",
        width: number(e.width, "path width", 0, 1e6),
        points: e.points.map((p) => {
          if (!Array.isArray(p) || p.length !== 2)
            throw new TypeError("path point must be [x,z]");
          return p.map((v) => number(v, "coordinate", -1e6, 1e6));
        }),
      };
    }
    throw new TypeError("exclusion type must be circle or path");
  });
  return {
    seed: o.seed,
    count: o.count,
    radius: o.radius,
    minDistance: o.minDistance,
    maxSlope: o.maxSlope,
    minHeight: o.minHeight,
    maxHeight: o.maxHeight,
    scale,
    alignToNormal: o.alignToNormal,
    maxAttempts: o.maxAttempts,
    exclusions: clean,
  };
}

/** XZ distance to a line segment; degenerate segments are supported. */
export function distanceToSegment(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    d = dx * dx + dz * dz;
  const t =
    d === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / d));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
export function isExcluded(x, z, exclusions) {
  return exclusions.some((e) =>
    e.type === "circle"
      ? Math.hypot(x - e.x, z - e.z) <= e.radius
      : e.points.some(
          (p, i) =>
            i > 0 && distanceToSegment(x, z, e.points[i - 1], p) <= e.width / 2,
        ),
  );
}

/**
 * Generate grounded transforms. Surface is (x,z)=>height or =>{height,normal:[x,y,z]}.
 * Density is optional (x,z,height)=>probability in [0,1]. Samples are uniform in XZ.
 * Rejection sampling is bounded; an over-constrained request returns fewer points.
 */
export function scatter(input = {}, surface = () => 0, density = () => 1) {
  const options = normalizeOptions(input);
  if (typeof surface !== "function" || typeof density !== "function")
    throw new TypeError("surface and density must be functions");
  const random = seededRandom(options.seed),
    points = [],
    grid = new Map();
  const rejected = {
    exclusion: 0,
    surface: 0,
    slope: 0,
    height: 0,
    density: 0,
    spacing: 0,
  };
  const cellSize = Math.max(options.minDistance, 0.00001),
    minD2 = options.minDistance ** 2;
  const epsilon = Math.max(0.001, options.radius / 1000);
  let attempts = 0;
  const heightAt = (x, z) => {
    const s = surface(x, z);
    return typeof s === "number" ? s : s?.height;
  };
  while (points.length < options.count && attempts < options.maxAttempts) {
    attempts++;
    const angle = random() * Math.PI * 2,
      r = Math.sqrt(random()) * options.radius;
    const x = Math.cos(angle) * r,
      z = Math.sin(angle) * r;
    if (isExcluded(x, z, options.exclusions)) {
      rejected.exclusion++;
      continue;
    }
    const sample = surface(x, z),
      y = typeof sample === "number" ? sample : sample?.height;
    if (!Number.isFinite(y)) {
      rejected.surface++;
      continue;
    }
    if (y < options.minHeight || y > options.maxHeight) {
      rejected.height++;
      continue;
    }
    let normal;
    if (sample?.normal) {
      if (
        !Array.isArray(sample.normal) ||
        sample.normal.length !== 3 ||
        !sample.normal.every(Number.isFinite)
      )
        throw new TypeError("surface normal must be a finite [x,y,z]");
      normal = new Vector3(...sample.normal);
    } else
      normal = new Vector3(
        heightAt(x - epsilon, z) - heightAt(x + epsilon, z),
        2 * epsilon,
        heightAt(x, z - epsilon) - heightAt(x, z + epsilon),
      );
    if (!Number.isFinite(normal.lengthSq()) || normal.lengthSq() < 1e-16) {
      rejected.surface++;
      continue;
    }
    normal.normalize();
    const slope =
      (Math.acos(Math.max(-1, Math.min(1, normal.y))) * 180) / Math.PI;
    if (slope > options.maxSlope + 1e-8) {
      rejected.slope++;
      continue;
    }
    const weight = density(x, z, y);
    number(weight, "density result", 0, 1);
    if (random() >= weight) {
      rejected.density++;
      continue;
    }
    const gx = Math.floor(x / cellSize),
      gz = Math.floor(z / cellSize);
    let crowded = false;
    if (minD2 > 0)
      for (let ix = -1; ix <= 1 && !crowded; ix++)
        for (let iz = -1; iz <= 1 && !crowded; iz++) {
          const neighbors = grid.get(`${gx + ix},${gz + iz}`);
          crowded =
            neighbors?.some(
              (p) =>
                (p.position[0] - x) ** 2 + (p.position[2] - z) ** 2 < minD2,
            ) ?? false;
        }
    if (crowded) {
      rejected.spacing++;
      continue;
    }
    const point = {
      position: [x, y, z],
      normal: normal.toArray(),
      yaw: random() * Math.PI * 2,
      scale:
        options.scale[0] + random() * (options.scale[1] - options.scale[0]),
    };
    points.push(point);
    const key = `${gx},${gz}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(point);
  }
  return {
    schema: "cranberry-forge.biome/1",
    options,
    points,
    stats: {
      requested: options.count,
      placed: points.length,
      attempts,
      saturated: points.length < options.count,
      rejected,
    },
  };
}

/** Validate an exported placement snapshot without executing code or regenerating it. */
export function parseScatter(value) {
  const data = typeof value === "string" ? JSON.parse(value) : value;
  if (
    !data ||
    data.schema !== "cranberry-forge.biome/1" ||
    !Array.isArray(data.points) ||
    data.points.length > 50000
  )
    throw new TypeError("invalid cranberry-forge.biome/1 snapshot");
  const options = normalizeOptions(data.options);
  const points = data.points.map((p) => {
    if (
      !p ||
      !Array.isArray(p.position) ||
      p.position.length !== 3 ||
      !Array.isArray(p.normal) ||
      p.normal.length !== 3
    )
      throw new TypeError("invalid placement");
    const position = p.position.map((v) => number(v, "position", -1e6, 1e6));
    const normal = p.normal.map((v) => number(v, "normal", -1, 1));
    if (Math.abs(Math.hypot(...normal) - 1) > 0.001)
      throw new RangeError("normal must be unit length");
    return {
      position,
      normal,
      yaw: number(p.yaw, "yaw", -1e6, 1e6),
      scale: number(p.scale, "scale", 0.001, 1000),
    };
  });
  return {
    schema: "cranberry-forge.biome/1",
    options,
    points,
    stats: {
      requested: options.count,
      placed: points.length,
      attempts: null,
      saturated: points.length < options.count,
      rejected: null,
    },
  };
}

/** Build a Three.js Group, one InstancedMesh per prototype part. No geometry copies. */
export function createInstances(result, parts) {
  if (!Array.isArray(parts) || !parts.length)
    throw new TypeError("at least one prototype part required");
  const group = new Group();
  group.name = "Biome";
  const object = new Object3D(),
    up = new Vector3(0, 1, 0),
    q = new Quaternion(),
    normal = new Vector3(),
    matrix = new Matrix4();
  for (const part of parts) {
    if (!part.geometry?.isBufferGeometry || !part.material)
      throw new TypeError("parts require geometry and material");
    const mesh = new InstancedMesh(
      part.geometry,
      part.material,
      result.points.length,
    );
    mesh.name = part.name ?? "Biome instances";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    result.points.forEach((point, i) => {
      object.position.fromArray(point.position);
      object.scale.setScalar(point.scale);
      object.quaternion.identity();
      if (result.options.alignToNormal)
        object.quaternion.setFromUnitVectors(
          up,
          normal.fromArray(point.normal),
        );
      q.setFromAxisAngle(up, point.yaw);
      object.quaternion.multiply(q);
      object.updateMatrix();
      matrix.copy(object.matrix);
      if (part.matrix) matrix.multiply(part.matrix);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  group.userData.biome = {
    schema: result.schema,
    seed: result.options.seed,
    count: result.points.length,
  };
  return group;
}

/** Releases per-instance buffers only. Caller retains ownership of prototype assets. */
export function disposeInstances(group) {
  group.traverse((object) => {
    if (object.isInstancedMesh) object.dispose();
  });
  group.removeFromParent();
  group.clear();
}
