import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MothlightGame } from "../dist/templates/mothlight/game.js";
import { ITEMS, PICKUPS } from "../dist/templates/mothlight/content.js";
import { createCampScene, CAMP_ITEMS } from "../dist/camp-scene.js";
test("Mothlight plays from first conversation through gathering, crafting and delivery", () => {
  const game = new MothlightGame();
  assert.equal(game.craft().reason, "quest-not-accepted");
  assert.equal(game.deliver().ok, false);
  const talk = game.createConversation();
  talk.choose("accept");
  game.accepted = talk.variables.accepted;
  for (const p of PICKUPS) assert.ok(game.collect(p.id).ok);
  const count = game.pack.count("copper");
  assert.equal(game.collect(PICKUPS[0].id).ok, false);
  assert.equal(game.pack.count("copper"), count);
  assert.ok(game.craft().ok);
  assert.equal(game.pack.count("lantern"), 1);
  assert.ok(game.deliver().ok);
  assert.equal(game.pack.count("lantern"), 0);
  assert.equal(game.completed, true);
  assert.equal(game.deliver().reason, "already-delivered");
  const restored = MothlightGame.fromSnapshot(
    JSON.stringify(game.toSnapshot()),
  );
  assert.deepEqual(restored.toSnapshot(), game.toSnapshot());
  assert.equal(restored.createConversation().nodeId, "thanks");
});
test("Mothlight rejects invalid saves and preserves mid-quest continuation", () => {
  const game = new MothlightGame();
  game.accepted = true;
  game.collect("pickup-0");
  const save = game.toSnapshot(),
    loaded = MothlightGame.fromSnapshot(save);
  assert.equal(loaded.createConversation().nodeId, "instructions");
  assert.throws(() =>
    MothlightGame.fromSnapshot({
      ...save,
      collected: ["pickup-0", "pickup-0"],
    }),
  );
  assert.throws(() =>
    MothlightGame.fromSnapshot({ ...save, position: { x: 100, z: 0 } }),
  );
  assert.throws(() =>
    MothlightGame.fromSnapshot({ ...save, completed: true, accepted: false }),
  );
});
test("all new showcase geometry is finite and the template content matches visible pickups", () => {
  for (const mode of ["satchel", "chatter", "mothlight"]) {
    const stage = {
        scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(),
        bloom: {},
      },
      w = createCampScene(stage, { mode });
    w.update(0.5);
    w.root.traverse((o) => {
      if (o.geometry)
        assert.ok(
          [...o.geometry.attributes.position.array].every(Number.isFinite),
        );
    });
    if (mode === "mothlight") {
      for (const p of PICKUPS) {
        const entry = w.loot.get(p.id);
        assert.equal(entry.itemId, p.itemId);
        assert.equal(entry.object.position.x, p.x);
        assert.equal(entry.object.position.z, p.z);
      }
      for (const item of ITEMS) {
        const data = CAMP_ITEMS.find((i) => i.id === item.id);
        for (const key of ["width", "height", "maxStack", "weight"])
          assert.equal(data[key], item[key]);
      }
    }
    w.dispose();
    assert.equal(stage.scene.children.length, 0);
  }
});
