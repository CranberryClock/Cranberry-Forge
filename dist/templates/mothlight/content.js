export const ITEMS = [
  {
    id: "copper",
    name: "Copper ore",
    width: 1,
    height: 1,
    maxStack: 8,
    weight: 0.6,
    color: "#da9a61",
  },
  {
    id: "glass",
    name: "Skyglass",
    width: 1,
    height: 2,
    maxStack: 4,
    weight: 0.8,
    color: "#8fdee3",
  },
  {
    id: "herb",
    name: "Moonleaf",
    width: 1,
    height: 1,
    maxStack: 6,
    weight: 0.2,
    color: "#b7d48a",
  },
  {
    id: "potion",
    name: "Dew tonic",
    width: 1,
    height: 2,
    maxStack: 3,
    weight: 0.5,
    color: "#b9a2e0",
  },
  {
    id: "blade",
    name: "Survey blade",
    width: 1,
    height: 3,
    maxStack: 1,
    weight: 2.4,
    color: "#c9d9d9",
  },
  {
    id: "lantern",
    name: "Moth lantern",
    width: 2,
    height: 2,
    maxStack: 1,
    weight: 2,
    color: "#ffd48c",
  },
];
export const LANTERN_RECIPE = {
  ingredients: [
    { itemId: "copper", quantity: 3 },
    { itemId: "glass", quantity: 2 },
    { itemId: "herb", quantity: 1 },
  ],
  outputs: [{ itemId: "lantern", quantity: 1 }],
};
export const PICKUPS = [
  { id: "pickup-0", itemId: "copper", x: -4.5, z: 3.5 },
  { id: "pickup-1", itemId: "copper", x: -0.5, z: 6 },
  { id: "pickup-2", itemId: "copper", x: 5, z: 4 },
  { id: "pickup-3", itemId: "glass", x: 6, z: 0.8 },
  { id: "pickup-4", itemId: "glass", x: 1.2, z: -6 },
  { id: "pickup-5", itemId: "herb", x: -6, z: 0 },
  { id: "pickup-6", itemId: "herb", x: -5, z: 5 },
];
export const QUEST_STORY = {
  id: "mothlight-quest",
  start: "hello",
  variables: { accepted: false, lit: false },
  nodes: {
    hello: {
      speaker: "Mira · the keeper",
      text: "The beacon went dark at dusk. I can mend a thousand little things, but I cannot leave the camp. Would you carry one last delivery?",
      choices: [
        {
          id: "accept",
          text: "I’ll bring the light back.",
          target: "instructions",
          effects: [{ op: "set", variable: "accepted", value: true }],
        },
        { id: "ask", text: "Who is the light for?", target: "brother" },
        { id: "later", text: "I’ll look around first.", target: null },
      ],
    },
    brother: {
      speaker: "Mira",
      text: "My brother’s skyship. It has been a very long time. But someone should still be here when it comes home.",
      next: "hello",
    },
    thanks: {
      speaker: "Mira",
      text: "Look. The moths came back. I put another cup on the worktable. Just in case. Thank you, Courier.",
    },
    instructions: {
      speaker: "Mira",
      text: "Find three copper, two skyglass and one moonleaf. Bring them to my worktable and assemble a moth lantern. Then carry it to the beacon on the east side. I’ll be right here.",
    },
  },
};
