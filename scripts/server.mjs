import { expansionPaths, expansionRequest } from "./expansion-api.mjs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { scatter, normalizeOptions } from "../dist/packages/biome/index.js";
import { normalizeTrailOptions } from "../dist/packages/flux/index.js";
import { Inventory } from "../dist/packages/satchel/index.js";
import { Conversation, validateStory } from "../dist/packages/chatter/index.js";
import {
  createJournal,
  LIMITS as TRAILMARK_LIMITS,
  SNAPSHOT_VERSION as TRAILMARK_SNAPSHOT_VERSION,
} from "../dist/packages/trailmark/index.js";
import {
  normalizeSignalOptions,
  containsLocalPoint,
} from "../dist/packages/signal/index.js";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
  ".md": "text/plain; charset=utf-8",
};
const json = (res, status, data) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(data));
};
async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw Object.assign(new Error("Content-Type must be application/json"), {
      status: 415,
    });
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024)
      throw Object.assign(new Error("Body exceeds 2 MB"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}
function requestObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Body must be an object");
  return value;
}
export function createAppServer({ root = resolve("dist") } = {}) {
  root = resolve(root);
  return createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (pathname.startsWith("/api/")) {
        if (req.method === "GET" && pathname === "/api/v1/health")
          return json(res, 200, {
            status: "ok",
            apiVersion: 1,
            three: "0.180.0",
          });
        if (req.method === "GET" && pathname === "/api/v1/capabilities")
          return json(res, 200, {
            biome: {
              schema: "cranberry-forge.biome/1",
              surfaces: ["flat", "waves"],
              maxCount: 10000,
              maxAttempts: 100000,
              workBudget: 2000000,
            },
            flux: { schema: "cranberry-forge.flux/1", action: "validate" },
            satchel: {
              schema: "cranberry-forge.satchel/1",
              action: "craft",
              maxCells: 96,
              maxRecipeEntries: 8,
              maxCatalogItems: 256,
            },
            chatter: {
              schema: "cranberry-forge.chatter/1",
              actions: ["validate", "step"],
              maxNodes: 256,
              maxVariables: 64,
              maxChoicesPerNode: 12,
              maxEffects: 32,
              maxConditions: 16,
            },
            trailmark: {
              snapshotVersion: TRAILMARK_SNAPSHOT_VERSION,
              actions: ["inspect", "activate", "dispatch", "claim"],
              limits: TRAILMARK_LIMITS,
              defaultDedupeCapacity: 2048,
            },
            signal: {
              schema: "cranberry-forge.signal/1",
              actions: ["validate", "contains"],
            },
            loom: { action: "sample", maxSamples: 128 },
            wayfinder: { action: "path", maxCells: 16384 },
            spring: { action: "step" },
            parcel: { action: "open" },
            tempo: { action: "step" },
            documentation: "/api-reference.json",
          });
        if (req.method !== "POST")
          return json(res, 405, { error: "Method not allowed" });
        if (expansionPaths.includes(pathname))
          return json(res, 200, expansionRequest(pathname, await body(req)));
        if (pathname === "/api/v1/trailmark/step") {
          const data = requestObject(await body(req));
          for (const field of Object.keys(data))
            if (!["definitions", "snapshot", "action"].includes(field))
              throw new TypeError(`Unknown request field: ${field}`);
          let action;
          if (Object.hasOwn(data, "action")) {
            action = requestObject(data.action);
            const fields =
              action.type === "dispatch"
                ? ["type", "event"]
                : ["activate", "claim"].includes(action.type)
                  ? ["type", "questId"]
                  : null;
            if (!fields)
              throw new TypeError(
                "action.type must be activate, dispatch or claim",
              );
            for (const field of Object.keys(action))
              if (!fields.includes(field))
                throw new TypeError(`Unknown action field: ${field}`);
          }
          const journal = createJournal(
            data.definitions,
            Object.hasOwn(data, "snapshot")
              ? {
                  snapshot: data.snapshot,
                  dedupeCapacity: data.snapshot?.dedupeCapacity,
                }
              : {},
          );
          const result = !action
            ? null
            : action.type === "activate"
              ? journal.activate(action.questId)
              : action.type === "dispatch"
                ? journal.dispatch(action.event)
                : journal.claim(action.questId);
          return json(res, 200, {
            result,
            quests: journal.list(),
            snapshot: journal.snapshot(),
          });
        }
        if (pathname === "/api/v1/satchel/craft") {
          const data = requestObject(await body(req));
          const snapshot =
            typeof data.snapshot === "string"
              ? JSON.parse(data.snapshot)
              : data.snapshot;
          if (
            !snapshot ||
            snapshot.columns * snapshot.rows > 96 ||
            !Array.isArray(data.recipe?.ingredients) ||
            data.recipe.ingredients.length > 8 ||
            !Array.isArray(data.recipe?.outputs) ||
            data.recipe.outputs.length > 8
          )
            throw new RangeError(
              "HTTP crafting supports at most 96 cells and 8 ingredients/outputs",
            );
          const pack = Inventory.fromSnapshot(snapshot, {
            catalog: data.catalog,
          });
          const result = pack.craft(data.recipe);
          return json(res, 200, { result, snapshot: pack.toSnapshot() });
        }
        if (pathname === "/api/v1/chatter/validate") {
          const data = requestObject(await body(req));
          return json(res, 200, { story: validateStory(data.story) });
        }
        if (pathname === "/api/v1/chatter/step") {
          const data = requestObject(await body(req));
          if (data.choiceId !== undefined && data.advance !== undefined)
            throw new TypeError("Use choiceId or advance, not both");
          if (data.advance !== undefined && data.advance !== true)
            throw new TypeError("advance must be true when supplied");
          if (data.choiceId !== undefined && typeof data.choiceId !== "string")
            throw new TypeError("choiceId must be a string when supplied");
          const conversation = Object.hasOwn(data, "snapshot")
            ? Conversation.fromSnapshot(data.story, data.snapshot)
            : new Conversation(data.story);
          const result =
            data.choiceId !== undefined
              ? conversation.choose(data.choiceId)
              : data.advance
                ? conversation.advance()
                : { ok: true };
          return json(res, 200, {
            result,
            view: conversation.view,
            snapshot: conversation.toSnapshot(),
          });
        }
        if (pathname === "/api/v1/signal/validate") {
          const data = await body(req);
          if (data?.schema !== "cranberry-forge.signal/1")
            throw new TypeError("schema must be cranberry-forge.signal/1");
          return json(res, 200, {
            schema: "cranberry-forge.signal/1",
            options: normalizeSignalOptions(data.options),
          });
        }
        if (pathname === "/api/v1/signal/contains") {
          const data = await body(req),
            options = normalizeSignalOptions(data.options);
          if (!Array.isArray(data.points) || data.points.length > 10000)
            throw new RangeError(
              "points must contain up to 10000 local [x,z] pairs",
            );
          return json(res, 200, {
            inside: data.points.map((p) => {
              if (!Array.isArray(p) || p.length !== 2)
                throw new TypeError("point must be [x,z]");
              return containsLocalPoint(options, p[0], p[1]);
            }),
          });
        }
        if (pathname === "/api/v1/biome/scatter") {
          const data = await body(req);
          if (!data || typeof data !== "object")
            return json(res, 422, { error: "Body must be an object" });
          const options = normalizeOptions(data.options ?? {});
          if (options.count > 10000 || options.maxAttempts > 100000)
            return json(res, 422, {
              error: "HTTP limit: count ≤ 10000 and maxAttempts ≤ 100000",
            });
          const complexity = options.exclusions.reduce(
            (n, e) => n + (e.type === "circle" ? 1 : e.points.length - 1),
            1,
          );
          if (complexity * options.maxAttempts > 2000000)
            return json(res, 422, {
              error:
                "Constraint workload exceeds HTTP budget; reduce maxAttempts or path segments",
            });
          const surface = data.surface ?? { type: "flat", height: 0 };
          let sample;
          if (surface.type === "flat") {
            const height = surface.height ?? 0;
            if (!Number.isFinite(height) || Math.abs(height) > 1e6)
              throw new RangeError("height must be finite within ±1e6");
            sample = () => height;
          } else if (surface.type === "waves") {
            const amplitude = surface.amplitude ?? 2,
              frequency = surface.frequency ?? 0.1;
            if (
              !Number.isFinite(amplitude) ||
              Math.abs(amplitude) > 1000 ||
              !Number.isFinite(frequency) ||
              frequency < 0 ||
              frequency > 10
            )
              throw new RangeError("Invalid wave amplitude or frequency");
            sample = (x, z) =>
              amplitude * Math.sin(x * frequency) * Math.cos(z * frequency);
          } else
            throw new TypeError(
              "surface.type must be flat or waves; code callbacks are not accepted over HTTP",
            );
          return json(res, 200, scatter(options, sample));
        }
        if (pathname === "/api/v1/flux/validate") {
          const data = await body(req);
          if (data?.schema !== "cranberry-forge.flux/1")
            throw new TypeError("schema must be cranberry-forge.flux/1");
          return json(res, 200, {
            schema: "cranberry-forge.flux/1",
            options: normalizeTrailOptions(data.options),
          });
        }
        return json(res, 404, { error: "Unknown API endpoint" });
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        return res.end();
      }
      let relative;
      try {
        relative = decodeURIComponent(pathname);
      } catch {
        res.writeHead(400);
        return res.end("Invalid path");
      }
      const file = resolve(
        root,
        `.${relative.endsWith("/") ? `${relative}index.html` : relative}`,
      );
      if (!file.startsWith(root + sep)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }
      let info;
      try {
        info = await stat(file);
      } catch {
        res.writeHead(404);
        return res.end("Not found");
      }
      if (!info.isFile()) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.writeHead(200, {
        "content-type": mime[extname(file)] ?? "application/octet-stream",
        "content-length": info.size,
        "x-content-type-options": "nosniff",
        "cache-control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
    } catch (error) {
      if (!res.headersSent)
        json(res, error.status ?? 422, { error: error.message });
      else res.end();
    }
  });
}
