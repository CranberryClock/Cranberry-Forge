import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import assert from "node:assert/strict";
import ts from "typescript";

for (const template of [
  {
    id: "mothlight",
    assets: [
      "assets/items/mira.png",
      "assets/items/lantern.png",
      "packages/chatter/dom.d.ts",
    ],
    routes: [
      "/lib/camp-scene.js",
      "/packages/chatter/dom.js",
      "/assets/items/mira.png",
    ],
  },
  {
    id: "afterglow",
    assets: [
      "scene.js",
      "packages/flux/index.d.ts",
      "packages/signal/index.d.ts",
    ],
    routes: [
      "/scene.js",
      "/packages/flux/index.js",
      "/packages/signal/index.js",
    ],
  },
]) {
  const root = await mkdtemp(join(tmpdir(), `${template.id}-template-`));
  execFileSync("tar", [
    "-xzf",
    resolve(`dist/downloads/${template.id}-template-0.1.0.tgz`),
    "-C",
    root,
  ]);
  const html = await readFile(join(root, "index.html"), "utf8");
  const imports = JSON.parse(
    html.match(/<script\s+type="importmap">([\s\S]*?)<\/script>/)[1],
  ).imports;
  const visited = new Set();
  async function inspect(path) {
    if (visited.has(path)) return;
    visited.add(path);
    const source = await readFile(path, "utf8");
    for (const dependency of ts.preProcessFile(source, true, true)
      .importedFiles) {
      const spec = dependency.fileName;
      let target;
      if (spec.startsWith(".")) target = resolve(dirname(path), spec);
      else if (imports[spec]) target = resolve(root, imports[spec]);
      else {
        const key = Object.keys(imports).find(
          (k) => k.endsWith("/") && spec.startsWith(k),
        );
        if (key) target = resolve(root, imports[key] + spec.slice(key.length));
      }
      assert.ok(target, `Unresolved import ${spec} from ${path}`);
      await inspect(target);
    }
  }
  await inspect(join(root, "app.js"));
  for (const path of [
    "game.css",
    "README.md",
    "LICENSE",
    "server.mjs",
    "vendor/fonts/dm-sans-400.woff2",
    ...template.assets,
  ])
    assert.ok((await stat(join(root, path))).size > 0);
  const allocator = createServer();
  allocator.listen(0, "127.0.0.1");
  await once(allocator, "listening");
  const port = allocator.address().port;
  await new Promise((resolve) => allocator.close(resolve));
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Template server startup timed out")),
        8000,
      );
      child.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Template server exited: ${code}`));
      });
      child.stdout.once("data", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    const base = `http://127.0.0.1:${port}`;
    for (const path of [
      "/",
      "/app.js",
      ...template.routes,
      "/vendor/three/build/three.module.js",
    ])
      assert.equal((await fetch(base + path)).status, 200, path);
    assert.notEqual(
      (await fetch(base + "/%2e%2e%2fpackage-lock.json")).status,
      200,
    );
    console.log(
      `${template.id} portable template passed: ${visited.size} browser modules resolve, assets exist, and the extracted server responds without npm install.`,
    );
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  }
}
