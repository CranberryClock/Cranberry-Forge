import * as THREE from "three";

const TAU = Math.PI * 2;
const COLORS = { blink: "#b1b8ff", bloom: "#a2edc8", meteor: "#ffc788" };
export const SPELLS = Object.freeze([
  Object.freeze({
    id: "blink",
    name: "Comet step",
    charges: 3,
    recharge: 3.5,
    cooldown: 0.25,
    usesGlobalCooldown: true,
    key: "1",
    color: COLORS.blink,
  }),
  Object.freeze({
    id: "bloom",
    name: "Verdant pulse",
    charges: 2,
    recharge: 5,
    cooldown: 0.6,
    usesGlobalCooldown: true,
    key: "2",
    color: COLORS.bloom,
  }),
  Object.freeze({
    id: "meteor",
    name: "Starfall",
    charges: 1,
    recharge: 8,
    cooldown: 0,
    usesGlobalCooldown: true,
    key: "3",
    color: COLORS.meteor,
  }),
]);

/** Native Three.js assets and spell visuals. No renderer or DOM is created. */
export function createTempoScene(stage, { reducedMotion = false } = {}) {
  const root = new THREE.Group();
  root.name = "Tempo · The Spellgarden";
  stage.scene.add(root);
  stage.scene.background = new THREE.Color("#1b2839");
  stage.scene.fog = new THREE.FogExp2("#1b2839", 0.01);
  stage.camera.position.set(21, 24, 30);
  stage.camera.lookAt(0, 1, 0);
  if (stage.bloom) stage.bloom.strength = reducedMotion ? 0.14 : 0.3;
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...extra });
  const materials = {
    stone: mat("#6a8992"),
    dark: mat("#2c4d62"),
    tip: mat("#253c54"),
    floor: mat("#d4cbb1"),
    tile: mat("#efe5c8"),
    gold: mat("#be9d67", { metalness: 0.4, roughness: 0.4 }),
    mint: mat("#559f9f"),
    leaf: mat("#73b9a9"),
    purple: mat("#676797"),
    pink: mat("#d6a6c7"),
    blossom: mat("#edc4d8"),
    bark: mat("#776365"),
    water: mat("#457e96", { roughness: 0.28, metalness: 0.2 }),
    cream: mat("#fff0d8"),
    cloak: mat("#7574a3"),
    shadow: mat("#313d54"),
  };
  const glowing = (color, intensity = 1.05) =>
    mat(color, {
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.35,
    });
  const lightMats = Object.fromEntries(
    Object.entries(COLORS).map(([id, color]) => [id, glowing(color)]),
  );
  const basic = (color, opacity = 1) =>
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity === 1,
    });
  function mesh(geometry, material, position = [0, 0, 0], parent = root) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  const box = (size, material, position, parent) =>
    mesh(new THREE.BoxGeometry(...size), material, position, parent);
  const cylinder = (
    top,
    bottom,
    height,
    material,
    position,
    parent = root,
    segments = 48,
  ) =>
    mesh(
      new THREE.CylinderGeometry(top, bottom, height, segments),
      material,
      position,
      parent,
    );
  function ring(
    radius,
    thickness,
    material,
    position = [0, 0.07, 0],
    parent = root,
  ) {
    const object = mesh(
      new THREE.RingGeometry(
        radius - thickness / 2,
        radius + thickness / 2,
        80,
      ),
      material,
      position,
      parent,
    );
    object.rotation.x = -Math.PI / 2;
    return object;
  }
  function rod(a, b, thickness, material, parent = root) {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      delta = to.clone().sub(from);
    const object = cylinder(
      thickness,
      thickness * 1.2,
      delta.length(),
      material,
      from.clone().add(to).multiplyScalar(0.5).toArray(),
      parent,
      8,
    );
    object.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return object;
  }
  root.add(new THREE.HemisphereLight("#e7ddff", "#435969", 2.4));
  const sunlight = new THREE.DirectionalLight("#ffe6c1", 3.5);
  sunlight.position.set(-14, 24, 16);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, {
    left: -17,
    right: 17,
    top: 17,
    bottom: -17,
    near: 0.5,
    far: 70,
  });
  sunlight.shadow.normalBias = 0.035;
  root.add(sunlight);
  const rimlight = new THREE.DirectionalLight("#aeacff", 2.1);
  rimlight.position.set(6, 9, -15);
  root.add(rimlight);

  cylinder(10.2, 8.1, 2.2, materials.stone, [0, -1.45, 0], root, 14).name =
    "Spellgarden island upper stratum";
  cylinder(8.1, 3.0, 3.7, materials.dark, [0, -4.4, 0], root, 11).name =
    "Spellgarden island lower stratum";
  cylinder(3, 0.6, 2.2, materials.tip, [0, -7.35, 0], root, 7).name =
    "Spellgarden island suspended tip";
  const ground = cylinder(
    10,
    10,
    0.4,
    materials.floor,
    [0, -0.15, 0],
    root,
    96,
  );
  ground.name = "Spellgarden marble disc";
  ring(9.65, 0.11, materials.gold);
  ring(5.1, 0.07, materials.gold);
  ring(3.65, 0.05, materials.mint);
  cylinder(2.9, 2.9, 0.075, materials.tile, [0, 0.065, 0], root, 64).name =
    "Spellgarden central practice disc";
  ring(2.65, 0.065, materials.gold, [0, 0.11, 0]);
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * TAU;
    const inlay = box(
      [0.12, 0.02, 0.55],
      i % 2 ? materials.mint : materials.gold,
      [Math.sin(angle) * 3.15, 0.08, Math.cos(angle) * 3.15],
    );
    inlay.rotation.y = angle;
  }
  // Crescent pools leave clear practice space through the center.
  for (const sign of [-1, 1]) {
    const pond = mesh(
      new THREE.RingGeometry(
        5.8,
        8.65,
        40,
        1,
        sign < 0 ? 0.18 : Math.PI + 0.18,
        Math.PI * 0.7,
      ),
      materials.water,
      [0, 0.07, 0],
    );
    pond.rotation.x = -Math.PI / 2;
    pond.name = "Spellgarden crescent pool";
    for (let i = 0; i < 8; i++) {
      const angle = (sign < 0 ? 0.4 : Math.PI + 0.4) + i * 0.22;
      const lily = mesh(
        new THREE.CircleGeometry(0.28, 16, 0.25, TAU - 0.5),
        materials.leaf,
        [
          Math.cos(angle) * (6.4 + (i % 3) * 0.5),
          0.09,
          -Math.sin(angle) * (6.4 + (i % 3) * 0.5),
        ],
      );
      lily.rotation.x = -Math.PI / 2;
      mesh(new THREE.OctahedronGeometry(0.11), materials.blossom, [
        lily.position.x,
        0.2,
        lily.position.z,
      ]);
    }
  }
  for (let i = 0; i < 7; i++) {
    const paving = box(
      [1.8, 0.13, 0.72],
      i % 2 ? materials.tile : materials.floor,
      [0, 0.105, 3.7 + i * 0.8],
    );
    paving.rotation.y = ((i % 2) - 0.5) * 0.035;
  }

  const tree = new THREE.Group();
  tree.name = "Spellgarden rosewood tree";
  tree.position.set(-3.2, 0.07, -5.8);
  root.add(tree);
  rod([0, 0, 0], [0.4, 3.4, 0], 0.3, materials.bark, tree);
  rod([0.2, 1.7, 0], [-1.5, 3.7, 0.4], 0.18, materials.bark, tree);
  rod([0.3, 2.2, 0], [1.5, 4.2, -0.3], 0.18, materials.bark, tree);
  rod([0.4, 3, 0], [0.15, 4.6, 0.4], 0.16, materials.bark, tree);
  for (let i = 0; i < 17; i++) {
    const angle = i * 2.39996,
      radius = 0.5 + (i % 4) * 0.45;
    const blossom = mesh(
      new THREE.IcosahedronGeometry(0.7 + (i % 3) * 0.16, 1),
      i % 3 ? materials.pink : materials.blossom,
      [
        Math.cos(angle) * radius + 0.2,
        3.75 + Math.sin(i * 2) * 0.65,
        Math.sin(angle) * radius * 0.8,
      ],
      tree,
    );
    blossom.scale.set(1.15, 0.74, 1);
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i * TAU) / 8;
    rod(
      [0, 0.2, 0],
      [Math.cos(angle) * 1.1, 0.02, Math.sin(angle) * 0.8],
      0.085,
      materials.bark,
      tree,
    );
  }
  // An open brass astrolabe stands among slender arcades.
  const astrolabe = new THREE.Group();
  astrolabe.name = "Spellgarden astrolabe";
  astrolabe.position.set(4.6, 3.0, -4.5);
  root.add(astrolabe);
  cylinder(0.9, 1.1, 0.3, materials.tile, [4.6, 0.23, -4.5]);
  cylinder(0.23, 0.4, 1.8, materials.gold, [4.6, 1.25, -4.5]);
  mesh(
    new THREE.TorusGeometry(1.48, 0.065, 8, 72),
    materials.gold,
    [0, 0, 0],
    astrolabe,
  );
  const tilted = mesh(
    new THREE.TorusGeometry(1.18, 0.04, 8, 72),
    materials.gold,
    [0, 0, 0],
    astrolabe,
  );
  tilted.rotation.y = 0.85;
  tilted.rotation.x = 0.4;
  const star = mesh(
    new THREE.OctahedronGeometry(0.47),
    lightMats.blink,
    [0, 0, 0],
    astrolabe,
  );
  for (let i = 0; i < 7; i++) {
    const angle = -Math.PI * 0.82 + (i / 6) * Math.PI * 0.95,
      x = Math.sin(angle) * 9.4,
      z = Math.cos(angle) * 9.4;
    cylinder(
      0.25,
      0.33,
      2.6 + (i % 2) * 0.7,
      materials.tile,
      [x, 1.45 + (i % 2) * 0.35, z],
      root,
      8,
    );
    cylinder(
      0.44,
      0.44,
      0.15,
      materials.gold,
      [x, 2.84 + (i % 2) * 0.7, z],
      root,
      8,
    );
    mesh(new THREE.OctahedronGeometry(0.22), lightMats.bloom, [
      x,
      3.23 + (i % 2) * 0.7,
      z,
    ]);
  }
  // A low garden wall and faceted shrubs catch the warm side light.
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * TAU,
      radius = 9.3;
    if (Math.abs(Math.sin(angle)) < 0.3 && Math.cos(angle) > 0) continue;
    const wall = box([1.05, 0.36, 0.38], materials.tile, [
      Math.sin(angle) * radius,
      0.24,
      Math.cos(angle) * radius,
    ]);
    wall.rotation.y = angle;
    if (i % 3 === 0) {
      const shrub = mesh(
        new THREE.IcosahedronGeometry(0.62, 1),
        materials.leaf,
        [Math.sin(angle) * 8.75, 0.6, Math.cos(angle) * 8.75],
      );
      shrub.scale.y = 0.7;
      mesh(new THREE.IcosahedronGeometry(0.29, 0), materials.blossom, [
        shrub.position.x + 0.2,
        1.05,
        shrub.position.z,
      ]);
    }
  }

  const actor = new THREE.Group();
  actor.name = "Spellgarden apprentice";
  actor.position.set(0, 0.13, 0.4);
  root.add(actor);
  cylinder(0.18, 0.47, 0.85, materials.cloak, [0, 0.64, 0], actor, 8);
  mesh(
    new THREE.IcosahedronGeometry(0.34, 1),
    materials.cream,
    [0, 1.25, 0],
    actor,
  );
  const face = mesh(
    new THREE.CircleGeometry(0.23, 20),
    materials.shadow,
    [0, 1.24, 0.31],
    actor,
  );
  face.renderOrder = 2;
  for (const x of [-0.075, 0.075])
    mesh(
      new THREE.SphereGeometry(0.035, 6, 4),
      lightMats.bloom,
      [x, 1.27, 0.335],
      actor,
    ).renderOrder = 3;
  cylinder(0.57, 0.57, 0.08, materials.cloak, [0, 1.52, 0], actor, 16);
  const hat = mesh(
    new THREE.ConeGeometry(0.39, 0.8, 9),
    materials.cloak,
    [0.05, 1.94, 0],
    actor,
  );
  hat.rotation.z = -0.14;
  cylinder(0.405, 0.405, 0.045, materials.gold, [0, 1.63, 0], actor, 9);
  rod([0.5, 0.25, 0], [0.5, 1.9, 0], 0.035, materials.gold, actor);
  mesh(
    new THREE.OctahedronGeometry(0.2),
    lightMats.bloom,
    [0.5, 2.05, 0],
    actor,
  );
  for (const x of [-0.18, 0.18])
    box([0.18, 0.24, 0.28], materials.shadow, [x, 0.13, 0.03], actor);
  ring(0.64, 0.035, basic(COLORS.blink, 0.75), [0, 0.03, 0], actor);

  const chargeCrystals = new Map();
  for (const [index, spell] of SPELLS.entries()) {
    const x = (index - 1) * 3.5,
      z = -2.7;
    cylinder(0.74, 0.84, 0.36, materials.tile, [x, 0.25, z]);
    ring(0.58, 0.045, materials.gold, [x, 0.44, z]);
    const orbs = [];
    for (let n = 0; n < spell.charges; n++) {
      const crystal = mesh(
        new THREE.OctahedronGeometry(0.23),
        lightMats[spell.id],
        [x + (n - (spell.charges - 1) / 2) * 0.48, 0.99, z],
      );
      crystal.scale.y = 1.6;
      orbs.push(crystal);
    }
    chargeCrystals.set(spell.id, orbs);
  }
  const petals = new THREE.Group();
  root.add(petals);
  for (let i = 0; i < 22; i++) {
    const angle = i * 2.39996;
    const petal = mesh(
      new THREE.OctahedronGeometry(0.045),
      i % 2 ? materials.blossom : lightMats.bloom,
      [
        Math.cos(angle) * (2 + (i % 5)),
        1 + (i % 7) * 0.44,
        Math.sin(angle) * (2 + (i % 5)),
      ],
      petals,
    );
    petal.scale.set(1, 0.4, 1.7);
    petal.userData.base = petal.position.clone();
  }
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4;
    const fragment = mesh(
      new THREE.IcosahedronGeometry(0.5 + (i % 2) * 0.3, 0),
      materials.dark,
      [Math.cos(angle) * 12.5, -3 - (i % 3) * 1.6, Math.sin(angle) * 12.5],
    );
    fragment.scale.y = 1.8;
  }

  let clock = 0,
    disposed = false,
    blinkSide = 1;
  const effects = [];
  function cast(id) {
    if (!Object.hasOwn(COLORS, id))
      throw new RangeError("Unknown spell visual");
    if (disposed) throw new Error("Spellgarden scene is disposed");
    const effect = new THREE.Group();
    effect.name = `Spellgarden ${id} cast`;
    root.add(effect);
    const color = COLORS[id],
      effectMat = basic(color, 0.82);
    const origin = actor.position.clone();
    const details = {
      id,
      root: effect,
      age: 0,
      duration: 1.6,
      origin,
      rings: [],
    };
    if (id === "blink") {
      blinkSide *= -1;
      const target = new THREE.Vector3(blinkSide * 2.6, actor.position.y, 1.2);
      const midpoint = origin.clone().lerp(target, 0.5);
      midpoint.y += 1.2;
      const curve = new THREE.QuadraticBezierCurve3(
        origin.clone().add(new THREE.Vector3(0, 0.6, 0)),
        midpoint,
        target.clone().add(new THREE.Vector3(0, 0.6, 0)),
      );
      mesh(
        new THREE.TubeGeometry(curve, 42, 0.085, 6, false),
        effectMat,
        [0, 0, 0],
        effect,
      );
      for (let i = 0; i < 12; i++) {
        const point = curve.getPoint(i / 11);
        const spark = mesh(
          new THREE.OctahedronGeometry(0.1 + (i % 3) * 0.035),
          effectMat,
          point.toArray(),
          effect,
        );
        spark.rotation.z = i;
      }
      details.target = target;
      details.duration = 1.2;
      if (reducedMotion) actor.position.copy(target);
    } else if (id === "bloom") {
      effect.position.set(origin.x, 0.15, origin.z);
      for (let i = 0; i < 3; i++)
        details.rings.push(
          ring(0.8 + i * 0.7, 0.08, effectMat, [0, 0.03 + i * 0.02, 0], effect),
        );
      for (let i = 0; i < 12; i++) {
        const angle = (i * TAU) / 12;
        const sprout = mesh(
          new THREE.OctahedronGeometry(0.22),
          effectMat,
          [Math.sin(angle) * 2.35, 0.4, Math.cos(angle) * 2.35],
          effect,
        );
        sprout.scale.set(0.65, 2.1, 0.65);
        sprout.rotation.z = Math.sin(angle) * 0.4;
      }
      details.duration = 1.9;
    } else {
      effect.position.set(3.2, 0.12, 0.2);
      details.rings.push(ring(1.35, 0.06, effectMat, [0, 0.015, 0], effect));
      const meteor = mesh(
        new THREE.IcosahedronGeometry(0.5, 0),
        effectMat,
        [-2, 7, -1],
        effect,
      );
      meteor.scale.y = 1.45;
      const tail = mesh(
        new THREE.ConeGeometry(0.3, 2.6, 8),
        effectMat,
        [-2.3, 8.3, -1.1],
        effect,
      );
      tail.rotation.z = -0.2;
      details.meteor = meteor;
      details.tail = tail;
      details.duration = 2.0;
      if (reducedMotion) {
        meteor.position.set(0, 0.65, 0);
        tail.visible = false;
      }
    }
    effects.push(details);
    // Bound demo visuals even when the caller constructs very rapid custom cooldowns.
    while (effects.length > 24) release(effects.shift().root);
    return effect;
  }
  function setState(state) {
    for (const ability of state.abilities) {
      const orbs = chargeCrystals.get(ability.id);
      if (!orbs) continue;
      orbs.forEach((orb, index) => {
        orb.material =
          index < ability.charges ? lightMats[ability.id] : materials.shadow;
      });
    }
  }
  function update(dt = 0) {
    if (disposed) return;
    if (!Number.isFinite(dt) || dt < 0 || dt > 86400)
      throw new RangeError("Scene dt must be finite in [0,86400]");
    clock += dt;
    if (!reducedMotion) {
      star.rotation.y = clock * 0.45;
      tilted.rotation.z = clock * 0.08;
      petals.children.forEach((petal, i) => {
        petal.position.y =
          petal.userData.base.y + Math.sin(clock * 0.6 + i) * 0.2;
        petal.rotation.y = clock * 0.3 + i;
      });
    }
    for (let index = effects.length - 1; index >= 0; index--) {
      const effect = effects[index];
      effect.age += dt;
      if (effect.age >= effect.duration) {
        release(effect.root);
        effects.splice(index, 1);
        continue;
      }
      const progress = effect.age / effect.duration;
      const opacity =
        (reducedMotion ? 0.45 : 0.82) * Math.min(1, (1 - progress) * 2.2);
      effect.root.traverse((object) => {
        if (object.material) object.material.opacity = opacity;
      });
      if (effect.id === "blink" && !reducedMotion) {
        const travel = Math.min(1, effect.age / 0.35),
          smooth = travel * travel * (3 - 2 * travel);
        // Only the newest blink controls the apprentice if rapid recasts overlap.
        if (!effects.slice(index + 1).some((other) => other.id === "blink")) {
          actor.position.lerpVectors(effect.origin, effect.target, smooth);
          actor.position.y += Math.sin(travel * Math.PI) * 0.25;
          actor.rotation.y = Math.atan2(
            effect.target.x - effect.origin.x,
            effect.target.z - effect.origin.z,
          );
        }
      }
      if (effect.id === "bloom" && !reducedMotion)
        effect.root.scale.setScalar(0.55 + progress * 0.85);
      if (effect.id === "meteor" && !reducedMotion) {
        const fall = Math.min(1, effect.age / 0.65);
        effect.meteor.position.set(
          -2 * (1 - fall),
          0.55 + 6.45 * (1 - fall * fall),
          -(1 - fall),
        );
        effect.meteor.rotation.set(effect.age, effect.age * 2, 0);
        effect.tail.position
          .copy(effect.meteor.position)
          .add(new THREE.Vector3(-0.3, 1.2, -0.1));
        effect.tail.visible = fall < 1;
        if (fall === 1) {
          effect.meteor.scale.setScalar(
            Math.max(0.03, 1 - (effect.age - 0.65) * 1.1),
          );
          effect.rings[0].scale.setScalar(1 + (effect.age - 0.65) * 1.8);
        }
      }
    }
  }
  function reset() {
    effects.splice(0).forEach((effect) => release(effect.root));
    clock = 0;
    blinkSide = 1;
    actor.position.set(0, 0.13, 0.4);
    actor.rotation.set(0, 0, 0);
  }
  function release(object, extraMaterials = []) {
    const geometries = new Set(),
      mats = new Set(extraMaterials);
    object.traverse((child) => {
      if (child.geometry) geometries.add(child.geometry);
      if (child.material)
        for (const m of Array.isArray(child.material)
          ? child.material
          : [child.material])
          mats.add(m);
    });
    geometries.forEach((geometry) => geometry.dispose());
    mats.forEach((m) => m.dispose());
    object.removeFromParent();
    object.clear();
  }
  return {
    root,
    ground,
    actor,
    chargeCrystals,
    effects,
    cast,
    setState,
    update,
    reset,
    setReducedMotion(value) {
      reducedMotion = !!value;
      if (reducedMotion)
        for (const effect of effects) {
          if (effect.id === "blink") actor.position.copy(effect.target);
          if (effect.id === "meteor") {
            effect.meteor.position.set(0, 0.65, 0);
            effect.tail.visible = false;
          }
        }
      if (stage.bloom) stage.bloom.strength = reducedMotion ? 0.14 : 0.3;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
      sunlight.shadow.dispose();
      release(root, [...Object.values(materials), ...Object.values(lightMats)]);
    },
  };
}
