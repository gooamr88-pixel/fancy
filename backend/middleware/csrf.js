/**
 * CSRF protection via Origin/Referer validation (fixes M2).
 *
 * Cookie‑based auth means a cross‑site page could try to drive a state‑changing
 * request on the victim's behalf. `SameSite=Lax` already blocks the cookie on
 * most cross‑site requests, but we add a second, independent layer that needs NO
 * client changes: verify the browser‑supplied Origin (or Referer) against the
 * same allowlist CORS uses.
 *
 * Design (deliberately non‑breaking):
 *  • Safe methods (GET/HEAD/OPTIONS) are never checked.
 *  • The Stripe webhook is exempt — it's a signed, server‑to‑server call with no
 *    browser Origin.
 *  • We only REJECT when an Origin/Referer is present AND not allowlisted. A
 *    genuine cross‑site forged POST always carries the attacker's Origin, so it's
 *    blocked. Non‑browser/API clients (curl, mobile w/ Bearer) send neither and
 *    cannot be CSRF'd, so they pass untouched — nothing in the existing app
 *    breaks, because same‑origin requests send a matching Origin.
 *
 * This mirrors the CSRF strategy used by frameworks like Django/Rails.
 */
const { getAllowedOrigins } = require('../utils/publicUrl');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Returns true if a URL string's origin is in the allowlist; null when unparseable. */
function isAllowedOrigin(value) {
  try {
    const u = new URL(value);
    return getAllowedOrigins().includes(`${u.protocol}//${u.host}`);
  } catch {
    return false;
  }
}

function csrfOriginGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  // Stripe webhook: server‑to‑server, Stripe‑signature‑verified, no browser Origin.
  if (req.originalUrl && req.originalUrl.startsWith('/api/v1/payments/webhook')) return next();

  const source = req.headers.origin || req.headers.referer || req.headers.referrer || '';
  if (source && !isAllowedOrigin(source)) {
    return res.status(403).json({
      success: false,
      error: 'CSRF_ORIGIN_REJECTED',
      message: 'This request was blocked because its origin is not trusted.',
    });
  }

  next();
}

module.exports = {
  csrfOriginGuard,
  isAllowedOrigin,
  get allowedOrigins() {
    return getAllowedOrigins();
  }
};
