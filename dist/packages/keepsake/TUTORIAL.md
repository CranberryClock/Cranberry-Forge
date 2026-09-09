# Keepsake integration tutorial

1. Choose a permanent format ID for your game.
2. Treat a schema version as a data contract. Write a validator before changing it.
3. Add one migration for each incompatible change.
4. Preview the result and apply it only after the complete chain passes.
5. Persist using your chosen storage, retaining the old save until persistence succeeds.

```js
import { createSave, migrateSave, diffSaves } from "@cranberry-forge/keepsake";

const config = {
  format: "my-game",
  targetVersion: 1,
  validators: {
    0: (p) => Number.isSafeInteger(p?.coins) && p.coins >= 0,
    1: (p) => Number.isSafeInteger(p?.wallet?.gold) && p.wallet.gold >= 0,
  },
  migrations: { 0: (p) => ({ wallet: { gold: p.coins } }) },
};
const original = createSave("my-game", 0, { coins: 25 });
const result = migrateSave(original, config);
if (result.ok) {
  console.log(diffSaves(original.payload, result.save.payload));
  // Build a candidate world/state before swapping the active one.
  // Persist result.save with your storage provider, handling write errors.
} else {
  console.error(result.error);
  // Keep original and the active game unchanged.
}
```

Importing a save should enforce a file-size limit before parsing; the demo uses 2 MiB. Keep imported data separate from executable migration code. Never eval a function or script from a save file.

A save can contain independently serialized inventory, quests and world data; your host assembles those records. Keep each system's own snapshot validation intact when applying its state. Keepsake does not reach into other packages.

Run the included example without a browser:

```sh
node dist/packages/keepsake/examples/demo.mjs
```

In /keepsake.html, select an old memory, preview the migration, inspect the JSON diff, then restore the candidate. Gold/island/schema counters show the active world; previews do not change them. Import and download operate locally.

The optional HTTP route POST /api/v1/keepsake/migrate accepts `{ profile: "observatory", save: ... }`. It uses the showcase's registered validators and migrations only. For your own game, import migrateSave or register your own trusted server-side profile. HTTP cannot accept JavaScript callbacks. Storage adapters are intentionally outside v1.
