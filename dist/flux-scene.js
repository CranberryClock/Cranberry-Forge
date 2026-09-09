import * as THREE from "three";
import { Trail } from "@cranberry-forge/flux";
import { releaseObject } from "./scene.js";

export const FLUX_PRESETS = [
  {
    id: "aurora",
    name: "Aurora engine",
    caption: "Orbital ribbons · emerald light",
    swatch: "linear-gradient(135deg,#c0ffd1,#42b9a3 45%,#123b52)",
    label: "STUDY 004 / AURORA ENGINE",
    title: "Make motion<br>unforgettable.",
    description: "Give every movement a luminous memory.",
    color: "#b2ffcd",
    tailColor: "#1d7392",
    colors: ["#b2ffcd", "#82e8cb", "#92eaf5", "#d1fcb1", "#4eb39f"],
    speed: 1,
    lifetime: 2.7,
    width: 0.55,
    count: 7,
    background: "#0c1e24",
  },
  {
    id: "solar",
    name: "Solar flare",
    caption: "Magnetic arcs · molten gold",
    swatch: "linear-gradient(135deg,#ffe5a5,#ef8945 50%,#84333c)",
    label: "STUDY 005 / SOLAR FLARE",
    title: "A little more<br>firepower.",
    description: "From a quiet orbit to a spell worth casting.",
    color: "#ffe0a2",
    tailColor: "#bf402e",
    colors: ["#ffe0a2", "#ffad66", "#ff7250", "#fbb575", "#ffeab2"],
    speed: 1.2,
    lifetime: 2.1,
    width: 0.38,
    count: 9,
    background: "#261819",
  },
  {
    id: "silk",
    name: "Electric silk",
    caption: "Chromatic loops · liquid violet",
    swatch: "linear-gradient(135deg,#e8b9ff,#9460e1 45%,#3846b4)",
    label: "STUDY 006 / ELECTRIC SILK",
    title: "Draw with<br>pure energy.",
    description: "A trail of possibilities. Follow your own path.",
    color: "#e8b6ff",
    tailColor: "#424bd1",
    colors: ["#e8b6ff", "#a291ff", "#7dabff", "#f5c1e6", "#997ae8"],
    speed: 0.75,
    lifetime: 3.8,
    width: 0.8,
    count: 5,
    background: "#171727",
  },
];

export function createFluxScene(stage, params, onStats) {
  const group = new THREE.Group();
  group.name = "Flux motion study";
  stage.scene.add(group);
  const decor = new THREE.Group();
  group.add(decor);
  const hemi = new THREE.HemisphereLight("#91c9dc", "#17232c", 2);
  decor.add(hemi);
  const light = new THREE.PointLight("#87e4c8", 150, 45);
  light.position.set(0, 4, 0);
  decor.add(light);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(65, 100),
    new THREE.MeshStandardMaterial({
      color: "#10232a",
      metalness: 0.7,
      roughness: 0.38,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -5.5;
  decor.add(floor);
  for (const r of [5.5, 8, 12, 18]) {
    const line = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.012, 4, 180),
      new THREE.MeshBasicMaterial({
        color: "#648d95",
        transparent: true,
        opacity: 0.21,
      }),
    );
    line.rotation.x = Math.PI / 2;
    line.position.y = -5.47;
    decor.add(line);
  }
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.15, 1),
    new THREE.MeshStandardMaterial({
      color: "#142e37",
      metalness: 0.65,
      roughness: 0.28,
      emissive: "#173842",
      emissiveIntensity: 0.65,
    }),
  );
  core.position.y = 1.5;
  decor.add(core);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.035, 6, 100),
    new THREE.MeshBasicMaterial({
      color: "#7badac",
      transparent: true,
      opacity: 0.55,
    }),
  );
  halo.position.y = 1.5;
  halo.rotation.x = 1;
  decor.add(halo);
  const starPoints = [];
  for (let i = 0; i < 280; i++) {
    const n = Math.sin(i * 177.17) * 43758.54,
      f = n - Math.floor(n),
      n2 = Math.sin(i * 85.78) * 17185.7,
      f2 = n2 - Math.floor(n2);
    starPoints.push(
      (f - 0.5) * 110,
      (f2 - 0.25) * 65,
      -30 - Math.abs(Math.sin(i)) * 25,
    );
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPoints, 3),
    ),
    new THREE.PointsMaterial({
      color: "#b0d2d9",
      size: 0.035,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    }),
  );
  decor.add(stars);
  let trails = [],
    emitters = [],
    time = 0,
    paused =
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false,
    burst = false,
    preset = FLUX_PRESETS[0];
  const point = new THREE.Vector3();
  function motion(t, i) {
    const phase = (i / params.count) * Math.PI * 2,
      variant = params.preset;
    if (variant === "silk")
      point.set(
        Math.sin(t * 0.9 + phase) * 7,
        1.5 + Math.sin(t * 1.8 + phase * 0.8) * 4,
        Math.cos(t * 0.6 + phase) * 5,
      );
    else if (variant === "solar") {
      const r = 5.5 + Math.sin(t * 1.4 + i) * 1.5;
      point.set(
        Math.cos(t + phase) * r,
        1.5 + Math.sin(t * 1.7 + phase) * 4,
        Math.sin(t + phase) * r,
      );
    } else
      point.set(
        Math.cos(t + phase) * (6.5 + Math.sin(t * 0.65 + i) * 1.2),
        1.5 + Math.sin(t * 1.4 + phase) * 3.4,
        Math.sin(t + phase) * 5.5,
      );
    if (burst) point.multiplyScalar(1.6);
    return point;
  }
  const rebuild = () => {
    trails.forEach((t) => t.dispose());
    emitters.forEach((e) => {
      e.geometry.dispose();
      e.material.dispose();
      e.removeFromParent();
    });
    trails = [];
    emitters = [];
    time = 0;
    preset =
      FLUX_PRESETS.find((p) => p.id === params.preset) ?? FLUX_PRESETS[0];
    stage.scene.background = new THREE.Color(preset.background);
    stage.scene.fog = new THREE.FogExp2(preset.background, 0.018);
    stage.bloom.strength = 0.65;
    stage.bloom.threshold = 0.75;
    stage.bloom.radius = 0.6;
    floor.material.color.set(preset.background);
    light.color.set(preset.color);
    halo.material.color.set(preset.color);
    for (let i = 0; i < params.count; i++) {
      const color = params.color ?? preset.colors[i % preset.colors.length];
      const trail = new Trail({
        capacity: 512,
        lifetime: params.lifetime,
        width: params.width,
        taper: params.taper,
        intensity: params.intensity,
        color,
        tailColor: params.tailColor ?? preset.tailColor,
        maxJump: 10,
      });
      group.add(trail);
      trails.push(trail);
      const emitter = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 6),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color).multiplyScalar(3),
        }),
      );
      group.add(emitter);
      emitters.push(emitter);
    }
    // Warm the trail with real historical samples so each study is immediately useful.
    const steps = Math.ceil(params.lifetime * 60);
    for (let k = 0; k <= steps; k++) {
      const t = k / 60;
      trails.forEach((trail, i) => trail.push(motion(t * params.speed, i), t));
    }
    time = steps / 60;
    trails.forEach((t, i) => {
      t.update(time, stage.camera.position);
      emitters[i].position.copy(motion(time * params.speed, i));
    });
    onStats?.({ placed: trails.reduce((n, t) => n + t.sampleCount, 0) });
  };
  rebuild();
  return {
    group,
    rebuild,
    get trails() {
      return trails;
    },
    get paused() {
      return paused;
    },
    set paused(v) {
      paused = v;
    },
    burst() {
      burst = !burst;
      trails.forEach((t) => t.break());
      return burst;
    },
    update(dt, elapsed, camera) {
      if (!paused) {
        time += dt;
        trails.forEach((trail, i) => {
          const p = motion(time * params.speed, i);
          trail.push(p, time);
          emitters[i].position.copy(p);
        });
        core.rotation.y += dt * 0.2;
        core.rotation.z += dt * 0.09;
        halo.rotation.y += dt * 0.3;
      }
      trails.forEach((t) => t.update(time, camera.position));
    },
    dispose() {
      trails.forEach((t) => t.dispose());
      releaseObject(group);
    },
  };
}
