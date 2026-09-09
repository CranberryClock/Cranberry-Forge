import * as THREE from "three";
import { createStage } from "./lib/scene.js";
import { AfterglowGame } from "./game.js";
import { createAfterglowScene } from "./scene.js";

const $ = (query) => document.querySelector(query);
const game = new AfterglowGame();
const keys = new Set(),
  touchKeys = new Map();
const abort = new AbortController(),
  listener = { signal: abort.signal };
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const BEST_KEY = "cranberry-forge.afterglow.best.v1";
const forward = new THREE.Vector3(),
  right = new THREE.Vector3(),
  up = new THREE.Vector3(0, 1, 0);
let stage,
  world,
  dashRequested = false,
  best = 0,
  reducedMotion = motionPreference.matches;
let announcementTimer,
  helpWasPlaying = false,
  disposed = false;

function announce(text, duration = 2600) {
  clearTimeout(announcementTimer);
  $("#announcement").textContent = text;
  $("#announcement").classList.add("visible");
  announcementTimer = setTimeout(
    () => $("#announcement").classList.remove("visible"),
    duration,
  );
}
function stopInput() {
  keys.clear();
  touchKeys.clear();
  dashRequested = false;
}
function closeDialogs() {
  for (const dialog of document.querySelectorAll("dialog"))
    if (dialog.open) dialog.close();
}
function focusGame() {
  $("#game-canvas").focus({ preventScroll: true });
}
function updateHud(view) {
  const health = $("#health");
  if (health.dataset.health !== String(view.health)) {
    health.dataset.health = String(view.health);
    health.replaceChildren();
    for (let i = 0; i < game.options.health; i++) {
      const charge = document.createElement("i");
      if (i >= view.health) charge.className = "empty";
      health.append(charge);
    }
    health.setAttribute(
      "aria-label",
      `${view.health} of ${game.options.health} light remaining`,
    );
  }
  $("#round-name").textContent =
    ["THE FIRST LIGHT", "THE LONG SHADOW", "THE LAST SUNRISE"][
      view.round - 1
    ] || `ROUND ${view.round}`;
  $("#timer").firstChild.textContent = Math.max(
    0,
    Math.ceil(view.duration - view.time),
  );
  $("#score").textContent = String(view.score).padStart(4, "0");
  $("#best").textContent = best ? `PERSONAL BEST ${best}` : "PERSONAL BEST —";
  $("#round-dots").setAttribute(
    "aria-label",
    `Round ${view.round} of ${game.options.rounds}`,
  );
  [...$("#round-dots").children].forEach((dot, i) =>
    dot.classList.toggle("active", i < view.round),
  );
  const ready = view.cooldown <= 0.001;
  $("#dash-button").disabled = view.phase !== "playing" || !ready;
  $("#dash-label").textContent = ready
    ? "READY"
    : `${view.cooldown.toFixed(1)}s TO READY`;
  $("#dash-fill").style.width =
    `${(1 - view.cooldown / game.options.dashCooldown) * 100}%`;
  $("#pause-button").disabled = !["playing", "paused"].includes(view.phase);
  $("#pause-button").firstChild.textContent =
    view.phase === "paused" ? "Resume " : "Pause ";
  const attackList = $("#attack-list");
  if (!view.attacks.length) {
    if (attackList.dataset.ids !== "quiet") {
      attackList.replaceChildren();
      const text = document.createElement("p");
      text.className = "quiet-note";
      text.textContent =
        view.phase === "playing"
          ? "A breath between rays. Keep moving."
          : "Every strike tells you where it will land.";
      attackList.append(text);
      attackList.dataset.ids = "quiet";
    }
  } else {
    const signature = view.attacks.map((a) => a.id).join(",");
    if (attackList.dataset.ids !== signature) {
      attackList.replaceChildren();
      for (const attack of view.attacks) {
        const row = document.createElement("div"),
          label = document.createElement("span"),
          track = document.createElement("i"),
          fill = document.createElement("b");
        row.className = "attack-row";
        label.textContent = attack.label;
        track.append(fill);
        row.append(label, track);
        attackList.append(row);
      }
      attackList.dataset.ids = signature;
    }
    view.attacks.forEach(
      (attack, i) =>
        (attackList.children[i].querySelector("b").style.width =
          `${Math.min(1, Math.max(0, (view.time - attack.armedAt) / attack.duration)) * 100}%`),
    );
  }
}
function startRun() {
  stopInput();
  closeDialogs();
  game.restart();
  game.start();
  world.setState(game.view);
  updateHud(game.view);
  focusGame();
  announce("First light. The temple is listening.");
}
function pause() {
  if (!game.pause()) return;
  stopInput();
  updateHud(game.view);
  if (!$("#help-dialog").open) $("#pause-dialog").showModal();
}
function resume() {
  if ($("#help-dialog").open) return;
  if (!game.resume()) return;
  $("#pause-dialog").close();
  stopInput();
  updateHud(game.view);
  focusGame();
}
function openHelp() {
  helpWasPlaying = game.phase === "playing";
  game.pause();
  stopInput();
  updateHud(game.view);
  if ($("#pause-dialog").open) $("#pause-dialog").close();
  $("#help-dialog").showModal();
}
function closeHelp() {
  $("#help-dialog").close();
  if (helpWasPlaying) {
    game.resume();
    stopInput();
    focusGame();
  } else if (game.phase === "paused") $("#pause-dialog").showModal();
  updateHud(game.view);
}
function finish(view) {
  stopInput();
  if (view.score > best) {
    best = view.score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      /* Best scores are optional device storage. */
    }
  }
  const won = view.phase === "won";
  $("#finish-eyebrow").textContent = won
    ? "THE TEMPLE REMEMBERS"
    : "EVEN SUNS BEGIN AGAIN";
  $("#finish-title").textContent = won
    ? "You kept the light."
    : "A little more dawn.";
  $("#finish-copy").textContent = won
    ? "Three rounds. One keeper. For another day, the temple belongs to the light."
    : "The next sunrise is yours. Watch the shapes fill, move early, and keep a dash for the last moment.";
  $("#finish-score").textContent = String(view.score).padStart(4, "0");
  $("#finish-avoided").textContent = `${view.avoided} strikes avoided`;
  $("#finish-time").textContent = `${view.time.toFixed(1)} seconds survived`;
  closeDialogs();
  $("#finish-dialog").showModal();
  updateHud(view);
}
function setMotion(value) {
  reducedMotion = value;
  world?.setReducedMotion(value);
  $("#motion-button").setAttribute("aria-pressed", String(value));
  $("#motion-button").textContent = value ? "Calm visuals on" : "Calm visuals";
}
function movement() {
  const active = new Set([...keys, ...touchKeys.values()]);
  const x =
    Number(active.has("KeyD") || active.has("ArrowRight")) -
    Number(active.has("KeyA") || active.has("ArrowLeft"));
  const y =
    Number(active.has("KeyW") || active.has("ArrowUp")) -
    Number(active.has("KeyS") || active.has("ArrowDown"));
  stage.camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, up).normalize();
  const direction = forward.clone().multiplyScalar(y).addScaledVector(right, x);
  if (direction.lengthSq() > 1) direction.normalize();
  const dash = dashRequested;
  dashRequested = false;
  return { x: direction.x, z: direction.z, dash };
}

try {
  try {
    const saved = Number(localStorage.getItem(BEST_KEY));
    if (Number.isSafeInteger(saved) && saved >= 0 && saved <= 1e9) best = saved;
  } catch {
    /* Storage is optional. */
  }
  stage = createStage($("#game-canvas"));
  world = createAfterglowScene(stage, { reducedMotion });
  stage.controls.autoRotate = false;
  stage.controls.enabled = false;
  stage.controls.target.set(0, 0.8, 0);
  function fit() {
    const scale = Math.max(1, 0.93 / stage.camera.aspect);
    stage.camera.position.set(18 * scale, 23 * scale, 25 * scale);
    stage.camera.lookAt(0, 0.8, 0);
  }
  fit();
  addEventListener("resize", fit, listener);
  stage.setActive({
    update(dt) {
      if (disposed) return;
      const events = game.step(dt, movement()),
        view = game.view;
      world.setState(view, events);
      world.update(dt);
      updateHud(view);
      for (const event of events) {
        if (event.type === "round")
          announce(
            event.round === 2
              ? "Round two. The shadow grows."
              : "Last sunrise. Hold your light.",
          );
        if (event.type === "impact" && event.damaged)
          announce("A light spent. Breathe, then move.", 1800);
        if (event.type === "impact" && event.dashed)
          announce("Through the ray. Beautiful timing.", 1500);
        if (event.type === "won" || event.type === "lost") finish(view);
      }
    },
    dispose() {
      world.dispose();
    },
  });
  world.setState(game.view);
  updateHud(game.view);
  setMotion(reducedMotion);
  $("#start-button").addEventListener("click", startRun, listener);
  $("#play-again").addEventListener("click", startRun, listener);
  $("#restart-paused").addEventListener("click", startRun, listener);
  $("#pause-button").addEventListener(
    "click",
    () => (game.phase === "playing" ? pause() : resume()),
    listener,
  );
  $("#resume-button").addEventListener("click", resume, listener);
  $("#help-button").addEventListener("click", openHelp, listener);
  $("#close-help").addEventListener("click", closeHelp, listener);
  $("#motion-button").addEventListener(
    "click",
    () => setMotion(!reducedMotion),
    listener,
  );
  $("#dash-button").addEventListener(
    "click",
    () => {
      if (game.phase === "playing") dashRequested = true;
    },
    listener,
  );
  motionPreference.addEventListener(
    "change",
    (event) => setMotion(event.matches),
    listener,
  );
  for (const id of ["intro-dialog", "finish-dialog"])
    $(`#${id}`).addEventListener(
      "cancel",
      (event) => event.preventDefault(),
      listener,
    );
  $("#pause-dialog").addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      resume();
    },
    listener,
  );
  $("#help-dialog").addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      closeHelp();
    },
    listener,
  );

  const moveCodes = [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ];
  addEventListener(
    "keydown",
    (event) => {
      if (event.target.matches?.("input,textarea,select")) return;
      if (["KeyP", "Escape"].includes(event.code) && !event.repeat) {
        if (game.phase === "playing") {
          event.preventDefault();
          pause();
        } else if (
          event.code === "KeyP" &&
          game.phase === "paused" &&
          !$("#help-dialog").open
        ) {
          event.preventDefault();
          resume();
        }
        return;
      }
      if (game.phase !== "playing") return;
      if (moveCodes.includes(event.code)) {
        event.preventDefault();
        keys.add(event.code);
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) dashRequested = true;
      }
    },
    listener,
  );
  addEventListener("keyup", (event) => keys.delete(event.code), listener);
  addEventListener(
    "blur",
    () => {
      stopInput();
      pause();
    },
    listener,
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        stopInput();
        pause();
      }
    },
    listener,
  );
  for (const button of document.querySelectorAll("[data-move]")) {
    const code = { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD" }[
      button.dataset.move
    ];
    button.addEventListener(
      "pointerdown",
      (event) => {
        event.preventDefault();
        if (game.phase !== "playing") return;
        button.setPointerCapture(event.pointerId);
        touchKeys.set(event.pointerId, code);
      },
      listener,
    );
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      button.addEventListener(
        name,
        (event) => touchKeys.delete(event.pointerId),
        listener,
      );
  }
  addEventListener(
    "pagehide",
    (event) => {
      stopInput();
      pause();
      // Preserve WebGL and listeners when the browser keeps this page in BFCache.
      if (event.persisted) return;
      disposed = true;
      clearTimeout(announcementTimer);
      abort.abort();
      stage.dispose();
    },
    listener,
  );
  $("#intro-dialog").showModal();
} catch (error) {
  console.error(error);
  disposed = true;
  clearTimeout(announcementTimer);
  abort.abort();
  stage?.dispose();
  closeDialogs();
  $("#error").textContent =
    `Afterglow could not start: ${error.message}. Use a browser with WebGL2 enabled and serve this folder over HTTP.`;
  $("#error").hidden = false;
}
