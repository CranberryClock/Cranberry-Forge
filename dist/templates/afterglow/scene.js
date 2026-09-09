import * as THREE from "three";
import { Telegraph } from "@cranberry-forge/signal";
import { Trail } from "@cranberry-forge/flux";

const TAU = Math.PI * 2;
const material = (color, roughness = 0.85, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra });

/** Original procedural geometry. No renderer, DOM, texture or asset loading. */
export function createAfterglowScene(stage, { reducedMotion = false } = {}) {
  const root = new THREE.Group();
  root.name = "Afterglow · the last sun temple";
  stage.scene.add(root);
  stage.scene.background = new THREE.Color("#132b35");
  stage.scene.fog = new THREE.FogExp2("#17313a", 0.01);
  stage.camera.position.set(18, 23, 25);
  stage.camera.lookAt(0, 0, 0);
  if (stage.bloom) {
    stage.bloom.strength = reducedMotion ? 0.16 : 0.34;
    stage.bloom.threshold = 0.95;
  }
  const sand = material("#cbb488"),
    pale = material("#eee0b4"),
    gold = material("#b88b46", 0.45, { metalness: 0.3 });
  const teal = material("#267c7d"),
    dark = material("#164f59"),
    stone = material("#24505a"),
    rock = material("#173540");
  const coral = material("#ed9371"),
    glow = material("#bcefe3", 0.35, {
      emissive: "#63decb",
      emissiveIntensity: 1.3,
    });
  const warmGlow = material("#ffe5a0", 0.3, {
    emissive: "#ffd58e",
    emissiveIntensity: 1.4,
  });
  const basic = (color, opacity = 1) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: opacity === 1,
    });
  function mesh(geometry, mat, x = 0, y = 0, z = 0, parent = root) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function ring(radius, width, mat, y, parent = root) {
    const m = mesh(
      new THREE.RingGeometry(radius - width / 2, radius + width / 2, 96),
      mat,
      0,
      y,
      0,
      parent,
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  const hemi = new THREE.HemisphereLight("#c4e9e5", "#21404b", 2.25);
  const sun = new THREE.DirectionalLight("#ffddb0", 3.6);
  sun.position.set(-12, 25, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -16,
    right: 16,
    top: 16,
    bottom: -16,
    near: 0.5,
    far: 70,
  });
  sun.shadow.normalBias = 0.035;
  const rim = new THREE.DirectionalLight("#55c9d9", 2.4);
  rim.position.set(6, 7, -14);
  root.add(hemi, sun, rim);

  const islandUpper = mesh(
    new THREE.CylinderGeometry(10.4, 8.1, 2.5, 12),
    stone,
    0,
    -1.6,
  );
  islandUpper.name = "Afterglow island upper stratum";
  const islandLower = mesh(
    new THREE.CylinderGeometry(8.1, 3.4, 3.6, 11),
    rock,
    0,
    -4.65,
  );
  islandLower.name = "Afterglow island lower stratum";
  islandLower.rotation.y = 0.16;
  const islandTip = mesh(
    new THREE.CylinderGeometry(3.4, 0.7, 2.1, 7),
    dark,
    0,
    -7.4,
  );
  islandTip.name = "Afterglow island suspended tip";
  const ground = mesh(
    new THREE.CylinderGeometry(10.2, 10.2, 0.4, 96),
    sand,
    0,
    -0.15,
  );
  ground.name = "Walkable sun disc";
  ring(9.1, 0.09, gold, 0.063);
  ring(8.75, 0.1, basic("#79c9bd", 0.65), 0.068);
  ring(6.15, 0.11, gold, 0.061);
  ring(3.1, 0.08, gold, 0.062);
  ring(1.0, 0.15, gold, 0.065);
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * TAU;
    const sector = mesh(
      new THREE.BoxGeometry(0.075, 0.008, i % 3 ? 0.55 : 1.3),
      gold,
      Math.sin(angle) * 8.0,
      0.064,
      Math.cos(angle) * 8.0,
    );
    sector.rotation.y = angle;
    if (i % 3 === 0) {
      const inlay = mesh(
        new THREE.BoxGeometry(0.08, 0.014, 3),
        dark,
        Math.sin(angle) * 4.65,
        0.063,
        Math.cos(angle) * 4.65,
      );
      inlay.rotation.y = angle;
    }
  }
  const center = mesh(
    new THREE.CylinderGeometry(0.58, 0.58, 0.014, 6),
    gold,
    0,
    0.067,
  );
  center.rotation.y = Math.PI / 6;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * TAU;
    mesh(
      new THREE.BoxGeometry(0.45, 0.018, 0.45),
      i % 2 ? teal : pale,
      Math.sin(angle) * 9.64,
      0.062,
      Math.cos(angle) * 9.64,
    ).rotation.y = angle + Math.PI / 4;
  }

  // Pillars frame the rear of the arena; the movement boundary lies inside them.
  const pillarAngles = [-1.75, -1.15, -0.6, 0, 0.6, 1.15, 1.75];
  for (let i = 0; i < pillarAngles.length; i++) {
    const angle = pillarAngles[i],
      x = Math.sin(angle) * 9.65,
      z = -Math.cos(angle) * 9.65;
    const height = i === 2 || i === 4 ? 2.4 : i === 3 ? 3.4 : 4.8;
    mesh(new THREE.BoxGeometry(1.25, 0.28, 1.25), pale, x, 0.2, z);
    mesh(
      new THREE.CylinderGeometry(0.38, 0.48, height, 8),
      sand,
      x,
      0.48 + height / 2,
      z,
    );
    mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), gold, x, height + 0.5, z);
    mesh(new THREE.OctahedronGeometry(0.28), warmGlow, x, height + 1.0, z);
    for (let j = 0; j < 3; j++) {
      const band = mesh(
        new THREE.CylinderGeometry(0.49, 0.49, 0.09, 8),
        gold,
        x,
        0.75 + (j * (height - 0.5)) / 3,
        z,
      );
      band.rotation.y = Math.PI / 8;
    }
  }
  for (const sign of [-1, 1]) {
    const fallen = mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 2.2, 8),
      sand,
      sign * 9.0,
      0.47,
      3.4,
    );
    fallen.rotation.set(0.3, sign * 0.3, Math.PI / 2);
    mesh(
      new THREE.BoxGeometry(1.15, 0.18, 1.0),
      gold,
      sign * 9.45,
      0.18,
      5.0,
    ).rotation.y = sign * 0.3;
  }

  const halo = new THREE.Group();
  halo.name = "Solar orrery";
  halo.position.set(0, 5.15, -9.6);
  root.add(halo);
  mesh(new THREE.TorusGeometry(2.1, 0.12, 12, 72), gold, 0, 0, 0, halo);
  mesh(new THREE.TorusGeometry(1.68, 0.04, 8, 72), warmGlow, 0, 0, 0, halo);
  const sunHeart = mesh(
    new THREE.IcosahedronGeometry(0.62, 0),
    warmGlow,
    0,
    0,
    0,
    halo,
  );
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * TAU;
    mesh(
      new THREE.OctahedronGeometry(0.17),
      gold,
      Math.sin(angle) * 2.48,
      Math.cos(angle) * 2.48,
      0,
      halo,
    ).scale.y = 1.8;
  }
  for (const sign of [-1, 1]) {
    const pole = mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 4.8, 8),
      gold,
      sign * 7.3,
      2.55,
      -7.0,
    );
    const banner = mesh(
      new THREE.PlaneGeometry(1.25, 2.2, 1, 4),
      material(sign < 0 ? "#db8769" : "#276d73", 1, { side: THREE.DoubleSide }),
      sign * 7.3,
      3.3,
      -6.98,
    );
    banner.rotation.z = sign * 0.04;
    mesh(
      new THREE.BoxGeometry(1.55, 0.08, 0.08),
      gold,
      pole.position.x,
      4.4,
      -7.0,
    );
  }

  // Small floating stones and a restrained dust field make the world feel suspended.
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.39996,
      radius = 13 + (i % 3) * 1.8;
    const shard = mesh(
      new THREE.IcosahedronGeometry(0.32 + (i % 3) * 0.22, 0),
      i % 2 ? stone : rock,
      Math.cos(angle) * radius,
      -3.5 - (i % 4) * 1.6,
      Math.sin(angle) * radius,
    );
    shard.scale.set(1, 1.8, 1);
  }
  const motes = new THREE.Group();
  root.add(motes);
  const moteGeo = new THREE.SphereGeometry(0.025, 4, 3),
    moteMat = basic("#ffe2a8", 0.6);
  for (let i = 0; i < 32; i++) {
    const angle = i * 2.39996,
      radius = 3 + ((i * 7) % 60) / 10;
    const mote = mesh(
      moteGeo,
      moteMat,
      Math.cos(angle) * radius,
      0.9 + (i % 7) * 0.4,
      Math.sin(angle) * radius,
      motes,
    );
    mote.userData.baseY = mote.position.y;
  }

  const player = new THREE.Group();
  player.name = "Keeper of the last light";
  root.add(player);
  mesh(new THREE.ConeGeometry(0.38, 0.7, 7), teal, 0, 0.6, 0, player);
  mesh(new THREE.IcosahedronGeometry(0.31, 1), pale, 0, 1.08, 0, player);
  const face = mesh(
    new THREE.CircleGeometry(0.2, 16),
    dark,
    0,
    1.08,
    0.275,
    player,
  );
  face.renderOrder = 2;
  for (const x of [-0.07, 0.07])
    mesh(
      new THREE.SphereGeometry(0.035, 6, 4),
      glow,
      x,
      1.1,
      0.3,
      player,
    ).renderOrder = 3;
  mesh(new THREE.ConeGeometry(0.38, 0.32, 7), teal, 0, 1.37, 0, player);
  for (const x of [-0.14, 0.14])
    mesh(new THREE.CapsuleGeometry(0.09, 0.2, 2, 6), dark, x, 0.2, 0, player);
  mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.35, 6),
    gold,
    0.48,
    0.9,
    0,
    player,
  );
  const staffLight = mesh(
    new THREE.OctahedronGeometry(0.17),
    glow,
    0.48,
    1.66,
    0,
    player,
  );
  ring(0.49, 0.045, basic("#c9fff0", 0.85), 0.09, player);

  const trail = new Trail({
    capacity: 96,
    lifetime: 0.68,
    width: 0.54,
    minDistance: 0.04,
    maxJump: 3,
    color: "#ddfff2",
    tailColor: "#2bafbb",
    intensity: 1.7,
    opacity: 0.8,
    taper: 1.3,
  });
  trail.name = "Flux · keeper dash ribbon";
  root.add(trail);
  const telegraphs = new Map(),
    flashes = [];
  let view = null,
    clock = 0,
    previousTime = -1,
    wasDashing = false,
    disposed = false;

  function footprint(attack) {
    const {
      shape,
      radius = 5,
      innerRadius = 0,
      angle = 70,
      width = 3,
      length = 10,
    } = attack.options;
    let geometry;
    if (shape === "beam") {
      geometry = new THREE.PlaneGeometry(width, length);
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, 0, -length / 2);
    } else if (shape === "cone") {
      const path = new THREE.Shape(),
        half = (angle * Math.PI) / 360;
      path.moveTo(0, 0);
      for (let i = 0; i <= 48; i++) {
        const a = -half + (i / 48) * half * 2;
        path.lineTo(Math.sin(a) * radius, Math.cos(a) * radius);
      }
      path.closePath();
      geometry = new THREE.ShapeGeometry(path);
      geometry.rotateX(-Math.PI / 2);
    } else {
      geometry = new THREE.RingGeometry(innerRadius, radius, 64);
      geometry.rotateX(-Math.PI / 2);
    }
    const fill = new THREE.Mesh(
      geometry,
      basic(attack.options.color || "#ff9473", 0.13),
    );
    fill.name = `Afterglow footprint ${attack.id}`;
    fill.position.set(attack.x, 0.155, attack.z);
    fill.rotation.y = attack.rotation;
    fill.renderOrder = 2;
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 40),
      new THREE.LineBasicMaterial({
        color: "#ffd5ae",
        transparent: true,
        opacity: 0.82,
      }),
    );
    outline.position.y = 0.002;
    fill.add(outline);
    return fill;
  }
  function removeWarning(record) {
    record.signal.dispose();
    record.signal.removeFromParent();
    release(record.fill);
  }
  function clearTransient() {
    telegraphs.forEach(removeWarning);
    telegraphs.clear();
    flashes.splice(0).forEach((f) => release(f.mesh));
    trail.clear();
    wasDashing = false;
  }
  function setState(next, events = []) {
    if (disposed) return;
    if (next.time < previousTime) clearTransient();
    previousTime = next.time;
    view = next;
    player.position.set(next.position.x, 0.07, next.position.z);
    player.rotation.y = Math.atan2(next.facing.x, next.facing.z);
    player.visible = !(
      next.invulnerability > 0 &&
      !reducedMotion &&
      Math.floor(next.time * 12) % 2
    );
    staffLight.scale.setScalar(next.dashRemaining > 0 ? 1.3 : 1);
    const ids = new Set(next.attacks.map((a) => a.id));
    for (const [id, record] of telegraphs) {
      if (!ids.has(id)) {
        removeWarning(record);
        telegraphs.delete(id);
      }
    }
    for (const attack of next.attacks) {
      let record = telegraphs.get(attack.id);
      if (!record) {
        const signal = new Telegraph(attack.options);
        signal.position.set(attack.x, 0, attack.z);
        signal.rotation.y = attack.rotation;
        root.add(signal);
        signal.project(() => 0.12);
        signal.arm(attack.armedAt, attack.duration);
        const fill = footprint(attack);
        root.add(fill);
        record = { signal, fill };
        telegraphs.set(attack.id, record);
      }
      record.signal.update(next.time);
      if (reducedMotion) record.signal.material.uniforms.clock.value = 0;
      record.fill.material.opacity = 0.1 + record.signal.progress * 0.12;
    }
    for (const event of events) {
      if (event.type !== "impact") continue;
      const fill = footprint(event.attack);
      fill.material.color.set(event.damaged ? "#ff806d" : "#ffedb0");
      fill.material.opacity = reducedMotion ? 0.18 : 0.32;
      root.add(fill);
      flashes.push({ mesh: fill, at: next.time });
    }
    if (next.dashRemaining > 0 && !reducedMotion) {
      trail.push([next.position.x, 0.5, next.position.z], next.time);
      wasDashing = true;
    } else if (wasDashing) {
      trail.break();
      wasDashing = false;
    }
    trail.update(next.time, stage.camera.position);
    trail.visible = !reducedMotion;
  }
  function update(dt = 0) {
    if (disposed || !view) return;
    if (view.phase === "playing" || view.phase === "ready") clock += dt;
    if (!reducedMotion) {
      sunHeart.rotation.y = clock * 0.22;
      sunHeart.rotation.z = clock * 0.1;
      halo.rotation.z = Math.sin(clock * 0.17) * 0.045;
      motes.children.forEach(
        (m, i) =>
          (m.position.y = m.userData.baseY + Math.sin(clock * 0.6 + i) * 0.12),
      );
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const age = view.time - flashes[i].at;
      if (age > 0.35 || view.phase === "ready") {
        release(flashes[i].mesh);
        flashes.splice(i, 1);
      } else
        flashes[i].mesh.material.opacity = Math.max(
          0,
          (reducedMotion ? 0.18 : 0.32) * (1 - age / 0.35),
        );
    }
  }
  function release(object) {
    const geometry = new Set(),
      materials = new Set();
    object.traverse((o) => {
      if (o.geometry) geometry.add(o.geometry);
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
    });
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    object.removeFromParent();
    object.clear();
  }
  return {
    root,
    ground,
    player,
    telegraphs,
    trail,
    setState,
    update,
    setReducedMotion(value) {
      reducedMotion = !!value;
      if (reducedMotion) {
        trail.clear();
        player.visible = true;
      }
      if (stage.bloom) stage.bloom.strength = reducedMotion ? 0.16 : 0.34;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTransient();
      trail.dispose();
      trail.removeFromParent();
      sun.shadow.dispose();
      release(root);
    },
  };
}
