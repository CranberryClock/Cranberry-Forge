import * as THREE from "three";

export const PARCEL_COLORS = Object.freeze({
  common: "#a8bdcf",
  uncommon: "#86dbad",
  rare: "#83c9ff",
  epic: "#c3a0ff",
  legendary: "#ffd68a",
});

/** No renderer or DOM required. stage needs only scene and camera; controls/bloom are optional. */
export function createParcelScene(stage, options = {}) {
  const root = new THREE.Group();
  root.name = "Parcel — Starlight Salvage";
  stage.scene.add(root);
  stage.scene.background = new THREE.Color("#101827");
  stage.scene.fog = new THREE.Fog("#101827", 38, 90);
  stage.camera.position.set(15, 11, 19);
  stage.camera.lookAt(0, 2.3, 0);
  if (stage.controls) {
    stage.controls.target.set(0, 2.3, 0);
    stage.controls.minDistance = 17;
    stage.controls.maxDistance = 42;
    stage.controls.maxPolarAngle = 1.48;
    stage.controls.autoRotate = false;
    stage.controls.update();
  }
  if (stage.bloom) {
    stage.bloom.strength = 0.48;
    stage.bloom.threshold = 0.86;
    stage.bloom.radius = 0.65;
  }
  const materials = new Set(),
    geometries = new Set();
  const mat = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.64,
      metalness: 0.25,
      flatShading: true,
      ...extra,
    });
    materials.add(m);
    return m;
  };
  const dark = mat("#202c47"),
    edge = mat("#3e5072"),
    gold = mat("#cfa671", { metalness: 0.72, roughness: 0.3 }),
    pale = mat("#edd2a0"),
    stone = mat("#26344e"),
    blue = mat("#447898");
  const lightGold = mat("#e9be80", {
      emissive: "#f3b975",
      emissiveIntensity: 1.3,
    }),
    lightBlue = mat("#90ccff", { emissive: "#65a9ff", emissiveIntensity: 1.5 });
  const mesh = (geometry, material, parent = root, position = [0, 0, 0]) => {
    geometries.add(geometry);
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...position);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, material, parent, position) =>
    mesh(new THREE.BoxGeometry(w, h, d), material, parent, position);
  const cylinder = (top, bottom, h, segments, material, parent, position) =>
    mesh(
      new THREE.CylinderGeometry(top, bottom, h, segments),
      material,
      parent,
      position,
    );
  const torus = (r, t, material, parent, position) =>
    mesh(new THREE.TorusGeometry(r, t, 8, 80), material, parent, position);
  root.add(new THREE.HemisphereLight("#b7d8ff", "#343045", 2.7));
  const sun = new THREE.DirectionalLight("#ffe1ad", 3.4);
  sun.position.set(-8, 16, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -15,
    right: 15,
    top: 15,
    bottom: -15,
  });
  root.add(sun);
  const rim = new THREE.DirectionalLight("#869dff", 3);
  rim.position.set(5, 8, -12);
  root.add(rim);
  const floor = cylinder(6.1, 5.8, 0.55, 64, stone, root, [0, -0.55, 0]);
  cylinder(5.8, 4.8, 1.1, 12, dark, root, [0, -1.35, 0]);
  cylinder(4.8, 1.8, 2.1, 9, edge, root, [0, -2.95, 0]);
  cylinder(6.3, 6.3, 0.12, 80, gold, root, [0, -0.23, 0]);
  cylinder(5.97, 5.97, 0.17, 80, dark, root, [0, -0.1, 0]);
  for (const radius of [2.9, 4.8, 5.65]) {
    const ring = torus(
      radius,
      0.022,
      radius === 4.8 ? lightBlue : gold,
      root,
      [0, 0.015, 0],
    );
    ring.rotation.x = -Math.PI / 2;
  }
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16,
      mark = box(0.035, 0.027, i % 4 === 0 ? 0.42 : 0.17, pale, root, [
        Math.sin(a) * 5.3,
        0.018,
        Math.cos(a) * 5.3,
      ]);
    mark.rotation.y = a;
  }
  cylinder(2.65, 2.95, 0.35, 12, edge, root, [0, 0.2, 0]);
  cylinder(2.5, 2.65, 0.2, 12, gold, root, [0, 0.47, 0]);
  cylinder(2.47, 2.47, 0.16, 12, dark, root, [0, 0.63, 0]);
  const chest = new THREE.Group();
  chest.position.y = 0.75;
  root.add(chest);
  box(3.8, 1.75, 2.5, dark, chest, [0, 0.9, 0]);
  box(3.45, 1.32, 0.07, blue, chest, [0, 0.94, 1.28]);
  for (const x of [-1.86, 1.86])
    for (const z of [-1.21, 1.21])
      box(0.14, 1.9, 0.14, gold, chest, [x, 0.94, z]);
  for (const y of [0.12, 1.7]) {
    box(3.95, 0.12, 2.65, gold, chest, [0, y, 0]);
    box(3.65, 0.07, 0.055, pale, chest, [0, y, 1.37]);
  }
  for (const x of [-1.1, 1.1]) {
    box(0.13, 1.63, 2.59, gold, chest, [x, 0.9, 0]);
    box(0.07, 1.38, 0.055, pale, chest, [x, 0.88, 1.33]);
  }
  const frontGem = mesh(
    new THREE.OctahedronGeometry(0.33),
    lightBlue,
    chest,
    [0, 1.05, 1.38],
  );
  frontGem.scale.set(0.75, 1, 0.35);
  const lid = new THREE.Group();
  lid.position.set(0, 1.78, -1.25);
  chest.add(lid);
  box(4.03, 0.48, 2.7, dark, lid, [0, 0.18, 1.25]);
  for (const x of [-1.88, -1.1, 1.1, 1.88])
    box(0.13, 0.58, 2.81, gold, lid, [x, 0.18, 1.25]);
  for (const z of [-0.13, 2.63]) box(4.1, 0.12, 0.12, pale, lid, [0, 0.4, z]);
  const emblem = mesh(
    new THREE.OctahedronGeometry(0.54),
    gold,
    lid,
    [0, 0.5, 1.25],
  );
  emblem.scale.set(1, 0.2, 1);
  const crystal = new THREE.Group();
  root.add(crystal);
  const crystalMat = mat(PARCEL_COLORS.legendary, {
    emissive: PARCEL_COLORS.legendary,
    emissiveIntensity: 0.65,
    metalness: 0.25,
    roughness: 0.17,
  });
  const gem = mesh(new THREE.OctahedronGeometry(1.15), crystalMat, crystal);
  gem.scale.set(0.72, 1.48, 0.72);
  const haloMat = new THREE.MeshBasicMaterial({
    color: PARCEL_COLORS.legendary,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });
  materials.add(haloMat);
  const halo = mesh(new THREE.OctahedronGeometry(1.4), haloMat, crystal);
  halo.scale.copy(gem.scale);
  const rewardLight = new THREE.PointLight(
    PARCEL_COLORS.legendary,
    14,
    14,
    1.7,
  );
  crystal.add(rewardLight);
  const revealRing = torus(1.35, 0.016, lightGold, crystal);
  revealRing.rotation.x = Math.PI / 2;
  const back = new THREE.Group();
  back.position.set(0, 3.3, -3.5);
  back.rotation.y = 0.04;
  root.add(back);
  const astrolabe = torus(4.5, 0.11, gold, back);
  const inner = torus(4.15, 0.025, lightBlue, back);
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    const glyph = box(i % 3 === 0 ? 0.11 : 0.04, 0.24, 0.09, pale, back, [
      Math.sin(a) * 4.5,
      Math.cos(a) * 4.5,
      0,
    ]);
    glyph.rotation.z = -a;
  }
  const crescent = new THREE.Group();
  crescent.position.set(-5.9, 5.9, -4);
  crescent.rotation.z = -0.45;
  root.add(crescent);
  mesh(
    new THREE.TorusGeometry(1, 0.18, 7, 32, Math.PI * 1.45),
    lightGold,
    crescent,
  );
  const floats = [];
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 0.4 + 0.4,
      r = 7.8 + (i % 2),
      x = Math.sin(a) * r,
      z = Math.cos(a) * r;
    const island = new THREE.Group();
    island.position.set(x, -0.4 + (i % 3) * 0.5, z);
    root.add(island);
    floats.push({ object: island, y: island.position.y, phase: i });
    cylinder(0.8, 0.2, 1.8, 5, edge, island, [0, -0.9, 0]);
    cylinder(0.85, 0.8, 0.18, 8, gold, island, [0, 0.08, 0]);
    cylinder(0.6, 0.7, 0.25, 8, dark, island, [0, 0.28, 0]);
    const spire = mesh(
      new THREE.OctahedronGeometry(0.4),
      i % 2 ? lightBlue : lightGold,
      island,
      [0, 0.95, 0],
    );
    spire.scale.y = 2;
    for (let j = 0; j < 2; j++) {
      const shard = mesh(new THREE.TetrahedronGeometry(0.2), stone, island, [
        Math.sin(j * 2 + i),
        -1.9 - j * 0.4,
        Math.cos(j + i),
      ]);
      shard.rotation.set(i, j, 0.4);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.25,
      x = Math.sin(a) * 5.5,
      z = Math.cos(a) * 5.5;
    if (z < -2) continue;
    cylinder(0.19, 0.3, 0.5, 6, gold, root, [x, 0.3, z]);
    const lamp = mesh(new THREE.OctahedronGeometry(0.15), lightGold, root, [
      x,
      0.73,
      z,
    ]);
    lamp.scale.y = 1.6;
  }
  const constellation = new THREE.Group();
  root.add(constellation);
  const starGeo = new THREE.OctahedronGeometry(0.045);
  geometries.add(starGeo);
  for (let i = 0; i < 100; i++) {
    const a = i * 2.39996,
      r = 12 + (i % 19) * 0.55,
      y = 1 + ((i * 17) % 37) * 0.35;
    const star = mesh(starGeo, i % 4 ? lightBlue : lightGold, constellation, [
      Math.sin(a) * r,
      y,
      Math.cos(a) * r,
    ]);
    star.scale.setScalar(0.7 + (i % 4) * 0.4);
  }
  const ribbon = torus(8.8, 0.025, gold, root, [0, 1.1, 0]);
  ribbon.rotation.set(Math.PI / 2 - 0.17, 0.14, 0.4);
  const motes = [];
  for (let i = 0; i < 22; i++) {
    const m = mesh(new THREE.OctahedronGeometry(0.045), lightGold, root);
    motes.push(m);
  }
  let openness = options.opened === false ? 0 : 1,
    targetOpen = openness,
    phase = 0,
    disposed = false;
  function setState({ rarity = "legendary", opened = true } = {}) {
    const color = PARCEL_COLORS[rarity] ?? PARCEL_COLORS.rare;
    crystalMat.color.set(color);
    crystalMat.emissive.set(color);
    haloMat.color.set(color);
    rewardLight.color.set(color);
    openness = opened ? 1 : 0;
    targetOpen = openness;
    layout(0);
  }
  function layout(time) {
    lid.rotation.x = -1.18 * openness;
    crystal.visible = openness > 0.02;
    crystal.position.set(0, 2.2 + openness * 2.8, 0);
    if (!options.reducedMotion) {
      crystal.position.y += Math.sin(time * 1.5) * 0.12 * openness;
      crystal.rotation.y = time * 0.32;
      halo.rotation.y = -time * 0.15;
    }
    crystal.scale.setScalar(0.2 + 0.8 * openness);
    rewardLight.intensity = 12 * openness;
    motes.forEach((m, i) => {
      const a = i * 2.3999 + time * 0.3,
        r = 0.9 + (i % 5) * 0.23;
      m.position.set(
        Math.cos(a) * r,
        2.3 + ((time * 0.4 + i * 0.17) % 2.8) * openness,
        Math.sin(a) * r,
      );
      m.visible = openness > 0.2;
    });
  }
  setState({
    rarity: options.rarity ?? "legendary",
    opened: options.opened ?? true,
  });
  return {
    root,
    pickables: [frontGem, floor],
    setState,
    reveal(receipt) {
      setState({ rarity: receipt.rarity, opened: false });
      targetOpen = 1;
      phase = 0;
      if (options.reducedMotion) {
        openness = 1;
        layout(0);
      }
    },
    reset() {
      setState({ rarity: "legendary", opened: false });
    },
    update(dt, time = 0) {
      if (disposed) return;
      phase += dt;
      if (options.reducedMotion) {
        layout(0);
        return;
      }
      if (targetOpen > openness) openness = Math.min(1, phase / 1.1);
      layout(time);
      floats.forEach((f) => {
        f.object.position.y = f.y + Math.sin(time * 0.7 + f.phase) * 0.15;
      });
      inner.rotation.z = time * 0.025;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      sun.shadow.map?.dispose();
      root.removeFromParent();
      root.clear();
    },
  };
}
