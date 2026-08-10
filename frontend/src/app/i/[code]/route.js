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
function notFound(request, reason) {
  console.warn(`[short-link] ${reason}`);
  return NextResponse.redirect(new URL('/?link=invalid', request.url), 307);
}

/**
 * A hostname with any leading `www.` folded away, for comparison only.
 *
 * nginx serves fancyrsvp.com and www.fancyrsvp.com from the same application,
 * so they are not different sites and must not be treated as a redirect off our
 * own domain.
 */
const bareHost = (host) => String(host || '').toLowerCase().replace(/^www\./, '');

export async function GET(request, { params }) {
  const { code } = await params;

  // Reject obvious junk before spending a network call on it. The alphabet is
  // lowercase alphanumeric and codes are 8 characters; anything else is a
  // scanner, and scanners should not get to make us do work.
  if (!code || code.length > 32 || !/^[a-z0-9]+$/i.test(code)) {
    return notFound(request, `malformed code: ${String(code).slice(0, 40)}`);
  }

  try {
    const res = await fetch(`${API_URL}/public/links/${encodeURIComponent(code.toLowerCase())}`, {
      cache: 'no-store',
      // A guest is staring at a blank tab while this runs. If the API is slow, a
      // redirect to somewhere useful beats an indefinite spinner — and the link
      // still works on a retry.
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return notFound(request, `api returned ${res.status} for ${code}`);

    const data = await res.json();
    if (!data?.url) return notFound(request, `api returned no url for ${code}`);

    // Resolve against the current origin so a stored relative target can never
    // become an open redirect to another host. Targets are written server-side
    // and should always be absolute and ours, but this endpoint is anonymous and
    // "should always be" is not a security control.
    const target = new URL(data.url, request.url);
    const here = new URL(request.url);

    /**
     * HOSTNAME, not origin — and that distinction was breaking every link in
     * production.
     *
     * `request.url` is built by Next from the connection it actually received.
     * Behind nginx that connection is plain HTTP to 127.0.0.1:3000, and Next
     * does not rewrite the scheme from X-Forwarded-Proto, so `here.origin` is
     * "http://fancyrsvp.com". Every stored target, meanwhile, is minted by
     * backend/utils/publicUrl.getPublicBaseUrl, which STRICTLY PREFERS the
     * https origin — "https://fancyrsvp.com".
     *
     * Those two strings can never be equal in production, so the old
     * `target.origin !== here.origin` rejected 100% of valid links and sent
     * every guest to the homepage. It passed in local development, where both
     * sides are http://localhost:3000, which is why it shipped.
     *
     * Scheme and port are therefore not comparable behind a proxy. The question
     * this check exists to ask is "could this send a guest somewhere that is not
     * us", and the hostname is the part that answers it — an attacker still
     * cannot point a code at another domain.
     */
    if (bareHost(target.hostname) !== bareHost(here.hostname)) {
      return notFound(request, `target host ${target.hostname} is not ${here.hostname}`);
    }

    // Redirect to the STORED target, so the guest lands on the canonical https
    // origin rather than being bounced through http by whatever scheme this
    // handler happened to observe.
    //
    // 307, not 301: a permanent redirect would be cached by the guest's browser
    // forever, and these targets legitimately move.
    return NextResponse.redirect(target, 307);
  } catch (err) {
    return notFound(request, `lookup failed for ${code}: ${err?.message || err}`);
  }
}
