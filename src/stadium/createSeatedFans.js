import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ghost } from './arenaDetail.js';
import { seatKey } from './seatLayout.js';
import { photoBillboardsStore } from '../state/photoBillboardsStore.js';
import { QUALITY_MODE, normalizeQualityMode } from '../config/renderQuality.js';

const CROWD_DENSITY = 0.38;
const BANNER_WIDTH = 0.3;
const BANNER_HEIGHT = 0.21;
const BANNER_TEXTURE_WIDTH = 320;
const BANNER_TEXTURE_HEIGHT = 224;
const SHIRT_COLORS = [0x041e42, 0x004c97, 0x8e9090, 0xffffff, 0x55565a, 0xac162c];
const CYBER_SHIRT_COLORS = [0x06243b, 0x07507a, 0x176a91, 0x9deaff, 0x473b72, 0xa73f70];
const SKIN_COLORS = [0xd6a078, 0xb97852, 0x895b43, 0xe1b894, 0x68432f];

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildMergedGeometry(parts, name) {
  const geometry = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error(`Could not build ${name} geometry`);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = name;
  return geometry;
}

function makeSeatedPoseGeometry() {
  const parts = [
    new THREE.BoxGeometry(0.27, 0.38, 0.19).translate(0, 0.73, -0.09),
    new THREE.BoxGeometry(0.085, 0.29, 0.12).translate(-0.17, 0.72, -0.1),
    new THREE.BoxGeometry(0.085, 0.29, 0.12).translate(0.17, 0.72, -0.1)
  ];
  return buildMergedGeometry(parts, 'SeatedFanTorsoAndArms');
}

function makeSeatedLegGeometry() {
  const parts = [
    new THREE.BoxGeometry(0.12, 0.13, 0.29).translate(-0.075, 0.51, -0.2),
    new THREE.BoxGeometry(0.12, 0.13, 0.29).translate(0.075, 0.51, -0.2)
  ];
  return buildMergedGeometry(parts, 'SeatedFanLegs');
}

function setSeatInstance(mesh, index, seat, yOffset, zOffset, object) {
  object.position.set(
    seat.position.x - Math.sin(seat.yaw) * zOffset,
    seat.position.y + yOffset,
    seat.position.z - Math.cos(seat.yaw) * zOffset
  );
  object.rotation.y = seat.yaw;
  object.updateMatrix();
  mesh.setMatrixAt(index, object.matrix);
}

function setSeatLocalInstance(mesh, index, seat, localX, localY, localZ, object) {
  const cos = Math.cos(seat.yaw);
  const sin = Math.sin(seat.yaw);
  object.position.set(
    seat.position.x + cos * localX + sin * localZ,
    seat.position.y + localY,
    seat.position.z - sin * localX + cos * localZ
  );
  object.rotation.y = seat.yaw;
  object.updateMatrix();
  mesh.setMatrixAt(index, object.matrix);
}

function makeBannerTexture(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = BANNER_TEXTURE_WIDTH;
      canvas.height = BANNER_TEXTURE_HEIGHT;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas is unavailable'));
        return;
      }

      context.fillStyle = '#10284a';
      context.fillRect(0, 0, BANNER_TEXTURE_WIDTH, BANNER_TEXTURE_HEIGHT);
      const targetAspect = BANNER_TEXTURE_WIDTH / BANNER_TEXTURE_HEIGHT;
      const sourceAspect = image.naturalWidth / image.naturalHeight;
      let sx = 0;
      let sy = 0;
      let sw = image.naturalWidth;
      let sh = image.naturalHeight;
      if (sourceAspect > targetAspect) {
        sw = image.naturalHeight * targetAspect;
        sx = (image.naturalWidth - sw) / 2;
      } else {
        sh = image.naturalWidth / targetAspect;
        sy = (image.naturalHeight - sh) / 2;
      }
      context.drawImage(image, sx, sy, sw, sh, 0, 0, BANNER_TEXTURE_WIDTH, BANNER_TEXTURE_HEIGHT);
      context.beginPath();
      context.roundRect(4, 4, BANNER_TEXTURE_WIDTH - 8, BANNER_TEXTURE_HEIGHT - 8, 20);
      context.strokeStyle = '#8e9090';
      context.lineWidth = 6;
      context.stroke();
      context.fillStyle = '#ac162c';
      context.fillRect(4, BANNER_TEXTURE_HEIGHT - 14, BANNER_TEXTURE_WIDTH - 8, 10);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 2;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      // Keep the canvas alive as the texture source until the GPU has uploaded it.
      resolve(texture);
    };
    image.onerror = () => reject(new Error('Could not load saved fan flag photo'));
    image.src = dataUrl;
  });
}

function resolvePhotoSeat(item, seatData) {
  const seat = seatData[item.seatId];
  if (!seat || seat.active === false) return null;
  const expectedKey = seatKey(item.section, item.row, item.seat);
  return seat.key === expectedKey && seat.section === String(item.section) &&
    seat.row === item.row && seat.seat === item.seat ? seat : null;
}

export function createSeatedFans(seatData, initialMode = 2, onInvalidate = () => {}) {
  const group = new THREE.Group();
  group.name = 'SeatedFans';
  const crowdGroup = new THREE.Group();
  crowdGroup.name = 'FanCrowd';
  const flagSupportGroup = new THREE.Group();
  flagSupportGroup.name = 'PaidFlagSupports';
  const photoFlagGroup = new THREE.Group();
  photoFlagGroup.name = 'PaidPhotoFlags';
  crowdGroup.visible = normalizeQualityMode(initialMode) !== QUALITY_MODE.LITE;
  group.add(crowdGroup, flagSupportGroup, photoFlagGroup);

  const torsoGeometry = makeSeatedPoseGeometry();
  const legGeometry = makeSeatedLegGeometry();
  const headGeometry = new THREE.SphereGeometry(0.135, 8, 6);
  const bannerGeometry = new THREE.PlaneGeometry(BANNER_WIDTH, BANNER_HEIGHT);
  const poleGeometry = new THREE.CylinderGeometry(0.009, 0.012, 0.64, 6);
  const raisedArmGeometry = new THREE.BoxGeometry(0.07, 0.33, 0.08);
  raisedArmGeometry.rotateZ(-0.3);
  raisedArmGeometry.translate(0.19, 0.94, -0.12);
  const raisedHandGeometry = new THREE.SphereGeometry(0.045, 6, 4);
  const torsoMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const legMaterial = new THREE.MeshLambertMaterial({ color: 0x101721 });
  const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x303843, metalness: 0.58, roughness: 0.4 });
  const raisedArmMaterial = new THREE.MeshLambertMaterial({ color: 0x24558a });
  const raisedHandMaterial = new THREE.MeshLambertMaterial({ color: 0xd6a078 });
  const bannerMaterial = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide });

  const photoItems = new Map();
  const bannerMeshes = new Map();
  const pendingPhotos = new Map();
  const photoSeats = new Set();
  const shirtColor = new THREE.Color();
  const skinColor = new THREE.Color();
  const instanceTransform = new THREE.Object3D();
  let shirtColors = SHIRT_COLORS;
  let currentStyle = 'jets';
  let sceneMode = normalizeQualityMode(initialMode);
  let crowdDensity = sceneMode === QUALITY_MODE.ULTRA ? 0.88 : CROWD_DENSITY;
  let crowdMeshes = null;
  let crowdCapacity = 0;
  let supportMeshes = null;
  let supportCapacity = 0;
  let disposed = false;

  function createInstanceMesh(geometry, material, count, name, parent) {
    const mesh = ghost(new THREE.InstancedMesh(geometry, material, Math.max(1, count)));
    mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = true;
    parent.add(mesh);
    return mesh;
  }

  function releaseMeshes(meshes) {
    if (!meshes) return;
    for (const mesh of Object.values(meshes)) {
      mesh.removeFromParent();
      mesh.dispose();
    }
  }

  function ensureCrowdMeshes(capacity) {
    if (crowdMeshes && crowdCapacity === capacity) return;
    releaseMeshes(crowdMeshes);
    crowdCapacity = capacity;
    crowdMeshes = capacity > 0 ? {
      torso: createInstanceMesh(torsoGeometry, torsoMaterial, capacity, 'SeatedFanTorsoInstances', crowdGroup),
      legs: createInstanceMesh(legGeometry, legMaterial, capacity, 'SeatedFanLegInstances', crowdGroup),
      head: createInstanceMesh(headGeometry, headMaterial, capacity, 'SeatedFanHeadInstances', crowdGroup)
    } : null;
  }

  function ensureSupportMeshes(capacity) {
    if (supportMeshes && supportCapacity === capacity) return;
    releaseMeshes(supportMeshes);
    supportCapacity = capacity;
    supportMeshes = capacity > 0 ? {
      pole: createInstanceMesh(poleGeometry, poleMaterial, capacity, 'PhotoFanFlagPoleInstances', flagSupportGroup),
      arm: createInstanceMesh(raisedArmGeometry, raisedArmMaterial, capacity, 'PhotoFanRaisedArmInstances', flagSupportGroup),
      hand: createInstanceMesh(raisedHandGeometry, raisedHandMaterial, capacity, 'PhotoFanRaisedHandInstances', flagSupportGroup)
    } : null;
  }

  function rebuildCrowd() {
    if (sceneMode === QUALITY_MODE.LITE) {
      ensureCrowdMeshes(0);
      return;
    }

    let requiredCount = 0;
    for (const seat of seatData) {
      if (!seat || seat.active === false || !Number.isFinite(seat.position?.x)) continue;
      if (hashString(seat.key) % 100 < crowdDensity * 100 || photoSeats.has(seat.id)) requiredCount++;
    }
    ensureCrowdMeshes(requiredCount);
    if (!crowdMeshes) return;

    let count = 0;
    for (const seat of seatData) {
      if (!seat || seat.active === false || !Number.isFinite(seat.position?.x)) continue;
      const hash = hashString(seat.key);
      if (hash % 100 >= crowdDensity * 100 && !photoSeats.has(seat.id)) continue;
      setSeatInstance(crowdMeshes.torso, count, seat, 0, 0, instanceTransform);
      setSeatInstance(crowdMeshes.legs, count, seat, 0, 0, instanceTransform);
      setSeatInstance(crowdMeshes.head, count, seat, 1.0, 0.1, instanceTransform);
      shirtColor.setHex(shirtColors[(hash >>> 8) % shirtColors.length]);
      skinColor.setHex(SKIN_COLORS[(hash >>> 16) % SKIN_COLORS.length]);
      crowdMeshes.torso.setColorAt(count, shirtColor);
      crowdMeshes.head.setColorAt(count, skinColor);
      count++;
    }
    for (const mesh of Object.values(crowdMeshes)) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  function removeBanner(seatId) {
    const entry = bannerMeshes.get(seatId);
    if (!entry) return;
    entry.mesh.removeFromParent();
    entry.material.map?.dispose();
    entry.material.dispose();
    bannerMeshes.delete(seatId);
  }

  function syncPortraits() {
    if (disposed) return;
    const nextItems = new Map();
    for (const item of photoBillboardsStore.getAll()) {
      if (resolvePhotoSeat(item, seatData)) nextItems.set(item.seatId, item);
    }
    let crowdChanged = false;
    for (const seatId of photoItems.keys()) {
      if (!nextItems.has(seatId)) {
        photoSeats.delete(seatId);
        removeBanner(seatId);
        crowdChanged = true;
      }
    }
    photoItems.clear();
    for (const [seatId, item] of nextItems) {
      photoItems.set(seatId, item);
      if (!photoSeats.has(seatId)) {
        photoSeats.add(seatId);
        crowdChanged = true;
      }
      const current = bannerMeshes.get(seatId);
      if (current?.updatedAt === item.updatedAt) continue;
      const pendingKey = `${seatId}:${item.updatedAt}`;
      if (pendingPhotos.get(seatId) === pendingKey) continue;
      pendingPhotos.set(seatId, pendingKey);
      makeBannerTexture(item.dataUrl).then((texture) => {
        if (disposed || photoItems.get(seatId)?.updatedAt !== item.updatedAt) {
          texture.dispose();
          if (pendingPhotos.get(seatId) === pendingKey) pendingPhotos.delete(seatId);
          return;
        }
        removeBanner(seatId);
        const seat = resolvePhotoSeat(item, seatData);
        if (!seat) {
          texture.dispose();
          return;
        }
        const material = bannerMaterial.clone();
        material.map = texture;
        const banner = ghost(new THREE.Mesh(bannerGeometry, material));
        banner.name = `FanPhotoFlag_${seatId}`;
        banner.castShadow = false;
        banner.receiveShadow = false;
        banner.frustumCulled = true;
        const cos = Math.cos(seat.yaw);
        const sin = Math.sin(seat.yaw);
        banner.position.set(
          seat.position.x + cos * 0.4 - sin * 0.15,
          seat.position.y + 1.25,
          seat.position.z - sin * 0.4 - cos * 0.15
        );
        banner.rotation.y = seat.yaw + Math.PI;
        banner.updateMatrix();
        banner.matrixAutoUpdate = false;
        photoFlagGroup.add(banner);
        bannerMeshes.set(seatId, { mesh: banner, material, updatedAt: item.updatedAt });
        pendingPhotos.delete(seatId);
        onInvalidate();
      }).catch((error) => {
        pendingPhotos.delete(seatId);
        if (!disposed) console.warn('[SeatedFans] Could not render a saved fan flag:', error);
      });
    }

    const flagSeats = [...nextItems.values()]
      .map((item) => resolvePhotoSeat(item, seatData))
      .filter(Boolean);
    ensureSupportMeshes(flagSeats.length);
    flagSeats.forEach((seat, index) => {
      setSeatLocalInstance(supportMeshes.pole, index, seat, 0.24, 1.05, -0.14, instanceTransform);
      setSeatLocalInstance(supportMeshes.hand, index, seat, 0.24, 1.08, -0.14, instanceTransform);
      instanceTransform.position.copy(seat.position);
      instanceTransform.rotation.set(0, seat.yaw, 0);
      instanceTransform.updateMatrix();
      supportMeshes.arm.setMatrixAt(index, instanceTransform.matrix);
    });
    if (supportMeshes) {
      for (const mesh of Object.values(supportMeshes)) {
        mesh.count = flagSeats.length;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (crowdChanged) rebuildCrowd();
    onInvalidate();
  }

  function setSceneMode(mode) {
    const nextMode = normalizeQualityMode(mode);
    if (nextMode === sceneMode) return;
    sceneMode = nextMode;
    crowdDensity = sceneMode === QUALITY_MODE.ULTRA ? 0.88 : CROWD_DENSITY;
    crowdGroup.visible = sceneMode !== QUALITY_MODE.LITE;
    flagSupportGroup.visible = true;
    if (supportMeshes) {
      supportMeshes.pole.visible = true;
      supportMeshes.arm.visible = sceneMode !== QUALITY_MODE.LITE;
      supportMeshes.hand.visible = sceneMode !== QUALITY_MODE.LITE;
    }
    photoFlagGroup.visible = true;
    rebuildCrowd();
    onInvalidate();
  }

  function setArenaStyle(style) {
    const nextStyle = style === 'cyber' ? 'cyber' : 'jets';
    if (nextStyle === currentStyle) return;
    currentStyle = nextStyle;
    shirtColors = currentStyle === 'cyber' ? CYBER_SHIRT_COLORS : SHIRT_COLORS;
    poleMaterial.color.setHex(currentStyle === 'cyber' ? 0x53dfff : 0x303843);
    rebuildCrowd();
    onInvalidate();
  }

  const initialItems = photoBillboardsStore.getAll();
  for (const item of initialItems) {
    if (resolvePhotoSeat(item, seatData)) photoSeats.add(item.seatId);
  }
  rebuildCrowd();
  syncPortraits();
  const unsubscribe = photoBillboardsStore.subscribe(syncPortraits);

  group.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    for (const seatId of [...bannerMeshes.keys()]) removeBanner(seatId);
    releaseMeshes(crowdMeshes);
    releaseMeshes(supportMeshes);
    torsoGeometry.dispose();
    legGeometry.dispose();
    headGeometry.dispose();
    bannerGeometry.dispose();
    poleGeometry.dispose();
    raisedArmGeometry.dispose();
    raisedHandGeometry.dispose();
    torsoMaterial.dispose();
    legMaterial.dispose();
    headMaterial.dispose();
    poleMaterial.dispose();
    raisedArmMaterial.dispose();
    raisedHandMaterial.dispose();
    bannerMaterial.dispose();
  };
  group.userData.setSceneMode = setSceneMode;
  group.userData.setArenaStyle = setArenaStyle;
  group.userData.getSceneMode = () => sceneMode;

  return group;
}

export default createSeatedFans;
