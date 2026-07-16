'use client';

import React from 'react';
import Icon from '../../../components/icons/Icon';

/* ═══════════════════════════════════════════════════════════════
   SectionsOrderEditor — add/remove/reorder any full-page guest-page
   section (Story, Schedule, Venues, Accommodation, Menu, Gift List,
   FAQ, Gallery, Invited-To map, Things To Do, Getting There).

   Extracted from Stage2_FormConfiguration.js so the create-event
   wizard and the post-creation Settings tab share one implementation
   instead of drifting apart. Fully self-contained: reads/writes
   `templateData.enabledSections` (on/off per section) and
   `templateData.sectionOrder` (display order) via the same
   `templateData`/`setTemplateData` prop pair every other template-data
   field in this app uses.
   ═══════════════════════════════════════════════════════════════ */

const C = {
  gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF',
};

// Every optional guest-page section, independently toggleable per event via
// template_data.enabledSections — lets the organizer add or remove any
// feature from any event type (wedding, engagement, celebration, baby
// shower…) regardless of which curated template they started from. A
// section left at its default (no explicit false) still auto-hides on the
// guest page when its data is empty, exactly as before.
export const SECTION_TOGGLES = [
  { key: 'story', label: 'Our Story', icon: 'book', hint: 'Love story / proposal story / about-us text' },
  { key: 'schedule', label: 'Schedule', icon: 'clock', hint: 'Day 1 / Day 2 timeline' },
  { key: 'venues', label: 'Venues', icon: 'mapPin', hint: 'Day 1 / Day 2 venue maps' },
  { key: 'dresscode', label: 'Dress Code', icon: 'dressCode', hint: '' },
  { key: 'accommodation', label: 'Accommodation', icon: 'hotel', hint: 'Hotel list' },
  { key: 'menu', label: 'Menu', icon: 'restaurant', hint: 'Courses' },
  { key: 'giftlist', label: 'Gift List', icon: 'gift', hint: 'Registry link + bank details' },
  { key: 'faq', label: 'FAQ', icon: 'question', hint: '' },
  { key: 'gallery', label: 'Photo Gallery', icon: 'gallery', hint: '' },
  { key: 'invited', label: '"Invited To" City Map', icon: 'map', hint: '' },
  { key: 'thingstodo', label: 'Things To Do', icon: 'compass', hint: 'Local recommendations' },
  { key: 'gettingthere', label: 'Getting There', icon: 'car', hint: 'Transport / parking notes' },
];

export default function SectionsOrderEditor({ templateData, setTemplateData }) {
  const enabledSections = templateData.enabledSections || {};
  const isSectionOn = (key) => enabledSections[key] !== false;
  const toggleSection = (key) => setTemplateData((d) => ({
    ...d,
    enabledSections: { ...(d.enabledSections || {}), [key]: !isSectionOn(key) },
  }));

  const savedOrder = Array.isArray(templateData.sectionOrder) ? templateData.sectionOrder : [];
  const allSectionKeys = SECTION_TOGGLES.map((s) => s.key);
  const orderedSectionKeys = [
    ...savedOrder.filter((k) => allSectionKeys.includes(k)),
    ...allSectionKeys.filter((k) => !savedOrder.includes(k)),
  ];
  const moveSection = (key, dir) => {
    const idx = orderedSectionKeys.indexOf(key);
    const j = idx + dir;
    if (j < 0 || j >= orderedSectionKeys.length) return;
    const next = orderedSectionKeys.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setTemplateData((d) => ({ ...d, sectionOrder: next }));
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.charcoal, fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
        ✚ Sections — add, remove, and arrange any feature
      </div>
      <p style={{ fontSize: 11.5, color: C.stone, fontFamily: 'var(--font-sans)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Every section below is available on every template, in the order you set here (between your opening and the RSVP). Fill one in above to show it — switch it off even if it has content to hide it — and use ↑ / ↓ to reorder.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {orderedSectionKeys.map((key, idx) => {
          const { label, icon, hint } = SECTION_TOGGLES.find((s) => s.key === key);
          const on = isSectionOn(key);
          return (
            <div key={key} title={hint || label}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px 8px 12px', borderRadius: 10,
                background: on ? 'rgba(184,148,79,0.07)' : C.white,
                border: `1px solid ${on ? 'rgba(184,148,79,0.3)' : C.border}`,
              }}>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: C.stone,
                width: 16, textAlign: 'center', flexShrink: 0,
              }}>{idx + 1}</span>
              <button type="button" onClick={() => moveSection(key, -1)} disabled={idx === 0} aria-label="Move up"
                style={{
                  width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`, background: C.white,
                  color: idx === 0 ? '#CFC8BB' : C.stone, cursor: idx === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 12, lineHeight: 1, flexShrink: 0,
                }}>↑</button>
              <button type="button" onClick={() => moveSection(key, 1)} disabled={idx === orderedSectionKeys.length - 1} aria-label="Move down"
                style={{
                  width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`, background: C.white,
                  color: idx === orderedSectionKeys.length - 1 ? '#CFC8BB' : C.stone,
                  cursor: idx === orderedSectionKeys.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: 12, lineHeight: 1, flexShrink: 0,
                }}>↓</button>
              <button type="button" onClick={() => toggleSection(key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: C.charcoal,
                }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name={icon} size={13} strokeWidth={1.6} /> {label}</span>
                <span style={{
                  width: 32, height: 18, borderRadius: 999, position: 'relative', flexShrink: 0,
                  background: on ? C.gold : '#D1CFC9', transition: 'background 0.2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: '50%',
                    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                  }} />
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
