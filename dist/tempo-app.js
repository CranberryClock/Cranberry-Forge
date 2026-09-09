import { Tempo } from "@cranberry-forge/tempo";
import { createStage } from "./scene.js";
import { createTempoScene, SPELLS } from "./tempo-scene.js";

const $ = (query) => document.querySelector(query);
const abort = new AbortController(),
  listener = { signal: abort.signal };
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
let stage,
  world,
  tempo,
  paused = false,
  timeScale = 1,
  reducedMotion = motionPreference.matches;
let casts = 0,
  disposed = false,
  traceClock = -1;
const eventLog = [];
function definitions(scale = 1, bloomBypass = false) {
  return SPELLS.map(({ id, charges, recharge, cooldown }) => ({
    id,
    charges,
    recharge: recharge * scale,
    cooldown,
    usesGlobalCooldown: !(id === "bloom" && bloomBypass),
  }));
}
function say(message) {
  $("#cast-message").textContent = message;
}
function record(events) {
  for (const event of events) {
    eventLog.unshift(event);
    if (eventLog.length > 6) eventLog.length = 6;
  }
  if (!events.length) return;
  $("#event-trace").replaceChildren(
    ...eventLog.map((event) => {
      const row = document.createElement("li"),
        type = document.createElement("b"),
        details = document.createElement("span");
      type.textContent = event.type;
      details.textContent = ` · ${event.id || "all"} · ${event.at.toFixed(2)}s${Object.hasOwn(event, "charges") ? ` · ${event.charges} charge(s)` : ""}`;
      row.append(type, details);
      return row;
    }),
  );
}
function sync(state = tempo.state, forceTrace = false) {
  $("#sim-time").firstChild.textContent = state.time.toFixed(2);
  $("#cast-count").textContent = String(casts).padStart(2, "0");
  $("#global-status").textContent =
    state.globalRemaining > 0
      ? `${state.globalRemaining.toFixed(2)}s`
      : "Ready";
  $("#global-fill").style.width = `${state.globalProgress * 100}%`;
  for (const ability of state.abilities) {
    const button = $(`[data-cast="${ability.id}"]`);
    if (!button) continue;
    const definition = tempo.definitions.find(
      (entry) => entry.id === ability.id,
    );
    const longest = Math.max(
      definition.recharge,
      definition.cooldown,
      definition.usesGlobalCooldown ? tempo.globalCooldown : 0,
    );
    button.style.setProperty(
      "--progress",
      String(ability.ready ? 1 : Math.max(0, 1 - ability.retryAfter / longest)),
    );
    button.setAttribute("aria-disabled", String(paused || !ability.ready));
    const chargeRow = button.querySelector(".spell-charges");
    if (
      chargeRow.dataset.count !== `${ability.charges}/${ability.maxCharges}`
    ) {
      chargeRow.dataset.count = `${ability.charges}/${ability.maxCharges}`;
      chargeRow.replaceChildren(
        ...Array.from({ length: ability.maxCharges }, (_, index) => {
          const crystal = document.createElement("i");
          if (index >= ability.charges) crystal.className = "empty";
          return crystal;
        }),
      );
    }
    const status = paused
      ? "paused"
      : ability.ready
        ? "ready"
        : `${ability.retryAfter.toFixed(1)}s until ready`;
    button.querySelector(".spell-ready").textContent =
      `${ability.charges} / ${ability.maxCharges} · ${status}`;
    button.querySelector(".spell-track i").style.width =
      `${ability.rechargeProgress * 100}%`;
    button.querySelector(".spell-recharge").textContent =
      ability.charges === ability.maxCharges
        ? "Fully charged"
        : `Next crystal in ${ability.rechargeRemaining.toFixed(1)}s`;
    const spell = SPELLS.find((entry) => entry.id === ability.id);
    button.setAttribute(
      "aria-label",
      `${spell.name}, key ${spell.key}. ${ability.charges} of ${ability.maxCharges} charges, ${status}`,
    );
  }
  if (forceTrace || state.time - traceClock > 0.15 || state.time < traceClock) {
    $("#state-trace").textContent = JSON.stringify(
      {
        time: Number(state.time.toFixed(3)),
        globalRemaining: Number(state.globalRemaining.toFixed(3)),
        abilities: state.abilities.map(
          ({
            id,
            charges,
            rechargeRemaining,
            cooldownRemaining,
            ready,
            reason,
          }) => ({
            id,
            charges,
            rechargeRemaining: Number(rechargeRemaining.toFixed(3)),
            cooldownRemaining: Number(cooldownRemaining.toFixed(3)),
            ready,
            reason,
          }),
        ),
      },
      null,
      2,
    );
    traceClock = state.time;
  }
  world.setState(state);
}
function setPaused(value) {
  paused = value;
  $("#pause").textContent = value ? "Resume clock" : "Pause clock";
  $("#pause").setAttribute("aria-pressed", String(value));
  $("#garden-status").textContent = value
    ? "PRACTICE CLOCK PAUSED"
    : "PRACTICE CLOCK RUNNING";
  $("#garden-status-dot").style.background = value ? "#e2bd9a" : "#a8d7c5";
  sync(tempo.state, true);
}
function cast(id) {
  if (paused) {
    say("The garden is paused. Resume its clock to cast again.");
    return;
  }
  const result = tempo.tryUse(id);
  if (result.ok) {
    casts++;
    world.cast(id);
    record(result.events);
    const name = SPELLS.find((spell) => spell.id === id).name;
    say(
      `${name} cast. ${result.state.charges} crystal${result.state.charges === 1 ? "" : "s"} in reserve.`,
    );
  } else {
    const reason = {
      "global-cooldown": "The shared clock is still settling",
      cooldown: "This spell needs a breath",
      "no-charges": "This spell is out of crystals",
    }[result.reason];
    say(`${reason}. Ready in ${result.retryAfter.toFixed(2)}s.`);
    record([{ type: "blocked", id, at: tempo.time }]);
  }
  sync(tempo.state, true);
}
function reset() {
  tempo.reset();
  world.reset();
  casts = 0;
  traceClock = -1;
  eventLog.length = 0;
  $("#event-trace").replaceChildren();
  setPaused(false);
  say("Every crystal is back. Press 1, 2, or 3 to begin again.");
}
function applyRecipe() {
  tempo = new Tempo(
    definitions(Number($("#recharge-scale").value), $("#bloom-bypass").checked),
    { globalCooldown: Number($("#global-duration").value) },
  );
  reset();
  say("A new rhythm. Charges refilled and the clock restarted.");
}
function setMotion(value) {
  reducedMotion = value;
  world.setReducedMotion(value);
  document.body.classList.toggle("tempo-calm", value);
  $("#calm").textContent = value ? "Calm visuals on" : "Calm visuals";
  $("#calm").setAttribute("aria-pressed", String(value));
}
function download(snapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "tempo-spellgarden-snapshot.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
try {
  tempo = new Tempo(definitions(), { globalCooldown: 0.45 });
  stage = createStage($("#scene"));
  world = createTempoScene(stage, { reducedMotion });
  stage.controls.autoRotate = false;
  stage.controls.target.set(0, 0.5, 0);
  stage.controls.minDistance = 22;
  stage.controls.maxDistance = 75;
  stage.controls.maxPolarAngle = Math.PI * 0.46;
  function frameGarden() {
    const scale = Math.max(1, 0.9 / stage.camera.aspect);
    stage.camera.position.set(21 * scale, 24 * scale, 30 * scale);
    stage.controls.target.set(0, 0.5, 0);
    stage.controls.update();
  }
  frameGarden();
  setMotion(reducedMotion);
  sync();
  stage.setActive({
    update(dt) {
      if (disposed) return;
      const advance = paused || document.hidden ? 0 : dt * timeScale;
      record(tempo.tick(advance));
      world.update(advance);
      sync();
    },
    dispose() {
      world.dispose();
    },
  });
  addEventListener("resize", frameGarden, listener);
  $("#reset-camera").addEventListener("click", frameGarden, listener);
  for (const button of document.querySelectorAll("[data-cast]"))
    button.addEventListener("click", () => cast(button.dataset.cast), listener);
  $("#pause").addEventListener("click", () => setPaused(!paused), listener);
  $("#reset").addEventListener("click", reset, listener);
  $("#apply").addEventListener("click", applyRecipe, listener);
  $("#calm").addEventListener(
    "click",
    () => setMotion(!reducedMotion),
    listener,
  );
  motionPreference.addEventListener(
    "change",
    (event) => setMotion(event.matches),
    listener,
  );
  $("#time-scale").addEventListener(
    "input",
    (event) => {
      timeScale = Number(event.target.value);
      $("#time-scale-value").textContent = `${timeScale}×`;
    },
    listener,
  );
  $("#recharge-scale").addEventListener(
    "input",
    (event) =>
      ($("#recharge-value").textContent = `${Number(event.target.value)}×`),
    listener,
  );
  $("#global-duration").addEventListener(
    "input",
    (event) =>
      ($("#global-value").textContent =
        `${Number(event.target.value).toFixed(2)}s`),
    listener,
  );
  $("#save").addEventListener(
    "click",
    () => {
      download(tempo.toSnapshot());
      say(
        "Clock snapshot downloaded. It includes the active recipe and all charge clocks.",
      );
    },
    listener,
  );
  $("#load").addEventListener("click", () => $("#load-file").click(), listener);
  $("#load-file").addEventListener(
    "change",
    async (event) => {
      const file = event.target.files[0];
      event.target.value = "";
      if (!file) return;
      try {
        if (file.size > 131072)
          throw new RangeError("Snapshot must be smaller than 128 KiB.");
        const next = Tempo.fromSnapshot(await file.text());
        if (disposed) return;
        const nextDefinitions = next.definitions;
        if (
          nextDefinitions.length !== SPELLS.length ||
          nextDefinitions.some(
            (definition, index) =>
              definition.id !== SPELLS[index].id ||
              definition.charges !== SPELLS[index].charges,
          )
        )
          throw new TypeError(
            "This scene requires blink/bloom/meteor in that order with 3/2/1 maximum charges. Use the package directly for another loadout.",
          );
        tempo = next;
        world.reset();
        eventLog.length = 0;
        casts = 0;
        $("#event-trace").replaceChildren();
        setPaused(true);
        sync(tempo.state, true);
        say(
          "Charge clocks restored and paused. Cast visuals and the session cast count start fresh.",
        );
      } catch (error) {
        say(`Could not restore: ${error.message}`);
      }
    },
    listener,
  );
  addEventListener(
    "keydown",
    (event) => {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.target.matches?.("input,textarea,select,[contenteditable='true']")
      )
        return;
      const id = {
        Digit1: "blink",
        Digit2: "bloom",
        Digit3: "meteor",
        Numpad1: "blink",
        Numpad2: "bloom",
        Numpad3: "meteor",
      }[event.code];
      if (id) {
        event.preventDefault();
        cast(id);
      }
      if (event.code === "KeyP") {
        event.preventDefault();
        setPaused(!paused);
      }
    },
    listener,
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) setPaused(true);
    },
    listener,
  );
  addEventListener(
    "pagehide",
    (event) => {
      setPaused(true);
      if (event.persisted) return;
      disposed = true;
      abort.abort();
      stage.dispose();
    },
    listener,
  );
} catch (error) {
  console.error(error);
  disposed = true;
  abort.abort();
  stage?.dispose();
  $("#error").textContent =
    `The Spellgarden could not start: ${error.message}. Enable WebGL2 and reload to try again.`;
  $("#error").hidden = false;
}
