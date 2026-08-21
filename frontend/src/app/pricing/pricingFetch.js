import { cache } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   FETCHING THE LIVE TIERS, ON THE SERVER.

   Its own module, apart from pricingData.js, for one concrete reason: that
   file holds pure helpers and PricingClient.js — a 'use client' component —
   imports them. A module without a client boundary that a client component
   imports gets bundled FOR THE BROWSER, and `cache(...)` here is a top-level
   call, i.e. a module-scope side effect, so no tree-shake removes it. Keeping
   the fetch separate means the browser never receives it, nor the API-URL
   resolution below.

   Only Server Components import this file.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Loopback for server-side fetches — see the comment in blog/[slug]/page.js. */
const API_URL = process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:5000/api/v1';

/**
 * The live tiers, fetched on the SERVER.
 *
 * Until now /pricing read its prices through usePublicPricing() in an effect,
 * which meant the HTML shipped with the words "Loading plans…" where the
 * prices belong: a crawler saw a pricing page with no prices on it, and a
 * visitor saw the whole plan section appear after first paint and shove the
 * page down. Neither is fixable on the client.
 *
 * `cache()` so generateMetadata() and the page component of the same render
 * share ONE backend call instead of each making their own — the pattern
 * blog/page.js established and shop/shopData.js follows.
 *
 * A failure returns null rather than throwing: pricing being briefly
 * unreachable must degrade to "call us", never to a 500 on a marketing page.
 */
export const fetchPricing = cache(async () => {
  try {
    const res = await fetch(`${API_URL}/payments/public-pricing`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.tiers)) return null;
    /* `featureCatalog` is NOT carried through. The endpoint still sends it —
       it is the registry's categories and its "charged separately" notes, and
       withdrawing it server-side would leave a future comparison to reinvent
       that wording — but the only thing that consumed it here was the
       comparison table, removed 2026-08-21. Passing it on so that nothing
       reads it just moves the dead weight into the page's props. One line to
       add back on the day a desktop-only comparison returns. */
    return {
      tiers: data.tiers,
      features: data.features || {},
    };
  } catch {
    return null;
  }
});
