import * as THREE from 'three';
import { BOWL, GROUND } from '../config/stadiumConfig.js';
import {
  createStadiumOvalShape,
  createStadiumOvalPath,
  getArenaFootprint,
  getTierLayouts,
  getStadiumOvalPerimeter,
  getStadiumOvalPointAt
} from './arenaHelpers.js';
import { ghost } from './arenaDetail.js';

function createExteriorSkirt(topOval, baseOval, topY) {
  const segments = 192;
  const verticalBands = 8;
  const vertices = [];
  const colors = [];
  const baseColor = new THREE.Color(0x858c91);
  const seamColor = new THREE.Color(0x70777c);
  const perimeterAt = (oval) => getStadiumOvalPerimeter(oval.halfL, oval.halfW, oval.radius);

  for (let band = 0; band < verticalBands; band++) {
    const t0 = band / verticalBands;
    const t1 = (band + 1) / verticalBands;
    const sample = (t, index) => {
      const oval = {
        halfL: THREE.MathUtils.lerp(topOval.halfL, baseOval.halfL, t),
        halfW: THREE.MathUtils.lerp(topOval.halfW, baseOval.halfW, t),
        radius: THREE.MathUtils.lerp(topOval.radius, baseOval.radius, t)
      };
      return getStadiumOvalPointAt(perimeterAt(oval) * index / segments, oval.halfL, oval.halfW, oval.radius);
    };

    for (let index = 0; index < segments; index++) {
      const next = (index + 1) % segments;
      const a = sample(t0, index);
      const b = sample(t0, next);
      const c = sample(t1, next);
      const d = sample(t1, index);
      const y0 = THREE.MathUtils.lerp(topY, GROUND.exteriorElevation, t0);
      const y1 = THREE.MathUtils.lerp(topY, GROUND.exteriorElevation, t1);
      vertices.push(
        a.x, y0, a.z, b.x, y0, b.z, c.x, y1, c.z,
        a.x, y0, a.z, c.x, y1, c.z, d.x, y1, d.z
      );
      const panelColor = index % 12 === 0 ? seamColor : baseColor;
      for (let vertex = 0; vertex < 6; vertex++) {
        colors.push(panelColor.r, panelColor.g, panelColor.b);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: 0x151719,
    emissiveIntensity: 0.3,
    roughness: 0.86,
    metalness: 0.04,
    side: THREE.DoubleSide
  });
  const mesh = ghost(new THREE.Mesh(geometry, material));
  mesh.name = 'ArenaExteriorFacade';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.dispose = () => { geometry.dispose(); material.dispose(); };
  return mesh;
}

/**
 * Surround of the oval ice (Stage 2.5):
 *  - PitApron: flat oval floor between the ice edge and the front of level100.
 *  - ArenaExteriorFacade: tapered outer shell from the back of the upper bowl to grade.
 *  - Facade meets the terrain opening directly, with no floating curb ring.
 */
export function createPit() {
  const group = new THREE.Group();
  group.name = 'Pit';
  const fp = getArenaFootprint();

  // 1) Neutral rink-side service apron between the boards and the lower bowl.
  const apronShape = createStadiumOvalShape(fp.apron.halfL, fp.apron.halfW, fp.apron.radius);
  apronShape.holes.push(createStadiumOvalPath(fp.ice.halfL, fp.ice.halfW, fp.ice.radius));
  const apronGeo = new THREE.ShapeGeometry(apronShape, 24);
  apronGeo.rotateX(-Math.PI / 2);
  apronGeo.translate(0, BOWL.fieldElevation + 0.005, 0); // +5 mm to avoid z-fighting with the ice
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x747a7e, roughness: 0.9 });
  const apron = ghost(new THREE.Mesh(apronGeo, apronMat));
  apron.name = 'PitApron';
  apron.receiveShadow = true;
  group.add(apron);

  // 2) Tapered exterior shell connects the outer seating bowl directly to grade.
  const upper = getTierLayouts()[2];
  const facadeTopY = upper.baseY + upper.cfg.rows * upper.cfg.riserHeight;
  group.add(createExteriorSkirt(fp.bowlBack, fp.facadeBase, facadeTopY));

  group.userData.dispose = () => {
    apronGeo.dispose(); apronMat.dispose();
    group.children.forEach((child) => child.userData.dispose?.());
  };
  return group;
}
