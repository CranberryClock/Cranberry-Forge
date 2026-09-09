import * as THREE from "three";
import { createStage } from "./scene.js";
import { createParcel, validateTable } from "./packages/parcel/index.js";
import { createParcelScene, PARCEL_COLORS } from "./parcel-scene.js";

const DEFAULT_TABLE = {
  id: "starlight",
  entries: [
    {
      id: "moon-silt",
      itemId: "moon_silt",
      label: "Moon silt",
      rarity: "common",
      weight: 55,
      min: 3,
      max: 7,
    },
    {
      id: "tideglass",
      itemId: "tideglass",
      label: "Tideglass",
      rarity: "uncommon",
      weight: 25,
      min: 2,
      max: 4,
    },
    {
      id: "comet-shard",
      itemId: "comet_shard",
      label: "Comet shard",
      rarity: "rare",
      weight: 13,
      min: 1,
      max: 2,
    },
    {
      id: "aurora-prism",
      itemId: "aurora_prism",
      label: "Aurora prism",
      rarity: "epic",
      weight: 6,
    },
    {
      id: "solar-heart",
      itemId: "solar_heart",
      label: "Solar heart",
      rarity: "legendary",
      weight: 1,
    },
  ],
  pity: { after: 8, rarities: ["epic", "legendary"] },
};
const $ = (id) => document.getElementById(id),
  storageKey = "cranberry-forge.parcel.lab.v1";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const color = (rarity) => PARCEL_COLORS[rarity] ?? "#a6c9e8";
const percent = (value) =>
  `${(value * 100).toFixed(value === 0 || value === 1 ? 0 : 2).replace(/\.00$/, "")}%`;
const title = (value) =>
  value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/^./, (c) => c.toUpperCase());
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function notify(text) {
  $("status").textContent = text;
}
let table = validateTable(DEFAULT_TABLE),
  parcel = createParcel(table, { seed: 42 }),
  history = [],
  stage,
  world,
  timer = 0,
  busy = false,
  disposed = false;
function envelope() {
  return { table, snapshot: parcel.snapshot() };
}
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(envelope()));
  } catch {
    notify(
      "Device storage is unavailable. Export a save to keep this exact random stream.",
    );
  }
}
function setBusy(value) {
  busy = value;
  for (const id of ["open", "reset", "table-apply", "save-import"])
    $(id).disabled = value;
}
function reward(receipt) {
  const host = $("reveal");
  host.style.setProperty("--reward", color(receipt.rarity));
  $("reward-rarity").textContent =
    `${title(receipt.rarity).toUpperCase()} DISCOVERY${receipt.guaranteed ? " · GUARANTEED" : ""}`;
  $("reward-name").textContent = receipt.label;
  $("reward-detail").textContent =
    `×${receipt.quantity} · ${percent(receipt.probability)} on this roll · #${String(receipt.roll).padStart(3, "0")}`;
  host.classList.remove("flash");
  void host.offsetWidth;
  host.classList.add("flash");
}
function render() {
  const odds = parcel.odds(),
    snapshot = parcel.snapshot();
  $("roll-count").textContent = String(snapshot.rolls).padStart(3, "0");
  const maximum = table.pity ? Math.max(1, table.pity.after - 1) : 1;
  $("pity-count").textContent = table.pity
    ? `${odds.misses} / ${table.pity.after - 1}`
    : "OFF";
  $("pity-heading").textContent = table.pity
    ? "Prismatic guarantee"
    : "Pure weighted chance";
  $("pity-track").setAttribute("aria-valuemax", String(maximum));
  $("pity-track").setAttribute(
    "aria-valuenow",
    String(odds.guaranteed ? maximum : odds.misses),
  );
  $("pity-track").setAttribute(
    "aria-valuetext",
    table.pity
      ? `${odds.misses} consecutive misses. ${odds.remaining} openings until guarantee at latest.`
      : "Guarantee disabled",
  );
  $("pity-fill").style.width =
    `${table.pity ? (odds.guaranteed ? 100 : (odds.misses / maximum) * 100) : 0}%`;
  $("pity-note").textContent = table.pity
    ? odds.guaranteed
      ? `Next cache guarantees: ${table.pity.rarities.map(title).join(" or ")}.`
      : `${table.pity.rarities.map(title).join(" or ")} within ${odds.remaining} more opening${odds.remaining === 1 ? "" : "s"}.`
    : "Each opening uses the base weights. No guarantee counter.";
  $("policy-note").textContent = table.pity
    ? "Weights stay fixed until the guarantee roll. Any qualifying discovery resets the counter."
    : "Rarity is a label. Only the entry weights determine selection.";
  $("odds").replaceChildren(
    ...odds.entries.map((entry) => {
      const row = element("div", "pc-odds-row");
      row.style.setProperty("--gem", color(entry.rarity));
      const name = element("div");
      name.append(
        element("span", "pc-item-name", entry.label),
        element(
          "span",
          "pc-item-note",
          `${title(entry.rarity)} · ×${entry.min === entry.max ? entry.min : `${entry.min}–${entry.max}`}`,
        ),
      );
      const probability = element(
        "div",
        "pc-chance",
        percent(entry.probability),
      );
      if (entry.probability !== entry.baseProbability)
        probability.append(
          element("small", "", `${percent(entry.baseProbability)} base`),
        );
      row.append(element("span", "pc-gem", "✧"), name, probability);
      return row;
    }),
  );
  $("ledger-count").textContent = history.length
    ? `Latest ${history.length}`
    : "0 discoveries";
  $("history").replaceChildren(
    ...(history.length
      ? history.map((receipt) => {
          const item = element("li"),
            glyph = element("span", "pc-gem", "◇"),
            copy = element("div");
          glyph.style.setProperty("--gem", color(receipt.rarity));
          copy.append(
            element("strong", "", `${receipt.label} ×${receipt.quantity}`),
            element(
              "small",
              "",
              `#${String(receipt.roll).padStart(3, "0")} · ${receipt.guaranteed ? "GUARANTEE" : title(receipt.rarity)}`,
            ),
          );
          item.append(glyph, copy);
          return item;
        })
      : [
          element(
            "li",
            "pc-empty",
            "The ledger is waiting for its first star.",
          ),
        ]),
  );
}
function clearPresentation() {
  history = [];
  world?.reset();
  $("reward-rarity").textContent = "A NEW DISCOVERY AWAITS";
  $("reward-name").textContent = "Starlight cache";
  $("reward-detail").textContent = "One opening. One weighted discovery.";
  $("distribution").replaceChildren(
    element("p", "pc-empty", "See a thousand discoveries in one glance."),
  );
  $("batch-note").textContent =
    "The simulation uses the same loot table, random generator and guarantee policy.";
}
function seedValue() {
  const value = $("seed").value;
  if (!value.trim())
    throw new Error("Enter a replay seed between 0 and 4,294,967,295.");
  return Number(value);
}
function openCache() {
  if (busy || disposed) return;
  try {
    const { receipt } = parcel.roll();
    history.unshift(receipt);
    history.length = Math.min(history.length, 6);
    world?.reveal(receipt);
    reward(receipt);
    render();
    notify(
      `${receipt.label} ×${receipt.quantity}. ${title(receipt.rarity)}; ${percent(receipt.probability)} selection probability${receipt.guaranteed ? ", guarantee roll" : ""}.`,
    );
    save();
    if (!reduced && world) {
      setBusy(true);
      timer = setTimeout(() => setBusy(false), 1150);
    }
  } catch (error) {
    notify(error.message);
  }
}
function download(name, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = element("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function readFile(input) {
  const file = input.files?.[0];
  input.value = "";
  if (!file) return null;
  if (file.size > 2 * 1024 * 1024)
    throw new Error("Choose a JSON file smaller than 2 MiB.");
  return JSON.parse(await file.text());
}
try {
  const saved = localStorage.getItem(storageKey);
  if (saved && saved.length <= 2 * 1024 * 1024) {
    const data = JSON.parse(saved),
      nextTable = validateTable(data.table),
      nextParcel = createParcel(nextTable, { snapshot: data.snapshot });
    table = nextTable;
    parcel = nextParcel;
    $("seed").value = String(parcel.snapshot().seed);
    notify(
      "Your saved random stream is restored. The recent ledger starts here; your roll count and guarantee continue.",
    );
  }
} catch {
  notify(
    "The previous device save could not be restored. A fresh seed-42 stream is ready.",
  );
}
$("table-editor").value = JSON.stringify(table, null, 2);
$("open").addEventListener("click", openCache);
$("reset").addEventListener("click", () => {
  try {
    const next = createParcel(table, { seed: seedValue() });
    parcel = next;
    clearPresentation();
    render();
    notify(
      `Seed ${parcel.snapshot().seed} restarted. The same table and seed produce the same discoveries.`,
    );
    save();
  } catch (error) {
    notify(error.message);
  }
});
$("simulate").addEventListener("click", () => {
  try {
    const sample = createParcel(table, { snapshot: parcel.snapshot() }).open(
        1000,
      ),
      counts = new Map(table.entries.map((e) => [e.id, 0]));
    sample.receipts.forEach((receipt) =>
      counts.set(receipt.entryId, counts.get(receipt.entryId) + 1),
    );
    $("distribution").replaceChildren(
      ...table.entries.map((entry) => {
        const row = element("div", "pc-bar-row");
        row.style.setProperty("--gem", color(entry.rarity));
        const track = element("div", "pc-bar-track"),
          fill = element("i");
        fill.style.width = `${counts.get(entry.id) / 10}%`;
        track.append(fill);
        row.append(
          element("span", "", entry.label),
          track,
          element("span", "", percent(counts.get(entry.id) / 1000)),
        );
        return row;
      }),
    );
    const guarantees = sample.receipts.filter((r) => r.guaranteed).length;
    $("batch-note").textContent =
      `1,000 actual rolls · ${guarantees} guarantee rolls · from live roll #${parcel.snapshot().rolls}. These are observed shares, including pity, not fixed base odds.`;
    notify(
      "Simulation complete. Your live random state and guarantee counter have not advanced.",
    );
  } catch (error) {
    notify(error.message);
  }
});
$("table-apply").addEventListener("click", () => {
  try {
    const nextTable = validateTable(JSON.parse($("table-editor").value)),
      next = createParcel(nextTable, { seed: seedValue() });
    table = nextTable;
    parcel = next;
    $("table-editor").value = JSON.stringify(table, null, 2);
    clearPresentation();
    render();
    notify("Table validated and applied. A new deterministic history begins.");
    save();
  } catch (error) {
    notify(`Table unchanged: ${error.message}`);
  }
});
$("table-export").addEventListener("click", () =>
  download("parcel-table.json", table),
);
$("table-import").addEventListener("click", () => $("table-file").click());
$("table-file").addEventListener("change", async () => {
  try {
    const data = await readFile($("table-file"));
    if (data === null) return;
    const next = validateTable(data);
    $("table-editor").value = JSON.stringify(next, null, 2);
    notify(
      "Imported table is ready in the editor. Apply it to begin a new history.",
    );
  } catch (error) {
    notify(`Import failed: ${error.message}`);
  }
});
$("save-export").addEventListener("click", () =>
  download("parcel-save.json", envelope()),
);
$("save-import").addEventListener("click", () => $("save-file").click());
$("save-file").addEventListener("change", async () => {
  try {
    const data = await readFile($("save-file"));
    if (data === null) return;
    const nextTable = validateTable(data.table),
      next = createParcel(nextTable, { snapshot: data.snapshot });
    table = nextTable;
    parcel = next;
    $("seed").value = String(parcel.snapshot().seed);
    $("table-editor").value = JSON.stringify(table, null, 2);
    clearPresentation();
    render();
    notify(
      "Save restored. Your next cache continues from the saved random state and guarantee counter.",
    );
    save();
  } catch (error) {
    notify(`Save unchanged: ${error.message}`);
  }
});
$("camera-reset").addEventListener("click", () => {
  if (stage) {
    stage.camera.position.set(15, 11, 19);
    stage.controls.target.set(0, 2.3, 0);
    stage.controls.update();
  }
});
try {
  stage = createStage($("foundry"));
  world = createParcelScene(stage, {
    reducedMotion: reduced,
    opened: true,
    rarity: "legendary",
  });
  stage.setActive(world);
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  let down = null;
  $("foundry").addEventListener(
    "pointerdown",
    (event) => (down = [event.clientX, event.clientY]),
  );
  $("foundry").addEventListener("pointerup", (event) => {
    if (
      !down ||
      Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5
    ) {
      down = null;
      return;
    }
    down = null;
    const r = $("foundry").getBoundingClientRect();
    pointer.set(
      ((event.clientX - r.left) / r.width) * 2 - 1,
      (-(event.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, stage.camera);
    if (raycaster.intersectObjects(world.pickables).length) openCache();
  });
  $("foundry").addEventListener("pointercancel", () => (down = null));
} catch (error) {
  $("error").hidden = false;
  $("error").textContent =
    "The 3D foundry could not start on this device. Cache opening, probability inspection, table editing and saved replay still work below.";
  $("camera-reset").disabled = true;
  stage?.dispose();
  stage = null;
  world = null;
}
render();
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  clearTimeout(timer);
  stage?.dispose();
});
