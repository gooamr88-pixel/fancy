import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * Cache invalidation hook for the Express backend.
 *
 * The public event page caches its backend payload for 60s (see
 * src/app/[slug]/page.js). That window is worth keeping — the most-shared URL
 * on the platform should not hit the API and the database on every view — but
 * a 60s window applied blindly means an organizer who has just created, moved
 * or deleted an event watches a stale page and concludes the product is
 * broken. The 404 case was the worst of them: a miss is cached exactly like a
 * hit, so a brand-new event read "not found" for a minute after it went live.
 *
 * So the backend tells us the moment a slug's data changes, and the tagged
 * cache entry is dropped immediately instead of aging out.
 *
 * NOT PUBLICLY REACHABLE. nginx routes every /api/* path on the public
 * hostname to the backend on :5000 (deployment/nginx.conf), so this handler is
 * only addressable over loopback at 127.0.0.1:3000, which is exactly how the
 * backend calls it. The shared secret is the second layer, for the case where
 * that routing changes or something else on the box can reach the port.
 */

// Route handlers are static-analysed by default; this one must run per request.
export const dynamic = 'force-dynamic';

function secretMatches(provided, expected) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak length
  // through the error path — compare lengths first and keep the comparison
  // constant-time only for equal-length inputs.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request) {
  const expected = process.env.REVALIDATE_SECRET;

  // Fail closed. Without a configured secret this endpoint would accept
  // anything that can reach the port, so it refuses to work at all instead.
  if (!expected) {
    return NextResponse.json(
      { revalidated: false, error: 'REVALIDATE_SECRET is not configured' },
      { status: 503 },
    );
  }

  if (!secretMatches(request.headers.get('x-revalidate-secret') || '', expected)) {
    return NextResponse.json({ revalidated: false, error: 'Forbidden' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ revalidated: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t) => typeof t === 'string' && t.length > 0 && t.length <= 256)
    : [];

  if (tags.length === 0) {
    return NextResponse.json({ revalidated: false, error: 'No tags supplied' }, { status: 400 });
  }

  for (const tag of tags) {
    revalidateTag(tag);
  }

  return NextResponse.json({ revalidated: true, tags });
}
