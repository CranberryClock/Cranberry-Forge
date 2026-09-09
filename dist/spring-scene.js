import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Spring, VectorSpring } from "./packages/spring/index.js";

export const SPRING_TOYS = Object.freeze([
  { name: "Mochi", color: "#ef886f", dark: "#b95249", dampingRatio: 0.28 },
  { name: "Pip", color: "#9bc9ae", dark: "#568e78", dampingRatio: 1 },
  { name: "Orbit", color: "#b6a4d7", dark: "#79619f", dampingRatio: 1.8 },
]);

/** Renderer-free procedural scene. Host supplies {scene,camera,bloom?}; owns its clock. */
export function createSpringScene(
  stage,
  { frequency = 1.6, dampingRatio = 0.28, reducedMotion = false } = {},
) {
  if (!stage?.scene?.isScene || !stage?.camera?.isCamera)
    throw new TypeError("A Three.js scene and camera are required");
  const springs = SPRING_TOYS.map(
    (toy, i) =>
      new Spring({
        frequency,
        dampingRatio: i ? toy.dampingRatio : dampingRatio,
      }),
  );
  const antennas = SPRING_TOYS.map(
    (toy, i) =>
      new VectorSpring({
        frequency: Math.min(100, frequency * 1.4),
        dampingRatio: i ? toy.dampingRatio : Math.max(0.12, dampingRatio),
      }),
  );
  const root = new THREE.Group();
  root.name = "Jellyworks · motion testing bench";
  stage.scene.add(root);
  stage.scene.background = new THREE.Color("#263734");
  stage.scene.fog = new THREE.Fog("#263734", 28, 65);
  const cameraPosition = new THREE.Vector3(12.6, 11.4, 18.6),
    cameraTarget = new THREE.Vector3(0, 1.4, 0);
  stage.camera.position.copy(cameraPosition);
  stage.camera.lookAt(cameraTarget);
  if (stage.bloom) {
    stage.bloom.strength = 0.08;
    stage.bloom.threshold = 1.5;
  }
  const materials = new Set(),
    geometries = new Set();
  const mat = (color, options = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.06,
      ...options,
    });
    materials.add(m);
    return m;
  };
  const cream = mat("#fff3d9"),
    white = mat("#f6f7e8"),
    benchFrame = mat("#53685e", { roughness: 0.72 }),
    benchSurface = mat("#3c5149", { roughness: 0.75 }),
    navy = mat("#243e4c"),
    steel = mat("#68848c", { roughness: 0.3, metalness: 0.65 });
  const yellow = mat("#e7be68"),
    blush = mat("#ebbaab"),
    mint = mat("#92bcb0");
  function mesh(geometry, material, position = [0, 0, 0], parent = root) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  const rounded = (w, h, d, radius = 0.2) =>
    new RoundedBoxGeometry(w, h, d, 3, radius);
  const cylinder = (r, h) => new THREE.CylinderGeometry(r, r, h, 48);
  root.add(new THREE.HemisphereLight("#d6f0df", "#25362e", 1.8));
  const key = new THREE.DirectionalLight("#fff0d3", 2.6);
  key.position.set(-7, 13, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {
    left: -12,
    right: 12,
    top: 10,
    bottom: -10,
    near: 0.5,
    far: 45,
  });
  key.shadow.normalBias = 0.035;
  root.add(key);
  const rim = new THREE.DirectionalLight("#b8dece", 1.7);
  rim.position.set(10, 7, -8);
  root.add(rim);

  mesh(rounded(15.8, 0.65, 8.1, 0.35), benchFrame, [0, -0.12, 0.2]);
  mesh(rounded(15.25, 0.08, 7.65, 0.18), benchSurface, [0, 0.25, 0.2]);
  mesh(
    new THREE.PlaneGeometry(160, 160),
    mat("#263734", { roughness: 0.9 }),
    [0, -1.4, 0],
  ).rotation.x = -Math.PI / 2;
  for (const x of [-6.5, 6.5])
    for (const z of [-2.7, 3]) {
      mesh(rounded(0.65, 1.0, 0.65, 0.15), steel, [x, -0.9, z]);
      mesh(cylinder(0.52, 0.12), navy, [x, -1.35, z]);
    }
  for (let i = 0; i < 37; i++) {
    const x = -7.2 + i * 0.4;
    mesh(
      new THREE.BoxGeometry(0.025, 0.015, i % 5 === 0 ? 0.32 : 0.14),
      steel,
      [x, 0.3, 3.53],
    );
  }
  // A soft industrial backdrop: rails, specimen shelf, and little calibration weights.
  mesh(rounded(15.0, 0.4, 0.38, 0.16), mint, [0, 5.15, -2.65]);
  for (const x of [-7.05, 7.05])
    mesh(rounded(0.4, 4.9, 0.4, 0.16), mint, [x, 2.6, -2.65]);
  for (const x of [-6.6, 6.6]) {
    mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 32), yellow, [
      x,
      4.95,
      -2.32,
    ]).rotation.y = Math.PI / 2;
    mesh(cylinder(0.26, 0.1), blush, [x, 0.38, 2.7]);
  }
  mesh(rounded(2.1, 0.15, 1.2, 0.09), steel, [0, 0.42, -2.35]);
  for (let i = 0; i < 3; i++)
    mesh(rounded(0.42, 0.16 + 0.12 * i, 0.42, 0.08), [blush, yellow, mint][i], [
      (i - 1) * 0.55,
      0.6 + 0.06 * i,
      -2.35,
    ]);

  const toys = [],
    pickables = [],
    coils = [],
    faces = [];
  const vertical = new THREE.Vector3(0, 1, 0),
    endpoint = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    const spec = SPRING_TOYS[i],
      x = (i - 1) * 4.6;
    const bodyMat = mat(spec.color, { roughness: 0.37 }),
      accent = mat(spec.dark);
    const station = new THREE.Group();
    station.position.x = x;
    station.userData.springIndex = i;
    root.add(station);
    pickables.push(station);
    mesh(cylinder(1.8, 0.18), navy, [0, 0.36, 0.25], station);
    mesh(cylinder(1.71, 0.3), bodyMat, [0, 0.58, 0.25], station);
    mesh(cylinder(1.64, 0.11), cream, [0, 0.78, 0.25], station);
    for (let screw = 0; screw < 8; screw++) {
      const a = (screw * Math.PI) / 4;
      mesh(
        cylinder(0.055, 0.022),
        steel,
        [Math.cos(a) * 1.42, 0.85, 0.25 + Math.sin(a) * 1.42],
        station,
      );
    }
    const coilPoints = [];
    for (let j = 0; j <= 160; j++) {
      const t = j / 160,
        a = t * Math.PI * 11;
      coilPoints.push(
        new THREE.Vector3(Math.cos(a) * 0.54, t, Math.sin(a) * 0.54),
      );
    }
    const coil = mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(coilPoints),
        160,
        0.065,
        8,
        false,
      ),
      steel,
      [0, 0.85, 0.25],
      station,
    );
    const assembly = new THREE.Group();
    assembly.position.set(0, 2, 0.25);
    station.add(assembly);
    mesh(cylinder(0.87, 0.12), accent, [0, 0, 0], assembly);
    mesh(
      new THREE.TorusGeometry(0.82, 0.055, 10, 48),
      cream,
      [0, 0.055, 0],
      assembly,
    ).rotation.x = Math.PI / 2;
    const body = new THREE.Group();
    body.position.y = 0.72;
    assembly.add(body);
    if (i === 2) {
      mesh(rounded(1.65, 1.08, 1.35, 0.44), bodyMat, [0, 0, 0], body);
      const belt = mesh(
        new THREE.TorusGeometry(0.89, 0.09, 12, 48),
        accent,
        [0, 0.04, 0],
        body,
      );
      belt.rotation.x = Math.PI / 2;
      belt.scale.y = 0.83;
    } else {
      const blob = mesh(
        new THREE.SphereGeometry(0.86, 40, 28),
        bodyMat,
        [0, 0, 0],
        body,
      );
      blob.scale.set(1, i ? 0.8 : 0.88, 0.92);
      for (const sign of [-1, 1])
        mesh(
          new THREE.SphereGeometry(0.22, 16, 12),
          bodyMat,
          [sign * 0.77, -0.25, 0.08],
          body,
        );
    }
    const face = new THREE.Group();
    face.position.set(0, -0.02, 0.76);
    body.add(face);
    for (const sign of [-1, 1]) {
      const eye = mesh(
        new THREE.SphereGeometry(0.11, 16, 12),
        navy,
        [sign * 0.25, 0.1, 0],
        face,
      );
      eye.scale.y = 1.2;
      mesh(
        new THREE.SphereGeometry(0.028, 8, 6),
        white,
        [sign * 0.25 - 0.02, 0.14, 0.1],
        face,
      );
      const cheek = mesh(
        new THREE.SphereGeometry(0.1, 12, 8),
        accent,
        [sign * 0.41, -0.12, -0.015],
        face,
      );
      cheek.scale.set(1, 0.38, 0.28);
    }
    const smile = mesh(
      new THREE.TorusGeometry(0.12, 0.026, 8, 20, Math.PI),
      navy,
      [0, -0.15, 0],
      face,
    );
    smile.rotation.z = Math.PI;
    const antenna = new THREE.Group();
    antenna.position.set(0, 0.6, 0);
    body.add(antenna);
    const stalk = mesh(cylinder(0.045, 0.8), accent, [0, 0.4, 0], antenna);
    const tip = mesh(
      new THREE.SphereGeometry(0.2, 20, 16),
      i === 1 ? yellow : cream,
      [0, 0.9, 0],
      antenna,
    );
    if (i === 1)
      for (const sign of [-1, 1]) {
        const petal = mesh(
          new THREE.SphereGeometry(0.19, 16, 10),
          accent,
          [sign * 0.17, 0.98, 0],
          antenna,
        );
        petal.scale.set(0.6, 1.7, 0.4);
        petal.rotation.z = -sign * 0.6;
      }
    mesh(rounded(1.38, 0.12, 0.53, 0.08), navy, [0, 0.35, 2.1], station);
    for (let n = 0; n <= i; n++)
      mesh(
        cylinder(0.07, 0.035),
        bodyMat,
        [(n - i / 2) * 0.23, 0.43, 2.1],
        station,
      );
    toys.push({ assembly, body, antenna, stalk, tip });
    coils.push(coil);
    faces.push(face);
  }
  let disposed = false,
    time = 0;
  function pose() {
    toys.forEach((toy, i) => {
      const displacement = springs[i].value,
        speed = springs[i].velocity;
      // A bounded presentation mapping protects the toy geometry from repeated energetic taps.
      // The response chart and public spring values always retain the exact oscillator state.
      const height = 1.23 + 0.72 * Math.tanh(displacement * 0.6);
      coils[i].scale.y = height;
      toy.assembly.position.y = 0.85 + height;
      const squash = reducedMotion ? 0 : Math.tanh(speed * 0.035) * 0.1;
      toy.body.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);
      const wobble = antennas[i].value;
      toy.antenna.rotation.z = Math.tanh(wobble[0]) * 0.65;
      toy.antenna.rotation.x = Math.tanh(wobble[2]) * 0.45;
      endpoint.set(wobble[0] * 0.05, 1, wobble[2] * 0.05).normalize();
      toy.stalk.quaternion.setFromUnitVectors(vertical, endpoint);
      faces[i].rotation.z = reducedMotion
        ? 0
        : Math.tanh(speed * 0.015) * 0.045;
    });
  }
  function kick(amount = 10, index = null) {
    if (!Number.isFinite(amount) || Math.abs(amount) > 20)
      throw new RangeError("Demo impulse must be finite in [-20,20]");
    if (index !== null && ![0, 1, 2].includes(index))
      throw new RangeError("Toy index must be 0, 1 or 2");
    if (disposed || reducedMotion) return;
    springs.forEach((spring, i) => {
      if (index !== null && index !== i) return;
      const impulse =
        Math.max(-24, Math.min(24, spring.velocity + amount)) - spring.velocity;
      spring.impulse(impulse);
      antennas[i].impulse([impulse * 0.6, 0, impulse * (i % 2 ? -0.3 : 0.3)]);
    });
  }
  function setParameters(options) {
    // Validate both configurations before committing any toy.
    const checked = new Spring({ ...springs[0].options, ...options }).options;
    const antennaFrequency = Math.min(100, checked.frequency * 1.4);
    springs.forEach((spring, i) =>
      spring.configure({
        frequency: checked.frequency,
        dampingRatio: i ? SPRING_TOYS[i].dampingRatio : checked.dampingRatio,
      }),
    );
    antennas.forEach((spring, i) =>
      spring.configure({
        frequency: antennaFrequency,
        dampingRatio: i
          ? SPRING_TOYS[i].dampingRatio
          : Math.max(0.12, checked.dampingRatio),
      }),
    );
  }
  function setTarget(value) {
    if (!Number.isFinite(value) || Math.abs(value) > 2)
      throw new RangeError("Demo target must be finite in [-2,2]");
    springs.forEach((spring) =>
      reducedMotion ? spring.snap(value) : spring.setTarget(value),
    );
    pose();
  }
  function reset() {
    springs.forEach((s) => s.snap(0));
    antennas.forEach((s) => s.snap([0, 0, 0]));
    time = 0;
    pose();
  }
  function sample() {
    return {
      time,
      values: springs.map((s) => s.value),
      velocities: springs.map((s) => s.velocity),
      target: springs[0].target,
    };
  }
  function update(dt = 0) {
    if (disposed) return sample();
    if (!Number.isFinite(dt) || dt < 0 || dt > 60)
      throw new RangeError("dt must be in [0,60]");
    if (!reducedMotion) {
      springs.forEach((s) => s.step(dt));
      antennas.forEach((s) => s.step(dt));
      time += dt;
    }
    pose();
    return sample();
  }
  pose();
  return {
    root,
    cameraPosition,
    cameraTarget,
    springs,
    antennas,
    pickables,
    kick,
    setParameters,
    setTarget,
    reset,
    sample,
    update,
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
      if (reducedMotion) {
        springs.forEach((s) => s.snap());
        antennas.forEach((s) => s.snap([0, 0, 0]));
      }
      pose();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      key.shadow.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      root.removeFromParent();
      root.clear();
    },
  };
}
