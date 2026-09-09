#!/usr/bin/env node
import { auditAssets } from "./index.js";
import { auditFiles, readAuditInput } from "./node.js";
const args = process.argv.slice(2);
if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
  console.log(
    "Usage: sift audit.json [--root asset-directory]\nJSON reports to stdout. Exit 0: pass; 1: policy failure; 2: invalid input / I/O.\nWithout --root, supplied metrics are used without touching asset files.",
  );
} else {
  try {
    if (
      ![1, 3].includes(args.length) ||
      (args.length === 3 && args[1] !== "--root")
    )
      throw new TypeError("Usage: sift audit.json [--root asset-directory]");
    const input = await readAuditInput(args[0]);
    const report =
      args.length === 3
        ? await auditFiles(input, { root: args[2] })
        : auditAssets(input);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.log(
      JSON.stringify(
        { ok: false, error: { code: "INVALID_INPUT", message: error.message } },
        null,
        2,
      ),
    );
    process.exitCode = 2;
  }
}
