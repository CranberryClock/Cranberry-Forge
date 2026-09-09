/// <reference types="@webgpu/types" />
import type { BufferGeometry, Material, Group, Matrix4 } from "three";
export type Exclusion =
  | { type: "circle"; x: number; z: number; radius: number }
  | { type: "path"; points: [number, number][]; width: number };
export interface ScatterOptions {
  seed?: number;
  count?: number;
  radius?: number;
  minDistance?: number;
  maxSlope?: number;
  minHeight?: number;
  maxHeight?: number;
  scale?: [number, number];
  alignToNormal?: boolean;
  maxAttempts?: number;
  exclusions?: Exclusion[];
}
export interface Placement {
  position: [number, number, number];
  normal: [number, number, number];
  yaw: number;
  scale: number;
}
export interface ScatterResult {
  schema: "cranberry-forge.biome/1";
  options: Required<ScatterOptions>;
  points: Placement[];
  stats: {
    requested: number;
    placed: number;
    attempts: number | null;
    saturated: boolean;
    rejected: Record<string, number> | null;
  };
}
export type Surface = (
  x: number,
  z: number,
) => number | { height: number; normal?: [number, number, number] };
export interface PrototypePart {
  geometry: BufferGeometry;
  material: Material | Material[];
  matrix?: Matrix4;
  name?: string;
}
export const DEFAULTS: Readonly<Omit<Required<ScatterOptions>, "exclusions">>;
export function seededRandom(seed?: number): () => number;
export function normalizeOptions(
  input?: ScatterOptions,
): Required<ScatterOptions>;
export function distanceToSegment(
  x: number,
  z: number,
  a: [number, number],
  b: [number, number],
): number;
export function isExcluded(
  x: number,
  z: number,
  exclusions: Exclusion[],
): boolean;
export function scatter(
  options?: ScatterOptions,
  surface?: Surface,
  density?: (x: number, z: number, height: number) => number,
): ScatterResult;
export function parseScatter(value: string | unknown): ScatterResult;
export function createInstances(
  result: ScatterResult,
  parts: PrototypePart[],
): Group;
export function disposeInstances(group: Group): void;
