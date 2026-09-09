# Parcel API · 0.1.0

Import from `@cranberry-forge/parcel`. The package exports `createParcel`, `validateTable`, `ParcelError`, `VERSION`, `SNAPSHOT_VERSION`, and `LIMITS`.

## Table

```ts
interface LootTable {
  id: string;
  entries: {
    id: string; itemId: string; label?: string; rarity: string;
    weight: number; min?: number; max?: number;
  }[];
  pity?: { after: number; rarities: string[] } | null;
}
```

| Field | Contract |
| --- | --- |
| Table/entry/item/rarity ID | Lowercase `[a-z][a-z0-9_-]{0,63}`, excluding `constructor`, `prototype`, `__proto__`. Entry IDs are unique within the table; multiple entries may share an item ID or rarity. |
| `entries` | Dense array of 1–256 entries. No nested tables or extra fields. |
| `label` | Nonblank string, at most 120 characters; defaults to entry ID. |
| `weight` | Integer 0–1,000,000. At least one positive weight; zero disables an entry. Relative weights need not total 100. |
| `min`, `max` | Inclusive integer item quantities 1–1,000,000. `min` defaults to 1; `max` defaults to `min`; `max >= min`. One entry is selected per roll. |
| `pity` | Omit or use null to disable. `after` is an integer 1–10,000. `rarities` is a dense array of 1–256 unique rarity IDs, each with at least one positive-weight table entry. Order of this list is normalized. |

`validateTable(unknown)` returns a detached normalized `{id,entries,pity}`. Every entry has all fields filled. Unknown fields and sparse arrays reject. The normalized table is fixed for one Parcel instance; use a new instance for a different table. Saves bind the complete normalized table, including labels and entry order.

## Factory and methods

`createParcel(table, {seed?, snapshot?})` validates the table and options. `seed` is an unsigned 32-bit integer, default 1 for a fresh stream. A supplied snapshot is always validated, including explicitly supplied null, false or undefined. With only `snapshot`, its seed is restored. If a seed is also supplied, it must match the saved seed. Snapshots must be objects; parse JSON strings before passing them.

| Method | Returns / behavior |
| --- | --- |
| `roll()` | `{receipt, snapshot}` for one opening. |
| `open(count = 1)` | `{receipts, snapshot}`. Count is an integer 1–10,000. Entire batch commits or nothing commits. |
| `odds()` | `{guaranteed, misses, remaining, entries}`. Does not consume randomness. Entries include every normalized entry plus `probability` and `baseProbability`. |
| `snapshot()` | Detached versioned state. No effects or random draws. |
| `restore(snapshot)` | Validates a candidate fully, then atomically replaces current state and returns its detached snapshot. It may restore another seed with the same normalized table. |

`remaining` is the maximum number of additional rolls until a qualifying result, including the next roll. It is null without pity. `guaranteed` means the next roll uses the restricted pity pool. Before that threshold, probabilities remain the base weights. With no pity, misses stay zero. All methods are synchronous and have no callbacks.

## Receipt

```ts
{
  id: string;             // tableId:roll
  roll: number;           // 1-based
  entryId: string;
  itemId: string;
  label: string;
  rarity: string;
  quantity: number;
  guaranteed: boolean;    // restricted pool used, not merely a rare result
  probability: number;    // selected entry's probability on this roll
  baseProbability: number;
  missesBefore: number;
  missesAfter: number;
}
```

Probabilities concern entry selection. If several entries share an item ID, sum their probabilities for the item's total chance. For a particular quantity in a selected entry, divide that entry's probability by `max-min+1`. A whole batch uses each preceding roll's updated pity state.

## Snapshot and limits

```ts
{
  version: 1;
  tableKey: string;       // exact JSON of normalized table
  seed: number;
  rngState: number;
  draws: number;          // raw 32-bit PRNG words consumed
  rolls: number;
  misses: number;
}
```

All fields are required; unknown fields reject. `tableKey` is a compatibility key, not a cryptographic signature. Seed/state are integers 0–4,294,967,295. Raw draws are bounded at 4,294,967,295 and rolls at 1,000,000,000. The PRNG state must agree with the seed and draw count; draws must fit 2–256 per roll. Misses cannot exceed roll count or `after-1`, and are zero without pity or when every selectable entry qualifies. These are structural checks; they do not authenticate historical outcomes.

PRNG transition: increment state by `0x6d2b79f5` modulo 2³², apply the Mulberry32 integer mixer, then draw an integer with rejection of words above the largest multiple of the target range below 2³². Every weighted and quantity selection consumes at least one word; rejection can consume more. At most 128 words per selection. Total work per batch is bounded by count × (entry scan + rejection budgets); no recursion or unbounded retained history.

## Errors

Errors are `ParcelError` with a `code` and readable `message`:

- `INVALID_INPUT`: bad type, range, identifier, unknown property or sparse array.
- `INVALID_TABLE`: duplicate entries, no positive weight, or impossible pity pool.
- `INCOMPATIBLE_SNAPSHOT`: version/table mismatch, or explicit factory seed mismatch.
- `INVALID_SNAPSHOT`: internally inconsistent random/roll/pity counters.
- `LIMIT_REACHED`: exhausted roll/draw/rejection budget.

Failed `open` and `restore` preserve the full prior state. Successful returns and definitions are detached. The host must grant items and persist the returned snapshot in its own transaction when durable rewards matter. Replaying old saves intentionally reproduces old receipts.
