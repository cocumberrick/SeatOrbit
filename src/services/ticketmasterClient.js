import { TICKETING, validateTicketUrl } from '../config/ticketingConfig.js';

// Ticketmaster's public FAQ documents a 2 requests/second limit; stay below that
// until the project's own quota is confirmed in the developer account.
const MIN_REQUEST_INTERVAL_MS = 550;
const REQUEST_TIMEOUT_MS = 9000;
const responseCache = new Map();
let nextRequestAt = 0;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildUrl(path, params) {
  const url = new URL(TICKETING.apiBaseUrl + path);
  url.searchParams.set('apikey', TICKETING.apiKey);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url;
}

async function requestJson(path, params) {
  if (!TICKETING.apiKey) {
    return { ok: false, code: 'not-configured', message: 'Ticketmaster API key is not configured.', data: null };
  }

  const url = buildUrl(path, params);
  const cacheKey = url.href;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < TICKETING.cacheTtlMs) {
    return { ok: true, code: 'ok', data: cached.data, cached: true };
  }

  const delay = Math.max(0, nextRequestAt - Date.now());
  if (delay) await wait(delay);
  nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.href, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) {
      return {
        ok: false,
        code: response.status === 429 ? 'rate-limited' : 'http-error',
        status: response.status,
        message: response.status === 429
          ? 'Ticketmaster request limit reached. Please retry shortly.'
          : 'Ticketmaster could not return event information.',
        data: null
      };
    }
    const data = await response.json();
    responseCache.set(cacheKey, { savedAt: Date.now(), data });
    return { ok: true, code: 'ok', data, cached: false };
  } catch (error) {
    return {
      ok: false,
      code: error && error.name === 'AbortError' ? 'timeout' : 'network-error',
      message: error && error.name === 'AbortError'
        ? 'Ticketmaster request timed out.'
        : 'Ticketmaster could not be reached.',
      data: null
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizePriceRanges(event) {
  const ranges = Array.isArray(event && event.priceRanges) ? event.priceRanges : [];
  return ranges.map((range) => ({
    min: Number.isFinite(Number(range.min)) ? Number(range.min) : null,
    max: Number.isFinite(Number(range.max)) ? Number(range.max) : null,
    currency: String(range.currency || 'CAD').toUpperCase()
  })).filter((range) => range.min !== null || range.max !== null);
}

export function normalizeTicketmasterEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const venue = event._embedded && Array.isArray(event._embedded.venues)
    ? event._embedded.venues[0]
    : null;
  const date = event.dates && event.dates.start ? event.dates.start : {};
  return {
    id: String(event.id || ''),
    name: String(event.name || 'Winnipeg Jets event'),
    date: String(date.dateTime || date.localDate || ''),
    venue: String(venue && venue.name || TICKETING.venueName),
    city: String(venue && venue.city && venue.city.name || 'Winnipeg'),
    priceRanges: normalizePriceRanges(event),
    ticketUrl: validateTicketUrl(event.url),
    imageUrl: Array.isArray(event.images) && event.images.length ? validateTicketUrl(event.images[0].url) : null
  };
}

/** Search future hockey events. Prefer an official venue ID when configured. */
export async function searchWinnipegJetsEvents(options = {}) {
  const params = {
    countryCode: 'CA',
    sort: 'date,asc',
    size: Math.min(50, Math.max(1, Number(options.size) || 20)),
    classificationName: 'Hockey',
    keyword: options.keyword || 'Winnipeg Jets'
  };
  if (TICKETING.venueId) params.venueId = TICKETING.venueId;
  const result = await requestJson('/events.json', params);
  if (!result.ok) return result;
  const events = result.data && result.data._embedded && Array.isArray(result.data._embedded.events)
    ? result.data._embedded.events.map(normalizeTicketmasterEvent).filter(Boolean)
    : [];
  return { ...result, events };
}

/** Load one event by its Ticketmaster event ID; price ranges are event-level only. */
export async function getTicketmasterEvent(eventId = TICKETING.eventId) {
  if (!eventId) {
    return { ok: false, code: 'event-not-configured', message: 'Ticketmaster event ID is not configured.', data: null };
  }
  const result = await requestJson('/events/' + encodeURIComponent(eventId) + '.json');
  if (!result.ok) return result;
  return { ...result, event: normalizeTicketmasterEvent(result.data) };
}

/** Clear only the in-memory public event cache (for manual refresh controls). */
export function clearTicketmasterCache() {
  responseCache.clear();
}
