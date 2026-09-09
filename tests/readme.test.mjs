import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";

test("README local documentation and all fourteen gallery images resolve", async () => {
  const readme = await readFile("README.md", "utf8");
  const targets = [...readme.matchAll(/\]\(([^)]+)\)/g)].map(
    (match) => match[1],
  );
  for (const target of targets) {
    if (/^(?:https?:|#)/.test(target)) continue;
    await access(target.split("#")[0]);
  }
  const gallery = new Set(
    targets.filter(
      (target) => target.startsWith("docs/images/") && target.endsWith(".png"),
    ),
  );
  assert.equal(gallery.size, 14);
  assert.ok(readme.startsWith("# Cranberry Forge\n"));
});

test("README's quick integration runs against the actual Biome API", async () => {
  const readme = await readFile("README.md", "utf8");
  const snippet = readme.match(/```js\n([\s\S]*?)\n```/)?.[1];
  assert.ok(snippet, "README should contain a runnable JavaScript integration");
  const program = `const scene = new THREE.Scene();\n${snippet}\nif (scene.children.length !== 1 || grove.children[0].count !== 180) throw Error('README integration failed');`;
  execFileSync(process.execPath, ["--input-type=module", "--eval", program], {
    stdio: "pipe",
  });
});
