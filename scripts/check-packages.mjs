import { mkdtemp, mkdir, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";

const extraSmokes = {
  ledger:
    "import {evaluateStats} from '@cranberry-forge/ledger';if(evaluateStats({base:{x:3}}).values.x!==3)throw Error('stats failed');",
  keepsake:
    "import {createSave,migrateSave} from '@cranberry-forge/keepsake';if(!migrateSave(createSave('test',0,{}),{format:'test',targetVersion:0,validators:{0:()=>true}}).ok)throw Error('save failed');",
  sift: "import {auditAssets} from '@cranberry-forge/sift';import {auditFiles} from '@cranberry-forge/sift/node';if(!auditAssets({manifest:[]}).ok||!(await auditFiles({manifest:[]})).ok)throw Error('audit failed');",
  tempo:
    "import {Tempo} from '@cranberry-forge/tempo';const t=new Tempo([{id:'dash',charges:2,recharge:1}]);if(!t.tryUse('dash').ok)throw Error('clock failed');t.tick(1);",
  loom: "import {Loom} from '@cranberry-forge/loom';const l=new Loom({points:[[0,0,0],[5,0,0],[10,0,0]]});if(!l.sample(0.5).position.isVector3)throw Error('sample failed');l.dispose();",
  wayfinder:
    "import {Wayfinder} from '@cranberry-forge/wayfinder';const g=new Wayfinder({width:3,height:3});if(g.findPath({x:0,z:0},{x:2,z:2}).status!=='found')throw Error('path failed');",
  spring:
    "import {Spring} from '@cranberry-forge/spring';const s=new Spring();s.setTarget(1);s.step(0.1);if(!(s.value>0))throw Error('spring failed');",
  parcel:
    "import {createParcel} from '@cranberry-forge/parcel';const p=createParcel({id:'test',entries:[{id:'ore',itemId:'ore',rarity:'common',weight:1}]});if(p.open().receipts.length!==1)throw Error('loot failed');",
};
const root = process.cwd(),
  scratch = await mkdtemp(join(tmpdir(), "cranberry-forge-package-check-"));
for (const name of (await readdir("dist/packages")).sort()) {
  const packed = JSON.parse(
    execFileSync(
      "npm",
      [
        "pack",
        `./dist/packages/${name}`,
        "--pack-destination",
        scratch,
        "--json",
      ],
      { cwd: root, encoding: "utf8" },
    ),
  )[0];
  for (const required of ["index.js", "index.d.ts", "README.md", "LICENSE"])
    if (!packed.files.some((f) => f.path === required))
      throw new Error(`${name} missing ${required}`);
  const app = join(scratch, name);
  await mkdir(app);
  const manifest = JSON.parse(
    await readFile(`dist/packages/${name}/package.json`, "utf8"),
  );
  const needsThree = Boolean(manifest.peerDependencies?.three);
  execFileSync(
    "npm",
    [
      "install",
      "--prefix",
      app,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      resolve(scratch, packed.filename),
      ...(needsThree ? ["three@0.180.0"] : []),
    ],
    { encoding: "utf8", stdio: "pipe" },
  );
  const code =
    extraSmokes[name] ??
    (name === "biome"
      ? "import {scatter} from '@cranberry-forge/biome';if(scatter({count:3}).points.length!==3)throw Error('scatter failed');"
      : name === "flux"
        ? "import {Trail} from '@cranberry-forge/flux';const t=new Trail();if(t.capacity!==256)throw Error('trail failed');t.dispose();"
        : name === "signal"
          ? "import {Telegraph} from '@cranberry-forge/signal';const t=new Telegraph();if(t.state!=='idle')throw Error('telegraph failed');t.dispose();"
          : name === "satchel"
            ? "import {Inventory} from '@cranberry-forge/satchel';const p=new Inventory({catalog:[{id:'ore'}]});if(!p.add('ore').ok)throw Error('inventory failed');"
            : name === "chatter"
              ? "import {Conversation} from '@cranberry-forge/chatter';import {mountDialogue} from '@cranberry-forge/chatter/dom';const c=new Conversation({id:'test',start:'hello',nodes:{hello:{text:'Hello'}}});if(c.view.text!=='Hello'||typeof mountDialogue!=='function')throw Error('dialogue failed');"
              : name === "latch"
                ? "import {Latch} from '@cranberry-forge/latch';import {Mesh,BoxGeometry,MeshBasicMaterial,Vector3,Ray} from 'three';const l=new Latch();l.register({id:'box',root:new Mesh(new BoxGeometry(),new MeshBasicMaterial())});const f=l.update({dt:0,aimRay:new Ray(new Vector3(0,0,3),new Vector3(0,0,-1)),actorPosition:new Vector3(0,0,2),pressed:false});if(f.focus?.id!=='box')throw Error('interaction failed');"
                : "import {createJournal} from '@cranberry-forge/trailmark';const j=createJournal([{id:'q',objectives:[{id:'o',type:'collect',target:1}]}]);j.activate('q');if(j.dispatch({id:'e',type:'collect'}).completed.length!==1)throw Error('journal failed');");
  execFileSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: app,
    stdio: "pipe",
  });
  if (name === "sift")
    execFileSync(join(app, "node_modules/.bin/sift"), ["--help"], {
      cwd: app,
      stdio: "pipe",
    });
  console.log(
    `${name}: standalone install and public API passed (${packed.size} bytes packed)`,
  );
}
console.log(
  "Each package tested in its own temporary project; Three.js installed only for peer packages.",
);
