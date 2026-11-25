/**
 * Princess Auto Stadium — shared architectural parameters.
 * Documented values are separated from estimated modelling assumptions.
 */
export const ARENA_FACTS = {
  arenaName: 'Canada Life Centre',
  city: 'Winnipeg, Manitoba',
  homeTeam: 'Winnipeg Jets',
  opened: 2004,
  capacity: 15294, // NHL Media Guide 2024–25 (configuration-dependent)
  levels: [100, 200, 300]
};

// Backward-compatible alias. The legacy stadium-roof fields (ROOF.trussSpan, trussApexY, ...)
// still read roofTrussSpan / maxStructuralHeight from here, so they are kept alongside.
export const DOCUMENTED = {
  ...ARENA_FACTS,
  roofTrussSpan: 188,
  maxStructuralHeight: 61,
  roofCoverageAcres: 8
};

export const FIELD = {
  playingLength: 100.584,
  width: 59.436,
  endZoneDepth: 18.288,
  totalLength: 137.16,
  totalWidth: 59.436,
  hashSpacing: 0.9144,
  goalPostWidth: 5.64,
  goalPostHeight: 3.05,
  goalPostDepth: 1.0
};

export const BOWL = {
  fieldElevation: -8,
  lowerBowl: {
    frontDistanceFromFieldEdge: 18,
    rows: 24,
    rowDepth: 0.85,
    riserHeight: 0.42
  },
  upperBowl: {
    setbackFromLowerBowl: 4,
    rows: 20,
    rowDepth: 0.85,
    riserHeight: 0.45
  },
  concourse: { mainConcourseElevation: -2, upperConcourseElevation: 8, width: 6, padding: 6 }
};

export const SEATING = {
  seatWidth: 0.52,
  seatDepth: 0.50,
  seatHeight: 0.45,
  aisleWidth: 1.2,
  sections: {
    sideline: 6,  // Number of sections per sideline (applies to both lower and upper bowls)
    endzone: 3    // Number of sections per end zone (lower bowl only)
  },
  colors: {
    default: 0x1b2c3c, // Polar Night inspired muted seat colour
    hover: 0xffffff,
    selected: 0xac162c,
    sectionHover: 0x004c97,
    sectionSelected: 0x8e9090
  }
};

export const ROOF = {
  trussSpan: DOCUMENTED.roofTrussSpan,
  canopy: {
    rearZ: 92,
    frontOffsetFromFieldEdge: 13,
    edgeLift: 0.35,
    undulationAmplitude: 1.15,
    lengthSegments: 64,
    widthSegments: 20
  },
  truss: {
    depth: 5.2,
    chordRadius: 0.34,
    webRadius: 0.16,
    camber: 5.8,
    panels: 24
  },
  columns: {
    count: 9,
    diameter: 1.05,
    baseElevation: 8.5,
    capHeight: 0.7
  }
};

export const EXTERIOR = {
  pylonHeight: 8.5,
  pylon: { topWidth: 3.0, baseWidth: 4.2, depthRatio: 1.35 },
  tieBeam: { height: 1.4, depth: 2.0, elevation: 7.8 }
};

export function getFieldBounds() {
  return {
    minX: -FIELD.totalLength / 2,
    maxX: FIELD.totalLength / 2,
    minZ: -FIELD.totalWidth / 2,
    maxZ: FIELD.totalWidth / 2
  };
}

// Vertical datum: +Y is up, exterior ground is y = 0. The field (BOWL.fieldElevation)
// and main concourse (BOWL.concourse.mainConcourseElevation) are measured from it.
export const GROUND = {
  exteriorElevation: 0,
  retainingWall: { thickness: 0.8, copingHeight: 0.15 }
};

// All roof functions are shared by canopy skins, trusses and support layout.
export function trussApexY(x) {
  const u = x / (ROOF.trussSpan / 2);
  return DOCUMENTED.maxStructuralHeight - 2 - ROOF.truss.depth +
    ROOF.truss.camber * (1 - u * u);
}
export function trussBottomY(x) { return trussApexY(x) - ROOF.truss.depth; }
export function rearBeamY(x) {
  const u = x / (ROOF.trussSpan / 2);
  return 29 + 2.0 * (1 - u * u);
}
export function canopyFrontZ() {
  return FIELD.totalWidth / 2 + ROOF.canopy.frontOffsetFromFieldEdge;
}
export function trussNodeX(i) {
  return -ROOF.trussSpan / 2 + i * ROOF.trussSpan / ROOF.truss.panels;
}
export function getRoofColumnLayout() {
  const half = ROOF.trussSpan / 2;
  const z = ROOF.canopy.rearZ;
  return Array.from({length: ROOF.columns.count}, (_, i) => ({
    x: -half + i * (ROOF.trussSpan / (ROOF.columns.count - 1)),
    z,
    side: 1
  })).flatMap(c => [
    {...c, z: c.z, side: 1},
    {...c, z: -c.z, side: -1}
  ]);
}

// ---------------------------------------------------------------------------
// Hockey rink (Stage 1). Metres; X = length, Z = width, Y up.
// ---------------------------------------------------------------------------
export const RINK = Object.freeze({
  LENGTH: 60.96,
  WIDTH: 25.9,
  CORNER_RADIUS: 8.5,
  GOAL_LINE_FROM_END: 3.35,
  BLUE_LINE_FROM_GOAL_LINE: 22.86,
  FACEOFF_CIRCLE_RADIUS: 4.57,
  FACEOFF_DOT_Z: 6.7,
  END_FACEOFF_FROM_GOAL_LINE: 6.1,
  CREASE_RADIUS: 1.83,
  LINE_WIDTH: 0.305,
  GOAL_LINE_WIDTH: 0.05,
  HASH_LENGTH: 0.6,
  DOT_RADIUS: 0.3,
  BOARD_HEIGHT: 1.07,
  BOARD_THICKNESS: 0.15,
  GLASS_HEIGHT: 1.8,
  GLASS_THICKNESS: 0.05,
  GOAL: { WIDTH: 1.83, HEIGHT: 1.22, DEPTH: 1.12, POST_RADIUS: 0.03 },
  BENCH: { LENGTH: 10, WIDTH: 2.0, HEIGHT: 0.9, Z_OFFSET: 1.4, SEPARATION: 1.5 },
  COLORS: {
    ICE: '#e6f0f5',
    ICE_EDGE: '#cfdee8',
    RED: '#c8102e',
    BLUE: '#0033a0',
    CREASE_FILL: 'rgba(120,170,220,0.55)',
    CREASE_LINE: '#c8102e',
    BOARDS: '#f2f2f2',
    BOARD_TOP: '#c0c8cd',
    GLASS: '#88ccff',
    LOGO_TEXT: '#1b3a5c'
  },
  TEXTURE: { WIDTH: 4096, HEIGHT: 1740 }
});

export function getRinkLines() {
  const half = RINK.LENGTH / 2;
  const goalLineX = half - RINK.GOAL_LINE_FROM_END;
  return {
    goalLineX,
    blueLineX: goalLineX - RINK.BLUE_LINE_FROM_GOAL_LINE,
    zoneFaceoffX: goalLineX - RINK.END_FACEOFF_FROM_GOAL_LINE
  };
}

// ---------------------------------------------------------------------------
// Canada Life Centre arena (Stage 2). PRELIMINARY numbers — the designer
// finalises them; only change VALUES here, never the code structure.
// Elevations named `startElevation` / `concourse*.elevation` are measured UP
// FROM BOWL.fieldElevation (ice). roof / jumbotron Y values are WORLD Y.
//
// frontSetback semantics (horizontal distance, metres):
//   level100: from the EDGE OF THE ICE (boards line)
//   level200: from the BACK edge of level100  (= gap between the tiers)
//   level300: from the BACK edge of level200  (= gap between the tiers)
// ---------------------------------------------------------------------------
export const ARENA = Object.freeze({
  bowl: {
    shape: 'stadiumOval',
    halfLength: 72.0,      // preliminary
    halfWidth:  54.0,
    baseCornerRadius: 18.0 // radius for the FIRST row; grows with every row
  },
  concourse1: { elevation:  6.88, width: 3.5 },   // top_100 + 0.4; width matches next tier's frontSetback to close the visible gap
  concourse2: { elevation: 13.14, width: 4.5 },   // top_200 + 0.4; width matches next tier's frontSetback to close the visible gap
  level100: {
    sectionsFrom: 101, sectionsTo: 130, sectionCount: 30,
    rows: 16,
    startElevation: 1.2,       // world Y = -8 + 1.2 = -6.8
    frontSetback: 2.5,         // FROM THE ICE EDGE (along the normal)
    rowDepth: 0.85,
    riserHeight: 0.33,
    rakeAngleDeg: 26
  },
  level200: {
    sectionsFrom: 202, sectionsTo: 228, sectionCount: 27,
    rows: 7,
    startElevation: 10.5,      // world Y = 2.5
    frontSetback: 3.5,         // FROM THE BACK of level100 (gap between tiers)
    rowDepth: 1.05,
    riserHeight: 0.32,
    rakeAngleDeg: 20
  },
  level300: {
    sectionsFrom: 301, sectionsTo: 330, sectionCount: 30,
    rows: 12,
    startElevation: 16.7,      // world Y = 8.7
    frontSetback: 4.5,         // FROM THE BACK of level200 (gap between tiers)
    rowDepth: 0.82,
    riserHeight: 0.38,
    rakeAngleDeg: 34
  },
  // Estimated prices (CAD). Final price is shown on Ticketmaster.
  // centre = |z| < 5 m, corner = |z| 5..11 m, endzone = |z| > 11 m.
  pricing: {
    level100: { centre: 190, corner: 120, endzone: 110 },
    level200: { centre: 95,  corner: 95,  endzone: 85 },
    level300: { centre: 45,  corner: 38,  endzone: 30 }
  },
  suites: { count: 52, elevation: 14.5, ringRadius: 48.0, depth: 2.5 },
  roof: {
    shape: 'flatSpaceFrame',
    elevation: 38.0,           // world Y
    halfLength: 76.0,
    halfWidth:  58.0,
    cornerRadius: 22.0
  },
  jumbotron: {
    position: { x: 0, y: 10.5, z: 0 },  // world Y of the CENTRE; bottom edge = 16 m above the ice
    size: { width: 8.0, depth: 8.0, height: 5.0 }
  }
});
