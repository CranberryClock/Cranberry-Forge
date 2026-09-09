import * as THREE from "three";
import { releaseObject } from "./scene.js";

export const CAMP_ITEMS = [
  {
    id: "copper",
    name: "Copper ore",
    width: 1,
    height: 1,
    maxStack: 8,
    weight: 0.6,
    color: "#da9a61",
    description: "Warm metal for the lantern housing.",
  },
  {
    id: "glass",
    name: "Skyglass",
    width: 1,
    height: 2,
    maxStack: 4,
    weight: 0.8,
    color: "#8fdee3",
    description: "A sliver of sky, caught before it fell.",
  },
  {
    id: "herb",
    name: "Moonleaf",
    width: 1,
    height: 1,
    maxStack: 6,
    weight: 0.2,
    color: "#b7d48a",
    description: "A small green argument against giving up.",
  },
  {
    id: "potion",
    name: "Dew tonic",
    width: 1,
    height: 2,
    maxStack: 3,
    weight: 0.5,
    color: "#b9a2e0",
    description: "Bottled moonleaf. Restores a courier’s resolve.",
  },
  {
    id: "blade",
    name: "Survey blade",
    width: 1,
    height: 3,
    maxStack: 1,
    weight: 2.4,
    color: "#c9d9d9",
    description: "A long tool. Rotate it to make room.",
  },
  {
    id: "lantern",
    name: "Moth lantern",
    width: 2,
    height: 2,
    maxStack: 1,
    weight: 2,
    color: "#ffd48c",
    description: "The last delivery. A light for someone still waiting.",
  },
];
export const CAMP_RECIPES = [
  {
    id: "tonic",
    name: "Brew dew tonic",
    ingredients: [{ itemId: "herb", quantity: 2 }],
    outputs: [{ itemId: "potion", quantity: 1 }],
  },
  {
    id: "lantern",
    name: "Assemble a lantern",
    ingredients: [
      { itemId: "copper", quantity: 3 },
      { itemId: "glass", quantity: 2 },
      { itemId: "herb", quantity: 1 },
    ],
    outputs: [{ itemId: "lantern", quantity: 1 }],
  },
];
export function createItemModel(id) {
  const root = new THREE.Group(),
    data = CAMP_ITEMS.find((i) => i.id === id);
  if (!data) throw new TypeError("unknown item model");
  const material = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.25 });
  const add = (geometry, color, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    root.add(m);
    return m;
  };
  if (id === "copper") {
    add(
      new THREE.DodecahedronGeometry(0.52, 0),
      data.color,
      0,
      0.5,
      0,
    ).rotation.z = 0.4;
    add(new THREE.DodecahedronGeometry(0.29, 0), "#975f45", 0.35, 0.22, 0.25);
  }
  if (id === "glass") {
    add(new THREE.OctahedronGeometry(0.55, 0), data.color, 0, 0.7).scale.set(
      0.65,
      1.5,
      0.65,
    );
    add(new THREE.OctahedronGeometry(0.3, 0), "#d1f6ef", 0.25, 0.32, 0.15);
  }
  if (id === "herb") {
    add(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 6), "#698571", 0, 0.4);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4,
        m = add(
          new THREE.SphereGeometry(0.24, 8, 5),
          i % 2 ? "#8aa675" : data.color,
          Math.cos(a) * 0.17,
          0.25 + i * 0.13,
          Math.sin(a) * 0.17,
        );
      m.scale.set(1, 0.22, 1.7);
      m.rotation.y = -a;
    }
  }
  if (id === "potion") {
    add(new THREE.SphereGeometry(0.35, 12, 8), data.color, 0, 0.4).scale.y =
      1.2;
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.35, 10), "#dce4cc", 0, 0.84);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 10), "#b78a61", 0, 1.06);
    add(
      new THREE.TorusGeometry(0.25, 0.035, 4, 18),
      "#ecdcb2",
      0,
      0.45,
    ).rotation.x = Math.PI / 2;
  }
  if (id === "blade") {
    const b = add(new THREE.BoxGeometry(0.18, 1.45, 0.08), data.color, 0, 1.03);
    b.rotation.z = -0.2;
    add(new THREE.BoxGeometry(0.56, 0.1, 0.15), "#d6b078", 0.14, 0.3);
    add(
      new THREE.CylinderGeometry(0.09, 0.1, 0.45, 8),
      "#60595a",
      0.18,
      0.11,
    ).rotation.z = -0.2;
  }
  if (id === "lantern") {
    add(new THREE.CylinderGeometry(0.4, 0.5, 0.16, 8), "#b58c62", 0, 0.1);
    add(new THREE.CylinderGeometry(0.5, 0.35, 0.22, 8), "#e6bd7f", 0, 1.02);
    for (const x of [-0.3, 0.3])
      for (const z of [-0.3, 0.3])
        add(
          new THREE.CylinderGeometry(0.035, 0.035, 0.85, 5),
          "#987552",
          x,
          0.57,
          z,
        );
    const light = add(
      new THREE.OctahedronGeometry(0.34, 0),
      data.color,
      0,
      0.57,
    );
    light.material.emissive = new THREE.Color("#ffb456");
    light.material.emissiveIntensity = 1.4;
    add(new THREE.TorusGeometry(0.23, 0.045, 6, 16), "#dfb780", 0, 1.3);
  }
  root.name = data.name;
  return root;
}
export function createCourier({ color = "#90b9b5", merchant = false } = {}) {
  const group = new THREE.Group(),
    mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const mesh = (g, c, x, y, z) => {
    const m = new THREE.Mesh(g, mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  mesh(new THREE.ConeGeometry(0.65, 1.3, 12), color, 0, 0.9, 0);
  mesh(new THREE.SphereGeometry(0.53, 16, 10), color, 0, 1.6, 0);
  const face = mesh(
    new THREE.CircleGeometry(0.34, 24),
    "#1b3037",
    0,
    1.61,
    0.555,
  );
  face.name = "Courier face";
  face.renderOrder = 2;
  for (const x of [-0.15, 0.15]) {
    const eye = mesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      "#ffe2a0",
      x,
      1.63,
      0.59,
    );
    eye.name = "Courier eyes";
    eye.renderOrder = 3;
    eye.material.emissive = new THREE.Color("#ffb873");
    eye.material.emissiveIntensity = 0.6;
    mesh(
      new THREE.CapsuleGeometry(0.15, 0.2, 3, 6),
      "#465b61",
      x * 1.8,
      0.2,
      0.14,
    );
  }
  for (const x of [-1, 1]) {
    const ear = mesh(
      new THREE.ConeGeometry(0.18, 0.65, 5),
      color,
      x * 0.29,
      2.1,
      -0.01,
    );
    ear.rotation.z = -x * 0.35;
    mesh(new THREE.SphereGeometry(0.2, 10, 6), color, x * 0.54, 0.9, 0.05);
  }
  const bag = mesh(
    new THREE.BoxGeometry(0.66, 0.72, 0.35),
    "#c29564",
    0,
    0.95,
    -0.5,
  );
  bag.rotation.z = 0.08;
  if (merchant) {
    mesh(
      new THREE.TorusGeometry(0.58, 0.06, 6, 24),
      "#e1ba80",
      0,
      1.27,
      0.02,
    ).rotation.x = Math.PI / 2;
    group.scale.setScalar(1.25);
  }
  return group;
}

export function createCampScene(stage, { mode = "satchel" } = {}) {
  const root = new THREE.Group();
  root.name = "Mothlight camp";
  stage.scene.add(root);
  stage.scene.background = new THREE.Color("#17232f");
  stage.scene.fog = new THREE.FogExp2("#17232f", 0.013);
  stage.bloom.strength = 0.35;
  stage.bloom.threshold = 1.1;
  root.add(new THREE.HemisphereLight("#dfedf2", "#485e5c", 2.1));
  const sun = new THREE.DirectionalLight("#ffd6a5", 3.3);
  sun.position.set(-9, 19, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -16,
    right: 16,
    top: 16,
    bottom: -16,
    near: 0.5,
    far: 60,
  });
  sun.shadow.normalBias = 0.06;
  root.add(sun);
  const rim = new THREE.DirectionalLight("#7eb9e0", 2);
  rim.position.set(8, 8, -12);
  root.add(rim);
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra });
  const mesh = (geometry, color, position, group = root) => {
    const m = new THREE.Mesh(geometry, mat(color));
    m.position.set(...position);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const ground = mesh(
    new THREE.CylinderGeometry(10, 8.5, 2, 64),
    "#354b53",
    [0, -1, 0],
  );
  ground.name = "Camp island";
  const turf = mesh(
    new THREE.CylinderGeometry(10.05, 10, 0.22, 64),
    "#78958b",
    [0, -0.02, 0],
  );
  turf.name = "Camp turf";
  const floor = mesh(new THREE.PlaneGeometry(200, 200), "#192a35", [0, -5, 0]);
  floor.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 25; i++) {
    const a = i * 2.4,
      r = 5 + Math.sin(i * 6.2) * 3;
    const stone = mesh(
      new THREE.DodecahedronGeometry(0.28 + (i % 3) * 0.12, 0),
      "#9aada0",
      [Math.cos(a) * r, 0.1, Math.sin(a) * r],
    );
    stone.scale.y = 0.4;
    stone.rotation.y = a;
  }
  const pickables = [],
    loot = new Map();
  const interact = (object, id, kind, position) => {
    object.position.set(...position);
    object.userData.interaction = { id, kind };
    root.add(object);
    pickables.push(object);
    return object;
  };
  const merchant = interact(
    createCourier({ merchant: true }),
    "mira",
    "talk",
    [-2, 0.08, -2],
  );
  merchant.rotation.y = 0.45;
  const canopy = new THREE.Group();
  canopy.position.set(-4, 0, -4);
  root.add(canopy);
  for (const x of [-2, 2])
    for (const z of [-1.2, 1.2])
      mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 3.9, 8),
        "#796654",
        [x, 1.9, z],
        canopy,
      );
  for (let i = 0; i < 10; i++) {
    const panel = mesh(
      new THREE.BoxGeometry(0.405, 0.08, 3),
      "#d8c4a3",
      [-1.8 + i * 0.4, 3.8 + Math.sin((i / 9) * Math.PI) * 0.45, 0],
      canopy,
    );
    panel.material.color.set(i % 2 ? "#548b88" : "#e8d6b3");
    panel.rotation.z = Math.cos((i / 9) * Math.PI) * 0.25;
  }
  mesh(new THREE.BoxGeometry(4, 0.18, 1.1), "#8a7360", [0, 1.15, 0.2], canopy);
  for (const x of [-1.5, 1.5])
    mesh(
      new THREE.BoxGeometry(0.18, 1.2, 0.7),
      "#6c6256",
      [x, 0.6, 0.2],
      canopy,
    );
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    if (a > 3.2 && a < 4.7) continue;
    const x = Math.cos(a) * 8.6,
      z = Math.sin(a) * 8.6;
    mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.6, 7), "#79715b", [
      x,
      0.75,
      z,
    ]);
    for (let j = 0; j < 3; j++)
      mesh(
        new THREE.ConeGeometry(1.05 - j * 0.23, 1.75, 7),
        ["#426962", "#568171", "#83a081"][j],
        [x, 1.9 + j * 0.65, z],
      );
  }
  const shrine = new THREE.Group();
  shrine.userData.interaction = { id: "beacon", kind: "beacon" };
  shrine.position.set(4, 0.12, -3.3);
  root.add(shrine);
  pickables.push(shrine);
  mesh(
    new THREE.CylinderGeometry(1.4, 1.6, 0.3, 8),
    "#98a6a0",
    [0, 0.1, 0],
    shrine,
  );
  mesh(
    new THREE.CylinderGeometry(0.85, 1.15, 0.5, 8),
    "#647d7b",
    [0, 0.5, 0],
    shrine,
  );
  for (const x of [-0.6, 0.6])
    for (const z of [-0.6, 0.6])
      mesh(
        new THREE.CylinderGeometry(0.07, 0.1, 2.4, 6),
        "#bda276",
        [x, 1.9, z],
        shrine,
      );
  const crystal = mesh(
    new THREE.OctahedronGeometry(0.65, 0),
    "#92c6cb",
    [0, 2, 0],
    shrine,
  );
  crystal.material.emissive = new THREE.Color("#ffbf66");
  crystal.material.emissiveIntensity = 0.1;
  mesh(
    new THREE.ConeGeometry(1.3, 0.6, 4),
    "#536c72",
    [0, 3.2, 0],
    shrine,
  ).rotation.y = Math.PI / 4;
  const halo = mesh(
    new THREE.TorusGeometry(0.9, 0.035, 6, 48),
    "#e0b57c",
    [0, 2, 0],
    shrine,
  );
  halo.rotation.x = Math.PI / 2;
  const beaconLight = new THREE.PointLight("#ffd089", 0, 15);
  beaconLight.position.set(4, 3, -3.3);
  root.add(beaconLight);
  const resourceDefs =
    mode === "satchel"
      ? [
          ["copper", -4, 3],
          ["glass", 0, 4.5],
          ["herb", 3.8, 3],
          ["potion", -5.8, 0.1],
          ["blade", 6.3, 0.3],
          ["lantern", 0.5, -5],
        ]
      : [
          ["copper", -4.5, 3.5],
          ["copper", -0.5, 6],
          ["copper", 5, 4],
          ["glass", 6, 0.8],
          ["glass", 1.2, -6],
          ["herb", -6, 0],
          ["herb", -5, 5],
        ];
  resourceDefs.forEach(([itemId, x, z], i) => {
    const marker = new THREE.Group();
    mesh(
      new THREE.CylinderGeometry(0.65, 0.8, 0.32, 8),
      "#536d70",
      [0, 0.15, 0],
      marker,
    );
    const item = createItemModel(itemId);
    item.position.y = 0.32;
    marker.add(item);
    const key = `pickup-${i}`;
    interact(marker, key, "pickup", [x, 0.12, z]);
    marker.userData.itemId = itemId;
    loot.set(key, { id: key, itemId, object: marker, model: item });
  });
  const player = createCourier({ color: "#d9b789" });
  player.position.set(0, 0.12, 2);
  if (mode === "mothlight") root.add(player);
  const motes = [];
  for (let i = 0; i < 24; i++) {
    const m = mesh(new THREE.OctahedronGeometry(0.035, 0), "#ffe2a3", [
      Math.sin(i * 3.2) * 8,
      1 + Math.sin(i) * 0.4,
      Math.cos(i * 1.5) * 7,
    ]);
    m.material.emissive = new THREE.Color("#ffc978");
    m.material.emissiveIntensity = 1.2;
    motes.push(m);
  }
  let time = 0,
    completed = false,
    selected = null;
  const paused =
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
    false;
  return {
    root,
    ground: turf,
    pickables,
    loot,
    merchant,
    player,
    select(id) {
      selected = id;
    },
    setCollected(ids) {
      const set = new Set(ids);
      for (const [id, entry] of loot) entry.object.visible = !set.has(id);
    },
    setCompleted(value) {
      completed = !!value;
      crystal.material.emissiveIntensity = completed ? 2 : 0.1;
      beaconLight.intensity = completed ? 32 : 0;
    },
    update(dt) {
      if (paused) return;
      time += dt;
      for (const [id, entry] of loot) {
        entry.model.rotation.y = time * 0.35 + (id === selected ? 0.7 : 0);
        entry.model.position.y =
          0.38 + Math.sin(time * 1.5 + entry.object.position.x) * 0.09;
      }
      crystal.rotation.y = time * 0.35;
      crystal.position.y = 2 + Math.sin(time * 1.6) * 0.1;
      halo.rotation.z = Math.sin(time * 0.6) * 0.1;
      merchant.rotation.y = 0.45 + Math.sin(time * 0.5) * 0.1;
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.position.y = 1.4 + Math.sin(time * 0.65 + i) * 0.7;
        if (completed) m.position.y += Math.abs(Math.sin(time * 0.5 + i)) * 2;
      }
    },
    dispose() {
      sun.shadow.map?.dispose();
      releaseObject(root);
    },
  };
}
