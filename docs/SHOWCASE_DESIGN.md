# Showcase navigation and themes

Every demo includes an **All showcases** link and an **Explore every system**
switcher covering all 15 tools and both playable templates. The current system
is marked with `aria-current`; the picker supports keyboard navigation, Escape,
and outside-click dismissal. Mobile layouts use a scrollable two-column menu.

Each system has a coordinated accent, background, and panel palette. Spring
retains its light paper presentation. Semantic colors inside rendered scenes
(errors, valid states, combat warnings) retain their gameplay meaning.

The authored shell lives in `dist/showcase-shell.css` and
`dist/showcase-shell.js`. The catalog and static HTML generator live in
`scripts/showcase-catalog.mjs` and `scripts/showcase-shell.mjs`. `npm run build`
regenerates navigation before packaging. Biome/Flux and Satchel/Chatter share
pages; the shell follows the active mode without taking over demo controls.

Portable templates include their own shell assets. Collection links in extracted
templates open the hosted demos at cranberryclock.com; their games still run
from an ordinary static server without Node.js. A portfolio importer can rewrite
those collection links to its local showcase base.

When adding a system, update the catalog and its matching CSS palette, then run
the build, tests, static-site check, and portable-template check. Review the
desktop and narrow layouts and keep text contrast at least 4.5:1.
