'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useFullPageTheme } from '../theme';
import { SectionShell, ScrollToRsvpHint } from '../shared';
import { alpha } from '../../../../utils/color';

// Warm "parchment" Google Static Maps style — keeps the section's cream/burgundy
// aesthetic while showing the REAL geography (streets, water, parks) around the
// actual venue, instead of the old decorative continent silhouettes.
const STATIC_MAP_STYLE = [
  'feature:all|element:labels|visibility:simplified',
  'feature:administrative|element:labels.text.fill|color:0x6b5a3e',
  'feature:administrative.locality|element:labels.text.fill|color:0x5a3a2a',
  'feature:landscape|element:geometry|color:0xf3ead6',
  'feature:landscape.natural|element:geometry|color:0xe9dcc0',
  'feature:poi|element:geometry|color:0xe6d9bf',
  'feature:poi.park|element:geometry|color:0xd8cfa6',
  'feature:road|element:geometry|color:0xece0c8',
  'feature:road|element:labels|visibility:off',
  'feature:road.highway|element:geometry|color:0xe0d2b2',
  'feature:transit|visibility:off',
  'feature:water|element:geometry|color:0xcdbb93',
];

// Decorative fallback ONLY when the event has no location at all — same silhouettes
// as before so an unconfigured event still shows something on-brand.
const CONTINENTS = [
  'M35 30 Q55 15 85 20 Q108 25 112 45 Q114 62 98 78 Q80 92 66 88 Q50 84 42 66 Q32 50 35 30 Z',
  'M92 108 Q108 100 118 115 Q126 135 118 155 Q110 172 98 168 Q86 160 86 138 Q84 120 92 108 Z',
  'M168 24 Q188 16 202 26 Q206 36 196 44 Q182 50 172 42 Q164 34 168 24 Z',
  'M170 58 Q195 52 208 70 Q214 92 204 118 Q196 140 182 138 Q168 134 164 108 Q158 82 170 58 Z',
  'M208 20 Q250 10 290 22 Q320 32 316 55 Q310 78 280 82 Q250 86 228 70 Q206 54 208 20 Z',
  'M272 128 Q296 120 314 132 Q320 145 306 154 Q288 160 276 150 Q266 140 272 128 Z',
];

export default function InvitedToSection({ city, lat, lng, isRTL }) {
  const C = useFullPageTheme();
  // If the Static Maps request fails (API not enabled for the key, quota, etc.)
  // we fall back to the key-free interactive embed rather than a broken image.
  const [staticFailed, setStaticFailed] = useState(false);

  const hasCoords = lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  // Pin the exact venue when we have coordinates; otherwise geocode by the city
  // name so a place-name-only event still lands on the real place.
  const query = hasCoords ? `${Number(lat)},${Number(lng)}` : (city || '');
  const hasLocation = !!query;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const markerHex = /^#[0-9a-fA-F]{6}$/.test(C.maroon || '') ? C.maroon.slice(1) : '6B1B2A';

  let mapNode;
  if (hasLocation && apiKey && !staticFailed) {
    // Premium path: a themed static map of the real place (no scroll-hijack).
    const params = new URLSearchParams({ center: query, zoom: '12', size: '640x360', scale: '2', maptype: 'roadmap', key: apiKey });
    STATIC_MAP_STYLE.forEach((s) => params.append('style', s));
    params.append('markers', `color:0x${markerHex}|${query}`);
    mapNode = (
      // A dynamic external static-map URL isn't a candidate for next/image optimization.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`}
        alt={city ? `Map of ${city}` : 'Venue location map'}
        onError={() => setStaticFailed(true)}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    );
  } else if (hasLocation) {
    // Key-free fallback: the real Google map via the embed endpoint. pointer-events
    // is disabled so it reads as an elegant map view and never hijacks page scroll.
    const src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=12&ie=UTF8&iwloc=&output=embed`;
    mapNode = (
      <iframe
        title={city ? `Map of ${city}` : 'Venue location map'}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none', filter: 'saturate(0.82) contrast(0.96)' }}
      />
    );
  } else {
    // No location configured — decorative silhouettes (no false pin).
    mapNode = (
      <svg viewBox="0 0 360 180" width="100%" height="100%" style={{ display: 'block' }} aria-hidden="true">
        {CONTINENTS.map((d, i) => <path key={i} d={d} fill={C.gold} opacity="0.28" />)}
      </svg>
    );
  }

  return (
    <SectionShell>
      <p style={{ fontSize: '13px', letterSpacing: '0.2em', fontWeight: 700, color: C.maroon, marginBottom: '20px' }}>
        {isRTL ? 'أنتم مدعوون إلى' : "YOU'RE INVITED TO"}
      </p>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', width: '100%', maxWidth: '520px', aspectRatio: '360/180',
          borderRadius: '22px', border: `1px solid ${C.border}`, background: C.cream, overflow: 'hidden',
          boxShadow: `0 24px 50px -28px ${alpha(C.maroon, 0.4)}`,
        }}
      >
        {/* Slow settle so the reveal feels intentional, not a jump-cut. */}
        <motion.div
          initial={{ scale: 1.08 }} whileInView={{ scale: 1 }} viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          {mapNode}
        </motion.div>

        {/* Warm vignette to tie the map back into the palette + lift the label. */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(180deg, ${alpha(C.maroon, 0.12)} 0%, transparent 24%, transparent 68%, ${alpha(C.maroon, 0.22)} 100%)`,
          boxShadow: `inset 0 0 70px ${alpha(C.maroon, 0.14)}`,
        }} />

        {/* Floating destination label — the same chip motif as before. */}
        {city && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true, amount: 0.3 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.25 }}
            style={{
              position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)', zIndex: 2, pointerEvents: 'none',
              fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '13px', color: C.maroon,
              background: C.cream, padding: '5px 14px', borderRadius: '999px', border: `1px solid ${C.border}`,
              boxShadow: `0 4px 14px ${alpha(C.maroon, 0.18)}`, whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            <svg width="12" height="16" viewBox="0 0 22 30" fill="none" aria-hidden="true">
              <path d="M11 0C4.9 0 0 4.9 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.9 17.1 0 11 0z" fill={C.maroon} />
              <circle cx="11" cy="11" r="4.5" fill={C.cream} />
            </svg>
            {city}
          </motion.span>
        )}
      </motion.div>

      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 6vw, 48px)', color: C.maroon, marginTop: '24px' }}>{city}</p>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
