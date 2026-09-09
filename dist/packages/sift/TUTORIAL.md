# Sift: add asset gates to your pipeline

1. Assign stable IDs to the assets your game loads.
2. Declare cross-asset references and required renderer extensions.
3. Collect metrics from your art pipeline.
4. Write budgets appropriate to your project.
5. Run Sift in a build script and inspect the report when it fails.

```json
{
  "manifest": [
    { "id": "hero", "path": "hero.glb", "dependencies": ["atlas"] },
    { "id": "atlas", "path": "atlas.png" }
  ],
  "metrics": {
    "hero": { "bytes": 40000, "triangles": 1800 },
    "atlas": { "bytes": 24000, "triangles": 0 }
  },
  "policy": {
    "budgets": { "bytes": 80000, "triangles": 5000 },
    "allowedExtensions": [],
    "missingMetrics": "error"
  }
}
```

A texture has zero triangles in this example because it is known not to contain geometry. Do not substitute zero when a geometry inspection failed; omit the metric so the missing measurement is reported.

Save the JSON as audit.json. With actual files under game-assets:

```sh
sift audit.json --root ./game-assets > asset-report.json
```

The process exit status is the build gate. CI can upload asset-report.json as an artifact. Do not append `|| true` if failures should stop the build. The adapter reads local file metadata; it does not modify your art.

For engine/editor integration:

```js
import { auditAssets } from "@cranberry-forge/sift";
const report = auditAssets({ manifest, metrics, policy });
for (const finding of report.findings) {
  console.log(finding.assetId, finding.code, finding.actual, finding.expected);
}
```

Run glTF Transform inspection and Khronos validation separately when you need structural asset validation. Copy/normalize measured values explicitly into the four supported Sift metrics. Record where your measurements came from. Inspector-specific adapters and aggregate loading-group budgets are future work.

The cargo showcase uses clearly labeled illustrative metrics. It executes auditAssets directly; its corrected-cargo button swaps the fixture, not your files. Import accepts a Sift audit-input JSON file, not GLB art. Local HTTP POST /api/v1/sift/audit takes the same JSON input; start the optional server with npm run dev.
