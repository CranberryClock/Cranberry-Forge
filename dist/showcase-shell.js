// Presentation only: package APIs and scene colors remain independent.
(() => {
  const picker = document.querySelector(".forge-picker");
  if (!picker) return;
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
  const resize = () => {
    const shell = document.querySelector("#world, #game-shell");
    if (!shell) return;
    const top = document
      .querySelector(".forge-explorer")
      .getBoundingClientRect().bottom;
    document.body.style.setProperty("--forge-shell-offset", `${top}px`);
  };
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(resize).observe(document.body);
  addEventListener("resize", resize);
  resize();
})();
