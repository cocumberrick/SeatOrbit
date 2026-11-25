/**
 * sectionPlacement.js — turns one data-driven section grid into 3D seat placements
 * (same shape as the legacy generator: key, x, y, z, yaw, section, row, seat, rowFactor,
 *  zonePrice, side, tier, order).
 *
 * Frame: oval walk order is counter-clockwise seen with +X right, +Z up, so +u (viewer's right
 * when facing the ice) == +arc length. Rows ride the bowl's own row ovals (getRowOval), so seats
 * stay on the concrete that createBowl builds; walkways push later rows outward along the normal.
 */
import { ARENA } from '../config/stadiumConfig.js';
import { getSectionGeometry, VENUE_META } from './arenaGeometryData.js';
import { buildSectionGrid } from './sectionGeometry.js';
import { resolveSectionCenter } from './sectionCenters.js';
import { seatKey } from './seatLayout.js';
import {
  clampOvalRadius, getStadiumOvalPerimeter, getStadiumOvalPointAt, getRowOval
} from './arenaHelpers.js';

const TWO_PI = Math.PI * 2;
const norm2pi = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;
const normArc = (s, perimeter) => ((s % perimeter) + perimeter) % perimeter;

/** Arc length s on an oval at which the ray from the origin at thetaDeg leaves it. */
export function ovalArcAtAngle(thetaDeg, o) {
  const R = clampOvalRadius(o.halfL, o.halfW, o.radius);
  const P = getStadiumOvalPerimeter(o.halfL, o.halfW, R);
  const p0 = getStadiumOvalPointAt(0, o.halfL, o.halfW, R);
  const a0 = Math.atan2(p0.z, p0.x);
  const target = norm2pi((thetaDeg * Math.PI) / 180 - a0);
  let lo = 0, hi = P;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const p = getStadiumOvalPointAt(mid, o.halfL, o.halfW, R);
    if (norm2pi(Math.atan2(p.z, p.x) - a0) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Arc length on the STRAIGHT part of oval o that holds world point (x, z): sidelines lock x, end
 * sections lock z. Walk order: bottom, SE arc, east end, NE arc, top, NW arc, west end, SW arc.
 */
function straightArcAt(seg, x, z, o) {
  const R = clampOvalRadius(o.halfL, o.halfW, o.radius);
  const sL = 2 * (o.halfL - R), sW = 2 * (o.halfW - R), arc = Math.PI * R / 2;
  const cxp = o.halfL - R, czp = o.halfW - R;
  const cx = Math.max(-cxp, Math.min(cxp, x)), cz = Math.max(-czp, Math.min(czp, z));
  switch (seg) {
    case 'bottom': return cx + cxp;
    case 'east':   return sL + arc + (cz + czp);
    case 'top':    return sL + 2 * arc + sW + (cxp - cx);
    default:       return 2 * sL + 3 * arc + sW + (czp - cz);   // west
  }
}

function zonePrice(tierNumber, absZ) {
  const zone = absZ < 5 ? 'centre' : absZ < 11 ? 'corner' : 'endzone';
  return ARENA.pricing['level' + tierNumber][zone];
}

export function buildSectionPlacements(sectionId, ctx) {
  const geom = getSectionGeometry(sectionId);
  const centre = resolveSectionCenter(sectionId);
  if (!centre) return null;

  const tierIndex = { 100: 0, 200: 1, 300: 2 }[geom.tier];
  const layout = ctx.layouts[tierIndex];
  const grid = buildSectionGrid(geom, VENUE_META.coordinates);
  const rectangular = geom.layout === 'rectangular';
  const placements = [];
  let rectSeg = null;

  for (const row of grid.rows) {
    const r0 = row.rowNumber - 1;
    const o = getRowOval(layout, r0);
    const R = clampOvalRadius(o.halfL, o.halfW, o.radius);
    const perimeter = getStadiumOvalPerimeter(o.halfL, o.halfW, R);

    let sCentre;
    if (rectangular && centre.xM !== undefined) {
      if (rectSeg === null) {                    // pick the straight side once, from the first built row
        const p0 = getStadiumOvalPointAt(ovalArcAtAngle(centre.deg, o), o.halfL, o.halfW, R);
        rectSeg = Math.abs(p0.nz) > 0.5 ? (p0.nz > 0 ? 'top' : 'bottom') : (p0.nx > 0 ? 'east' : 'west');
      }
      sCentre = straightArcAt(rectSeg, centre.xM, centre.zM, o);   // parallel sides, fixed lateral position
    } else {
      sCentre = ovalArcAtAngle(centre.deg, o);
    }

    for (const seat of row.seats) {
      if (seat.removed) continue;
      const pt = getStadiumOvalPointAt(sCentre + seat.u, o.halfL, o.halfW, R);
      const x = pt.x + pt.nx * row.walkwayOffset;
      const z = pt.z + pt.nz * row.walkwayOffset;
      placements.push({
        key: seatKey(String(sectionId), row.rowNumber, seat.seatNumber),
        x, y: layout.baseY + row.rowNumber * layout.cfg.riserHeight, z,
        yaw: Math.atan2(pt.nx, pt.nz),
        section: String(sectionId),
        row: row.rowNumber,
        seat: seat.seatNumber,
        rowFactor: 1 - (r0 / geom.rows) * 0.35,
        zonePrice: zonePrice(geom.tier, Math.abs(z)),
        side: pt.kind,
        tier: layout.tier,
        order: ctx.startOrder + placements.length,
        layoutArc: normArc(sCentre + seat.u, perimeter),
        layoutWalkwayOffset: row.walkwayOffset
      });
    }
  }

  // How far the section runs past the bowl's concrete (createBowl only builds cfg.rows rows).
  const rowsBeyond = Math.max(0, geom.rows - layout.cfg.rows);
  const walkTotal = grid.walkwayRows.length * grid.walkwayWidthMeters;
  return {
    placements,
    report: {
      sectionId: String(sectionId), tier: geom.tier, centreDeg: centre.deg, centreSource: centre.source,
      dataCentreDeg: centre.dataDeg, seats: placements.length,
      rowsBeyondBowl: rowsBeyond, overrunMeters: rowsBeyond * layout.pitch + walkTotal
    }
  };
}
