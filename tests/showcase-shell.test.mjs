import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { JSDOM } from "jsdom";
import { systems } from "../scripts/showcase-catalog.mjs";

const showcaseFile = (url) => {
  const path = url.split(/[?#]/)[0];
  return `dist/${path.endsWith("/") ? path + "index.html" : path}`;
};

const localTarget = (file, href) => {
  const path = href.split(/[?#]/)[0];
  return path.startsWith("https://cranberryclock.com/forge/showcase/")
    ? resolve(
        "dist",
        path.slice("https://cranberryclock.com/forge/showcase/".length),
      )
    : resolve(dirname(file), path);
};

test("every showcase exposes all tools and games with valid destinations", async () => {
  for (const [id, , , url] of systems) {
    const file = showcaseFile(url);
    const dom = new JSDOM(await readFile(file, "utf8"));
    const doc = dom.window.document;
    const nav = doc.querySelector(".forge-explorer");
    assert.ok(nav, id);
    for (const selector of [
      ".forge-explorer",
      ".forge-site-header",
      ".forge-site-footer",
      ".forge-product-hero",
      ".forge-use-product",
    ])
      assert.equal(
        doc.querySelectorAll(selector).length,
        1,
        `${id}: one ${selector}`,
      );
    assert.equal(
      doc.querySelectorAll("header [data-tool], header [data-kit]").length,
      0,
    );
    assert.deepEqual(
      [...doc.querySelectorAll(".forge-site-header nav a")].map((a) => a.href),
      [
        "https://cranberryclock.com/",
        "https://github.com/CranberryClock/Cranberry-Forge",
      ],
      `${id}: one consistent creator and source navigation`,
    );
    assert.ok(
      doc.querySelector(
        doc.querySelector(".forge-action-primary").getAttribute("href"),
      ),
      `${id}: working demo jump`,
    );
    const links = [...nav.querySelectorAll("[data-forge-link]")];
    assert.equal(links.length, 17, id);
    assert.equal(new Set(links.map((a) => a.dataset.forgeLink)).size, 17);
    for (const link of links) {
      const href = link.getAttribute("href");
      let target = localTarget(file, href);
      if ((await stat(target)).isDirectory()) target += "/index.html";
      assert.ok((await stat(target)).isFile(), href);
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
    for (const asset of doc.querySelectorAll(
      ".forge-source-brand img, .forge-home img, [data-product-mark]",
    ))
      assert.ok(
        (await stat(localTarget(file, asset.getAttribute("src")))).isFile(),
        `${id}: bundled brand and identity assets`,
      );
    dom.window.close();
  }
});

test("shared-page theme, product copy and install actions follow hash changes", async () => {
  const html = await readFile("dist/index.html", "utf8");
  const script = await readFile("dist/showcase-shell.js", "utf8");
  const dom = new JSDOM(html, {
    url: "https://example.test/index.html#flux",
    runScripts: "outside-only",
  });
  const { window } = dom;
  window.eval(script);
  const body = window.document.body;
  const products = JSON.parse(
    body.querySelector("#forge-product-data").textContent,
  );
  const assertProduct = (id) => {
    const product = products[id];
    assert.equal(body.dataset.forgeTool, id);
    assert.equal(
      body.querySelector("[data-product-name]").textContent,
      product.name,
    );
    assert.equal(
      body.querySelector("[data-product-title]").textContent,
      product.title,
    );
    assert.equal(
      body.querySelector("[data-product-command]").textContent,
      product.command,
    );
    assert.equal(window.document.title, `${product.name} — Cranberry Forge`);
    for (const link of body.querySelectorAll("[data-product-download]"))
      assert.equal(
        link.href,
        new URL(product.download, window.location.href).href,
      );
    for (const link of body.querySelectorAll("[data-product-docs]"))
      assert.equal(link.href, new URL(product.docs, window.location.href).href);
    assert.equal(
      body.querySelector("[data-product-mark]").src,
      new URL(product.mark, window.location.href).href,
    );
  };
  assertProduct("flux");
  assert.equal(body.dataset.forgeTool, "flux");
  assert.equal(
    body.querySelector('.forge-picker [aria-current="page"]').dataset.forgeLink,
    "flux",
  );
  window.history.replaceState(null, "", "#biome");
  window.dispatchEvent(new window.HashChangeEvent("hashchange"));
  assertProduct("biome");
  const picker = body.querySelector(".forge-picker");
  picker.open = true;
  window.document.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape" }),
  );
  assert.equal(picker.open, false);
  assert.equal(window.document.activeElement, picker.querySelector("summary"));
  window.close();
});

test("shared camp URLs select the matching product and package", async () => {
  const html = await readFile("dist/play.html", "utf8");
  const script = await readFile("dist/showcase-shell.js", "utf8");
  for (const id of ["satchel", "chatter"]) {
    const dom = new JSDOM(html, {
      url: `https://example.test/play.html?kit=${id}`,
      runScripts: "outside-only",
    });
    dom.window.eval(script);
    const doc = dom.window.document;
    assert.equal(doc.body.dataset.forgeTool, id);
    assert.equal(
      doc.querySelector("[data-product-name]").textContent.toLowerCase(),
      id,
    );
    assert.match(
      doc.querySelector("[data-product-download]").href,
      new RegExp(`cranberry-forge-${id}-[^/]+\\.tgz$`),
    );
    assert.equal(
      doc.querySelector('.forge-picker [aria-current="page"]').dataset
        .forgeLink,
      id,
    );
    dom.window.close();
  }
});

test("product instructions install bundled archives and link existing documentation", async () => {
  for (const [id, , , url] of systems) {
    const file = showcaseFile(url);
    const dom = new JSDOM(await readFile(file, "utf8"));
    const record = JSON.parse(
      dom.window.document.querySelector("#forge-product-data").textContent,
    )[id];
    assert.ok(record, `${id}: product data is available before mode switching`);
    assert.ok(
      (await stat(localTarget(file, record.download))).isFile(),
      `${id}: downloadable archive exists`,
    );
    assert.ok(
      (await stat(localTarget(file, record.docs))).isFile(),
      `${id}: documentation exists`,
    );
    if (url.startsWith("templates/")) {
      assert.equal(record.command, "Extract the archive and serve the folder.");
    } else {
      const pkg = JSON.parse(
        await readFile(`dist/packages/${id}/package.json`, "utf8"),
      );
      assert.equal(
        record.command,
        `npm install ./cranberry-forge-${id}-${pkg.version}.tgz${pkg.peerDependencies?.three ? " three@0.180.0" : ""}`,
      );
    }
    dom.window.close();
  }
});

test("layout changes preserve bound controls and live progress counters", async () => {
  const required = {
    "index.html": ["open-docs"],
    "signal.html": ["open-docs"],
    "play.html": ["kit-guide"],
    "trailmark.html": ["completion", "receipts"],
    "wayfinder.html": ["deliveries"],
    "templates/afterglow/index.html": [
      "help-button",
      "motion-button",
      "pause-button",
    ],
  };
  for (const [file, ids] of Object.entries(required)) {
    const dom = new JSDOM(await readFile(`dist/${file}`, "utf8"));
    for (const id of ids)
      assert.equal(
        dom.window.document.querySelectorAll(`#${id}`).length,
        1,
        `${file}: preserves one #${id}`,
      );
    dom.window.close();
  }
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
