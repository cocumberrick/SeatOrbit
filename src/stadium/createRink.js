import * as THREE from 'three';
import { BOWL, RINK, getRinkLines } from '../config/stadiumConfig.js';
import { ghost } from './arenaDetail.js';
import { getStadiumOvalPerimeter, getStadiumOvalPointAt } from './arenaHelpers.js';

let shared = null;

const DEFAULTS = {
  LENGTH: 60.96,
  WIDTH: 25.91,
  CORNER_RADIUS: 3.05,
  LINE_WIDTH: 0.05,
  GOAL_LINE_WIDTH: 0.05,
  BOARD_THICKNESS: 0.18,
  BOARD_HEIGHT: 1.07,
  GLASS_HEIGHT: 1.8,
  FACEOFF_CIRCLE_RADIUS: 4.5,
  FACEOFF_DOT_Z: 6.7,
  DOT_RADIUS: 0.15,
  CREASE_RADIUS: 1.8,
  HASH_LENGTH: 0.6,
  GOAL: { POST_RADIUS: 0.06, HEIGHT: 1.22, WIDTH: 1.83, DEPTH: 0.9 },
  BENCH: { LENGTH: 10, HEIGHT: 0.8, WIDTH: 1.8, Z_OFFSET: 3 },
  COLORS: {
    ICE: '#eaf5fa', ICE_EDGE: '#d4e8f3', RED: '#c62838', BLUE: '#174b9b',
    BOARDS: '#f5f6f7', BOARD_TOP: '#c4cbd1', GLASS: '#d8f0ff',
    CREASE_FILL: 'rgba(80,150,220,0.3)', CREASE_LINE: '#347ac1', LOGO_TEXT: '#164477'
  },
  TEXTURE: { WIDTH: 4096, HEIGHT: 2048 }
};

const CFG = Object.assign({}, DEFAULTS, RINK || {});
CFG.COLORS = Object.assign({}, DEFAULTS.COLORS, RINK?.COLORS || {});
CFG.GOAL = Object.assign({}, DEFAULTS.GOAL, RINK?.GOAL || {});
CFG.BENCH = Object.assign({}, DEFAULTS.BENCH, RINK?.BENCH || {});
CFG.TEXTURE = Object.assign({}, DEFAULTS.TEXTURE, RINK?.TEXTURE || {});

const HALF_L = CFG.LENGTH / 2;
const HALF_W = CFG.WIDTH / 2;
const FIELD_Y = BOWL?.fieldElevation ?? -8;

function roundedRectPath(L, W, radius) {
  const shape = new THREE.Shape();
  const r = Math.min(radius, L, W);
  shape.moveTo(-L + r, -W);
  shape.lineTo(L - r, -W);
  shape.absarc(L - r, -W + r, r, -Math.PI / 2, 0);
  shape.lineTo(L, W - r);
  shape.absarc(L - r, W - r, r, 0, Math.PI / 2);
  shape.lineTo(-L + r, W);
  shape.absarc(-L + r, W - r, r, Math.PI / 2, Math.PI);
  shape.lineTo(-L, -W + r);
  shape.absarc(-L + r, -W + r, r, Math.PI, Math.PI * 1.5);
  return shape;
}

function createRingGeometry(thickness, height, outerRadius = CFG.CORNER_RADIUS) {
  const half = thickness / 2;
  const outer = roundedRectPath(HALF_L + half, HALF_W + half, outerRadius + half);
  const inner = roundedRectPath(HALF_L - half, HALF_W - half, Math.max(0.1, outerRadius - half));
  const hole = new THREE.Path();
  hole.copy(inner);
  outer.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(outer, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 64 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createIceTexture() {
  const width = CFG.TEXTURE.WIDTH;
  const height = CFG.TEXTURE.HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create the rink canvas texture.');
  const pxX = width / CFG.LENGTH;
  const pxZ = height / CFG.WIDTH;
  const worldToCanvas = (x, z) => ({ x: (x + HALF_L) * pxX, y: (HALF_W - z) * pxZ });
  const C = CFG.COLORS;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.65);
  gradient.addColorStop(0, C.ICE);
  gradient.addColorStop(1, C.ICE_EDGE);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const random = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let i = 0; i < 22000; i++) {
    const x = random(i, 1) * width;
    const y = random(i, 2) * height;
    ctx.fillStyle = `rgba(255,255,255,${random(i, 3) * 0.12})`;
    ctx.fillRect(x, y, 1 + random(i, 4) * 2, 1);
  }

  // Fine, low-contrast skate tracings add surface variation without obscuring markings.
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#78909d';
  ctx.lineWidth = Math.max(1, pxX * 0.012);
  for (let i = 0; i < 180; i++) {
    const cx = random(i, 11) * width;
    const cy = random(i, 12) * height;
    const radius = 8 + random(i, 13) * 62;
    const start = random(i, 14) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * (0.25 + random(i, 15) * 0.35), start, 0.1, 1.0 + random(i, 16) * 2.5);
    ctx.stroke();
  }
  ctx.restore();

  function verticalLine(x, thickness, color) {
    const p = worldToCanvas(x, 0);
    ctx.fillStyle = color;
    ctx.fillRect(p.x - thickness * pxX / 2, 0, thickness * pxX, height);
  }
  function circle(x, z, radius, thickness, color) {
    const p = worldToCanvas(x, z);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius * pxX, radius * pxZ, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness * pxX;
    ctx.stroke();
  }
  function dot(x, z, radius, color) {
    const p = worldToCanvas(x, z);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius * pxX, radius * pxZ, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function line(x1, z1, x2, z2, color, thickness) {
    const a = worldToCanvas(x1, z1);
    const b = worldToCanvas(x2, z2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness * pxX;
    ctx.stroke();
  }

  const lines = getRinkLines();
  verticalLine(0, CFG.LINE_WIDTH, C.RED);
  for (const side of [-1, 1]) {
    verticalLine(side * lines.blueLineX, CFG.LINE_WIDTH, C.BLUE);
    verticalLine(side * lines.goalLineX, CFG.GOAL_LINE_WIDTH, C.RED);
  }
  circle(0, 0, CFG.FACEOFF_CIRCLE_RADIUS, CFG.LINE_WIDTH, C.BLUE);
  dot(0, 0, CFG.DOT_RADIUS, C.BLUE);

  const zoneCircles = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      zoneCircles.push({ x: sx * lines.zoneFaceoffX, z: sz * CFG.FACEOFF_DOT_Z });
    }
  }
  for (const p of zoneCircles) {
    circle(p.x, p.z, CFG.FACEOFF_CIRCLE_RADIUS, CFG.LINE_WIDTH, C.RED);
    dot(p.x, p.z, CFG.DOT_RADIUS, C.RED);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      dot(sx * lines.endFaceoffFromGoalLine, sz * CFG.FACEOFF_DOT_Z, CFG.DOT_RADIUS, C.RED);
    }
  }
  for (const p of zoneCircles) {
    const r = CFG.FACEOFF_CIRCLE_RADIUS;
    line(p.x, p.z + r, p.x, p.z + r + CFG.HASH_LENGTH, C.RED, 0.05);
    line(p.x, p.z - r, p.x, p.z - r - CFG.HASH_LENGTH, C.RED, 0.05);
  }
  for (const side of [-1, 1]) {
    const x = side * lines.goalLineX;
    const p = worldToCanvas(x, 0);
    const start = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    const end = side > 0 ? Math.PI * 1.5 : Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, CFG.CREASE_RADIUS * pxX, CFG.CREASE_RADIUS * pxZ, 0, start, end);
    ctx.closePath();
    ctx.fillStyle = C.CREASE_FILL;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, CFG.CREASE_RADIUS * pxX, CFG.CREASE_RADIUS * pxZ, 0, start, end);
    ctx.strokeStyle = C.BLUE;
    ctx.lineWidth = 0.05 * pxX;
    ctx.stroke();
  }
  const centre = worldToCanvas(0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const logoRadius = 4.6;
  ctx.beginPath(); ctx.ellipse(centre.x, centre.y, logoRadius * pxX, logoRadius * pxZ, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fill();
  ctx.lineWidth = 0.12 * pxX; ctx.strokeStyle = '#174477'; ctx.stroke();
  ctx.fillStyle = C.LOGO_TEXT;
  ctx.font = `italic 900 ${Math.round(1.9 * pxZ)}px sans-serif`;
  ctx.fillText('JETS', centre.x, centre.y - 0.15 * pxZ);
  ctx.font = `bold ${Math.round(0.28 * pxZ)}px sans-serif`;
  ctx.fillText('WINNIPEG', centre.x, centre.y + 1.05 * pxZ);
  ctx.font = `bold ${Math.round(0.32 * pxZ)}px sans-serif`;
  ctx.fillText('CANADA LIFE CENTRE', centre.x, centre.y - 6.2 * pxZ);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

function getShared() {
  if (shared) return shared;
  const map = createIceTexture();
  const C = CFG.COLORS;
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 2048; boardCanvas.height = 512;
  const boardCtx = boardCanvas.getContext('2d');
  const boardGradient = boardCtx.createLinearGradient(0, 0, 0, boardCanvas.height);
  boardGradient.addColorStop(0, '#f9fbfd'); boardGradient.addColorStop(0.72, '#e7edf1'); boardGradient.addColorStop(1, '#c7d0d8');
  boardCtx.fillStyle = boardGradient; boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.fillStyle = '#0033a0'; boardCtx.fillRect(0, 0, boardCanvas.width, 38);
  boardCtx.fillStyle = '#c8102e'; boardCtx.fillRect(0, boardCanvas.height - 30, boardCanvas.width, 30);
  // Keep the dasher face clean; arena chants and team branding belong on the video board.
  boardCtx.fillStyle = 'rgba(20,42,70,0.12)';
  for (let x = 0; x < boardCanvas.width; x += 256) boardCtx.fillRect(x, 38, 4, boardCanvas.height - 68);
  for (let i = 0; i < 4000; i++) {
    const x = ((i * 7919) % boardCanvas.width), y = ((i * 3571) % boardCanvas.height);
    boardCtx.fillStyle = `rgba(70,90,110,${((i * 13) % 10) / 1000})`; boardCtx.fillRect(x, y, 1, 1);
  }
  const boardMap = new THREE.CanvasTexture(boardCanvas);
  boardMap.colorSpace = THREE.SRGBColorSpace; boardMap.wrapS = THREE.RepeatWrapping; boardMap.repeat.set(6, 1); boardMap.anisotropy = 8;
  shared = {
    map,
    boardMap,
    ice: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map, roughness: 0.2, metalness: 0, clearcoat: 0.68, clearcoatRoughness: 0.2, reflectivity: 0.35, envMapIntensity: 0.65 }),
    boards: new THREE.MeshStandardMaterial({ color: 0xffffff, map: boardMap, roughness: 0.42, metalness: 0.04 }),
    bench: new THREE.MeshStandardMaterial({ color: 0x12375e, roughness: 0.72, metalness: 0.05 }),
    rail: new THREE.MeshStandardMaterial({ color: C.BOARD_TOP, roughness: 0.35, metalness: 0.55 }),
    glass: new THREE.MeshPhysicalMaterial({ color: C.GLASS, transparent: true, opacity: 0.3, transmission: 0.95, thickness: 0.08, roughness: 0.05, metalness: 0, ior: 1.5, side: THREE.DoubleSide, depthWrite: false }),
    red: new THREE.MeshStandardMaterial({ color: 0xc62838, roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x252a31, roughness: 0.7 }),
  };
  return shared;
}

function addGhostMesh(parent, geometry, material, name, position) {
  const mesh = ghost(new THREE.Mesh(geometry, material));
  mesh.name = name;
  if (position) mesh.position.set(position.x, position.y, position.z);
  parent.add(mesh);
  return mesh;
}

function createIceMesh(mats) {
  const shape = roundedRectPath(HALF_L, HALF_W, CFG.CORNER_RADIUS);
  const geometry = new THREE.ShapeGeometry(shape, 32);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, FIELD_Y, 0);
  const positions = geometry.attributes.position;
  const uvs = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    uvs[i * 2] = (x + HALF_L) / CFG.LENGTH;
    uvs[i * 2 + 1] = (HALF_W - z) / CFG.WIDTH;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  const mesh = ghost(new THREE.Mesh(geometry, mats.ice));
  mesh.name = 'Ice';
  mesh.receiveShadow = true;
  return mesh;
}

function createGoal(mats, side, goalLineX) {
  const G = CFG.GOAL;
  const group = new THREE.Group();
  group.name = side > 0 ? 'GoalPosX' : 'GoalNegX';
  group.position.set(side * goalLineX, FIELD_Y, 0);
  const postGeometry = new THREE.CylinderGeometry(G.POST_RADIUS, G.POST_RADIUS, G.HEIGHT, 12);
  for (const z of [-1, 1]) {
    const post = ghost(new THREE.Mesh(postGeometry, mats.red));
    post.position.set(0, G.HEIGHT / 2, z * G.WIDTH / 2);
    group.add(post);
  }
  const barGeometry = new THREE.CylinderGeometry(G.POST_RADIUS, G.POST_RADIUS, G.WIDTH, 12);
  barGeometry.rotateX(Math.PI / 2);
  const crossbar = ghost(new THREE.Mesh(barGeometry, mats.red));
  crossbar.position.y = G.HEIGHT;
  group.add(crossbar);
  const net = ghost(new THREE.Mesh(
    new THREE.BoxGeometry(G.DEPTH, G.HEIGHT, G.WIDTH),
    new THREE.MeshBasicMaterial({ color: 0xe9edf1, transparent: true, opacity: 0.12, wireframe: true })
  ));
  net.position.set(side * G.DEPTH / 2, G.HEIGHT / 2, 0);
  group.add(net);
  return group;
}

function createBench(mats, name, z, side) {
  const group = new THREE.Group();
  group.name = name;
  const B = CFG.BENCH;
  const y = FIELD_Y + 0.08;
  const platform = ghost(new THREE.Mesh(new THREE.BoxGeometry(B.LENGTH, B.HEIGHT, B.WIDTH), mats.dark));
  platform.position.set(0, y + B.HEIGHT / 2, z);
  group.add(platform);
  const seats = ghost(new THREE.Mesh(new THREE.BoxGeometry(B.LENGTH * 0.88, 0.35, 0.5), mats.red));
  seats.position.set(0, y + B.HEIGHT + 0.18, z + side * 0.25);
  group.add(seats);
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const ctx = labelCanvas.getContext('2d');
  ctx.fillStyle = '#041e42';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.toUpperCase(), 256, 64);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(B.LENGTH * 0.7, 1);
  const labelMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  const label = ghost(new THREE.Mesh(geometry, labelMaterial));
  label.position.set(0, y + B.HEIGHT + 1, z + side * (B.WIDTH / 2 + 0.03));
  label.rotation.y = side < 0 ? Math.PI : 0;
  group.add(label);
  const aisleLabel = ghost(new THREE.Mesh(geometry, labelMaterial));
  aisleLabel.name = `${name}AisleLabel`;
  aisleLabel.position.copy(label.position).setZ(label.position.z - side * 0.035);
  aisleLabel.rotation.y = label.rotation.y + Math.PI;
  group.add(aisleLabel);
  return group;
}

function createHockeySticks(mats, z, side) {
  const group = new THREE.Group(); group.name = `HockeySticks_${side > 0 ? 'Home' : 'Visitor'}`;
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x302b26, roughness: 0.68 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe3e0d8, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const stick = new THREE.Group();
    const shaft = ghost(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 1.45, 6), shaftMat));
    shaft.position.y = 0.76;
    const blade = ghost(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.055), bladeMat));
    blade.position.set(0.12, 0.08, 0); blade.rotation.z = -0.12;
    stick.add(shaft, blade);
    stick.position.set(-CFG.BENCH.LENGTH * 0.32 + i * 0.28, FIELD_Y + 0.08, z - side * 0.15);
    stick.rotation.z = 0.22 + i * 0.08; group.add(stick);
  }
  group.traverse((o) => { if (o.isMesh) o.raycast = function () {}; });
  group.userData.dispose = () => { shaftMat.dispose(); bladeMat.dispose(); };
  return group;
}

function createPenaltyBox(mats, name, x, z, side) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, FIELD_Y, z);

  const platform = ghost(new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.24, 2.6), mats.dark));
  platform.position.y = 0.12;
  group.add(platform);

  const bench = ghost(new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.34, 0.72), mats.bench));
  bench.position.set(0, 0.4, -side * 0.42);
  group.add(bench);

  const backrest = ghost(new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.54, 0.14), mats.bench));
  backrest.position.set(0, 0.78, -side * 0.02);
  group.add(backrest);

  const rearGlass = ghost(new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.35, 0.055), mats.glass));
  rearGlass.position.set(0, 1.0, side * 1.22);
  group.add(rearGlass);

  const endGlassGeometry = new THREE.BoxGeometry(0.055, 1.15, 1.95);
  for (const xOffset of [-2.48, 2.48]) {
    const endGlass = ghost(new THREE.Mesh(endGlassGeometry, mats.glass));
    endGlass.position.set(xOffset, 0.9, side * 0.32);
    group.add(endGlass);
  }

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 96;
  const signContext = signCanvas.getContext('2d');
  signContext.fillStyle = '#071d49';
  signContext.fillRect(0, 0, signCanvas.width, signCanvas.height);
  signContext.fillStyle = '#ffffff';
  signContext.font = 'bold 44px Arial, sans-serif';
  signContext.textAlign = 'center';
  signContext.textBaseline = 'middle';
  signContext.fillText(name.replace('PenaltyBox', '').toUpperCase() + ' PENALTY', 256, 48);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = ghost(new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.52),
    new THREE.MeshBasicMaterial({ map: signTexture, side: THREE.DoubleSide, toneMapped: false })
  ));
  sign.position.set(0, 1.82, side * 1.25);
  sign.rotation.y = side > 0 ? Math.PI : 0;
  group.add(sign);
  return group;
}

export function createRink() {
  const mats = getShared();
  const group = new THREE.Group();
  group.name = 'Rink';
  group.add(createIceMesh(mats));

  const boards = addGhostMesh(group, createRingGeometry(CFG.BOARD_THICKNESS, CFG.BOARD_HEIGHT), mats.boards, 'BoardsWall', { x: 0, y: FIELD_Y, z: 0 });
  boards.receiveShadow = true;

  addGhostMesh(group, createRingGeometry(CFG.BOARD_THICKNESS * 1.35, 0.08), mats.rail, 'BoardsTopRail', { x: 0, y: FIELD_Y + CFG.BOARD_HEIGHT, z: 0 });
  
  const glass = addGhostMesh(group, createRingGeometry(CFG.BOARD_THICKNESS, CFG.GLASS_HEIGHT), mats.glass, 'RinkGlass', { x: 0, y: FIELD_Y + CFG.BOARD_HEIGHT, z: 0 });
  glass.renderOrder = 2;

  const glassTop = addGhostMesh(group,
    createRingGeometry(CFG.BOARD_THICKNESS * 0.9, 0.06),
    mats.rail,
    'RinkGlassTopRail',
    { x: 0, y: FIELD_Y + CFG.BOARD_HEIGHT + CFG.GLASS_HEIGHT - 0.03, z: 0 }
  );
  glassTop.castShadow = false;
  glassTop.receiveShadow = false;

  const glassPath = {
    halfL: HALF_L + CFG.BOARD_THICKNESS / 2,
    halfW: HALF_W + CFG.BOARD_THICKNESS / 2,
    radius: CFG.CORNER_RADIUS + CFG.BOARD_THICKNESS / 2
  };
  const glassPerimeter = getStadiumOvalPerimeter(glassPath.halfL, glassPath.halfW, glassPath.radius);
  const postCount = Math.ceil(glassPerimeter / 2.8);
  const postGeometry = new THREE.CylinderGeometry(0.035, 0.035, CFG.GLASS_HEIGHT, 6);
  const mullions = ghost(new THREE.InstancedMesh(postGeometry, mats.rail, postCount));
  mullions.name = 'RinkGlassMullions';
  const postMatrix = new THREE.Matrix4();
  for (let i = 0; i < postCount; i++) {
    const point = getStadiumOvalPointAt(i / postCount * glassPerimeter, glassPath.halfL, glassPath.halfW, glassPath.radius);
    postMatrix.makeTranslation(point.x, FIELD_Y + CFG.BOARD_HEIGHT + CFG.GLASS_HEIGHT / 2, point.z);
    mullions.setMatrixAt(i, postMatrix);
  }
  mullions.instanceMatrix.needsUpdate = true;
  group.add(mullions);

  const lines = getRinkLines();
  group.add(createGoal(mats, -1, lines.goalLineX));
  group.add(createGoal(mats, 1, lines.goalLineX));

  const B = CFG.BENCH;
  
  // ИСПРАВЛЕНО: HOME теперь внизу (-Z), VISITOR наверху (+Z) - ровно как на карте
  const benchZ = -(HALF_W + B.Z_OFFSET);
  group.add(createBench(mats, 'HOME', benchZ, 1));
  group.add(createBench(mats, 'VISITOR', -benchZ, -1));
  group.add(createHockeySticks(mats, benchZ, 1));
  group.add(createHockeySticks(mats, -benchZ, -1));

  const penaltyBoxZ = HALF_W + 1.85;
  group.add(createPenaltyBox(mats, 'PenaltyBoxHome', -3.0, penaltyBoxZ, 1));
  group.add(createPenaltyBox(mats, 'PenaltyBoxVisitor', 3.0, penaltyBoxZ, 1));

  group.userData.dispose = () => {
    const disposed = new Set();
    const disposeOnce = (resource) => { if (!resource || disposed.has(resource)) return; disposed.add(resource); resource.dispose(); };
    group.traverse((object) => {
      if (object.geometry) disposeOnce(object.geometry);
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => { if (material.map) disposeOnce(material.map); disposeOnce(material); });
      }
    });
    if (shared) {
      Object.values(shared).forEach((resource) => {
        if (resource?.isTexture) disposeOnce(resource);
        else if (resource?.isMaterial) { if (resource.map) disposeOnce(resource.map); disposeOnce(resource); }
      });
    }
    shared = null;
  };
  return group;
}
