export const MIRA_STORY = {
  id: "mira-at-mothlight",
  start: "welcome",
  variables: {
    name: "Courier",
    trust: 0,
    coins: 3,
    knows_secret: false,
    promised: false,
  },
  nodes: {
    welcome: {
      speaker: "Mira · keeper of small things",
      text: "You made it, {{name}}. The last ferry left at dusk. I was beginning to think I would have to talk to my inventory again.",
      choices: [
        {
          id: "help",
          text: "The beacon is dark. Can I help?",
          target: "beacon",
          once: true,
          effects: [{ op: "add", variable: "trust", value: 1 }],
        },
        { id: "shop", text: "What have you got for sale?", target: "shop" },
        {
          id: "story",
          text: "Why do you stay here alone?",
          target: "history",
          when: [{ variable: "trust", op: "gte", value: 1 }],
        },
        { id: "leave", text: "I’ll have a look around.", target: "goodbye" },
      ],
    },
    beacon: {
      speaker: "Mira",
      text: "Three copper, two skyglass, one moonleaf. Build a lantern and carry it to the tower. People say a lighthouse is for ships. I think it is for the person watching the horizon.",
      choices: [
        {
          id: "promise",
          text: "I’ll bring the light back.",
          target: "welcome",
          effects: [
            { op: "set", variable: "promised", value: true },
            { op: "add", variable: "trust", value: 1 },
          ],
        },
        { id: "maybe", text: "I’ll see what I can find.", target: "welcome" },
      ],
    },
    shop: {
      speaker: "Mira",
      text: "You have {{coins}} coins. The blue bottle costs two. The advice is free, but it has a strange aftertaste.",
      choices: [
        {
          id: "buy",
          text: "Buy the blue bottle · 2 coins",
          target: "bought",
          once: true,
          when: [{ variable: "coins", op: "gte", value: 2 }],
          effects: [
            { op: "add", variable: "coins", value: -2 },
            { op: "add", variable: "trust", value: 1 },
          ],
        },
        { id: "advice", text: "Let’s risk the advice.", target: "advice" },
        { id: "back", text: "Maybe later.", target: "welcome" },
      ],
    },
    bought: {
      speaker: "Mira",
      text: "There. A small transaction between people who might become friends. You have {{coins}} coin left. Spend it on something wonderfully unnecessary.",
      next: "welcome",
    },
    advice: {
      speaker: "Mira",
      text: "Leave one empty space in your pack. Something good will find it. And if it doesn’t, at least your shoulders won’t hurt.",
      next: "welcome",
    },
    history: {
      speaker: "Mira",
      text: "My brother was on the last skyship. Every night I leave a light. Silly, probably. But there is a difference between being alone and being the one who stayed.",
      choices: [
        {
          id: "listen",
          text: "It isn’t silly.",
          target: "secret",
          once: true,
          effects: [
            { op: "set", variable: "knows_secret", value: true },
            { op: "add", variable: "trust", value: 2 },
          ],
        },
        {
          id: "quiet",
          text: "[Sit quietly for a moment.]",
          target: "welcome",
          effects: [{ op: "add", variable: "trust", value: 1 }],
        },
      ],
    },
    secret: {
      speaker: "Mira",
      text: "The little moths come back when the beacon is lit. Follow them. They have better navigation than any captain I ever met.",
      next: "welcome",
    },
    goodbye: {
      speaker: "Mira",
      text: "Take your time, {{name}}. Small worlds still have corners worth looking around.",
    },
  },
};
