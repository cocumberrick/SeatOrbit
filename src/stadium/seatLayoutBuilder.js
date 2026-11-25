/**
 * seatLayoutBuilder.js — the ONLY owner of the seat InstancedMesh.
 *
 * Contract kept intact for main.js:
 *   mesh.userData.seatData        === controller.data       (same array, same identity)
 *   mesh.userData.sectionBounds   === controller.sectionBounds
 *   mesh.userData.sectionOutlines === controller.outlines
 *   mesh.userData.seatLayout      === controller
 *   seat.id === InstancedMesh instance index
 *   seat.key === SEC_ROW_SEAT
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA, SEATING } from '../config/stadiumConfig.js';
import {
  seatKey,
  normalizeInventory,
  computeSectionBounds,
  computeSectionMinPrices,
  computeSectionOutlineData,
  resolveSeatColorHex,
  diffLayouts,
  summarizeSeats,
  defaultSanitizeUrl
} from './seatLayout.js';
import { buildArenaSeatLayout, createLegacyDecor, createHashDecor } from './proceduralSeatLayout.js';

/* ------------------------------------------------------------------ palette */

export function createSeatPalette(colors) {
  const c = colors || SEATING.colors || {};
  const pick = function (name, fallback) { return c[name] === undefined ? fallback : c[name]; };
  return {
    default: pick('default', 0x1b2c3c),
    hover: pick('hover', pick('hovered', 0xffffff)),
    selected: pick('selected', 0xac162c),
    sectionHover: pick('sectionHover', 0x004c97),
    sectionSelected: pick('sectionSelected', 0x8e9090)
  };
}

/* ----------------------------------------------------------------- geometry */

export function createLowPolySeatGeometry() {
  const parts = [];
  const add = function (geometry, opts) {
    const o = opts || {};
    if (o.tiltX) geometry.rotateX(o.tiltX);
    geometry.translate(o.x || 0, o.y || 0, o.z || 0);
    parts.push(geometry);
  };

  add(new THREE.BoxGeometry(0.40, 0.05, 0.40), { x: 0, y: 0.425, z: -0.05 });
  add(new THREE.BoxGeometry(0.40, 0.34, 0.045), { tiltX: 0.2, x: 0, y: 0.632, z: 0.165 });
  add(new THREE.BoxGeometry(0.10, 0.40, 0.10), { x: 0, y: 0.20, z: 0.0 });

  const geometry = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  geometry.deleteAttribute('uv');
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = 'StadiumSeatLowPoly';
  return geometry;
}

/* ----------------------------------------------------------------- outlines */

const OUTLINE_COLOUR = 0x8e9090;
const OUTLINE_OPACITY = 0.48;

function tierRowDepth() {
  return {
    lower: ARENA.level100.rowDepth,
    club: ARENA.level200.rowDepth,
    upper: ARENA.level300.rowDepth
  };
}

function outlineMaterial() {
  return new THREE.LineBasicMaterial({
    color: OUTLINE_COLOUR, transparent: true, opacity: OUTLINE_OPACITY,
    depthTest: false, depthWrite: false
  });
}

function hitMaterial() {
  return new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

function buildOutlineObject(label, data, sharedHitMaterial) {
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(data.loop, 3));
  lineGeometry.computeBoundingSphere();

  const line = new THREE.LineLoop(lineGeometry, outlineMaterial());
  line.name = 'Outline_' + label;
  line.renderOrder = 10;
  line.frustumCulled = false;
  line.userData = { sectionLabel: label, minPrice: data.minPrice };

  const hitGeometry = new THREE.BufferGeometry();
  hitGeometry.setAttribute('position', new THREE.BufferAttribute(data.hit, 3));
  hitGeometry.setIndex(data.index);
  hitGeometry.computeBoundingSphere();

  const hit = new THREE.Mesh(hitGeometry, sharedHitMaterial);
  hit.name = 'HitArea_' + label;
  hit.frustumCulled = false;
  // Raycaster still tests invisible objects, while WebGLRenderer skips them.
  hit.visible = false;
  hit.userData = { sectionLabel: label, minPrice: data.minPrice };
  line.add(hit);
  return line;
}

export function createSectionOutlines(seats) {
  const group = new THREE.Group();
  group.name = 'SectionOutlines';
  const shared = hitMaterial();
  const data = computeSectionOutlineData(seats, { rowDepthByTier: tierRowDepth() });
  for (const [label, d] of data) group.add(buildOutlineObject(label, d, shared));
  group.userData.hitMaterial = shared;
  return group;
}

export function updateSectionOutlines(group, seats) {
  const data = computeSectionOutlineData(seats, { rowDepthByTier: tierRowDepth() });
  const shared = group.userData.hitMaterial || hitMaterial();
  group.userData.hitMaterial = shared;

  const existing = new Map();
  for (const child of group.children) existing.set(child.userData.sectionLabel, child);

  for (const [label, d] of data) {
    const line = existing.get(label);
    if (!line) { group.add(buildOutlineObject(label, d, shared)); continue; }

    line.userData.minPrice = d.minPrice;
    const hit = line.children[0];
    if (hit) hit.userData.minPrice = d.minPrice;

    const pos = line.geometry.getAttribute('position');
    if (pos && pos.array.length === d.loop.length) {
      pos.array.set(d.loop);
      pos.needsUpdate = true;
      line.geometry.computeBoundingSphere();
    } else {
      line.geometry.dispose();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(d.loop, 3));
      g.computeBoundingSphere();
      line.geometry = g;
    }

    if (hit) {
      const hpos = hit.geometry.getAttribute('position');
      const sameIndex = hit.geometry.index && hit.geometry.index.count === d.index.length;
      if (hpos && hpos.array.length === d.hit.length && sameIndex) {
        hpos.array.set(d.hit);
        hpos.needsUpdate = true;
        hit.geometry.setIndex(d.index);
        hit.geometry.computeBoundingSphere();
      } else {
        hit.geometry.dispose();
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(d.hit, 3));
        g.setIndex(d.index);
        g.computeBoundingSphere();
        hit.geometry = g;
      }
    }
  }

  for (const [label, line] of existing) {
    if (data.has(label)) continue;
    group.remove(line);
    line.geometry.dispose();
    line.material.dispose();
    if (line.children[0]) line.children[0].geometry.dispose();
  }
  return group;
}

/* ------------------------------------------------------- partial GPU uploads */

function markAttributeUpdate(attr, start, count, totalLength) {
  const full = count >= totalLength * 0.6;
  if (full) {
    if (typeof attr.clearUpdateRanges === 'function') attr.clearUpdateRanges();
    else if (attr.updateRange) { attr.updateRange.offset = 0; attr.updateRange.count = -1; }
  } else if (typeof attr.addUpdateRange === 'function') {
    if (attr.updateRanges && attr.updateRanges.length > 32) attr.clearUpdateRanges();
    attr.addUpdateRange(start, count);
  } else if (attr.updateRange) {
    const r = attr.updateRange;
    if (r.count <= 0) { r.offset = start; r.count = count; }
    else {
      const end = Math.max(r.offset + r.count, start + count);
      r.offset = Math.min(r.offset, start);
      r.count = end - r.offset;
    }
  }
  attr.needsUpdate = true;
}

const EPS = 1e-6;
const sameTransform = function (seat, p) {
  return Math.abs(seat.position.x - p.x) < EPS &&
         Math.abs(seat.position.y - p.y) < EPS &&
         Math.abs(seat.position.z - p.z) < EPS &&
         Math.abs(seat.yaw - p.yaw) < EPS;
};

/* ========================================================================= */

export class SeatLayoutBuilder {
  constructor(options) {
    const o = options || {};
    this.palette = o.palette || createSeatPalette();
    this.headroom = o.headroom === undefined ? 0.15 : o.headroom;
    this.reuseRemovedIds = o.reuseRemovedIds === true;
    this.autoFlush = o.autoFlush !== false;
    this.sanitizeUrl = o.sanitizeUrl || defaultSanitizeUrl;
    this.name = o.name || 'Seats';

    const initial = o.placements || buildArenaSeatLayout().placements;
    this._decor = o.decor || createLegacyDecor();
    this._appendDecor = o.appendDecor || createHashDecor();

    this.capacity = Math.max(16, Math.ceil(initial.length * (1 + this.headroom)));
    this.highWater = 0;

    this.geometry = o.geometry || createLowPolySeatGeometry();
    this.material = o.material || new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.name = this.name;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3).fill(1), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    this.data = [];
    this.byKey = new Map();
    this._retired = new Map();
    this._freeIds = [];
    this._visuals = new Map();
    this._sectionIds = new Map();
    this._photoMoves = new Map();
    this._photoOrphans = [];
    this.orphanedBillboards = [];
    this._listeners = new Set();
    this._pending = false;
    this._disposed = false;
    this._flushScheduled = () => {
      this._pending = false;
      this.flush();
    };
    this.lastInventorySource = null;
    this.lastInventoryAt = null;

    this.sectionBounds = {};
    this.outlines = new THREE.Group();
    this.outlines.name = 'SectionOutlines';
    this.outlines.userData.hitMaterial = hitMaterial();

    this._matrixMin = Infinity; this._matrixMax = -Infinity;
    this._colorMin = Infinity; this._colorMax = -Infinity;
    this._boundsDirty = true;

    this._tmpMatrix = new THREE.Matrix4();
    this._tmpColor = new THREE.Color();

    this.mesh.userData.seatData = this.data;
    this.mesh.userData.sectionBounds = this.sectionBounds;
    this.mesh.userData.sectionOutlines = this.outlines;
    this.mesh.userData.seatLayout = this;
    this.mesh.userData.dispose = () => this.dispose();

    this._appendPlacements(initial, this._decor);
    this._refreshAggregates(true);
    this.flush();
  }

  get size() { return this.highWater; }
  get activeCount() {
    let n = 0;
    for (const s of this.data) if (s && s.active !== false) n++;
    return n;
  }
  getSeat(id) { const s = this.data[id]; return s && s.active !== false ? s : null; }
  getSeatRecord(id) { return this.data[id] || null; }
  getSeatByKey(key) { const id = this.byKey.get(key); return id === undefined ? null : this.data[id]; }
  getId(key) { const id = this.byKey.get(key); return id === undefined ? -1 : id; }
  getIdByParts(section, row, seat) { return this.getId(seatKey(section, row, seat)); }
  getSectionIds(label) { return this._sectionIds.get(String(label)) || []; }
  getActiveSeats() {
    return this.data.filter(function (s) { return s && s.active !== false; });
  }
  stats() {
    return Object.assign(summarizeSeats(this.data), {
      slots: this.highWater,
      capacity: this.capacity,
      sections: this._sectionIds.size,
      source: this.lastInventorySource
    });
  }

  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(event) {
    this._listeners.forEach(function (fn) {
      try { fn(event); } catch (err) { console.error('[SeatLayout] listener failed:', err); }
    });
  }

  _allocateId(key) {
    if (this._retired.has(key)) {
      const id = this._retired.get(key);
      this._retired.delete(key);
      const orphanAt = this._photoOrphans.indexOf(id);
      if (orphanAt >= 0) this._photoOrphans.splice(orphanAt, 1);
      return id;
    }
    if (this.reuseRemovedIds && this._freeIds.length) return this._freeIds.pop();
    const id = this.highWater++;
    this._ensureCapacity(this.highWater);
    return id;
  }

  _ensureCapacity(needed) {
    if (needed <= this.capacity) return false;
    const next = Math.max(needed, Math.ceil(this.capacity * 1.5), 16);

    const matrix = new THREE.InstancedBufferAttribute(new Float32Array(next * 16), 16);
    matrix.setUsage(THREE.DynamicDrawUsage);
    matrix.array.set(this.mesh.instanceMatrix.array);

    const color = new THREE.InstancedBufferAttribute(new Float32Array(next * 3).fill(1), 3);
    color.setUsage(THREE.DynamicDrawUsage);
    color.array.set(this.mesh.instanceColor.array);

    this.mesh.dispose();
    this.mesh.instanceMatrix = matrix;
    this.mesh.instanceColor = color;
    this.capacity = next;
    this._matrixMin = 0; this._matrixMax = this.highWater - 1;
    this._colorMin = 0; this._colorMax = this.highWater - 1;
    this._emit({ type: 'capacity', capacity: next });
    return true;
  }

  _writeMatrix(id, p) {
    const m = this._tmpMatrix.makeRotationY(p.yaw);
    m.setPosition(p.x, p.y, p.z);
    this.mesh.setMatrixAt(id, m);
    if (id < this._matrixMin) this._matrixMin = id;
    if (id > this._matrixMax) this._matrixMax = id;
  }

  _writeTombstone(id, p) {
    const m = this._tmpMatrix.makeScale(0, 0, 0);
    m.setPosition(p ? p.x : 0, p ? p.y : 0, p ? p.z : 0);
    this.mesh.setMatrixAt(id, m);
    if (id < this._matrixMin) this._matrixMin = id;
    if (id > this._matrixMax) this._matrixMax = id;
  }

  _writeColor(id) {
    const seat = this.data[id];
    if (!seat) return;
    const hex = resolveSeatColorHex(seat, this._visuals.get(id), this.palette);
    this._tmpColor.setHex(hex);
    this.mesh.setColorAt(id, this._tmpColor);
    if (id < this._colorMin) this._colorMin = id;
    if (id > this._colorMax) this._colorMax = id;
  }

  _makeSeat(id, p, decor) {
    const d = decor(p, id) || {};
    const seat = {
      id,
      section: p.section,
      row: p.row,
      seat: p.seat,
      price: Number.isFinite(d.price) ? d.price : 0,
      estimatedPrice: d.estimatedPrice !== false,
      inCart: false,
      originalColor: this.palette.default,
      side: p.side,
      tier: p.tier,
      yaw: p.yaw,
      position: { x: p.x, y: p.y, z: p.z },
      avatarUrl: null,
      key: p.key,
      active: true,
      order: p.order === undefined ? id : p.order,
      rowFactor: p.rowFactor,
      zonePrice: p.zonePrice,
      currency: 'CAD',
      ticketUrl: null,
      seatType: null,
      externalId: null,
      priceSource: 'estimate',
      inventorySource: null,
      updatedAt: null
    };
    this.data[id] = seat;
    this.byKey.set(seat.key, id);
    return seat;
  }

  _appendPlacements(placements, decor) {
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      if (this.byKey.has(p.key)) continue;
      const id = this._allocateId(p.key);
      this._makeSeat(id, p, decor);
      this._writeMatrix(id, p);
      this._writeColor(id);
    }
    this.mesh.count = this.highWater;
  }

  applyLayout(placements, opts) {
    if (this._disposed) throw new Error('[SeatLayout] disposed');
    const o = opts || {};
    const decor = o.decor || this._appendDecor;
    const keepInventory = o.keepInventory !== false;
    const next = Array.isArray(placements) ? placements : [];
    const prevByKey = this.byKey;
    const diff = diffLayouts(prevByKey, next, o.renames);

    let moved = 0;
    let recoloured = 0;

    for (const item of diff.kept) {
      const p = item.placement;
      const id = prevByKey.get(item.prevKey);
      const seat = this.data[id];
      if (!seat) continue;

      if (item.prevKey !== p.key) {
        prevByKey.delete(item.prevKey);
        this._retired.delete(p.key);
        prevByKey.set(p.key, id);
        seat.section = p.section; seat.row = p.row; seat.seat = p.seat; seat.key = p.key;
        this._photoMoves.set(id, { seatId: id, section: p.section, row: p.row, seat: p.seat });
      }

      if (!sameTransform(seat, p)) { this._writeMatrix(id, p); moved++; }
      seat.position.x = p.x; seat.position.y = p.y; seat.position.z = p.z;
      seat.yaw = p.yaw;
      seat.side = p.side; seat.tier = p.tier;
      seat.order = p.order === undefined ? seat.order : p.order;
      seat.rowFactor = p.rowFactor; seat.zonePrice = p.zonePrice;

      let needColour = false;
      if (seat.active === false) {
        seat.active = true;
        this._writeMatrix(id, p);
        moved++;
        needColour = true;
      }
      if (!keepInventory) {
        const d = decor(p, id) || {};
        seat.price = Number.isFinite(d.price) ? d.price : seat.price;
        seat.estimatedPrice = d.estimatedPrice !== false;
        seat.ticketUrl = null; seat.externalId = null; seat.priceSource = 'estimate';
        needColour = true;
      }
      if (needColour) { this._writeColor(id); recoloured++; }
    }

    const addedIds = [];
    for (const p of diff.added) {
      if (this.byKey.has(p.key)) continue;
      const id = this._allocateId(p.key);
      this._makeSeat(id, p, decor);
      this._writeMatrix(id, p);
      this._writeColor(id);
      addedIds.push(id);
    }

    const removedIds = [];
    for (const key of diff.removed) {
      const id = prevByKey.get(key);
      if (id === undefined) continue;
      const seat = this.data[id];
      prevByKey.delete(key);
      this._retired.set(key, id);
      if (this.reuseRemovedIds) {
        this._freeIds.push(id);
        this._freeIds.sort(function (a, b) { return b - a; });
        this._photoOrphans.push(id);
      }
      if (seat) {
        seat.active = false;
        seat.inCart = false;
        seat.ticketUrl = null;
        this._writeTombstone(id, seat.position);
        this._writeColor(id);
      }
      this._visuals.delete(id);
      removedIds.push(id);
    }

    this.mesh.count = this.highWater;
    this._boundsDirty = true;
    this._refreshAggregates(true);
    this._schedule();

    const report = {
      type: 'layout',
      added: addedIds.length,
      removed: removedIds.length,
      moved,
      renamed: diff.renamed.length,
      recoloured,
      addedIds,
      removedIds,
      total: this.activeCount,
      slots: this.highWater,
      capacity: this.capacity,
      photoMoves: this._photoMoves.size
    };
    this._emit(report);
    return report;
  }

  rebuild(input, opts) {
    const o = opts || {};
    const layoutReport = this.applyLayout(input.placements || input, o);
    const inventoryReport = input.inventory
      ? this.applyInventory(input.inventory, Object.assign({ source: o.source || 'rebuild' }, o.inventoryOptions))
      : null;
    return { layout: layoutReport, inventory: inventoryReport };
  }

  compact() {
    const survivors = this.data.filter(function (s) { return s && s.active !== false; });
    survivors.sort(function (a, b) {
      return (a.order === undefined ? a.id : a.order) - (b.order === undefined ? b.id : b.order);
    });

    const moves = [];
    const visuals = new Map();
    this.byKey.clear();
    this._retired.clear();
    this._freeIds.length = 0;
    this._photoOrphans.length = 0;

    for (let i = 0; i < survivors.length; i++) {
      const seat = survivors[i];
      const oldId = seat.id;
      if (oldId !== i) {
        moves.push({ from: oldId, to: { seatId: i, section: seat.section, row: seat.row, seat: seat.seat } });
        const v = this._visuals.get(oldId);
        if (v) visuals.set(i, v);
      }
      seat.id = i;
      seat.order = i;
      this.data[i] = seat;
      this.byKey.set(seat.key, i);
      this._writeMatrix(i, { x: seat.position.x, y: seat.position.y, z: seat.position.z, yaw: seat.yaw });
      this._writeColor(i);
    }
    this.data.length = survivors.length;
    this._visuals.clear();
    visuals.forEach(function (v, k) { this._visuals.set(k, v); }, this);
    this._photoMoves.clear();
    moves.forEach(function (m) { this._photoMoves.set(m.from, m.to); }, this);

    this.highWater = survivors.length;
    this.mesh.count = this.highWater;
    this._matrixMin = 0; this._matrixMax = Math.max(0, this.highWater - 1);
    this._colorMin = 0; this._colorMax = Math.max(0, this.highWater - 1);
    this._boundsDirty = true;
    this._refreshAggregates(true);
    this._schedule();

    const report = { type: 'compact', moved: moves.length, total: this.highWater, slots: this.highWater, capacity: this.capacity };
    this._emit(report);
    return report;
  }

  applyInventory(input, opts) {
    if (this._disposed) throw new Error('[SeatLayout] disposed');
    const o = opts || {};
    const norm = input && input.byKey instanceof Map
      ? input
      : normalizeInventory(input instanceof Map ? [...input.values()] : input, {
          fieldMap: o.fieldMap, sanitizeUrl: this.sanitizeUrl, defaultCurrency: o.currency
        });
    const byKey = norm.byKey;
    const delta = o.delta === true;
    const unmatched = delta ? 'keep' : (o.unmatched || 'keep');
    const source = o.source || 'feed';
    const now = new Date().toISOString();

    const changedIds = [];
    const unknownKeys = [];
    const touchedSections = new Set();
    let matched = 0;

    if (o.reset) {
      for (const seat of this.data) {
        if (!seat || seat.active === false) continue;
        seat.ticketUrl = null; seat.externalId = null; seat.seatType = null;
      }
    }

    for (const rec of byKey.values()) {
      const id = this.byKey.get(rec.key);
      if (id === undefined) { unknownKeys.push(rec.key); continue; }
      const seat = this.data[id];
      if (!seat || seat.active === false) { unknownKeys.push(rec.key); continue; }
      matched++;

      let changed = false;
      if (rec.price !== null && rec.price !== seat.price) {
        seat.price = rec.price; seat.estimatedPrice = false; seat.priceSource = source; changed = true;
      }
      if (rec.currency && rec.currency !== seat.currency) { seat.currency = rec.currency; changed = true; }
      if (rec.ticketUrl && rec.ticketUrl !== seat.ticketUrl) { seat.ticketUrl = rec.ticketUrl; changed = true; }
      if (rec.seatType && rec.seatType !== seat.seatType) { seat.seatType = rec.seatType; changed = true; }
      if (rec.externalId && rec.externalId !== seat.externalId) { seat.externalId = rec.externalId; changed = true; }

      seat.inventorySource = source;
      seat.updatedAt = now;
      if (changed) {
        changedIds.push(id);
        touchedSections.add(seat.section);
        this._writeColor(id);
      }
    }

    if (unmatched !== 'keep') {
      for (const seat of this.data) {
        if (!seat || seat.active === false || byKey.has(seat.key)) continue;
        let changed = false;
        if (unmatched === 'available') {
          if (seat.estimatedPrice === false) { seat.estimatedPrice = true; seat.priceSource = 'estimate'; changed = true; }
        } else if (unmatched === 'demo') {
          const d = this._appendDecor(seat, seat.id) || {};
          if (Number.isFinite(d.price) && seat.price !== d.price) { seat.price = d.price; changed = true; }
          if (seat.estimatedPrice !== true) { seat.estimatedPrice = true; seat.priceSource = 'estimate'; changed = true; }
        }
        if (changed) {
          seat.inventorySource = source;
          seat.updatedAt = now;
          changedIds.push(seat.id);
          touchedSections.add(seat.section);
          this._writeColor(seat.id);
        }
      }
    }

    this.lastInventorySource = source;
    this.lastInventoryAt = now;
    this._refreshMinPrices(touchedSections);
    this._schedule();

    const report = {
      type: 'inventory', source, delta, matched,
      changed: changedIds.length, changedIds, unknownKeys,
      invalid: norm.invalid || 0, duplicates: norm.duplicates || 0,
      sections: touchedSections.size
    };
    this._emit(report);
    return report;
  }

  updateSeat(id, patch) {
    const seat = this.data[id];
    if (!seat || !patch) return false;
    const geometryPatch = patch.position || patch.yaw !== undefined;
    const safePatch = Object.assign({}, patch);
    delete safePatch.status;
    Object.assign(seat, safePatch, { id: seat.id, key: seat.key });
    if (geometryPatch) {
      this._writeMatrix(id, { x: seat.position.x, y: seat.position.y, z: seat.position.z, yaw: seat.yaw });
      this._boundsDirty = true;
    }
    this._writeColor(id);
    this._refreshMinPrices([seat.section]);
    this._schedule();
    this._emit({ type: 'seat', id, changedIds: [id] });
    return true;
  }

  setVisual(id, state) {
    const seat = this.data[id];
    if (!seat) return;
    const next = this._visuals.get(id) || {};
    if (state) Object.assign(next, state);
    if (!next.hovered && !next.selected && !next.inCart && !next.billboard &&
        !next.sectionHovered && !next.sectionSelected) this._visuals.delete(id);
    else this._visuals.set(id, next);
    if (state && 'inCart' in state) seat.inCart = !!state.inCart;
    this._writeColor(id);
    this._schedule();
  }

  setSectionVisual(section, state) {
    const ids = this.getSectionIds(section);
    if (!ids.length) return;
    const patch = state || {};
    for (const id of ids) {
      const next = this._visuals.get(id) || {};
      Object.assign(next, patch);
      if (!next.hovered && !next.selected && !next.inCart && !next.billboard &&
          !next.sectionHovered && !next.sectionSelected) this._visuals.delete(id);
      else this._visuals.set(id, next);
      this._writeColor(id);
    }
    this._schedule();
  }

  clearVisual(id) {
    if (!this._visuals.has(id)) return;
    this._visuals.delete(id);
    const seat = this.data[id];
    if (seat) seat.inCart = false;
    this._writeColor(id);
    this._schedule();
  }

  setCart(ids) {
    const wanted = new Set(ids || []);
    for (const [id, v] of [...this._visuals]) {
      if (v.inCart && !wanted.has(id)) this.setVisual(id, { inCart: false });
    }
    for (const id of wanted) this.setVisual(id, { inCart: true });
  }

  refreshColors(ids) {
    const list = ids || this.data;
    for (const item of list) {
      const id = typeof item === 'number' ? item : item && item.id;
      if (id === undefined || id === null) continue;
      this._writeColor(id);
    }
    this._schedule();
  }

  setPalette(colors) {
    if (!colors || typeof colors !== 'object') return;
    this.palette = Object.assign({}, this.palette, colors);
    for (let id = 0; id < this.highWater; id++) this._writeColor(id);
    this._schedule();
  }

  _rebuildSectionIndex() {
    this._sectionIds.clear();
    for (const seat of this.data) {
      if (!seat || seat.active === false) continue;
      let bucket = this._sectionIds.get(seat.section);
      if (!bucket) { bucket = []; this._sectionIds.set(seat.section, bucket); }
      bucket.push(seat.id);
    }
  }

  _refreshAggregates(withGeometry) {
    this._rebuildSectionIndex();
    const next = computeSectionBounds(this.data);
    for (const key of Object.keys(this.sectionBounds)) if (!next[key]) delete this.sectionBounds[key];
    Object.assign(this.sectionBounds, next);
    if (withGeometry) {
      updateSectionOutlines(this.outlines, this.data);
      this.mesh.computeBoundingSphere();
      this._boundsDirty = false;
    }
    this._refreshMinPrices(null);
  }

  _refreshMinPrices(sections) {
    const all = sections === null || sections === undefined;
    const labels = all ? [...this._sectionIds.keys()] : [...sections];
    if (!labels.length) return;
    const prices = all ? computeSectionMinPrices(this.data) : null;
    for (const label of labels) {
      let min = Infinity;
      if (all) {
        min = prices.get(label);
      } else {
        for (const id of this.getSectionIds(label)) {
          const s = this.data[id];
          if (s && s.active !== false && Number.isFinite(s.price) && s.price < min) min = s.price;
        }
      }
      if (min === undefined) continue;
      const line = this.outlines.getObjectByName('Outline_' + label);
      if (!line) continue;
      line.userData.minPrice = min;
      if (line.children[0]) line.children[0].userData.minPrice = min;
    }
  }

  refreshSections() { this._refreshAggregates(true); this._schedule(); }

  syncPhotoBillboards(store) {
    if (!store) return { moved: 0, orphaned: 0 };
    let moved = 0;
    if (this._photoMoves.size) {
      const moves = [...this._photoMoves.entries()].map(function (e) { return { from: e[0], to: e[1] }; });
      this._photoMoves.clear();
      const res = store.rekeyMany(moves);
      moved = (res && res.moved) || 0;
    }
    let orphaned = 0;
    if (this._photoOrphans.length) {
      for (const id of this._photoOrphans) {
        const item = typeof store.get === 'function' ? store.get(id) : null;
        if (!item) continue;
        this.orphanedBillboards.push(item);
        if (typeof store.remove === 'function') store.remove(id);
        orphaned++;
      }
      this._photoOrphans.length = 0;
    }
    return { moved, orphaned };
  }

  restoreOrphanedBillboards(store) {
    if (!store || !this.orphanedBillboards.length) return 0;
    let restored = 0;
    const getId = this.getId.bind(this);
    this.orphanedBillboards = this.orphanedBillboards.filter(function (item) {
      const id = getId(seatKey(item.section, item.row, item.seat));
      if (id < 0) return true;
      store.save({ seatId: id, section: item.section, row: item.row, seat: item.seat }, item.dataUrl);
      restored++;
      return false;
    });
    return restored;
  }

  setAutoFlush(value) {
    this.autoFlush = !!value;
    if (this.autoFlush) this._schedule();
  }

  _schedule() {
    if (!this.autoFlush) return;
    if (typeof requestAnimationFrame !== 'function') { this.flush(); return; }
    if (this._pending) return;
    this._pending = true;
    requestAnimationFrame(this._flushScheduled);
  }

  flush() {
    if (this._disposed) return;
    if (this._matrixMax >= this._matrixMin) {
      const start = this._matrixMin;
      const count = this._matrixMax - this._matrixMin + 1;
      markAttributeUpdate(this.mesh.instanceMatrix, start * 16, count * 16, this.capacity * 16);
      this._matrixMin = Infinity; this._matrixMax = -Infinity;
    }
    if (this._colorMax >= this._colorMin) {
      const start = this._colorMin;
      const count = this._colorMax - this._colorMin + 1;
      markAttributeUpdate(this.mesh.instanceColor, start * 3, count * 3, this.capacity * 3);
      this._colorMin = Infinity; this._colorMax = -Infinity;
    }
    if (this._boundsDirty) {
      this.mesh.computeBoundingSphere();
      this._boundsDirty = false;
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
    this.outlines.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this._listeners.clear();
  }
}

export function createSeatLayoutBuilder(options) {
  return new SeatLayoutBuilder(options);
}

export default createSeatLayoutBuilder;
