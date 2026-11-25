
import * as THREE from 'three';
import { ARENA } from '../config/stadiumConfig.js';
import { createStadiumOvalShape } from './arenaHelpers.js';
import { ghost } from './arenaDetail.js';
import { createRoofStructure } from './createRoofStructure.js';

const ROOF = ARENA.roof || {
  elevation: 42,
  halfLength: 75,
  halfWidth: 36,
  cornerRadius: 12
};

const FRAME = {
  chordRadius: 0.32,
  webRadius: 0.13,
  rimRadius: 0.65,
  longitudinalCount: 9,
  transverseCount: 7,
  jumbotronY: 17,
  screenWidth: 9,
  screenHeight: 4.5,
  screenDepth: 7
};

function createSteelTube(start, end, radius, material, radialSegments = 8) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length < 0.001) return null;
  const geometry = new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1);
  const mesh = ghost(new THREE.Mesh(geometry, material));
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function createRoofPanel() {
  const L = ROOF.halfLength;
  const W = ROOF.halfWidth;
  const R = ROOF.cornerRadius;
  const elevation = ROOF.elevation;

  const geometry = new THREE.ShapeGeometry(
    createStadiumOvalShape(L, W, R),
    32
  );

  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, elevation - 1.8, 0);

  const material = new THREE.MeshStandardMaterial({
    color: 0x777f89,
    roughness: 0.75,
    metalness: 0.45,
    side: THREE.DoubleSide
  });

  const panel = ghost(new THREE.Mesh(geometry, material));

  panel.name = 'RoofPanel';
  panel.receiveShadow = false;
  panel.castShadow = false;

  return panel;
}

function createScreenMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    toneMapped: false,
    side: THREE.DoubleSide
  });
}

function createJumbotron() {
  const group = new THREE.Group();
  group.name = 'Jumbotron';

  const W = FRAME.screenWidth;
  const H = FRAME.screenHeight;
  const D = FRAME.screenDepth;
  const y = FRAME.jumbotronY;

  const housingMaterial = new THREE.MeshStandardMaterial({
    color: 0x171c23,
    roughness: 0.3,
    metalness: 0.85
  });

  const housing = ghost(new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    housingMaterial
  ));

  housing.name = 'JumbotronHousing';
  group.add(housing);

  const screenColors = [
    0x003b83,
    0x004c97,
    0x082b58,
    0x002b60
  ];

  const facePositions = [
    { x: 0, z: D / 2 + 0.015, rotation: 0 },
    { x: 0, z: -D / 2 - 0.015, rotation: Math.PI },
    { x: W / 2 + 0.015, z: 0, rotation: Math.PI / 2 },
    { x: -W / 2 - 0.015, z: 0, rotation: -Math.PI / 2 }
  ];

  facePositions.forEach((p, i) => {
    const screen = ghost(new THREE.Mesh(
      new THREE.PlaneGeometry(
        i < 2 ? W * 0.94 : D * 0.94,
        H * 0.9
      ),
      createScreenMaterial(screenColors[i])
    ));

    screen.name = `JumbotronScreen_${i + 1}`;
    screen.position.set(p.x, 0, p.z);
    screen.rotation.y = p.rotation;
    group.add(screen);
  });

  // Bottom-facing screen.
  const bottom = ghost(new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.85, D * 0.85),
    createScreenMaterial(0x041e42)
  ));

  bottom.name = 'JumbotronBottomScreen';
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -H / 2 - 0.02;
  group.add(bottom);

  // Support cables.
  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x555c65,
    metalness: 0.9,
    roughness: 0.3
  });

  const cableTop = new THREE.Vector3(0, y + 10, 0);
  const corners = [
    [-W / 2, -D / 2],
    [W / 2, -D / 2],
    [W / 2, D / 2],
    [-W / 2, D / 2]
  ];

  for (const [x, z] of corners) {
    const cable = createSteelTube(
      cableTop,
      new THREE.Vector3(x, y + H / 2, z),
      0.055,
      cableMaterial,
      6
    );

    if (cable) group.add(cable);
  }

  group.position.y = y;
  return group;
}

export function createRoof() {
  const group = new THREE.Group();
  group.name = 'RoofGroup';

  const L = ROOF.halfLength;
  const W = ROOF.halfWidth;
  const R = ROOF.cornerRadius;
  const elevation = ROOF.elevation;

  group.add(createRoofPanel());
  group.add(createRoofStructure({
    halfLength: L,
    halfWidth: W,
    cornerRadius: R,
    elevation
  }));

  // The current four-sided LED board is created once by createVideoBoard().
  // Do not add the legacy flat-blue board here as a second overlapping object.

  group.userData.dispose = () => {
    const disposed = new Set();

    group.traverse((object) => {
      if (object.geometry && !disposed.has(object.geometry)) {
        disposed.add(object.geometry);
        object.geometry.dispose();
      }

      if (object.material) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        materials.forEach((mat) => {
          if (!disposed.has(mat)) {
            disposed.add(mat);
            mat.dispose();
          }
        });
      }
    });
  };

  return group;
}
