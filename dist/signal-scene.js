import * as THREE from "three";
import { Telegraph } from "@cranberry-forge/signal";
import { releaseObject } from "./scene.js";

export const SIGNAL_PRESETS = [
  {
    id: "orbital",
    name: "Orbital strike",
    caption: "Radial danger · precise timing",
    shape: "circle",
    radius: 5.5,
    innerRadius: 0,
    angle: 70,
    width: 3,
    length: 10,
    color: "#ffb48a",
    title: "Make danger<br>readable.",
    label: "STUDY 007 / ORBITAL STRIKE",
    swatch: "linear-gradient(120deg,#ffc58f,#b46348,#402d31)",
  },
  {
    id: "cleave",
    name: "Arcane cleave",
    caption: "Directional range · a clean escape",
    shape: "cone",
    radius: 10,
    innerRadius: 0.8,
    angle: 75,
    width: 3,
    length: 10,
    color: "#a8a1ff",
    title: "A warning.<br>With direction.",
    label: "STUDY 008 / ARCANE CLEAVE",
    swatch: "linear-gradient(120deg,#d0baff,#8079c3,#272d50)",
  },
  {
    id: "rail",
    name: "Rail cannon",
    caption: "A charged corridor · no ambiguity",
    shape: "beam",
    radius: 5.5,
    innerRadius: 0,
    angle: 70,
    width: 3.5,
    length: 13,
    color: "#99e4ea",
    title: "Show the line.<br>Then cross it.",
    label: "STUDY 009 / RAIL CANNON",
    swatch: "linear-gradient(120deg,#baf0ed,#529697,#203f4c)",
  },
];
export const arenaHeight = (x, z, relief = 1) =>
  0.25 +
  relief *
    (0.5 * Math.sin(x * 0.32) * Math.cos(z * 0.28) +
      0.14 * Math.cos(x * 0.6 + z * 0.3));

export function createSignalScene(stage, params, onStatus) {
  const root = new THREE.Group();
  stage.scene.add(root);
  const floorGroup = new THREE.Group();
  root.add(floorGroup);
  stage.scene.background = new THREE.Color("#20292e");
  stage.scene.fog = new THREE.FogExp2("#20292e", 0.012);
  stage.bloom.strength = 0.5;
  stage.bloom.threshold = 0.95;
  root.add(new THREE.HemisphereLight("#d4e0ef", "#29302d", 2.1));
  const sun = new THREE.DirectionalLight("#ffe0b3", 3.5);
  sun.position.set(-12, 25, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -20,
    right: 20,
    top: 20,
    bottom: -20,
    far: 70,
  });
  sun.shadow.normalBias = 0.07;
  root.add(sun);
  const rim = new THREE.DirectionalLight("#84b5d7", 2.3);
  rim.position.set(14, 10, -12);
  root.add(rim);
  const telegraph = new Telegraph({ shape: "circle" });
  root.add(telegraph);
  const targetGeo = new THREE.CapsuleGeometry(0.24, 0.6, 4, 8),
    safe = new THREE.MeshStandardMaterial({
      color: "#a8c4bd",
      metalness: 0.3,
      roughness: 0.6,
    }),
    danger = new THREE.MeshStandardMaterial({
      color: "#ffe0b0",
      emissive: "#b9663a",
      emissiveIntensity: 0.6,
    });
  const targets = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2,
      r = 4.5 + (i % 3) * 2.2;
    const target = new THREE.Mesh(targetGeo, safe);
    target.position.set(Math.cos(a) * r, 1, Math.sin(a) * r);
    target.castShadow = true;
    root.add(target);
    targets.push(target);
  }
  const outline = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.025, 6, 100),
    new THREE.MeshBasicMaterial({
      color: params.color,
      transparent: true,
      opacity: 0,
    }),
  );
  outline.rotation.x = -Math.PI / 2;
  outline.position.y = 1.1;
  root.add(outline);
  let time = 0,
    lastImpact = -100,
    paused =
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false,
    ground = null,
    disposed = false;
  function refreshTargets() {
    let count = 0;
    for (const t of targets) {
      t.position.y =
        arenaHeight(t.position.x, t.position.z, params.relief) + 0.65;
      const hit = telegraph.containsPoint(t.position);
      t.material = hit ? danger : safe;
      if (hit) count++;
    }
    onStatus?.({ count, state: telegraph.state, progress: telegraph.progress });
  }
  function rebuild() {
    releaseObject(floorGroup);
    root.add(floorGroup);
    const g = new THREE.PlaneGeometry(32, 32, 96, 96);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const colors = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i);
      p.setY(i, arenaHeight(x, z, params.relief));
      const shade = 0.7 + 0.15 * Math.sin(x * 0.3) * Math.cos(z * 0.4);
      colors.push(shade, shade, shade);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    ground = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        color: "#68757a",
        vertexColors: true,
        roughness: 0.95,
      }),
    );
    ground.receiveShadow = true;
    ground.name = "Arena ground";
    floorGroup.add(ground);
    // A skirt joins the sampled edge to a plinth below every supported terrain
    // height. A box just under y=0 would cut through the low parts of the arena.
    const edgePositions = [];
    const edgePoint = (side, t) =>
      side === 0
        ? [-16 + 32 * t, -16]
        : side === 1
          ? [16, -16 + 32 * t]
          : side === 2
            ? [16 - 32 * t, 16]
            : [-16, 16 - 32 * t];
    for (let side = 0; side < 4; side++)
      for (let i = 0; i < 96; i++) {
        const [ax, az] = edgePoint(side, i / 96),
          [bx, bz] = edgePoint(side, (i + 1) / 96);
        const a = [ax, arenaHeight(ax, az, params.relief), az],
          b = [bx, arenaHeight(bx, bz, params.relief), bz],
          bottomA = [ax, -1.8, az],
          bottomB = [bx, -1.8, bz];
        edgePositions.push(
          ...a,
          ...b,
          ...bottomA,
          ...b,
          ...bottomB,
          ...bottomA,
        );
      }
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(edgePositions, 3),
    );
    edgeGeometry.computeVertexNormals();
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: "#39474f",
      roughness: 0.8,
    });
    const skirt = new THREE.Mesh(edgeGeometry, edgeMaterial);
    skirt.name = "Arena skirt";
    skirt.castShadow = true;
    floorGroup.add(skirt);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(32, 0.8, 32, 24, 1, 24),
      edgeMaterial,
    );
    base.name = "Arena plinth";
    base.position.y = -2.2;
    base.castShadow = true;
    floorGroup.add(base);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: "#263035", roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.7;
    floor.receiveShadow = true;
    floorGroup.add(floor);
    const linePositions = [];
    for (let j = -15; j <= 15; j += 3) {
      for (let i = -15; i < 15; i += 0.5) {
        linePositions.push(
          j,
          arenaHeight(j, i, params.relief) + 0.015,
          i,
          j,
          arenaHeight(j, i + 0.5, params.relief) + 0.015,
          i + 0.5,
        );
        linePositions.push(
          i,
          arenaHeight(i, j, params.relief) + 0.015,
          j,
          i + 0.5,
          arenaHeight(i + 0.5, j, params.relief) + 0.015,
          j,
        );
      }
    }
    floorGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.Float32BufferAttribute(linePositions, 3),
        ),
        new THREE.LineBasicMaterial({
          color: "#a6bbb8",
          transparent: true,
          opacity: 0.15,
        }),
      ),
    );
    // Obelisks establish scale; the transparent footprint remains depth-tested against them.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2,
        x = Math.cos(a) * 13,
        z = Math.sin(a) * 13;
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.75, 3.2 + (i % 2), 5),
        new THREE.MeshStandardMaterial({
          color: "#374750",
          roughness: 0.6,
          metalness: 0.2,
        }),
      );
      pillar.position.set(x, arenaHeight(x, z, params.relief) + 1.5, z);
      pillar.rotation.y = a;
      pillar.castShadow = true;
      floorGroup.add(pillar);
      const tip = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.26, 0),
        new THREE.MeshBasicMaterial({ color: params.color }),
      );
      tip.position.set(x, pillar.position.y + 2.1, z);
      floorGroup.add(tip);
    }
    telegraph.position.set(params.x, 0, params.z);
    telegraph.rotation.y = (params.rotation * Math.PI) / 180;
    telegraph.configure({
      shape: params.shape,
      radius: params.radius,
      innerRadius: params.innerRadius,
      angle: params.angle,
      width: params.width,
      length: params.length,
      color: params.color,
      intensity: params.intensity,
    });
    telegraph.project((x, z) => arenaHeight(x, z, params.relief));
    telegraph.arm(time, params.duration);
    outline.material.color.set(params.color);
    refreshTargets();
  }
  telegraph.addEventListener("complete", () => {
    lastImpact = time;
    refreshTargets();
  });
  rebuild();
  return {
    root,
    telegraph,
    rebuild,
    get ground() {
      return ground;
    },
    get paused() {
      return paused;
    },
    set paused(value) {
      paused = value;
    },
    replay() {
      telegraph.arm(time, params.duration);
    },
    update(dt) {
      if (disposed) return;
      if (!paused) {
        time += dt;
        telegraph.update(time);
        if (telegraph.state === "complete" && time - lastImpact > 0.85)
          telegraph.arm(time, params.duration);
        const fade = Math.max(0, 1 - (time - lastImpact) / 0.8);
        outline.position.set(
          params.x,
          arenaHeight(params.x, params.z, params.relief) + 0.12,
          params.z,
        );
        outline.scale.setScalar(params.radius + (1 - fade) * 3);
        outline.material.opacity = fade * 0.65;
      }
      refreshTargets();
    },
    dispose() {
      disposed = true;
      telegraph.dispose();
      targets.forEach((t) => (t.material = safe));
      danger.dispose();
      releaseObject(root);
      sun.shadow.map?.dispose();
    },
  };
}
