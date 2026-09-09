import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Telegraph } from "@cranberry-forge/signal";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#17252d");
scene.add(new THREE.HemisphereLight("#ffffff", "#334c55", 2.5));
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(12, 16, 18);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, -3);
controls.enableDamping = true;

const height = (x, z) => Math.sin(x * 0.4) * Math.cos(z * 0.3) * 0.6;
const geometry = new THREE.PlaneGeometry(24, 24, 64, 64);
geometry.rotateX(-Math.PI / 2);
const vertices = geometry.attributes.position;
for (let i = 0; i < vertices.count; i++)
  vertices.setY(i, height(vertices.getX(i), vertices.getZ(i)));
geometry.computeVertexNormals();
const ground = new THREE.Mesh(
  geometry,
  new THREE.MeshStandardMaterial({ color: "#506c6a", roughness: 1 }),
);
scene.add(ground);
const warning = new Telegraph({
  shape: "cone",
  radius: 9,
  angle: 80,
  color: "#ffc499",
});
scene.add(warning);
warning.project(height);

const target = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 16, 12),
  new THREE.MeshBasicMaterial({ color: "#cdecd5" }),
);
scene.add(target);
let now = 0,
  previous = performance.now();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const targetWorld = new THREE.Vector3();
warning.addEventListener("complete", () => {
  target.getWorldPosition(targetWorld);
  document.querySelector("#status").textContent = warning.containsPoint(
    targetWorld,
  )
    ? "Impact: target inside the warning."
    : "Impact: target escaped.";
});
document.querySelector("#arm").onclick = () => {
  warning.arm(now, 3);
  document.querySelector("#status").textContent = "Charging for 3 seconds…";
};
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener("resize", resize);
resize();
renderer.setAnimationLoop(() => {
  const frame = performance.now();
  now += Math.min((frame - previous) / 1000, 0.05);
  previous = frame;
  const x = reducedMotion ? 0 : Math.sin(now * 0.9) * 6,
    z = -5;
  target.position.set(x, height(x, z) + 0.3, z);
  warning.update(now);
  controls.update();
  renderer.render(scene, camera);
});
addEventListener(
  "pagehide",
  () => {
    renderer.setAnimationLoop(null);
    warning.dispose();
    ground.geometry.dispose();
    ground.material.dispose();
    target.geometry.dispose();
    target.material.dispose();
    controls.dispose();
    renderer.dispose();
  },
  { once: true },
);
