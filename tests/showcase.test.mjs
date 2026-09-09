import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  createBiomeScene,
  createBiomeExport,
  BIOME_PRESETS,
} from "../dist/biome-scene.js";
import { createFluxScene, FLUX_PRESETS } from "../dist/flux-scene.js";

// Only a FileReader adapter is needed for Node's real Blob support. No renderer mocking.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const stage = () => ({
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(),
  bloom: {},
});

test("all Biome studies generate upward terrain faces and finite visible geometry", () => {
  for (const preset of BIOME_PRESETS) {
    const s = stage(),
      params = {
        preset: preset.id,
        seed: preset.seed,
        count: 100,
        relief: preset.relief,
        spacing: 0.96,
        slope: 36,
        scale: 1,
        pathWidth: 2.5,
        clearings: [],
      };
    const world = createBiomeScene(s, params);
    assert.ok(world.result.points.length > 50);
    const normal = world.ground.geometry.attributes.normal;
    assert.ok(normal.getY(200) > 0.5);
    world.group.traverse((o) => {
      if (o.geometry) {
        for (const n of o.geometry.attributes.position.array)
          assert.ok(Number.isFinite(n));
      }
    });
    const exp = createBiomeExport(world.group);
    assert.ok(exp.children.every((o) => !o.isLight));
    assert.ok(!exp.children.some((o) => o.geometry?.parameters?.width === 300));
    exp.clear();
    world.dispose();
    assert.equal(s.scene.children.length, 0);
  }
});
test("actual Biome GLB round trip preserves GPU instance counts", async () => {
  const s = stage(),
    world = createBiomeScene(s, {
      preset: "alpine",
      seed: 42,
      count: 20,
      relief: 1.4,
      spacing: 0.96,
      slope: 36,
      scale: 1,
      pathWidth: 2.5,
      clearings: [],
    });
  const exp = createBiomeExport(world.group),
    buffer = await new GLTFExporter().parseAsync(exp, { binary: true });
  assert.ok(buffer instanceof ArrayBuffer);
  assert.equal(new DataView(buffer).getUint32(0, true), 0x46546c67);
  const loaded = await new GLTFLoader().parseAsync(buffer, "");
  let instances = 0;
  loaded.scene.traverse((o) => {
    if (o.isInstancedMesh) instances += o.count;
  });
  assert.equal(instances, 20 * 2 + 110);
  exp.clear();
  world.dispose();
  loaded.scene.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    o.geometry?.dispose();
    if (o.material)
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        m.dispose(),
      );
  });
});
test("all Flux studies can warm, animate, pause and teleport without invalid buffers", () => {
  for (const preset of FLUX_PRESETS) {
    const s = stage();
    s.camera.position.set(16, 11, 22);
    const world = createFluxScene(s, {
      preset: preset.id,
      count: preset.count,
      speed: preset.speed,
      lifetime: preset.lifetime,
      width: preset.width,
      taper: 1.2,
      intensity: 2.4,
    });
    for (let i = 0; i < 5; i++) world.update(1 / 60, i / 60, s.camera);
    world.burst();
    world.update(1 / 60, 1, s.camera);
    world.paused = true;
    world.update(1 / 60, 2, s.camera);
    for (const trail of world.trails) {
      assert.ok(trail.sampleCount > 1);
      assert.ok(
        [...trail.geometry.attributes.position.array].every(Number.isFinite),
      );
      assert.ok(trail.geometry.drawRange.count > 0);
    }
    world.dispose();
    assert.equal(s.scene.children.length, 0);
  }
});
