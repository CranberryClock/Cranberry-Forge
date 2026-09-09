# Keepsake

Versioned JSON save migration with per-schema validation, isolated candidates, and structural diffs. Headless ES module; zero runtime dependencies.

## Install

```sh
npm pack ./dist/packages/keepsake
npm install /path/to/cranberry-forge-keepsake-0.1.0.tgz
```

Source/archive distribution; not published to npm. Node 22+ or a modern browser.

## API

`createSave(format, version, payload)` creates a detached `{ format, version, payload }` envelope. format is a nonempty game/format ID; version is a nonnegative safe integer.

`migrateSave(input, config)` accepts a JSON string or envelope. config has:

- format: expected game/format ID.
- targetVersion: desired schema version.
- migrations: record of synchronous functions keyed by source version. Function v transforms payload v into payload v+1.
- validators: synchronous functions for every visited schema version, including source and target. Return true, false, or an error string.

Success: `{ ok: true, save, fromVersion, trace: [{from,to}] }`.
Failure: `{ ok: false, error: {code,message,version}, trace }`; no candidate is returned. A failure trace records completed transforms, not a valid restorable state.

Codes: INVALID_CONFIG, INVALID_JSON, INVALID_ENVELOPE, WRONG_FORMAT, FUTURE_VERSION, MISSING_VALIDATOR, MISSING_MIGRATION, VALIDATION_FAILED, MIGRATION_FAILED.

The full chain is checked before any transform runs. Every validator receives a detached copy, and every migration receives isolated data. All intermediate schemas must validate. Same-version saves still validate. Maximum chain: 1000 transitions.

Only finite, acyclic JSON data is accepted. Dates, Maps, undefined values, accessors, sparse arrays, symbols and prototype-related keys are rejected. Nesting is capped at 100 levels. Migration callbacks are trusted code supplied by the host and must be synchronous and free of external side effects. These functions are not a sandbox.

`diffSaves(before, after, { limit = 200 })` returns `{ changes, truncated }`. Changes contain JSON Pointer paths, kind (add/remove/replace), and before/after when present. Limit: 1–10000. Arrays are compared by index, not item identity. This is a display diff, not an executable patch.

## Example

```js
import { createSave, migrateSave } from "@cranberry-forge/keepsake";
const old = createSave("my-game", 0, { coins: 12 });
const result = migrateSave(old, {
  format: "my-game",
  targetVersion: 1,
  migrations: { 0: (p) => ({ gold: p.coins }) },
  validators: {
    0: (p) => Number.isFinite(p?.coins),
    1: (p) => Number.isFinite(p?.gold),
  },
});
if (result.ok) console.log(result.save.payload); // { gold: 12 }
```

[Tutorial](TUTORIAL.md) · [Runnable example](examples/demo.mjs)

## Ownership

Keepsake produces a validated candidate. Your game owns applying it to live systems, writing storage, handling storage failures and retaining backups. It does not promise atomic rollback across arbitrary game systems. No cloud sync, automatic saving, encryption or anti-cheat. MIT licensed.
