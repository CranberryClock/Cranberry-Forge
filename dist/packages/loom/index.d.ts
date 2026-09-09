import type {
  BufferGeometry,
  Group,
  Material,
  Mesh,
  Quaternion,
  Vector3,
} from "three";
export type LoomPoint = readonly [number, number, number] | Vector3;
export interface ProfileKey {
  readonly at: number;
  readonly value: number;
}
export type LoomProfile = number | readonly ProfileKey[];
export interface LoomOptions {
  points?: readonly LoomPoint[];
  closed?: boolean;
  segments?: number;
  width?: LoomProfile;
  /** Radians about the forward tangent. */
  bank?: LoomProfile;
  up?: LoomPoint;
  /** World units per longitudinal UV repeat. */
  uvScale?: number;
  borderWidth?: number;
  borderHeight?: number;
}
export interface NormalizedLoomOptions
  extends Required<Omit<LoomOptions, "points" | "up">> {
  readonly points: readonly (readonly [number, number, number])[];
  readonly up: readonly [number, number, number];
}
export interface LoomMaterials {
  surface?: Material;
  borders?: Material;
}
export interface LoomSample {
  u: number;
  distance: number;
  width: number;
  bank: number;
  position: Vector3;
  tangent: Vector3;
  right: Vector3;
  up: Vector3;
  /** Maps local +X/right, +Y/up, +Z/forward into the route frame. */
  quaternion: Quaternion;
}
export interface LoomRecipe {
  schema: "cranberry-forge.loom/1";
  options: NormalizedLoomOptions;
}
export const LOOM_DEFAULTS: Readonly<NormalizedLoomOptions>;
export function normalizeLoomOptions(
  options?: LoomOptions,
): Readonly<NormalizedLoomOptions>;
export function createLoomSample(): LoomSample;
export class Loom extends Group {
  constructor(options?: LoomOptions, materials?: LoomMaterials);
  readonly options: Readonly<NormalizedLoomOptions>;
  readonly length: number;
  readonly disposed: boolean;
  readonly surface: Mesh<BufferGeometry, Material>;
  readonly borders: Mesh<BufferGeometry, Material>;
  /** Arc-length fraction; open paths clamp and closed paths wrap. Local-space output. */
  sample(u: number, target?: LoomSample): LoomSample;
  /** Arc distance; open paths clamp and closed paths wrap. */
  sampleDistance(distance: number, target?: LoomSample): LoomSample;
  /** Transactional rebuild. Disposes old geometry after successful construction. */
  configure(options: LoomOptions): this;
  toRecipe(): LoomRecipe;
  static fromRecipe(
    recipe: LoomRecipe | string,
    materials?: LoomMaterials,
  ): Loom;
  /** Idempotent. Keeps caller-supplied materials and arbitrary added children alive. */
  dispose(): void;
}
