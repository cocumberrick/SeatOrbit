import * as THREE from 'three';
import { GROUND } from '../config/stadiumConfig.js';
import { createStadiumOvalPath, getArenaFootprint } from '../stadium/arenaHelpers.js';

// Prairie Dusk palette.
const DUSK_SKY_TOP = 0x101a35;
const DUSK_SKY_BOTTOM = 0x2a4058;
const DUSK_FOG = 0x101a2d;
const DUSK_GROUND = 0x171c23;

export function createEnvironment(scene) {
  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const previousFogColor = previousFog?.color?.clone() || null;
  // Fog blends the far edges of the ground into the night. If createScene.js already
  // installed a fog, keep its range and only recolour it; otherwise add one that starts
  // well beyond the stadium so the bowl itself stays crisp from the overview camera.
  if (scene.fog) {
    scene.fog.color.setHex(DUSK_FOG);
  } else {
    scene.fog = new THREE.Fog(DUSK_FOG, 340, 950);
  }
  const background = new THREE.Color(DUSK_FOG);
  scene.background = background;

  const skyGeometry = new THREE.SphereGeometry(900, 32, 16);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      // Prairie Dusk: deep graphite blue overhead fading to dark twilight blue at the horizon.
      topColor: { value: new THREE.Color(DUSK_SKY_TOP) },
      bottomColor: { value: new THREE.Color(DUSK_SKY_BOTTOM) },
      offset: { value: 120 },
      exponent: { value: 0.7 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float t = max(pow(max(h, 0.0), exponent), 0.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);

  // Exterior ground with an oval opening over the sunken arena, so the ice (y = -8)
  // and bowl are not covered by the terrain plane at y = 0.
  const GROUND_SIZE = 1400;
  const half = GROUND_SIZE / 2;
  const fp = getArenaFootprint();

  const groundShape = new THREE.Shape();
  groundShape.moveTo(-half, -half);
  groundShape.lineTo(half, -half);
  groundShape.lineTo(half, half);
  groundShape.lineTo(-half, half);
  groundShape.closePath();
  groundShape.holes.push(createStadiumOvalPath(
    fp.groundOpening.halfL, fp.groundOpening.halfW, fp.groundOpening.radius
  ));

  const groundGeometry = new THREE.ShapeGeometry(groundShape, 24); // same curveSegments as the retaining wall -> seam matches
  groundGeometry.rotateX(-Math.PI / 2); // shape XY plane -> world XZ plane, normal +Y
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: DUSK_GROUND,
    roughness: 0.95,
    metalness: 0.0
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.name = 'Ground';
  ground.position.y = GROUND.exteriorElevation;
  ground.receiveShadow = true;
  scene.add(ground);

  function setArenaStyle(style) {
    const cyber = style === 'cyber';
    const skyTop = cyber ? 0x080d1c : DUSK_SKY_TOP;
    const skyBottom = cyber ? 0x142a49 : DUSK_SKY_BOTTOM;
    const fogColor = cyber ? 0x080d19 : DUSK_FOG;
    topColorFor(skyMaterial).setHex(skyTop);
    bottomColorFor(skyMaterial).setHex(skyBottom);
    background.setHex(fogColor);
    scene.fog.color.setHex(fogColor);
    groundMaterial.color.setHex(cyber ? 0x0a1426 : DUSK_GROUND);
    return style;
  }

  return {
    sky,
    ground,
    setArenaStyle,
    dispose() {
      scene.remove(sky, ground);
      skyGeometry.dispose();
      skyMaterial.dispose();
      groundGeometry.dispose();
      groundMaterial.dispose();
      if (scene.background === background) scene.background = previousBackground;
      if (previousFog && scene.fog === previousFog && previousFogColor) previousFog.color.copy(previousFogColor);
      else if (!previousFog && scene.fog?.color?.getHex() === DUSK_FOG) scene.fog = null;
    }
  };
}

function topColorFor(material) {
  return material.uniforms.topColor.value;
}

function bottomColorFor(material) {
  return material.uniforms.bottomColor.value;
}
