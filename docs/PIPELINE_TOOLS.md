# Headless pipeline tools

The next three independent tools are implemented as ES modules with TypeScript declarations, examples, package archives and interactive Three.js showcases.

| Tool     | Core API                               | Local showcase | Tutorial                                       |
| -------- | -------------------------------------- | -------------- | ---------------------------------------------- |
| Ledger   | evaluateStats, Ledger, compareLoadouts | /ledger.html   | [Guide](../dist/packages/ledger/TUTORIAL.md)   |
| Keepsake | createSave, migrateSave, diffSaves     | /keepsake.html | [Guide](../dist/packages/keepsake/TUTORIAL.md) |
| Sift     | auditAssets; optional auditFiles + CLI | /sift.html     | [Guide](../dist/packages/sift/TUTORIAL.md)     |

Every core works without Three.js, a DOM or another Forge package. Three.js is used by the interactive demonstrations. There are no hosted service costs or account requirements.

## Local automation

Start the optional companion with `npm run dev`. POST JSON to:

- `/api/v1/ledger/evaluate`: stat configuration; returns values and explanations. HTTP limits: 256 base stats and 2048 modifiers.
- `/api/v1/keepsake/migrate`: `{ profile: "observatory", save }`; uses the trusted example migrations. Register your own callbacks in your own server, or import the core directly.
- `/api/v1/sift/audit`: manifest, supplied metrics and policy; returns findings. HTTP limit: 10000 assets. HTTP never reads local asset files.

Bodies are limited to 2 MiB. Invalid JSON returns 400; invalid arguments return 422; content-type and size errors return 415/413. Domain-level migration rejection and asset-policy failure return HTTP 200 with `ok: false`. See [OpenAPI](../dist/api-reference.json) for request/response examples. `node scripts/document-pipeline-api.mjs` regenerates these operations and their executable response examples.

## Current boundaries

Ledger provides arithmetic and source management, not combat or timed effects. Keepsake validates candidate saves, not storage transactions or rollback across arbitrary game systems. Sift checks project policies and local byte sizes; it does not replace glTF specification validation or optimize geometry. A dedicated glTF inspector adapter is deferred; normalize your inspector's output into Sift metrics.

## Showcase branding

The new scenes contain a native Three.js CranberryClock cameo with a cranberry body, an embedded 2:15 clock face and the natural pointed crown. No leaves or apple-like stem. Previous shared-renderer showcases and the portable templates receive a discreet signature using the creator's existing portfolio header image. See [asset provenance](../dist/assets/branding/README.md).

Gallery previews are offline renders of actual scene geometry. They do not claim browser rendering, bloom, shadows or GPU performance verification. The catalog and tutorials remain useful when evaluating the source without a published hosted update.
