import type { Camera, Intersection, Object3D, Ray, Vector3 } from "three";

export interface LatchOptions {
  /** Actor-to-hit distance in world units. Default 3. */
  reach?: number;
  /** Maximum ray distance from the aim origin. Default Infinity. */
  aimFar?: number;
  /** Retain current focus within this distance of the nearest aim hit. Default .015. */
  focusTolerance?: number;
}
export type InteractionMode = "press" | "hold";
export type Availability = boolean | string;
export interface ConditionInput<Context = unknown> {
  context: Context;
  actorPosition: Vector3;
  target: Target<Context>;
  hit: Intersection<Object3D>;
}
export interface TargetOptions<Context = unknown> {
  id: string;
  root: Object3D;
  label?: string;
  mode?: InteractionMode;
  /** Seconds; positive. Default 1. Ignored for press targets. */
  holdDuration?: number;
  reach?: number;
  /** Pure synchronous predicate: true permits; false or a reason string blocks. */
  condition?: (input: ConditionInput<Context>) => Availability;
}
export interface Target<Context = unknown> {
  readonly id: string;
  readonly root: Object3D;
  readonly label: string;
  readonly mode: InteractionMode;
  readonly holdDuration: number;
  readonly reach: number;
  readonly condition?: (input: ConditionInput<Context>) => Availability;
}
export interface InteractionFrame<Context = unknown> {
  /** Elapsed seconds since the previous update; finite and nonnegative. */
  dt: number;
  aimRay: Ray;
  /** World-space actor hand/body interaction origin, independent of aim/camera origin. */
  actorPosition: Vector3;
  pressed: boolean;
  suspended?: boolean;
  /** Supply the camera when raycasting view-dependent objects such as Sprites. */
  camera?: Camera;
  context?: Context;
}
export interface Focus {
  readonly id: string;
  readonly root: Object3D;
  readonly label: string;
  readonly mode: InteractionMode;
  readonly holdDuration: number;
  /** Independent point copy; changing it does not change controller state. */
  readonly point: Vector3;
  /** Actor-to-hit distance. */
  readonly distance: number;
  readonly available: boolean;
  readonly reason: string | null;
}
export type CancellationReason =
  | "focus-lost"
  | "removed"
  | "suspended"
  | "released"
  | "unavailable";
export type InteractionEvent =
  | { readonly type: "focus" | "start" | "activate"; readonly target: Focus }
  | {
      readonly type: "blur" | "cancel";
      readonly target: Focus;
      readonly reason: CancellationReason;
    }
  | {
      readonly type: "blocked";
      readonly target: Focus;
      readonly reason: string;
    };
export interface InteractionResult {
  readonly focus: Focus | null;
  /** 0–1; resets to 0 after activation or cancellation. */
  readonly progress: number;
  readonly holding: boolean;
  readonly requiresRelease: boolean;
  readonly events: readonly InteractionEvent[];
}
export class Latch<Context = unknown> {
  constructor(options?: LatchOptions);
  readonly options: Readonly<Required<LatchOptions>>;
  readonly size: number;
  register(options: TargetOptions<Context>): Target<Context>;
  /** Removal effects appear as events at the next update. */
  remove(id: string): boolean;
  /** Unregister every target. Does not remove or dispose scene objects. */
  clear(): void;
  /** Explicit roots tested along both the aim ray and actor-to-hit segment. */
  setOccluders(roots?: Object3D[]): this;
  update(frame: InteractionFrame<Context>): InteractionResult;
}
