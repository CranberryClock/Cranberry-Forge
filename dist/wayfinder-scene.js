import * as THREE from "three";

export const MOONPOST_CONFIG = Object.freeze({
  width: 12,
  height: 10,
  cellSize: 1.35,
  origin: Object.freeze({ x: -8.1, z: -6.75 }),
  diagonal: "no-cut",
  defaultCost: 1,
});
export function moonpostPreset(name = "garden") {
  const edits = [];
  for (let z = 0; z < 10; z++)
    for (let x = 0; x < 12; x++) {
      let blocked = false,
        cost = 1;
      if (name === "garden") {
        blocked =
          (x === 3 && z > 0 && z < 8 && z !== 4) ||
          (x === 7 && z > 1 && z < 9 && z !== 6) ||
          (x === 9 && z === 3);
        cost = x > 3 && x < 7 && z > 5 && z < 9 ? 5 : 1;
      }
      if (name === "switchback")
        blocked =
          (x === 2 && z < 8) || (x === 5 && z > 1) || (x === 8 && z < 8);
      if (name === "sealed") blocked = x === 6;
      edits.push({ x, z, blocked, cost });
    }
  return edits;
}

/** Renderer-free, fixed 12×10 demonstration garden; the package supports arbitrary bounded grids. */
export function createWayfinderScene(stage, options = {}) {
  const root = new THREE.Group();
  root.name = "Moonpost Dispatch — Wayfinder";
  stage.scene.add(root);
  stage.scene.background = new THREE.Color("#252438");
  stage.scene.fog = new THREE.Fog("#252438", 65, 120);
  stage.camera.position.set(25, 30, 32);
  stage.camera.lookAt(0, 1.1, 0);
  if (stage.controls) {
    stage.controls.target.set(0, 1.1, 0);
    stage.controls.autoRotate = false;
    stage.controls.minDistance = 23;
    stage.controls.maxDistance = 65;
    stage.controls.maxPolarAngle = Math.PI * 0.44;
    stage.controls.update();
  }
  if (stage.bloom) {
    stage.bloom.strength = 0.35;
    stage.bloom.threshold = 1.05;
  }
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      flatShading: true,
      ...extra,
    });
  const m = {
    foundation: mat("#60577c"),
    dark: mat("#3c3d5d"),
    trim: mat("#d6b4a0"),
    stone: mat("#e2d7bc"),
    pale: mat("#f0e4cc"),
    lavender: mat("#b5a4ce"),
    violet: mat("#8b80b8"),
    mint: mat("#a4cabb"),
    leaf: mat("#749c93"),
    deepLeaf: mat("#547c78"),
    gold: mat("#e7bc75"),
    copper: mat("#c88568"),
    wood: mat("#8b7277"),
    ink: mat("#343c57"),
    path: mat("#9eeacb", { emissive: "#62af91", emissiveIntensity: 0.9 }),
    route: mat("#23796f", { emissive: "#195a50", emissiveIntensity: 0.12 }),
    glass: mat("#87c5c5", { transparent: true, opacity: 0.42 }),
    lamp: mat("#ffe6ac", { emissive: "#ffd987", emissiveIntensity: 2.1 }),
  };
  function mesh(geometry, material, x = 0, y = 0, z = 0, parent = root) {
    const o = new THREE.Mesh(geometry, material);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  const box = (w, h, d, material, x, y, z, p) =>
    mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, p);
  const cylinder = (r, r2, h, n, material, x, y, z, p) =>
    mesh(new THREE.CylinderGeometry(r, r2, h, n), material, x, y, z, p);
  const sphere = (r, material, x, y, z, p) =>
    mesh(new THREE.IcosahedronGeometry(r, 1), material, x, y, z, p);
  const hemi = new THREE.HemisphereLight("#ece7ff", "#584e70", 2.1);
  root.add(hemi);
  const sun = new THREE.DirectionalLight("#ffe7c2", 3.2);
  sun.position.set(-17, 27, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -24,
    right: 24,
    top: 24,
    bottom: -24,
    near: 1,
    far: 80,
  });
  sun.shadow.bias = -0.0006;
  root.add(sun);
  const rim = new THREE.DirectionalLight("#a4b6fa", 2.4);
  rim.position.set(18, 20, -25);
  root.add(rim);
  // A layered floating slab, with a brass seam and faceted hanging rock.
  box(19.7, 1.3, 17.1, m.foundation, 0, -0.14, 0);
  box(20.1, 0.18, 17.5, m.trim, 0, 0.61, 0);
  box(19.8, 0.15, 17.2, m.pale, 0, 0.78, 0);
  box(19.5, 0.16, 16.9, m.dark, 0, -0.91, 0);
  for (let i = 0; i < 15; i++) {
    const x = -8.7 + (i % 5) * 4.1,
      z = -6 + Math.floor(i / 5) * 5.9;
    const rock = mesh(
      new THREE.ConeGeometry(1.9 + (i % 3) * 0.28, 2.3 + (i % 4) * 0.48, 5),
      m.foundation,
      x,
      -1.5,
      z,
    );
    rock.rotation.z = Math.PI;
    rock.rotation.y = i * 0.6;
  }
  for (let i = 0; i < 12; i++) {
    box(0.42, 0.55, 0.16, m.trim, -8.8 + i * 1.6, -0.15, 8.59);
    box(0.42, 0.55, 0.16, m.trim, -8.8 + i * 1.6, -0.15, -8.59);
  }
  // Every navigable cell has a visible tile and a matching pick surface.
  const tiles = [],
    pickables = [],
    walls = [],
    grasses = [],
    tileGeo = new THREE.BoxGeometry(1.26, 0.17, 1.26),
    wallGeo = new THREE.BoxGeometry(1.17, 0.43, 1.17);
  const centers = (x, z) => ({
    x: MOONPOST_CONFIG.origin.x + (x + 0.5) * 1.35,
    y: 1.05,
    z: MOONPOST_CONFIG.origin.z + (z + 0.5) * 1.35,
  });
  for (let z = 0; z < 10; z++)
    for (let x = 0; x < 12; x++) {
      const p = centers(x, z),
        tile = mesh(tileGeo, (x + z) % 3 ? m.stone : m.pale, p.x, 0.95, p.z);
      tile.userData.cell = { x, z };
      tiles.push(tile);
      pickables.push(tile);
      const wall = new THREE.Group();
      wall.position.set(p.x, 1.05, p.z);
      wall.name = `obstacle-${x}-${z}`;
      root.add(wall);
      mesh(wallGeo, m.lavender, 0, 0.21, 0, wall);
      box(1.23, 0.09, 1.23, m.pale, 0, 0.45, 0, wall);
      sphere(0.48, (x + z) % 2 ? m.leaf : m.deepLeaf, 0, 0.82, 0, wall);
      sphere(0.25, m.mint, 0.18, 1.16, -0.05, wall);
      walls.push(wall);
      const grass = new THREE.Group();
      grass.position.set(p.x, 1.05, p.z);
      root.add(grass);
      for (let i = 0; i < 3; i++) {
        const reed = cylinder(
          0.025,
          0.037,
          0.3 + i * 0.1,
          5,
          m.violet,
          -0.28 + i * 0.25,
          0.18 + i * 0.03,
          Math.sin(i * 7) * 0.21,
          grass,
        );
        reed.rotation.z = (i - 1) * 0.2;
        sphere(
          0.095,
          m.lavender,
          -0.28 + i * 0.25,
          0.4 + i * 0.07,
          Math.sin(i * 7) * 0.21,
          grass,
        );
      }
      grasses.push(grass);
    }
  function tree(x, z, s = 1, y = 0.93) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    root.add(g);
    cylinder(0.1, 0.17, 1.6, 7, m.wood, 0, 0.7, 0, g);
    sphere(0.9, m.lavender, 0, 1.8, 0, g);
    sphere(0.58, m.violet, -0.35, 2.2, -0.15, g);
    sphere(0.44, m.pale, 0.3, 2.5, 0, g);
    return g;
  }
  [
    [-8.9, 5.9, 0.74],
    [8.9, 5.7, 0.85],
    [8.85, -5.5, 0.65],
    [-8.95, -5.6, 0.62],
    [-5.6, -7.55, 0.63],
    [1.1, -7.7, 0.7],
  ].forEach(([x, z, s]) => tree(x, z, s));
  // Sorting house sits completely beyond the grid's west boundary.
  const house = new THREE.Group();
  house.position.set(-10.9, 0.83, -1.7);
  root.add(house);
  box(3.6, 0.25, 4.2, m.trim, 0, -0.05, 0, house);
  box(2.9, 2.5, 3.7, m.pale, 0, 1.27, 0, house);
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-1.7, 0);
  roofShape.lineTo(0, 1.45);
  roofShape.lineTo(1.7, 0);
  roofShape.closePath();
  mesh(
    new THREE.ExtrudeGeometry(roofShape, { depth: 4.1, bevelEnabled: false }),
    m.violet,
    0,
    2.5,
    -2.05,
    house,
  );
  for (let i = 0; i < 8; i++) {
    const slat = box(
      3.5,
      0.055,
      0.035,
      m.lavender,
      0,
      2.65 + Math.min(i, 7 - i) * 0.31,
      -1.7 + i * 0.49,
      house,
    );
    slat.rotation.z = 0;
  }
  box(0.75, 1.45, 0.08, m.wood, 0.5, 0.75, 1.89, house);
  box(0.8, 0.8, 0.08, m.ink, -0.75, 1.63, 1.89, house);
  box(0.05, 0.82, 0.1, m.gold, -0.75, 1.63, 1.95, house);
  box(0.82, 0.05, 0.1, m.gold, -0.75, 1.63, 1.95, house);
  box(0.5, 0.85, 0.55, m.copper, 0.75, 3.7, -0.85, house);
  box(0.63, 0.14, 0.65, m.pale, 0.75, 4.15, -0.85, house);
  const envelope = new THREE.Group();
  envelope.position.set(0, 1.9, 1.99);
  envelope.scale.setScalar(0.5);
  house.add(envelope);
  box(1.1, 0.7, 0.07, m.gold, 0, 0, 0, envelope);
  const flap = new THREE.Shape();
  flap.moveTo(-0.5, 0.28);
  flap.lineTo(0, -0.07);
  flap.lineTo(0.5, 0.28);
  mesh(new THREE.ShapeGeometry(flap), m.pale, 0, 0, 0.045, envelope);
  // Copper observatory and a raised arcade outside the north edge.
  cylinder(1.8, 2.1, 0.48, 8, m.trim, 5.4, 0.85, -9.3);
  cylinder(1.5, 1.7, 2.7, 12, m.pale, 5.4, 2.35, -9.3);
  mesh(
    new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    m.copper,
    5.4,
    3.75,
    -9.3,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cylinder(
      0.045,
      0.045,
      1.8,
      6,
      m.gold,
      5.4 + Math.cos(a) * 1.57,
      2.8,
      -9.3 + Math.sin(a) * 1.57,
    );
  }
  const telescope = cylinder(0.23, 0.16, 1.7, 10, m.dark, 6, 4.85, -9.3);
  telescope.rotation.z = -1.06;
  cylinder(0.09, 0.09, 0.8, 6, m.gold, 5.4, 5.2, -9.3);
  function arch(x, z, rotation = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0.83, z);
    g.rotation.y = rotation;
    root.add(g);
    const s = new THREE.Shape();
    s.moveTo(-1.2, 0);
    s.lineTo(-1.2, 2.2);
    s.absarc(0, 2.2, 1.2, Math.PI, 0, true);
    s.lineTo(1.2, 0);
    s.lineTo(0.83, 0);
    s.lineTo(0.83, 2.2);
    s.absarc(0, 2.2, 0.83, 0, Math.PI, false);
    s.lineTo(-0.83, 0);
    s.closePath();
    mesh(
      new THREE.ExtrudeGeometry(s, {
        depth: 0.5,
        bevelEnabled: false,
        curveSegments: 12,
      }),
      m.lavender,
      0,
      0,
      -0.25,
      g,
    );
    for (const xx of [-1.03, 1.03])
      box(0.62, 0.18, 0.8, m.pale, xx, 0.12, 0, g);
    return g;
  }
  arch(-2.25, -8.8);
  arch(0.2, -8.8);
  arch(10.6, 1.6, Math.PI / 2);
  for (let i = 0; i < 7; i++)
    box(2.3, 0.21, 1.1, m.stone, 10.7 + i * 0.58, 0.83 - i * 0.21, 4.2);
  // A moon-shaped brass sign and dangling stars behind the sorting house.
  const moonShape = new THREE.Shape();
  const r = 2.0,
    offset = 0.92,
    endX = r * 0.5,
    endY = (r * Math.sqrt(3)) / 2,
    innerR = Math.hypot(endX - offset, endY);
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI / 3 + ((i / 48) * Math.PI * 4) / 3;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    if (i === 0) moonShape.moveTo(x, y);
    else moonShape.lineTo(x, y);
  }
  const lower = Math.atan2(-endY, endX - offset),
    upper = Math.atan2(endY, endX - offset) - Math.PI * 2;
  for (let i = 0; i <= 40; i++) {
    const a = lower + ((upper - lower) * i) / 40;
    moonShape.lineTo(offset + Math.cos(a) * innerR, Math.sin(a) * innerR);
  }
  moonShape.closePath();
  const moon = mesh(
    new THREE.ExtrudeGeometry(moonShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      bevelSegments: 1,
    }),
    m.gold,
    -5.6,
    8.5,
    -9.3,
  );
  moon.rotation.z = -0.23;
  cylinder(0.06, 0.08, 6.4, 7, m.dark, -5.8, 3.8, -9.5);
  for (let i = 0; i < 5; i++) {
    const star = mesh(
      new THREE.OctahedronGeometry(0.12 + (i % 2) * 0.08),
      m.lamp,
      -2 + i * 2.3,
      7 + Math.sin(i) * 0.85,
      -10.4,
    );
    star.rotation.z = 0.3 + i;
  }
  const orbit = mesh(
    new THREE.TorusGeometry(2.8, 0.025, 5, 64, Math.PI * 1.65),
    m.trim,
    -5.6,
    8.5,
    -9.3,
  );
  orbit.rotation.set(0.25, 0.2, 0.4);
  // Border lampposts have warm faceted lanterns and square planters.
  const lanterns = [];
  for (const [x, z] of [
    [-8.9, 2],
    [8.95, -1.9],
    [-3, 7.8],
    [4.8, 7.8],
  ]) {
    box(0.6, 0.22, 0.6, m.trim, x, 0.95, z);
    cylinder(0.06, 0.1, 2.8, 7, m.dark, x, 2.45, z);
    cylinder(0.38, 0.22, 0.16, 8, m.gold, x, 3.7, z);
    const l = cylinder(0.22, 0.22, 0.58, 6, m.lamp, x, 4.07, z);
    lanterns.push(l);
    cylinder(0, 0.38, 0.32, 6, m.dark, x, 4.53, z);
  }
  // Floating satellite terraces stay outside the playable rectangle.
  for (const [x, z, radius] of [
    [-13, 7.2, 1.5],
    [12.8, -7.8, 1.8],
    [3.1, 11.6, 1.45],
  ]) {
    cylinder(radius, radius * 0.7, 1, 7, m.foundation, x, -0.4, z);
    cylinder(radius * 1.03, radius * 1.03, 0.16, 7, m.trim, x, 0.18, z);
    tree(x, z, 0.7, 0.27);
  }
  const courier = new THREE.Group();
  courier.name = "moonpost-courier";
  root.add(courier);
  const body = mesh(
    new THREE.CapsuleGeometry(0.24, 0.35, 4, 8),
    m.pale,
    0,
    0.43,
    0,
    courier,
  );
  body.rotation.z = 0.04;
  const helmet = sphere(0.34, m.gold, 0, 0.91, 0, courier);
  helmet.scale.set(1, 0.87, 1);
  const visor = sphere(0.275, m.ink, 0, 0.91, 0.14, courier);
  visor.scale.set(1, 0.55, 0.65);
  for (const x of [-0.11, 0.11]) sphere(0.037, m.path, x, 0.94, 0.31, courier);
  box(0.43, 0.48, 0.22, m.copper, 0, 0.46, -0.28, courier);
  box(0.25, 0.14, 0.03, m.pale, 0, 0.53, -0.405, courier);
  for (const x of [-0.17, 0.17]) {
    const foot = box(0.18, 0.14, 0.32, m.dark, x, 0.12, 0.045, courier);
    foot.rotation.y = x;
    const arm = box(0.12, 0.33, 0.12, m.pale, x * 2, 0.49, 0, courier);
    arm.rotation.z = -x;
  }
  cylinder(0.023, 0.023, 0.31, 6, m.gold, 0.13, 1.28, 0, courier);
  sphere(0.07, m.path, 0.13, 1.48, 0, courier);
  const shadow = mesh(
    new THREE.CircleGeometry(0.4, 20),
    new THREE.MeshBasicMaterial({
      color: "#554c63",
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
    0,
    0.014,
    0,
    courier,
  );
  shadow.rotation.x = -Math.PI / 2;
  const goal = new THREE.Group();
  root.add(goal);
  const goalRing = mesh(
    new THREE.TorusGeometry(0.43, 0.06, 6, 24),
    m.gold,
    0,
    0.07,
    0,
    goal,
  );
  goalRing.rotation.x = Math.PI / 2;
  cylinder(0.035, 0.045, 1.3, 6, m.gold, 0.34, 0.69, 0, goal);
  box(0.56, 0.37, 0.055, m.lavender, 0.57, 1.16, 0, goal);
  box(0.23, 0.13, 0.06, m.pale, 0.56, 1.18, 0.03, goal);
  const routeGroup = new THREE.Group();
  root.add(routeGroup);
  let journey = [],
    segment = 0,
    progress = 0,
    onArrive = null,
    delivering = false;
  function clearRoute() {
    for (const child of [...routeGroup.children]) {
      child.geometry?.dispose();
      routeGroup.remove(child);
    }
  }
  function setGrid(snapshot) {
    if (
      snapshot.config.width !== 12 ||
      snapshot.config.height !== 10 ||
      snapshot.config.cellSize !== 1.35 ||
      snapshot.config.origin.x !== -8.1 ||
      snapshot.config.origin.z !== -6.75
    )
      throw new Error("Moonpost scene expects its fixed 12×10 display grid");
    snapshot.cells.forEach((cell, i) => {
      walls[i].visible = cell.blocked;
      grasses[i].visible = !cell.blocked && cell.cost > 1;
      tiles[i].material =
        cell.cost > 1
          ? m.violet
          : ((i % 12) + Math.floor(i / 12)) % 3
            ? m.stone
            : m.pale;
    });
    stop();
  }
  function setRoute(points) {
    clearRoute();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      cylinder(0.135, 0.135, 0.06, 10, m.route, p.x, 1.11, p.z, routeGroup);
      if (i) {
        const a = new THREE.Vector3(points[i - 1].x, 1.11, points[i - 1].z),
          b = new THREE.Vector3(p.x, 1.11, p.z),
          delta = b.clone().sub(a),
          length = delta.length();
        if (length) {
          const line = mesh(
            new THREE.CylinderGeometry(0.065, 0.065, length, 8),
            m.route,
            0,
            0,
            0,
            routeGroup,
          );
          line.position.copy(a.add(b).multiplyScalar(0.5));
          line.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            delta.normalize(),
          );
        }
      }
    }
  }
  function setCourier(point) {
    courier.position.set(point.x, 1.055, point.z);
  }
  function setGoal(point) {
    goal.position.set(point.x, 1.07, point.z);
  }
  function stop() {
    delivering = false;
    journey = [];
    segment = 0;
    progress = 0;
    onArrive = null;
  }
  function travel(points, callback) {
    stop();
    journey = points.map((p) => new THREE.Vector3(p.x, 1.055, p.z));
    if (!journey.length) return false;
    setCourier(journey[0]);
    onArrive = callback ?? null;
    if (options.reducedMotion || journey.length === 1) {
      setCourier(journey.at(-1));
      const done = onArrive;
      stop();
      done?.();
      return true;
    }
    delivering = true;
    return true;
  }
  const initial = options.snapshot ?? {
    config: MOONPOST_CONFIG,
    cells: moonpostPreset("garden"),
  };
  setGrid(initial);
  setCourier(options.start ?? centers(1, 8));
  setGoal(options.goal ?? centers(10, 1));
  if (options.route) setRoute(options.route);
  return {
    root,
    pickables,
    courier,
    setGrid,
    setRoute,
    setCourier,
    setGoal,
    travel,
    stop,
    get delivering() {
      return delivering;
    },
    update(dt, time = 0) {
      if (!options.reducedMotion) {
        moon.position.y = 8.5 + Math.sin(time * 0.5) * 0.06;
        lanterns.forEach((l, i) => {
          l.material.emissiveIntensity = 2.1 + Math.sin(time + i) * 0.08;
        });
      }
      if (!delivering) return;
      let distance = Math.max(0, Math.min(dt, 0.1)) * 3.5;
      while (distance > 0 && segment < journey.length - 1) {
        const a = journey[segment],
          b = journey[segment + 1],
          length = a.distanceTo(b),
          left = length - progress;
        if (distance >= left) {
          distance -= left;
          segment++;
          progress = 0;
          courier.position.copy(b);
        } else {
          progress += distance;
          courier.position.copy(a).lerp(b, progress / length);
          distance = 0;
        }
        courier.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      }
      if (segment >= journey.length - 1) {
        const done = onArrive;
        stop();
        done?.();
      }
    },
    dispose() {
      stop();
      sun.shadow.dispose();
      const geometries = new Set(),
        materials = new Set();
      root.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((v) =>
            materials.add(v),
          );
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      root.removeFromParent();
      root.clear();
    },
  };
}
