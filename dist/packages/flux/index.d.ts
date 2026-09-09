/// <reference types="@webgpu/types" />
import type { Mesh, BufferGeometry, ShaderMaterial, Vector3 } from "three";
export interface TrailOptions {
  capacity?: number;
  lifetime?: number;
  width?: number;
  taper?: number;
  opacity?: number;
  intensity?: number;
  color?: string;
  tailColor?: string;
  minDistance?: number;
  maxJump?: number;
}
export interface TrailRecipe {
  schema: "cranberry-forge.flux/1";
  options: Required<TrailOptions>;
}
export const FLUX_DEFAULTS: Readonly<Required<TrailOptions>>;
export function normalizeTrailOptions(
  options?: TrailOptions,
): Required<TrailOptions>;
export class Trail extends Mesh<BufferGeometry, ShaderMaterial> {
  constructor(options?: TrailOptions);
  options: Required<TrailOptions>;
  readonly sampleCount: number;
  readonly capacity: number;
  push(position: Vector3 | [number, number, number], time: number): boolean;
  break(): this;
  clear(): this;
  update(time: number, cameraPosition: Vector3): this;
  configure(options: TrailOptions): this;
  toRecipe(): TrailRecipe;
  static fromRecipe(value: TrailRecipe | string): Trail;
  dispose(): void;
}
