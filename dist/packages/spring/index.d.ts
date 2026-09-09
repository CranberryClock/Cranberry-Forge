export const VERSION: "0.1.0";
export const SPRING_DEFAULTS: Readonly<{
  frequency: number;
  dampingRatio: number;
}>;
export const SPRING_LIMITS: Readonly<{
  minFrequency: number;
  maxFrequency: number;
  maxDampingRatio: number;
  maxDeltaTime: number;
  maxMagnitude: number;
}>;
export interface SpringOptions {
  frequency?: number;
  dampingRatio?: number;
}
export interface SpringState {
  value: number;
  target: number;
  velocity: number;
}
export interface SpringInitialOptions extends SpringOptions {
  value?: number;
  target?: number;
  velocity?: number;
}
export type Vec3 = readonly [number, number, number];
export interface VectorSpringState {
  value: [number, number, number];
  target: [number, number, number];
  velocity: [number, number, number];
}
export interface VectorSpringInitialOptions extends SpringOptions {
  value?: Vec3;
  target?: Vec3;
  velocity?: Vec3;
}
export function normalizeSpringOptions(
  options?: SpringOptions,
): Required<SpringOptions>;
export function stepSpring(
  state: Readonly<SpringState>,
  dt: number,
  options?: SpringOptions,
): SpringState;
export class Spring {
  constructor(options?: SpringInitialOptions);
  readonly value: number;
  readonly velocity: number;
  readonly target: number;
  readonly state: SpringState;
  readonly options: Required<SpringOptions>;
  step(dt: number): number;
  setTarget(value: number): this;
  impulse(velocity: number): this;
  configure(options: SpringOptions): this;
  snap(value?: number): this;
  reset(): this;
}
export class VectorSpring {
  constructor(options?: VectorSpringInitialOptions);
  readonly value: [number, number, number];
  readonly velocity: [number, number, number];
  readonly target: [number, number, number];
  readonly state: VectorSpringState;
  readonly options: Required<SpringOptions>;
  step(dt: number): [number, number, number];
  setTarget(value: Vec3): this;
  impulse(velocity: Vec3): this;
  configure(options: SpringOptions): this;
  snap(value?: Vec3): this;
  reset(): this;
}
