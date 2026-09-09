import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Telegraph } from "@cranberry-forge/signal";
import {
  AfterglowGame,
  attackContains,
} from "../dist/templates/afterglow/game.js";
import { createAfterglowScene } from "../dist/templates/afterglow/scene.js";

function until(game, time, input = {}) {
  const events = [];
  while (game.view.time < time - 1e-8 && game.phase === "playing")
    events.push(...game.step(Math.min(1 / 60, time - game.view.time), input));
  return events;
}

test("Afterglow has a finite loss loop, explicit lifecycle, and a clean restart", () => {
  const game = new AfterglowGame();
  const initial = game.view;
  assert.equal(game.step(0.25).length, 0);
  assert.deepEqual(game.view, initial);
  assert.equal(game.start(), true);
  assert.equal(game.start(), false);
  const events = until(game, 54);
  assert.equal(game.phase, "lost");
  assert.equal(game.view.health, 0);
  assert.equal(game.view.hits, 3);
  assert.equal(events.filter((e) => e.type === "lost").length, 1);
  const ended = game.view;
  assert.deepEqual(game.step(0.25, { x: 1, dash: true }), []);
  assert.deepEqual(game.view, ended);
  assert.deepEqual(game.restart(), initial);
  game.start();
  assert.equal(game.view.time, 0);
});

test("Afterglow pause freezes clocks, warnings, movement and dash cooldown", () => {
  const game = new AfterglowGame();
  game.start();
  until(game, 1.8);
  game.step(1 / 60, { x: 1, dash: true });
  assert.equal(game.pause(), true);
  const before = game.view;
  assert.ok(before.attacks.length);
  for (let i = 0; i < 120; i++) game.step(0.25, { z: 1, dash: true });
  assert.deepEqual(game.view, before);
  assert.equal(game.pause(), false);
  assert.equal(game.resume(), true);
  assert.equal(game.resume(), false);
  game.step(0.1);
  assert.ok(game.view.time > before.time);
  assert.ok(game.view.cooldown < before.cooldown);
});

test("Afterglow damage queries agree with real Signal transforms for every attack kind", () => {
  const attacks = [
    { shape: "circle", radius: 2.6 },
    { shape: "circle", radius: 9.8, innerRadius: 4.84 },
    { shape: "cone", radius: 17.6, angle: 58 },
    { shape: "beam", width: 2.8, length: 20.24 },
  ];
  for (const options of attacks) {
    const attack = { x: 2.3, z: -1.7, rotation: 1.17, options };
    const telegraph = new Telegraph(options);
    telegraph.position.set(attack.x, 0, attack.z);
    telegraph.rotation.y = attack.rotation;
    telegraph.updateMatrixWorld(true);
    for (let x = -10; x <= 10; x += 0.73)
      for (let z = -10; z <= 10; z += 0.81)
        assert.equal(
          attackContains(attack, { x, z }),
          telegraph.containsPoint(new THREE.Vector3(x, 0, z)),
        );
    telegraph.dispose();
  }
  const game = new AfterglowGame();
  game.start();
  until(game, 2.9);
  const warning = game.view.attacks[0];
  assert.ok(attackContains(warning, game.view.position));
  const events = until(game, warning.impactAt + 0.02);
  const impact = events.find((e) => e.type === "impact");
  assert.equal(impact.inside, true);
  assert.equal(impact.damaged, true);
  assert.equal(game.view.health, 2);
});

test("Afterglow dash protection is bounded and requests respect recharge", () => {
  const game = new AfterglowGame();
  game.start();
  until(game, 3.0);
  const events = game.step(0.15, { dash: true });
  const impact = events.find((e) => e.type === "impact");
  assert.ok(impact);
  assert.equal(impact.dashed, true);
  assert.equal(impact.damaged, false);
  assert.equal(game.view.health, 3);
  assert.equal(
    game.step(0.05, { dash: true }).filter((e) => e.type === "dash").length,
    0,
  );
  until(game, 4.3);
  assert.equal(
    game.step(0.01, { dash: true }).filter((e) => e.type === "dash").length,
    1,
  );
  assert.ok(
    Math.hypot(game.view.position.x, game.view.position.z) <=
      game.options.arenaRadius + 1e-8,
  );
});

test("Afterglow can complete all three rounds through public movement input", () => {
  const game = new AfterglowGame();
  game.start();
  const events = [];
  for (let frame = 0; frame < 60 * 55 && game.phase === "playing"; frame++) {
    const view = game.view;
    const dangerous = view.attacks.some((a) =>
      attackContains(a, view.position),
    );
    let target = view.position;
    if (dangerous) {
      let distance = Infinity;
      for (let x = -8; x <= 8; x += 0.4)
        for (let z = -8; z <= 8; z += 0.4) {
          if (Math.hypot(x, z) > 8.4) continue;
          const candidate = { x, z };
          if (
            view.attacks.some((a) =>
              [
                [0, 0],
                [0.3, 0],
                [-0.3, 0],
                [0, 0.3],
                [0, -0.3],
              ].some(([dx, dz]) => attackContains(a, { x: x + dx, z: z + dz })),
            )
          )
            continue;
          const d = Math.hypot(x - view.position.x, z - view.position.z);
          if (d < distance) {
            distance = d;
            target = candidate;
          }
        }
    }
    const dx = target.x - view.position.x,
      dz = target.z - view.position.z;
    const length = Math.hypot(dx, dz);
    events.push(
      ...game.step(1 / 60, {
        x: length > 0.05 ? dx / length : 0,
        z: length > 0.05 ? dz / length : 0,
        dash:
          dangerous && view.attacks.some((a) => a.impactAt - view.time < 0.16),
      }),
    );
  }
  assert.equal(game.phase, "won");
  assert.equal(game.view.time, 54);
  assert.equal(game.view.round, 3);
  assert.equal(game.view.resolved, 19);
  assert.equal(events.filter((e) => e.type === "round").length, 2);
  assert.equal(events.filter((e) => e.type === "won").length, 1);
  assert.ok(game.view.score > 2000);
  assert.equal(game.view.avoided + game.view.hits, game.view.resolved);
});

test("Afterglow rejects invalid inputs, bounds movement and protects returned state", () => {
  assert.throws(() => new AfterglowGame({ rounds: 0 }));
  assert.throws(() => new AfterglowGame({ health: 2.5 }));
  assert.throws(() => new AfterglowGame({ roundDuration: NaN }));
  assert.throws(() => new AfterglowGame({ unexpected: true }));
  assert.throws(() => new AfterglowGame(JSON.parse('{"constructor":7}')));
  assert.throws(() => new AfterglowGame(JSON.parse('{"__proto__":{}}')));
  const game = new AfterglowGame();
  game.start();
  for (const dt of [-1, Infinity, NaN, 0.251])
    assert.throws(() => game.step(dt));
  for (const input of [{ x: NaN }, { z: 2 }, { dash: 1 }, null])
    assert.throws(() => game.step(0.1, input));
  const detached = game.view;
  detached.position.x = 100;
  detached.attacks.push({});
  assert.equal(game.view.position.x, 0);
  assert.deepEqual(game.view.attacks, []);
  until(game, 1.4, { x: 1, z: 1 });
  assert.ok(
    Math.hypot(game.view.position.x, game.view.position.z) <= 8.8 + 1e-8,
  );
});

test("Afterglow scene is renderer-free, uses Signal and Flux, and can reset and dispose", () => {
  const stage = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(38, 1.5, 0.1, 200),
    bloom: {},
  };
  const world = createAfterglowScene(stage);
  const game = new AfterglowGame();
  game.start();
  until(game, 1.7);
  world.setState(game.view);
  world.update(0.01);
  assert.equal(world.telegraphs.size, 1);
  assert.ok([...world.telegraphs.values()][0].signal instanceof Telegraph);
  game.step(0.05, { x: 1, dash: true });
  world.setState(game.view);
  game.step(0.05, { x: 1 });
  world.setState(game.view);
  assert.ok(world.trail.sampleCount >= 2);
  assert.ok(stage.scene.getObjectByName("Walkable sun disc"));
  let vertices = 0;
  world.root.traverse((o) => {
    if (o.geometry) {
      vertices += o.geometry.attributes.position.count;
      assert.ok(
        [...o.geometry.attributes.position.array].every(Number.isFinite),
      );
    }
  });
  assert.ok(vertices > 10000);
  world.setReducedMotion(true);
  assert.equal(world.trail.sampleCount, 0);
  game.restart();
  world.setState(game.view);
  assert.equal(world.telegraphs.size, 0);
  world.dispose();
  world.dispose();
  assert.equal(stage.scene.children.length, 0);
});
