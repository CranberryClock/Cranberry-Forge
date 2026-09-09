import test from "node:test";
import assert from "node:assert/strict";
import {
  Wayfinder,
  WayfinderError,
  LIMITS,
} from "../dist/packages/wayfinder/index.js";

test("deterministic tie-breaking routes around an obstacle in row-major order", () => {
  const grid = new Wayfinder({ width: 3, height: 3, diagonal: "never" });
  grid.setCell({ x: 1, z: 1 }, { blocked: true });
  const expected = [
    { x: 0, z: 1 },
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 0 },
    { x: 2, z: 1 },
  ];
  const first = grid.findPath({ x: 0, z: 1 }, { x: 2, z: 1 });
  assert.deepEqual(first.cells, expected);
  assert.equal(first.cost, 4);
  for (let i = 0; i < 5; i++)
    assert.deepEqual(grid.findPath({ x: 0, z: 1 }, { x: 2, z: 1 }), first);
});

test("cost is destination-weighted world distance, and a cheap detour beats an expensive shortcut", () => {
  const grid = new Wayfinder({
    width: 5,
    height: 3,
    diagonal: "never",
    cellSize: 2,
  });
  grid.setCells([1, 2, 3].map((x) => ({ x, z: 1, cost: 8 })));
  const route = grid.findPath({ x: 0, z: 1 }, { x: 4, z: 1 }, { y: 2.5 });
  assert.equal(route.cost, 12);
  assert.equal(route.cells.length, 7);
  assert.ok(route.cells.every((c) => grid.getCell(c).cost === 1));
  assert.ok(route.points.every((p) => p.y === 2.5));
  grid.setCell({ x: 0, z: 1 }, { cost: 100 });
  assert.equal(grid.findPath({ x: 0, z: 1 }, { x: 4, z: 1 }).cost, 12);
});

test("diagonal policies distinguish corner crossing and cardinal-only travel", () => {
  for (const policy of ["never", "no-cut", "always"]) {
    const grid = new Wayfinder({ width: 2, height: 2, diagonal: policy });
    grid.setCells([
      { x: 1, z: 0, blocked: true },
      { x: 0, z: 1, blocked: true },
    ]);
    const r = grid.findPath({ x: 0, z: 0 }, { x: 1, z: 1 });
    assert.equal(r.status, policy === "always" ? "found" : "unreachable");
    if (policy === "always") assert.equal(r.cost, Math.SQRT2);
  }
  const free = new Wayfinder({ width: 2, height: 2, diagonal: "never" });
  assert.equal(free.findPath({ x: 0, z: 0 }, { x: 1, z: 1 }).cost, 2);
});

test("world mapping uses a lower-inclusive, upper-exclusive XZ rectangle and cell centers", () => {
  const grid = new Wayfinder({
    width: 3,
    height: 2,
    origin: { x: -4, z: 10 },
    cellSize: 2,
  });
  assert.deepEqual(grid.worldToCell({ x: -4, z: 10 }), { x: 0, z: 0 });
  assert.deepEqual(grid.worldToCell({ x: -2, z: 12 }), { x: 1, z: 1 });
  assert.equal(grid.worldToCell({ x: 2, z: 10 }), null);
  assert.equal(grid.worldToCell({ x: -4.001, z: 10 }), null);
  assert.deepEqual(grid.cellToWorld({ x: 2, z: 1 }, 5), { x: 1, y: 5, z: 13 });
  assert.deepEqual(
    grid.findWorldPath({ x: -3, z: 11 }, { x: 1.99, z: 13.99 }).cells.at(-1),
    { x: 2, z: 1 },
  );
});

test("outcomes distinguish blocked endpoints, exhausted budget, impossible path, and a zero-step path", () => {
  const grid = new Wayfinder({ width: 4, height: 4 });
  const same = grid.findPath({ x: 0, z: 0 }, { x: 0, z: 0 }, { maxVisited: 1 });
  assert.equal(same.status, "found");
  assert.equal(same.cost, 0);
  assert.equal(same.cells.length, 1);
  const capped = grid.findPath(
    { x: 0, z: 0 },
    { x: 3, z: 3 },
    { maxVisited: 1 },
  );
  assert.equal(capped.status, "budget-exceeded");
  assert.equal(capped.visited, 1);
  assert.deepEqual(capped.cells, []);
  assert.equal(capped.cost, null);
  grid.setCell({ x: 0, z: 0 }, { blocked: true });
  assert.equal(
    grid.findPath({ x: 0, z: 0 }, { x: 3, z: 3 }).status,
    "blocked-start",
  );
  assert.equal(
    grid.findPath({ x: 3, z: 3 }, { x: 0, z: 0 }).status,
    "blocked-goal",
  );
  assert.equal(
    grid.findPath({ x: -1, z: 0 }, { x: 3, z: 3 }).status,
    "outside-grid",
  );
  assert.equal(
    grid.findWorldPath({ x: 999, z: 0 }, { x: 0, z: 0 }).status,
    "outside-grid",
  );
});

test("batch edits are atomic, reject duplicate/sparse inputs, and revisions identify stale routes", () => {
  const grid = new Wayfinder({ width: 3, height: 3 });
  const r = grid.findPath({ x: 0, z: 0 }, { x: 2, z: 2 }),
    before = grid.snapshot();
  for (const edits of [
    [
      { x: 1, z: 1, blocked: true },
      { x: 8, z: 8, cost: 2 },
    ],
    [
      { x: 1, z: 1, cost: 3 },
      { x: 1, z: 1, blocked: true },
    ],
    new Array(1),
  ]) {
    assert.throws(() => grid.setCells(edits), WayfinderError);
    assert.deepEqual(grid.snapshot(), before);
  }
  assert.equal(
    grid.setCells([
      { x: 1, z: 1, blocked: true },
      { x: 0, z: 1, cost: 3 },
    ]),
    1,
  );
  assert.notEqual(r.revision, grid.revision);
  assert.equal(grid.setCell({ x: 1, z: 1 }, { blocked: true }), 1);
  assert.equal(grid.setCell({ x: 1, z: 1 }, { blocked: false }), 2);
});

test("snapshot round trips preserve exact routes and reject malformed state atomically", () => {
  const grid = new Wayfinder({ width: 4, height: 3 });
  grid.setCells([
    { x: 1, z: 1, blocked: true },
    { x: 2, z: 1, cost: 3.5 },
  ]);
  const save = grid.snapshot(),
    restored = Wayfinder.fromSnapshot(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(restored.snapshot(), save);
  assert.deepEqual(
    restored.findPath({ x: 0, z: 0 }, { x: 3, z: 2 }),
    grid.findPath({ x: 0, z: 0 }, { x: 3, z: 2 }),
  );
  for (const mutate of [
    (s) => {
      s.version = 2;
    },
    (s) => {
      s.cells = new Array(12);
    },
    (s) => {
      s.cells[1].cost = 0;
    },
    (s) => {
      s.cells[1].blocked = 1;
    },
    (s) => {
      s.cells.pop();
    },
    (s) => {
      s.revision = -1;
    },
    (s) => {
      s.config.width = 5;
    },
    (s) => {
      delete s.config.defaultCost;
    },
    (s) => {
      s.cells[0].unknown = true;
    },
  ]) {
    const bad = structuredClone(save);
    mutate(bad);
    assert.throws(() => grid.restore(bad), WayfinderError);
    assert.deepEqual(grid.snapshot(), save);
  }
  restored.config.origin.x = 90;
  restored.getCell({ x: 0, z: 0 }).cost = 9;
  assert.deepEqual(restored.snapshot(), save);
});

test("limits, malformed coordinates and exhausted revisions fail before mutation", () => {
  for (const options of [
    { width: 0, height: 2 },
    { width: LIMITS.dimension + 1, height: 1 },
    { width: 2, height: 2, cellSize: Infinity },
    { width: 2, height: 2, diagonal: "maybe" },
  ])
    assert.throws(() => new Wayfinder(options), WayfinderError);
  const grid = new Wayfinder({ width: 2, height: 2 });
  assert.throws(
    () => grid.findPath({ x: 0.2, z: 0 }, { x: 1, z: 1 }),
    WayfinderError,
  );
  assert.throws(
    () => grid.setCell({ x: 0, z: 0, cost: 4 }, { blocked: true }),
    WayfinderError,
  );
  assert.throws(
    () => grid.setCell({ x: 0, z: 0 }, { cost: NaN }),
    WayfinderError,
  );
  const save = grid.snapshot();
  save.revision = Number.MAX_SAFE_INTEGER;
  grid.restore(save);
  assert.throws(
    () => grid.setCell({ x: 0, z: 0 }, { blocked: true }),
    (e) => e.code === "LIMIT_REACHED",
  );
  assert.deepEqual(grid.snapshot(), save);
});

test("A* matches an independent Dijkstra oracle across seeded weighted grids and policies", () => {
  function oracle(grid, start, goal) {
    const { width, height, cellSize, diagonal } = grid.config,
      n = width * height,
      costs = new Array(n).fill(Infinity),
      settled = new Set();
    costs[start.z * width + start.x] = 0;
    for (let count = 0; count < n; count++) {
      let current = -1;
      for (let i = 0; i < n; i++)
        if (!settled.has(i) && (current < 0 || costs[i] < costs[current]))
          current = i;
      if (current < 0 || !Number.isFinite(costs[current])) return null;
      settled.add(current);
      const x = current % width,
        z = Math.floor(current / width);
      if (x === goal.x && z === goal.z) return costs[current];
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dz) || (dx && dz && diagonal === "never")) continue;
          const nx = x + dx,
            nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
          const dest = grid.getCell({ x: nx, z: nz });
          if (dest.blocked) continue;
          if (
            dx &&
            dz &&
            diagonal === "no-cut" &&
            (grid.getCell({ x: nx, z }).blocked ||
              grid.getCell({ x, z: nz }).blocked)
          )
            continue;
          const i = nz * width + nx;
          costs[i] = Math.min(
            costs[i],
            costs[current] + Math.hypot(dx, dz) * cellSize * dest.cost,
          );
        }
    }
    return null;
  }
  let seed = 913;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (const diagonal of ["never", "no-cut", "always"])
    for (let example = 0; example < 15; example++) {
      const grid = new Wayfinder({
        width: 7,
        height: 6,
        diagonal,
        cellSize: 0.7,
      });
      const edits = [];
      for (let z = 0; z < 6; z++)
        for (let x = 0; x < 7; x++)
          edits.push({
            x,
            z,
            blocked: (x || z) && (x !== 6 || z !== 5) ? random() < 0.23 : false,
            cost: 1 + Math.floor(random() * 6) / 2,
          });
      grid.setCells(edits);
      const a = { x: 0, z: 0 },
        b = { x: 6, z: 5 },
        wanted = oracle(grid, a, b),
        result = grid.findPath(a, b);
      if (wanted === null) assert.equal(result.status, "unreachable");
      else {
        assert.equal(result.status, "found");
        assert.ok(
          Math.abs(result.cost - wanted) < 1e-9,
          `${diagonal}: ${result.cost} vs ${wanted}`,
        );
      }
      assert.ok(result.visited <= grid.size);
    }
});
