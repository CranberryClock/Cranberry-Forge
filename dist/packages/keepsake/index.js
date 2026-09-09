/** JSON save migration with isolated candidates and per-version validation. */
function cloneJSON(value, seen = new Set(), depth = 0) {
  if (depth > 100) throw new RangeError("JSON nesting exceeds 100 levels");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object" || seen.has(value))
    throw new TypeError("Save must be finite, acyclic JSON data");
  if (
    !Array.isArray(value) &&
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new TypeError("Save objects must be plain records");
  seen.add(value);
  const out = Array.isArray(value) ? [] : {};
  for (const key of Object.keys(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new TypeError(`Unsafe JSON key: ${key}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor))
      throw new TypeError("JSON accessors are not supported");
    out[key] = cloneJSON(descriptor.value, seen, depth + 1);
  }
  if (
    Array.isArray(value) &&
    (Object.keys(value).length !== value.length ||
      Object.keys(value).some((key, index) => key !== String(index)))
  )
    throw new TypeError("Sparse or decorated arrays are not JSON data");
  if (Object.getOwnPropertySymbols(value).length)
    throw new TypeError("JSON symbols are not supported");
  seen.delete(value);
  return out;
}
const version = (v) => Number.isSafeInteger(v) && v >= 0;
const message = (error) =>
  error instanceof Error ? error.message : String(error);

export function createSave(format, schemaVersion, payload) {
  if (typeof format !== "string" || !format.trim() || !version(schemaVersion))
    throw new TypeError(
      "Expected a format ID and nonnegative safe integer version",
    );
  return { format, version: schemaVersion, payload: cloneJSON(payload) };
}

/** Validators return true or an error string/false. Migrations are synchronous. */
export function migrateSave(
  input,
  { format, targetVersion, migrations = {}, validators = {} } = {},
) {
  const trace = [];
  const fail = (code, detail, atVersion = null) => ({
    ok: false,
    error: { code, message: detail, version: atVersion },
    trace,
  });
  if (typeof format !== "string" || !format.trim() || !version(targetVersion))
    return fail("INVALID_CONFIG", "A format ID and targetVersion are required");
  if (
    !migrations ||
    typeof migrations !== "object" ||
    !validators ||
    typeof validators !== "object"
  )
    return fail("INVALID_CONFIG", "migrations and validators must be records");
  let save;
  try {
    save = cloneJSON(typeof input === "string" ? JSON.parse(input) : input);
  } catch (e) {
    return fail("INVALID_JSON", message(e));
  }
  if (
    !save ||
    Array.isArray(save) ||
    typeof save !== "object" ||
    !version(save.version) ||
    !Object.hasOwn(save, "payload")
  )
    return fail("INVALID_ENVELOPE", "Expected { format, version, payload }");
  if (save.format !== format)
    return fail(
      "WRONG_FORMAT",
      "Save format does not match this game",
      save.version,
    );
  if (save.version > targetVersion)
    return fail(
      "FUTURE_VERSION",
      "Save was created by a newer schema",
      save.version,
    );
  if (targetVersion - save.version > 1000)
    return fail("INVALID_CONFIG", "At most 1000 migration steps are allowed");
  const fromVersion = save.version;
  // Preflight the entire chain before any transform is invoked.
  for (let v = save.version; v <= targetVersion; v++) {
    if (!Object.hasOwn(validators, v) || typeof validators[v] !== "function")
      return fail("MISSING_VALIDATOR", `Missing validator for version ${v}`, v);
    if (
      v < targetVersion &&
      (!Object.hasOwn(migrations, v) || typeof migrations[v] !== "function")
    )
      return fail("MISSING_MIGRATION", `Missing migration ${v} → ${v + 1}`, v);
  }
  for (let v = save.version; v <= targetVersion; v++) {
    try {
      const check = validators[v](cloneJSON(save.payload));
      if (check && typeof check.then === "function") {
        Promise.resolve(check).catch(() => {});
        return fail("VALIDATION_FAILED", "Validators must be synchronous", v);
      }
      if (check !== true)
        return fail(
          "VALIDATION_FAILED",
          typeof check === "string"
            ? check
            : `Version ${v} validation must return true`,
          v,
        );
    } catch (e) {
      return fail("VALIDATION_FAILED", message(e), v);
    }
    if (v === targetVersion) break;
    try {
      const candidate = migrations[v](cloneJSON(save.payload));
      if (candidate && typeof candidate.then === "function") {
        Promise.resolve(candidate).catch(() => {});
        throw new TypeError("Migrations must be synchronous");
      }
      save = createSave(format, v + 1, candidate);
      trace.push({ from: v, to: v + 1 });
    } catch (e) {
      return fail("MIGRATION_FAILED", message(e), v);
    }
  }
  return { ok: true, save, fromVersion, trace };
}

/** Bounded structural JSON diff for migration previews. JSON Pointer paths. */
export function diffSaves(before, after, { limit = 200 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
    throw new RangeError("limit must be 1–10000");
  const a = cloneJSON(before),
    b = cloneJSON(after),
    changes = [];
  let truncated = false;
  const escape = (key) => key.replace(/~/g, "~0").replace(/\//g, "~1");
  function walk(x, y, path, hasX = true, hasY = true) {
    if (hasX && hasY && Object.is(x, y)) return;
    if (
      hasX &&
      hasY &&
      x &&
      y &&
      typeof x === "object" &&
      typeof y === "object" &&
      Array.isArray(x) === Array.isArray(y)
    ) {
      for (const key of [
        ...new Set([...Object.keys(x), ...Object.keys(y)]),
      ].sort())
        walk(
          x[key],
          y[key],
          `${path}/${escape(key)}`,
          Object.hasOwn(x, key),
          Object.hasOwn(y, key),
        );
    } else if (changes.length < limit)
      changes.push({
        path,
        kind: !hasX ? "add" : !hasY ? "remove" : "replace",
        ...(hasX ? { before: x } : {}),
        ...(hasY ? { after: y } : {}),
      });
    else truncated = true;
  }
  walk(a, b, "");
  return { changes, truncated };
}
