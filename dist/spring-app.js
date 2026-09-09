import * as THREE from "three";
import { createStage } from "./scene.js";
import { createSpringScene, SPRING_TOYS } from "./spring-scene.js";

const $ = (query) => document.querySelector(query);
const abort = new AbortController(),
  listen = { signal: abort.signal };
const preference = matchMedia("(prefers-reduced-motion: reduce)");
let stage,
  world,
  paused = false,
  calm = preference.matches,
  disposed = false,
  history = [],
  lastTrace = -1,
  down = null;
function say(message) {
  $("#status").textContent = message;
}
function trace(force = false) {
  const sample = world.sample();
  if (!force && sample.time - lastTrace < 1 / 24) return;
  lastTrace = sample.time;
  if (!history.length || history.at(-1).time !== sample.time)
    history.push(sample);
  else history[history.length - 1] = sample;
  history = history.filter((p) => p.time >= sample.time - 5).slice(-350);
  let extent = Math.max(2, Math.abs(sample.target) + 0.3);
  for (const point of history)
    for (const value of point.values)
      extent = Math.max(extent, Math.abs(value) * 1.15);
  const y = (value) => 75 - (value / extent) * 62;
  for (let index = 0; index < 3; index++) {
    const path = history
      .map(
        (point, i) =>
          `${i ? "L" : "M"}${(900 - ((sample.time - point.time) / 5) * 900).toFixed(2)},${y(point.values[index]).toFixed(2)}`,
      )
      .join(" ");
    $(`#trace-${index}`).setAttribute("d", path);
  }
  $("#trace-target").setAttribute("d", `M0 ${y(sample.target)}H900`);
  $("#positions").textContent = sample.values
    .map((v) => v.toFixed(3))
    .join(" / ");
  $("#velocities").textContent = sample.velocities
    .map((v) => v.toFixed(3))
    .join(" / ");
  $("#trace-scale").textContent =
    `±${extent.toFixed(1)} units · last 5 seconds`;
}
function clearTrace() {
  history = [];
  lastTrace = -1;
  trace(true);
}
function parameters() {
  const frequency = Number($("#frequency").value),
    dampingRatio = Number($("#damping").value);
  world.setParameters({ frequency, dampingRatio });
  $("#frequency-value").value = `${frequency.toFixed(2)} Hz`;
  $("#damping-value").value = dampingRatio.toFixed(2);
  $("#mochi-ratio").textContent = `ζ ${dampingRatio.toFixed(2)}`;
  $("#mochi-regime").textContent =
    dampingRatio === 0
      ? "The wiggle keeps going."
      : dampingRatio < 1
        ? "A little extra wiggle."
        : dampingRatio === 1
          ? "Balanced, from rest to rest."
          : "Taking the softer route.";
  document
    .querySelectorAll("[data-damping]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(Math.abs(Number(button.dataset.damping) - dampingRatio) < 0.001),
      ),
    );
}
function setPause(value) {
  paused = value;
  $("#pause").textContent = paused ? "▷ Resume" : "Ⅱ Pause";
  $("#pause").setAttribute("aria-pressed", String(paused));
  $("#nudge").disabled = paused || calm;
  say(
    paused
      ? "Motion paused. Resume when you’re ready."
      : calm
        ? "Calm motion: targets snap into place."
        : "Ready for another experiment.",
  );
}
function setCalm(value) {
  calm = value;
  world.setReducedMotion(calm);
  $("#calm").checked = calm;
  $("#nudge").disabled = paused || calm;
  clearTrace();
  say(
    calm
      ? "Calm motion: targets snap; impulses are off."
      : "Spring motion is on.",
  );
}
function nudge(index = null) {
  if (paused || calm) return;
  world.kick(Number($("#impulse").value), index);
  say(
    index === null
      ? "Same impulse, three responses. Watch the trace."
      : `${SPRING_TOYS[index].name} says hello. The other springs keep their motion.`,
  );
  trace(true);
}
try {
  stage = createStage($("#spring-canvas"));
  world = createSpringScene(stage, { reducedMotion: calm });
  stage.controls.target.copy(world.cameraTarget);
  stage.controls.autoRotate = false;
  stage.controls.minDistance = 13;
  stage.controls.maxDistance = 65;
  stage.controls.maxPolarAngle = Math.PI * 0.46;
  function fit() {
    const { width, height } = $("#viewport").getBoundingClientRect();
    const aspect = width / Math.max(1, height),
      scale = Math.max(1, 1.35 / aspect);
    stage.camera.position.copy(world.cameraPosition).multiplyScalar(scale);
    stage.controls.target.copy(world.cameraTarget);
    stage.controls.update();
  }
  fit();
  const observer = new ResizeObserver(fit);
  observer.observe($("#viewport"));
  stage.setActive({
    update(dt) {
      if (disposed) return;
      if (!paused) world.update(dt);
      trace();
    },
    dispose() {
      observer.disconnect();
      world.dispose();
    },
  });
  $("#frequency").addEventListener("input", parameters, listen);
  $("#damping").addEventListener("input", parameters, listen);
  $("#impulse").addEventListener(
    "input",
    () => {
      $("#impulse-value").value = Number($("#impulse").value).toFixed(1);
    },
    listen,
  );
  document.querySelectorAll("[data-damping]").forEach((button) =>
    button.addEventListener(
      "click",
      () => {
        $("#damping").value = button.dataset.damping;
        parameters();
        say(
          "Mochi’s damping changed. Its position and velocity stay continuous.",
        );
      },
      listen,
    ),
  );
  $("#nudge").addEventListener("click", () => nudge(), listen);
  $("#pause").addEventListener("click", () => setPause(!paused), listen);
  $("#reset").addEventListener(
    "click",
    () => {
      world.reset();
      clearTrace();
      $("#target").setAttribute("aria-pressed", "false");
      $("#target").textContent = "Raise the target ↑";
      say("All motion and targets reset. Your tuning stays.");
    },
    listen,
  );
  $("#target").addEventListener(
    "click",
    () => {
      const raised = world.sample().target === 0;
      world.setTarget(raised ? 1 : 0);
      $("#target").setAttribute("aria-pressed", String(raised));
      $("#target").textContent = raised
        ? "Lower the target ↓"
        : "Raise the target ↑";
      trace(true);
      say(
        calm
          ? "Targets snapped into place."
          : "Target changed. The springs keep their momentum.",
      );
    },
    listen,
  );
  $("#calm").addEventListener(
    "change",
    () => setCalm($("#calm").checked),
    listen,
  );
  preference.addEventListener(
    "change",
    (event) => setCalm(event.matches),
    listen,
  );
  const canvas = $("#spring-canvas");
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button === 0)
        down = { x: event.clientX, y: event.clientY, id: event.pointerId };
    },
    listen,
  );
  canvas.addEventListener(
    "pointercancel",
    () => {
      down = null;
    },
    listen,
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      const start = down;
      down = null;
      if (
        !start ||
        start.id !== event.pointerId ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5
      )
        return;
      const rect = canvas.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        stage.camera,
      );
      world.root.updateWorldMatrix(true, true);
      let hit = ray.intersectObjects(world.pickables, true)[0]?.object;
      while (hit && hit.userData.springIndex === undefined) hit = hit.parent;
      if (hit) nudge(hit.userData.springIndex);
    },
    listen,
  );
  canvas.addEventListener(
    "keydown",
    (event) => {
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        nudge();
      }
      if (event.code === "KeyP" && !event.repeat) {
        event.preventDefault();
        setPause(!paused);
      }
    },
    listen,
  );
  $("#copy-code").addEventListener(
    "click",
    async () => {
      try {
        await navigator.clipboard.writeText($("#integration-code").textContent);
        $("#copy-code").textContent = "Copied";
      } catch {
        say("Select the example code to copy it.");
      }
    },
    listen,
  );
  addEventListener(
    "blur",
    () => {
      down = null;
    },
    listen,
  );
  addEventListener(
    "pagehide",
    (event) => {
      down = null;
      if (event.persisted) return;
      disposed = true;
      abort.abort();
      stage.dispose();
    },
    listen,
  );
  parameters();
  setCalm(calm);
  if (!calm) world.kick(10);
  clearTrace();
} catch (error) {
  disposed = true;
  abort.abort();
  stage?.dispose();
  $("#error").textContent =
    `Jellyworks could not start: ${error.message}. The Spring package and documentation are still available below.`;
  $("#error").hidden = false;
  console.error(error);
}
