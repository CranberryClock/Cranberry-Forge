export const $ = (selector) => document.querySelector(selector);
let toastTimer;
export function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
export function download(data, name, type = "application/json") {
  const blob =
      data instanceof Blob
        ? data
        : new Blob(
            [typeof data === "string" ? data : JSON.stringify(data, null, 2)],
            { type },
          ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function button(
  label,
  onClick,
  { disabled = false, className = "kit-small-button" } = {},
) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  b.disabled = disabled;
  b.onclick = onClick;
  return b;
}
export function describeFailure(reason) {
  return (
    {
      "no-space": "No room left. Move or rotate items to free some cells.",
      "weight-limit": "That would exceed the weight limit.",
      blocked: "That space is occupied or outside the pack.",
      "missing-items": "You need more ingredients.",
      "invalid-split": "A split must leave something in the original stack.",
      "stack-full": "That stack is already full.",
      "not-found": "Select an item first.",
    }[reason] ?? reason
  );
}
export function renderGrid(
  container,
  inventory,
  { items, selected, onSelect, onChange, assetBase = "/assets/items/" } = {},
) {
  container.replaceChildren();
  container.className = "inventory-grid";
  container.style.aspectRatio = `${inventory.columns}/${inventory.rows}`;
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Inventory grid");
  const place = (element, x, y, w = 1, h = 1) => {
    Object.assign(element.style, {
      left: `${(x / inventory.columns) * 100}%`,
      top: `${(y / inventory.rows) * 100}%`,
      width: `${(w / inventory.columns) * 100}%`,
      height: `${(h / inventory.rows) * 100}%`,
    });
  };
  for (let y = 0; y < inventory.rows; y++)
    for (let x = 0; x < inventory.columns; x++) {
      const cell = button(
        "",
        () => {
          if (!selected) return;
          const result = inventory.move(selected, x, y);
          onChange?.(result);
        },
        { className: "inventory-cell" },
      );
      cell.setAttribute(
        "aria-label",
        `Move selected item to column ${x + 1}, row ${y + 1}`,
      );
      place(cell, x, y);
      container.append(cell);
    }
  for (const stack of inventory.items) {
    const data = items.find((i) => i.id === stack.itemId),
      size = inventory.dimensions(stack);
    const entry = button("", () => onSelect?.(stack.id), {
      className: `inventory-item${stack.id === selected ? " selected" : ""}`,
    });
    entry.setAttribute(
      "aria-label",
      `${data.name}, ${stack.quantity}. ${size.width} by ${size.height} cells.`,
    );
    entry.style.setProperty("--item-color", data.color);
    entry.draggable = true;
    entry.ondragstart = (e) => {
      e.dataTransfer.setData("text/plain", stack.id);
      e.dataTransfer.effectAllowed = "move";
    };
    place(entry, stack.x, stack.y, size.width, size.height);
    const img = document.createElement("img");
    img.src = `${assetBase}${data.id}.png`;
    img.alt = "";
    img.draggable = false;
    entry.append(img);
    const count = document.createElement("span");
    count.className = "item-quantity";
    count.textContent = stack.quantity;
    entry.append(count);
    container.append(entry);
  }
  container.ondragover = (e) => e.preventDefault();
  container.ondrop = (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!inventory.items.some((i) => i.id === id)) return;
    const r = container.getBoundingClientRect(),
      x = Math.min(
        inventory.columns - 1,
        Math.max(
          0,
          Math.floor(((e.clientX - r.left) / r.width) * inventory.columns),
        ),
      ),
      y = Math.min(
        inventory.rows - 1,
        Math.max(
          0,
          Math.floor(((e.clientY - r.top) / r.height) * inventory.rows),
        ),
      );
    onChange?.(inventory.move(id, x, y));
  };
}
