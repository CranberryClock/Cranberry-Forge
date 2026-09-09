# Build a three-spell loadout with Tempo

This tutorial plugs Tempo into a normal Three.js game loop. The package itself imports nothing and can also run without Three.js.

## 1. Define the clocks

```js
import { Tempo } from "@cranberry-forge/tempo";

const tempo = new Tempo(
  [
    { id: "blink", charges: 3, recharge: 3.5, cooldown: 0.25 },
    { id: "bloom", charges: 2, recharge: 5, cooldown: 0.6 },
    { id: "meteor", charges: 1, recharge: 8 },
  ],
  { globalCooldown: 0.45 },
);
```

Use `charges` for stored uses and `recharge` for the time to regain one. Add `cooldown` only when you want a minimum gap between uses even while charges remain. The global cooldown creates a brief common lock across the three spells.

If a healing item should work during that lock, give it `usesGlobalCooldown: false`. It then neither waits for nor triggers the global clock. Its own recharge and cooldown still apply.

## 2. Make success the only path to the effect

```js
let paused = false;

function requestSpell(id) {
  if (paused || !playerCanCast(id)) return;
  const result = tempo.tryUse(id);
  if (!result.ok) {
    showMessage(`Ready in ${result.retryAfter.toFixed(1)} seconds`);
    return;
  }
  createSpellEffect(id);
  recordEvents(result.events);
}

castButton.addEventListener("click", () => requestSpell("blink"));
window.addEventListener("keydown", (event) => {
  if (event.repeat || event.target.matches("input,textarea,select")) return;
  if (event.code === "Digit1") requestSpell("blink");
});
```

`playerCanCast`, `showMessage`, `createSpellEffect` and `recordEvents` are your application's functions. Check target validity, resources and other prerequisites before spending a charge. Tempo does not roll back a successful use if your later effect creation fails. Keep effect setup reliable or build a higher-level transaction for additional resources.

The Spellgarden listens to buttons and number keys 1–3. Repeating keyboard events do not automatically cast. It deliberately lets a blocked button attempt reach `tryUse`, so the status line can explain the actual remaining lock.

## 3. Advance with simulation time

```js
let previous = performance.now();
let timeScale = 1;

function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  const dt = paused || document.hidden ? 0 : realDt * timeScale;

  const events = tempo.tick(dt);
  recordEvents(events);
  updateSpellVisuals(dt);
  renderHud(tempo.state);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
```

The sample host caps a frame delta at 0.05 seconds to avoid jumping forward after a hitch. That policy makes slow frames slow the simulation. A deterministic fixed-step host can supply its fixed step instead. Tempo itself accepts a much larger tick and catches up all currently missing charges without extra callbacks.

Use the same delta for clocks and associated spell effects. A pause that freezes the HUD but continues calling `tick(realDt)` does not pause recharge. Conversely, a zero tick prevents recharge but does not stop the host from asking to use an available charge; guard the input too.

## 4. Render the HUD from public state

```js
function renderHud(state) {
  const blink = state.abilities.find((ability) => ability.id === "blink");
  count.textContent = `${blink.charges}/${blink.maxCharges}`;
  rechargeFill.style.width = `${blink.rechargeProgress * 100}%`;
  nextCharge.textContent =
    blink.charges === blink.maxCharges
      ? "Fully charged"
      : `Next charge in ${blink.rechargeRemaining.toFixed(1)}s`;
  castButton.setAttribute("aria-disabled", String(!blink.ready));
}
```

`aria-disabled` describes availability but does not disable event handling; use the native `disabled` property if you want the browser to suppress blocked attempts. Always check the current `tryUse` result when an input actually arrives. `rechargeProgress` describes the next missing charge, not overall readiness: an ability can have a stored charge and still be blocked by a global or per-use cooldown.

`retryAfter` combines all applicable blockers. It reports the next usable moment if the host makes no further uses, resets or restores. Another ability can restart the global cooldown after it expires, so this is a current-state estimate, not a reserved future cast.

## 5. Save and resume the clocks

```js
const text = JSON.stringify(tempo.toSnapshot());
localStorage.setItem("spell-clocks", text);

// Same recipe: atomic validation before mutating the current instance.
tempo.restore(localStorage.getItem("spell-clocks"));

// Or construct a new instance from the saved recipe.
const restored = Tempo.fromSnapshot(text);
```

Handle denied storage, missing values and invalid input in your UI. No real-world elapsed time is added while the game is closed. The snapshot resumes at its stored simulation time. If your product should grant offline recovery, your host must compute and explicitly apply that elapsed time with `tick`, within Tempo's bounds.

The Spellgarden's restore UI accepts only its three visual spell IDs and 3/2/1 charge capacities. It pauses after loading so you can inspect restored clocks. Scene effects and its session cast counter start fresh; past casts are not replayed. The package itself accepts other valid definitions through `fromSnapshot`.

## 6. Reuse the procedural Spellgarden

The showcase's `tempo-scene.js` is separate demo code; it is not included in the dependency-free npm package. Copy it from the repository if you want the original procedural stage:

```js
import * as THREE from "three";
import { createTempoScene } from "./tempo-scene.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1.5, 0.1, 200);
const world = createTempoScene({ scene, camera }, { reducedMotion: false });

const result = tempo.tryUse("meteor");
if (result.ok) world.cast("meteor");

function update(dt) {
  tempo.tick(dt);
  world.setState(tempo.state);
  world.update(dt);
}

world.dispose(); // when the stage is removed
```

The factory creates no renderer, DOM or assets. Its required stage has `scene` and `camera`; optional `bloom` is tuned when present. It sets the scene background/fog, positions the camera, and adds its own root group and lights. All materials and geometry are original native Three.js objects.

The result exposes `root`, `ground`, `actor`, `chargeCrystals`, `effects`, `cast(id)`, `setState(state)`, `update(dt)`, `reset()`, `setReducedMotion(boolean)` and idempotent `dispose()`. Supported visual IDs are `blink`, `bloom` and `meteor`. The scene does not independently authorize a cast; the caller must use Tempo's success result. At most 24 temporary effect groups are retained.

`reset` clears visual effects and returns the apprentice to its starting position. Pair it with `tempo.reset()` to also reset charge clocks. `setState` updates the pedestal crystals to match public charges. Calm visuals stops decorative movement and substitutes restrained, stationary spell cues; cooldown progress remains visible.

For an offline geometry illustration, construct the factory with ordinary Three.js Scene and Camera instances, perform real successful uses, call `world.cast`, and advance both clocks and visuals. Its native mesh geometry is compatible with Three.js SVGRenderer-based illustration workflows. These are offline illustrations, not WebGL browser screenshots.

## Scope

Tempo does not schedule arbitrary functions or contain combat, damage, mana, inventory, animation channels, status effects, network prediction or HTTP endpoints. It answers whether one known ability may spend a charge now and when its clocks will finish. Its direct JavaScript API is the integration surface. See the [complete API](./README.md) for numeric limits, event ordering, snapshot rules and researched alternatives.
