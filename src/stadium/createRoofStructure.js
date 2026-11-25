import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStadiumOvalPath } from './arenaHelpers.js';
import { ghost } from './arenaDetail.js';

const FRAME = Object.freeze({
  chordRadius: 0.32,
  webRadius: 0.13,
  rimRadius: 0.65,
  longitudinalCount: 9,
  transverseCount: 7
});

const UP = new THREE.Vector3(0, 1, 0);
const _direction = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();

function beamGeometry(start, end, radius, radialSegments = 8) {
  _direction.subVectors(end, start);
  const length = _direction.length();
  if (length < 0.001) return null;
  const geometry = new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1);
  geometry.applyQuaternion(_quaternion.setFromUnitVectors(UP, _direction.normalize()));
  geometry.translate(
    (start.x + end.x) * 0.5,
    (start.y + end.y) * 0.5,
    (start.z + end.z) * 0.5
  );
  return geometry;
}

function addBeam(geometries, start, end, radius) {
  const geometry = beamGeometry(start, end, radius);
  if (geometry) geometries.push(geometry);
}

function createMergedFrame(halfLength, halfWidth, cornerRadius, elevation) {
  const geometries = [];
  const upperY = elevation;
  const lowerY = elevation - 3.5;

  for (let i = 0; i < FRAME.longitudinalCount; i++) {
    const t = i / (FRAME.longitudinalCount - 1);
    const z = -halfWidth + 4 + t * (halfWidth - 4) * 2;
    addBeam(geometries, new THREE.Vector3(-halfLength + 3, upperY, z), new THREE.Vector3(halfLength - 3, upperY, z), FRAME.chordRadius);
    addBeam(geometries, new THREE.Vector3(-halfLength + 3, lowerY, z), new THREE.Vector3(halfLength - 3, lowerY, z), FRAME.chordRadius);

    const divisions = 16;
    for (let j = 0; j < divisions; j++) {
      const x0 = -halfLength + 3 + (j / divisions) * (2 * halfLength - 6);
      const x1 = -halfLength + 3 + ((j + 1) / divisions) * (2 * halfLength - 6);
      addBeam(geometries, new THREE.Vector3(x0, upperY, z), new THREE.Vector3(x1, lowerY, z), FRAME.webRadius);
      if (j % 2 === 0) {
        addBeam(geometries, new THREE.Vector3(x1, upperY, z), new THREE.Vector3(x0, lowerY, z), FRAME.webRadius);
      }
    }
  }

  for (let i = 0; i < FRAME.transverseCount; i++) {
    const t = i / (FRAME.transverseCount - 1);
    const x = -halfLength + 5 + t * (2 * halfLength - 10);
    addBeam(geometries, new THREE.Vector3(x, upperY, -halfWidth + 4), new THREE.Vector3(x, upperY, halfWidth - 4), FRAME.chordRadius * 0.8);
    addBeam(geometries, new THREE.Vector3(x, lowerY, -halfWidth + 4), new THREE.Vector3(x, lowerY, halfWidth - 4), FRAME.chordRadius * 0.8);

    const diagonals = 8;
    for (let j = 0; j < diagonals; j++) {
      const z0 = -halfWidth + 4 + j * (2 * halfWidth - 8) / diagonals;
      const z1 = -halfWidth + 4 + (j + 1) * (2 * halfWidth - 8) / diagonals;
      addBeam(geometries, new THREE.Vector3(x, upperY, z0), new THREE.Vector3(x, lowerY, z1), FRAME.webRadius);
    }
  }

  const perimeter = createStadiumOvalPath(halfLength, halfWidth, cornerRadius);
  const points = perimeter.getPoints(120).map((point) => new THREE.Vector3(point.x, elevation - 1, point.y));
  const rimCurve = new THREE.CatmullRomCurve3(points, true);
  geometries.push(new THREE.TubeGeometry(rimCurve, 160, FRAME.rimRadius, 12, true));

  for (const x of [-halfLength + 8, halfLength - 8]) {
    for (const z of [-halfWidth + 6, halfWidth - 6]) {
      addBeam(geometries, new THREE.Vector3(x, elevation - 10, z), new THREE.Vector3(x, elevation - 2, z), 0.45);
    }
  }

  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error('Could not merge roof frame geometry.');

  const material = new THREE.MeshStandardMaterial({
    color: 0x343a42,
    roughness: 0.38,
    metalness: 0.78
  });
  const mesh = ghost(new THREE.Mesh(merged, material));
  mesh.name = 'RoofFrameMerged';
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const group = new THREE.Group();
  group.name = 'RoofStructure';
  group.add(mesh);
  return group;
}

export function createRoofStructure(options) {
  const config = options || {};
  return createMergedFrame(
    config.halfLength,
    config.halfWidth,
    config.cornerRadius,
    config.elevation
  );
}
