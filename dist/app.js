import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { normalizeOptions } from "@cranberry-forge/biome";
import { normalizeTrailOptions } from "@cranberry-forge/flux";
import { createStage } from "./scene.js";
import {
  createBiomeScene,
  createBiomeExport,
  BIOME_PRESETS,
} from "./biome-scene.js";
import { createFluxScene, FLUX_PRESETS } from "./flux-scene.js";
import { guideHTML, integrationCode } from "./guide.js";

const $ = (s) => document.querySelector(s);
const biome = {
  preset: "alpine",
  seed: 42,
  count: 440,
  relief: 1.4,
  spacing: 0.96,
  slope: 36,
  scale: 1,
  pathWidth: 2.5,
  clearings: [],
};
const flux = {
  preset: "aurora",
  count: 7,
  speed: 1,
  lifetime: 2.7,
  width: 0.55,
  taper: 1.2,
  intensity: 2.4,
};
let mode = "biome",
  stage,
  active,
  paint = false,
  toastTimer,
  frameTimer,
  customAsset = false;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3800);
}
function download(blob, name) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function saveJSON(data, name) {
  download(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    name,
  );
}
function range(id, label, value, min, max, step = 1, unit = "") {
  return `<div class="control-row"><label class="control-label" for="${id}">${label}<output id="${id}-value">${value}${unit}</output></label><input id="${id}" data-param="${id}" data-unit="${unit}" type="range" value="${value}" min="${min}" max="${max}" step="${step}"></div>`;
}
function stats(s) {
  $("#metric-count").textContent = s.placed.toLocaleString();
  if (mode === "biome")
    $("#placement-note").textContent = s.saturated
      ? `${s.placed} of ${s.requested} placed. Spacing or exclusions limit this seed.`
      : `${Math.round(s.buildMs)} ms to compose · ${s.attempts.toLocaleString()} candidates evaluated`;
}

function controls() {
  if (mode === "biome")
    $("#controls").innerHTML =
      `<section class="control-section"><h3>01 / GENERATION</h3><label class="control-label" for="seed">World seed</label><div class="seed-row"><input id="seed" type="number" min="0" max="4294967295" step="1" value="${biome.seed}" aria-label="World seed"><button id="shuffle" aria-label="Randomize seed" title="New seed">⤨</button></div>${range("count", "Object budget", biome.count, 50, 1200, 10)}${range("spacing", "Minimum spacing", biome.spacing, 0.4, 2.5, 0.05, " m")}</section><section class="control-section"><h3>02 / THE LANDSCAPE</h3>${range("relief", "Terrain relief", biome.relief, 0, 3, 0.1)}${range("slope", "Maximum slope", biome.slope, 5, 60, 1, "°")}${range("pathWidth", "Corridor width", biome.pathWidth, 0, 6, 0.1, " m")}${range("scale", "Asset scale", biome.scale, 0.4, 1.8, 0.05, "×")}</section><section class="control-section"><h3>03 / MAKE IT YOURS</h3><button id="load-asset" class="compact-button">${customAsset ? "Replace custom GLB" : "Use your own .glb"} <span>↑</span></button><p class="helper">Static models, up to 20 MB. Click “Add clearing”, then click the land.</p><button id="clear-masks" class="compact-button" style="margin-top:10px">Clear exclusion circles <span>${biome.clearings.length}</span></button></section>`;
  else
    $("#controls").innerHTML =
      `<section class="control-section"><h3>01 / MOTION</h3>${range("count", "Emitters", flux.count, 1, 16)}${range("speed", "Speed", flux.speed, 0.1, 2.5, 0.05, "×")}${range("lifetime", "Trail lifetime", flux.lifetime, 0.2, 6, 0.1, " s")}<label class="toggle-row" for="pause">Freeze motion <input id="pause" type="checkbox" ${active?.paused ? "checked" : ""}></label></section><section class="control-section"><h3>02 / LIGHT & FORM</h3>${range("width", "Ribbon width", flux.width, 0.05, 1.5, 0.05, " m")}${range("taper", "Tail taper", flux.taper, 0, 4, 0.1)}${range("intensity", "Light intensity", flux.intensity, 0.2, 5, 0.1)}<label class="toggle-row" for="trail-color">Head color <input id="trail-color" type="color" value="${flux.color ?? FLUX_PRESETS.find((p) => p.id === flux.preset).color}"></label></section><section class="control-section"><h3>03 / DISCONTINUITY</h3><button id="burst" class="compact-button">Teleport emitters <span>↗</span></button><p class="helper">Trails break on teleport. No stretched ribbons crossing your entire scene.</p></section>`;
  document.querySelectorAll("[data-param]").forEach((input) =>
    input.addEventListener("input", () => {
      const value = Number(input.value),
        params = mode === "biome" ? biome : flux;
      params[input.dataset.param] = value;
      $(`#${input.id}-value`).textContent = `${value}${input.dataset.unit}`;
      clearTimeout(frameTimer);
      frameTimer = setTimeout(
        () => {
          try {
            active.rebuild();
          } catch (e) {
            toast(e.message);
          }
        },
        mode === "biome" ? 80 : 25,
      );
    }),
  );
  if (mode === "biome") {
    $("#seed").addEventListener("change", (e) => {
      const seed = Number(e.target.value);
      if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
        toast("Use a whole-number seed between 0 and 4294967295.");
        e.target.value = biome.seed;
        return;
      }
      biome.seed = seed;
      active.rebuild();
    });
    $("#shuffle").onclick = () => {
      biome.seed = crypto.getRandomValues(new Uint32Array(1))[0];
      $("#seed").value = biome.seed;
      active.rebuild();
    };
    $("#load-asset").onclick = () => $("#asset-file").click();
    $("#clear-masks").onclick = () => {
      biome.clearings = [];
      active.rebuild();
      controls();
      toast("Exclusion circles cleared.");
    };
  } else {
    $("#pause").onchange = (e) => {
      active.paused = e.target.checked;
    };
    $("#trail-color").oninput = (e) => {
      flux.color = e.target.value;
      active.trails.forEach((t) => t.configure({ color: flux.color }));
    };
    $("#burst").onclick = () => {
      const expanded = active.burst();
      toast(
        expanded
          ? "Teleported outward. Ribbons stay disconnected."
          : "Returned to orbit. Trail connection reset.",
      );
    };
  }
}

function presetCards() {
  const list = mode === "biome" ? BIOME_PRESETS : FLUX_PRESETS,
    params = mode === "biome" ? biome : flux;
  $("#presets").innerHTML = list
    .map(
      (p) =>
        `<button class="preset ${params.preset === p.id ? "selected" : ""}" data-preset="${p.id}" aria-pressed="${params.preset === p.id}"><span class="preset-swatch" style="--swatch:${p.swatch}"></span><span><span class="preset-title">${p.name}</span><span class="preset-caption">${p.caption}</span></span><span class="preset-check">${params.preset === p.id ? "✓" : ""}</span></button>`,
    )
    .join("");
  document.querySelectorAll("[data-preset]").forEach(
    (button) =>
      (button.onclick = () => {
        const p = list.find((p) => p.id === button.dataset.preset);
        params.preset = p.id;
        if (mode === "biome") {
          Object.assign(biome, {
            seed: p.seed,
            count: p.count,
            relief: p.relief,
          });
        } else {
          Object.assign(flux, {
            count: p.count,
            speed: p.speed,
            lifetime: p.lifetime,
            width: p.width,
          });
          delete flux.color;
          delete flux.tailColor;
        }
        active.rebuild();
        controls();
        presetCards();
        sceneCopy();
      }),
  );
}
function sceneCopy() {
  const preset = (mode === "biome" ? BIOME_PRESETS : FLUX_PRESETS).find(
    (p) => p.id === (mode === "biome" ? biome : flux).preset,
  );
  $("#scene-label").textContent = preset.label;
  $("#scene-title").innerHTML = preset.title;
  $("#scene-description").textContent = preset.description;
}
function showGuide() {
  $("#docs-content").innerHTML = guideHTML(mode);
  $("#docs-dialog").showModal();
}
function switchTool(next) {
  if (!["biome", "flux"].includes(next)) next = "biome";
  clearTimeout(frameTimer);
  mode = next;
  paint = false;
  customAsset = false;
  $("#scene").style.cursor = "";
  document.documentElement.style.setProperty(
    "--accent",
    mode === "biome" ? "#dcf68b" : "#a0e9dd",
  );
  // Dispose before constructing: each factory configures the shared stage.
  stage.setActive(null);
  active =
    mode === "biome"
      ? createBiomeScene(stage, biome, stats)
      : createFluxScene(stage, flux, stats);
  stage.setActive(active);
  stage.reset(mode);
  $("#tool-category").textContent =
    mode === "biome" ? "ENVIRONMENT TOOLKIT" : "MOTION TOOLKIT";
  $("#tool-title").innerHTML =
    mode === "biome"
      ? "Biome <span>Terrain-aware scattering</span>"
      : "Flux <span>World-space motion trails</span>";
  $("#metric-label").textContent =
    mode === "biome" ? "PLACED OBJECTS" : "ACTIVE SAMPLES";
  $("#paint").hidden = mode === "flux";
  $("#paint").classList.remove("active");
  $("#export-glb").textContent =
    mode === "biome" ? "Save .glb" : "Trail recipe";
  $("#integration-description").textContent =
    mode === "biome"
      ? "One small package. Native Three.js objects. A repeatable world you can actually ship."
      : "A world-space position goes in. A luminous ribbon comes out. No particle engine required.";
  $("#integration-code").textContent = integrationCode(mode);
  $("#code-filename").textContent = mode === "biome" ? "world.js" : "spell.js";
  $(".renderer-tag").innerHTML =
    mode === "biome"
      ? "WEBGL2 <span> / </span> INSTANCED"
      : "WEBGL2 <span> / </span> RIBBONS";
  if (mode === "flux")
    $("#placement-note").textContent =
      "Fixed-capacity buffers · time-based fade · camera-facing geometry";
  controls();
  presetCards();
  sceneCopy();
  history.replaceState(null, "", `#${mode}`);
}

function validateRecipe(data) {
  if (
    !data ||
    !["cranberry-forge.biome-lab/1", "cranberry-forge.flux-lab/1"].includes(data.schema) ||
    !data.settings
  )
    throw new Error("Use an Cranberry Forge workbench recipe exported by this page.");
  const input = data.settings;
  const finite = (key, min, max) => {
    if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max)
      throw new Error(`Recipe has an invalid ${key}.`);
    return input[key];
  };
  if (data.schema === "cranberry-forge.biome-lab/1") {
    if (!BIOME_PRESETS.some((p) => p.id === input.preset))
      throw new Error("Unknown biome preset.");
    normalizeOptions({
      seed: input.seed,
      count: input.count,
      minDistance: input.spacing,
      maxSlope: input.slope,
      exclusions: input.clearings,
    });
    if (
      !Array.isArray(input.clearings) ||
      input.clearings.length > 64 ||
      input.clearings.some((e) => e.type !== "circle")
    )
      throw new Error("Up to 64 circle clearings supported.");
    return {
      mode: "biome",
      settings: {
        preset: input.preset,
        seed: input.seed,
        count: finite("count", 0, 1200),
        spacing: finite("spacing", 0.4, 2.5),
        slope: finite("slope", 5, 60),
        scale: finite("scale", 0.4, 1.8),
        relief: finite("relief", 0, 3),
        pathWidth: finite("pathWidth", 0, 6),
        clearings: structuredClone(input.clearings),
      },
    };
  }
  if (!FLUX_PRESETS.some((p) => p.id === input.preset))
    throw new Error("Unknown trail preset.");
  normalizeTrailOptions({
    lifetime: input.lifetime,
    width: input.width,
    taper: input.taper,
    intensity: input.intensity,
    ...(input.color ? { color: input.color } : {}),
    ...(input.tailColor ? { tailColor: input.tailColor } : {}),
  });
  if (!Number.isInteger(input.count))
    throw new Error("Emitter count must be an integer.");
  return {
    mode: "flux",
    settings: {
      preset: input.preset,
      count: finite("count", 1, 16),
      speed: finite("speed", 0.1, 2.5),
      lifetime: finite("lifetime", 0.2, 6),
      width: finite("width", 0.05, 1.5),
      taper: finite("taper", 0, 4),
      intensity: finite("intensity", 0.2, 5),
      ...(input.color ? { color: input.color } : {}),
      ...(input.tailColor ? { tailColor: input.tailColor } : {}),
    },
  };
}

async function init() {
  stage = createStage($("#scene"));
  switchTool(location.hash.slice(1));
  $("#loading").hidden = true;
  $("#orbit").classList.toggle("active", stage.controls.autoRotate);
  window.addEventListener("hashchange", () => {
    if (location.hash.slice(1) !== mode) switchTool(location.hash.slice(1));
  });
  $("#orbit").onclick = () => {
    stage.controls.autoRotate = !stage.controls.autoRotate;
    $("#orbit").classList.toggle("active", stage.controls.autoRotate);
  };
  $("#reset-camera").onclick = () => stage.reset(mode);
  $("#paint").onclick = () => {
    paint = !paint;
    $("#paint").classList.toggle("active", paint);
    $("#scene").style.cursor = paint ? "crosshair" : "";
    if (paint) {
      stage.controls.autoRotate = false;
      $("#orbit").classList.remove("active");
      toast("Click the land to make a 2 m clearing.");
    }
  };
  let pointerStart = null;
  $("#scene").addEventListener("pointerdown", (e) => {
    pointerStart = [e.clientX, e.clientY];
  });
  $("#scene").addEventListener("pointerup", (e) => {
    if (
      !paint ||
      mode !== "biome" ||
      !pointerStart ||
      Math.hypot(e.clientX - pointerStart[0], e.clientY - pointerStart[1]) > 5
    )
      return;
    if (biome.clearings.length >= 64) {
      toast("The workbench supports up to 64 clearings.");
      return;
    }
    const rect = $("#scene").getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      stage.camera,
    );
    const hit = ray.intersectObject(active.ground)[0];
    if (hit) {
      biome.clearings.push({
        type: "circle",
        x: hit.point.x,
        z: hit.point.z,
        radius: 2,
      });
      active.rebuild();
      controls();
    }
  });
  $("#fullscreen").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if ($(".viewport").requestFullscreen)
        await $(".viewport").requestFullscreen();
      else toast("Fullscreen is not available in this browser.");
    } catch {
      toast("Fullscreen is unavailable in this browser.");
    }
  };
  $("#capture").onclick = () => {
    $("#scene").toBlob((blob) => {
      if (blob) {
        download(blob, `cranberry-forge-${mode}-${Date.now()}.png`);
        toast("Scene image saved.");
      } else toast("Could not capture this scene.");
    }, "image/png");
  };
  $("#open-docs").onclick = showGuide;
  $("#read-tutorial").onclick = showGuide;
  $("#close-docs").onclick = () => $("#docs-dialog").close();
  $("#docs-dialog").addEventListener("click", (e) => {
    if (e.target === $("#docs-dialog")) {
      const r = e.target.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        e.target.close();
    }
  });
  $("#copy-code").onclick = async () => {
    try {
      await navigator.clipboard.writeText(integrationCode(mode));
      toast("Integration code copied.");
    } catch {
      toast("Clipboard unavailable. Select and copy the example instead.");
    }
  };
  $("#export").onclick = () => {
    if (mode === "biome")
      saveJSON(
        {
          schema: "cranberry-forge.biome-lab/1",
          settings: biome,
          asset: customAsset ? "custom" : "builtin",
          placement: active.result,
        },
        `biome-${biome.preset}-${biome.seed}.json`,
      );
    else
      saveJSON(
        {
          schema: "cranberry-forge.flux-lab/1",
          settings: flux,
          trails: active.trails.map((t) => t.toRecipe()),
        },
        `flux-${flux.preset}.json`,
      );
    toast("Recipe exported. Reopen it with “Load recipe”.");
  };
  $("#export-glb").onclick = async () => {
    if (mode === "flux") {
      saveJSON(active.trails[0].toRecipe(), `flux-${flux.preset}-trail.json`);
      toast("Standalone Trail.fromRecipe() preset exported.");
      return;
    }
    const button = $("#export-glb");
    button.disabled = true;
    const scene = createBiomeExport(active.group);
    try {
      const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
      download(
        new Blob([glb], { type: "model/gltf-binary" }),
        `biome-${biome.seed}.glb`,
      );
      toast("GLB saved with native instancing.");
    } catch (e) {
      toast(`Export failed: ${e.message}`);
    } finally {
      button.disabled = false;
      scene.clear();
    }
  };
  $("#import-recipe").onclick = () => $("#recipe-file").click();
  $("#recipe-file").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 4 * 1024 * 1024)
        throw new Error("Recipe must be smaller than 4 MB.");
      const data = JSON.parse(await file.text()),
        loaded = validateRecipe(data);
      if (loaded.mode === "flux") {
        delete flux.color;
        delete flux.tailColor;
      }
      Object.assign(loaded.mode === "biome" ? biome : flux, loaded.settings);
      switchTool(loaded.mode);
      toast(
        data.asset === "custom"
          ? "Settings restored. Import the same GLB to restore the custom asset."
          : "Recipe restored.",
      );
    } catch (error) {
      toast(error.message);
    }
  };
  $("#asset-file").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || mode !== "biome") return;
    const current = active;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Please use a GLB smaller than 20 MB.");
      toast("Reading your model…");
      const result = await current.importGLB(await file.arrayBuffer());
      if (active !== current) return;
      customAsset = true;
      controls();
      toast(
        `Imported ${result.parts} mesh parts. Budget: ${result.count} instances.`,
      );
    } catch (error) {
      toast(error.message);
    }
  };
  setInterval(() => {
    if (!stage || document.hidden) return;
    $("#metric-draws").textContent =
      stage.renderer.info.render.calls.toLocaleString();
    $("#metric-triangles").textContent =
      stage.renderer.info.render.triangles.toLocaleString();
    if (mode === "flux")
      $("#metric-count").textContent = active.trails
        .reduce((n, t) => n + t.sampleCount, 0)
        .toLocaleString();
  }, 500);
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) stage.dispose();
  });
}
init().catch((error) => {
  $("#loading").hidden = true;
  $("#error").textContent =
    `The 3D workbench could not start: ${error.message}. A browser with WebGL2 is required. You can still read the source and tutorials on GitHub.`;
  $("#error").hidden = false;
  console.error(error);
});
