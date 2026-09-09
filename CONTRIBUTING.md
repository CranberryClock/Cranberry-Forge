# Contributing to Cranberry Forge

Help make practical Three.js game tooling easier to use. Start with a focused issue describing the problem, a minimal reproduction, or the workflow a new feature would improve.

## Design principles

- Preserve package independence: tools must not import another Forge tool.
- Prefer explicit clocks, deterministic inputs, validated state, and clear resource ownership.
- Keep rendering packages compatible with ordinary Three.js objects.
- Include TypeScript declarations, tests, and an integration example for public behavior.
- State limitations plainly; support performance claims with reproducible measurements.

## Development

```sh
npm ci
npm run check
npm run test:packages
npm run test:template
npm run test:site
npm run test:privacy
```

Use `npm run dev` to explore the catalog locally. `dist/` contains authored source; do not delete it as build output. The generated vendor directories and package archives are ignored by Git.

When a visual changes intentionally, run `npm run samples` and inspect the affected images. Gallery renders are not substitutes for browser/GPU testing.

## Pull requests

Explain the problem, API decision, verification performed, and known limits. Update the relevant package guide and changelog for user-visible changes. Keep unrelated refactors out of the patch and remove credentials, private links, logs, or personal data from examples and screenshots.

Communicate respectfully, critique ideas rather than people, and help keep discussions welcoming. Contributions are licensed under the repository's MIT License.
