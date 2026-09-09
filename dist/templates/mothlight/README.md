# Mothlight — a small Three.js adventure template

Walk a floating camp at dusk. Meet Mira, gather copper, skyglass and moonleaf, assemble a lantern, and bring the beacon back to life. A complete beginning → objective → gathering → crafting → delivery → ending loop, designed as a short template rather than a content-heavy game.

## Play or run your own copy

In Cranberry Forge-bench, open `/templates/mothlight/` after `npm run build`. For an independent copy, download `mothlight-template-0.1.0.tgz` from the Game kits page, extract it into a new folder, then:

```sh
node server.mjs
# or: npm start
```

Open `http://127.0.0.1:4173`. Node 22+ is required only for the local file server. The archive includes official unmodified Three.js r180 and its license, fonts, images, both gameplay packages and every runtime file. **No dependency installation or build step is required.** It also runs on an ordinary static host. Keep the template's relative directory structure.

## Controls and game loop

- WASD / arrows move relative to the camera. Click or tap a destination to walk there.
- Click an interactable to walk toward it and interact, or press E nearby.
- I opens the inventory. A touch direction pad and visible interaction button support mobile devices.
- Talk to Mira and accept the request. Gather 3 copper, 2 skyglass and 1 moonleaf.
- Return to Mira, assemble the lantern, and deliver it at the beacon.
- Progress saves to this device when localStorage is available. Export/import saves from the menu. Starting again resets only this game's save.

## What to customize

| File | Responsibility |
| --- | --- |
| `content.js` | Item catalog, pickup IDs/locations, crafting recipe and quest conversation. |
| `game.js` | Renderer-independent progression, inventory operations, validated saves. |
| `app.js` | Input, Three.js raycasts, movement, proximity checks, UI, autosave and completion presentation. |
| `game.css` | Game HUD, inventory, dialogs and responsive layout. |
| `lib/camp-scene.js` | Original procedural camp, courier, items and beacon visuals. |
| `lib/scene.js` | Native Three.js renderer, orbit camera and postprocessing. |
| `lib/kit-ui.js` | Inventory presentation helpers. |
| `packages/satchel/` | Independent inventory/crafting module and tutorial. |
| `packages/chatter/` | Independent dialogue module and tutorial. |

The template explicitly uses **Satchel + Chatter**. Those packages do not require each other, nor Biome, Flux or Signal. Three.js remains the actual renderer.

### Add a new delivery

1. Add item definitions and a recipe to `content.js`. Keep visual metadata in `lib/camp-scene.js` in agreement with the catalog; the repository tests check the shipped definitions and pickup locations.
2. Add its pickup meshes and identifiers in `createCampScene`. A root object's `userData.interaction` identifies its behavior; descendants may be raycast hit targets.
3. Change the quest conversation and progression in `game.js`. Keep resource removal conditional on successful inventory operations.
4. Update the objective presentation in `app.js`. Version your save schema if you change the meaning of saved state.

### Connect real models

Replace `createCourier` or `createItemModel` with loaded GLB groups. Keep the root group's interaction metadata and position contract. Game units use Y up, movement in XZ, and a radius-9.3 walkable island. Models should fit the existing character/pickup scale or adjust proximity distances.

## Boundaries

Movement is kinematic with a circular island boundary. There is no navmesh, obstacle pathfinding, general collision system, combat, multiplayer or backend. Click travel follows a straight line, and decorative props are passable. These are explicit replacement points for your game's movement/physics system.

The local save is a convenience, not anti-cheat protection. Imported saves validate structure, quantities and layout; they are not authenticated proofs of play. Modal windows pause movement and the play timer. The visual target is WebGL2 / Three.js WebGLRenderer; browser/GPU QA status is stated in the repository README.

Original code, procedural models and game writing are MIT licensed. The archive includes licenses for Three.js and the self-hosted fonts. Mothlight is a template title, not a trademark-clearance claim.
