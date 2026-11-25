// src/stadium/arenaGeometryData.js
// Validated seating geometry specification for Canada Life Centre (Winnipeg, MB).

export const VENUE_META = {
  venueName: "Canada Life Centre",
  city: "Winnipeg, MB",
  sport: "NHL Hockey",
  expectedCounts: {
    tier100: 21,
    tier200: 23,
    tier300: 30,
    mappedSuites: 49, // S1-S47 (47) + S54-S55 (2)
    maxSuiteNumber: 55,
    loge: 30,
  },
  coordinates: {
    iceCenter: { x: 0, y: 0 },
    row1FromIce: true,
    rowIncreaseDirection: "outward-from-ice",
    localSeatOrder: "left-to-right-facing-ice",
    seatNumberDirection: "clockwise-from-viewer-right",
    seatNumberingMode: "physical-grid", // "physical-grid" | "consecutive-occupied"
    rowSpacingMeters: 0.86,
    seatPitchMeters: 0.54,
    baseTierRadiusMeters: {
      100: 18.5,
      200: 27.5,
      300: 34.5,
    },
  },
};

export const SECTION_PROFILES = {
  // 100 LEVEL — LOWER BOWL
  sideline100BenchPenalty: {
    tier: 100,
    zone: "sideline-center",
    rows: 15,
    row1SeatCount: 18,
    layout: "rectangular",
    taper: { mode: "none", deltaPerRow: 0, rounding: "round" },
    omittedFrontRows: [1, 2],
    walkwaysAfterRows: [],
    walkwayWidthMeters: 0,
    cutouts: [
      {
        id: "vomitory-left-upper",
        type: "side-vomitory",
        side: "left",
        startRow: 11,
        endRow: 15,
        seatSpan: 4,
      },
    ],
    boundary: {
      shape: "quad",
      facetAngleDeg: 0,
      angularBoundsDeg: { startDeg: -15, endDeg: 15 },
    },
    backWallFeature: null,
  },

  sideline100BlueLine: {
    tier: 100,
    zone: "sideline-flank",
    rows: 17,
    row1SeatCount: 20,
    layout: "rectangular",
    taper: { mode: "linear", deltaPerRow: 0.15, rounding: "round" },
    omittedFrontRows: [],
    walkwaysAfterRows: [],
    walkwayWidthMeters: 0,
    cutouts: [
      {
        id: "vomitory-left-upper",
        type: "side-vomitory",
        side: "left",
        startRow: 13,
        endRow: 17,
        seatSpan: 4,
      },
    ],
    boundary: {
      shape: "quad",
      facetAngleDeg: 0,
      angularBoundsDeg: { startDeg: 15, endDeg: 35 },
    },
    backWallFeature: null,
  },

  corner100: {
    tier: 100,
    zone: "corner",
    rows: 18,
    row1SeatCount: 12,
    layout: "radial",
    taper: { mode: "linear", deltaPerRow: 0.65, rounding: "round" },
    omittedFrontRows: [],
    walkwaysAfterRows: [],
    walkwayWidthMeters: 0,
    cutouts: [
      {
        id: "vomitory-left-upper",
        type: "side-vomitory",
        side: "left",
        startRow: 14,
        endRow: 18,
        seatSpan: 3,
      },
    ],
    boundary: {
      shape: "radial-sector",
      facetAngleDeg: 18,
      angularBoundsDeg: { startDeg: 35, endDeg: 53 },
    },
    backWallFeature: null,
  },

  end100Bowl: {
    tier: 100,
    zone: "end",
    rows: 17,
    row1SeatCount: 14,
    layout: "radial",
    taper: { mode: "linear", deltaPerRow: 0.45, rounding: "round" },
    omittedFrontRows: [],
    walkwaysAfterRows: [],
    walkwayWidthMeters: 0,
    cutouts: [
      {
        id: "vomitory-left-upper",
        type: "side-vomitory",
        side: "left",
        startRow: 13,
        endRow: 17,
        seatSpan: 3,
      },
    ],
    boundary: {
      shape: "radial-sector",
      facetAngleDeg: 15,
      angularBoundsDeg: { startDeg: 165, endDeg: 180 },
    },
    backWallFeature: null,
  },

  end100ClubLounge: {
    tier: 100,
    zone: "club-end",
    rows: 13,
    row1SeatCount: 15,
    layout: "rectangular",
    taper: { mode: "none", deltaPerRow: 0, rounding: "round" },
    omittedFrontRows: [],
    walkwaysAfterRows: [],
    walkwayWidthMeters: 0,
    cutouts: [],
    boundary: {
      shape: "quad",
      facetAngleDeg: 0,
      angularBoundsDeg: { startDeg: -12, endDeg: 12 },
    },
    backWallFeature: {
      id: "PREMIUM_SUITE_LOUNGE",
      type: "lounge-wall",
      depthMeters: 4.5,
      spansSections: ["125", "126"],
    },
  },

  wedge100: {
    tier: 100,
    zone: "tunnel-wedge",
    rows: 12,
    row1SeatCount: 6,
    layout: "wedge",
    taper: { mode: "linear", deltaPerRow: 0.15, rounding: "round" },
    omittedFrontRows: [],
    walkwaysAfterRows: [],
    walkwayWidthMeters: 0,
    cutouts: [],
    boundary: {
      shape: "wedge",
      facetAngleDeg: 11,
      angularBoundsDeg: { startDeg: 154, endDeg: 165 },
    },
    backWallFeature: null,
  },

  // 200 LEVEL — MIDDLE BOWL
  standard200Sideline: {
    tier: 200,
    zone: "sideline",
    rows: 7,
    lowerRows: 3,
    upperRows: 4,
    row1SeatCount: 18,
    layout: "split-tier",
    taper: { mode: "none", deltaPerRow: 0, rounding: "round" },
    omittedFrontRows: [],
    walkwaysAfterRows: [3],
    walkwayWidthMeters: 1.5,
    cutouts: [
      {
        id: "vomitory-left-lower",
        type: "side-vomitory",
        side: "left",
        startRow: 1,
        endRow: 3,
        seatSpan: 4,
      },
    ],
    boundary: {
      shape: "quad",
      facetAngleDeg: 0,
      angularBoundsDeg: { startDeg: -15, endDeg: 15 },
    },
    backWallFeature: null,
  },

  standard200Curve: {
    tier: 200,
    zone: "corner-end",
    rows: 7,
    lowerRows: 3,
    upperRows: 4,
    row1SeatCount: 14,
    layout: "split-tier-radial",
    taper: { mode: "linear", deltaPerRow: 0.55, rounding: "round" },
    omittedFrontRows: [],
    walkwaysAfterRows: [3],
    walkwayWidthMeters: 1.5,
    cutouts: [
      {
        id: "vomitory-left-lower",
        type: "side-vomitory",
        side: "left",
        startRow: 1,
        endRow: 3,
        seatSpan: 3,
      },
    ],
    boundary: {
      shape: "radial-sector",
      facetAngleDeg: 16,
      angularBoundsDeg: { startDeg: 120, endDeg: 136 },
    },
    backWallFeature: null,
  },

  loungeAdjacent200: {
    tier: 200,
    zone: "lounge-adjacent",
    rows: 9,
    lowerRows: 4,
    upperRows: 5,
    row1SeatCount: 13,
    layout: "stepped-lounge",
    taper: { mode: "linear", deltaPerRow: 0.4, rounding: "round" },
    omittedFrontRows: [],
    walkwaysAfterRows: [4],
    walkwayWidthMeters: 1.5,
    cutouts: [],
    boundary: {
      shape: "stepped-polygon",
      facetAngleDeg: 14,
      angularBoundsDeg: { startDeg: -38, endDeg: -24 },
    },
    backWallFeature: {
      id: "PREMIUM_SUITE_LOUNGE_STEP",
      type: "lounge-adjacent",
      depthMeters: 2.2,
      spansSections: ["224", "227"],
    },
  },

  // 300 LEVEL — UPPER BOWL
  standard300Sideline: {
    tier: 300,
    zone: "sideline",
    rows: 12,
    lowerRows: 6,
    upperRows: 6,
    row1SeatCount: 20,
    layout: "faceted",
    taper: { mode: "linear", deltaPerRow: 0.15, rounding: "round" },
    omittedFrontRows: [],
    walkwaysAfterRows: [6],
    walkwayWidthMeters: 1.8,
    cutouts: [
      {
        id: "vomitory-left-lower",
        type: "side-vomitory",
        side: "left",
        startRow: 1,
        endRow: 5,
        seatSpan: 4,
      },
    ],
    boundary: {
      shape: "faceted-quad",
      facetAngleDeg: 6,
      angularBoundsDeg: { startDeg: 75, endDeg: 90 },
    },
    backWallFeature: null,
  },

  standard300Faceted: {
    tier: 300,
    zone: "corner-end",
    rows: 13,
    lowerRows: 6,
    upperRows: 7,
    row1SeatCount: 16,
    layout: "faceted-radial",
    taper: { mode: "linear", deltaPerRow: 0.75, rounding: "round" },
    omittedFrontRows: [],
    walkwaysAfterRows: [6],
    walkwayWidthMeters: 1.8,
    cutouts: [
      {
        id: "vomitory-left-lower",
        type: "side-vomitory",
        side: "left",
        startRow: 1,
        endRow: 5,
        seatSpan: 4,
      },
    ],
    boundary: {
      shape: "faceted-polygon",
      facetAngleDeg: 15,
      angularBoundsDeg: { startDeg: -50, endDeg: -35 },
    },
    backWallFeature: null,
  },
};

export const SECTION_PROFILE_MAP = {
  // 100s — North Sideline (Bench) [6]
  116: "wedge100",
  117: "sideline100BlueLine",
  118: "sideline100BenchPenalty",
  119: "sideline100BenchPenalty",
  120: "sideline100BlueLine",
  121: "corner100",

  // 100s — South Sideline (Penalty) [6]
  109: "corner100",
  107: "sideline100BlueLine",
  106: "sideline100BenchPenalty",
  105: "sideline100BenchPenalty",
  104: "sideline100BlueLine",
  103: "corner100",

  // 100s — West End (Zamboni / Attack Zone) [4]
  115: "wedge100",
  113: "end100Bowl",
  112: "end100Bowl",
  111: "end100Bowl",

  // 100s — East End (Lounge / Tunnels) [5]
  123: "wedge100",
  124: "corner100",
  125: "end100ClubLounge",
  126: "end100ClubLounge",
  127: "corner100",

  // 200s — North Sideline [7]
  215: "standard200Curve",
  216: "standard200Sideline",
  217: "standard200Sideline",
  218: "standard200Sideline",
  219: "standard200Sideline",
  220: "standard200Sideline",
  221: "standard200Curve",

  // 200s — South Sideline [7]
  209: "standard200Curve",
  208: "standard200Sideline",
  207: "standard200Sideline",
  206: "standard200Sideline",
  205: "standard200Sideline",
  204: "standard200Sideline",
  203: "standard200Curve",

  // 200s — West & East Ends [9]
  214: "standard200Curve",
  213: "standard200Curve",
  212: "standard200Curve",
  211: "standard200Curve",
  210: "standard200Curve",
  222: "standard200Curve",
  224: "loungeAdjacent200",
  227: "loungeAdjacent200",
  202: "standard200Curve",

  // 300s — North Sideline [8]
  317: "standard300Faceted",
  318: "standard300Sideline",
  319: "standard300Sideline",
  320: "standard300Sideline",
  321: "standard300Sideline",
  322: "standard300Sideline",
  323: "standard300Sideline",
  324: "standard300Faceted",

  // 300s — South Sideline [8]
  309: "standard300Faceted",
  308: "standard300Sideline",
  307: "standard300Sideline",
  306: "standard300Sideline",
  305: "standard300Sideline",
  304: "standard300Sideline",
  303: "standard300Sideline",
  302: "standard300Faceted",

  // 300s — West & East Ends [14]
  316: "standard300Faceted",
  315: "standard300Faceted",
  314: "standard300Faceted",
  313: "standard300Faceted",
  312: "standard300Faceted",
  311: "standard300Faceted",
  310: "standard300Faceted",
  325: "standard300Faceted",
  326: "standard300Faceted",
  327: "standard300Faceted",
  328: "standard300Faceted",
  329: "standard300Faceted",
  330: "standard300Faceted",
  301: "standard300Faceted",
};

export const SECTION_OVERRIDES = {
  116: {
    rows: 12,
    row1SeatCount: 6,
    boundary: {
      shape: "wedge",
      facetAngleDeg: 11,
      angularBoundsDeg: { startDeg: 154, endDeg: 165 },
    },
  },
  118: {
    boundary: {
      shape: "quad",
      facetAngleDeg: 0,
      angularBoundsDeg: { startDeg: 95, endDeg: 110 },
    },
  },
  121: {
    boundary: {
      shape: "radial-sector",
      facetAngleDeg: 18,
      angularBoundsDeg: { startDeg: 35, endDeg: 53 },
    },
  },
  215: {
    boundary: {
      shape: "radial-sector",
      facetAngleDeg: 16,
      angularBoundsDeg: { startDeg: 120, endDeg: 136 },
    },
  },
  224: {
    boundary: {
      shape: "stepped-polygon",
      facetAngleDeg: 14,
      angularBoundsDeg: { startDeg: -38, endDeg: -24 },
    },
  },
  318: {
    boundary: {
      shape: "faceted-quad",
      facetAngleDeg: 6,
      angularBoundsDeg: { startDeg: 75, endDeg: 90 },
    },
  },
  301: {
    boundary: {
      shape: "faceted-polygon",
      facetAngleDeg: 15,
      angularBoundsDeg: { startDeg: -50, endDeg: -35 },
    },
  },
  115: {
    rows: 11,
    row1SeatCount: 7,
    boundary: {
      shape: "wedge",
      facetAngleDeg: 12,
      angularBoundsDeg: { startDeg: 170, endDeg: 182 },
    },
  },
  123: {
    rows: 10,
    row1SeatCount: 5,
    taper: { mode: "linear", deltaPerRow: 0.1, rounding: "round" },
    boundary: {
      shape: "wedge",
      facetAngleDeg: 9,
      angularBoundsDeg: { startDeg: -15, endDeg: -6 },
    },
  },
  125: { rows: 13, row1SeatCount: 15, omittedFrontRows: [] },
  126: { rows: 13, row1SeatCount: 15, omittedFrontRows: [] },
};

const SUITE_IDS = [
  ...Array.from({ length: 47 }, (_, i) => `S${i + 1}`),
  "S54",
  "S55",
];

export const SUITE_LAYOUT_MAP = Object.fromEntries(
  SUITE_IDS.map((suiteId, idx) => {
    const suiteNumber = Number(suiteId.slice(1));
    return [
      suiteId,
      {
        suiteId,
        suiteNumber,
        sequenceIndex: idx,
        rows: 2,
        seatsPerRow: 4,
        dividerAfterPod: true,
        adjacentUpperSection: null,
      },
    ];
  })
);

export const LOGE_LAYOUT_MAP = Object.fromEntries(
  Array.from({ length: 30 }, (_, i) => {
    const num = i + 301;
    const logeId = `${num}L`;
    const isCorner = [301, 302, 309, 310, 316, 317, 324, 325].includes(num);
    return [
      logeId,
      {
        logeId,
        parentUpperSection: `${num}`,
        rows: 1,
        seatsInCluster: isCorner ? 4 : 6,
      },
    ];
  })
);

export const STRUCTURAL_GAPS = {
  suiteGapBetweenS8AndS9: {
    id: "gap-s8-s9",
    betweenSuites: ["S8", "S9"],
    type: "concours-break",
    widthMeters: 2.4,
  },
  suiteGapBetweenS47AndS54: {
    id: "gap-s47-s54-lounge",
    betweenSuites: ["S47", "S54"],
    type: "premium-suite-lounge",
    widthMeters: 16.0,
    omittedSuiteNumbers: [48, 49, 50, 51, 52, 53],
  },
  premiumSuiteLounge: {
    id: "PREMIUM_SUITE_LOUNGE",
    type: "lounge-zone",
    behindSections100: ["125", "126"],
    belowSections200: ["224", "227"],
    dimensionsMeters: {
      widthMeters: 16.0,
      depthMeters: 8.0,
    },
    footprint: {
      xMin: 24.0,
      xMax: 32.0,
      yMin: -8.0,
      yMax: 8.0,
    },
  },
  diagonalTunnels: [
    {
      id: "zamboni-tunnel-west",
      orientationDeg: 28,
      betweenSections: ["113", "115", "116"],
    },
    {
      id: "sw-corner-aisle-109-111",
      orientationDeg: -36,
      betweenSections: ["109", "111"],
    },
    {
      id: "se-corner-aisle-103-127",
      orientationDeg: 36,
      betweenSections: ["103", "127"],
    },
    {
      id: "ne-corner-tunnel-123-124",
      orientationDeg: -25,
      betweenSections: ["123", "124"],
    },
  ],
  unmappedStructuralLabels: [
    "VISITOR",
    "HOME",
    "PENALTY",
    "ATTACK ZONE",
    "ZAMBONI",
  ],
};

const VALID_TAPER_MODES = new Set(["none", "linear"]);
const VALID_ROUNDING_MODES = new Set(["round", "floor"]);
const VALID_CUTOUT_SIDES = new Set(["left", "right"]);
const ALLOWED_OVERRIDE_KEYS = new Set([
  "rows",
  "lowerRows",
  "upperRows",
  "row1SeatCount",
  "layout",
  "taper",
  "omittedFrontRows",
  "walkwaysAfterRows",
  "walkwayWidthMeters",
  "cutouts",
  "boundary",
  "backWallFeature",
]);

export function getRowSeatCount(profile, row) {
  if (!Number.isInteger(row) || row < 1) {
    throw new Error(`Invalid row index: ${row}`);
  }
  if (Number.isInteger(profile.rows) && row > profile.rows) {
    throw new Error(`Row ${row} exceeds profile maximum of ${profile.rows}`);
  }
  const taper = profile.taper || { mode: "none", deltaPerRow: 0, rounding: "round" };
  const delta = taper.mode === "linear" ? taper.deltaPerRow : 0;
  const raw = profile.row1SeatCount + (row - 1) * delta;
  return taper.rounding === "floor" ? Math.floor(raw) : Math.round(raw);
}

export function getSeatNumber(localSeatIdx, rowSeatCount, options = {}) {
  const mode = options.numberingMode || VENUE_META.coordinates.seatNumberingMode || "physical-grid";
  if (mode === "consecutive-occupied") {
    const occupiedIndex = options.occupiedIndexFromRight ?? localSeatIdx;
    const totalOccupied = options.occupiedSeatCount ?? rowSeatCount;
    if (!Number.isInteger(occupiedIndex) || occupiedIndex < 0 || occupiedIndex >= totalOccupied) {
      throw new Error(`Invalid occupiedIndex ${occupiedIndex} for totalOccupied ${totalOccupied}`);
    }
    return totalOccupied - occupiedIndex;
  }
  if (!Number.isInteger(localSeatIdx) || localSeatIdx < 0 || localSeatIdx >= rowSeatCount) {
    throw new Error(`Invalid localSeatIdx ${localSeatIdx} for rowSeatCount ${rowSeatCount}`);
  }
  return rowSeatCount - localSeatIdx;
}

export function getCutoutLocalInterval(cutout, rowSeatCount) {
  if (!VALID_CUTOUT_SIDES.has(cutout.side)) {
    throw new Error(
      `Invalid cutout side "${cutout.side}" for cutout "${cutout.id || "unnamed"}". Expected "left" or "right".`
    );
  }
  const span = Math.max(0, Math.min(cutout.seatSpan || 0, rowSeatCount));
  if (cutout.side === "right") {
    return { startIdx: rowSeatCount - span, endIdx: rowSeatCount, span };
  }
  return { startIdx: 0, endIdx: span, span };
}

export function getSectionGeometry(sectionId) {
  const key = String(sectionId);
  const profileName = SECTION_PROFILE_MAP[key];
  if (!profileName || !SECTION_PROFILES[profileName]) {
    throw new Error(`Unknown or unmapped sectionId: "${key}"`);
  }

  const baseProfile = SECTION_PROFILES[profileName];
  const override = SECTION_OVERRIDES[key] || {};

  return {
    sectionId: key,
    profileName,
    ...baseProfile,
    ...override,
    taper: {
      ...baseProfile.taper,
      ...(override.taper || {}),
    },
    boundary: {
      ...baseProfile.boundary,
      ...(override.boundary || {}),
    },
  };
}

export function validateArenaGeometryData() {
  const errors = [];
  const countByTier = { 100: 0, 200: 0, 300: 0 };

  for (const [secId, override] of Object.entries(SECTION_OVERRIDES)) {
    if (!SECTION_PROFILE_MAP[secId]) {
      errors.push(`Override exists for unmapped section ${secId}.`);
    }
    for (const key of Object.keys(override || {})) {
      if (!ALLOWED_OVERRIDE_KEYS.has(key)) {
        errors.push(`Section ${secId}: unsupported override key "${key}".`);
      }
    }
  }

  for (const [sectionId, profileName] of Object.entries(SECTION_PROFILE_MAP)) {
    const profile = SECTION_PROFILES[profileName];
    if (!profile) {
      errors.push(`Section ${sectionId}: missing profile "${profileName}".`);
      continue;
    }

    const geom = getSectionGeometry(sectionId);
    const expectedTier = Math.floor(Number(sectionId) / 100) * 100;

    if (Number(geom.tier) !== expectedTier) {
      errors.push(`Section ${sectionId}: tier ${geom.tier} does not match expected ${expectedTier}.`);
    }
    if (Number.isInteger(geom.tier) && countByTier[geom.tier] !== undefined) {
      countByTier[geom.tier]++;
    }
    if (!Number.isInteger(geom.rows) || geom.rows <= 0) {
      errors.push(`Section ${sectionId}: invalid row count (${geom.rows}).`);
      continue;
    }
    if (!Number.isInteger(geom.row1SeatCount) || geom.row1SeatCount <= 0) {
      errors.push(`Section ${sectionId}: invalid row1SeatCount (${geom.row1SeatCount}).`);
      continue;
    }

    const hasLower = geom.lowerRows !== undefined;
    const hasUpper = geom.upperRows !== undefined;
    if (hasLower || hasUpper) {
      if (
        !Number.isInteger(geom.lowerRows) ||
        geom.lowerRows <= 0 ||
        !Number.isInteger(geom.upperRows) ||
        geom.upperRows <= 0
      ) {
        errors.push(`Section ${sectionId}: lowerRows and upperRows must be positive integers.`);
      } else if (geom.lowerRows + geom.upperRows !== geom.rows) {
        errors.push(
          `Section ${sectionId}: lowerRows (${geom.lowerRows}) + upperRows (${geom.upperRows}) !== rows (${geom.rows}).`
        );
      }
    }

    if (!VALID_TAPER_MODES.has(geom.taper?.mode)) {
      errors.push(`Section ${sectionId}: invalid taper.mode "${geom.taper?.mode}".`);
    }
    if (!VALID_ROUNDING_MODES.has(geom.taper?.rounding)) {
      errors.push(`Section ${sectionId}: invalid taper.rounding "${geom.taper?.rounding}".`);
    }
    if (
      typeof geom.taper?.deltaPerRow !== "number" ||
      Number.isNaN(geom.taper.deltaPerRow) ||
      geom.taper.deltaPerRow < 0
    ) {
      errors.push(`Section ${sectionId}: invalid taper.deltaPerRow.`);
    }

    const omitted = geom.omittedFrontRows || [];
    if (new Set(omitted).size !== omitted.length) {
      errors.push(`Section ${sectionId}: duplicate omittedFrontRows.`);
    }
    for (const r of omitted) {
      if (!Number.isInteger(r) || r < 1 || r > geom.rows) {
        errors.push(`Section ${sectionId}: omittedFrontRow ${r} out of range 1..${geom.rows}.`);
      }
    }
    const omittedSet = new Set(omitted);

    const walkways = geom.walkwaysAfterRows || [];
    if (new Set(walkways).size !== walkways.length) {
      errors.push(`Section ${sectionId}: duplicate walkwaysAfterRows.`);
    }
    for (const w of walkways) {
      if (!Number.isInteger(w) || w < 1 || w >= geom.rows) {
        errors.push(`Section ${sectionId}: walkwayAfterRow ${w} out of range 1..${geom.rows - 1}.`);
      }
      if (omittedSet.has(w)) {
        errors.push(`Section ${sectionId}: walkway after row ${w} collides with omitted front row.`);
      }
      if (hasLower && w !== geom.lowerRows) {
        errors.push(
          `Section ${sectionId}: walkwayAfterRow ${w} must sit between split tiers after lowerRows (${geom.lowerRows}).`
        );
      }
    }

    for (let row = 1; row <= geom.rows; row++) {
      const rowSeats = getRowSeatCount(geom, row);
      if (rowSeats <= 0) {
        errors.push(`Section ${sectionId}, row ${row}: seat count ${rowSeats} <= 0.`);
        continue;
      }

      const activeIntervals = [];
      for (const cutout of geom.cutouts || []) {
        if (
          !Number.isInteger(cutout.startRow) ||
          !Number.isInteger(cutout.endRow) ||
          cutout.startRow < 1 ||
          cutout.endRow > geom.rows ||
          cutout.startRow > cutout.endRow
        ) {
          errors.push(`Section ${sectionId}: cutout "${cutout.id || "unnamed"}" row range invalid.`);
          continue;
        }
        if (!VALID_CUTOUT_SIDES.has(cutout.side)) {
          errors.push(
            `Section ${sectionId}: cutout "${cutout.id || "unnamed"}" has invalid side "${cutout.side}" (must be "left" or "right").`
          );
          continue;
        }
        if (row >= cutout.startRow && row <= cutout.endRow) {
          if (omittedSet.has(row)) {
            errors.push(`Section ${sectionId}, row ${row}: cutout overlaps omitted front row.`);
          }
          if (!Number.isInteger(cutout.seatSpan) || cutout.seatSpan <= 0 || cutout.seatSpan >= rowSeats) {
            errors.push(`Section ${sectionId}, row ${row}: invalid cutout seatSpan ${cutout.seatSpan}.`);
            continue;
          }
          const interval = getCutoutLocalInterval(cutout, rowSeats);
          for (const prev of activeIntervals) {
            if (interval.startIdx < prev.endIdx && interval.endIdx > prev.startIdx) {
              errors.push(
                `Section ${sectionId}, row ${row}: overlapping cutouts "${prev.id}" and "${cutout.id || "unnamed"}".`
              );
            }
          }
          activeIntervals.push({ id: cutout.id || "unnamed", ...interval });
        }
      }

      const totalCutoutSeats = activeIntervals.reduce((acc, item) => acc + item.span, 0);
      if (rowSeats - totalCutoutSeats <= 0) {
        errors.push(`Section ${sectionId}, row ${row}: cutouts remove all remaining seats.`);
      }
    }
  }

  for (const tier of [100, 200, 300]) {
    const expected = VENUE_META.expectedCounts[`tier${tier}`];
    if (countByTier[tier] !== expected) {
      errors.push(`Tier ${tier}: ${countByTier[tier]} mapped, expected ${expected}.`);
    }
  }

  const suiteEntries = Object.entries(SUITE_LAYOUT_MAP);
  if (suiteEntries.length !== VENUE_META.expectedCounts.mappedSuites) {
    errors.push(
      `Suites mapped ${suiteEntries.length}, expected ${VENUE_META.expectedCounts.mappedSuites}.`
    );
  }
  const seenSuiteNums = new Set();
  for (const [key, suite] of suiteEntries) {
    if (`S${suite.suiteNumber}` !== key) {
      errors.push(`Suite key "${key}" does not match suiteNumber ${suite.suiteNumber}.`);
    }
    if (
      !Number.isInteger(suite.rows) ||
      suite.rows <= 0 ||
      !Number.isInteger(suite.seatsPerRow) ||
      suite.seatsPerRow <= 0
    ) {
      errors.push(`Suite ${key}: rows and seatsPerRow must be positive integers.`);
    }
    if (
      !Number.isInteger(suite.suiteNumber) ||
      suite.suiteNumber < 1 ||
      suite.suiteNumber > VENUE_META.expectedCounts.maxSuiteNumber
    ) {
      errors.push(`Suite ${key}: invalid suiteNumber ${suite.suiteNumber}.`);
    } else if (seenSuiteNums.has(suite.suiteNumber)) {
      errors.push(`Suite ${key}: duplicate suiteNumber ${suite.suiteNumber}.`);
    } else {
      seenSuiteNums.add(suite.suiteNumber);
    }
  }
  const omittedSuites = new Set(STRUCTURAL_GAPS.suiteGapBetweenS47AndS54?.omittedSuiteNumbers || []);
  for (let n = 1; n <= VENUE_META.expectedCounts.maxSuiteNumber; n++) {
    const present = seenSuiteNums.has(n);
    const shouldBeAbsent = omittedSuites.has(n);
    if (present && shouldBeAbsent) errors.push(`Suite S${n} should be absent in lounge gap.`);
    if (!present && !shouldBeAbsent) errors.push(`Suite S${n} is unexpectedly missing.`);
  }

  const logeEntries = Object.entries(LOGE_LAYOUT_MAP);
  if (logeEntries.length !== VENUE_META.expectedCounts.loge) {
    errors.push(`Loge mapped ${logeEntries.length}, expected ${VENUE_META.expectedCounts.loge}.`);
  }
  const seenLogeIds = new Set();
  for (const [key, loge] of logeEntries) {
    if (key !== loge.logeId) errors.push(`Loge key "${key}" does not match logeId "${loge.logeId}".`);
    if (seenLogeIds.has(loge.logeId)) errors.push(`Duplicate logeId "${loge.logeId}".`);
    seenLogeIds.add(loge.logeId);

    const parentSec = String(loge.parentUpperSection);
    const parentProf = SECTION_PROFILE_MAP[parentSec]
      ? SECTION_PROFILES[SECTION_PROFILE_MAP[parentSec]]
      : null;
    if (!parentProf || parentProf.tier !== 300) {
      errors.push(`Loge ${loge.logeId}: invalid 300-level parentUpperSection "${parentSec}".`);
    }
    if (
      !Number.isInteger(loge.rows) ||
      loge.rows <= 0 ||
      !Number.isInteger(loge.seatsInCluster) ||
      loge.seatsInCluster <= 0
    ) {
      errors.push(`Loge ${loge.logeId}: rows and seatsInCluster must be positive integers.`);
    }
  }
  for (let num = 301; num <= 330; num++) {
    if (!seenLogeIds.has(`${num}L`)) errors.push(`Missing expected loge section ${num}L.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      ...countByTier,
      suites: suiteEntries.length,
      maxSuiteNumber: VENUE_META.expectedCounts.maxSuiteNumber,
      loge: logeEntries.length,
    },
  };
}