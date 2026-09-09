/** Read-only asset-manifest policy evaluation; metrics are supplied by inspectors. */
const METRICS = ["bytes", "triangles", "textureWidth", "textureHeight"];
const record = (v, name) => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new TypeError(`${name} must be a record`);
};
const string = (v, name) => {
  if (typeof v !== "string" || !v.trim())
    throw new TypeError(`${name} must be a nonempty string`);
};
const strings = (v, name) => {
  if (!Array.isArray(v)) throw new TypeError(`${name} must be an array`);
  for (const x of v) string(x, name);
};
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function auditAssets({ manifest, metrics = {}, policy = {} } = {}) {
  if (!Array.isArray(manifest))
    throw new TypeError("manifest must be an array");
  record(metrics, "metrics");
  record(policy, "policy");
  const budgets = policy.budgets ?? {};
  record(budgets, "budgets");
  for (const [key, value] of Object.entries(budgets)) {
    if (!METRICS.includes(key) || !Number.isSafeInteger(value) || value < 0)
      throw new TypeError(`Invalid budget: ${key}`);
  }
  if (policy.allowedExtensions !== undefined)
    strings(policy.allowedExtensions, "allowedExtensions");
  const missing = policy.missingMetrics ?? "error";
  if (!["error", "warning"].includes(missing))
    throw new TypeError("missingMetrics must be error or warning");
  const ids = new Set(),
    duplicates = new Set();
  for (const asset of manifest) {
    record(asset, "asset");
    string(asset.id, "asset.id");
    if (asset.path !== undefined) string(asset.path, "asset.path");
    if (asset.dependencies !== undefined)
      strings(asset.dependencies, "dependencies");
    if (asset.requiredExtensions !== undefined)
      strings(asset.requiredExtensions, "requiredExtensions");
    if (ids.has(asset.id)) duplicates.add(asset.id);
    ids.add(asset.id);
  }
  for (const [key, metric] of Object.entries(metrics)) {
    record(metric, `metrics.${key}`);
    for (const [name, value] of Object.entries(metric)) {
      if (!METRICS.includes(name) || !Number.isSafeInteger(value) || value < 0)
        throw new TypeError(`Invalid metric: ${key}.${name}`);
    }
  }
  const findings = [];
  const add = (assetId, code, field, actual, expected, severity = "error") =>
    findings.push({ assetId, code, field, actual, expected, severity });
  for (const id of duplicates) add(id, "DUPLICATE_ID", "id", id, "unique ID");
  for (const id of Object.keys(metrics))
    if (!ids.has(id))
      add(id, "ORPHAN_METRICS", "id", id, "declared asset", "warning");
  for (const asset of manifest) {
    for (const ref of new Set(asset.dependencies ?? []))
      if (!ids.has(ref))
        add(
          asset.id,
          "MISSING_REFERENCE",
          "dependencies",
          ref,
          "declared asset",
        );
    if (policy.allowedExtensions)
      for (const ext of new Set(asset.requiredExtensions ?? []))
        if (!policy.allowedExtensions.includes(ext))
          add(
            asset.id,
            "UNSUPPORTED_EXTENSION",
            "requiredExtensions",
            ext,
            policy.allowedExtensions.slice(),
          );
    const metric = Object.hasOwn(metrics, asset.id) ? metrics[asset.id] : {};
    for (const [field, max] of Object.entries(budgets)) {
      if (!Object.hasOwn(metric, field))
        add(asset.id, "MISSING_METRIC", field, null, max, missing);
      else if (metric[field] > max)
        add(asset.id, "BUDGET_EXCEEDED", field, metric[field], max);
    }
  }
  findings.sort(
    (a, b) =>
      compare(a.assetId, b.assetId) ||
      compare(a.code, b.code) ||
      compare(a.field, b.field) ||
      compare(JSON.stringify(a.actual), JSON.stringify(b.actual)),
  );
  const errors = findings.filter((f) => f.severity === "error").length;
  return {
    ok: errors === 0,
    findings,
    summary: {
      assets: manifest.length,
      errors,
      warnings: findings.length - errors,
    },
  };
}
