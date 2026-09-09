import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppServer } from "../scripts/server.mjs";
test("HTTP companion integrates geometry packages and validates requests", async () => {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, data, headers = { "content-type": "application/json" }) =>
    fetch(base + path, {
      method: "POST",
      headers,
      body: typeof data === "string" ? data : JSON.stringify(data),
    });
  try {
    assert.equal((await fetch(base + "/api/v1/health")).status, 200);
    const capabilities = await (
      await fetch(base + "/api/v1/capabilities")
    ).json();
    assert.deepEqual(capabilities.trailmark.actions, [
      "inspect",
      "activate",
      "dispatch",
      "claim",
    ]);
    assert.equal(capabilities.trailmark.snapshotVersion, 1);
    assert.equal(capabilities.trailmark.limits.objectives, 1024);
    assert.equal(capabilities.trailmark.defaultDedupeCapacity, 2048);
    const body = {
      options: { seed: 42, count: 25 },
      surface: { type: "flat", height: 3 },
    };
    const a = await (await post("/api/v1/biome/scatter", body)).json(),
      b = await (await post("/api/v1/biome/scatter", body)).json();
    assert.equal(a.schema, "cranberry-forge.biome/1");
    assert.deepEqual(a, b);
    assert.equal(a.points.length, 25);
    assert.ok(a.points.every((p) => p.position[1] === 3));
    const trail = await (
      await post("/api/v1/flux/validate", {
        schema: "cranberry-forge.flux/1",
        options: { width: 0.8 },
      })
    ).json();
    assert.equal(trail.options.width, 0.8);
    assert.equal(trail.options.capacity, 256);
    const signal = await (
      await post("/api/v1/signal/validate", {
        schema: "cranberry-forge.signal/1",
        options: { shape: "cone", angle: 80 },
      })
    ).json();
    assert.equal(signal.options.angle, 80);
    assert.equal(signal.options.segments, 48);
    const footprint = await (
      await post("/api/v1/signal/contains", {
        options: { shape: "beam", width: 2, length: 8 },
        points: [
          [0, -4],
          [2, -4],
          [0, 1],
          [1, -8],
        ],
      })
    ).json();
    assert.deepEqual(footprint.inside, [true, false, false, true]);
    assert.equal(
      (await post("/api/v1/signal/contains", { points: [[0]] })).status,
      422,
    );
    assert.equal(
      (
        await post("/api/v1/signal/contains", {
          points: Array.from({ length: 10001 }, () => [0, 0]),
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await post("/api/v1/signal/validate", {
          schema: "cranberry-forge.signal/1",
          options: { innerRadius: 6, radius: 5 },
        })
      ).status,
      422,
    );
    assert.equal((await post("/api/v1/biome/scatter", "{bad")).status, 400);
    assert.equal(
      (
        await post(
          "/api/v1/biome/scatter",
          {},
          { "content-type": "text/plain" },
        )
      ).status,
      415,
    );
    assert.equal(
      (await post("/api/v1/biome/scatter", { options: { count: 20000 } }))
        .status,
      422,
    );
    assert.equal(
      (
        await post("/api/v1/flux/validate", {
          schema: "cranberry-forge.flux/1",
          options: { width: -1 },
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await post("/api/v1/biome/scatter", {
          surface: { type: "javascript", code: "alert(1)" },
        })
      ).status,
      422,
    );
    assert.equal((await fetch(base + "/api/v1/biome/scatter")).status, 405);
    assert.equal((await fetch(base + "/index.html")).status, 200);
    const js = await fetch(base + "/packages/biome/index.js");
    assert.match(js.headers.get("content-type"), /javascript/);
    assert.notEqual((await fetch(base + "/%2e%2e%2fpackage.json")).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

async function httpClient(t) {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path, data, expectedStatus = 200) => {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    assert.equal(response.status, expectedStatus, JSON.stringify(result));
    assert.match(response.headers.get("content-type"), /application\/json/);
    if (expectedStatus !== 200) assert.equal(typeof result.error, "string");
    return result;
  };
}

const craftRequest = () => ({
  catalog: [
    { id: "ore", maxStack: 8, weight: 1 },
    { id: "gear", weight: 1 },
    { id: "chip", weight: 2 },
    { id: "blade", width: 2, weight: 2 },
    { id: "anchor", weight: 20 },
  ],
  snapshot: {
    schema: "cranberry-forge.satchel/1",
    columns: 2,
    rows: 1,
    maxWeight: 10,
    nextId: 3,
    items: [
      { id: "s1", itemId: "ore", quantity: 2, x: 0, y: 0, rotated: false },
      { id: "s2", itemId: "gear", quantity: 1, x: 1, y: 0, rotated: false },
    ],
  },
  recipe: {
    ingredients: [{ itemId: "ore", quantity: 2 }],
    outputs: [{ itemId: "chip", quantity: 1 }],
  },
});

test("HTTP crafting commits saved results and rolls back partial work on failure", async (t) => {
  const post = await httpClient(t),
    path = "/api/v1/satchel/craft",
    request = craftRequest();
  for (const [reason, recipe] of [
    [
      "no-space",
      {
        ingredients: request.recipe.ingredients,
        outputs: [
          { itemId: "chip", quantity: 1 },
          { itemId: "blade", quantity: 1 },
        ],
      },
    ],
    [
      "weight-limit",
      {
        ingredients: request.recipe.ingredients,
        outputs: [
          { itemId: "chip", quantity: 1 },
          { itemId: "anchor", quantity: 1 },
        ],
      },
    ],
    [
      "missing-items",
      {
        ingredients: [
          { itemId: "ore", quantity: 2 },
          { itemId: "gear", quantity: 2 },
        ],
        outputs: request.recipe.outputs,
      },
    ],
  ]) {
    const failed = await post(path, { ...request, recipe });
    assert.deepEqual(failed.result, { ok: false, reason });
    assert.deepEqual(failed.snapshot, request.snapshot);
  }

  const crafted = await post(path, request);
  assert.deepEqual(crafted.result, { ok: true });
  assert.deepEqual(crafted.snapshot, {
    ...request.snapshot,
    nextId: 4,
    items: [
      request.snapshot.items[1],
      { id: "s3", itemId: "chip", quantity: 1, x: 0, y: 0, rotated: false },
    ],
  });
  const retry = await post(path, { ...request, snapshot: crafted.snapshot });
  assert.deepEqual(retry.result, { ok: false, reason: "missing-items" });
  assert.deepEqual(retry.snapshot, crafted.snapshot);

  const recycled = await post(path, {
    catalog: request.catalog,
    snapshot: JSON.stringify(crafted.snapshot),
    recipe: {
      ingredients: [{ itemId: "chip", quantity: 1 }],
      outputs: [{ itemId: "ore", quantity: 2 }],
    },
  });
  assert.deepEqual(recycled.result, { ok: true });
  assert.equal(recycled.snapshot.nextId, 5);
  assert.equal(recycled.snapshot.items[1].id, "s4");
  assert.equal(recycled.snapshot.items[1].itemId, "ore");
  assert.equal(recycled.snapshot.items[1].quantity, 2);
  assert.deepEqual(await post(path, request), crafted);
});

test("HTTP crafting enforces grid limits for object and encoded saves", async (t) => {
  const post = await httpClient(t),
    path = "/api/v1/satchel/craft",
    request = craftRequest(),
    oversized = { ...request.snapshot, columns: 32, rows: 4 };
  for (const snapshot of [oversized, JSON.stringify(oversized)]) {
    const error = await post(path, { ...request, snapshot }, 422);
    assert.match(error.error, /96 cells/);
  }
  for (const field of ["ingredients", "outputs"])
    await post(
      path,
      {
        ...request,
        recipe: {
          ...request.recipe,
          [field]: Array.from({ length: 9 }, () => ({
            itemId: "ore",
            quantity: 1,
          })),
        },
      },
      422,
    );
  await post(
    path,
    { ...request, snapshot: { ...request.snapshot, nextId: 1 } },
    422,
  );
  await post(path, { ...request, catalog: [] }, 422);
  await post(
    path,
    { ...request, recipe: { ingredients: [], outputs: [] } },
    422,
  );
  const limit = await post(path, {
    ...request,
    snapshot: { ...request.snapshot, columns: 32, rows: 3 },
  });
  assert.equal(limit.result.ok, true);
});

const dialogueStory = () => ({
  id: "workshop",
  start: "welcome",
  variables: { coins: 0, deliveries: 0 },
  nodes: {
    welcome: {
      speaker: "Mira",
      text: "You have {{coins}} coins.",
      onEnter: [{ op: "add", variable: "coins", value: 1 }],
      choices: [
        {
          id: "work",
          text: "Help once",
          target: "welcome",
          once: true,
          effects: [{ op: "add", variable: "coins", value: 2 }],
        },
        {
          id: "buy",
          text: "Pay four coins",
          target: "delivery",
          when: [{ variable: "coins", op: "gte", value: 4 }],
          effects: [{ op: "add", variable: "coins", value: -4 }],
        },
      ],
    },
    delivery: {
      text: "Delivery {{deliveries}} is ready.",
      onEnter: [{ op: "add", variable: "deliveries", value: 1 }],
    },
  },
});

test("HTTP dialogue validates, restores and advances consequences without replay", async (t) => {
  const post = await httpClient(t),
    path = "/api/v1/chatter/step",
    { story } = await post("/api/v1/chatter/validate", {
      story: dialogueStory(),
    });
  assert.deepEqual(story.variables, { coins: 0, deliveries: 0 });
  assert.equal(story.nodes.delivery.next, null);
  assert.deepEqual(story.nodes.delivery.choices, []);
  assert.equal(story.nodes.welcome.choices[1].once, false);
  const started = await post(path, { story });
  assert.deepEqual(started.result, { ok: true });
  assert.equal(started.view.text, "You have 1 coins.");
  assert.deepEqual(started.snapshot.visits, { welcome: 1 });
  assert.deepEqual(
    started.view.choices.map((choice) => choice.enabled),
    [true, false],
  );

  for (const [action, reason] of [
    [{ choiceId: "buy" }, "unavailable"],
    [{ choiceId: "missing" }, "not-found"],
    [{ advance: true }, "choice-required"],
  ]) {
    const failed = await post(path, {
      story,
      snapshot: started.snapshot,
      ...action,
    });
    assert.deepEqual(failed.result, { ok: false, reason });
    assert.deepEqual(failed.snapshot, started.snapshot);
    assert.deepEqual(failed.view, started.view);
  }
  const worked = await post(path, {
    story,
    snapshot: started.snapshot,
    choiceId: "work",
  });
  assert.deepEqual(worked.result, { ok: true });
  assert.equal(worked.snapshot.variables.coins, 4);
  assert.deepEqual(worked.snapshot.visits, { welcome: 2 });
  assert.deepEqual(worked.snapshot.usedChoices, ["welcome/work"]);
  assert.deepEqual(
    worked.view.choices.map((choice) => choice.enabled),
    [false, true],
  );
  assert.deepEqual(
    await post(path, { story, snapshot: JSON.stringify(worked.snapshot) }),
    worked,
  );
  const repeated = await post(path, {
    story,
    snapshot: worked.snapshot,
    choiceId: "work",
  });
  assert.deepEqual(repeated.result, { ok: false, reason: "unavailable" });
  assert.deepEqual(repeated.snapshot, worked.snapshot);
  const delivered = await post(path, {
    story,
    snapshot: worked.snapshot,
    choiceId: "buy",
  });
  assert.equal(delivered.view.nodeId, "delivery");
  assert.equal(delivered.view.text, "Delivery 1 is ready.");
  assert.equal(delivered.view.canAdvance, true);
  assert.deepEqual(delivered.snapshot.variables, { coins: 0, deliveries: 1 });
  assert.deepEqual(
    await post(path, { story, snapshot: delivered.snapshot }),
    delivered,
  );
  const ended = await post(path, {
    story,
    snapshot: delivered.snapshot,
    advance: true,
  });
  assert.equal(ended.view.ended, true);
  assert.equal(ended.view.canAdvance, false);
  assert.equal(ended.snapshot.ended, true);
  const afterEnd = await post(path, {
    story,
    snapshot: ended.snapshot,
    advance: true,
  });
  assert.deepEqual(afterEnd.result, { ok: false, reason: "ended" });
  assert.deepEqual(afterEnd.snapshot, ended.snapshot);
  assert.deepEqual(await post(path, { story }), started);
});

test("HTTP dialogue rejects invalid explicit snapshots, actions and stories", async (t) => {
  const post = await httpClient(t),
    path = "/api/v1/chatter/step",
    story = dialogueStory(),
    started = await post(path, { story });
  for (const snapshot of [null, false, 0, "", [], {}, "null", "{bad"])
    await post(path, { story, snapshot }, 422);
  for (const action of [
    { advance: false },
    { advance: null },
    { advance: 0 },
    { choiceId: null },
    { choiceId: 0 },
    { choiceId: "work", advance: true },
  ])
    await post(path, { story, snapshot: started.snapshot, ...action }, 422);
  const changed = structuredClone(story);
  changed.nodes.welcome.text = "Edited story";
  await post(path, { story: changed, snapshot: started.snapshot }, 422);
  await post(
    path,
    {
      story,
      snapshot: {
        ...started.snapshot,
        variables: { coins: "1", deliveries: 0 },
      },
    },
    422,
  );
  const broken = structuredClone(story);
  broken.nodes.welcome.choices[0].target = "absent";
  for (const endpoint of [path, "/api/v1/chatter/validate"])
    await post(endpoint, { story: broken }, 422);
  for (const endpoint of [
    path,
    "/api/v1/chatter/validate",
    "/api/v1/satchel/craft",
  ])
    for (const body of [null, false, [], 0, "request"])
      await post(endpoint, body, 422);
});

test("HTTP gameplay OpenAPI examples match real responses", async (t) => {
  const post = await httpClient(t),
    api = JSON.parse(
      await readFile(
        new URL("../dist/api-reference.json", import.meta.url),
        "utf8",
      ),
    );
  for (const [path, input, output] of [
    ["/api/v1/satchel/craft", "smelt", "crafted"],
    ["/api/v1/chatter/validate", "gatekeeper", "normalized"],
    ["/api/v1/chatter/step", "start", "started"],
    ["/api/v1/chatter/step", "choose", "helped"],
    ["/api/v1/chatter/step", "inspect", "helped"],
    ...Object.keys(
      api.paths["/api/v1/trailmark/step"].post.requestBody.content[
        "application/json"
      ].examples,
    ).map((name) => ["/api/v1/trailmark/step", name, name]),
  ]) {
    const operation = api.paths[path].post;
    assert.deepEqual(
      await post(
        path,
        operation.requestBody.content["application/json"].examples[input].value,
      ),
      operation.responses[200].content["application/json"].examples[output]
        .value,
    );
  }
});

const questDefinitions = () => [
  {
    id: "bridge",
    title: "Restore the bridge",
    objectives: [
      { id: "wood", type: "gather", tags: ["wood", "harbor"], target: 3 },
      { id: "arch", type: "restore", tags: ["bridge"], target: 1 },
    ],
  },
  {
    id: "beacon",
    prerequisites: ["bridge"],
    objectives: [{ id: "light", type: "restore", tags: ["beacon"], target: 1 }],
  },
];

test("HTTP Trailmark completes a saved prerequisite chain and claims each receipt once", async (t) => {
  const post = await httpClient(t),
    path = "/api/v1/trailmark/step",
    definitions = questDefinitions(),
    initial = await post(path, { definitions });
  assert.equal(initial.result, null);
  assert.equal(initial.snapshot.version, 1);
  assert.equal(initial.snapshot.dedupeCapacity, 2048);
  assert.deepEqual(
    initial.quests.map((q) => q.status),
    ["available", "locked"],
  );
  let current = initial;
  const step = async (action) =>
    (current = await post(path, {
      definitions,
      snapshot: current.snapshot,
      action,
    }));
  await step({ type: "activate", questId: "beacon" });
  assert.equal(current.result.activated, false);
  assert.equal(current.result.reason, "prerequisites");
  assert.deepEqual(current.snapshot, initial.snapshot);
  await step({ type: "claim", questId: "bridge" });
  assert.equal(current.result, null);
  assert.deepEqual(current.snapshot, initial.snapshot);
  await step({
    type: "dispatch",
    event: {
      id: "early",
      type: "gather",
      tags: ["wood", "harbor"],
      amount: 3,
    },
  });
  assert.equal(current.result.accepted, true);
  assert.deepEqual(current.result.changes, []);
  await step({ type: "activate", questId: "bridge" });
  assert.equal(current.result.activated, true);
  assert.equal(current.result.quest.objectives[0].count, 0);
  const activated = current.snapshot;
  await step({ type: "activate", questId: "bridge" });
  assert.equal(current.result.reason, "already-started");
  assert.deepEqual(current.snapshot, activated);
  for (const event of [
    { id: "wrong-type", type: "found", tags: ["wood", "harbor"] },
    { id: "missing-tag", type: "gather", tags: ["wood"] },
  ]) {
    await step({ type: "dispatch", event });
    assert.deepEqual(current.result.changes, []);
  }
  await step({
    type: "dispatch",
    event: {
      id: "timber-1",
      type: "gather",
      tags: ["wood", "harbor", "extra"],
      amount: 10,
    },
  });
  assert.deepEqual(current.result.changes, [
    { questId: "bridge", objectiveId: "wood", before: 0, after: 3, target: 3 },
  ]);
  assert.deepEqual(current.result.completed, []);
  const repair = {
    type: "dispatch",
    event: { id: "arch-1", type: "restore", tags: ["bridge"] },
  };
  await step(repair);
  assert.equal(current.result.completed.length, 1);
  const receipt = current.result.completed[0],
    completed = current.snapshot;
  assert.equal(receipt.questId, "bridge");
  assert.equal(receipt.claimedAt, null);
  assert.deepEqual(
    current.quests.map((q) => q.status),
    ["completed", "available"],
  );
  const inspected = await post(path, { definitions, snapshot: completed });
  assert.equal(inspected.result, null);
  assert.deepEqual(inspected.snapshot, completed);
  assert.deepEqual(inspected.quests, current.quests);
  await step(repair);
  assert.deepEqual(current.result, {
    accepted: false,
    duplicate: true,
    sequence: completed.sequence,
    changes: [],
    completed: [],
  });
  assert.deepEqual(current.snapshot, completed);
  await step({ type: "claim", questId: "bridge" });
  assert.equal(current.result.id, receipt.id);
  assert.equal(current.result.claimedAt, receipt.completedAt + 1);
  const claimed = current.snapshot;
  await step({ type: "claim", questId: "bridge" });
  assert.equal(current.result, null);
  assert.deepEqual(current.snapshot, claimed);
  await step({ type: "activate", questId: "beacon" });
  assert.equal(current.result.activated, true);
  await step({
    type: "dispatch",
    event: { id: "lamp-1", type: "restore", tags: ["beacon"] },
  });
  assert.equal(current.result.completed[0].questId, "beacon");
  await step({ type: "claim", questId: "beacon" });
  assert.equal(current.result.questId, "beacon");
  assert.deepEqual(
    current.quests.map((q) => q.status),
    ["claimed", "claimed"],
  );
  assert.deepEqual(
    (await post(path, { definitions, snapshot: current.snapshot })).snapshot,
    current.snapshot,
  );
  assert.deepEqual(await post(path, { definitions }), initial);
});

test("HTTP Trailmark preserves bounded FIFO event dedupe across saved requests", async (t) => {
  const post = await httpClient(t),
    path = "/api/v1/trailmark/step",
    definitions = questDefinitions();
  let current = await post(path, { definitions });
  // This is the valid save shape emitted by a journal configured with capacity 2.
  current.snapshot.dedupeCapacity = 2;
  current = await post(path, {
    definitions,
    snapshot: current.snapshot,
    action: { type: "activate", questId: "bridge" },
  });
  const dispatch = async (event) =>
    (current = await post(path, {
      definitions,
      snapshot: current.snapshot,
      action: { type: "dispatch", event },
    }));
  const gather = { id: "a", type: "gather", tags: ["wood", "harbor"] };
  await dispatch(gather);
  await dispatch({ id: "b", type: "unmatched" });
  const before = current.snapshot;
  await post(
    path,
    {
      definitions,
      snapshot: before,
      action: { type: "dispatch", event: { ...gather, amount: 0 } },
    },
    422,
  );
  await dispatch({ id: "a", type: "different-but-valid", amount: 99 });
  assert.equal(current.result.duplicate, true);
  assert.deepEqual(current.snapshot, before);
  await dispatch({ id: "c", type: "unmatched" });
  assert.deepEqual(
    current.snapshot.recentEvents.map((e) => e.id),
    ["b", "c"],
  );
  await dispatch(gather);
  assert.equal(current.result.accepted, true);
  assert.equal(current.quests[0].objectives[0].count, 2);
  assert.equal(current.snapshot.dedupeCapacity, 2);
  const inspected = await post(path, {
    definitions,
    snapshot: current.snapshot,
  });
  assert.deepEqual(inspected.snapshot, current.snapshot);
});

test("HTTP Trailmark rejects malformed actions, definitions, events and supplied saves", async (t) => {
  const post = await httpClient(t),
    path = "/api/v1/trailmark/step",
    definitions = questDefinitions();
  const initial = await post(path, { definitions }),
    valid = initial.snapshot;
  for (const snapshot of [null, false, 0, "", [], {}, JSON.stringify(valid)])
    await post(path, { definitions, snapshot }, 422);
  for (const action of [
    null,
    false,
    0,
    "activate",
    [],
    {},
    { type: "inspect" },
    { type: "activate" },
    { type: "claim", questId: "unknown" },
    { type: "activate", questId: "bridge", event: {} },
    {
      type: "dispatch",
      questId: "bridge",
      event: { id: "one", type: "gather" },
    },
    { type: "dispatch" },
  ])
    await post(path, { definitions, snapshot: valid, action }, 422);
  for (const event of [
    null,
    { id: "x", type: "gather", amount: 0 },
    { id: "x", type: "gather", amount: 1000001 },
    { id: "x", type: "gather", tags: ["wood", "wood"] },
    { id: " ", type: "gather" },
    { id: "x", type: "gather", extra: true },
  ])
    await post(
      path,
      { definitions, snapshot: valid, action: { type: "dispatch", event } },
      422,
    );
  for (const mutate of [
    (s) => (s.version = 2),
    (s) => (s.catalogKey += " "),
    (s) => (s.dedupeCapacity = 10001),
    (s) => (s.sequence = -1),
    (s) => (s.quests[0].counters[0].count = 1),
    (s) => (s.quests[0].counters = [null]),
    (s) => s.quests.reverse(),
    (s) => (s.extra = true),
  ]) {
    const snapshot = structuredClone(valid);
    mutate(snapshot);
    await post(path, { definitions, snapshot }, 422);
  }
  for (const invalidDefinitions of [
    [],
    [null],
    [definitions[0], definitions[0]],
    [{ ...definitions[0], prerequisites: ["bridge"] }],
    [{ ...definitions[0], prerequisites: ["missing"] }],
    [{ ...definitions[0], extra: true }],
    Array.from({ length: 129 }, (_, i) => ({
      id: `q${i}`,
      objectives: [{ id: "x", type: "gather", target: 1 }],
    })),
  ])
    await post(path, { definitions: invalidDefinitions }, 422);
  await post(path, { definitions, dedupeCapacity: 2 }, 422);
  for (const body of [null, false, [], 0, "request"])
    await post(path, body, 422);
  assert.deepEqual(await post(path, { definitions, snapshot: valid }), initial);
});
