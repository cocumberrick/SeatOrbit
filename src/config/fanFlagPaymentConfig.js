const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const rawPaymentUrl = String(env.VITE_STRIPE_FAN_FLAG_PAYMENT_URL || '').trim();

function readStripePaymentLink(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const allowedHost = url.hostname === 'buy.stripe.com' || url.hostname === 'checkout.stripe.com';
    if (url.protocol !== 'https:' || !allowedHost || url.username || url.password) return null;
    return url;
  } catch (_error) {
    return null;
  }
}

const stripePaymentLink = readStripePaymentLink(rawPaymentUrl);

export const STRIPE_FAN_FLAG_PAYMENT_CONFIGURED = !!stripePaymentLink;

/** Builds the public Stripe Payment Link and attaches the stable section_row_seat reference. */
export function getFanFlagPaymentUrl(sectionRowSeatKey) {
  if (!stripePaymentLink) return null;
  const url = new URL(stripePaymentLink.href);
  const reference = String(sectionRowSeatKey || '');
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(reference)) return null;
  url.searchParams.set('client_reference_id', reference);
  return url.href;
}
