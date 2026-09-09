import { Inventory } from "@cranberry-forge/satchel";
import { Conversation } from "@cranberry-forge/chatter";
import { ITEMS, LANTERN_RECIPE, PICKUPS, QUEST_STORY } from "./content.js";

/** Renderer-free game state: collect → craft → deliver, with validated snapshots. */
export class MothlightGame {
  constructor() {
    this.pack = new Inventory({
      catalog: ITEMS,
      columns: 6,
      rows: 4,
      maxWeight: 16,
    });
    this.accepted = false;
    this.completed = false;
    this.collected = new Set();
    this.elapsed = 0;
    this.position = { x: 0, z: 2 };
  }
  createConversation() {
    const talk = new Conversation({
      ...QUEST_STORY,
      start: this.completed
        ? "thanks"
        : this.accepted
          ? "instructions"
          : "hello",
    });
    talk.setVariables({ accepted: this.accepted, lit: this.completed });
    return talk;
  }
  collect(id) {
    if (this.completed) return { ok: false, reason: "finished" };
    const pickup = PICKUPS.find((p) => p.id === id);
    if (!pickup) return { ok: false, reason: "not-found" };
    if (this.collected.has(id))
      return { ok: false, reason: "already-collected" };
    const result = this.pack.add(pickup.itemId);
    if (result.ok) this.collected.add(id);
    return result;
  }
  craft() {
    if (!this.accepted) return { ok: false, reason: "quest-not-accepted" };
    if (this.completed) return { ok: false, reason: "finished" };
    return this.pack.craft(LANTERN_RECIPE);
  }
  deliver() {
    if (!this.accepted) return { ok: false, reason: "quest-not-accepted" };
    if (this.completed) return { ok: false, reason: "already-delivered" };
    const result = this.pack.take("lantern", 1);
    if (result.ok) this.completed = true;
    return result;
  }
  toSnapshot() {
    return {
      schema: "cranberry-forge.mothlight/1",
      pack: this.pack.toSnapshot(),
      accepted: this.accepted,
      completed: this.completed,
      collected: [...this.collected],
      elapsed: this.elapsed,
      position: { ...this.position },
    };
  }
  static fromSnapshot(value) {
    const s = typeof value === "string" ? JSON.parse(value) : value;
    if (
      !s ||
      s.schema !== "cranberry-forge.mothlight/1" ||
      typeof s.accepted !== "boolean" ||
      typeof s.completed !== "boolean" ||
      !Array.isArray(s.collected) ||
      s.collected.length > PICKUPS.length ||
      new Set(s.collected).size !== s.collected.length ||
      s.collected.some((id) => !PICKUPS.some((p) => p.id === id))
    )
      throw new TypeError("invalid Mothlight save");
    if (
      !Number.isFinite(s.elapsed) ||
      s.elapsed < 0 ||
      s.elapsed > 10000000 ||
      !s.position ||
      !Number.isFinite(s.position.x) ||
      !Number.isFinite(s.position.z) ||
      Math.hypot(s.position.x, s.position.z) > 9.31
    )
      throw new RangeError("invalid time or position");
    if (s.completed && !s.accepted)
      throw new TypeError("completed quest must have been accepted");
    const game = new MothlightGame(),
      pack = Inventory.fromSnapshot(s.pack, { catalog: ITEMS });
    if (pack.columns !== 6 || pack.rows !== 4 || pack.maxWeight !== 16)
      throw new TypeError("save uses an incompatible pack");
    game.pack = pack;
    game.accepted = s.accepted;
    game.completed = s.completed;
    game.collected = new Set(s.collected);
    game.elapsed = s.elapsed;
    game.position = { x: s.position.x, z: s.position.z };
    return game;
  }
}
