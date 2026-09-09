export declare const VERSION: "0.1.0";
export declare const SNAPSHOT_VERSION: 1;
export declare const LIMITS: Readonly<{
  entries: 256;
  weight: 1000000;
  quantity: 1000000;
  batch: 10000;
  pity: 10000;
  rolls: 1000000000;
  draws: 4294967295;
}>;
export type ParcelErrorCode =
  | "INVALID_INPUT"
  | "INVALID_TABLE"
  | "INVALID_SNAPSHOT"
  | "INCOMPATIBLE_SNAPSHOT"
  | "LIMIT_REACHED";
export declare class ParcelError extends Error {
  readonly code: ParcelErrorCode;
  constructor(code: ParcelErrorCode, message: string);
}
export interface LootEntry {
  id: string;
  itemId: string;
  label?: string;
  rarity: string;
  weight: number;
  min?: number;
  max?: number;
}
export interface PityPolicy {
  after: number;
  rarities: readonly string[];
}
export interface LootTable {
  id: string;
  entries: readonly LootEntry[];
  pity?: PityPolicy | null;
}
export interface NormalizedTable {
  id: string;
  entries: Required<LootEntry>[];
  pity: { after: number; rarities: string[] } | null;
}
export interface ParcelSnapshot {
  version: 1;
  tableKey: string;
  seed: number;
  rngState: number;
  draws: number;
  rolls: number;
  misses: number;
}
export interface LootReceipt {
  id: string;
  roll: number;
  entryId: string;
  itemId: string;
  label: string;
  rarity: string;
  quantity: number;
  guaranteed: boolean;
  probability: number;
  baseProbability: number;
  missesBefore: number;
  missesAfter: number;
}
export interface EntryOdds extends Required<LootEntry> {
  probability: number;
  baseProbability: number;
}
export interface Odds {
  guaranteed: boolean;
  misses: number;
  remaining: number | null;
  entries: EntryOdds[];
}
export interface ParcelOptions {
  seed?: number;
  snapshot?: unknown;
}
export interface Parcel {
  roll(): { receipt: LootReceipt; snapshot: ParcelSnapshot };
  open(count?: number): { receipts: LootReceipt[]; snapshot: ParcelSnapshot };
  odds(): Odds;
  snapshot(): ParcelSnapshot;
  restore(snapshot: unknown): ParcelSnapshot;
}
export declare function validateTable(input: unknown): NormalizedTable;
export declare function createParcel(
  table: LootTable | unknown,
  options?: ParcelOptions,
): Parcel;
