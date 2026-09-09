import { cp, mkdir, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

// dist contains authored source. Never delete it during preparation.
await mkdir("dist/vendor/three", { recursive: true });
await cp("node_modules/three/build", "dist/vendor/three/build", {
  recursive: true,
});
await cp("node_modules/three/examples/jsm", "dist/vendor/three/addons", {
  recursive: true,
});
await cp("node_modules/three/LICENSE", "dist/vendor/three/LICENSE");
await mkdir("dist/vendor/fonts", { recursive: true });
for (const [font, weights] of [
  ["dm-sans", [400, 500, 600]],
  ["space-grotesk", [400, 500, 700]],
]) {
  for (const weight of weights)
    await cp(
      `node_modules/@fontsource/${font}/files/${font}-latin-${weight}-normal.woff2`,
      `dist/vendor/fonts/${font}-${weight}.woff2`,
    );
  await cp(
    `node_modules/@fontsource/${font}/LICENSE`,
    `dist/vendor/fonts/${font}-LICENSE.txt`,
  );
}
await mkdir("dist/downloads", { recursive: true });
await cp("docs/images", "dist/assets/previews", { recursive: true });
for (const name of (await readdir("dist/packages")).sort()) {
  execFileSync(
    "npm",
    [
      "pack",
      `./dist/packages/${name}`,
      "--pack-destination",
      "dist/downloads",
      "--json",
    ],
    { stdio: "pipe" },
  );
}
// Each portable template gets its own official renderer and explicitly used
// libraries. Authored template code stays put; no other template is needed.
for (const config of [
  {
    id: "mothlight",
    libraries: ["satchel", "chatter"],
    helpers: ["scene.js", "cranberryclock.js", "camp-scene.js", "kit-ui.js"],
    items: true,
  },
  {
    id: "afterglow",
    libraries: ["signal", "flux"],
    helpers: ["scene.js", "cranberryclock.js"],
    items: false,
  },
]) {
  const template = `dist/templates/${config.id}`;
  await mkdir(`${template}/lib`, { recursive: true });
  for (const name of config.helpers)
    await cp(`dist/${name}`, `${template}/lib/${name}`);
  await cp("dist/assets/branding", `${template}/lib/assets/branding`, {
    recursive: true,
  });
  await cp("dist/vendor", `${template}/vendor`, { recursive: true });
  if (config.items)
    await cp("dist/assets/items", `${template}/assets/items`, {
      recursive: true,
    });
  for (const name of config.libraries)
    await cp(`dist/packages/${name}`, `${template}/packages/${name}`, {
      recursive: true,
    });
  execFileSync("tar", [
    "-czf",
    resolve(`dist/downloads/${config.id}-template-0.1.0.tgz`),
    "-C",
    resolve(template),
    ".",
  ]);
}

async function scan(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "vendor") continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) await scan(p);
    else if (p.endsWith(".js") || p.endsWith(".mjs"))
      execFileSync(process.execPath, ["--check", p]);
  }
}
await scan("dist");
await scan("scripts");
await readFile("dist/index.html");
console.log(
  `Prepared self-contained Three.js r180 showcase in ${resolve("dist")}`,
);
