import * as THREE from 'three';
import { ARENA, BOWL, RINK, ROOF, trussApexY } from '../config/stadiumConfig.js';

/**
 * Smooth camera flights for the ticketing views.
 *
 * Only one flight can run at a time: starting a new flight (or calling
 * cancelFlight) stops the previous one where it is, so the camera never
 * fights itself when the user clicks quickly or grabs the controls mid-flight.
 */

let activeFlight = null;
const flightStartPosition = new THREE.Vector3();
const flightStartTarget = new THREE.Vector3();
const flightEndPosition = new THREE.Vector3();
const flightEndTarget = new THREE.Vector3();
const endpointCamera = { position: flightEndPosition };
const forwardScratch = new THREE.Vector3();

const WALK_BOUNDS = Object.freeze({
  // Main.js applies the rounded arena-footprint boundary; these are only broad safety limits.
  halfX: ARENA.roof.halfLength + 12,
  halfZ: ARENA.roof.halfWidth + 12,
  minY: BOWL.fieldElevation + 1.15,
  maxY: Math.min(ARENA.roof.elevation - 2.5, trussApexY(0) - 2.5)
});

// Keep the Ice Level orbit in the low rink-side band, just outside the glass.
const ICE_BOUNDS = Object.freeze({ halfX: RINK.LENGTH / 2 + 7, halfZ: RINK.WIDTH / 2 + 7 });
const INTERIOR_BOUNDS = Object.freeze({ halfX: ARENA.roof.halfLength - 4, halfZ: ARENA.roof.halfWidth - 4 });

function clampToOval(position, centreX, centreZ, halfX, halfZ) {
  const x = (position.x - centreX) / halfX;
  const z = (position.z - centreZ) / halfZ;
  const radius = Math.hypot(x, z);
  if (radius > 1) {
    position.x = centreX + (x / radius) * halfX;
    position.z = centreZ + (z / radius) * halfZ;
  }
  return position;
}

export function clampWalkCamera(camera, _groundY) {
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -WALK_BOUNDS.halfX, WALK_BOUNDS.halfX);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -WALK_BOUNDS.halfZ, WALK_BOUNDS.halfZ);
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, WALK_BOUNDS.minY, WALK_BOUNDS.maxY);
  return camera.position;
}

export function clampIceCamera(camera, target) {
  clampToOval(camera.position, 0, 0, ICE_BOUNDS.halfX, ICE_BOUNDS.halfZ);
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, BOWL.fieldElevation + 3, BOWL.fieldElevation + 6.5);
  target.x = THREE.MathUtils.clamp(target.x, -RINK.LENGTH / 2 + 1, RINK.LENGTH / 2 - 1);
  target.z = THREE.MathUtils.clamp(target.z, -RINK.WIDTH / 2 + 1, RINK.WIDTH / 2 - 1);
  return camera.position;
}

function clampInteriorCamera(camera) {
  clampToOval(camera.position, 0, 0, INTERIOR_BOUNDS.halfX, INTERIOR_BOUNDS.halfZ);
  camera.position.y = THREE.MathUtils.clamp(
    camera.position.y,
    BOWL.fieldElevation + 1.35,
    ARENA.roof.elevation - 2.5
  );
}

function clampExteriorCamera(camera) {
  const halfX = ARENA.roof.halfLength + 8;
  const halfZ = ARENA.roof.halfWidth + 8;
  const x = camera.position.x / halfX;
  const z = camera.position.z / halfZ;
  const radius = Math.hypot(x, z);
  if (radius < 1) {
    const scale = 1 / Math.max(radius, 0.001);
    camera.position.x *= scale;
    camera.position.z *= scale;
  }
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, 3, 150);
}

/** Keep orbit views in their intended safe volume. */
export function clampCameraForMode(camera, controls, mode) {
  if (mode === 'fieldLevel') {
    clampIceCamera(camera, controls.target);
  } else if (mode === 'exterior') {
    clampExteriorCamera(camera);
  } else if (mode === 'overview') {
    const roofClearance = ARENA.roof.elevation + 5;
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, roofClearance, 600);
    clampToOval(camera.position, 0, 0, ARENA.roof.halfLength + 200, ARENA.roof.halfWidth + 200);
  } else if (mode === 'section' || mode === 'seat') {
    clampInteriorCamera(camera);
  }
  return camera.position;
}

function clampTransitCamera(camera) {
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -500, 500);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -500, 500);
  // Overview and exterior flights may legitimately pass above the roof; the destination is clamped again for its active mode.
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, BOWL.fieldElevation + 1.35, 600);
}

export function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Accepts a THREE.Vector3, an [x, y, z] array or an { x, y, z } object.
function toVector3(value, target) {
  if (value && value.isVector3) return target.copy(value);
  if (Array.isArray(value)) return target.set(value[0], value[1], value[2]);
  if (value && typeof value === 'object') return target.set(value.x, value.y, value.z);
  throw new TypeError('flyTo: expected a Vector3, an [x, y, z] array or an { x, y, z } object.');
}

export function isCameraFlightActive() {
  return activeFlight !== null;
}

export function cancelFlight() {
  if (activeFlight) {
    const flight = activeFlight;
    activeFlight = null;
    flight.cancel();
  }
}

/**
 * Re-aim controls.target along the camera's current forward direction.
 *
 * Used when leaving the first-person seat view: while looking around, the
 * camera is rotated by hand and controls.target is stale. Pointing the target
 * straight ahead of the camera means that when OrbitControls takes over again
 * (controls.update() does camera.lookAt(target)) the view does not snap, and
 * the following flyTo starts from exactly what the user was looking at.
 *
 * The target is placed at `distance` along the view direction (default: the
 * camera's distance to `fallbackPoint`, or 10) so OrbitControls' min/max
 * distance limits do not move the camera on the first update.
 */
export function setTargetAheadOfCamera(camera, controls, distance, fallbackPoint) {
  let d = distance;
  if (!(d > 0)) {
    d = fallbackPoint ? camera.position.distanceTo(fallbackPoint) : 10;
  }
  if (!(d > 0)) d = 10;

  camera.getWorldDirection(forwardScratch);
  controls.target.copy(camera.position).addScaledVector(forwardScratch, d);
}

/**
 * Animate camera.position to targetPos and controls.target to targetLookAt.
 * Returns a Promise that resolves to true when the flight completes, or to
 * false if it was cancelled before finishing.
 */
export function flyTo(camera, controls, targetPos, targetLookAt, duration = 800, mode = 'section') {
  cancelFlight();

  const endPosition = toVector3(targetPos, flightEndPosition);
  const endTarget = toVector3(targetLookAt, flightEndTarget);
  if (mode !== 'walk') clampCameraForMode(endpointCamera, { target: endTarget }, mode);
  const startPosition = flightStartPosition.copy(camera.position);
  const startTarget = flightStartTarget.copy(controls.target);

  if (!(duration > 0)) {
    camera.position.copy(endPosition);
    controls.target.copy(endTarget);
    clampCameraForMode(camera, controls, mode);
    controls.update();
    clampCameraForMode(camera, controls, mode);
    return Promise.resolve(true);
  }

  return new Promise(function (resolve) {
    const savedMinDistance = controls.minDistance;
    const savedMaxDistance = controls.maxDistance;
    let limitsRestored = false;
    function restoreDistanceLimits() {
      if (limitsRestored) return;
      limitsRestored = true;
      controls.minDistance = savedMinDistance;
      controls.maxDistance = savedMaxDistance;
    }
    // Let the camera travel from the previous view to the new preset without
    // OrbitControls snapping it to the destination mode's distance limits.
    controls.minDistance = 0.01;
    controls.maxDistance = 100000;

    const flight = {
      cancelled: false,
      cancel: function () {
        flight.cancelled = true;
        restoreDistanceLimits();
        resolve(false);
      }
    };
    activeFlight = flight;

    const startTime = performance.now();

    function step(now) {
      if (flight.cancelled) return;

      const t = Math.min(Math.max((now - startTime) / duration, 0), 1);
      const eased = easeInOutCubic(t);

      camera.position.lerpVectors(startPosition, endPosition, eased);
      controls.target.lerpVectors(startTarget, endTarget, eased);
      clampTransitCamera(camera);
      controls.update();
      clampTransitCamera(camera);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        restoreDistanceLimits();
        clampCameraForMode(camera, controls, mode);
        controls.update();
        clampCameraForMode(camera, controls, mode);
        if (activeFlight === flight) activeFlight = null;
        resolve(true);
      }
    }

    requestAnimationFrame(step);
  });
}
