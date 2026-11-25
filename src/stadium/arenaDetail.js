import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getStadiumOvalPointAt, getStadiumOvalPerimeter, clampOvalRadius } from './arenaHelpers.js';

export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Декоративные меши не должны перехватывать клики у сидений */
export function ghost(object) {
  object.raycast = function () {};
  return object;
}

export function offsetOval(o, d) {
  return { halfL: o.halfL + d, halfW: o.halfW + d, radius: Math.max(0.01, o.radius + d) };
}

export function ovalPerimeter(o) {
  return getStadiumOvalPerimeter(o.halfL, o.halfW, clampOvalRadius(o.halfL, o.halfW, o.radius));
}

export function ovalPointAt(o, s) {
  return getStadiumOvalPointAt(s, o.halfL, o.halfW, clampOvalRadius(o.halfL, o.halfW, o.radius));
}

export function sampleOval(o, count) {
  const P = ovalPerimeter(o);
  const pts = [];
  for (let i = 0; i < count; i++) pts.push(ovalPointAt(o, (i / count) * P));
  return pts;
}

export function finalize(geometry, color) {
  let g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  const c = new THREE.Color(color === undefined ? 0xffffff : color);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function boxAt(w, h, d, x, y, z, yaw = 0, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (yaw) g.rotateY(yaw);
  g.translate(x, y, z);
  return finalize(g, color);
}

export function mergeOrNull(list) {
  if (!list.length) return null;
  const merged = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  return merged;
}

// Заглушки для совместимости с createBowl.js
export function wallStrip() { return null; }
export function ringWall() { return null; }
export function railTube() { return null; }
export function railPosts() { return null; }
export function makeConcreteTextures() { return { map: null, bump: null }; }
export function makeLabelAtlas() { return null; }
export function labelQuad() { return null; }
export function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  });
}