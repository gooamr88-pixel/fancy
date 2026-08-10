/**
 * SHORT-LINK FRONT DOOR — `fancyrsvp.com/i/k7m2xq4p`
 *
 * ── Why this lives on the site and not the API ──
 *
 * The entire point of a short link is character count. A GSM-7 SMS segment holds
 * 160 characters, the mandatory compliance footer takes 78, and the raw RSVP URL
 * (`/<slug>/rsvp?g=<uuid>`) is another 89 — so every text was two segments before
 * the guest's name, and every Arabic text was four.
 *
 * Putting the redirect on the API host would hand most of those characters back,
 * because the API hostname is longer than the site's and reads like a machine
 * address in a message from a number nobody recognises. So the public hop is here,
 * on the short domain, and this handler asks the backend what the code means.
 *
 * ── Why a Route Handler and not a page ──
 *
 * A guest tapping this is mid-journey; there is nothing to render and nothing to
 * hydrate. A 307 from the edge is one hop with no HTML, no JS bundle and no flash
 * of an empty layout — which also means no chance of a client-side redirect being
 * eaten by an in-app browser, which is where a great many of these links are
 * opened.
 */

import { NextResponse } from 'next/server';

// Never cached, never statically evaluated. Two reasons, and both are absolute:
// a code's destination can be repointed (a slug rename rewrites every RSVP URL in
// an event), and a cached redirect would send one guest to another guest's page
// if the CDN keyed on the path alone.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/** Where an unknown, expired or malformed code lands. */
function notFound(request) {
  // The homepage, not a 404 page. Someone holding a dead invitation link is a
  // guest, not an error — dropping them somewhere they can search for the event
  // or contact the couple beats a stack of technical apology.
  return NextResponse.redirect(new URL('/?link=expired', request.url), 307);
}

export async function GET(request, { params }) {
  const { code } = await params;

  // Reject obvious junk before spending a network call on it. The alphabet is
  // lowercase alphanumeric and codes are 8 characters; anything else is a
  // scanner, and scanners should not get to make us do work.
  if (!code || code.length > 32 || !/^[a-z0-9]+$/i.test(code)) {
    return notFound(request);
  }

  try {
    const res = await fetch(`${API_URL}/public/links/${encodeURIComponent(code.toLowerCase())}`, {
      cache: 'no-store',
      // A guest is staring at a blank tab while this runs. If the API is slow, a
      // redirect to somewhere useful beats an indefinite spinner — and the link
      // still works on a retry.
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return notFound(request);

    const data = await res.json();
    if (!data?.url) return notFound(request);

    // Resolve against the current origin so a stored relative target can never
    // become an open redirect to another host. Targets are written server-side
    // and should always be absolute and ours, but this endpoint is anonymous and
    // "should always be" is not a security control.
    const target = new URL(data.url, request.url);
    const here = new URL(request.url);
    if (target.origin !== here.origin) return notFound(request);

    // 307, not 301: a permanent redirect would be cached by the guest's browser
    // forever, and these targets legitimately move.
    return NextResponse.redirect(target, 307);
  } catch {
    return notFound(request);
  }
}
