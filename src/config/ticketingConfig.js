/**
 * Ticketmaster integration settings.
 *
 * Discovery API consumer keys are browser-visible. Never put private credentials here.
 * Ticket links remain outbound links; this application does not sell or reserve seats.
 */
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

export const TICKETING = Object.freeze({
  apiBaseUrl: 'https://app.ticketmaster.com/discovery/v2',
  apiKey: String(env.VITE_TICKETMASTER_API_KEY || '').trim(),
  eventId: String(env.VITE_TICKETMASTER_EVENT_ID || '').trim(),
  venueId: String(env.VITE_TICKETMASTER_VENUE_ID || '').trim(),
  venueName: String(env.VITE_TICKETMASTER_VENUE_NAME || 'Canada Life Centre').trim(),
  affiliateUrl: String(env.VITE_TICKETMASTER_URL || '').trim(),
  cacheTtlMs: 5 * 60 * 1000
});

function httpsUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Returns a validated fallback affiliate link, or null if it is not configured. */
export function getTicketUrl() {
  return httpsUrl(TICKETING.affiliateUrl);
}

/** Event URLs come from Ticketmaster's API and must also be HTTPS before opening. */
export function validateTicketUrl(value) {
  return httpsUrl(value);
}
