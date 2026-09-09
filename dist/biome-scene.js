import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  scatter,
  createInstances,
  disposeInstances,
  seededRandom,
} from "@cranberry-forge/biome";
import { releaseObject } from "./scene.js";

export const BIOME_PRESETS = [
  {
    id: "alpine",
    name: "Alpine sanctuary",
    caption: "Cedar · jade · mountain air",
    swatch: "linear-gradient(135deg,#a3b59a,#49735e 45%,#243e38)",
    title: "Small seed.<br>Whole world.",
    label: "STUDY 001 / ALPINE SANCTUARY",
    description: "Shape a landscape. Let the details find their place.",
    colors: ["#436847", "#728853", "#284d3d"],
    ground: "#5d7657",
    rock: "#3d4e48",
    water: "#7fafad",
    fog: "#243b40",
    seed: 42,
    count: 440,
    relief: 1.4,
  },
  {
    id: "autumn",
    name: "The amber hour",
    caption: "Copper · ochre · late sunlight",
    swatch: "linear-gradient(135deg,#f0c277,#be793c 50%,#623c2b)",
    title: "A season.<br>In a second.",
    label: "STUDY 002 / THE AMBER HOUR",
    description: "Same rules. A completely different place.",
    colors: ["#b97436", "#d3a354", "#985333"],
    ground: "#857452",
    rock: "#584d42",
    water: "#83a8a3",
    fog: "#3d3531",
    seed: 178,
    count: 300,
    relief: 1.1,
  },
  {
    id: "otherworld",
    name: "After the humans",
    caption: "Bioluminescence · impossible blue",
    swatch: "linear-gradient(135deg,#76daca,#347da0 50%,#3e3165)",
    title: "Nature.<br>Reimagined.",
    label: "STUDY 003 / AFTER THE HUMANS",
    description: "Plant something that has never grown before.",
    colors: ["#366e87", "#60afa2", "#625790"],
    ground: "#38575a",
    rock: "#33384e",
    water: "#6acbc8",
    fog: "#182938",
    seed: 971,
    count: 370,
    relief: 1.65,
  },
];

export const pathPoints = Array.from({ length: 45 }, (_, i) => {
  const z = -18 + i * 0.82;
  return [Math.sin(z * 0.22) * 3, z];
});

export function terrainHeight(x, z, relief = 1.4) {
  return (
    1.1 +
    relief *
      (Math.sin(x * 0.16 + 0.5) * Math.cos(z * 0.12) * 0.72 +
        Math.sin(z * 0.32 + x * 0.17) * 0.23 +
        Math.cos(x * 0.42 - z * 0.21) * 0.13) +
    Math.max(0, (x + z - 8) / 15) * relief
  );
}

/** Export the actual world, excluding lights, backdrop and authoring helpers. */
export function createBiomeExport(root) {
  const scene = new THREE.Scene();
  scene.name = "Biome export";
  root.traverse((o) => {
    if (
      o.isInstancedMesh ||
      ["Terrain", "Island strata", "Exclusion watercourse"].includes(o.name)
    ) {
      const clone = o.clone();
      o.updateWorldMatrix(true, false);
      clone.matrix.copy(o.matrixWorld);
      clone.matrixAutoUpdate = false;
      scene.add(clone);
    }
  });
  return scene;
}

function groundGeometry(radius, relief) {
  const positions = [0, terrainHeight(0, 0, relief), 0],
    colors = [0.82, 0.82, 0.82],
    indices = [],
    rings = 48,
    segments = 160;
  const green = new THREE.Color("#ffffff");
  for (let j = 1; j <= rings; j++)
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2,
        r = (j / rings) * radius,
        x = Math.cos(angle) * r,
        z = Math.sin(angle) * r;
      positions.push(x, terrainHeight(x, z, relief), z);
      const shade = 0.82 + 0.14 * Math.sin(x * 0.32) * Math.cos(z * 0.28);
      green.setRGB(shade, shade, shade);
      colors.push(green.r, green.g, green.b);
      if (i < segments) {
        const a = 1 + (j - 1) * (segments + 1) + i;
        if (j === 1) indices.push(0, a + 1, a);
        if (j < rings) {
          const b = a + segments + 1;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function cliffGeometry(radius, relief) {
  const positions = [],
    indices = [],
    segments = 160;
  for (let j = 0; j < 4; j++)
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const top = terrainHeight(
        Math.cos(a) * radius,
        Math.sin(a) * radius,
        relief,
      );
      const r = radius * (j === 0 ? 1 : j === 1 ? 1.01 : j === 2 ? 0.95 : 0.83);
      positions.push(
        Math.cos(a) * r,
        j === 0
          ? top
          : j === 1
            ? -0.1 + Math.sin(a * 7) * 0.15
            : j === 2
              ? -1.1
              : -2.6 + Math.sin(a * 9) * 0.2,
        Math.sin(a) * r,
      );
      if (j < 3 && i < segments) {
        const b = j * (segments + 1) + i,
          c = b + segments + 1;
        indices.push(b, b + 1, c, b + 1, c + 1, c);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function makePrototype(preset) {
  const trunks = [],
    crowns = [];
  const trunk = new THREE.CylinderGeometry(0.09, 0.17, 2.6, 7).translate(
    0,
    1.3,
    0,
  );
  trunks.push(trunk);
  if (preset.id === "alpine") {
    for (let i = 0; i < 4; i++)
      crowns.push(
        new THREE.ConeGeometry(
          0.92 - i * 0.14,
          1.65 - i * 0.15,
          8,
          1,
        ).translate(0, 1.65 + i * 0.55, 0),
      );
  } else if (preset.id === "autumn") {
    const offsets = [
      [0, 2.8, 0, 1.03],
      [-0.58, 2.4, 0.3, 0.7],
      [0.55, 2.65, 0.2, 0.8],
      [0.1, 3.35, -0.1, 0.6],
    ];
    offsets.forEach(([x, y, z, s]) =>
      crowns.push(
        new THREE.IcosahedronGeometry(s, 1)
          .scale(1, 0.83, 1)
          .translate(x, y, z),
      ),
    );
    [-1, 1].forEach((side) =>
      trunks.push(
        new THREE.CylinderGeometry(0.045, 0.08, 1.2, 5)
          .rotateZ(side * 0.5)
          .translate(side * 0.23, 2.2, 0),
      ),
    );
  } else {
    crowns.push(
      new THREE.SphereGeometry(1.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)
        .scale(1, 0.5, 1)
        .translate(0, 2.6, 0),
    );
    crowns.push(new THREE.ConeGeometry(0.35, 0.8, 7).translate(0, 2.95, 0));
  }
  const trunkGeo = mergeGeometries(trunks),
    crownGeo = mergeGeometries(crowns);
  trunks.forEach((g) => g.dispose());
  crowns.forEach((g) => g.dispose());
  const material = new THREE.MeshStandardMaterial({
    color: "#695440",
    roughness: 1,
    flatShading: true,
  });
  const leaves = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.9,
    flatShading: true,
  });
  if (preset.id === "otherworld") {
    leaves.emissive = new THREE.Color("#2e6971");
    leaves.emissiveIntensity = 0.4;
  }
  return [
    { name: "Trunks", geometry: trunkGeo, material },
    { name: "Canopy", geometry: crownGeo, material: leaves },
  ];
}

export function createBiomeScene(stage, params, onStats) {
  const group = new THREE.Group();
  group.name = "Biome landscape";
  stage.scene.add(group);
  const ambient = new THREE.HemisphereLight("#e3efdf", "#374345", 2.15);
  group.add(ambient);
  const sun = new THREE.DirectionalLight("#ffe2ab", 4.2);
  sun.position.set(-12, 28, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.normalBias = 0.12;
  sun.shadow.bias = -0.0002;
  sun.shadow.camera.far = 80;
  group.add(sun);
  const rim = new THREE.DirectionalLight("#8bc7e5", 2.4);
  rim.position.set(10, 9, -15);
  group.add(rim);
  const set = new THREE.Group();
  group.add(set);
  let field = null,
    result = null,
    parts = null,
    customParts = null,
    preset = BIOME_PRESETS[0],
    ground = null;
  let buildMs = 0,
    disposed = false;
  const rebuild = () => {
    const started = performance.now();
    preset =
      BIOME_PRESETS.find((p) => p.id === params.preset) ?? BIOME_PRESETS[0];
    stage.scene.background = new THREE.Color(preset.fog);
    stage.scene.fog = new THREE.FogExp2(preset.fog, 0.01);
    stage.bloom.strength = preset.id === "otherworld" ? 0.38 : 0.12;
    stage.bloom.threshold = 1.05;
    if (field) {
      disposeInstances(field);
      field = null;
    }
    if (parts && parts !== customParts) {
      parts.forEach((p) => {
        p.geometry.dispose();
        p.material.dispose();
      });
    }
    parts = null;
    releaseObject(set);
    group.add(set);
    const terrain = new THREE.MeshStandardMaterial({
      color: preset.ground,
      roughness: 1,
      vertexColors: true,
    });
    ground = new THREE.Mesh(groundGeometry(16.7, params.relief), terrain);
    ground.receiveShadow = true;
    ground.name = "Terrain";
    set.add(ground);
    const cliff = new THREE.Mesh(
      cliffGeometry(16.7, params.relief),
      new THREE.MeshStandardMaterial({
        color: preset.rock,
        roughness: 1,
        flatShading: true,
      }),
    );
    cliff.name = "Island strata";
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    set.add(cliff);
    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(15.1, 13.9, 0.3, 120),
      new THREE.MeshStandardMaterial({ color: preset.rock, roughness: 1 }),
    );
    bottom.position.y = -2.55;
    set.add(bottom);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(17.25, 0.018, 4, 160),
      new THREE.MeshBasicMaterial({
        color: "#b7ceb1",
        transparent: true,
        opacity: 0.28,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -2.7;
    set.add(ring);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ color: preset.fog, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.6;
    floor.receiveShadow = true;
    set.add(floor);
    const roadPositions = [],
      roadIndices = [];
    const width = params.pathWidth;
    if (width > 0) {
      const visiblePath = pathPoints.filter(([, z]) => Math.abs(z) < 16.6);
      for (let i = 0; i < visiblePath.length; i++) {
        const [x, z] = visiblePath[i],
          edge = Math.sqrt(16.65 ** 2 - z ** 2);
        for (const side of [-1, 1]) {
          const xx = Math.max(-edge, Math.min(edge, x + side * width * 0.46));
          roadPositions.push(
            xx,
            terrainHeight(xx, z, params.relief) + 0.028,
            z,
          );
        }
        if (i < visiblePath.length - 1) {
          const a = i * 2;
          roadIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(roadPositions, 3),
      );
      g.setIndex(roadIndices);
      g.computeVertexNormals();
      // Geometry is clipped to the island, so the exported GLB matches the preview.
      const m = new THREE.MeshStandardMaterial({
        color: preset.water,
        metalness: 0.25,
        roughness: 0.25,
        side: THREE.DoubleSide,
      });
      const river = new THREE.Mesh(g, m);
      river.name = "Exclusion watercourse";
      set.add(river);
    }
    for (const e of params.clearings) {
      const circle = new THREE.Mesh(
        new THREE.RingGeometry(e.radius - 0.03, e.radius + 0.03, 64),
        new THREE.MeshBasicMaterial({
          color: "#e2efab",
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
        }),
      );
      circle.rotation.x = -Math.PI / 2;
      circle.position.set(
        e.x,
        terrainHeight(e.x, e.z, params.relief) + 0.05,
        e.z,
      );
      set.add(circle);
    }
    result = scatter(
      {
        seed: params.seed,
        count: params.count,
        radius: 15.7,
        minDistance: params.spacing,
        maxSlope: params.slope,
        scale: [params.scale * 0.65, params.scale * 1.15],
        maxAttempts: Math.min(120000, params.count * 150),
        exclusions: [
          ...(width > 0
            ? [{ type: "path", points: pathPoints, width: width + 0.5 }]
            : []),
          ...params.clearings,
        ],
      },
      (x, z) => terrainHeight(x, z, params.relief),
    );
    parts = customParts ?? makePrototype(preset);
    field = createInstances(result, parts);
    if (!customParts) {
      const rng = seededRandom((params.seed + 1) >>> 0),
        palette = preset.colors.map((c) => new THREE.Color(c));
      const canopy = field.children[1];
      for (let i = 0; i < result.points.length; i++) {
        const color = palette[Math.floor(rng() * palette.length)]
          .clone()
          .multiplyScalar(0.8 + rng() * 0.3);
        canopy.setColorAt(i, color);
      }
      if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
    }
    group.add(field);
    const rng = seededRandom(182),
      rockGeo = new THREE.IcosahedronGeometry(1, 0),
      rockMat = new THREE.MeshStandardMaterial({
        color: preset.rock,
        roughness: 1,
        flatShading: true,
      });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 110),
      dummy = new THREE.Object3D();
    for (let i = 0; i < 110; i++) {
      const angle = rng() * Math.PI * 2,
        r = 5 + rng() * 11,
        x = Math.cos(angle) * r,
        z = Math.sin(angle) * r;
      dummy.position.set(x, terrainHeight(x, z, params.relief) + 0.06, z);
      dummy.scale.set(
        0.15 + rng() * 0.42,
        0.15 + rng() * 0.45,
        0.2 + rng() * 0.45,
      );
      dummy.rotation.set(rng(), rng() * 6, rng());
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    rocks.name = "Ground stones";
    set.add(rocks);
    buildMs = performance.now() - started;
    onStats?.({ ...result.stats, buildMs });
  };
  rebuild();
  return {
    group,
    rebuild,
    get result() {
      return result;
    },
    get params() {
      return params;
    },
    get ground() {
      return ground;
    },
    get buildMs() {
      return buildMs;
    },
    update() {},
    async importGLB(buffer) {
      if (buffer.byteLength > 20 * 1024 * 1024)
        throw new Error("Please use a GLB smaller than 20 MB.");
      // External URIs are intentionally rejected: GLB imports must be self-contained.
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => {
        if (!url.startsWith("blob:") && !url.startsWith("data:"))
          throw new Error("Use a self-contained GLB with embedded textures.");
        return url;
      });
      const gltf = await new GLTFLoader(manager).parseAsync(buffer, "");
      if (disposed) {
        releaseObject(gltf.scene);
        throw new Error("Import cancelled because the active tool changed.");
      }
      gltf.scene.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(gltf.scene),
        size = bounds.getSize(new THREE.Vector3()),
        center = bounds.getCenter(new THREE.Vector3());
      if (!Number.isFinite(size.y) || size.y < 0.0001) {
        releaseObject(gltf.scene);
        throw new Error("The GLB needs a visible mesh with nonzero height.");
      }
      const normalized = new THREE.Matrix4()
        .makeScale(3.8 / size.y, 3.8 / size.y, 3.8 / size.y)
        .multiply(
          new THREE.Matrix4().makeTranslation(
            -center.x,
            -bounds.min.y,
            -center.z,
          ),
        );
      const next = [];
      let triangles = 0,
        unsupported = false;
      gltf.scene.traverse((o) => {
        if (
          o.isSkinnedMesh ||
          o.isInstancedMesh ||
          o.morphTargetInfluences?.length
        )
          unsupported = true;
        if (o.isMesh) {
          triangles +=
            (o.geometry.index?.count ?? o.geometry.attributes.position.count) /
            3;
          next.push({
            geometry: o.geometry.clone(),
            material: Array.isArray(o.material)
              ? o.material.map((m) => m.clone())
              : o.material.clone(),
            matrix: normalized.clone().multiply(o.matrixWorld),
            name: o.name,
          });
        }
      });
      const releaseParts = (list) =>
        list?.forEach((p) => {
          p.geometry.dispose();
          (Array.isArray(p.material) ? p.material : [p.material]).forEach((m) =>
            m.dispose(),
          );
        });
      if (
        !next.length ||
        next.length > 16 ||
        triangles > 30000 ||
        unsupported
      ) {
        releaseParts(next);
        releaseObject(gltf.scene);
        throw new Error(
          "Use a static GLB: 1–16 mesh parts, up to 30k triangles, no skinning, morphs or nested instances.",
        );
      }
      // Cloned materials share texture ownership with gltf.scene; retain it until replacement/disposal.
      if (field) {
        disposeInstances(field);
        field = null;
      }
      if (parts && parts !== customParts) releaseParts(parts);
      parts = null;
      releaseParts(customParts);
      if (this.sourceAsset) releaseObject(this.sourceAsset);
      this.sourceAsset = gltf.scene;
      customParts = next;
      params.count = Math.min(
        params.count,
        Math.max(10, Math.floor(1500000 / triangles)),
      );
      rebuild();
      return { parts: next.length, triangles, count: params.count };
    },
    dispose() {
      disposed = true;
      if (field) {
        disposeInstances(field);
        field = null;
      }
      parts?.forEach((p) => {
        p.geometry.dispose();
        (Array.isArray(p.material) ? p.material : [p.material]).forEach((m) =>
          m.dispose(),
        );
      });
      if (this.sourceAsset) releaseObject(this.sourceAsset);
      releaseObject(group);
      sun.shadow.map?.dispose();
    },
  };
}
