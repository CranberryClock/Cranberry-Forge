# Build a small restoration journal

This tutorial uses the public Trailmark API. The runtime owns objectives and receipts; your game owns input, presentation, inventory, and storage. The bundled harbor demonstrates that separation with Three.js, but the same commands work in a terminal, a canvas game, or a UI framework.

## 1. Define actions in the vocabulary of your game

```js
import { createJournal } from '@cranberry-forge/trailmark';

const quests = [
  {
    id: 'supplies',
    title: 'A place to begin',
    objectives: [
      { id: 'wood', title: 'Gather timber', type: 'gather', tags: ['wood'], target: 3 },
    ],
  },
  {
    id: 'bridge',
    title: 'Across the blue',
    prerequisites: ['supplies'],
    objectives: [
      { id: 'arches', title: 'Repair the arches', type: 'restore', tags: ['bridge'], target: 3 },
    ],
  },
];
const journal = createJournal(quests, { dedupeCapacity: 256 });
```

Use event `type` for the action family and tags to narrow its meaning. A required tag list `['wood', 'north']` matches only events containing both tags. Unrelated event tags do no harm. If objectives require ordered stages, split those stages into separate quests with prerequisites; objectives inside one quest count in parallel.

## 2. Accept a commission before counting its actions

```js
console.log(journal.activate('bridge').reason); // 'prerequisites'
journal.activate('supplies');

for (let i = 0; i < 3; i++) {
  journal.dispatch({ id: `wood-${i}`, type: 'gather', tags: ['wood'] });
}
console.log(journal.get('supplies').status); // 'completed'
console.log(journal.get('bridge').status);   // 'available'
journal.activate('bridge');
```

Early events are not buffered for later quests. IDs on unmatched accepted events still enter the retention window. Let the interface explain locked prerequisites and give available quests an explicit Accept button.

## 3. Route a real action through the journal

```js
function repairArch(actionId) {
  const result = journal.dispatch({
    id: actionId,
    type: 'restore',
    tags: ['bridge'],
  });
  if (result.duplicate) return;
  renderJournal(journal.list());
  reconcileWorld(journal.list());
  persistJournal();
  for (const receipt of result.completed) {
    showCompletionToast(receipt.questId);
  }
}
```

`renderJournal`, `reconcileWorld`, `persistJournal`, and `showCompletionToast` above are application-owned integration functions. Generate an action ID once when the gameplay action occurs, and reuse that ID for retries. A new browser action can use `crypto.randomUUID()`. Do not generate a new ID every time you retry the same action.

Treat visual updates as a projection of `journal.list()`. The harbor shows the first N bridge arches for a count N and lights the beacon when its quest has a receipt. Loading a save then produces the correct scene directly without replaying past animations or rewards.

## 4. Demonstrate the retention boundary

```js
repairArch('repair-001');
repairArch('repair-001'); // second dispatch reports duplicate
```

With capacity 256, protection lasts until 256 later accepted distinct IDs have pushed this ID out of FIFO retention. Duplicates do not refresh it. Resending an evicted ID is a new accepted event. The receipt still prevents an already completed quest from completing again in that forward history.

## 5. Claim a receipt and persist the complete state

```js
const claimed = journal.claim('bridge');
if (claimed) {
  // Acknowledge the receipt in this local UI.
  // A durable external reward needs its own idempotent transaction.
  console.log('Claimed', claimed.id);
}

function persistJournal() {
  localStorage.setItem('harbor-v1', JSON.stringify(journal.snapshot()));
}

const saved = localStorage.getItem('harbor-v1');
if (saved) {
  try {
    journal.restore(JSON.parse(saved));
    renderJournal(journal.list());
    reconcileWorld(journal.list());
  } catch (error) {
    console.error('Save rejected; current journal is unchanged', error);
  }
}
```

Use the same catalog and `dedupeCapacity` for restore. A catalog edit, including a title change, changes compatibility. Migrate explicitly when your game content changes. Keep old saves available to your application until that migration succeeds. Guard storage failures in production and offer an export when appropriate.

The demo's Export button downloads the complete JSON snapshot. Load imposes a 2 MB file limit, parses JSON, and calls the same public `restore()` method. Reset creates a fresh journal. This is deliberate: resets and restoring old saves can branch history, so claimed receipts are not a cross-save anti-replay mechanism.

## 6. Connect a Three.js scene without coupling the runtime

The showcase scene factory is separate application source (`dist/trailmark-scene.js`) and is not part of the npm runtime API:

```js
import * as THREE from 'three';
import { createTrailmarkScene } from './trailmark-scene.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 350);
const harbor = createTrailmarkScene({ scene, camera, bloom: {} });

harbor.setState({ quests: journal.list(), selected: 'bridge' });
harbor.update(1 / 60, 2);
// Pass scene/camera to the renderer of your choice.
// Later: harbor.dispose();
```

The factory creates geometry and lights but no renderer or animation loop. It accepts `{ completed: ['supplies', 'bridge', 'homes', 'beacon'], selected: 'beacon' }` for a static fully restored illustration. Pass `reducedMotion: true` to keep decorative waterwheel, boat, and light animation static. It returns `root`, `pickables`, `districts`, `setState`, `select`, `update`, and `dispose`. `pickables` meshes carry `userData.district` so a raycaster can select a journal entry. The factory takes ownership of its scene group's geometries/materials and removes that group on disposal. It configures the supplied camera, scene background/fog, and optional controls/bloom for this demo; use it in a dedicated scene.

The browser companion uses Three.js 0.180.0 and Cranberry Forge's rendering helper. Your installed Trailmark package remains independent of both. Run the repository locally and open `/catalog.html` to explore the broader collection.
