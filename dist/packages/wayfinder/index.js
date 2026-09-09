export const VERSION = "0.1.0";
export const SNAPSHOT_VERSION = 1;
export const LIMITS = Object.freeze({
  dimension: 128,
  cells: 16384,
  cost: 1000,
  coordinate: 1000000,
  cellSizeMin: 0.001,
  cellSizeMax: 1000,
});
export class WayfinderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WayfinderError";
    this.code = code;
  }
}
function fail(code, message) {
  throw new WayfinderError(code, message);
}
function record(value, allowed, name) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    fail("INVALID_INPUT", `${name} must be a plain object`);
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      fail("INVALID_INPUT", `${name}: unknown field ${key}`);
}
function number(value, min, max, name, integer = false) {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isSafeInteger(value))
  )
    fail(
      "INVALID_INPUT",
      `${name} must be ${integer ? "an integer" : "finite"} in ${min}..${max}`,
    );
  return value;
}
function dense(value, length, name) {
  if (!Array.isArray(value) || value.length !== length)
    fail("INVALID_INPUT", `${name} must have ${length} entries`);
  for (let i = 0; i < length; i++)
    if (!Object.hasOwn(value, i))
      fail("INVALID_INPUT", `${name} must not have holes`);
}
function boolean(value, name) {
  if (typeof value !== "boolean")
    fail("INVALID_INPUT", `${name} must be boolean`);
  return value;
}
function configuration(input, strict = false) {
  record(
    input,
    ["width", "height", "cellSize", "origin", "diagonal", "defaultCost"],
    "options",
  );
  if (strict)
    for (const key of [
      "width",
      "height",
      "cellSize",
      "origin",
      "diagonal",
      "defaultCost",
    ])
      if (!Object.hasOwn(input, key) || input[key] === undefined)
        fail("INVALID_INPUT", `Snapshot config requires ${key}`);
  const width = number(input.width, 1, LIMITS.dimension, "width", true),
    height = number(input.height, 1, LIMITS.dimension, "height", true);
  if (width * height > LIMITS.cells) fail("INVALID_INPUT", "Too many cells");
  const cellSize = number(
      input.cellSize ?? 1,
      LIMITS.cellSizeMin,
      LIMITS.cellSizeMax,
      "cellSize",
    ),
    origin = input.origin ?? { x: 0, z: 0 };
  record(origin, ["x", "z"], "origin");
  number(origin.x, -LIMITS.coordinate, LIMITS.coordinate, "origin.x");
  number(origin.z, -LIMITS.coordinate, LIMITS.coordinate, "origin.z");
  const diagonal = input.diagonal ?? "no-cut";
  if (!["never", "no-cut", "always"].includes(diagonal))
    fail("INVALID_INPUT", "diagonal must be never, no-cut, or always");
  const defaultCost = number(
    input.defaultCost ?? 1,
    1,
    LIMITS.cost,
    "defaultCost",
  );
  return Object.freeze({
    width,
    height,
    cellSize,
    origin: Object.freeze({ x: origin.x, z: origin.z }),
    diagonal,
    defaultCost,
  });
}

/** Single-layer XZ navigation. Terrain is private; edits are atomic and revisioned. */
export class Wayfinder {
  #config;
  #blocked;
  #costs;
  #revision = 0;
  constructor(options) {
    this.#config = configuration(options);
    this.#blocked = new Uint8Array(this.size);
    this.#costs = new Float64Array(this.size).fill(this.#config.defaultCost);
  }
  get config() {
    return { ...this.#config, origin: { ...this.#config.origin } };
  }
  get revision() {
    return this.#revision;
  }
  get size() {
    return this.#config.width * this.#config.height;
  }
  #cell(input) {
    record(input, ["x", "z"], "cell");
    number(
      input.x,
      -Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      "cell.x",
      true,
    );
    number(
      input.z,
      -Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      "cell.z",
      true,
    );
    if (
      input.x < 0 ||
      input.z < 0 ||
      input.x >= this.#config.width ||
      input.z >= this.#config.height
    )
      return -1;
    return input.z * this.#config.width + input.x;
  }
  #requiredCell(input) {
    const index = this.#cell(input);
    if (index < 0) fail("OUTSIDE_GRID", "Cell lies outside this grid");
    return index;
  }
  #coordinate(index) {
    return {
      x: index % this.#config.width,
      z: Math.floor(index / this.#config.width),
    };
  }
  #advance() {
    if (this.#revision === Number.MAX_SAFE_INTEGER)
      fail("LIMIT_REACHED", "Revision exhausted");
    this.#revision++;
  }
  getCell(cell) {
    const index = this.#requiredCell(cell);
    return {
      ...this.#coordinate(index),
      blocked: !!this.#blocked[index],
      cost: this.#costs[index],
    };
  }
  setCell(cell, patch) {
    this.#requiredCell(cell);
    return this.setCells([{ x: cell.x, z: cell.z, ...this.#patch(patch) }]);
  }
  #patch(patch) {
    record(patch, ["blocked", "cost"], "patch");
    if (patch.blocked === undefined && patch.cost === undefined)
      fail("INVALID_INPUT", "Patch must specify blocked or cost");
    const result = {};
    if (Object.hasOwn(patch, "blocked"))
      result.blocked = boolean(patch.blocked, "blocked");
    if (Object.hasOwn(patch, "cost"))
      result.cost = number(patch.cost, 1, LIMITS.cost, "cost");
    return result;
  }
  setCells(edits) {
    if (!Array.isArray(edits) || edits.length > this.size)
      fail("INVALID_INPUT", "edits must be an array no larger than this grid");
    dense(edits, edits.length, "edits");
    const used = new Set();
    const changes = edits
      .map((edit) => {
        record(edit, ["x", "z", "blocked", "cost"], "edit");
        const index = this.#requiredCell({ x: edit.x, z: edit.z });
        if (used.has(index))
          fail("INVALID_INPUT", "Duplicate cell in edit batch");
        used.add(index);
        const patch = {};
        if (Object.hasOwn(edit, "blocked")) patch.blocked = edit.blocked;
        if (Object.hasOwn(edit, "cost")) patch.cost = edit.cost;
        return { index, ...this.#patch(patch) };
      })
      .filter(
        (e) =>
          (e.blocked !== undefined &&
            Number(e.blocked) !== this.#blocked[e.index]) ||
          (e.cost !== undefined && e.cost !== this.#costs[e.index]),
      );
    if (!changes.length) return this.#revision;
    this.#advance();
    for (const e of changes) {
      if (e.blocked !== undefined) this.#blocked[e.index] = Number(e.blocked);
      if (e.cost !== undefined) this.#costs[e.index] = e.cost;
    }
    return this.#revision;
  }
  worldToCell(point) {
    record(point, ["x", "z"], "world point");
    number(point.x, -Number.MAX_VALUE, Number.MAX_VALUE, "world.x");
    number(point.z, -Number.MAX_VALUE, Number.MAX_VALUE, "world.z");
    const { origin, cellSize, width, height } = this.#config;
    if (
      point.x < origin.x ||
      point.z < origin.z ||
      point.x >= origin.x + width * cellSize ||
      point.z >= origin.z + height * cellSize
    )
      return null;
    return {
      x: Math.min(width - 1, Math.floor((point.x - origin.x) / cellSize)),
      z: Math.min(height - 1, Math.floor((point.z - origin.z) / cellSize)),
    };
  }
  cellToWorld(cell, y = 0) {
    this.#requiredCell(cell);
    number(y, -LIMITS.coordinate, LIMITS.coordinate, "world.y");
    const { origin, cellSize } = this.#config;
    return {
      x: origin.x + (cell.x + 0.5) * cellSize,
      y,
      z: origin.z + (cell.z + 0.5) * cellSize,
    };
  }
  #result(status, visited, cells = [], cost = null, y = 0) {
    return {
      status,
      cells,
      points: cells.map((c) => this.cellToWorld(c, y)),
      cost,
      visited,
      revision: this.#revision,
    };
  }
  #searchOptions(input = {}) {
    record(input, ["maxVisited", "y"], "search options");
    return {
      maxVisited: number(
        input.maxVisited ?? this.size,
        1,
        this.size,
        "maxVisited",
        true,
      ),
      y: number(input.y ?? 0, -LIMITS.coordinate, LIMITS.coordinate, "y"),
    };
  }
  findWorldPath(start, goal, options = {}) {
    const a = this.worldToCell(start),
      b = this.worldToCell(goal),
      opts = this.#searchOptions(options);
    if (!a || !b) return this.#result("outside-grid", 0);
    return this.findPath(a, b, opts);
  }
  findPath(start, goal, options = {}) {
    const a = this.#cell(start),
      b = this.#cell(goal),
      { maxVisited, y } = this.#searchOptions(options);
    if (a < 0 || b < 0) return this.#result("outside-grid", 0);
    if (this.#blocked[a]) return this.#result("blocked-start", 0);
    if (this.#blocked[b]) return this.#result("blocked-goal", 0);
    const { width, height, cellSize, diagonal } = this.#config,
      n = this.size;
    const g = new Float64Array(n).fill(Infinity),
      h = new Float64Array(n),
      parents = new Int32Array(n).fill(-1),
      positions = new Int32Array(n).fill(-1),
      closed = new Uint8Array(n),
      heap = [];
    const heuristic = (index) => {
      const x = index % width,
        z = Math.floor(index / width),
        dx = Math.abs(x - goal.x),
        dz = Math.abs(z - goal.z);
      return (
        (diagonal === "never"
          ? dx + dz
          : Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)) * cellSize
      );
    };
    const less = (i, j) => {
      const f1 = g[i] + h[i],
        f2 = g[j] + h[j];
      return (
        f1 < f2 || (f1 === f2 && (h[i] < h[j] || (h[i] === h[j] && i < j)))
      );
    };
    const swap = (i, j) => {
      [heap[i], heap[j]] = [heap[j], heap[i]];
      positions[heap[i]] = i;
      positions[heap[j]] = j;
    };
    function up(i) {
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!less(heap[i], heap[p])) break;
        swap(i, p);
        i = p;
      }
    }
    function pushOrDecrease(index) {
      if (positions[index] < 0) {
        positions[index] = heap.length;
        heap.push(index);
      }
      up(positions[index]);
    }
    function pop() {
      const top = heap[0],
        last = heap.pop();
      positions[top] = -1;
      if (heap.length) {
        heap[0] = last;
        positions[last] = 0;
        let i = 0;
        for (;;) {
          let child = i * 2 + 1;
          if (child >= heap.length) break;
          if (child + 1 < heap.length && less(heap[child + 1], heap[child]))
            child++;
          if (!less(heap[child], heap[i])) break;
          swap(i, child);
          i = child;
        }
      }
      return top;
    }
    g[a] = 0;
    h[a] = heuristic(a);
    pushOrDecrease(a);
    let visited = 0;
    const directions =
      diagonal === "never"
        ? [
            [0, -1],
            [-1, 0],
            [1, 0],
            [0, 1],
          ]
        : [
            [0, -1],
            [-1, 0],
            [1, 0],
            [0, 1],
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ];
    while (heap.length && visited < maxVisited) {
      const current = pop();
      closed[current] = 1;
      visited++;
      if (current === b) {
        const cells = [];
        for (let i = b; i >= 0; i = parents[i]) cells.push(this.#coordinate(i));
        cells.reverse();
        return this.#result("found", visited, cells, g[b], y);
      }
      const x = current % width,
        z = Math.floor(current / width);
      for (const [dx, dz] of directions) {
        const nx = x + dx,
          nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
        const index = nz * width + nx;
        if (this.#blocked[index] || closed[index]) continue;
        if (
          dx &&
          dz &&
          diagonal === "no-cut" &&
          (this.#blocked[z * width + nx] || this.#blocked[nz * width + x])
        )
          continue;
        const score =
          g[current] +
          this.#costs[index] * cellSize * (dx && dz ? Math.SQRT2 : 1);
        if (score >= g[index]) continue;
        g[index] = score;
        h[index] = heuristic(index);
        parents[index] = current;
        pushOrDecrease(index);
      }
    }
    return this.#result(
      heap.length ? "budget-exceeded" : "unreachable",
      visited,
    );
  }
  snapshot() {
    return {
      version: SNAPSHOT_VERSION,
      config: this.config,
      revision: this.#revision,
      cells: Array.from({ length: this.size }, (_, i) => ({
        blocked: !!this.#blocked[i],
        cost: this.#costs[i],
      })),
    };
  }
  restore(input) {
    record(input, ["version", "config", "revision", "cells"], "snapshot");
    if (input.version !== SNAPSHOT_VERSION)
      fail("INCOMPATIBLE_SNAPSHOT", "Unsupported snapshot version");
    const config = configuration(input.config, true);
    if (JSON.stringify(config) !== JSON.stringify(this.#config))
      fail(
        "INCOMPATIBLE_SNAPSHOT",
        "Snapshot configuration differs from this grid",
      );
    const revision = number(
      input.revision,
      0,
      Number.MAX_SAFE_INTEGER,
      "revision",
      true,
    );
    dense(input.cells, this.size, "snapshot.cells");
    const blocked = new Uint8Array(this.size),
      costs = new Float64Array(this.size);
    input.cells.forEach((cell, i) => {
      record(cell, ["blocked", "cost"], "snapshot cell");
      blocked[i] = Number(boolean(cell.blocked, "blocked"));
      costs[i] = number(cell.cost, 1, LIMITS.cost, "cost");
    });
    this.#blocked = blocked;
    this.#costs = costs;
    this.#revision = revision;
    return this;
  }
  static fromSnapshot(snapshot) {
    record(snapshot, ["version", "config", "revision", "cells"], "snapshot");
    return new Wayfinder(snapshot.config).restore(snapshot);
  }
}
