# Sift

Read-only asset manifest policies for game builds. Headless core, local-file adapter and a JSON CLI. No renderer, network service or runtime dependency.

## Install

```sh
npm pack ./dist/packages/sift
npm install /path/to/cranberry-forge-sift-0.1.0.tgz
```

Source/archive distribution; not published to npm. Node 22+ for CLI/local files. The core works in modern browsers.

## Core API

`auditAssets({ manifest, metrics = {}, policy = {} })` returns `{ ok, findings, summary }`. Invalid input throws TypeError.

- manifest: array of `{ id, path?, dependencies?, requiredExtensions? }`. References use asset IDs. Paths are used by the Node adapter only.
- metrics: record keyed by asset ID, containing nonnegative safe integers for bytes, triangles, textureWidth and/or textureHeight. These are inspector-provided facts, not measured by the core.
- policy.budgets: maximum values for the supported metrics. Exact equality passes.
- policy.allowedExtensions: allowed required glTF extensions. Omit to skip extension checks; [] permits none.
- policy.missingMetrics: error (default) or warning. Missing measurements always generate findings.

A finding has assetId, code, field, actual, expected and severity. Codes: DUPLICATE_ID, MISSING_REFERENCE, UNSUPPORTED_EXTENSION, MISSING_METRIC, BUDGET_EXCEEDED, ORPHAN_METRICS. Summary contains assets, errors and warnings. `ok` means no errors; warnings may remain. Findings are sorted by asset/code/field/actual, using code-unit ordering.

Declare dependency assets separately from metrics. A file-byte limit is per asset, not total project download size. Texture dimensions are supplied policy metrics; they do not measure VRAM. Triangle metrics are not draw-call measurements. Dependency cycles are allowed; this is not a loading scheduler.

## Local files

`import { auditFiles, readAuditInput } from '@cranberry-forge/sift/node'`

`auditFiles(input, { root = '.', maxAssets = 10000 })` measures bytes for declared paths and retains supplied geometry metrics. Relative local paths must resolve within root, including symlinks. Missing files add MISSING_FILE errors; other I/O/configuration problems throw. This is a build helper for trusted local workspaces, not a hardened file server for concurrently changing hostile filesystems.

`readAuditInput(path, {maxBytes = 2097152})` reads bounded JSON input.

## CLI

```sh
sift audit.json
sift audit.json --root ./game-assets
# From the source checkout:
node dist/packages/sift/cli.mjs dist/packages/sift/examples/audit.json
```

One JSON result is written to stdout. Exit 0: passes policy; 1: policy failure; 2: invalid input, configuration or I/O. Without --root, no asset files are inspected. With --root, real byte sizes override supplied bytes.

[Tutorial](TUTORIAL.md) · [Example audit input](examples/audit.json)

## Existing tools

Use [glTF Transform](https://gltf-transform.dev/cli) for inspection/optimization and [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) for glTF specification validity. Supply normalized metrics to Sift from your chosen inspector. Sift v1 does not parse/validate glTF binaries, auto-optimize assets, or ship an inspector-specific adapter. Its job is project policies and cross-asset references. MIT licensed.
