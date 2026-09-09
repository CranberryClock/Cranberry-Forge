/// <reference types="@webgpu/types" />
import type {
  Mesh,
  BufferGeometry,
  ShaderMaterial,
  Vector3,
  Object3DEventMap,
} from "three";
export interface SignalOptions {
  shape?: "circle" | "cone" | "beam";
  radius?: number;
  innerRadius?: number;
  angle?: number;
  length?: number;
  width?: number;
  segments?: number;
  color?: string;
  opacity?: number;
  intensity?: number;
  edgeWidth?: number;
  offset?: number;
}
export interface SignalRecipe {
  schema: "cranberry-forge.signal/1";
  options: Required<SignalOptions>;
}
export interface SignalEventMap extends Object3DEventMap {
  armed: {};
  complete: {};
}
export const SIGNAL_DEFAULTS: Readonly<Required<SignalOptions>>;
export function normalizeSignalOptions(
  options?: SignalOptions,
): Required<SignalOptions>;
export function containsLocalPoint(
  options: SignalOptions,
  x: number,
  z: number,
): boolean;
export class Telegraph extends Mesh<
  BufferGeometry,
  ShaderMaterial,
  SignalEventMap
> {
  constructor(options?: SignalOptions);
  options: Required<SignalOptions>;
  progress: number;
  readonly state: "idle" | "charging" | "complete" | "cancelled";
  arm(time: number, duration?: number): this;
  update(time: number): this;
  cancel(): this;
  project(surface: (x: number, z: number) => number): this;
  containsPoint(worldPoint: Vector3): boolean;
  configure(options: SignalOptions): this;
  toRecipe(): SignalRecipe;
  static fromRecipe(value: string | SignalRecipe): Telegraph;
  dispose(): void;
}
