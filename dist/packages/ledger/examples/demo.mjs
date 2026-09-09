import { compareLoadouts } from "../index.js";
const base = { attack: 50, speed: 3 };
const result = compareLoadouts({ base, rounding: 2 }, [
  { id: "bare", modifiers: [] },
  {
    id: "sword",
    modifiers: [
      { id: "blade", source: "sword", stat: "attack", kind: "flat", value: 10 },
    ],
  },
  {
    id: "boots",
    modifiers: [
      {
        id: "stride",
        source: "boots",
        stat: "speed",
        kind: "multiplier",
        value: 1.5,
      },
    ],
  },
]);
console.log(JSON.stringify(result, null, 2));
