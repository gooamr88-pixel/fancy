'use client';

import React from 'react';
import { motion } from 'framer-motion';

/* Shared visual chrome for the RSVP wizard's steps — this wizard's own
   analogue of the Heritage Arch template's shared.js: the same "line —
   ornament — line" grammar, an italic-serif heading treatment, and a
   glassmorphic language pill. Unlike Heritage Arch, every color here is
   passed in by the caller rather than baked into a fixed palette, since
   this one skeleton is shared by all 16 non-Heritage-Arch templates —
   the organizer's own event color is what makes each instance feel
   bespoke, not per-template artwork. */

/** A small abstract 4-point spark — deliberately not a floral/vine motif
    (which would suit weddings but clash with corporate/birthday/gala/
    engagement events also sharing this skeleton). Same stroke-based, round-
    cap icon language as RsvpIcons.js. */
export function SparkMark({ color = 'currentColor', size = 14, opacity = 0.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity, flexShrink: 0 }} aria-hidden="true">
      <path d="M12 2.5c0 4-1.2 7.3-4 9.5 2.8 2.2 4 5.5 4 9.5 0-4 1.2-7.3 4-9.5-2.8-2.2-4-5.5-4-9.5z" />
    </svg>
  );
}

/** Replaces a plain `borderTop` seam with a themed hairline + centered
    SparkMark — the single recurring signature that ties the whole
    progressively-revealed page together. */
export function RsvpDivider({ themeColor, spacing = 0 }) {
  const lineStyle = { flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, #E8E2D6 40%, #E8E2D6 60%, transparent)' };
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: spacing }}>
      <span style={lineStyle} />
      <SparkMark color={themeColor} size={13} opacity={0.65} />
      <span style={lineStyle} />
    </div>
  );
}

/** Replaces the ad hoc flat `<h3>` section headers with real hierarchy: an
    optional uppercase kicker (tinted to the event color), an italic-serif
    heading — mirrors Heritage Arch's SectionHeading treatment exactly
    (fontStyle italic, fontWeight 600) — and a short themed underline. */
export function RsvpSectionHeading({ kicker, children, themeColor, isRTL, align, style = {} }) {
  const resolvedAlign = align || (isRTL ? 'right' : 'left');
  const centered = resolvedAlign === 'center';
  return (
    <div style={{ textAlign: resolvedAlign, ...style }}>
      {kicker && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px',
          justifyContent: centered ? 'center' : 'flex-start',
          flexDirection: !centered && isRTL ? 'row-reverse' : 'row',
        }}>
          <SparkMark color={themeColor} size={11} opacity={0.9} />
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, color: themeColor, fontFamily: 'var(--font-sans)' }}>
            {kicker}
          </span>
        </div>
      )}
      <h3 style={{
        fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 600,
        fontSize: '20px', color: '#191B1E', margin: 0, lineHeight: 1.35,
      }}>
        {children}
      </h3>
      <span aria-hidden="true" style={{
        display: 'block', width: '32px', height: '2px', borderRadius: '1px',
        background: themeColor, marginTop: '8px',
        ...(centered ? { marginLeft: 'auto', marginRight: 'auto' } : (isRTL ? { marginLeft: 'auto' } : {})),
      }} />
    </div>
  );
}

/** One segmented pill control replacing two independent toggle buttons — a
    themed thumb slides between EN/AR via a shared framer-motion layoutId. */
export function LangSwitchPill({ lang, setLang, themeColor }) {
  const options = [{ code: 'en', label: 'EN' }, { code: 'ar', label: 'عربي' }];
  return (
    <div style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center', padding: '3px',
      borderRadius: '999px', background: 'rgba(255,255,255,0.10)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.18)',
    }}>
      {options.map((o) => {
        const active = lang === o.code;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => setLang(o.code)}
            style={{
              position: 'relative', border: 'none', background: 'none', cursor: 'pointer',
              padding: '5px 12px', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-sans)',
              color: active ? '#191B1E' : 'rgba(255,255,255,0.7)', transition: 'color 0.2s ease',
            }}
          >
            {active && (
              <motion.span
                layoutId="rsvp-lang-thumb"
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ position: 'absolute', inset: 0, borderRadius: '999px', background: themeColor, zIndex: -1 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
