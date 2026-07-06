'use client';

import React, { useRef } from 'react';
import { HERITAGE_ARCH_COLORS as C } from '../defaultContent';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

export default function AccommodationSection({ hotels, note, isRTL }) {
  const trackRef = useRef(null);
  const scrollByCard = (dir) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: dir * (track.clientWidth * 0.85), behavior: 'smooth' });
  };

  return (
    <SectionShell background={C.paper}>
      <SectionHeading subtitle={isRTL ? 'لقد رتبنا هذه الفنادق من أجلكم' : 'We have arranged these hotels for you'} isRTL={isRTL}>
        {isRTL ? 'الإقامة' : 'Accommodation'}
      </SectionHeading>

      {note && (
        <p style={{ maxWidth: '560px', textAlign: 'center', fontSize: '14px', color: C.ink, opacity: 0.85, whiteSpace: 'pre-wrap', marginBottom: '18px' }}>
          {note}
        </p>
      )}

      <div style={{ position: 'relative', width: '100%', maxWidth: '560px' }}>
        <div
          ref={trackRef}
          style={{
            display: 'flex', gap: '18px', overflowX: 'auto', scrollSnapType: 'x mandatory',
            paddingBottom: '8px', scrollbarWidth: 'none',
          }}
        >
          {hotels.map((h, i) => (
            <div
              key={i}
              style={{
                flex: '0 0 100%', scrollSnapAlign: 'start', background: C.cream,
                borderRadius: '18px', overflow: 'hidden', border: `1px solid ${C.border}`,
              }}
            >
              {h.imageUrl && (
                <div style={{ height: '200px' }}>
                  <img src={h.imageUrl} alt={h.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <div style={{ padding: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: C.maroon, margin: '0 0 6px' }}>{h.name}</h3>
                {h.description && <p style={{ fontSize: '13px', color: C.ink, opacity: 0.8, margin: '0 0 10px' }}>{h.description}</p>}
                {h.price && <p style={{ fontWeight: 700, color: C.ink, margin: '0 0 14px' }}>{h.price}</p>}
                {h.link && (
                  <a href={h.link} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px',
                    border: `1px solid ${C.maroon}`, borderRadius: '999px', color: C.maroon,
                    textDecoration: 'none', fontSize: '13px', fontWeight: 700,
                  }}>
                    {isRTL ? 'عرض التفاصيل' : 'View details'}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {hotels.length > 1 && (
          <>
            <button type="button" onClick={() => scrollByCard(-1)} aria-label="Previous hotel" style={arrowStyle('left')}>‹</button>
            <button type="button" onClick={() => scrollByCard(1)} aria-label="Next hotel" style={arrowStyle('right')}>›</button>
          </>
        )}
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}

function arrowStyle(side) {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: '-8px',
    width: '38px', height: '38px', borderRadius: '50%', border: `1px solid ${C.border}`,
    background: 'rgba(255,255,255,0.9)', color: C.maroon, fontSize: '20px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
