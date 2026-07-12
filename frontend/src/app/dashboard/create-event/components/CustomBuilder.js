'use client';

import React from 'react';

/* ═══════════════════════════════════════════════════════════════
   CustomBuilder — the guided "design your own page" panel for the
   Custom template. Every control updates `config` via onChange and is
   reflected live in the phone simulator. Content (which kind of event
   this is, and the fields/sections that follow from it) lives on the
   next step — this panel stays focused on look & feel.
   ═══════════════════════════════════════════════════════════════ */

const FONTS = [
  { key: 'serif', label: 'Elegant', css: 'var(--font-serif)' },
  { key: 'sans', label: 'Modern', css: 'var(--font-sans)' },
  { key: 'script', label: 'Romantic', css: 'var(--font-script)' },
];

const PALETTES = [
  { name: 'Linen', primary: '#8B7355', secondary: '#D4C5A9', accent: '#8B7355', background: '#FAF8F5' },
  { name: 'Blush', primary: '#C96A7B', secondary: '#F3D3DA', accent: '#C96A7B', background: '#FFF7F8' },
  { name: 'Ocean', primary: '#2B6E8F', secondary: '#BFE0EC', accent: '#2B6E8F', background: '#F2FAFC' },
  { name: 'Forest', primary: '#3C6E47', secondary: '#BFE0C5', accent: '#3C6E47', background: '#F4FAF5' },
  { name: 'Slate', primary: '#475569', secondary: '#CBD5E1', accent: '#475569', background: '#F8FAFC' },
  { name: 'Plum', primary: '#6D4C7D', secondary: '#D9C7E4', accent: '#6D4C7D', background: '#FBF6FE' },
];

const labelStyle = {
  fontSize: 9, fontWeight: 700, color: '#77736A', textTransform: 'uppercase',
  letterSpacing: '0.08em', fontFamily: 'var(--font-sans)', marginBottom: 6, display: 'block',
};

function ColorField({ label, value, onChange }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E8E2D6', borderRadius: 8, padding: '5px 8px', background: '#fff' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 26, height: 26, border: 'none', background: 'none', padding: 0, cursor: 'pointer', borderRadius: 6 }} />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: '#77736A', textTransform: 'uppercase' }}>{value}</span>
      </div>
    </div>
  );
}

export default function CustomBuilder({ config, onChange }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(184,148,79,0.18)',
      borderRadius: 18, padding: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🎨</span>
        <div>
          <h4 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 600, color: '#191B1E' }}>Design your page</h4>
          <p style={{ margin: '1px 0 0', fontFamily: 'var(--font-sans)', fontSize: 11, color: '#77736A' }}>Every change previews live on the phone →</p>
        </div>
      </div>

      {/* Palettes */}
      <div>
        <label style={labelStyle}>Color Palette</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PALETTES.map(p => {
            const active = config.primary === p.primary && config.background === p.background;
            return (
              <button key={p.name} onClick={() => onChange({ primary: p.primary, secondary: p.secondary, accent: p.accent, background: p.background })}
                title={p.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px 5px 5px', borderRadius: 999, cursor: 'pointer',
                  border: `1.5px solid ${active ? '#B8944F' : 'rgba(184,148,79,0.18)'}`,
                  background: active ? 'rgba(184,148,79,0.08)' : '#fff',
                  boxShadow: active ? '0 2px 8px rgba(184,148,79,0.15)' : 'none', transition: 'all 0.2s',
                }}>
                <span style={{ display: 'flex' }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: p.primary, border: '1.5px solid #fff' }} />
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: p.secondary, border: '1.5px solid #fff', marginLeft: -7 }} />
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: '#191B1E' }}>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom colors */}
      <div style={{ display: 'flex', gap: 10 }}>
        <ColorField label="Primary" value={config.primary} onChange={v => onChange({ primary: v, accent: v })} />
        <ColorField label="Accent" value={config.secondary} onChange={v => onChange({ secondary: v })} />
        <ColorField label="Background" value={config.background} onChange={v => onChange({ background: v })} />
      </div>

      {/* Typography */}
      <div>
        <label style={labelStyle}>Heading Typography</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {FONTS.map(f => {
            const active = config.headingFont === f.key;
            return (
              <button key={f.key} onClick={() => onChange({ headingFont: f.key })}
                style={{
                  flex: 1, padding: '8px 6px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${active ? '#B8944F' : '#E8E2D6'}`,
                  background: active ? 'rgba(184,148,79,0.08)' : '#fff', transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                <span style={{ fontFamily: f.css, fontSize: f.key === 'script' ? 20 : 16, color: '#191B1E', lineHeight: 1 }}>Aa</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9.5, fontWeight: 600, color: active ? '#B8944F' : '#77736A' }}>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* What kind of event this is (wedding / engagement / celebration / baby
          shower), the fields that follow from it, cover image, and every
          content section (schedule, venues, accommodation, FAQ, gift list,
          gallery, dress code and more) are configured with real data and
          individually toggled on the next step — Custom gets every feature
          every other template has, so there's a lot to fit; this panel stays
          focused on look & feel. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        borderRadius: 10, background: 'rgba(184,148,79,0.06)', border: '1px solid rgba(184,148,79,0.15)',
      }}>
        <span style={{ fontSize: 14 }}>✚</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: '#77736A', lineHeight: 1.4 }}>
          Choose what kind of event this is, add your story, schedule, venues, gift list, FAQ and any other section on the next step — everything is optional and yours to switch on or off.
        </span>
      </div>
    </div>
  );
}
