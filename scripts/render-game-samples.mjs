// Local geometry and state illustrations, never browser captures or URL access.
import * as THREE from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { flatten, save } from "./render-samples.mjs";
import {
  createCampScene,
  createItemModel,
  createCourier,
  CAMP_ITEMS,
} from "../dist/camp-scene.js";
import { Inventory } from "../dist/packages/satchel/index.js";
import { Conversation } from "../dist/packages/chatter/index.js";
import { MIRA_STORY } from "../dist/kits/chatter-story.js";
import { MothlightGame } from "../dist/templates/mothlight/game.js";
import { PICKUPS } from "../dist/templates/mothlight/content.js";

await mkdir("dist/assets/items", { recursive: true });
for (const id of [...CAMP_ITEMS.map((i) => i.id), "mira"]) {
  const model =
      id === "mira" ? createCourier({ merchant: true }) : createItemModel(id),
    scene = flatten(model);
  scene.background = null;
  const bounds = new THREE.Box3().setFromObject(model),
    sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position
    .copy(sphere.center)
    .add(
      new THREE.Vector3(2.8, 2.4, 4.5)
        .normalize()
        .multiplyScalar(
          (sphere.radius / Math.sin(THREE.MathUtils.degToRad(17.5))) * 1.1,
        ),
    );
  camera.lookAt(sphere.center);
  const renderer = new SVGRenderer();
  renderer.setSize(256, 256);
  renderer.setPrecision(2);
  renderer.render(scene, camera);
  renderer.domElement.removeAttribute("style");
  await sharp(Buffer.from(renderer.domElement.outerHTML))
    .png()
    .toFile(`dist/assets/items/${id}.png`);
}
console.log("Generated 7 original Three.js item/character thumbnails.");
const ns = "http://www.w3.org/2000/svg";
function element(svg, tag, attrs, value) {
  const e = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (value !== undefined) e.textContent = String(value);
  svg.append(e);
  return e;
}
const rect = (svg, x, y, w, h, fill, stroke = "none", radius = 8) =>
  element(svg, "rect", { x, y, width: w, height: h, rx: radius, fill, stroke });
const label = (svg, value, x, y, size = 16, color = "#dbe6dc") =>
  element(
    svg,
    "text",
    {
      x,
      y,
      "font-family": "DejaVu Sans,sans-serif",
      "font-size": size,
      fill: color,
    },
    value,
  );
function wrap(svg, value, x, y, width = 29, size = 17, color = "#c6d4c9") {
  const words = value.split(" ");
  let line = "",
    row = 0;
  for (const word of words) {
    if ((line + word).length > width && line) {
      label(svg, line.trim(), x, y + row * size * 1.6, size, color);
      row++;
      line = "";
    }
    line += word + " ";
  }
  if (line) label(svg, line.trim(), x, y + row * size * 1.6, size, color);
  return y + (row + 1) * size * 1.6;
}
const thumbnails = Object.fromEntries(
  await Promise.all(
    CAMP_ITEMS.map(async (i) => [
      i.id,
      (await readFile(`dist/assets/items/${i.id}.png`)).toString("base64"),
    ]),
  ),
);
const stage = () => ({
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(),
  bloom: {},
});
{
  const world = createCampScene(stage(), { mode: "satchel" }),
    scene = flatten(world.root),
    camera = new THREE.PerspectiveCamera(38, 1440 / 900, 0.1, 200);
  camera.position.set(20, 17, 25);
  camera.lookAt(0, 0.5, 0);
  camera.setViewOffset(1440, 900, 190, 0, 1440, 900);
  const bag = new Inventory({
    catalog: CAMP_ITEMS,
    columns: 6,
    rows: 4,
    maxWeight: 16,
  });
  bag.add("copper", 5);
  bag.add("blade");
  bag.add("glass", 3);
  bag.add("herb", 3);
  bag.add("potion");
  await save(
    "satchel-sample",
    scene,
    camera,
    "SATCHEL  /  Everything in its place",
    "Actual camp, item models and inventory state · offline illustration; browser lighting is simplified",
    (svg) => {
      rect(svg, 335, -285, 350, 635, "#1b2e36", "#4a6367");
      label(svg, "THE COURIER’S PACK", 357, -250, 16, "#e7d0a1");
      label(svg, `${bag.weight.toFixed(1)} / 16 kg`, 357, -218, 15, "#abc4be");
      const x = 355,
        y = -187,
        size = 50;
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 6; col++)
          rect(
            svg,
            x + col * size,
            y + row * size,
            48,
            48,
            "#142731",
            "#38525b",
            3,
          );
      for (const stack of bag.items) {
        const d = CAMP_ITEMS.find((i) => i.id === stack.itemId),
          dim = bag.dimensions(stack);
        rect(
          svg,
          x + stack.x * size,
          y + stack.y * size,
          dim.width * size - 2,
          dim.height * size - 2,
          "#29434a",
          d.color,
          4,
        );
        element(svg, "image", {
          x: x + stack.x * size,
          y: y + stack.y * size,
          width: dim.width * size - 2,
          height: dim.height * size - 2,
          href: `data:image/png;base64,${thumbnails[d.id]}`,
        });
        label(
          svg,
          stack.quantity,
          x + stack.x * size + 7,
          y + (stack.y + dim.height) * size - 8,
          13,
          "#f6e9c5",
        );
      }
      let yy = 60;
      for (const line of [
        "Stack your supplies.",
        "Rotate the awkward things.",
        "Transfer without losing items.",
        "Craft only when it all fits.",
      ]) {
        label(svg, line, 357, yy, 16, "#bdd2c8");
        yy += 36;
      }
      rect(svg, 355, 235, 308, 53, "#d8c593");
      label(svg, "READY FOR YOUR GAME", 376, 267, 15, "#243e42");
    },
  );
  world.dispose();
}
{
  const world = createCampScene(stage(), { mode: "chatter" }),
    scene = flatten(world.root),
    camera = new THREE.PerspectiveCamera(38, 1440 / 900, 0.1, 200);
  camera.position.set(14, 12, 19);
  camera.lookAt(-1, 1, -1);
  camera.setViewOffset(1440, 900, 170, 0, 1440, 900);
  const talk = new Conversation(MIRA_STORY);
  talk.choose("help");
  talk.choose("promise");
  talk.choose("story");
  const view = talk.view;
  await save(
    "chatter-sample",
    scene,
    camera,
    "CHATTER  /  Someone worth listening to",
    "Actual scene and live dialogue state · offline illustration; not a browser screenshot",
    (svg) => {
      rect(svg, 298, -290, 390, 658, "#192e37", "#4b686b");
      label(svg, "MIRA · THE KEEPER", 325, -248, 17, "#ebcd98");
      const yy = wrap(svg, view.text, 325, -205, 29, 17);
      let y = yy + 28;
      for (const choice of view.choices) {
        rect(svg, 320, y, 342, 68, "#2c484b", "#788779");
        wrap(svg, choice.text, 337, y + 27, 27, 15, "#e8e7cc");
        y += 82;
      }
      label(
        svg,
        `trust: ${talk.variables.trust}  ·  promised: ${talk.variables.promised}`,
        323,
        325,
        14,
        "#aecbbe",
      );
    },
  );
  world.dispose();
}
{
  const game = new MothlightGame(),
    talk = game.createConversation();
  talk.choose("accept");
  game.accepted = talk.variables.accepted;
  for (const pickup of PICKUPS) game.collect(pickup.id);
  game.craft();
  game.deliver();
  const world = createCampScene(stage(), { mode: "mothlight" });
  world.setCollected(game.collected);
  world.setCompleted(game.completed);
  world.player.position.set(2, 0.12, -1);
  world.update(1);
  const camera = new THREE.PerspectiveCamera(38, 1440 / 900, 0.1, 200);
  camera.position.set(19, 16, 24);
  camera.lookAt(0, 0.7, 0);
  await save(
    "mothlight-sample",
    flatten(world.root),
    camera,
    "MOTHLIGHT  /  A small light. A way home.",
    "Playable adventure template · gather / craft / deliver · offline geometry illustration",
    (svg) => {
      rect(svg, 365, -270, 300, 112, "#203841", "#668078");
      label(svg, "DELIVERY COMPLETE", 387, -230, 16, "#f1d29a");
      label(svg, "The moths came back.", 387, -194, 17, "#c2d7c7");
    },
  );
  world.dispose();
}
