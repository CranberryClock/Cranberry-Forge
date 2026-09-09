import test from "node:test";
import assert from "node:assert/strict";
import { MeshBasicMaterial, Raycaster, Vector3 } from "three";
import {
  Loom,
  createLoomSample,
  normalizeLoomOptions,
} from "../dist/packages/loom/index.js";
import { createLoomScene, LOOM_PRESETS } from "../dist/loom-scene.js";

const line = {
  points: [
    [0, 0, 0],
    [0, 0, 10],
  ],
  segments: 16,
  width: 2,
  uvScale: 2,
};
const near = (a, b, epsilon = 1e-5) =>
  assert.ok(Math.abs(a - b) <= epsilon, `${a} differs from ${b}`);
function frameValid(s) {
  for (const v of [s.position, s.tangent, s.right, s.up])
    assert.ok(v.toArray().every(Number.isFinite));
  for (const v of [s.tangent, s.right, s.up]) near(v.length(), 1);
  near(s.tangent.dot(s.up), 0);
  near(s.tangent.dot(s.right), 0);
  near(s.up.dot(s.right), 0);
  near(new Vector3().crossVectors(s.right, s.up).dot(s.tangent), 1);
  near(
    new Vector3(0, 0, 1).applyQuaternion(s.quaternion).distanceTo(s.tangent),
    0,
  );
}

test("straight ribbons have measured width, upward winding and distance-scaled UVs", () => {
  const loom = new Loom(line);
  near(loom.length, 10);
  near(loom.sample(0.5).position.z, 5);
  const p = loom.surface.geometry.getAttribute("position"),
    uv = loom.surface.geometry.getAttribute("uv");
  near(p.getX(0), -1);
  near(p.getX(1), 1);
  near(uv.getY(uv.count - 1), 5);
  assert.equal(loom.surface.geometry.index.count, 16 * 6);
  loom.updateMatrixWorld(true);
  assert.ok(
    new Raycaster(new Vector3(0, 2, 5), new Vector3(0, -1, 0)).intersectObject(
      loom.surface,
    ).length,
  );
  assert.ok(loom.borders.geometry.getAttribute("position").count > 0);
  loom.dispose();
});

test("arc-length samples cover unequal control-point spacing at approximately equal speed", () => {
  const loom = new Loom({
    points: [
      [0, 0, 0],
      [0, 0, 0.15],
      [3, 0, 5],
      [3, 1, 18],
    ],
    segments: 256,
  });
  const distances = Array.from({ length: 99 }, (_, i) =>
    loom
      .sample((i + 1) / 100)
      .position.distanceTo(loom.sample(i / 100).position),
  );
  assert.ok(Math.max(...distances) / Math.min(...distances) < 1.05);
  const target = createLoomSample();
  assert.equal(loom.sampleDistance(loom.length * 0.45, target), target);
  near(target.position.distanceTo(loom.sample(0.45).position), 0);
  near(loom.sample(-2).u, 0);
  near(loom.sample(9).u, 1);
  loom.dispose();
});

test("transported frames remain finite near vertical paths and close without a seam flip", () => {
  const vertical = new Loom({
    points: [
      [0, 0, 0],
      [0, 4, 0],
      [0.001, 7, 0],
      [2, 9, 2],
    ],
    up: [0, 1, 0],
  });
  for (let i = 0; i <= 40; i++) frameValid(vertical.sample(i / 40));
  const loop = new Loom({
    points: [
      [-5, 0, 0],
      [0, 3, -5],
      [5, 1, 0],
      [0, -2, 5],
    ],
    closed: true,
  });
  for (let i = 0; i <= 40; i++) frameValid(loop.sample(i / 40));
  near(loop.sample(0).position.distanceTo(loop.sample(1).position), 0);
  assert.ok(loop.sample(1 - 1e-6).up.dot(loop.sample(0).up) > 0.999);
  near(loop.sample(-0.25).position.distanceTo(loop.sample(0.75).position), 0);
  const p = loop.surface.geometry.getAttribute("position");
  near(
    new Vector3()
      .fromBufferAttribute(p, 0)
      .distanceTo(new Vector3().fromBufferAttribute(p, p.count - 2)),
    0,
  );
  vertical.dispose();
  loop.dispose();
});

test("width and bank profiles interpolate by distance and recipe copies round-trip", () => {
  const loom = new Loom({
    ...line,
    width: [
      { at: 0, value: 1 },
      { at: 0.5, value: 3 },
      { at: 1, value: 2 },
    ],
    bank: [
      { at: 0, value: 0 },
      { at: 1, value: Math.PI / 2 },
    ],
  });
  near(loom.sample(0.25).width, 2);
  near(loom.sample(0.5).bank, Math.PI / 4);
  near(loom.sample(1).up.distanceTo(new Vector3(-1, 0, 0)), 0);
  const recipe = loom.toRecipe(),
    restored = Loom.fromRecipe(JSON.stringify(recipe));
  near(restored.sample(0.4).position.distanceTo(loom.sample(0.4).position), 0);
  assert.deepEqual(restored.toRecipe(), recipe);
  recipe.options.points[0][0] = 999;
  assert.equal(loom.options.points[0][0], 0);
  assert.throws(() => {
    loom.options.points[0][0] = 9;
  }, TypeError);
  loom.dispose();
  restored.dispose();
});

test("configure is atomic and disposes replaced geometry; dispose preserves supplied materials", () => {
  const material = new MeshBasicMaterial();
  let materialDisposals = 0;
  material.addEventListener("dispose", () => materialDisposals++);
  const loom = new Loom(line, { surface: material, borders: material });
  const previous = loom.surface.geometry;
  let geometryDisposals = 0;
  previous.addEventListener("dispose", () => geometryDisposals++);
  assert.throws(() => loom.configure({ width: -1 }));
  assert.equal(loom.surface.geometry, previous);
  assert.equal(geometryDisposals, 0);
  loom.configure({ width: 3, borderHeight: 0 });
  assert.equal(geometryDisposals, 1);
  assert.equal(loom.borders.geometry.getAttribute("position").count, 0);
  loom.dispose();
  loom.dispose();
  assert.equal(materialDisposals, 0);
  assert.throws(() => loom.sample(0), /disposed/);
  assert.throws(() => loom.configure({ width: 2 }), /disposed/);
  material.dispose();
});

test("strict validation rejects malformed, excessive and discontinuous recipes before construction", () => {
  for (const options of [
    { up: new Array(3) },
    { points: [new Array(3), [1, 2, 3]] },
    { points: new Array(3) },
    { width: new Array(3) },
  ])
    assert.throws(() => normalizeLoomOptions(options));
  for (const options of [
    { width: NaN },
    { bank: Infinity },
    { segments: 7 },
    { segments: 64.5 },
    { segments: 4097 },
    { up: [0, 0, 0] },
    {
      points: [
        [0, 0, 0],
        [0, 0, 0],
      ],
    },
    { mystery: true },
    { closed: "yes" },
    {
      width: [
        { at: 0.2, value: 2 },
        { at: 1, value: 2 },
      ],
    },
    {
      width: [
        { at: 0, value: 2 },
        { at: 0, value: 3 },
      ],
    },
    {
      closed: true,
      width: [
        { at: 0, value: 1 },
        { at: 1, value: 2 },
      ],
    },
  ])
    assert.throws(() => normalizeLoomOptions(options));
  assert.throws(() => Loom.fromRecipe({ schema: "unknown", options: line }));
  assert.throws(() =>
    Loom.fromRecipe({ schema: "cranberry-forge.loom/1", options: line, extra: true }),
  );
  assert.throws(
    () =>
      new Loom({
        points: [
          [0, 0, 0],
          [0, 0, 1],
          [0, 0, 0],
        ],
      }),
    /degenerate tangent/,
  );
  const loom = new Loom(line);
  assert.throws(() => loom.sample(NaN));
  assert.throws(() => loom.sampleDistance(Infinity));
  loom.dispose();
});

test("generated geometry attributes and indices remain finite and in bounds across banked loops", () => {
  const loom = new Loom({
    points: [
      [-5, 0, 0],
      [0, 2, -5],
      [5, 0, 0],
      [0, -1, 5],
    ],
    closed: true,
    bank: [
      { at: 0, value: 0 },
      { at: 0.25, value: 0.4 },
      { at: 0.75, value: -0.3 },
      { at: 1, value: 0 },
    ],
    segments: 80,
  });
  for (const mesh of [loom.surface, loom.borders]) {
    for (const attribute of Object.values(mesh.geometry.attributes))
      assert.ok(attribute.array.every(Number.isFinite));
    if (mesh.geometry.index)
      assert.ok(
        mesh.geometry.index.array.every(
          (n) => n < mesh.geometry.getAttribute("position").count,
        ),
      );
  }
  loom.dispose();
});

test("Cloudline presets build without a renderer and the train follows public arc-distance frames", () => {
  const world = createLoomScene();
  for (const preset of Object.keys(LOOM_PRESETS)) {
    world.setPreset(preset);
    const before = world.train.position.clone();
    world.update(0.5, { speed: 2 });
    assert.ok(world.train.position.distanceTo(before) > 0.2);
    const paused = world.train.position.clone();
    world.update(2, { reducedMotion: true });
    near(paused.distanceTo(world.train.position), 0);
    world.group.traverse((object) => {
      if (object.geometry)
        assert.ok(
          object.geometry.getAttribute("position").array.every(Number.isFinite),
        );
    });
  }
  world.dispose();
  world.dispose();
  assert.equal(world.loom.disposed, true);
});
