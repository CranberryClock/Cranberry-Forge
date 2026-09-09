// Offline geometry illustrations. This does not load or capture the web application.
// Three.js's official SVGRenderer supplies projection/raster input. Shader effects,
// bloom and shadows are intentionally absent; the README labels these differences.
import { JSDOM } from "jsdom";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { createBiomeScene, createBiomeExport } from "../dist/biome-scene.js";
import { createFluxScene } from "../dist/flux-scene.js";
import { createSignalScene } from "../dist/signal-scene.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.document = dom.window.document;
const width = 1440,
  height = 900;
await mkdir("docs/images", { recursive: true });
export function flatten(source, { trail = false, signal = false } = {}) {
  source.updateMatrixWorld(true);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#15242d");
  scene.add(new THREE.AmbientLight("#d6e4ee", 1.4));
  const key = new THREE.DirectionalLight("#ffddb0", 2.3);
  key.position.set(-12, 22, 12);
  scene.add(key);
  const mat = (material, tint) => {
    const color = (
      material.color ??
      material.uniforms?.headColor?.value ??
      new THREE.Color("#83decb")
    ).clone();
    if (tint) color.multiply(tint);
    return new THREE.MeshLambertMaterial({
      color,
      emissive:
        material.emissive?.clone().multiplyScalar(0.2) ?? new THREE.Color(0),
      vertexColors: !!material.vertexColors,
      side: material.side ?? THREE.FrontSide,
      transparent: material.transparent,
      opacity: material.opacity ?? 1,
      visible: material.visible !== false,
    });
  };
  source.traverseVisible((o) => {
    if (!o.isMesh || !o.visible) return;
    if (!Array.isArray(o.material) && o.material?.visible === false) return;
    if (signal && o.name === "Signal telegraph") return;
    if (
      o.geometry.parameters?.width >= 150 ||
      o.geometry.parameters?.radius >= 50
    )
      return;
    if (o.isInstancedMesh) {
      const matrix = new THREE.Matrix4(),
        color = new THREE.Color();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix);
        if (o.instanceColor) o.getColorAt(i, color);
        else color.set("#ffffff");
        const m = new THREE.Mesh(
          o.geometry,
          Array.isArray(o.material)
            ? o.material.map((v) => mat(v, color))
            : mat(o.material, color),
        );
        m.matrix.copy(o.matrixWorld).multiply(matrix);
        m.matrixAutoUpdate = false;
        scene.add(m);
      }
      return;
    }
    if (trail && o.name === "Flux trail") {
      const g = o.geometry.clone();
      const start = g.drawRange.start,
        count = g.drawRange.count;
      g.setIndex(Array.from(g.index.array.slice(start, start + count)));
      const colors = [];
      const life = g.attributes.aLife,
        head = o.material.uniforms.headColor.value,
        tail = o.material.uniforms.tailColor.value;
      for (let i = 0; i < g.attributes.position.count; i++) {
        const c = tail.clone().lerp(head, life.getX(i));
        colors.push(c.r, c.g, c.b);
      }
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      const m = new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({
          color: "#ffffff",
          vertexColors: true,
          side: THREE.DoubleSide,
        }),
      );
      m.matrix.copy(o.matrixWorld);
      m.matrixAutoUpdate = false;
      scene.add(m);
      return;
    }
    const m = new THREE.Mesh(
      o.geometry,
      Array.isArray(o.material)
        ? o.material.map((v) => mat(v))
        : mat(o.material),
    );
    m.matrix.copy(o.matrixWorld);
    m.matrixAutoUpdate = false;
    m.name = o.name;
    m.renderOrder = o.renderOrder;
    if (signal)
      m.renderOrder =
        { "Arena plinth": -5, "Arena skirt": -4, "Arena ground": -3 }[o.name] ??
        o.renderOrder;
    else if (!trail)
      m.renderOrder =
        {
          "Island strata": -5,
          Terrain: -4,
          "Exclusion watercourse": -3,
          "Camp island": -5,
          "Camp turf": -4,
        }[o.name] ?? o.renderOrder;
    scene.add(m);
  });
  return scene;
}
export async function save(name, scene, camera, title, subtitle, decorate) {
  const renderer = new SVGRenderer();
  renderer.setSize(width, height);
  renderer.setQuality("high");
  renderer.setPrecision(2);
  renderer.render(scene, camera);
  const svg = renderer.domElement;
  // SVGRenderer uses a centered viewBox. Label the artifact as an offline sample.
  const namespace = "http://www.w3.org/2000/svg";
  const background = document.createElementNS(namespace, "rect");
  Object.entries({
    x: -width / 2,
    y: -height / 2,
    width,
    height,
    fill: "#15242d",
  }).forEach(([k, v]) => background.setAttribute(k, String(v)));
  svg.prepend(background);
  decorate?.(svg);
  const panel = document.createElementNS(namespace, "rect");
  Object.entries({
    x: -width / 2,
    y: -height / 2,
    width,
    height: 115,
    fill: "#0d181f",
  }).forEach(([k, v]) => panel.setAttribute(k, String(v)));
  svg.append(panel);
  const label = (text, y, size, color) => {
    const el = document.createElementNS(namespace, "text");
    el.setAttribute("x", String(-width / 2 + 42));
    el.setAttribute("y", String(-height / 2 + y));
    el.setAttribute("font-family", "DejaVu Sans,sans-serif");
    el.setAttribute("font-size", String(size));
    el.setAttribute("fill", color);
    el.textContent = text;
    svg.append(el);
  };
  label(title, 48, 26, "#e9efd9");
  label(subtitle, 82, 16, "#a6b8bb");
  const buffer = Buffer.from(svg.outerHTML);
  await sharp(buffer).png().toFile(`docs/images/${name}.png`);
  console.log(`Saved docs/images/${name}.png`);
}

const direct = process.argv[1] === fileURLToPath(import.meta.url);
if (direct && (!process.argv[2] || process.argv[2] === "biome")) {
  const stage = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    bloom: {},
  };
  const world = createBiomeScene(stage, {
    preset: "alpine",
    seed: 42,
    count: 180,
    relief: 1.4,
    spacing: 0.96,
    slope: 36,
    scale: 1,
    pathWidth: 2.5,
    clearings: [],
  });
  const scene = flatten(createBiomeExport(world.group));
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);
  camera.position.set(34, 29, 38);
  camera.lookAt(0, 1.5, 0);
  await save(
    "biome-sample",
    scene,
    camera,
    "BIOME  /  Alpine placement study",
    "Seed 42 · 180 placements · offline geometry render; no browser lighting or shadows",
  );
  world.dispose();
}
if (direct && (!process.argv[2] || process.argv[2] === "flux")) {
  const stage = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    bloom: {},
  };
  stage.camera.position.set(16, 11, 22);
  const world = createFluxScene(stage, {
    preset: "aurora",
    count: 7,
    speed: 1,
    lifetime: 2.7,
    width: 0.55,
    taper: 1.2,
    intensity: 2.4,
  });
  const scene = flatten(world.group, { trail: true });
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);
  camera.position.set(16, 11, 22);
  camera.lookAt(0, 1.5, 0);
  await save(
    "flux-sample",
    scene,
    camera,
    "FLUX  /  Aurora ribbon study",
    "Actual motion-ribbon geometry · offline flat-color render; browser bloom is not shown",
  );
  world.dispose();
}
if (direct && (!process.argv[2] || process.argv[2] === "signal")) {
  const stage = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    bloom: {},
  };
  const params = {
    shape: "circle",
    radius: 5.5,
    innerRadius: 1.4,
    angle: 70,
    length: 10,
    width: 3,
    color: "#ffb48a",
    intensity: 1.7,
    relief: 1.1,
    duration: 3,
    rotation: 0,
    x: 0,
    z: 0,
  };
  const world = createSignalScene(stage, params);
  const scene = flatten(world.root, { signal: true });
  // Mesh representation of the exact ring footprint for a renderer without fragment shaders.
  const g = new THREE.RingGeometry(params.innerRadius, params.radius, 120, 8);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    p.setY(
      i,
      0.25 +
        params.relief *
          (0.5 * Math.sin(x * 0.32) * Math.cos(z * 0.28) +
            0.14 * Math.cos(x * 0.6 + z * 0.3)) +
        0.06,
    );
  }
  const ring = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ color: "#c89572", side: THREE.DoubleSide }),
  );
  ring.renderOrder = -2;
  scene.add(ring);
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);
  camera.position.set(29, 28, 35);
  camera.lookAt(0, 0, 0);
  await save(
    "signal-sample",
    scene,
    camera,
    "SIGNAL  /  Combat footprint study",
    "Terrain and target geometry · offline ring overlay; browser charge shader is not shown",
  );
  world.dispose();
}
