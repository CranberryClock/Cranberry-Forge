// Stateless local automation for the five independent workshop packages.
import { Loom } from "../dist/packages/loom/index.js";
import { Wayfinder } from "../dist/packages/wayfinder/index.js";
import { stepSpring } from "../dist/packages/spring/index.js";
import { createParcel } from "../dist/packages/parcel/index.js";
import { Tempo } from "../dist/packages/tempo/index.js";

export const expansionPaths = [
  "/api/v1/loom/sample",
  "/api/v1/wayfinder/path",
  "/api/v1/spring/step",
  "/api/v1/parcel/open",
  "/api/v1/tempo/step",
];
function record(value, fields, label = "Body") {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be an object`);
  for (const key of Object.keys(value))
    if (!fields.includes(key))
      throw new TypeError(`Unknown ${label} field: ${key}`);
  return value;
}
function exclusive(data, a, b) {
  if (Object.hasOwn(data, a) && Object.hasOwn(data, b))
    throw new TypeError(`Use ${a} or ${b}, not both`);
}
export function expansionRequest(path, data) {
  if (
    data &&
    Object.hasOwn(data, "snapshot") &&
    (!data.snapshot ||
      typeof data.snapshot !== "object" ||
      Array.isArray(data.snapshot))
  )
    throw new TypeError("HTTP snapshot must be an object");
  if (path === "/api/v1/loom/sample") {
    record(data, ["options", "samples"]);
    if (
      !Array.isArray(data.samples) ||
      data.samples.length < 1 ||
      data.samples.length > 128
    )
      throw new RangeError("samples must contain 1–128 normalized distances");
    for (const u of data.samples)
      if (!Number.isFinite(u) || u < 0 || u > 1)
        throw new RangeError("samples must be finite in [0,1]");
    record(
      data.options,
      [
        "points",
        "closed",
        "segments",
        "width",
        "bank",
        "up",
        "uvScale",
        "borderWidth",
        "borderHeight",
      ],
      "options",
    );
    const track = new Loom(data.options);
    try {
      return {
        recipe: track.toRecipe(),
        samples: data.samples.map((u) => {
          const sample = track.sample(u);
          return Object.fromEntries(
            Object.entries(sample).map(([key, value]) => [
              key,
              value?.toArray ? value.toArray() : value,
            ]),
          );
        }),
      };
    } finally {
      track.dispose();
    }
  }
  if (path === "/api/v1/wayfinder/path") {
    record(data, ["grid", "snapshot", "cells", "start", "goal", "maxVisited"]);
    exclusive(data, "grid", "snapshot");
    const grid = Object.hasOwn(data, "snapshot")
      ? Wayfinder.fromSnapshot(data.snapshot)
      : new Wayfinder(data.grid);
    if (Object.hasOwn(data, "cells")) grid.setCells(data.cells);
    const result = grid.findPath(
      data.start,
      data.goal,
      Object.hasOwn(data, "maxVisited") ? { maxVisited: data.maxVisited } : {},
    );
    return { result, snapshot: grid.snapshot() };
  }
  if (path === "/api/v1/spring/step") {
    record(data, ["state", "dt", "options"]);
    return { state: stepSpring(data.state, data.dt, data.options) };
  }
  if (path === "/api/v1/parcel/open") {
    record(data, ["table", "seed", "snapshot", "count"]);
    const options = {};
    if (Object.hasOwn(data, "seed")) options.seed = data.seed;
    if (Object.hasOwn(data, "snapshot")) options.snapshot = data.snapshot;
    if (
      Object.hasOwn(data, "count") &&
      (!Number.isInteger(data.count) || data.count < 1 || data.count > 1000)
    )
      throw new RangeError("HTTP count must be an integer in [1,1000]");
    const parcel = createParcel(data.table, options);
    return {
      ...parcel.open(Object.hasOwn(data, "count") ? data.count : 1),
      odds: parcel.odds(),
    };
  }
  if (path === "/api/v1/tempo/step") {
    record(data, ["definitions", "options", "snapshot", "dt", "use"]);
    exclusive(data, "definitions", "snapshot");
    exclusive(data, "options", "snapshot");
    const clock = Object.hasOwn(data, "snapshot")
      ? Tempo.fromSnapshot(data.snapshot)
      : new Tempo(data.definitions, data.options);
    const events = clock.tick(Object.hasOwn(data, "dt") ? data.dt : 0);
    const result = Object.hasOwn(data, "use") ? clock.tryUse(data.use) : null;
    return { events, result, state: clock.state, snapshot: clock.toSnapshot() };
  }
  throw new RangeError("Unknown expansion endpoint");
}
