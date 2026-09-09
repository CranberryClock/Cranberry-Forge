# Trailmark API · 0.1.0

All runtime exports come from `@cranberry-forge/trailmark`. ESM JavaScript and complete TypeScript declarations are included. The runtime supports Node.js 18+ and modern browsers with native ES modules. It never accesses the DOM, local storage, Three.js, or a network.

## Exports

| Export | Purpose |
| --- | --- |
| `createJournal(definitions, options?)` | Validate a catalog and construct an isolated journal. |
| `TrailmarkError` | Error subclass with a stable `code` field. |
| `VERSION` | Package version, `"0.1.0"`. |
| `SNAPSHOT_VERSION` | Persisted schema version, `1`. |
| `LIMITS` | Frozen public validation bounds. |

## Definitions

```ts
interface ObjectiveDefinition {
  id: string;              // unique inside its quest
  title?: string;          // defaults to id
  type: string;           // exact event type
  tags?: readonly string[]; // all required; defaults to []
  target: number;          // positive integer
}
interface QuestDefinition {
  id: string;              // unique in the catalog
  title?: string;          // defaults to id
  description?: string;   // defaults to ''
  prerequisites?: readonly string[]; // existing IDs, no cycles
  objectives: readonly ObjectiveDefinition[];
}
interface JournalOptions {
  dedupeCapacity?: number; // default 2048
  snapshot?: unknown;     // strict version-1 restore on construction
}
```

Every object accepts only its documented fields. IDs and tags are case sensitive and preserved, not trimmed or Unicode-normalized. Whitespace-only strings are invalid. Leading/trailing whitespace in a nonblank ID is significant. Objective tags and prerequisite IDs are sorted in the internal catalog, without changing the caller's objects. Quest and objective order is preserved.

## Lifecycle

`locked` → `available` → `active` → `completed` → `claimed`

`locked` and `available` are derived views of an unstarted (`idle`) persisted state. A root quest begins available. An unstarted dependent is locked until all prerequisite quests have a completion receipt. Claims are optional acknowledgements and never block dependent activation. An activated quest is never cancelled or restarted; create a new journal for a reset.

### `journal.activate(id): ActivationResult`

Begins counting future matching events after every prerequisite has completed. On success: `{ activated: true, reason: null, quest }`. A blocked gate returns `reason: 'prerequisites'`; any active/completed/claimed quest returns `reason: 'already-started'`. Both unsuccessful results have `activated: false` and do not mutate or increment sequence. Unknown IDs throw `UNKNOWN_QUEST`.

### `journal.dispatch(event): DispatchResult`

```ts
interface JournalEvent {
  id: string;
  type: string;
  tags?: readonly string[];
  amount?: number; // default 1
}
interface DispatchResult {
  accepted: boolean;
  duplicate: boolean;
  sequence: number;
  changes: {
    questId: string; objectiveId: string;
    before: number; after: number; target: number;
  }[];
  completed: CompletionReceipt[];
}
```

Validation precedes duplicate detection. An accepted event gets a new sequence even if it matches nothing; an ignored duplicate reports the current sequence. Matching requires identical type plus a superset of objective tags. The same event can update multiple objectives and quests. Amount is added independently to each; objectives do not consume it. Already-full counters do not produce a change. Counts never exceed targets. Every accepted event ID participates in FIFO retention.

Completing all objectives changes the quest status immediately and returns its receipt. No dependent quest activates automatically. Events cannot reach newly available dependents without a later explicit `activate()` call. Results follow definition order, independent of activation order.

### `journal.claim(id): CompletionReceipt | null`

Acknowledges a completed quest. The first successful call increments sequence, records `claimedAt`, and returns a detached receipt. Calls before completion or after a successful claim return `null`. Unknown IDs throw. This method does not grant inventory, currency, or any other external reward.

```ts
interface CompletionReceipt {
  id: string;               // `${questId}@${completedAt}`
  questId: string;
  completedAt: number;      // operation sequence of the completing event
  eventId: string;
  claimedAt: number | null; // operation sequence of claim
}
```

Multiple quests completed by one event share its operation sequence but have different receipt IDs. Sequence numbers are logical order, not timestamps. Receipt IDs are local to a saved history. Restoring an older snapshot or resetting starts another possible history branch; external reward systems need their own transactional idempotency.

### `journal.get(id): QuestView`

Returns `{ id, title, description, status, prerequisites, missingPrerequisites, activatedAt, objectives, receipt }`. Each objective contains its normalized definition fields plus `count` and `complete`. Missing prerequisites are those without a completion receipt. `activatedAt` is null for unstarted quests. All data is detached and mutable by the caller without changing the journal.

### `journal.list(): QuestView[]`

Returns every view in catalog order. This is the primary integration point for UI rendering, map markers, and deriving a world from saved progress. There are no subscriber callbacks; the application renders after successful commands or dispatches.

### `journal.snapshot(): JournalSnapshot`

Returns a detached, JSON-serializable record:

```ts
interface JournalSnapshot {
  version: 1;
  catalogKey: string; // exact JSON of normalized definitions
  dedupeCapacity: number;
  sequence: number;
  recentEvents: { id: string; sequence: number }[]; // oldest first
  quests: {
    id: string;
    status: 'idle' | 'active' | 'completed' | 'claimed';
    activatedAt: number | null;
    counters: { id: string; count: number }[];
    receipt: CompletionReceipt | null;
  }[];
}
```

The catalog string provides exact compatibility comparison, not a cryptographic signature. It duplicates some definition data intentionally. The snapshot contains no unbounded event history. Existing completed/claimed state remains present even when its originating event ID has left the dedupe window.

### `journal.restore(snapshot: unknown): QuestView[]`

Validates and replaces the entire current state atomically. On error, the old state is unchanged. On success, returns `list()`. The provided definition catalog and configured capacity must match the snapshot. Restore does not invoke `dispatch` or return past completions/claims.

Validation checks version and exact normalized catalog compatibility, bounds, exact quest/counter identities and order, idle/active/completed/claimed consistency, receipt IDs, activation/completion/claim ordering, prerequisites completed before activation, distinct activation/claim operation sequences, retained event order and uniqueness, and consistency between retained events and completion receipts. Reuse of an evicted ID is allowed, including when an old receipt references that ID. Structural validation does not reconstruct an authenticated event log, infer every historic operation, or prevent malicious counter fabrication.

## Errors

`TrailmarkError extends Error` has `name: 'TrailmarkError'` and a `code`:

| Code | Meaning |
| --- | --- |
| `INVALID_INPUT` | Malformed shapes, unknown fields, missing required values, out-of-range values, duplicate tags, or basic snapshot field errors. |
| `INVALID_DEFINITION` | Duplicate quest/objective IDs, unknown prerequisite, dependency cycle, or too many total objectives. |
| `UNKNOWN_QUEST` | A method references a quest outside the catalog. |
| `INCOMPATIBLE_SNAPSHOT` | Unsupported schema version, different catalog, or different dedupe capacity. |
| `INVALID_SNAPSHOT` | Logically inconsistent snapshot state or ordering. |
| `LIMIT_REACHED` | Incrementing sequence would exceed `Number.MAX_SAFE_INTEGER`. |

Catch the error type and `code` rather than parsing human-readable messages. Plain data objects are the supported input; objects with accessors/proxies or custom prototypes are outside the JSON data contract.

## Complexity and ownership

Dispatch scans active objectives and required tags. The bounded FIFO uses a `Map` with constant-time membership and oldest-key eviction. Snapshot copies retained state and the catalog. Restore validates the bounded catalog and cross-checks retained events; it is intended for load boundaries, not every animation frame. Definitions, inputs, and returned records do not become live mutable handles. The journal object itself is frozen; its commands own its private mutable state.
