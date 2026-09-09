import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { prepareSyntax } from "../scripts/highlight-code.mjs";
import {
  enhanceLiveCode,
  highlightCode,
  inferLanguage,
} from "../dist/syntax-runtime.js";

test("syntax grammars preserve source text and escape code instead of creating HTML", () => {
  for (const [language, source, token] of [
    [
      "javascript",
      `const name = '<img src=x onerror=alert(1)>'; // example\nnew Spring({ value: 42 });`,
      ".hljs-keyword",
    ],
    ["typescript", "interface Player { health: number; }", ".hljs-keyword"],
    ["json", '{"health":42,"ready":true}', ".hljs-attr"],
    [
      "bash",
      "npm install ./cranberry-forge-spring-0.1.0.tgz",
      ".hljs-built_in",
    ],
    ["xml", '<div class="scene">World</div>', ".hljs-tag"],
    ["css", ".scene { color: #fff; }", ".hljs-attribute"],
  ]) {
    const dom = new JSDOM(
      `<pre><code>${highlightCode(source, language)}</code></pre>`,
    );
    const node = dom.window.document.querySelector("code");
    assert.equal(node.textContent, source, language);
    assert.ok(node.querySelector(token), language);
    assert.equal(node.querySelectorAll("img, script, div").length, 0);
    dom.window.close();
  }
  const plain = '<script>alert("example")</script>\nA & B';
  const dom = new JSDOM(`<pre>${highlightCode(plain, "plaintext")}</pre>`);
  assert.equal(dom.window.document.querySelector("pre").textContent, plain);
  assert.equal(dom.window.document.querySelectorAll("script, span").length, 0);
  dom.window.close();
});

test("syntax language selection recognizes live reports and install commands", () => {
  const dom = new JSDOM(`<pre id="json"></pre><pre id="state-trace"></pre>
    <pre><code class="language-ts">interface Player {}</code></pre>
    <code data-product-command>npm install ./package.tgz</code>
    <code data-product-command>Extract the archive and serve the folder.</code>`);
  const document = dom.window.document;
  assert.equal(inferLanguage(document.querySelector("#json")), "json");
  assert.equal(inferLanguage(document.querySelector("#state-trace")), "json");
  assert.equal(
    inferLanguage(document.querySelector(".language-ts")),
    "typescript",
  );
  const commands = document.querySelectorAll("[data-product-command]");
  assert.equal(inferLanguage(commands[0]), "bash");
  assert.equal(inferLanguage(commands[1]), "plaintext");
  dom.window.close();
});

test("live code follows demo updates without recursive mutations or altered copy text", async () => {
  const dom = new JSDOM(
    `<pre id="json" data-forge-syntax data-language="json"></pre>
    <pre><code id="integration-code" data-forge-syntax data-language="javascript"></code></pre>`,
    { pretendToBeVisual: true },
  );
  const document = dom.window.document;
  const stop = enhanceLiveCode(document);
  const report = document.querySelector("#json");
  const example = document.querySelector("#integration-code");
  const nextFrame = () =>
    new Promise((done) =>
      dom.window.requestAnimationFrame(() =>
        dom.window.requestAnimationFrame(done),
      ),
    );
  try {
    report.textContent = '{"gold":125,"restored":true}';
    example.textContent = "const spring = new Spring({ frequency: 1.6 });";
    await nextFrame();
    assert.ok(report.querySelector(".hljs-attr"));
    assert.ok(example.querySelector(".hljs-keyword"));
    assert.equal(report.textContent, '{"gold":125,"restored":true}');
    const copy = example.textContent;
    // Assigning identical text destroys its spans; the observer restores them.
    example.textContent = copy;
    report.textContent = '{"gold":250,"restored":false}';
    await nextFrame();
    assert.equal(example.textContent, copy);
    assert.ok(example.querySelector(".hljs-keyword"));
    assert.equal(report.textContent, '{"gold":250,"restored":false}');
    assert.ok(report.querySelector(".hljs-literal"));
    let mutations = 0;
    const probe = new dom.window.MutationObserver(() => mutations++);
    probe.observe(report, { childList: true, subtree: true });
    await nextFrame();
    assert.equal(
      mutations,
      0,
      "Highlighting must not create an observer feedback loop",
    );
    probe.disconnect();
    stop();
    report.textContent = '{"afterStop":true}';
    await nextFrame();
    assert.equal(report.querySelector("span"), null);
  } finally {
    stop();
    dom.window.close();
  }
});

test("syntax preparation is repeatable and portable template assets remain local", async () => {
  const workspace = resolve(".");
  const fixture = await mkdtemp(resolve(workspace, ".syntax-test-"));
  try {
    await cp(
      resolve("dist/syntax-runtime.js"),
      resolve(fixture, "syntax-runtime.js"),
    );
    await cp(resolve("dist/syntax.css"), resolve(fixture, "syntax.css"));
    const source =
      '<!doctype html><html><head><title>Fixture</title></head><body><pre><code id="keep-id">const count = 42; // &lt;example&gt;</code></pre><pre id="json"></pre></body></html>';
    await writeFile(resolve(fixture, "index.html"), source);
    await mkdir(resolve(fixture, "templates/mothlight"), { recursive: true });
    await writeFile(resolve(fixture, "templates/mothlight/index.html"), source);
    await mkdir(resolve(fixture, "docs"));
    await writeFile(resolve(fixture, "docs/index.html"), source);
    assert.equal(await prepareSyntax(fixture), 4);
    const first = await readFile(resolve(fixture, "index.html"), "utf8");
    assert.equal(await prepareSyntax(fixture), 4);
    assert.equal(await readFile(resolve(fixture, "index.html"), "utf8"), first);
    assert.equal(
      await readFile(resolve(fixture, "docs/index.html"), "utf8"),
      source,
    );
    const dom = new JSDOM(first);
    assert.equal(
      dom.window.document.querySelector("#keep-id").textContent,
      "const count = 42; // <example>",
    );
    assert.ok(dom.window.document.querySelector("#keep-id .hljs-number"));
    assert.equal(
      dom.window.document.querySelectorAll("script[data-forge-syntax-asset]")
        .length,
      1,
    );
    const scriptUrl = dom.window.document
      .querySelector("script[data-forge-syntax-asset]")
      .getAttribute("src");
    const styleUrl = dom.window.document
      .querySelector("link[data-forge-syntax-asset]")
      .getAttribute("href");
    const digest = async (name) =>
      createHash("sha256")
        .update(await readFile(resolve(fixture, name)))
        .digest("hex")
        .slice(0, 12);
    assert.equal(scriptUrl, `./syntax.js?v=${await digest("syntax.js")}`);
    assert.equal(styleUrl, `./syntax.css?v=${await digest("syntax.css")}`);
    dom.window.close();
    const portable = await readFile(
      resolve(fixture, "templates/mothlight/index.html"),
      "utf8",
    );
    assert.ok(
      portable.includes(
        `href="./lib/syntax.css?v=${await digest("syntax.css")}"`,
      ),
    );
    assert.ok(
      portable.includes(`src="./lib/syntax.js?v=${await digest("syntax.js")}"`),
    );
    assert.equal(
      await readFile(
        resolve(fixture, "templates/mothlight/lib/syntax.js"),
        "utf8",
      ),
      await readFile(resolve(fixture, "syntax.js"), "utf8"),
    );
    await writeFile(resolve(fixture, "syntax.css"), ".hljs { color: #abc; }\n");
    await prepareSyntax(fixture);
    const changed = new JSDOM(
      await readFile(resolve(fixture, "index.html"), "utf8"),
    );
    assert.notEqual(
      changed.window.document
        .querySelector("link[data-forge-syntax-asset]")
        .getAttribute("href"),
      styleUrl,
    );
    assert.equal(
      changed.window.document
        .querySelector("script[data-forge-syntax-asset]")
        .getAttribute("src"),
      scriptUrl,
    );
    changed.window.close();
  } finally {
    assert.equal(dirname(fixture), workspace);
    assert.ok(fixture.startsWith(resolve(workspace, ".syntax-test-")));
    await rm(fixture, { recursive: true, force: true });
  }
});

test("new guide-dialog examples are discovered and keep highlighting later updates", async () => {
  const dom = new JSDOM('<body><div id="metric">0</div></body>', {
    pretendToBeVisual: true,
  });
  const document = dom.window.document;
  const stop = enhanceLiveCode(document);
  const nextFrame = () =>
    new Promise((done) =>
      dom.window.requestAnimationFrame(() =>
        dom.window.requestAnimationFrame(done),
      ),
    );
  try {
    const dialog = document.createElement("section");
    dialog.innerHTML =
      '<pre><code id="guide-example" class="language-ts"></code></pre><pre id="raw-example" data-no-highlight></pre>';
    dialog.querySelector("code").textContent =
      "interface Player { health: number; }";
    dialog.querySelector("#raw-example").textContent = "const plain = 7;";
    document.body.append(dialog);
    await nextFrame();
    const code = document.querySelector("#guide-example");
    assert.ok(code.querySelector(".hljs-keyword"));
    assert.equal(code.dataset.language, "typescript");
    assert.equal(code.textContent, "interface Player { health: number; }");
    assert.equal(document.querySelector("#raw-example span"), null);
    code.textContent = "type Health = number;";
    await nextFrame();
    assert.ok(code.querySelector(".hljs-keyword"));
    assert.equal(code.textContent, "type Health = number;");
    let mutations = 0;
    const probe = new dom.window.MutationObserver(() => mutations++);
    probe.observe(code, { childList: true, subtree: true });
    for (let i = 1; i <= 20; i++)
      document.querySelector("#metric").textContent = String(i);
    await nextFrame();
    assert.equal(
      mutations,
      0,
      "Unrelated metric updates must leave highlighted code alone",
    );
    probe.disconnect();
  } finally {
    stop();
    dom.window.close();
  }
});
