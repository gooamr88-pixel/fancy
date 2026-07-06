'use client';

import React from 'react';

const C = { gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', error: '#C45E5E' };

const rowInputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px',
  fontSize: '13px', color: C.charcoal, outline: 'none', fontFamily: 'var(--font-sans)',
};

/**
 * Generic "list of small objects with add/remove" editor — reused for the
 * Heritage Arch template's schedule items, accommodation hotels, and FAQ
 * entries instead of hand-rolling the same add/edit/remove row UI three times.
 * `columns` describes each row's inputs: { key, label, placeholder, type, options }.
 */
export default function RepeatableListEditor({ items, onChange, columns, addLabel = '+ Add row', emptyLabel = 'No items yet.' }) {
  const updateRow = (idx, key, value) => {
    const next = items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    onChange(next);
  };
  const addRow = () => onChange([...items, {}]);
  const removeRow = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {items.length === 0 && (
        <p style={{ fontSize: '12px', color: C.stone, margin: 0 }}>{emptyLabel}</p>
      )}
      {items.map((item, idx) => (
        <div key={idx} style={{
          display: 'flex', gap: '8px', alignItems: 'flex-start',
          padding: '10px', border: `1px solid ${C.border}`, borderRadius: '10px', background: C.white,
        }}>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: '8px' }}>
            {columns.map((col) => (
              <div key={col.key}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                  {col.label}
                </label>
                {col.type === 'textarea' ? (
                  <textarea
                    value={item[col.key] || ''}
                    onChange={(e) => updateRow(idx, col.key, e.target.value)}
                    placeholder={col.placeholder}
                    rows={2}
                    style={{ ...rowInputStyle, resize: 'vertical' }}
                  />
                ) : col.type === 'select' ? (
                  <select
                    value={item[col.key] || ''}
                    onChange={(e) => updateRow(idx, col.key, e.target.value)}
                    style={{ ...rowInputStyle, cursor: 'pointer' }}
                  >
                    <option value="">{col.placeholder || 'Select...'}</option>
                    {(col.options || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={col.type || 'text'}
                    value={item[col.key] || ''}
                    onChange={(e) => updateRow(idx, col.key, e.target.value)}
                    placeholder={col.placeholder}
                    style={rowInputStyle}
                  />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => removeRow(idx)}
            aria-label="Remove row"
            style={{
              flexShrink: 0, width: '30px', height: '30px', borderRadius: '8px', border: `1px solid ${C.border}`,
              background: C.white, color: C.error, cursor: 'pointer', fontSize: '15px', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        style={{
          alignSelf: 'flex-start', padding: '8px 16px', borderRadius: '8px',
          border: `1px dashed ${C.gold}`, background: 'transparent', color: C.gold,
          cursor: 'pointer', fontSize: '12px', fontWeight: 700,
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}
