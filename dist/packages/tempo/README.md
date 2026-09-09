# Tempo

**Small clocks for powerful little abilities.** Tempo tracks stored charges, sequential recharge, per-use cooldowns and an optional global cooldown. It has no dependencies, timers, renderer, DOM, callbacks or other Cranberry Forge packages. Use it for dash charges, spells, healing items or any finite ability reserve in a Three.js game.

The [Spellgarden showcase](../../tempo.html) drives three original procedural spells from successful `tryUse` results. Charge crystals in the world and the HUD read the same public state. Adjust time scale, pause, tune recharge, or save and restore the clocks.

## Install

Download `cranberry-forge-tempo-0.1.0.tgz` from Cranberry Forge, then:

```sh
npm install ./cranberry-forge-tempo-0.1.0.tgz
```

```js
import { Tempo } from "@cranberry-forge/tempo";

const tempo = new Tempo(
  [
    { id: "dash", charges: 3, recharge: 2, cooldown: 0.15 },
    { id: "heal", charges: 2, recharge: 6, usesGlobalCooldown: false },
  ],
  { globalCooldown: 0.4 },
);

const result = tempo.tryUse("dash");
if (result.ok) startDash();

// Your existing game loop owns the clock, in seconds.
const events = tempo.tick(dt);
const hud = tempo.inspect("dash");
```

The browser can also import `index.js` directly by relative URL; the package has no imports. TypeScript declarations ship with the archive. Modern runtimes must support private class fields, `structuredClone` and `Object.hasOwn`.

## The recharge policy

| Clock               | Starts                                    | Completes                                               | Relationship                                                                   |
| ------------------- | ----------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Sequential recharge | First charge spent from a full ability    | Restores one charge every `recharge` seconds until full | Spending another stored charge keeps the running recharge deadline             |
| Per-use cooldown    | Every successful use                      | After that ability's `cooldown` seconds                 | Runs concurrently with recharge; can block an ability even when charges remain |
| Global cooldown     | Successful use by a participating ability | After the scheduler's `globalCooldown` seconds          | Blocks other participating abilities while their individual clocks continue    |

For three charges with `recharge: 2`, spending all three at time zero restores charges at 2, 4 and 6 seconds. These are sequential deadlines; each charge does not get a separate parallel timer. A one-charge ability with no per-use cooldown behaves like an ordinary cooldown: its next use is available after recharge.

`usesGlobalCooldown: false` both bypasses the current global lock and avoids starting or extending it. A failed use changes nothing. When several locks apply, the reported reason prefers global cooldown, then per-use cooldown, then no charges. `retryAfter` is the maximum delay across every applicable lock, including the next recharge when empty.

## API

### `new Tempo(definitions, options?)`

Provide 1–64 unique ability definitions. Unknown fields, duplicate IDs, sparse arrays, explicit nulls and invalid values throw.

| Definition field     | Type / range                                                                                              | Default  |
| -------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| `id`                 | 1–48 characters; starts with a letter, then letters, digits, `_` or `-`; prototype-related names excluded | Required |
| `charges`            | Integer 1–16                                                                                              | 1        |
| `recharge`           | Finite seconds, 0.001–86400                                                                               | Required |
| `cooldown`           | Finite seconds, 0–86400                                                                                   | 0        |
| `usesGlobalCooldown` | Boolean                                                                                                   | true     |

`options.globalCooldown` is a finite duration in 0–86400 seconds, default 0. The definition order determines tie ordering between abilities. Definitions remain fixed for a Tempo instance; construct a new instance to apply another recipe.

### `tryUse(id)`

Known, available ability:

```js
{
  ok: true,
  id: 'dash',
  at: 0,
  state: { /* detached AbilityState after spending */ },
  events: [{ type: 'used', id: 'dash', at: 0, charges: 2 }]
}
```

Blocked ability:

```js
{
  ok: false,
  id: 'dash',
  reason: 'global-cooldown', // or 'cooldown' / 'no-charges'
  retryAfter: 0.4,
  state: { /* detached unchanged AbilityState */ },
  events: []
}
```

Unknown or invalid IDs throw rather than silently accepting a typo. The successful result means the charge was consumed; perform your gameplay effect afterward. Tempo does not validate movement, target range, resources or game rules for you. Check those prerequisites before calling `tryUse`.

An extremely small positive cooldown can become unrepresentable after a large simulation time. `tryUse` rejects that case before changing any charge or clock. Normal millisecond-scale durations remain representable throughout the supported time range.

### `tick(dt)`

Advance by finite seconds in `[0, 86400]`. Returns a detached array of events generated during this call. A zero tick does nothing. Events include their scheduled completion time, even if one large tick crosses several deadlines.

| Event            | Fields                | Meaning                                |
| ---------------- | --------------------- | -------------------------------------- |
| `recharged`      | `id`, `at`, `charges` | One charge returned                    |
| `cooldown-ready` | `id`, `at`            | An ability's per-use cooldown finished |
| `global-ready`   | `at`                  | The shared lock finished               |

Events sort by timestamp. Exact ties sort global-ready, cooldown-ready, then recharged; abilities tie in definition order. `cooldown-ready` does not itself guarantee the ability can be used: inspect its remaining charges and global lock. `tick` never emits or replays `used` events.

Recharge deadlines are absolute simulation times. Dividing an interval into smaller ticks preserves scheduled completions and ordering, within ordinary floating-point precision. Boundary checks tolerate 1 nanosecond; this is not a fixed-point networking clock or a bit-identical cross-platform simulation guarantee. At most 1024 recharge events can be pending across the maximum 64×16 charges. Simulation time is bounded to 1 billion seconds; invalid advancement throws before mutation.

### State and lifecycle

| API                            | Returns                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `.inspect(id)`                 | Detached ability view                                                                    |
| `.state`                       | `{time, globalRemaining, globalProgress, abilities}`                                     |
| `.definitions`                 | Detached normalized definitions with defaults filled                                     |
| `.time`                        | Current simulation seconds                                                               |
| `.globalCooldown`              | Configured global duration                                                               |
| `.reset()`                     | Refills every charge, clears every cooldown and resets time to zero; returns fresh state |
| `.toSnapshot()`                | Detached `cranberry-forge.tempo/1` snapshot                                                        |
| `.restore(snapshot)`           | Atomically restores matching configuration; returns restored state                       |
| `Tempo.fromSnapshot(snapshot)` | New validated scheduler using the saved recipe                                           |

An ability view contains `id`, `charges`, `maxCharges`, `rechargeRemaining`, `rechargeProgress`, `cooldownRemaining`, `globalRemaining`, `ready`, `reason` and `retryAfter`. Progress values run 0–1 and are 1 when their clock is inactive. An opted-out ability reports zero `globalRemaining`, even when `.state.globalRemaining` is positive. Every object, array and event returned by Tempo is detached; modifying it does not change the scheduler.

Tempo has no internal pause, time scale or wall clock. The host chooses the elapsed simulation time:

```js
tempo.tick(paused ? 0 : realDt * timeScale);
```

Pause must also prevent new `tryUse` calls if your game disallows casting while paused. The Spellgarden applies that host rule and freezes its spell visuals with the same delta. It pauses when hidden and preserves its renderer/listeners when browser back-forward caching retains the page.

### Snapshots

`restore` accepts a snapshot object or JSON string of at most 128 KiB. The snapshot contains the full normalized recipe, global duration, current simulation time, optional active global deadline and each ability's charges/recharge/cooldown deadlines. `null` deadlines mean inactive; active deadlines must lie after the saved clock and within the configured duration.

`restore` requires an exact normalized definition order and matching global cooldown. It validates the complete candidate, including dense arrays, required fields, valid charge counts and full/missing-charge clock consistency, before committing. An invalid restore leaves existing state unchanged. `fromSnapshot` can construct another valid recipe. Neither method replays previous casts or completion events.

Snapshots preserve clocks, not spell effects, character motion, random state or session analytics. Structural validation does not authenticate a save; a backend that cares about competitive outcomes should own its simulation.

## Why this small tool exists

Ability timers are an established category. Phaser provides scene clocks, timer callbacks, time scaling and pause controls in its engine. Unreal's Gameplay Ability System addresses a much larger ability architecture, including effects, costs and cooldowns. [Phaser time documentation](https://docs.phaser.io/phaser/concepts/time), [Epic's Gameplay Ability System tutorial](https://dev.epicgames.com/community/learning/tutorials/8Xn9/unreal-engine-epic-for-indies-your-first-60-minutes-with-gameplay-ability-system).

Tempo's narrow contribution is an explicit, independently installable charge policy for a Three.js host: sequential recharge, concurrent per-use/global locks, caller-owned time, returned events, and validated snapshots. This is an integration choice, not a claim that cooldown tools or charge systems did not previously exist. It deliberately excludes ability trees, resource costs, animation state machines, status effects, casting channels and networking.

## Tutorial and verification

Follow [TUTORIAL.md](./TUTORIAL.md) for Three.js integration, HUDs, pause/time scaling, save handling and the Spellgarden scene API. Ten targeted Node tests cover sequential timing, tick partition behavior, global bypass, independent clocks, lifecycle and detached data, active snapshot continuation, malformed/sparse snapshot atomicity, configuration rejection, stable event ordering, bounded catch-up and procedural scene construction. Browser visual QA was unavailable in the build environment; offline scene illustrations are labeled as such.

MIT licensed. No runtime or peer dependencies.
