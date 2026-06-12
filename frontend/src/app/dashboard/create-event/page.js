'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PlacesAutocomplete from '../../components/PlacesAutocomplete';

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════ */
const C = {
  gold: '#B8944F', goldHover: '#a6833f', goldLight: '#D4B96A',
  charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6',
  white: '#FFFFFF', softBg: '#FAFAF8', error: '#C45E5E', success: '#3B9B6D',
  darkBg: '#08090C', darkCard: '#0E1015', darkBorder: '#1E2028',
  goldGlow: 'rgba(184,148,79,0.25)',
};

/* ═══════════════════════════════════════════════════════════
   TEMPLATE DATA
   ═══════════════════════════════════════════════════════════ */
const TEMPLATES = [
  {
    key: 'wedding', label: 'Wedding', icon: '💍',
    desc: 'Elegant ceremony & reception RSVP with meal selection',
    colors: { primary: '#B8944F', secondary: '#D7BE80', accent: '#191B1E', background: '#F8F4EC' },
    gradient: 'linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)',
    cardTheme: {
      bg: 'linear-gradient(180deg, #FFFDF8 0%, #F8F2E4 100%)',
      flapBg: 'linear-gradient(180deg, #F5EDD8 0%, #EDE3CC 100%)',
      accent: '#B8944F', text: '#3D3425', subtext: '#9A917F',
      borderAccent: '#D4C5A0',
      line1: 'Together with their families', line2: 'Julian & Sophia',
      line3: 'request the pleasure of your company\nat the celebration of their marriage',
      ornament: '❧', sealEmoji: '💍', fontFamily: 'var(--font-serif)',
      headerFont: 'var(--font-script)',
    },
  },
  {
    key: 'engagement', label: 'Engagement', icon: '💎',
    desc: 'Celebrate your love story with a stunning invitation',
    colors: { primary: '#C27B8E', secondary: '#E8B4C0', accent: '#2D1F26', background: '#FDF5F7' },
    gradient: 'linear-gradient(135deg, #C27B8E 0%, #E8B4C0 100%)',
    cardTheme: {
      bg: 'linear-gradient(180deg, #FFF8FA 0%, #FDF0F4 100%)',
      flapBg: 'linear-gradient(180deg, #F9DDE5 0%, #F0C8D4 100%)',
      accent: '#C27B8E', text: '#3D1F2A', subtext: '#B8909A',
      borderAccent: '#E8B4C0',
      line1: 'She said yes!', line2: 'We\'re Engaged',
      line3: 'Join us as we celebrate\nthe beginning of forever',
      ornament: '♥', sealEmoji: '💎', fontFamily: 'var(--font-serif)',
      headerFont: 'var(--font-script)',
    },
  },
  {
    key: 'corporate', label: 'Corporate', icon: '🏢',
    desc: 'Professional event with agenda, speakers & check-in',
    colors: { primary: '#2563EB', secondary: '#60A5FA', accent: '#1E293B', background: '#F8FAFC' },
    gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
    cardTheme: {
      bg: 'linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)',
      flapBg: 'linear-gradient(180deg, #DBEAFE 0%, #BFDBFE 100%)',
      accent: '#2563EB', text: '#0F172A', subtext: '#64748B',
      borderAccent: '#93C5FD',
      line1: 'You\'re Invited To Attend', line2: 'Tech Summit \'26',
      line3: 'Innovation · Leadership · Growth\nSilicon Valley Convention Center',
      ornament: '◆', sealEmoji: '🏢', fontFamily: 'var(--font-sans)',
      headerFont: 'var(--font-sans)',
    },
  },
  {
    key: 'birthday', label: 'Birthday', icon: '🎂',
    desc: 'Fun and colorful birthday party invitation',
    colors: { primary: '#E85D75', secondary: '#F9A8B8', accent: '#3D1520', background: '#FFF5F7' },
    gradient: 'linear-gradient(135deg, #E85D75 0%, #F472B6 100%)',
    cardTheme: {
      bg: 'linear-gradient(180deg, #FFFBFC 0%, #FFF1F4 100%)',
      flapBg: 'linear-gradient(180deg, #FECDD3 0%, #FDA4AF 100%)',
      accent: '#E85D75', text: '#1F0710', subtext: '#BE7080',
      borderAccent: '#F9A8B8',
      line1: 'You\'re Invited!', line2: 'Let\'s Party!',
      line3: 'Come celebrate with us\nfor an unforgettable night',
      ornament: '✦', sealEmoji: '🎂', fontFamily: 'var(--font-sans)',
      headerFont: 'var(--font-sans)',
    },
  },
  {
    key: 'gala', label: 'Gala / Formal', icon: '🥂',
    desc: 'Black-tie galas, fundraisers, and prestigious events',
    colors: { primary: '#1E293B', secondary: '#475569', accent: '#B8944F', background: '#F1F5F9' },
    gradient: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
    cardTheme: {
      bg: 'linear-gradient(180deg, #111827 0%, #0A0E17 100%)',
      flapBg: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
      accent: '#B8944F', text: '#F1E8D5', subtext: '#8B8170',
      borderAccent: '#B8944F',
      line1: 'The honour of your presence', line2: 'Annual Gala',
      line3: 'Black Tie · Cocktails · Dinner\nThe Grand Ballroom',
      ornament: '❖', sealEmoji: '🥂', fontFamily: 'var(--font-serif)',
      headerFont: 'var(--font-serif)',
      dark: true,
    },
  },
  {
    key: 'custom', label: 'Custom', icon: '✨',
    desc: 'Start from scratch — fully customizable event page',
    colors: { primary: '#B8944F', secondary: '#D7BE80', accent: '#191B1E', background: '#F8F4EC' },
    gradient: 'linear-gradient(135deg, #B8944F 0%, #8B6F3A 100%)',
    cardTheme: {
      bg: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAF7 100%)',
      flapBg: 'linear-gradient(180deg, #F3EEE3 0%, #E8E0CF 100%)',
      accent: '#B8944F', text: '#1A1A1A', subtext: '#9A9488',
      borderAccent: '#D4C5A0',
      line1: 'Your Vision', line2: 'Your Event',
      line3: 'A blank canvas to create\nsomething extraordinary',
      ornament: '◇', sealEmoji: '✨', fontFamily: 'var(--font-serif)',
      headerFont: 'var(--font-serif)',
    },
  },
];

const STEPS = [
  { key: 'template', label: 'Template', icon: '🎨' },
  { key: 'details', label: 'Details', icon: '📋' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
  { key: 'preview', label: 'Create', icon: '🚀' },
];

const DRESS_CODES = [
  '', 'Black Tie', 'Black Tie Optional', 'Cocktail Attire',
  'Semi-Formal', 'Business Casual', 'Casual', 'White Party', 'Themed',
];

/* ═══════════════════════════════════════════════════════════
   FLOATING PARTICLES (pure CSS ambient effect)
   ═══════════════════════════════════════════════════════════ */
function FloatingParticles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    size: 2 + Math.random() * 4,
    duration: 8 + Math.random() * 12,
    delay: Math.random() * 10,
    opacity: 0.15 + Math.random() * 0.35,
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: p.left, bottom: '-20px',
          width: `${p.size}px`, height: `${p.size}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${C.gold} 0%, transparent 70%)`,
          opacity: p.opacity,
          animation: `ce-float ${p.duration}s ${p.delay}s ease-in-out infinite`,
        }} />
      ))}
      {/* Ambient gradient orbs */}
      <div style={{
        position: 'absolute', top: '10%', left: '10%', width: '400px', height: '400px',
        borderRadius: '50%', background: `radial-gradient(circle, rgba(184,148,79,0.06) 0%, transparent 70%)`,
        filter: 'blur(60px)', animation: 'ce-drift 20s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '20%', right: '5%', width: '300px', height: '300px',
        borderRadius: '50%', background: `radial-gradient(circle, rgba(215,190,128,0.05) 0%, transparent 70%)`,
        filter: 'blur(50px)', animation: 'ce-drift 15s 5s ease-in-out infinite reverse',
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INVITATION CARD COMPONENT
   ═══════════════════════════════════════════════════════════ */
function InvitationCard({ tpl, isSelected, onSelect, index }) {
  const [hovered, setHovered] = useState(false);
  const t = tpl.cardTheme;
  const isDark = t.dark;

  return (
    <div
      style={{
        animation: `ce-cardEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.12}s both`,
      }}
    >
      <button
        onClick={onSelect}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={`Select ${tpl.label} template`}
        style={{
          position: 'relative', width: '100%', aspectRatio: '5/7',
          perspective: '1400px', border: 'none', background: 'none',
          cursor: 'pointer', padding: 0, display: 'block',
        }}
      >
        {/* ── GLOW behind card ── */}
        <div style={{
          position: 'absolute', inset: '-12px',
          borderRadius: '28px',
          background: isSelected
            ? `radial-gradient(circle, ${t.accent}30 0%, transparent 70%)`
            : hovered
              ? `radial-gradient(circle, ${t.accent}15 0%, transparent 70%)`
              : 'none',
          transition: 'all 0.6s ease',
          filter: 'blur(8px)',
          zIndex: 0,
        }} />

        {/* ── Card wrapper with 3D ── */}
        <div style={{
          width: '100%', height: '100%', position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: hovered
            ? 'rotateY(-4deg) rotateX(3deg) translateY(-8px) scale(1.03)'
            : isSelected
              ? 'scale(1.01)'
              : 'scale(1)',
        }}>

          {/* ═══ ENVELOPE FLAP ═══ */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
            transformOrigin: 'top center',
            transform: hovered ? 'rotateX(-170deg)' : 'rotateX(0deg)',
            transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: hovered ? 1 : 15,
            borderRadius: '18px 18px 0 0',
            overflow: 'hidden',
          }}>
            {/* Flap FRONT */}
            <div style={{
              width: '100%', height: '100%',
              background: t.flapBg,
              borderRadius: '18px 18px 0 0',
              border: `1px solid ${t.borderAccent}40`,
              borderBottom: 'none',
              backfaceVisibility: 'hidden',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '14px', padding: '20px 16px',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Subtle texture overlay */}
              <div style={{
                position: 'absolute', inset: 0, opacity: 0.03,
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23${isDark ? 'ffffff' : '000000'}' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />

              {/* Wax Seal */}
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: tpl.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px',
                boxShadow: `0 4px 20px ${t.accent}40, inset 0 1px 0 rgba(255,255,255,0.2)`,
                border: `2px solid ${t.accent}30`,
                position: 'relative',
                transition: 'transform 0.4s ease',
                transform: hovered ? 'scale(1.1)' : 'scale(1)',
              }}>
                {tpl.icon}
                {/* Seal rim detail */}
                <div style={{
                  position: 'absolute', inset: '-3px', borderRadius: '50%',
                  border: `1px dashed ${t.accent}40`,
                }} />
              </div>

              {/* Label */}
              <span style={{
                fontFamily: t.fontFamily, fontSize: '17px', fontWeight: 700,
                color: t.text, letterSpacing: '-0.01em',
              }}>
                {tpl.label}
              </span>

              {/* Hover hint */}
              <span style={{
                fontSize: '9px', fontWeight: 600, color: t.subtext,
                textTransform: 'uppercase', letterSpacing: '0.2em',
                transition: 'opacity 0.3s', opacity: hovered ? 0 : 0.7,
              }}>
                Hover to preview
              </span>
            </div>

            {/* Flap BACK */}
            <div style={{
              position: 'absolute', inset: 0,
              background: isDark ? '#0D1117' : '#EDE5D4',
              backfaceVisibility: 'hidden',
              transform: 'rotateX(180deg)',
              borderRadius: '18px 18px 0 0',
            }}>
              <div style={{
                width: '100%', height: '100%', opacity: 0.05,
                backgroundImage: `repeating-linear-gradient(45deg, ${t.accent} 0px, ${t.accent} 1px, transparent 1px, transparent 10px)`,
              }} />
            </div>
          </div>

          {/* ═══ CARD BODY (The Invitation) ═══ */}
          <div style={{
            position: 'absolute', inset: 0,
            background: t.bg,
            borderRadius: '18px',
            border: `1px solid ${t.borderAccent}40`,
            overflow: 'hidden',
            zIndex: 2,
            boxShadow: hovered
              ? `0 25px 60px rgba(0,0,0,${isDark ? '0.5' : '0.15'}), 0 10px 20px rgba(0,0,0,${isDark ? '0.3' : '0.08'})`
              : `0 4px 20px rgba(0,0,0,${isDark ? '0.3' : '0.06'})`,
            transition: 'box-shadow 0.6s ease',
          }}>
            {/* Inner decorative frame */}
            <div style={{
              position: 'absolute', inset: '12px',
              border: `1px solid ${t.accent}15`,
              borderRadius: '12px', pointerEvents: 'none',
            }} />

            {/* Corner ornaments */}
            {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => {
              const isTop = pos.includes('top');
              const isLeft = pos.includes('left');
              return (
                <div key={pos} style={{
                  position: 'absolute',
                  top: isTop ? '16px' : 'auto',
                  bottom: isTop ? 'auto' : '16px',
                  left: isLeft ? '16px' : 'auto',
                  right: isLeft ? 'auto' : '16px',
                  width: '16px', height: '16px',
                  borderTop: isTop ? `1.5px solid ${t.accent}30` : 'none',
                  borderBottom: isTop ? 'none' : `1.5px solid ${t.accent}30`,
                  borderLeft: isLeft ? `1.5px solid ${t.accent}30` : 'none',
                  borderRight: isLeft ? 'none' : `1.5px solid ${t.accent}30`,
                  pointerEvents: 'none',
                }} />
              );
            })}

            {/* ── Invitation Content ── */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '32px 24px 24px',
              gap: '6px',
            }}>
              {/* Top ornament row */}
              <div style={{
                fontSize: '14px', color: t.accent, letterSpacing: '8px',
                opacity: 0.4, marginBottom: '4px',
              }}>
                {t.ornament} {t.ornament} {t.ornament}
              </div>

              {/* Line 1 — subtitle */}
              <span style={{
                fontSize: '9px', fontWeight: 600, color: t.subtext,
                textTransform: 'uppercase', letterSpacing: '0.25em',
                textAlign: 'center',
              }}>
                {t.line1}
              </span>

              {/* Main heading */}
              <span style={{
                fontFamily: t.headerFont,
                fontSize: t.headerFont.includes('script') ? 'clamp(22px, 2.8vw, 30px)' : 'clamp(18px, 2.2vw, 24px)',
                fontWeight: t.headerFont.includes('script') ? 400 : 700,
                color: t.text,
                textAlign: 'center', lineHeight: 1.2,
                margin: '4px 0',
                background: t.headerFont.includes('script')
                  ? 'none'
                  : `linear-gradient(135deg, ${t.text}, ${t.accent})`,
                WebkitBackgroundClip: t.headerFont.includes('script') ? 'unset' : 'text',
                WebkitTextFillColor: t.headerFont.includes('script') ? t.text : 'transparent',
              }}>
                {t.line2}
              </span>

              {/* Gold divider with diamond */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                margin: '6px 0',
              }}>
                <div style={{ width: '28px', height: '1px', background: `linear-gradient(90deg, transparent, ${t.accent}60)` }} />
                <div style={{
                  width: '5px', height: '5px', background: t.accent,
                  transform: 'rotate(45deg)', opacity: 0.5,
                }} />
                <div style={{ width: '28px', height: '1px', background: `linear-gradient(90deg, ${t.accent}60, transparent)` }} />
              </div>

              {/* Line 3 — details */}
              <span style={{
                fontSize: '9px', color: t.subtext,
                textAlign: 'center', lineHeight: 1.8,
                whiteSpace: 'pre-line', maxWidth: '90%',
                fontWeight: 400,
              }}>
                {t.line3}
              </span>

              {/* Bottom ornament */}
              <div style={{
                fontSize: '10px', color: t.accent, opacity: 0.25,
                marginTop: '6px', letterSpacing: '6px',
              }}>
                {t.ornament}
              </div>

              {/* Color palette */}
              <div style={{
                display: 'flex', gap: '4px', marginTop: '8px',
                padding: '5px 10px', borderRadius: '100px',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}`,
              }}>
                {Object.values(tpl.colors).map((color, i) => (
                  <div key={i} style={{
                    width: '8px', height: '8px', borderRadius: '50%', background: color,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
                    transition: 'transform 0.3s ease',
                    transform: hovered ? 'scale(1.2)' : 'scale(1)',
                    transitionDelay: `${i * 50}ms`,
                  }} />
                ))}
              </div>
            </div>

            {/* Shimmer sweep effect on hover */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,${isDark ? '0.03' : '0.08'}) 45%, transparent 50%)`,
              backgroundSize: '200% 100%',
              animation: hovered ? 'ce-shimmerSweep 1.2s ease forwards' : 'none',
              pointerEvents: 'none',
              borderRadius: '18px',
            }} />
          </div>

          {/* ── Selected ring ── */}
          {isSelected && (
            <>
              <div style={{
                position: 'absolute', inset: '-3px', borderRadius: '20px',
                border: `2px solid ${C.gold}`,
                boxShadow: `0 0 24px ${C.goldGlow}`,
                animation: 'ce-scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                zIndex: 20, pointerEvents: 'none',
              }} />
              {/* Checkmark badge */}
              <div style={{
                position: 'absolute', top: '-10px', right: '-10px', zIndex: 25,
                width: '30px', height: '30px', borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 14px ${C.goldGlow}`,
                animation: 'ce-badgePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                border: `2px solid ${C.darkBg}`,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3.5 7L5.5 9L10.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </>
          )}
        </div>
      </button>

      {/* Template label below card */}
      <div style={{
        textAlign: 'center', marginTop: '14px',
        transition: 'all 0.3s ease',
      }}>
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: '14px', fontWeight: 600,
          color: isSelected ? C.gold : hovered ? C.champagne : 'rgba(255,255,255,0.6)',
          transition: 'color 0.3s ease',
        }}>
          {tpl.label}
        </span>
        <span style={{
          display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.3)',
          marginTop: '4px', lineHeight: 1.4,
          fontWeight: 400,
        }}>
          {tpl.desc}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN WIZARD
   ═══════════════════════════════════════════════════════════ */
export default function CreateEventWizard() {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [slugStatus, setSlugStatus] = useState(null);
  const [suggestedSlug, setSuggestedSlug] = useState('');
  const [mounted, setMounted] = useState(false);

  const [templateType, setTemplateType] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [rsvpDeadline, setRsvpDeadline] = useState('');
  const [privacyMode, setPrivacyMode] = useState('private');
  const [accessPassword, setAccessPassword] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [customColors, setCustomColors] = useState({});
  const [templateData, setTemplateData] = useState({});
  const [locationLat, setLocationLat] = useState(null);
  const [locationLng, setLocationLng] = useState(null);
  const [locationPlaceId, setLocationPlaceId] = useState('');

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const orgId = localStorage.getItem('org_id');
      if (!orgId) router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (title) {
      const generated = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
      setSlug(generated);
    }
  }, [title]);

  useEffect(() => {
    if (!slug || slug.length < 3) { setSlugStatus(null); return; }
    setSlugStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl}/public/events/${slug}`);
        if (res.status === 404) setSlugStatus('available');
        else if (res.ok) { setSlugStatus('taken'); setSuggestedSlug(`${slug}-${new Date().getFullYear()}`); }
        else setSlugStatus('error');
      } catch { setSlugStatus('error'); }
    }, 500);
    return () => clearTimeout(timer);
  }, [slug, apiUrl]);

  const handleTemplateSelect = (tpl) => {
    setTemplateType(tpl.key);
    setCustomColors(tpl.colors);
    setTemplateData({});
    setTimeout(() => setStep(1), 300);
  };

  const canProceed = useCallback(() => {
    if (step === 0) return !!templateType;
    if (step === 1) return !!title && !!slug && !!eventDate && slugStatus !== 'taken';
    if (step === 2) return true;
    return true;
  }, [step, templateType, title, slug, eventDate, slugStatus]);

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      const payload = {
        slug, templateType, title, description, eventDate,
        eventEndDate: eventEndDate || undefined, locationName: locationName || undefined,
        locationAddress: locationAddress || undefined, locationLat: locationLat || undefined,
        locationLng: locationLng || undefined, locationPlaceId: locationPlaceId || undefined,
        dressCode: dressCode || undefined, rsvpDeadline: rsvpDeadline || undefined, privacyMode,
        accessPassword: privacyMode === 'password' ? accessPassword : undefined,
        coverImageUrl: coverImageUrl || undefined, customColors,
        templateData: Object.keys(templateData).length > 0 ? templateData : undefined,
      };
      const res = await fetch(`${apiUrl}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'SLUG_TAKEN') { setSlugStatus('taken'); setSuggestedSlug(data.suggestedSlug); setStep(1); throw new Error('This event URL is already taken.'); }
        throw new Error(data.message || 'Failed to create event');
      }
      router.push('/dashboard');
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  };

  const selectedTemplate = TEMPLATES.find(t => t.key === templateType);
  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fancyrsvp.com';

  /* ── Input helpers ── */
  const FancyInput = ({ label, required, children, hint }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {label && <label style={{ fontSize: '11px', fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-sans)' }}>{label} {required && <span style={{ color: C.gold, fontSize: '13px' }}>*</span>}</label>}
      {children}
      {hint && <span style={{ fontSize: '11px', color: C.stone, opacity: 0.7 }}>{hint}</span>}
    </div>
  );

  const iStyle = {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px',
    background: C.white, border: `1.5px solid ${C.border}`, borderRadius: '12px',
    fontSize: '14px', color: C.charcoal, outline: 'none', fontFamily: 'var(--font-sans)',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  };
  const onFocus = (e) => { e.target.style.borderColor = C.gold; e.target.style.boxShadow = `0 0 0 4px ${C.goldGlow}`; };
  const onBlur = (e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; };

  /* ── Nav button helpers ── */
  const BackBtn = ({ onClick, label }) => (
    <button onClick={onClick} style={{ background: 'none', border: `1.5px solid ${C.border}`, borderRadius: '12px', padding: '12px 24px', fontSize: '13px', color: C.stone, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      {label}
    </button>
  );

  const NextBtn = ({ onClick, label, disabled }) => (
    <button disabled={disabled} onClick={onClick} style={{
      padding: '14px 32px', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px',
      cursor: disabled ? 'default' : 'pointer', fontFamily: 'var(--font-sans)',
      background: disabled ? C.border : `linear-gradient(135deg, ${C.gold}, ${C.goldHover})`,
      color: disabled ? C.stone : C.white,
      boxShadow: disabled ? 'none' : `0 4px 20px ${C.goldGlow}`,
      display: 'flex', alignItems: 'center', gap: '6px',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      transform: disabled ? 'none' : 'translateY(0)',
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 30px ${C.goldGlow}`; }}}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${C.goldGlow}`; }}}
    >
      {label}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: step === 0 ? C.darkBg : C.softBg, fontFamily: 'var(--font-sans)', transition: 'background 0.8s ease' }}>

      {/* ═══ TOPBAR ═══ */}
      <div style={{
        padding: '0 32px', height: '64px',
        background: step === 0 ? 'rgba(8,9,12,0.8)' : 'rgba(255,255,255,0.9)',
        borderBottom: step === 0 ? '1px solid rgba(184,148,79,0.08)' : `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 100,
        transition: 'all 0.5s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard" style={{ fontSize: '13px', color: step === 0 ? 'rgba(255,255,255,0.4)' : C.stone, textDecoration: 'none', fontWeight: 600, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14L6 9L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <div style={{ width: '1px', height: '20px', background: step === 0 ? 'rgba(255,255,255,0.08)' : C.border }} />
          <span style={{ fontFamily: 'var(--font-script)', fontSize: '22px', color: step === 0 ? C.gold : C.gold, letterSpacing: '1px' }}>Fancy</span>
        </div>
        {/* Progress dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {STEPS.map((s, i) => (
            <div key={s.key} onClick={() => { if (i < step) setStep(i); }} style={{
              width: i === step ? '28px' : '8px', height: '8px', borderRadius: '4px',
              background: i === step ? `linear-gradient(90deg, ${C.gold}, ${C.champagne})` : i < step ? C.champagne : (step === 0 ? 'rgba(255,255,255,0.1)' : C.border),
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: i < step ? 'pointer' : 'default',
            }} />
          ))}
        </div>
      </div>

      {/* ═══ STEPPER BAR (for steps > 0) ═══ */}
      {step > 0 && (
        <div style={{ maxWidth: '860px', margin: '28px auto 0', padding: '0 24px', animation: 'ce-fadeIn 0.4s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, background: C.white, borderRadius: '14px', padding: '5px', border: `1px solid ${C.border}`, boxShadow: '0 1px 8px rgba(0,0,0,0.03)' }}>
            {STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <button onClick={() => { if (i < step) setStep(i); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: i <= step ? 'pointer' : 'default', background: step === i ? `linear-gradient(135deg, ${C.gold}, ${C.champagne})` : 'transparent', color: step === i ? C.white : i < step ? C.gold : C.stone, fontWeight: step === i ? 700 : 500, fontSize: '12px', fontFamily: 'var(--font-sans)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', opacity: i > step ? 0.35 : 1 }}>
                  {i < step ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill={C.gold} opacity="0.12"/><path d="M4.5 7L6 8.5L9.5 5.5" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> : <span style={{ fontSize: '13px' }}>{s.icon}</span>}
                  <span className="ce-step-label">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div style={{ width: '24px', height: '2px', borderRadius: '1px', background: i < step ? `linear-gradient(90deg, ${C.gold}, ${C.champagne})` : C.border, transition: 'background 0.5s ease', flexShrink: 0 }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: step === 0 ? '0' : '28px 24px 80px' }}>

        {/* ════════════════════════════════════════
           STEP 0 — TEMPLATE SELECTION
           ════════════════════════════════════════ */}
        {step === 0 && (
          <div style={{ position: 'relative', padding: '40px 24px 80px' }}>
            <FloatingParticles />

            {/* Hero heading */}
            <div style={{
              position: 'relative', zIndex: 1, textAlign: 'center',
              marginBottom: '52px',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              {/* Badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '7px 18px', borderRadius: '100px',
                background: 'rgba(184,148,79,0.06)', border: '1px solid rgba(184,148,79,0.12)',
                marginBottom: '28px',
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.gold, animation: 'ce-pulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: C.champagne, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                  New Event
                </span>
              </div>

              <h2 style={{
                fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 5vw, 48px)',
                fontWeight: 500, color: C.white, margin: '0 0 16px', letterSpacing: '-0.025em', lineHeight: 1.1,
              }}>
                Choose Your
              </h2>
              <h2 style={{
                fontFamily: 'var(--font-script)', fontSize: 'clamp(36px, 6vw, 64px)',
                fontWeight: 400, margin: '0 0 20px', lineHeight: 1,
                background: `linear-gradient(135deg, ${C.gold} 20%, ${C.champagne} 50%, ${C.goldLight} 80%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundSize: '200% auto',
                animation: 'ce-gradientShift 4s ease infinite',
              }}>
                Invitation
              </h2>

              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', fontWeight: 400, maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>
                Hover to preview each style. Every template is handcrafted with unique aesthetics for your occasion.
              </p>

              {/* Ornamental divider */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '28px' }}>
                <div style={{ width: '40px', height: '1px', background: `linear-gradient(90deg, transparent, ${C.gold}40)` }} />
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: C.gold, opacity: 0.4 }} />
                <div style={{ width: '40px', height: '1px', background: `linear-gradient(90deg, ${C.gold}40, transparent)` }} />
              </div>
            </div>

            {/* Cards Grid */}
            <div className="ce-template-grid" style={{
              position: 'relative', zIndex: 1,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '28px', maxWidth: '780px', margin: '0 auto',
            }}>
              {TEMPLATES.map((tpl, idx) => (
                <InvitationCard
                  key={tpl.key}
                  tpl={tpl}
                  isSelected={templateType === tpl.key}
                  onSelect={() => handleTemplateSelect(tpl)}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
           STEP 1 — EVENT DETAILS
           ════════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '44px', boxShadow: '0 4px 30px rgba(0,0,0,0.04)', animation: 'ce-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: selectedTemplate?.gradient || C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: `0 4px 12px ${selectedTemplate?.colors.primary || C.gold}30` }}>{selectedTemplate?.icon}</div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: C.charcoal, margin: 0 }}>Event Details</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: C.gold, padding: '3px 10px', borderRadius: '100px', background: 'rgba(184,148,79,0.08)', letterSpacing: '0.05em' }}>{selectedTemplate?.label}</span>
                  <button onClick={() => setStep(0)} style={{ background: 'none', border: 'none', fontSize: '11px', color: C.stone, cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'underline', textUnderlineOffset: '2px', opacity: 0.7 }}>change</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <FancyInput label="Event Title" required><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Julian & Sophia's Wedding Gala" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
              <FancyInput label="Event URL" required>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <div style={{ padding: '14px 12px', background: C.ivory, border: `1.5px solid ${C.border}`, borderRadius: '12px 0 0 12px', borderRight: 'none', fontSize: '12px', color: C.stone, whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center' }}>{frontendUrl}/</div>
                  <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-'))} placeholder="your-event-slug" style={{ ...iStyle, borderRadius: '0 12px 12px 0', flex: 1, borderColor: slugStatus === 'taken' ? C.error : slugStatus === 'available' ? C.success : C.border }} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {slugStatus === 'checking' && <span style={{ color: C.stone, display: 'flex', alignItems: 'center', gap: '6px' }}><span className="ce-spinner" /> Checking…</span>}
                  {slugStatus === 'available' && <span style={{ color: C.success }}>✓ Available</span>}
                  {slugStatus === 'taken' && <span style={{ color: C.error }}>✕ Taken — <button onClick={() => setSlug(suggestedSlug)} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '11px', fontFamily: 'var(--font-sans)' }}>Try &ldquo;{suggestedSlug}&rdquo;</button></span>}
                </div>
              </FancyInput>
              <FancyInput label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Tell your guests about the event…" style={{ ...iStyle, resize: 'vertical', minHeight: '88px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
              <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FancyInput label="Start Date & Time" required><input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} style={{ ...iStyle, cursor: 'pointer' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                <FancyInput label="End Date & Time" hint="Optional"><input type="datetime-local" value={eventEndDate} onChange={e => setEventEndDate(e.target.value)} style={{ ...iStyle, cursor: 'pointer' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
              </div>
              <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FancyInput label="Venue Name"><input type="text" value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="e.g. The Grand Ballroom" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                <FancyInput label="Address"><PlacesAutocomplete value={locationAddress} onChange={setLocationAddress} onPlaceSelect={(place) => { setLocationAddress(place.address); setLocationName(place.name || locationName); setLocationLat(place.lat); setLocationLng(place.lng); setLocationPlaceId(place.placeId); }} placeholder="Search venue…" style={iStyle} /></FancyInput>
              </div>

              <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />

              {/* Template-Specific Fields */}
              {templateType && templateType !== 'custom' && (
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: C.charcoal, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(184,148,79,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>{selectedTemplate?.icon}</span>
                    {selectedTemplate?.label} Details
                  </h3>
                  {templateType === 'wedding' && (<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}><div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}><FancyInput label="Partner 1"><input type="text" value={templateData.partner1Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner1Name: e.target.value }))} placeholder="Julian" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Partner 2"><input type="text" value={templateData.partner2Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner2Name: e.target.value }))} placeholder="Sophia" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput></div><FancyInput label="Love Story"><textarea value={templateData.loveStory || ''} onChange={e => setTemplateData(d => ({ ...d, loveStory: e.target.value }))} rows={3} placeholder="How you met…" style={{ ...iStyle, resize: 'vertical', minHeight: '90px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput><div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}><FancyInput label="Ceremony" hint="If different"><input type="text" value={templateData.ceremonyLocation || ''} onChange={e => setTemplateData(d => ({ ...d, ceremonyLocation: e.target.value }))} placeholder="Cathedral" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Reception" hint="If different"><input type="text" value={templateData.receptionLocation || ''} onChange={e => setTemplateData(d => ({ ...d, receptionLocation: e.target.value }))} placeholder="Plaza Hotel" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput></div><FancyInput label="Registry URL"><input type="text" value={templateData.registryUrl || ''} onChange={e => setTemplateData(d => ({ ...d, registryUrl: e.target.value }))} placeholder="https://…" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Accommodations"><textarea value={templateData.accommodations || ''} onChange={e => setTemplateData(d => ({ ...d, accommodations: e.target.value }))} rows={2} placeholder="Hotel blocks, parking…" style={{ ...iStyle, resize: 'vertical', minHeight: '70px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput></div>)}
                  {templateType === 'engagement' && (<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}><div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}><FancyInput label="Partner 1"><input type="text" value={templateData.partner1Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner1Name: e.target.value }))} placeholder="Julian" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Partner 2"><input type="text" value={templateData.partner2Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner2Name: e.target.value }))} placeholder="Sophia" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput></div><FancyInput label="Our Story"><textarea value={templateData.ourStory || ''} onChange={e => setTemplateData(d => ({ ...d, ourStory: e.target.value }))} rows={3} placeholder="Your engagement story…" style={{ ...iStyle, resize: 'vertical', minHeight: '90px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Registry URL"><input type="text" value={templateData.registryUrl || ''} onChange={e => setTemplateData(d => ({ ...d, registryUrl: e.target.value }))} placeholder="https://…" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput></div>)}
                  {templateType === 'corporate' && (<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}><FancyInput label="Company"><input type="text" value={templateData.companyName || ''} onChange={e => setTemplateData(d => ({ ...d, companyName: e.target.value }))} placeholder="Acme Corp" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Agenda"><textarea value={templateData.agenda || ''} onChange={e => setTemplateData(d => ({ ...d, agenda: e.target.value }))} rows={4} placeholder="Schedule…" style={{ ...iStyle, resize: 'vertical', minHeight: '120px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Speakers"><textarea value={templateData.speakers || ''} onChange={e => setTemplateData(d => ({ ...d, speakers: e.target.value }))} rows={2} placeholder="Name — Title" style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Sponsors"><textarea value={templateData.sponsors || ''} onChange={e => setTemplateData(d => ({ ...d, sponsors: e.target.value }))} rows={2} placeholder="Sponsors…" style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput></div>)}
                  {templateType === 'birthday' && (<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}><div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}><FancyInput label="Name"><input type="text" value={templateData.birthdayPersonName || ''} onChange={e => setTemplateData(d => ({ ...d, birthdayPersonName: e.target.value }))} placeholder="Emma" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Age / Milestone"><input type="text" value={templateData.ageMilestone || ''} onChange={e => setTemplateData(d => ({ ...d, ageMilestone: e.target.value }))} placeholder="Turning 30!" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput></div><FancyInput label="Theme"><input type="text" value={templateData.theme || ''} onChange={e => setTemplateData(d => ({ ...d, theme: e.target.value }))} placeholder="Tropical, Retro…" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput></div>)}
                  {templateType === 'gala' && (<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}><FancyInput label="Honoree(s)"><input type="text" value={templateData.honorees || ''} onChange={e => setTemplateData(d => ({ ...d, honorees: e.target.value }))} placeholder="Dr. Smith" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Program"><textarea value={templateData.program || ''} onChange={e => setTemplateData(d => ({ ...d, program: e.target.value }))} rows={3} placeholder="Evening program…" style={{ ...iStyle, resize: 'vertical', minHeight: '90px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput><FancyInput label="Sponsor Tiers"><textarea value={templateData.sponsorTiers || ''} onChange={e => setTemplateData(d => ({ ...d, sponsorTiers: e.target.value }))} rows={2} placeholder={'Platinum: $10,000\nGold: $5,000'} style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput></div>)}
                </div>
              )}
              {templateType === 'custom' && (<div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(184,148,79,0.03)', border: '1px solid rgba(184,148,79,0.1)', display: 'flex', gap: '12px' }}><span style={{ fontSize: '18px' }}>✨</span><span style={{ fontSize: '13px', color: C.stone, lineHeight: 1.7 }}><strong style={{ color: C.charcoal }}>Custom template</strong> — use the Form Builder after creation to add fields.</span></div>)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
              <BackBtn onClick={() => setStep(0)} label="Templates" />
              <NextBtn onClick={() => setStep(2)} label="Continue" disabled={!canProceed()} />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
           STEP 2 — SETTINGS
           ════════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '44px', boxShadow: '0 4px 30px rgba(0,0,0,0.04)', animation: 'ce-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ marginBottom: '32px' }}><h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: C.charcoal, margin: '0 0 6px' }}>Event Settings</h2><p style={{ fontSize: '13px', color: C.stone, margin: 0, opacity: 0.7 }}>All optional — change anytime from the dashboard.</p></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
              <FancyInput label="Dress Code">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {DRESS_CODES.map(dc => { const isActive = dressCode === dc; return (<button key={dc} onClick={() => setDressCode(dc)} style={{ padding: '9px 16px', borderRadius: '100px', border: `1.5px solid ${isActive ? C.gold : C.border}`, background: isActive ? 'rgba(184,148,79,0.06)' : C.white, color: isActive ? C.gold : C.stone, fontSize: '12px', fontWeight: isActive ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.25s ease' }}>{dc || 'None'}</button>); })}
                </div>
              </FancyInput>
              <FancyInput label="RSVP Deadline" hint="Guests can't RSVP after this date"><input type="datetime-local" value={rsvpDeadline} onChange={e => setRsvpDeadline(e.target.value)} style={{ ...iStyle, cursor: 'pointer' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
              <FancyInput label="Visibility">
                <div className="ce-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  {[{ key: 'public', label: 'Public', desc: 'Open link', icon: '🌐' }, { key: 'private', label: 'Private', desc: 'Invite only', icon: '🔒' }, { key: 'password', label: 'Password', desc: 'Passcode', icon: '🔐' }].map(m => { const a = privacyMode === m.key; return (<button key={m.key} onClick={() => setPrivacyMode(m.key)} style={{ padding: '18px 14px', border: `1.5px solid ${a ? C.gold : C.border}`, borderRadius: '14px', background: a ? 'rgba(184,148,79,0.04)' : C.white, cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s ease', transform: a ? 'scale(1.02)' : 'scale(1)', boxShadow: a ? `0 4px 16px ${C.goldGlow}` : 'none' }}><span style={{ fontSize: '24px', display: 'block', marginBottom: '8px', transform: a ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.3s ease' }}>{m.icon}</span><span style={{ fontWeight: 700, fontSize: '13px', color: a ? C.gold : C.charcoal, display: 'block', marginBottom: '2px' }}>{m.label}</span><span style={{ fontSize: '10px', color: C.stone }}>{m.desc}</span></button>); })}
                </div>
                {privacyMode === 'password' && <div style={{ marginTop: '10px', animation: 'ce-fadeIn 0.3s ease' }}><input type="text" value={accessPassword} onChange={e => setAccessPassword(e.target.value)} placeholder="Enter passcode" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></div>}
              </FancyInput>
              <FancyInput label="Cover Image" hint="Hero image URL">
                <input type="url" value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)} placeholder="https://images.unsplash.com/…" style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                {coverImageUrl && <div style={{ marginTop: '8px', borderRadius: '14px', overflow: 'hidden', height: '160px', position: 'relative' }}><img src={coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} /><div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50px', background: 'linear-gradient(to top, rgba(0,0,0,0.35), transparent)' }} /></div>}
              </FancyInput>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
              <BackBtn onClick={() => setStep(1)} label="Details" />
              <NextBtn onClick={() => setStep(3)} label="Review & Create" />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
           STEP 3 — PREVIEW & CREATE
           ════════════════════════════════════════ */}
        {step === 3 && (
          <div style={{ animation: 'ce-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 30px rgba(0,0,0,0.06)' }}>
              {/* Hero */}
              <div style={{ height: '200px', position: 'relative', background: coverImageUrl ? `linear-gradient(to top, rgba(25,27,30,0.9), rgba(25,27,30,0.2)), url(${coverImageUrl}) center/cover` : `linear-gradient(135deg, ${customColors.primary || C.gold} 0%, ${customColors.accent || C.charcoal} 100%)`, display: 'flex', alignItems: 'flex-end', padding: '32px' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '100px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: '11px' }}>{selectedTemplate?.icon}</span>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{templateType}</span>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 500, color: C.white, margin: 0 }}>{title || 'Untitled Event'}</h2>
                </div>
              </div>
              {/* Body */}
              <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: C.charcoal, margin: 0 }}>Summary</h3>
                <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { l: 'URL', v: `${frontendUrl}/${slug}`, i: '🔗' },
                    { l: 'Template', v: selectedTemplate?.label, i: selectedTemplate?.icon },
                    { l: 'Date', v: eventDate ? new Date(eventDate).toLocaleString() : '—', i: '📅' },
                    { l: 'Location', v: locationName || '—', i: '📍' },
                    { l: 'Dress Code', v: dressCode || 'None', i: '👔' },
                    { l: 'Privacy', v: privacyMode.charAt(0).toUpperCase() + privacyMode.slice(1), i: privacyMode === 'public' ? '🌐' : '🔒' },
                  ].map(item => (
                    <div key={item.l} style={{ display: 'flex', gap: '10px', padding: '12px 14px', background: C.softBg, borderRadius: '12px', border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: '16px' }}>{item.i}</span>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, fontWeight: 700, display: 'block' }}>{item.l}</span>
                        <span style={{ fontSize: '12px', color: C.charcoal, fontWeight: 500, wordBreak: 'break-all', lineHeight: 1.4 }}>{item.v}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {description && <div style={{ padding: '14px', background: C.softBg, borderRadius: '12px', border: `1px solid ${C.border}` }}><span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, fontWeight: 700, display: 'block', marginBottom: '6px' }}>Description</span><p style={{ fontSize: '12px', color: C.charcoal, lineHeight: 1.7, margin: 0 }}>{description}</p></div>}
                <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(184,148,79,0.03)', border: '1px solid rgba(184,148,79,0.1)', display: 'flex', gap: '10px' }}>
                  <span style={{ fontSize: '14px' }}>💡</span>
                  <span style={{ fontSize: '11px', color: C.stone, lineHeight: 1.6 }}>Created as <strong style={{ color: C.charcoal }}>draft</strong>. Activate from dashboard after payment.</span>
                </div>
                {error && <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(196,94,94,0.05)', border: '1px solid rgba(196,94,94,0.12)', fontSize: '12px', color: C.error }}>⚠️ {error}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: `1px solid ${C.border}` }}>
                  <BackBtn onClick={() => setStep(2)} label="Settings" />
                  <button disabled={submitting} onClick={handleSubmit} style={{
                    padding: '16px 44px', border: 'none', borderRadius: '14px', fontWeight: 700, fontSize: '15px',
                    cursor: submitting ? 'default' : 'pointer', fontFamily: 'var(--font-sans)',
                    background: submitting ? C.champagne : `linear-gradient(135deg, ${C.gold}, ${C.goldHover})`,
                    color: C.white, opacity: submitting ? 0.7 : 1,
                    boxShadow: submitting ? 'none' : `0 8px 30px ${C.goldGlow}`,
                    display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s ease',
                  }}
                    onMouseEnter={e => { if (!submitting) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 40px ${C.goldGlow}`; }}}
                    onMouseLeave={e => { if (!submitting) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 30px ${C.goldGlow}`; }}}
                  >
                    {submitting ? <><span className="ce-spinner" style={{ width: '16px', height: '16px' }} /> Creating…</> : <>🎉 Create Event</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ANIMATIONS ═══ */}
      <style jsx>{`
        @keyframes ce-fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ce-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ce-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ce-scaleIn { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
        @keyframes ce-badgePop { 0% { opacity: 0; transform: scale(0); } 60% { transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes ce-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes ce-spin { to { transform: rotate(360deg); } }
        @keyframes ce-float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes ce-drift {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -20px); }
          66% { transform: translate(-20px, 10px); }
        }
        @keyframes ce-shimmerSweep {
          0% { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes ce-gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes ce-cardEntrance {
          from { opacity: 0; transform: translateY(40px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ce-spinner {
          width: 12px; height: 12px; display: inline-block;
          border: 2px solid rgba(119,115,106,0.25);
          border-top-color: #77736A;
          border-radius: 50%;
          animation: ce-spin 0.6s linear infinite;
        }
        @media (max-width: 900px) {
          .ce-template-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 20px !important; }
          .ce-step-label { display: none; }
        }
        @media (max-width: 580px) {
          .ce-template-grid { grid-template-columns: 1fr !important; max-width: 260px !important; margin: 0 auto !important; }
          .ce-grid-2 { grid-template-columns: 1fr !important; }
          .ce-grid-3 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
