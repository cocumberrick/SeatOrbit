/**
 * Photo Billboards store (Stage 4, demo only).
 *
 * Everything lives under ONE localStorage key:
 *   { version: 1, items: { [seatId]: { seatId, section, row, seat, dataUrl, createdAt, updatedAt, mode: 'demo' } } }
 *
 * Safety rules:
 *  - Storage that is missing or blocked never throws: the store keeps working in memory and
 *    reports persisted: false.
 *  - Unreadable data (malformed JSON, wrong version, invalid items) is NEVER silently overwritten.
 *    The raw text is copied to a backup key first; if that copy cannot be made, writes are blocked.
 *  - QuotaExceededError leaves the existing items untouched and returns an error.
 *  - Image data is never logged or emitted in events.
 */

export const STORAGE_KEY = 'clc_photo_billboards_v1';
export const STORE_VERSION = 1;
export const DEMO_UNIT_PRICE = 2; // CAD, demo value only. No payment is ever collected.

const MAX_DATA_URL_CHARS = 300000; // ~220 KB of JPEG; the upload pipeline caps photos near 100 KB
const DATA_URL_PATTERN = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

function ok(extra) {
  return Object.assign({ ok: true }, extra);
}

function fail(code, title, message) {
  return { ok: false, code, title, message };
}

function isQuotaError(err) {
  return !!err && (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

export function isValidPhotoDataUrl(value) {
  return typeof value === 'string' && value.length <= MAX_DATA_URL_CHARS && DATA_URL_PATTERN.test(value);
}

function defaultGetStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage; // may throw SecurityError; callers catch
}

function cleanItem(key, raw, fallbackTime) {
  if (!raw || typeof raw !== 'object') return null;
  const seatId = raw.seatId;
  if (!Number.isInteger(seatId) || seatId < 0 || String(seatId) !== key) return null;
  if (typeof raw.section !== 'string' || raw.section === '') return null;
  if (!Number.isInteger(raw.row) || raw.row < 1) return null;
  if (!Number.isInteger(raw.seat) || raw.seat < 1) return null;
  if (!isValidPhotoDataUrl(raw.dataUrl)) return null;
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : fallbackTime;
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;
  return {
    seatId,
    section: raw.section,
    row: raw.row,
    seat: raw.seat,
    dataUrl: raw.dataUrl,
    createdAt,
    updatedAt,
    mode: 'demo'
  };
}

/**
 * Factory (the app uses the shared instance exported below; tests pass their own storage).
 * @param {object} [options]  { storageKey, getStorage(), now() }
 */
export function createPhotoBillboardsStore(options) {
  const opts = options || {};
  const key = opts.storageKey || STORAGE_KEY;
  const getStorage = opts.getStorage || defaultGetStorage;
  const now = opts.now || function () { return new Date().toISOString(); };

  let items = Object.create(null);
  let loaded = false;
  let storageAvailable = true;
  let writeBlocked = false;
  let watching = false;
  const listeners = new Set();

  function resolveStorage() {
    try {
      return getStorage() || null;
    } catch (err) {
      return null;
    }
  }

  function emit(source) {
    listeners.forEach(function (fn) {
      try { fn({ source: source }); } catch (err) { console.error('[PhotoBillboards] listener failed:', err); }
    });
  }

  /** Copies unreadable raw text aside. Returns true when a copy exists afterwards. */
  function backUp(storage, raw) {
    const backupKey = key + '_backup';
    try {
      const existing = storage.getItem(backupKey);
      if (existing === raw) return true;
      const target = existing === null ? backupKey : backupKey + '_' + Date.now();
      storage.setItem(target, raw);
      return true;
    } catch (err) {
      return false;
    }
  }

  /** Reads and validates storage. Replaces the in-memory items. Never writes the main key. */
  function readFromStorage() {
    const storage = resolveStorage();
    if (!storage) {
      storageAvailable = false;
      return ok({
        code: 'storage-unavailable',
        persisted: false,
        count: Object.keys(items).length,
        message: 'Your browser is blocking local storage, so photo billboards will only last until you close this page.'
      });
    }

    let raw;
    try {
      raw = storage.getItem(key);
    } catch (err) {
      storageAvailable = false;
      return ok({
        code: 'storage-unavailable',
        persisted: false,
        count: Object.keys(items).length,
        message: 'Your browser is blocking local storage, so photo billboards will only last until you close this page.'
      });
    }
    storageAvailable = true;
    writeBlocked = false;

    if (raw === null || raw === undefined) {
      items = Object.create(null);
      return ok({ code: 'empty', persisted: true, count: 0 });
    }

    let parsed = null;
    let parseFailed = false;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parseFailed = true;
    }

    const structureOk = !parseFailed && parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
      parsed.items && typeof parsed.items === 'object' && !Array.isArray(parsed.items);
    const versionOk = structureOk && parsed.version === STORE_VERSION;

    if (!structureOk || !versionOk) {
      const backedUp = backUp(storage, raw);
      items = Object.create(null);
      if (!backedUp) writeBlocked = true;
      return {
        ok: backedUp,
        code: structureOk ? 'unsupported-version' : 'malformed',
        persisted: true,
        count: 0,
        backedUp: backedUp,
        message: backedUp
          ? 'Your saved photo billboards couldn\u2019t be read. A backup copy was kept on this device.'
          : 'Your saved photo billboards couldn\u2019t be read, and there wasn\u2019t room to keep a copy. ' +
            'Saving is paused so nothing is overwritten. Clear this site\u2019s data in your browser settings to start fresh.'
      };
    }

    const fallbackTime = now();
    const next = Object.create(null);
    let dropped = 0;
    Object.keys(parsed.items).forEach(function (k) {
      const item = cleanItem(k, parsed.items[k], fallbackTime);
      if (item) next[k] = item;
      else dropped++;
    });
    items = next;

    if (dropped > 0) {
      const backedUp = backUp(storage, raw);
      if (!backedUp) writeBlocked = true;
      return {
        ok: backedUp,
        code: 'partial',
        persisted: true,
        count: Object.keys(next).length,
        backedUp: backedUp,
        message: dropped + (dropped === 1 ? ' saved photo billboard' : ' saved photo billboards') +
          ' couldn\u2019t be read and ' + (dropped === 1 ? 'was' : 'were') + ' skipped. ' +
          (backedUp
            ? 'A backup copy was kept on this device.'
            : 'Saving is paused so nothing is overwritten. Clear this site\u2019s data in your browser settings to start fresh.')
      };
    }
    return ok({ code: 'ready', persisted: true, count: Object.keys(next).length });
  }

  function watchOtherTabs() {
    if (watching || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    watching = true;
    window.addEventListener('storage', function (event) {
      if (event.key !== null && event.key !== key) return;
      readFromStorage();
      emit('external');
    });
  }

  function persist(next) {
    if (writeBlocked) {
      return fail(
        'storage-blocked',
        'Saving Is Paused',
        'Your saved photo billboards couldn\u2019t be read, so saving is paused to protect them. ' +
          'Clear this site\u2019s data in your browser settings to start fresh.'
      );
    }
    const storage = resolveStorage();
    if (!storage) {
      storageAvailable = false;
      return ok({ persisted: false });
    }
    try {
      storage.setItem(key, JSON.stringify({ version: STORE_VERSION, items: next }));
      storageAvailable = true;
      return ok({ persisted: true });
    } catch (err) {
      if (isQuotaError(err)) {
        return fail(
          'quota-exceeded',
          'Not Enough Storage Space',
          'Your browser\u2019s storage is full. Remove a photo billboard and try again. Your saved photos are unchanged.'
        );
      }
      storageAvailable = false;
      return ok({ persisted: false });
    }
  }

  function commit(nextItems, extra) {
    const result = persist(nextItems);
    if (!result.ok) return result;
    items = nextItems;
    emit('local');
    return ok(Object.assign({ persisted: result.persisted }, extra));
  }

  function copyItems() {
    const out = Object.create(null);
    Object.keys(items).forEach(function (k) { out[k] = items[k]; });
    return out;
  }

  function ensureLoaded() {
    if (!loaded) store.load();
  }

  const store = {
    /** Reads storage. Safe to call more than once. */
    load() {
      loaded = true;
      const result = readFromStorage();
      watchOtherTabs();
      emit('load');
      return result;
    },

    /** All saved billboards, most recently updated first. Items are copies. */
    getAll() {
      ensureLoaded();
      return Object.keys(items)
        .map(function (k) { return Object.assign({}, items[k]); })
        .sort(function (a, b) {
          if (a.updatedAt === b.updatedAt) return a.seatId - b.seatId;
          return a.updatedAt < b.updatedAt ? 1 : -1;
        });
    },

    get(seatId) {
      ensureLoaded();
      const item = items[String(seatId)];
      return item ? Object.assign({}, item) : null;
    },

    /** Creates (or replaces) the billboard for a seat. seatMeta: { seatId, section, row, seat } */
    save(seatMeta, dataUrl) {
      ensureLoaded();
      const meta = seatMeta || {};
      const row = Number(meta.row);
      const seat = Number(meta.seat);
      if (
        !Number.isInteger(meta.seatId) || meta.seatId < 0 ||
        (typeof meta.section !== 'string' && typeof meta.section !== 'number') ||
        !Number.isInteger(row) || row < 1 || !Number.isInteger(seat) || seat < 1
      ) {
        return fail('invalid-seat', 'Seat Not Recognized', 'We couldn\u2019t tell which seat this photo is for. Please select the seat again.');
      }
      if (!isValidPhotoDataUrl(dataUrl)) {
        return fail('invalid-image', 'Photo Not Accepted', 'That photo couldn\u2019t be saved. Please choose it again.');
      }
      const id = String(meta.seatId);
      const previous = items[id];
      const time = now();
      const item = {
        seatId: meta.seatId,
        section: String(meta.section),
        row,
        seat,
        dataUrl,
        createdAt: previous ? previous.createdAt : time,
        updatedAt: time,
        mode: 'demo'
      };
      const next = copyItems();
      next[id] = item;
      const result = commit(next);
      return result.ok ? Object.assign(result, { item: Object.assign({}, item) }) : result;
    },

    /** Replaces the photo of an existing billboard. */
    updateAvatar(seatId, dataUrl) {
      ensureLoaded();
      const id = String(seatId);
      const previous = items[id];
      if (!previous) {
        return fail('not-found', 'Photo Not Found', 'There is no saved photo for that seat.');
      }
      if (!isValidPhotoDataUrl(dataUrl)) {
        return fail('invalid-image', 'Photo Not Accepted', 'That photo couldn\u2019t be saved. Please choose it again.');
      }
      const item = Object.assign({}, previous, { dataUrl, updatedAt: now() });
      const next = copyItems();
      next[id] = item;
      const result = commit(next);
      return result.ok ? Object.assign(result, { item: Object.assign({}, item) }) : result;
    },

    remove(seatId) {
      ensureLoaded();
      const id = String(seatId);
      if (!items[id]) return ok({ removed: false, persisted: storageAvailable });
      const next = copyItems();
      delete next[id];
      return commit(next, { removed: true });
    },

    /**
     * Re-points saved billboards at new seat ids in ONE write (used when the seat layout changes
     * and ids shift). moves: [{ from: oldSeatId, to: { seatId, section, row, seat } }]
     */
    rekeyMany(moves) {
      ensureLoaded();
      const current = copyItems();
      const next = copyItems();
      const validMoves = [];
      const sourceIds = new Set();
      (moves || []).forEach(function (move) {
        const fromId = String(move.from);
        const item = current[fromId];
        const to = move.to;
        if (!item || !to || !Number.isInteger(to.seatId) || to.seatId < 0) return;
        validMoves.push({ fromId, item, to });
        sourceIds.add(fromId);
      });
      sourceIds.forEach(function (id) { delete next[id]; });

      let moved = 0;
      validMoves.forEach(function (move) {
        const relocated = Object.assign({}, move.item, {
          seatId: move.to.seatId,
          section: String(move.to.section),
          row: Number(move.to.row),
          seat: Number(move.to.seat)
        });
        const targetId = String(move.to.seatId);
        const clash = next[targetId];
        if (!clash || clash.updatedAt <= relocated.updatedAt) next[targetId] = relocated;
        moved++;
      });
      if (moved === 0) return ok({ moved: 0, persisted: storageAvailable });
      return commit(next, { moved });
    },

    /** Demo summary. The unit price is a demo value: no payment is collected. */
    getDemoSummary(unitPrice) {
      ensureLoaded();
      const price = unitPrice === undefined ? DEMO_UNIT_PRICE : Number(unitPrice);
      const count = Object.keys(items).length;
      return { count, unitPrice: price, total: count * price, currency: 'CAD', mode: 'demo' };
    },

    /** fn({ source: 'load' | 'local' | 'external' }) after every change. Returns an unsubscribe function. */
    subscribe(fn) {
      listeners.add(fn);
      return function () { listeners.delete(fn); };
    },

    /** Status flags for the UI. */
    getStatus() {
      return { loaded, storageAvailable, writeBlocked };
    }
  };

  return store;
}

export const photoBillboardsStore = createPhotoBillboardsStore();
export default photoBillboardsStore;
