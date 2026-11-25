import * as THREE from 'three';
import { ARENA, BOWL, RINK } from '../config/stadiumConfig.js';
import { SECTION_PROFILE_MAP, getSectionGeometry, VENUE_META } from './arenaGeometryData.js';

const EPS = 0.002;

/** Radius that is geometrically valid for a half-extent pair (never larger than either half side). */
export function clampOvalRadius(halfL, halfW, radius) {
  return Math.max(EPS, Math.min(radius, halfL - EPS, halfW - EPS));
}

/**
 * Rounded rectangle ("stadium oval"), works for THREE.Shape and THREE.Path.
 * halfL = half extent along X, halfW = half extent along Y (shape space).
 * The radius is clamped so the outline can never self-intersect.
 */
export function traceStadiumOval(p, halfL, halfW, radius) {
  const R = clampOvalRadius(halfL, halfW, radius);
  p.moveTo(-halfL + R, -halfW);
  p.lineTo(halfL - R, -halfW);
  p.absarc(halfL - R, -halfW + R, R, -Math.PI / 2, 0, false);
  p.lineTo(halfL, halfW - R);
  p.absarc(halfL - R, halfW - R, R, 0, Math.PI / 2, false);
  p.lineTo(-halfL + R, halfW);
  p.absarc(-halfL + R, halfW - R, R, Math.PI / 2, Math.PI, false);
  p.lineTo(-halfL, -halfW + R);
  p.absarc(-halfL + R, -halfW + R, R, Math.PI, Math.PI * 1.5, false);
  p.closePath();
  return p;
}

export function createStadiumOvalShape(halfL, halfW, radius) {
  return traceStadiumOval(new THREE.Shape(), halfL, halfW, radius);
}

export function createStadiumOvalPath(halfL, halfW, radius) {
  return traceStadiumOval(new THREE.Path(), halfL, halfW, radius);
}

export function getRowCornerRadius(baseRadius, rowIndex, rowDepth, rakeAngleDeg) {
  return baseRadius + rowIndex * rowDepth * Math.cos(rakeAngleDeg * Math.PI / 180);
}

export function getStadiumOvalPerimeter(halfL, halfW, radius) {
  const R = clampOvalRadius(halfL, halfW, radius);
  return 2 * (2 * halfL - 2 * R) + 2 * (2 * halfW - 2 * R) + 2 * Math.PI * R;
}

/**
 * Point on the oval outline at arc length s (any real number, wraps around).
 * Walk order: bottom (z=-W, +x) -> right-bottom arc -> right -> right-top arc -> top
 * -> top-left arc -> left -> bottom-left arc. Coordinates are WORLD (x, z).
 * Returns { x, z, nx, nz (outward unit normal), kind: 'sideline'|'endzone'|'corner' }.
 */
export function getStadiumOvalPointAt(s, halfL, halfW, radius) {
  const R = clampOvalRadius(halfL, halfW, radius);
  const sL = 2 * (halfL - R);
  const sW = 2 * (halfW - R);
  const arc = Math.PI * R / 2;
  const P = 2 * sL + 2 * sW + 4 * arc;
  let t = ((s % P) + P) % P;
  const cxp = halfL - R, czp = halfW - R;
  const segs = [
    { len: sL, f: (u) => ({ x: -cxp + u, z: -halfW, nx: 0, nz: -1, kind: 'sideline' }) },
    { len: arc, f: (u) => arcPt(cxp, -czp, -Math.PI / 2 + u / R) },
    { len: sW, f: (u) => ({ x: halfL, z: -czp + u, nx: 1, nz: 0, kind: 'endzone' }) },
    { len: arc, f: (u) => arcPt(cxp, czp, u / R) },
    { len: sL, f: (u) => ({ x: cxp - u, z: halfW, nx: 0, nz: 1, kind: 'sideline' }) },
    { len: arc, f: (u) => arcPt(-cxp, czp, Math.PI / 2 + u / R) },
    { len: sW, f: (u) => ({ x: -halfL, z: czp - u, nx: -1, nz: 0, kind: 'endzone' }) },
    { len: arc, f: (u) => arcPt(-cxp, -czp, Math.PI + u / R) }
  ];
  function arcPt(cx, cz, a) {
    const c = Math.cos(a), sn = Math.sin(a);
    return { x: cx + R * c, z: cz + R * sn, nx: c, nz: sn, kind: 'corner' };
  }
  for (const seg of segs) {
    if (t <= seg.len) return seg.f(t);
    t -= seg.len;
  }
  return segs[7].f(arc);
}

// ---------------------------------------------------------------------------
// Tier layout shared by bowl, seats and concourse so they always agree.
// ---------------------------------------------------------------------------
const TIER_DEFS = [
  { key: 'level100', tier: 'lower', meshName: 'LowerBowl' },
  { key: 'level200', tier: 'club',  meshName: 'ClubBowl' },
  { key: 'level300', tier: 'upper', meshName: 'UpperBowl' }
];

/**
 * horizontal offsets are measured from the ice edge (boards line).
 * level100.frontSetback is from the ice; level200/300.frontSetback is from the back
 * of the previous tier. Corner radius grows concentrically across ALL tiers.
 */
export function getTierLayouts() {
  const out = [];
  let prevBack = 0;
  let firstFront = 0;
  TIER_DEFS.forEach((def, i) => {
    const tierNumber = [100, 200, 300][i];
    const profiles = Object.keys(SECTION_PROFILE_MAP)
      .map((sectionId) => getSectionGeometry(sectionId))
      .filter((profile) => profile.tier === tierNumber);
    const maxRows = Math.max(...profiles.map((profile) => profile.rows));
    const rowSpacing = VENUE_META.coordinates.rowSpacingMeters;
    const maxWalkwayDepth = Math.max(0, ...profiles.map((profile) =>
      (profile.walkwaysAfterRows || []).length * (profile.walkwayWidthMeters || 0)
    ));
    const cfg = { ...ARENA[def.key], rows: maxRows, rowDepth: rowSpacing };
    const pitch = rowSpacing;
    const frontOffset = i === 0 ? cfg.frontSetback : prevBack + cfg.frontSetback;
    if (i === 0) firstFront = frontOffset;
    const backOffset = frontOffset + (cfg.rows - 1) * pitch + cfg.rowDepth + maxWalkwayDepth;
    prevBack = backOffset;
    out.push({
      ...def,
      cfg,
      pitch,
      frontOffset,
      backOffset,
      walkwayDepth: maxWalkwayDepth,
      radiusBase: ARENA.bowl.baseCornerRadius + (frontOffset - firstFront),
      baseY: BOWL.fieldElevation + cfg.startElevation
    });
  });
  return out;
}

/** Centre-line oval of row r (inner edge = -rowDepth/2, outer edge = +rowDepth/2). */
export function getRowOval(layout, r) {
  const { cfg, pitch, frontOffset } = layout;
  const offset = frontOffset + r * pitch;
  // A corner tighter than the ice corner offset outwards would cut through the boards,
  // so the radius is capped at the concentric value (rink corner radius + offset).
  const concentric = RINK.CORNER_RADIUS + offset + cfg.rowDepth / 2;
  return {
    halfL: RINK.LENGTH / 2 + offset + cfg.rowDepth / 2,
    halfW: RINK.WIDTH / 2 + offset + cfg.rowDepth / 2,
    radius: Math.min(
      layout.radiusBase + r * layout.pitch,
      concentric
    )
  };
}

/** Oval of the outer (back) edge of the last row of a tier. */
export function getTierBackOval(layout) {
  const o = getRowOval(layout, layout.cfg.rows - 1);
  const h = layout.cfg.rowDepth / 2;
  const walkwayDepth = layout.walkwayDepth || 0;
  return {
    halfL: o.halfL + h + walkwayDepth,
    halfW: o.halfW + h + walkwayDepth,
    radius: o.radius + h + walkwayDepth
  };
}
// ---------------------------------------------------------------------------
// Plan-view footprint of the arena (Stage 2.5). Single source of truth for the pit
// apron, the retaining wall and the opening cut into the exterior ground.
// All ovals are { halfL (X), halfW (Z), radius } in metres.
// ---------------------------------------------------------------------------
export function getArenaFootprint() {
  const layouts = getTierLayouts();
  const l100 = layouts[0];
  const l300 = layouts[2];
  const facadeFlare = 2.0;
  const ice = {
    halfL: RINK.LENGTH / 2,
    halfW: RINK.WIDTH / 2,
    radius: RINK.CORNER_RADIUS
  };
  const apron = {
    halfL: RINK.LENGTH / 2 + l100.frontOffset,
    halfW: RINK.WIDTH / 2 + l100.frontOffset,
    radius: RINK.CORNER_RADIUS + l100.frontOffset
  };
  const bowlBack = getTierBackOval(l300);
  const facadeBase = {
    halfL: bowlBack.halfL + facadeFlare,
    halfW: bowlBack.halfW + facadeFlare,
    radius: bowlBack.radius + facadeFlare
  };
  const groundOpening = facadeBase;
  return { ice, apron, bowlBack, facadeBase, groundOpening };
}
