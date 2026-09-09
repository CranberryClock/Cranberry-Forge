import { Inventory } from "@cranberry-forge/satchel";
import { CAMP_ITEMS, CAMP_RECIPES } from "../camp-scene.js";
import {
  $,
  toast,
  download,
  button,
  renderGrid,
  describeFailure,
} from "../kit-ui.js";

export function mountKit({ world, panel }) {
  let bag,
    stash,
    active = "bag",
    selected = null;
  const collected = new Set();
  const reset = () => {
    bag = new Inventory({
      catalog: CAMP_ITEMS,
      columns: 6,
      rows: 4,
      maxWeight: 16,
    });
    stash = new Inventory({
      catalog: CAMP_ITEMS,
      columns: 6,
      rows: 4,
      maxWeight: 40,
    });
    bag.add("copper", 5);
    bag.add("blade");
    bag.add("herb", 3);
    stash.add("glass", 3);
    stash.add("copper", 4);
    stash.add("potion", 2);
    selected = null;
    collected.clear();
    world.setCollected([]);
    world.setCompleted(false);
  };
  reset();
  const inventory = () => (active === "bag" ? bag : stash);
  panel.innerHTML = `<h2>The courier's pack</h2><p>Loot the camp, make room, craft a little light.</p><div class="pack-tabs"><button data-pack="bag">Field pack</button><button data-pack="stash">Camp stash</button></div><div class="pack-meter"><span id="pack-count"></span><span id="pack-weight-text"></span></div><div class="pack-weight"><span id="pack-weight-fill"></span></div><div id="pack-grid"></div><div id="pack-detail" class="pack-detail"></div><div id="pack-actions" class="pack-actions"></div><h3>AT THE WORKTABLE</h3><div id="pack-recipes"></div><div class="pack-file-actions" id="pack-files"></div><p>Drag items, or select one and click an empty cell. Rotation and transfers never destroy items when they fail.</p>`;
  const act = (result) => {
    if (!result.ok) toast(describeFailure(result.reason));
    render();
  };
  function render() {
    const inv = inventory();
    panel.querySelectorAll("[data-pack]").forEach((b) => {
      b.classList.toggle("active", b.dataset.pack === active);
      b.setAttribute("aria-pressed", b.dataset.pack === active);
      b.onclick = () => {
        active = b.dataset.pack;
        selected = null;
        render();
      };
    });
    $("#pack-count").textContent =
      `${inv.items.length} stacks · ${inv.columns} × ${inv.rows} cells`;
    $("#pack-weight-text").textContent =
      `${inv.weight.toFixed(1)} / ${inv.maxWeight} kg`;
    $("#pack-weight-fill").style.width =
      `${(inv.weight / inv.maxWeight) * 100}%`;
    if (!inv.items.some((i) => i.id === selected)) selected = null;
    renderGrid($("#pack-grid"), inv, {
      items: CAMP_ITEMS,
      selected,
      onSelect: (id) => {
        selected = id;
        render();
      },
      onChange: act,
    });
    const detail = $("#pack-detail"),
      actions = $("#pack-actions");
    detail.replaceChildren();
    actions.replaceChildren();
    const entry = inv.items.find((i) => i.id === selected);
    if (entry) {
      const data = CAMP_ITEMS.find((d) => d.id === entry.itemId),
        img = document.createElement("img");
      img.src = `/assets/items/${data.id}.png`;
      img.alt = "";
      detail.append(img);
      const copy = document.createElement("div"),
        name = document.createElement("strong"),
        desc = document.createElement("p");
      name.textContent = data.name;
      desc.textContent = data.description;
      copy.append(name, desc);
      detail.append(copy);
      actions.append(
        button("Rotate", () => act(inv.rotate(selected))),
        button(
          "Split half",
          () => act(inv.split(selected, Math.floor(entry.quantity / 2))),
          { disabled: entry.quantity < 2 },
        ),
        button(active === "bag" ? "To stash →" : "To pack →", () =>
          act(inv.transfer(selected, active === "bag" ? stash : bag)),
        ),
        button("Drop one", () => act(inv.remove(selected, 1))),
      );
      const other = inv.items.find(
        (i) => i.id !== selected && i.itemId === entry.itemId,
      );
      if (other)
        actions.append(
          button("Merge stacks", () => act(inv.merge(selected, other.id))),
        );
    } else {
      const p = document.createElement("p");
      p.textContent =
        "Select an item to inspect, rotate, split or transfer it.";
      detail.append(p);
    }
    const recipes = $("#pack-recipes");
    recipes.replaceChildren();
    for (const recipe of CAMP_RECIPES) {
      const b = button(
          "",
          () => {
            const result = bag.craft(recipe);
            if (result.ok) {
              active = "bag";
              toast(`${recipe.name}: ready to carry.`);
            }
            act(result);
          },
          { disabled: !bag.canCraft(recipe).ok, className: "recipe-button" },
        ),
        label = document.createElement("span"),
        title = document.createElement("span"),
        cost = document.createElement("small");
      title.textContent = recipe.name;
      cost.textContent = recipe.ingredients
        .map(
          (i) =>
            `${i.quantity} ${CAMP_ITEMS.find((d) => d.id === i.itemId).name}`,
        )
        .join(" · ");
      label.append(title, cost);
      const arrow = document.createElement("span");
      arrow.textContent = "＋";
      b.append(label, arrow);
      recipes.append(b);
    }
  }
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".json,application/json";
  file.hidden = true;
  panel.append(file);
  file.onchange = async () => {
    const picked = file.files[0];
    file.value = "";
    if (!picked) return;
    try {
      if (picked.size > 100000)
        throw new Error("Choose a pack smaller than 100 KB.");
      const next = Inventory.fromSnapshot(await picked.text(), {
        catalog: CAMP_ITEMS,
      });
      if (next.columns !== 6 || next.rows !== 4 || next.maxWeight !== 16)
        throw new Error(
          "This workbench loads 6 × 4 packs with a 16 kg limit. Other sizes work in the package API.",
        );
      bag = next;
      active = "bag";
      selected = null;
      render();
      toast("Field pack loaded. Camp loot and stash stay as they are.");
    } catch (e) {
      toast(e.message);
    }
  };
  $("#pack-files").append(
    button("Save pack ↓", () =>
      download(bag.toSnapshot(), "satchel-pack.json"),
    ),
    button("Load pack", () => file.click()),
    button("Reset camp", () => {
      reset();
      render();
      toast("Camp reset.");
    }),
  );
  $("#integration-description").textContent =
    "A data-only inventory you can connect to any Three.js scene. Stacks, grid placement, weight limits and crafting use atomic operations, so a failed action leaves the inventory intact.";
  $("#kit-download").href = "/downloads/cranberry-forge-satchel-0.1.0.tgz";
  $("#kit-api").href = "/packages/satchel/README.md";
  $("#kit-code").textContent =
    `import { Inventory } from '@cranberry-forge/satchel';

const pack = new Inventory({ catalog,
  columns: 6, rows: 4, maxWeight: 16 });

// In your Three.js pickup handler:
const result = pack.add('copper', 3);
if (result.ok) pickup.removeFromParent();

pack.craft(lanternRecipe);
saveGame(pack.toSnapshot());`;
  render();
  return {
    interact(interaction, object) {
      if (interaction.kind === "pickup") {
        if (collected.has(interaction.id)) return;
        const itemId = object.userData.itemId,
          result = bag.add(itemId, 1);
        if (result.ok) {
          collected.add(interaction.id);
          world.setCollected(collected);
          world.select(interaction.id);
          active = "bag";
          toast(`${CAMP_ITEMS.find((d) => d.id === itemId).name} added.`);
        }
        act(result);
      } else if (interaction.kind === "talk") {
        active = active === "bag" ? "stash" : "bag";
        selected = null;
        render();
        toast("Mira keeps your camp stash safe.");
      } else {
        if (bag.count("lantern")) {
          world.setCompleted(true);
          toast("A light worth carrying. Try the full Mothlight template.");
        } else toast("Craft a lantern at the worktable.");
      }
    },
    guide: `<h2>Satchel / from pickup to inventory</h2><p>Define items once, create a grid and add loot from your interaction handler. All normal gameplay failures return <code>{ok:false,reason}</code>; bad API inputs throw.</p><pre>const result = pack.add('copper', 1);
if (result.ok) worldPickup.removeFromParent();</pre><p>Only remove the Three.js object after the inventory confirms success. <code>move</code>, <code>rotate</code>, <code>split</code> and <code>merge</code> operate on stack IDs. <code>transfer</code> changes both inventories together. <code>craft</code> plans all ingredients and outputs before committing.</p><h3>Save and restore</h3><pre>const json = pack.toSnapshot();
const restored = Inventory.fromSnapshot(json, { catalog });</pre><p>Save files contain item IDs and layout, not item definitions. Supply the same catalog when loading. A snapshot with overlapping cells, too much weight or invalid quantities is rejected.</p><p><a href="/packages/satchel/README.md" target="_blank" rel="noopener">Full tutorial, methods and limits ↗</a></p>`,
  };
}
