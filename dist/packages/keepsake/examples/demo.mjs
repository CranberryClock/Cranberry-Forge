import { createSave, migrateSave, diffSaves } from "../index.js";
const original = createSave("example-game", 0, { coins: 25 });
const result = migrateSave(original, {
  format: "example-game",
  targetVersion: 1,
  validators: {
    0: (p) => Number.isSafeInteger(p?.coins),
    1: (p) => Number.isSafeInteger(p?.wallet?.gold),
  },
  migrations: { 0: (p) => ({ wallet: { gold: p.coins } }) },
});
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
else
  console.log(
    JSON.stringify(diffSaves(original.payload, result.save.payload), null, 2),
  );
