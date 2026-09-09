import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { systems } from "./showcase-catalog.mjs";
import { JSDOM } from "jsdom";

// Generate static, keyboard-accessible navigation before packing the templates.
const pages = new Map(
  systems.map(([id, , , url]) => [url.split(/[?#]/)[0], id]),
);
pages.set("index.html", "biome");
pages.set("play.html", "satchel");
pages.set("catalog.html", "collection");
for (const id of ["biome", "flux", "signal"])
  pages.set(`examples/${id}.html`, id);
for (let [path, id] of pages) {
  const portable = path.startsWith("templates/");
  if (path.endsWith("/")) path += "index.html";
  const prefix = portable
    ? "https://cranberryclock.com/forge/showcase/"
    : path.startsWith("examples/")
      ? "../"
      : "./";
  const assets = portable
    ? "./lib/"
    : path.startsWith("examples/")
      ? "../"
      : "./";
  const choices = systems
    .map(
      ([key, name, description, url, color], index) =>
        `<a href="${prefix}${url}" data-forge-link="${key}" style="--swatch:${color}"${key === id ? ' aria-current="page"' : ""}><span class="forge-dot" aria-hidden="true"></span><span><strong>${name}</strong><small>${description}</small></span><span class="forge-number">${String(index + 1).padStart(2, "0")}</span></a>`,
    )
    .join("\n");
  const title = systems.find((s) => s[0] === id)?.[1] || "The collection";
  const shell = `<!-- forge-shell:start -->
<nav class="forge-explorer" aria-label="Cranberry Forge collection">
  <a class="forge-home" href="${prefix}catalog.html">ALL SHOWCASES <span>15 tools · 2 games</span></a>
  <details class="forge-picker"><summary><span data-forge-current>${title}</span><span class="forge-switch-label">Explore every system</span><span aria-hidden="true">⌄</span></summary>
    <div class="forge-menu"><div class="forge-menu-heading">ONE COLLECTION. MANY POSSIBILITIES.</div><div class="forge-options">${choices}</div></div>
  </details>
</nav>
<!-- forge-shell:end -->`;
  let html = await readFile(`dist/${path}`, "utf8");
  // The collection switcher owns system navigation. Headers retain identity
  // and resource actions, without the original release-specific tab groups.
  html = html.replace(/<header\b[\s\S]*?<\/header>/g, (markup) => {
    const dom = new JSDOM(markup);
    const header = dom.window.document.querySelector("header");
    for (const nav of header.querySelectorAll("nav")) {
      const resources = [...nav.querySelectorAll("a")].filter((link) =>
        /\/(packages|downloads)\//.test(link.getAttribute("href")),
      );
      if (resources.length) {
        nav.replaceChildren(...resources);
        nav.setAttribute("aria-label", "Showcase resources");
      } else nav.remove();
    }
    for (const link of header.querySelectorAll("a")) {
      if (/^(All tools|Game kits)/i.test(link.textContent.trim())) link.remove();
    }
    const result = header.outerHTML;
    dom.window.close();
    return result.replace(/[\t ]+$/gm, "");
  });
  html = html.replace(/<nav class="collection-nav"[\s\S]*?<\/nav>/g, "");
  html = html
    .replace(
      /\s*<!-- forge-shell:start -->[\s\S]*?<!-- forge-shell:end -->\s*/g,
      "",
    )
    .replace(/\s*<link[^>]*data-forge-shell[^>]*>/g, "")
    .replace(/\s*<script[^>]*data-forge-shell[^>]*><\/script>/g, "")
    .replace(/ data-forge-tool="[^"]*"/g, "");
  html = html
    .replace(
      "</head>",
      `<link data-forge-shell rel="stylesheet" href="${assets}showcase-shell.css" />\n<script data-forge-shell src="${assets}showcase-shell.js" defer></script>\n</head>`,
    )
    .replace(/<body([^>]*)>/, `<body$1 data-forge-tool="${id}">`);
  html = html.includes("</header>")
    ? html.replace("</header>", `</header>\n${shell}`)
    : html.replace(/<body[^>]*>/, `$&\n${shell}`);
  await writeFile(`dist/${path}`, html);
  if (portable) {
    const dir = `dist/${path.slice(0, -"index.html".length)}lib`;
    await mkdir(dir, { recursive: true });
    for (const file of ["showcase-shell.css", "showcase-shell.js"])
      await copyFile(`dist/${file}`, `${dir}/${file}`);
  }
}
console.log("Updated collection navigation for all 17 showcases.");
