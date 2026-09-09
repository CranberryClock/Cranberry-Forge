import { Vector3, MeshStandardMaterial } from "three";
import {
  Loom,
  createLoomSample,
  normalizeLoomOptions,
  type LoomOptions,
  type LoomRecipe,
  type LoomSample,
} from "../dist/packages/loom/index.js";
const options: LoomOptions = {
  points: [[0, 0, 0], new Vector3(0, 0, 10)],
  width: [
    { at: 0, value: 1 },
    { at: 1, value: 2 },
  ],
  bank: 0.1,
};
const loom = new Loom(options, { surface: new MeshStandardMaterial() });
const frame: LoomSample = loom.sampleDistance(3, createLoomSample());
frame.position.addScaledVector(frame.up, 1);
const recipe: LoomRecipe = loom.toRecipe();
const restored: Loom = Loom.fromRecipe(recipe).configure({ segments: 256 });
normalizeLoomOptions(options);
restored.dispose();
loom.dispose();
// @ts-expect-error Invalid bank profile strings must fail at compile time.
const invalid: LoomOptions = { bank: "tilted" };
void invalid;
