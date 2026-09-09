import { readFile, writeFile } from "node:fs/promises";
import { pipelineRequest } from "./pipeline-api.mjs";
import { memories, cargoInput } from "../dist/pipeline-fixtures.js";
export const pipelineExamples = {
  "/api/v1/ledger/evaluate": {
    base: { attack: 50, speed: 3 },
    modifiers: [
      { id: "sword", source: "sword", stat: "attack", kind: "flat", value: 10 },
    ],
    rounding: 2,
  },
  "/api/v1/keepsake/migrate": { profile: "observatory", save: memories.first },
  "/api/v1/sift/audit": cargoInput(),
};
const doc = JSON.parse(await readFile("dist/api-reference.json", "utf8"));
const number = { type: "number" },
  text = { type: "string" },
  integer = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const modifier = {
  type: "object",
  required: ["id", "source", "stat", "kind", "value"],
  properties: {
    id: text,
    source: text,
    stat: text,
    kind: { enum: ["flat", "additivePercent", "multiplier"] },
    value: number,
  },
};
const metrics = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(
    ["bytes", "triangles", "textureWidth", "textureHeight"].map((k) => [
      k,
      integer,
    ]),
  ),
};
const schemas = {
  "/api/v1/ledger/evaluate": {
    type: "object",
    required: ["base"],
    properties: {
      base: {
        type: "object",
        maxProperties: 256,
        additionalProperties: number,
      },
      modifiers: { type: "array", maxItems: 2048, items: modifier },
      bounds: {
        type: "object",
        additionalProperties: {
          type: "object",
          properties: { min: number, max: number },
        },
      },
      rounding: { type: ["integer", "null"], minimum: 0, maximum: 10 },
    },
  },
  "/api/v1/keepsake/migrate": {
    type: "object",
    required: ["profile", "save"],
    properties: {
      profile: { const: "observatory" },
      save: {
        description:
          "Save JSON string or envelope. Only the registered observatory schema is supported by this example route.",
        oneOf: [
          { type: "string" },
          {
            type: "object",
            required: ["format", "version", "payload"],
            properties: { format: text, version: integer, payload: {} },
          },
        ],
      },
    },
  },
  "/api/v1/sift/audit": {
    type: "object",
    required: ["manifest"],
    properties: {
      manifest: {
        type: "array",
        maxItems: 10000,
        items: {
          type: "object",
          required: ["id"],
          properties: {
            id: text,
            path: text,
            dependencies: { type: "array", items: text },
            requiredExtensions: { type: "array", items: text },
          },
        },
      },
      metrics: { type: "object", additionalProperties: metrics },
      policy: {
        type: "object",
        properties: {
          budgets: metrics,
          allowedExtensions: { type: "array", items: text },
          missingMetrics: { enum: ["error", "warning"] },
        },
      },
    },
  },
};
for (const [path, input] of Object.entries(pipelineExamples)) {
  doc.paths[path] = {
    post: {
      summary: {
        "/api/v1/ledger/evaluate": "Evaluate explainable stats",
        "/api/v1/keepsake/migrate": "Migrate an observatory example save",
        "/api/v1/sift/audit":
          "Audit supplied asset metrics and manifest policies",
      }[path],
      description:
        "Optional stateless local endpoint. application/json up to 2 MiB. No asset file I/O or untrusted JavaScript execution over HTTP.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemas[path],
            examples: { basic: { value: input } },
          },
        },
      },
      responses: {
        200: {
          description:
            "Evaluation result. Inspect ok for Sift and Keepsake domain failures.",
          content: {
            "application/json": {
              schema: { type: "object" },
              examples: { basic: { value: pipelineRequest(path, input) } },
            },
          },
        },
        400: { description: "Invalid JSON" },
        422: { description: "Invalid input or request limit exceeded" },
        413: { description: "Body too large" },
        415: { description: "Content-Type must be application/json" },
      },
    },
  };
}
await writeFile("dist/api-reference.json", JSON.stringify(doc, null, 2) + "\n");
