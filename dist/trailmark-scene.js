import * as THREE from "three";

export const TRAILMARK_DISTRICTS = Object.freeze([
  {
    id: "supplies",
    name: "Driftwood Landing",
    position: [-9, 3.6, 2.8],
    color: "#e4b777",
  },
  {
    id: "bridge",
    name: "Ribbon Bridge",
    position: [-1.1, 3.8, 2.3],
    color: "#e9ab7a",
  },
  {
    id: "homes",
    name: "Terracotta Quarter",
    position: [7, 5.8, 2.5],
    color: "#ec957c",
  },
  {
    id: "beacon",
    name: "Northlight",
    position: [2.2, 10.5, -6.7],
    color: "#b9e6b4",
  },
]);

/** Renderer-free scene factory. setState accepts journal.list() or { completed, selected }. */
export function createTrailmarkScene(stage, options = {}) {
  const root = new THREE.Group();
  root.name = "Trailmark — the returning tide";
  stage.scene.add(root);
  stage.scene.background = new THREE.Color("#142c35");
  stage.scene.fog = new THREE.Fog("#142c35", 65, 115);
  stage.camera.position.set(30, 28, 35);
  stage.camera.lookAt(0, 2, 0);
  if (stage.controls) {
    stage.controls.target.set(0, 2, 0);
    stage.controls.minDistance = 22;
    stage.controls.maxDistance = 70;
    stage.controls.autoRotate = false;
    stage.controls.update();
  }
  if (stage.bloom) {
    stage.bloom.strength = 0.32;
    stage.bloom.threshold = 1.05;
  }
  const mats = {},
    pickables = [],
    floats = [],
    repairs = { bridge: [], homes: [] };
  const material = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.83,
      flatShading: true,
      ...extra,
    });
  const colors = {
    sand: "#dcc8a1",
    limestone: "#cbbd9e",
    rock: "#617d7b",
    deep: "#264c57",
    grass: "#7b9d84",
    grassLight: "#9cad85",
    terracotta: "#bd6b52",
    roof: "#ec9465",
    cream: "#f3d3a1",
    wood: "#8c5f49",
    darkWood: "#654b43",
    green: "#366e65",
    leaf: "#608f70",
    gold: "#f2c877",
    iron: "#416268",
    water: "#245b66",
  };
  for (const [key, value] of Object.entries(colors))
    mats[key] = material(value);
  mats.glow = material("#ffe2a4", {
    emissive: "#ffc874",
    emissiveIntensity: 3.5,
  });
  mats.glass = material("#76cfbd", {
    transparent: true,
    opacity: 0.43,
    metalness: 0.15,
  });
  function mesh(geometry, mat, x = 0, y = 0, z = 0, parent = root) {
    const m = new THREE.Mesh(
      geometry,
      typeof mat === "string" ? mats[mat] : mat,
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (w, h, d, mat, x, y, z, p) =>
    mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
  const cylinder = (r1, r2, h, n, mat, x, y, z, p) =>
    mesh(new THREE.CylinderGeometry(r1, r2, h, n), mat, x, y, z, p);
  const ambient = new THREE.HemisphereLight("#d8f4f0", "#46546c", 2.3);
  root.add(ambient);
  const sun = new THREE.DirectionalLight("#ffe0ab", 3.4);
  sun.position.set(-20, 34, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -25,
    right: 25,
    top: 25,
    bottom: -25,
    near: 1,
    far: 90,
  });
  sun.shadow.bias = -0.0006;
  root.add(sun);
  const rim = new THREE.DirectionalLight("#80bcd1", 1.5);
  rim.position.set(15, 18, -22);
  root.add(rim);
  cylinder(25, 24.3, 1.8, 96, "deep", 0, -1.65, 0);
  cylinder(25.2, 25.2, 0.18, 96, "water", 0, -0.66, 0);
  const waveMat = new THREE.LineBasicMaterial({
    color: "#619395",
    transparent: true,
    opacity: 0.27,
  });
  for (let row = 0; row < 18; row++)
    for (let col = 0; col < 9; col++) {
      const x = -23 + col * 5.4 + (row % 2) * 1.1,
        z = -22 + row * 2.5;
      if (x * x + z * z > 560) continue;
      const pts = Array.from(
        { length: 9 },
        (_, i) =>
          new THREE.Vector3(
            x + i * 0.28,
            -0.545,
            z + Math.sin((i / 8) * Math.PI) * 0.12,
          ),
      );
      root.add(
        new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), waveMat),
      );
    }
  function island(x, z, r, rotation) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    root.add(group);
    cylinder(r * 0.97, r * 0.8, 1.8, 10, "rock", 0, 0.05, 0, group);
    cylinder(r, r * 0.97, 0.55, 10, "sand", 0, 1.12, 0, group);
    cylinder(r * 0.93, r * 0.93, 0.12, 10, "grass", 0, 1.45, 0, group);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.1;
      const stone = box(
        0.8,
        0.17,
        0.45,
        "limestone",
        Math.cos(a) * r * 0.96,
        1.48,
        Math.sin(a) * r * 0.96,
        group,
      );
      stone.rotation.y = -a;
    }
    return group;
  }
  island(-8.1, 3.3, 4.3, 0.18);
  island(6.5, 2.1, 5.6, 0.09);
  island(2, -7.3, 3.6, 0.26);
  island(-10, -7, 1.8, -0.1);
  island(11.8, -8.7, 1.65, 0.17);
  function tree(x, z, scale = 1, parent = root) {
    const g = new THREE.Group();
    g.position.set(x, 1.5, z);
    g.scale.setScalar(scale);
    parent.add(g);
    cylinder(0.11, 0.17, 1.6, 6, "wood", 0, 0.6, 0, g);
    cylinder(0, 0.92, 1.8, 7, "green", 0, 1.7, 0, g);
    cylinder(0, 0.74, 1.5, 7, "leaf", 0, 2.4, 0, g);
    cylinder(0, 0.46, 1.2, 7, "grassLight", 0, 3, 0, g);
  }
  [
    [-10, 1, 0.85],
    [-10.5, 4.6, 0.7],
    [-9, 5.8, 0.62],
    [9.8, 1.2, 1.05],
    [10.2, 3.3, 0.75],
    [7.8, -1.2, 0.7],
    [4.2, -0.8, 0.62],
    [-9.9, -7, 1.1],
    [11.8, -8.7, 0.65],
    [0.2, -8.2, 0.6],
    [4, -8.2, 0.75],
  ].forEach(([x, z, s]) => tree(x, z, s));
  // A tidy timber yard, crane, quarry stones, and a long working jetty.
  box(2.9, 0.15, 5.1, "wood", -8.4, 1.35, 7.5);
  for (let i = 0; i < 14; i++)
    box(2.95, 0.055, 0.045, "darkWood", -8.4, 1.45, 5.15 + i * 0.36);
  for (const x of [-9.65, -7.15])
    for (const z of [5.4, 7.7, 9.6]) {
      cylinder(0.14, 0.16, 2.7, 7, "wood", x, 0.3, z);
      cylinder(0.18, 0.18, 0.1, 8, "cream", x, 1.71, z);
    }
  box(0.22, 3.5, 0.22, "wood", -6.6, 3.1, 4.1);
  box(2.4, 0.2, 0.2, "wood", -7.3, 4.75, 4.1);
  const craneBrace = box(1.8, 0.12, 0.15, "darkWood", -7.1, 4.3, 4.1);
  craneBrace.rotation.z = 0.55;
  cylinder(0.025, 0.025, 1.7, 6, "iron", -8.2, 3.8, 4.1);
  box(0.65, 0.5, 0.65, "gold", -8.2, 2.7, 4.1);
  for (let i = 0; i < 7; i++) {
    const log = cylinder(
      0.22,
      0.24,
      2.3,
      8,
      "wood",
      -7 + (i % 3) * 0.45,
      1.8 + Math.floor(i / 3) * 0.38,
      2.15,
    );
    log.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 6; i++) {
    const stone = mesh(
      new THREE.DodecahedronGeometry(0.44 + (i % 2) * 0.13, 0),
      "limestone",
      -9.8 + (i % 3) * 0.58,
      1.8,
      -0.1 + Math.floor(i / 3) * 0.65,
    );
    stone.rotation.set(i * 0.7, i, 0.2);
  }
  const crates = new THREE.Group();
  root.add(crates);
  for (let i = 0; i < 5; i++) {
    const x = -6.8 + (i % 2) * 0.73,
      z = 4.9 + Math.floor(i / 2) * 0.72;
    box(0.65, 0.6, 0.65, "cream", x, 1.8, z, crates);
    box(0.07, 0.62, 0.67, "wood", x, 1.8, z, crates);
  }
  // Stone arches are real extrusions with open interiors.
  function arch(x) {
    const g = new THREE.Group();
    g.position.set(x, 0, 2.3);
    root.add(g);
    const shape = new THREE.Shape();
    shape.moveTo(-1.07, 0.15);
    shape.lineTo(-1.07, 1.6);
    shape.lineTo(1.07, 1.6);
    shape.lineTo(1.07, 0.15);
    shape.lineTo(0.72, 0.15);
    shape.lineTo(0.72, 0.55);
    shape.absarc(0, 0.55, 0.72, 0, Math.PI, false);
    shape.lineTo(-0.72, 0.15);
    shape.closePath();
    mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 1.9,
        bevelEnabled: false,
        curveSegments: 10,
      }),
      "sand",
      0,
      0,
      -0.95,
      g,
    );
    box(2.17, 0.15, 2.15, "limestone", 0, 1.69, 0, g);
    for (const z of [-1, 1]) {
      box(2.16, 0.35, 0.13, "cream", 0, 1.96, z, g);
      for (const bx of [-0.98, 0.98])
        box(0.24, 0.65, 0.24, "sand", bx, 2.03, z, g);
    }
    return g;
  }
  for (let i = 0; i < 3; i++) repairs.bridge.push(arch(-3.5 + i * 2.18));
  box(1.4, 0.25, 2.1, "sand", -5.1, 1.6, 2.3);
  box(1.4, 0.25, 2.1, "sand", 2.1, 1.6, 2.3);
  const broken = new THREE.Group();
  root.add(broken);
  for (let i = 0; i < 5; i++) {
    const plank = box(
      1.15,
      0.11,
      0.17,
      "wood",
      -4.5 + i * 0.32,
      1.86,
      1.55 + i * 0.27,
      broken,
    );
    plank.rotation.y = i * 0.3;
  }
  // Warm faceted houses, striped awnings, chimney pots, and roof scaffolds.
  function house(x, z, w, d, h, turn, index) {
    const g = new THREE.Group();
    g.position.set(x, 1.53, z);
    g.rotation.y = turn;
    root.add(g);
    box(w, h, d, index === 1 ? "terracotta" : "cream", 0, h / 2, 0, g);
    box(w + 0.13, 0.14, d + 0.12, "sand", 0, 0.08, 0, g);
    const roof = new THREE.Group();
    g.add(roof);
    const triangle = new THREE.Shape();
    triangle.moveTo(-w * 0.59, 0);
    triangle.lineTo(0, w * 0.46);
    triangle.lineTo(w * 0.59, 0);
    triangle.closePath();
    mesh(
      new THREE.ExtrudeGeometry(triangle, {
        depth: d + 0.35,
        bevelEnabled: false,
      }),
      "roof",
      0,
      h,
      -d / 2 - 0.175,
      roof,
    );
    for (let i = 0; i < 6; i++)
      box(
        0.06,
        0.04,
        d + 0.38,
        "terracotta",
        -w * 0.54 + i * w * 0.215,
        h + 0.12 + (1 - Math.abs(-1 + i * 0.4)) * w * 0.35,
        0,
        roof,
      );
    box(0.31, 0.7, 0.34, "terracotta", w * 0.26, h + w * 0.36, d * 0.2, roof);
    box(0.4, 0.1, 0.42, "cream", w * 0.26, h + w * 0.36 + 0.38, d * 0.2, roof);
    repairs.homes.push(roof);
    box(0.49, 0.9, 0.06, "wood", 0, 0.5, d / 2 + 0.035, g);
    cylinder(
      0.038,
      0.038,
      0.035,
      6,
      "gold",
      0.14,
      0.54,
      d / 2 + 0.08,
      g,
    ).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) {
      box(0.4, 0.46, 0.06, "iron", sx * w * 0.29, h * 0.64, d / 2 + 0.04, g);
      box(
        0.47,
        0.07,
        0.1,
        "sand",
        sx * w * 0.29,
        h * 0.64 - 0.26,
        d / 2 + 0.06,
        g,
      );
    }
    const awning = box(
      w * 0.7,
      0.1,
      0.85,
      "grassLight",
      0,
      h * 0.45,
      d / 2 + 0.46,
      g,
    );
    awning.rotation.x = 0.11;
    for (const sx of [-1, 1])
      cylinder(
        0.038,
        0.038,
        h * 0.46,
        6,
        "wood",
        sx * w * 0.32,
        h * 0.23,
        d / 2 + 0.8,
        g,
      );
    const scaffold = new THREE.Group();
    g.add(scaffold);
    roof.userData.scaffold = scaffold;
    for (const sx of [-1, 1]) {
      box(
        0.09,
        h + 0.7,
        0.09,
        "wood",
        sx * w * 0.5,
        (h + 0.7) / 2,
        d / 2 + 0.2,
        scaffold,
      );
    }
    box(w + 1, 0.09, 0.09, "wood", 0, h + 0.4, d / 2 + 0.2, scaffold);
    return g;
  }
  house(5, 3.6, 2.2, 1.75, 2.05, -0.12, 0);
  house(7.9, 2.1, 2, 1.7, 2.9, 0.12, 1);
  house(5.6, -0.15, 1.8, 1.65, 2.5, -0.1, 2);
  // A courtyard and a gently turning tide wheel.
  cylinder(1.2, 1.2, 0.12, 12, "sand", 7, 1.57, 5);
  cylinder(0.65, 0.75, 0.5, 12, "limestone", 7, 1.88, 5);
  cylinder(0.54, 0.54, 0.04, 12, "water", 7, 2.15, 5);
  box(2.2, 0.12, 1.1, "wood", 10.2, 1.7, 4.1);
  const wheel = new THREE.Group();
  wheel.position.set(10.9, 1.05, 4.1);
  root.add(wheel);
  const wheelRim = mesh(
    new THREE.TorusGeometry(1.12, 0.11, 6, 16),
    "wood",
    0,
    0,
    0,
    wheel,
  );
  wheelRim.rotation.y = Math.PI / 2;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const spoke = box(0.12, 2.15, 0.1, "wood", 0, 0, 0, wheel);
    spoke.rotation.x = a;
    const paddle = box(
      0.85,
      0.22,
      0.32,
      "wood",
      0,
      Math.cos(a) * 1.05,
      Math.sin(a) * 1.05,
      wheel,
    );
    paddle.rotation.x = a;
  }
  // Northlight: ringed lighthouse on its own octagonal keep.
  cylinder(1.8, 2.1, 0.45, 8, "limestone", 2, 1.78, -7.3);
  for (let i = 0; i < 4; i++)
    cylinder(
      1.6 - i * 0.23,
      1.76 - i * 0.23,
      0.18,
      10,
      "sand",
      2,
      2.05 + i * 0.16,
      -7.3,
    );
  for (let i = 0; i < 5; i++)
    cylinder(
      0.78 - i * 0.035,
      0.84 - i * 0.035,
      0.84,
      12,
      i % 2 ? "terracotta" : "cream",
      2,
      2.9 + i * 0.84,
      -7.3,
    );
  box(0.48, 0.83, 0.08, "wood", 2, 2.86, -6.44);
  for (let i = 0; i < 3; i++)
    box(0.22, 0.42, 0.06, "iron", 2, 4.0 + i * 1.15, -6.56 - i * 0.04);
  cylinder(1.12, 1.08, 0.18, 12, "sand", 2, 6.95, -7.3);
  cylinder(0.76, 0.76, 1.02, 12, "glass", 2, 7.55, -7.3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cylinder(
      0.045,
      0.045,
      1.14,
      6,
      "iron",
      2 + Math.cos(a) * 0.78,
      7.55,
      -7.3 + Math.sin(a) * 0.78,
    );
    cylinder(
      0.035,
      0.035,
      0.63,
      6,
      "iron",
      2 + Math.cos(a) * 1.08,
      7.27,
      -7.3 + Math.sin(a) * 1.08,
    );
  }
  const rail = mesh(
    new THREE.TorusGeometry(1.08, 0.035, 5, 24),
    "iron",
    2,
    7.56,
    -7.3,
  );
  rail.rotation.x = Math.PI / 2;
  cylinder(0, 1.13, 1.04, 12, "roof", 2, 8.61, -7.3);
  cylinder(0.06, 0.08, 0.6, 7, "gold", 2, 9.21, -7.3);
  const lamp = mesh(
    new THREE.IcosahedronGeometry(0.41, 1),
    mats.glow,
    2,
    7.55,
    -7.3,
  );
  const beaconLight = new THREE.PointLight("#ffd58a", 0, 18, 2);
  beaconLight.position.copy(lamp.position);
  root.add(beaconLight);
  const beam = mesh(
    new THREE.ConeGeometry(2.6, 15, 28, 1, true),
    new THREE.MeshBasicMaterial({
      color: "#ffdfa1",
      transparent: true,
      opacity: 0.095,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    2,
    7.6,
    -7.3,
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.x += 7.5;
  const buoyMat = material("#e9926e");
  for (let i = 0; i < 7; i++) {
    const x = -3 + i * 2.1,
      z = 9 + Math.sin(i) * 0.5;
    const b = new THREE.Group();
    b.position.set(x, -0.23, z);
    root.add(b);
    cylinder(0.15, 0.26, 0.55, 7, buoyMat, 0, 0, 0, b);
    cylinder(0.025, 0.025, 0.5, 5, "cream", 0, 0.5, 0, b);
    floats.push(b);
  }
  function boat(x, z, turn, scale) {
    const g = new THREE.Group();
    g.position.set(x, -0.22, z);
    g.rotation.y = turn;
    g.scale.setScalar(scale);
    root.add(g);
    const hull = cylinder(0.75, 0.45, 0.45, 4, "cream", 0, 0, 0, g);
    hull.scale.z = 2.3;
    hull.rotation.y = Math.PI / 4;
    box(0.75, 0.12, 1.8, "wood", 0, 0.25, 0, g);
    cylinder(0.045, 0.06, 3.5, 6, "wood", 0, 1.9, 0, g);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0.07, 0.7);
    sailShape.lineTo(0.07, 3.5);
    sailShape.lineTo(1.6, 1);
    sailShape.closePath();
    const sail = mesh(
      new THREE.ShapeGeometry(sailShape),
      material("#f2d6ad", { side: THREE.DoubleSide }),
      0,
      0,
      0,
      g,
    );
    sail.rotation.y = 0.32;
    floats.push(g);
    return g;
  }
  boat(-12.5, 7, 0.5, 0.85);
  boat(10.5, -4, -1.1, 0.8);
  // Selectable district footprints and a thin turquoise selected ring.
  const selectedRing = mesh(
    new THREE.TorusGeometry(2.6, 0.045, 6, 64),
    new THREE.MeshBasicMaterial({ color: "#b9e5bb" }),
    -8.1,
    1.65,
    3.3,
  );
  selectedRing.rotation.x = Math.PI / 2;
  const footprints = {
    supplies: [-8.1, 3.3, 4.1],
    bridge: [-1.1, 2.3, 2.2],
    homes: [6.5, 2.1, 5.3],
    beacon: [2, -7.3, 3.3],
  };
  for (const [id, [x, z, r]] of Object.entries(footprints)) {
    const p = cylinder(
      r,
      r,
      3,
      12,
      new THREE.MeshBasicMaterial({ visible: false }),
      x,
      2,
      z,
    );
    p.userData.district = id;
    pickables.push(p);
  }
  let selected = options.selected ?? "supplies",
    beaconOn = false,
    stateViews = [];
  function setState(input = {}) {
    if (Array.isArray(input)) stateViews = input;
    else if (input.quests) stateViews = input.quests;
    const completed = new Set(
      Array.isArray(input)
        ? input.filter((q) => q.receipt).map((q) => q.id)
        : (input.completed ??
          stateViews.filter((q) => q.receipt).map((q) => q.id)),
    );
    const count = (id, oid) =>
      stateViews.find((q) => q.id === id)?.objectives.find((o) => o.id === oid)
        ?.count ?? 0;
    if (!Array.isArray(input) && input.selected) selected = input.selected;
    repairs.bridge.forEach((p, i) => {
      p.visible = completed.has("bridge") || i < count("bridge", "repair");
    });
    broken.visible = !completed.has("bridge");
    repairs.homes.forEach((p, i) => {
      p.visible = completed.has("homes") || i < count("homes", "roofs");
      p.userData.scaffold.visible = !p.visible;
    });
    crates.visible = completed.has("supplies");
    beaconOn = completed.has("beacon");
    lamp.visible = beaconOn;
    beam.visible = beaconOn;
    beaconLight.intensity = beaconOn ? 8 : 0;
    const [x, z, r] = footprints[selected] ?? footprints.supplies;
    selectedRing.position.set(x, 1.7, z);
    selectedRing.scale.setScalar(r / 2.6);
  }
  setState(options);
  return {
    root,
    pickables,
    districts: TRAILMARK_DISTRICTS,
    setState,
    select(id) {
      if (footprints[id]) {
        selected = id;
        setState({ selected: id });
      }
    },
    update(_dt, time = 0) {
      if (options.reducedMotion) return;
      floats.forEach((g, i) => {
        g.position.y = -0.2 + Math.sin(time * 1.2 + i) * 0.07;
        g.rotation.z = Math.sin(time * 0.7 + i) * 0.025;
      });
      wheel.rotation.x = time * 0.18;
      lamp.rotation.y = time * 0.6;
      if (beaconOn) beam.material.opacity = 0.08 + Math.sin(time) * 0.025;
    },
    dispose() {
      const geometries = new Set(),
        materials = new Set();
      root.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            materials.add(m),
          );
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      root.removeFromParent();
      root.clear();
    },
  };
}
