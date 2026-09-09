import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { Conversation, validateStory } from "@cranberry-forge/chatter";
import { mountDialogue } from "@cranberry-forge/chatter/dom";
import { MIRA_STORY } from "../dist/kits/chatter-story.js";
test("dialogue conditions, one-time choices and snapshots retain consequences", () => {
  const c = new Conversation(MIRA_STORY);
  assert.equal(c.view.choices.find((i) => i.id === "story").enabled, false);
  c.choose("help");
  c.choose("promise");
  assert.equal(c.variables.trust, 2);
  assert.equal(c.view.choices.find((i) => i.id === "story").enabled, true);
  assert.equal(c.choose("help").reason, "unavailable");
  const saved = c.toSnapshot(),
    loaded = Conversation.fromSnapshot(MIRA_STORY, JSON.stringify(saved));
  assert.deepEqual(loaded.toSnapshot(), saved);
  assert.equal(loaded.variables.trust, 2);
  assert.equal(loaded.choose("help").reason, "unavailable");
});
test("dialogue transition errors roll back variables, visits and one-time flags", () => {
  const story = {
    id: "overflow",
    start: "start",
    variables: { n: 999999999 },
    nodes: {
      start: {
        text: "A",
        choices: [
          {
            id: "go",
            text: "Go",
            target: "end",
            once: true,
            effects: [{ op: "add", variable: "n", value: 1 }],
          },
        ],
      },
      end: { text: "B", onEnter: [{ op: "add", variable: "n", value: 1 }] },
    },
  };
  const c = new Conversation(story),
    before = c.toSnapshot();
  assert.throws(() => c.choose("go"));
  assert.deepEqual(c.toSnapshot(), before);
  assert.equal(c.view.choices[0].enabled, true);
});
test("story validation catches references, types and accidental save incompatibility", () => {
  assert.throws(() =>
    validateStory({
      id: "bad",
      start: "a",
      nodes: { a: { text: "Hi", next: "missing" } },
    }),
  );
  const c = new Conversation(MIRA_STORY),
    before = c.toSnapshot();
  assert.throws(() => c.setVariables({ trust: 4, unknown: true }));
  assert.deepEqual(c.toSnapshot(), before);
  const edited = structuredClone(MIRA_STORY);
  edited.nodes.welcome.text = "Changed";
  assert.throws(() => Conversation.fromSnapshot(edited, before));
  const bad = structuredClone(before);
  bad.usedChoices = ["welcome/no-such-choice"];
  assert.throws(() => Conversation.fromSnapshot(MIRA_STORY, bad));
});
test("DOM dialogue safely presents text, changes branches and releases subscriptions", () => {
  const dom = new JSDOM('<main id="box"></main>'),
    host = dom.window.document.querySelector("#box"),
    story = {
      id: "text",
      start: "a",
      nodes: {
        a: {
          speaker: "<b>Mira</b>",
          text: "<img src=x onerror=alert(1)>",
          next: "b",
        },
        b: { text: "Goodbye" },
      },
    },
    c = new Conversation(story),
    box = mountDialogue(host, c, { charactersPerSecond: 0 });
  assert.equal(host.querySelector("img"), null);
  assert.ok(host.textContent.includes("<img src=x"));
  host.querySelector("button").click();
  assert.ok(host.textContent.includes("Goodbye"));
  box.dispose();
  assert.equal(host.children.length, 0);
  c.advance();
  assert.equal(host.children.length, 0);
  dom.window.close();
});

test("supplied malformed snapshots reject instead of replaying initial effects", () => {
  const story = {
    id: "restore",
    start: "start",
    variables: { count: 0 },
    nodes: {
      start: {
        text: "Hello",
        onEnter: [{ op: "add", variable: "count", value: 1 }],
      },
    },
  };
  const fresh = new Conversation(story);
  assert.equal(fresh.variables.count, 1);
  assert.equal(new Conversation(story, {}).variables.count, 1);
  assert.equal(
    Conversation.fromSnapshot(story, fresh.toSnapshot()).variables.count,
    1,
  );
  assert.throws(() => Conversation.fromSnapshot(story));
  for (const snapshot of [undefined, null, false, 0, "", NaN]) {
    assert.throws(() => Conversation.fromSnapshot(story, snapshot));
    assert.throws(() => new Conversation(story, { snapshot }));
  }
});

test("restored node IDs must be primitive identifiers", () => {
  const before = new Conversation(MIRA_STORY).toSnapshot();
  for (const nodeId of [
    [before.nodeId],
    new String(before.nodeId),
    { toString: () => before.nodeId },
    null,
    0,
  ])
    assert.throws(() =>
      Conversation.fromSnapshot(MIRA_STORY, { ...before, nodeId }),
    );
  assert.throws(() =>
    Conversation.fromSnapshot(
      MIRA_STORY,
      JSON.stringify({ ...before, nodeId: [before.nodeId] }),
    ),
  );
  const loaded = Conversation.fromSnapshot(MIRA_STORY, before),
    originalId = before.nodeId;
  before.nodeId = "missing";
  assert.equal(loaded.nodeId, originalId);
  assert.equal(loaded.view.nodeId, originalId);
});

test("DOM validates onEnd before mounting and isolates callback failures", (t) => {
  const dom = new JSDOM("<main></main>"),
    host = dom.window.document.querySelector("main"),
    c = new Conversation(MIRA_STORY),
    errors = t.mock.method(console, "error", () => {});
  t.after(() => dom.window.close());
  assert.throws(() => mountDialogue(host, c, { onEnd: null }), TypeError);
  assert.equal(host.children.length, 0);
  c.end();
  let ended = 0;
  const box = mountDialogue(host, c, {
    onEnd() {
      ended++;
      assert.equal(host.querySelector("p").textContent, "Conversation ended.");
      throw new Error("game callback failed");
    },
  });
  assert.equal(ended, 1);
  assert.equal(errors.mock.callCount(), 1);
  assert.equal(host.querySelector("p").textContent, "Conversation ended.");
  c.setVariables({});
  assert.equal(ended, 1);
  assert.equal(host.querySelectorAll("p").length, 1);
  box.dispose();
  box.dispose();
  assert.equal(host.children.length, 0);
});

test("DOM cleans up its subscription and root when initial rendering fails", (t) => {
  const dom = new JSDOM("<main></main>"),
    host = dom.window.document.querySelector("main"),
    c = new Conversation(MIRA_STORY),
    subscribe = c.subscribe.bind(c),
    failure = new Error("initial view failed");
  t.after(() => dom.window.close());
  let subscriptions = 0,
    viewReads = 0;
  c.subscribe = (listener) => {
    subscriptions++;
    const unsubscribe = subscribe(listener);
    return () => {
      subscriptions--;
      unsubscribe();
    };
  };
  Object.defineProperty(c, "view", {
    get() {
      viewReads++;
      throw failure;
    },
  });
  assert.throws(
    () => mountDialogue(host, c),
    (error) => error === failure,
  );
  assert.equal(host.children.length, 0);
  assert.equal(subscriptions, 0);
  assert.equal(viewReads, 1);
  c.end();
  assert.equal(viewReads, 1);
});

test("onEnd can trigger a conversation update without duplicate ended content", (t) => {
  const dom = new JSDOM("<main></main>"),
    host = dom.window.document.querySelector("main"),
    c = new Conversation(MIRA_STORY);
  t.after(() => dom.window.close());
  let ended = 0;
  const box = mountDialogue(host, c, {
    charactersPerSecond: 0,
    onEnd() {
      ended++;
      c.setVariables({});
    },
  });
  c.end();
  assert.equal(ended, 1);
  assert.equal(host.querySelectorAll("p").length, 1);
  box.dispose();
});
