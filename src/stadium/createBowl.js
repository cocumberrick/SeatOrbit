import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA, BOWL } from '../config/stadiumConfig.js';
import { createStadiumOvalShape, createStadiumOvalPath, getTierLayouts, getRowOval } from './arenaHelpers.js';
import { SECTION_PROFILE_MAP, getSectionGeometry } from './arenaGeometryData.js';
import { ghost } from './arenaDetail.js';

function createConcreteTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = bumpCanvas.width = bumpCanvas.height = size;
  const colorContext = colorCanvas.getContext('2d');
  const bumpContext = bumpCanvas.getContext('2d');
  colorContext.fillStyle = '#b4b9bd';
  colorContext.fillRect(0, 0, size, size);
  bumpContext.fillStyle = '#808080';
  bumpContext.fillRect(0, 0, size, size);

  let seed = 731;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 26000; i++) {
    const x = random() * size;
    const y = random() * size;
    const shade = Math.floor(105 + random() * 85);
    colorContext.fillStyle = `rgba(${shade},${shade + 2},${shade + 4},${0.025 + random() * 0.07})`;
    colorContext.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
    const relief = Math.floor(105 + random() * 48);
    bumpContext.fillStyle = `rgba(${relief},${relief},${relief},0.22)`;
    bumpContext.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 3);
  bumpMap.repeat.copy(map.repeat);
  map.anisotropy = bumpMap.anisotropy = 4;
  return { map, bumpMap };
}

function createOvalBand(layout, rowIndex, radialOffset, width, bottomY, topY) {
  const rowLayout = { ...layout, frontOffset: layout.frontOffset + radialOffset };
  const center = getRowOval(rowLayout, rowIndex);
  const halfRow = layout.cfg.rowDepth / 2;
  // getRowOval returns the row centreline used by the seat matrices. Centre the
  // concrete tread on that same line; shifting the whole tread outward by half
  // a row leaves the seat feet visibly unsupported at low camera angles.
  const innerDistance = -halfRow;
  const outerDistance = halfRow + Math.max(0, width - layout.cfg.rowDepth);
  const outer = createStadiumOvalShape(
    center.halfL + outerDistance,
    center.halfW + outerDistance,
    center.radius + outerDistance
  );
  outer.holes.push(createStadiumOvalPath(
    Math.max(0.1, center.halfL + innerDistance),
    Math.max(0.1, center.halfW + innerDistance),
    Math.max(0.1, center.radius + innerDistance)
  ));
  const geometry = new THREE.ExtrudeGeometry(outer, {
    depth: Math.max(0.01, topY - bottomY),
    bevelEnabled: false,
    steps: 1,
    curveSegments: 64
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottomY, 0);
  return geometry;
}

function createFrontGuard(group, layout) {
  const firstRow = getRowOval(layout, 0);
  const inset = layout.cfg.rowDepth / 2 + 0.28;
  const guardOval = {
    halfL: firstRow.halfL - inset,
    halfW: firstRow.halfW - inset,
    radius: Math.max(0.1, firstRow.radius - inset)
  };
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc7e9fa,
    transparent: true,
    opacity: 0.22,
    transmission: 0.72,
    thickness: 0.04,
    roughness: 0.08,
    ior: 1.45,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x343b43, metalness: 0.72, roughness: 0.3 });
  const glassShape = createStadiumOvalShape(
    guardOval.halfL + 0.035,
    guardOval.halfW + 0.035,
    guardOval.radius + 0.035
  );
  glassShape.holes.push(createStadiumOvalPath(
    guardOval.halfL - 0.035,
    guardOval.halfW - 0.035,
    Math.max(0.1, guardOval.radius - 0.035)
  ));
  const glassGeometry = new THREE.ExtrudeGeometry(glassShape, {
    depth: 0.95,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 64
  });
  glassGeometry.rotateX(-Math.PI / 2);
  glassGeometry.translate(0, layout.baseY + 0.2, 0);
  const glass = ghost(new THREE.Mesh(glassGeometry, glassMaterial));
  glass.name = 'LowerBowlFrontGlass';
  group.add(glass);

  const railY = layout.baseY + 1.18;
  const railCurve = new THREE.CatmullRomCurve3(
    createStadiumOvalPath(guardOval.halfL, guardOval.halfW, guardOval.radius)
      .getPoints(128)
      .map((point) => new THREE.Vector3(point.x, railY, point.y)),
    true
  );
  const rail = ghost(new THREE.Mesh(new THREE.TubeGeometry(railCurve, 256, 0.045, 6, true), railMaterial));
  rail.name = 'LowerBowlFrontRail';
  group.add(rail);

  return { glassMaterial, railMaterial };
}

export function createBowl(seatPlacements = []) {
  const group = new THREE.Group();
  group.name = 'Bowl';

  const textures = createConcreteTextures();
  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.map,
    bumpMap: textures.bumpMap,
    bumpScale: 0.045,
    emissive: 0x17191b,
    emissiveIntensity: 0.35,
    roughness: 0.88,
    metalness: 0.03
  });
  const layouts = getTierLayouts();
  const layoutByTier = new Map(layouts.map((layout, index) => [[100, 200, 300][index], layout]));
  const tierGeometry = new Map(layouts.map((layout, index) => [[100, 200, 300][index], []]));
  const profilesByTier = new Map([[100, []], [200, []], [300, []]]);
  for (const sectionId of Object.keys(SECTION_PROFILE_MAP)) {
    const profile = getSectionGeometry(sectionId);
    profilesByTier.get(profile.tier).push(profile);
  }
  const tierFloors = [
    BOWL.fieldElevation,
    BOWL.fieldElevation + ARENA.concourse1.elevation,
    BOWL.fieldElevation + ARENA.concourse2.elevation
  ];

  layouts.forEach((layout, tierIndex) => {
    const tierNumber = [100, 200, 300][tierIndex];
    const profiles = profilesByTier.get(tierNumber);
    const maxRows = layout.cfg.rows;
    for (let row = 1; row <= maxRows; row++) {
      const offsets = new Set();
      for (const profile of profiles) {
        if (profile.rows < row || (profile.omittedFrontRows || []).includes(row)) continue;
        const priorWalkways = (profile.walkwaysAfterRows || []).filter((afterRow) => afterRow < row).length;
        offsets.add(priorWalkways * (profile.walkwayWidthMeters || 0));
      }
      if (!offsets.size) offsets.add(0);
      const topY = layout.baseY + row * layout.cfg.riserHeight;
      const bottomY = row === 1
        ? Math.min(tierFloors[tierIndex], topY - layout.cfg.riserHeight)
        : topY - layout.cfg.riserHeight;
      for (const offset of offsets) {
        tierGeometry.get(tierNumber).push(createOvalBand(layout, row - 1, offset, layout.cfg.rowDepth, bottomY, topY));
      }
    }

    // Walkways occupy the radial gap after their row at the same elevation as that tread.
    const walkwayBands = new Set();
    for (const profile of profiles) {
      for (const afterRow of profile.walkwaysAfterRows || []) {
        const priorWalkways = (profile.walkwaysAfterRows || []).filter((row) => row < afterRow).length;
        const offset = priorWalkways * (profile.walkwayWidthMeters || 0);
        const width = profile.walkwayWidthMeters || 0;
        if (width <= 0) continue;
        const key = `${afterRow}|${offset}|${width}`;
        if (walkwayBands.has(key)) continue;
        walkwayBands.add(key);
        const y = layout.baseY + afterRow * layout.cfg.riserHeight;
        const rowLayout = { ...layout, frontOffset: layout.frontOffset + offset };
        const center = getRowOval(rowLayout, afterRow - 1);
        const halfRow = layout.cfg.rowDepth / 2;
        const outer = createStadiumOvalShape(
          center.halfL + halfRow + width,
          center.halfW + halfRow + width,
          center.radius + halfRow + width
        );
        outer.holes.push(createStadiumOvalPath(
          center.halfL + halfRow,
          center.halfW + halfRow,
          center.radius + halfRow
        ));
        const walk = new THREE.ExtrudeGeometry(outer, { depth: 0.12, bevelEnabled: false, steps: 1, curveSegments: 64 });
        walk.rotateX(-Math.PI / 2);
        walk.translate(0, y - 0.12, 0);
        tierGeometry.get(tierNumber).push(walk);
      }
    }
  });

  layouts.forEach((layout, tierIndex) => {
    const tierNumber = [100, 200, 300][tierIndex];
    const geometries = tierGeometry.get([100, 200, 300][tierIndex]);
    if (!geometries.length) throw new Error(`No seat footprints provided for ${layout.meshName}`);
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) throw new Error(`Could not merge ${layout.meshName} geometry`);
    merged.computeVertexNormals();
    const mesh = ghost(new THREE.Mesh(merged, concreteMaterial));
    mesh.name = layout.meshName;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);

  });

  // The guard is inset from row 1 so its panels and rail clear the existing seat footprint.
  const guardMaterials = createFrontGuard(group, layouts[0]);

  group.userData.dispose = () => {
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
    });
    textures.map.dispose();
    textures.bumpMap.dispose();
    concreteMaterial.dispose();
    guardMaterials.glassMaterial.dispose();
    guardMaterials.railMaterial.dispose();
  };
  return group;
}
