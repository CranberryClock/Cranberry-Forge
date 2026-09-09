import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, MeshBasicMaterial, Matrix4, Vector3 } from "three";
import {
  scatter,
  parseScatter,
  createInstances,
  disposeInstances,
  normalizeOptions,
  isExcluded,
  seededRandom,
} from "@cranberry-forge/biome";

test("same recipe is deterministic, different seed changes placement", () => {
  const o = { count: 150, seed: 42 };
  const a = scatter(o),
    b = scatter(o),
    c = scatter({ ...o, seed: 43 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.points, c.points);
  assert.equal(a.points.length, 150);
});
test("seed zero and full uint32 range work without global RNG changes", () => {
  const original = Math.random;
  assert.equal(seededRandom(0)(), seededRandom(0)());
  assert.ok(seededRandom(4294967295)() < 1);
  assert.equal(Math.random, original);
});
test("all placements respect center spacing, circular bounds and exclusions", () => {
  const exclusions = [
    { type: "circle", x: 2, z: 2, radius: 3 },
    {
      type: "path",
      points: [
        [-14, 0],
        [0, 1],
        [14, -2],
      ],
      width: 3,
    },
  ];
  const a = scatter({
    seed: 982,
    count: 450,
    radius: 15,
    minDistance: 1.1,
    exclusions,
  });
  for (let i = 0; i < a.points.length; i++) {
    const p = a.points[i].position;
    assert.ok(Math.hypot(p[0], p[2]) <= 15);
    assert.ok(!isExcluded(p[0], p[2], exclusions));
    for (let j = 0; j < i; j++) {
      const q = a.points[j].position;
      assert.ok(Math.hypot(p[0] - q[0], p[2] - q[2]) >= 1.1 - 1e-10);
    }
  }
});
test("height callback grounds placements and explicit normal enforces slope", () => {
  const a = scatter({ count: 50, maxSlope: 50 }, (x, z) => x + z * 0.2);
  a.points.forEach((p) =>
    assert.equal(p.position[1], p.position[0] + p.position[2] * 0.2),
  );
  const b = scatter({ count: 10, maxSlope: 20, maxAttempts: 100 }, () => ({
    height: 0,
    normal: [1, 1, 0],
  }));
  assert.equal(b.points.length, 0);
  assert.equal(b.stats.rejected.slope, 100);
});
test("height filters, density and unavailable surface reject candidates", () => {
  const a = scatter({ count: 50, minHeight: 2, maxAttempts: 100 }, () => 1);
  assert.equal(a.stats.rejected.height, 100);
  const b = scatter(
    { count: 50, maxAttempts: 100 },
    () => 0,
    () => 0,
  );
  assert.equal(b.stats.rejected.density, 100);
  const c = scatter({ count: 50, maxAttempts: 100 }, () => NaN);
  assert.equal(c.stats.rejected.surface, 100);
  assert.throws(
    () =>
      scatter(
        { count: 1 },
        () => 0,
        () => 2,
      ),
    /density/,
  );
});
test("impossible requests terminate at budget and account for every proposal", () => {
  const a = scatter({
    count: 300,
    radius: 1,
    minDistance: 2,
    maxAttempts: 150,
  });
  assert.ok(a.stats.saturated);
  assert.equal(a.stats.attempts, 150);
  assert.equal(
    a.points.length +
      Object.values(a.stats.rejected).reduce((a, b) => a + b, 0),
    150,
  );
  assert.equal(scatter({ count: 0 }).points.length, 0);
});
test("snapshot round trip validates coordinates and does not trust statistics", () => {
  const a = scatter({ count: 50 });
  const b = parseScatter(JSON.stringify(a));
  assert.deepEqual(a.points, b.points);
  assert.equal(b.stats.attempts, null);
  assert.throws(() => parseScatter({ ...a, schema: "unknown" }));
  assert.throws(() =>
    parseScatter({ ...a, points: [{ ...a.points[0], scale: Infinity }] }),
  );
  assert.throws(() =>
    parseScatter({ ...a, points: [{ ...a.points[0], normal: [0, 0, 0] }] }),
  );
});
test("normal alignment, local part matrices and resource ownership", () => {
  const normal = new Vector3(1, 2, 0).normalize();
  const result = scatter(
    { count: 10, alignToNormal: true, maxSlope: 90, scale: [1, 1] },
    () => ({ height: 5, normal: normal.toArray() }),
  );
  const geometry = new BoxGeometry(),
    material = new MeshBasicMaterial(),
    partMatrix = new Matrix4().makeTranslation(0, 2, 0);
  const group = createInstances(result, [
    { geometry, material, matrix: partMatrix },
  ]);
  const mesh = group.children[0],
    matrix = new Matrix4();
  mesh.getMatrixAt(0, matrix);
  const up = new Vector3(0, 1, 0).transformDirection(matrix);
  assert.ok(up.distanceTo(normal) < 1e-6);
  const expected = new Vector3(...result.points[0].position).addScaledVector(
    normal,
    2,
  );
  assert.ok(
    new Vector3().setFromMatrixPosition(matrix).distanceTo(expected) < 1e-5,
  );
  let geoDisposed = false,
    matDisposed = false,
    meshDisposed = false;
  geometry.addEventListener("dispose", () => (geoDisposed = true));
  material.addEventListener("dispose", () => (matDisposed = true));
  mesh.addEventListener("dispose", () => (meshDisposed = true));
  disposeInstances(group);
  assert.ok(meshDisposed);
  assert.ok(!geoDisposed && !matDisposed);
  assert.equal(group.children.length, 0);
  geometry.dispose();
  material.dispose();
});
test("malformed and resource-unbounded options fail before sampling", () => {
  for (const options of [
    { count: Infinity },
    { seed: -1 },
    { count: 1.2 },
    { radius: 0 },
    { scale: [2, 1] },
    { maxAttempts: Infinity },
    { maxSlope: 91 },
    { exclusions: [{ type: "path", points: [[0, 0]], width: 2 }] },
  ])
    assert.throws(() => normalizeOptions(options));
});
