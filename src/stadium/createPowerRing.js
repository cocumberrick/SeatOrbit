import * as THREE from 'three';
import { ARENA, BOWL } from '../config/stadiumConfig.js';
import { getRowOval, getTierLayouts, getStadiumOvalPerimeter, getStadiumOvalPointAt } from './arenaHelpers.js';
import { ghost } from './arenaDetail.js';

function createPowerRingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#123d86');
  gradient.addColorStop(1, '#061b43');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ac162c';
  context.fillRect(0, canvas.height - 16, canvas.width, 16);
  context.fillStyle = '#ffffff';
  context.font = 'bold 58px Arial, Helvetica, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('WINNIPEG JETS  •  GO JETS GO', canvas.width / 2, 112);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createRibbonGeometry(perimeter, oval, centerY, height, radialOffset) {
  const segments = Math.max(256, Math.ceil(perimeter / 0.55));
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const indices = new Uint16Array(segments * 6);
  const repeatCount = Math.max(1, Math.round(perimeter / 14));
  const repeatLength = perimeter / repeatCount;

  for (let index = 0; index <= segments; index++) {
    const distance = perimeter * index / segments;
    const point = getStadiumOvalPointAt(distance % perimeter, oval.halfL, oval.halfW, oval.radius);
    const x = point.x + point.nx * radialOffset;
    const z = point.z + point.nz * radialOffset;
    const vertex = index * 6;
    positions[vertex] = x;
    positions[vertex + 1] = centerY - height / 2;
    positions[vertex + 2] = z;
    positions[vertex + 3] = x;
    positions[vertex + 4] = centerY + height / 2;
    positions[vertex + 5] = z;

    const uv = index * 4;
    const u = distance / repeatLength;
    uvs[uv] = u;
    uvs[uv + 1] = 0;
    uvs[uv + 2] = u;
    uvs[uv + 3] = 1;

    if (index < segments) {
      const current = index * 2;
      const next = current + 2;
      const offset = index * 6;
      indices[offset] = current;
      indices[offset + 1] = next;
      indices[offset + 2] = current + 1;
      indices[offset + 3] = current + 1;
      indices[offset + 4] = next;
      indices[offset + 5] = next + 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createPowerRing() {
  const group = new THREE.Group();
  group.name = 'JetsPowerRing';

  const upper = getTierLayouts()[2];
  const oval = getRowOval(upper, 0);
  const innerRowEdge = upper.cfg.rowDepth / 2;
  const perimeter = getStadiumOvalPerimeter(oval.halfL, oval.halfW, oval.radius);
  const frontConcourseY = BOWL.fieldElevation + ARENA.concourse2.elevation;
  const firstRiserTopY = upper.baseY + upper.cfg.riserHeight;
  const centerY = (frontConcourseY + firstRiserTopY) / 2;
  const panelHeight = 0.84;

  // One continuous, inward-facing ribbon replaces the disconnected floating sign panels.
  const housingGeometry = createRibbonGeometry(perimeter, oval, centerY, panelHeight + 0.14, -innerRowEdge + 0.11);
  const screenGeometry = createRibbonGeometry(perimeter, oval, centerY, panelHeight, -innerRowEdge - 0.012);
  const housingMaterial = new THREE.MeshStandardMaterial({
    color: 0x17202b,
    metalness: 0.58,
    roughness: 0.42,
    side: THREE.DoubleSide
  });
  const texture = createPowerRingTexture();
  const screenMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    side: THREE.DoubleSide
  });

  const housing = ghost(new THREE.Mesh(housingGeometry, housingMaterial));
  housing.name = 'JetsPowerRingHousing';
  housing.castShadow = false;
  housing.receiveShadow = false;
  const screen = ghost(new THREE.Mesh(screenGeometry, screenMaterial));
  screen.name = 'JetsPowerRingScreens';
  screen.castShadow = false;
  screen.receiveShadow = false;
  group.add(housing, screen);

  group.userData.dispose = () => {
    housingGeometry.dispose();
    screenGeometry.dispose();
    texture.dispose();
    screenMaterial.dispose();
    housingMaterial.dispose();
  };
  return group;
}
