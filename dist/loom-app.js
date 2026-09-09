import * as THREE from "three";
import { Loom } from "@cranberry-forge/loom";
import { createStage } from "./scene.js";
import { createLoomScene, LOOM_PRESETS } from "./loom-scene.js";

const $ = (selector) => document.querySelector(selector);
let stage, world, fitObserver;
try {
  stage = createStage($("#scene"));
  world = createLoomScene();
  stage.scene.add(world.group);
  stage.scene.background = new THREE.Color("#233e46");
  stage.scene.fog = new THREE.FogExp2("#233e46", 0.011);
  stage.camera.position.copy(world.cameraPosition);
  stage.controls.target.copy(world.cameraTarget);
  stage.controls.minDistance = 17;
  stage.controls.maxDistance = 72;
  stage.controls.autoRotate = false;
  stage.controls.update();
  stage.bloom.strength = 0.18;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let playing = !motion.matches,
    manualPlay = false,
    preset = "skyloop",
    revision = 0;
  const bankProfile = (degrees) => {
    const value = (degrees * Math.PI) / 180;
    return [
      { at: 0, value: 0 },
      { at: 0.25, value },
      { at: 0.5, value: 0 },
      { at: 0.75, value: -value },
      { at: 1, value: 0 },
    ];
  };
  const widthProfile = (width) =>
    $("#variable-width").checked
      ? [
          { at: 0, value: width },
          { at: 0.25, value: width * 0.85 },
          { at: 0.5, value: width * 1.2 },
          { at: 0.75, value: width * 0.85 },
          { at: 1, value: width },
        ]
      : width;
  function status(message, error = false) {
    $("#status").textContent = message;
    $("#status").dataset.error = String(error);
  }
  function syncStats() {
    const options = world.loom.options;
    $("#metric-length").textContent = world.loom.length.toFixed(1);
    $("#metric-segments").textContent = options.segments;
    $("#metric-vertices").textContent = world.loom.surface.geometry
      .getAttribute("position")
      .count.toLocaleString();
    $("#route-kind").textContent =
      `${options.closed ? "LOOP" : "SHUTTLE"} SERVICE · ${options.points.length} WAYPOINTS`;
    $("#width-value").textContent =
      typeof options.width === "number"
        ? `${options.width.toFixed(2)} m`
        : "width profile";
    $("#bank-value").textContent =
      typeof options.bank === "number"
        ? `${Math.round((options.bank * 180) / Math.PI)}°`
        : `${Math.round((Math.max(...options.bank.map((key) => Math.abs(key.value))) * 180) / Math.PI)}° profile`;
    $("#segments-value").textContent = options.segments;
    $("#speed-value").textContent =
      `${Number($("#speed").value).toFixed(1)} m/s`;
    $("#play-toggle").textContent = playing ? "Pause train Ⅱ" : "Run train ▷";
    $("#play-toggle").setAttribute("aria-pressed", String(playing));
  }
  function apply(patch) {
    try {
      world.configure(patch);
      syncStats();
      status(
        `Route updated · ${world.loom.length.toFixed(1)} metres ready to travel.`,
      );
    } catch (error) {
      status(error.message, true);
    }
  }
  $("#width").addEventListener("input", () =>
    apply({ width: widthProfile(Number($("#width").value)) }),
  );
  $("#variable-width").addEventListener("change", () =>
    apply({ width: widthProfile(Number($("#width").value)) }),
  );
  $("#bank").addEventListener("input", () =>
    apply({ bank: bankProfile(Number($("#bank").value)) }),
  );
  $("#segments").addEventListener("input", () =>
    apply({ segments: Number($("#segments").value) }),
  );
  $("#rails").addEventListener("change", () =>
    apply({
      borderWidth: $("#rails").checked ? 0.085 : 0,
      borderHeight: $("#rails").checked ? 0.11 : 0,
    }),
  );
  $("#speed").addEventListener("input", syncStats);
  document.querySelectorAll("[data-preset]").forEach((button) =>
    button.addEventListener("click", () => {
      const id = button.dataset.preset,
        p = LOOM_PRESETS[id];
      try {
        world.configure({
          points: p.points,
          closed: p.closed,
          width: widthProfile(Number($("#width").value)),
          bank: bankProfile(Number($("#bank").value)),
        });
        preset = id;
        revision++;
        document.querySelectorAll("[data-preset]").forEach((item) => {
          item.classList.toggle("selected", item === button);
          item.setAttribute("aria-pressed", String(item === button));
        });
        $("#route-name").textContent = p.name;
        $("#scene-subtitle").textContent = p.subtitle;
        syncStats();
        status(`${p.name} is ready for departure.`);
      } catch (error) {
        status(error.message, true);
      }
    }),
  );
  $("#play-toggle").addEventListener("click", () => {
    playing = !playing;
    manualPlay = playing;
    syncStats();
    status(
      playing
        ? "The train is running."
        : "Train paused. You can still shape the route.",
    );
  });
  motion.addEventListener("change", () => {
    if (motion.matches) {
      playing = false;
      manualPlay = false;
    }
    syncStats();
  });
  function fitRoute() {
    const { width, height } = $("#viewport").getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    stage.camera.aspect = width / height;
    world.loom.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(world.loom),
      center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(
      8,
      bounds.getSize(new THREE.Vector3()).length() / 2,
    );
    const verticalHalfFov = THREE.MathUtils.degToRad(stage.camera.fov / 2);
    const horizontalHalfFov = Math.atan(
      Math.tan(verticalHalfFov) * stage.camera.aspect,
    );
    const halfFov = Math.max(
      0.005,
      Math.min(verticalHalfFov, horizontalHalfFov),
    );
    const distance = Math.min(1e9, (radius / Math.sin(halfFov)) * 1.14);
    stage.controls.target.copy(center);
    stage.camera.position
      .copy(center)
      .add(
        new THREE.Vector3(0.64, 0.61, 0.74)
          .normalize()
          .multiplyScalar(distance),
      );
    stage.controls.minDistance = radius * 0.7;
    stage.controls.maxDistance = Math.min(3e9, distance * 3);
    stage.camera.near = Math.max(0.1, distance / 1e5);
    stage.camera.far = Math.min(1e10, Math.max(350, distance * 5 + radius * 2));
    stage.camera.updateProjectionMatrix();
    stage.controls.update();
  }
  fitObserver = new ResizeObserver(fitRoute);
  fitObserver.observe($("#viewport"));
  fitRoute();
  $("#frame-route").addEventListener("click", () => {
    fitRoute();
    status("View centered on your route.");
  });
  $("#export-recipe").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(world.loom.toRecipe(), null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `loom-${preset || "custom"}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("Recipe exported. Import it in any Loom project.");
  });
  $("#import-recipe").addEventListener("click", () =>
    $("#recipe-file").click(),
  );
  $("#recipe-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const request = ++revision;
    let imported;
    try {
      if (file.size > 256 * 1024)
        throw new RangeError("Choose a recipe smaller than 256 KB.");
      const text = await file.text();
      if (request !== revision) return;
      imported = Loom.fromRecipe(text);
      world.configure(imported.options);
      preset = null;
      const options = world.loom.options;
      $("#width").value =
        typeof options.width === "number"
          ? options.width
          : options.width[0].value;
      $("#bank").value =
        typeof options.bank === "number"
          ? (options.bank * 180) / Math.PI
          : (Math.max(...options.bank.map((key) => Math.abs(key.value))) *
              180) /
            Math.PI;
      $("#segments").value = options.segments;
      $("#variable-width").checked = typeof options.width !== "number";
      $("#rails").checked = options.borderWidth > 0 && options.borderHeight > 0;
      document.querySelectorAll("[data-preset]").forEach((button) => {
        button.classList.remove("selected");
        button.setAttribute("aria-pressed", "false");
      });
      $("#route-name").textContent = "Your cloudline";
      $("#scene-subtitle").textContent = "A route of your own making.";
      syncStats();
      status(
        "Recipe imported. Use Frame route if it is outside the current view.",
      );
    } catch (error) {
      if (request === revision) status(`Import failed: ${error.message}`, true);
    } finally {
      imported?.dispose();
    }
  });
  stage.setActive({
    update(dt) {
      world.update(dt, {
        playing,
        speed: Number($("#speed").value),
        reducedMotion: motion.matches && !manualPlay,
      });
    },
    dispose() {
      fitObserver.disconnect();
      world.dispose();
    },
  });
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) {
      revision++;
      stage.dispose();
    }
  });
  syncStats();
  if (motion.matches)
    status("Reduced motion: train paused. Press Run train to start it.");
  $("#loading").hidden = true;
} catch (error) {
  fitObserver?.disconnect();
  try {
    stage?.dispose();
  } catch {
    /* Continue releasing independent scene resources. */
  }
  try {
    world?.dispose();
  } catch {
    /* Preserve the original startup error for the user. */
  }
  $("#loading").hidden = true;
  $("#error").hidden = false;
  $("#error").textContent =
    `The workshop could not start: ${error.message}. The package and tutorial are available below.`;
}
