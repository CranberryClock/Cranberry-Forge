# Afterglow

**Keep the last light alive.** A complete 54-second arena survival game in an original floating sun temple, made with native Three.js, Cranberry Forge Signal and Cranberry Forge Flux. Read a charged warning, move into safety, or dash through the moment of impact. Survive three rounds to win; spend all three light charges and try another sunrise.

The portable download includes the game, official Three.js 0.180.0, its required addons, the two independent Cranberry Forge packages, and a small local web server. It needs no build step, npm install, external artwork, API key, account, or network service at runtime. All art is original procedural Three.js geometry. Signal supplies real warning meshes and the matching footprint query; Flux supplies the actual dash ribbon.

## Run the download

Extract `afterglow-template-0.1.0.tgz`, open a terminal in the extracted folder, and run:

```sh
node server.mjs
```

Open the localhost address printed by the server. Node.js 22 or later is recommended. `npm start` runs the same server. Use `PORT=4180 node server.mjs` to change the port on a POSIX shell. You can also place the whole extracted folder on an ordinary static web host. Keep its relative paths intact. Use HTTP; directly opening `index.html` as a `file:` URL does not reliably support browser module loading.

The source repository assembles the portable runtime during its root `npm run build`. The authored template omits generated `vendor/`, `packages/`, and `lib/` copies. The build copies official Three.js, Signal, Flux and Cranberry Forge's shared `createStage` helper. Those copies and the authored portable server are included in the downloadable archive. No other Cranberry Forge package is required.

## Play

| Action                                         | Keyboard                   | Touch                     |
| ---------------------------------------------- | -------------------------- | ------------------------- |
| Move relative to the fixed camera              | WASD or arrow keys         | Direction pad             |
| Dash in the current or last movement direction | Space                      | Dash button               |
| Pause / resume                                 | P; Escape also opens pause | Pause button              |
| Read the rules                                 | How to play                | ? button on small screens |
| Reduce decorative motion                       | Calm visuals               | Calm visuals              |

- **Sunfall:** leave the circle before it fills.
- **Solar fan:** cross either side of the wedge.
- **Light lance:** sidestep the straight lane.
- **Corona:** move into the ring's empty center.
- **Twin sunfall:** later rounds can charge two circles together.

Only the instant a warning finishes can deal damage. The drawn fill communicates charge progress, while its full boundary communicates the entire danger area. Warm colors indicate danger; the thin mint floor ring marks the movement limit. There is no damage-over-time zone after the brief impact flash.

A dash lasts 0.22 seconds and provides protection for that interval. Its 1.25-second cooldown begins when the dash starts. A hit consumes one light charge and grants 0.75 seconds of protection against stacked impacts. The controller treats the keeper as a point on the XZ floor; the character's hat, staff and body do not enlarge its hitbox.

Each survived strike earns 100 points, including strikes blocked by dash or post-hit protection. Survival time earns 10 points per second. Winning adds 250 points for each remaining light charge. The optional personal best is stored only in this browser's local storage; denied storage never prevents play.

Opening help, switching tabs, or losing window focus pauses gameplay. Calm visuals follows the device preference initially and can be changed in the page. It stops decorative animation, player blinking and Flux ribbons, and reduces bloom. Essential warning progress remains visible. There is no camera shake, sound dependency or timed dialogue.

## How the template is divided

| File                                | Responsibility                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `game.js`                           | Renderer-free game state, encounter schedule, movement, dash, exact impact checks, lifecycle and score |
| `scene.js`                          | Original Three.js temple and keeper, Signal warning instances, Flux dash trail, visual cleanup         |
| `app.js`                            | DOM HUD, input, camera-relative movement mapping, dialogs, optional best score and lifecycle           |
| `game.css` / `index.html`           | Responsive presentation, touch controls, accessible labels, import map                                 |
| `lib/scene.js`                      | Shared native Three.js renderer, lighting pipeline, resize handling and frame loop                     |
| `packages/signal` / `packages/flux` | Independent MIT toolkits with their own API documentation and declarations                             |
| `server.mjs`                        | Small local static web server; not an application backend                                              |

There are no HTTP game endpoints. The public API is a direct JavaScript controller, suitable for an existing Three.js game loop, a unit test or a separate frontend. A backend would need its own authoritative simulation and protocol.

## Controller tutorial

```js
import { AfterglowGame, attackContains } from "./game.js";

const game = new AfterglowGame();
game.start();

// World coordinates: +X is right, +Z is forward on the XZ floor.
// The shipped app converts camera-relative keyboard/touch input to these axes.
const events = game.step(1 / 60, { x: 1, z: 0, dash: false });
const view = game.view;

for (const event of events) {
  if (event.type === "impact" && event.damaged) {
    console.log("Light remaining:", view.health);
  }
}

// Use this exact shared query when adding another gameplay reaction.
const warning = view.attacks[0];
if (warning) console.log(attackContains(warning, view.position));

game.pause(); // step() now leaves all gameplay state unchanged
game.resume();
game.restart(); // returns a fresh READY view; call start() to begin again
```

`game.view` is a detached structured clone. Editing it does not move the player or change the controller. This API does not accept arbitrary state restoration; it avoids silently trusting imported combat state. Restarting is explicit. The optional best score is the only persisted value.

### Public API

| API                             | Result                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `new AfterglowGame(options?)`   | New controller in `ready` phase; validates configuration                                     |
| `.options`                      | Frozen normalized configuration                                                              |
| `.phase`                        | `ready`, `playing`, `paused`, `won` or `lost`                                                |
| `.view`                         | Detached current state, including attacks, position, score and clocks                        |
| `.start()`                      | `true` only when transitioning from `ready` to `playing`                                     |
| `.pause()` / `.resume()`        | `true` only when performing the requested valid transition                                   |
| `.restart()`                    | Resets all attacks, timers, position, score and lifecycle; returns the ready view            |
| `.step(dt, input?)`             | Advances playing state and returns the events created during this call                       |
| `attackContains(attack, {x,z})` | Inclusive point-in-footprint check with the same Y rotation and XZ shape semantics as Signal |

`dt` must be finite in `[0, 0.25]` seconds. `input.x` and `input.z` default to zero and must be finite in `[-1,1]`. Diagonal input is normalized. `input.dash` defaults to false and must be a boolean. Send it as a one-frame press request. A sustained `true` intentionally requests another dash as soon as the cooldown ends; the shipped keyboard adapter ignores key-repeat and the touch adapter uses button activation.

The controller advances in at most 1/120-second movement slices and splits at warning starts, impacts, and dash ends. All movement occurs before checking an impact at the new time. Protection is exclusive at its end: a dash that has just reached zero no longer blocks that instant's impact. A call with `dt = 0`, a paused controller or a terminal phase performs no gameplay work. A frame hitch is capped by the supplied stage helper rather than fast-forwarding the game while a tab is hidden.

`view` includes `phase`, `time`, `duration`, `round`, `health`, `position`, normalized `facing`, `dashRemaining`, `cooldown`, `invulnerability`, `attacks`, `resolved`, `avoided`, `hits` and `score`. Positions use world XZ units; clocks use seconds. `attacks` contain `id`, `round`, `label`, world `x/z`, Y `rotation` in radians, `armedAt`, `impactAt`, `duration`, and Signal `options`.

### Returned events

| Type           | Extra fields                            | Meaning                                                                                                   |
| -------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `armed`        | `attack`                                | A warning locked its location and facing                                                                  |
| `dash`         | `position`                              | A valid dash request began                                                                                |
| `impact`       | `attack`, `inside`, `damaged`, `dashed` | One footprint resolved exactly once; `dashed` means the point was inside while dash protection was active |
| `round`        | `round`                                 | The next round began                                                                                      |
| `won` / `lost` | —                                       | A terminal transition occurred once                                                                       |

Events are returned as plain detached data. There are no callbacks inside the controller, so a HUD or scene cannot re-enter an unfinished damage update. Once terminal, subsequent steps return an empty array and preserve the final state.

## Put the scene in an existing Three.js stage

```js
import * as THREE from "three";
import { createAfterglowScene } from "./scene.js";
import { AfterglowGame } from "./game.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);
const world = createAfterglowScene({ scene, camera });
const game = new AfterglowGame();
game.start();

function update(dt, input) {
  const events = game.step(Math.min(dt, 0.25), input);
  world.setState(game.view, events);
  world.update(dt);
  // Your renderer.render(scene, camera) goes here.
}

// On teardown:
world.dispose();
```

`createAfterglowScene(stage, { reducedMotion = false }?)` creates no renderer, canvas or DOM. `stage.scene` and `stage.camera` are required; an optional `stage.bloom` is tuned if present. The factory changes the supplied scene's background and fog and positions the supplied camera. It returns `root`, `ground`, `player`, `telegraphs`, `trail`, `setState(view, events = [])`, `update(dt = 0)`, `setReducedMotion(boolean)` and idempotent `dispose()`.

Pass successive real controller views to `setState`; event arrays add impact flashes. The scene detects a backward game clock on restart and clears all previous Signal/Flux state. Its warning records expose the actual `signal` and a companion native geometry `fill`. That static fill and edge geometry improve legibility and allow honest offline illustrations; they are generated from the same options and do not replace the live Signal shader. The factory also works in a Node process for geometry checks or Three.js SVGRenderer illustrations. Such illustrations are not browser screenshots or proof of WebGL rendering.

## Customize an encounter

Start by changing a small controller option:

```js
const game = new AfterglowGame({
  rounds: 3,
  roundDuration: 24,
  health: 4,
  dashCooldown: 1.6,
});
```

| Option          | Default          | Accepted range |
| --------------- | ---------------- | -------------- |
| `rounds`        | 3                | Integer 1–5    |
| `roundDuration` | 18 seconds       | 12–60 seconds  |
| `health`        | 3                | Integer 1–10   |
| `arenaRadius`   | 8.8 units        | 7–12 units     |
| `moveSpeed`     | 4.8 units/second | 1–12           |
| `dashSpeed`     | 18 units/second  | 8–30           |
| `dashDuration`  | 0.22 seconds     | 0.1–0.5        |
| `dashCooldown`  | 1.25 seconds     | 0.5–5          |

The shipped HTML introduction, help text and three round indicators describe the default 3×18-second game. Update that copy and indicator count when tuning rounds, duration, health or dash timing. **The temple geometry and mint movement ring are authored for `arenaRadius: 8.8`; changing the controller radius does not resize the island or props.** Update the geometry in `scene.js` alongside any radius change. Other option combinations are validated numerically but are not guaranteed to preserve the default difficulty or solvability.

The encounter schedule is built in `restart()` using six warning times per round. `#arm()` chooses the circle, fan, lane or ring and snapshots the player's location/facing at warning start. Later rounds shorten the warning duration and add a twin circle. To create a new pattern, change that method, keep its Signal `options` and transform as the single source of truth, and keep its impact before the round's end. Add a test that drives the resulting encounter to completion.

Colors, column arrangement, halo, banners and character geometry live in `scene.js`. Flux's constructor near the keeper controls ribbon capacity, life, color and width. Signal's normalizer documents shape limits in `packages/signal/README.md`. A native Three.js `Telegraph` uses the same local -Z direction as `attackContains`; do not change one orientation convention without the other.

## Scope and verification

This is a complete small survival game and an editable integration example. It uses kinematic movement constrained to a circular floor; there is no physics engine, obstacle collision, jump, pathfinding, enemy AI, networking, audio system, authoritative score verification or general save/load layer. The decorative pillars sit outside the default movement boundary. Scores are local and can be edited by a device owner.

Seven targeted Node tests cover a full public-input win loop, a finite loss/restart loop, pause immutability, dash protection/recharge, every warning kind's footprint agreement against actual Signal transforms, malformed inputs, detached state, and renderer-free scene/reset/disposal. The repository's portable archive check also verifies local imports and HTTP assets after extraction. Browser visual QA was unavailable in the build environment; offline geometry illustrations are labeled accordingly. Try your target devices before shipping a customized game.

The code and procedural art are MIT licensed. Keep this template's license and the included third-party license files when redistributing.
