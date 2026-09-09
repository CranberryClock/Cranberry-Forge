// Offline illustrations of the actual Three.js geometry, not browser screenshots.
import * as THREE from "three";
import { flatten, save } from "./render-samples.mjs";
import { createPipelineScene } from "../dist/pipeline-scenes.js";
import { evaluateStats } from "../dist/packages/ledger/index.js";
import { auditAssets } from "../dist/packages/sift/index.js";
import { ledgerBase, loadouts, cargoInput } from "../dist/pipeline-fixtures.js";
for (const [kind, title, detail] of [
  [
    "ledger",
    "LEDGER / Clockwork Proving Ground",
    "Equipment stats with source-by-source explanations",
  ],
  [
    "keepsake",
    "KEEPSAKE / Memory Observatory",
    "Validated migrations preserve progress between schemas",
  ],
  [
    "sift",
    "SIFT / Cargo Inspection Dock",
    "Manifest errors and asset budgets become visible build gates",
  ],
]) {
  const stage = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(38, 1440 / 900, 0.1, 250),
    bloom: {},
  };
  const world = createPipelineScene(stage, kind);
  if (kind === "ledger")
    world.setState(
      evaluateStats({ base: ledgerBase, modifiers: loadouts.mage.modifiers })
        .values,
    );
  if (kind === "keepsake") world.setState({ islands: 5 });
  if (kind === "sift")
    world.setState({ report: auditAssets(cargoInput()), selected: 0 });
  world.update(1.4);
  world.root.traverse((o) => {
    if (o.parent === world.root && o.isMesh && o.position.y < 0.2)
      o.renderOrder = -100 + o.position.y;
  });
  const illustration = flatten(world.root);
  illustration.background = stage.scene.background;
  await save(
    `${kind}-sample`,
    illustration,
    stage.camera,
    title,
    `${detail} · offline geometry render; no WebGL bloom or shadows`,
  );
  world.dispose();
}
