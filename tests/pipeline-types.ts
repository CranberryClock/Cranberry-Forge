import {
  Ledger,
  evaluateStats,
  compareLoadouts,
} from "../dist/packages/ledger/index.js";
import {
  createSave,
  migrateSave,
  diffSaves,
} from "../dist/packages/keepsake/index.js";
import { auditAssets } from "../dist/packages/sift/index.js";
import { auditFiles } from "../dist/packages/sift/node.js";
const ledger = new Ledger({ base: { attack: 50 } });
ledger.setModifier({
  id: "blade",
  source: "sword",
  stat: "attack",
  kind: "flat",
  value: 10,
});
const value: number = evaluateStats(ledger.snapshot()).values.attack;
compareLoadouts({ base: { attack: value } }, [{ id: "bare", modifiers: [] }]);
const save = createSave("test", 0, { coins: 3 });
const result = migrateSave(save, {
  format: "test",
  targetVersion: 0,
  validators: { 0: () => true },
});
if (result.ok) diffSaves(save.payload, result.save.payload);
else console.log(result.error.code);
auditAssets({ manifest: [{ id: "hero" }], policy: { budgets: { bytes: 80 } } });
auditFiles({ manifest: [] }, { root: "." });
