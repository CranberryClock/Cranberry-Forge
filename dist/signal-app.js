import * as THREE from "three";
import { Telegraph } from "@cranberry-forge/signal";
import { createStage } from "./scene.js";
import { createSignalScene, SIGNAL_PRESETS } from "./signal-scene.js";

const $ = (s) => document.querySelector(s);
const params = {
  preset: "orbital",
  shape: "circle",
  radius: 5.5,
  innerRadius: 0,
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
const code = `import { Telegraph } from '@cranberry-forge/signal';

const warning = new Telegraph({ shape: 'cone',
  radius: 10, angle: 75, color: '#a8a1ff' });
scene.add(warning);
warning.project(getTerrainHeight).arm(now, 3);

warning.addEventListener('complete', () => {
  if (warning.containsPoint(playerWorldPosition)) hit();
});
// Every frame: warning.update(elapsedSeconds);`;
let stage,
  world,
  aim = false,
  timer,
  debounce;
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(timer);
  timer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function download(blob, name) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function range(id, label, min, max, step = 1, unit = "") {
  return `<div class="control-row"><label class="control-label" for="${id}">${label}<output id="${id}-value">${params[id]}${unit}</output></label><input type="range" id="${id}" data-unit="${unit}" data-param="${id}" min="${min}" max="${max}" step="${step}" value="${params[id]}"></div>`;
}
function controls() {
  $("#controls").innerHTML =
    `<section class="control-section"><h3>01 / FOOTPRINT</h3>${params.shape === "beam" ? range("length", "Beam length", 3, 17, 0.5, " m") + range("width", "Beam width", 1, 8, 0.1, " m") : range("radius", "Outer radius", 2, 12, 0.1, " m") + range("innerRadius", "Safe center", 0, Math.max(0, params.radius - 0.1), 0.1, " m")}${params.shape === "cone" ? range("angle", "Cone angle", 15, 180, 1, "°") : ""}${range("rotation", "Direction", 0, 360, 1, "°")}</section><section class="control-section"><h3>02 / CHARGE & TERRAIN</h3>${range("duration", "Charge duration", 0.5, 8, 0.1, " s")}${range("relief", "Terrain relief", 0, 2.5, 0.1)}${range("intensity", "Light intensity", 0.3, 3, 0.1)}<label class="toggle-row" for="pause">Freeze time <input id="pause" type="checkbox" ${world?.paused ? "checked" : ""}></label><div class="charge-track"><span id="charge-fill"></span></div></section><section class="control-section"><h3>03 / COLOR</h3><label class="toggle-row" for="color">Warning color <input id="color" type="color" value="${params.color}"></label><p class="helper">Warm targets are inside the footprint. Hit checks use the same shape, position and direction as the warning.</p></section>`;
  document.querySelectorAll("[data-param]").forEach(
    (input) =>
      (input.oninput = () => {
        params[input.id] = Number(input.value);
        if (params.innerRadius >= params.radius)
          params.innerRadius = Math.max(0, params.radius - 0.1);
        $(`#${input.id}-value`).textContent =
          `${input.value}${input.dataset.unit}`;
        if (input.id === "radius") {
          const inner = $("#innerRadius");
          if (inner) {
            inner.max = params.radius - 0.1;
            inner.value = params.innerRadius;
            $("#innerRadius-value").textContent = `${params.innerRadius} m`;
          }
        }
        clearTimeout(debounce);
        debounce = setTimeout(() => world.rebuild(), 65);
      }),
  );
  $("#pause").onchange = (e) => (world.paused = e.target.checked);
  $("#color").oninput = (e) => {
    params.color = e.target.value;
    world.telegraph.configure({ color: params.color });
  };
}
function presets() {
  $("#presets").innerHTML = SIGNAL_PRESETS.map(
    (p) =>
      `<button class="preset ${p.id === params.preset ? "selected" : ""}" data-preset="${p.id}" aria-pressed="${p.id === params.preset}"><span class="preset-swatch" style="--swatch:${p.swatch}"></span><span><span class="preset-title">${p.name}</span><span class="preset-caption">${p.caption}</span></span><span class="preset-check">${p.id === params.preset ? "✓" : ""}</span></button>`,
  ).join("");
  document.querySelectorAll("[data-preset]").forEach(
    (b) =>
      (b.onclick = () => {
        const p = SIGNAL_PRESETS.find((p) => p.id === b.dataset.preset);
        Object.assign(params, {
          preset: p.id,
          shape: p.shape,
          radius: p.radius,
          innerRadius: p.innerRadius,
          angle: p.angle,
          width: p.width,
          length: p.length,
          color: p.color,
          x: 0,
          z: p.shape === "circle" ? 0 : 5,
          rotation: 0,
        });
        world.rebuild();
        controls();
        presets();
        $("#scene-title").innerHTML = p.title;
        $("#scene-label").textContent = p.label;
      }),
  );
}
function guide() {
  $("#docs-content").innerHTML =
    `<h2>Signal / Fair combat starts with a clear warning</h2><p>Signal pairs a visible footprint with the same mathematical containment query. It is independently usable with Three.js: no Biome, Flux or game engine dependency.</p><p><a href="/downloads/cranberry-forge-signal-0.1.0.tgz" download>Download the standalone package ↓</a> · <a href="/docs/signal/api/index.html" target="_blank" rel="noopener">Complete API and tutorial ↗</a></p><h3>Install</h3><pre>npm install three@0.180.0 ./cranberry-forge-signal-0.1.0.tgz</pre><p>The package is not published on npm. Use the provided tarball or pack <code>dist/packages/signal</code> from the repository.</p><h3>Follow your game's clock</h3><pre>${code.replaceAll("<", "&lt;")}</pre><p>Use seconds. <code>arm(time,duration)</code> resets the timer. The <code>complete</code> event fires once. Call <code>cancel()</code> to hide the warning, or arm it again for another attack. A completed warning remains visible until your game hides or reuses it.</p><h3>Terrain and footprints</h3><p>Call <code>project((x,z)=&gt;height)</code> with a world-space height function. After moving, yawing or scaling the warning, project it again. Use Y-up scenes and yaw rotations; arbitrary pitch or roll is unsupported. Cones and beams point down local −Z.</p><p><code>containsPoint(worldPosition)</code> queries the full XZ footprint, including ring holes. It intentionally ignores altitude and charge progress. Your game controls team filtering, vertical tolerance, collision and damage. Signal supplies a warning and a consistent area test.</p><h3>Save, restore, dispose</h3><pre>const recipe = warning.toRecipe();
const restored = Telegraph.fromRecipe(recipe);
warning.dispose();</pre><p>Recipes save shape and appearance, not transforms, terrain callbacks or timers. The shader uses additive transparency. Terrain projection approximates your surface with a configurable grid; very sharp features need more subdivisions. CPU hit tests use exact footprints in XZ, independent of that visual grid.</p>`;
  $("#docs-dialog").showModal();
}
try {
  stage = createStage($("#signal-canvas"));
  world = createSignalScene(stage, params, ({ count, state, progress }) => {
    $("#hit-count").textContent = count;
    $("#progress-count").textContent = `${Math.round(progress * 100)}%`;
    $("#signal-status").textContent = world?.paused
      ? "TIME FROZEN"
      : state === "complete"
        ? "IMPACT"
        : "CHARGING";
    const bar = $("#charge-fill");
    if (bar) bar.style.width = `${progress * 100}%`;
  });
  stage.setActive(world);
  stage.reset("flux");
  stage.camera.position.set(26, 25, 31);
  stage.controls.target.set(0, 0, 0);
  stage.controls.autoRotate = false;
  stage.controls.update();
  $("#code").textContent = code;
  controls();
  presets();
  $("#aim").onclick = () => {
    aim = !aim;
    $("#aim").classList.toggle("active", aim);
    $("#signal-canvas").style.cursor = aim ? "crosshair" : "";
    if (aim) toast("Click the arena to move the warning.");
  };
  let down = null;
  $("#signal-canvas").addEventListener(
    "pointerdown",
    (e) => (down = [e.clientX, e.clientY]),
  );
  $("#signal-canvas").addEventListener("pointerup", (e) => {
    if (
      !aim ||
      !down ||
      Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5
    )
      return;
    const rect = e.target.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      stage.camera,
    );
    const hit = ray.intersectObject(world.ground)[0];
    if (hit) {
      params.x = hit.point.x;
      params.z = hit.point.z;
      world.rebuild();
    }
  });
  $("#replay").onclick = () => world.replay();
  $("#reset-view").onclick = () => {
    stage.camera.position.set(26, 25, 31);
    stage.controls.target.set(0, 0, 0);
    stage.controls.update();
  };
  $("#export").onclick = () => {
    download(
      new Blob([JSON.stringify(world.telegraph.toRecipe(), null, 2)], {
        type: "application/json",
      }),
      `signal-${params.shape}.json`,
    );
    toast("Standalone telegraph recipe exported.");
  };
  $("#load").onclick = () => $("#file").click();
  $("#file").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 65536)
        throw new Error("Use a recipe smaller than 64 KB.");
      const loaded = Telegraph.fromRecipe(await file.text()),
        o = loaded.options;
      const p = SIGNAL_PRESETS.find((p) => p.shape === o.shape);
      if (
        o.radius > 12 ||
        o.radius < 2 ||
        o.length > 17 ||
        o.length < 3 ||
        o.width > 8 ||
        o.width < 1 ||
        (o.shape === "cone" && (o.angle < 15 || o.angle > 180)) ||
        o.innerRadius > o.radius - 0.1 ||
        o.intensity > 3 ||
        o.intensity < 0.3
      ) {
        loaded.dispose();
        throw new Error(
          "This preset exceeds workbench ranges; use the package API to load it in your game.",
        );
      }
      Object.assign(params, {
        preset: p.id,
        shape: o.shape,
        radius: o.radius,
        innerRadius: o.innerRadius,
        angle: o.angle,
        length: o.length,
        width: o.width,
        color: o.color,
        intensity: o.intensity,
      });
      world.rebuild();
      world.telegraph.configure(o);
      loaded.dispose();
      controls();
      presets();
      $("#scene-title").innerHTML = p.title;
      $("#scene-label").textContent = p.label;
      toast("Telegraph preset loaded.");
    } catch (error) {
      toast(error.message);
    }
  };
  $("#capture").onclick = () =>
    $("#signal-canvas").toBlob((blob) => {
      if (blob) download(blob, "signal-study.png");
    }, "image/png");
  $("#open-docs").onclick = guide;
  $("#tutorial").onclick = guide;
  $("#close-docs").onclick = () => $("#docs-dialog").close();
  $("#copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast("Code copied.");
    } catch {
      toast("Select the example to copy it.");
    }
  };
  setInterval(
    () =>
      ($("#draw-count").textContent =
        stage.renderer.info.render.calls.toLocaleString()),
    500,
  );
  addEventListener("pagehide", (event) => {
    if (!event.persisted) stage.dispose();
  });
} catch (error) {
  $("#error").textContent =
    `Signal could not start: ${error.message}. WebGL2 is required.`;
  $("#error").hidden = false;
  console.error(error);
}
