/**
 * sectionGeometry.js — PURE helper (no THREE, no DOM).
 * Turns a merged section geometry (arenaGeometryData.getSectionGeometry(id)) into a row/seat
 * grid in section-local metres. All counting rules come from arenaGeometryData.js so there is
 * a single source of truth:  getRowSeatCount (taper), getCutoutLocalInterval (cutouts),
 * getSeatNumber (numbering).
 *
 * Local frame (facing the ice): u = lateral, +u = viewer's RIGHT; depth = away from the ice.
 * Row 1 is nearest the ice. localIndex 0 is leftmost; seatNumber 1 is the viewer's rightmost
 * physical slot. Cutouts REMOVE seats but never compress the survivors, so a cutout stays an
 * open aisle gap at the physical pitch.
 */
import {
  VENUE_META,
  getRowSeatCount,
  getSeatNumber,
  getCutoutLocalInterval
} from './arenaGeometryData.js';

export function buildSectionGrid(geom, meta = VENUE_META.coordinates) {
  const rowSpacing = meta.rowSpacingMeters;
  const pitch = meta.seatPitchMeters;
  const omitted = new Set(geom.omittedFrontRows || []);
  const walkAfter = new Set(geom.walkwaysAfterRows || []);
  const walkW = geom.walkwayWidthMeters || 0;

  const rows = [];
  const walkwayRows = [];
  let walkwaysPassed = 0;

  for (let r = 1; r <= geom.rows; r++) {
    // Depth keeps omitted rows' physical space, so the first built row is not pulled to the ice.
    const depth = (r - 1) * rowSpacing + walkwaysPassed * walkW;
    if (walkAfter.has(r)) { walkwaysPassed++; walkwayRows.push(r); }
    if (omitted.has(r)) continue;

    const count = getRowSeatCount(geom, r);
    const removed = new Set();
    for (const c of geom.cutouts || []) {
      if (r < c.startRow || r > c.endRow) continue;
      const { startIdx, endIdx } = getCutoutLocalInterval(c, count);
      for (let i = startIdx; i < endIdx; i++) removed.add(i);
    }

    const seats = [];
    let occupiedFromRight = 0;
    for (let i = count - 1; i >= 0; i--) {          // right -> left so survivors count from the right
      const gone = removed.has(i);
      seats[i] = {
        localIndex: i,
        seatNumber: getSeatNumber(i, count, {
          occupiedIndexFromRight: gone ? 0 : occupiedFromRight,
          occupiedSeatCount: count - removed.size
        }),
        u: (i + 0.5 - count / 2) * pitch,
        removed: gone
      };
      if (!gone) occupiedFromRight++;
    }
    rows.push({
      rowNumber: r, physicalCount: count, removedCount: removed.size, depth,
      walkwayOffset: walkwaysPassed - (walkAfter.has(r) ? 1 : 0) > 0 ? (walkwaysPassed - (walkAfter.has(r) ? 1 : 0)) * walkW : 0,
      seats
    });
  }

  return {
    sectionId: geom.sectionId,
    rows,
    walkwayRows,
    walkwayWidthMeters: walkW,
    seatsBuilt: rows.reduce((n, row) => n + row.physicalCount - row.removedCount, 0),
    seatsRemoved: rows.reduce((n, row) => n + row.removedCount, 0)
  };
}