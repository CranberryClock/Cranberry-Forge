export interface ItemDefinition {
  id: string;
  name?: string;
  width?: number;
  height?: number;
  maxStack?: number;
  weight?: number;
}
export interface Stack {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  rotated: boolean;
}
export interface Recipe {
  ingredients: { itemId: string; quantity: number }[];
  outputs: { itemId: string; quantity: number }[];
}
export type Result =
  | { ok: true; quantity?: number; id?: string }
  | { ok: false; reason: string };
export interface Snapshot {
  schema: "cranberry-forge.satchel/1";
  columns: number;
  rows: number;
  maxWeight: number;
  nextId: number;
  items: Stack[];
}
export function normalizeCatalog(
  catalog: ItemDefinition[],
): Readonly<Required<ItemDefinition>>[];
export class Inventory {
  constructor(options: {
    catalog: ItemDefinition[];
    columns?: number;
    rows?: number;
    maxWeight?: number;
  });
  readonly columns: number;
  readonly rows: number;
  readonly maxWeight: number;
  readonly revision: number;
  readonly items: Stack[];
  readonly catalog: Required<ItemDefinition>[];
  readonly weight: number;
  count(itemId: string): number;
  dimensions(entry: Pick<Stack, "itemId" | "rotated">): {
    width: number;
    height: number;
  };
  add(itemId: string, quantity?: number): Result;
  take(itemId: string, quantity?: number): Result;
  remove(id: string, quantity?: number): Result;
  move(id: string, x: number, y: number, rotated?: boolean): Result;
  rotate(id: string): Result;
  split(id: string, quantity: number): Result;
  merge(sourceId: string, targetId: string): Result;
  transfer(id: string, target: Inventory, quantity?: number): Result;
  canCraft(recipe: Recipe, times?: number): Result;
  craft(recipe: Recipe, times?: number): Result;
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
  toSnapshot(): Snapshot;
  static fromSnapshot(
    value: string | Snapshot | unknown,
    options: { catalog: ItemDefinition[] },
  ): Inventory;
}
