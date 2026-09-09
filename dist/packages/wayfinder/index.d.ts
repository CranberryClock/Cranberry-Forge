export declare const VERSION: "0.1.0";
export declare const SNAPSHOT_VERSION: 1;
export declare const LIMITS: Readonly<{
  dimension: 128;
  cells: 16384;
  cost: 1000;
  coordinate: 1000000;
  cellSizeMin: 0.001;
  cellSizeMax: 1000;
}>;
export type WayfinderErrorCode =
  | "INVALID_INPUT"
  | "OUTSIDE_GRID"
  | "INCOMPATIBLE_SNAPSHOT"
  | "LIMIT_REACHED";
export declare class WayfinderError extends Error {
  readonly code: WayfinderErrorCode;
  constructor(code: WayfinderErrorCode, message: string);
}
export interface Cell {
  x: number;
  z: number;
}
export interface WorldXZ {
  x: number;
  z: number;
}
export interface WorldPoint extends WorldXZ {
  y: number;
}
export type DiagonalPolicy = "never" | "no-cut" | "always";
export interface WayfinderOptions {
  width: number;
  height: number;
  cellSize?: number;
  origin?: WorldXZ;
  diagonal?: DiagonalPolicy;
  defaultCost?: number;
}
export interface GridConfig {
  width: number;
  height: number;
  cellSize: number;
  origin: WorldXZ;
  diagonal: DiagonalPolicy;
  defaultCost: number;
}
export interface CellPatch {
  blocked?: boolean;
  cost?: number;
}
export interface CellEdit extends Cell, CellPatch {}
export interface CellState extends Cell {
  blocked: boolean;
  cost: number;
}
export interface SearchOptions {
  maxVisited?: number;
  y?: number;
}
export type RouteStatus =
  | "found"
  | "outside-grid"
  | "blocked-start"
  | "blocked-goal"
  | "unreachable"
  | "budget-exceeded";
export interface RouteResult {
  status: RouteStatus;
  cells: Cell[];
  points: WorldPoint[];
  cost: number | null;
  visited: number;
  revision: number;
}
export interface WayfinderSnapshot {
  version: 1;
  config: GridConfig;
  revision: number;
  cells: { blocked: boolean; cost: number }[];
}
export declare class Wayfinder {
  constructor(options: WayfinderOptions);
  readonly config: GridConfig;
  readonly revision: number;
  readonly size: number;
  getCell(cell: Cell): CellState;
  /** Returns revision. A no-op does not advance it. */
  setCell(cell: Cell, patch: CellPatch): number;
  /** Validates all edits before applying one atomic revision. Duplicate cells reject. */
  setCells(edits: readonly CellEdit[]): number;
  worldToCell(point: WorldXZ): Cell | null;
  cellToWorld(cell: Cell, y?: number): WorldPoint;
  findPath(start: Cell, goal: Cell, options?: SearchOptions): RouteResult;
  findWorldPath(
    start: WorldXZ,
    goal: WorldXZ,
    options?: SearchOptions,
  ): RouteResult;
  snapshot(): WayfinderSnapshot;
  restore(snapshot: unknown): this;
  static fromSnapshot(snapshot: unknown): Wayfinder;
}
