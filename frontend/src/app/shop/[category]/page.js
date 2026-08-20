import { notFound } from 'next/navigation';
import Navbar from '../../components/landing/Navbar';
import FooterSection from '../../components/landing/FooterSection';
import ShopBrowse from '../ShopBrowse';
import { fetchShop, SITE } from '../shopData';
import { safeJsonLdHtml } from '../../utils/jsonLdSafe.mjs';

/**
 * ONE SHELF — /shop/<category-slug>.
 *
 * Renders the same ShopBrowse as /shop with the shelf pre-selected, so the two
 * cannot drift into different card designs or different filter behaviour.
 *
 * A slug that is not a published category 404s rather than falling back to the
 * full catalogue: silently showing everything under a wrong URL is how a
 * mistyped link ends up indexed as a duplicate of the shop home.
 */

export async function generateMetadata({ params }) {
  const { category } = await params;
  const data = await fetchShop();
  const shelf = (data?.categories || []).find((c) => c.slug === category);
  if (!shelf) return { title: 'Not found | Fancy RSVP' };

  const title = `${shelf.name} | Shop | Fancy RSVP`;
  const description = shelf.description
    || `${shelf.name} from Fancy RSVP — priced per unit in US dollars.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE}/shop/${shelf.slug}`,
      siteName: 'Fancy RSVP',
      type: 'website',
      images: [{ url: `${SITE}/og-image.png`, width: 1200, height: 630, alt: 'Fancy RSVP' }],
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `${SITE}/shop/${shelf.slug}` },
  };
}

export default async function ShopCategoryPage({ params }) {
  const { category } = await params;
  const data = await fetchShop();

  if (data && data.enabled === false) notFound();

  const categories = data?.categories || [];
  const shelf = categories.find((c) => c.slug === category);
  if (!shelf) notFound();

  const products = data?.products || [];
  const mine = products.filter((p) => p.category_id === shelf.id);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: shelf.name,
    description: shelf.description || undefined,
    numberOfItems: mine.length,
    itemListElement: mine.slice(0, 30).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.title,
      url: `${SITE}/shop/${shelf.slug}/${p.slug}`,
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
        settings={data?.settings || {}}
        category={shelf.slug}
      />
      <FooterSection />
    </>
  );
}
