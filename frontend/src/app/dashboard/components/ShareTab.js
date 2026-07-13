'use client';

import Link from 'next/link';
import EventSharePanel from './EventSharePanel';
import Icon from '../../components/icons/Icon';

const C = {
  gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF', soft: '#FAF8F3',
};

const goldBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: 40, padding: '0 18px', background: 'linear-gradient(135deg, #B8944F, #a6833f)',
  color: '#FFFFFF', border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
};

/**
 * Dashboard → Share. The dedicated, first-class home for an event's public link and
 * general-purpose QR code (mass distribution: social, print, broadcast). Operates on
 * the event currently selected in the dashboard top bar.
 */
export default function ShareTab({ event }) {
  if (!event) {
    return (
      <div style={{ textAlign: 'center', padding: '56px 24px', background: C.soft, border: `1px dashed ${C.border}`, borderRadius: 16 }}>
        <Icon name="link" size={32} color="#B8944F" strokeWidth={1.3} />
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: C.charcoal, margin: '10px 0 6px' }}>
          Nothing to share yet
        </h3>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone, margin: '0 0 18px' }}>
          Create an event to get a public link and a downloadable QR code for it.
        </p>
        <Link href="/dashboard/create-event" style={goldBtn}>+ New Event</Link>
      </div>
    );
  }

  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
      <div style={{ borderBottom: '1px solid #F0ECE3', paddingBottom: 18, marginBottom: 22 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: C.charcoal, margin: 0 }}>
          Share &amp; QR Code
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone, margin: '6px 0 0', maxWidth: 600 }}>
          One public entry point for <strong style={{ color: C.charcoal }}>{event.title || 'your event'}</strong> — copy the link, download a
          print-ready QR, or broadcast it anywhere. Everyone lands on the same RSVP page.
        </p>
      </div>
      <EventSharePanel event={event} />
    </div>
  );
}
