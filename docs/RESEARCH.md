# Opportunity research · updated 8 September 2026

This is an implementation-led opportunity scan, not a market-size study or proof that no competitor exists. No customer interviews were conducted. Product priorities below are engineering judgments informed by public primary sources.

| Area | Existing work / evidence | Decision |
| --- | --- | --- |
| Procedural trees | [EZ-Tree](https://github.com/dgreenheck/ez-tree) offers a library, browser authoring and exports. | Do not build a competing tree generator. Use original simple showcase models; accept user GLB prototypes. |
| Broad particle systems | [Quarks](https://github.com/Alchemist0823/three.quarks) provides a substantial VFX library and editor ecosystem. [Nebula](https://github.com/creativelifeform/three-nebula) also covers particle engines. | Do not build a general particle engine. A narrow motion-trail utility remains useful as an integration choice, not an invented category. |
| Surface distribution | Three.js [MeshSurfaceSampler](https://threejs.org/docs/pages/MeshSurfaceSampler.html) supplies weighted area sampling, including a custom RNG. | Use when area sampling is needed; our first tool deliberately targets XZ heightfields, spacing, road exclusions, inspectable rejections and reusable snapshots. |
| Terrain / vegetation | [THREE.Terrain](https://github.com/IceCreamYou/THREE.Terrain) already includes scatter and grass APIs. A [procedural instanced forest author](https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610) describes the challenge between detailed single trees and large forests. | Biome differentiates on a small independent placement API and immediately editable/exportable recipe workflow. Terrain generation is demo scaffolding, not the main product claim. |
| Rendering scale | Native [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) reduces draws for shared geometry/material. | Build on native instancing. Report actual renderer statistics; do not promise an unmeasured FPS or million-instance capacity. |
| Motion trails | [Developer thread](https://discourse.threejs.org/t/trail-renderer-particle-system/10095) and Quarks document existing trail solutions. | A standalone, fixed-capacity world-space ribbon with a tiny update API and a visual preset workbench is a credible second tool. |
| Combat warnings | A [developer's directional ability indicator question](https://community.gamedev.tv/t/directional-ability-indicator/211371) illustrates the pointer/ability integration need. Three.js provides [DecalGeometry](https://threejs.org/docs/pages/DecalGeometry.html); a [decal discussion](https://discourse.threejs.org/t/threejs-decalgeometry-alternative/39205) describes stretching concerns. | Signal focuses on Y-up heightfields, charge lifecycle and gameplay queries that agree with the visible shape. Indicators are an existing category. A reusable, documented integration is the opportunity; this is an inference, not measured unmet demand. |

## Priorities

### Gameplay expansion

These are established categories. The useful gap is a small, independently reusable integration with clear state semantics and a playable explanation—not a claim that nobody has made an inventory or quest system.

| Area | Primary evidence and alternatives | Product choice |
| --- | --- | --- |
| Grid inventories | The [GridPack developer](https://devforum.roblox.com/t/gridpack-create-gridtetris-style-inventories/2891897) packages Tetris-style inventories; a [Quest author](https://textadventures.co.uk/forum/samples/topic/avkma4syb0olnl7bbdwada/grid-inventory-take-2) describes grid inventory and stacking work. These demonstrate an established mechanic, not Three.js market demand. | Satchel concentrates on renderer-free state, atomic transfers/crafting, stable IDs and strict snapshots. The original camp demonstrates those operations through real objects. |
| Branching dialogue | [inkjs](https://github.com/y-lohse/inkjs) brings Ink stories to JavaScript. [Yarn Spinner](https://github.com/YarnSpinnerTool/YarnSpinner) already provides a substantial narrative compiler/runtime ecosystem. | Chatter is deliberately smaller: plain JSON, typed scalar variables, explicit effects/conditions and an optional DOM box. It does not attempt to replace a narrative language or editor. |
| Contextual interaction | Three.js [InteractiveGroup](https://threejs.org/docs/pages/InteractiveGroup.html) handles pointer/XR interaction. [THREE.Interactive](https://github.com/markuslerner/THREE.Interactive) provides pointer/touch dispatch. Native [Raycaster](https://threejs.org/docs/pages/Raycaster.html) supplies picking. | Latch adds gameplay rules above picking: actor reach, supplied occluders, focus arbitration and hold cancellation. Returning events keeps host mutations outside traversal. |
| Objective journals | [XState persistence](https://stately.ai/docs/persistence) already covers persisted actors/state machines; inkjs covers rich narrative state. | Trailmark targets a narrow objective schema with prerequisite gates, event counters, completion receipts and validated saves. Bounded local dedupe is explicitly separate from distributed transaction guarantees. |
| Premade game loop | Satchel and Chatter need a credible integration example that goes beyond isolated controls. | Mothlight composes them into a short original adventure with movement, pickup/craft/deliver, saving and an ending. It is a starting template, not a general engine. |
| Combat integration template | Signal and Flux already have isolated visual studies, but a complete loop must connect visible warnings to actual damage, movement and round outcomes. | Afterglow composes native warning footprints and dash ribbons into a finite arena-survival game. It demonstrates integration and gameplay policy rather than claiming a new combat mechanic. |

### Rendering and larger ideas

1. **Biome** — deterministic heightfield placement; minimum center spacing; altitude/slope filters; exclusion disks/corridors; GPU instances; JSON snapshots; live visual scene; user GLB prototype support.
2. **Flux** — standalone world-space motion trails; bounded buffers; time-based lifetime; taper and gradient; explicit breaks for teleports; recipe export; multiple gorgeous motion studies. No dependency on Biome.
3. **Signal** — independent terrain-conforming combat warnings; circle/ring, cone and beam; one-time completion events; transformed area queries; recipe and optional HTTP automation; three arena studies. No dependency on Biome or Flux.
4. **Impostor baker** — attractive future adjacent tool. Park until multi-view normal/depth atlas accuracy, color management and alpha sorting have a clear testable design.
5. **Navmesh painter / agent authoring** — park; mature Recast integrations should be evaluated before building geometry/agent infrastructure.
6. **Road authoring** — defer; terrain conformance, intersections, UVs, shoulders and collision produce a much larger first milestone.
7. **Camera director** — investigate authored gameplay modes before implementing. [camera-controls](https://yomotsu.github.io/camera-controls/) already offers extensive transitions and camera behavior; [Ecctrl](https://github.com/pmndrs/ecctrl) supplies a capable React Three Fiber character/camera ecosystem. Basic smoothing would overlap heavily.

## Product boundaries

- Authoring and rendering run in the web browser on actual Three.js r180.
- Independently packageable ES modules. Rendering/interaction tools use Three.js as a peer; headless gameplay packages have no runtime dependencies. No React or proprietary engine dependency.
- JavaScript APIs are the primary integration. An optional documented HTTP companion supports automation without being required by any package or the showcase.
- No claim of unique invention, production readiness across every browser, or measured commercial demand.
- No downloaded model, texture, music or image assets are necessary. Demo geometry is original and procedural.


## Five-tool expansion · 8 September 2026

These are useful workflow choices, not five previously undiscovered algorithms. The research found substantial existing alternatives; implementation scope deliberately stays small enough to use independently and explain through a working scene.

| Tool | Primary alternatives | Narrow product decision and showcase |
| --- | --- | --- |
| Loom | Three.js [Curve](https://threejs.org/docs/pages/Curve.html) already provides arc-length sampling; [ExtrudeGeometry](https://threejs.org/docs/pages/ExtrudeGeometry.html) sweeps shapes along a path. | Use native Three.js curves and BufferGeometry to package a ribbon with width/bank profiles, borders, consistent route sampling and JSON recipes. Cloudline Railway makes editing a route and moving a vehicle along the same route visible. This is not a terrain road/intersection generator. |
| Wayfinder | [three-pathfinding](https://github.com/donmccurdy/three-pathfinding) supplies navigation mesh paths and movement clamping. [Yuka](https://github.com/Mugen87/yuka) offers game AI and steering. | A bounded, dependency-free weighted XZ grid with explicit diagonal/corner rules, atomic edits and saves is easier to drop into tile-based Three.js games. Moonpost Dispatch shows editable obstacles, costly terrain and courier paths. No navmesh baking or crowd avoidance. |
| Spring | [pmndrs math](https://github.com/pmndrs/math) includes graphics math, easing and springs; [react-spring](https://github.com/pmndrs/react-spring) is an established animation ecosystem. | A small scalar/vector analytic oscillator with target changes and impulses supports recoil, secondary motion and UI offsets without an animation framework. Jellyworks compares damping responses. No claim of inventing springs or replacing full rigid-body physics. |
| Parcel | [Chance weighted](https://chancejs.com/miscellaneous/weighted.html) provides relative weighted selection; [Silvermine weighted-random-selection](https://github.com/silvermine/weighted-random-selection) provides configurable repeat distance. | A flat deterministic table with receipts, inspectable next-roll odds, an explicit hard-pity policy and validated state is a useful integration boundary. Starlight Salvage reveals actual generated drops and measures its own sampled distribution. No economy server, item granting or cryptographic randomness. |
| Tempo | [Phaser Clock and Timer Events](https://docs.phaser.io/phaser/concepts/time) already support game-time timers, pause and time scaling. | A renderer-independent charge clock makes sequential recharge, per-use cooldown and optional global cooldown explicit. Spellgarden derives effects and controls from the same successful-use result. This is a cooldown scheduler, not a complete ability/combat framework. |

Broad particle engines remain covered by [Quarks](https://github.com/Alchemist0823/three.quarks) and [Nebula](https://github.com/creativelifeform/three-nebula). Camera controls remain covered by [camera-controls](https://github.com/yomotsu/camera-controls) and [three-story-controls](https://github.com/nytimes/three-story-controls). Building another general version was not the highest-value next step. Larger terrain-conforming roads, navmesh authoring and impostor baking remain parked; Loom and Wayfinder intentionally solve narrower problems.
