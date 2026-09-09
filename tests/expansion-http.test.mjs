import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppServer } from "../scripts/server.mjs";
import { expansionExamples } from "../scripts/expansion-examples.mjs";

async function client(t) {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return async (path, body, status = 200) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}${path}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  };
}
test("HTTP expansion executes all five documented requests and exact response examples", async (t) => {
  const post = await client(t);
  const api = JSON.parse(await readFile("dist/api-reference.json", "utf8"));
  for (const [path, input] of Object.entries(expansionExamples)) {
    const op = api.paths[path].post;
    assert.deepEqual(
      op.requestBody.content["application/json"].examples.basic.value,
      input,
    );
    assert.deepEqual(
      await post(path, input),
      op.responses[200].content["application/json"].examples.basic.value,
    );
  }
});
test("HTTP expansion resumes loot, navigation and ability state without global server state", async (t) => {
  const post = await client(t);
  const loot = expansionExamples["/api/v1/parcel/open"];
  const first = await post("/api/v1/parcel/open", { ...loot, count: 2 });
  const resumed = await post("/api/v1/parcel/open", {
    table: loot.table,
    snapshot: first.snapshot,
    count: 3,
  });
  const whole = await post("/api/v1/parcel/open", loot);
  assert.deepEqual([...first.receipts, ...resumed.receipts], whole.receipts);
  assert.deepEqual(resumed.snapshot, whole.snapshot);
  const used = await post(
    "/api/v1/tempo/step",
    expansionExamples["/api/v1/tempo/step"],
  );
  assert.equal(used.result.ok, true);
  const blocked = await post("/api/v1/tempo/step", {
    snapshot: used.snapshot,
    use: "dash",
  });
  assert.equal(blocked.result.ok, false);
  assert.deepEqual(blocked.snapshot, used.snapshot);
  const ready = await post("/api/v1/tempo/step", {
    snapshot: used.snapshot,
    dt: 3,
  });
  assert.equal(ready.state.abilities[0].charges, 2);
  assert.ok(ready.events.some((e) => e.type === "recharged"));
  const routeInput = expansionExamples["/api/v1/wayfinder/path"];
  const route = await post("/api/v1/wayfinder/path", routeInput);
  assert.equal(route.result.status, "found");
  assert.ok(!route.result.cells.some((c) => c.x === 1 && c.z === 0));
  const routeAgain = await post("/api/v1/wayfinder/path", {
    snapshot: route.snapshot,
    start: routeInput.start,
    goal: routeInput.goal,
  });
  assert.deepEqual(routeAgain, route);
});
test("HTTP expansion rejects malformed wrappers, conflicting state and excessive workloads", async (t) => {
  const post = await client(t);
  for (const [path, input] of Object.entries(expansionExamples)) {
    for (const invalid of [
      null,
      [],
      false,
      0,
      "request",
      { ...input, unknown: true },
    ])
      await post(path, invalid, 422);
  }
  const loom = expansionExamples["/api/v1/loom/sample"];
  for (const samples of [[], [null], [-1], [1.1], Array(129).fill(0)])
    await post("/api/v1/loom/sample", { ...loom, samples }, 422);
  for (const snapshot of [null, false, 0, [], {}]) {
    await post(
      "/api/v1/wayfinder/path",
      { snapshot, start: { x: 0, z: 0 }, goal: { x: 1, z: 1 } },
      422,
    );
    await post("/api/v1/tempo/step", { snapshot }, 422);
    await post(
      "/api/v1/parcel/open",
      { table: expansionExamples["/api/v1/parcel/open"].table, snapshot },
      422,
    );
  }
  await post(
    "/api/v1/wayfinder/path",
    { ...expansionExamples["/api/v1/wayfinder/path"], snapshot: {} },
    422,
  );
  await post(
    "/api/v1/tempo/step",
    { ...expansionExamples["/api/v1/tempo/step"], snapshot: {} },
    422,
  );
  await post(
    "/api/v1/tempo/step",
    { ...expansionExamples["/api/v1/tempo/step"], dt: -1 },
    422,
  );
  await post(
    "/api/v1/spring/step",
    { ...expansionExamples["/api/v1/spring/step"], dt: 61 },
    422,
  );
  await post(
    "/api/v1/parcel/open",
    { ...expansionExamples["/api/v1/parcel/open"], count: 1001 },
    422,
  );
});
