import test from "node:test";
import assert from "node:assert/strict";
import { inspectPublicFile } from "../scripts/check-privacy.mjs";

test("public-source guard recognizes sensitive paths without exposing values", () => {
  assert.deepEqual(inspectPublicFile(".env", Buffer.from("example")), [
    "sensitive file path",
  ]);
  assert.deepEqual(
    inspectPublicFile(".openai/hosting.json", Buffer.from("{}")),
    ["sensitive file path"],
  );
  assert.deepEqual(inspectPublicFile("example.pem", Buffer.from([0, 1])), [
    "sensitive file path",
  ]);
  assert.deepEqual(
    inspectPublicFile(".env.example", Buffer.from("PORT=4173")),
    [],
  );
});

test("public-source guard recognizes credential and internal-metadata signatures", () => {
  for (const [value, label] of [
    ["ghp_" + "x".repeat(36), "GitHub token"],
    ["sk-proj-" + "x".repeat(40), "API token"],
    ["AKIA" + "A".repeat(16), "AWS access key"],
    [["-----BEGIN", "PRIVATE KEY-----"].join(" "), "private key"],
    ["https://demo." + "chatgpt.site/path", "private deployment URL"],
    ["/work" + "space/example/source", "internal workspace path"],
    ["appgprj_" + "example", "deployment identifier"],
  ]) {
    assert.deepEqual(inspectPublicFile("example.txt", Buffer.from(value)), [
      label,
    ]);
  }
});

test("public-source guard accepts ordinary public documentation and binary images", () => {
  assert.deepEqual(
    inspectPublicFile(
      "README.md",
      Buffer.from("Use Three.js with Cranberry Forge. http://127.0.0.1:4173"),
    ),
    [],
  );
  assert.deepEqual(
    inspectPublicFile("sample.png", Buffer.from([137, 80, 78, 71, 0, 1])),
    [],
  );
});
