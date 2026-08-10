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

/**
 * Where an unknown or malformed code lands.
 *
 * The homepage, not a 404 page. Someone holding a dead invitation link is a
 * guest, not an error — dropping them somewhere they can search for the event
 * or contact the couple beats a stack of technical apology.
 *
 * `reason` is logged, never shown. Every failure here used to land on
 * `?link=expired`, which was wrong twice over: nothing in this system expires
 * (short_links has no expiry column and nothing prunes it), and collapsing four
 * different faults into one word meant a total outage of the redirect looked
 * identical to a guest mistyping a code. When every link in production is
 * failing, the difference between "no such code" and "could not reach the API"
 * is the whole diagnosis.
 */
function notFound(reason) {
  console.warn(`[short-link] ${reason}`);
  return relativeRedirect('/?link=invalid');
}

/**
 * Redirect to a path on WHATEVER origin the browser is already using.
 *
 * ── Why not NextResponse.redirect ──
 *
 * That helper requires an absolute URL, and the only origin available here is
 * `request.url` — which is not this site's. Next builds it from the socket the
 * Node process is listening on, so behind nginx it is `http://localhost:3000`
 * even though nginx forwards `Host: fancyrsvp.com` correctly. Production proved
 * it:
 *
 *     [short-link] target host fancyrsvp.com is not localhost
 *
 * An absolute redirect built from that sends the guest to `localhost:3000` — their
 * own device. So no comparison against `request.url`, and nothing derived from it,
 * can be trusted for identity: not the scheme, not the host, not the port.
 *
 * ── Why a relative Location is the right answer ──
 *
 * RFC 7231 allows a relative reference in `Location`, and the browser resolves it
 * against the page it is already on. That makes this correct on apex and www, on
 * http and https, on any port, and on a laptop running `next dev` — without the
 * server needing to know its own name.
 *
 * It also makes an open redirect impossible BY CONSTRUCTION rather than by a check
 * somebody has to keep correct: only a path survives, so a hostile `target_url`
 * pointing at another domain can at worst land the guest on a 404 of ours.
 */
function relativeRedirect(pathAndQuery) {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: pathAndQuery, 'Cache-Control': 'no-store' },
  });
}

export async function GET(request, { params }) {
  const { code } = await params;

  // Reject obvious junk before spending a network call on it. The alphabet is
  // lowercase alphanumeric and codes are 8 characters; anything else is a
  // scanner, and scanners should not get to make us do work.
  if (!code || code.length > 32 || !/^[a-z0-9]+$/i.test(code)) {
    return notFound(`malformed code: ${String(code).slice(0, 40)}`);
  }

  try {
    const res = await fetch(`${API_URL}/public/links/${encodeURIComponent(code.toLowerCase())}`, {
      cache: 'no-store',
      // A guest is staring at a blank tab while this runs. If the API is slow, a
      // redirect to somewhere useful beats an indefinite spinner — and the link
      // still works on a retry.
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return notFound(`api returned ${res.status} for ${code}`);

    const data = await res.json();
    if (!data?.url) return notFound(`api returned no url for ${code}`);

    /**
     * Keep only the PATH. The host is deliberately thrown away.
     *
     * Two previous attempts compared the stored target against `request.url` —
     * first by origin, then by hostname. Both were wrong for the same underlying
     * reason, and production said so plainly:
     *
     *     [short-link] target host fancyrsvp.com is not localhost
     *
     * `request.url` is built from the socket Next is listening on, so it is
     * `http://localhost:3000` no matter what nginx forwards. Nothing derived from
     * it identifies this site — not the scheme, not the host, not the port — so
     * every comparison against it rejected every real link.
     *
     * Discarding the host removes the comparison rather than fixing it. The
     * browser resolves a relative Location against the origin it is already on, so
     * the guest lands on the site they came from, and a `target_url` pointing
     * anywhere else can only ever produce a path on ours.
     *
     * `new URL(data.url, 'http://x')` is a parser, not a destination — the base is
     * a throwaway that lets a stored relative path parse identically to an
     * absolute one.
     */
    const target = new URL(data.url, 'http://placeholder.invalid');
    const path = `${target.pathname}${target.search}${target.hash}`;

    // 307, not 301: a permanent redirect would be cached by the guest's browser
    // forever, and these targets legitimately move.
    return relativeRedirect(path || '/');
  } catch (err) {
    return notFound(`lookup failed for ${code}: ${err?.message || err}`);
  }
}
