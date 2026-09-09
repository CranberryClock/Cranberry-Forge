import test from "node:test";
import assert from "node:assert/strict";
import {
  createParcel,
  validateTable,
  ParcelError,
  LIMITS,
} from "../dist/packages/parcel/index.js";
const table = () => ({
  id: "salvage",
  entries: [
    { id: "dust", itemId: "dust", rarity: "common", weight: 9, min: 2, max: 4 },
    { id: "star", itemId: "star", rarity: "legendary", weight: 1 },
  ],
  pity: { after: 4, rarities: ["legendary"] },
});
test("Parcel's versioned seeded sequence and quantity endpoints are stable", () => {
  const result = createParcel(table(), { seed: 42 }).open(8);
  assert.deepEqual(
    result.receipts.map((r) => [r.entryId, r.quantity, r.guaranteed]),
    [
      ["dust", 3, false],
      ["dust", 4, false],
      ["dust", 2, false],
      ["star", 1, true],
      ["dust", 2, false],
      ["dust", 3, false],
      ["dust", 4, false],
      ["star", 1, true],
    ],
  );
  assert.equal(result.receipts[7].id, "salvage:8");
  assert.equal(result.snapshot.draws, 16);
  assert.notDeepEqual(
    createParcel(table(), { seed: 0 }).open(8).receipts,
    result.receipts,
  );
});
test("batch, individual calls and restored continuation produce identical receipts", () => {
  const a = createParcel(table(), { seed: 9 }),
    b = createParcel(table(), { seed: 9 });
  const batch = a.open(100),
    individual = Array.from({ length: 100 }, () => b.roll().receipt);
  assert.deepEqual(batch.receipts, individual);
  assert.deepEqual(a.snapshot(), b.snapshot());
  const restored = createParcel(table(), {
    snapshot: JSON.parse(JSON.stringify(batch.snapshot)),
  });
  assert.deepEqual(restored.open(100), a.open(100));
});
test("hard pity changes only the guarantee roll and natural qualifying drops reset it", () => {
  const p = createParcel(table(), { seed: 42 });
  assert.deepEqual(
    p.odds().entries.map((e) => e.probability),
    [0.9, 0.1],
  );
  p.open(3);
  assert.equal(p.odds().remaining, 1);
  assert.equal(p.odds().guaranteed, true);
  assert.deepEqual(
    p.odds().entries.map((e) => e.probability),
    [0, 1],
  );
  const receipt = p.roll().receipt;
  assert.equal(receipt.probability, 1);
  assert.equal(receipt.baseProbability, 0.1);
  assert.equal(receipt.missesBefore, 3);
  assert.equal(receipt.missesAfter, 0);
  assert.equal(p.odds().remaining, 4);
  const natural = createParcel(table(), { seed: 9 }).open(4).receipts;
  assert.equal(natural[2].rarity, "legendary");
  assert.equal(natural[2].guaranteed, false);
  assert.equal(natural[2].missesAfter, 0);
  assert.equal(natural[3].guaranteed, false);
});
test("pity uses weighted qualifying rarities, zero-weight entries never drop", () => {
  const definition = {
    id: "forced",
    entries: [
      { id: "dust", itemId: "dust", rarity: "common", weight: 6 },
      { id: "a", itemId: "a", rarity: "epic", weight: 3 },
      { id: "b", itemId: "b", rarity: "legendary", weight: 1 },
      { id: "off", itemId: "off", rarity: "legendary", weight: 0 },
    ],
    pity: { after: 1, rarities: ["epic", "legendary"] },
  };
  const p = createParcel(definition, { seed: 42 });
  assert.deepEqual(
    p.odds().entries.map((e) => e.probability),
    [0, 0.75, 0.25, 0],
  );
  const receipts = p.open(1000).receipts;
  assert.ok(
    receipts.every(
      (r) =>
        ["a", "b"].includes(r.entryId) && r.guaranteed && r.missesAfter === 0,
    ),
  );
  assert.ok(
    receipts.some((r) => r.entryId === "a") &&
      receipts.some((r) => r.entryId === "b"),
  );
});
test("table validation rejects malformed, recursive and impossible configurations", () => {
  for (const bad of [
    null,
    [],
    { ...table(), surprise: true },
    { ...table(), entries: new Array(2) },
    { ...table(), entries: [table().entries[0], table().entries[0]] },
    { ...table(), entries: [{ ...table().entries[0], weight: 0 }] },
    { ...table(), entries: [{ ...table().entries[0], weight: 0.5 }] },
    { ...table(), entries: [{ ...table().entries[0], min: 4, max: 3 }] },
    { ...table(), entries: [{ ...table().entries[0], table: table() }] },
    { ...table(), pity: { after: 0, rarities: ["legendary"] } },
    { ...table(), pity: { after: 4, rarities: ["missing"] } },
    { ...table(), pity: { after: 4, rarities: ["legendary", "legendary"] } },
  ])
    assert.throws(() => validateTable(bad), ParcelError);
  for (const seed of [-1, 4294967296, 1.5, "42"])
    assert.throws(() => createParcel(table(), { seed }), ParcelError);
});
test("bad snapshot restore is atomic and explicit falsy saves never reset progress", () => {
  const p = createParcel(table(), { seed: 42 });
  p.open(3);
  const before = p.snapshot();
  for (const value of [
    null,
    undefined,
    false,
    0,
    "",
    JSON.stringify(before),
    [],
    {},
  ]) {
    assert.throws(() => p.restore(value), ParcelError);
    assert.throws(
      () => createParcel(table(), { snapshot: value }),
      ParcelError,
    );
    assert.deepEqual(p.snapshot(), before);
  }
  for (const mutate of [
    (s) => s.version++,
    (s) => (s.tableKey += " "),
    (s) => s.rngState++,
    (s) => (s.draws = 1),
    (s) => (s.misses = 4),
    (s) => (s.rolls = -1),
    (s) => (s.extra = true),
  ]) {
    const bad = structuredClone(before);
    mutate(bad);
    assert.throws(() => p.restore(bad), ParcelError);
    assert.deepEqual(p.snapshot(), before);
  }
  assert.throws(
    () => createParcel(table(), { seed: 1, snapshot: before }),
    ParcelError,
  );
  const changed = table();
  changed.entries[0].weight++;
  assert.throws(() => createParcel(changed, { snapshot: before }), ParcelError);
});
test("returned data and input definitions are detached from live random state", () => {
  const input = table(),
    p = createParcel(input, { seed: 42 });
  input.entries[0].weight = 100;
  const odds = p.odds();
  odds.entries[0].weight = 0;
  assert.equal(p.odds().entries[0].weight, 9);
  const result = p.roll(),
    saved = p.snapshot();
  result.receipt.quantity = 900;
  result.snapshot.rolls = 900;
  assert.deepEqual(p.snapshot(), saved);
  const snapshot = p.snapshot();
  p.restore(snapshot);
  snapshot.misses = 900;
  assert.deepEqual(p.snapshot(), saved);
});
test("invalid batches and an exhausted RNG leave all partial rolls uncommitted", () => {
  const p = createParcel(table());
  for (const count of [0, -1, 1.5, LIMITS.batch + 1, "2", null]) {
    const before = p.snapshot();
    assert.throws(() => p.open(count), ParcelError);
    assert.deepEqual(p.snapshot(), before);
  }
  const save = p.snapshot();
  save.draws = LIMITS.draws - 2;
  save.rolls = 20000000;
  save.rngState = (save.seed + Math.imul(save.draws, 0x6d2b79f5)) >>> 0;
  p.restore(save);
  const before = p.snapshot();
  assert.throws(
    () => p.open(2),
    (e) => e.code === "LIMIT_REACHED",
  );
  assert.deepEqual(p.snapshot(), before);
});
test("unpityed seeded distribution matches declared weights within a coarse fixed bound", () => {
  const input = table();
  input.pity = null;
  const p = createParcel(input, { seed: 42 }),
    result = p.open(10000);
  const rare = result.receipts.filter((r) => r.rarity === "legendary").length;
  assert.ok(rare > 850 && rare < 1150, `${rare} legendary rolls`);
  assert.ok(result.receipts.every((r) => !r.guaranteed && r.missesAfter === 0));
  assert.equal(p.odds().remaining, null);
  assert.equal(
    result.receipts.reduce((n, r) => n + r.probability, 0) > 0,
    true,
  );
});
