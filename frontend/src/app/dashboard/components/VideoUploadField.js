'use client';

import React, { useRef } from 'react';

/* Presentational video upload control — sibling to ImageUploadField.js, not a
   modification of it (different preview element and accept type: a <video>
   preview instead of <img>, and a much larger practical file size). Purely
   presentational — the parent owns the actual upload: `onUpload(file)`
   receives a File (do the storage upload and set the URL there), `uploading`
   toggles the busy state, `value` is the current URL, `onClear()` removes it.
   There is no server-side video compression anywhere in this codebase, so
   `maxSizeMb` is enforced client-side only — a stopgap, not a real fix. */

const C = {
  gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

export default function VideoUploadField({
  value,
  onUpload,
  onClear,
  uploading = false,
  height = 150,
  maxSizeMb = 20,
  hint,
}) {
  const inputRef = useRef(null);
  const [sizeError, setSizeError] = React.useState('');

  const pick = (file) => {
    if (!file || !file.type.startsWith('video/')) return;
    setSizeError('');
    if (file.size > maxSizeMb * 1024 * 1024) {
      setSizeError(`Video is too large — please keep it under ${maxSizeMb}MB.`);
      return;
    }
    onUpload?.(file);
  };

  return (
    <div>
      {value ? (
        <div style={{
          position: 'relative', borderRadius: 12, overflow: 'hidden',
          border: `1px solid ${C.border}`, height, background: '#000',
        }}>
          <video
            src={value}
            muted
            loop
            playsInline
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
              aria-label="Replace video"
              style={pillBtn}
            >Replace</button>
            <button
              type="button"
              onClick={onClear}
              aria-label="Remove video"
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
              <rect x="2.5" y="5" width="15" height="14" rx="2.5" />
              <path d="m17.5 10 4-2.5v9l-4-2.5" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.stone, fontFamily: 'var(--font-sans)' }}>
              {uploading ? 'Uploading…' : 'Drop video here or click to upload'}
            </span>
            <span style={{ fontSize: 10, color: '#A09A91', fontFamily: 'var(--font-sans)' }}>
              {hint || `MP4, WebM • Max ${maxSizeMb}MB`}
            </span>
          </div>
        </div>
      )}

      {sizeError && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#B3261E', fontFamily: 'var(--font-sans)' }}>
          {sizeError}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
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
