import { Suspense, cache } from 'react';
import EventPageClient from './EventPageClient';
import { safeJsonLdHtml } from '../utils/jsonLdSafe.mjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// PERF-2: React.cache() dedupes this within a single render so generateMetadata()
// and the page component share ONE backend call instead of two.
// PERF-1: the public landing payload is guest-agnostic (the personalized guestRsvp
// is fetched client-side in EventPageClient), so a short revalidate window puts the
// most-shared URL behind a cache instead of hitting the backend+DB on every view.
const fetchEvent = cache(async (slug) => {
  try {
    const res = await fetch(`${API_URL}/public/events/${slug}`, {
      next: { revalidate: 60 },
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

export default async function EventPage({ params }) {
  const { slug } = await params;
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

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(jsonLd) }}
        />
      )}
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        </div>
      }>
        <EventPageClient initialEvent={event} slug={slug} />
      </Suspense>
    </>
  );
}
