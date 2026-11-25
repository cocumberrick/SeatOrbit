import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA } from '../config/stadiumConfig.js';
import { ghost } from './arenaDetail.js';

// Materials created once.
const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.8, roughness: 0.4 });
const housingMat = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.6, roughness: 0.5 });

function createScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 1280, 720);
  grad.addColorStop(0, '#081b49');
  grad.addColorStop(0.55, '#123f91');
  grad.addColorStop(1, '#061332');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(0, 0, 1280, 18);
  ctx.fillRect(0, 702, 1280, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(640, 330, 176, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d7e8ff';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(640, 330, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 76px Arial, Helvetica, sans-serif';
  ctx.fillText('WINNIPEG JETS', 640, 95);
  ctx.font = '900 112px Arial, Helvetica, sans-serif';
  ctx.fillText('GO JETS GO', 640, 590);
  ctx.font = 'bold 42px Arial, Helvetica, sans-serif';
  ctx.fillText('WPG  2   •   1  VIS', 640, 674);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  return tex;
}

/**
 * Jumbotron on a steel frame. Built in local space facing +Z, then rotated so
 * the screen faces -X (toward the field) when placed at the +X end.
 * Access the screen mesh via group.userData.screen to swap in a video texture later.
 *
 * The whole frame (housing, bezel, legs, struts, footings) is merged per material,
 * so the board costs 4 draw calls: housing, steel, concrete, screen.
 */
export function createVideoBoard({ x = 0, y = 10.5, z = 0, width = 8, height = 5, depth = 8 } = {}) {
  const group = new THREE.Group();
  group.name = 'VideoBoard';

  const steelGeoms = [], suspensionGeometries = [], housingGeoms = [];

  // Box with optional X rotation baked into the vertices (rotate about own centre, then place).
  const addBox = (target, w, h, d, px, py, pz, rx = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    g.translate(px, py, pz);
    target.push(g);
  };

  // Screen housing + bezel
  const bezel = 0.6;
  const boardDepth = depth;
  addBox(housingGeoms, width, height, boardDepth, 0, y, 0);
  addBox(steelGeoms, width + 2 * bezel, bezel, boardDepth + 0.2, 0, y + height / 2 + bezel / 2, 0);
  addBox(steelGeoms, width + 2 * bezel, bezel, boardDepth + 0.2, 0, y - height / 2 - bezel / 2, 0);
  addBox(steelGeoms, bezel, height, boardDepth + 0.2, -(width / 2 + bezel / 2), y, 0);
  addBox(steelGeoms, bezel, height, boardDepth + 0.2, (width / 2 + bezel / 2), y, 0);

  // Four suspension cables connect the cube to a compact overhead spreader frame.
  const cableLength = 18;
  const cableTopY = y + height / 2 + cableLength;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(suspensionGeometries, 0.07, cableLength, 0.07,
        sx * (width / 2 - 0.35), y + height / 2 + cableLength / 2, sz * (boardDepth / 2 - 0.35));
    }
  }
  addBox(suspensionGeometries, width + 1, 0.35, 0.45, 0, cableTopY, 0);
  addBox(suspensionGeometries, 0.45, 0.35, boardDepth + 1, 0, cableTopY, 0);
  const trussMountY = ARENA.roof.elevation - 3.5;
  const mountLength = trussMountY - (cableTopY + 0.175);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(suspensionGeometries, 0.18, mountLength, 0.18,
        sx * (width / 2 + 0.5), (trussMountY + cableTopY + 0.175) / 2, sz * (boardDepth / 2 + 0.5));
    }
  }

  const flush = (geoms, material, name) => {
    const merged = mergeGeometries(geoms, false);
    geoms.forEach(g => g.dispose());
    if (!merged) throw new Error(`Could not merge ${name} geometries`);
    const mesh = ghost(new THREE.Mesh(merged, material));
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  flush(housingGeoms, housingMat, 'VideoBoardHousing');
  flush(steelGeoms, steel, 'VideoBoardSteel');
  flush(suspensionGeometries, steel, 'VideoBoardSuspension');

  // The screen itself: black base colour with an emissive texture. Never casts shadows.
  const screenTexture = createScreenTexture();
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false, side: THREE.DoubleSide });
  const screens = [];
  for (const side of [-1, 1]) {
    const screen = ghost(new THREE.Mesh(new THREE.PlaneGeometry(width, height), screenMaterial));
    screen.name = `VideoBoardScreen_${side > 0 ? 'Front' : 'Back'}`;
    screen.position.set(0, y, side * (boardDepth / 2 + 0.012));
    if (side < 0) screen.rotation.y = Math.PI;
    screen.castShadow = false;
    screen.receiveShadow = false;
    group.add(screen);
    screens.push(screen);
  }
  for (const side of [-1, 1]) {
    const screenWidth = boardDepth - 2 * bezel;
    const screen = ghost(new THREE.Mesh(new THREE.PlaneGeometry(screenWidth, height), screenMaterial));
    screen.name = `VideoBoardScreen_${side > 0 ? 'Right' : 'Left'}`;
    screen.position.set(side * (width / 2 + bezel + 0.012), y, 0);
    screen.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    screen.castShadow = false;
    screen.receiveShadow = false;
    group.add(screen);
    screens.push(screen);
  }
  group.userData.screen = screens[0];
  group.userData.screens = screens;
  group.userData.dispose = () => {
    group.traverse((object) => { if (object.geometry) object.geometry.dispose(); });
    screenTexture.dispose();
    screenMaterial.dispose();
    steel.dispose();
    housingMat.dispose();
  };

  group.position.set(x, 0, z);
  group.rotation.y = -Math.PI / 2; // screen normal +Z -> -X
  return group;
}
