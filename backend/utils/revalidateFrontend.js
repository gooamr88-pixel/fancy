const logger = require('./logger');

/**
 * Drops the Next.js cache entry for an event page as soon as its data changes.
 *
 * The public event page caches the payload this API returns for 60s. That is
 * the right call for the most-shared URL on the platform, but the window
 * applies to misses as well as hits, so without an explicit purge a brand-new
 * event answers "not found" for a minute and a deleted one keeps answering.
 *
 * Called over LOOPBACK, never the public hostname: nginx routes every /api/*
 * path on the public host to this backend, so the frontend handler is only
 * reachable at 127.0.0.1:3000 — which also means it is not exposed publicly.
 */

const FRONTEND_URL = process.env.INTERNAL_FRONTEND_URL || 'http://127.0.0.1:3000';

// Must match eventCacheTag() in frontend/src/app/[slug]/page.js exactly.
const eventCacheTag = (slug) => `event:${slug}`;

/**
 * Invalidates the cached page for one or more event slugs.
 *
 * BEST EFFORT BY DESIGN. A failure here means a stale page for up to 60s; it
 * must never turn a successful event create/update/delete into an error the
 * organizer sees, and must never delay the response. Every path resolves, and
 * failures are logged at warn rather than thrown.
 *
 * @param {string|string[]} slugs - slug(s) whose cached page should be dropped.
 *   Nullish entries are ignored, so callers can pass an old slug that may not
 *   exist without guarding at the call site.
 * @returns {Promise<boolean>} whether the purge was accepted.
 */
async function revalidateEventSlugs(slugs) {
  const list = (Array.isArray(slugs) ? slugs : [slugs]).filter(
    (s) => typeof s === 'string' && s.length > 0,
  );
  if (list.length === 0) return false;

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // Deliberately warn every time rather than staying silent: the symptom of a
    // missing secret is stale pages, which reads as a caching bug and costs far
    // more to diagnose than this line costs to emit.
    logger.warn(
      { slugs: list },
      'revalidateEventSlugs: REVALIDATE_SECRET is not set — event pages will stay cached for up to 60s',
    );
    return false;
  }

  try {
    const res = await fetch(`${FRONTEND_URL}/api/internal/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ tags: list.map(eventCacheTag) }),
      // The frontend is on the same box over loopback. If it cannot answer in
      // two seconds it is down or wedged, and waiting longer only delays the
      // organizer's response for a cache purge that is already best-effort.
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      logger.warn(
        { status: res.status, slugs: list },
        'revalidateEventSlugs: frontend refused the purge',
      );
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, slugs: list }, 'revalidateEventSlugs: purge failed');
    return false;
  }
}

module.exports = { revalidateEventSlugs, eventCacheTag };
