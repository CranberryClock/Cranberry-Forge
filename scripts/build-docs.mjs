import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { posix } from "node:path";
import { marked } from "marked";
import hljs from "highlight.js";
import { JSDOM } from "jsdom";
import { systems } from "./showcase-catalog.mjs";
import { products } from "./product-copy.mjs";

const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
const labels = {
  overview: "Overview",
  guide: "Integration guide",
  api: "API reference",
  tutorial: "Tutorial",
};
const plans = {
  biome: { guide: ["Install", "Workbench exports"], api: ["API", "Limits"] },
  flux: {
    guide: ["Install", "Visual integration"],
    api: ["API", "Performance and limits"],
  },
  signal: {
    guide: ["Install"],
    api: ["Options", "Limits and visual tradeoffs"],
  },
  latch: {
    guide: ["Install", "Selection and timing contract", "Ownership and limits"],
    api: ["API"],
  },
  loom: {
    guide: ["Install", "Geometry, frames, and limitations"],
    api: ["API"],
  },
  satchel: {
    guide: ["Install", "Saves and UI integration"],
    api: ["Item definitions", "Inventory and actions", "Boundaries"],
  },
  chatter: {
    guide: ["Install", "Save and resume", "Optional dialogue box"],
    api: ["Story schema", "Runtime API"],
  },
  keepsake: { guide: ["Install", "Example"], api: ["API", "Ownership"] },
  ledger: { guide: ["Install", "Example"], api: ["API", "Boundaries"] },
  sift: { guide: ["Install"], api: ["Core API", "Local files", "CLI"] },
  tempo: { guide: ["Install"], api: ["The recharge policy", "API"] },
  parcel: {
    guide: ["Install", "The policy, exactly", "Deterministic and atomic"],
  },
  spring: {
    guide: [
      "Install",
      "What the two controls mean",
      "Guarantees and boundaries",
      "Optional local HTTP endpoint",
    ],
  },
  trailmark: {
    guide: [
      "Install",
      "Contract",
      "Bounded duplicate protection",
      "Saves and validation",
      "Practical limits",
    ],
  },
  wayfinder: {
    guide: [
      "Install",
      "The navigation contract",
      "Edit terrain and replan",
      "World coordinates",
      "Saves",
      "Practical limits",
    ],
  },
  afterglow: {
    guide: [
      "Run the download",
      "How the template is divided",
      "Controller tutorial",
      "Put the scene in an existing Three.js stage",
      "Customize an encounter",
    ],
  },
  mothlight: {
    guide: [
      "Play or run your own copy",
      "Controls and game loop",
      "What to customize",
    ],
  },
};
const entries = [];
const sourceLinks = new Map();
const sourceAnchors = new Map();
const outFile = (id, section) =>
  `docs/${id}/${section === "overview" ? "" : section + "/"}index.html`;

// Parse Markdown tokens rather than splitting lines: shell comments inside fenced
// examples can begin with # and must remain part of the original example.
for (const [id, name, category, demo, accent] of systems) {
  const template = demo.startsWith("templates/");
  const source = `${template ? "templates" : "packages"}/${id}/README.md`;
  const tokens = marked.lexer(await readFile(`dist/${source}`, "utf8"));
  const groups = [{ title: "", tokens: [] }];
  for (const token of tokens) {
    if (token.type === "heading" && token.depth === 1) continue;
    if (token.type === "heading" && token.depth === 2)
      groups.push({ title: token.text, tokens: [] });
    groups.at(-1).tokens.push(token);
  }
  const pages = new Map([
    ["overview", []],
    ["guide", []],
  ]);
  if (!template) pages.set("api", []);
  const plan = plans[id] || { guide: ["Install"] };
  for (const group of groups) {
    const section = /^Tutorial:/.test(group.title)
      ? "tutorial"
      : Object.entries(plan).find(([, titles]) =>
          titles.includes(group.title),
        )?.[0] || "overview";
    if (!pages.has(section)) pages.set(section, []);
    pages.get(section).push({ source, tokens: group.tokens });
  }
  for (const [section, filename] of [
    ["api", "API.md"],
    ["tutorial", "TUTORIAL.md"],
  ]) {
    const file = posix.join(posix.dirname(source), filename);
    let markdown;
    try {
      markdown = await readFile(`dist/${file}`, "utf8");
    } catch (err) {
      if (err.code === "ENOENT") continue;
      throw err;
    }
    pages.set(section, [
      {
        source: file,
        tokens: marked
          .lexer(markdown)
          .filter((t) => !(t.type === "heading" && t.depth === 1)),
      },
    ]);
    sourceLinks.set(file, outFile(id, section));
  }
  // Page order stays predictable across the collection.
  const ordered = ["overview", "guide", "api", "tutorial"].filter((key) =>
    pages.has(key),
  );
  for (const key of ordered)
    if (
      !pages
        .get(key)
        .some((chunk) => chunk.tokens.some((t) => t.type !== "space"))
    ) {
      throw new Error(
        `${id}: ${key} needs a documented source section before publication.`,
      );
    }
  sourceLinks.set(source, outFile(id, "overview"));
  for (const key of ordered) {
    const seen = new Map();
    for (const chunk of pages.get(key))
      for (const token of chunk.tokens) {
        if (token.type !== "heading") continue;
        const base = slug(token.text),
          n = seen.get(base) || 0;
        seen.set(base, n + 1);
        token.docsId = base + (n ? `-${n}` : "");
        sourceAnchors.set(
          `${chunk.source}#${token.docsId}`,
          `${outFile(id, key)}#${token.docsId}`,
        );
      }
  }
  entries.push({
    id,
    name,
    category,
    demo,
    accent,
    template,
    source,
    pages,
    ordered,
  });
}

function relative(from, to) {
  const [file, hash] = to.split("#");
  return (
    (posix.relative(posix.dirname(from), file) || posix.basename(file)) +
    (hash ? "#" + hash : "")
  );
}
function resolveLink(href, source, page) {
  if (
    href ===
    "https://github.com/CranberryClock/Cranberry-Forge/blob/main/docs/HTTP_API.md"
  )
    return relative(page, "docs/http/index.html");
  if (source === "../docs/HTTP_API.md")
    href = href.replace(/^\.\.\/dist\//, "/");
  if (/^(https?:|mailto:|tel:|data:)/i.test(href)) {
    const github = href.match(
      /^https:\/\/github\.com\/CranberryClock\/Cranberry-Forge\/(?:blob|tree)\/main\/dist\/(.*)$/,
    );
    if (!github) return href;
    href = "/" + github[1];
  }
  if (/^(javascript|vbscript):/i.test(href)) return "#";
  const url = new URL(href, `https://docs.local/${source}`);
  const target = decodeURIComponent(url.pathname.slice(1));
  const fragment = decodeURIComponent(url.hash);
  const mapped =
    sourceAnchors.get(target + fragment) || sourceLinks.get(target);
  if (mapped)
    return relative(page, mapped) + (!mapped.includes("#") ? fragment : "");
  return relative(page, target) + url.search + url.hash;
}
function renderChunk(chunk, page) {
  const renderer = new marked.Renderer();
  renderer.heading = function (token) {
    return `<h${token.depth} id="${esc(token.docsId || slug(token.text))}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
  };
  renderer.code = ({ text, lang }) => {
    let language = (lang || "text").split(/\s/)[0];
    language =
      {
        js: "javascript",
        ts: "typescript",
        sh: "bash",
        shell: "bash",
        html: "xml",
      }[language] || language;
    const html = hljs.getLanguage(language)
      ? hljs.highlight(text, { language, ignoreIllegals: true }).value
      : esc(text);
    return `<div class="code-example"><div class="code-toolbar"><span>${esc(language === "xml" ? "html" : language)}</span><button class="code-copy" data-copy-code type="button" aria-label="Copy code example">Copy code</button></div><pre><code class="hljs language-${esc(language)}">${html}</code></pre></div>\n`;
  };
  const html = marked.parser(chunk.tokens, { renderer });
  const dom = new JSDOM(`<article>${html}</article>`);
  const article = dom.window.document.querySelector("article");
  for (const node of article.querySelectorAll("script,iframe,object,embed"))
    node.remove();
  for (const node of article.querySelectorAll("*"))
    for (const attr of [...node.attributes])
      if (attr.name.startsWith("on")) node.removeAttribute(attr.name);
  for (const a of article.querySelectorAll("a[href]")) {
    let href = resolveLink(a.getAttribute("href"), chunk.source, page);
    // A README can link to its complete API; preserve that intent after splitting.
    if (
      /api/i.test(a.textContent) &&
      /README\.md(?:#|$)/.test(a.getAttribute("href"))
    ) {
      const id =
        a.getAttribute("href").match(/packages\/([^/]+)\//)?.[1] ||
        chunk.source.split("/")[1];
      if (entries.find((e) => e.id === id)?.pages.has("api"))
        href = relative(page, outFile(id, "api"));
    }
    a.setAttribute("href", href);
  }
  for (const img of article.querySelectorAll("img[src]"))
    img.setAttribute(
      "src",
      resolveLink(img.getAttribute("src"), chunk.source, page),
    );
  for (const table of [...article.querySelectorAll("table")]) {
    const wrap = dom.window.document.createElement("div");
    wrap.className = "docs-table";
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Reference table");
    table.replaceWith(wrap);
    wrap.append(table);
  }
  const result = article.innerHTML;
  dom.window.close();
  return result;
}
function frame({ page, title, description, id = "collection", body }) {
  const root = (path) => relative(page, path);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101817"><title>${esc(title)} — Cranberry Forge</title><meta name="description" content="${esc(description)}"><link rel="icon" type="image/svg+xml" href="${root("assets/branding/forge-mark.svg")}"><link rel="stylesheet" href="${root("showcase-shell.css")}"><link rel="stylesheet" href="${root("syntax.css")}"><link rel="stylesheet" href="${root("docs/docs.css")}"><script src="${root("docs/docs.js")}" defer></script></head><body class="forge-docs" data-forge-tool="${id}"><a class="docs-skip" href="#main-content">Skip to documentation</a><header class="forge-site-header"><a class="forge-source-brand" href="${root("catalog.html")}"><img src="${root("assets/branding/forge-mark.svg")}" width="38" height="38" alt=""><span>CRANBERRY <b>FORGE</b></span></a><nav aria-label="Site navigation"><a href="https://cranberryclock.com/">CranberryClock</a><a href="https://github.com/CranberryClock/Cranberry-Forge">Source on GitHub ↗</a></nav></header><nav class="docs-breadcrumb" aria-label="Breadcrumb"><a class="forge-home" href="${root("catalog.html")}">Forge</a><span aria-hidden="true">/</span><a href="${root("docs/index.html")}">Documentation</a>${id !== "collection" ? `<span aria-hidden="true">/</span><span>${esc(entries.find((e) => e.id === id).name)}</span>` : ""}</nav>${body}<footer class="forge-site-footer"><a class="forge-source-brand" href="${root("catalog.html")}"><img src="${root("assets/branding/forge-mark.svg")}" width="36" height="36" alt=""><span>CRANBERRY <b>FORGE</b><small>SMALL SYSTEMS. PLAYABLE POSSIBILITIES.</small></span></a><p>Designed by CranberryClock.<br>Independent tools. Shared with care.</p><nav aria-label="Footer navigation"><a href="${root("docs/index.html")}">Documentation</a><a href="${root("catalog.html")}">Explore the collection</a><a href="https://github.com/CranberryClock/Cranberry-Forge">GitHub ↗</a></nav></footer></body></html>\n`;
}
const manifest = [];
for (const e of entries)
  for (const key of e.ordered) {
    const page = outFile(e.id, key),
      root = (path) => relative(page, path),
      chunks = e.pages.get(key);
    const guideIntro =
      key === "guide" && !e.template
        ? `<div class="docs-callout"><strong>Start with the package archive.</strong><p><a href="${root(`downloads/cranberry-forge-${e.id}-0.1.0.tgz`)}" download>Download ${e.name} v0.1.0 ↓</a>, then follow the installation instructions below. Commands that pack source files run from the public repository checkout.</p></div>`
        : "";
    const toc = chunks
      .flatMap((c) => c.tokens)
      .filter((t) => t.type === "heading" && t.depth <= 3);
    const index = e.ordered.indexOf(key);
    const desc = {
      overview: products[e.id].pitch,
      guide: `Install ${e.name}, connect it to your project, and understand the integration boundaries.`,
      api: `The public ${e.name} API: inputs, outputs, behavior, and constraints.`,
      tutorial: `Work through the ${e.name} example and adapt the pattern to your own project.`,
    }[key];
    const side = `<aside class="docs-sidebar"><a class="docs-product" href="${root(outFile(e.id, "overview"))}"><img src="${root(`assets/identities/${e.id}.svg`)}" alt="" width="88" height="88"><strong>${e.name}</strong><small>${e.category}</small></a><nav aria-label="${e.name} documentation">${e.ordered.map((k) => `<a href="${root(outFile(e.id, k))}"${key === k ? ' aria-current="page"' : ""}>${labels[k]}</a>`).join("")}</nav><a class="docs-demo-link" href="${root(e.demo)}">Open the ${e.template ? "game" : "showcase"} ↗</a><label for="docs-system-select">Explore another system</label><select id="docs-system-select" class="docs-system-select">${entries.map((p) => `<option value="${root(outFile(p.id, "overview"))}"${p.id === e.id ? " selected" : ""}>${p.name}</option>`).join("")}</select><a href="${root("docs/index.html")}">All documentation →</a></aside>`;
    const next = `<footer class="docs-pagination">${[e.ordered[index - 1], e.ordered[index + 1]].map((k, i) => (k ? `<a href="${root(outFile(e.id, k))}"><small>${i === 0 ? "← Previous" : "Next →"}</small><strong>${labels[k]}</strong></a>` : "<span></span>")).join("")}</footer>`;
    const overviewLinks =
      key === "overview"
        ? `<div class="docs-grid">${e.ordered
            .filter((k) => k !== "overview")
            .map(
              (k) =>
                `<a class="docs-card" href="${root(outFile(e.id, k))}"><h2>${labels[k]} →</h2><p>${{ guide: "Install the package and connect the pieces.", api: "Explore the contract, methods, and constraints.", tutorial: "Follow a worked example, step by step." }[k]}</p></a>`,
            )
            .join("")}</div>`
        : "";
    const body = `<div class="docs-layout">${side}<main class="docs-main" id="main-content"><header class="docs-heading"><p class="docs-eyebrow">${e.template ? "GAME TEMPLATE" : "INDEPENDENT TOOL"} / v0.1.0</p><h1>${e.name}<span>${labels[key]}</span></h1><p class="docs-lede">${esc(desc)}</p></header>${guideIntro}<article class="docs-prose">${chunks.map((c) => renderChunk(c, page)).join("\n")}</article>${overviewLinks}${next}<p class="docs-source"><a href="https://github.com/CranberryClock/Cranberry-Forge/tree/main/dist/${posix.dirname(e.source)}">View versioned source on GitHub ↗</a></p></main><aside class="docs-toc"><nav aria-label="On this page"><strong>On this page</strong>${toc.map((t) => `<a href="#${esc(t.docsId)}"${t.depth === 3 ? ' class="docs-toc-sub"' : ""}>${esc(t.text.replace(/`/g, ""))}</a>`).join("")}</nav></aside></div>`;
    await mkdir(`dist/${posix.dirname(page)}`, { recursive: true });
    await writeFile(
      `dist/${page}`,
      frame({
        page,
        title: `${e.name} ${labels[key]}`,
        description: desc,
        id: e.id,
        body,
      }),
    );
    manifest.push({
      id: e.id,
      section: key,
      path: page,
      sources: [...new Set(chunks.map((c) => c.source))],
    });
  }
const hub = "docs/index.html";
const httpPage = "docs/http/index.html";
const httpTokens = marked
  .lexer(await readFile("docs/HTTP_API.md", "utf8"))
  .filter((t) => !(t.type === "heading" && t.depth === 1));
for (const t of httpTokens) if (t.type === "heading") t.docsId = slug(t.text);
await mkdir("dist/docs/http", { recursive: true });
await writeFile(
  `dist/${httpPage}`,
  frame({
    page: httpPage,
    title: "Optional HTTP companion",
    description:
      "Local Node companion endpoints, request examples, and response contracts for Cranberry Forge.",
    body: `<div class="docs-layout"><aside class="docs-sidebar"><a class="docs-product" href="../index.html"><img src="../../assets/branding/forge-mark.svg" width="88" height="88" alt=""><strong>Forge</strong><small>Local development</small></a><nav aria-label="Companion documentation"><a href="index.html" aria-current="page">HTTP API</a><a href="../index.html">All documentation</a></nav></aside><main class="docs-main" id="main-content"><header class="docs-heading"><p class="docs-eyebrow">OPTIONAL LOCAL COMPANION</p><h1>HTTP API<span>Local automation &amp; development</span></h1><p class="docs-lede">Run the companion on your own machine to connect Forge’s data tools to local workflows.</p></header><article class="docs-prose">${renderChunk({ source: "../docs/HTTP_API.md", tokens: httpTokens }, httpPage)}</article><p class="docs-source"><a href="https://github.com/CranberryClock/Cranberry-Forge/blob/main/docs/HTTP_API.md">View versioned source on GitHub ↗</a></p></main><aside class="docs-toc"><nav aria-label="On this page"><strong>On this page</strong>${httpTokens
      .filter((t) => t.type === "heading" && t.depth <= 3)
      .map((t) => `<a href="#${esc(t.docsId)}">${esc(t.text)}</a>`)
      .join("")}</nav></aside></div>`,
  }),
);
manifest.push({
  id: "collection",
  section: "http",
  path: httpPage,
  sources: ["../docs/HTTP_API.md"],
});
await writeFile(
  `dist/${hub}`,
  frame({
    page: hub,
    title: "Documentation",
    description:
      "Integration guides, API references and worked tutorials for every Cranberry Forge system.",
    body: `<main class="docs-hub" id="main-content"><header class="docs-hub-heading"><p class="docs-eyebrow">CRANBERRY FORGE / DEVELOPER LIBRARY</p><h1>From curiosity<br>to working code.</h1><p>Find your system. Learn its contract. Make it your own.</p><p>Integration guides, API references, and worked examples for 15 independent tools and two playable templates.</p><p><a href="http/index.html">Optional local HTTP API →</a></p></header><div class="docs-grid">${entries
      .map(
        (e) =>
          `<article class="docs-card" style="--forge-accent:${e.accent}"><img src="${relative(hub, `assets/identities/${e.id}.svg`)}" width="96" height="96" alt=""><p class="docs-eyebrow">${esc(e.category)}</p><h2><a href="${relative(hub, outFile(e.id, "overview"))}">${e.name} →</a></h2><p>${esc(products[e.id].title)}</p><div>${e.ordered
            .filter((k) => k !== "overview")
            .map(
              (k) =>
                `<a href="${relative(hub, outFile(e.id, k))}">${labels[k]}</a>`,
            )
            .join("")}</div></article>`,
      )
      .join("")}</div></main>`,
  }),
);
await writeFile(
  "dist/docs/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);

// Replace reader-facing Markdown links in authored HTML. Raw Markdown stays in
// the downloadable source, while labels determine the intended reading page.
async function adaptLinks(dir = "dist") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (
        !["vendor", "packages", "assets", "downloads", "docs", "lib"].includes(
          entry.name,
        )
      )
        await adaptLinks(path);
      continue;
    }
    if (!entry.name.endsWith(".html")) continue;
    const html = await readFile(path, "utf8");
    const page = path.slice(5),
      dom = new JSDOM(html),
      doc = dom.window.document;
    for (const a of doc.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (!/\.(?:md)(?:#|$)/.test(href)) continue;
      const normalized = href.replace(
        "https://cranberryclock.com/forge/showcase/",
        "/",
      );
      const url = new URL(normalized, `https://docs.local/${page}`);
      const source = url.pathname.slice(1),
        entry = entries.find(
          (e) => posix.dirname(e.source) === posix.dirname(source),
        );
      if (!entry || !sourceLinks.has(source)) continue;
      let section = /API\.md$/.test(source)
        ? "api"
        : /TUTORIAL\.md$/.test(source)
          ? "tutorial"
          : /api|reference/i.test(a.textContent)
            ? "api"
            : /guide|integration/i.test(a.textContent)
              ? "guide"
              : "overview";
      if (!entry.pages.has(section)) section = "guide";
      const dest =
        sourceAnchors.get(source + url.hash) || outFile(entry.id, section);
      a.setAttribute(
        "href",
        page.startsWith("templates/")
          ? "https://cranberryclock.com/forge/showcase/" + dest
          : relative(page, dest),
      );
      a.removeAttribute("target");
    }
    await writeFile(path, dom.serialize().replace(/[\t ]+$/gm, "") + "\n");
    dom.window.close();
  }
}
await adaptLinks();
console.log(
  `Built ${manifest.length + 1} static documentation pages from the public package contracts.`,
);
