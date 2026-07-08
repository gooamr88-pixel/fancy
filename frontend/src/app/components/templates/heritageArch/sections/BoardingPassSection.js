'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, ScrollToRsvpHint } from '../shared';

/* A playful "boarding pass to the wedding" teaser card — cream/burgundy,
   dashed ticket border, a faux barcode. Distinct from the dark QR check-in
   pass shown on the RSVP success screen (GuestPassGenerator). Values are
   auto-derived from the event (city, date, partner initials) by the
   orchestrator; nothing here is required organizer input. */

// Deterministic variable-width bars for a decorative (non-scannable) barcode.
function pseudoRandom(seed) {
  const x = Math.sin(seed * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
}

export default function BoardingPassSection({ destination, dateISO, initials, flightCode, isRTL }) {
  const C = useFullPageTheme();
  if (!destination && !dateISO) return null;

  const d = dateISO ? new Date(dateISO) : null;
  const dd = d ? String(d.getUTCDate()).padStart(2, '0') : '--';
  const mm = d ? String(d.getUTCMonth() + 1).padStart(2, '0') : '--';
  const yyyy = d ? String(d.getUTCFullYear()) : '----';
  const seat = `${dd}.${mm}`;
  const cityCode = (destination || 'LOVE').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'LOV';
  const flight = flightCode || 'WED01';
  const barcodeText = `${cityCode}${dd}${mm}${yyyy}`;

  const bars = Array.from({ length: 44 }, (_, i) => 2 + Math.round(pseudoRandom(i + 1) * 4));

  const meta = [
    { label: isRTL ? 'البوابة' : 'GATE', value: initials || 'L♡V' },
    { label: isRTL ? 'المقعد' : 'SEAT', value: seat },
    { label: isRTL ? 'الصف' : 'ROW', value: yyyy },
    { label: isRTL ? 'الرحلة' : 'FLIGHT', value: flight },
  ];

  return (
    <SectionShell>
      <div style={{
        width: '100%', maxWidth: '460px', background: C.cream, borderRadius: '18px',
        border: `2px dashed ${C.border}`, padding: '0', overflow: 'hidden',
        boxShadow: '0 20px 50px -24px rgba(58,42,34,0.35)',
      }}>
        {/* Header band */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', background: `${C.maroon}14`, borderBottom: `1px dashed ${C.border}`,
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: C.maroon, fontFamily: 'var(--font-sans)' }}>
            {isRTL ? 'بطاقة صعود' : 'BOARDING PASS'}
          </span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.maroon} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.5 2.5 11 13" />
            <path d="M21.5 2.5l-6.9 19-4-9-9-4 19.9-6z" />
          </svg>
        </div>

        <div style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', color: C.ink, opacity: 0.6, textTransform: 'uppercase' }}>
            {isRTL ? 'الوجهة' : 'Destination'}
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 7vw, 40px)', fontWeight: 700, color: C.maroon, letterSpacing: '0.02em', margin: '4px 0 18px' }}>
            {destination}
          </div>

          <div aria-hidden="true" style={{ height: '1px', borderTop: `1px dashed ${C.border}`, margin: '0 -4px 18px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
            {meta.map((m) => (
              <div key={m.label}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: C.ink, opacity: 0.55, textTransform: 'uppercase' }}>{m.label}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '19px', fontWeight: 700, color: C.maroon, marginTop: '4px' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Faux barcode */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2px', height: '52px' }} aria-hidden="true">
            {bars.map((w, i) => (
              <span key={i} style={{ width: `${w}px`, height: '100%', background: C.maroon }} />
            ))}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.3em', color: C.maroon, marginTop: '10px' }}>
            {barcodeText}
          </div>
        </div>
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
