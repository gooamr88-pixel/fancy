import { Suspense } from 'react';
import EventPageClient from './EventPageClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

async function fetchEvent(slug) {
  try {
    const res = await fetch(`${API_URL}/public/events/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.event || null;
  } catch {
    return null;
  }
}

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
  const images = event.cover_image_url
    ? [{ url: event.cover_image_url, width: 1200, height: 630, alt: event.title }]
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
