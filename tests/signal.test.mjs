import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import {
  Telegraph,
  containsLocalPoint,
  normalizeSignalOptions,
} from "@cranberry-forge/signal";
import { createSignalScene, SIGNAL_PRESETS } from "../dist/signal-scene.js";
import { Scene, PerspectiveCamera } from "three";

test("circle and ring footprints include boundaries and exclude safe centers", () => {
  assert.ok(containsLocalPoint({ radius: 5 }, 5, 0));
  assert.ok(!containsLocalPoint({ radius: 5 }, 5.1, 0));
  assert.ok(!containsLocalPoint({ radius: 5, innerRadius: 2 }, 0, 0));
  assert.ok(containsLocalPoint({ radius: 5, innerRadius: 2 }, 2, 0));
});
test("cone and beam point along negative Z with matching directional footprints", () => {
  assert.ok(containsLocalPoint({ shape: "cone", radius: 5, angle: 60 }, 0, -4));
  assert.ok(!containsLocalPoint({ shape: "cone", radius: 5, angle: 60 }, 0, 4));
  assert.ok(
    !containsLocalPoint({ shape: "cone", radius: 5, angle: 60 }, 4, -1),
  );
  assert.ok(containsLocalPoint({ shape: "beam", width: 2, length: 8 }, 1, -8));
  assert.ok(
    !containsLocalPoint({ shape: "beam", width: 2, length: 8 }, 1.1, -4),
  );
  assert.ok(
    !containsLocalPoint({ shape: "beam", width: 2, length: 8 }, 0, 0.1),
  );
});
test("world footprint agrees after translation, yaw and scale", () => {
  const t = new Telegraph({ shape: "beam", width: 2, length: 8 });
  t.position.set(10, 0, 5);
  t.rotation.y = Math.PI / 2;
  t.scale.setScalar(2);
  t.updateWorldMatrix(true, false);
  const inside = t.localToWorld(new Vector3(0.5, 999, -4)),
    outside = t.localToWorld(new Vector3(2, 0, -4));
  assert.ok(t.containsPoint(inside));
  assert.ok(!t.containsPoint(outside));
  t.dispose();
});
test("terrain projection is world-space and remains repeatable after movement", () => {
  const t = new Telegraph({ segments: 8, offset: 0.05 });
  t.position.set(2, 3, -4);
  t.rotation.y = 0.7;
  t.scale.setScalar(1.4);
  const height = (x, z) => Math.sin(x) + z * 0.1;
  t.project(height);
  const before = new Float32Array(t.geometry.attributes.position.array);
  t.project(height);
  assert.deepEqual(t.geometry.attributes.position.array, before);
  const p = t.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const world = t.localToWorld(new Vector3().fromBufferAttribute(p, i));
    assert.ok(Math.abs(world.y - height(world.x, world.z) - 0.05) < 1e-5);
  }
  t.dispose();
});
test("charge completion fires once; cancellation and rearming behave explicitly", () => {
  const t = new Telegraph();
  let complete = 0;
  t.addEventListener("complete", () => complete++);
  t.arm(10, 2);
  t.update(11);
  assert.equal(t.progress, 0.5);
  t.update(12);
  t.update(13);
  assert.equal(complete, 1);
  assert.equal(t.state, "complete");
  t.arm(20, 1).cancel().update(22);
  assert.equal(complete, 1);
  assert.ok(!t.visible);
  t.arm(30, 1).update(31);
  assert.equal(complete, 2);
  assert.throws(() => t.update(29));
  t.dispose();
});
test("recipes validate, configuration changes geometry, resources dispose once", () => {
  const t = new Telegraph({ shape: "cone", angle: 90 }),
    copy = Telegraph.fromRecipe(JSON.stringify(t.toRecipe()));
  assert.deepEqual(copy.options, t.options);
  const geo = t.geometry;
  let disposed = 0;
  geo.addEventListener("dispose", () => disposed++);
  t.configure({ shape: "beam" });
  assert.equal(disposed, 1);
  assert.notEqual(t.geometry, geo);
  assert.throws(() => normalizeSignalOptions({ innerRadius: 10, radius: 5 }));
  assert.throws(() => normalizeSignalOptions({ shape: "bad" }));
  t.dispose();
  t.dispose();
  copy.dispose();
});
test("every Signal study constructs and runs a full attack cycle", () => {
  for (const preset of SIGNAL_PRESETS) {
    const s = {
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      bloom: {},
    };
    const w = createSignalScene(s, {
      ...preset,
      x: 0,
      z: 0,
      rotation: 0,
      intensity: 1.7,
      relief: 2.5,
      duration: 1,
    });
    for (let i = 0; i < 20; i++) w.update(0.1);
    assert.ok(w.telegraph.progress >= 0 && w.telegraph.progress <= 1);
    const base = w.root.getObjectByName("Arena plinth");
    base.geometry.computeBoundingBox();
    const baseTop = base.geometry.boundingBox.max.y + base.position.y;
    const heights = w.ground.geometry.attributes.position;
    for (let i = 0; i < heights.count; i++)
      assert.ok(
        heights.getY(i) > baseTop,
        "arena base must not cut through low terrain",
      );
    w.dispose();
    assert.equal(s.scene.children.length, 0);
  }
});
