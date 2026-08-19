import { cache } from 'react';
import { notFound } from 'next/navigation';
import Navbar from '../components/landing/Navbar';
import FooterSection from '../components/landing/FooterSection';
import ShopClient from './ShopClient';
import { safeJsonLdHtml } from '../utils/jsonLdSafe.mjs';

// Loopback for server-side fetches — see the comment in blog/[slug]/page.js.
const API_URL = process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:5000/api/v1';

const SITE = 'https://fancyrsvp.com';

/**
 * Cached within a single render so generateMetadata() and the page component
 * share ONE backend call (mirrors blog/page.js's fetchBlogPosts).
 */
const fetchShop = cache(async () => {
  try {
    const res = await fetch(`${API_URL}/public/shop`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
});

export async function generateMetadata() {
  const data = await fetchShop();
  const s = data?.settings || {};
  const title = `${s.hero_title || 'Printed Invitations'} | Fancy RSVP`;
  const description = s.hero_subtitle
    || 'Handcrafted printed wedding and event invitations — foiled, pressed and finished by hand, then delivered to your door.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE}/printed-invitations`,
      siteName: 'Fancy RSVP',
      type: 'website',
      images: [{ url: `${SITE}/og-image.png`, width: 1200, height: 630, alt: 'Fancy RSVP' }],
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `${SITE}/printed-invitations` },
  };
}

export default async function PrintedInvitationsPage() {
  const data = await fetchShop();

  // The admin master switch. `enabled: false` must make the URL genuinely stop
  // existing — hiding the nav link while the page still renders would leave it
  // reachable by bookmark, by search result and by anyone who saw it once.
  if (data && data.enabled === false) notFound();

  const products = data?.products || [];
  const settings = data?.settings || {};

  // ItemList rather than a bare list of Products: this page IS a catalogue, and
  // the per-item Product/Offer markup belongs on each product's own page where
  // the price and availability actually live.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: settings.hero_title || 'Printed Invitations',
    description: settings.hero_subtitle || undefined,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 30).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.title,
      url: `${SITE}/printed-invitations/${p.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(jsonLd) }}
      />
      <Navbar />
      <ShopClient
        products={products}
        categories={data?.categories || []}
        badges={data?.badges || []}
        settings={settings}
      />
      <FooterSection />
    </>
  );
}
