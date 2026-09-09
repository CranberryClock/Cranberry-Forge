import { Conversation, validateStory } from "@cranberry-forge/chatter";
import { mountDialogue } from "@cranberry-forge/chatter/dom";
import { MIRA_STORY } from "./chatter-story.js";
import { $, toast, download, button } from "../kit-ui.js";

export function mountKit({ world, panel, stage }) {
  let story = structuredClone(MIRA_STORY),
    conversation,
    view,
    unsubscribe;
  $("#kit-instruction").textContent =
    "Meet Mira. Your choices change what she tells you.";
  $("#kit-scene-label").textContent = "A LIGHT LEFT ON";
  document.title = "Chatter / Cranberry Forge";
  stage.camera.position.set(12, 11, 17);
  stage.controls.target.set(-2, 1, -2);
  stage.controls.minDistance = 10;
  stage.controls.update();
  panel.innerHTML = `<div class="dialogue-intro"><img class="dialogue-portrait" src="/assets/items/mira.png" alt="Mira, a small hooded keeper"><div><h2>A conversation with Mira</h2><p>Choices have consequences. Some doors open slowly.</p></div></div><div id="conversation" class="dialogue-card"></div><h3>THE STORY REMEMBERS</h3><div id="story-variables" class="dialogue-variables"></div><div class="pack-actions" id="story-actions"></div><details><summary class="kit-small-button">Edit the story JSON</summary><p>Change the words, conditions and branches. Applying a story validates every target and resets the conversation.</p><textarea id="story-json" class="kit-json" aria-label="Story JSON" spellcheck="false"></textarea><div class="pack-file-actions" id="story-editor-actions"></div></details>`;
  function refresh() {
    const target = $("#story-variables");
    target.replaceChildren();
    for (const [key, value] of Object.entries(conversation.variables)) {
      const pill = document.createElement("span");
      pill.className = "dialogue-variable";
      pill.textContent = `${key}: ${value}`;
      target.append(pill);
    }
    world.setCompleted(conversation.variables.knows_secret === true);
  }
  function start(snapshot) {
    view?.dispose();
    unsubscribe?.();
    conversation = snapshot
      ? Conversation.fromSnapshot(story, snapshot)
      : new Conversation(story);
    view = mountDialogue($("#conversation"), conversation, {
      onEnd: () =>
        toast("Conversation ended. Restart to explore another branch."),
    });
    unsubscribe = conversation.subscribe(refresh);
    refresh();
  }
  const savedInput = document.createElement("input");
  savedInput.type = "file";
  savedInput.accept = ".json,application/json";
  savedInput.hidden = true;
  panel.append(savedInput);
  savedInput.onchange = async () => {
    const f = savedInput.files[0];
    savedInput.value = "";
    if (!f) return;
    try {
      if (f.size > 100000) throw new Error("Use a save smaller than 100 KB.");
      const snapshot = JSON.parse(await f.text());
      const validated = Conversation.fromSnapshot(story, snapshot);
      start(validated.toSnapshot());
      toast("Conversation restored without repeating choice effects.");
    } catch (e) {
      toast(e.message);
    }
  };
  $("#story-actions").append(
    button("Restart conversation", () => start()),
    button("Save progress ↓", () =>
      download(conversation.toSnapshot(), "mira-progress.json"),
    ),
    button("Load progress", () => savedInput.click()),
  );
  $("#story-json").value = JSON.stringify(story, null, 2);
  $("#story-editor-actions").append(
    button("Apply story", () => {
      try {
        const value = $("#story-json").value;
        if (value.length > 1000000) throw new Error("Keep stories below 1 MB.");
        const next = validateStory(JSON.parse(value));
        new Conversation(next);
        story = next;
        start();
        toast("Story validated and applied.");
      } catch (e) {
        toast(e.message);
      }
    }),
    button("Export story ↓", () => download(story, "mira-story.json")),
  );
  $("#integration-title").textContent = "A voice for your next world.";
  $("#integration-description").textContent =
    "A validated dialogue graph with conditions, typed variables, one-time choices and save files. Use the headless runtime with your own UI, or mount the optional accessible dialogue box.";
  $("#kit-download").href = "/downloads/cranberry-forge-chatter-0.1.0.tgz";
  $("#kit-api").href = "/packages/chatter/README.md";
  $("#code-filename").textContent = "conversation.js";
  $("#kit-code").textContent =
    `import { Conversation } from '@cranberry-forge/chatter';
import { mountDialogue } from '@cranberry-forge/chatter/dom';

const talk = new Conversation(story);
const box = mountDialogue(panel, talk);

talk.subscribe(view => {
  npc.lookAt(camera.position);
  saveGame(talk.toSnapshot());
});

// On scene cleanup:
box.dispose();`;
  start();
  return {
    interact(interaction) {
      if (interaction.kind === "talk") {
        if (conversation.ended) start();
        else toast("Mira is listening. Choose a reply.");
      } else if (interaction.kind === "beacon")
        toast("Ask Mira about the beacon.");
      else toast("Some treasures are stories. Talk to Mira.");
    },
    dispose() {
      view?.dispose();
      unsubscribe?.();
    },
    guide: `<h2>Chatter / a small graph with a memory</h2><p>A story contains nodes, text, choices and scalar variables. Every target and variable reference is validated before a conversation begins. The runtime never evaluates code from story data.</p><pre>const talk = new Conversation(story);
talk.choose('help');
const currentLine = talk.view;
const saved = talk.toSnapshot();</pre><p>Use <code>when</code> conditions to gate a choice, <code>effects</code> to set or add a variable, and <code>once:true</code> for one-time decisions. Choices and entry effects commit together. Save files preserve the current line, visited nodes and used choices without re-running effects.</p><h3>Connect a Three.js character</h3><p>Open the dialogue after a raycast interaction. Disable movement while the box is open. The optional <code>mountDialogue</code> adapter uses native buttons, safe text insertion, keyboard focus and reduced-motion-aware typing. Its styles can be themed with CSS variables.</p><p><a href="/packages/chatter/README.md" target="_blank" rel="noopener">Full story schema, tutorial and API ↗</a></p>`,
  };
}
