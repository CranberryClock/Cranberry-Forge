// Regenerate the five workshop operations and their executable examples.
import { readFile, writeFile } from "node:fs/promises";
import { expansionRequest } from "./expansion-api.mjs";
import { expansionExamples } from "./expansion-examples.mjs";
const doc = JSON.parse(await readFile("dist/api-reference.json", "utf8"));
const schemas = doc.components.schemas;
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const obj = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const num = (minimum, maximum) => ({
  type: "number",
  ...(minimum === undefined ? {} : { minimum }),
  ...(maximum === undefined ? {} : { maximum }),
});
const int = (minimum, maximum) => ({
  ...num(minimum, maximum),
  type: "integer",
});
const str = { type: "string" };
const bool = { type: "boolean" };
const arr = (items, minItems = 0, maxItems) => ({
  type: "array",
  items,
  minItems,
  ...(maxItems === undefined ? {} : { maxItems }),
});
const nullable = (value) => ({ anyOf: [value, { type: "null" }] });
const tuple = (size, value = num()) => ({ ...arr(value, size, size) });
const safeTime = num(0, 1e9);
const cell = obj({
  x: int(-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
  z: int(-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
});
const profile = (min, max) => ({
  oneOf: [
    num(min, max),
    arr(obj({ at: num(0, 1), value: num(min, max) }), 2, 128),
  ],
  description:
    "Profile keys strictly increase from at=0 to at=1. Closed routes require equal endpoint values.",
});
schemas.LoomOptions = obj(
  {
    points: arr(tuple(3, num(-1e6, 1e6)), 2, 128),
    closed: bool,
    segments: int(8, 4096),
    width: profile(0.001, 1000),
    bank: profile(-Math.PI, Math.PI),
    up: tuple(3, num(-1e6, 1e6)),
    uvScale: num(0.001, 1e6),
    borderWidth: num(0, 100),
    borderHeight: num(0, 100),
  },
  [],
);
schemas.LoomRecipe = obj({
  schema: { const: "cranberry-forge.loom/1" },
  options: ref("LoomOptions"),
});
schemas.LoomSample = obj({
  u: num(0, 1),
  distance: num(0),
  width: num(0.001, 1000),
  bank: num(-Math.PI, Math.PI),
  position: tuple(3),
  tangent: tuple(3),
  right: tuple(3),
  up: tuple(3),
  quaternion: tuple(4),
});
schemas.WayfinderConfig = obj(
  {
    width: int(1, 128),
    height: int(1, 128),
    cellSize: num(0.001, 1000),
    origin: obj({ x: num(-1e6, 1e6), z: num(-1e6, 1e6) }),
    diagonal: { enum: ["never", "no-cut", "always"] },
    defaultCost: num(1, 1000),
  },
  ["width", "height"],
);
schemas.WayfinderSnapshot = obj({
  version: { const: 1 },
  config: ref("WayfinderConfig"),
  revision: int(0, Number.MAX_SAFE_INTEGER),
  cells: arr(obj({ blocked: bool, cost: num(1, 1000) }), 1, 16384),
});
schemas.WayfinderResult = obj({
  status: {
    enum: [
      "found",
      "outside-grid",
      "blocked-start",
      "blocked-goal",
      "unreachable",
      "budget-exceeded",
    ],
  },
  cells: arr(cell, 0, 16384),
  points: arr(obj({ x: num(), y: num(), z: num() }), 0, 16384),
  cost: nullable(num(0)),
  visited: int(0, 16384),
  revision: int(0, Number.MAX_SAFE_INTEGER),
});
schemas.SpringState = obj({
  value: num(-1e12, 1e12),
  velocity: num(-1e12, 1e12),
  target: num(-1e12, 1e12),
});
schemas.SpringOptions = obj(
  { frequency: num(0.01, 100), dampingRatio: num(0, 10) },
  [],
);
schemas.ParcelEntry = obj(
  {
    id: str,
    itemId: str,
    label: str,
    rarity: str,
    weight: int(0, 1e6),
    min: int(1, 1e6),
    max: int(1, 1e6),
  },
  ["id", "itemId", "rarity", "weight"],
);
schemas.ParcelTable = obj(
  {
    id: str,
    entries: arr(ref("ParcelEntry"), 1, 256),
    pity: nullable(obj({ after: int(1, 10000), rarities: arr(str, 1, 256) })),
  },
  ["id", "entries"],
);
schemas.ParcelSnapshot = obj({
  version: { const: 1 },
  tableKey: str,
  seed: int(0, 4294967295),
  rngState: int(0, 4294967295),
  draws: int(0, 4294967295),
  rolls: int(0, 1e9),
  misses: int(0, 10000),
});
schemas.ParcelReceipt = obj({
  id: str,
  roll: int(1, 1e9),
  entryId: str,
  itemId: str,
  label: str,
  rarity: str,
  quantity: int(1, 1e6),
  guaranteed: bool,
  probability: num(0, 1),
  baseProbability: num(0, 1),
  missesBefore: int(0, 10000),
  missesAfter: int(0, 10000),
});
schemas.ParcelOdds = obj({
  guaranteed: bool,
  misses: int(0, 10000),
  remaining: nullable(int(0, 10000)),
  entries: arr(
    obj({
      ...schemas.ParcelEntry.properties,
      probability: num(0, 1),
      baseProbability: num(0, 1),
    }),
    1,
    256,
  ),
});
const abilityId = { type: "string", pattern: "^[a-zA-Z][a-zA-Z0-9_-]{0,47}$" };
schemas.TempoDefinition = obj(
  {
    id: abilityId,
    charges: int(1, 16),
    recharge: num(0.001, 86400),
    cooldown: num(0, 86400),
    usesGlobalCooldown: bool,
  },
  ["id", "recharge"],
);
schemas.TempoSnapshot = obj({
  schema: { const: "cranberry-forge.tempo/1" },
  definitions: arr(ref("TempoDefinition"), 1, 64),
  globalCooldown: num(0, 86400),
  time: safeTime,
  globalReadyAt: nullable(num(0, 1e9 + 86400)),
  abilities: arr(
    obj({
      id: abilityId,
      charges: int(0, 16),
      rechargeAt: nullable(num(0)),
      cooldownUntil: nullable(num(0)),
    }),
    1,
    64,
  ),
});
const reason = { enum: ["global-cooldown", "cooldown", "no-charges"] };
schemas.TempoAbilityState = obj({
  id: abilityId,
  charges: int(0, 16),
  maxCharges: int(1, 16),
  rechargeRemaining: num(0, 86400),
  rechargeProgress: num(0, 1),
  cooldownRemaining: num(0, 86400),
  globalRemaining: num(0, 86400),
  ready: bool,
  reason: nullable(reason),
  retryAfter: num(0, 86400),
});
schemas.TempoEvent = {
  oneOf: [
    obj({
      type: { enum: ["used", "recharged"] },
      id: abilityId,
      at: safeTime,
      charges: int(0, 16),
    }),
    obj({ type: { const: "cooldown-ready" }, id: abilityId, at: safeTime }),
    obj({ type: { const: "global-ready" }, at: safeTime }),
  ],
};
schemas.TempoState = obj({
  time: safeTime,
  globalRemaining: num(0, 86400),
  globalProgress: num(0, 1),
  abilities: arr(ref("TempoAbilityState"), 1, 64),
});
schemas.TempoUse = {
  oneOf: [
    obj({
      ok: { const: true },
      id: abilityId,
      at: safeTime,
      state: ref("TempoAbilityState"),
      events: arr(ref("TempoEvent")),
    }),
    obj({
      ok: { const: false },
      id: abilityId,
      reason,
      retryAfter: num(0, 86400),
      state: ref("TempoAbilityState"),
      events: arr(ref("TempoEvent"), 0, 0),
    }),
  ],
};
const operations = {
  loom: {
    summary: "Sample an editable spline track",
    description:
      "Build native Three.js geometry from options, return normalized recipe and arc-length frames, then dispose temporary resources. Local-space vectors/quaternions are numeric arrays. HTTP samples are bounded to [0,1]; closed sample(1) wraps to zero. This does not return a mesh or render an image.",
    request: obj({
      options: ref("LoomOptions"),
      samples: arr(num(0, 1), 1, 128),
    }),
    response: obj({
      recipe: ref("LoomRecipe"),
      samples: arr(ref("LoomSample"), 1, 128),
    }),
  },
  wayfinder: {
    summary: "Find a weighted grid route",
    description:
      "Supply grid options or a saved snapshot, optional atomic cell edits, and start/goal cells. Returns route status and resulting grid snapshot. A blocked or unreachable route is a normal 200 response with empty path and null cost. No server session is retained.",
    request: {
      ...obj(
        {
          grid: ref("WayfinderConfig"),
          snapshot: ref("WayfinderSnapshot"),
          cells: arr(
            obj(
              {
                x: int(0, 127),
                z: int(0, 127),
                blocked: bool,
                cost: num(1, 1000),
              },
              ["x", "z"],
            ),
            0,
            16384,
          ),
          start: cell,
          goal: cell,
          maxVisited: int(1, 16384),
        },
        ["start", "goal"],
      ),
      oneOf: [
        { required: ["grid"], not: { required: ["snapshot"] } },
        { required: ["snapshot"], not: { required: ["grid"] } },
      ],
    },
    response: obj({
      result: ref("WayfinderResult"),
      snapshot: ref("WayfinderSnapshot"),
    }),
  },
  spring: {
    summary: "Advance a scalar damped spring analytically",
    description:
      "All state values are required. Units are seconds and hertz; dampingRatio is dimensionless. The target remains constant during the step. Returns detached value, velocity and target. Output outside package bounds rejects.",
    request: obj(
      {
        state: ref("SpringState"),
        dt: num(0, 60),
        options: ref("SpringOptions"),
      },
      ["state", "dt"],
    ),
    response: obj({ state: ref("SpringState") }),
  },
  parcel: {
    summary: "Generate deterministic loot receipts",
    description:
      "Open 1–1000 draws from a flat table. Supply a uint32 seed for a new stream or a table-compatible snapshot to resume it. An explicit seed with a save must match. Pity is a hard guarantee on the Nth consecutive eligible attempt, with natural qualifying drops resetting misses. Returns next-roll odds. Does not grant items or retain state.",
    request: obj(
      {
        table: ref("ParcelTable"),
        seed: int(0, 4294967295),
        snapshot: ref("ParcelSnapshot"),
        count: int(1, 1000),
      },
      ["table"],
    ),
    response: obj({
      receipts: arr(ref("ParcelReceipt"), 1, 1000),
      snapshot: ref("ParcelSnapshot"),
      odds: ref("ParcelOdds"),
    }),
  },
  tempo: {
    summary: "Advance ability clocks and optionally spend a charge",
    description:
      "Supply definitions/options for a new clock or a snapshot to resume. First tick dt seconds (default 0), then optionally tryUse the supplied use ID. A blocked use is a normal 200 response with result.ok=false. No server clock or wall-time advancement occurs. Missing charges refill sequentially; cooldown runs concurrently.",
    request: {
      ...obj(
        {
          definitions: arr(ref("TempoDefinition"), 1, 64),
          options: obj({ globalCooldown: num(0, 86400) }, []),
          snapshot: ref("TempoSnapshot"),
          dt: num(0, 86400),
          use: abilityId,
        },
        [],
      ),
      oneOf: [
        { required: ["definitions"], not: { required: ["snapshot"] } },
        {
          required: ["snapshot"],
          not: {
            anyOf: [{ required: ["definitions"] }, { required: ["options"] }],
          },
        },
      ],
    },
    response: obj({
      events: arr(ref("TempoEvent")),
      result: nullable(ref("TempoUse")),
      state: ref("TempoState"),
      snapshot: ref("TempoSnapshot"),
    }),
  },
};
for (const [path, input] of Object.entries(expansionExamples)) {
  const id = path.split("/")[3],
    op = operations[id];
  const output = JSON.parse(JSON.stringify(expansionRequest(path, input)));
  doc.paths[path] = {
    post: {
      summary: op.summary,
      description: op.description,
      operationId: `${id}${path.split("/").at(-1)[0].toUpperCase()}${path.split("/").at(-1).slice(1)}`,
      tags: [id],
      externalDocs: {
        description: `${id} JavaScript API and tutorial`,
        url: `https://github.com/CranberryClock/Cranberry-Forge/tree/main/dist/packages/${id}`,
      },
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: op.request,
            examples: { basic: { value: input } },
          },
        },
      },
      responses: {
        200: {
          description:
            "Successful request (inspect action status in the result)",
          content: {
            "application/json": {
              schema: op.response,
              examples: { basic: { value: output } },
            },
          },
        },
        422: {
          description:
            "Invalid data, incompatible snapshot or exceeded workload bound",
          content: { "application/json": { schema: obj({ error: str }) } },
        },
      },
    },
  };
}
await writeFile("dist/api-reference.json", JSON.stringify(doc, null, 2) + "\n");
console.log(
  "Documented five expansion endpoints with executable request/response examples.",
);
