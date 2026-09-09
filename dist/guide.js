export function integrationCode(mode) {
  return mode === "biome"
    ? `import { scatter, createInstances } from '@cranberry-forge/biome';

const field = scatter({ seed: 42, count: 600,
  radius: 20, minDistance: 1.2 }, (x, z) => 0);

const forest = createInstances(field, [
  { geometry: treeGeometry, material: treeMaterial }
]);
scene.add(forest);`
    : `import { Trail } from '@cranberry-forge/flux';

const trail = new Trail({ width: 0.4, lifetime: 2,
  color: '#b2ffcd', tailColor: '#1d7392' });
scene.add(trail);

// Each frame: absolute time in seconds, world positions.
trail.push(emitterWorldPosition, elapsedSeconds);
trail.update(elapsedSeconds, cameraWorldPosition);`;
}
const repo = "https://github.com/CranberryClock/Cranberry-Forge";
export function guideHTML(mode) {
  const common = `<h3>Install only what you need</h3><p><a href="/downloads/cranberry-forge-${mode}-0.1.0.tgz" download>Download the standalone package ↓</a> · <a href="/examples/${mode}.html" target="_blank" rel="noopener">Open the minimal working example ↗</a></p><p>Packages have <strong>not been published to npm</strong>. Download the tarball above, or clone the repository and pack either independent folder:</p><pre>npm pack ./dist/packages/${mode}
# In your game project:
npm install three@0.180.0 /path/to/cranberry-forge-${mode}-0.1.0.tgz</pre><p>ES modules, TypeScript declarations, MIT-licensed original code. Three.js is the only peer dependency. Tested against r180 with WebGLRenderer. A wider version range and WebGPU are not claimed.</p>`;
  if (mode === "biome")
    return `<h2>Biome / Build a living scene</h2><p>Biome places your meshes on a heightfield, keeps their centers apart, and leaves room for paths and clearings. The island is a demonstration: your game can supply any height function and any static Three.js geometry.</p><h3>1. Explore the workbench</h3><p>Choose a study, change the object budget, then widen the corridor. Watch the vegetation move out of its way. “Add clearing” lets you click the landscape to reserve a circular area. A tight spacing rule can place fewer objects than requested; the counter reports that honestly.</p>${common}<h3>2. Ground your own assets</h3><pre>${integrationCode("biome").replaceAll("<", "&lt;")}</pre><p>Replace the flat surface callback with <code>(x,z) =&gt; terrain.getHeight(x,z)</code>. Return <code>{height, normal:[nx,ny,nz]}</code> to provide an analytic surface normal; otherwise Biome estimates slope with neighboring height samples. Geometry should be authored around its base at the origin, with Y up.</p><h3>3. Reserve gameplay space</h3><pre>const field = scatter({
  seed: 12, count: 800, radius: 30,
  minDistance: 1.4, maxSlope: 30,
  exclusions: [
    { type: 'circle', x: 0, z: 0, radius: 4 },
    { type: 'path', points: [[-20,0],[0,4],[20,0]], width: 3 }
  ]
}, getTerrainHeight);</pre><h3>4. Export and restore</h3><p><strong>Export recipe</strong> saves workbench settings plus the actual placement snapshot. Restore the workbench with <strong>Load recipe</strong>. For game integration, pass its <code>placement</code> field to <code>parseScatter()</code>, then <code>createInstances()</code>. <strong>Save .glb</strong> exports the world using <code>EXT_mesh_gpu_instancing</code>; your destination viewer must support that extension. PNG capture saves the current 3D view.</p><p>Custom GLB assets stay on your device. Recipes do not embed model binaries; reimport the same model after loading its recipe. The importer accepts self-contained static GLBs, up to 20 MB, 16 mesh parts and 30,000 triangles. Skins, morphs, compressed meshes and nested instances are outside this version.</p><h3>API at a glance</h3><table><tr><th>Function</th><th>Purpose</th></tr><tr><td><code>scatter(options, surface, density?)</code></td><td>Generate placements and rejection statistics.</td></tr><tr><td><code>createInstances(result, parts)</code></td><td>Build a native Three.js Group.</td></tr><tr><td><code>parseScatter(snapshot)</code></td><td>Validate saved placements without regeneration.</td></tr><tr><td><code>disposeInstances(group)</code></td><td>Free instance buffers; retain your prototype assets.</td></tr></table><h3>Things to know</h3><p>Distribution is uniform in XZ, not mesh surface area. Spacing measures centers, not full model collisions. The first release is a synchronous, bounded CPU generator with GPU instanced rendering. It does not implement streaming, per-instance LOD, skeletal animation or terrain editing.</p><p><a href="/docs/biome/api/index.html" target="_blank" rel="noopener">Full API and tutorial ↗</a> · <a href="/docs/http/index.html" target="_blank" rel="noopener">Optional HTTP companion ↗</a> · <a href="${repo}/blob/main/docs/RESEARCH.md" target="_blank" rel="noopener">Research and existing alternatives ↗</a></p>`;
  return `<h2>Flux / Give movement a memory</h2><p>A compact world-space ribbon for spells, swords, projectiles and vehicles. Flux stores recent positions in a fixed-capacity buffer, fades them by age, and faces the ribbon toward your camera.</p><h3>1. Try a motion study</h3><p>Choose an atmosphere. Stretch the trail lifetime, widen the ribbon or freeze the motion and orbit around it. “Teleport emitters” moves the source abruptly while deliberately breaking the trail. That is the same mechanism you would use when a weapon is re-equipped.</p>${common}<h3>2. Follow your game object</h3><pre>${integrationCode("flux").replaceAll("<", "&lt;")}</pre><p>Use <code>object.getWorldPosition(vector)</code> and <code>camera.getWorldPosition(vector)</code> for objects inside transformed parents. Add the trail directly to an untransformed scene root. Time must increase monotonically in seconds; call <code>clear()</code> before restarting a clock.</p><h3>3. Make it yours</h3><pre>trail.configure({ width: 0.65, taper: 1.8 });
trail.break(); // next point starts a new ribbon segment

const preset = trail.toRecipe();
const restored = Trail.fromRecipe(preset);

// On level exit:
trail.dispose();</pre><p><strong>Export recipe</strong> saves the whole workbench study. <strong>Trail recipe</strong> saves just the first emitter's standalone <code>cranberry-forge.flux/1</code> configuration, ready for <code>Trail.fromRecipe()</code>. Motion paths belong to the showcase, not the trail package.</p><h3>API at a glance</h3><table><tr><th>Method</th><th>Purpose</th></tr><tr><td><code>push(position, time)</code></td><td>Record a position in world units.</td></tr><tr><td><code>update(time, cameraPosition)</code></td><td>Expire samples and rebuild camera-facing ribbons.</td></tr><tr><td><code>break() / clear()</code></td><td>Handle teleports and reset history.</td></tr><tr><td><code>configure(options)</code></td><td>Change appearance without replacing buffers.</td></tr><tr><td><code>toRecipe() / fromRecipe()</code></td><td>Serialize and restore appearance.</td></tr><tr><td><code>dispose()</code></td><td>Release owned GPU resources.</td></tr></table><h3>Things to know</h3><p>Capacity is fixed at construction. At 60 samples per second, 256 samples retain at most about 4.3 seconds even if the lifetime is longer. Each trail uses one draw call. Rendering uses additive transparency and can become bright where ribbons overlap. Bloom is added by the showcase; it is optional in your game. Flux is not a general particle engine.</p><p><a href="/docs/flux/api/index.html" target="_blank" rel="noopener">Full API and tutorial ↗</a> · <a href="/docs/http/index.html" target="_blank" rel="noopener">Optional HTTP companion ↗</a> · <a href="${repo}/blob/main/docs/RESEARCH.md" target="_blank" rel="noopener">Research and existing alternatives ↗</a></p>`;
}
