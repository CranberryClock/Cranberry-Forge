# @cranberry-forge/chatter

A small branching dialogue runtime with validated story graphs, typed variables, conditional choices, one-time effects, snapshots and an optional accessible dialogue box. **Zero runtime dependencies.** Designed to attach to Three.js NPC interactions without adopting a game engine.

Try `/play.html?kit=chatter`, edit the live story JSON, or read `dist/kits/chatter-story.js`. Mothlight is a complete adventure template using Chatter for its quest conversation.

## Install

Not published on npm. Download from the workbench or run `npm pack ./dist/packages/chatter`, then:

```sh
npm install /path/to/cranberry-forge-chatter-0.1.0.tgz
```

The main import has no browser or renderer dependency. `@cranberry-forge/chatter/dom` is an optional browser presentation adapter; neither import requires another Cranberry Forge package. MIT license and TypeScript declarations are included.

## Tutorial: a keeper with a request

```js
import { Conversation } from '@cranberry-forge/chatter';
import { mountDialogue } from '@cranberry-forge/chatter/dom';

const story = {
  id: 'keeper', start: 'hello', variables: { accepted: false, coins: 3 },
  nodes: {
    hello: {
      speaker: 'Mira', text: 'You have {{coins}} coins. Will you help?',
      choices: [
        { id: 'yes', text: 'Of course.', target: 'thanks', once: true,
          effects: [{ op: 'set', variable: 'accepted', value: true }] },
        { id: 'leave', text: 'Another time.', target: null }
      ]
    },
    thanks: { speaker: 'Mira', text: 'Then there is still a little light.' }
  }
};

// Call when a Three.js interaction selects an NPC.
const talk = new Conversation(story);
const box = mountDialogue(panelElement, talk, {
  onEnd() { movementEnabled = true; }
});
movementEnabled = false;
const unsubscribe = talk.subscribe(view => {
  quest.accepted = talk.variables.accepted;
});

// On scene cleanup:
box.dispose();
unsubscribe();
```

Movement, camera framing, voices, quests and inventory effects belong to your game. The runtime only executes the declared `set` and `add` operations on its own variables. It never evaluates scripts or looks up remote content.

## Story schema

| Field | Meaning |
| --- | --- |
| `id`, `start` | Story ID and initial node ID. |
| `variables` | Optional map of number, boolean or string defaults. Types stay fixed throughout the conversation. |
| `nodes` | Map of node IDs to `{speaker?,text,choices?,next?,onEnter?}`. |
| `choices` | Array of `{id,text,target,when?,effects?,once?}`. `target:null` ends immediately. |
| `next` | Next node for a line with no choices. Omit or set `null` to end when advanced. |
| `when` | All conditions must pass. Each is `{variable,op,value}`. |
| `effects`, `onEnter` | Array of `{op:'set'|'add',variable,value}`. |

IDs use lowercase letters, digits, `_`, `-`, begin with a letter and have at most 64 characters. Reserved prototype keys are rejected. Story limits: 256 nodes, 64 variables, 12 choices per node, 16 conditions per choice, 32 effects per transition/entry list. Node text is up to 8,000 characters; speaker names up to 120; choice text up to 500. Numeric variables and results must be finite within ±1e9; strings up to 1,000 characters. Visits are capped at 1,000,000 per node.

Condition operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`. Ordered comparisons and `add` require numbers. Comparisons and assignments must use the variable's declared type. Text interpolation supports `{{variable}}` and performs plain-text substitution.

```js
{ id: 'buy', text: 'Buy tonic · 2 coins', target: 'thanks', once: true,
  when: [{ variable: 'coins', op: 'gte', value: 2 }],
  effects: [{ op: 'add', variable: 'coins', value: -2 }] }
```

`once` is scoped to the node and choice ID for this conversation. Hidden branches are not skipped automatically. Disabled choices remain in `view.choices` with `enabled:false`; your UI decides how to present them. Always provide an exit when all choices could become unavailable. Graph cycles are allowed because progress is explicit; there is no automatic traversal loop.

## Runtime API

| Method / getter | Behavior |
| --- | --- |
| `new Conversation(story)` | Validate, enter the start node and apply its entry effects once. |
| `validateStory(value)` | Return a normalized graph or throw. Checks targets, duplicate IDs, types and limits. |
| `view` | Detached current speaker/text/choices, nodeId, ended and canAdvance. |
| `variables`, `nodeId`, `ended` | Inspect current state; variables are copied. |
| `choose(choiceId)` | Recheck availability; apply choice and target entry effects together. |
| `advance()` | Follow `next` on a node without choices, or end at its final line. |
| `setVariables(values)` | Atomically update existing variables with values of their declared types. |
| `end()` | Explicitly end the conversation. |
| `subscribe(listener)` | Notify after a state change; returns unsubscribe. |
| `toSnapshot()` | Return an `cranberry-forge.chatter/1` save. |
| `Conversation.fromSnapshot(story,save)` | Resume without replaying entry or choice effects. |

Actions return `{ok:true}` or `{ok:false,reason}` for `ended`, `not-found`, `unavailable`, or `choice-required`. Invalid schemas, argument values or overflowing effects throw. Failed effect transitions leave node, variables, visits and one-time choices unchanged. Subscriber errors are logged after commit. Avoid reentrant writes in a subscriber.

## Save and resume

```js
const saved = JSON.stringify(talk.toSnapshot());
const restored = Conversation.fromSnapshot(story, saved);
```

Snapshots preserve current node, variables, visit counts, used one-time choices and ended state. A non-cryptographic fingerprint rejects saves from a different normalized story definition. It is an accidental mismatch check, not authentication. Changing the story requires a deliberate save migration; even reordering object keys can change the fingerprint. Game progress outside the conversation must be saved by your game.

## Optional dialogue box

`mountDialogue(container,talk,{charactersPerSecond=45,onEnd})` returns `{finishLine(),dispose()}`. Use `0` to reveal lines instantly; range is 0–500. The adapter honors reduced-motion preference, uses safe `textContent`, provides native focusable buttons, a full-line screen-reader announcement, and cancels animation when disposed. Buttons are keyboard-operable with Tab/Enter/Space; a “Show full line” button skips typing. Wrap it in your own modal dialog if you need focus trapping or Escape-to-close.

Theme through `--chatter-text`, `--chatter-accent`, `--chatter-border`, `--chatter-button`, and `--chatter-hover`. The adapter is deliberately small; use `view` to implement subtitles, portraits, gamepad navigation, localization, voiced timing or a 3D UI yourself.

## Scope

Ink/inkjs and Yarn Spinner are mature alternatives for richer narrative authoring; see the root research notes. Chatter is a direct JSON integration utility, not a replacement scripting language or claim of a new category. Browser/GPU showcase verification status is recorded in the root README.
