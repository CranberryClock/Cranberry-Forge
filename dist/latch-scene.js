import * as THREE from "three";

/** Procedural scene assets only. Safe to construct in Node without a DOM or WebGL renderer. */
export function createLatchScene() {
  const group = new THREE.Group();
  group.name = "The Meridian Observatory";
  const materials = {
    stone: new THREE.MeshStandardMaterial({
      color: "#254653",
      roughness: 0.87,
      flatShading: true,
    }),
    edge: new THREE.MeshStandardMaterial({
      color: "#142e3c",
      roughness: 0.88,
      flatShading: true,
    }),
    floor: new THREE.MeshStandardMaterial({
      color: "#55777a",
      roughness: 0.94,
    }),
    tile: new THREE.MeshStandardMaterial({ color: "#6f9090", roughness: 0.94 }),
    dark: new THREE.MeshStandardMaterial({ color: "#16343e", roughness: 0.7 }),
    brass: new THREE.MeshStandardMaterial({
      color: "#cfaa65",
      metalness: 0.65,
      roughness: 0.34,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: "#f8ce79",
      metalness: 0.42,
      roughness: 0.3,
    }),
    teal: new THREE.MeshStandardMaterial({
      color: "#2a7778",
      metalness: 0.38,
      roughness: 0.5,
    }),
    cream: new THREE.MeshStandardMaterial({ color: "#f5dec1", roughness: 0.8 }),
    rust: new THREE.MeshStandardMaterial({ color: "#de815e", roughness: 0.75 }),
    glow: new THREE.MeshStandardMaterial({
      color: "#bafbef",
      emissive: "#76c8b6",
      emissiveIntensity: 0.8,
      roughness: 0.35,
    }),
    amber: new THREE.MeshStandardMaterial({
      color: "#ffd297",
      emissive: "#e9a454",
      emissiveIntensity: 1.6,
      roughness: 0.35,
    }),
  };
  const add = (geometry, material, position = [0, 0, 0], parent = group) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (size, mat, pos, parent) =>
    add(new THREE.BoxGeometry(...size), mat, pos, parent);
  const cyl = (top, bottom, height, mat, pos, parent, segments = 48) =>
    add(
      new THREE.CylinderGeometry(top, bottom, height, segments),
      mat,
      pos,
      parent,
    );
  const ring = (radius, tube, mat, pos, parent, segments = 80) =>
    add(new THREE.TorusGeometry(radius, tube, 6, segments), mat, pos, parent);
  const rod = (from, to, radius, mat, parent = group, segments = 8) => {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      direction = b.clone().sub(a);
    const mesh = cyl(
      radius,
      radius,
      direction.length(),
      mat,
      a.clone().add(b).multiplyScalar(0.5).toArray(),
      parent,
      segments,
    );
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    return mesh;
  };
  const flatRing = (r, tube, mat, y = 0.055, parent = group) => {
    const mesh = ring(r, tube, mat, [0, y, 0], parent);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };

  // Cut stone and suspended rock make the island readable from every orbit angle.
  cyl(7.15, 7.35, 0.6, materials.stone, [0, -0.36, 0], group, 64);
  cyl(7.4, 7.4, 0.12, materials.brass, [0, -0.1, 0], group, 64);
  cyl(7.17, 7.17, 0.13, materials.floor, [0, -0.025, 0], group, 64);
  const underside = add(
    new THREE.ConeGeometry(7.05, 5.2, 11, 2),
    materials.edge,
    [0, -3.0, 0],
  );
  underside.rotation.z = Math.PI;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2,
      r = 5.6 + Math.sin(i * 3.1) * 0.7;
    const rock = add(
      new THREE.DodecahedronGeometry(0.75 + (i % 4) * 0.22),
      i % 2 ? materials.stone : materials.edge,
      [Math.cos(a) * r, -0.9 - (i % 3) * 0.45, Math.sin(a) * r],
    );
    rock.rotation.set(i * 0.4, i * 0.7, i * 0.2);
    rock.scale.y = 1.4;
  }
  flatRing(6.72, 0.025, materials.brass);
  flatRing(5.8, 0.019, materials.gold);
  flatRing(3.95, 0.02, materials.brass);
  flatRing(2.2, 0.015, materials.brass);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const tick = box(
      [i % 4 === 0 ? 0.065 : 0.03, 0.025, i % 4 === 0 ? 0.5 : 0.2],
      materials.brass,
      [Math.sin(a) * 6.2, 0.067, Math.cos(a) * 6.2],
    );
    tick.rotation.y = a;
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const stone = box(
      [1.4, 0.06, 0.65],
      i % 2 ? materials.tile : materials.floor,
      [Math.sin(a) * 4.95, 0.072, Math.cos(a) * 4.95],
    );
    stone.rotation.y = a;
  }

  // Low railings leave the working side of the island open.
  for (let i = 0; i < 18; i++) {
    const a = (i / 23) * Math.PI * 2 + 0.73;
    const x = Math.sin(a) * 6.8,
      z = Math.cos(a) * 6.8;
    cyl(0.065, 0.09, 0.72, materials.brass, [x, 0.4, z], group, 8);
    add(new THREE.SphereGeometry(0.12, 8, 6), materials.gold, [x, 0.81, z]);
    if (i < 17) {
      const b = ((i + 1) / 23) * Math.PI * 2 + 0.73;
      rod(
        [x, 0.64, z],
        [Math.sin(b) * 6.8, 0.64, Math.cos(b) * 6.8],
        0.029,
        materials.brass,
      );
    }
  }
  for (const [x, z] of [
    [-5.2, -1.5],
    [5.3, -1.2],
    [-4.5, 4.6],
    [4.8, 4.4],
  ]) {
    cyl(0.16, 0.25, 0.18, materials.brass, [x, 0.17, z], group, 8);
    cyl(0.047, 0.065, 1.65, materials.brass, [x, 0.94, z], group, 8);
    cyl(0.24, 0.24, 0.34, materials.amber, [x, 1.93, z], group, 6);
    cyl(0.03, 0.37, 0.28, materials.dark, [x, 2.23, z], group, 6);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2;
      rod(
        [x + Math.sin(a) * 0.19, 1.72, z + Math.cos(a) * 0.19],
        [x + Math.sin(a) * 0.19, 2.13, z + Math.cos(a) * 0.19],
        0.027,
        materials.brass,
      );
    }
  }

  // Clockwork telescope: stacked plinth, armillary rings and a tilted optical tube.
  const observatory = new THREE.Group();
  observatory.position.set(0, 0, -3);
  group.add(observatory);
  cyl(2.2, 2.4, 0.2, materials.dark, [0, 0.15, 0], observatory, 12);
  cyl(1.93, 2.1, 0.22, materials.brass, [0, 0.36, 0], observatory, 12);
  const pedestal = cyl(
    0.78,
    1,
    1.5,
    materials.teal,
    [0, 1.2, 0],
    observatory,
    12,
  );
  cyl(1.02, 1.02, 0.15, materials.gold, [0, 1.98, 0], observatory);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rod(
      [Math.sin(a) * 0.83, 0.48, Math.cos(a) * 0.83],
      [Math.sin(a) * 0.66, 1.94, Math.cos(a) * 0.66],
      0.045,
      materials.brass,
      observatory,
    );
  }
  const armillary = new THREE.Group();
  armillary.position.y = 3.05;
  observatory.add(armillary);
  ring(1.9, 0.065, materials.gold, [0, 0, 0], armillary);
  const oblique = ring(2.05, 0.038, materials.brass, [0, 0, 0], armillary);
  oblique.rotation.set(0.9, 0.5, 0.3);
  const equator = ring(1.96, 0.09, materials.teal, [0, 0, 0], armillary);
  equator.rotation.x = 1.3;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const tick = box(
      [0.065, i % 3 ? 0.12 : 0.22, 0.055],
      materials.gold,
      [Math.sin(a) * 1.9, Math.cos(a) * 1.9, 0.01],
      armillary,
    );
    tick.rotation.z = -a;
  }
  const telescope = new THREE.Group();
  telescope.position.set(0, 3.0, 0);
  telescope.rotation.z = -0.67;
  telescope.rotation.x = 0.58;
  observatory.add(telescope);
  cyl(0.49, 0.36, 2.9, materials.teal, [0, 0.15, 0], telescope);
  for (const y of [-1.25, -0.82, 0.74, 1.45])
    cyl(0.53, 0.53, 0.13, materials.brass, [0, y, 0], telescope);
  cyl(0.47, 0.47, 0.035, materials.glow, [0, 1.535, 0], telescope);
  cyl(0.22, 0.22, 0.5, materials.dark, [0, -1.53, 0], telescope);
  cyl(0.27, 0.27, 0.07, materials.gold, [0, -1.81, 0], telescope);
  rod([-1.4, 0.55, 0], [-1.4, 2.9, 0], 0.09, materials.brass, observatory);
  rod([1.4, 0.55, 0], [1.4, 2.9, 0], 0.09, materials.brass, observatory);
  rod([-1.4, 2.9, 0], [1.4, 2.9, 0], 0.085, materials.brass, observatory);

  // Three distinct targets, each assembled from nested, raycastable meshes.
  const fuse = new THREE.Group();
  fuse.name = "Aether fuse";
  fuse.position.set(-3.7, 0, 2.1);
  group.add(fuse);
  cyl(0.64, 0.82, 0.26, materials.dark, [0, 0.19, 0], fuse, 8);
  cyl(0.47, 0.52, 0.65, materials.teal, [0, 0.61, 0], fuse, 8);
  cyl(0.62, 0.62, 0.1, materials.brass, [0, 0.99, 0], fuse, 16);
  const fuseItem = new THREE.Group();
  fuseItem.position.y = 1.35;
  fuse.add(fuseItem);
  cyl(0.18, 0.18, 0.54, materials.glow, [0, 0, 0], fuseItem, 12);
  for (const y of [-0.31, 0.31])
    cyl(0.24, 0.24, 0.14, materials.gold, [0, y, 0], fuseItem, 8);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    rod(
      [Math.sin(a) * 0.22, -0.28, Math.cos(a) * 0.22],
      [Math.sin(a) * 0.22, 0.28, Math.cos(a) * 0.22],
      0.028,
      materials.brass,
      fuseItem,
    );
  }
  const fuseHalo = flatRing(0.94, 0.025, materials.glow, 0.12);
  fuseHalo.position.x = fuse.position.x;
  fuseHalo.position.z = fuse.position.z;

  const crank = new THREE.Group();
  crank.name = "Meridian crank";
  crank.position.set(0, 0, 0.5);
  group.add(crank);
  box([1.5, 0.22, 1.1], materials.dark, [0, 0.17, 0], crank);
  box([0.84, 0.95, 0.62], materials.teal, [0, 0.72, -0.05], crank);
  box([0.96, 0.12, 0.75], materials.brass, [0, 1.25, -0.05], crank);
  const wheel = new THREE.Group();
  wheel.position.set(0, 1.13, 0.51);
  crank.add(wheel);
  ring(0.61, 0.08, materials.gold, [0, 0, 0], wheel, 40);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rod(
      [0, 0, 0],
      [Math.sin(a) * 0.61, Math.cos(a) * 0.61, 0],
      0.035,
      materials.brass,
      wheel,
    );
    const tooth = box(
      [0.16, 0.18, 0.17],
      materials.brass,
      [Math.sin(a) * 0.67, Math.cos(a) * 0.67, 0],
      wheel,
    );
    tooth.rotation.z = -a;
  }
  rod([0, 0, -0.15], [0, 0, 0.15], 0.16, materials.gold, wheel);
  rod([0.47, 0, 0], [0.47, 0, 0.43], 0.065, materials.dark, wheel);
  const crankHalo = flatRing(1.0, 0.025, materials.glow, 0.12);
  crankHalo.position.z = crank.position.z;

  const beacon = new THREE.Group();
  beacon.name = "Dawn beacon";
  beacon.position.set(3.65, 0, 1.8);
  group.add(beacon);
  cyl(0.84, 1.0, 0.24, materials.dark, [0, 0.18, 0], beacon, 8);
  cyl(0.63, 0.72, 0.21, materials.brass, [0, 0.4, 0], beacon, 8);
  cyl(0.46, 0.58, 1.06, materials.teal, [0, 1.02, 0], beacon, 8);
  cyl(0.85, 0.6, 0.24, materials.brass, [0, 1.62, 0], beacon, 8);
  const beaconOrbMaterial = materials.glow.clone();
  beaconOrbMaterial.emissiveIntensity = 0.15;
  beaconOrbMaterial.color.set("#507779");
  const beaconOrb = add(
    new THREE.IcosahedronGeometry(0.43, 1),
    beaconOrbMaterial,
    [0, 2.14, 0],
    beacon,
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rod(
      [Math.sin(a) * 0.65, 1.68, Math.cos(a) * 0.65],
      [Math.sin(a) * 0.48, 2.65, Math.cos(a) * 0.48],
      0.04,
      materials.gold,
      beacon,
    );
  }
  cyl(0.13, 0.82, 0.45, materials.dark, [0, 2.86, 0], beacon, 6);
  cyl(0.03, 0.13, 0.5, materials.brass, [0, 3.26, 0], beacon, 6);
  ring(0.85, 0.04, materials.brass, [0, 2.13, 0], beacon);
  const beaconHalo = flatRing(1.15, 0.025, materials.glow, 0.12);
  beaconHalo.position.x = beacon.position.x;
  beaconHalo.position.z = beacon.position.z;
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: "#9bece0",
    transparent: true,
    opacity: 0.075,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = cyl(0.03, 0.46, 13, beamMaterial, [3.65, 8.7, 1.8]);
  beam.visible = false;
  beam.castShadow = false;

  // An optional physical shutter lets players inspect explicit occlusion.
  const shutter = new THREE.Group();
  shutter.position.set(0, -3.1, 1.5);
  group.add(shutter);
  box([1.9, 2.5, 0.12], materials.dark, [0, 1.25, 0], shutter);
  for (const x of [-0.9, 0.9])
    box([0.065, 2.5, 0.16], materials.gold, [x, 1.25, 0], shutter);
  for (let i = 0; i < 9; i++)
    box([1.76, 0.05, 0.16], materials.brass, [0, 0.2 + i * 0.26, 0], shutter);

  const actor = new THREE.Group();
  actor.name = "Keeper";
  actor.position.set(-3.5, 0, 4.1);
  group.add(actor);
  cyl(0.18, 0.34, 0.57, materials.rust, [0, 0.45, 0], actor, 8);
  add(
    new THREE.SphereGeometry(0.21, 12, 8),
    materials.cream,
    [0, 0.9, 0],
    actor,
  );
  cyl(0.21, 0.31, 0.12, materials.dark, [0, 1.08, 0], actor, 12);
  cyl(0.13, 0.21, 0.21, materials.dark, [0, 1.22, 0], actor, 8);
  box([0.17, 0.16, 0.27], materials.dark, [-0.16, 0.12, 0.02], actor);
  box([0.17, 0.16, 0.27], materials.dark, [0.16, 0.12, 0.02], actor);
  const pack = box(
    [0.35, 0.39, 0.18],
    materials.brass,
    [0, 0.51, -0.25],
    actor,
  );
  pack.rotation.x = -0.13;
  const reachMaterial = new THREE.MeshBasicMaterial({
    color: "#bce9cb",
    transparent: true,
    opacity: 0.23,
    depthWrite: false,
  });
  const reachRing = flatRing(3.1, 0.016, reachMaterial, 0.13);
  const marker = flatRing(0.45, 0.025, materials.gold, 0.14);

  const stars = new THREE.Group();
  group.add(stars);
  for (let i = 0; i < 30; i++) {
    const a = i * 2.39996,
      r = 9 + (i % 5) * 0.6;
    const star = add(
      new THREE.OctahedronGeometry(i % 4 === 0 ? 0.08 : 0.035),
      i % 3 ? materials.glow : materials.gold,
      [Math.cos(a) * r, Math.sin(i * 7.3) * 2.8 + 2.2, Math.sin(a) * r],
      stars,
    );
    star.castShadow = false;
  }
  for (let i = 0; i < 3; i++) {
    const r = 0.48 + i * 0.13;
    const rock = add(new THREE.DodecahedronGeometry(r, 0), materials.stone, [
      -8 - i * 0.65,
      -1.0 - i * 0.6,
      -2 + i * 2.6,
    ]);
    rock.rotation.set(i, i * 0.7, i * 0.3);
    cyl(
      r * 0.72,
      r * 0.8,
      0.08,
      materials.brass,
      [rock.position.x, rock.position.y + r * 0.75, rock.position.z],
      group,
      8,
    );
  }

  group.add(new THREE.HemisphereLight("#b8f2ed", "#24323a", 2.45));
  const key = new THREE.DirectionalLight("#ffe4b7", 4.1);
  key.position.set(-5, 13, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.normalBias = 0.045;
  group.add(key);
  const rim = new THREE.DirectionalLight("#6bbde0", 2.9);
  rim.position.set(6, 5, -8);
  group.add(rim);

  const targets = { fuse, crank, beacon };
  const aimPoints = {
    fuse: new THREE.Vector3(-3.7, 1.37, 2.1),
    crank: new THREE.Vector3(0, 1.13, 1.01),
    beacon: new THREE.Vector3(3.65, 2.14, 1.8),
  };
  const stations = {
    fuse: new THREE.Vector3(-3.5, 0, 4.1),
    crank: new THREE.Vector3(0, 0, 3.1),
    beacon: new THREE.Vector3(3.6, 0, 4.15),
  };
  function update({
    time = 0,
    dt = 0,
    focus = null,
    holding = false,
    hasFuse = false,
    charged = false,
    lit = false,
    shutterRaised = false,
    reducedMotion = false,
  } = {}) {
    fuseItem.visible = !hasFuse;
    if (!reducedMotion) {
      fuseItem.rotation.y = time * 0.7;
      fuseItem.position.y = 1.35 + Math.sin(time * 2) * 0.07;
    }
    if (holding) wheel.rotation.z -= dt * 3.2;
    armillary.rotation.y = charged && !reducedMotion ? time * 0.065 : 0;
    beaconOrbMaterial.emissiveIntensity = lit ? 3 : charged ? 1.0 : 0.15;
    beaconOrbMaterial.color.set(
      lit ? "#bdfff0" : charged ? "#9cb7a0" : "#507779",
    );
    beam.visible = lit;
    if (!reducedMotion) beaconOrb.rotation.y = time * 0.7;
    shutter.position.y = shutterRaised ? 0 : -3.1;
    for (const [id, halo] of Object.entries({
      fuse: fuseHalo,
      crank: crankHalo,
      beacon: beaconHalo,
    })) {
      halo.visible = id === focus && !(id === "fuse" && hasFuse);
    }
    reachRing.position.x = actor.position.x;
    reachRing.position.z = actor.position.z;
    marker.position.x = actor.position.x;
    marker.position.z = actor.position.z;
    stars.rotation.y = reducedMotion ? 0 : time * 0.009;
  }
  update();
  return {
    group,
    targets,
    actor,
    aimPoints,
    stations,
    occluders: [pedestal, shutter],
    shutter,
    update,
    cameraPosition: new THREE.Vector3(13, 13.5, 18.5),
    cameraTarget: new THREE.Vector3(0, 0.7, 0),
    dispose() {
      const geometries = new Set(),
        usedMaterials = new Set();
      group.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        for (const mat of Array.isArray(object.material)
          ? object.material
          : [object.material])
          if (mat) usedMaterials.add(mat);
      });
      geometries.forEach((geometry) => geometry.dispose());
      usedMaterials.forEach((mat) => mat.dispose());
      group.removeFromParent();
      group.clear();
    },
  };
}
