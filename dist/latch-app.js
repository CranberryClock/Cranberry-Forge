import * as THREE from "three";
import { Latch } from "@cranberry-forge/latch";
import { createStage } from "./scene.js";
import { createLatchScene } from "./latch-scene.js";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#scene");

try {
  const stage = createStage(canvas);
  const world = createLatchScene();
  stage.scene.add(world.group);
  stage.scene.background = new THREE.Color("#102632");
  stage.scene.fog = new THREE.FogExp2("#102632", 0.012);
  stage.camera.position.copy(world.cameraPosition);
  stage.controls.target.copy(world.cameraTarget);
  stage.controls.minDistance = 17;
  stage.controls.maxDistance = 37;
  stage.controls.autoRotate = false;
  stage.controls.maxPolarAngle = Math.PI * 0.47;
  stage.controls.update();
  stage.bloom.strength = 0.27;

  let latch,
    state,
    latest,
    autoAim = "fuse",
    destination = null,
    paused = false,
    elapsed = 0;
  const down = new Set(),
    keys = new Set();
  const pointer = new THREE.Vector2();
  const aimCaster = new THREE.Raycaster();
  const aimRay = new THREE.Ray();
  const actorPosition = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const names = {
    fuse: "aether fuse",
    crank: "meridian crank",
    beacon: "dawn beacon",
  };
  const log = [];

  function createController() {
    state = { hasFuse: false, charged: false, lit: false };
    latch = new Latch({ reach: 3.1, focusTolerance: 0.025 });
    latch.register({
      id: "fuse",
      root: world.targets.fuse,
      label: "Take the aether fuse",
    });
    latch.register({
      id: "crank",
      root: world.targets.crank,
      label: "Wind the meridian crank",
      mode: "hold",
      holdDuration: 1.8,
      condition: ({ context }) =>
        context.charged
          ? "The mechanism is fully wound"
          : context.hasFuse || "Find the aether fuse first",
    });
    latch.register({
      id: "beacon",
      root: world.targets.beacon,
      label: "Ignite the dawn beacon",
      condition: ({ context }) =>
        context.lit
          ? "The meridian is restored"
          : context.charged || "Wind the meridian crank first",
    });
    latch.setOccluders(world.occluders);
    latest = null;
  }

  function chooseStation(id) {
    autoAim = id;
    destination = world.stations[id].clone();
    document.querySelectorAll(".station").forEach((button) => {
      const selected = button.dataset.station === id;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function recordEvents(events) {
    for (const event of events) {
      log.unshift({
        type: event.type,
        id: event.target.id,
        reason: "reason" in event ? event.reason : null,
      });
      if (event.type !== "activate") continue;
      if (event.target.id === "fuse") {
        state.hasFuse = true;
        latch.remove("fuse");
      }
      if (event.target.id === "crank") state.charged = true;
      if (event.target.id === "beacon") state.lit = true;
      syncMission();
    }
    if (!events.length) return;
    log.splice(4);
    $("#event-log").replaceChildren(
      ...log.map((event) => {
        const item = document.createElement("li"),
          type = document.createElement("b"),
          target = document.createElement("span");
        type.textContent = event.type;
        target.textContent = `${event.id}${event.reason ? ` · ${event.reason}` : ""}`;
        item.append(type, target);
        return item;
      }),
    );
  }

  function syncMission() {
    const count =
      Number(state.hasFuse) + Number(state.charged) + Number(state.lit);
    $("#mission-count").textContent = `${count} / 3`;
    $("#fuse-check").textContent = state.hasFuse ? "✓" : "↗";
    $("#crank-check").textContent = state.charged ? "✓" : "↗";
    $("#beacon-check").textContent = state.lit ? "✓" : "↗";
    $("#objective-title").textContent = state.lit
      ? "A new dawn begins."
      : "Bring back the light.";
    $("#objective-copy").textContent = state.lit
      ? "The beacon is burning. The keeper’s work is done. Restart to try a different route."
      : state.charged
        ? "The mechanism is charged. Walk to the dawn beacon and ignite it."
        : state.hasFuse
          ? "Fuse collected. Walk to the meridian crank and hold the key to wind it."
          : "Collect the aether fuse, wind the meridian crank, then wake the dawn beacon.";
  }

  function renderPrompt(result) {
    const focused = result.focus;
    let label =
      focused?.label ||
      (destination
        ? "Walking to the station…"
        : "Aim at something within reach");
    let reason = focused
      ? focused.available
        ? focused.mode === "hold"
          ? "Hold E or the gold key for 1.8 seconds."
          : "Press E or tap the gold key to interact."
        : focused.reason
      : "Choose a station, or walk closer with WASD.";
    if (state.hasFuse && autoAim === "fuse" && !focused) {
      label = "Aether fuse collected";
      reason = "Choose the meridian crank to continue.";
    }
    if (result.requiresRelease && focused?.available)
      reason = "Release the key before starting another action.";
    if (result.holding)
      reason = `Winding the mechanism · ${Math.round(result.progress * 100)}%`;
    if (paused || document.hidden) {
      label = "The observatory is paused";
      reason = "Resume, then press the key again to interact.";
    }
    $("#prompt-label").textContent = label;
    $("#prompt-reason").textContent = reason;
    $("#prompt").dataset.available = String(Boolean(focused?.available));
    $("#hold-progress").style.width = `${result.progress * 100}%`;
    $("#hold-track").setAttribute(
      "aria-valuenow",
      String(Math.round(result.progress * 100)),
    );
    $("#focus-metric").textContent = focused ? names[focused.id] : "none";
    $("#reach-metric").textContent = focused
      ? `${focused.distance.toFixed(2)} m`
      : "—";
    $("#mode-metric").textContent = focused?.mode || "—";
  }

  function advance(dt, suspended = paused || document.hidden) {
    actorPosition.copy(world.actor.position).y += 0.85;
    if (autoAim) {
      aimRay.origin.copy(stage.camera.position);
      aimRay.direction
        .subVectors(world.aimPoints[autoAim], stage.camera.position)
        .normalize();
    } else {
      aimCaster.setFromCamera(pointer, stage.camera);
      aimRay.copy(aimCaster.ray);
    }
    latest = latch.update({
      dt,
      aimRay,
      actorPosition,
      camera: stage.camera,
      pressed: down.size > 0,
      suspended,
      context: state,
    });
    recordEvents(latest.events);
    renderPrompt(latest);
    return latest;
  }

  createController();
  syncMission();
  advance(0);
  stage.setActive({
    update(dt, time) {
      elapsed = time;
      if (!paused) {
        movement.set(
          Number(keys.has("d") || keys.has("arrowright")) -
            Number(keys.has("a") || keys.has("arrowleft")),
          0,
          Number(keys.has("s") || keys.has("arrowdown")) -
            Number(keys.has("w") || keys.has("arrowup")),
        );
        if (movement.lengthSq()) {
          destination = null;
          movement.normalize().multiplyScalar(dt * 3.0);
        } else if (destination) {
          movement.subVectors(destination, world.actor.position);
          const distance = movement.length();
          if (distance < 0.02) destination = null;
          movement.normalize().multiplyScalar(Math.min(distance, dt * 3.0));
        }
        world.actor.position.add(movement);
        if (Math.hypot(world.actor.position.x, world.actor.position.z) > 6.1)
          world.actor.position.setLength(6.1);
        if (movement.lengthSq())
          world.actor.rotation.y = Math.atan2(movement.x, movement.z);
      }
      world.update({
        time,
        dt: paused ? 0 : dt,
        ...state,
        focus: latest?.focus?.id,
        holding: latest?.holding && !paused,
        shutterRaised: $("#shutter").checked,
        reducedMotion: reducedMotion.matches || paused,
      });
      advance(dt);
      world.update({
        time,
        ...state,
        focus: latest.focus?.id,
        holding: latest.holding,
        shutterRaised: $("#shutter").checked,
        reducedMotion: reducedMotion.matches || paused,
      });
    },
    dispose() {
      latch.clear();
      world.dispose();
    },
  });

  document
    .querySelectorAll(".station")
    .forEach((button) =>
      button.addEventListener("click", () =>
        chooseStation(button.dataset.station),
      ),
    );
  function aimAtPointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    autoAim = null;
    document.querySelectorAll(".station").forEach((button) => {
      button.classList.remove("selected");
      button.setAttribute("aria-pressed", "false");
    });
  }
  canvas.addEventListener("pointermove", aimAtPointer);
  canvas.addEventListener("pointerdown", aimAtPointer);
  const interact = $("#interact");
  interact.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    interact.setPointerCapture(event.pointerId);
    down.add(`pointer-${event.pointerId}`);
    advance(0);
  });
  const releasePointer = (event) => {
    if (down.delete(`pointer-${event.pointerId}`)) advance(0);
  };
  interact.addEventListener("pointerup", releasePointer);
  interact.addEventListener("pointercancel", releasePointer);
  interact.addEventListener("lostpointercapture", releasePointer);
  interact.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      if (!event.repeat) {
        down.add(event.code);
        advance(0);
      }
    }
  });
  interact.addEventListener("keyup", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      down.delete(event.code);
      advance(0);
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.target.matches("input,textarea,select")) return;
    const key = event.key.toLowerCase();
    if (key === "e") {
      event.preventDefault();
      if (!event.repeat) {
        down.add("e");
        advance(0);
      }
    }
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(key)
    ) {
      event.preventDefault();
      keys.add(key);
    }
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    const released = down.delete(key);
    keys.delete(key);
    const releasedCode = down.delete(event.code);
    if (released || releasedCode) advance(0);
  });
  function releaseAll() {
    down.clear();
    keys.clear();
  }
  window.addEventListener("blur", () => {
    releaseAll();
    advance(0, true);
  });
  document.addEventListener("visibilitychange", () => {
    releaseAll();
    advance(0, paused || document.hidden);
  });
  $("#pause").addEventListener("click", () => {
    paused = !paused;
    releaseAll();
    $("#pause").textContent = paused ? "Resume" : "Pause";
    $("#pause").setAttribute("aria-pressed", String(paused));
    advance(0);
  });
  $("#reset").addEventListener("click", () => {
    releaseAll();
    paused = false;
    $("#pause").textContent = "Pause";
    $("#pause").setAttribute("aria-pressed", "false");
    $("#shutter").checked = false;
    latch.clear();
    createController();
    log.length = 0;
    world.actor.position.copy(world.stations.fuse);
    world.actor.rotation.y = 0;
    chooseStation("fuse");
    world.update({ time: elapsed });
    syncMission();
    advance(0);
  });
  window.addEventListener("pagehide", (event) => {
    releaseAll();
    if (!event.persisted) stage.dispose();
  });
  $("#loading").hidden = true;
} catch (error) {
  $("#loading").hidden = true;
  $("#error").hidden = false;
  $("#error").textContent =
    `The observatory could not start. ${error.message}. You can still download Latch and read its API below.`;
}
