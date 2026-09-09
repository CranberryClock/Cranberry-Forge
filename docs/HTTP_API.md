# Optional HTTP companion

The published showcase is static. It runs its tools entirely in your browser and does not require a backend. The endpoints below run in the repository's **optional Node server**; they are not available on the static hosted showcase URL.

```sh
npm ci
npm run build
npm run dev
```

Default: `http://127.0.0.1:4173`. Set `PORT` to choose a different port. `HOST=0.0.0.0` is an explicit opt-in to expose the local server. This companion is intended for local automation/development; add your own authentication, TLS, process isolation and request rate limiting before internet exposure. It accepts data, never executable height callbacks or remote URLs.

## Endpoints

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/v1/health` | API status, version, Three.js version |
| GET | `/api/v1/capabilities` | Supported schemas, surfaces and request limits |
| POST | `/api/v1/biome/scatter` | `cranberry-forge.biome/1` placement snapshot |
| POST | `/api/v1/flux/validate` | Normalized `cranberry-forge.flux/1` recipe |
| POST | `/api/v1/satchel/craft` | Craft result and updated `cranberry-forge.satchel/1` inventory snapshot |
| POST | `/api/v1/chatter/validate` | Validated, normalized dialogue story |
| POST | `/api/v1/chatter/step` | Action result, dialogue view and `cranberry-forge.chatter/1` conversation snapshot |
| POST | `/api/v1/trailmark/step` | Quest action result, quest views and version-1 journal snapshot |
| POST | `/api/v1/signal/validate` | Normalized `cranberry-forge.signal/1` recipe |
| POST | `/api/v1/signal/contains` | Boolean footprint results for local `[x,z]` points |
| POST | `/api/v1/loom/sample` | Normalized spline recipe and local arc-length frames |
| POST | `/api/v1/wayfinder/path` | Weighted grid route and edited grid snapshot |
| POST | `/api/v1/spring/step` | Analytically advanced scalar spring state |
| POST | `/api/v1/parcel/open` | Seeded loot receipts, snapshot and next-roll odds |
| POST | `/api/v1/tempo/step` | Clock events, optional ability-use result, state and snapshot |
| GET | `/api-reference.json` | OpenAPI 3.1 description |

Latch remains JavaScript-only: interaction resolution queries a live Three.js scene, so it has no HTTP endpoint.

## Generate a meadow

```sh
curl http://127.0.0.1:4173/api/v1/biome/scatter \
  -H 'Content-Type: application/json' \
  --data '{"options":{"seed":42,"count":500,"radius":25,"minDistance":1.2},"surface":{"type":"waves","amplitude":2,"frequency":0.12}}'
```

`options` uses the Biome JavaScript schema. HTTP adds limits: 10,000 requested instances, 100,000 attempts, 2 MB body and a constraint workload budget of 2,000,000 (`maxAttempts × (1 + circles + total path segments)`). Exceeding a generation limit returns 422. The surface defaults to `{type:"flat",height:0}`; the other preset is `{type:"waves",amplitude:2,frequency:0.1}`. Wave height is `amplitude * sin(x * frequency) * cos(z * frequency)`.

Read the returned `stats.placed` and `stats.saturated`. Geometrically impossible requests legitimately return fewer placements. Use `parseScatter(response)` in your game, then `createInstances` with local prototype meshes.

## Validate a trail preset

```sh
curl http://127.0.0.1:4173/api/v1/flux/validate \
  -H 'Content-Type: application/json' \
  --data '{"schema":"cranberry-forge.flux/1","options":{"width":0.5,"lifetime":2.5,"color":"#b2ffcd"}}'
```

Returns the fully normalized preset suitable for `Trail.fromRecipe()`. It does not generate motion paths or render an image.

## Craft and save an inventory

`POST /api/v1/satchel/craft` accepts an object with three required fields: `catalog`, `snapshot` and `recipe`. The snapshot may be an object or a JSON-encoded snapshot string. The catalog is separate from the snapshot and must be supplied on every request. The server restores the inventory, crafts the recipe **once**, and returns `{result, snapshot}`. The HTTP endpoint does not expose the JavaScript method's `times` argument.

| Field | Shape and limits |
| --- | --- |
| `catalog` | 1–256 item definitions. Each requires a unique `id`; optional `name` defaults to the ID, `width` and `height` to 1, `maxStack` to 1, and `weight` to 0. Names are 1–120 characters, dimensions are integers 1–32, stack capacity is an integer 1–1,000,000, and weight is finite in 0–1,000,000. |
| `snapshot` | `{schema:"cranberry-forge.satchel/1", columns, rows, maxWeight, nextId, items}`. Both grid dimensions are integers 1–32; HTTP additionally limits their product to **96 cells**. `maxWeight` is finite in 0–1,000,000,000. |
| `snapshot.items` | Stacks shaped as `{id, itemId, quantity, x, y, rotated}`. IDs are unique `s` followed by 1–15 digits, without a leading zero. Quantities must fit the item's stack capacity; coordinates are integers and footprints must be inside the grid without overlapping. `rotated` is a boolean. The complete inventory must fit its weight limit. |
| `snapshot.nextId` | Integer 1–1,000,000,000,000,000, greater than every existing stack ID's numeric suffix. Keep the returned value when saving. |
| `recipe` | `{ingredients:[{itemId,quantity}], outputs:[{itemId,quantity}]}`. HTTP permits **1–8 entries in each array**; quantities are integers 1–1,000,000. Every item must exist in the supplied catalog. |

Catalog IDs use `[a-z][a-z0-9_-]{0,63}`, excluding `constructor`, `prototype` and `__proto__`. Saved stack IDs are independent of catalog IDs. Snapshot parsing permits at most 1,024 stack entries, but a valid HTTP inventory can hold no more stacks than its 96-cell grid allows.

Crafting is atomic: insufficient ingredients (`missing-items`), excess output weight (`weight-limit`), lack of room (`no-space`), or exhausted stack IDs (`id-limit`) return **HTTP 200** with `result: {ok:false, reason}` and the unchanged inventory state. Success returns `result: {ok:true}` and the new snapshot. Invalid data, such as an unknown item, overlapping saved stacks, or an oversized HTTP grid, returns **422** with `{error}` instead.

With the server running, use a separate shell for this example. It creates a four-cell inventory holding four ore, then crafts a fuse from two ore. The examples use curl and Node; no jq is required.

```sh
cat > satchel-request.json <<'JSON'
{
  "catalog": [
    {"id":"ore","name":"Copper ore","maxStack":10,"weight":1},
    {"id":"fuse","name":"Beacon fuse","maxStack":5,"weight":1}
  ],
  "snapshot": {
    "schema":"cranberry-forge.satchel/1",
    "columns":2,"rows":2,"maxWeight":10,"nextId":2,
    "items":[{"id":"s1","itemId":"ore","quantity":4,"x":0,"y":0,"rotated":false}]
  },
  "recipe": {
    "ingredients":[{"itemId":"ore","quantity":2}],
    "outputs":[{"itemId":"fuse","quantity":1}]
  }
}
JSON

curl --fail -sS http://127.0.0.1:4173/api/v1/satchel/craft \
  -H 'Content-Type: application/json' \
  --data-binary @satchel-request.json -o satchel-response.json

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const response = read('satchel-response.json');
if (!response.result?.ok) throw new Error(JSON.stringify(response));
writeFileSync('satchel-save.json', JSON.stringify(response.snapshot, null, 2));
const request = read('satchel-request.json');
request.snapshot = read('satchel-save.json');
writeFileSync('satchel-next-request.json', JSON.stringify(request, null, 2));
console.log(response.result, response.snapshot.items);
JS

curl --fail -sS http://127.0.0.1:4173/api/v1/satchel/craft \
  -H 'Content-Type: application/json' \
  --data-binary @satchel-next-request.json -o satchel-next-response.json

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const response = JSON.parse(readFileSync('satchel-next-response.json', 'utf8'));
if (!response.result?.ok) throw new Error(JSON.stringify(response));
writeFileSync('satchel-save.json', JSON.stringify(response.snapshot, null, 2));
console.log(response.result, response.snapshot.items);
JS
```

The first response contains two ore and one fuse; the second contains two fuses and no ore. Both calls resubmit the catalog and recipe. For another operation, build its request from the latest saved snapshot. Reposting an old request repeats that operation from the old state; the server does not retain an inventory or overwrite your save files.

## Validate, play and resume a conversation

`POST /api/v1/chatter/validate` accepts `{story}` and returns `{story}` with defaults filled in and unsupported fields discarded. The story itself has `id`, `start`, optional `variables`, and a `nodes` object; `cranberry-forge.chatter/1` identifies a **conversation snapshot**, not the story input. Validation checks identifiers, variable types, interpolation references and node targets. It does not start a conversation or run effects.

| Story field | Shape and limits |
| --- | --- |
| `id`, `start`, node/choice IDs and variable names | `[a-z][a-z0-9_-]{0,63}`, excluding `constructor`, `prototype` and `__proto__`. `start` must name an existing node; choice IDs are unique within their node. |
| `variables` | At most 64 declared variables. Values are booleans, finite numbers within ±1,000,000,000, or strings of at most 1,000 characters. |
| `nodes` | 1–256 entries. Each node requires `text` of at most 8,000 characters; optional `speaker` is at most 120 characters. `{{variable}}` interpolation in node and choice text must refer to a declared variable. |
| Node navigation | At most 12 `choices`, each with `id`, `text` (at most 500 characters) and `target` (an existing node ID or `null` to end). A node without choices may use `next` with the same target shape; omitted `next` defaults to `null`. Choices and a non-null `next` cannot be combined. |
| Choice availability | Optional boolean `once` defaults to `false`. Optional `when` contains at most 16 `{op,variable,value}` conditions; all must pass. Operators are `eq`, `ne`, `gt`, `gte`, `lt`, `lte`; ordered comparisons require numbers. |
| Effects | Node `onEnter` and choice `effects` each allow at most 32 `{op,variable,value}` operations. `set` assigns a declared variable; `add` requires a numeric variable. Conditions and effects must use the variable's declared type. |

`POST /api/v1/chatter/step` requires `story` on every request and accepts the following optional fields:

| Field | Behavior |
| --- | --- |
| `snapshot` | An `cranberry-forge.chatter/1` snapshot object or JSON-encoded snapshot string. Omit it to start a new conversation at `story.start` and run that node's `onEnter` effects. A supplied snapshot restores progress without replaying entry effects. Explicit invalid values, including `null`, `false`, `0` and `""`, return 422. |
| `choiceId` | A string selecting one choice from the current node. The response can report `not-found`, `unavailable` or `ended`; a non-string value returns 422. |
| `advance` | Must be exactly `true` when supplied. Advance a node without choices to `next`; a null target ends the conversation. The response can report `choice-required` or `ended`. |

Supply at most one of `choiceId` and `advance`. Supplying both, or supplying `advance:false`, returns 422. Omitting both returns the initial/restored view with `result: {ok:true}` and performs no navigation. Each step returns `{result, view, snapshot}`. The view includes `nodeId`, `speaker`, interpolated `text`, `ended`, `canAdvance`, and choices shaped as `{id,text,enabled}`; unavailable choices remain visible with `enabled:false`. A terminal line remains available to display until advancing ends the conversation.

Valid but unsuccessful gameplay actions return **HTTP 200** with `result: {ok:false,reason}` and unchanged conversation state. Invalid stories/snapshots, mismatched story signatures, and effect or visit-limit violations return **422** with `{error}`. A snapshot records `schema`, `storyId`, `signature`, `nodeId`, `variables`, `usedChoices`, `visits` and `ended`. Preserve all of it and resubmit the same story: the signature must match the normalized story, including its content. Visits are limited to 1,000,000 per node, and snapshots allow at most 256 visit entries and 3,072 unique, valid one-time choice keys. The server stores neither stories nor conversations.

This example validates a story, starts it, buys a fuse, saves and restores the returned progress, then advances the receipt to end the conversation.

```sh
cat > chatter-validate-request.json <<'JSON'
{
  "story": {
    "id":"beacon-shop","start":"offer",
    "variables":{"coins":2,"has_fuse":false},
    "nodes":{
      "offer":{
        "speaker":"Engineer","text":"A fuse costs 2 coins. You have {{coins}}.",
        "choices":[{
          "id":"buy","text":"Buy the fuse","target":"receipt","once":true,
          "when":[{"op":"gte","variable":"coins","value":2}],
          "effects":[
            {"op":"add","variable":"coins","value":-2},
            {"op":"set","variable":"has_fuse","value":true}
          ]
        }]
      },
      "receipt":{"speaker":"Engineer","text":"The fuse is yours. Coins left: {{coins}}.","next":null}
    }
  }
}
JSON

curl --fail -sS http://127.0.0.1:4173/api/v1/chatter/validate \
  -H 'Content-Type: application/json' \
  --data-binary @chatter-validate-request.json -o chatter-validated.json

# The validation response is already a {story} request: no snapshot starts anew.
curl --fail -sS http://127.0.0.1:4173/api/v1/chatter/step \
  -H 'Content-Type: application/json' \
  --data-binary @chatter-validated.json -o chatter-start-response.json

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const { story } = read('chatter-validated.json');
const response = read('chatter-start-response.json');
if (!response.result?.ok) throw new Error(JSON.stringify(response));
writeFileSync('chatter-story.json', JSON.stringify(story, null, 2));
writeFileSync('chatter-save.json', JSON.stringify(response.snapshot, null, 2));
writeFileSync('chatter-choice-request.json', JSON.stringify({
  story, snapshot: read('chatter-save.json'), choiceId: 'buy'
}, null, 2));
console.log(response.view);
JS

curl --fail -sS http://127.0.0.1:4173/api/v1/chatter/step \
  -H 'Content-Type: application/json' \
  --data-binary @chatter-choice-request.json -o chatter-choice-response.json

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const response = read('chatter-choice-response.json');
if (!response.result?.ok) throw new Error(JSON.stringify(response));
writeFileSync('chatter-save.json', JSON.stringify(response.snapshot, null, 2));
writeFileSync('chatter-advance-request.json', JSON.stringify({
  story: read('chatter-story.json'), snapshot: read('chatter-save.json'), advance: true
}, null, 2));
console.log(response.view, response.snapshot.variables);
JS

curl --fail -sS http://127.0.0.1:4173/api/v1/chatter/step \
  -H 'Content-Type: application/json' \
  --data-binary @chatter-advance-request.json -o chatter-end-response.json

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const response = JSON.parse(readFileSync('chatter-end-response.json', 'utf8'));
if (!response.result?.ok) throw new Error(JSON.stringify(response));
writeFileSync('chatter-save.json', JSON.stringify(response.snapshot, null, 2));
console.log(response.view.ended, response.snapshot.variables);
JS
```

The final output is `true` with `{coins:0, has_fuse:true}`. Those are dialogue variables; Chatter does not add an item to a Satchel inventory. The host application coordinates the two systems and saves each returned snapshot. Curl's `--fail` handles HTTP errors, but clients must also inspect `result.ok` for gameplay failures returned with HTTP 200.

## Activate, complete and claim a quest

`POST /api/v1/trailmark/step` accepts `{definitions, snapshot?, action?}` and returns `{result, quests, snapshot}`. Every request supplies the quest definitions. Omit `snapshot` to create a fresh journal with a deduplication capacity of **2,048** accepted event IDs. To continue, supply the latest returned snapshot as a **JSON object**; JSON-encoded snapshot strings are not supported by this endpoint. A restored journal preserves the snapshot's `dedupeCapacity`, an integer from 1 to 10,000. There is no top-level capacity option.

The request, action, quest/objective definitions, event and all snapshot records reject unknown fields. Explicit invalid snapshots, including `null`, `false`, `0`, `""` and encoded JSON strings, return **422**; only omission starts a new journal. All POST requests share the 2 MiB body limit.

| `action` | Returned `result` |
| --- | --- |
| Omitted | `null`; inspect the fresh or restored journal without changing it. |
| `{type:"activate", questId}` | `{activated, reason, quest}`. Success has `activated:true` and `reason:null`; failed gates have `activated:false` and reason `prerequisites` or `already-started`. |
| `{type:"dispatch", event:{id,type,tags?,amount?}}` | `{accepted, duplicate, sequence, changes, completed}`. Each change is `{questId,objectiveId,before,after,target}`; `completed` contains newly issued completion receipts. A retained event ID returns `accepted:false`, `duplicate:true` and empty change/completion arrays. |
| `{type:"claim", questId}` | The receipt on the first claim of a completed quest; `null` if that quest is not completed or was already claimed. |

Trailmark returns these method results directly; it does not wrap them in `{ok:...}`. Failed activation gates, duplicate events and no-op claims are **HTTP 200** gameplay outcomes. Invalid definitions, events, actions or snapshots, an unknown quest ID, or an exhausted operation sequence return **422** with `{error}`. A successful claim acknowledges completion; it does not award currency or inventory.

| Definitions and event limits | Contract |
| --- | --- |
| `definitions` | 1–128 quests, each `{id,title?,description?,prerequisites?,objectives}`. Quest IDs must be unique. |
| `objectives` | 1–64 per quest and at most 1,024 across the journal; each `{id,title?,type,tags?,target}`. Objective IDs must be unique within their quest. |
| `prerequisites` | At most 32 unique existing quest IDs per quest, with no cycles; defaults to `[]`. |
| IDs, event types and tags | Nonblank strings of 1–96 characters. Matching is exact and case-sensitive. |
| Titles and descriptions | Quest/objective titles default to their ID and must be nonblank strings of at most 160 characters. Quest descriptions default to `""`; supplied descriptions allow `""` or a nonblank string of at most 1,000 characters. |
| Objective/event `tags` | At most 16 unique strings, default `[]`. An event must contain every tag required by an objective; extra event tags are allowed. |
| Objective `target` | Integer 1–1,000,000,000. |
| Event `amount` | Integer 1–1,000,000, default 1. |
| Operation `sequence` | Integer 0–9,007,199,254,740,991. Accepted events, successful activations and successful claims increment it. Failed gates, duplicates and no-op claims do not. Exhaustion throws before mutation. |

Activation is explicit. Only active objectives with the matching event type and all required tags receive progress. One event can advance multiple objectives in parallel; amounts are not consumed between objectives, and counters clamp at their targets. Events received before activation never count retroactively. Completing all objectives creates a receipt and makes dependent quests **available before claim**, but does not activate those dependents. `quests` is the current list in definition order, with statuses `locked`, `available`, `active`, `completed` or `claimed`, objective counts, missing prerequisites and any receipt. Changes and completions also follow definition/objective order.

Deduplication retains the most recent N **accepted event IDs in FIFO order**, including events that matched nothing or arrived before any quest was active. IDs are global within the journal, regardless of event type or payload. A duplicate changes neither progress nor sequence and does not refresh its retention position. After N later distinct accepted events, an ID is evicted and can be accepted again. Invalid event payloads are rejected before the duplicate check. Use the same ID for a retry and a new ID for a distinct gameplay action.

Keep the complete returned snapshot: `{version:1,catalogKey,dedupeCapacity,sequence,recentEvents,quests}`. It preserves counters, activation order, completion/claim receipts and retained event IDs. A receipt is `{id,questId,completedAt,eventId,claimedAt}`, with `claimedAt:null` until claimed. Restoration checks structural consistency and the exact normalized definitions; definition order, titles, descriptions and objective edits can make a save incompatible. Tag and prerequisite ordering are normalized. Restoration does not replay events or reissue completion/claim results. The server retains no journal: send the definitions and newest save on every request.

This example activates a timber commission, completes it with one event, then claims its receipt. A dependent beacon quest becomes available when the timber arrives. Run it beside the local server using curl and Node:

```sh
cat > trailmark-activate-request.json <<'JSON'
{
  "definitions":[
    {
      "id":"timber","title":"Supply the harbor",
      "objectives":[{"id":"wood","type":"gather","tags":["timber"],"target":3}]
    },
    {
      "id":"beacon","title":"Light the beacon","prerequisites":["timber"],
      "objectives":[{"id":"light","type":"restore","tags":["beacon"],"target":1}]
    }
  ],
  "action":{"type":"activate","questId":"timber"}
}
JSON

curl --fail -sS http://127.0.0.1:4173/api/v1/trailmark/step \
  -H 'Content-Type: application/json' \
  --data-binary @trailmark-activate-request.json -o trailmark-activate-response.json

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const { definitions } = read('trailmark-activate-request.json');
const response = read('trailmark-activate-response.json');
if (!response.result?.activated) throw new Error(JSON.stringify(response));
writeFileSync('trailmark-definitions.json', JSON.stringify(definitions, null, 2));
writeFileSync('trailmark-save.json', JSON.stringify(response.snapshot, null, 2));
writeFileSync('trailmark-dispatch-request.json', JSON.stringify({
  definitions, snapshot: read('trailmark-save.json'),
  action: { type: 'dispatch', event: { id: 'wood-001', type: 'gather', tags: ['timber'], amount: 3 } }
}, null, 2));
console.log(response.quests.map(quest => [quest.id, quest.status]));
JS

curl --fail -sS http://127.0.0.1:4173/api/v1/trailmark/step \
  -H 'Content-Type: application/json' \
  --data-binary @trailmark-dispatch-request.json -o trailmark-dispatch-response.json

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const response = read('trailmark-dispatch-response.json');
if (!response.result?.accepted) throw new Error(JSON.stringify(response));
writeFileSync('trailmark-save.json', JSON.stringify(response.snapshot, null, 2));
writeFileSync('trailmark-claim-request.json', JSON.stringify({
  definitions: read('trailmark-definitions.json'), snapshot: read('trailmark-save.json'),
  action: { type: 'claim', questId: 'timber' }
}, null, 2));
console.log(response.result.completed);
console.log(response.quests.map(quest => [quest.id, quest.status]));
JS

curl --fail -sS http://127.0.0.1:4173/api/v1/trailmark/step \
  -H 'Content-Type: application/json' \
  --data-binary @trailmark-claim-request.json -o trailmark-claim-response.json

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const response = JSON.parse(readFileSync('trailmark-claim-response.json', 'utf8'));
if (!response.result || response.result.claimedAt === null) throw new Error(JSON.stringify(response));
writeFileSync('trailmark-save.json', JSON.stringify(response.snapshot, null, 2));
console.log(response.result);
console.log(response.quests.map(quest => [quest.id, quest.status]));
JS
```

Activation is operation 1. The gathering event is operation 2 and returns receipt `timber@2`; the beacon is already `available` at that point. Claiming records `claimedAt:3`, leaving timber `claimed` and beacon `available`. A subsequent claim **using the latest saved snapshot** returns `result:null`. Replaying `wood-001` from that latest snapshot reports a duplicate. To inspect without acting, submit only `definitions` and that snapshot.

Reposting a stale request or restoring an older save creates another branch of history and can repeat a completion or claim. Receipts and the bounded dedupe window do not provide external exactly-once delivery, merge concurrent saves, authenticate events, or make receipt IDs globally unique. If a claim grants durable rewards, the host application owns the transaction and must namespace idempotency by player/save. Always persist the returned snapshot before building the next request.

## Validate and query a combat warning

```sh
curl http://127.0.0.1:4173/api/v1/signal/validate \
  -H 'Content-Type: application/json' \
  --data '{"schema":"cranberry-forge.signal/1","options":{"shape":"cone","radius":10,"angle":75,"color":"#a8a1ff"}}'

curl http://127.0.0.1:4173/api/v1/signal/contains \
  -H 'Content-Type: application/json' \
  --data '{"options":{"shape":"beam","width":2,"length":8},"points":[[0,-4],[2,-4],[0,1]]}'
```

The query returns `{"inside":[true,false,false]}` in input order. Coordinates are **local XZ**, not world positions; cones and beams extend along −Z. Maximum 10,000 points, each exactly two finite numbers. The query checks the complete footprint and includes boundaries. It does not consider altitude, transforms, terrain occlusion, charge progress or physics. Use `Telegraph.containsPoint(worldPosition)` in your game for transformed world-space checks.

Errors are JSON `{error: string}`. 400 = malformed JSON; 413 = body larger than 2 MiB (2,097,152 bytes); 415 = wrong content type; 422 = invalid schema/range/workload; 404 = unknown endpoint; 405 = unsupported method. The body limit applies to every POST endpoint. Satchel and Chatter gameplay failures use HTTP 200 with `{result:{ok:false,reason},...}` instead of an HTTP error. Trailmark uses HTTP 200 with its action-specific result for failed gates, duplicates and no-op claims. No permissive CORS header is emitted. Use the local server's same-origin frontend or a server-side HTTP client.


## Sample a spline track with Loom

```sh
curl http://127.0.0.1:4173/api/v1/loom/sample \
  -H 'Content-Type: application/json' \
  --data '{"options":{"points":[[-6,0,0],[0,2,-3],[6,0,0]],"width":1.5,"segments":32},"samples":[0,0.5,1]}'
```

Returns `{recipe,samples}`. Each sample includes `u`, arc distance, width, bank and local-space position/tangent/right/up/quaternion arrays. `u` is an arc-length fraction, not raw curve parameter. The HTTP wrapper accepts 1–128 sample fractions in [0,1]. A closed route wraps 1 to 0. Geometry is built and disposed for the request; no mesh, GLB or image is returned. The recipe imports into `Loom.fromRecipe()` in your own scene. Points, width/bank profiles and all bounds follow [Loom's API](../dist/packages/loom/README.md). No terrain projection or intersections are inferred.

## Ask Wayfinder for a route

```sh
curl http://127.0.0.1:4173/api/v1/wayfinder/path \
  -H 'Content-Type: application/json' \
  --data '{"grid":{"width":4,"height":3,"diagonal":"no-cut"},"cells":[{"x":1,"z":0,"blocked":true},{"x":2,"z":1,"cost":4}],"start":{"x":0,"z":0},"goal":{"x":3,"z":2}}'
```

Supply either `grid` options or an object `snapshot`, never both. `cells` is an optional array of atomic `{x,z,blocked?,cost?}` edits. `start` and `goal` are integer cells; `maxVisited` optionally bounds search work. Returns `{result,snapshot}`. Result status `found` includes cells, world points, weighted cost, visited count and grid revision. `outside-grid`, `blocked-start`, `blocked-goal`, `unreachable` and `budget-exceeded` are ordinary **200** responses with empty paths and null cost, not malformed requests. Grid dimensions are 1–128 each, costs 1–1000. Pass the returned snapshot with new endpoints to query the same map later. The server stores no grid and does not move an agent. [Wayfinder API](../dist/packages/wayfinder/API.md).

## Step a spring

```sh
curl http://127.0.0.1:4173/api/v1/spring/step \
  -H 'Content-Type: application/json' \
  --data '{"state":{"value":0,"velocity":0,"target":1},"dt":0.1,"options":{"frequency":2,"dampingRatio":0.65}}'
```

Returns `{state:{value,velocity,target}}`. Feed that state into the next request. Each input state field is required. `dt` is 0–60 seconds; frequency .01–100 Hz and damping ratio 0–10. Options default to 2 Hz and .65 damping. The analytic step assumes a fixed target and coefficients during that step; change the target or velocity between requests for tracking and impulses. Magnitudes are bounded to 1e12. The [JavaScript API](../dist/packages/spring/API.md) also exposes scalar and vector classes; render-loop use should call those directly.

## Open seeded loot parcels

```sh
curl http://127.0.0.1:4173/api/v1/parcel/open \
  -H 'Content-Type: application/json' \
  --data '{"table":{"id":"moon-cache","entries":[{"id":"copper","itemId":"copper","rarity":"common","weight":9,"min":1,"max":3},{"id":"star","itemId":"star","rarity":"rare","weight":1}],"pity":{"after":5,"rarities":["rare"]}},"seed":42,"count":5}'
```

Returns `{receipts,snapshot,odds}`. `odds` describes the **next** draw; each receipt records the probability for its own draw. One draw selects one weighted entry and an inclusive integer quantity. Integer weights may be zero; at least one must be positive. Hard pity guarantees a configured rarity on the Nth consecutive attempt, after N−1 misses; natural qualifying drops reset the counter. No soft probability escalation is applied.

HTTP `count` is 1–1000 (default 1); the direct package permits larger bounded batches. Omitted seed defaults to 1. To resume, supply the same table and returned object snapshot; its seed is preserved. If you additionally supply a seed, it must match. Failed validation does not advance a saved stream. Receipts are local results, not proof of inventory granting or network authority; the host applies items. [Parcel API](../dist/packages/parcel/API.md).

## Advance ability clocks

```sh
curl http://127.0.0.1:4173/api/v1/tempo/step \
  -H 'Content-Type: application/json' \
  --data '{"definitions":[{"id":"dash","charges":2,"recharge":3,"cooldown":0.2}],"options":{"globalCooldown":0.5},"dt":0,"use":"dash"}'
```

Returns `{events,result,state,snapshot}`. The server first advances the clock by `dt` seconds (default 0), then attempts `use` if supplied. `result` is null when inspecting; a blocked ability is an ordinary **200** response with `ok:false`, reason and retry time. `events` contains recharge/cooldown completion events from the tick; a successful `result.events` contains the use event. Missing charges recharge sequentially. A separate per-use cooldown runs concurrently, and an ability with `usesGlobalCooldown:false` neither triggers nor observes the global gate.

Start with `definitions` and optional `options`, or resume with the returned object `snapshot`. Snapshot input cannot be combined with definitions/options. There are at most 64 abilities and 16 charges each; `dt` is 0–86400 seconds. The host owns pause/time scale and persistence. The server uses no wall clock, keeps no game session and does not execute spell effects. [Tempo API](../dist/packages/tempo/README.md).

All five expansion routes reject unknown request fields. HTTP snapshots are objects, even where a direct JavaScript package also accepts encoded JSON text. Request/response examples in OpenAPI are generated by `node scripts/document-expansion-api.mjs` and checked against the actual local server.
