import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { QUALITY_MODE, getQualityLevel } from '../config/renderQuality.js';

export function applyRenderQuality(renderer, mode) {
  const quality = getQualityLevel(mode);
  const devicePixelRatio = Number(window.devicePixelRatio) || 1;
  const mobileDisplay = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const mobilePixelRatioCap = quality.pixelRatio >= 2 ? 1.5 : quality.pixelRatio > 1 ? 1.25 : 1.2;
  const pixelRatioCap = mobileDisplay ? Math.min(quality.pixelRatio, mobilePixelRatioCap) : quality.pixelRatio;
  renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: false, // PERF: MSAA multiplies fill-rate and memory bandwidth
    powerPreference: 'high-performance'
  });
  // PERF: no light casts shadows any more, so skip the shadow-map machinery entirely.
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  applyRenderQuality(renderer, QUALITY_MODE.STANDARD);

  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.5,
    2000
  );
  camera.position.set(220, 140, 220);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 10, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.82;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 30;
  controls.maxDistance = 700;
  controls.update();

  return { renderer, scene, camera, controls };
}
