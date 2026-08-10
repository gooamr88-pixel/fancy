import { Suspense, cache } from 'react';
import EventPageClient from './EventPageClient';
import { safeJsonLdHtml } from '../utils/jsonLdSafe.mjs';
import { preloadRevealAssets } from '../components/guest/revealAssets';

// Server-side renders talk to the backend over LOOPBACK, never via the public
// hostname. Going out through https://fancyrsvp.com hairpins back in through
// nginx, which (a) makes every SSR request on the box share ONE rate-limit key —
// the server's own address — so server rendering silently dies for all guests
// after a few dozen renders, and (b) pays a full TLS round trip per render.
// NEXT_PUBLIC_API_URL is kept as the fallback so nothing breaks if the internal
// URL isn't configured, and so local dev keeps working unchanged.
const API_URL = process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:5000/api/v1';

// PERF-2: React.cache() dedupes this within a single render so generateMetadata()
// and the page component share ONE backend call instead of two.
// PERF-1: the public landing payload is guest-agnostic (the personalized guestRsvp
// is fetched client-side in EventPageClient), so a short revalidate window puts the
// most-shared URL behind a cache instead of hitting the backend+DB on every view.
// The tag lets the backend drop this entry the instant the event changes, via
// src/app/api/internal/revalidate/route.js. Without it the 60s window applies
// to MISSES too — Next caches a 404 exactly like a hit — so a newly created
// event read "not found" for a minute after going live, and a deleted one kept
// answering. The format is duplicated in backend/utils/revalidateFrontend.js;
// the two must stay identical or invalidation silently stops working.
const eventCacheTag = (slug) => `event:${slug}`;

const fetchEvent = cache(async (slug) => {
  try {
    const res = await fetch(`${API_URL}/public/events/${slug}`, {
      next: { revalidate: 60, tags: [eventCacheTag(slug)] },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.event || null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const event = await fetchEvent(slug);

  if (!event) {
    return {
      title: 'Event | Fancy RSVP',
      description: 'View event details and RSVP on Fancy RSVP.',
    };
  }

  const title = `${event.title} | Fancy RSVP`;
  const description = event.description || `RSVP to ${event.title} on Fancy RSVP.`;
  const canonicalUrl = `https://fancyrsvp.com/${slug}`;
  // Cache-bust with updated_at so Facebook/WhatsApp re-scrape the current cover image
  // instead of serving a stale preview from their own link cache after it changes.
  const ogImageUrl = event.cover_image_url
    ? `${event.cover_image_url}${event.cover_image_url.includes('?') ? '&' : '?'}v=${encodeURIComponent(event.updated_at || '')}`
    : null;
  const images = ogImageUrl
    ? [{ url: ogImageUrl, width: 1200, height: 630, alt: event.title }]
    : [{ url: 'https://fancyrsvp.com/og-image.png', width: 1200, height: 630, alt: 'Fancy RSVP' }];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Fancy RSVP',
      type: 'website',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((img) => img.url),
    },
    alternates: { canonical: canonicalUrl },
  };
}

export default async function EventPage({ params, searchParams }) {
  const { slug } = await params;
  // Read the per-guest invitation token HERE, on the server, instead of letting
  // EventPageClient call useSearchParams(). A client component reading search
  // params inside a Suspense boundary makes Next bail that whole subtree out of
  // prerendering — the shipped HTML was only the spinner fallback, so `initialEvent`
  // below never reached the browser and the entire invitation was gated on a large
  // client bundle downloading and hydrating first. Awaiting searchParams marks this
  // route dynamic, which is correct: the response genuinely varies per guest. The
  // backend payload stays cached by the fetch() revalidate window either way.
  const sp = (await searchParams) || {};
  const first = (v) => (Array.isArray(v) ? v[0] : v) || null;
  const event = await fetchEvent(slug);

  const jsonLd = event
    ? {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.title,
        description: event.description || '',
        startDate: event.event_date || undefined,
        location: {
          '@type': 'Place',
          name: event.location_name || '',
          address: event.location_address || '',
        },
        organizer: {
          '@type': 'Organization',
          name: 'Fancy RSVP',
          url: 'https://fancyrsvp.com',
        },
        image: event.cover_image_url || undefined,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      }
    : null;

  // The envelope reveal is the first thing rendered over this page, and its
  // artwork is static (the same four files for every event), so it can be
  // requested from the server render — in the initial HTML, in parallel with
  // the client's own event fetch — instead of only once the overlay mounts.
  // Deliberately unconditional: whether the reveal actually plays depends on
  // client-side state (password gate, private link, ?noreveal=1), and those
  // are the rare paths — waiting to find out would cost every normal guest
  // the head start this exists to give them.
  preloadRevealAssets();

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(jsonLd) }}
        />
      )}
      <Suspense fallback={
        <div style={{ minHeight: '100dvh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        </div>
      }>
        <EventPageClient
          initialEvent={event}
          slug={slug}
          invitationPartyId={first(sp.party_id)}
          invitationGuestId={first(sp.g)}
          noReveal={first(sp.noreveal) === '1'}
        />
      </Suspense>
    </>
  );
}
