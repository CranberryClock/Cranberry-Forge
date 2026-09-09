// Resolve static page links and browser module graphs without starting a browser.
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import ts from "typescript";
const root = resolve("dist"),
  pages = [];
async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["vendor", "packages", "assets", "downloads"].includes(entry.name))
      continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (path.endsWith(".html")) pages.push(path);
  }
}
await collect(root);
const seenCSS = new Set(),
  local = (value, from) => {
    if (!value || /^(#|https?:|data:|blob:|mailto:)/.test(value)) return null;
    const clean = value.split(/[?#]/)[0];
    return value.startsWith("/")
      ? resolve(root, "." + clean)
      : resolve(dirname(from), clean);
  };
async function exists(path) {
  assert.ok(
    path === root || path.startsWith(root + sep),
    `Path outside static root: ${path}`,
  );
  const info = await stat(path);
  if (info.isDirectory()) return exists(resolve(path, "index.html"));
  assert.ok(info.isFile(), path);
  return path;
}
async function css(path) {
  if (seenCSS.has(path)) return;
  seenCSS.add(path);
  const source = await readFile(path, "utf8");
  for (const match of source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
    const target = local(match[1], path);
    if (target) await exists(target);
  }
}
let modules = 0;
for (const page of pages) {
  const dom = new JSDOM(await readFile(page, "utf8")),
    doc = dom.window.document;
  const map = JSON.parse(
    doc.querySelector('script[type="importmap"]')?.textContent ??
      '{"imports":{}}',
  ).imports;
  const visited = new Set();
  async function inspect(path) {
    if (visited.has(path)) return;
    visited.add(path);
    await exists(path);
    const source = await readFile(path, "utf8");
    modules++;
    for (const dependency of ts.preProcessFile(source, true, true)
      .importedFiles) {
      const spec = dependency.fileName;
      let target =
        spec.startsWith(".") || spec.startsWith("/") ? local(spec, path) : null;
      if (!target && map[spec]) target = local(map[spec], page);
      if (!target) {
        const key = Object.keys(map).find(
          (k) => k.endsWith("/") && spec.startsWith(k),
        );
        if (key) target = local(map[key] + spec.slice(key.length), page);
      }
      assert.ok(target, `Unresolved ${spec} in ${path} from page ${page}`);
      await inspect(target);
    }
  }
  for (const element of doc.querySelectorAll("[href],[src]")) {
    const value = element.getAttribute("href") ?? element.getAttribute("src"),
      path = local(value, page);
    if (!path) continue;
    const file = await exists(path);
    if (element.tagName === "SCRIPT") await inspect(file);
    if (extname(file) === ".css") await css(file);
  }
  dom.window.close();
}
console.log(
  `Static delivery passed: ${pages.length} pages, ${modules} per-page module dependencies and ${seenCSS.size} stylesheets. No browser rendering performed.`,
);
