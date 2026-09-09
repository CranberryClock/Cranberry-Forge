import * as THREE from "three";

/** Showcase-only mascot. Natural pointed cranberry crown, no leaves or stem. */
export function createCranberryClock() {
  const root = new THREE.Group();
  root.name = "CranberryClock · natural crown · 2:15";
  const red = new THREE.MeshStandardMaterial({
    color: "#a51d49",
    roughness: 0.28,
    metalness: 0.18,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: "#d8af6d",
    roughness: 0.3,
    metalness: 0.7,
  });
  const black = new THREE.MeshStandardMaterial({
    color: "#152220",
    roughness: 0.65,
  });
  const crown = new THREE.MeshStandardMaterial({
    color: "#642b27",
    roughness: 0.8,
  });
  function mesh(g, m, p) {
    const o = new THREE.Mesh(g, m);
    o.position.set(...p);
    o.castShadow = true;
    root.add(o);
    return o;
  }
  const berry = mesh(new THREE.SphereGeometry(0.7, 24, 16), red, [0, 0, 0]);
  berry.scale.set(1, 0.93, 0.88);
  mesh(new THREE.CircleGeometry(0.47, 40), black, [0, -0.04, 0.555]);
  mesh(new THREE.TorusGeometry(0.48, 0.037, 8, 48), gold, [0, -0.04, 0.555]);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      o = mesh(
        new THREE.BoxGeometry(0.026, i % 3 === 0 ? 0.11 : 0.07, 0.016),
        gold,
        [Math.sin(a) * 0.39, -0.04 + Math.cos(a) * 0.39, 0.577],
      );
    o.rotation.z = -a;
  }
  for (const [a, length, width] of [
    [Math.PI / 2, 0.36, 0.025],
    [Math.PI * 0.375, 0.25, 0.039],
  ]) {
    const o = mesh(new THREE.BoxGeometry(width, length, 0.028), gold, [
      (Math.sin(a) * length) / 2,
      -0.04 + (Math.cos(a) * length) / 2,
      0.598,
    ]);
    o.rotation.z = -a;
  }
  mesh(new THREE.SphereGeometry(0.043, 12, 8), gold, [0, -0.04, 0.61]);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const o = mesh(new THREE.ConeGeometry(0.1, 0.26, 4), crown, [
      Math.sin(a) * 0.15,
      0.66,
      Math.cos(a) * 0.15,
    ]);
    o.rotation.z = -Math.sin(a) * 0.32;
    o.rotation.x = Math.cos(a) * 0.32;
  }
  // Tiny dew beads keep the original wet cranberry character in a low-poly form.
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996,
      y = -0.45 + (i % 7) * 0.14,
      r = Math.sqrt(Math.max(0, 0.48 - y * y));
    if (Math.cos(a) > 0.7 && Math.abs(y) < 0.4) continue;
    mesh(new THREE.SphereGeometry(0.018 + (i % 3) * 0.005, 6, 4), red, [
      Math.sin(a) * r,
      y,
      Math.cos(a) * r * 0.88,
    ]);
  }
  return root;
}

