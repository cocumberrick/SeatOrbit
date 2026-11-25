/**
 * seatLayout.js — PURE seat-layout core (no THREE import, no DOM).
 */
export const SEAT_KEY_SEP = '_';

export function seatKey(section, row, seat) {
  return String(section) + SEAT_KEY_SEP + Number(row) + SEAT_KEY_SEP + Number(seat);
}

export function parseSeatKey(key) {
  if (typeof key !== 'string') return null;
  const parts = key.split(SEAT_KEY_SEP);
  if (parts.length !== 3) return null;
  const row = Number(parts[1]);
  const seat = Number(parts[2]);
  if (!parts[0] || !Number.isInteger(row) || row < 1 || !Number.isInteger(seat) || seat < 1) return null;
  return { section: parts[0], row, seat };
}

const DEFAULT_FIELD_MAP = Object.freeze({
  section: ['section', 'sectionName', 'section_name', 'sec', 'sectionCode'],
  row: ['row', 'rowName', 'row_name', 'rowNumber'],
  seat: ['seat', 'seatName', 'seat_name', 'seatNumber', 'seat_num'],
  price: ['price', 'faceValue', 'face_value', 'amount', 'listPrice'],
  currency: ['currency', 'currencyCode'],
  ticketUrl: ['ticketUrl', 'url', 'listingUrl', 'deepLink'],
  seatType: ['seatType', 'type', 'kind'],
  externalId: ['externalId', 'id', 'listingId', 'inventoryId', 'seatId'],
  x: ['x'], y: ['y'], z: ['z'], yaw: ['yaw', 'rotationY', 'heading']
});

function pick(raw, names) {
  for (let i = 0; i < names.length; i++) {
    const v = raw[names[i]];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function toPositiveInt(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 1 ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isInteger(n) && n >= 1 ? n : null;
  }
  return null;
}

function toPrice(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function defaultSanitizeUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    url.username = '';
    url.password = '';
    url.hash = '';
    return url.href;
  } catch (err) {
    return null;
  }
}

export function normalizeSeatRecord(raw, opts) {
  if (!raw || typeof raw !== 'object') return null;
  const o = opts || {};
  const fm = o.fieldMap ? Object.assign({}, DEFAULT_FIELD_MAP, o.fieldMap) : DEFAULT_FIELD_MAP;

  let section = pick(raw, fm.section);
  let row = toPositiveInt(pick(raw, fm.row));
  let seat = toPositiveInt(pick(raw, fm.seat));

  if ((section === undefined || row === null || seat === null) && typeof raw.key === 'string') {
    const parsed = parseSeatKey(raw.key);
    if (parsed) {
      if (section === undefined) section = parsed.section;
      if (row === null) row = parsed.row;
      if (seat === null) seat = parsed.seat;
    }
  }
  if (section === undefined || row === null || seat === null) return null;

  section = String(section).trim();
  if (!section) return null;

  const rawUrl = pick(raw, fm.ticketUrl);
  const sanitize = o.sanitizeUrl || defaultSanitizeUrl;
  const x = toNumber(pick(raw, fm.x));
  const y = toNumber(pick(raw, fm.y));
  const z = toNumber(pick(raw, fm.z));

  const record = {
    key: seatKey(section, row, seat),
    section,
    row,
    seat,
    price: toPrice(pick(raw, fm.price)),
    currency: String(pick(raw, fm.currency) || o.defaultCurrency || 'CAD').toUpperCase(),
    ticketUrl: rawUrl ? sanitize(String(rawUrl)) : null,
    seatType: pick(raw, fm.seatType) ? String(pick(raw, fm.seatType)).toLowerCase() : null,
    externalId: pick(raw, fm.externalId) !== undefined ? String(pick(raw, fm.externalId)) : null
  };
  if (x !== null && y !== null && z !== null) {
    record.position = { x, y, z };
    record.yaw = toNumber(pick(raw, fm.yaw));
  }
  return record;
}

export function normalizeInventory(rawRecords, opts) {
  const byKey = new Map();
  const list = Array.isArray(rawRecords) ? rawRecords : [];
  let invalid = 0;
  let duplicates = 0;
  for (let i = 0; i < list.length; i++) {
    const rec = normalizeSeatRecord(list[i], opts);
    if (!rec) { invalid++; continue; }
    if (byKey.has(rec.key)) duplicates++;
    byKey.set(rec.key, rec);
  }
  return { byKey, invalid, duplicates, count: byKey.size };
}

export function diffLayouts(prevByKey, nextPlacements, renames) {
  const renameMap = new Map();
  (renames || []).forEach(function (r) { if (r && r.from && r.to) renameMap.set(r.to, r.from); });

  const kept = [];
  const added = [];
  const renamed = [];
  const consumed = new Set();
  const seen = new Set();

  for (let i = 0; i < nextPlacements.length; i++) {
    const p = nextPlacements[i];
    if (seen.has(p.key)) continue;
    seen.add(p.key);
    const oldKey = renameMap.get(p.key);
    if (oldKey && prevByKey.has(oldKey) && !consumed.has(oldKey)) {
      consumed.add(oldKey);
      renamed.push({ from: oldKey, to: p.key, placement: p });
      kept.push({ prevKey: oldKey, placement: p });
    } else if (prevByKey.has(p.key) && !consumed.has(p.key)) {
      consumed.add(p.key);
      kept.push({ prevKey: p.key, placement: p });
    } else {
      added.push(p);
    }
  }

  const removed = [];
  for (const key of prevByKey.keys()) if (!consumed.has(key)) removed.push(key);

  return { kept, added, removed, renamed };
}

export function computeSectionBounds(seats) {
  const acc = new Map();
  for (const s of seats) {
    if (!s || s.active === false) continue;
    const p = s.position;
    let a = acc.get(s.section);
    if (!a) {
      a = { label: s.section, tier: s.tier, side: s.side,
            minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity,
            sumY: 0, count: 0 };
      acc.set(s.section, a);
    }
    if (p.x < a.minX) a.minX = p.x;
    if (p.x > a.maxX) a.maxX = p.x;
    if (p.z < a.minZ) a.minZ = p.z;
    if (p.z > a.maxZ) a.maxZ = p.z;
    a.sumY += p.y;
    a.count++;
  }

  const result = {};
  for (const [label, a] of acc) {
    result[label] = {
      label,
      tier: a.tier,
      side: a.side,
      centre: { x: (a.minX + a.maxX) / 2, z: (a.minZ + a.maxZ) / 2 },
      y: a.sumY / a.count + 0.5,
      radius: Math.hypot(a.maxX - a.minX, a.maxZ - a.minZ) / 2,
      seatCount: a.count
    };
  }
  return result;
}

export function computeSectionMinPrices(seats) {
  const out = new Map();
  for (const s of seats) {
    if (!s || s.active === false) continue;
    const price = Number.isFinite(s.price) ? s.price : Infinity;
    const cur = out.get(s.section);
    if (cur === undefined || price < cur) out.set(s.section, price);
  }
  return out;
}

const OUTLINE_LIFT = 0.9;
const OUTLINE_SAMPLES = 8;

function sample(arr, n) {
  const m = Math.min(n, arr.length);
  if (m <= 1) return [arr[0]];
  const out = [];
  for (let i = 0; i < m; i++) out.push(arr[Math.round(i * (arr.length - 1) / (m - 1))]);
  return out;
}

export function computeSectionOutlineData(seats, opts) {
  const o = opts || {};
  const rowDepthByTier = o.rowDepthByTier || {};
  const lift = o.lift === undefined ? OUTLINE_LIFT : o.lift;
  const samples = o.samples || OUTLINE_SAMPLES;

  const acc = new Map();
  for (const s of seats) {
    if (!s || s.active === false) continue;
    let a = acc.get(s.section);
    if (!a) { a = { tier: s.tier, rows: new Map(), minPrice: Infinity }; acc.set(s.section, a); }
    let row = a.rows.get(s.row);
    if (!row) { row = []; a.rows.set(s.row, row); }
    row.push(s);
    if (s.price < a.minPrice) a.minPrice = s.price;
  }

  const out = new Map();
  for (const [label, a] of acc) {
    const rowNumbers = [...a.rows.keys()];
    const byOrder = function (x, y) {
      return (x.order === undefined ? x.id : x.order) - (y.order === undefined ? y.id : y.order);
    };
    const front = a.rows.get(Math.min(...rowNumbers)).sort(byOrder);
    const back = a.rows.get(Math.max(...rowNumbers)).sort(byOrder);
    const half = (rowDepthByTier[a.tier] || 0.8) / 2;

    const edge = function (seat, dir) {
      const nx = Math.sin(seat.yaw), nz = Math.cos(seat.yaw);
      return [seat.position.x + dir * nx * half, seat.position.y + lift, seat.position.z + dir * nz * half];
    };
    const f = sample(front, samples).map(function (s) { return edge(s, -1); });
    const b = sample(back, samples).map(function (s) { return edge(s, +1); });
    const n = Math.min(f.length, b.length);
    const fPts = f.slice(0, n), bPts = b.slice(0, n);

    const index = [];
    for (let i = 0; i < n - 1; i++) index.push(i, i + 1, n + i + 1, i, n + i + 1, n + i);

    out.set(label, {
      label,
      minPrice: a.minPrice,
      loop: new Float32Array([...fPts, ...bPts.slice().reverse()].flat()),
      hit: new Float32Array([...fPts, ...bPts].flat()),
      index
    });
  }
  return out;
}

export function resolveSeatColorHex(seat, visual, palette) {
  if (visual) {
    if (visual.selected) return palette.selected;
    if (visual.hovered) return palette.hover;
    if (visual.sectionSelected) return palette.sectionSelected;
    if (visual.sectionHovered) return palette.sectionHover;
  }
  return palette.default;
}

export function hashSeatKey(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

export function summarizeSeats(seats) {
  const byTier = {};
  let active = 0;
  let priced = 0;
  for (const s of seats) {
    if (!s || s.active === false) continue;
    active++;
    byTier[s.tier] = (byTier[s.tier] || 0) + 1;
    if (s.estimatedPrice === false) priced++;
  }
  return { active, byTier, realPrices: priced };
}
