import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { marked } from "marked";
import { systems } from "../scripts/showcase-catalog.mjs";

const root = resolve("dist");
const manifest = JSON.parse(
  await readFile(resolve(root, "docs/manifest.json"), "utf8"),
);
const pages = [...manifest, { id: "collection", path: "docs/index.html" }];

async function documentAt(path) {
  return new JSDOM(await readFile(resolve(root, path), "utf8"), {
    url: `https://docs.test/${path}`,
  });
}

async function localLink(from, href) {
  const url = new URL(href, `https://docs.test/${from}`);
  if (
    url.origin === "https://cranberryclock.com" &&
    url.pathname.startsWith("/forge/showcase/")
  ) {
    url.pathname = url.pathname.slice("/forge/showcase".length);
  } else if (url.origin !== "https://docs.test") {
    return null;
  }
  let file = resolve(root, "." + decodeURIComponent(url.pathname));
  assert.ok(
    file === root || file.startsWith(root + sep),
    `${href}: stays inside static output`,
  );
  if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
  assert.ok((await stat(file)).isFile(), `${from}: ${href} resolves to a file`);
  return { file, fragment: decodeURIComponent(url.hash.slice(1)) };
}

test("every tool has a complete documentation journey and templates have integration guides", async () => {
  assert.equal(manifest.length, 65);
  assert.deepEqual(
    manifest.find((entry) => entry.id === "collection"),
    {
      id: "collection",
      section: "http",
      path: "docs/http/index.html",
      sources: ["../docs/HTTP_API.md"],
    },
    "the optional HTTP companion has its own documented contract",
  );
  assert.equal(
    new Set(manifest.map((entry) => entry.path)).size,
    manifest.length,
  );
  for (const [id, , , demo] of systems) {
    const sections = manifest
      .filter((entry) => entry.id === id)
      .map((entry) => entry.section);
    assert.deepEqual(
      sections,
      demo.startsWith("templates/")
        ? ["overview", "guide"]
        : ["overview", "guide", "api", "tutorial"],
      id,
    );
  }
  for (const page of pages) {
    const dom = await documentAt(page.path);
    const doc = dom.window.document;
    assert.equal(
      doc.body.dataset.forgeTool,
      page.id,
      `${page.path}: matching theme`,
    );
    for (const selector of [
      ".forge-site-header",
      ".forge-site-footer",
      "main",
      "h1",
    ])
      assert.equal(
        doc.querySelectorAll(selector).length,
        1,
        `${page.path}: one ${selector}`,
      );
    if (page.id !== "collection") {
      assert.equal(
        doc.querySelectorAll('.docs-sidebar [aria-current="page"]').length,
        1,
      );
      assert.match(
        doc.querySelector("h1").textContent,
        new RegExp(systems.find((system) => system[0] === page.id)[1]),
      );
      assert.equal(
        doc.querySelectorAll("#docs-system-select option").length,
        17,
      );
    }
    dom.window.close();
  }
});

test("documentation navigation, downloads, assets and section anchors resolve", async () => {
  const targetDocuments = new Map();
  try {
    for (const page of pages) {
      const dom = await documentAt(page.path);
      const doc = dom.window.document;
      for (const element of doc.querySelectorAll(
        "a[href], link[href], script[src], img[src], option[value]",
      )) {
        const href =
          element.getAttribute("href") ??
          element.getAttribute("src") ??
          element.getAttribute("value");
        const target = await localLink(page.path, href);
        if (!target?.fragment || !target.file.endsWith(".html")) continue;
        // Biome and Flux use hashes as application modes, rather than in-page headings.
        if (
          target.file === resolve(root, "index.html") &&
          ["biome", "flux"].includes(target.fragment)
        )
          continue;
        if (!targetDocuments.has(target.file))
          targetDocuments.set(
            target.file,
            new JSDOM(await readFile(target.file, "utf8")),
          );
        assert.ok(
          targetDocuments
            .get(target.file)
            .window.document.getElementById(target.fragment),
          `${page.path}: ${href} points to an existing heading`,
        );
      }
      dom.window.close();
    }
  } finally {
    for (const dom of targetDocuments.values()) dom.window.close();
  }
});

test("reader-facing pages link to rendered documentation instead of raw Markdown", async () => {
  const htmlFiles = [];
  async function collect(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = resolve(folder, entry.name);
      if (entry.isDirectory()) {
        if (
          !["vendor", "packages", "assets", "downloads", "lib"].includes(
            entry.name,
          )
        )
          await collect(path);
      } else if (entry.name.endsWith(".html")) htmlFiles.push(path);
    }
  }
  await collect(root);
  for (const file of htmlFiles) {
    const dom = new JSDOM(await readFile(file, "utf8"));
    for (const a of dom.window.document.querySelectorAll("a[href]")) {
      if (!/\.md(?:[?#]|$)/i.test(a.getAttribute("href"))) continue;
      assert.match(
        a.textContent,
        /View versioned source/i,
        `${relative(root, file)}: reader link still opens Markdown (${a.getAttribute("href")})`,
      );
    }
    dom.window.close();
  }
});

test("rendered code examples exactly preserve the original documented fences", async () => {
  const sourceBlocks = new Map();
  const seenBlocks = new Map();
  let examples = 0;
  for (const entry of manifest) {
    for (const source of entry.sources) {
      if (sourceBlocks.has(source)) continue;
      const blocks = new Set();
      marked.walkTokens(
        marked.lexer(await readFile(resolve(root, source), "utf8")),
        (token) => {
          if (token.type === "code") blocks.add(token.text);
        },
      );
      sourceBlocks.set(source, blocks);
      seenBlocks.set(source, new Set());
    }
    const dom = await documentAt(entry.path);
    for (const code of dom.window.document.querySelectorAll(
      ".docs-prose pre code",
    )) {
      const sources = entry.sources.filter((source) =>
        sourceBlocks.get(source).has(code.textContent),
      );
      assert.ok(
        sources.length,
        `${entry.path}: code must exactly match a documented example`,
      );
      for (const source of sources)
        seenBlocks.get(source).add(code.textContent);
      assert.ok(
        code.closest(".code-example").querySelector("button[data-copy-code]"),
        `${entry.path}: code is copyable`,
      );
      examples++;
    }
    dom.window.close();
  }
  assert.ok(
    examples > 50,
    "the docs include the collection's worked integration examples",
  );
  for (const [source, expected] of sourceBlocks)
    assert.deepEqual(
      [...seenBlocks.get(source)].sort(),
      [...expected].sort(),
      `${source}: no source example was lost during section extraction`,
    );
});

test("JavaScript syntax and reference tables remain readable and accessible", async () => {
  let javascriptExamples = 0;
  let tables = 0;
  for (const page of pages) {
    const dom = await documentAt(page.path);
    const doc = dom.window.document;
    for (const code of doc.querySelectorAll(
      ".docs-prose code.language-javascript",
    )) {
      assert.ok(
        code.querySelector('span[class*="hljs-"]'),
        `${page.path}: JavaScript has syntax highlighting`,
      );
      javascriptExamples++;
    }
    for (const table of doc.querySelectorAll(".docs-prose table")) {
      const wrapper = table.closest(".docs-table");
      assert.ok(wrapper, `${page.path}: wide tables have a scroll container`);
      assert.equal(
        wrapper.tabIndex,
        0,
        `${page.path}: table scroll is keyboard reachable`,
      );
      assert.equal(wrapper.getAttribute("role"), "region");
      assert.ok(wrapper.getAttribute("aria-label"));
      assert.ok(
        table.querySelector("th"),
        `${page.path}: reference table has column headers`,
      );
      tables++;
    }
    dom.window.close();
  }
  assert.ok(javascriptExamples > 20);
  assert.ok(tables > 10);
});

test("Sift reference includes its headless API, local adapter and CLI contract", async () => {
  const dom = await documentAt("docs/sift/api/index.html");
  const doc = dom.window.document;
  for (const id of ["core-api", "local-files", "cli"])
    assert.ok(doc.getElementById(id), `Sift API includes ${id}`);
  for (const name of [
    "auditAssets",
    "auditFiles",
    "readAuditInput",
    "MISSING_FILE",
    "Exit 0:",
  ])
    assert.ok(
      doc.querySelector(".docs-prose").textContent.includes(name),
      `Sift API retains ${name}`,
    );
  assert.ok(
    [...doc.querySelectorAll("pre code")].some((code) =>
      code.textContent.includes("sift audit.json --root ./game-assets"),
    ),
  );
  dom.window.close();
});
