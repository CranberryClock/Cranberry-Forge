import * as THREE from "three";
import { Loom, createLoomSample } from "./packages/loom/index.js";

export const LOOM_PRESETS = {
  skyloop: {
    name: "The cloudline",
    subtitle: "A long way around, above it all.",
    closed: true,
    points: [
      [-8, 2.3, 0],
      [-7, 2.8, -5],
      [-1, 3.2, -6.4],
      [6, 2.3, -4],
      [8.2, 1.7, 2.5],
      [3, 2, 6],
      [-4.5, 2.1, 5],
    ],
  },
  switchback: {
    name: "Canyon crossing",
    subtitle: "One careful crossing through the clouds.",
    closed: false,
    points: [
      [-9, 2, 3],
      [-7, 2.2, -3],
      [-2.3, 3, -4],
      [1.1, 2.6, 2.7],
      [5.3, 2, 4],
      [9, 3.5, -3],
    ],
  },
  overpass: {
    name: "The figure eight",
    subtitle: "Two loops. One winding thread.",
    closed: true,
    points: [
      [-8, 2, 0],
      [-5.7, 2, -4.8],
      [0, 2.5, 0],
      [5.7, 4.5, 4.8],
      [8, 4.4, 0],
      [5.6, 4.2, -4.8],
      [0, 4.7, 0],
      [-5.7, 2.8, 4.8],
    ],
  },
};

/** Pure procedural assets: constructing this factory needs neither DOM nor WebGL. */
export function createLoomScene({ preset = "skyloop", options = {} } = {}) {
  if (!LOOM_PRESETS[preset]) throw new RangeError("Unknown railway preset");
  const group = new THREE.Group();
  group.name = "Cloudline Railway";
  const mat = {
    rock: new THREE.MeshStandardMaterial({
      color: "#365b64",
      flatShading: true,
      roughness: 0.92,
    }),
    rockDark: new THREE.MeshStandardMaterial({
      color: "#25404d",
      flatShading: true,
      roughness: 0.92,
    }),
    earth: new THREE.MeshStandardMaterial({
      color: "#75918b",
      roughness: 0.95,
    }),
    grass: new THREE.MeshStandardMaterial({
      color: "#b5ba85",
      roughness: 0.92,
    }),
    wood: new THREE.MeshStandardMaterial({ color: "#9b7357", roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({
      color: "#28434c",
      roughness: 0.55,
      metalness: 0.55,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: "#e5c48b",
      metalness: 0.5,
      roughness: 0.32,
    }),
    cream: new THREE.MeshStandardMaterial({ color: "#eddbc0", roughness: 0.8 }),
    teal: new THREE.MeshStandardMaterial({
      color: "#438a87",
      metalness: 0.18,
      roughness: 0.7,
    }),
    red: new THREE.MeshStandardMaterial({ color: "#ee9169", roughness: 0.64 }),
    glass: new THREE.MeshStandardMaterial({
      color: "#91d1c6",
      emissive: "#447a72",
      emissiveIntensity: 0.18,
      roughness: 0.2,
    }),
    pine: new THREE.MeshStandardMaterial({
      color: "#4b8079",
      flatShading: true,
      roughness: 1,
    }),
    cloud: new THREE.MeshStandardMaterial({
      color: "#9ab7b7",
      flatShading: true,
      roughness: 1,
    }),
  };
  const add = (geometry, material, xyz, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...xyz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (size, material, xyz, parent) =>
    add(new THREE.BoxGeometry(...size), material, xyz, parent);
  const cylinder = (a, b, h, material, xyz, parent, n = 12) =>
    add(new THREE.CylinderGeometry(a, b, h, n), material, xyz, parent);
  const rod = (a, b, radius, material, parent = group) => {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      direction = end.clone().sub(start);
    const mesh = cylinder(
      radius,
      radius,
      direction.length(),
      material,
      start.add(end).multiplyScalar(0.5).toArray(),
      parent,
      6,
    );
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    return mesh;
  };
  function island(x, y, z, radius, seed) {
    cylinder(radius * 0.93, radius, 0.32, mat.earth, [x, y, z], group, 10);
    cylinder(
      radius * 0.89,
      radius * 0.93,
      0.07,
      mat.grass,
      [x, y + 0.2, z],
      group,
      10,
    );
    const rock = add(
      new THREE.ConeGeometry(radius, radius * 2.2, 9, 2),
      mat.rockDark,
      [x, y - radius * 1.12, z],
    );
    rock.rotation.z = Math.PI;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2,
        r = radius * 0.75;
      const chunk = add(
        new THREE.DodecahedronGeometry(radius * (0.21 + (i % 3) * 0.06)),
        i % 2 ? mat.rock : mat.rockDark,
        [x + Math.cos(a) * r, y - 0.25 - (i % 3) * 0.3, z + Math.sin(a) * r],
      );
      chunk.scale.y = 1.8;
      chunk.rotation.set(seed + i, i * 0.8, i * 0.1);
    }
  }
  island(-5.3, 0.3, -0.9, 3.1, 1);
  island(5.1, 0.15, 0.6, 2.9, 3);
  island(-1.2, -2.1, -7.7, 1.35, 5);
  island(1.5, -2.4, 8.1, 1.2, 4);
  for (let i = 0; i < 7; i++)
    island(
      Math.sin(i * 7) * 11,
      -3.4 - (i % 3),
      Math.cos(i * 6.7) * 8,
      0.35 + (i % 2) * 0.2,
      i,
    );
  for (const [x, y, z, s] of [
    [-6.6, 0.7, -2, 1],
    [-4.3, 0.7, -2.4, 0.8],
    [-3.6, 0.7, -0.4, 0.6],
    [6.5, 0.6, -0.4, 1.15],
    [5.1, 0.6, -1.1, 0.8],
    [6.7, 0.6, 1.7, 0.65],
    [-1.2, -1.7, -7.7, 0.7],
  ]) {
    cylinder(0.06 * s, 0.11 * s, s, mat.wood, [x, y + s * 0.45, z]);
    for (let j = 0; j < 3; j++)
      add(new THREE.ConeGeometry((0.62 - j * 0.13) * s, 1.1 * s, 7), mat.pine, [
        x,
        y + (0.95 + j * 0.4) * s,
        z,
      ]);
  }
  // The workshop and station exist as modeled objects, independent of the route.
  const workshop = new THREE.Group();
  workshop.position.set(-5.4, 0.61, 1);
  workshop.rotation.y = 0.25;
  group.add(workshop);
  box([2.2, 0.18, 2.1], mat.wood, [0, 0.05, 0], workshop);
  box([1.75, 1.4, 1.5], mat.cream, [0, 0.86, 0], workshop);
  for (const x of [-0.88, 0.88])
    for (const z of [-0.76, 0.76])
      box([0.09, 1.5, 0.09], mat.wood, [x, 0.86, z], workshop);
  for (const x of [-0.51, 0.51]) {
    const roof = box([1.22, 0.13, 1.94], mat.teal, [x, 1.92, 0], workshop);
    roof.rotation.z = x < 0 ? 0.48 : -0.48;
  }
  box([0.42, 0.86, 0.06], mat.wood, [0, 0.58, 0.78], workshop);
  for (const x of [-0.59, 0.59]) {
    box([0.4, 0.49, 0.07], mat.gold, [x, 1, 0.79], workshop);
    box([0.31, 0.4, 0.08], mat.glass, [x, 1, 0.83], workshop);
  }
  box([0.23, 0.64, 0.3], mat.rock, [0.58, 2.28, -0.35], workshop);
  for (let i = 0; i < 4; i++)
    box([0.8, 0.06, 0.17], mat.wood, [0, 0.1, 1.2 + i * 0.22], workshop);
  const waterTower = new THREE.Group();
  waterTower.position.set(4.7, 0.65, 0.7);
  group.add(waterTower);
  for (const x of [-0.52, 0.52])
    for (const z of [-0.52, 0.52])
      rod([x * 1.25, 0, z * 1.25], [x, 2.3, z], 0.055, mat.wood, waterTower);
  cylinder(0.85, 0.75, 1.2, mat.teal, [0, 2.6, 0], waterTower, 16);
  for (const y of [2.1, 2.65, 3.13])
    cylinder(0.87, 0.87, 0.06, mat.gold, [0, y, 0], waterTower, 16);
  cylinder(0.04, 0.93, 0.43, mat.steel, [0, 3.37, 0], waterTower, 16);
  for (let i = 0; i < 10; i++)
    rod(
      [-0.61, i * 0.27, 0.71],
      [-0.2, i * 0.27, 0.71],
      0.025,
      mat.gold,
      waterTower,
    );
  for (const x of [-0.61, -0.2])
    rod([x, 0, 0.71], [x, 2.8, 0.71], 0.027, mat.gold, waterTower);
  const clouds = new THREE.Group();
  group.add(clouds);
  for (let i = 0; i < 18; i++) {
    const a = i * 2.399,
      r = 9 + (i % 3) * 1.3;
    const cloud = add(
      new THREE.IcosahedronGeometry(0.9 + (i % 3) * 0.3, 1),
      mat.cloud,
      [Math.sin(a) * r, -4.3 + Math.sin(i * 3) * 1.1, Math.cos(a) * r],
      clouds,
    );
    cloud.scale.set(2.2, 0.45, 1);
    cloud.castShadow = false;
  }
  const balloon = new THREE.Group();
  balloon.position.set(-9, 5.6, -6.2);
  group.add(balloon);
  const envelope = add(
    new THREE.SphereGeometry(0.92, 12, 10),
    mat.red,
    [0, 0, 0],
    balloon,
  );
  envelope.scale.y = 1.3;
  for (const x of [-0.35, 0.35])
    rod([x, -0.92, 0], [x * 0.6, -1.67, 0], 0.015, mat.gold, balloon);
  box([0.49, 0.3, 0.39], mat.wood, [0, -1.74, 0], balloon);

  const chosen = LOOM_PRESETS[preset];
  const loom = new Loom(
    {
      points: chosen.points,
      closed: chosen.closed,
      width: 1.4,
      segments: 160,
      borderWidth: 0.085,
      borderHeight: 0.11,
      ...options,
    },
    { surface: mat.steel, borders: mat.gold },
  );
  group.add(loom);
  const details = new THREE.Group();
  details.name = "Sleepers and trestles";
  group.add(details);
  function clearDetails() {
    const geometries = new Set();
    details.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
    });
    geometries.forEach((g) => g.dispose());
    details.clear();
  }
  function rebuildDetails() {
    clearDetails();
    const count = Math.min(300, Math.max(2, Math.floor(loom.length / 0.48)));
    for (let i = 0; i <= count; i++) {
      const sample = loom.sample(i / count);
      const tie = box(
        [sample.width + 0.38, 0.095, 0.17],
        mat.wood,
        sample.position.clone().addScaledVector(sample.up, -0.04).toArray(),
        details,
      );
      tie.quaternion.copy(sample.quaternion);
      if (i % 6 === 0) {
        const top = sample.position.clone().addScaledVector(sample.up, -0.2),
          low = top.clone();
        low.y = -1.75 - Math.sin(i) * 0.8;
        if (top.y > low.y) {
          rod(
            top.clone().addScaledVector(sample.right, -0.5).toArray(),
            low.clone().addScaledVector(sample.right, -0.8).toArray(),
            0.075,
            mat.wood,
            details,
          );
          rod(
            top.clone().addScaledVector(sample.right, 0.5).toArray(),
            low.clone().addScaledVector(sample.right, 0.8).toArray(),
            0.075,
            mat.wood,
            details,
          );
          rod(
            top.clone().addScaledVector(sample.right, -0.5).toArray(),
            low.clone().addScaledVector(sample.right, 0.8).toArray(),
            0.043,
            mat.gold,
            details,
          );
          rod(
            top.clone().addScaledVector(sample.right, 0.5).toArray(),
            low.clone().addScaledVector(sample.right, -0.8).toArray(),
            0.043,
            mat.gold,
            details,
          );
        }
      }
      if (i % 20 === 0) {
        const sign = new THREE.Group();
        sign.position
          .copy(sample.position)
          .addScaledVector(sample.right, sample.width / 2 + 0.3);
        sign.quaternion.copy(sample.quaternion);
        details.add(sign);
        cylinder(0.035, 0.045, 1, mat.gold, [0, 0.45, 0], sign, 6);
        box([0.35, 0.16, 0.06], mat.cream, [0, 1, 0], sign);
      }
    }
  }
  function carriage(engine) {
    const root = new THREE.Group();
    group.add(root);
    box([1.18, 0.19, engine ? 1.9 : 1.65], mat.steel, [0, 0.32, 0], root);
    if (engine) {
      const boiler = cylinder(
        0.36,
        0.36,
        0.95,
        mat.red,
        [0, 0.75, 0.27],
        root,
        16,
      );
      boiler.rotation.x = Math.PI / 2;
      box([1, 0.83, 0.72], mat.red, [0, 0.91, -0.6], root);
      box([1.18, 0.1, 0.9], mat.teal, [0, 1.39, -0.6], root);
      for (const x of [-0.51, 0.51])
        box([0.035, 0.36, 0.4], mat.glass, [x, 1.08, -0.6], root);
      cylinder(0.17, 0.1, 0.49, mat.steel, [0, 1.18, 0.49], root);
      cylinder(0.2, 0.2, 0.065, mat.gold, [0, 1.44, 0.49], root);
      const light = cylinder(0.12, 0.12, 0.1, mat.cream, [0, 0.8, 0.81], root);
      light.rotation.x = Math.PI / 2;
      for (const z of [-0.02, 0.62]) {
        const belt = new THREE.Mesh(
          new THREE.TorusGeometry(0.365, 0.024, 5, 20),
          mat.gold,
        );
        belt.position.set(0, 0.75, z);
        root.add(belt);
      }
    } else {
      box([1.02, 0.61, 1.39], mat.cream, [0, 0.7, 0], root);
      for (const x of [-0.52, 0.52])
        for (const z of [-0.4, 0, 0.4])
          box([0.03, 0.3, 0.29], mat.glass, [x, 0.83, z], root);
      box([1.2, 0.14, 1.65], mat.teal, [0, 1.12, 0], root);
    }
    for (const x of [-0.7, 0.7])
      for (const z of [-0.59, 0.59]) {
        const wheel = cylinder(
          0.21,
          0.21,
          0.11,
          mat.steel,
          [x, 0.23, z],
          root,
          12,
        );
        wheel.rotation.z = Math.PI / 2;
        const hub = cylinder(
          0.065,
          0.065,
          0.125,
          mat.gold,
          [x, 0.23, z],
          root,
          8,
        );
        hub.rotation.z = Math.PI / 2;
      }
    return root;
  }
  const train = carriage(true),
    coaches = [carriage(false), carriage(false)],
    sampleTarget = createLoomSample();
  let distance = 5,
    disposed = false;
  function placeTrain() {
    for (const [i, car] of [train, ...coaches].entries()) {
      let d = distance - i * 2.05,
        reverse = false;
      if (!loom.options.closed) {
        const period = loom.length * 2;
        d = ((d % period) + period) % period;
        reverse = d > loom.length;
        if (reverse) d = period - d;
      }
      loom.sampleDistance(d, sampleTarget);
      car.position
        .copy(sampleTarget.position)
        .addScaledVector(sampleTarget.up, 0.075);
      car.quaternion.copy(sampleTarget.quaternion);
      if (reverse) car.rotateY(Math.PI);
      car.scale.x = Math.min(1.7, sampleTarget.width / 1.4);
    }
  }
  rebuildDetails();
  placeTrain();
  group.add(new THREE.HemisphereLight("#d2efe3", "#2d4854", 2.6));
  const sun = new THREE.DirectionalLight("#ffddab", 4.2);
  sun.position.set(-6, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -15,
    right: 15,
    top: 15,
    bottom: -15,
  });
  sun.shadow.normalBias = 0.05;
  group.add(sun);
  const rim = new THREE.DirectionalLight("#86c8dd", 2.7);
  rim.position.set(8, 8, -12);
  group.add(rim);
  return {
    group,
    loom,
    train,
    coaches,
    cameraPosition: new THREE.Vector3(24, 22, 27),
    cameraTarget: new THREE.Vector3(0, 0.8, 0),
    configure(patch) {
      if (disposed) throw new Error("Scene disposed");
      loom.configure(patch);
      rebuildDetails();
      placeTrain();
    },
    setPreset(id) {
      const p = LOOM_PRESETS[id];
      if (!p) throw new RangeError("Unknown railway preset");
      this.configure({ points: p.points, closed: p.closed });
    },
    update(
      dt = 0,
      { playing = true, speed = 2.2, reducedMotion = false } = {},
    ) {
      if (disposed) return;
      if (playing && !reducedMotion) distance += Math.max(0, dt) * speed;
      placeTrain();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loom.dispose();
      const geometries = new Set();
      group.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
      });
      geometries.forEach((g) => g.dispose());
      Object.values(mat).forEach((m) => m.dispose());
      group.removeFromParent();
      group.clear();
    },
  };
}
