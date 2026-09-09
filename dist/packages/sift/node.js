import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { auditAssets } from "./index.js";

/** Local-only file inspection. Existing art metrics are retained; bytes are measured. */
export async function auditFiles(
  input,
  { root = ".", maxAssets = 10000 } = {},
) {
  auditAssets(input); // Validate the complete input before file I/O.
  if (
    !Number.isSafeInteger(maxAssets) ||
    maxAssets < 1 ||
    input.manifest.length > maxAssets
  )
    throw new RangeError("Asset count exceeds maxAssets");
  const base = await realpath(root),
    metrics = structuredClone(input.metrics ?? {}),
    files = [];
  for (const asset of input.manifest) {
    if (!asset.path) continue;
    if (isAbsolute(asset.path) || /^[a-z][a-z0-9+.-]*:/i.test(asset.path))
      throw new TypeError("Asset paths must be local and relative");
    const path = resolve(base, asset.path);
    const inside = (p) => {
      const r = relative(base, p);
      return r !== ".." && !r.startsWith(`..${sep}`) && !isAbsolute(r);
    };
    if (!inside(path)) throw new TypeError("Asset path escapes root");
    try {
      const actual = await realpath(path);
      if (!inside(actual)) throw new TypeError("Asset symlink escapes root");
      const info = await stat(actual);
      if (!info.isFile()) throw new TypeError("Asset is not a regular file");
      Object.defineProperty(metrics, asset.id, {
        value: {
          ...(Object.hasOwn(metrics, asset.id) ? metrics[asset.id] : {}),
          bytes: info.size,
        },
        configurable: true,
        enumerable: true,
        writable: true,
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (Object.hasOwn(metrics, asset.id)) delete metrics[asset.id].bytes;
      files.push({
        assetId: asset.id,
        code: "MISSING_FILE",
        field: "path",
        actual: asset.path,
        expected: "existing file",
        severity: "error",
      });
    }
  }
  const report = auditAssets({ ...input, metrics });
  report.findings.push(...files);
  report.findings.sort((a, b) => {
    const x = `${a.assetId}\0${a.code}\0${a.field}`,
      y = `${b.assetId}\0${b.code}\0${b.field}`;
    return x < y ? -1 : x > y ? 1 : 0;
  });
  report.summary.errors += files.length;
  report.ok = report.summary.errors === 0;
  return report;
}

export async function readAuditInput(
  path,
  { maxBytes = 2 * 1024 * 1024 } = {},
) {
  if ((await stat(path)).size > maxBytes)
    throw new RangeError("Audit input exceeds byte limit");
  const text = await readFile(path, "utf8");
  if (Buffer.byteLength(text) > maxBytes)
    throw new RangeError("Audit input exceeds byte limit");
  return JSON.parse(text);
}
