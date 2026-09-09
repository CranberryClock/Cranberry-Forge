import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Tempo } from "../dist/packages/tempo/index.js";
import { createTempoScene, SPELLS } from "../dist/tempo-scene.js";

const loadout = [
  { id: "dash", charges: 3, recharge: 2 },
  { id: "heal", charges: 2, recharge: 3, cooldown: 0.5 },
];
const near = (a, b) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} approximately equals ${b}`);

test("Tempo restores charges sequentially without restarting an existing recharge", () => {
  const tempo = new Tempo(loadout);
  assert.equal(tempo.tryUse("dash").ok, true);
  tempo.tick(0.5);
  assert.equal(tempo.tryUse("dash").ok, true);
  assert.equal(tempo.tryUse("dash").ok, true);
  assert.equal(tempo.inspect("dash").charges, 0);
  near(tempo.inspect("dash").rechargeRemaining, 1.5);
  const blocked = tempo.tryUse("dash");
  assert.equal(blocked.reason, "no-charges");
  assert.equal(blocked.retryAfter, 1.5);
  const first = tempo.tick(1.5);
  assert.deepEqual(first, [
    { type: "recharged", id: "dash", at: 2, charges: 1 },
  ]);
  assert.deepEqual(tempo.tick(4), [
    { type: "recharged", id: "dash", at: 4, charges: 2 },
    { type: "recharged", id: "dash", at: 6, charges: 3 },
  ]);
  assert.equal(tempo.inspect("dash").rechargeProgress, 1);
  assert.deepEqual(tempo.tick(100), []);
});

test("Tempo tick partitions produce the same recharge events and equivalent state", () => {
  function run(partitions) {
    const tempo = new Tempo(loadout, { globalCooldown: 0.35 });
    tempo.tryUse("dash");
    tempo.tick(0.35);
    tempo.tryUse("dash");
    tempo.tick(0.35);
    tempo.tryUse("heal");
    const events = partitions.flatMap((dt) => tempo.tick(dt));
    return { tempo, events };
  }
  const coarse = run([12]),
    fine = run(Array(120).fill(0.1));
  assert.deepEqual(fine.events, coarse.events);
  near(fine.tempo.time, coarse.tempo.time);
  for (const id of ["dash", "heal"])
    assert.deepEqual(fine.tempo.inspect(id), coarse.tempo.inspect(id));
  const split = new Tempo([{ id: "fast", charges: 3, recharge: 0.1 }]);
  split.tryUse("fast");
  split.tryUse("fast");
  split.tryUse("fast");
  assert.equal(
    Array.from({ length: 30 }, () => split.tick(0.01))
      .flat()
      .filter((event) => event.type === "recharged").length,
    3,
  );
});

test("Tempo per-use cooldown and charge recharge run independently", () => {
  const tempo = new Tempo([
    { id: "spell", charges: 2, recharge: 1, cooldown: 3 },
  ]);
  tempo.tryUse("spell");
  assert.equal(tempo.tryUse("spell").reason, "cooldown");
  assert.deepEqual(tempo.tick(1), [
    { type: "recharged", id: "spell", at: 1, charges: 2 },
  ]);
  assert.equal(tempo.inspect("spell").charges, 2);
  assert.equal(tempo.inspect("spell").ready, false);
  assert.equal(tempo.inspect("spell").retryAfter, 2);
  assert.deepEqual(tempo.tick(2), [
    { type: "cooldown-ready", id: "spell", at: 3 },
  ]);
  assert.equal(tempo.tryUse("spell").ok, true);
});

test("Tempo global cooldown blocks participants; bypass spells neither check nor trigger it", () => {
  const tempo = new Tempo(
    [
      { id: "dash", charges: 2, recharge: 2 },
      { id: "meteor", recharge: 5 },
      { id: "heal", charges: 2, recharge: 3, usesGlobalCooldown: false },
    ],
    { globalCooldown: 0.6 },
  );
  tempo.tryUse("dash");
  const before = tempo.toSnapshot();
  assert.equal(tempo.tryUse("meteor").reason, "global-cooldown");
  assert.deepEqual(tempo.toSnapshot(), before);
  tempo.tick(0.2);
  assert.equal(tempo.tryUse("heal").ok, true);
  near(tempo.state.globalRemaining, 0.4);
  tempo.tick(0.4);
  assert.equal(tempo.tryUse("meteor").ok, true);
  assert.equal(tempo.inspect("heal").globalRemaining, 0);
  tempo.tick(0.6);
  assert.equal(tempo.tryUse("heal").ok, true);
  assert.equal(tempo.state.globalRemaining, 0);
});

test("Tempo reset and host pause have explicit clock behavior, with detached results", () => {
  const tempo = new Tempo(loadout, { globalCooldown: 0.4 });
  const initial = tempo.toSnapshot();
  const used = tempo.tryUse("dash");
  used.state.charges = 99;
  used.events[0].charges = 99;
  const definitions = tempo.definitions;
  definitions[0].recharge = 99;
  const state = tempo.state;
  state.abilities[0].charges = 99;
  assert.equal(tempo.inspect("dash").charges, 2);
  assert.equal(tempo.definitions[0].recharge, 2);
  const paused = tempo.toSnapshot();
  for (let i = 0; i < 100; i++) assert.deepEqual(tempo.tick(0), []);
  assert.deepEqual(tempo.toSnapshot(), paused);
  tempo.tick(1.25);
  tempo.reset();
  assert.deepEqual(tempo.toSnapshot(), initial);
});

test("Tempo snapshots round-trip active clocks and resume without replaying use events", () => {
  const original = new Tempo(loadout, { globalCooldown: 0.7 });
  original.tryUse("dash");
  original.tick(0.7);
  original.tryUse("dash");
  original.tick(0.7);
  original.tryUse("heal");
  original.tick(0.2);
  const restored = Tempo.fromSnapshot(JSON.stringify(original.toSnapshot()));
  assert.deepEqual(restored.state, original.state);
  assert.deepEqual(restored.tick(8), original.tick(8));
  assert.deepEqual(restored.toSnapshot(), original.toSnapshot());
  const current = new Tempo(loadout, { globalCooldown: 0.7 });
  const save = original.toSnapshot();
  current.restore(save);
  save.abilities[0].charges = 100;
  assert.equal(current.inspect("dash").charges, 3);
  const old = new Tempo([{ id: "quick", recharge: 0.001 }], {
    globalCooldown: 0.001,
  });
  for (let i = 0; i < 1200; i++) old.tick(86400);
  old.tryUse("quick");
  assert.equal(old.inspect("quick").rechargeProgress, 0);
  assert.equal(old.state.globalProgress, 0);
  const oldRestored = Tempo.fromSnapshot(old.toSnapshot());
  assert.deepEqual(oldRestored.tick(0.001), old.tick(0.001));
});

test("Tempo invalid restores are atomic, including sparse arrays and explicit null defaults", () => {
  const tempo = new Tempo(loadout, { globalCooldown: 0.5 });
  tempo.tryUse("dash");
  tempo.tick(0.2);
  const before = tempo.toSnapshot();
  const mutations = [
    (s) => {
      s.time = NaN;
    },
    (s) => {
      s.globalReadyAt = s.time - 1;
    },
    (s) => {
      s.abilities[0].charges = 3;
    },
    (s) => {
      s.abilities[0].rechargeAt = null;
    },
    (s) => {
      s.abilities[0].rechargeAt = s.time + 4;
    },
    (s) => {
      s.abilities[0].cooldownUntil = s.time + 1;
    },
    (s) => {
      s.abilities[1].id = "dash";
    },
    (s) => {
      delete s.abilities[0];
    },
    (s) => {
      delete s.definitions[0];
    },
    (s) => {
      s.definitions[0].charges = null;
    },
    (s) => {
      s.definitions[0].cooldown = null;
    },
    (s) => {
      s.definitions[0].usesGlobalCooldown = null;
    },
    (s) => {
      delete s.definitions[0].cooldown;
    },
    (s) => {
      s.globalCooldown = 4;
    },
    (s) => {
      s.extra = true;
    },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(before);
    mutate(invalid);
    assert.throws(() => tempo.restore(invalid));
    assert.deepEqual(tempo.toSnapshot(), before);
  }
  for (const invalid of [null, false, 0, "", "{}", "x".repeat(131073)]) {
    assert.throws(() => tempo.restore(invalid));
    assert.deepEqual(tempo.toSnapshot(), before);
  }
});

test("Tempo rejects malformed configuration and advancement before mutation", () => {
  for (const input of [
    [],
    new Array(1),
    [{ id: "__proto__", recharge: 1 }],
    [
      { id: "same", recharge: 1 },
      { id: "same", recharge: 2 },
    ],
    [{ id: "dash", recharge: 0 }],
    [{ id: "dash", recharge: 1, charges: 1.5 }],
    [{ id: "dash", recharge: 1, cooldown: null }],
    [{ id: "dash", recharge: 1, usesGlobalCooldown: null }],
    [{ id: "dash", recharge: 1, mystery: true }],
  ])
    assert.throws(() => new Tempo(input));
  assert.throws(() => new Tempo(loadout, { globalCooldown: null }));
  assert.throws(() => new Tempo(loadout, { constructor: 7 }));
  const tempo = new Tempo(loadout);
  tempo.tryUse("dash");
  const before = tempo.toSnapshot();
  for (const dt of [-1, NaN, Infinity, 86401, "1"]) {
    assert.throws(() => tempo.tick(dt));
    assert.deepEqual(tempo.toSnapshot(), before);
  }
  assert.throws(() => tempo.tryUse("typo"));
  assert.deepEqual(tempo.toSnapshot(), before);
  assert.throws(() => tempo.inspect(["dash"]));
  const tiny = new Tempo([{ id: "tiny", recharge: 1, cooldown: 1e-20 }]);
  tiny.tick(1);
  const tinyBefore = tiny.toSnapshot();
  assert.throws(() => tiny.tryUse("tiny"), /too small to represent/);
  assert.deepEqual(tiny.toSnapshot(), tinyBefore);
});

test("Tempo tie events have stable global / cooldown / recharge ordering and bounded catch-up", () => {
  const tempo = new Tempo([{ id: "zeta", recharge: 1, cooldown: 1 }], {
    globalCooldown: 1,
  });
  tempo.tryUse("zeta");
  assert.deepEqual(tempo.tick(1), [
    { type: "global-ready", at: 1 },
    { type: "cooldown-ready", id: "zeta", at: 1 },
    { type: "recharged", id: "zeta", at: 1, charges: 1 },
  ]);
  const full = new Tempo(
    Array.from({ length: 64 }, (_, i) => ({
      id: `ability${i}`,
      charges: 16,
      recharge: 0.001,
    })),
  );
  for (let i = 0; i < 64; i++)
    for (let j = 0; j < 16; j++)
      assert.equal(full.tryUse(`ability${i}`).ok, true);
  assert.equal(full.tick(86400).length, 1024);
  assert.ok(full.state.abilities.every((ability) => ability.charges === 16));
});

test("Spellgarden visuals follow accepted casts and real charge state without a renderer", () => {
  const stage = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(38, 1.5, 0.1, 200),
    bloom: {},
  };
  const world = createTempoScene(stage);
  const tempo = new Tempo(
    SPELLS.map(({ id, charges, recharge, cooldown }) => ({
      id,
      charges,
      recharge,
      cooldown,
    })),
    { globalCooldown: 0.45 },
  );
  for (const spell of SPELLS) {
    const result = tempo.tryUse(spell.id);
    assert.equal(result.ok, true);
    world.cast(spell.id);
    world.setState(tempo.state);
    tempo.tick(0.5);
    world.update(0.5);
  }
  assert.equal(world.effects.length, 2);
  assert.equal(
    world.chargeCrystals.get("meteor")[0].material.emissive.getHex(),
    0,
  );
  assert.ok(stage.scene.getObjectByName("Spellgarden marble disc"));
  let vertices = 0;
  world.root.traverse((object) => {
    if (object.geometry) {
      vertices += object.geometry.attributes.position.count;
      assert.ok(
        [...object.geometry.attributes.position.array].every(Number.isFinite),
      );
    }
  });
  assert.ok(vertices > 0, "scene construction includes actual mesh geometry");
  world.setReducedMotion(true);
  world.update(3);
  assert.equal(world.effects.length, 0);
  world.reset();
  world.dispose();
  world.dispose();
  assert.equal(stage.scene.children.length, 0);
});
