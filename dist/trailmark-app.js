import * as THREE from "three";
import { createStage } from "./scene.js";
import { createJournal } from "/packages/trailmark/index.js";
import {
  createTrailmarkScene,
  TRAILMARK_DISTRICTS,
} from "./trailmark-scene.js";

const QUESTS = [
  {
    id: "supplies",
    title: "A place to begin",
    description:
      "The old landing still has everything we need. Gather timber from the yard and pale stone from the shore.",
    objectives: [
      {
        id: "timber",
        title: "Gather seasoned timber",
        type: "gather",
        tags: ["timber"],
        target: 4,
      },
      {
        id: "stone",
        title: "Gather limestone",
        type: "gather",
        tags: ["stone"],
        target: 3,
      },
    ],
  },
  {
    id: "bridge",
    title: "Across the blue",
    description:
      "Reconnect the islands. Set three stone arches over the channel and open the way to the quiet village.",
    prerequisites: ["supplies"],
    objectives: [
      {
        id: "repair",
        title: "Restore the bridge arches",
        type: "restore",
        tags: ["bridge"],
        target: 3,
      },
    ],
  },
  {
    id: "homes",
    title: "Rooms for returning",
    description:
      "The quarter has stood empty since the last storm. Give each of its three houses a terracotta roof again.",
    prerequisites: ["bridge"],
    objectives: [
      {
        id: "roofs",
        title: "Rebuild the village roofs",
        type: "restore",
        tags: ["homes"],
        target: 3,
      },
    ],
  },
  {
    id: "beacon",
    title: "A light to come home to",
    description:
      "With the village ready, gather two sunstones and kindle Northlight. Let the little harbor shine across the sea.",
    prerequisites: ["homes"],
    objectives: [
      {
        id: "crystals",
        title: "Gather sunstones",
        type: "gather",
        tags: ["sunstone"],
        target: 2,
      },
      {
        id: "ignite",
        title: "Kindle the beacon",
        type: "restore",
        tags: ["beacon"],
        target: 1,
      },
    ],
  },
];
const ACTIONS = {
  supplies: [
    {
      label: "Gather timber +1",
      objective: "timber",
      type: "gather",
      tags: ["timber"],
    },
    {
      label: "Gather stone +1",
      objective: "stone",
      type: "gather",
      tags: ["stone"],
    },
  ],
  bridge: [
    {
      label: "Set a stone arch +1",
      objective: "repair",
      type: "restore",
      tags: ["bridge"],
    },
  ],
  homes: [
    {
      label: "Rebuild a roof +1",
      objective: "roofs",
      type: "restore",
      tags: ["homes"],
    },
  ],
  beacon: [
    {
      label: "Gather a sunstone +1",
      objective: "crystals",
      type: "gather",
      tags: ["sunstone"],
    },
    {
      label: "Kindle Northlight ✧",
      objective: "ignite",
      type: "restore",
      tags: ["beacon"],
    },
  ],
};
const $ = (id) => document.getElementById(id),
  storageKey = "cranberry-forge.trailmark.harbor.v1",
  config = { dedupeCapacity: 256 };
let journal = createJournal(QUESTS, config),
  selected = "supplies",
  stage = null,
  world = null,
  lastEvent = null,
  trace = [],
  frame = 0;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const notify = (text) => {
  $("status").textContent = text;
};
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(journal.snapshot()));
  } catch {
    notify("Progress is running in memory. Use Export save to keep a copy.");
  }
}
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    journal.restore(JSON.parse(saved));
    notify("Your harbor journal is restored. Select a district to continue.");
    selected =
      journal
        .list()
        .find((q) => q.status === "active" || q.status === "available")?.id ??
      "beacon";
  }
} catch {
  notify("The previous save could not be loaded. A fresh journal is ready.");
}
function addTrace(message) {
  trace.unshift(message);
  trace = trace.slice(0, 5);
  $("trace").innerHTML = trace.map((s) => `<li>${s}</li>`).join("");
}
function choose(id) {
  selected = id;
  render();
}
function render() {
  const views = journal.list(),
    q = journal.get(selected),
    done = views.filter((v) => v.receipt).length,
    claimed = views.filter((v) => v.status === "claimed").length;
  $("completion").textContent = `${done * 25}%`;
  $("receipts").textContent = String(claimed).padStart(2, "0");
  $("quest-count").textContent = `${done} / 4 complete`;
  $("overall-progress").style.width = `${done * 25}%`;
  $("quests").innerHTML = views
    .map(
      (v, i) =>
        `<button class="tm-quest ${v.id === selected ? "selected" : ""} ${v.receipt ? "done" : ""}" data-quest="${v.id}" aria-pressed="${v.id === selected}"><span class="tm-quest-number">${v.receipt ? "✓" : String(i + 1).padStart(2, "0")}</span><span><span class="tm-quest-title">${escape(TRAILMARK_DISTRICTS[i].name)}</span><span class="tm-quest-status">${v.status === "available" ? "Ready to accept" : v.status === "completed" ? "Complete · claim receipt" : v.status === "claimed" ? "Receipt claimed" : v.status}</span></span><span class="tm-quest-right">${v.objectives.reduce((n, o) => n + o.count, 0)}/${v.objectives.reduce((n, o) => n + o.target, 0)}</span></button>`,
    )
    .join("");
  let controls = "";
  if (q.status === "locked")
    controls = `<div class="tm-gate">Requires ${q.missingPrerequisites.map((id) => escape(QUESTS.find((v) => v.id === id).title)).join(" + ")} to be complete.</div>`;
  if (q.status === "available")
    controls = `<button class="tm-action" data-activate="${q.id}">Accept this commission →</button>`;
  if (q.status === "active")
    controls = ACTIONS[q.id]
      .map((a, i) => {
        const complete = q.objectives.find(
          (o) => o.id === a.objective,
        ).complete;
        const gated =
          q.id === "beacon" &&
          a.objective === "ignite" &&
          !q.objectives[0].complete;
        return `<button class="tm-action ${i === 1 ? "secondary" : ""}" data-action="${i}" ${complete || gated ? "disabled" : ""}>${complete ? "✓ " + a.label.replace(/ \+1/, "") : gated ? "Gather sunstones to kindle" : a.label}</button>`;
      })
      .join("");
  if (q.status === "completed")
    controls = `<button class="tm-action" data-claim="${q.id}">Claim completion receipt ✓</button>`;
  if (q.status === "claimed") {
    const next = views.find(
      (v) => v.status === "available" || v.status === "active",
    );
    controls = next
      ? `<button class="tm-action secondary" data-next="${next.id}">Continue to ${escape(TRAILMARK_DISTRICTS.find((d) => d.id === next.id).name)} →</button>`
      : `<div class="tm-gate">The harbor is whole again. Export your journal, or start a new restoration.</div>`;
  }
  $("detail").innerHTML =
    `<p class="tm-detail-label">Commission ${String(QUESTS.findIndex((v) => v.id === q.id) + 1).padStart(2, "0")} · ${escape(q.status)}</p><h3>${escape(q.title)}</h3><p class="tm-description">${escape(q.description)}</p>${q.objectives.map((o) => `<div class="tm-objective"><div class="tm-objective-top"><span>${o.complete ? "✓ " : ""}${escape(o.title)}</span><span>${o.count} / ${o.target}</span></div><div class="tm-objective-track"><div style="width:${(o.count / o.target) * 100}%"></div></div></div>`).join("")}<div class="tm-actions">${controls}</div>${q.receipt ? `<p class="tm-claim-note">Receipt ${escape(q.receipt.id)}<br>${q.status === "claimed" ? "Claim recorded. This receipt cannot be claimed again in this journal history." : "Completion recorded. The next commission is now available."}</p>` : ""}`;
  world?.setState({ quests: views, selected });
  for (const d of TRAILMARK_DISTRICTS) {
    const pin = $(`pin-${d.id}`);
    if (pin) {
      pin.classList.toggle("selected", d.id === selected);
      pin.classList.toggle("done", !!views.find((q) => q.id === d.id).receipt);
      pin.setAttribute("aria-pressed", String(d.id === selected));
    }
  }
}
$("quests").addEventListener("click", (e) => {
  const button = e.target.closest("[data-quest]");
  if (button) choose(button.dataset.quest);
});
$("detail").addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button || button.disabled) return;
  if (button.dataset.activate) {
    journal.activate(button.dataset.activate);
    addTrace(`<em>activate</em> ${escape(selected)}`);
    notify(
      "Commission accepted. Every matching action now advances this objective.",
    );
  }
  if (button.dataset.action !== undefined) {
    const a = ACTIONS[selected][Number(button.dataset.action)];
    lastEvent = { id: crypto.randomUUID(), type: a.type, tags: a.tags };
    const result = journal.dispatch(lastEvent);
    $("replay").disabled = false;
    addTrace(
      `<em>${escape(a.type)}</em> [${a.tags.map(escape).join(", ")}] → ${result.changes.map((c) => `${c.after}/${c.target}`).join(", ")}`,
    );
    notify(
      result.completed.length
        ? `${QUESTS.find((q) => q.id === selected).title} is complete. A receipt is ready to claim.`
        : `${a.label.replace(/ \+1/, "")} recorded. Progress saved.`,
    );
    if (result.completed.length)
      addTrace(`<em>complete</em> ${escape(result.completed[0].id)}`);
  }
  if (button.dataset.claim) {
    const r = journal.claim(button.dataset.claim);
    if (r) {
      addTrace(`<em>claim</em> ${escape(r.id)}`);
      notify(
        "Completion receipt claimed and saved. Select the next district to continue.",
      );
    }
  }
  if (button.dataset.next) selected = button.dataset.next;
  render();
  save();
});
$("replay").addEventListener("click", () => {
  if (!lastEvent) return;
  const r = journal.dispatch(lastEvent);
  addTrace(
    `<em>${r.duplicate ? "duplicate ignored" : "accepted"}</em> ${escape(lastEvent.type)} · no new progress`,
  );
  notify(
    r.duplicate
      ? "Same event ID replayed: the journal rejected it without changing counters or receipts."
      : "The event ID was outside the retention window and was accepted again.",
  );
  render();
});
$("export").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(journal.snapshot(), null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "trailmark-harbor-save.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Journal exported with progress, receipts, and retained event IDs.");
});
$("load").addEventListener("click", () => $("save-file").click());
$("save-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000)
      throw new Error("Save must be smaller than 2 MB");
    const input = JSON.parse(await file.text());
    journal.restore(input);
    lastEvent = null;
    $("replay").disabled = true;
    selected =
      journal
        .list()
        .find((q) => q.status === "active" || q.status === "available")?.id ??
      "beacon";
    trace = [];
    addTrace("<em>restore</em> Validated version 1 snapshot");
    render();
    save();
    notify("Save loaded. Completed and claimed commissions remain recorded.");
  } catch (error) {
    notify(
      `Could not load this save: ${error.message}. Current progress is unchanged.`,
    );
  } finally {
    e.target.value = "";
  }
});
$("reset").addEventListener("click", () => {
  journal = createJournal(QUESTS, config);
  selected = "supplies";
  lastEvent = null;
  trace = [];
  $("replay").disabled = true;
  addTrace("<em>reset</em> A new journal history begins");
  render();
  save();
  notify(
    "A fresh tide, a new journal. Accept the first commission at Driftwood Landing.",
  );
});
$("camera-reset").addEventListener("click", () => {
  if (stage) {
    stage.camera.position.set(30, 28, 35);
    stage.controls.target.set(0, 2, 0);
    stage.controls.update();
  }
});
try {
  stage = createStage($("harbor"));
  world = createTrailmarkScene(stage, {
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  stage.setActive(world);
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  let start = null;
  $("harbor").addEventListener("pointerdown", (e) => {
    start = [e.clientX, e.clientY];
  });
  $("harbor").addEventListener("pointerup", (e) => {
    if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6)
      return;
    const rect = $("harbor").getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, stage.camera);
    const hit = raycaster.intersectObjects(world.pickables)[0];
    if (hit) choose(hit.object.userData.district);
  });
  for (const [i, d] of TRAILMARK_DISTRICTS.entries()) {
    const button = document.createElement("button");
    button.id = `pin-${d.id}`;
    button.className = "tm-pin";
    button.innerHTML = `<span>${i + 1}</span>${escape(d.name)}`;
    button.addEventListener("click", () => choose(d.id));
    $("district-labels").append(button);
  }
  const point = new THREE.Vector3();
  function project() {
    frame = requestAnimationFrame(project);
    if (document.hidden) return;
    const rect = $("world").getBoundingClientRect();
    for (const d of TRAILMARK_DISTRICTS) {
      point.set(...d.position).project(stage.camera);
      const pin = $(`pin-${d.id}`);
      pin.style.left = `${Math.max(65, Math.min(rect.width - 65, (point.x * 0.5 + 0.5) * rect.width))}px`;
      pin.style.top = `${Math.max(145, Math.min(rect.height - 85, (-point.y * 0.5 + 0.5) * rect.height))}px`;
      pin.hidden = point.z > 1;
    }
  }
  project();
} catch (error) {
  $("error").hidden = false;
  $("error").textContent =
    "The 3D harbor could not start on this device. The restoration journal still works: select a district on the board and accept its commission.";
  $("camera-reset").disabled = true;
}
render();
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  cancelAnimationFrame(frame);
  stage?.dispose();
});
