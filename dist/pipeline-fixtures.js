// Demonstration data: independent headless cores never import this module.
export const ledgerBase = { attack: 50, speed: 3, reach: 2 };
export const loadouts = {
  scout: {
    name: "Courier",
    description: "Light feet. A longer stride.",
    color: "#b6ef79",
    modifiers: [
      {
        id: "boots-speed",
        source: "boots",
        stat: "speed",
        kind: "multiplier",
        value: 1.65,
      },
      {
        id: "blade-flat",
        source: "blade",
        stat: "attack",
        kind: "flat",
        value: 8,
      },
    ],
  },
  knight: {
    name: "Sentinel",
    description: "Heavy brass. Heavy hits.",
    color: "#ffbc72",
    modifiers: [
      {
        id: "blade-flat",
        source: "blade",
        stat: "attack",
        kind: "flat",
        value: 24,
      },
      {
        id: "armor-speed",
        source: "armor",
        stat: "speed",
        kind: "multiplier",
        value: 0.7,
      },
      {
        id: "blade-reach",
        source: "blade",
        stat: "reach",
        kind: "flat",
        value: 0.65,
      },
    ],
  },
  mage: {
    name: "Arcanist",
    description: "A little reach. A lot of leverage.",
    color: "#c6adff",
    modifiers: [
      {
        id: "staff-power",
        source: "staff",
        stat: "attack",
        kind: "additivePercent",
        value: 0.3,
      },
      {
        id: "charm-power",
        source: "charm",
        stat: "attack",
        kind: "multiplier",
        value: 1.15,
      },
      {
        id: "staff-reach",
        source: "staff",
        stat: "reach",
        kind: "flat",
        value: 1.4,
      },
    ],
  },
};
export const memoryConfig = {
  format: "forge.observatory",
  targetVersion: 2,
  validators: {
    0: (p) =>
      (p &&
        Number.isSafeInteger(p.coins) &&
        p.coins >= 0 &&
        Number.isInteger(p.islands) &&
        p.islands >= 1 &&
        p.islands <= 5) ||
      "Expected coins ≥ 0 and islands from 1 to 5",
    1: (p) =>
      (p &&
        Number.isSafeInteger(p.wallet?.gold) &&
        p.wallet.gold >= 0 &&
        Number.isInteger(p.islands) &&
        p.islands >= 1 &&
        p.islands <= 5) ||
      "Expected wallet.gold ≥ 0 and islands from 1 to 5",
    2: (p) =>
      (p &&
        Number.isSafeInteger(p.wallet?.gold) &&
        p.wallet.gold >= 0 &&
        Number.isInteger(p.world?.islands) &&
        p.world.islands >= 1 &&
        p.world.islands <= 5 &&
        ["dawn", "dusk"].includes(p.world.sky)) ||
      "Expected wallet.gold ≥ 0, world.islands from 1 to 5, and a dawn/dusk sky",
  },
  migrations: {
    0: (p) => ({ wallet: { gold: p.coins }, islands: p.islands }),
    1: (p) => ({
      wallet: p.wallet,
      world: { islands: p.islands, sky: "dusk" },
    }),
  },
};
export const memories = {
  first: {
    format: "forge.observatory",
    version: 0,
    payload: { coins: 125, islands: 2 },
  },
  expedition: {
    format: "forge.observatory",
    version: 1,
    payload: { wallet: { gold: 840 }, islands: 5 },
  },
  current: {
    format: "forge.observatory",
    version: 2,
    payload: { wallet: { gold: 420 }, world: { islands: 3, sky: "dawn" } },
  },
  broken: {
    format: "forge.observatory",
    version: 0,
    payload: { coins: "oops", islands: 2 },
  },
  future: { format: "forge.observatory", version: 7, payload: {} },
};
export function cargoInput(corrected = false, budget = 80000) {
  return {
    manifest: [
      {
        id: "clockwork-scout",
        dependencies: ["brass-atlas"],
        requiredExtensions: [],
      },
      { id: "brass-atlas", requiredExtensions: [] },
      {
        id: "memory-gate",
        dependencies: [corrected ? "brass-atlas" : "lost-atlas"],
        requiredExtensions: corrected ? [] : ["EXT_future_shader"],
      },
    ],
    metrics: {
      "clockwork-scout": { bytes: corrected ? 48000 : 125000, triangles: 1800 },
      "brass-atlas": { bytes: 24000, triangles: 0 },
      "memory-gate": { bytes: 64000, triangles: corrected ? 2400 : 9800 },
    },
    policy: {
      budgets: { bytes: budget, triangles: 5000 },
      allowedExtensions: [],
      missingMetrics: "error",
    },
  };
}
