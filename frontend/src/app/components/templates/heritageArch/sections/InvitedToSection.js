'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useFullPageTheme } from '../theme';
import { SectionShell, ScrollToRsvpHint } from '../shared';

// Simplified, non-cartographic continent silhouettes on an equirectangular
// 360x180 viewBox — lng/lat map straight onto x/y (x = lng+180, y = 90-lat),
// so a pin's position is at least directionally correct, not pixel-accurate.
const CONTINENTS = [
  // North America
  'M35 30 Q55 15 85 20 Q108 25 112 45 Q114 62 98 78 Q80 92 66 88 Q50 84 42 66 Q32 50 35 30 Z',
  // South America
  'M92 108 Q108 100 118 115 Q126 135 118 155 Q110 172 98 168 Q86 160 86 138 Q84 120 92 108 Z',
  // Europe
  'M168 24 Q188 16 202 26 Q206 36 196 44 Q182 50 172 42 Q164 34 168 24 Z',
  // Africa
  'M170 58 Q195 52 208 70 Q214 92 204 118 Q196 140 182 138 Q168 134 164 108 Q158 82 170 58 Z',
  // Asia
  'M208 20 Q250 10 290 22 Q320 32 316 55 Q310 78 280 82 Q250 86 228 70 Q206 54 208 20 Z',
  // Australia
  'M272 128 Q296 120 314 132 Q320 145 306 154 Q288 160 276 150 Q266 140 272 128 Z',
];

function project(lat, lng) {
  const x = (Number(lng) + 180);
  const y = (90 - Number(lat));
  return { x, y };
}

export default function InvitedToSection({ city, lat, lng, isRTL }) {
  const C = useFullPageTheme();
  const hasCoords = lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  const pin = hasCoords ? project(lat, lng) : null;

  return (
    <SectionShell>
      <p style={{ fontSize: '13px', letterSpacing: '0.2em', fontWeight: 700, color: C.maroon, marginBottom: '20px' }}>
        {isRTL ? 'أنتم مدعوون إلى' : "YOU'RE INVITED TO"}
      </p>

      <div style={{
        position: 'relative', width: '100%', maxWidth: '520px', aspectRatio: '360/180',
        borderRadius: '20px', border: `1px solid ${C.border}`, background: C.cream, overflow: 'hidden',
      }}>
        <svg viewBox="0 0 360 180" width="100%" height="100%" style={{ display: 'block' }} aria-hidden="true">
          {CONTINENTS.map((d, i) => (
            <path key={i} d={d} fill={C.gold} opacity="0.28" />
          ))}
        </svg>

        {pin && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }}
            style={{
              position: 'absolute', left: `${(pin.x / 360) * 100}%`, top: `${(pin.y / 180) * 100}%`,
              transform: 'translate(-50%, -100%)', display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '12px', color: C.maroon,
              background: C.cream, padding: '2px 8px', borderRadius: '999px', border: `1px solid ${C.border}`,
              marginBottom: '2px', whiteSpace: 'nowrap',
            }}>
              {city}
            </span>
            <svg width="18" height="24" viewBox="0 0 22 30" fill="none">
              <path d="M11 0C4.9 0 0 4.9 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.9 17.1 0 11 0z" fill={C.maroon} />
              <circle cx="11" cy="11" r="4.5" fill={C.cream} />
            </svg>
          </motion.div>
        )}
      </div>

      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 6vw, 48px)', color: C.maroon, marginTop: '24px' }}>{city}</p>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
