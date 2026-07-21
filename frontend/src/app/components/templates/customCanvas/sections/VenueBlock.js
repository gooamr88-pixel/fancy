'use client';

import React from 'react';
import { FadeInUp } from '../../../guest/GuestAnimations';
import { MapEmbed, getDirectionsUrl } from '../../heritageArch/shared';
import { useLiteralTheme } from '../theme';

/* VenueBlock — venue name/address chrome plus the reference's Google Maps
   embed + "Get Directions" button. MapEmbed/getDirectionsUrl are reused
   as-is from heritageArch/shared.js rather than rebuilt — same real
   lat/lng + Place ID data every other template already uses. */
export default function VenueBlock({ venue, isRTL }) {
  const C = useLiteralTheme();
  if (!venue?.name && !venue?.address) return null;

  return (
    <div style={{
      minHeight: '70dvh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
      background: C.background, padding: 'clamp(48px, 10vh, 80px) 24px', boxSizing: 'border-box',
    }}>
      <FadeInUp>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.6" aria-hidden="true">
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.4" />
          </svg>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: C.gold, fontSize: 'clamp(24px, 4.5vw, 34px)', margin: 0 }}>
            {venue.name}
          </h2>
          {venue.address && (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: C.ink, opacity: 0.85 }}>
              {venue.address}
            </span>
          )}
        </div>
      </FadeInUp>

      <FadeInUp delay={0.1} style={{ width: '100%', maxWidth: 500 }}>
        <MapEmbed lat={venue.lat} lng={venue.lng} address={venue.address} height="280px" />
      </FadeInUp>

      {(venue.lat != null || venue.address) && (
        <a
          href={getDirectionsUrl(venue.lat, venue.lng, venue.address)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
            background: C.gold, color: C.paper, fontFamily: 'var(--font-sans)', fontWeight: 700,
            fontSize: 14, padding: '12px 26px', borderRadius: 999,
            boxShadow: `0 10px 24px -8px ${C.gold}88`, transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
          </svg>
          {isRTL ? 'احصل على الاتجاهات' : 'Get Directions'}
        </a>
      )}
    </div>
  );
}
