// Shared, executable examples for the optional local HTTP companion.
export const expansionExamples = {
  "/api/v1/loom/sample": {
    options: {
      points: [
        [-6, 0, 0],
        [0, 2, -3],
        [6, 0, 0],
      ],
      width: 1.5,
      segments: 32,
    },
    samples: [0, 0.5, 1],
  },
  "/api/v1/wayfinder/path": {
    grid: { width: 4, height: 3, diagonal: "no-cut" },
    cells: [
      { x: 1, z: 0, blocked: true },
      { x: 2, z: 1, cost: 4 },
    ],
    start: { x: 0, z: 0 },
    goal: { x: 3, z: 2 },
  },
  "/api/v1/spring/step": {
    state: { value: 0, velocity: 0, target: 1 },
    dt: 0.1,
    options: { frequency: 2, dampingRatio: 0.65 },
  },
  "/api/v1/parcel/open": {
    table: {
      id: "moon-cache",
      entries: [
        {
          id: "copper",
          itemId: "copper",
          rarity: "common",
          weight: 9,
          min: 1,
          max: 3,
        },
        { id: "star", itemId: "star", rarity: "rare", weight: 1 },
      ],
      pity: { after: 5, rarities: ["rare"] },
    },
    seed: 42,
    count: 5,
  },
  "/api/v1/tempo/step": {
    definitions: [{ id: "dash", charges: 2, recharge: 3, cooldown: 0.2 }],
    options: { globalCooldown: 0.5 },
    dt: 0,
    use: "dash",
  },
};
