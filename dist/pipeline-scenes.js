import * as THREE from "three";
import { createCranberryClock } from "./cranberryclock.js";
import { releaseObject } from "./scene.js";

export function createPipelineScene(stage, kind) {
  const root = new THREE.Group();
  root.name = `${kind} · Cranberry Forge`;
  stage.scene.add(root);
  const colors = {
    ledger: ["#121d29", "#e6b16a", "#b7f37a"],
    keepsake: ["#17182e", "#9d87e5", "#76e5eb"],
    sift: ["#10282b", "#df9673", "#b7f37a"],
  }[kind];
  stage.scene.background = new THREE.Color(colors[0]);
  stage.scene.fog = new THREE.FogExp2(colors[0], 0.011);
  const targetY = kind === "keepsake" ? 3.2 : 2;
  stage.camera.position.set(
    kind === "sift" ? 21 : 18,
    kind === "keepsake" ? 16 : 17,
    kind === "keepsake" ? 28 : 25,
  );
  stage.camera.lookAt(0, targetY, 0);
  stage.controls?.target.set(0, targetY, 0);
  if (stage.controls) {
    stage.controls.minDistance = 14;
    stage.controls.maxDistance = 48;
    stage.controls.autoRotate = false;
  }
  if (stage.bloom) stage.bloom.strength = 0.35;
  const mat = (color, metalness = 0.2) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.5 });
  const m = {
    dark: mat("#243a48"),
    black: mat("#142331"),
    floor: mat("#405565"),
    gold: mat(colors[1], 0.7),
    ivory: mat("#e6ddd0"),
    pink: mat("#b93968"),
    glow: new THREE.MeshStandardMaterial({
      color: colors[2],
      emissive: colors[2],
      emissiveIntensity: 1.2,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: "#83cbd1",
      transparent: true,
      opacity: 0.15,
      metalness: 0.3,
      roughness: 0.15,
      depthWrite: false,
    }),
  };
  const add = (g, material, p = [0, 0, 0], parent = root) => {
    const o = new THREE.Mesh(g, material);
    o.position.set(...p);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const box = (size, material, p, parent) =>
    add(new THREE.BoxGeometry(...size), material, p, parent);
  const cyl = (r, h, material, p, parent, s = 48) =>
    add(new THREE.CylinderGeometry(r, r, h, s), material, p, parent);
  const ring = (r, t, material, p, parent) => {
    const o = add(new THREE.TorusGeometry(r, t, 8, 64), material, p, parent);
    o.rotation.x = Math.PI / 2;
    return o;
  };
  const rod = (a, b, r, material, parent = root) => {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      delta = bv.clone().sub(av);
    const o = cyl(
      r,
      delta.length(),
      material,
      av.add(bv).multiplyScalar(0.5).toArray(),
      parent,
      8,
    );
    o.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return o;
  };
  root.add(new THREE.HemisphereLight("#d4e3ff", "#302030", 2.7));
  const sun = new THREE.DirectionalLight("#ffe8ca", 3.8);
  sun.position.set(-10, 22, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -18,
    right: 18,
    top: 18,
    bottom: -18,
    near: 1,
    far: 70,
  });
  sun.shadow.normalBias = 0.025;
  root.add(sun);
  const rim = new THREE.DirectionalLight(
    kind === "keepsake" ? "#a195ff" : "#84e5d3",
    2.6,
  );
  rim.position.set(8, 10, -14);
  root.add(rim);
  const floor = cyl(10.7, 0.75, m.black, [0, -0.65, 0], root, 12);
  floor.name = "Stage foundation";
  cyl(10.3, 0.16, m.floor, [0, -0.2, 0], root, 64);
  ring(10, 0.045, m.gold, [0, -0.08, 0]);
  for (let i = 0; i < 40; i++) {
    const a = (i * Math.PI) / 20;
    const o = box([0.045, 0.025, i % 5 ? 0.2 : 0.48], m.gold, [
      Math.sin(a) * 9.55,
      -0.1,
      Math.cos(a) * 9.55,
    ]);
    o.rotation.y = a;
  }
  // Suspended lower machinery gives each workbench a tangible silhouette.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    box([0.9, 1.6, 0.9], m.dark, [Math.sin(a) * 8, -1.6, Math.cos(a) * 8]);
    cyl(0.3, 0.45, m.gold, [Math.sin(a) * 8, -2.6, Math.cos(a) * 8]);
  }
  const mascot = createCranberryClock();
  mascot.position.set(-6, 1.4, 5.1);
  mascot.rotation.y = 0.35;
  root.add(mascot);
  cyl(1.05, 0.35, m.gold, [-6, 0.1, 5.1]);
  cyl(0.72, 0.7, m.dark, [-6, 0.55, 5.1]);
  const moving = [],
    crates = [],
    islands = [];
  let robot, arm, reachRing, scan, orbital;
  let state = {
    attack: 50,
    speed: 3,
    reach: 2,
    islands: 2,
    gold: 125,
    sky: "dusk",
    report: null,
    selected: 0,
  };
  let elapsed = 0,
    paused = false;
  if (kind === "ledger") {
    cyl(5.9, 0.18, m.ivory, [0, 0, 0]);
    ring(5.65, 0.075, m.gold, [0, 0.12, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      rod(
        [Math.sin(a) * 6.4, 0.1, Math.cos(a) * 6.4],
        [Math.sin(a) * 8.5, 0.1, Math.cos(a) * 8.5],
        0.025,
        m.gold,
      );
    }
    robot = new THREE.Group();
    robot.position.set(-1, 0.25, 0);
    root.add(robot);
    for (const x of [-0.43, 0.43]) {
      box([0.65, 0.42, 1.15], m.black, [x, 0.25, 0.16], robot);
      rod([x, 0.5, 0], [x, 1.6, 0], 0.19, m.gold, robot);
      add(new THREE.SphereGeometry(0.25, 12, 8), m.dark, [x, 0.9, 0], robot);
    }
    const body = box([1.65, 1.5, 1.1], m.gold, [0, 2.2, 0], robot);
    body.rotation.z = 0.08;
    box([1.2, 1.02, 0.15], m.dark, [0, 2.2, 0.6], robot);
    cyl(0.27, 0.45, m.black, [0, 3.1, 0], robot);
    const head = box([1.1, 0.85, 0.95], m.ivory, [0, 3.65, 0], robot);
    head.rotation.y = 0.12;
    box([0.75, 0.14, 0.06], m.glow, [0, 3.69, 0.49], robot);
    arm = new THREE.Group();
    arm.position.set(0.98, 2.7, 0);
    robot.add(arm);
    add(new THREE.SphereGeometry(0.32, 12, 8), m.dark, [0, 0, 0], arm);
    rod([0, 0, 0], [0, -1.2, 0], 0.15, m.gold, arm);
    box([0.24, 2.1, 0.18], m.ivory, [0, -1.3, 0.6], arm);
    box([0.85, 0.12, 0.22], m.gold, [0, -0.48, 0.6], arm);
    rod([-0.97, 2.6, 0], [-1.12, 1.3, 0], 0.17, m.dark, robot);
    const shield = add(
      new THREE.CylinderGeometry(0.66, 0.66, 0.15, 6),
      m.gold,
      [-1.2, 1.8, 0.35],
      robot,
    );
    shield.rotation.x = Math.PI / 2;
    reachRing = ring(1, 0.032, m.glow, [-1, 0.2, 0]);
    for (let i = 0; i < 3; i++) {
      const x = 4.1,
        z = -3 + i * 3;
      cyl(0.62, 0.22, m.gold, [x, 0.15, z]);
      rod([x, 0.3, z], [x, 2.1, z], 0.12, m.dark);
      const target = add(
        new THREE.CylinderGeometry(0.77, 0.77, 0.2, 24),
        m.pink,
        [x, 2.1, z],
      );
      target.rotation.z = Math.PI / 2;
      target.rotation.x = Math.PI / 2;
      const center = add(new THREE.SphereGeometry(0.22, 12, 8), m.ivory, [
        x - 0.15,
        2.1,
        z,
      ]);
      moving.push(center);
    }
    for (let i = 0; i < 3; i++) {
      box([1.5, 0.8, 1.4], m.dark, [-6 + i * 2.2, 0.4, -6]);
      cyl(0.22, 1.2, m.gold, [-6 + i * 2.2, 1.3, -6]);
      add(new THREE.OctahedronGeometry(0.45), m.glow, [-6 + i * 2.2, 2.25, -6]);
    }
  } else if (kind === "keepsake") {
    cyl(4.5, 0.5, m.gold, [0, 0.2, 0]);
    cyl(4.1, 0.3, m.black, [0, 0.6, 0]);
    ring(3.8, 0.045, m.glow, [0, 0.78, 0]);
    orbital = new THREE.Group();
    orbital.position.y = 4;
    root.add(orbital);
    for (let i = 0; i < 3; i++) {
      const hoop = add(
        new THREE.TorusGeometry(3.8 + i * 0.15, 0.055, 8, 80),
        m.gold,
        [0, 0, 0],
        orbital,
      );
      hoop.rotation.set(i * 0.85, 0.4 + i * 0.8, i * 0.35);
    }
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      g.position.set(
        Math.cos(i * 2.399) * 1.8,
        i * 0.42 + 2.3,
        Math.sin(i * 2.399) * 1.8,
      );
      root.add(g);
      islands.push(g);
      const island = add(
        new THREE.ConeGeometry(1, 1.4, 7),
        m.dark,
        [0, -0.6, 0],
        g,
      );
      island.rotation.z = Math.PI;
      cyl(1, 0.12, m.ivory, [0, 0.08, 0], g, 7);
      box([0.6, 0.6, 0.65], m.gold, [0, 0.42, 0], g);
      const roof = add(
        new THREE.ConeGeometry(0.62, 0.5, 4),
        m.pink,
        [0, 0.96, 0],
        g,
      );
      roof.rotation.y = Math.PI / 4;
      box([0.14, 0.23, 0.03], m.glow, [0, 0.48, 0.34], g);
      for (let n = 0; n < 3; n++)
        add(
          new THREE.OctahedronGeometry(0.13),
          m.glow,
          [-0.5 + n * 0.35, 0.28, 0.65],
          g,
        );
    }
    for (const x of [-6.6, 6.6]) {
      cyl(0.7, 0.2, m.gold, [x, 0.1, -3]);
      rod([x, 0.2, -3], [x, 6.8, -3], 0.16, m.gold);
      for (let j = 0; j < 4; j++)
        box([0.65, 0.2, 0.65], m.ivory, [x, 1 + j * 1.45, -3]);
    }
    const arch = add(
      new THREE.TorusGeometry(6.6, 0.16, 8, 64, Math.PI),
      m.gold,
      [0, 6.8, -3],
    );
    arch.scale.y = 0.55;
    for (let i = 0; i < 3; i++) {
      const x = -3.2 + i * 3.2;
      cyl(0.8, 0.35, m.gold, [x, 0.3, 6.3]);
      cyl(0.64, 1.8, m.glass, [x, 1.35, 6.3]);
      const crystal = add(
        new THREE.OctahedronGeometry(0.43),
        i === 1 ? m.glow : m.pink,
        [x, 1.4, 6.3],
      );
      moving.push(crystal);
      ring(0.67, 0.05, m.gold, [x, 2.27, 6.3]);
    }
    for (let i = 0; i < 30; i++) {
      const a = i * 2.39996;
      add(new THREE.SphereGeometry(0.025, 6, 4), m.glow, [
        Math.cos(a) * (4 + (i % 3)),
        1 + (i % 8),
        Math.sin(a) * (4 + (i % 3)),
      ]);
    }
  } else {
    box([16, 0.55, 5.6], m.black, [0, 0.3, 0]);
    for (let i = 0; i < 23; i++) {
      const roller = cyl(
        0.2,
        5.2,
        i % 3 === 0 ? m.gold : m.floor,
        [-7.7 + i * 0.7, 0.75, 0],
        root,
        12,
      );
      roller.rotation.x = Math.PI / 2;
    }
    for (const z of [-2.9, 2.9]) box([16.5, 0.2, 0.16], m.gold, [0, 0.95, z]);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      g.position.set(-5 + i * 5, 0.95, 0);
      root.add(g);
      crates.push(g);
      const shell = box([2.4, 2.5, 2.4], m.dark.clone(), [0, 1.25, 0], g);
      g.userData.shell = shell;
      for (const x of [-1.22, 1.22])
        for (const z of [-1.22, 1.22])
          box([0.12, 2.6, 0.12], m.gold, [x, 1.25, z], g);
      for (const y of [0.08, 2.44])
        box([2.55, 0.12, 2.55], m.gold, [0, y, 0], g);
      const asset =
        i === 0
          ? add(new THREE.IcosahedronGeometry(0.6, 0), m.ivory, [0, 3.5, 0], g)
          : i === 1
            ? box([1.1, 1.1, 0.2], m.gold, [0, 3.5, 0], g)
            : add(
                new THREE.TorusGeometry(0.55, 0.12, 8, 24),
                m.pink,
                [0, 3.5, 0],
                g,
              );
      moving.push(asset);
      const lamp = box([0.8, 0.2, 0.04], m.glow.clone(), [0, 1.6, 1.24], g);
      g.userData.lamp = lamp;
    }
    for (const x of [-8.4, 8.4])
      for (const z of [-3.8, 3.8]) {
        box([0.32, 6.7, 0.32], m.gold, [x, 3.25, z]);
        box([0.95, 0.35, 0.95], m.dark, [x, 0.1, z]);
      }
    for (const z of [-3.8, 3.8]) {
      box([17.2, 0.35, 0.4], m.gold, [0, 6.5, z]);
      box([14, 0.07, 0.1], m.glow, [0, 6.3, z]);
    }
    scan = box(
      [0.07, 4.3, 5.6],
      new THREE.MeshBasicMaterial({
        color: "#79edda",
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }),
      [-6, 3.1, 0],
    );
    for (let i = 0; i < 5; i++) {
      box([1.2, 0.65, 1.2], i % 2 ? m.dark : m.gold, [-5 + i * 2.1, 0.3, -6.5]);
    }
  }
  function setState(next) {
    state = { ...state, ...next };
    if (reachRing) {
      reachRing.scale.setScalar(state.reach);
    }
    islands.forEach((o, i) => (o.visible = i < state.islands));
    crates.forEach((g, i) => {
      const id = ["clockwork-scout", "brass-atlas", "memory-gate"][i];
      g.visible = !state.assetIds || state.assetIds.includes(id);
      const bad = state.report?.findings.some(
        (f) => f.assetId === id && f.severity === "error",
      );
      const c = bad ? "#fa718f" : "#b5ed80";
      g.userData.lamp.material.color.set(c);
      g.userData.lamp.material.emissive.set(c);
      g.userData.shell.material.color.set(
        i === state.selected ? "#5a7280" : "#243a48",
      );
    });
    if (kind === "keepsake") {
      m.pink.color.set(state.sky === "dawn" ? "#efaf79" : "#b93968");
    }
  }
  function update(dt) {
    if (paused) return;
    elapsed += dt;
    if (robot) {
      robot.position.z = Math.sin(elapsed * state.speed * 0.32) * 1.5;
      robot.rotation.y = Math.sin(elapsed * 0.55) * 0.14;
      arm.rotation.x =
        -0.25 - Math.max(0, Math.sin(elapsed * state.speed)) * 0.8;
      reachRing.position.z = robot.position.z;
      moving.forEach((o, i) =>
        o.scale.setScalar(
          1 +
            (Math.max(0, Math.sin(elapsed * state.speed - i)) * state.attack) /
              280,
        ),
      );
    }
    if (orbital) {
      orbital.rotation.y = elapsed * 0.12;
      islands.forEach(
        (o, i) => (o.rotation.y = Math.sin(elapsed * 0.3 + i) * 0.2),
      );
    }
    if (!robot)
      moving.forEach((o, i) => {
        o.rotation.y = elapsed * (0.3 + i * 0.08);
      });
    if (scan) scan.position.x = Math.sin(elapsed * 0.5) * 7.5;
  }
  setState({});
  return {
    root,
    setState,
    update,
    setPaused(value) {
      paused = value;
    },
    dispose() {
      releaseObject(root);
    },
  };
}
