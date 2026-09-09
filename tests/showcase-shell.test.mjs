import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { JSDOM } from "jsdom";
import { systems } from "../scripts/showcase-catalog.mjs";

test("every showcase exposes all tools and games with valid destinations", async () => {
  for (const [id, , , url] of systems) {
    const path = url.split(/[?#]/)[0];
    const file = `dist/${path.endsWith("/") ? path + "index.html" : path}`;
    const dom = new JSDOM(await readFile(file, "utf8"));
    const nav = dom.window.document.querySelector(".forge-explorer");
    assert.ok(nav, id);
    assert.equal(dom.window.document.querySelectorAll('.forge-explorer').length, 1);
    assert.equal(dom.window.document.querySelectorAll('header [data-tool], header [data-kit]').length, 0);
    for (const link of dom.window.document.querySelectorAll('header nav a')) {
      assert.match(link.getAttribute('href'), /\/(packages|downloads)\//, `${id}: only resource actions belong in the header`);
    }
    const links = [...nav.querySelectorAll("[data-forge-link]")];
    assert.equal(links.length, 17, id);
    assert.equal(new Set(links.map((a) => a.dataset.forgeLink)).size, 17);
    for (const link of links) {
      const href = link.getAttribute("href");
      if (href.startsWith("https:")) {
        assert.ok(
          href.startsWith("https://cranberryclock.com/forge/showcase/"),
        );
      } else {
        let target = resolve(dirname(file), href.split(/[?#]/)[0]);
        if ((await stat(target)).isDirectory()) target += "/index.html";
        assert.ok((await stat(target)).isFile(), href);
      }
    }
    for (const asset of dom.window.document.querySelectorAll(
      "[data-forge-shell]",
    ))
      assert.ok(
        (
          await stat(
            resolve(
              dirname(file),
              asset.getAttribute("src") || asset.getAttribute("href"),
            ),
          )
        ).isFile(),
      );
  }
});

test("shared-page themes follow mode changes and picker closes with Escape", async () => {
  const html = await readFile("dist/index.html", "utf8");
  const script = await readFile("dist/showcase-shell.js", "utf8");
  const dom = new JSDOM(html, {
    url: "https://example.test/index.html#flux",
    runScripts: "outside-only",
  });
  const { window } = dom;
  window.eval(script);
  const body = window.document.body;
  assert.equal(body.dataset.forgeTool, "flux");
  assert.equal(
    body.querySelector('.forge-picker [aria-current="page"]').dataset.forgeLink,
    "flux",
  );
  window.history.replaceState(null, "", "#biome");
  window.dispatchEvent(new window.HashChangeEvent("hashchange"));
  assert.equal(body.dataset.forgeTool, "biome");
  const picker = body.querySelector(".forge-picker");
  picker.open = true;
  window.document.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape" }),
  );
  assert.equal(picker.open, false);
  assert.equal(window.document.activeElement, picker.querySelector("summary"));
  window.close();
});

test("each system has its own readable accent and background", () => {
  const luminance = (hex) => {
    const v = hex
      .slice(1)
      .match(/../g)
      .map((x) => parseInt(x, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
  };
  assert.equal(new Set(systems.map((s) => s[4])).size, 17);
  for (const [id, , , , accent, bg] of systems) {
    const a = luminance(accent),
      b = luminance(bg);
    assert.ok(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5,
      `${id} accent contrast`,
    );
  }
});
