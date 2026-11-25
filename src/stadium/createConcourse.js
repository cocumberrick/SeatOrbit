import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA, BOWL } from '../config/stadiumConfig.js';
import { SECTION_PROFILE_MAP, getSectionGeometry } from './arenaGeometryData.js';
import { resolveSectionCenter } from './sectionCenters.js';
import { ovalArcAtAngle } from './sectionPlacement.js';
import { ghost } from './arenaDetail.js';
import { QUALITY_MODE } from '../config/renderQuality.js';
import {
  createStadiumOvalShape,
  createStadiumOvalPath,
  getTierLayouts,
  getTierBackOval,
  getStadiumOvalPointAt,
  getStadiumOvalPerimeter
} from './arenaHelpers.js';

const SLAB_THICKNESS = 0.4;

function makeSignTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#081b3c');
  gradient.addColorStop(1, '#123d75');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#c8102e';
  context.fillRect(0, canvas.height - 9, canvas.width, 9);
  context.fillStyle = '#ffffff';
  context.font = 'bold 40px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2 - 4, canvas.width - 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function setInstance(mesh, index, position, yaw) {
  const object = new THREE.Object3D();
  object.position.copy(position);
  object.rotation.y = yaw;
  object.updateMatrix();
  mesh.setMatrixAt(index, object.matrix);
}

function createPremiumChairGeometry() {
  const parts = [];
  const addPart = (width, height, depth, x, y, z) => {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.translate(x, y, z);
    parts.push(geometry);
  };

  addPart(0.62, 0.16, 0.58, 0, 0.43, 0);
  addPart(0.62, 0.72, 0.16, 0, 0.84, -0.2);
  addPart(0.1, 0.36, 0.58, -0.26, 0.57, 0);
  addPart(0.1, 0.36, 0.58, 0.26, 0.57, 0);
  for (const x of [-0.22, 0.22]) {
    for (const z of [-0.2, 0.2]) addPart(0.07, 0.38, 0.07, x, 0.2, z);
  }

  const geometry = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error('Could not build premium lounge chair geometry');
  return geometry;
}

function addSectionPortals(group, layout, tierNumber, floorY) {
  const sections = Object.keys(SECTION_PROFILE_MAP)
    .filter((sectionId) => getSectionGeometry(sectionId).tier === tierNumber)
    .map((sectionId) => ({ center: resolveSectionCenter(sectionId) }))
    .filter((entry) => entry.center)
    .map((entry) => ({ ...entry, angle: (entry.center.deg * Math.PI) / 180 }))
    .sort((a, b) => a.angle - b.angle);
  if (!sections.length) return [];

  const back = getTierBackOval(layout);
  const portals = [];
  for (let index = 0; index < sections.length; index++) {
    const first = sections[index];
    const second = sections[(index + 1) % sections.length];
    const delta = (second.angle - first.angle + Math.PI * 2) % (Math.PI * 2);
    if (delta > 0.42) continue;
    let angle = first.angle + delta / 2;
    if (angle >= Math.PI * 2) angle -= Math.PI * 2;
    portals.push(angle);
  }
  const count = portals.length;
  if (!count) return [];
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x69727a, metalness: 0.48, roughness: 0.46 });
  const labelTexture = makeSignTexture('SECTION ENTRY');
  const labelMaterial = new THREE.MeshBasicMaterial({ map: labelTexture, toneMapped: false, side: THREE.DoubleSide });
  const sideGeometry = new THREE.BoxGeometry(0.13, 2.45, 0.22);
  const headerGeometry = new THREE.BoxGeometry(1.65, 0.2, 0.24);
  const labelGeometry = new THREE.PlaneGeometry(1.55, 0.34);
  const left = ghost(new THREE.InstancedMesh(sideGeometry, frameMaterial, count));
  const right = ghost(new THREE.InstancedMesh(sideGeometry, frameMaterial, count));
  const headers = ghost(new THREE.InstancedMesh(headerGeometry, frameMaterial, count));
  const labels = ghost(new THREE.InstancedMesh(labelGeometry, labelMaterial, count));
  const pivot = new THREE.Vector3();

  portals.forEach((angle, index) => {
    const arc = ovalArcAtAngle((angle * 180) / Math.PI, back);
    const point = getStadiumOvalPointAt(arc, back.halfL, back.halfW, back.radius);
    const yaw = Math.atan2(point.nx, point.nz);
    const base = pivot.set(point.x + point.nx * 0.18, 0, point.z + point.nz * 0.18);
    setInstance(left, index, new THREE.Vector3(base.x - Math.cos(yaw) * 0.76, floorY + 1.225, base.z + Math.sin(yaw) * 0.76), yaw);
    setInstance(right, index, new THREE.Vector3(base.x + Math.cos(yaw) * 0.76, floorY + 1.225, base.z - Math.sin(yaw) * 0.76), yaw);
    setInstance(headers, index, new THREE.Vector3(base.x, floorY + 2.55, base.z), yaw);
    setInstance(labels, index, new THREE.Vector3(base.x + point.nx * 0.14, floorY + 2.57, base.z + point.nz * 0.14), yaw);
  });

  left.name = `SectionPortalFrames_${tierNumber}_Left`;
  right.name = `SectionPortalFrames_${tierNumber}_Right`;
  headers.name = `SectionPortalHeaders_${tierNumber}`;
  labels.name = `SectionPortalSigns_${tierNumber}`;
  group.add(left, right, headers, labels);
  return [sideGeometry, headerGeometry, labelGeometry, frameMaterial, labelMaterial, labelTexture];
}

function addConcourseRearWall(group, layout, tierNumber, floorY) {
  const sections = Object.keys(SECTION_PROFILE_MAP)
    .filter((sectionId) => getSectionGeometry(sectionId).tier === tierNumber)
    .map((sectionId) => resolveSectionCenter(sectionId))
    .filter(Boolean)
    .map((center) => (center.deg * Math.PI) / 180)
    .sort((a, b) => a - b);
  const portals = [];
  for (let index = 0; index < sections.length; index++) {
    const first = sections[index];
    const second = sections[(index + 1) % sections.length];
    const delta = (second - first + Math.PI * 2) % (Math.PI * 2);
    if (delta > 0.42) continue;
    portals.push(((first + delta / 2) % (Math.PI * 2)) * 180 / Math.PI);
  }

  const back = getTierBackOval(layout);
  const wallOval = { halfL: back.halfL + 0.2, halfW: back.halfW + 0.2, radius: back.radius + 0.2 };
  const perimeter = getStadiumOvalPerimeter(wallOval.halfL, wallOval.halfW, wallOval.radius);
  const segments = Math.ceil(perimeter / 0.8);
  const portalArcs = portals.map((angle) => ovalArcAtAngle(angle, wallOval));
  const vertices = [];
  const indices = [];
  for (let segment = 0; segment < segments; segment++) {
    const s0 = segment / segments * perimeter;
    const s1 = (segment + 1) / segments * perimeter;
    const middle = (s0 + s1) / 2;
    if (portalArcs.some((arc) => {
      const delta = Math.abs(middle - arc);
      return Math.min(delta, perimeter - delta) < 1.12;
    })) continue;
    const first = getStadiumOvalPointAt(s0, wallOval.halfL, wallOval.halfW, wallOval.radius);
    const second = getStadiumOvalPointAt(s1, wallOval.halfL, wallOval.halfW, wallOval.radius);
    const offset = vertices.length / 3;
    vertices.push(
      first.x, floorY, first.z, first.x, floorY + 2.8, first.z,
      second.x, floorY, second.z, second.x, floorY + 2.8, second.z
    );
    indices.push(offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0x737a80, roughness: 0.9, side: THREE.DoubleSide });
  const wall = ghost(new THREE.Mesh(geometry, material));
  wall.name = `ConcourseRearWall_${tierNumber}`;
  wall.castShadow = false;
  wall.receiveShadow = true;
  group.add(wall);
  return [geometry, material];
}

function getFacilityDoorArcs(layout, cfg, tierNumber, perimeter) {
  const restroomSections = tierNumber === 300 ? [317, 325, 309, 302] : [215, 224, 208, 203];
  const elevators = tierNumber === 300
    ? [{ section: 315, offset: 2.8 }, { section: 309, offset: 2.8 }, { section: 302, copies: 2, offset: 2.8 }, { section: 319 }]
    : [{ section: 215, offset: 2.8 }, { section: 208, offset: 2.8 }, { section: 203, copies: 2, offset: 2.8 }, { section: 121 }];
  const back = getTierBackOval(layout);
  const outer = { halfL: back.halfL + cfg.width, halfW: back.halfW + cfg.width, radius: back.radius + cfg.width };
  const arcs = [];
  const add = (sectionId, offset = 0) => {
    const section = resolveSectionCenter(sectionId);
    if (!section) return;
    const value = ovalArcAtAngle(section.deg, outer) + offset;
    arcs.push((value % perimeter + perimeter) % perimeter);
  };
  restroomSections.forEach((section) => { add(section, -0.68); add(section, 0.68); });
  // Keep the family washroom clear of the nearby elevator entrance at section 215.
  add(tierNumber === 300 ? 325 : tierNumber === 200 ? 216 : 215, -4.0);
  for (const elevator of elevators) {
    const copies = elevator.copies || 1;
    for (let index = 0; index < copies; index++) {
      add(elevator.section, (elevator.offset || 0) + (index - (copies - 1) / 2) * 1.65);
    }
  }
  return { outer, arcs };
}

function createConcourseOuterWallGeometry(layout, cfg, floorY, tierNumber) {
  const back = getTierBackOval(layout);
  const outer = { halfL: back.halfL + cfg.width, halfW: back.halfW + cfg.width, radius: back.radius + cfg.width };
  const outerWallPerimeter = getStadiumOvalPerimeter(outer.halfL + 0.12, outer.halfW + 0.12, outer.radius + 0.12);
  const { arcs } = getFacilityDoorArcs(layout, cfg, tierNumber, outerWallPerimeter);
  const portalAngles = Object.keys(SECTION_PROFILE_MAP)
    .filter((sectionId) => getSectionGeometry(sectionId).tier === tierNumber)
    .map((sectionId) => resolveSectionCenter(sectionId))
    .filter(Boolean).map((section) => section.deg * Math.PI / 180).sort((a, b) => a - b);
  const portalArcs = [];
  for (let index = 0; index < portalAngles.length; index++) {
    const first = portalAngles[index];
    const second = portalAngles[(index + 1) % portalAngles.length];
    const delta = (second - first + Math.PI * 2) % (Math.PI * 2);
    if (delta <= 0.42) portalArcs.push(ovalArcAtAngle(((first + delta / 2) % (Math.PI * 2)) * 180 / Math.PI, outer));
  }
  const segments = Math.ceil(outerWallPerimeter / 0.8);
  const vertices = [];
  const indices = [];
  const openings = [
    ...arcs.map((arc) => ({ arc, halfWidth: 0.78 })),
    ...portalArcs.map((arc) => ({ arc, halfWidth: 1.12 }))
  ];
  for (let segment = 0; segment < segments; segment++) {
    const s0 = segment / segments * outerWallPerimeter;
    const s1 = (segment + 1) / segments * outerWallPerimeter;
    const middle = (s0 + s1) / 2;
    const inOpening = openings.some(({ arc, halfWidth }) => {
      const delta = Math.abs(middle - arc);
      return Math.min(delta, outerWallPerimeter - delta) < halfWidth;
    });
    if (inOpening) continue;
    const first = getStadiumOvalPointAt(s0, outer.halfL + 0.12, outer.halfW + 0.12, outer.radius + 0.12);
    const second = getStadiumOvalPointAt(s1, outer.halfL + 0.12, outer.halfW + 0.12, outer.radius + 0.12);
    const base = vertices.length / 3;
    vertices.push(first.x, 0, first.z, first.x, 2.8, first.z, second.x, 0, second.z, second.x, 2.8, second.z);
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const wall = new THREE.BufferGeometry();
  wall.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  wall.setIndex(indices);
  wall.computeVertexNormals();
  wall.translate(0, floorY, 0);
  return wall;
}

function addConcourseServices(group, layout, cfg, floorY, tierNumber) {
  const locations = tierNumber === 100 ? [
    [103, 'FOOD'], [104, 'BAR'], [105, 'FOOD'], [106, 'SNACKS'], [107, 'BAR'],
    [109, 'FOOD'], [112, 'BAR'], [113, 'FOOD'], [116, 'FOOD'], [117, 'BAR'],
    [118, 'SNACKS'], [119, 'FOOD'], [120, 'BAR'], [121, 'FOOD'], [124, 'GRAB + GO'],
    [125, "CHEF'S KITCHEN"], [126, 'BAR'], [127, 'SNACKS']
  ] : tierNumber === 200 ? [
    [222, 'JETS GEAR']
  ] : tierNumber === 300 ? [
    [301, 'FOOD'], [303, 'BAR'], [304, 'SNACKS'], [305, 'FOOD'], [306, 'FOOD'],
    [308, 'FOOD'], [309, 'BAR'], [310, 'FOOD'], [314, 'FOOD'], [316, 'BAR'],
    [317, 'BAR'], [318, 'SNACKS'], [319, 'FOOD'], [320, 'BAR'], [321, 'FOOD'],
    [324, 'SNACKS'], [325, 'GUEST SERVICES'], [329, 'BAR'], [330, 'GRAB + GO']
  ] : [];
  if (!locations.length) return [];

  const back = getTierBackOval(layout);
  const outer = {
    halfL: back.halfL + cfg.width,
    halfW: back.halfW + cfg.width,
    radius: back.radius + cfg.width
  };
  const count = locations.length;
  const labels = [...new Set(locations.map(([, label]) => label))];
  const bodyGeometry = new THREE.BoxGeometry(2.8, 1.55, 0.72);
  const counterGeometry = new THREE.BoxGeometry(2.9, 0.16, 0.9);
  const signGeometry = new THREE.PlaneGeometry(2.6, 0.5);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x23394e, roughness: 0.72, metalness: 0.08 });
  const counterMaterial = new THREE.MeshStandardMaterial({ color: 0xd8d4c9, roughness: 0.46, metalness: 0.08 });
  const bodies = ghost(new THREE.InstancedMesh(bodyGeometry, bodyMaterial, count));
  const counters = ghost(new THREE.InstancedMesh(counterGeometry, counterMaterial, count));
  const labelMeshes = new Map();
  const textures = [];
  const labelMaterials = [];
  const labelIndex = new Map();
  labels.forEach((label) => {
    const texture = makeSignTexture(label);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
    textures.push(texture);
    labelMaterials.push(material);
    labelMeshes.set(label, ghost(new THREE.InstancedMesh(signGeometry, material, count)));
    labelIndex.set(label, 0);
  });

  for (let index = 0; index < count; index++) {
    const [sectionId, label] = locations[index];
    const section = resolveSectionCenter(sectionId);
    if (!section) continue;
    const arc = ovalArcAtAngle(section.deg, outer);
    const point = getStadiumOvalPointAt(arc, outer.halfL, outer.halfW, outer.radius);
    // Local +Z is the customer-facing side; aim it toward the rink/concourse interior.
    const yaw = Math.atan2(-point.nx, -point.nz);
    const depth = 0.72;
    const center = new THREE.Vector3(
      point.x - point.nx * 0.55,
      floorY + 0.775,
      point.z - point.nz * 0.55
    );
    setInstance(bodies, index, center, yaw);
    const counter = center.clone().add(new THREE.Vector3(-point.nx * 0.12, 0.3, -point.nz * 0.12));
    setInstance(counters, index, counter, yaw);
    const sign = center.clone().add(new THREE.Vector3(-point.nx * 0.4, 0.95, -point.nz * 0.4));
    const mesh = labelMeshes.get(label);
    setInstance(mesh, labelIndex.get(label), sign, yaw);
    labelIndex.set(label, labelIndex.get(label) + 1);
  }

  bodies.name = `ConcourseServiceKiosks_${tierNumber}`;
  counters.name = `ConcourseServiceCounters_${tierNumber}`;
  group.add(bodies, counters);
  for (const [label, mesh] of labelMeshes) {
    mesh.count = labelIndex.get(label);
    group.add(mesh);
  }
  return [bodyGeometry, counterGeometry, signGeometry, bodyMaterial, counterMaterial, ...textures, ...labelMaterials];
}

function addFacilityEntrances(group, layout, cfg, floorY, tierNumber) {
  const publicRestroomSections = tierNumber === 300 ? [317, 325, 309, 302] : [215, 224, 208, 203];
  const elevatorSections = tierNumber === 300
    ? [{ section: 315, tangentOffset: 2.8 }, { section: 309, tangentOffset: 2.8 }, { section: 302, copies: 2, tangentOffset: 2.8 }, { section: 319, service: true }]
    : [{ section: 215, tangentOffset: 2.8 }, { section: 208, tangentOffset: 2.8 }, { section: 203, copies: 2, tangentOffset: 2.8 }, { section: 121, service: true }];
  const back = getTierBackOval(layout);
  const outer = {
    halfL: back.halfL + cfg.width,
    halfW: back.halfW + cfg.width,
    radius: back.radius + cfg.width
  };
  const doors = [];
  const signs = new Map();
  const doorCategories = [];
  const signCategories = [];
  const restroomLocations = publicRestroomSections.map((section) => ({ section, kind: 'restroom' }));
  const familySection = tierNumber === 300 ? 325 : tierNumber === 200 ? 216 : 215;
  restroomLocations.push({ section: familySection, kind: 'family', tangentOffset: -4.0 });
  const elevatorLocations = elevatorSections.flatMap((entry) =>
    Array.from({ length: entry.copies || 1 }, (_, index) => ({
      section: entry.section,
      kind: entry.service ? 'service-elevator' : 'elevator',
      tangentOffset: (entry.tangentOffset || 0) + (index - ((entry.copies || 1) - 1) / 2) * 1.65
    }))
  );
  const entries = [
    ...restroomLocations.flatMap((entry) => entry.kind === 'family'
      ? [{ ...entry, label: 'FAMILY WASHROOM', side: 0 }]
      : [
          { ...entry, label: 'MEN', side: -0.68 },
          { ...entry, label: 'WOMEN', side: 0.68 }
        ]),
    ...elevatorLocations.map((entry) => ({ ...entry, label: entry.kind === 'service-elevator' ? 'SERVICE ELEVATOR' : 'ELEVATOR', side: 0 }))
  ];

  const doorGeometry = new THREE.BoxGeometry(1.08, 2.12, 0.12);
  const jambGeometry = new THREE.BoxGeometry(0.12, 2.42, 0.2);
  const headerGeometry = new THREE.BoxGeometry(1.34, 0.14, 0.2);
  const signGeometry = new THREE.PlaneGeometry(1.18, 0.38);
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x303b43, metalness: 0.42, roughness: 0.55 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xc2c7ca, metalness: 0.56, roughness: 0.34 });
  const signMaterials = new Map();
  const signTextures = [];
  for (const label of new Set(entries.map((entry) => entry.label))) {
    const texture = makeSignTexture(label);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
    signMaterials.set(label, material);
    signTextures.push(texture);
  }
  const doorMesh = ghost(new THREE.InstancedMesh(doorGeometry, doorMaterial, entries.length));
  const jambMesh = ghost(new THREE.InstancedMesh(jambGeometry, frameMaterial, entries.length * 2));
  const headerMesh = ghost(new THREE.InstancedMesh(headerGeometry, frameMaterial, entries.length));
  for (const label of signMaterials.keys()) {
    signs.set(label, ghost(new THREE.InstancedMesh(signGeometry, signMaterials.get(label), entries.length)));
  }
  const signCounts = new Map([...signs.keys()].map((label) => [label, 0]));
  const position = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  let jambIndex = 0;
  let doorIndex = 0;
  for (const entry of entries) {
    const section = resolveSectionCenter(entry.section);
    if (!section) continue;
    const arc = ovalArcAtAngle(section.deg, outer);
    const point = getStadiumOvalPointAt(arc, outer.halfL, outer.halfW, outer.radius);
    const yaw = Math.atan2(-point.nx, -point.nz);
    tangent.set(Math.cos(yaw), 0, -Math.sin(yaw));
    // The outer wall is offset 0.12 m beyond `outer`; place the door through its face.
    const base = position.set(point.x + point.nx * 0.24, floorY, point.z + point.nz * 0.24)
      .addScaledVector(tangent, (entry.tangentOffset || 0) + (entry.side || 0));
    const doorPosition = base.clone().add(new THREE.Vector3(0, 1.08, 0));
    setInstance(doorMesh, doorIndex, doorPosition, yaw);
    const leftJamb = base.clone().addScaledVector(tangent, -0.6).add(new THREE.Vector3(0, 1.21, 0));
    const rightJamb = base.clone().addScaledVector(tangent, 0.6).add(new THREE.Vector3(0, 1.21, 0));
    setInstance(jambMesh, jambIndex++, leftJamb, yaw);
    setInstance(jambMesh, jambIndex++, rightJamb, yaw);
    setInstance(headerMesh, doorIndex, base.clone().add(new THREE.Vector3(0, 2.4, 0)), yaw);
    const signPosition = base.clone().add(new THREE.Vector3(0, 2.58, 0)).addScaledVector(new THREE.Vector3(-point.nx, 0, -point.nz), 0.13);
    const signMesh = signs.get(entry.label);
    setInstance(signMesh, signCounts.get(entry.label), signPosition, yaw);
    signCounts.set(entry.label, signCounts.get(entry.label) + 1);
    doorIndex++;
  }
  doorMesh.count = doorIndex;
  jambMesh.count = jambIndex;
  headerMesh.count = doorIndex;
  doorMesh.name = `WashroomAndElevatorDoors_${tierNumber}`;
  jambMesh.name = `FacilityDoorFrames_${tierNumber}`;
  headerMesh.name = `FacilityDoorHeaders_${tierNumber}`;
  group.add(doorMesh, jambMesh, headerMesh);
  for (const [label, mesh] of signs) {
    mesh.count = signCounts.get(label);
    mesh.name = `FacilitySigns_${tierNumber}_${label.replaceAll(' ', '_')}`;
    group.add(mesh);
  }
  return [doorGeometry, jambGeometry, headerGeometry, signGeometry, doorMaterial, frameMaterial, ...signTextures, ...signMaterials.values()];
}

function addPremiumDiningLounge(group, layout, floorY, gameNightGroups, gameNightAccents) {
  const sectionA = resolveSectionCenter(125);
  const sectionB = resolveSectionCenter(126);
  const angleA = sectionA.deg * Math.PI / 180;
  const angleB = sectionB.deg * Math.PI / 180;
  const angle = Math.atan2(Math.sin(angleA) + Math.sin(angleB), Math.cos(angleA) + Math.cos(angleB));
  const back = getTierBackOval(layout);
  const loungeOval = { halfL: back.halfL + ARENA.concourse2.width * 0.5, halfW: back.halfW + ARENA.concourse2.width * 0.5, radius: back.radius + ARENA.concourse2.width * 0.5 };
  const arc = ovalArcAtAngle(angle * 180 / Math.PI, loungeOval);
  const point = getStadiumOvalPointAt(arc, loungeOval.halfL, loungeOval.halfW, loungeOval.radius);
  // Face the lounge glazing toward the rink, with the entrance/sign facing the concourse.
  const yaw = Math.atan2(-point.nx, -point.nz);
  const inward = new THREE.Vector3(-point.nx, 0, -point.nz);
  const tangent = new THREE.Vector3(-inward.z, 0, inward.x);
  const center = new THREE.Vector3(point.x, floorY, point.z);
  const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x152b49, roughness: 0.62, metalness: 0.16 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xc5a15a, metalness: 0.55, roughness: 0.35 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0xb9d9e6, transparent: true, opacity: 0.28, transmission: 0.55, roughness: 0.12, depthWrite: false, side: THREE.DoubleSide });
  const furnitureMaterial = new THREE.MeshStandardMaterial({ color: 0x233752, roughness: 0.62, metalness: 0.08 });
  const shell = ghost(new THREE.Mesh(new THREE.BoxGeometry(8.2, 2.7, 0.28), shellMaterial));
  shell.name = 'PremiumLoungeRearFacade';
  shell.position.copy(center).addScaledVector(inward, -1.55).add(new THREE.Vector3(0, 1.35, 0));
  shell.rotation.y = yaw;
  const glass = ghost(new THREE.Mesh(new THREE.BoxGeometry(8.0, 2.25, 0.06), glassMaterial));
  glass.name = 'PremiumDiningLoungeGlass';
  glass.position.copy(center).addScaledVector(inward, 1.45).add(new THREE.Vector3(0, 1.14, 0));
  glass.rotation.y = yaw;
  const bar = ghost(new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.95, 0.72), shellMaterial));
  bar.name = 'PremiumDiningBar';
  bar.position.copy(center).addScaledVector(inward, 0.35).add(new THREE.Vector3(0, 0.48, 0));
  bar.rotation.y = yaw;
  const barTop = ghost(new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.12, 0.86), trimMaterial));
  barTop.name = 'PremiumDiningBarTop';
  barTop.position.copy(bar.position).add(new THREE.Vector3(0, 0.52, 0));
  barTop.rotation.y = yaw;
  const tableGeometry = new THREE.BoxGeometry(1.4, 0.1, 0.72);
  const tables = ghost(new THREE.InstancedMesh(tableGeometry, trimMaterial, 3));
  const furnitureSeatGeometry = new THREE.BoxGeometry(0.38, 0.62, 0.38);
  const seats = ghost(new THREE.InstancedMesh(furnitureSeatGeometry, furnitureMaterial, 6));
  seats.name = 'PremiumLoungeBaseSeating';
  const premiumChairGeometry = createPremiumChairGeometry();
  const premiumChairs = ghost(new THREE.InstancedMesh(premiumChairGeometry, furnitureMaterial, 6));
  premiumChairs.name = 'PremiumLoungeGameNightSeating';
  for (let index = 0; index < 3; index++) {
    const along = (index - 1) * 1.8;
    const tablePosition = center.clone().addScaledVector(tangent, along).addScaledVector(inward, -0.35).add(new THREE.Vector3(0, 0.92, 0));
    setInstance(tables, index, tablePosition, yaw);
    for (let side = 0; side < 2; side++) {
      const seatPosition = tablePosition.clone().addScaledVector(inward, side === 0 ? -0.62 : 0.62);
      seatPosition.y = floorY + 0.36;
      setInstance(seats, index * 2 + side, seatPosition, yaw);
      const premiumSeatPosition = seatPosition.clone();
      premiumSeatPosition.y = floorY;
      setInstance(premiumChairs, index * 2 + side, premiumSeatPosition, yaw);
    }
  }
  const signTexture = makeSignTexture('PREMIUM SUITE LOUNGE');
  const signMaterial = new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false, side: THREE.DoubleSide });
  const sign = ghost(new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.55), signMaterial));
  sign.name = 'PremiumSuiteLoungeSign';
  sign.position.copy(shell.position).add(new THREE.Vector3(0, 0.15, 0));
  sign.rotation.y = yaw + Math.PI;
  group.add(shell, glass, bar, barTop, tables, seats, sign);

  const gameNightGroup = new THREE.Group();
  gameNightGroup.name = 'PremiumSuiteLoungeGameNight';
  gameNightGroup.visible = false;

  const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x101d31, metalness: 0.42, roughness: 0.48 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xc5a15a, emissive: 0x6e4510, emissiveIntensity: 0.28, metalness: 0.68, roughness: 0.32 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd58a, toneMapped: false });
  const canopy = ghost(new THREE.Mesh(new THREE.BoxGeometry(8.55, 0.18, 3.65), canopyMaterial));
  canopy.name = 'PremiumLoungeGameNightCanopy';
  canopy.position.copy(center).add(new THREE.Vector3(0, 2.62, 0.02));
  canopy.rotation.y = yaw;

  const trimGeometry = new THREE.BoxGeometry(0.11, 0.14, 3.5);
  const trim = ghost(new THREE.InstancedMesh(trimGeometry, accentMaterial, 2));
  trim.name = 'PremiumLoungeGameNightTrim';
  for (let index = 0; index < 2; index++) {
    const trimPosition = center.clone()
      .addScaledVector(tangent, index === 0 ? -4.15 : 4.15)
      .addScaledVector(inward, 0.04)
      .add(new THREE.Vector3(0, 1.28, 0));
    setInstance(trim, index, trimPosition, yaw);
  }

  const ceilingLight = ghost(new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.035, 2.82), glowMaterial));
  ceilingLight.name = 'PremiumLoungeGameNightLighting';
  ceilingLight.position.copy(center).add(new THREE.Vector3(0, 2.51, 0.02));
  ceilingLight.rotation.y = yaw;

  const fascia = ghost(new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.23, 0.12), accentMaterial));
  fascia.name = 'PremiumLoungeGameNightFascia';
  fascia.position.copy(center).addScaledVector(inward, 1.73).add(new THREE.Vector3(0, 2.23, 0));
  fascia.rotation.y = yaw;

  const innerSign = ghost(new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.45), signMaterial));
  innerSign.name = 'PremiumLoungeGameNightSign';
  innerSign.position.copy(center).addScaledVector(inward, 1.81).add(new THREE.Vector3(0, 2.23, 0));
  innerSign.rotation.y = yaw;

  gameNightGroup.add(canopy, trim, ceilingLight, fascia, innerSign, premiumChairs);
  group.add(gameNightGroup);
  gameNightGroups.push({ detail: gameNightGroup, baseFurniture: [seats] });
  gameNightAccents.push({ accentMaterial, glowMaterial });

  return [shell.geometry, glass.geometry, bar.geometry, barTop.geometry, tableGeometry, furnitureSeatGeometry, premiumChairGeometry, sign.geometry, canopy.geometry, trimGeometry, ceilingLight.geometry, fascia.geometry, innerSign.geometry, shellMaterial, trimMaterial, glassMaterial, furnitureMaterial, canopyMaterial, accentMaterial, glowMaterial, signMaterial, signTexture];
}

export function createConcourse() {
  const group = new THREE.Group();
  group.name = 'Concourse';

  const layouts = getTierLayouts();
  const upperConcourseElevation =
    layouts[2].baseY + layouts[2].cfg.rows * layouts[2].cfg.riserHeight + 0.4 - BOWL.fieldElevation;
  // The first two levels use the configured concourse dimensions; the upper level follows the 300 bowl back edge.
  const rings = [
    { layout: layouts[0], cfg: ARENA.concourse1, tier: 100 },
    { layout: layouts[1], cfg: ARENA.concourse2, tier: 200 },
    // The official venue maps show a 300-level concourse; dimensions are fitted to the bowl envelope.
    { layout: layouts[2], cfg: { width: ARENA.concourse2.width, elevation: upperConcourseElevation }, tier: 300 }
  ];

  const geoms = [];
  const outerWallGeometries = [];
  for (const { layout, cfg, tier } of rings) {
    const back = getTierBackOval(layout);
    const outer = createStadiumOvalShape(back.halfL + cfg.width, back.halfW + cfg.width, back.radius + cfg.width);
    outer.holes.push(createStadiumOvalPath(back.halfL, back.halfW, back.radius));
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: SLAB_THICKNESS,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 24
    });
    g.rotateX(-Math.PI / 2);
    // Extrusion depth points upward after the -PI/2 rotation; translation is the slab base.
    g.translate(0, BOWL.fieldElevation + cfg.elevation - SLAB_THICKNESS, 0);
    geoms.push(g);
    outerWallGeometries.push(createConcourseOuterWallGeometry(layout, cfg, BOWL.fieldElevation + cfg.elevation, tier));
  }

  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  if (!merged) throw new Error('Could not merge concourse geometries');
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a8086, roughness: 0.9 });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'ConcourseSlabs';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const outerWalls = mergeGeometries(outerWallGeometries, false);
  outerWallGeometries.forEach((geometry) => geometry.dispose());
  const outerWallMaterial = new THREE.MeshStandardMaterial({ color: 0x666f77, roughness: 0.9, metalness: 0.02 });
  const outerWallMesh = ghost(new THREE.Mesh(outerWalls, outerWallMaterial));
  outerWallMesh.name = 'ConcourseExteriorWalls';
  outerWallMesh.castShadow = false;
  outerWallMesh.receiveShadow = true;
  group.add(outerWallMesh);

  const ownedResources = [merged, mat, outerWalls, outerWallMaterial];
  const gameNightGroups = [];
  const gameNightAccents = [];
  for (const { layout, cfg, tier } of rings) {
    const floorY = BOWL.fieldElevation + cfg.elevation;
    ownedResources.push(...addConcourseRearWall(group, layout, tier, floorY));
    ownedResources.push(...addSectionPortals(group, layout, tier, floorY));
    ownedResources.push(...addConcourseServices(group, layout, cfg, floorY, tier));
    ownedResources.push(...addFacilityEntrances(group, layout, cfg, floorY, tier));
    if (tier === 200) ownedResources.push(...addPremiumDiningLounge(group, layout, floorY, gameNightGroups, gameNightAccents));
  }

  group.userData.setSceneMode = (mode) => {
    const gameNight = Number(mode) === QUALITY_MODE.ULTRA;
    for (const { detail, baseFurniture } of gameNightGroups) {
      detail.visible = gameNight;
      for (const mesh of baseFurniture) mesh.visible = !gameNight;
    }
  };
  group.userData.setArenaStyle = (style) => {
    const cyber = style === 'cyber';
    for (const { accentMaterial, glowMaterial } of gameNightAccents) {
      accentMaterial.color.setHex(cyber ? 0x00d9ff : 0xc5a15a);
      accentMaterial.emissive.setHex(cyber ? 0x007fa5 : 0x6e4510);
      glowMaterial.color.setHex(cyber ? 0x7cecff : 0xffd58a);
    }
  };

  group.userData.dispose = () => {
    const disposed = new Set();
    for (const resource of ownedResources) {
      if (!resource || disposed.has(resource)) continue;
      disposed.add(resource);
      resource.dispose?.();
    }
  };
  return group;
}
