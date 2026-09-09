import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#182a30");
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 350);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 15;
  controls.maxDistance = 95;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.autoRotate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotateSpeed = 0.22;
  controls.enablePan = false;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.5, 1.1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const resize = () => {
    const { width, height } = canvas.parentElement.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  resize();
  function reset(mode = "biome") {
    if (mode === "biome") {
      camera.position.set(34, 29, 38);
      controls.target.set(0, 2.5, 0);
      controls.minDistance = 24;
      controls.maxDistance = 90;
    } else {
      camera.position.set(16, 11, 22);
      controls.target.set(0, 1.5, 0);
      controls.minDistance = 8;
      controls.maxDistance = 65;
    }
    controls.update();
  }
  reset();
  let last = performance.now(),
    elapsed = 0,
    active = null,
    raf = 0,
    running = true;
  const frame = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden) return;
    elapsed += dt;
    active?.update(dt, elapsed, camera);
    controls.update(dt);
    renderer.info.reset();
    composer.render(dt);
  };
  renderer.info.autoReset = false;
  raf = requestAnimationFrame(frame);
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(raf);
    const box = document.querySelector("#error");
    box.textContent =
      "The graphics context was interrupted. Reload this page to restart the laboratory.";
    box.hidden = false;
  });
  return {
    renderer,
    scene,
    camera,
    controls,
    composer,
    bloom,
    reset,
    get active() {
      return active;
    },
    setActive(next) {
      active?.dispose();
      active = next;
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      active?.dispose();
      observer.disconnect();
      controls.dispose();
      composer.dispose();
      bloom.dispose();
      renderer.dispose();
    },
  };
}

export function releaseObject(root) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    if (o.geometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      if (m) materials.add(m);
  });
  for (const m of materials)
    for (const value of Object.values(m))
      if (value?.isTexture) textures.add(value);
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
  root.removeFromParent();
  root.clear();
}
