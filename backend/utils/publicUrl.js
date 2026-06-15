/**
 * Bulletproof resolution of the public frontend origin from FRONTEND_URL.
 *
 * FRONTEND_URL is operator-supplied and has been seen malformed in the wild, e.g.
 *   "https://fancyrsvp.com,https//www.fancyrsvp.com"
 * (comma-joined list, a missing colon, trailing slashes). Naively interpolating it
 * into a Stripe success_url produced broken links like
 *   "https://fancyrsvp.com,https//www.fancyrsvp.com/dashboard?..."
 * which fail DNS resolution.
 *
 * These helpers split on commas, repair common typos, validate each entry as a real
 * URL, and hand back only clean origins — strictly preferring the first valid
 * https:// origin for anything user-facing (Stripe redirects, email links).
 */

/**
 * Normalize a single candidate origin into a clean "scheme://host[:port]" string,
 * or return null if it can't be salvaged into a valid http(s) URL.
 */
function normalizeOrigin(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let s = raw.trim();
  if (!s) return null;

  // Strip trailing slashes.
  s = s.replace(/\/+$/, '');
  // Repair the classic "https//host" / "http//host" (missing colon) typo.
  s = s.replace(/^(https?)\/\/+/i, '$1://');
  // If there's no scheme at all (bare host), assume https.
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;

  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname) return null;
    // Return origin only (scheme + host + optional port) — never a path/query.
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * All valid, de-duplicated origins parsed from FRONTEND_URL. Used for CORS so a
 * second (possibly typo'd) origin still works once repaired.
 */
function getAllowedOrigins() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:3000';
  const seen = new Set();
  const origins = [];
  for (const part of raw.split(',')) {
    const norm = normalizeOrigin(part);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      origins.push(norm);
    }
  }
  return origins.length ? origins : ['http://localhost:3000'];
}

/**
 * The single public-facing base URL for redirects and links. Strictly prefers the
 * first valid https:// origin; falls back to the first valid origin (e.g.
 * http://localhost:3000 in development), then to localhost.
 */
function getPublicBaseUrl() {
  const origins = getAllowedOrigins();
  const httpsOrigin = origins.find(o => o.startsWith('https://'));
  return httpsOrigin || origins[0] || 'http://localhost:3000';
}

module.exports = { normalizeOrigin, getAllowedOrigins, getPublicBaseUrl };
