import * as THREE from 'three';
import { ARENA, getFieldBounds } from '../config/stadiumConfig.js';
import { createPit } from './createPit.js';
import { createBowl } from './createBowl.js';
import { createSeatsProgressively } from './createSeats.js';
import { createConcourse } from './createConcourse.js';
import { createRoof } from './createRoof.js';
import { createVideoBoard } from './createVideoBoard.js';
import { createRink } from './createRink.js';
import { createSeatedFans } from './createSeatedFans.js';
import { createGameAtmosphere } from './createGameAtmosphere.js';
import { createPowerRing } from './createPowerRing.js';
import { QUALITY_MODE, normalizeQualityMode } from '../config/renderQuality.js';

function freezeStaticTransforms(root) {
  root.traverse((object) => {
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  });
}

export async function createStadium(scene, initialMode = QUALITY_MODE.STANDARD, onInvalidate, onBuildProgress) {
  const initialSceneMode = normalizeQualityMode(initialMode);
  const stadium = new THREE.Group();
  stadium.name = 'CanadaLifeCentre';
  scene.add(stadium);

  const bounds = getFieldBounds();
  const yieldFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const updateProgress = async (message) => {
    onBuildProgress?.(message);
    await yieldFrame();
  };

  onBuildProgress?.('Building rink and ice…');
  stadium.add(createRink());
  await updateProgress('Building arena bowl…');
  stadium.add(createPit());
  let seats;
  seats = await createSeatsProgressively(bounds, {
    batchSize: 700,
    onPlacementsReady: (placements) => stadium.add(createBowl(placements)),
    onMeshReady: (mesh) => stadium.add(mesh),
    onProgress: (built, total) => {
      onBuildProgress?.(`Building seats… ${Math.round((built / total) * 100)}%`);
    }
  });
  await updateProgress('Adding fans and arena services…');
  const fans = createSeatedFans(seats.data, initialSceneMode, onInvalidate);
  const concourse = createConcourse();
  let videoBoard = null;
  let atmosphere = null;
  let powerRing = null;

  stadium.add(fans);
  stadium.add(concourse);
  await updateProgress('Finishing arena details…');
  stadium.add(createRoof());
  freezeStaticTransforms(stadium);

  const styledMaterials = new Map();
  let sceneMode = initialSceneMode;
  let arenaStyle = 'jets';

  function ensureVideoBoard() {
    if (videoBoard) return;
    videoBoard = createVideoBoard({
      ...ARENA.jumbotron.position,
      width: ARENA.jumbotron.size.width,
      height: ARENA.jumbotron.size.height,
      depth: ARENA.jumbotron.size.depth
    });
    stadium.add(videoBoard);
    freezeStaticTransforms(videoBoard);
  }

  function releaseVideoBoard() {
    if (!videoBoard) return;
    forgetStyledMaterials(videoBoard);
    videoBoard.userData.dispose?.();
    videoBoard.removeFromParent();
    videoBoard = null;
  }

  function ensureUltraEffects() {
    if (!atmosphere) {
      atmosphere = createGameAtmosphere();
      stadium.add(atmosphere);
      freezeStaticTransforms(atmosphere);
      atmosphere.userData.setArenaStyle(arenaStyle);
      atmosphere.userData.setSceneMode(sceneMode);
    }
    if (!powerRing) {
      powerRing = createPowerRing();
      stadium.add(powerRing);
      freezeStaticTransforms(powerRing);
    }
  }

  function releaseUltraEffects() {
    for (const effect of [atmosphere, powerRing]) {
      if (!effect) continue;
      forgetStyledMaterials(effect);
      effect.userData.dispose?.();
      effect.removeFromParent();
    }
    atmosphere = null;
    powerRing = null;
  }

  function forgetStyledMaterials(root) {
    root.traverse((object) => {
      if (!object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) styledMaterials.delete(material);
    });
  }

  function saveMaterial(material) {
    if (styledMaterials.has(material)) return styledMaterials.get(material);
    const state = {
      color: material.color?.clone() || null,
      emissive: material.emissive?.clone() || null,
      emissiveIntensity: material.emissiveIntensity,
      roughness: material.roughness,
      metalness: material.metalness
    };
    styledMaterials.set(material, state);
    return state;
  }

  function styleMaterial(object, color, emissive, emissiveIntensity) {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      saveMaterial(material);
      if (material.color) material.color.setHex(color);
      if (material.emissive && emissive !== undefined) {
        material.emissive.setHex(emissive);
        material.emissiveIntensity = emissiveIntensity;
      }
      material.needsUpdate = true;
    }
  }

  function hasAncestor(object, name) {
    for (let parent = object.parent; parent && parent !== stadium; parent = parent.parent) {
      if (parent.name === name) return true;
    }
    return false;
  }

  function restoreStyledMaterials() {
    for (const [material, state] of styledMaterials) {
      if (state.color && material.color) material.color.copy(state.color);
      if (state.emissive && material.emissive) material.emissive.copy(state.emissive);
      if (state.emissiveIntensity !== undefined) material.emissiveIntensity = state.emissiveIntensity;
      if (state.roughness !== undefined) material.roughness = state.roughness;
      if (state.metalness !== undefined) material.metalness = state.metalness;
    }
  }

  function applySceneAppearance() {
    restoreStyledMaterials();
    if (arenaStyle === 'cyber') {
      stadium.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        const name = object.name || '';
        if (/^(?:LowerBowl|ClubBowl|UpperBowl)$/.test(name)) {
          styleMaterial(object, 0x7b91aa, 0x091d35, 0.32);
        } else if (/ConcourseSlabs/.test(name)) {
          styleMaterial(object, 0x344762, 0x06152b, 0.2);
        } else if (/ConcourseRearWall|ConcourseExteriorWalls|PremiumLoungeRearFacade/.test(name)) {
          styleMaterial(object, 0x17263d, 0x071a34, 0.22);
        } else if (/Glass|Mullion/.test(name)) {
          styleMaterial(object, 0x72dfff, 0x0b7898, 0.26);
        } else if (/FrontRail|BarTop|PremiumDiningBarTop/.test(name)) {
          styleMaterial(object, 0x43d8ff, 0x0c9fc7, 0.48);
        } else if (/Bench|Penalty/.test(name)) {
          styleMaterial(object, 0x10294a, 0x062448, 0.18);
        } else if (hasAncestor(object, 'RoofGroup') && !/Screen|Label|Logo/.test(name)) {
          styleMaterial(object, 0x29394f, 0x071c36, 0.18);
        } else if (/ArenaExteriorFacade/.test(name)) {
          styleMaterial(object, 0x24354c, 0x071a32, 0.18);
        }
      });
    }

    if (sceneMode === QUALITY_MODE.ULTRA) {
      stadium.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        const name = object.name || '';
        if (/^(?:LowerBowl|ClubBowl|UpperBowl)$/.test(name)) {
          styleMaterial(object, arenaStyle === 'cyber' ? 0x42546d : 0x66788e, 0x07172b, 0.2);
        } else if (/ConcourseSlabs/.test(name)) {
          styleMaterial(object, arenaStyle === 'cyber' ? 0x263b55 : 0x46566b, 0x06162c, 0.12);
        } else if (/ConcourseRearWall|ConcourseExteriorWalls/.test(name)) {
          styleMaterial(object, arenaStyle === 'cyber' ? 0x14243a : 0x202d3e, 0x07182d, 0.14);
        } else if (/PremiumLoungeRearFacade|PremiumDiningBar/.test(name)) {
          styleMaterial(object, arenaStyle === 'cyber' ? 0x152944 : 0x152b49, 0x10223a, 0.2);
        } else if (/PremiumDiningLoungeGlass/.test(name)) {
          styleMaterial(object, arenaStyle === 'cyber' ? 0x54c9e8 : 0xe2b66b, arenaStyle === 'cyber' ? 0x082f49 : 0x5a3516, 0.16);
        } else if (/ArenaExteriorFacade|PitApron/.test(name)) {
          styleMaterial(object, arenaStyle === 'cyber' ? 0x17263d : 0x28374a, 0x061326, 0.18);
        } else if (hasAncestor(object, 'RoofGroup') && !/Screen|Label|Logo/.test(name)) {
          styleMaterial(object, arenaStyle === 'cyber' ? 0x202f47 : 0x293341, 0x07182d, 0.18);
        }
      });
    }

    const gameNight = sceneMode === QUALITY_MODE.ULTRA;
    seats.controller.setPalette(arenaStyle === 'cyber' ? {
      default: gameNight ? 0x071d32 : 0x0b3454,
      hover: 0xb8f7ff,
      selected: 0xff4fc8,
      sectionHover: 0x00bfe8,
      sectionSelected: 0x4fe6ce
    } : {
      default: gameNight ? 0x0b2039 : 0x1b2c3c,
      hover: 0xffffff,
      selected: 0xac162c,
      sectionHover: 0x004c97,
      sectionSelected: 0x8e9090
    });
    concourse.userData.setSceneMode?.(sceneMode);
    concourse.userData.setArenaStyle?.(arenaStyle);
    if (powerRing) powerRing.visible = gameNight;
    fans.userData.setArenaStyle(arenaStyle);
    atmosphere?.userData.setArenaStyle(arenaStyle);
  }

  function setArenaStyle(style) {
    arenaStyle = style === 'cyber' ? 'cyber' : 'jets';
    applySceneAppearance();
    return arenaStyle;
  }

  stadium.userData.dispose = () => {
    for (const child of stadium.children) child.userData.dispose?.();
    stadium.removeFromParent();
  };
  stadium.userData.setSceneMode = (mode) => {
    sceneMode = normalizeQualityMode(mode);
    if (sceneMode === QUALITY_MODE.LITE) releaseVideoBoard();
    else ensureVideoBoard();
    if (sceneMode === QUALITY_MODE.ULTRA) ensureUltraEffects();
    else releaseUltraEffects();
    fans.userData.setSceneMode(sceneMode);
    atmosphere?.userData.setSceneMode(sceneMode);
    applySceneAppearance();
    if (videoBoard) videoBoard.visible = sceneMode !== QUALITY_MODE.LITE;
  };
  stadium.userData.setArenaStyle = setArenaStyle;
  stadium.userData.getSceneMode = () => sceneMode;
  stadium.userData.getArenaStyle = () => arenaStyle;
  stadium.userData.updateSceneMode = (timeSeconds) => atmosphere?.userData.update(timeSeconds);
  return stadium;
}
