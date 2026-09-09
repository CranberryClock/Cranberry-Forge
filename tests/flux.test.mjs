import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { Trail, normalizeTrailOptions } from "@cranberry-forge/flux";
const camera = new Vector3(0, 3, 10);
test("fixed capacity overwrites oldest samples and keeps buffers stable", () => {
  const t = new Trail({ capacity: 8, lifetime: 100, minDistance: 0 });
  const array = t.geometry.attributes.position.array;
  for (let i = 0; i < 50; i++) {
    t.push([i, 0, 0], i / 10);
    t.update(i / 10, camera);
  }
  assert.equal(t.sampleCount, 8);
  assert.equal(t.geometry.attributes.position.array, array);
  assert.equal(t.geometry.drawRange.count, 42);
  t.dispose();
});
test("tail expires without further emitter positions", () => {
  const t = new Trail({ lifetime: 1 });
  t.push([0, 0, 0], 0);
  t.push([1, 0, 0], 0.1);
  t.update(0.5, camera);
  assert.equal(t.geometry.drawRange.count, 6);
  t.update(1.2, camera);
  assert.equal(t.sampleCount, 0);
  assert.equal(t.geometry.drawRange.count, 0);
  t.dispose();
});
test("explicit and automatic teleport breaks omit spanning triangles", () => {
  const t = new Trail({ maxJump: 2 });
  t.push([0, 0, 0], 0);
  t.push([1, 0, 0], 0.1);
  t.break();
  t.push([2, 0, 0], 0.2);
  t.push([3, 0, 0], 0.3);
  t.push([20, 0, 0], 0.4);
  t.update(0.4, camera);
  assert.equal(t.geometry.drawRange.count, 12);
  t.dispose();
});
test("camera tangent alignment and repeated positions produce finite geometry", () => {
  const t = new Trail({ minDistance: 0 });
  t.push([0, 0, 0], 0);
  t.push([0, 0, 0], 0.1);
  t.push([0, 1, 0], 0.2);
  t.update(0.2, new Vector3(0, 20, 0));
  assert.ok([...t.geometry.attributes.position.array].every(Number.isFinite));
  t.dispose();
});
test("world samples are copied and width is in world units", () => {
  const t = new Trail({ width: 2, taper: 0 });
  const v = new Vector3(1, 0, 0);
  t.push(v, 0);
  v.set(2, 0, 0);
  t.push(v, 0.1);
  t.update(0.1, camera);
  const p = t.geometry.attributes.position;
  const a = new Vector3().fromBufferAttribute(p, 0),
    b = new Vector3().fromBufferAttribute(p, 1);
  assert.ok(Math.abs(a.distanceTo(b) - 2) < 1e-6);
  assert.ok(
    a
      .add(b)
      .multiplyScalar(0.5)
      .distanceTo(new Vector3(1, 0, 0)) < 1e-6,
  );
  t.dispose();
});
test("recipe validation and configuration preserve ownership", () => {
  const t = new Trail({ color: "#aabbcc", width: 0.7 });
  const b = Trail.fromRecipe(JSON.stringify(t.toRecipe()));
  assert.deepEqual(t.options, b.options);
  const g = t.geometry;
  t.configure({ width: 1 });
  assert.equal(g, t.geometry);
  assert.throws(() => t.configure({ capacity: 99 }), /capacity/);
  assert.throws(() => Trail.fromRecipe({ schema: "other" }));
  assert.throws(() => normalizeTrailOptions({ color: "garbage" }));
  t.dispose();
  b.dispose();
});
test("time is monotonic, clear resets it, disposal is idempotent", () => {
  const t = new Trail();
  t.push([0, 0, 0], 2);
  t.update(2, camera);
  assert.throws(() => t.push([1, 0, 0], 1), /monotonic/);
  assert.throws(() => t.update(1, camera));
  t.clear();
  assert.ok(t.push([1, 0, 0], 0));
  t.dispose();
  t.dispose();
  assert.throws(() => t.push([2, 0, 0], 1), /disposed/);
});
