'use client';

import React, { useState, useEffect } from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, ScrollToRsvpHint } from '../shared';

/* A playful "boarding pass to the wedding" teaser card — cream/burgundy,
   dashed ticket border. Distinct from (but now shares real credentials with)
   the dark QR check-in pass shown on the RSVP success screen
   (GuestPassGenerator).

   TABLE/PARTY show this guest's real seating-chart assignment
   (assignedTableName + partySize) once the organizer has assigned one and
   seating is revealed; otherwise the two middle fields fall back to a
   stylized SEAT/ROW derived from the event date, for events with no seating
   chart (or before it's revealed).

   FLIGHT defaults to a code derived from the event's own slug (real, and
   consistent for every visitor including an unidentified one on a public
   link) unless the organizer typed an override.

   The barcode is only ever a REAL scannable QR — the same signed check-in
   ticket token the door scanner and emailed ticket use (qrToken, only ever
   minted server-side for a confirmed "yes" — see
   tokenService.signQrTicketForResponse). Until that exists for this guest
   (not yet identified, hasn't RSVP'd yes, on a public link with no prior
   RSVP on this device…) this shows dashed placeholder bars labeled
   "Preview" instead of anything that looks scannable but isn't — matching
   the same rule StepSuccess.js already follows for GuestPassGenerator. */

// Deterministic short alphanumeric code from any string — used for the
// FLIGHT default so it's derived from real event data instead of a fixed
// generic constant, even before any guest is identified.
function codeFromSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return String(100 + (hash % 900));
}

// Deterministic variable-width bars for the decorative placeholder shown
// only until a real ticket exists.
function pseudoRandom(seed) {
  const x = Math.sin(seed * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
}

export default function BoardingPassSection({
  destination, dateISO, initials, flightCode, isRTL,
  assignedTableName, partySize, eventSlug, qrToken,
}) {
  const C = useFullPageTheme();
  const [qrImageUrl, setQrImageUrl] = useState(null);

  useEffect(() => {
    if (!qrToken || typeof window === 'undefined') return undefined;
    let cancelled = false;
    const qrData = `${window.location.origin}/ticket/${qrToken}`;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(qrData, { width: 240, margin: 1, color: { dark: C.maroon, light: '#FFFFFF' } })
        .then((url) => { if (!cancelled) setQrImageUrl(url); })
        .catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [qrToken, C.maroon]);

  if (!destination && !dateISO) return null;

  const d = dateISO ? new Date(dateISO) : null;
  const dd = d ? String(d.getUTCDate()).padStart(2, '0') : '--';
  const mm = d ? String(d.getUTCMonth() + 1).padStart(2, '0') : '--';
  const yyyy = d ? String(d.getUTCFullYear()) : '----';
  // Stripping to A-Z silently empties out for a non-Latin destination (e.g. an
  // Arabic city name) — falls back to the raw first 3 characters of whatever
  // was actually typed instead of always collapsing to the generic "LOV".
  const lettersOnly = (destination || '').replace(/[^a-zA-Z]/g, '');
  const cityCode = (lettersOnly || (destination || '').trim() || 'LOVE').slice(0, 3).toUpperCase() || 'LOV';
  const flight = flightCode || `${cityCode.slice(0, 2)}${codeFromSeed(eventSlug || `${destination}${dateISO}`)}`;
  // A real, guest-specific reference (a slice of their actual signed ticket)
  // once one exists; otherwise the same event+date derived code as before.
  const barcodeText = qrToken ? `TKT-${qrToken.slice(-8).toUpperCase()}` : `${cityCode}${dd}${mm}${yyyy}`;

  const bars = Array.from({ length: 44 }, (_, i) => 2 + Math.round(pseudoRandom(i + 1) * 4));

  // No couple, no honoree name resolved either (shouldn't normally happen —
  // heroTitle always falls back to the event title) — last resort uses the
  // destination's own initial instead of a wedding-only "L♡V" placeholder,
  // so a Corporate/Graduation/Gala custom event never shows a heart symbol.
  const gate = initials || (destination ? destination.trim().charAt(0).toUpperCase() : '✦');

  const meta = assignedTableName
    ? [
        { label: isRTL ? 'البوابة' : 'GATE', value: gate },
        { label: isRTL ? 'الطاولة' : 'TABLE', value: assignedTableName },
        { label: isRTL ? 'المجموعة' : 'PARTY', value: partySize ? `×${partySize}` : '—' },
        { label: isRTL ? 'الرحلة' : 'FLIGHT', value: flight },
      ]
    : [
        { label: isRTL ? 'البوابة' : 'GATE', value: gate },
        { label: isRTL ? 'المقعد' : 'SEAT', value: `${dd}.${mm}` },
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
            {meta.map((m) => {
              const text = String(m.value);
              return (
                <div key={m.label} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: C.ink, opacity: 0.55, textTransform: 'uppercase' }}>{m.label}</div>
                  <div
                    title={text.length > 8 ? text : undefined}
                    style={{
                      fontFamily: 'var(--font-serif)', fontWeight: 700, color: C.maroon, marginTop: '4px',
                      fontSize: text.length > 8 ? '14px' : '19px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >{text}</div>
                </div>
              );
            })}
          </div>

          {qrToken && qrImageUrl ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImageUrl} alt={isRTL ? 'امسح رمز الدخول' : 'Scan for check-in'} width={100} height={100} style={{ borderRadius: '10px', boxShadow: `0 0 0 1px ${C.border}` }} />
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.2em', color: C.maroon, marginTop: '10px', opacity: 0.85 }}>
                {barcodeText}
              </div>
            </>
          ) : (
            <>
              {/* Placeholder bars — never a stand-in for a real scan. */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2px', height: '52px', opacity: 0.5 }} aria-hidden="true">
                {bars.map((w, i) => (
                  <span key={i} style={{ width: `${w}px`, height: '100%', background: C.maroon }} />
                ))}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.3em', color: C.maroon, marginTop: '10px', opacity: 0.7 }}>
                {barcodeText}
              </div>
              <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.ink, opacity: 0.5, marginTop: '8px', fontFamily: 'var(--font-sans)' }}>
                {isRTL ? 'معاينة — تصلك بطاقتك الحقيقية بعد تأكيد الحضور' : 'Preview — your real check-in QR appears once you RSVP yes'}
              </div>
            </>
          )}
        </div>
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
