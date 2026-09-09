import test from "node:test";
import assert from "node:assert/strict";
import {
  createJournal,
  TrailmarkError,
  LIMITS,
} from "../dist/packages/trailmark/index.js";

const definitions = [
  {
    id: "bridge",
    objectives: [
      { id: "wood", type: "gather", tags: ["wood", "harbor"], target: 3 },
      { id: "work", type: "restore", tags: ["bridge"], target: 1 },
    ],
  },
  {
    id: "beacon",
    prerequisites: ["bridge"],
    objectives: [{ id: "light", type: "restore", tags: ["beacon"], target: 1 }],
  },
];
const gather = (id, amount = 1) => ({
  id,
  type: "gather",
  tags: ["harbor", "wood", "extra"],
  amount,
});
const finishBridge = (j) => {
  j.activate("bridge");
  j.dispatch(gather("wood", 3));
  return j.dispatch({ id: "work", type: "restore", tags: ["bridge"] });
};

test("activation is explicit; prerequisites unlock only after completion", () => {
  const j = createJournal(definitions);
  assert.equal(j.get("bridge").status, "available");
  assert.equal(j.get("beacon").status, "locked");
  assert.equal(j.activate("beacon").reason, "prerequisites");
  assert.equal(j.dispatch(gather("early", 3)).changes.length, 0);
  assert.equal(j.get("bridge").objectives[0].count, 0);
  finishBridge(j);
  assert.equal(j.get("beacon").status, "available");
  assert.equal(j.activate("beacon").activated, true);
  assert.equal(j.activate("beacon").reason, "already-started");
});

test("typed events require every tag; integer counters clamp deterministically", () => {
  const j = createJournal(definitions);
  j.activate("bridge");
  j.dispatch({ id: "wrong-type", type: "found", tags: ["wood", "harbor"] });
  j.dispatch({ id: "missing-tag", type: "gather", tags: ["wood"] });
  assert.equal(j.get("bridge").objectives[0].count, 0);
  const result = j.dispatch(gather("a", 100));
  assert.deepEqual(result.changes, [
    { questId: "bridge", objectiveId: "wood", before: 0, after: 3, target: 3 },
  ]);
  assert.equal(j.get("bridge").status, "active");
});

test("one event updates every matching active objective in catalog order", () => {
  const j = createJournal([
    {
      id: "a",
      objectives: [
        { id: "x", type: "step", target: 1 },
        { id: "y", type: "step", target: 1 },
      ],
    },
    { id: "b", objectives: [{ id: "z", type: "step", target: 1 }] },
  ]);
  j.activate("b");
  j.activate("a");
  const r = j.dispatch({ id: "one", type: "step" });
  assert.deepEqual(
    r.completed.map((v) => v.questId),
    ["a", "b"],
  );
  assert.deepEqual(
    r.changes.map((v) => v.objectiveId),
    ["x", "y", "z"],
  );
  assert.deepEqual(
    createJournal(
      [
        {
          id: "a",
          objectives: [
            { id: "x", type: "step", target: 1 },
            { id: "y", type: "step", target: 1 },
          ],
        },
        { id: "b", objectives: [{ id: "z", type: "step", target: 1 }] },
      ],
      { snapshot: j.snapshot() },
    ).snapshot(),
    j.snapshot(),
  );
});

test("dedupe uses FIFO accepted event IDs, including unmatched events; duplicate does not refresh", () => {
  const j = createJournal(definitions, { dedupeCapacity: 2 });
  j.activate("bridge");
  j.dispatch(gather("a"));
  j.dispatch({ id: "b", type: "unmatched" });
  const before = j.snapshot();
  assert.equal(j.dispatch(gather("a")).duplicate, true);
  assert.deepEqual(j.snapshot(), before);
  j.dispatch({ id: "c", type: "unmatched" });
  assert.deepEqual(
    j.snapshot().recentEvents.map((e) => e.id),
    ["b", "c"],
  );
  assert.equal(j.dispatch(gather("a")).accepted, true);
  assert.equal(j.get("bridge").objectives[0].count, 2);
});

test("completion and claim are each returned once in a forward journal history", () => {
  const j = createJournal(definitions);
  const r = finishBridge(j);
  assert.equal(r.completed.length, 1);
  assert.equal(
    j.dispatch({ id: "again", type: "restore", tags: ["bridge"] }).completed
      .length,
    0,
  );
  assert.equal(j.claim("beacon"), null);
  const receipt = j.claim("bridge");
  assert.equal(receipt.id, r.completed[0].id);
  assert.ok(receipt.claimedAt > receipt.completedAt);
  assert.equal(j.claim("bridge"), null);
});

test("snapshot round trip preserves counters, dedupe, completed and claimed states", () => {
  const j = createJournal(definitions);
  finishBridge(j);
  j.claim("bridge");
  j.activate("beacon");
  j.dispatch({ id: "lit", type: "restore", tags: ["beacon"] });
  const saved = JSON.parse(JSON.stringify(j.snapshot()));
  const restored = createJournal(definitions, { snapshot: saved });
  assert.deepEqual(restored.snapshot(), saved);
  assert.equal(restored.claim("bridge"), null);
  assert.equal(
    restored.dispatch({ id: "lit", type: "restore", tags: ["beacon"] })
      .duplicate,
    true,
  );
  assert.equal(restored.claim("beacon").questId, "beacon");
});

test("input and all returned data are detached from internal state", () => {
  const d = structuredClone(definitions),
    j = createJournal(d);
  d[0].objectives[0].target = 999;
  const q = j.activate("bridge").quest;
  q.objectives[0].target = 9;
  const snap = j.snapshot();
  snap.quests[0].counters[0].count = 2;
  assert.equal(j.get("bridge").objectives[0].count, 0);
  assert.equal(j.get("bridge").objectives[0].target, 3);
});

test("bad definitions reject cycles, unknown gates, duplicate IDs, bad limits and unknown fields", () => {
  const cases = [
    [],
    [
      {
        id: "a",
        prerequisites: ["a"],
        objectives: [{ id: "x", type: "a", target: 1 }],
      },
    ],
    [{ ...definitions[0], prerequisites: ["missing"] }],
    [definitions[0], definitions[0]],
    [{ id: "x", objectives: [{ id: "x", type: "a", target: 0 }] }],
    [{ ...definitions[0], surprise: true }],
    [
      {
        ...definitions[0],
        objectives: [{ id: "x", type: "a", target: 1, tags: ["a", "a"] }],
      },
    ],
  ];
  for (const input of cases)
    assert.throws(() => createJournal(input), TrailmarkError);
  assert.throws(
    () =>
      createJournal(definitions, { dedupeCapacity: LIMITS.dedupeCapacity + 1 }),
    TrailmarkError,
  );
});

test("malformed event validation is atomic, even for duplicate IDs", () => {
  const j = createJournal(definitions);
  j.activate("bridge");
  j.dispatch(gather("a"));
  const before = j.snapshot();
  for (const event of [
    null,
    { id: "a", type: "gather", amount: NaN },
    { id: "b", type: "gather", amount: -1 },
    { id: "b", type: "gather", amount: 0.5 },
    { id: "b", type: "gather", tags: ["x", "x"] },
    { id: "", type: "gather" },
    { id: "b", type: "gather", extra: true },
  ])
    assert.throws(() => j.dispatch(event), TrailmarkError);
  assert.deepEqual(j.snapshot(), before);
});

test("invalid snapshots are rejected without changing the live journal", () => {
  const j = createJournal(definitions);
  finishBridge(j);
  j.claim("bridge");
  j.activate("beacon");
  const valid = j.snapshot();
  const mutations = [
    (s) => {
      s.version = 9;
    },
    (s) => {
      s.catalogKey += " ";
    },
    (s) => {
      s.dedupeCapacity = 1;
    },
    (s) => {
      s.sequence = -1;
    },
    (s) => {
      s.quests[0].counters[0].count = 1;
    },
    (s) => {
      s.quests[0].receipt.claimedAt = null;
    },
    (s) => {
      s.quests[0].receipt.id = "fake";
    },
    (s) => {
      s.quests[0].receipt.completedAt = s.quests[0].activatedAt;
    },
    (s) => {
      s.quests[1].activatedAt = 2;
    },
    (s) => {
      s.quests[1].status = "idle";
    },
    (s) => {
      s.quests.reverse();
    },
    (s) => {
      s.recentEvents.push(s.recentEvents[0]);
    },
    (s) => {
      s.recentEvents[1].id = "different-event";
    },
    (s) => {
      s.quests[0].receipt.extra = true;
    },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(valid);
    mutate(bad);
    assert.throws(() => j.restore(bad), TrailmarkError);
    assert.deepEqual(j.snapshot(), valid);
  }
});

test("evicted event IDs can be reused and their later sequence survives a snapshot", () => {
  const j = createJournal(definitions, { dedupeCapacity: 1 });
  finishBridge(j);
  j.dispatch({ id: "new", type: "noop" });
  j.dispatch({ id: "work", type: "noop" });
  const restored = createJournal(definitions, {
    dedupeCapacity: 1,
    snapshot: j.snapshot(),
  });
  assert.equal(restored.get("bridge").status, "completed");
});

test("unknown quest IDs fail predictably and sequence exhaustion cannot partly mutate", () => {
  const j = createJournal(definitions);
  assert.throws(
    () => j.get("missing"),
    (e) => e.code === "UNKNOWN_QUEST",
  );
  const s = j.snapshot();
  s.sequence = Number.MAX_SAFE_INTEGER;
  j.restore(s);
  assert.throws(
    () => j.activate("bridge"),
    (e) => e.code === "LIMIT_REACHED",
  );
  assert.equal(j.get("bridge").status, "available");
  assert.throws(
    () => j.dispatch(gather("last")),
    (e) => e.code === "LIMIT_REACHED",
  );
  assert.deepEqual(j.snapshot(), s);
});

test("sparse definitions and snapshots fail before any state can be committed", () => {
  assert.throws(() => createJournal(new Array(1)), TrailmarkError);
  assert.throws(
    () => createJournal([{ ...definitions[0], objectives: new Array(1) }]),
    TrailmarkError,
  );
  const j = createJournal(definitions),
    before = j.snapshot();
  for (const mutate of [
    (s) => {
      s.quests = new Array(definitions.length);
    },
    (s) => {
      s.quests[0].counters = new Array(definitions[0].objectives.length);
    },
    (s) => {
      s.recentEvents = new Array(1);
    },
  ]) {
    const bad = structuredClone(before);
    mutate(bad);
    assert.throws(() => j.restore(bad), TrailmarkError);
    assert.deepEqual(j.snapshot(), before);
    assert.equal(j.get("bridge").status, "available");
  }
  assert.throws(
    () => j.dispatch({ id: "bad-tags", type: "gather", tags: new Array(1) }),
    TrailmarkError,
  );
  assert.deepEqual(j.snapshot(), before);
});
