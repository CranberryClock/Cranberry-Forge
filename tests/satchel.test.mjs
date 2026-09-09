import test from "node:test";
import assert from "node:assert/strict";
import { Inventory } from "@cranberry-forge/satchel";
const catalog = [
  { id: "ore", maxStack: 5, weight: 1 },
  { id: "rod", width: 1, height: 3, weight: 2 },
  { id: "tool", width: 2, height: 2, weight: 3 },
];
test("Satchel stacks automatically and returns detached state", () => {
  const p = new Inventory({ catalog });
  assert.ok(p.add("ore", 12).ok);
  assert.deepEqual(
    p.items.map((i) => i.quantity),
    [5, 5, 2],
  );
  assert.equal(p.weight, 12);
  const items = p.items;
  items[0].quantity = 100;
  assert.equal(p.count("ore"), 12);
  p.catalog[0].weight = 50;
  assert.equal(p.weight, 12);
});
test("failed adds and crafts preserve quantities, IDs and revision", () => {
  const p = new Inventory({ catalog, columns: 2, rows: 1, maxWeight: 20 });
  p.add("ore", 5);
  const before = p.toSnapshot(),
    revision = p.revision;
  assert.equal(p.add("ore", 20).reason, "weight-limit");
  assert.deepEqual(p.toSnapshot(), before);
  assert.equal(p.revision, revision);
  const recipe = {
    ingredients: [{ itemId: "ore", quantity: 5 }],
    outputs: [{ itemId: "tool", quantity: 1 }],
  };
  assert.equal(p.craft(recipe).reason, "no-space");
  assert.deepEqual(p.toSnapshot(), before);
  assert.equal(p.revision, revision);
});
test("grid movement and rotation reject overlap without corrupting layout", () => {
  const p = new Inventory({ catalog, columns: 4, rows: 3 });
  p.add("rod");
  p.add("ore");
  const rod = p.items.find((i) => i.itemId === "rod");
  const before = p.toSnapshot();
  assert.equal(p.rotate(rod.id).reason, "blocked");
  assert.deepEqual(p.toSnapshot(), before);
  assert.ok(p.move(rod.id, 1, 2, true).ok);
  const cells = new Set();
  for (const entry of p.items) {
    const d = p.dimensions(entry);
    for (let y = entry.y; y < entry.y + d.height; y++)
      for (let x = entry.x; x < entry.x + d.width; x++) {
        assert.ok(!cells.has(`${x},${y}`));
        cells.add(`${x},${y}`);
      }
  }
});
test("splitting and merging conserve units across partial target fills", () => {
  const p = new Inventory({ catalog });
  p.add("ore", 9);
  const first = p.items[0];
  assert.ok(p.split(first.id, 2).ok);
  assert.equal(p.count("ore"), 9);
  const parts = p.items;
  assert.equal(p.merge(parts[2].id, parts[1].id).quantity, 1);
  assert.equal(p.count("ore"), 9);
  assert.equal(p.items.find((i) => i.id === parts[2].id).quantity, 1);
});
test("transfers commit both inventories before observers and fail atomically", () => {
  const a = new Inventory({ catalog }),
    b = new Inventory({ catalog, maxWeight: 3 });
  a.add("ore", 5);
  const original = a.toSnapshot();
  assert.equal(a.transfer(a.items[0].id, b, 4).reason, "weight-limit");
  assert.deepEqual(a.toSnapshot(), original);
  let observed = 0;
  a.subscribe(() => {
    assert.equal(a.count("ore") + b.count("ore"), 5);
    observed++;
  });
  assert.ok(a.transfer(a.items[0].id, b, 3).ok);
  assert.equal(observed, 1);
  assert.equal(a.count("ore"), 2);
  assert.equal(b.count("ore"), 3);
});
test("crafting frees input space and snapshots reject corrupt state", () => {
  const p = new Inventory({ catalog, columns: 2, rows: 2 });
  p.add("ore", 5);
  const recipe = {
    ingredients: [{ itemId: "ore", quantity: 5 }],
    outputs: [{ itemId: "tool", quantity: 1 }],
  };
  assert.ok(p.canCraft(recipe).ok);
  assert.equal(p.count("ore"), 5);
  assert.ok(p.craft(recipe).ok);
  assert.equal(p.count("tool"), 1);
  const saved = p.toSnapshot();
  assert.deepEqual(
    Inventory.fromSnapshot(JSON.stringify(saved), { catalog }).toSnapshot(),
    saved,
  );
  assert.throws(() =>
    Inventory.fromSnapshot(
      {
        ...saved,
        items: [...saved.items, { ...saved.items[0], id: "s999" }],
        nextId: 1000,
      },
      { catalog },
    ),
  );
  assert.throws(() =>
    Inventory.fromSnapshot({ ...saved, nextId: 1 }, { catalog }),
  );
  assert.throws(() =>
    Inventory.fromSnapshot(
      { ...saved, items: [{ ...saved.items[0], quantity: 5 }] },
      { catalog },
    ),
  );
});

test("ID exhaustion rolls back partial adds and preserves the final legal ID", () => {
  const maxId = 999999999999999,
    initial = new Inventory({ catalog });
  initial.add("ore", 4);
  const p = Inventory.fromSnapshot(
      { ...initial.toSnapshot(), nextId: maxId },
      { catalog },
    ),
    before = p.toSnapshot();
  let notifications = 0;
  p.subscribe(() => notifications++);
  assert.deepEqual(p.add("ore", 7), { ok: false, reason: "id-limit" });
  assert.deepEqual(p.toSnapshot(), before);
  assert.equal(p.revision, 0);
  assert.equal(notifications, 0);

  assert.ok(p.add("ore", 6).ok);
  assert.equal(p.items[1].id, `s${maxId}`);
  assert.equal(p.toSnapshot().nextId, maxId + 1);
  const restored = Inventory.fromSnapshot(JSON.stringify(p.toSnapshot()), {
    catalog,
  });
  assert.deepEqual(restored.toSnapshot(), p.toSnapshot());
  assert.equal(restored.add("ore").reason, "id-limit");
  restored.remove(restored.items[0].id, 1);
  assert.ok(restored.add("ore").ok);
  assert.equal(restored.toSnapshot().nextId, maxId + 1);
});

test("splitting can use the final ID and rejects exhaustion without mutation", () => {
  const initial = new Inventory({ catalog });
  initial.add("ore", 4);
  const p = Inventory.fromSnapshot(
    { ...initial.toSnapshot(), nextId: 999999999999999 },
    { catalog },
  );
  assert.deepEqual(p.split(p.items[0].id, 2), {
    ok: true,
    id: "s999999999999999",
    quantity: 2,
  });
  const before = p.toSnapshot(),
    revision = p.revision;
  assert.equal(p.split(p.items[0].id, 1).reason, "id-limit");
  assert.deepEqual(p.toSnapshot(), before);
  assert.equal(p.revision, revision);
  assert.deepEqual(
    Inventory.fromSnapshot(before, { catalog }).toSnapshot(),
    before,
  );
});

test("ID exhaustion leaves crafting and both sides of a transfer unchanged", () => {
  const initial = new Inventory({ catalog });
  initial.add("ore", 4);
  const target = Inventory.fromSnapshot(
      { ...initial.toSnapshot(), nextId: 1000000000000000 },
      { catalog },
    ),
    source = new Inventory({ catalog });
  source.add("ore", 2);
  const targetBefore = target.toSnapshot(),
    sourceBefore = source.toSnapshot(),
    sourceRevision = source.revision,
    recipe = {
      ingredients: [{ itemId: "ore", quantity: 1 }],
      outputs: [{ itemId: "rod", quantity: 1 }],
    };
  let notifications = 0;
  target.subscribe(() => notifications++);
  source.subscribe(() => notifications++);
  assert.equal(target.canCraft(recipe).reason, "id-limit");
  assert.equal(target.craft(recipe).reason, "id-limit");
  assert.equal(source.transfer(source.items[0].id, target).reason, "id-limit");
  assert.deepEqual(target.toSnapshot(), targetBefore);
  assert.deepEqual(source.toSnapshot(), sourceBefore);
  assert.equal(target.revision, 0);
  assert.equal(source.revision, sourceRevision);
  assert.equal(notifications, 0);
});

test("snapshots require explicit valid dimensions, weight limit and bounded IDs", () => {
  const saved = new Inventory({ catalog }).toSnapshot();
  for (const field of ["columns", "rows", "maxWeight"]) {
    const missing = { ...saved };
    delete missing[field];
    assert.throws(() => Inventory.fromSnapshot(missing, { catalog }));
    for (const invalid of [undefined, null, "4", -1, Infinity, NaN])
      assert.throws(() =>
        Inventory.fromSnapshot({ ...saved, [field]: invalid }, { catalog }),
      );
  }
  for (const invalid of [0, 1.5, 1000000000000001, Number.MAX_SAFE_INTEGER])
    assert.throws(() =>
      Inventory.fromSnapshot({ ...saved, nextId: invalid }, { catalog }),
    );
});
