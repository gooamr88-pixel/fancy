import { cache } from 'react';

/* Loopback for server-side fetches — see the comment in blog/[slug]/page.js. */
const API_URL = process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:5000/api/v1';

export const SITE = 'https://fancyrsvp.com';

/**
 * The whole catalogue in one call: products, categories, badges and settings.
 *
 * `cache()` so generateMetadata() and the page component of the same render
 * share ONE backend call rather than each making their own — the pattern
 * blog/page.js established.
 *
 * Shared by /shop and /shop/[category] because the endpoint returns everything
 * anyway; a per-category endpoint would be a second query shape to keep in
 * step with this one for no fewer round trips.
 */
export const fetchShop = cache(async () => {
  try {
    const res = await fetch(`${API_URL}/public/shop`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
});
