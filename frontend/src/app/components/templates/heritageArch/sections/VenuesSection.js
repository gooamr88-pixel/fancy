'use client';

import React, { useState } from 'react';
import { HERITAGE_ARCH_COLORS as C } from '../defaultContent';
import { SectionShell, SectionHeading, DayTabs, ScrollToRsvpHint, MapEmbed, getDirectionsUrl } from '../shared';

export default function VenuesSection({ venues, isRTL, t }) {
  const [day, setDay] = useState('day1');
  const venue = (venues && venues[day]) || {};

  return (
    <SectionShell>
      <SectionHeading isRTL={isRTL}>{isRTL ? 'الأماكن' : 'Venues'}</SectionHeading>
      <DayTabs value={day} onChange={setDay} isRTL={isRTL} />

      <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {venue.image && (
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${C.border}`, maxHeight: '220px' }}>
            <img src={venue.image} alt={venue.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        <MapEmbed lat={venue.lat} lng={venue.lng} address={venue.address} />

        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '22px', color: C.maroon, margin: '4px 0' }}>{venue.name}</h3>
          {venue.address && <p style={{ fontSize: '14px', color: C.ink, opacity: 0.8, margin: 0 }}>{venue.address}</p>}
        </div>

        {(venue.address || (venue.lat != null && venue.lng != null)) && (
          <a
            href={getDirectionsUrl(venue.lat, venue.lng, venue.address)}
            target="_blank" rel="noopener noreferrer"
            style={{
              alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 26px', borderRadius: '999px', border: `1px solid ${C.maroon}`,
              color: C.maroon, textDecoration: 'none', fontWeight: 700, fontSize: '13px',
              letterSpacing: '0.04em', fontFamily: 'var(--font-sans)',
            }}
          >
            {isRTL ? 'احصل على الاتجاهات' : 'Get directions'}
          </a>
        )}
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
