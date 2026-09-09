import { createStage } from "./scene.js";
import { createPipelineScene } from "./pipeline-scenes.js";
import {
  evaluateStats,
  Ledger,
  compareLoadouts,
} from "./packages/ledger/index.js";
import { migrateSave, diffSaves } from "./packages/keepsake/index.js";
import { auditAssets } from "./packages/sift/index.js";
import {
  ledgerBase,
  loadouts,
  memories,
  memoryConfig,
  cargoInput,
} from "./pipeline-fixtures.js";

const $ = (s) => document.querySelector(s),
  kind = document.body.dataset.tool,
  abort = new AbortController();
const on = (selector, event, fn) =>
  $(selector)?.addEventListener(event, fn, { signal: abort.signal });
const json = (value) => JSON.stringify(value, null, 2),
  say = (text) => ($("#notice").textContent = text);
let stage,
  world,
  output,
  paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
function metrics(items) {
  $("#metrics").replaceChildren(
    ...items.map(([label, value]) => {
      const d = document.createElement("div");
      d.className = "metric";
      const s = document.createElement("span"),
        b = document.createElement("strong");
      s.textContent = label;
      b.textContent = value;
      d.append(s, b);
      return d;
    }),
  );
}
function rows(selector, data) {
  $(selector).replaceChildren(
    ...data.map((cells) => {
      const tr = document.createElement("tr");
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.append(td);
      }
      return tr;
    }),
  );
}
function publish(value) {
  output = value;
  $("#json").textContent = json(value);
}
function paragraph(parent, label, value, total = false) {
  const p = document.createElement("p");
  if (total) p.className = "total";
  const a = document.createElement("span"),
    b = document.createElement("strong");
  a.textContent = label;
  b.textContent = value;
  p.append(a, b);
  parent.append(p);
}
try {
  stage = createStage($("#scene"));
  world = createPipelineScene(stage, kind);
  stage.setActive(world);
  world.setPaused(paused);
} catch (error) {
  $("#error").textContent =
    `The 3D view could not start. The headless workbench below still works. ${error.message}`;
  $("#error").hidden = false;
  stage?.dispose();
  stage = null;
}
const camera = stage?.camera.position.clone(),
  target = stage?.controls.target.clone();
const pause = () => {
  $("#pause").setAttribute("aria-pressed", String(paused));
  $("#pause").textContent = paused ? "Resume motion" : "Pause motion";
  world?.setPaused(paused);
};
pause();
on("#pause", "click", () => {
  paused = !paused;
  pause();
});
on("#camera", "click", () => {
  if (stage) {
    stage.camera.position.copy(camera);
    stage.controls.target.copy(target);
    stage.controls.update();
  }
});
on("#download", "click", () => {
  const url = URL.createObjectURL(
      new Blob([json(output)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `${kind}-${kind === "keepsake" ? "save" : "report"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
async function importJSON(target, limit = 2 * 1024 * 1024) {
  const file = $("#file").files[0];
  $("#file").value = "";
  if (!file) return;
  try {
    if (file.size > limit) throw Error("File exceeds the 2 MiB limit");
    const text = await file.text();
    JSON.parse(text);
    $(target).value = text;
    $(target).dispatchEvent(new Event("input"));
    say("JSON imported locally. Review it, then run the workbench.");
  } catch (e) {
    say(`Import failed: ${e.message}`);
  }
}
on("#import", "click", () => $("#file").click());

if (kind === "ledger") {
  let ledger;
  function restore() {
    ledger = new Ledger({
      base: ledgerBase,
      modifiers: loadouts[$("#preset").value].modifiers,
      rounding: 2,
    });
    $("#buff").value = "0";
    sync();
    say(loadouts[$("#preset").value].description);
  }
  function sync() {
    const result = ledger.result;
    publish(result);
    world?.setState(result.values);
    metrics(Object.entries(result.values).map(([k, v]) => [k, v]));
    const sources = [
      ...new Set(ledger.snapshot().modifiers.map((m) => m.source)),
    ];
    $("#source").replaceChildren(...sources.map((s) => new Option(s, s)));
    $("#remove-source").disabled = !sources.length;
    const e = result.explanations[$("#stat").value],
      r = $("#receipt");
    r.replaceChildren();
    paragraph(r, "Base", e.base);
    paragraph(r, "Flat bonuses", `+ ${e.flat}`);
    paragraph(r, "Additive bonus", `${(e.additivePercent * 100).toFixed(0)}%`);
    paragraph(r, "Multipliers", `× ${e.multiplier}`);
    paragraph(r, "Final value", e.value, true);
    for (const m of e.sources) paragraph(r, `${m.source} / ${m.kind}`, m.value);
    $("#buff-label").textContent = `${$("#buff").value}%`;
  }
  on("#preset", "change", restore);
  on("#reset-loadout", "click", restore);
  on("#stat", "change", sync);
  on("#remove-source", "click", () => {
    const s = $("#source").value;
    ledger.removeSource(s);
    if (s === "rally") $("#buff").value = "0";
    sync();
    say(`Removed every modifier from ${s}.`);
  });
  on("#buff", "input", () => {
    ledger.setModifier({
      id: "rally",
      source: "rally",
      stat: "attack",
      kind: "additivePercent",
      value: Number($("#buff").value) / 100,
    });
    sync();
  });
  rows(
    "#comparison",
    compareLoadouts(
      { base: ledgerBase, rounding: 2 },
      Object.entries(loadouts).map(([id, p]) => ({
        id,
        modifiers: p.modifiers,
      })),
    ).map((r) => [
      loadouts[r.id].name,
      r.values.attack,
      r.values.speed,
      r.values.reach,
    ]),
  );
  restore();
} else if (kind === "keepsake") {
  let active = migrateSave(memories.current, memoryConfig).save,
    candidate = null;
  function showActive() {
    publish(active);
    world?.setState({
      islands: active.payload.world.islands,
      sky: active.payload.world.sky,
      gold: active.payload.wallet.gold,
    });
    metrics([
      ["Gold", active.payload.wallet.gold],
      ["Islands", active.payload.world.islands],
      ["Schema", active.version],
    ]);
  }
  function invalidate() {
    candidate = null;
    $("#apply").disabled = true;
    $("#migration-status").textContent =
      "Changed input. Preview again before restoring.";
    $("#steps").replaceChildren();
    rows("#changes", []);
  }
  function preview() {
    candidate = null;
    $("#apply").disabled = true;
    const text = $("#save-input").value;
    if (new TextEncoder().encode(text).length > 2 * 1024 * 1024) {
      say("Save exceeds 2 MiB.");
      return;
    }
    const r = migrateSave(text, memoryConfig);
    $("#steps").replaceChildren();
    rows("#changes", []);
    if (!r.ok) {
      $("#migration-status").textContent =
        `${r.error.code}: ${r.error.message}. Active world preserved.`;
      return;
    }
    candidate = r.save;
    $("#apply").disabled = false;
    $("#migration-status").textContent =
      `Valid candidate: schema ${r.fromVersion} → ${r.save.version}. Review changes, then restore.`;
    for (const step of r.trace) {
      const li = document.createElement("li");
      li.textContent = `Schema ${step.from} → ${step.to} · validated`;
      $("#steps").append(li);
    }
    if (!r.trace.length) {
      const li = document.createElement("li");
      li.textContent = "Already current · validated";
      $("#steps").append(li);
    }
    rows(
      "#changes",
      diffSaves(JSON.parse(text).payload, r.save.payload).changes.map((c) => [
        c.path,
        Object.hasOwn(c, "before") ? json(c.before) : "—",
        Object.hasOwn(c, "after") ? json(c.after) : "—",
      ]),
    );
  }
  function choose() {
    $("#save-input").value = json(memories[$("#memory").value]);
    invalidate();
    preview();
  }
  on("#memory", "change", choose);
  on("#save-input", "input", invalidate);
  on("#preview", "click", preview);
  on("#file", "change", () => importJSON("#save-input"));
  on("#apply", "click", () => {
    if (!candidate) return;
    active = structuredClone(candidate);
    candidate = null;
    $("#apply").disabled = true;
    showActive();
    say(
      "Candidate restored. This world is local to this page; download the save to keep it.",
    );
  });
  showActive();
  choose();
} else {
  let input = cargoInput(),
    report;
  function sync() {
    report = auditAssets(input);
    const selected = $("#asset").value;
    $("#asset").replaceChildren(
      ...[...new Set(input.manifest.map((a) => a.id))].map(
        (id) => new Option(id, id),
      ),
    );
    if (input.manifest.some((a) => a.id === selected))
      $("#asset").value = selected;
    publish(report);
    world?.setState({
      report,
      selected: ["clockwork-scout", "brass-atlas", "memory-gate"].indexOf(
        $("#asset").value,
      ),
      assetIds: input.manifest.map((a) => a.id),
    });
    metrics([
      ["Assets", report.summary.assets],
      ["Errors", report.summary.errors],
      ["Warnings", report.summary.warnings],
    ]);
    const relevant = report.findings.filter(
        (f) => f.assetId === $("#asset").value,
      ),
      r = $("#findings");
    r.replaceChildren();
    if (!relevant.length)
      paragraph(
        r,
        "Selected asset",
        input.manifest.length ? "Passed" : "No assets",
        true,
      );
    for (const f of relevant) {
      const p = document.createElement("p");
      p.className = "finding";
      p.textContent = f.code.replaceAll("_", " ");
      const s = document.createElement("small");
      s.textContent = `${f.field}: ${json(f.actual)} · expected ${json(f.expected)}`;
      p.append(s);
      r.append(p);
    }
    rows(
      "#report-rows",
      report.findings.length
        ? report.findings.map((f) => [
            f.assetId,
            f.code,
            json(f.actual),
            json(f.expected),
          ])
        : [["All assets", "PASS", "Within policy", "Ready"]],
    );
    say(
      report.ok
        ? "Shipment passes the current policy."
        : "Shipment blocked. Inspect the findings before shipping.",
    );
  }
  function fixture(corrected) {
    input = cargoInput(corrected, Number($("#budget").value));
    $("#audit-input").value = json(input);
    sync();
  }
  on("#original", "click", () => fixture(false));
  on("#corrected", "click", () => fixture(true));
  on("#asset", "change", sync);
  on("#budget", "input", () => {
    const budget = Number($("#budget").value);
    $("#budget-label").textContent = `${budget.toLocaleString()} bytes`;
    input.policy = {
      ...input.policy,
      budgets: { ...input.policy?.budgets, bytes: budget },
    };
    $("#audit-input").value = json(input);
    sync();
  });
  on("#audit", "click", () => {
    try {
      const text = $("#audit-input").value;
      if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
        throw Error("Input exceeds 2 MiB");
      const next = JSON.parse(text);
      auditAssets(next);
      input = next;
      sync();
    } catch (e) {
      say(`Invalid input: ${e.message}. Last valid report retained.`);
    }
  });
  on("#file", "change", () => importJSON("#audit-input"));
  fixture(false);
}
addEventListener(
  "pagehide",
  (event) => {
    if (event.persisted) {
      paused = true;
      pause();
      return;
    }
    abort.abort();
    stage?.dispose();
  },
  { signal: abort.signal },
);
