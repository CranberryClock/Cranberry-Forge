(() => {
  const picker = document.querySelector(".forge-picker");
  if (!picker) return;
  const products = JSON.parse(
    document.querySelector("#forge-product-data")?.textContent || "{}",
  );
  const update = () => {
    let id = document.body.dataset.forgeTool;
    if (
      /\/index.html$|\/$/.test(location.pathname) &&
      ["biome", "flux"].includes(id)
    )
      id = location.hash === "#flux" ? "flux" : "biome";
    if (location.pathname.endsWith("/play.html"))
      id =
        new URLSearchParams(location.search).get("kit") === "chatter"
          ? "chatter"
          : "satchel";
    document.body.dataset.forgeTool = id;
    for (const link of picker.querySelectorAll("[data-forge-link]")) {
      if (link.dataset.forgeLink === id) {
        link.setAttribute("aria-current", "page");
        picker.querySelector("[data-forge-current]").textContent =
          link.querySelector("strong").textContent;
      } else link.removeAttribute("aria-current");
    }
    const p = products[id];
    if (!p) return;
    for (const key of [
      "name",
      "title",
      "pitch",
      "category",
      "kind",
      "version",
      "use",
      "command",
    ])
      for (const el of document.querySelectorAll(`[data-product-${key}]`))
        el.textContent = p[key];
    for (const key of ["download", "docs", "guide"])
      for (const el of document.querySelectorAll(`[data-product-${key}]`))
        el.href = p[key];
    for (const img of document.querySelectorAll("[data-product-mark]")) {
      img.src = p.mark;
      img.alt = `${p.studio} — ${p.name} showcase identity`;
    }
    document.title = `${p.name} — Cranberry Forge`;
  };
  update();
  addEventListener("hashchange", update);
  document.addEventListener("click", (event) => {
    if (!picker.contains(event.target) || event.target.closest("a"))
      picker.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && picker.open) {
      picker.open = false;
      picker.querySelector("summary").focus();
    }
  });
})();
