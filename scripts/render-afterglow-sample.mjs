// Offline geometry illustration from a real game trace; never a browser capture.
import * as THREE from "three";
import assert from "node:assert/strict";
import { flatten, save } from "./render-samples.mjs";
import { AfterglowGame } from "../dist/templates/afterglow/game.js";
import { createAfterglowScene } from "../dist/templates/afterglow/scene.js";

const stage = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(38, 1440 / 900, 0.1, 250),
  bloom: {},
};
const game = new AfterglowGame(),
  world = createAfterglowScene(stage);
game.start();
for (let frame = 0; frame < 492; frame++) {
  const events = game.step(1 / 60, {
    x: frame < 450 ? 0.8 : -0.6,
    z: frame < 450 ? -0.3 : 0.8,
    dash: frame === 479,
  });
  world.setState(game.view, events);
  world.update(1 / 60);
}
assert.ok(
  game.view.attacks.length > 0,
  "Sample trace must contain a real active warning",
);
assert.ok(
  world.trail.sampleCount >= 4,
  "Sample trace must contain a real dash ribbon",
);
world.trail.name = "Flux trail";
world.root.traverse((object) => {
  if (!object.isMesh) return;
  if (
    object.geometry.type === "CylinderGeometry" &&
    object.geometry.parameters.radiusTop >= 3 &&
    object.position.y < 0
  )
    object.renderOrder = -10 + object.position.y;
});
stage.camera.position.set(20, 24, 29);
stage.camera.lookAt(0, -0.6, 0);
const illustration = flatten(world.root, { trail: true, signal: true });
illustration.traverse((object) => {
  if (object.isAmbientLight) object.intensity = 0.75;
  if (object.isDirectionalLight) object.intensity = 1.45;
  if (object.name.startsWith("Afterglow footprint")) {
    object.material.dispose();
    object.material = new THREE.MeshBasicMaterial({
      color: "#f09174",
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
  }
});
await save(
  "afterglow-sample",
  illustration,
  stage.camera,
  "AFTERGLOW / Outrun the last sun",
  "Actual game trace and dash ribbon · offline warning overlay simplifies the browser charge shader",
  (svg) => {
    const ns = "http://www.w3.org/2000/svg";
    const rect = document.createElementNS(ns, "rect");
    for (const [k, v] of Object.entries({
      x: -680,
      y: 205,
      width: 305,
      height: 142,
      rx: 10,
      fill: "#132b35",
      stroke: "#5e807d",
    }))
      rect.setAttribute(k, String(v));
    svg.append(rect);
    for (const [text, y, color] of [
      [`ROUND ${game.view.round} / 3`, 237, "#e4ca8f"],
      [`${game.view.health} light charges remaining`, 272, "#bed5c9"],
      ["Read the lane. Dash clear.", 313, "#e0e5d1"],
    ]) {
      const node = document.createElementNS(ns, "text");
      for (const [k, v] of Object.entries({
        x: -658,
        y,
        fill: color,
        "font-size": 16,
        "font-family": "DejaVu Sans,sans-serif",
      }))
        node.setAttribute(k, String(v));
      node.textContent = text;
      svg.append(node);
    }
  },
);
world.dispose();
