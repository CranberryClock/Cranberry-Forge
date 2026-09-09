import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { systems } from "./showcase-catalog.mjs";
import { products } from "./product-copy.mjs";
import { JSDOM } from "jsdom";
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const pages = new Map(
  systems.map(([id, , , url]) => [url.split(/[?#]/)[0], id]),
);
pages.set("index.html", "biome");
pages.set("play.html", "satchel");
pages.set("catalog.html", "collection");
for (const id of ["biome", "flux", "signal"])
  pages.set(`examples/${id}.html`, id);
await mkdir("dist/assets/identities", { recursive: true });
for (const [id, name, category, , color] of systems) {
  const p = products[id];
  const words = p.studio.split(" "),
    halfway = Math.ceil(words.length / 2),
    lines =
      words.length > 2
        ? [words.slice(0, halfway).join(" "), words.slice(halfway).join(" ")]
        : [p.studio];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g fill="none" stroke="${color}"><circle cx="120" cy="120" r="110" opacity=".2"/><circle cx="120" cy="120" r="100" opacity=".5"/><g transform="translate(88 43)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${p.glyph}"/></g></g><g fill="${color}" text-anchor="middle" font-family="monospace" letter-spacing="2">${lines.map((line, i) => `<text x="120" y="${130 + i * 18}" font-size="12">${escape(line)}</text>`).join("")}<text x="120" y="179" font-size="8" opacity=".7">${name.toUpperCase()} / CRANBERRY FORGE</text></g></svg>`;
  await writeFile(`dist/assets/identities/${id}.svg`, svg);
}
await writeFile(
  "dist/product-themes.json",
  JSON.stringify(
    Object.fromEntries(systems.map(([id, , , , color]) => [id, color])),
    null,
    2,
  ) + "\n",
);
for (let [path, id] of pages) {
  const portable = path.startsWith("templates/");
  if (path.endsWith("/")) path += "index.html";
  const prefix = portable
    ? "https://cranberryclock.com/forge/showcase/"
    : path.startsWith("examples/")
      ? "../"
      : "./";
  const assets = portable ? "./lib/" : prefix;
  let html = await readFile(`dist/${path}`, "utf8");
  html = html.replace(
    /\s*<!-- forge-shell:start -->[\s\S]*?<!-- forge-shell:end -->\s*/g,
    "",
  );
  const dom = new JSDOM(html),
    doc = dom.window.document,
    body = doc.body,
    main = doc.querySelector("main");
  // Keep controls with live bindings, even when the authored marketing wrapper changes.
  const controls = ["open-docs", "kit-guide"]
    .map((key) => doc.getElementById(key))
    .filter(Boolean);
  const counters = ["completion", "receipts"]
    .map((key) => doc.getElementById(key)?.parentElement)
    .filter(Boolean);
  const deliveries = doc.getElementById("deliveries");
  if (deliveries) counters.push(deliveries);
  for (const e of [
    ...doc.querySelectorAll(
      "[data-forge-shell],#forge-product-data,.forge-product-hero,.forge-use-product,.forge-runtime-metrics,.forge-site-header,.forge-site-footer,.forge-explorer",
    ),
  ])
    e.remove();
  for (const e of [...body.querySelectorAll(":scope > header, footer")])
    e.remove();
  for (const e of doc.querySelectorAll(
    ".workspace-heading,.kit-heading,.latch-heading,.loom-heading,.pc-intro,.tempo-heading,.tm-intro,.wf-intro,main > .intro,main > .heading",
  ))
    e.remove();
  body.dataset.forgeTool = id;
  if (id === 'collection') {
    const jump = doc.querySelector('.collection-jump');
    if (jump) jump.innerHTML = '<a href="#afterglow">Play the templates ↓</a><a href="#tools">Explore all 15 tools ↓</a>';
    for (const tag of doc.querySelectorAll('.image-tag')) tag.textContent = tag.textContent.replace(/^NEW\s*\/\s*/, '');
  }
  if (portable) body.classList.add("forge-portable");
  if (main && !main.id) main.id = "main-content";
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = "#101817";
  for (const icon of doc.querySelectorAll('link[rel="icon"]')) icon.remove();
  const favicon = doc.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/svg+xml";
  favicon.href = assets + "assets/branding/forge-mark.svg";
  doc.head.append(favicon);
  // Retain Afterglow's in-game toolbar. It is gameplay UI, not site navigation.
  const choices = systems
    .map(
      ([key, name, description, url, color], index) =>
        `<a href="${prefix}${url}" data-forge-link="${key}" style="--swatch:${color}"${key === id ? ' aria-current="page"' : ""}><span class="forge-dot" aria-hidden="true"></span><span><strong>${name}</strong><small>${description}</small></span><span class="forge-number">${String(index + 1).padStart(2, "0")}</span></a>`,
    )
    .join("");
  const header = `<header class="forge-site-header"><a class="forge-source-brand" href="${prefix}catalog.html"><img src="${assets}assets/branding/forge-mark.svg" width="38" height="38" alt=""/><span>CRANBERRY <b>FORGE</b></span></a><nav aria-label="Site navigation"><a href="https://cranberryclock.com/">CranberryClock</a><a href="https://github.com/CranberryClock/Cranberry-Forge">Source on GitHub ↗</a></nav></header>`;
  const nav = `<nav class="forge-explorer" aria-label="Cranberry Forge collection"><a class="forge-home" href="${prefix}catalog.html"><img src="${assets}assets/branding/forge-mark.svg" width="26" height="26" alt=""/>FORGE <span>15 tools · 2 games</span></a><details class="forge-picker"><summary><span data-forge-current>${id === "collection" ? "The collection" : systems.find((s) => s[0] === id)[1]}</span><span class="forge-switch-label">Explore every system</span><span aria-hidden="true">⌄</span></summary><div class="forge-menu"><div class="forge-menu-heading">ONE COLLECTION. MANY POSSIBILITIES.</div><div class="forge-options">${choices}</div></div></details></nav>`;
  body.insertAdjacentHTML("afterbegin", header + nav);
  if (id !== "collection" && !path.startsWith("examples/")) {
    const applicable = ["biome", "flux"].includes(id)
      ? ["biome", "flux"]
      : ["satchel", "chatter"].includes(id)
        ? ["satchel", "chatter"]
        : [id];
    const records = {};
    for (const key of applicable) {
      const [, name, category] = systems.find((s) => s[0] === key),
        p = products[key];
      let pkg = { version: "0.1.0" };
      if (!portable)
        pkg = JSON.parse(
          await readFile(`dist/packages/${key}/package.json`, "utf8"),
        );
      const file = portable
        ? `${key}-template-${pkg.version}.tgz`
        : `cranberry-forge-${key}-${pkg.version}.tgz`;
      records[key] = {
        ...p,
        name,
        category,
        version: pkg.version,
        mark: `${assets}assets/identities/${key}.svg`,
        download: `${prefix}downloads/${file}`,
        docs: portable
          ? `${prefix}templates/${key}/README.md`
          : `${prefix}packages/${key}/README.md`,
        command: portable
          ? "Extract the archive and serve the folder."
          : `npm install ./${file}${pkg.peerDependencies?.three ? " three@0.180.0" : ""}`,
        kind: portable ? "PLAYABLE TEMPLATE" : "INDEPENDENT TOOL",
      };
    }
    const p = records[id];
    const hero = `<section class="forge-product-hero" aria-labelledby="forge-product-name"><div class="forge-product-copy"><p class="forge-product-eyebrow"><span data-product-kind>${p.kind}</span><span aria-hidden="true">/</span><span data-product-category>${escape(p.category)}</span></p><h1 id="forge-product-name" data-product-name>${p.name}</h1><p class="forge-product-tagline" data-product-title>${escape(p.title)}</p><p class="forge-product-pitch" data-product-pitch>${escape(p.pitch)}</p><div class="forge-product-actions"><a class="forge-action-primary" href="#forge-demo">${portable ? "Play the game" : "Try the system"} ↓</a><a data-product-download href="${p.download}" download>Download ${portable ? "template" : "package"} ↗</a><a data-product-docs href="${p.docs}">Documentation ↗</a></div><div class="forge-product-facts"><span>MIT LICENSE</span><span>v<span data-product-version>${p.version}</span></span><span>${portable ? "SELF-CONTAINED" : "MODULAR BY DESIGN"}</span></div></div><div class="forge-product-emblem"><img data-product-mark src="${p.mark}" width="240" height="240" alt="${p.studio} — ${p.name} showcase identity"/></div></section>`;
    if (portable) main.insertAdjacentHTML("beforebegin", hero);
    else main.insertAdjacentHTML("afterbegin", hero);
    const heroNode = doc.querySelector(".forge-product-hero");
    for (const control of controls) {
      control.className = "forge-guide-control";
      heroNode.querySelector(".forge-product-actions").append(control);
    }
    const demo = portable ? main : heroNode.nextElementSibling;
    if (demo) {
      demo.dataset.forgeDemo = "";
      if (!demo.id) demo.id = "forge-demo";
      else
        heroNode
          .querySelector(".forge-action-primary")
          .setAttribute("href", `#${demo.id}`);
    }
    if (counters.length) {
      const box = doc.createElement("div");
      box.className = "forge-runtime-metrics";
      box.append(...counters);
      (portable ? main : demo).insertAdjacentElement("afterend", box);
    }
    const use = `<section class="forge-use-product"><div><p class="forge-product-eyebrow">FROM SHOWCASE TO YOUR PROJECT</p><h2>Take the good parts with you.</h2><p data-product-use>${escape(p.use)}</p></div><div class="forge-install"><p>${portable ? "A complete starting point" : "Download the archive, then install locally."}</p><code data-product-command>${escape(p.command)}</code><div><a data-product-download href="${p.download}" download>Download ${portable ? "template" : "archive"} ↓</a><a data-product-docs href="${p.docs}">Read the integration guide ↗</a></div></div></section>`;
    if (portable) main.insertAdjacentHTML("afterend", use);
    else main.insertAdjacentHTML("beforeend", use);
    const data = doc.createElement("script");
    data.type = "application/json";
    data.id = "forge-product-data";
    data.textContent = JSON.stringify(records).replaceAll("<", "\\u003c");
    body.append(data);
  }
  body.insertAdjacentHTML(
    "beforeend",
    `<footer class="forge-site-footer"><a class="forge-source-brand" href="${prefix}catalog.html"><img src="${assets}assets/branding/forge-mark.svg" width="36" height="36" alt=""/><span>CRANBERRY <b>FORGE</b><small>SMALL SYSTEMS. PLAYABLE POSSIBILITIES.</small></span></a><p>Designed by CranberryClock.<br/>Independent tools. Shared with care.</p><nav aria-label="Footer navigation"><a href="${prefix}catalog.html">Explore the collection</a><a href="https://github.com/CranberryClock/Cranberry-Forge">GitHub ↗</a><a href="https://cranberryclock.com/about/">The story behind Forge ↗</a></nav></footer>`,
  );
  for (const [tag, attrs] of [
    ["link", { rel: "stylesheet", href: assets + "showcase-shell.css" }],
    ["script", { src: assets + "showcase-shell.js", defer: "" }],
  ]) {
    const e = doc.createElement(tag);
    e.dataset.forgeShell = "";
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    doc.head.append(e);
  }
  await writeFile(
    `dist/${path}`,
    dom.serialize().replace(/[\t ]+$/gm, "") + "\n",
  );
  dom.window.close();
  if (portable) {
    const dir = `dist/${path.slice(0, -"index.html".length)}lib`;
    await mkdir(`${dir}/assets/identities`, { recursive: true });
    await writeFile(
      `${dir}/showcase-shell.css`,
      (await readFile("dist/showcase-shell.css", "utf8")).replaceAll(
        "./vendor/",
        "../vendor/",
      ),
    );
    await copyFile("dist/showcase-shell.js", `${dir}/showcase-shell.js`);
    for (const key of ["mothlight", "afterglow"])
      await copyFile(
        `dist/assets/identities/${key}.svg`,
        `${dir}/assets/identities/${key}.svg`,
      );
  }
}
console.log(
  "Prepared cohesive product identities, navigation and footers for the full Forge collection.",
);
