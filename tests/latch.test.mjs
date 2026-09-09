import test from "node:test";
import assert from "node:assert/strict";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Ray,
  Vector3,
} from "three";
import { Latch } from "../dist/packages/latch/index.js";
import { createLatchScene } from "../dist/latch-scene.js";

function mesh(x = 0, z = 0) {
  const root = new Group();
  const middle = new Group();
  middle.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
  root.add(middle);
  root.position.set(x, 0, z);
  return root;
}
function frame(overrides = {}) {
  return {
    dt: 0.1,
    aimRay: new Ray(new Vector3(0, 0, 8), new Vector3(0, 0, -1)),
    actorPosition: new Vector3(0, 0, 2),
    pressed: false,
    ...overrides,
  };
}
const types = (result) => result.events.map((event) => event.type);
function setup(options = {}) {
  const latch = new Latch();
  const root = mesh();
  latch.register({ id: "a", root, ...options });
  return { latch, root };
}

test("reach uses actor-to-surface distance, independent of a distant camera", () => {
  const { latch } = setup();
  assert.equal(latch.update(frame()).focus.id, "a");
  assert.equal(
    latch.update(frame({ actorPosition: new Vector3(0, 0, 5) })).focus,
    null,
  );
  assert.equal(
    latch.update(
      frame({
        aimRay: new Ray(new Vector3(0, 0, 1000), new Vector3(0, 0, -1)),
      }),
    ).focus.id,
    "a",
  );
});

test("normalizes copied aim direction and refreshes parent transforms", () => {
  const { latch, root } = setup();
  const parent = new Group();
  parent.add(root);
  parent.position.x = 2;
  const aimRay = new Ray(new Vector3(2, 0, 8), new Vector3(0, 0, -5));
  assert.equal(
    latch.update(frame({ aimRay, actorPosition: new Vector3(2, 0, 2) })).focus
      .id,
    "a",
  );
  assert.equal(aimRay.direction.z, -5);
});

test("nested mesh intersections resolve to their nearest registered root", () => {
  const { latch, root } = setup();
  const nested = root.children[0];
  latch.register({ id: "inner", root: nested });
  assert.equal(latch.update(frame()).focus.id, "inner");
  latch.remove("inner");
  assert.equal(latch.update(frame()).focus.id, "a");
});

test("explicit occluders block aim and actor segments, ignoring target self hits", () => {
  const { latch, root } = setup();
  const wall = mesh(0, 4);
  latch.setOccluders([wall]);
  assert.equal(latch.update(frame()).focus, null);
  wall.visible = false;
  assert.equal(latch.update(frame()).focus.id, "a");
  const sideWall = mesh(1.5, 0.25);
  latch.setOccluders([sideWall, root]);
  assert.equal(
    latch.update(frame({ actorPosition: new Vector3(2.5, 0, 0.5) })).focus,
    null,
  );
  latch.setOccluders([root]);
  assert.equal(latch.update(frame()).focus.id, "a");
});

test("unregistered scenery has no implicit occlusion; invisible ancestors hide targets", () => {
  const { latch, root } = setup();
  const scene = new Group();
  scene.add(root, mesh(0, 4));
  assert.equal(latch.update(frame()).focus.id, "a");
  scene.visible = false;
  assert.equal(latch.update(frame()).focus, null);
});

test("stable focus retains close depth ties and registration resolves exact initial ties", () => {
  const latch = new Latch({ focusTolerance: 0.02 });
  const a = mesh(),
    b = mesh();
  latch.register({ id: "first", root: a });
  latch.register({ id: "second", root: b });
  assert.equal(latch.update(frame()).focus.id, "first");
  b.position.z = 0.01;
  assert.equal(latch.update(frame()).focus.id, "first");
  b.position.z = 0.04;
  assert.equal(latch.update(frame()).focus.id, "second");
});

test("a press activates once until an observed release and fresh press", () => {
  const { latch } = setup();
  latch.update(frame());
  assert.deepEqual(types(latch.update(frame({ pressed: true }))), ["activate"]);
  for (let i = 0; i < 10; i++)
    assert.deepEqual(types(latch.update(frame({ pressed: true }))), []);
  latch.update(frame());
  assert.deepEqual(types(latch.update(frame({ pressed: true }))), ["activate"]);
});

test("hold timing excludes time before the starting press and activates once", () => {
  const { latch } = setup({ mode: "hold", holdDuration: 1 });
  latch.update(frame());
  let result = latch.update(frame({ pressed: true, dt: 9 }));
  assert.deepEqual(types(result), ["start"]);
  assert.equal(result.progress, 0);
  result = latch.update(frame({ pressed: true, dt: 0.4 }));
  assert.equal(result.progress, 0.4);
  result = latch.update(frame({ pressed: true, dt: 0.6 }));
  assert.deepEqual(types(result), ["activate"]);
  assert.equal(result.holding, false);
  assert.deepEqual(types(latch.update(frame({ pressed: true, dt: 3 }))), []);
});

test("release cancels partial holds and a later hold starts at zero", () => {
  const { latch } = setup({ mode: "hold", holdDuration: 1 });
  latch.update(frame({ pressed: true }));
  latch.update(frame({ pressed: true, dt: 0.6 }));
  const result = latch.update(frame());
  assert.equal(result.events[0].reason, "released");
  assert.equal(result.progress, 0);
  assert.equal(latch.update(frame({ pressed: true })).progress, 0);
});

test("switching targets while held cancels and requires a release", () => {
  const { latch } = setup({ mode: "hold" });
  latch.register({ id: "b", root: mesh(2) });
  latch.update(frame({ pressed: true }));
  const next = {
    pressed: true,
    aimRay: new Ray(new Vector3(2, 0, 8), new Vector3(0, 0, -1)),
    actorPosition: new Vector3(2, 0, 2),
  };
  const result = latch.update(frame(next));
  assert.deepEqual(types(result), ["cancel", "blur", "focus"]);
  assert.equal(result.events[0].reason, "focus-lost");
  assert.equal(result.requiresRelease, true);
  assert.deepEqual(types(latch.update(frame(next))), []);
  latch.update(frame({ ...next, pressed: false }));
  assert.deepEqual(types(latch.update(frame(next))), ["activate"]);
});

test("a fresh press on the same frame as a target switch still requires release", () => {
  const { latch } = setup();
  latch.register({ id: "b", root: mesh(2) });
  latch.update(frame());
  const result = latch.update(
    frame({
      pressed: true,
      aimRay: new Ray(new Vector3(2, 0, 8), new Vector3(0, 0, -1)),
    }),
  );
  assert.equal(result.focus.id, "b");
  assert.equal(result.requiresRelease, true);
  assert.ok(!types(result).includes("activate"));
});

test("losing reach or aim cancels and cannot restart while held", () => {
  for (const lost of [
    { actorPosition: new Vector3(0, 0, 10) },
    { aimRay: new Ray(new Vector3(8, 0, 8), new Vector3(0, 0, -1)) },
  ]) {
    const { latch } = setup({ mode: "hold" });
    latch.update(frame({ pressed: true }));
    const result = latch.update(frame({ pressed: true, ...lost }));
    assert.equal(result.events[0].reason, "focus-lost");
    assert.ok(!types(latch.update(frame({ pressed: true }))).includes("start"));
  }
});

test("suspension cancels with a reason and holds need release after resumption", () => {
  const { latch } = setup({ mode: "hold" });
  latch.update(frame({ pressed: true }));
  const result = latch.update(frame({ pressed: true, suspended: true }));
  assert.equal(result.events[0].reason, "suspended");
  assert.equal(result.focus, null);
  assert.ok(!types(latch.update(frame({ pressed: true }))).includes("start"));
  latch.update(frame());
  assert.ok(types(latch.update(frame({ pressed: true }))).includes("start"));
});

test("removal is reported on update; replacement with same id is a different target", () => {
  const { latch } = setup({ mode: "hold" });
  latch.update(frame({ pressed: true }));
  assert.equal(latch.remove("a"), true);
  latch.register({ id: "a", root: mesh() });
  const result = latch.update(frame({ pressed: true }));
  assert.deepEqual(types(result), ["cancel", "blur", "focus"]);
  assert.equal(result.events[0].reason, "removed");
  assert.equal(result.requiresRelease, true);
});

test("blocked reasons remain focused and availability changes cancel a running hold", () => {
  const { latch } = setup({
    mode: "hold",
    condition: ({ context }) => context.ready || "Insert fuse",
  });
  let result = latch.update(
    frame({ context: { ready: false }, pressed: true }),
  );
  assert.equal(result.focus.reason, "Insert fuse");
  assert.deepEqual(types(result), ["focus", "blocked"]);
  latch.update(frame({ context: { ready: true } }));
  latch.update(frame({ context: { ready: true }, pressed: true }));
  result = latch.update(
    frame({ context: { ready: false }, pressed: true, dt: 5 }),
  );
  assert.deepEqual(types(result), ["cancel"]);
  assert.equal(result.events[0].reason, "unavailable");
});

test("availability is rechecked immediately before press and hold completion", () => {
  for (const mode of ["press", "hold"]) {
    let checks = 0,
      expireAt = mode === "press" ? 2 : 3;
    const { latch } = setup({
      mode,
      condition: () => ++checks < expireAt || "Expired",
    });
    let result = latch.update(frame({ pressed: true }));
    if (mode === "hold") result = latch.update(frame({ pressed: true, dt: 2 }));
    assert.ok(!types(result).includes("activate"));
    assert.equal(result.focus.reason, "Expired");
  }
});

test("event processing is deferred to host; clear does not dispose scene data", () => {
  const { latch, root } = setup();
  const result = latch.update(frame({ pressed: true }));
  for (const event of result.events)
    if (event.type === "activate") latch.remove(event.target.id);
  assert.equal(latch.size, 0);
  assert.equal(root.children.length, 1);
  assert.equal(latch.update(frame()).events[0].reason, "removed");
  latch.clear();
});

test("rejects invalid configuration and reentrant mutation", () => {
  assert.throws(() => new Latch({ reach: -1 }), RangeError);
  const { latch } = setup();
  assert.throws(() => latch.register({ id: "a", root: mesh() }), /Duplicate/);
  assert.throws(() => latch.update(frame({ dt: NaN })), RangeError);
  assert.throws(
    () =>
      latch.update(frame({ aimRay: new Ray(new Vector3(), new Vector3()) })),
    TypeError,
  );
  const reentrant = new Latch();
  reentrant.register({
    id: "x",
    root: mesh(),
    condition: () => {
      reentrant.remove("x");
      return true;
    },
  });
  assert.throws(() => reentrant.update(frame()), /cannot be mutated/);
  reentrant.remove("x");
});

test("failed updates preserve the fresh press and return its events on a successful retry", () => {
  for (const failure of [
    () => {
      throw new Error("condition failed");
    },
    () => null,
  ]) {
    let condition = failure;
    const { latch } = setup({ condition: () => condition() });
    assert.throws(() => latch.update(frame({ pressed: true })));
    condition = () => true;
    const result = latch.update(frame({ pressed: true }));
    assert.deepEqual(types(result), ["focus", "activate"]);
  }
});

test("a failed target switch preserves a pending hold cancellation until successful update", () => {
  const { latch } = setup({ mode: "hold", holdDuration: 2 });
  let fail = true;
  latch.register({
    id: "b",
    root: mesh(2),
    condition: () => {
      if (fail) throw new Error("retry");
      return true;
    },
  });
  latch.update(frame({ pressed: true }));
  latch.update(frame({ pressed: true, dt: 0.7 }));
  const next = frame({
    pressed: true,
    aimRay: new Ray(new Vector3(2, 0, 8), new Vector3(0, 0, -1)),
  });
  assert.throws(() => latch.update(next), /retry/);
  const original = latch.update(frame({ pressed: true, dt: 0 }));
  assert.equal(original.progress, 0.35);
  fail = false;
  assert.deepEqual(types(latch.update(next)), ["cancel", "blur", "focus"]);
});

test("procedural observatory completes its fuse/crank/beacon route and shutter blocks crank", () => {
  const world = createLatchScene();
  const latch = new Latch({ reach: 3.1 });
  const context = { hasFuse: false, charged: false };
  latch.register({ id: "fuse", root: world.targets.fuse });
  latch.register({
    id: "crank",
    root: world.targets.crank,
    mode: "hold",
    holdDuration: 1.8,
    condition: ({ context }) => context.hasFuse || "Find fuse",
  });
  latch.register({
    id: "beacon",
    root: world.targets.beacon,
    condition: ({ context }) => context.charged || "Wind crank",
  });
  latch.setOccluders(world.occluders);
  function at(id, pressed = false, dt = 0.1) {
    const actorPosition = world.stations[id].clone();
    actorPosition.y += 0.85;
    const aimRay = new Ray(
      world.cameraPosition.clone(),
      world.aimPoints[id].clone().sub(world.cameraPosition).normalize(),
    );
    return latch.update({ dt, actorPosition, aimRay, pressed, context });
  }
  assert.equal(at("beacon").focus.reason, "Wind crank");
  assert.equal(at("fuse").focus.id, "fuse");
  assert.ok(types(at("fuse", true)).includes("activate"));
  context.hasFuse = true;
  latch.remove("fuse");
  assert.equal(at("crank").focus.id, "crank");
  world.update({ shutterRaised: true });
  assert.equal(at("crank").focus, null);
  world.update({ shutterRaised: false });
  at("crank");
  assert.ok(types(at("crank", true)).includes("start"));
  assert.ok(types(at("crank", true, 1.8)).includes("activate"));
  context.charged = true;
  assert.equal(at("beacon").focus.id, "beacon");
  assert.ok(types(at("beacon", true)).includes("activate"));
  world.dispose();
});
