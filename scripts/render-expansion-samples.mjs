// Reproducible illustrations of actual tool scenes and public API state.
// Official Three.js SVGRenderer; no browser navigation, GPU capture or concept art.
import * as THREE from "three";
import assert from "node:assert/strict";
import { flatten, save } from "./render-samples.mjs";
const requested = process.argv[2];
const enabled = (name) => !requested || requested === name;
const stage = () => ({
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(38, 1440 / 900, 0.1, 250),
  bloom: {},
});
async function render(id, root, camera, title, detail) {
  // SVGRenderer uses painter ordering instead of a depth buffer. Order only
  // broad ground layers explicitly so their triangles cannot cover the props.
  root.traverse((object) => {
    if (!object.isMesh) return;
    const p = object.geometry.parameters ?? {};
    if (id === "wayfinder") {
      if (object.parent === root && p.width > 15 && p.height < 2)
        object.renderOrder = -90 + object.position.y;
      if (
        object.parent === root &&
        object.geometry.type === "ConeGeometry" &&
        object.position.y < 0
      )
        object.renderOrder = -110;
      if (object.userData.cell) object.renderOrder = -70;
    }
    if (id === "spring") {
      if (object.parent === root && object.position.y < -0.3)
        object.renderOrder = -110 + object.position.y;
      object.geometry.computeBoundingBox();
      const span = object.geometry.boundingBox.getSize(new THREE.Vector3());
      if (object.parent === root && span.x > 10 && object.position.y < 0.3)
        object.renderOrder = -90 + object.position.y;
      if (
        object.geometry.type === "CylinderGeometry" &&
        p.radiusTop > 1 &&
        object.position.y < 1
      )
        object.renderOrder = -60 + object.position.y;
    }
    if (id === "parcel" || id === "tempo") {
      if (
        object.parent === root &&
        object.geometry.type === "CylinderGeometry" &&
        p.radiusTop >= 2 &&
        object.position.y < 1
      )
        object.renderOrder = -90 + object.position.y;
      if (
        object.parent === root &&
        object.geometry.type === "RingGeometry" &&
        object.position.y < 0.3
      )
        object.renderOrder = -70 + object.position.y;
      if (
        object.parent === root &&
        object.geometry.type === "TorusGeometry" &&
        Math.abs(object.rotation.x - Math.PI / 2) < 0.01 &&
        object.position.y < 0.1
      )
        object.renderOrder = -60 + object.position.y;
    }
  });
  const illustration = flatten(root);
  illustration.traverse((object) => {
    if (object.isAmbientLight) object.intensity = 0.65;
    if (object.isDirectionalLight) object.intensity = 1.35;
  });
  await save(
    `${id}-sample`,
    illustration,
    camera,
    title,
    `${detail} · offline geometry render; no WebGL bloom or shadows`,
  );
}
if (enabled("loom")) {
  const { createLoomScene } = await import("../dist/loom-scene.js");
  const world = createLoomScene({ preset: "skyloop" }),
    s = stage();
  world.update(8, { playing: true, speed: 2.2, reducedMotion: false });
  s.camera.position.copy(world.cameraPosition).multiplyScalar(1.12);
  s.camera.lookAt(world.cameraTarget);
  await render(
    "loom",
    world.group,
    s.camera,
    "LOOM / Cloudline Railway",
    `${world.loom.length.toFixed(1)} m spline track · native arc-length train placement`,
  );
  world.dispose();
}
if (enabled("wayfinder")) {
  const { Wayfinder } = await import("../dist/packages/wayfinder/index.js");
  const { createWayfinderScene, MOONPOST_CONFIG, moonpostPreset } =
    await import("../dist/wayfinder-scene.js");
  const grid = new Wayfinder(MOONPOST_CONFIG);
  grid.setCells(moonpostPreset("garden"));
  const route = grid.findPath({ x: 1, z: 8 }, { x: 10, z: 1 });
  assert.equal(route.status, "found");
  const s = stage(),
    world = createWayfinderScene(s, {
      snapshot: grid.snapshot(),
      route: route.points,
      reducedMotion: true,
    });
  world.setCourier(route.points[Math.floor(route.points.length / 2)]);
  world.update(0, 0);
  s.camera.position.multiplyScalar(1.05);
  s.camera.lookAt(0, 2.6, 0);
  await render(
    "wayfinder",
    world.root,
    s.camera,
    "WAYFINDER / Moonpost Dispatch",
    `${route.cells.length} route cells · weighted cost ${route.cost.toFixed(2)}`,
  );
  world.dispose();
}
if (enabled("parcel")) {
  const { createParcel } = await import("../dist/packages/parcel/index.js");
  const { createParcelScene } = await import("../dist/parcel-scene.js");
  const loot = createParcel(
    {
      id: "starlight",
      entries: [
        { id: "ore", itemId: "ore", rarity: "common", weight: 9 },
        { id: "star", itemId: "star", rarity: "legendary", weight: 1 },
      ],
      pity: { after: 5, rarities: ["legendary"] },
    },
    { seed: 42 },
  );
  let receipt;
  do {
    receipt = loot.roll().receipt;
  } while (receipt.rarity !== "legendary");
  const s = stage(),
    world = createParcelScene(s, { opened: false, reducedMotion: true });
  world.reveal(receipt);
  world.update(0, 0);
  s.camera.position.multiplyScalar(1.2);
  s.camera.lookAt(0, 2.3, 0);
  await render(
    "parcel",
    world.root,
    s.camera,
    "PARCEL / Starlight Salvage",
    `Seed 42 · actual ${receipt.rarity} receipt #${receipt.roll}`,
  );
  world.dispose();
}
if (enabled("tempo")) {
  const { Tempo } = await import("../dist/packages/tempo/index.js");
  const { createTempoScene, SPELLS } = await import("../dist/tempo-scene.js");
  const clock = new Tempo(
    SPELLS.map(({ id, charges, recharge, cooldown, usesGlobalCooldown }) => ({
      id,
      charges,
      recharge,
      cooldown,
      usesGlobalCooldown,
    })),
    { globalCooldown: 0.5 },
  );
  const s = stage(),
    world = createTempoScene(s);
  for (const id of ["blink", "bloom", "meteor"]) {
    const used = clock.tryUse(id);
    assert.equal(used.ok, true);
    world.cast(id);
    clock.tick(0.55);
    world.update(0.55);
  }
  world.setState(clock.state);
  s.camera.position.multiplyScalar(0.95);
  s.camera.lookAt(0, 1.5, 0);
  await render(
    "tempo",
    world.root,
    s.camera,
    "TEMPO / The Spellgarden",
    `Three accepted casts · simulation time ${clock.time.toFixed(2)} s`,
  );
  world.dispose();
}
if (enabled("spring")) {
  const { createSpringScene } = await import("../dist/spring-scene.js");
  const s = stage(),
    world = createSpringScene(s, {
      frequency: 1.6,
      dampingRatio: 0.28,
      reducedMotion: false,
    });
  world.kick(14);
  world.update(0.13);
  s.camera.position.copy(world.cameraPosition).multiplyScalar(1.08);
  s.camera.lookAt(world.cameraTarget);
  await render(
    "spring",
    world.root,
    s.camera,
    "SPRING / Jellyworks",
    "Actual analytic spring response after an impulse",
  );
  world.dispose();
}
