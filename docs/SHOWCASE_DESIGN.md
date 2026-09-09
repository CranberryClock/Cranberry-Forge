# One Forge collection

The fifteen tools and two playable templates share a single product presentation:
the Cranberry Forge header, collection switcher, product introduction, working
demo, installation section, and footer. The portfolio uses this same structure
within the CranberryClock site. Product identities and accent colors distinguish
the systems without changing how visitors navigate or find the download.

## Product presentation

Each showcase has one `.forge-product-hero` with its tool name, purpose, short
pitch, version, license, demo link, package download, documentation, and a circular
illustrated identity. Its `.forge-use-product` section explains how the system
fits into a project and gives the next practical step. The identity belongs to
the product presentation; it is never an image badge over the rendered scene.

The shared site header and footer use the transparent cranberry hammer mark in
`dist/assets/branding/forge-mark.svg`. Demo-specific in-game controls remain
inside the demo. Afterglow's pause, help, and motion controls are gameplay UI;
they are separate from the collection's site navigation.

Every demo includes the collection switcher with all fifteen tools and both
games. It marks the active system with `aria-current`, supports keyboard focus,
closes on Escape or outside click, and gives narrow screens a scrollable menu.
Biome and Flux share a page selected by its hash; Satchel and Chatter share a
page selected by the `kit` query parameter. The shared shell updates the visible
name, purpose, theme, identity, document title, package links, and installation
command to match the active system.

## Color and layout

All products use dark, subdued surfaces with readable typography. Spring uses a
deep teal workshop palette with mint accents, retaining the Jellyworks scene
without the former white page background. Semantic colors inside the demos
still communicate valid states, errors, combat warnings, and gameplay feedback.
Accent text must maintain at least 4.5:1 contrast against its page background.

The `.forge-site-header`, `.forge-explorer`, and `.forge-site-footer` each appear
once. Installation details belong alongside the product and below its demo;
creator and GitHub links belong in the shared site navigation. Older navigation
clusters and marketing headers are replaced by this common layout.

## Installation and portable templates

Tools are distributed as downloadable `.tgz` archives. A tool's instructions use
`npm install ./cranberry-forge-NAME-VERSION.tgz`, with `three@0.180.0` appended
only when the package declares Three.js as a peer dependency. These are local
archive commands, not claims that the packages are published to npm. Each tool
links to its own README; additional API and tutorial documents remain in the
demo where available.

Portable game templates include the shell, identity assets, dependencies, and
game files. Extract an archive and serve the folder from a static server. No
Node.js server is required to play. Their collection links open the hosted
showcases at cranberryclock.com; a portfolio importer can rewrite these to its
local showcase base. The game viewport remains usable within the surrounding
product page, including its keyboard, pointer, and touch controls.

## Authoring and validation

`scripts/showcase-catalog.mjs` defines navigation and palettes;
`scripts/product-copy.mjs` defines the product copy and illustrated identities.
`scripts/showcase-shell.mjs` generates the common structure before packaging in
`npm run build`. Shared styling and behavior live in `dist/showcase-shell.css`
and `dist/showcase-shell.js`.

Keep demo bindings when changing wrappers. `open-docs` and `kit-guide` open the
existing guides; `completion`, `receipts`, and `deliveries` are live progress
counters. Afterglow's `help-button`, `motion-button`, and `pause-button` must
remain reachable. The shell must not create duplicate instances of these IDs.

After adding or updating a system, run `npm run build`, `npm test`,
`npm run typecheck`, `npm run test:site`, and `npm run test:template`. Review the
desktop and narrow layouts, product switching, documentation links, downloaded
archives, and actual demo interactions before importing into the portfolio.
