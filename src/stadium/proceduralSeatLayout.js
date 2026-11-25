/**
 * proceduralSeatLayout.js — the arena's own seat generator.
 * Now perfectly aligned with the real Ticketmaster map:
 * - Level 100 starts at the SE corner (bottom right) and goes clockwise.
 * - Level 200 & 300 start at the NE corner (top right) and go clockwise.
 */

import { ARENA, SEATING } from '../config/stadiumConfig.js';
import {
  getTierLayouts,
  getRowOval,
  clampOvalRadius,
  getStadiumOvalPerimeter,
  getStadiumOvalPointAt
} from './arenaHelpers.js';
import { seatKey } from './seatLayout.js';
import { SECTION_PROFILE_MAP } from './arenaGeometryData.js';
import { buildSectionPlacements } from './sectionPlacement.js';


export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getRowSectionFrame(layout, cfg, r) {
  const o = getRowOval(layout, r);
  const radius = clampOvalRadius(o.halfL, o.halfW, o.radius);
  const perimeter = getStadiumOvalPerimeter(o.halfL, o.halfW, radius);
  const sectionLen = perimeter / cfg.sectionCount;

  const sL = 2 * (o.halfL - radius);
  const sW = 2 * (o.halfW - radius);
  const arc = Math.PI * radius / 2;
  
  let anchor, direction;
  
  // 100 Level: Starts at SE (bottom right), goes clockwise (right to left on the bottom).
  // 200 & 300 Level: Starts at NE (top right), goes clockwise (right to left on the top).
  if (layout.key === 'level100') {
    anchor = sL + arc / 2; // SE Corner
    direction = -1; 
  } else {
    anchor = sL + arc + sW + arc / 2; // NE Corner
    direction = 1;
  }

  return { o, radius, perimeter, sectionLen, anchor, direction };
}

export function buildProceduralLayout(overrides) {
  const placements = [];
  const perTier = { lower: 0, club: 0, upper: 0 };
  const ov = overrides || {};

  for (const layout of getTierLayouts()) {
    const cfg = Object.assign({}, layout.cfg, ov[layout.key] || {});
    
    for (let r = 0; r < cfg.rows; r++) {
      const frame = getRowSectionFrame(layout, cfg, r);
      const usable = frame.sectionLen - SEATING.aisleWidth;
      const perSection = Math.floor(usable / SEATING.seatWidth);
      if (perSection < 1) continue;
      const slack = usable - perSection * SEATING.seatWidth;
      const y = layout.baseY + (r + 1) * cfg.riserHeight;

      for (let sec = 0; sec < cfg.sectionCount; sec++) {
        const s_center = frame.anchor + (sec * frame.direction) * frame.sectionLen;
        const s_edge = s_center - frame.direction * (frame.sectionLen / 2);
        const s_usable_start = s_edge + frame.direction * (SEATING.aisleWidth / 2 + slack / 2);
        
        for (let k = 0; k < perSection; k++) {
          const s = s_usable_start + frame.direction * (k + 0.5) * SEATING.seatWidth;
          
          const pt = getStadiumOvalPointAt(s, frame.o.halfL, frame.o.halfW, frame.radius);
          const absZ = Math.abs(pt.z);
          const zone = absZ < 5 ? 'centre' : absZ < 11 ? 'corner' : 'endzone';
          const tierPrefix = layout.key.replace('level', '');
          const zonePrice = ARENA.pricing['level' + tierPrefix][zone];
          const section = String(cfg.sectionsFrom + sec);
          const row = r + 1;
          const seat = k + 1;
          
          placements.push({
            key: seatKey(section, row, seat),
            x: pt.x, y, z: pt.z,
            yaw: Math.atan2(pt.nx, pt.nz), 
            section,
            row,
            seat,
            rowFactor: 1 - (r / cfg.rows) * 0.35,
            zonePrice,
            side: pt.kind,
            tier: layout.tier,
            order: placements.length
          });
          perTier[layout.tier]++;
        }
      }
    }
  }

  return { placements, perTier };
}

/** Builds production placements from the validated per-section geometry specification. */
export function buildArenaSeatLayout() {
  const placements = [];
  const perTier = { lower: 0, club: 0, upper: 0 };
  const reports = [];
  const layouts = getTierLayouts();
  const sectionIds = Object.keys(SECTION_PROFILE_MAP).sort((a, b) => Number(a) - Number(b));

  for (const sectionId of sectionIds) {
    const result = buildSectionPlacements(sectionId, { layouts, startOrder: placements.length });
    if (!result) continue;
    placements.push(...result.placements);
    reports.push(result.report);
    const tierKey = { 100: 'lower', 200: 'club', 300: 'upper' }[result.report.tier];
    perTier[tierKey] += result.placements.length;
  }

  separateSectionSeatRows(placements, layouts);
  for (const placement of placements) {
    delete placement.layoutArc;
    delete placement.layoutWalkwayOffset;
  }

  return { placements, perTier, reports };
}

function separateSectionSeatRows(placements, layouts) {
  const MIN_SECTION_EDGE_GAP = 0.68;
  const layoutByTier = new Map(layouts.map((layout) => [layout.tier, layout]));
  const rows = new Map();
  for (const placement of placements) {
    const key = `${placement.tier}:${placement.row}`;
    const entries = rows.get(key) || [];
    entries.push(placement);
    rows.set(key, entries);
  }

  for (const entries of rows.values()) {
    const layout = layoutByTier.get(entries[0].tier);
    if (!layout || entries.length < 2) continue;
    const rowOval = getRowOval(layout, entries[0].row - 1);
    const perimeter = getStadiumOvalPerimeter(rowOval.halfL, rowOval.halfW, rowOval.radius);
    for (let pass = 0; pass < 24; pass++) {
      const sections = new Map();
      for (const placement of entries) {
        const seats = sections.get(placement.section) || [];
        seats.push(placement);
        sections.set(placement.section, seats);
      }
      const intervals = [...sections].map(([section, seats]) => {
        const sin = seats.reduce((sum, seat) => sum + Math.sin(seat.layoutArc / perimeter * Math.PI * 2), 0);
        const cos = seats.reduce((sum, seat) => sum + Math.cos(seat.layoutArc / perimeter * Math.PI * 2), 0);
        const center = ((Math.atan2(sin, cos) / (Math.PI * 2) * perimeter) % perimeter + perimeter) % perimeter;
        const relative = seats.map((seat) => {
          let delta = seat.layoutArc - center;
          if (delta > perimeter / 2) delta -= perimeter;
          if (delta < -perimeter / 2) delta += perimeter;
          return delta;
        });
        return { section, seats, center, min: Math.min(...relative), max: Math.max(...relative) };
      }).sort((a, b) => a.center - b.center);

      const shifts = new Map();
      let adjusted = false;
      for (let index = 0; index < intervals.length; index++) {
        const first = intervals[index];
        const second = intervals[(index + 1) % intervals.length];
        const centerGap = (second.center - first.center + perimeter) % perimeter;
        const gap = centerGap - first.max + second.min;
        if (gap >= MIN_SECTION_EDGE_GAP) continue;
        const shift = (MIN_SECTION_EDGE_GAP - gap) / 2;
        shifts.set(first.section, (shifts.get(first.section) || 0) - shift);
        shifts.set(second.section, (shifts.get(second.section) || 0) + shift);
        adjusted = true;
      }
      if (!adjusted) break;
      for (const placement of entries) {
        const shift = shifts.get(placement.section) || 0;
        placement.layoutArc = ((placement.layoutArc + shift) % perimeter + perimeter) % perimeter;
      }
    }

    for (const placement of entries) {
      const point = getStadiumOvalPointAt(placement.layoutArc, rowOval.halfL, rowOval.halfW, rowOval.radius);
      placement.x = point.x + point.nx * placement.layoutWalkwayOffset;
      placement.z = point.z + point.nz * placement.layoutWalkwayOffset;
      placement.yaw = Math.atan2(point.nx, point.nz);
    }
  }
}

export function estimatePrice(placement) {
  const base = Number.isFinite(placement.zonePrice) ? placement.zonePrice : 0;
  const factor = Number.isFinite(placement.rowFactor) ? placement.rowFactor : 1;
  return Math.round(base * factor);
}

export function createLegacyDecor() {
  return function decor(placement) {
    return {
      originalColor: SEATING.colors.default,
      price: estimatePrice(placement),
      estimatedPrice: true
    };
  };
}

export function createHashDecor() {
  return function decor(placement) {
    return {
      originalColor: SEATING.colors.default,
      price: estimatePrice(placement),
      estimatedPrice: true
    };
  };
}
