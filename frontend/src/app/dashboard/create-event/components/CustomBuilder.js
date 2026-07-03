'use client';
import { toast } from '../../../utils/toast';

import React from 'react';

/* ═══════════════════════════════════════════════════════════════
   CustomBuilder — the guided "design your own page" panel for the
   Custom template. Every control updates `config` via onChange and is
   reflected live in the phone simulator.
   ═══════════════════════════════════════════════════════════════ */

const FONTS = [
  { key: 'serif', label: 'Elegant', css: 'var(--font-serif)' },
  { key: 'sans', label: 'Modern', css: 'var(--font-sans)' },
  { key: 'script', label: 'Romantic', css: 'var(--font-script)' },
];

const OCCASIONS = [
  { key: 'graduation', label: 'Graduation', emoji: '🎓', phrase: 'our graduation' },
  { key: 'farewell', label: 'Farewell', emoji: '👋', phrase: 'our farewell' },
  { key: 'other', label: 'Other', emoji: '✨', phrase: null },
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
const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E8E2D6',
  borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: '#191B1E', outline: 'none', fontFamily: 'var(--font-sans)',
};

function Toggle({ label, on, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        width: '100%', padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
        background: on ? 'rgba(184,148,79,0.07)' : '#fff',
        border: `1px solid ${on ? 'rgba(184,148,79,0.3)' : '#E8E2D6'}`,
        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: '#191B1E',
        transition: 'all 0.2s',
      }}
    >
      {label}
      <span style={{
        width: 34, height: 19, borderRadius: 999, position: 'relative', flexShrink: 0,
        background: on ? '#B8944F' : '#D1CFC9', transition: 'background 0.25s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.25s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </span>
    </button>
  );
}

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
  const sections = config.sections || {};
  const toggleSection = (key) => onChange({ sections: { [key]: !sections[key] } });

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

      {/* Occasion type — drives the "We are inviting you to our…" invite line */}
      <div>
        <label style={labelStyle}>Occasion</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {OCCASIONS.map(o => {
            const active = config.occasionType === o.key;
            return (
              <button key={o.key} onClick={() => onChange({ occasionType: o.key })}
                style={{
                  flex: 1, padding: '8px 6px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${active ? '#B8944F' : '#E8E2D6'}`,
                  background: active ? 'rgba(184,148,79,0.08)' : '#fff', transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>{o.emoji}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, color: active ? '#B8944F' : '#77736A' }}>{o.label}</span>
              </button>
            );
          })}
        </div>
        {config.occasionType === 'other' && (
          <input
            style={{ ...inputStyle, marginTop: 8 }}
            value={config.occasionLabel || ''}
            onChange={e => onChange({ occasionLabel: e.target.value })}
            placeholder="e.g. our housewarming"
          />
        )}
        {config.occasionType && (
          <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-sans)', fontSize: 10.5, color: '#77736A', fontStyle: 'italic' }}>
            Invite line will read: “We are inviting you to {
              OCCASIONS.find(o => o.key === config.occasionType)?.phrase
                || config.occasionLabel
                || 'our celebration'
            }”
          </p>
        )}
      </div>

      {/* Headline + CTA */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Headline</label>
          <input style={inputStyle} value={config.headline || ''} onChange={e => onChange({ headline: e.target.value })} placeholder="You’re Invited" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>RSVP Button Label</label>
          <input style={inputStyle} value={config.ctaLabel || ''} onChange={e => onChange({ ctaLabel: e.target.value })} placeholder="RSVP Now" />
        </div>
      </div>

      {/* Cover image */}
      <div>
        <label style={labelStyle}>Cover Image (optional)</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            padding: '7px 10px', borderRadius: 8, border: '1px solid #B8944F', color: '#B8944F',
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            ⬆ Upload
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 8 * 1024 * 1024) { toast.error('File exceeds 8MB.'); return; }
              try {
                const { supabase } = await import('../../../utils/supabaseClient');
                if (!supabase) throw new Error('Storage not configured');
                const ext = file.name.split('.').pop();
                const filePath = `covers/custom-${Date.now()}.${ext}`;
                const { error: err } = await supabase.storage.from('event-assets').upload(filePath, file, { cacheControl: '3600', upsert: true });
                if (err) throw err;
                const { data: { publicUrl } } = supabase.storage.from('event-assets').getPublicUrl(filePath);
                onChange({ coverImageUrl: publicUrl });
              } catch (err) {
                console.error('Cover upload failed:', err);
                toast.error('Cover image upload failed. Please try again.');
              }
            }} />
          </label>
        </div>
        {config.coverImageUrl && (
          <div style={{
            marginTop: 8, borderRadius: 10, overflow: 'hidden', height: 80,
            border: '1px solid #E8E2D6', position: 'relative', background: '#FAFAF8',
          }}>
            <img src={config.coverImageUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none'; }} />
            <button type="button" onClick={() => onChange({ coverImageUrl: '' })}
              style={{
                position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                border: 'none', background: 'rgba(25,27,30,0.7)', color: '#fff', cursor: 'pointer',
                fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
          </div>
        )}
      </div>

      {/* Section toggles */}
      <div>
        <label style={labelStyle}>Sections</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Toggle label="Event details" on={!!sections.details} onClick={() => toggleSection('details')} />
          <Toggle label="Photo gallery" on={!!sections.gallery} onClick={() => toggleSection('gallery')} />
          <Toggle label="Message the host" on={!!sections.messageHost} onClick={() => toggleSection('messageHost')} />
        </div>
      </div>
    </div>
  );
}
