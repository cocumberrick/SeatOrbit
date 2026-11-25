const STORAGE_KEY = 'clc_pending_stripe_fan_flag_v1';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function savePendingFanFlagCheckout(draft) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      createdAt: Date.now(),
      referenceId: String(draft.referenceId),
      section: String(draft.section),
      row: Number(draft.row),
      seat: Number(draft.seat),
      dataUrl: String(draft.dataUrl)
    }));
    return { ok: true };
  } catch (_error) {
    return {
      ok: false,
      message: 'This browser could not keep the photo for the Stripe return. Checkout was not started and the photo was not saved.'
    };
  }
}

export function takePendingFanFlagCheckout() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const draft = JSON.parse(raw);
    const age = Date.now() - Number(draft.createdAt);
    if (draft.version !== 1 || !Number.isFinite(age) || age < 0 || age > DRAFT_MAX_AGE_MS) return null;
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(String(draft.referenceId || ''))) return null;
    if (!Number.isInteger(draft.row) || draft.row < 1 || !Number.isInteger(draft.seat) || draft.seat < 1) return null;
    if (typeof draft.dataUrl !== 'string' || !draft.dataUrl.startsWith('data:image/')) return null;
    return draft;
  } catch (_error) {
    return null;
  }
}
