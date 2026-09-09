/** Headless inventory. No DOM, renderer, global clock, storage or other Cranberry Forge dependency. */
const copy = (value) => structuredClone(value);
const fail = (reason) => ({ ok: false, reason });
const MAX_STACK_ID = 999999999999999;
const validId = (value) =>
  typeof value === "string" &&
  /^[a-z][a-z0-9_-]{0,63}$/.test(value) &&
  !["constructor", "prototype", "__proto__"].includes(value);
const integer = (value, min, max, name) => {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new RangeError(`${name} must be an integer in [${min},${max}]`);
  return value;
};

export function normalizeCatalog(input) {
  if (!Array.isArray(input) || !input.length || input.length > 256)
    throw new TypeError("catalog must contain 1–256 item definitions");
  const seen = new Set();
  return input.map((item) => {
    if (!item || !validId(item.id) || seen.has(item.id))
      throw new TypeError("catalog IDs must be unique lowercase identifiers");
    seen.add(item.id);
    const o = {
      id: item.id,
      name: item.name ?? item.id,
      width: item.width ?? 1,
      height: item.height ?? 1,
      maxStack: item.maxStack ?? 1,
      weight: item.weight ?? 0,
    };
    if (typeof o.name !== "string" || !o.name.length || o.name.length > 120)
      throw new TypeError("name must be 1–120 characters");
    integer(o.width, 1, 32, "width");
    integer(o.height, 1, 32, "height");
    integer(o.maxStack, 1, 1000000, "maxStack");
    if (!Number.isFinite(o.weight) || o.weight < 0 || o.weight > 1000000)
      throw new RangeError("weight must be finite in [0,1000000]");
    return Object.freeze(o);
  });
}

export class Inventory {
  #catalog;
  #items = [];
  #nextId = 1;
  #listeners = new Set();
  #revision = 0;
  #columns;
  #rows;
  #maxWeight;
  constructor({ catalog, columns = 6, rows = 4, maxWeight = 1000000000 } = {}) {
    this.#catalog = new Map(normalizeCatalog(catalog).map((d) => [d.id, d]));
    this.#columns = integer(columns, 1, 32, "columns");
    this.#rows = integer(rows, 1, 32, "rows");
    if (!Number.isFinite(maxWeight) || maxWeight < 0 || maxWeight > 1000000000)
      throw new RangeError("maxWeight must be finite in [0,1000000000]");
    this.#maxWeight = maxWeight;
  }
  get columns() {
    return this.#columns;
  }
  get rows() {
    return this.#rows;
  }
  get maxWeight() {
    return this.#maxWeight;
  }
  get revision() {
    return this.#revision;
  }
  get items() {
    return copy(this.#items);
  }
  get catalog() {
    return [...this.#catalog.values()].map(copy);
  }
  get weight() {
    return this.#weight(this.#items);
  }
  count(itemId) {
    this.#definition(itemId);
    return this.#items.reduce(
      (n, i) => n + (i.itemId === itemId ? i.quantity : 0),
      0,
    );
  }
  dimensions(entry) {
    const d = this.#definition(entry.itemId);
    return entry.rotated
      ? { width: d.height, height: d.width }
      : { width: d.width, height: d.height };
  }
  #definition(id) {
    const d = this.#catalog.get(id);
    if (!d) throw new TypeError(`Unknown item: ${id}`);
    return d;
  }
  #draft() {
    return { items: copy(this.#items), nextId: this.#nextId };
  }
  #weight(items) {
    return items.reduce(
      (n, i) => n + this.#definition(i.itemId).weight * i.quantity,
      0,
    );
  }
  #fits(items, entry) {
    const a = this.dimensions(entry);
    if (
      entry.x < 0 ||
      entry.y < 0 ||
      entry.x + a.width > this.columns ||
      entry.y + a.height > this.rows
    )
      return false;
    return !items.some((i) => {
      if (i.id === entry.id) return false;
      const b = this.dimensions(i);
      return (
        entry.x < i.x + b.width &&
        entry.x + a.width > i.x &&
        entry.y < i.y + b.height &&
        entry.y + a.height > i.y
      );
    });
  }
  #position(items, entry) {
    for (const rotated of [false, true])
      for (let y = 0; y < this.rows; y++)
        for (let x = 0; x < this.columns; x++) {
          const trial = { ...entry, x, y, rotated };
          if (this.#fits(items, trial)) return trial;
        }
    return null;
  }
  #add(draft, itemId, quantity) {
    const def = this.#definition(itemId);
    integer(quantity, 1, 1000000, "quantity");
    if (
      this.#weight(draft.items) + def.weight * quantity >
      this.maxWeight + 1e-8
    )
      return fail("weight-limit");
    let remaining = quantity;
    for (const stack of draft.items) {
      if (stack.itemId !== itemId) continue;
      const amount = Math.min(remaining, def.maxStack - stack.quantity);
      stack.quantity += amount;
      remaining -= amount;
      if (!remaining) break;
    }
    while (remaining) {
      if (draft.nextId > MAX_STACK_ID) return fail("id-limit");
      const amount = Math.min(remaining, def.maxStack),
        entry = this.#position(draft.items, {
          id: `s${draft.nextId}`,
          itemId,
          quantity: amount,
        });
      if (!entry) return fail("no-space");
      draft.nextId++;
      draft.items.push(entry);
      remaining -= amount;
    }
    return { ok: true, quantity };
  }
  #take(draft, itemId, quantity) {
    this.#definition(itemId);
    integer(quantity, 1, 1000000, "quantity");
    if (
      draft.items.reduce(
        (n, i) => n + (i.itemId === itemId ? i.quantity : 0),
        0,
      ) < quantity
    )
      return fail("missing-items");
    let remaining = quantity;
    for (const entry of draft.items) {
      if (entry.itemId !== itemId) continue;
      const n = Math.min(remaining, entry.quantity);
      entry.quantity -= n;
      remaining -= n;
      if (!remaining) break;
    }
    draft.items = draft.items.filter((i) => i.quantity > 0);
    return { ok: true, quantity };
  }
  #commit(draft, notify = true) {
    this.#items = draft.items;
    this.#nextId = draft.nextId;
    this.#revision++;
    if (notify) this.#notify();
  }
  #notify() {
    for (const listener of [...this.#listeners])
      try {
        listener(this.toSnapshot());
      } catch (error) {
        console.error("Satchel subscriber error", error);
      }
  }
  subscribe(listener) {
    if (typeof listener !== "function")
      throw new TypeError("listener must be a function");
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  add(itemId, quantity = 1) {
    const draft = this.#draft(),
      result = this.#add(draft, itemId, quantity);
    if (result.ok) this.#commit(draft);
    return result;
  }
  take(itemId, quantity = 1) {
    const draft = this.#draft(),
      result = this.#take(draft, itemId, quantity);
    if (result.ok) this.#commit(draft);
    return result;
  }
  remove(id, quantity) {
    const draft = this.#draft(),
      entry = draft.items.find((i) => i.id === id);
    if (!entry) return fail("not-found");
    quantity ??= entry.quantity;
    integer(quantity, 1, 1000000, "quantity");
    if (quantity > entry.quantity) return fail("missing-items");
    entry.quantity -= quantity;
    draft.items = draft.items.filter((i) => i.quantity);
    this.#commit(draft);
    return { ok: true, quantity };
  }
  move(id, x, y, rotated) {
    integer(x, 0, 31, "x");
    integer(y, 0, 31, "y");
    const draft = this.#draft(),
      entry = draft.items.find((i) => i.id === id);
    if (!entry) return fail("not-found");
    rotated ??= entry.rotated;
    if (typeof rotated !== "boolean")
      throw new TypeError("rotated must be boolean");
    Object.assign(entry, { x, y, rotated });
    if (!this.#fits(draft.items, entry)) return fail("blocked");
    this.#commit(draft);
    return { ok: true };
  }
  rotate(id) {
    const entry = this.#items.find((i) => i.id === id);
    return entry
      ? this.move(id, entry.x, entry.y, !entry.rotated)
      : fail("not-found");
  }
  split(id, quantity) {
    integer(quantity, 1, 1000000, "quantity");
    const draft = this.#draft(),
      source = draft.items.find((i) => i.id === id);
    if (!source) return fail("not-found");
    if (quantity >= source.quantity) return fail("invalid-split");
    if (draft.nextId > MAX_STACK_ID) return fail("id-limit");
    const entry = this.#position(draft.items, {
      id: `s${draft.nextId}`,
      itemId: source.itemId,
      quantity,
    });
    if (!entry) return fail("no-space");
    source.quantity -= quantity;
    draft.nextId++;
    draft.items.push(entry);
    this.#commit(draft);
    return { ok: true, id: entry.id, quantity };
  }
  merge(sourceId, targetId) {
    if (sourceId === targetId) return fail("same-stack");
    const draft = this.#draft(),
      source = draft.items.find((i) => i.id === sourceId),
      target = draft.items.find((i) => i.id === targetId);
    if (!source || !target) return fail("not-found");
    if (source.itemId !== target.itemId) return fail("different-items");
    const quantity = Math.min(
      source.quantity,
      this.#definition(target.itemId).maxStack - target.quantity,
    );
    if (!quantity) return fail("stack-full");
    source.quantity -= quantity;
    target.quantity += quantity;
    draft.items = draft.items.filter((i) => i.quantity);
    this.#commit(draft);
    return { ok: true, quantity };
  }
  transfer(id, target, quantity) {
    if (!(target instanceof Inventory))
      throw new TypeError("target must be an Inventory");
    if (target === this) return fail("same-inventory");
    const from = this.#draft(),
      to = target.#draft(),
      source = from.items.find((i) => i.id === id);
    if (!source) return fail("not-found");
    quantity ??= source.quantity;
    integer(quantity, 1, 1000000, "quantity");
    if (quantity > source.quantity) return fail("missing-items");
    const result = target.#add(to, source.itemId, quantity);
    if (!result.ok) return result;
    source.quantity -= quantity;
    from.items = from.items.filter((i) => i.quantity);
    this.#commit(from, false);
    target.#commit(to, false);
    this.#notify();
    target.#notify();
    return { ok: true, quantity };
  }
  #craft(recipe, times) {
    integer(times, 1, 1000, "times");
    if (!recipe || typeof recipe !== "object")
      throw new TypeError("recipe must be an object");
    const validate = (list) => {
      if (!Array.isArray(list) || !list.length || list.length > 64)
        throw new TypeError(
          "ingredients and outputs must be arrays of 1–64 entries",
        );
      return list.map((i) => {
        this.#definition(i.itemId);
        integer(i.quantity, 1, 1000000, "quantity");
        integer(i.quantity * times, 1, 1000000, "total quantity");
        return i;
      });
    };
    const ingredients = validate(recipe.ingredients),
      outputs = validate(recipe.outputs),
      draft = this.#draft();
    for (const i of ingredients) {
      const r = this.#take(draft, i.itemId, i.quantity * times);
      if (!r.ok) return r;
    }
    for (const i of outputs) {
      const r = this.#add(draft, i.itemId, i.quantity * times);
      if (!r.ok) return r;
    }
    return { ok: true, draft };
  }
  canCraft(recipe, times = 1) {
    const result = this.#craft(recipe, times);
    return result.ok ? { ok: true } : result;
  }
  craft(recipe, times = 1) {
    const result = this.#craft(recipe, times);
    if (!result.ok) return result;
    this.#commit(result.draft);
    return { ok: true };
  }
  toSnapshot() {
    return {
      schema: "cranberry-forge.satchel/1",
      columns: this.columns,
      rows: this.rows,
      maxWeight: this.maxWeight,
      nextId: this.#nextId,
      items: copy(this.#items),
    };
  }
  static fromSnapshot(value, { catalog } = {}) {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    if (
      !data ||
      data.schema !== "cranberry-forge.satchel/1" ||
      !Array.isArray(data.items) ||
      data.items.length > 1024
    )
      throw new TypeError("invalid cranberry-forge.satchel/1 snapshot");
    integer(data.columns, 1, 32, "columns");
    integer(data.rows, 1, 32, "rows");
    if (
      !Number.isFinite(data.maxWeight) ||
      data.maxWeight < 0 ||
      data.maxWeight > 1000000000
    )
      throw new RangeError("maxWeight must be finite in [0,1000000000]");
    const inventory = new Inventory({
        catalog,
        columns: data.columns,
        rows: data.rows,
        maxWeight: data.maxWeight,
      }),
      items = [],
      ids = new Set();
    let highest = 0;
    integer(data.nextId, 1, MAX_STACK_ID + 1, "nextId");
    for (const entry of data.items) {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        !/^s[1-9][0-9]{0,14}$/.test(entry.id) ||
        ids.has(entry.id)
      )
        throw new TypeError("invalid or duplicate stack ID");
      ids.add(entry.id);
      highest = Math.max(highest, Number(entry.id.slice(1)));
      const def = inventory.#definition(entry.itemId);
      integer(entry.x, 0, 31, "x");
      integer(entry.y, 0, 31, "y");
      integer(entry.quantity, 1, def.maxStack, "quantity");
      if (typeof entry.rotated !== "boolean")
        throw new TypeError("rotated must be boolean");
      const item = {
        id: entry.id,
        itemId: entry.itemId,
        x: entry.x,
        y: entry.y,
        quantity: entry.quantity,
        rotated: entry.rotated,
      };
      if (!inventory.#fits(items, item))
        throw new RangeError(
          "snapshot contains overlapping or out-of-bounds items",
        );
      items.push(item);
    }
    if (data.nextId <= highest)
      throw new RangeError("nextId would reuse an existing stack ID");
    if (inventory.#weight(items) > inventory.maxWeight + 1e-8)
      throw new RangeError("snapshot exceeds weight limit");
    inventory.#items = items;
    inventory.#nextId = data.nextId;
    return inventory;
  }
}
