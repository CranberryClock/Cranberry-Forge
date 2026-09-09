# Add a salvage cache to your game

Parcel is independent of Three.js and any inventory system. Keep loot selection separate from the animation and the act of granting items.

## 1. Define one flat table

```js
import { createParcel } from '@cranberry-forge/parcel';

const table = {
  id: 'observatory',
  entries: [
    { id: 'ore', itemId: 'copper_ore', label: 'Copper ore', rarity: 'common', weight: 90, min: 2, max: 5 },
    { id: 'lens', itemId: 'star_lens', label: 'Star lens', rarity: 'rare', weight: 10 },
  ],
  pity: { after: 6, rarities: ['rare'] },
};
let parcel = createParcel(table, { seed: 42 });
```

Normally the lens has a 10% selection chance. Five consecutive ore results make the next result a lens. A natural lens before then resets the miss counter. Rarity names have no hidden ranking.

## 2. Open once and present its receipt

```js
const { receipt, snapshot } = parcel.roll();
console.log(`${receipt.label} ×${receipt.quantity}`);
console.log(receipt.guaranteed, receipt.probability);
// Animate your chest and present this already-selected result.
// Your inventory adapter decides when/how to grant receipt.itemId × receipt.quantity.
```

Do not call `roll()` on every animation frame. A single gameplay action makes one call; the resulting receipt drives the reveal animation. Duplicate clicks are an input concern for the host. For durable grants, coordinate grant and save writes in your own transaction; the local receipt ID alone does not provide external exactly-once delivery.

## 3. Show honest probabilities and progress

```js
const next = parcel.odds();
for (const entry of next.entries) {
  console.log(entry.label, `${(entry.probability * 100).toFixed(2)}%`);
}
console.log(next.misses, next.remaining, next.guaranteed);
```

`remaining` counts the next opening as one. Show the actual current probability, not a fixed legendary percentage during a forced roll. If pity includes multiple rarities, their original weights are renormalized inside the qualifying pool.

## 4. Save and resume the exact stream

```js
const savedText = JSON.stringify({ table, snapshot: parcel.snapshot() });
// Write savedText to storage owned by your application.
const saved = JSON.parse(savedText);
parcel = createParcel(saved.table, { snapshot: saved.snapshot });
// The next roll is exactly where the saved stream left off.
```

The table is not embedded as a parsed object in the runtime snapshot; retain it alongside the save. Changing an entry's order, label, weight, quantity or rarity changes the normalized compatibility key. Table migrations are an explicit host decision. Restoring an earlier snapshot rewinds pity and randomness as well as the roll count.

## 5. Measure without disturbing live progress

```js
const experiment = createParcel(table, { snapshot: parcel.snapshot() });
const { receipts } = experiment.open(1000);
const counts = new Map();
for (const receipt of receipts) {
  counts.set(receipt.entryId, (counts.get(receipt.entryId) ?? 0) + 1);
}
console.log(counts);
```

This sample uses real rolls from a copy of current state. It does not advance the live parcel or guarantee counter. With pity, long-run observed percentages need not equal the base weights. Repeating this experiment from the same save repeats the results.

## 6. Keep the browser interface resilient

The included Starlight Salvage laboratory at `/parcel.html` on the local server uses the public package plus a separate Three.js scene. All controls are ordinary accessible buttons. Reduced-motion users receive an immediate reveal. If WebGL fails, opening, odds, editing and saves still work. The scene factory `createParcelScene(stage, options)` itself requires only a Three.js scene and camera; it can be used with an offline renderer. It is demonstration code, not part of this package's runtime exports.
