'use client';

import React, { useState } from 'react';
import PlacesAutocomplete from '../../../../app/components/PlacesAutocomplete';
import ImageUploadField from '../../components/ImageUploadField';
import RepeatableListEditor from '../../components/RepeatableListEditor';

const C = { gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8', error: '#C45E5E' };

const iStyle = {
  width: '100%', boxSizing: 'border-box',
  background: C.white, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: '9px 12px', fontSize: 13, color: C.charcoal,
  outline: 'none', fontFamily: 'var(--font-sans)',
};
const lbl = {
  fontSize: 10, fontWeight: 700, color: C.stone, textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 4, fontFamily: 'var(--font-sans)',
};
const iconBtn = (disabled) => ({
  width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.white, color: disabled ? '#CFC8BB' : C.stone, cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
});

const SCHEDULE_ICON_OPTIONS = [
  { value: 'plate', label: '🍽️ Plate' }, { value: 'rings', label: '💍 Rings' },
  { value: 'ornament', label: '🎊 Ornament' }, { value: 'watch', label: '⏰ Watch' }, { value: 'clock', label: '🕯️ Candle' },
];

/* ═══════════════════════════════════════════════════════════════
   DaysEditor — a flexible list of days for the full-page guest
   experience. Most events are a single day (no tabs show on the guest
   page then); multi-function events can add as many as they need —
   two, three, or more — each with its own venue and schedule.
   ═══════════════════════════════════════════════════════════════ */
export default function DaysEditor({ days, onChange, onUploadImage }) {
  const list = Array.isArray(days) ? days : [];
  const [uploading, setUploading] = useState({}); // idx -> bool

  const updateDay = (idx, patch) => onChange(list.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  const updateVenue = (idx, patch) => onChange(list.map((d, i) => (i === idx ? { ...d, venue: { ...(d.venue || {}), ...patch } } : d)));
  const addDay = () => onChange([...list, { label: `Day ${list.length + 1}`, schedule: [], venue: {} }]);
  const removeDay = (idx) => onChange(list.filter((_, i) => i !== idx));
  const moveDay = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const placeSelectHandler = (idx) => (place) => updateVenue(idx, {
    name: place.name && place.name !== place.address
      ? place.name
      : (place.address ? place.address.split(',')[0] : list[idx]?.venue?.name),
    address: place.address,
    lat: place.lat,
    lng: place.lng,
  });

  const handleVenuePhoto = async (idx, file) => {
    if (!onUploadImage) return;
    setUploading((u) => ({ ...u, [idx]: true }));
    try {
      const url = await onUploadImage(file);
      if (url) updateVenue(idx, { image: url });
    } finally {
      setUploading((u) => ({ ...u, [idx]: false }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {list.length === 0 && (
        <p style={{ fontSize: 12, color: C.stone, margin: 0, fontFamily: 'var(--font-sans)' }}>
          No days yet — add one for each day of your event. Most events only need one; multi-function celebrations can add as many as they need.
        </p>
      )}

      {list.map((day, idx) => (
        <div key={idx} style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 14px',
            background: C.softBg, borderBottom: `1px solid ${C.border}`,
          }}>
            <input
              value={day.label || ''}
              onChange={(e) => updateDay(idx, { label: e.target.value })}
              placeholder={`Day ${idx + 1}`}
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 12.5, fontWeight: 700, color: C.charcoal, fontFamily: 'var(--font-sans)',
              }}
            />
            <button type="button" onClick={() => moveDay(idx, -1)} disabled={idx === 0} aria-label="Move up" style={iconBtn(idx === 0)}>↑</button>
            <button type="button" onClick={() => moveDay(idx, 1)} disabled={idx === list.length - 1} aria-label="Move down" style={iconBtn(idx === list.length - 1)}>↓</button>
            <button type="button" onClick={() => removeDay(idx)} aria-label="Remove day" style={{ ...iconBtn(false), color: C.error, borderColor: 'rgba(196,94,94,0.35)' }}>✕</button>
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Venue</label>
                <PlacesAutocomplete
                  value={day.venue?.name || ''}
                  // Retyping the venue name without picking a fresh suggestion clears the
                  // old lat/lng — otherwise the guest page's venue map silently keeps
                  // pointing at whatever place was last actually selected here.
                  onChange={(v) => updateVenue(idx, { name: v, lat: null, lng: null })}
                  onPlaceSelect={placeSelectHandler(idx)}
                  placeholder="Search for this day's venue…"
                  style={iStyle}
                />
              </div>
              <div>
                <label style={lbl}>Venue Photo</label>
                <ImageUploadField
                  value={day.venue?.image || ''}
                  uploading={!!uploading[idx]}
                  onUpload={(file) => handleVenuePhoto(idx, file)}
                  onClear={() => updateVenue(idx, { image: '' })}
                  height={100}
                />
              </div>
            </div>

            <div>
              <label style={lbl}>Schedule</label>
              <RepeatableListEditor
                items={Array.isArray(day.schedule) ? day.schedule : []}
                onChange={(items) => updateDay(idx, { schedule: items })}
                addLabel="+ Add schedule item"
                emptyLabel="No schedule items yet."
                itemNoun="Item"
                columns={[
                  { key: 'time', label: 'Time', placeholder: '14:00' },
                  { key: 'label', label: 'Label', placeholder: 'Lunch' },
                  { key: 'icon', label: 'Icon', type: 'select', placeholder: 'Icon', options: SCHEDULE_ICON_OPTIONS },
                ]}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addDay}
        style={{
          alignSelf: 'flex-start', padding: '9px 18px', borderRadius: 8,
          border: `1px dashed ${C.gold}`, background: 'rgba(184,148,79,0.05)', color: C.gold,
          cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
        }}
      >
        + Add a day
      </button>
    </div>
  );
}
