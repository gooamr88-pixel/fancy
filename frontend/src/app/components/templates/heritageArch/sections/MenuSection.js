'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

/* Dinner menu framed by a soft ribbon/bow drawn as an inline SVG, with the
   courses stacked down the middle and a faint candelabra sketch anchoring the
   bottom — matches the reference's stationery-menu look. */
export default function MenuSection({ courses, isRTL }) {
  const C = useFullPageTheme();
  if (!Array.isArray(courses) || courses.length === 0) return null;

  return (
    <SectionShell>
      {/* Ribbon/bow frame — decorative, sits behind the content */}
      <svg
        aria-hidden="true"
        viewBox="0 0 300 620"
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', width: 'min(88%, 520px)', height: '88%', opacity: 0.9, pointerEvents: 'none' }}
      >
        {/* Bow knot at the top */}
        <path d="M150 40 C 138 20 108 18 118 44 C 126 62 146 50 150 40 C 154 50 174 62 182 44 C 192 18 162 20 150 40 Z" fill="none" stroke={C.maroon} strokeWidth="3" />
        <path d="M150 44 L138 96 M150 44 L162 96" stroke={C.maroon} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Two ribbons flowing down the sides */}
        <path d="M132 52 C 40 120 60 300 30 440 C 18 520 40 580 70 600" fill="none" stroke={C.maroon} strokeWidth="2.5" opacity="0.8" />
        <path d="M168 52 C 260 120 240 300 270 440 C 282 520 260 580 230 600" fill="none" stroke={C.maroon} strokeWidth="2.5" opacity="0.8" />
      </svg>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px' }}>
        <SectionHeading isRTL={isRTL}>{isRTL ? 'قائمة الطعام' : 'Menu'}</SectionHeading>

        {courses.map((course, i) => {
          const label = course.label || '';
          const name = course.name || '';
          const description = course.description || '';
          if (!label && !name && !description) return null;
          return (
            <div key={i} style={{ textAlign: 'center' }}>
              {label && (
                <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.14em', color: C.gold, textTransform: 'uppercase', marginBottom: '8px' }}>
                  — {label} —
                </div>
              )}
              {name && (
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '19px', fontWeight: 600, color: C.maroon, lineHeight: 1.3 }}>
                  {name}
                </div>
              )}
              {description && (
                <p style={{ fontSize: '14px', color: C.ink, opacity: 0.8, margin: '6px 0 0', lineHeight: 1.6 }}>
                  {description}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Faint candelabra / set-table sketch at the very bottom */}
      <svg aria-hidden="true" viewBox="0 0 120 60" style={{ position: 'absolute', bottom: '4%', width: '150px', height: '70px', opacity: 0.15 }}>
        <path d="M60 6 L60 34 M48 16 Q48 8 44 6 M72 16 Q72 8 76 6 M44 6 L44 3 M60 6 L60 3 M76 6 L76 3" stroke={C.maroon} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M40 34 L80 34 L74 52 L46 52 Z" stroke={C.maroon} strokeWidth="1.5" fill="none" />
      </svg>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
