import Navbar from '../components/landing/Navbar';
import FooterSection from '../components/landing/FooterSection';
import PricingClient from './PricingClient';
import { fetchPricing } from './pricingFetch';
import { buildFaqs, priceOf, SITE } from './pricingData';
import { safeJsonLdHtml } from '../utils/jsonLdSafe.mjs';

/* ═══════════════════════════════════════════════════════════════════════════
   /pricing — the SERVER half.

   This route was a 1,163-line 'use client' page with no layout.js and no
   metadata of any kind: no title, no description, no canonical, no Open
   Graph. It has been listed in sitemap.js the whole time, so search engines
   were being pointed at a page that could not describe itself — and, because
   the tiers were fetched in an effect, at a pricing page whose HTML contained
   the words "Loading plans…" where the prices belong.

   The split follows /shop: a Server Component fetches once, describes the
   page, emits the structured data, and hands the values to a client child for
   the parts that genuinely need state (the accordion, the plan finder). The
   prices are now in the HTML.
   ═══════════════════════════════════════════════════════════════════════════ */

const DESCRIPTION =
  'One price per event, paid once — never a monthly subscription. Compare plans by guest '
  + 'numbers, seating, texting and door check-in, and start free.';

export async function generateMetadata() {
  const data = await fetchPricing();
  const fixed = (data?.tiers || []).filter((t) => !t.is_custom && t.price_cents > 0);
  const cheapest = fixed.sort((a, b) => a.price_cents - b.price_cents)[0];

  /* The real starting price when we have one, so the search result says
     something a hardcoded sentence could not keep true through an admin's
     next price change. */
  const description = cheapest
    ? `${DESCRIPTION} Paid plans from ${priceOf(cheapest).amount} per event.`
    : DESCRIPTION;
  const title = 'Pricing | Fancy RSVP';

  return {
    title,
    description,
    alternates: { canonical: `${SITE}/pricing` },
    openGraph: {
      title,
      description,
      url: `${SITE}/pricing`,
      siteName: 'Fancy RSVP',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * Product + AggregateOffer, built from the SAME tiers the page renders.
 *
 * The custom/quoted tier is deliberately excluded from the price range: it has
 * no price_cents, and publishing a 0 for it would advertise a low price of
 * zero for a plan that is quoted by a human.
 */
function structuredData(tiers, faqs) {
  const priced = tiers.filter((t) => !t.is_custom);
  const amounts = priced.map((t) => (Number(t.price_cents) || 0) / 100);

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Fancy RSVP',
    description: DESCRIPTION,
    url: `${SITE}/pricing`,
    brand: { '@type': 'Brand', name: 'Fancy RSVP' },
    ...(amounts.length > 0 && {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: Math.min(...amounts).toFixed(2),
        highPrice: Math.max(...amounts).toFixed(2),
        offerCount: priced.length,
        offers: priced.map((t) => ({
          '@type': 'Offer',
          name: t.name,
          price: ((Number(t.price_cents) || 0) / 100).toFixed(2),
          priceCurrency: 'USD',
          url: `${SITE}/pricing`,
          availability: 'https://schema.org/InStock',
        })),
      },
    }),
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return [product, faqPage];
}

export default async function PricingPage() {
  const data = await fetchPricing();
  const tiers = data?.tiers || [];
  const faqs = buildFaqs(tiers, { stripeEnabled: data?.features?.stripeEnabled });
  const blocks = tiers.length > 0 ? structuredData(tiers, faqs) : [];

  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(block) }}
        />
      ))}
      <Navbar />
      {/* featureCatalog is fetched but not passed on: the only thing that
          consumed it was the comparison table, removed 2026-08-21. It stays
          in the endpoint because it is the registry's category and
          "charged separately" note — the data a comparison would need if one
          returns, desktop-only. */}
      <PricingClient tiers={tiers} faqs={faqs} unavailable={data === null} />
      <FooterSection />
    </>
  );
}
