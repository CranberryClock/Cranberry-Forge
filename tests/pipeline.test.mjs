import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  evaluateStats,
  Ledger,
  compareLoadouts,
} from "../dist/packages/ledger/index.js";
import {
  createSave,
  migrateSave,
  diffSaves,
} from "../dist/packages/keepsake/index.js";
import { auditAssets } from "../dist/packages/sift/index.js";
import { auditFiles } from "../dist/packages/sift/node.js";
const mods = [
  { id: "a", source: "sword", stat: "attack", kind: "flat", value: 10 },
  {
    id: "b",
    source: "sword",
    stat: "attack",
    kind: "additivePercent",
    value: 0.2,
  },
  { id: "c", source: "charm", stat: "attack", kind: "multiplier", value: 1.1 },
];
test("Ledger arithmetic is explained and independent of insertion order", () => {
  const result = evaluateStats({
    base: { attack: 50 },
    modifiers: mods,
    rounding: 2,
  });
  assert.equal(result.values.attack, 79.2);
  assert.equal(result.explanations.attack.afterFlat, 60);
  assert.equal(result.explanations.attack.afterAdditive, 72);
  assert.deepEqual(
    result,
    evaluateStats({
      base: { attack: 50 },
      modifiers: mods.toReversed(),
      rounding: 2,
    }),
  );
});
test("Ledger removes equipment atomically, replaces IDs and rejects invalid updates", () => {
  const ledger = new Ledger({
    base: { attack: 50 },
    modifiers: mods,
    rounding: 2,
  });
  assert.equal(ledger.removeSource("sword").values.attack, 55);
  assert.equal(ledger.setModifier({ ...mods[2], value: 2 }).values.attack, 100);
  const snapshot = ledger.snapshot();
  snapshot.base.attack = 999;
  assert.throws(() => ledger.setModifier({ ...mods[0], stat: "unknown" }));
  assert.equal(ledger.result.values.attack, 100);
});
test("Ledger bounds survive rounding; zero, negative and overflow inputs have explicit behavior", () => {
  assert.equal(
    evaluateStats({
      base: { x: 2.999 },
      bounds: { x: { max: 2.999 } },
      rounding: 0,
    }).values.x,
    2.999,
  );
  assert.equal(evaluateStats({ base: { x: -2 } }).values.x, -2);
  assert.equal(
    evaluateStats({
      base: { attack: 50 },
      modifiers: [{ ...mods[2], value: 0 }],
    }).values.attack,
    0,
  );
  assert.throws(() => evaluateStats({ base: { attack: Infinity } }));
  assert.throws(() =>
    evaluateStats({
      base: { attack: Number.MAX_VALUE },
      modifiers: [{ ...mods[2], value: 2 }],
    }),
  );
  assert.throws(() =>
    evaluateStats({ base: { attack: 50 }, modifiers: [mods[0], mods[0]] }),
  );
  assert.throws(() =>
    evaluateStats({ base: { x: 1 }, bounds: { x: { min: 3, max: 2 } } }),
  );
});
test("Ledger batch evaluation does not leak state between loadouts or special stat names", () => {
  const result = compareLoadouts({ base: { attack: 50 } }, [
    { id: "bare", modifiers: [] },
    { id: "sword", modifiers: mods },
  ]);
  assert.equal(result[0].values.attack, 50);
  assert.ok(result[1].values.attack > 79);
  const special = evaluateStats({ base: JSON.parse('{"__proto__":7}') });
  assert.equal(special.values.__proto__, 7);
  assert.equal({}.polluted, undefined);
});
const config = {
  format: "test",
  targetVersion: 2,
  migrations: {
    0: (p) => ({ gold: p.coins }),
    1: (p) => ({ wallet: { gold: p.gold } }),
  },
  validators: {
    0: (p) => Number.isFinite(p?.coins),
    1: (p) => Number.isFinite(p?.gold),
    2: (p) => Number.isFinite(p?.wallet?.gold),
  },
};
test("Keepsake migrates and validates each version without mutating input", () => {
  const input = createSave("test", 0, { coins: 8 }),
    copy = structuredClone(input);
  const result = migrateSave(input, config);
  assert.equal(result.ok, true);
  assert.deepEqual(result.save.payload, { wallet: { gold: 8 } });
  assert.deepEqual(result.trace, [
    { from: 0, to: 1 },
    { from: 1, to: 2 },
  ]);
  assert.deepEqual(input, copy);
  assert.equal(migrateSave(result.save, config).trace.length, 0);
});
test("Keepsake preflights missing steps and rejects future / wrong format saves", () => {
  let calls = 0;
  const r = migrateSave(createSave("test", 0, { coins: 1 }), {
    ...config,
    migrations: {
      0: () => {
        calls++;
        return {};
      },
    },
  });
  assert.equal(r.error.code, "MISSING_MIGRATION");
  assert.equal(calls, 0);
  assert.equal(
    migrateSave(createSave("test", 3, {}), config).error.code,
    "FUTURE_VERSION",
  );
  assert.equal(
    migrateSave(createSave("other", 0, {}), config).error.code,
    "WRONG_FORMAT",
  );
});
test("Keepsake preserves originals across throwing transforms and validator mutations", () => {
  const input = createSave("test", 0, { coins: 8 });
  const result = migrateSave(input, {
    ...config,
    migrations: {
      ...config.migrations,
      0: (p) => {
        p.coins = 0;
        throw Error("failed");
      },
    },
  });
  assert.equal(result.error.code, "MIGRATION_FAILED");
  assert.equal(input.payload.coins, 8);
  const r = migrateSave(input, {
    ...config,
    validators: {
      ...config.validators,
      0: (p) => {
        p.coins = 99;
        return true;
      },
    },
  });
  assert.equal(r.save.payload.wallet.gold, 8);
  const invalid = migrateSave(input, {
    ...config,
    migrations: { ...config.migrations, 0: () => ({ gold: "bad" }) },
  });
  assert.equal(invalid.error.version, 1);
  assert.equal(invalid.ok, false);
});
test("Keepsake rejects non-JSON, prototype keys, missing validators and async callbacks", () => {
  assert.throws(() => createSave("test", 0, { x: NaN }));
  assert.throws(() => createSave("test", 0, JSON.parse('{"__proto__":{}}')));
  assert.equal(migrateSave("broken", config).error.code, "INVALID_JSON");
  assert.equal(
    migrateSave(createSave("test", 0, { coins: 1 }), {
      ...config,
      validators: {},
    }).error.code,
    "MISSING_VALIDATOR",
  );
  assert.equal(
    migrateSave(createSave("test", 0, { coins: 1 }), {
      ...config,
      migrations: { ...config.migrations, 0: async () => ({ gold: 1 }) },
    }).error.code,
    "MIGRATION_FAILED",
  );
});
test("Keepsake diff uses JSON pointers, distinguishes absent vs null and reports truncation", () => {
  const d = diffSaves({ "a/b": 1, old: null }, { "a/b": 2, new: null });
  assert.deepEqual(
    d.changes.map((c) => [c.path, c.kind]),
    [
      ["/a~1b", "replace"],
      ["/new", "add"],
      ["/old", "remove"],
    ],
  );
  assert.equal(
    diffSaves({ a: 1, b: 2 }, { a: 3, b: 4 }, { limit: 1 }).truncated,
    true,
  );
});
test("Sift finds missing references, duplicate IDs and unsupported extensions", () => {
  const report = auditAssets({
    manifest: [
      { id: "tree", dependencies: ["missing"], requiredExtensions: ["X"] },
      { id: "tree" },
    ],
    policy: { allowedExtensions: [] },
  });
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.findings.map((f) => f.code),
    ["DUPLICATE_ID", "MISSING_REFERENCE", "UNSUPPORTED_EXTENSION"],
  );
});
test("Sift exact budgets pass; unavailable metrics never silently pass", () => {
  const input = {
    manifest: [{ id: "tree" }],
    metrics: { tree: { bytes: 100 } },
    policy: { budgets: { bytes: 100, triangles: 100 } },
  };
  const r = auditAssets(input);
  assert.equal(r.findings[0].code, "MISSING_METRIC");
  assert.equal(r.ok, false);
  const w = auditAssets({
    ...input,
    policy: { ...input.policy, missingMetrics: "warning" },
  });
  assert.equal(w.ok, true);
  assert.equal(w.summary.warnings, 1);
  assert.throws(() =>
    auditAssets({ ...input, metrics: { tree: { bytes: NaN } } }),
  );
});
test("Sift reports stable order and does not mutate manifests or metrics", () => {
  const input = {
    manifest: [{ id: "b" }, { id: "a" }],
    metrics: { b: { bytes: 9 }, a: { bytes: 8 } },
    policy: { budgets: { bytes: 1 } },
  };
  const before = structuredClone(input),
    r = auditAssets(input);
  assert.deepEqual(input, before);
  assert.deepEqual(
    r,
    auditAssets({ ...input, manifest: input.manifest.toReversed() }),
  );
});
test("Sift local adapter measures files and rejects symlink traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "sift-test-"));
  try {
    await writeFile(join(root, "asset.bin"), "hello");
    const r = await auditFiles(
      {
        manifest: [
          { id: "a", path: "asset.bin" },
          { id: "b", path: "gone.bin" },
        ],
        policy: { budgets: { bytes: 4 } },
      },
      { root },
    );
    assert.ok(
      r.findings.some((f) => f.code === "BUDGET_EXCEEDED" && f.actual === 5),
    );
    assert.ok(r.findings.some((f) => f.code === "MISSING_FILE"));
    await assert.rejects(() =>
      auditFiles(
        { manifest: [{ id: "escape", path: "../outside" }] },
        { root },
      ),
    );
    await symlink(tmpdir(), join(root, "outside"), "junction");
    await assert.rejects(() =>
      auditFiles(
        { manifest: [{ id: "escape", path: "outside" }] },
        { root },
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("Sift CLI has useful machine-readable exit codes", async () => {
  const root = await mkdtemp(join(tmpdir(), "sift-cli-")),
    path = join(root, "audit.json");
  const cli = resolve("dist/packages/sift/cli.mjs");
  try {
    for (const [input, status] of [
      [{ manifest: [] }, 0],
      [{ manifest: [{ id: "a", dependencies: ["missing"] }] }, 1],
      [{ manifest: "bad" }, 2],
    ]) {
      await writeFile(path, JSON.stringify(input));
      const r = spawnSync(process.execPath, [cli, path], { encoding: "utf8" });
      assert.equal(r.status, status, r.stderr);
      assert.equal(JSON.parse(r.stdout).ok, status === 0);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
