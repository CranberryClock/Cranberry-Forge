# Trailmark

**Small objectives, dependable progress.** `@cranberry-forge/trailmark` is a framework-independent quest journal for JavaScript games and interactive worlds. Define a few commissions, activate them deliberately, and feed typed events into inspectable counters. The runtime has zero dependencies, no storage, no renderer, and no Cranberry Forge imports.

Version **0.1.0** · ESM · JavaScript + TypeScript declarations · MIT

## The harbor laboratory

Run the repository locally and open `/trailmark.html` to restore a tiny procedural archipelago: gather timber and stone, repair three open stone arches, rebuild a village's terracotta roofs, and light the lighthouse. Each action goes through the public package API. Inspect the event trace, replay the most recent event to demonstrate deduplication, claim receipts, and export or load a versioned save.

The standalone runtime does not depend on the demonstration or on Three.js. The scene is application code that derives its appearance from `journal.list()`.

## Install

Run `npm pack ./dist/packages/trailmark` from the repository, then install the local archive in your game project:

```sh
npm install ./cranberry-forge-trailmark-0.1.0.tgz
```

The archive is an installable npm package; this documentation does not assume that the package has been published to the public npm registry.

```js
import { createJournal } from '@cranberry-forge/trailmark';

const quests = [
  {
    id: 'bridge',
    title: 'Across the blue',
    objectives: [
      { id: 'timber', type: 'gather', tags: ['timber'], target: 3 },
      { id: 'arch', type: 'restore', tags: ['bridge'], target: 1 },
    ],
  },
  {
    id: 'beacon',
    prerequisites: ['bridge'],
    objectives: [{ id: 'light', type: 'restore', tags: ['beacon'], target: 1 }],
  },
];

const journal = createJournal(quests, { dedupeCapacity: 256 });
journal.activate('bridge');
journal.dispatch({ id: 'wood-001', type: 'gather', tags: ['timber'], amount: 3 });
const result = journal.dispatch({ id: 'arch-001', type: 'restore', tags: ['bridge'] });
console.log(result.completed[0]); // stable local completion receipt
console.log(journal.get('beacon').status); // 'available', still needs activation
const receipt = journal.claim('bridge'); // first call returns the claimed receipt
console.log(journal.claim('bridge')); // null: already claimed
```

## Contract

- Activation is explicit. A quest starts only when all of its prerequisites are completed or claimed. Earlier events are never counted retroactively. Completing a prerequisite makes its dependents available; it does not activate them.
- Every active objective with the exact event `type` and **all** of its required tags receives the event's positive integer `amount` (default `1`). Extra event tags are allowed. Objectives progress in parallel; amounts are not an inventory to consume. All counters clamp at their targets.
- Events are processed synchronously, in caller order. Changes and completions are returned in catalog/objective order. There are no timers, callbacks, random numbers, or background tasks.
- A completed quest returns a completion receipt in exactly one `dispatch().completed` result during one forward journal history. `claim()` records an acknowledgement once. Receipts remain bounded by the number of defined quests.
- Snapshots preserve counters, activation order, completion and claim receipts, and retained event IDs. Restoration does not dispatch events or replay completion/claim callbacks.

## Bounded duplicate protection

`dedupeCapacity` is **1–10,000**, default **2,048**. The journal retains the IDs of the most recent N **accepted events**, in FIFO order. This includes events that matched nothing, even before any quest was active. Duplicate attempts are rejected without advancing the sequence, changing progress, or refreshing an ID's position. Event IDs are global within this journal, not per event type; different payloads with a retained ID are also duplicates. Invalid payloads throw before the dedupe check.

After N later distinct accepted events, an old ID is evicted and can be accepted again. The retained window survives a snapshot round trip. Use stable IDs for retries and new IDs for distinct gameplay actions. An ID that was accepted too early cannot be reused to retroactively count that action while it remains retained.

**This is bounded in-process duplicate suppression, not network exactly-once delivery.** It does not authenticate events, coordinate clients, merge saves, or prevent rollback. Restoring an older save can make an already completed or claimed action happen again in a new branch of history. Receipt IDs such as `bridge@5` are stable within the saved journal history, not globally unique across players or resets. If claiming grants durable currency or inventory, use a transactional authority and a player/save namespace for idempotency. The application owns that transaction; Trailmark never grants rewards itself.

## Saves and validation

```js
const saved = JSON.stringify(journal.snapshot());
const restored = createJournal(quests, {
  dedupeCapacity: 256,
  snapshot: JSON.parse(saved),
});

// Or replace an existing journal atomically:
restored.restore(JSON.parse(saved));
```

Version 1 snapshots are strict plain JSON records. Unknown fields, invalid counters, state/receipt inconsistencies, impossible prerequisite ordering, duplicate/out-of-order retained IDs, and mismatched catalog or capacity are rejected. Validation completes before the live journal changes. Inputs and returned data are copied, so edits to a view or snapshot cannot mutate the journal.

The snapshot embeds an exact normalized catalog string. Definition order, title, description, type, target, and prerequisite/objective edits require an application-owned migration. Tag and prerequisite ordering are normalized. There is no implicit migration or partial restore. Validation establishes structural consistency; it does not prove that a client truly performed the claimed actions and is not a security boundary against cheating.

## Practical limits

| Item | Bound |
| --- | --- |
| Quests per journal | 1–128 |
| Objectives per quest / per journal | 1–64 / at most 1,024 |
| Prerequisites per quest | At most 32, acyclic, existing quest IDs |
| Tags per event or objective | At most 16 unique strings |
| ID, event type, or tag | 1–96 characters; nonblank; exact case-sensitive matching |
| Title / description | At most 160 / 1,000 characters |
| Objective target | Integer 1–1,000,000,000 |
| Event amount | Integer 1–1,000,000 |
| Retained IDs | 1–10,000 (default 2,048) |
| Operation sequence | JavaScript safe integer; exhaustion throws before mutation |

Accepted events, successful activations, and successful claims increment the shared operation sequence. Failed gates, duplicate events, and repeated claims do not. Each dispatch scans active objectives; maximum work is proportional to objectives × required tags. In-memory retention is proportional to the catalog plus retained IDs. Persistence, file-size limits, UI, event transport, and save retention are application responsibilities. The browser demo imposes a 2 MB upload limit and a 256-event retention window.

## Where it fits

Quest journals, narrative engines, and state machines are established categories. Trailmark's contribution is a compact objective-specific integration utility: explicit gated activation, integer objective aggregation, deterministic views, bounded event dedupe, and validated local receipts/saves in one small API.

| Tool | Documented focus | Choose it when |
| --- | --- | --- |
| [XState persistence](https://stately.ai/docs/persistence) | Persisting/restoring actor state; deep persistence and event-sourcing patterns | Your gameplay needs hierarchical or parallel state machines and actor orchestration. |
| [inkjs](https://github.com/y-lohse/inkjs) | JavaScript runtime and compiler for ink interactive narrative, including story continuation and choices | Your project needs authored branching narrative, ink scripts, and story execution. |
| Trailmark | Objective counters, prerequisite gates, completion receipts, and bounded local saves | You already have events and need a small inspectable quest journal beside your world or narrative engine. |

This comparison describes documented focus, not feature exclusivity or a performance benchmark. Primary sources reviewed on September 7, 2026. Trailmark can sit alongside either alternative; it does not implement their general state-machine or story-language capabilities.

## Documentation and verification

- [Full API reference](./API.md)
- [Harbor integration tutorial](./TUTORIAL.md)
- [MIT license](./LICENSE)

The source repository includes `tests/trailmark.test.mjs`. Its meaningful checks cover explicit activation, prerequisite gates, matching/clamping, deterministic fan-out, FIFO deduplication, one-time claims, save round trips, detached data, malformed inputs, atomic failed restore, reused evicted IDs, and sequence exhaustion. Run from the Cranberry Forge repository with `node --test tests/trailmark.test.mjs`.
