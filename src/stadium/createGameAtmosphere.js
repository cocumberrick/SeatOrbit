import * as THREE from 'three';
import { ARENA, BOWL } from '../config/stadiumConfig.js';
import { getRowOval, getStadiumOvalPerimeter, getStadiumOvalPointAt, getTierLayouts } from './arenaHelpers.js';
import { ghost } from './arenaDetail.js';
import { QUALITY_MODE, normalizeQualityMode } from '../config/renderQuality.js';

const LIGHT_COUNT = 96;
const TEAM_LIGHTS = [0x004c97, 0xffffff, 0xac162c, 0x8e9090];
const CYBER_LIGHTS = [0x00d9ff, 0x53a7ff, 0xff4fca, 0x9a7cff];

/** A low-cost, instanced LED accent mounted below the existing power ring. */
export function createGameAtmosphere() {
  const group = new THREE.Group();
  group.name = 'JetsGameAtmosphere';

  const upper = getTierLayouts()[2];
  const oval = getRowOval(upper, 0);
  const rowHalfDepth = upper.cfg.rowDepth / 2;
  const perimeter = getStadiumOvalPerimeter(oval.halfL, oval.halfW, oval.radius);
  const centerY = (
    BOWL.fieldElevation + ARENA.concourse2.elevation +
    upper.baseY + upper.cfg.riserHeight
  ) / 2 - 0.72;
  const geometry = new THREE.BoxGeometry(perimeter / LIGHT_COUNT * 0.72, 0.085, 0.055);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const lights = ghost(new THREE.InstancedMesh(geometry, material, LIGHT_COUNT));
  lights.name = 'JetsRallyLightSegments';
  lights.castShadow = false;
  lights.receiveShadow = false;
  lights.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  for (let index = 0; index < LIGHT_COUNT; index++) {
    const point = getStadiumOvalPointAt(index * perimeter / LIGHT_COUNT, oval.halfL, oval.halfW, oval.radius);
    transform.position.set(
      point.x - point.nx * rowHalfDepth - point.nx * 0.025,
      centerY,
      point.z - point.nz * rowHalfDepth - point.nz * 0.025
    );
    transform.rotation.set(0, Math.atan2(point.nx, -point.nz), 0);
    transform.updateMatrix();
    lights.setMatrixAt(index, transform.matrix);
    color.setHex(TEAM_LIGHTS[index % TEAM_LIGHTS.length]);
    lights.setColorAt(index, color);
  }
  lights.instanceMatrix.needsUpdate = true;
  if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
  group.add(lights);
  group.visible = false;

  let active = false;
  let sceneMode = QUALITY_MODE.STANDARD;
  let arenaStyle = 'jets';
  let palette = TEAM_LIGHTS;
  function updateVisibility() {
    active = sceneMode === QUALITY_MODE.ULTRA;
    group.visible = active;
    for (let index = 0; index < LIGHT_COUNT; index++) {
      color.setHex(palette[index % palette.length]);
      if (!active) color.multiplyScalar(0.58);
      lights.setColorAt(index, color);
    }
    if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
  }
  group.userData.setSceneMode = (mode) => {
    sceneMode = normalizeQualityMode(mode);
    updateVisibility();
  };
  group.userData.setArenaStyle = (style) => {
    arenaStyle = style === 'cyber' ? 'cyber' : 'jets';
    palette = arenaStyle === 'cyber' ? CYBER_LIGHTS : TEAM_LIGHTS;
    updateVisibility();
  };
  group.userData.update = (timeSeconds) => {
    if (sceneMode !== QUALITY_MODE.ULTRA) return;
    for (let index = 0; index < LIGHT_COUNT; index++) {
      const pulse = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(timeSeconds * 2.2 - index * 0.19));
      color.setHex(palette[index % palette.length]).multiplyScalar(pulse);
      lights.setColorAt(index, color);
    }
    if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
  };
  group.userData.dispose = () => {
    geometry.dispose();
    material.dispose();
  };
  return group;
}

export default createGameAtmosphere;
