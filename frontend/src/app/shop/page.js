import { notFound } from 'next/navigation';
import Navbar from '../components/landing/Navbar';
import FooterSection from '../components/landing/FooterSection';
import ShopBrowse from './ShopBrowse';
import { fetchShop, SITE } from './shopData';
import { safeJsonLdHtml } from '../utils/jsonLdSafe.mjs';

/**
 * THE SHOP — every piece, with the category shelves on top.
 *
 * Replaces /printed-invitations, which named a sixth of what is now sold here
 * (that route redirects; see printed-invitations/page.js).
 */

export async function generateMetadata() {
  const data = await fetchShop();
  const s = data?.settings || {};
  const title = `${s.hero_title || 'Shop'} | Fancy RSVP`;
  const description = s.hero_subtitle
    || 'Printed invitations, envelopes, signage, screens and door hardware — priced per unit in US dollars, made to the same artwork as your digital invitation.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE}/shop`,
      siteName: 'Fancy RSVP',
      type: 'website',
      images: [{ url: `${SITE}/og-image.png`, width: 1200, height: 630, alt: 'Fancy RSVP' }],
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `${SITE}/shop` },
  };
}

export default async function ShopPage() {
  const data = await fetchShop();

  // The admin master switch. `enabled: false` must make the URL genuinely stop
  // existing — hiding the nav link while the page still renders would leave it
  // reachable by bookmark, by search result and by anyone who saw it once.
  if (data && data.enabled === false) notFound();

  const products = data?.products || [];
  const categories = data?.categories || [];
  const settings = data?.settings || {};

  const catById = new Map(categories.map((c) => [c.id, c]));
  const urlFor = (p) => {
    const slug = catById.get(p.category_id)?.slug;
    return `${SITE}/shop/${slug || 'all'}/${p.slug}`;
  };

  // ItemList rather than a bare list of Products: this page IS a catalogue, and
  // the per-item Product/Offer markup belongs on each product's own page where
  // the price and availability actually live.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: settings.hero_title || 'Shop',
    description: settings.hero_subtitle || undefined,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 30).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.title,
      url: urlFor(p),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(jsonLd) }}
      />
      <Navbar />
      <ShopBrowse
        products={products}
        categories={categories}
        badges={data?.badges || []}
        settings={settings}
        category={null}
      />
      <FooterSection />
    </>
  );
}
