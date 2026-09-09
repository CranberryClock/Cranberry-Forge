# @cranberry-forge/satchel

A grid inventory for Three.js games: stacks, rectangular items, rotation, weight limits, transfers, crafting and validated saves. **Zero runtime dependencies.** It owns game state; your renderer owns meshes and your UI owns presentation.

Try `/play.html?kit=satchel` in the workbench. The demo source is `dist/kits/satchel.js`. The Mothlight adventure shows a complete pickup → craft → delivery loop.

## Install

This package is not published on npm. Download the tarball from the workbench, or run `npm pack ./dist/packages/satchel` from the repository:

```sh
npm install /path/to/cranberry-forge-satchel-0.1.0.tgz
```

ES modules, TypeScript declarations and MIT license are included. Use native Three.js in your game; Satchel requires no renderer, DOM, storage, framework or other Cranberry Forge package.

## Tutorial: collect something, then make something

```js
import { Inventory } from '@cranberry-forge/satchel';

const catalog = [
  { id: 'copper', name: 'Copper ore', maxStack: 8, weight: 0.6 },
  { id: 'glass', name: 'Skyglass', width: 1, height: 2, maxStack: 4, weight: 0.8 },
  { id: 'lantern', name: 'Lantern', width: 2, height: 2, weight: 2 }
];
const pack = new Inventory({ catalog, columns: 6, rows: 4, maxWeight: 16 });

// Call from a Three.js raycast or overlap handler. Confirm success before
// removing the world object; a full pack must never destroy the pickup.
const result = pack.add('copper', 3);
if (result.ok) copperPickup.removeFromParent();

pack.add('glass', 2);
const recipe = {
  ingredients: [{ itemId: 'copper', quantity: 3 }, { itemId: 'glass', quantity: 2 }],
  outputs: [{ itemId: 'lantern', quantity: 1 }]
};
const crafted = pack.craft(recipe);
if (!crafted.ok) showMessage(crafted.reason);
```

Every operation plans changes in a private draft. If an output cannot fit or a weight limit is exceeded, the entire action fails without consuming ingredients, changing stack IDs, or notifying subscribers. `transfer()` commits both inventories before notifying either one. These guarantees concern synchronous inventory state, not persistence, networking or callback side effects.

## Item definitions

| Field | Default | Contract |
| --- | --- | --- |
| `id` | required | Unique lowercase identifier: letters, digits, `_` and `-`; 1–64 characters, starts with a letter. Reserved prototype names are rejected. |
| `name` | ID | Display name, 1–120 characters. |
| `width`, `height` | 1 | Integers 1–32; rectangles may be rotated 90°. |
| `maxStack` | 1 | Integer 1–1,000,000. Every stack occupies the item's full rectangle. |
| `weight` | 0 | Nonnegative per-unit weight, up to 1,000,000; choose your own unit. |

Catalogs support 1–256 definitions. Extra visual metadata is ignored; keep rarity, icons, meshes and descriptions in your own content data. Every item of the same ID is fungible. Unique durability, rolls or equipment stats are outside this version; use distinct catalog IDs where practical.

## Inventory and actions

Construct with `{catalog, columns=6, rows=4, maxWeight=1e9}`. Grid dimensions are 1–32, and maximum weight is finite from 0–1e9. Getters `items`, `catalog`, `columns`, `rows`, `maxWeight`, `weight` and `revision` expose state. Arrays are copies, so mutating them does not modify the inventory. An item stack has `{id,itemId,quantity,x,y,rotated}`. Stack IDs are scoped to one inventory.

| Method | Behavior |
| --- | --- |
| `add(itemId, quantity=1)` | Fill compatible stacks, then search row by row for new stacks. Try unrotated, then rotated layouts. All units must fit. |
| `take(itemId, quantity=1)` | Consume units across stacks in insertion order. All units must exist. |
| `remove(stackId, quantity=wholeStack)` | Remove units from one stack. |
| `move(stackId,x,y,rotated=current)` | Set the top-left grid cell and optional orientation. Reject overlap and bounds violations. |
| `rotate(stackId)` | Rotate in place. Does not search for a different position. |
| `split(stackId,quantity)` | Move part of a stack into a new automatically placed stack. Leave at least one unit behind. |
| `merge(sourceId,targetId)` | Move as many compatible units as the target can accept. Return the transferred quantity. |
| `transfer(stackId,target,quantity=wholeStack)` | Add to the target and remove from the source atomically. Destination catalog definitions govern its dimensions and weight. |
| `canCraft(recipe,times=1)` | Plan a craft without changing state. |
| `craft(recipe,times=1)` | Consume every ingredient and place every output, or change nothing. |
| `count(itemId)` | Count units across all stacks. |
| `dimensions(stack)` | Return width/height in the stack's current orientation. |
| `subscribe(callback)` | Notify after commits with a detached snapshot; returns an unsubscribe function. |

Normal game-rule failures return `{ok:false,reason}`: `no-space`, `weight-limit`, `blocked`, `missing-items`, `not-found`, `invalid-split`, `same-stack`, `different-items`, `stack-full`, `same-inventory`, `id-limit`. Successful actions return `{ok:true}` with a `quantity` or new stack `id` when relevant. Invalid argument types, unknown catalog IDs and resource limits throw. Quantities are positive integers ≤1,000,000. Recipes have 1–64 ingredients and outputs, and batch size is 1–1,000; each multiplied quantity must stay within the quantity limit. Stack IDs stop at `s999999999999999`; an exhausted inventory can still merge into existing stacks, but allocating a new stack fails atomically with `id-limit`.

## Saves and UI integration

```js
const unsubscribe = pack.subscribe(snapshot => updateInventoryUI(snapshot));
const save = JSON.stringify(pack.toSnapshot());
const restored = Inventory.fromSnapshot(save, { catalog });
unsubscribe();
```

The `cranberry-forge.satchel/1` snapshot contains layout, limits, quantities and the next stack ID. The catalog is deliberately external. Restoring rejects unknown items, duplicate IDs, reused future IDs, invalid quantities, overlaps, bounds violations and excessive weight. Choose a migration when changing catalogs between game versions. Local save files are not anti-cheat proof or authentication.

The workbench's `kit-ui.js` demonstrates drag/drop plus select-and-place controls for touch and keyboard users. It is demo code, not a dependency of this package. A subscriber error is logged and does not roll back a committed action. Subscriber-triggered mutations are application code; avoid reentrant writes when rendering UI.

## Boundaries

This is bounded grid packing, not an optimal packing solver. Failure means the deterministic search could not fit the requested placement; manual rearrangement may create room. No physics, equipment slots, currency ledger, multiplayer authority, undo stack or persistent storage is included. Use server-owned state and your own transaction boundaries for online economies.
