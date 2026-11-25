
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BOWL, RINK, canopyFrontZ } from '../config/stadiumConfig.js';
import { QUALITY_MODE, normalizeQualityMode } from '../config/renderQuality.js';
import { ghost } from '../stadium/arenaDetail.js';

const FLOOD_DUSK = 18000;
const FLOOD_COLOUR = 0xffe8c4;

const FIELD_Y = BOWL?.fieldElevation ?? -8;
const RINK_LENGTH = RINK?.LENGTH ?? 60.96;
const RINK_WIDTH = RINK?.WIDTH ?? 25.91;

export function createLighting(scene, renderer = null) {
  // Environment lighting.
  const hemi = new THREE.HemisphereLight(
    0x9bb9e8,
    0x171b24,
    0.42
  );

  scene.add(hemi);

  const ambient = new THREE.AmbientLight(
    0x9aafd0,
    0.22
  );

  scene.add(ambient);

  // Subtle warm arena fill.
  const sun = new THREE.DirectionalLight(
    0xffd5a0,
    0.65
  );

  sun.position.set(120, 100, 80);
  sun.castShadow = false;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(
    0x9bbcff,
    0.22
  );

  fill.position.set(-100, 70, -120);
  fill.castShadow = false;
  scene.add(fill);

  // Arena floodlights.
  const floodlights = createFloodlights(scene);

  // Optional PMREM environment.
  let environment = null;
  let pmrem = null;
  let environmentTarget = null;

  if (renderer) {
    const result = createEnvironment(scene, renderer, 0.3);
    environment = result.texture;
    pmrem = result.generator;
    environmentTarget = result.target;
  }

  const original = {
    hemi: hemi.intensity,
    ambient: ambient.intensity,
    sun: sun.intensity,
    fill: fill.intensity,
    hemiColor: hemi.color.clone(),
    ambientColor: ambient.color.clone(),
    sunColor: sun.color.clone(),
    fillColor: fill.color.clone()
  };
  let sceneMode = QUALITY_MODE.STANDARD;
  let arenaStyle = 'jets';
  let floodBase = FLOOD_DUSK;
  let overviewMode = false;

  function setOverviewMode(enabled) {
    overviewMode = !!enabled;
    floodlights.group.visible = !overviewMode;
    for (const light of floodlights.lights) light.visible = !overviewMode;
  }

  function setSceneMode(mode) {
    sceneMode = normalizeQualityMode(mode);
    if (arenaStyle === 'cyber') {
      if (sceneMode === QUALITY_MODE.LITE) {
        hemi.intensity = 0.3;
        ambient.intensity = 0.19;
        sun.intensity = 0.08;
        fill.intensity = 0.34;
        floodBase = 9500;
      } else if (sceneMode === QUALITY_MODE.STANDARD) {
        hemi.intensity = 0.34;
        ambient.intensity = 0.2;
        sun.intensity = 0.12;
        fill.intensity = 0.38;
        floodBase = 15500;
      } else {
        hemi.intensity = 0.2;
        ambient.intensity = 0.12;
        sun.intensity = 0.035;
        fill.intensity = 0.4;
        floodBase = 22500;
      }
      hemi.color.setHex(0x3c8fca);
      ambient.color.setHex(0x0b1930);
      sun.color.setHex(0x8fc9ff);
      fill.color.setHex(0x30c8f2);
    } else if (sceneMode === QUALITY_MODE.LITE) {
      hemi.intensity = 0.48;
      ambient.intensity = 0.24;
      sun.intensity = 0.5;
      fill.intensity = 0.18;
      hemi.color.setHex(0xb4c9e6);
      ambient.color.copy(original.ambientColor);
      sun.color.copy(original.sunColor);
      fill.color.copy(original.fillColor);
      floodBase = 12000;
    } else if (sceneMode === QUALITY_MODE.ULTRA) {
      // Keep the bowl and crowd legible while the ice and show accents stay dramatic.
      hemi.intensity = 0.32;
      ambient.intensity = 0.26;
      sun.intensity = 0.08;
      fill.intensity = 0.2;
      hemi.color.setHex(0x5479ad);
      ambient.color.setHex(0x7186a5);
      sun.color.copy(original.sunColor);
      fill.color.copy(original.fillColor);
      floodBase = 24500;
    } else {
      hemi.intensity = original.hemi;
      ambient.intensity = original.ambient;
      sun.intensity = original.sun;
      fill.intensity = original.fill;
      hemi.color.copy(original.hemiColor);
      ambient.color.copy(original.ambientColor);
      sun.color.copy(original.sunColor);
      fill.color.copy(original.fillColor);
      floodBase = FLOOD_DUSK;
    }
    floodlights.setColor(arenaStyle === 'cyber' ? 0xa5efff : FLOOD_COLOUR);
    floodlights.setIntensity(floodBase);
    return sceneMode;
  }

  function setArenaStyle(style) {
    arenaStyle = style === 'cyber' ? 'cyber' : 'jets';
    return setSceneMode(sceneMode);
  }

  function update(timeSeconds) {
    if (sceneMode !== QUALITY_MODE.ULTRA || overviewMode) return;
    const pulse = 0.94 + 0.06 * Math.sin(timeSeconds * 1.25);
    floodlights.setIntensity(floodBase * pulse);
  }

  return {
    hemi,
    ambient,
    sun,
    fill,
    floodlights,
    environment,
    setOverviewMode,
    setSceneMode,
    setArenaStyle,
    update,
    dispose() {
      floodlights.dispose();

      if (environment) {
        scene.environment = null;
      }

      if (environmentTarget) environmentTarget.dispose();
      if (pmrem) pmrem.dispose();

      hemi.dispose();
      ambient.dispose();
      sun.dispose();
      fill.dispose();
    }
  };
}

export function createEnvironment(scene, renderer, intensity = 0.3) {
  if (!renderer) {
    return { texture: null, generator: null };
  }

  const generator = new THREE.PMREMGenerator(renderer);
  generator.compileEquirectangularShader();

  const environmentScene = new RoomEnvironment();

  const target = generator.fromScene(
    environmentScene,
    0.04
  );
  environmentScene.dispose?.();

  const texture = target.texture;

  scene.environment = texture;

  if ('environmentIntensity' in scene) {
    scene.environmentIntensity = intensity;
  }

  // The generated texture is retained by the scene.
  // Keep the generator alive until dispose() is called.

  return {
    texture,
    generator,
    target
  };
}

export function createFloodlights(scene, {
  // Hang fixtures below the roof skin so the beam reaches the ice instead of
  // creating bright pools on the underside of the canopy.
  height = 33,
  xPositions = [-24, 0, 24],
  litIndices = [0, 2],
  intensity = FLOOD_DUSK
} = {}) {
  const group = new THREE.Group();
  group.name = 'Floodlights';

  const mountZ = typeof canopyFrontZ === 'function'
    ? canopyFrontZ() - 3
    : RINK_WIDTH / 2 + 15;

  const housingMaterial = new THREE.MeshStandardMaterial({
    color: 0x252a32,
    metalness: 0.82,
    roughness: 0.32
  });

  const lensMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff1d0,
    toneMapped: false
  });

  const lights = [];

  for (const side of [-1, 1]) {
    xPositions.forEach((x, index) => {
      const position = new THREE.Vector3(
        x,
        height,
        side * mountZ
      );

      const target = new THREE.Vector3(
        x * 0.5,
        FIELD_Y,
        0
      );

      if (litIndices.includes(index)) {
        const spot = new THREE.SpotLight(
          FLOOD_COLOUR,
          intensity,
          82,
          Math.PI / 3.8,
          0.62,
          2
        );

        spot.position.copy(position);
        spot.target.position.copy(target);
        spot.castShadow = false;

        scene.add(spot);
        scene.add(spot.target);

        lights.push(spot);
      }

      // Visible fixture.
      const fixture = new THREE.Group();

      fixture.name =
        `Floodlight_${side > 0 ? 'South' : 'North'}_${index + 1}`;

      const housing = ghost(new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.4, 0.9),
        housingMaterial
      ));

      housing.position.set(0, 0, 0);
      fixture.add(housing);

      const lens = ghost(new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 1.05),
        lensMaterial
      ));

      lens.position.z = 0.47;
      fixture.add(lens);

      fixture.position.copy(position);
      fixture.lookAt(target);

      group.add(fixture);
    });
  }

  scene.add(group);

  return {
    group,
    lights,

    setIntensity(value) {
      lights.forEach((light) => {
        light.intensity = value;
      });
    },

    setColor(value) {
      lights.forEach((light) => light.color.setHex(value));
      lensMaterial.color.setHex(value);
    },

    dispose() {
      lights.forEach((light) => {
        scene.remove(light);
        scene.remove(light.target);
        light.dispose();
      });

      group.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
      });

      scene.remove(group);

      housingMaterial.dispose();
      lensMaterial.dispose();
    }
  };
}
