import * as THREE from "three";
import { Wayfinder } from "/packages/wayfinder/index.js";
import { createStage, releaseObject } from "./scene.js";
import {
  createWayfinderScene,
  MOONPOST_CONFIG,
  moonpostPreset,
} from "./wayfinder-scene.js";

const $ = (id) => document.getElementById(id),
  key = "cranberry-forge.wayfinder.moonpost.v1";
let grid = new Wayfinder(MOONPOST_CONFIG),
  start = { x: 1, z: 8 },
  goal = { x: 10, z: 1 },
  mode = "goal",
  route,
  deliveries = 0,
  stage = null,
  world = null,
  busy = false,
  focusIndex = 0,
  fitView = null,
  fitObserver = null;
grid.setCells(moonpostPreset("garden"));
const same = (a, b) => a.x === b.x && a.z === b.z;
const label = (c) =>
  `${String(c.x + 1).padStart(2, "0")} / ${String(c.z + 1).padStart(2, "0")}`;
const notify = (text) => {
  $("status").textContent = text;
};
function snapshot() {
  return {
    version: 1,
    grid: grid.snapshot(),
    start: { ...start },
    goal: { ...goal },
    deliveries,
  };
}
function validateSave(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "deliveries,goal,grid,start,version" ||
    value.version !== 1
  )
    throw new Error("Expected a version 1 Moonpost save");
  const next = Wayfinder.fromSnapshot(value.grid),
    c = next.config;
  if (
    c.width !== 12 ||
    c.height !== 10 ||
    c.cellSize !== 1.35 ||
    c.origin.x !== -8.1 ||
    c.origin.z !== -6.75
  )
    throw new Error(
      "Moonpost displays a 12×10 grid with its original scale and origin",
    );
  if (next.getCell(value.start).blocked || next.getCell(value.goal).blocked)
    throw new Error("Courier and destination must be on open tiles");
  if (
    !Number.isSafeInteger(value.deliveries) ||
    value.deliveries < 0 ||
    value.deliveries > 1000000
  )
    throw new Error("Invalid delivery count");
  return {
    grid: next,
    start: { ...value.start },
    goal: { ...value.goal },
    deliveries: value.deliveries,
  };
}
function loadState(value) {
  const next = validateSave(value);
  world?.stop();
  grid = next.grid;
  start = next.start;
  goal = next.goal;
  deliveries = next.deliveries;
  busy = false;
  $("diagonal").value = grid.config.diagonal;
}
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(snapshot()));
  } catch {
    notify("This garden is running in memory. Export JSON to keep a copy.");
  }
}
try {
  const saved = localStorage.getItem(key);
  if (saved) {
    loadState(JSON.parse(saved));
    notify("Your garden and courier stop have been restored.");
  }
} catch {
  notify("The previous save was not compatible. A fresh garden is ready.");
}
function renderMap() {
  const path = new Set(route.cells.map((c) => c.z * 12 + c.x));
  for (let i = 0; i < 120; i++) {
    const x = i % 12,
      z = Math.floor(i / 12),
      cell = grid.getCell({ x, z }),
      button = $(`cell-${i}`);
    button.className = [
      cell.blocked ? "wall" : "",
      cell.cost > 1 ? "cost" : "",
      path.has(i) ? "route" : "",
      same(cell, start) ? "start" : "",
      same(cell, goal) ? "goal" : "",
    ]
      .filter(Boolean)
      .join(" ");
    button.setAttribute(
      "aria-label",
      `Column ${x + 1}, row ${z + 1}: ${same(cell, start) ? "courier, " : ""}${same(cell, goal) ? "destination, " : ""}${cell.blocked ? "blocked planter" : `open, cost ${cell.cost}`}`,
    );
    button.tabIndex = i === focusIndex ? 0 : -1;
  }
}
function render() {
  route = grid.findPath(start, goal, { y: 1.05 });
  $("from-cell").textContent = label(start);
  $("to-cell").textContent = label(goal);
  $("route-status").textContent = busy
    ? "Courier in transit"
    : route.status === "found"
      ? same(start, goal)
        ? "At destination"
        : "Route ready"
      : "No route available";
  $("route-version").textContent =
    `REV ${String(grid.revision).padStart(2, "0")}`;
  $("route-cost").textContent =
    route.cost === null ? "—" : route.cost.toFixed(1);
  $("route-steps").textContent =
    route.status === "found"
      ? String(Math.max(0, route.cells.length - 1))
      : "—";
  $("route-visited").textContent = String(route.visited);
  $("dispatch").disabled =
    busy || route.status !== "found" || same(start, goal);
  $("dispatch").textContent = busy
    ? "A letter on its way…"
    : "Send the moonpost →";
  $("delivery-note").textContent = busy
    ? "Following the selected path, one tile at a time."
    : route.status !== "found"
      ? "A planter closes the way. Erase one to reconnect the garden."
      : same(start, goal)
        ? "Delivered. Choose another tile for the next letter."
        : "Route ready. Dispatch your courier when you like.";
  $("deliveries").textContent =
    `${String(deliveries).padStart(2, "0")} letters delivered`;
  world?.setGrid(grid.snapshot());
  world?.setRoute(route.points);
  world?.setCourier(grid.cellToWorld(start));
  world?.setGoal(grid.cellToWorld(goal));
  renderMap();
}
function stopAndRender() {
  busy = false;
  world?.stop();
  render();
  save();
}
function applyCell(cell) {
  if (mode === "goal") {
    if (grid.getCell(cell).blocked) {
      notify(
        "That tile contains a planter. Choose an open tile, or erase the planter first.",
      );
      return;
    }
    goal = { ...cell };
    notify(
      `Destination set to ${label(goal)}. The route has been recalculated.`,
    );
  } else {
    if (mode === "wall" && (same(cell, start) || same(cell, goal))) {
      notify("The courier and destination stay open. Plant on another tile.");
      return;
    }
    grid.setCell(
      cell,
      mode === "wall"
        ? { blocked: true }
        : mode === "cost"
          ? { blocked: false, cost: 5 }
          : { blocked: false, cost: 1 },
    );
    notify(
      mode === "wall"
        ? "Planter placed. The route now finds a way around it."
        : mode === "cost"
          ? "Lavender planted. Entering this tile now costs five times more."
          : "Tile cleared. Normal travel cost restored.",
    );
  }
  stopAndRender();
}
for (let i = 0; i < 120; i++) {
  const b = document.createElement("button");
  b.id = `cell-${i}`;
  b.type = "button";
  b.addEventListener("click", () => {
    focusIndex = i;
    applyCell({ x: i % 12, z: Math.floor(i / 12) });
  });
  b.addEventListener("keydown", (event) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12 }[
      event.key
    ];
    if (delta === undefined) return;
    event.preventDefault();
    const x = i % 12,
      z = Math.floor(i / 12);
    if (
      (event.key === "ArrowLeft" && x === 0) ||
      (event.key === "ArrowRight" && x === 11) ||
      (event.key === "ArrowUp" && z === 0) ||
      (event.key === "ArrowDown" && z === 9)
    )
      return;
    focusIndex = i + delta;
    renderMap();
    $(`cell-${focusIndex}`).focus();
  });
  $("cell-map").append(b);
}
const help = {
  goal: "Click a pale tile to set the destination. Drag the garden to orbit.",
  wall: "Click or drag across tiles to plant obstacles. The courier replans after every edit.",
  cost: "Paint lavender meadows. Entering a lavender tile costs ×5, so detours may be cheaper.",
  erase:
    "Click or drag to clear planters and lavender. Cleared tiles have normal cost.",
};
document.querySelectorAll("[data-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    $("mode-help").textContent = help[mode];
    if (stage) stage.controls.enableRotate = mode === "goal";
  }),
);
$("dispatch").addEventListener("click", () => {
  if (busy || route.status !== "found" || same(start, goal)) return;
  busy = true;
  render();
  const planned = route.points;
  notify(
    `Courier dispatched to ${label(goal)}. Weighted route cost ${route.cost.toFixed(1)}.`,
  );
  const arrive = () => {
    start = { ...goal };
    deliveries = Math.min(1000000, deliveries + 1);
    busy = false;
    render();
    save();
    notify(
      "Delivered under moonlight. Pick a new destination for the next letter.",
    );
  };
  if (world) world.travel(planned, arrive);
  else arrive();
});
$("preset").addEventListener("change", () => {
  grid = new Wayfinder({ ...MOONPOST_CONFIG, diagonal: $("diagonal").value });
  grid.setCells(moonpostPreset($("preset").value));
  start = { x: 1, z: 8 };
  goal = { x: 10, z: 1 };
  stopAndRender();
  notify(
    $("preset").value === "sealed"
      ? "The garden is divided. Erase a planter in column 7 to reopen a crossing."
      : "New garden arranged. The courier is ready for another route.",
  );
});
$("diagonal").addEventListener("change", () => {
  const old = grid.snapshot();
  grid = new Wayfinder({ ...grid.config, diagonal: $("diagonal").value });
  grid.setCells(
    old.cells.map((c, i) => ({ x: i % 12, z: Math.floor(i / 12), ...c })),
  );
  stopAndRender();
  notify(
    "Movement policy changed. A new grid revision history begins with the same terrain.",
  );
});
$("reset").addEventListener("click", () => {
  grid = new Wayfinder(MOONPOST_CONFIG);
  grid.setCells(moonpostPreset("garden"));
  start = { x: 1, z: 8 };
  goal = { x: 10, z: 1 };
  deliveries = 0;
  $("preset").value = "garden";
  $("diagonal").value = "no-cut";
  stopAndRender();
  notify("A fresh night shift. The lavender garden is restored.");
});
$("export").addEventListener("click", () => {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot(), null, 2)], {
        type: "application/json",
      }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "moonpost-wayfinder-save.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Garden, movement policy, and courier stops exported.");
});
$("load").addEventListener("click", () => $("save-file").click());
$("save-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2000000) throw new Error("File exceeds 2 MB");
    const value = JSON.parse(await file.text());
    loadState(value);
    render();
    save();
    notify(
      "Save validated and loaded. The route was recalculated from your courier stop.",
    );
  } catch (error) {
    notify(
      `Could not load the save: ${error.message}. Your current garden is unchanged.`,
    );
  } finally {
    event.target.value = "";
  }
});
$("camera-reset").addEventListener("click", () => fitView?.(true));
try {
  stage = createStage($("garden"));
  world = createWayfinderScene(stage, {
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  stage.setActive(world);
  const bounds = new THREE.Box3().setFromObject(world.root),
    corners = [];
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z])
        corners.push(new THREE.Vector3(x, y, z));
  fitView = (reset = false) => {
    const rect = $("world").getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const target = new THREE.Vector3(0, 1.1, 0),
      direction = reset
        ? new THREE.Vector3(25, 28.9, 32).normalize()
        : stage.camera.position.clone().sub(stage.controls.target).normalize(),
      right = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), direction)
        .normalize(),
      up = new THREE.Vector3().crossVectors(direction, right),
      tan = Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2)),
      aspect = rect.width / rect.height;
    let distance = 40;
    for (const corner of corners) {
      const relative = corner.clone().sub(target),
        depth = relative.dot(direction);
      distance = Math.max(
        distance,
        depth + Math.abs(relative.dot(right)) / (tan * aspect * 0.9),
        depth + Math.abs(relative.dot(up)) / (tan * 0.84),
      );
    }
    stage.camera.aspect = aspect;
    stage.camera.position.copy(target).addScaledVector(direction, distance);
    stage.camera.updateProjectionMatrix();
    stage.scene.fog.near = Math.max(65, distance + 25);
    stage.scene.fog.far = Math.max(120, distance + 75);
    stage.controls.target.copy(target);
    stage.controls.maxDistance = Math.max(65, distance * 1.65);
    stage.controls.update();
  };
  fitObserver = new ResizeObserver(() => fitView());
  fitObserver.observe($("world"));
  fitView(true);
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  let pointerStart = null,
    painted = new Set();
  function pick(event) {
    const r = $("garden").getBoundingClientRect();
    pointer.set(
      ((event.clientX - r.left) / r.width) * 2 - 1,
      (-(event.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, stage.camera);
    return raycaster.intersectObjects(world.pickables)[0]?.object.userData.cell;
  }
  function paint(event) {
    const cell = pick(event);
    if (!cell) return;
    const id = cell.z * 12 + cell.x;
    if (painted.has(id)) return;
    painted.add(id);
    applyCell(cell);
  }
  $("garden").addEventListener("pointerdown", (event) => {
    pointerStart = [event.clientX, event.clientY];
    painted = new Set();
    if (mode !== "goal") {
      event.preventDefault();
      $("garden").setPointerCapture(event.pointerId);
      paint(event);
    }
  });
  $("garden").addEventListener("pointermove", (event) => {
    if (
      pointerStart &&
      mode !== "goal" &&
      (event.buttons || event.pointerType === "touch")
    )
      paint(event);
  });
  $("garden").addEventListener("pointerup", (event) => {
    if (
      mode === "goal" &&
      pointerStart &&
      Math.hypot(
        event.clientX - pointerStart[0],
        event.clientY - pointerStart[1],
      ) < 6
    ) {
      const cell = pick(event);
      if (cell) applyCell(cell);
    }
    pointerStart = null;
  });
  $("garden").addEventListener("pointercancel", () => {
    pointerStart = null;
  });
} catch {
  fitObserver?.disconnect();
  fitView = null;
  if (stage) {
    if (world && stage.active !== world) world.dispose();
    stage.dispose();
    stage.scene.traverse((object) => object.shadow?.dispose?.());
    for (const child of [...stage.scene.children]) releaseObject(child);
  }
  stage = null;
  world = null;
  $("error").hidden = false;
  $("error").textContent =
    "The 3D garden could not start on this device. The navigator still works: open the keyboard & touch cell map to choose destinations and paint terrain.";
  $("camera-reset").disabled = true;
}
render();
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  fitObserver?.disconnect();
  stage?.dispose();
});
