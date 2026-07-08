'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

/* Line-icon set the organizer can pick per item (keys stored in ha_things_to_do[].icon).
   Stroke-based, single-color, 24-unit viewBox — matches the app's icon language. */
const ICON_PATHS = {
  mountain: <path d="M3 20 L9 8 L13 15 L16 10 L21 20 Z" />,
  food: <><path d="M5 3v7M8 3v7M6.5 10v11M17 3c-1.6.6-2.7 2.3-2.7 4.4 0 1.8 1 3.3 2.2 3.9V21" /></>,
  water: <path d="M4 12c2 0 2-1.5 4-1.5S10 12 12 12s2-1.5 4-1.5S18 12 20 12M4 17c2 0 2-1.5 4-1.5S10 17 12 17s2-1.5 4-1.5S18 17 20 17" />,
  camera: <><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="12" cy="13.5" r="3.2" /><path d="M8 7l1.5-2.5h5L16 7" /></>,
  drink: <path d="M6 3h12l-1 4a5 5 0 0 1-10 0zM12 12v6M8.5 21h7" />,
  shopping: <><path d="M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2" /></>,
  landmark: <path d="M4 21h16M5 21V10M19 21V10M4 10l8-6 8 6M9 21v-6M15 21v-6" />,
  star: <path d="M12 3l2.5 6.3L21 10l-5 4.4L17.5 21 12 17.3 6.5 21 8 14.4 3 10l6.5-.7z" />,
};

function TodoIcon({ name, color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name] || ICON_PATHS.star}
    </svg>
  );
}

export default function ThingsToDoSection({ items, isRTL }) {
  const C = useFullPageTheme();
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <SectionShell>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '4px' }} aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M8 12l4-5 4 5-4 2z" />
      </svg>
      <SectionHeading subtitle={isRTL ? 'بعض أنشطتنا المفضلة القريبة' : 'Some of our favourite things to do nearby'} isRTL={isRTL}>
        {isRTL ? 'أماكن وأنشطة' : 'Things to Do'}
      </SectionHeading>

      <div style={{ width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {items.map((item, i) => {
          const title = item.title || '';
          const description = item.description || '';
          if (!title && !description) return null;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '14px',
              background: C.cream, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '18px 20px',
              textAlign: isRTL ? 'right' : 'left',
            }}>
              <span style={{
                flexShrink: 0, width: '42px', height: '42px', borderRadius: '12px',
                background: `${C.maroon}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TodoIcon name={item.icon} color={C.maroon} />
              </span>
              <div>
                {title && <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: C.maroon, margin: 0 }}>{title}</h3>}
                {description && <p style={{ fontSize: '14px', color: C.ink, opacity: 0.8, margin: '4px 0 0', lineHeight: 1.6 }}>{description}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
