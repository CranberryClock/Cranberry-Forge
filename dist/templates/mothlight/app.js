import * as THREE from "three";
import { createStage } from "./lib/scene.js";
import { createCampScene } from "./lib/camp-scene.js";
import { renderGrid, button } from "./lib/kit-ui.js";
import { mountDialogue } from "@cranberry-forge/chatter/dom";
import { MothlightGame } from "./game.js";
import { ITEMS, LANTERN_RECIPE } from "./content.js";

const $ = (s) => document.querySelector(s),
  SAVE_KEY = "cranberry-forge.mothlight.v1";
let game = new MothlightGame(),
  stage,
  world,
  selected = null,
  destination = null,
  pendingInteraction = null,
  nearest = null,
  talkView = null,
  talkUnsubscribe = null,
  toastTimer,
  storageWarning = false;
const keys = new Set(),
  forward = new THREE.Vector3(),
  right = new THREE.Vector3(),
  move = new THREE.Vector3(),
  up = new THREE.Vector3(0, 1, 0);
function toast(message) {
  $("#game-toast").textContent = message;
  $("#game-toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => $("#game-toast").classList.remove("visible"),
    3200,
  );
}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.toSnapshot()));
  } catch {
    if (!storageWarning) {
      storageWarning = true;
      toast("Device saving is unavailable. Export a save from the menu.");
    }
  }
}
try {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) game = MothlightGame.fromSnapshot(saved);
} catch {
  toast("The previous save could not be loaded. A fresh adventure is ready.");
}
const modalOpen = () =>
  [...document.querySelectorAll("dialog")].some((d) => d.open);
const stopWalking = () => {
  keys.clear();
  destination = null;
  pendingInteraction = null;
};
function openDialog(id) {
  stopWalking();
  $(id).showModal();
}
function updateWorld() {
  world.setCollected(game.collected);
  world.setCompleted(game.completed);
  world.player.position.set(game.position.x, 0.12, game.position.z);
  updateQuest();
}
function updateQuest() {
  const hasLantern = game.pack.count("lantern") > 0;
  $("#objective").textContent = game.completed
    ? "The light is home."
    : !game.accepted
      ? "Find Mira at the camp."
      : hasLantern
        ? "Carry your lantern to the beacon."
        : game.pack.canCraft(LANTERN_RECIPE).ok
          ? "Return to Mira’s worktable."
          : "Find the lantern’s missing pieces.";
  $("#objective-detail").textContent = game.completed
    ? "The moths came back. You can stay and explore."
    : !game.accepted
      ? "Someone is still waiting for the skyship."
      : hasLantern
        ? "The tower stands on the east side of the island."
        : "3 copper · 2 skyglass · 1 moonleaf";
  const row = $("#quest-items");
  row.replaceChildren();
  if (game.accepted && !game.completed && !hasLantern)
    for (const ingredient of LANTERN_RECIPE.ingredients) {
      const d = ITEMS.find((i) => i.id === ingredient.itemId),
        item = document.createElement("span");
      item.className = "quest-item";
      const img = document.createElement("img");
      img.src = `./assets/items/${d.id}.png`;
      img.alt = d.name;
      const count = document.createElement("span");
      count.textContent = `${game.pack.count(d.id)}/${ingredient.quantity}`;
      item.append(img, count);
      row.append(item);
    }
  const nearMira =
    Math.hypot(
      game.position.x - world.merchant.position.x,
      game.position.z - world.merchant.position.z,
    ) < 3;
  $("#craft").hidden = !game.accepted || hasLantern || game.completed;
  $("#craft").disabled = !nearMira || !game.pack.canCraft(LANTERN_RECIPE).ok;
  $("#craft").textContent = nearMira
    ? "Assemble the moth lantern"
    : "Craft at Mira’s worktable";
}
function renderPack() {
  if (!game.pack.items.some((i) => i.id === selected)) selected = null;
  $("#weight").textContent =
    `${game.pack.weight.toFixed(1)} / 16 kg · ${game.pack.items.length} stacks`;
  const result = (r) => {
    if (!r.ok)
      toast(
        r.reason === "blocked"
          ? "That space is occupied."
          : r.reason === "no-space"
            ? "No room for a new stack."
            : r.reason,
      );
    renderPack();
    save();
  };
  renderGrid($("#game-grid"), game.pack, {
    items: ITEMS,
    selected,
    assetBase: "./assets/items/",
    onSelect: (id) => {
      selected = id;
      renderPack();
    },
    onChange: result,
  });
  const actions = $("#item-actions");
  actions.replaceChildren();
  if (selected) {
    const item = game.pack.items.find((i) => i.id === selected);
    actions.append(
      button("Rotate", () => result(game.pack.rotate(selected))),
      button(
        "Split half",
        () => result(game.pack.split(selected, Math.floor(item.quantity / 2))),
        { disabled: item.quantity < 2 },
      ),
    );
  }
}
function talk() {
  const conversation = game.createConversation();
  talkView?.dispose();
  talkUnsubscribe?.();
  talkUnsubscribe = conversation.subscribe(() => {
    game.accepted = conversation.variables.accepted === true;
    updateQuest();
    save();
  });
  talkView = mountDialogue($("#talk-box"), conversation, {
    onEnd: () => {
      $("#talk-dialog").close();
    },
  });
  openDialog("#talk-dialog");
}
function interact(object = nearest) {
  if (!object || modalOpen()) return;
  const { id, kind } = object.userData.interaction;
  if (kind === "talk") {
    talk();
    return;
  }
  if (kind === "pickup") {
    const result = game.collect(id);
    if (result.ok) {
      toast(
        `${ITEMS.find((i) => i.id === object.userData.itemId).name} collected.`,
      );
      updateWorld();
      save();
    } else
      toast(
        result.reason === "no-space"
          ? "Your pack is full. Rearrange it or craft the lantern."
          : result.reason === "finished"
            ? "The delivery is complete. Enjoy the quiet."
            : result.reason,
      );
    return;
  }
  if (kind === "beacon") {
    const result = game.deliver();
    if (!result.ok) {
      toast(
        result.reason === "already-delivered"
          ? "A light for the ones still finding their way."
          : "Build a moth lantern at Mira’s worktable first.",
      );
      return;
    }
    updateWorld();
    save();
    $("#finish-time").textContent =
      `Your little journey took ${Math.floor(game.elapsed / 60)}m ${Math.floor(game.elapsed % 60)}s.`;
    openDialog("#win-dialog");
  }
}
function reset() {
  game = new MothlightGame();
  selected = null;
  stopWalking();
  for (const d of document.querySelectorAll("dialog")) if (d.open) d.close();
  updateWorld();
  save();
  toast("A new little adventure. Find Mira at the camp.");
}
function findNearest() {
  let distance = 2.2,
    candidate = null;
  for (const object of world.pickables) {
    if (!object.visible) continue;
    const d = Math.hypot(
      object.position.x - game.position.x,
      object.position.z - game.position.z,
    );
    if (d < distance) {
      distance = d;
      candidate = object;
    }
  }
  return candidate;
}
function walk(dt) {
  if (modalOpen() || document.hidden) return;
  if (!game.completed) game.elapsed += dt;
  const x =
      Number(keys.has("KeyD") || keys.has("ArrowRight")) -
      Number(keys.has("KeyA") || keys.has("ArrowLeft")),
    y =
      Number(keys.has("KeyW") || keys.has("ArrowUp")) -
      Number(keys.has("KeyS") || keys.has("ArrowDown"));
  move.set(0, 0, 0);
  if (x || y) {
    destination = null;
    pendingInteraction = null;
    stage.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, up).normalize();
    move.addScaledVector(forward, y).addScaledVector(right, x).normalize();
  } else if (destination) {
    move.set(
      destination.x - game.position.x,
      0,
      destination.z - game.position.z,
    );
    const distance = move.length();
    if ((pendingInteraction && distance < 1.65) || distance < 0.12) {
      destination = null;
      move.set(0, 0, 0);
      const object = pendingInteraction;
      pendingInteraction = null;
      if (object) interact(object);
    } else move.normalize();
  }
  if (move.lengthSq() > 0) {
    game.position.x += move.x * dt * 3.5;
    game.position.z += move.z * dt * 3.5;
    const distance = Math.hypot(game.position.x, game.position.z);
    if (distance > 9.3) {
      game.position.x *= 9.3 / distance;
      game.position.z *= 9.3 / distance;
      destination = null;
      pendingInteraction = null;
    }
    world.player.rotation.y = Math.atan2(move.x, move.z);
    world.player.position.set(
      game.position.x,
      0.12 + Math.abs(Math.sin(game.elapsed * 10)) * 0.025,
      game.position.z,
    );
  }
  nearest = findNearest();
  const control = $("#interact");
  control.disabled = !nearest;
  control.textContent = nearest
    ? (nearest.userData.interaction.kind === "talk"
        ? "Talk to Mira"
        : nearest.userData.interaction.kind === "beacon"
          ? "Light the beacon"
          : `Pick up ${ITEMS.find((i) => i.id === nearest.userData.itemId).name}`) +
      " · E"
    : "Walk closer to interact";
}
try {
  stage = createStage($("#game-canvas"));
  world = createCampScene(stage, { mode: "mothlight" });
  stage.controls.autoRotate = false;
  stage.controls.minDistance = 16;
  stage.controls.maxDistance = 95;
  stage.controls.target.set(0, 0.5, 0);
  const fit = () => {
    const factor = Math.max(1, 1 / stage.camera.aspect);
    stage.camera.position.set(18 * factor, 16 * factor, 22 * factor);
    stage.controls.update();
  };
  fit();
  addEventListener("resize", fit);
  let lastHud = 0,
    lastSave = 0;
  stage.setActive({
    update(dt, elapsed) {
      world.update(dt);
      walk(dt);
      if (elapsed - lastHud > 0.25) {
        updateQuest();
        lastHud = elapsed;
      }
      if (elapsed - lastSave > 3) {
        save();
        lastSave = elapsed;
      }
    },
    dispose() {
      world.dispose();
    },
  });
  updateWorld();
  addEventListener("keydown", (e) => {
    if (e.target.matches?.("input,textarea")) return;
    if (e.code === "KeyI" && !e.repeat) {
      e.preventDefault();
      if ($("#pack-dialog").open) $("#pack-dialog").close();
      else if (!modalOpen()) {
        renderPack();
        openDialog("#pack-dialog");
      }
      return;
    }
    if (modalOpen()) return;
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.code)
    ) {
      e.preventDefault();
      keys.add(e.code);
    }
    if (e.code === "KeyE" && !e.repeat) interact();
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", stopWalking);
  for (const b of document.querySelectorAll("[data-move]")) {
    const key = { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD" }[
      b.dataset.move
    ];
    b.onpointerdown = (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      keys.add(key);
    };
    b.onpointerup = () => keys.delete(key);
    b.onpointercancel = () => keys.delete(key);
    b.onlostpointercapture = () => keys.delete(key);
  }
  let down = null;
  $("#game-canvas").addEventListener(
    "pointerdown",
    (e) => (down = [e.clientX, e.clientY]),
  );
  $("#game-canvas").addEventListener("pointerup", (e) => {
    if (
      modalOpen() ||
      !down ||
      Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5
    )
      return;
    const r = e.target.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      stage.camera,
    );
    const hit = ray.intersectObjects(
      world.pickables.filter((o) => o.visible),
      true,
    )[0];
    if (hit) {
      let object = hit.object;
      while (object && !object.userData.interaction) object = object.parent;
      if (object) {
        destination = { x: object.position.x, z: object.position.z };
        pendingInteraction = object;
        return;
      }
    }
    const terrain = ray.intersectObject(world.ground)[0];
    if (terrain) {
      destination = { x: terrain.point.x, z: terrain.point.z };
      pendingInteraction = null;
    }
  });
  $("#interact").onclick = () => interact();
  $("#pack-button").onclick = () => {
    renderPack();
    openDialog("#pack-dialog");
  };
  $("#help-button").onclick = () => openDialog("#help-dialog");
  for (const [close, target] of [
    ["close-pack", "pack-dialog"],
    ["close-talk", "talk-dialog"],
    ["close-help", "help-dialog"],
  ])
    $(`#${close}`).onclick = () => $(`#${target}`).close();
  $("#talk-dialog").addEventListener("close", () => {
    talkView?.dispose();
    talkView = null;
    talkUnsubscribe?.();
    talkUnsubscribe = null;
  });
  $("#craft").onclick = () => {
    if (
      Math.hypot(
        game.position.x - world.merchant.position.x,
        game.position.z - world.merchant.position.z,
      ) >= 3
    )
      return;
    const result = game.craft();
    if (result.ok) {
      toast("Moth lantern assembled. Bring it to the beacon.");
      save();
      updateQuest();
    } else toast(result.reason);
  };
  $("#keep-exploring").onclick = () => $("#win-dialog").close();
  $("#play-again").onclick = reset;
  $("#restart").onclick = reset;
  $("#save-file").onclick = () => {
    const blob = new Blob([JSON.stringify(game.toSnapshot(), null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "mothlight-save.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  $("#load-file").onclick = () => $("#load-input").click();
  $("#load-input").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 100000)
        throw new Error("Save must be smaller than 100 KB.");
      const loaded = MothlightGame.fromSnapshot(await file.text());
      game = loaded;
      selected = null;
      stopWalking();
      updateWorld();
      save();
      $("#help-dialog").close();
      toast("Adventure restored.");
    } catch (error) {
      toast(error.message);
    }
  };
  addEventListener("pagehide", (event) => {
    save();
    stopWalking();
    if (event.persisted) return;
    talkView?.dispose();
    talkUnsubscribe?.();
    stage.dispose();
  });
} catch (error) {
  $("#error").textContent =
    `Mothlight could not start: ${error.message}. Use a browser with WebGL2 enabled.`;
  $("#error").hidden = false;
  console.error(error);
}
