import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FIELD, BOWL } from '../config/stadiumConfig.js';

const YARD = 0.9144;
const STRIPE_WIDTH = 5 * YARD;          // one mowing stripe = 5 yards
const STRIPE_PAIR = STRIPE_WIDTH * 2;   // one texture tile = dark + light stripe

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                    */
/* ------------------------------------------------------------------ */
function mergeOrThrow(geoms, label) {
  const merged = mergeGeometries(geoms, false);
  geoms.forEach(g => g.dispose());
  if (!merged) throw new Error(`Could not merge ${label} geometries`);
  return merged;
}

/* ------------------------------------------------------------------ */
/*  Turf texture (mowing stripes) — generated ONCE and cached          */
/* ------------------------------------------------------------------ */
let _turfBase = null;
function getTurfTexture() {
  if (_turfBase) return _turfBase;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b5e20';
  ctx.fillRect(0, 0, size / 2, size);
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(size / 2, 0, size / 2, size);
  for (let i = 0; i < 14000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2 + Math.random() * 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  _turfBase = tex;
  return tex;
}

// Clone only carries a different `repeat`; it shares the same underlying image/GPU upload.
function tiledTurf(base, lengthM, widthM) {
  const tex = base.clone();
  tex.needsUpdate = true;
  tex.repeat.set(lengthM / STRIPE_PAIR, widthM / STRIPE_PAIR);
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Canvas helpers — yard numbers + end-zone wordmark                 */
/* ------------------------------------------------------------------ */
// One canvas per unique number (0..50). Reused across both sidelines.
const _yardNumberTexCache = new Map();
function getYardNumberTexture(number) {
  if (_yardNumberTexCache.has(number)) return _yardNumberTexCache.get(number);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // Soft outer glow so the number reads well on striped grass
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = 'bold 340px "Arial Black", Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), size / 2, size / 2 + 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  _yardNumberTexCache.set(number, tex);
  return tex;
}

function createEndZoneWordmarkTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Subtle outline for legibility against the striped turf
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = 'bold 260px "Arial Black", Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Yard numbers — laid flat on the turf, readable from each sideline */
/*  Merged per digit texture: 18 planes -> 5 meshes                    */
/* ------------------------------------------------------------------ */
function addYardNumbers(group, fieldY, halfWidth, goalLineX) {
  // 9 markers per side: 10,20,30,40,50,40,30,20,10 (west -> east)
  const sequence = [10, 20, 30, 40, 50, 40, 30, 20, 10];
  const numSize = 2.4;                       // metres — plane width/height
  const sidelineInset = 3.2;                 // metres from the sideline

  // Created once; cloned once per unique number (not once per plane).
  const numMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    alphaTest: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  const planeTemplate = new THREE.PlaneGeometry(numSize, numSize);
  const euler = new THREE.Euler();
  const matrix = new THREE.Matrix4();
  const byNumber = new Map();

  for (let i = 0; i < sequence.length; i++) {
    const n = sequence[i];
    // x position: 10yd, 20yd, ... from the west goal line (-goalLineX)
    const x = -goalLineX + (i + 1) * 10 * YARD;
    if (!byNumber.has(n)) byNumber.set(n, []);

    for (const zSign of [-1, 1]) {
      // Lay flat; rotate 180° on Y for the +z sideline so the digit reads
      // correctly from that side (bottom of the digit toward the sideline).
      euler.set(-Math.PI / 2, zSign > 0 ? Math.PI : 0, 0);
      matrix.makeRotationFromEuler(euler);
      matrix.setPosition(x, fieldY + 0.02, zSign * (halfWidth - sidelineInset));
      byNumber.get(n).push(planeTemplate.clone().applyMatrix4(matrix));
    }
  }
  planeTemplate.dispose();

  for (const [n, geoms] of byNumber) {
    const mat = numMaterial.clone();
    mat.map = getYardNumberTexture(n);
    const mesh = new THREE.Mesh(mergeOrThrow(geoms, `YardNumber_${n}`), mat);
    mesh.name = `YardNumbers_${n}`;
    mesh.renderOrder = 2;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
}

/* ------------------------------------------------------------------ */
/*  CFL goalposts — single rear pole + curved support arm             */
/*  Both posts merged into 3 meshes (gold / padding / tip stripes)     */
/* ------------------------------------------------------------------ */
const goldMat = new THREE.MeshStandardMaterial({
  color: 0xffcc00,
  roughness: 0.32,
  metalness: 0.65,
  emissive: 0x2a1a00,
  emissiveIntensity: 0.15
});
const paddingMat = new THREE.MeshStandardMaterial({
  color: 0x141414,
  roughness: 0.95,
  metalness: 0.0
});
const tipMat = new THREE.MeshStandardMaterial({ color: 0xff3b1f, roughness: 0.5, metalness: 0.3 });

function createGoalPosts(fieldY, goalLineX /* , halfWidth */) {
  const group = new THREE.Group();
  group.name = 'GoalPosts';

  const basePoleRadius = 0.28;
  const armRadius      = 0.18;
  const uprightRadius  = 0.12;

  const basePoleHeight = 11.5;                // top of rear pole
  const crossbarY      = FIELD.goalPostHeight; // 3.05 m
  const uprightLength  = 7.6;                 // ~25 ft above crossbar (CFL)
  const backOfEndZone  = FIELD.totalLength / 2; // 68.58 m

  const gold = [], padGeoms = [], tips = [];

  for (const sign of [-1, 1]) {
    const baseX = sign * backOfEndZone;   // rear of end zone
    const goalX = sign * goalLineX;       // goal line

    // Padded base (black foam collar around the rear pole)
    padGeoms.push(
      new THREE.CylinderGeometry(0.55, 0.62, 1.6, 20).translate(baseX, fieldY + 0.8, 0)
    );

    // Rear vertical pole
    gold.push(
      new THREE.CylinderGeometry(basePoleRadius, basePoleRadius, basePoleHeight, 20)
        .translate(baseX, fieldY + basePoleHeight / 2, 0)
    );

    // Small cap on top of the rear pole
    gold.push(
      new THREE.SphereGeometry(basePoleRadius * 1.05, 16, 12)
        .translate(baseX, fieldY + basePoleHeight, 0)
    );

    // Curved support arm from top of rear pole to crossbar centre
    const midX = (baseX + goalX) / 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(baseX, basePoleHeight, 0),
      new THREE.Vector3(midX,  basePoleHeight + 0.9, 0),
      new THREE.Vector3(goalX, crossbarY, 0)
    ], false, 'catmullrom', 0.5);
    gold.push(new THREE.TubeGeometry(curve, 40, armRadius, 14, false).translate(0, fieldY, 0));

    // Crossbar (on the goal line)
    gold.push(
      new THREE.CylinderGeometry(uprightRadius, uprightRadius, FIELD.goalPostWidth, 16)
        .rotateX(Math.PI / 2)
        .translate(goalX, fieldY + crossbarY, 0)
    );

    // Uprights rising from each end of the crossbar
    for (const zSign of [-1, 1]) {
      const uz = zSign * FIELD.goalPostWidth / 2;
      gold.push(
        new THREE.CylinderGeometry(uprightRadius, uprightRadius, uprightLength, 14)
          .translate(goalX, fieldY + crossbarY + uprightLength / 2, uz)
      );
      // Small orange/red tip stripe (CFL style) on top of each upright
      tips.push(
        new THREE.CylinderGeometry(uprightRadius * 1.02, uprightRadius * 1.02, 0.6, 14)
          .translate(goalX, fieldY + crossbarY + uprightLength - 0.3, uz)
      );
    }
  }

  const flush = (geoms, material, name) => {
    const mesh = new THREE.Mesh(mergeOrThrow(geoms, name), material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  flush(gold, goldMat, 'GoalPosts_Gold');
  flush(padGeoms, paddingMat, 'GoalPosts_Padding');
  flush(tips, tipMat, 'GoalPosts_Tips');

  return group;
}

/* ------------------------------------------------------------------ */
/*  End-zone wordmark ("BLUE BOMBERS") painted on the turf            */
/*  Both end zones merged into ONE mesh.                               */
/* ------------------------------------------------------------------ */
function addEndZoneWordmarks(group, fieldY, halfLength) {
  const tex = createEndZoneWordmarkTexture('BLUE BOMBERS');
  const planeWidth  = FIELD.width * 0.75;   // ~44.5 m
  const planeHeight = FIELD.endZoneDepth * 0.55; // ~10 m
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    alphaTest: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  const geoms = [];
  for (const sign of [-1, 1]) {
    geoms.push(
      new THREE.PlaneGeometry(planeWidth, planeHeight)
        .rotateX(-Math.PI / 2)
        .translate(sign * (halfLength - FIELD.endZoneDepth / 2), fieldY + 0.016, 0)
    );
  }
  const mesh = new THREE.Mesh(mergeOrThrow(geoms, 'EndZoneWordmarks'), mat);
  mesh.name = 'EndZoneWordmarks';
  mesh.renderOrder = 2;
  mesh.castShadow = false;
  group.add(mesh);
}

/* ------------------------------------------------------------------ */
/*  Main field builder                                                */
/* ------------------------------------------------------------------ */
const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });

export function createField() {
  const group = new THREE.Group();
  group.name = 'Field';

  const halfLength = FIELD.totalLength / 2;
  const halfWidth  = FIELD.width / 2;
  const goalLineX  = FIELD.playingLength / 2;
  const fieldY     = BOWL.fieldElevation;

  const baseTurf = getTurfTexture();   // generated once, cached

  // --- Main playing surface ---
  const turf = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.totalLength, FIELD.width),
    new THREE.MeshStandardMaterial({
      map: tiledTurf(baseTurf, FIELD.totalLength, FIELD.width),
      roughness: 0.95
    })
  );
  turf.rotation.x = -Math.PI / 2;
  turf.position.y = fieldY;
  turf.receiveShadow = true;
  group.add(turf);

  // --- End zones (blue-tinted turf): both planes merged, one shared material ---
  const endZoneMaterial = new THREE.MeshStandardMaterial({
    map: tiledTurf(baseTurf, FIELD.endZoneDepth, FIELD.width),
    color: 0x14334f,   // deep Bombers blue tint
    roughness: 0.95
  });
  const zoneGeoms = [];
  for (const sign of [-1, 1]) {
    zoneGeoms.push(
      new THREE.PlaneGeometry(FIELD.endZoneDepth, FIELD.width)
        .rotateX(-Math.PI / 2)
        .translate(sign * (halfLength - FIELD.endZoneDepth / 2), fieldY + 0.003, 0)
    );
  }
  const zones = new THREE.Mesh(mergeOrThrow(zoneGeoms, 'EndZones'), endZoneMaterial);
  zones.name = 'EndZones';
  zones.receiveShadow = true;
  group.add(zones);

  // --- Wordmarks in each end zone ---
  addEndZoneWordmarks(group, fieldY, halfLength);

  // --- Field lines: ONE LineSegments for every boundary / goal / yard / hash line ---
  const linePts = [];
  const addLine = (x1, z1, x2, z2, y = fieldY + 0.012) => {
    linePts.push(x1, y, z1, x2, y, z2);
  };

  addLine(-halfLength, -halfWidth, halfLength, -halfWidth);
  addLine(-halfLength,  halfWidth, halfLength,  halfWidth);
  addLine(-halfLength, -halfWidth, -halfLength,  halfWidth);
  addLine( halfLength, -halfWidth,  halfLength,  halfWidth);
  addLine(-goalLineX, -halfWidth, -goalLineX, halfWidth);
  addLine( goalLineX, -halfWidth,  goalLineX, halfWidth);

  const yard = 4.572;
  for (let i = 1; i < 22; i++) {
    const x = -goalLineX + i * yard;
    if (x < goalLineX) addLine(x, -halfWidth, x, halfWidth);
  }

  const hashOffset = FIELD.hashSpacing * 3;
  for (let x = -goalLineX + FIELD.hashSpacing; x < goalLineX; x += FIELD.hashSpacing) {
    for (const z of [-hashOffset, hashOffset]) addLine(x, z - 0.3, x, z + 0.3);
  }

  const lineGeom = new THREE.BufferGeometry();
  lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
  lineGeom.computeBoundingSphere();
  const lines = new THREE.LineSegments(lineGeom, lineMat);
  lines.name = 'FieldLines';
  lines.castShadow = false;
  lines.receiveShadow = false;
  group.add(lines);

  // --- Yard numbers (10..50..10 on both sidelines) ---
  addYardNumbers(group, fieldY, halfWidth, goalLineX);

  // --- Goalposts (CFL style) ---
  group.add(createGoalPosts(fieldY, goalLineX, halfWidth));

  // --- LED advertising boards ---
  group.add(createAdBoards(fieldY, halfLength, halfWidth));

  return group;
}

/* ------------------------------------------------------------------ */
/*  LED advertising boards (no shadow casting; 4 boards -> 2 meshes)  */
/* ------------------------------------------------------------------ */
const BOARD_HEIGHT = 0.9;
const BOARD_DEPTH  = 0.2;
const PANEL_LENGTH = 7.2;

let _ledTex = null;
function getLedTexture() {
  if (_ledTex) return _ledTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#0a4fd6');
  grad.addColorStop(1, '#002a7a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GO JETS GO', 256, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, 0, 3, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  _ledTex = tex;
  return tex;
}

function createAdBoards(fieldY, halfLength, halfWidth) {
  const group = new THREE.Group();
  group.name = 'AdBoards';
  const baseTex = getLedTexture();

  const makeMaterial = (lengthM) => {
    const map = baseTex.clone();
    map.needsUpdate = true;
    map.repeat.set(lengthM / PANEL_LENGTH, 1);
    return new THREE.MeshStandardMaterial({
      color: 0x222222,
      emissive: 0xffffff,
      emissiveMap: map,
      emissiveIntensity: 0.85,
      roughness: 0.6,
      metalness: 0.1
    });
  };

  const y = fieldY + BOARD_HEIGHT / 2;

  // Sideline boards (+Z / -Z)
  const sideLength = 2 * halfLength + 2 * BOARD_DEPTH;
  const sideGeoms = [];
  for (const sign of [-1, 1]) {
    sideGeoms.push(
      new THREE.BoxGeometry(sideLength, BOARD_HEIGHT, BOARD_DEPTH)
        .translate(0, y, sign * (halfWidth + BOARD_DEPTH / 2))
    );
  }
  const sides = new THREE.Mesh(mergeOrThrow(sideGeoms, 'AdBoardsSide'), makeMaterial(sideLength));
  sides.name = 'AdBoards_Sidelines';
  sides.castShadow = false;
  sides.receiveShadow = true;
  group.add(sides);

  // End-zone boards (+X / -X)
  const endLength = 2 * halfWidth;
  const endGeoms = [];
  for (const sign of [-1, 1]) {
    endGeoms.push(
      new THREE.BoxGeometry(BOARD_DEPTH, BOARD_HEIGHT, endLength)
        .translate(sign * (halfLength + BOARD_DEPTH / 2), y, 0)
    );
  }
  const ends = new THREE.Mesh(mergeOrThrow(endGeoms, 'AdBoardsEnd'), makeMaterial(endLength));
  ends.name = 'AdBoards_EndZones';
  ends.castShadow = false;
  ends.receiveShadow = true;
  group.add(ends);

  return group;
}
