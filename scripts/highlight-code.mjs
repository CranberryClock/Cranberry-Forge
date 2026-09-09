import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { highlightCode, inferLanguage } from "../dist/syntax-runtime.js";

export { highlightCode, inferLanguage };

const skip = new Set([
  "vendor",
  "packages",
  "assets",
  "docs",
  "downloads",
  "lib",
]);
const posix = (value) => value.split(sep).join("/");

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory() && !skip.has(entry.name))
      files.push(...(await htmlFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files.sort();
}

export async function prepareSyntax(root = resolve("dist")) {
  await build({
    entryPoints: [resolve(root, "syntax-runtime.js")],
    outfile: resolve(root, "syntax.js"),
    bundle: true,
    minify: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    legalComments: "eof",
  });
  const versions = Object.fromEntries(
    await Promise.all(
      ["syntax.js", "syntax.css"].map(async (name) => [
        name,
        createHash("sha256")
          .update(await readFile(resolve(root, name)))
          .digest("hex")
          .slice(0, 12),
      ]),
    ),
  );
  await mkdir(resolve(root, "vendor", "highlight.js"), { recursive: true });
  await cp(
    "node_modules/highlight.js/LICENSE",
    resolve(root, "vendor", "highlight.js", "LICENSE"),
  );
  let count = 0;
  for (const path of await htmlFiles(root)) {
    const source = await readFile(path, "utf8");
    const dom = new JSDOM(source);
    const document = dom.window.document;
    const blocks = [...document.querySelectorAll("pre")].map(
      (pre) => pre.querySelector(":scope > code") || pre,
    );
    blocks.push(...document.querySelectorAll("code[data-product-command]"));
    if (!blocks.length) {
      dom.window.close();
      continue;
    }
    for (const node of blocks) {
      const language = inferLanguage(node);
      const text = node.textContent;
      node.classList.add("hljs", `language-${language}`);
      node.setAttribute("data-forge-syntax", "");
      node.dataset.language = language;
      node.innerHTML = highlightCode(text, language);
      if (node.textContent !== text)
        throw new Error(`Highlighting changed source text in ${path}`);
      count++;
    }

    const templatePath = posix(relative(resolve(root, "templates"), path));
    const portable =
      !templatePath.startsWith("../") && !templatePath.startsWith("/");
    let assets = root;
    if (portable) {
      assets = resolve(root, "templates", templatePath.split("/")[0], "lib");
      await mkdir(assets, { recursive: true });
      for (const file of ["syntax.css", "syntax.js"])
        await cp(resolve(root, file), resolve(assets, file));
      await cp(
        "node_modules/highlight.js/LICENSE",
        resolve(assets, "highlight-LICENSE"),
      );
    }
    document
      .querySelectorAll("[data-forge-syntax-asset]")
      .forEach((element) => element.remove());
    const href = (name) =>
      `./${posix(relative(dirname(path), resolve(assets, name)))}?v=${versions[name]}`;
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = href("syntax.css");
    style.setAttribute("data-forge-syntax-asset", "");
    document.head.append(style);
    const script = document.createElement("script");
    script.src = href("syntax.js");
    script.defer = true;
    script.setAttribute("data-forge-syntax-asset", "");
    document.head.append(script);
    await writeFile(path, dom.serialize());
    dom.window.close();
  }
  console.log(
    `Prepared syntax colors for ${count} showcase code blocks and live reports.`,
  );
  return count;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await prepareSyntax();
