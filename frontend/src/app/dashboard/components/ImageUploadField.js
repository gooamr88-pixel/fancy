'use client';

import React, { useRef } from 'react';

/* Presentational image upload control: a drag/click drop-zone with an inline
   preview and a remove button. Purely presentational — the parent owns the
   actual upload: `onUpload(file)` receives a File (do the storage upload and
   set the URL there), `uploading` toggles the busy state, `value` is the
   current URL, and `onClear()` removes it. Shared by the create wizard and the
   Event Settings editor so venue/photo uploads look and behave identically. */

const C = {
  gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

export default function ImageUploadField({
  value,
  onUpload,
  onClear,
  uploading = false,
  previewFit = 'cover',
  hint = 'JPG, PNG, WebP • Max 8MB',
  height = 150,
}) {
  const inputRef = useRef(null);

  const pick = (file) => { if (file && file.type.startsWith('image/')) onUpload?.(file); };

  return (
    <div>
      {value ? (
        <div style={{
          position: 'relative', borderRadius: 12, overflow: 'hidden',
          border: `1px solid ${C.border}`, height, background: C.softBg,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview"
            style={{ width: '100%', height: '100%', objectFit: previewFit }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(25,27,30,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)',
            }}>Uploading…</div>
          )}
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Replace image"
              style={pillBtn}
            >Replace</button>
            <button
              type="button"
              onClick={onClear}
              aria-label="Remove image"
              style={{ ...pillBtn, width: 28, padding: 0, fontSize: 15 }}
            >×</button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(184,148,79,0.04)'; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.softBg; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.background = C.softBg;
            pick(e.dataTransfer.files?.[0]);
          }}
          style={{
            padding: '18px 16px', borderRadius: 12, border: `2px dashed ${C.border}`,
            background: C.softBg, textAlign: 'center', cursor: uploading ? 'wait' : 'pointer',
            transition: 'all 0.25s',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.stone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.stone, fontFamily: 'var(--font-sans)' }}>
              {uploading ? 'Uploading…' : 'Drop image here or click to upload'}
            </span>
            <span style={{ fontSize: 10, color: '#A09A91', fontFamily: 'var(--font-sans)' }}>{hint}</span>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
        style={{ display: 'none' }}
      />
    </div>
  );
}

const pillBtn = {
  height: 28, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: 'rgba(25,27,30,0.75)', color: '#fff', fontSize: 12, fontWeight: 700,
  fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1,
};
