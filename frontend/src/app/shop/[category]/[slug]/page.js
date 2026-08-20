import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import Navbar from '../../../components/landing/Navbar';
import FooterSection from '../../../components/landing/FooterSection';
import ProductClient from './ProductClient';
import { safeJsonLdHtml } from '../../../utils/jsonLdSafe.mjs';
import { SHOP_CURRENCY } from '../../../utils/shopLinks';
import { SITE } from '../../shopData';

/**
 * ONE PIECE — /shop/<category>/<slug>.
 *
 * The slug is still the identity (the backend looks a product up by slug
 * alone); the category segment is there so the URL says where the piece sits
 * and the breadcrumb has something true to render. A request whose category
 * segment does not match the product's real category REDIRECTS to the correct
 * one rather than rendering — otherwise the same product would be reachable,
 * and indexable, at six different URLs.
 */

// Loopback for server-side fetches — see the comment in blog/[slug]/page.js.
const API_URL = process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:5000/api/v1';

// Cached within a single render so generateMetadata() and the page component
// share ONE backend call.
const fetchProduct = cache(async (slug) => {
  try {
    const res = await fetch(`${API_URL}/public/shop/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
});

/** The category segment a product actually belongs under. */
function categorySlugOf(product) {
  return product?.category?.slug || product?.category_slug || 'all';
}

export async function generateMetadata({ params }) {
  const { category, slug } = await params;
  const data = await fetchProduct(slug);
  const product = data?.product;

  if (!product) return { title: 'Not Found | Fancy RSVP' };

  const cat = categorySlugOf(product);
  const title = `${product.meta_title || product.title} | Shop | Fancy RSVP`;
  const description = product.meta_description
    || product.tagline
    || `${product.title} — from the Fancy RSVP shop.`;
  // Canonical always points at the product's OWN category, never at whatever
  // segment the request happened to use.
  const canonicalUrl = `${SITE}/shop/${cat}/${slug}`;
  const cover = product.images?.[0]?.url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Fancy RSVP',
      type: 'website',
      images: cover
        ? [{ url: cover, width: 1200, height: 630, alt: product.title }]
        : [{ url: `${SITE}/og-image.png`, width: 1200, height: 630, alt: 'Fancy RSVP' }],
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: canonicalUrl },
  };
}

export default async function ShopProductPage({ params }) {
  const { category, slug } = await params;
  const data = await fetchProduct(slug);

  // Covers all three of: unpublished, deleted, and the whole section switched
  // off by an admin. The backend answers 404 for each, so the page genuinely
  // stops existing rather than rendering an empty shell.
  if (!data?.product) notFound();

  const { product, related = [], settings = {} } = data;

  const cat = categorySlugOf(product);
  if (cat !== category) redirect(`/shop/${cat}/${slug}`);

  const url = `${SITE}/shop/${cat}/${slug}`;

  /**
   * Product schema.
   *
   * `offers` is emitted ONLY when there is a real price. A piece sold by quote
   * has no price to state, and inventing `"price": "0"` to satisfy the shape
   * would publish a structured-data claim that it is free — the exact lie the
   * null price exists to avoid. Availability likewise reflects the sold-out
   * flag rather than always claiming InStock.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.meta_description || product.tagline || product.description || undefined,
    image: (product.images || []).map((i) => i.url).slice(0, 6),
    brand: { '@type': 'Brand', name: 'Fancy RSVP' },
    url,
    ...(product.price_cents != null
      ? {
        offers: {
          '@type': 'Offer',
          price: (product.price_cents / 100).toFixed(2),
          priceCurrency: product.currency || SHOP_CURRENCY,
          availability: product.is_sold_out
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
          url,
        },
      }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(jsonLd) }}
      />
      <Navbar />
      <ProductClient product={product} related={related} settings={settings} />
      <FooterSection />
    </>
  );
}
