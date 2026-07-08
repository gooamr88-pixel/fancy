'use client';

import React, { useState } from 'react';

/* Chip/tag editor for simple string lists (e.g. Heritage Arch meal options).
   Replaces the old comma-separated text input with an add/remove UI: type an
   option and press Enter (or the Add button) to append a chip; click × to
   remove. Always emits a clean array of trimmed, de-duplicated strings.
   Accepts either an array or a legacy comma-separated string as its value so
   existing events (which stored a string) keep working. */

const C = {
  gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

// Normalize any stored value (array, legacy comma-separated string, or empty)
// into a clean array of trimmed, non-empty strings. Exported so save-payload
// builders can coerce legacy string values to the array form too.
export function toTagArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

export default function TagListEditor({
  value,
  onChange,
  placeholder = 'Type an option and press Enter',
  addLabel = 'Add',
  emptyLabel = 'No options yet — add one above.',
}) {
  const tags = toTagArray(value);
  const [draft, setDraft] = useState('');

  const commit = () => {
    const next = draft.trim();
    if (!next) return;
    // Case-insensitive de-dupe so "Fish" and "fish" don't both appear.
    if (tags.some((t) => t.toLowerCase() === next.toLowerCase())) { setDraft(''); return; }
    onChange([...tags, next]);
    setDraft('');
  };

  const removeAt = (idx) => onChange(tags.filter((_, i) => i !== idx));

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    // Backspace on an empty input removes the last chip — a familiar tag-input gesture.
    else if (e.key === 'Backspace' && !draft && tags.length) removeAt(tags.length - 1);
  };

  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {tags.map((tag, idx) => (
            <span
              key={`${tag}-${idx}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 8px 6px 14px', borderRadius: 999,
                background: 'rgba(184,148,79,0.08)', border: `1px solid rgba(184,148,79,0.3)`,
                color: C.charcoal, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
              }}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeAt(idx)}
                aria-label={`Remove ${tag}`}
                style={{
                  width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: 'rgba(184,148,79,0.18)', color: C.gold, fontSize: 13, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1, boxSizing: 'border-box', background: C.white, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '10px 14px', fontSize: 14, color: C.charcoal,
            outline: 'none', fontFamily: 'var(--font-sans)', transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={(e) => { e.target.style.borderColor = C.gold; e.target.style.boxShadow = '0 0 0 3px rgba(184,148,79,0.08)'; }}
          onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          style={{
            flexShrink: 0, padding: '0 18px', borderRadius: 8, border: `1px solid ${C.gold}`,
            background: draft.trim() ? C.gold : C.white, color: draft.trim() ? C.white : C.gold,
            cursor: draft.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700,
            fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
          }}
        >
          {addLabel}
        </button>
      </div>

      {tags.length === 0 && (
        <p style={{ fontSize: 11, color: '#A09A91', margin: '8px 0 0', fontFamily: 'var(--font-sans)' }}>{emptyLabel}</p>
      )}
    </div>
  );
}
