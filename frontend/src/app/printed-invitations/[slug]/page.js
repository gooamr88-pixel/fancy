import { permanentRedirect } from 'next/navigation';

/* Loopback for server-side fetches — see the comment in blog/[slug]/page.js. */
const API_URL = process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:5000/api/v1';

/**
 * /printed-invitations/<slug> → /shop/<category>/<slug>
 *
 * The product URL gained a category segment, so this cannot be a static
 * redirect: it has to look the piece up to learn which shelf it is on.
 *
 * When that lookup fails — backend down, product unpublished, slug never
 * existed — the redirect falls back to /shop rather than 404ing. A dead
 * product link landing on the catalogue is a worse outcome than landing on the
 * product and a better one than landing on nothing, and the alternative
 * (guessing a category segment) would produce a URL that redirects again.
 */
async function categoryFor(slug) {
  try {
    const res = await fetch(`${API_URL}/public/shop/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.product?.category?.slug || null;
  } catch {
    return null;
  }
}

export default async function PrintedInvitationProductRedirect({ params }) {
  const { slug } = await params;
  const category = await categoryFor(slug);
  permanentRedirect(category ? `/shop/${category}/${slug}` : '/shop');
}
