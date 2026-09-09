# Ledger integration tutorial

1. Pack and install Ledger as described in the README.
2. Give your game a stable base-stat record. Do not mutate that base each time gear changes.
3. Assign stable modifier IDs and a source ID for each equipment instance.
4. Apply the returned values to your movement/combat components.
5. Remove the source when equipment leaves the slot.

```js
import { Ledger } from "@cranberry-forge/ledger";

const stats = new Ledger({
  base: { attack: 50, speed: 3, reach: 2 },
  bounds: { speed: { min: 0.1, max: 12 } },
  rounding: 2,
});
stats.setModifier({
  id: "boots-17:speed",
  source: "boots-17",
  stat: "speed",
  kind: "multiplier",
  value: 1.5,
});

// Inside an existing Three.js game's update:
function move(player, dt) {
  player.position.z += stats.result.values.speed * dt;
}
// If stats change rarely, cache stats.result after each equipment operation.

// Unequip exactly this item:
stats.removeSource("boots-17");
const snapshot = stats.snapshot();
const restored = new Ledger(snapshot);
console.log(restored.result.values.speed); // 3
```

For Satchel integration, translate a successful equip action into setModifier calls; keep the inventory package independent. A temporary buff uses its own source, and your game clock removes that source on expiry. Ledger owns no timers.

To tune balance without WebGL:

```sh
node dist/packages/ledger/examples/demo.mjs
```

The example compares three candidates. Record results in a test when a balance constraint matters, such as preventing movement speed from exceeding a cap.

Local HTTP: POST /api/v1/ledger/evaluate accepts the same config and returns the same result. Start the optional server with npm run dev. No HTTP server is needed when importing the package.

The showcase at /ledger.html visualizes speed as movement, reach as a ring, and attack as target response. Pause motion for a static view. The package allocates no GPU resources; the showcase disposes its Three.js resources on exit.
