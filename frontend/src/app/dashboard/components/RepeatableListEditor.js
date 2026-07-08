'use client';

import React, { useState } from 'react';
import ImageUploadField from './ImageUploadField';

const C = { gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8', error: '#C45E5E' };

const rowInputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px',
  fontSize: '13px', color: C.charcoal, outline: 'none', fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};
const focusRow = (e) => { e.target.style.borderColor = C.gold; e.target.style.boxShadow = '0 0 0 3px rgba(184,148,79,0.08)'; };
const blurRow = (e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; };

const iconBtn = (disabled) => ({
  width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.white, color: disabled ? '#CFC8BB' : C.stone, cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s',
});

/**
 * Generic "list of small objects with add/remove" editor — reused for the
 * Heritage Arch template's schedule items, accommodation hotels, FAQ, menu and
 * things-to-do lists instead of hand-rolling the same UI many times.
 *
 * `columns` describes each row's inputs: { key, label, placeholder, type, options }.
 * `type` may be 'text' (default), 'textarea', 'select', or 'image'. Image columns
 * render an upload control and require an `onUploadImage(file) => Promise<url>`
 * prop; without it they fall back to a plain URL text field. Each item also gets
 * a header row with its number and reorder / remove controls.
 */
export default function RepeatableListEditor({
  items, onChange, columns, onUploadImage,
  addLabel = '+ Add row', emptyLabel = 'No items yet.', itemNoun = 'Item',
}) {
  const list = Array.isArray(items) ? items : [];
  const [uploading, setUploading] = useState({}); // `${idx}-${key}` -> bool

  const updateRow = (idx, key, value) => onChange(list.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  const addRow = () => onChange([...list, {}]);
  const removeRow = (idx) => onChange(list.filter((_, i) => i !== idx));
  const moveRow = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const handleUpload = async (idx, key, file) => {
    if (!onUploadImage) return;
    const busyKey = `${idx}-${key}`;
    setUploading((u) => ({ ...u, [busyKey]: true }));
    try {
      const url = await onUploadImage(file);
      if (url) updateRow(idx, key, url);
    } finally {
      setUploading((u) => ({ ...u, [busyKey]: false }));
    }
  };

  const renderField = (idx, item, col) => {
    if (col.type === 'textarea') {
      return (
        <textarea
          value={item[col.key] || ''}
          onChange={(e) => updateRow(idx, col.key, e.target.value)}
          placeholder={col.placeholder}
          rows={2}
          style={{ ...rowInputStyle, resize: 'vertical' }}
          onFocus={focusRow} onBlur={blurRow}
        />
      );
    }
    if (col.type === 'select') {
      return (
        <select
          value={item[col.key] || ''}
          onChange={(e) => updateRow(idx, col.key, e.target.value)}
          style={{ ...rowInputStyle, cursor: 'pointer' }}
          onFocus={focusRow} onBlur={blurRow}
        >
          <option value="">{col.placeholder || 'Select...'}</option>
          {(col.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    if (col.type === 'image' && onUploadImage) {
      return (
        <ImageUploadField
          value={item[col.key] || ''}
          uploading={!!uploading[`${idx}-${col.key}`]}
          onUpload={(file) => handleUpload(idx, col.key, file)}
          onClear={() => updateRow(idx, col.key, '')}
          height={120}
        />
      );
    }
    return (
      <input
        type={col.type === 'image' ? 'url' : (col.type || 'text')}
        value={item[col.key] || ''}
        onChange={(e) => updateRow(idx, col.key, e.target.value)}
        placeholder={col.placeholder}
        style={rowInputStyle}
        onFocus={focusRow} onBlur={blurRow}
      />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {list.length === 0 && (
        <p style={{ fontSize: '12px', color: C.stone, margin: 0 }}>{emptyLabel}</p>
      )}
      {list.map((item, idx) => (
        <div key={idx} style={{
          border: `1px solid ${C.border}`, borderRadius: '12px', background: C.white, overflow: 'hidden',
        }}>
          {/* Item header — number + reorder + remove */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 14px',
            background: C.softBg, borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>
              {itemNoun} {idx + 1}
            </span>
            <button type="button" onClick={() => moveRow(idx, -1)} disabled={idx === 0} aria-label="Move up" style={iconBtn(idx === 0)}>↑</button>
            <button type="button" onClick={() => moveRow(idx, 1)} disabled={idx === list.length - 1} aria-label="Move down" style={iconBtn(idx === list.length - 1)}>↓</button>
            <button type="button" onClick={() => removeRow(idx)} aria-label="Remove" style={{ ...iconBtn(false), color: C.error, borderColor: 'rgba(196,94,94,0.35)' }}>✕</button>
          </div>

          <div style={{
            padding: '12px', display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px',
          }}>
            {columns.map((col) => {
              const fullWidth = col.type === 'textarea' || col.type === 'image' || col.full;
              return (
                <div key={col.key} style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                    {col.label}
                  </label>
                  {renderField(idx, item, col)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        style={{
          alignSelf: 'flex-start', padding: '9px 18px', borderRadius: '8px',
          border: `1px dashed ${C.gold}`, background: 'rgba(184,148,79,0.05)', color: C.gold,
          cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)',
          transition: 'background 0.2s',
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}
