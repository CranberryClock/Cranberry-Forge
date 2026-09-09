import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppServer } from "../scripts/server.mjs";
test("Pipeline HTTP examples match the documented results and rejected saves preserve state", async (t) => {
  const server = createAppServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body) => {
    const r = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  const doc = JSON.parse(await readFile("dist/api-reference.json", "utf8"));
  for (const path of [
    "/api/v1/ledger/evaluate",
    "/api/v1/keepsake/migrate",
    "/api/v1/sift/audit",
  ]) {
    const op = doc.paths[path].post;
    const r = await post(
      path,
      op.requestBody.content["application/json"].examples.basic.value,
    );
    assert.equal(r.status, 200);
    assert.deepEqual(
      r.data,
      op.responses[200].content["application/json"].examples.basic.value,
    );
  }
  const future = await post("/api/v1/keepsake/migrate", {
    profile: "observatory",
    save: { format: "forge.observatory", version: 8, payload: {} },
  });
  assert.equal(future.data.error.code, "FUTURE_VERSION");
  assert.equal(future.data.ok, false);
  assert.equal(
    (await post("/api/v1/keepsake/migrate", { profile: "unknown", save: {} }))
      .status,
    422,
  );
  assert.equal(
    (
      await post("/api/v1/ledger/evaluate", {
        base: { x: 1 },
        modifiers: Array(2049).fill({}),
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await post("/api/v1/sift/audit", {
        manifest: Array(10001).fill({ id: "a" }),
      })
    ).status,
    422,
  );
});
