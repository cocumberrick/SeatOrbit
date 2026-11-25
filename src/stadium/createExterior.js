import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EXTERIOR, ROOF, getRoofColumnLayout } from '../config/stadiumConfig.js';

// Materials are created once, at module level.
const concrete = new THREE.MeshStandardMaterial({ color: 0x92999f, roughness: 0.9 });
const dark = new THREE.MeshStandardMaterial({ color: 0x747c83, roughness: 0.92 });

function addMerged(group, geoms, material, name, castShadow, receiveShadow) {
  if (!geoms.length) return;
  const merged = mergeGeometries(geoms, false);
  geoms.forEach(g => g.dispose());
  if (!merged) throw new Error(`Could not merge ${name} geometries`);
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  group.add(mesh);
}

export function createExterior() {
  const group = new THREE.Group(); group.name = 'Exterior';
  const P = EXTERIOR.pylon, capH = ROOF.columns.capHeight;
  const h = EXTERIOR.pylonHeight - capH;

  // Shared templates, cloned + baked per column.
  const shaftTemplate = new THREE.CylinderGeometry(
    P.topWidth / Math.SQRT2, P.baseWidth / Math.SQRT2, h, 4
  );
  const capTemplate = new THREE.BoxGeometry(P.topWidth + 0.5, capH, P.topWidth * P.depthRatio + 0.5);

  // Same transform the old per-mesh code produced: T * R(y = 45deg) * S(1,1,depthRatio)
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0));
  const scl = new THREE.Vector3(1, 1, P.depthRatio);
  const pos = new THREE.Vector3();
  const mat = new THREE.Matrix4();

  const shafts = [], caps = [];
  for (const c of getRoofColumnLayout()) {
    mat.compose(pos.set(c.x, h / 2, c.z), quat, scl);
    shafts.push(shaftTemplate.clone().applyMatrix4(mat));
    caps.push(capTemplate.clone().translate(c.x, EXTERIOR.pylonHeight - capH / 2, c.z));
  }
  shaftTemplate.dispose();
  capTemplate.dispose();

  addMerged(group, shafts, concrete, 'PylonShafts', true, true);
  addMerged(group, caps, dark, 'PylonCaps', true, false);

  // Two longitudinal concrete tie beams only; no end-zone perimeter walls.
  const beams = [];
  for (const side of [-1, 1]) {
    beams.push(
      new THREE.BoxGeometry(ROOF.trussSpan + 4, 1.2, 2.4)
        .translate(0, EXTERIOR.pylonHeight - 0.6, side * ROOF.canopy.rearZ)
    );
  }
  addMerged(group, beams, concrete, 'TieBeams', true, false);
  return group;
}