import {
  createParcel,
  validateTable,
  type LootTable,
  type ParcelSnapshot,
  type LootReceipt,
} from "../dist/packages/parcel/index.js";
const table: LootTable = {
  id: "test",
  entries: [
    { id: "star", itemId: "star", rarity: "rare", weight: 1, min: 1, max: 3 },
  ],
  pity: { after: 5, rarities: ["rare"] },
};
const normalized = validateTable(table),
  parcel = createParcel(normalized, { seed: 0 });
const receipt: LootReceipt = parcel.roll().receipt;
const snapshot: ParcelSnapshot = parcel.open(10).snapshot;
parcel.restore(snapshot);
createParcel(table, { snapshot });
const chance: number = parcel.odds().entries[0].probability;
void [receipt, chance];
// @ts-expect-error batch counts are numeric
parcel.open("ten");
// @ts-expect-error seeds are numeric
createParcel(table, { seed: "seed" });
