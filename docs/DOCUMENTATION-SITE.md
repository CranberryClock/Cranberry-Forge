# Documentation delivery

`npm run build` generates a static documentation library at `dist/docs/` from the package README, API and tutorial files, plus the optional HTTP companion contract. Markdown remains the editable source and ships in package archives; reader-facing showcase links open the generated pages.

Each tool has an overview, integration guide, API reference and worked tutorial. The game templates have an overview and integration guide. Section assignments in `scripts/build-docs.mjs` keep API contracts, ownership notes and integration examples together. The generator parses Markdown tokens so shell comments inside code fences remain code. Add an explicit section plan when adding a new tool; empty documentation pages fail the build.

The pages share Forge's product colors, identity marks and navigation. The portfolio importer replaces the outer site header and footer with CranberryClock's shared chrome. All pages, fonts and syntax assets are local static files; hosting requires no Node process. The HTTP companion page describes a separate, optional local Node server.

Code fences are highlighted during generation. Showcase examples and changing JSON reports use the same six-language palette and a bundled, local highlight.js runtime. `scripts/highlight-code.mjs` prepares that bundle and portable-template copies. Copy buttons preserve the original code; tests compare every rendered documentation fence to the source text.

Validation: `npm test`, `npm run typecheck`, `npm run test:site`, and `npm run test:template`. The documentation tests cover the complete navigation journey, local links and anchors, source-code preservation and reference-table accessibility. Syntax tests cover live replacements, inserted examples, text safety and repeatable preparation.
