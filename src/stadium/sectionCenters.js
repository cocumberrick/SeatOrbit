/**
 * sectionCenters.js — where every section sits around the bowl.
 *
 * Source: the clean Ticketmaster overview map (1024x768 render). Each entry is the pixel position of
 * the section's printed label, which sits at the middle of the section polygon. Pixels are converted
 * to arena metres with the calibration below (ice centre -> origin, +X right/east, +Z up/north).
 * Accuracy is about +-1 m. Replace an entry with an exact value whenever you have one.
 *
 * Scale check: with 6.56 px/m the 300-level outline spans +-76 m x +-55 m, which agrees with
 * ARENA.roof (halfLength 76, halfWidth 58) and ARENA.bowl (72 x 54).
 */
import { SECTION_OVERRIDES } from './arenaGeometryData.js';

export const MAP_CALIBRATION = Object.freeze({ cx: 502, cy: 384, pxPerM: 6.56 });

export const MAP_LABEL_PX = Object.freeze({
  // 100 level
  103: [709, 521], 104: [627, 524], 105: [550, 525], 106: [474, 525], 107: [398, 524], 109: [312, 525],
  111: [257, 459], 112: [253, 383], 113: [256, 305],
  115: [283, 237], 116: [333, 216], 117: [398, 241], 118: [474, 235], 119: [550, 235], 120: [627, 241],
  121: [708, 244], 123: [724, 297], 124: [774, 304], 125: [780, 361], 126: [780, 401], 127: [774, 457],
  // 200 level
  202: [777, 555], 203: [704, 592], 204: [631, 595], 205: [555, 596], 206: [479, 596], 207: [403, 596],
  208: [328, 594], 209: [263, 569], 210: [212, 520], 211: [183, 458], 212: [181, 383], 213: [183, 306],
  214: [211, 244], 215: [264, 197], 216: [329, 170], 217: [404, 170], 218: [479, 170], 219: [555, 170],
  220: [631, 170], 221: [704, 172], 222: [777, 209], 224: [831, 275], 227: [826, 490],
  // 300 level
  301: [874, 612], 302: [801, 666], 303: [722, 694], 304: [640, 694], 305: [555, 694], 306: [470, 694],
  307: [384, 694], 308: [300, 694], 309: [223, 667], 310: [150, 613], 311: [97, 540], 312: [71, 463],
  313: [71, 384], 314: [71, 303], 315: [97, 225], 316: [150, 156], 317: [224, 101], 318: [300, 72],
  319: [384, 72], 320: [470, 72], 321: [555, 72], 322: [640, 72], 323: [722, 72], 324: [797, 101],
  325: [873, 156], 326: [926, 227], 327: [953, 303], 328: [953, 384], 329: [953, 463], 330: [926, 541]
});

export function mapLabelToMetres(sectionId) {
  const px = MAP_LABEL_PX[String(sectionId)];
  if (!px) return null;
  const c = MAP_CALIBRATION;
  return { x: (px[0] - c.cx) / c.pxPerM, z: (c.cy - px[1]) / c.pxPerM };
}

export function resolveSectionCenter(sectionId) {
  const id = String(sectionId);
  const b = SECTION_OVERRIDES[id] && SECTION_OVERRIDES[id].boundary
    ? SECTION_OVERRIDES[id].boundary.angularBoundsDeg : null;
  const dataDeg = b ? (b.startDeg + b.endDeg) / 2 : null;
  const m = mapLabelToMetres(id);
  if (!m) return dataDeg === null ? null : { deg: dataDeg, source: 'data', dataDeg };
  return { deg: (Math.atan2(m.z, m.x) * 180) / Math.PI, xM: m.x, zM: m.z, source: 'map', dataDeg };
}