# Parcel

**A little chance. A dependable stream.** `@cranberry-forge/parcel` is an independent, zero-dependency loot-table runtime: seeded weighted selection, inclusive item quantities, explicit hard pity, current probabilities, and portable random state.

Version **0.1.0** · ESM + TypeScript declarations · MIT · No Three.js, renderer, storage, global randomness, or Cranberry Forge imports.

Run the repository locally and open `/parcel.html` for Starlight Salvage. [API](./API.md) · [Integration tutorial](./TUTORIAL.md)

## Install

Run `npm pack ./dist/packages/parcel` from the repository, then install the local archive in your game project:

```sh
npm install ./cranberry-forge-parcel-0.1.0.tgz
```

This is a downloadable installable package; these instructions do not assume publication to the public npm registry.

```js
import { createParcel } from '@cranberry-forge/parcel';

const table = {
  id: 'starlight',
  entries: [
    { id: 'dust', itemId: 'moon_silt', rarity: 'common', weight: 93, min: 3, max: 7 },
    { id: 'prism', itemId: 'aurora_prism', rarity: 'epic', weight: 6 },
    { id: 'heart', itemId: 'solar_heart', rarity: 'legendary', weight: 1 },
  ],
  pity: { after: 8, rarities: ['epic', 'legendary'] },
};
const parcel = createParcel(table, { seed: 42 });
const { receipt, snapshot } = parcel.roll();
console.log(receipt.itemId, receipt.quantity, receipt.probability);
const continued = createParcel(table, { snapshot });
console.log(continued.odds());
```

## The policy, exactly

Every roll selects **one entry**, with replacement, in proportion to its positive integer weight. It then selects a uniformly distributed integer quantity in that entry's inclusive `min..max` range. A zero weight disables the entry. Rarity names are labels, not an implicit ordering.

Pity is optional. With `{after:8, rarities:['epic','legendary']}`, the eighth roll after seven consecutive nonqualifying results is guaranteed to select from those exact rarity labels. Their original relative weights still apply: epic 6 and legendary 1 become **6/7 and 1/7**, not equal chances. Any natural or guaranteed qualifying result resets the miss counter. Earlier rolls retain their base probabilities. `after:1` restricts every roll to the qualifying pool. There is no soft escalation, duplicate protection, multiple reward slots, nested table, or retroactive adjustment.

`odds()` reports the probabilities of the **next** entry selection, not the chance of obtaining a given quantity or at least one item across a batch. Each receipt records the probability actually used on that roll and its base probability. Long-run observed frequencies with pity differ from the base weights.

## Deterministic and atomic

The same normalized table, seed, call sequence and version produce the same receipts. `open(n)` matches `n` consecutive `roll()` calls and commits the entire batch at once. Invalid inputs, corrupt saves and exhausted counters leave the existing state unchanged.

Parcel owns a local Mulberry32-style 32-bit stream. Integer selection uses rejection sampling to avoid modulo-reduction bias, with a bounded 128-word budget per selection. Each roll makes two selections, even when quantity is fixed. Saved state includes the seed, PRNG word counter, current state, roll count and pity misses; restoring does not roll or grant anything. This is a deterministic simulation generator, not cryptographic randomness.

Receipts are detached data for the host application. Their IDs are local `tableId:rollNumber` identities, not globally unique authenticated grants. Restoring an older save repeats that branch of history. The host owns item grants, durable transactions, save namespaces, multiplayer authority and any replay protection across saves.

## The laboratory

Starlight Salvage is a live Three.js treasure foundry: a hinged chest reveals a rarity-colored crystal over a floating astrolabe. Opening, current odds, guarantee progress and a 1,000-roll distribution experiment all use the public package. Resetting the seed replays the stream; the distribution experiment forks the current state and leaves live progress unchanged. Edit/import/export the table or save its complete stream. The page supports reduced motion, mobile controls and a working data interface when WebGL is unavailable. The Three.js scene is application code, not a runtime dependency.

## Existing alternatives

Weighted selection and loot systems are established categories. Parcel packages a narrow policy and inspectable save contract for small JavaScript games.

| Alternative | Documented focus | Useful when |
| --- | --- | --- |
| [Chance weighted](https://chancejs.com/miscellaneous/weighted.html) | Relative weighted selection, including fractional weights, in a broader random-data toolkit | You need general random data helpers and a weighted picker. |
| [Silvermine weighted-random-selection](https://github.com/silvermine/weighted-random-selection) | Weighted items with configurable repeat distance | You want weighted rotation with recent-repeat controls. |
| [Unity's Loot Boxes sample](https://docs.unity.com/en-us/services/solutions/loot-boxes) | Cloud Code chooses rewards and Economy grants currency | You need a Unity service-backed reward flow. |
| Parcel | Flat integer-weight tables, explicit hard pity, current odds and deterministic local saves | Your host already owns inventory and persistence and needs a small reward-selection component. |

These are differences in documented scope, not claims of feature exclusivity. Primary sources reviewed September 8, 2026. See [the API reference](./API.md) for bounds and guarantees.
