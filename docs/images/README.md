# Sample image provenance

These are offline illustrations generated from the demo geometry by `npm run samples` using the official Three.js SVGRenderer and Sharp. They are not browser screenshots. SVGRenderer does not support WebGL shaders, bloom, textures or shadows; materials are simplified accordingly. Signal uses a mesh version of the matching ring footprint. No external or generated concept imagery is used.

Satchel's inventory and Chatter's dialogue panels are SVG presentations of actual package state, rather than DOM captures. Mothlight's completed scene is produced by running its collect/craft/deliver game-state flow. Latch and Trailmark samples use their procedural scene factories. Original item and character thumbnails in `dist/assets/items/` use the same renderer; these assets also appear in the live UI.

The build copies these gallery files into `dist/assets/previews/` for the collection page. These copies are generated; the tracked originals live here.

Afterglow's sample advances a real game trace to an active beam warning and dash. Its ribbon is the actual Flux buffer; the warning overlay uses the template's matching native footprint geometry with a stronger flat color for the offline renderer. The small status panel reads the real round/health state. Lighting is simplified; the live Signal charge shader is not reproduced.

These offline images are not evidence of browser/GPU visual QA. Verify rendering and performance in your target browsers and devices before shipping an application.


The five expansion samples use their actual scene factories: Loom moves the train using its spline frame API; Wayfinder computes a weighted A* route before rendering it; Spring advances an analytic impulse response; Parcel renders the actual seeded legendary receipt; Tempo accepts three casts through its real charge clock before drawing the effects. These are fourteen tracked README images in total. `npm run samples:expansion` regenerates these five; append a tool name to `node scripts/render-expansion-samples.mjs` to render one.

The offline expansion renderer assigns broad ground layers explicit painter order because SVG has no depth buffer. Lighting is simplified. This corrects projection artifacts without replacing the underlying Three.js scene geometry or claiming WebGL equivalence.
