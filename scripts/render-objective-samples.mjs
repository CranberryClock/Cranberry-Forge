// Offline Three.js geometry illustrations. Does not navigate to or capture a page.
import * as THREE from "three";
import { flatten, save } from "./render-samples.mjs";
import { createLatchScene } from "../dist/latch-scene.js";
import { createTrailmarkScene } from "../dist/trailmark-scene.js";

{
  const world = createLatchScene();
  world.update({
    time: 2,
    focus: "beacon",
    hasFuse: true,
    charged: true,
    lit: true,
  });
  world.shutter.visible = false; // Below the solid floor in this scene state.
  // SVG's painter ordering needs explicit layers for overlapping island disks.
  world.group.traverse((object) => {
    if (!object.isMesh) return;
    if (object.geometry.type === "ConeGeometry" && object.position.y < 0)
      object.renderOrder = -12;
    else if (
      object.geometry.type === "DodecahedronGeometry" &&
      object.position.y < 0
    )
      object.renderOrder = -11;
    else if (
      object.geometry.type === "CylinderGeometry" &&
      object.geometry.parameters.radiusTop > 7
    )
      object.renderOrder = -8 + object.position.y;
  });
  const camera = new THREE.PerspectiveCamera(38, 1440 / 900, 0.1, 200);
  camera.position.copy(world.cameraPosition).multiplyScalar(1.1);
  camera.lookAt(world.cameraTarget);
  await save(
    "latch-sample",
    flatten(world.group),
    camera,
    "LATCH / The Meridian Observatory",
    "Actual procedural observatory · offline geometry illustration; browser bloom and shadows are not shown",
  );
  world.dispose();
}
{
  const stage = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(38, 1440 / 900, 0.1, 200),
    bloom: {},
  };
  const world = createTrailmarkScene(stage, {
    completed: ["supplies", "bridge", "homes", "beacon"],
    selected: "beacon",
  });
  world.update(0, 3);
  world.root.traverse((object) => {
    if (!object.isMesh) return;
    if (
      object.geometry.type === "CylinderGeometry" &&
      object.geometry.parameters.radiusTop >= 24
    )
      object.renderOrder = -20 + object.position.y;
  });
  stage.camera.position.set(27, 25, 33);
  stage.camera.lookAt(0, 2, 0);
  await save(
    "trailmark-sample",
    flatten(world.root),
    stage.camera,
    "TRAILMARK / The returning tide",
    "Actual restoration scene · offline geometry illustration; browser lighting and world labels are not shown",
  );
  world.dispose();
}
