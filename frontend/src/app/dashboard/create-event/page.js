'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PlacesAutocomplete from '../../components/PlacesAutocomplete';

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS (Ivory & Gold Theme)
   ═══════════════════════════════════════════════════════════ */
const C = {
  gold: '#2563EB', // Indigo Blue accent instead of gold
  goldHover: '#1D4ED8',
  goldLight: '#60A5FA',
  charcoal: '#0F172A', // Slate 900
  ivory: '#FFFFFF', // Pure White
  linen: '#F8FAFC', // Slate 50
  champagne: '#3B82F6', // Blue 500
  stone: '#64748B', // Slate 500
  border: '#E2E8F0', // Slate 200
  white: '#FFFFFF',
  softBg: '#F8FAFC', // Slate 50
  error: '#EF4444',
  success: '#10B981',
  goldGlow: 'rgba(37,99,235,0.05)',
  waxRed: 'radial-gradient(circle, #3B82F6 0%, #1D4ED8 100%)',
};

/* ═══════════════════════════════════════════════════════════
   TEMPLATE DATA
   ═══════════════════════════════════════════════════════════ */
const TEMPLATES = [
  {
    key: 'wedding',
    label: 'Royale Wedding',
    icon: '💍',
    desc: 'Handcrafted luxury invitation for ceremonies, dinner selection and plus-one mapping.',
    presets: [
      { name: 'Royale Gold', primary: '#B8944F', secondary: '#D7BE80', accent: '#3D3425', background: '#FFFDF9' },
      { name: 'Emerald Ivy', primary: '#0A5C36', secondary: '#A3D9C9', accent: '#111827', background: '#F0F9F6' },
      { name: 'Burgundy Velvet', primary: '#8B1E3F', secondary: '#E5A4B6', accent: '#1C1917', background: '#FFF7F8' }
    ],
    specs: [
      'Multi-course meal options tracking',
      'Table seating plan compatibility',
      'Accommodations details & registry links',
      'Plus-one group limit verification'
    ],
    fields: ['Guest Name', 'Email / Phone', 'Response Status', 'Meal Selection', 'Dietary Restrictions', 'Plus-One Group RSVP'],
    cardTheme: {
      bg: '#FFFDF9',
      accent: '#B8944F', text: '#3D3425', subtext: '#9A917F',
      line1: 'Together with their families', line2: 'Julian & Sophia',
      line3: 'request the pleasure of your company\nat the celebration of their marriage',
      ornament: '❧', fontFamily: 'var(--font-serif)',
      headerFont: 'var(--font-script)',
    },
  },
  {
    key: 'engagement',
    label: 'Eternal Love',
    icon: '💎',
    desc: 'Modern romantic announcement template with proposal story and guest book messaging.',
    presets: [
      { name: 'Blush Gold', primary: '#C27B8E', secondary: '#E8B4C0', accent: '#2D1F26', background: '#FFFDFD' },
      { name: 'Champagne Sparkle', primary: '#B8944F', secondary: '#D7BE80', accent: '#3D3425', background: '#FFFDF9' },
      { name: 'Sage Garden', primary: '#2D6A4F', secondary: '#95D5B2', accent: '#1B4332', background: '#F4FAF6' }
    ],
    specs: [
      'Love story timelines & photo panels',
      'Interactive registry list',
      'Song request playlist submission',
      'Warm wishes digital message board'
    ],
    fields: ['Guest Name', 'Attendance Confirmation', 'Song Request', 'Message for Couple'],
    cardTheme: {
      bg: '#FFFDFD',
      accent: '#C27B8E', text: '#3D1F2A', subtext: '#B8909A',
      line1: 'She said yes!', line2: 'We\'re Engaged',
      line3: 'Join us as we celebrate\nthe beginning of forever',
      ornament: '♥', fontFamily: 'var(--font-serif)',
      headerFont: 'var(--font-script)',
    },
  },
  {
    key: 'corporate',
    label: 'Summit Pro',
    icon: '🏢',
    desc: 'Sleek design for summits, presentations, workshop choice, and ticketing integration.',
    presets: [
      { name: 'Tech Sapphire', primary: '#2563EB', secondary: '#60A5FA', accent: '#1E293B', background: '#F8FAFC' },
      { name: 'Executive Forest', primary: '#0A5C36', secondary: '#A3D9C9', accent: '#121212', background: '#F4FAF8' },
      { name: 'Corporate Platinum', primary: '#475569', secondary: '#94A3B8', accent: '#0F172A', background: '#FAFAFA' }
    ],
    specs: [
      'Schedule agenda & sessions listing',
      'Speaker bios & profiles layout',
      'Sponsor branding placeholders',
      'Check-in QR code ticket generation'
    ],
    fields: ['Attendee Name', 'Professional Title', 'Company Name', 'Workshop Choice', 'Special Diet Request'],
    cardTheme: {
      bg: '#FFFFFF',
      accent: '#2563EB', text: '#0F172A', subtext: '#64748B',
      line1: 'You\'re Invited To Attend', line2: 'Tech Summit \'26',
      line3: 'Innovation · Leadership · Growth\nSilicon Valley Convention Center',
      ornament: '◆', fontFamily: 'var(--font-sans)',
      headerFont: 'var(--font-sans)',
    },
  },
  {
    key: 'birthday',
    label: 'Milestone Party',
    icon: '🎂',
    desc: 'Fun, energetic template with party themes, drink selections, and countdown timer.',
    presets: [
      { name: 'Sunset Vibe', primary: '#E85D75', secondary: '#F9A8B8', accent: '#3D1520', background: '#FFFDFE' },
      { name: 'Ocean Retro', primary: '#0EA5E9', secondary: '#38BDF8', accent: '#0369A1', background: '#F0F9FF' },
      { name: 'Electric Fuchsia', primary: '#D946EF', secondary: '#F472B6', accent: '#701A75', background: '#FDF2F8' }
    ],
    specs: [
      'Real-time RSVP countdown timer',
      'Milestone celebration details',
      'Party dress code & color theme details',
      'Fun activity preferences survey'
    ],
    fields: ['Guest Name', 'Response (Attending/Decline)', 'Favorite Drink', 'Plus-One Name'],
    cardTheme: {
      bg: '#FFFDFE',
      accent: '#E85D75', text: '#1F0710', subtext: '#BE7080',
      line1: 'You\'re Invited!', line2: 'Let\'s Party!',
      line3: 'Come celebrate with us\nfor an unforgettable night',
      ornament: '✦', fontFamily: 'var(--font-sans)',
      headerFont: 'var(--font-sans)',
    },
  },
  {
    key: 'gala',
    label: 'Black Tie Gala',
    icon: '🥂',
    desc: 'Prestige layout for charity galas, sponsors packages, and table preferences.',
    presets: [
      { name: 'Luxury Ivory', primary: '#B8944F', secondary: '#D7BE80', accent: '#191B1E', background: '#FAF6ED' },
      { name: 'Obsidian Velvet', primary: '#B8944F', secondary: '#3A3A3A', accent: '#000000', background: '#191B1F' },
      { name: 'Imperial Royal', primary: '#1E3A8A', secondary: '#93C5FD', accent: '#0F172A', background: '#F0F4F8' }
    ],
    specs: [
      'Corporate sponsor package options',
      'VIP table assignment selection',
      'Detailed event program itinerary',
      'Stripe checkout ticket billing integration'
    ],
    fields: ['Attendee Name', 'Organization Name', 'Table Seating Preference', 'Sponsor Package Choice', 'Dietary Restrictions'],
    cardTheme: {
      bg: '#FAF6ED',
      accent: '#B8944F', text: '#1E293B', subtext: '#77736A',
      line1: 'The honour of your presence', line2: 'Annual Gala',
      line3: 'Black Tie · Cocktails · Dinner\nThe Grand Ballroom',
      ornament: '❖', fontFamily: 'var(--font-serif)',
      headerFont: 'var(--font-serif)',
    },
  },
  {
    key: 'custom',
    label: 'Custom Canvas',
    icon: '✨',
    desc: 'A blank design canvas allowing fully customizable styling parameters and questionnaire setup.',
    presets: [
      { name: 'Clean Linen', primary: '#B8944F', secondary: '#E8E2D6', accent: '#191B1E', background: '#FFFFFF' },
      { name: 'Warm Cream', primary: '#7A6B52', secondary: '#EDE7DC', accent: '#1C1917', background: '#FAF8F5' },
      { name: 'Obsidian Slate', primary: '#B8944F', secondary: '#2A2D35', accent: '#090A0E', background: '#FAFAFA' }
    ],
    specs: [
      'Complete color configuration freedoms',
      'Flexible layouts setup',
      'Dynamic questionnaire creation tools',
      'Standalone RSVPs submission portal'
    ],
    fields: ['Guest Name', 'Email Address'],
    cardTheme: {
      bg: '#FFFFFF',
      accent: '#B8944F', text: '#1A1A1A', subtext: '#9A9488',
      line1: 'Your Vision', line2: 'Your Event',
      line3: 'A blank canvas to create\nsomething extraordinary',
      ornament: '◇', fontFamily: 'var(--font-serif)',
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
   DECORATIVE FLOATING PARTICLES
   ═══════════════════════════════════════════════════════════ */
function FloatingParticles() {
  const [particles, setParticles] = React.useState([]);
  React.useEffect(() => {
    const items = [...Array(12)].map((_, i) => ({
      id: i,
      width: Math.random() * 8 + 4,
      height: Math.random() * 8 + 4,
      top: Math.random() * 100,
      left: Math.random() * 100,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * -15,
    }));
    setParticles(items);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 0,
    }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            width: `${p.width}px`,
            height: `${p.height}px`,
            background: 'rgba(37, 99, 235, 0.03)',
            borderRadius: '50%',
            top: `${p.top}%`,
            left: `${p.left}%`,
            animation: `ce-float ${p.duration}s linear infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PREMIUM MINIMALIST CARD SELECTOR
   ═══════════════════════════════════════════════════════════ */
function InvitationCard({ tpl, isSelected, onSelect, index, activePreset }) {
  const [hovered, setHovered] = useState(false);
  const t = tpl.cardTheme;

  const primaryColor = activePreset.primary;
  const secondaryColor = activePreset.secondary;
  const accentColor = activePreset.accent;
  const backgroundColor = activePreset.background;

  return (
    <div style={{ animation: `ce-cardEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s both` }}>
      <button
        onClick={onSelect}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={`Select ${tpl.label} template`}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1/1.25',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'block',
          outline: 'none',
        }}
      >
        {/* Glow effect on hover/selection */}
        <div style={{
          position: 'absolute',
          inset: '-8px',
          borderRadius: '20px',
          background: isSelected
            ? `radial-gradient(circle, ${primaryColor}15 0%, transparent 70%)`
            : hovered
              ? `radial-gradient(circle, ${primaryColor}08 0%, transparent 70%)`
              : 'none',
          transition: 'all 0.4s ease',
          zIndex: 0,
        }} />

        {/* The Card Component */}
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: `1.5px solid ${isSelected ? primaryColor : '#E2E8F0'}`,
          overflow: 'hidden',
          boxShadow: hovered 
            ? '0 16px 36px rgba(0, 0, 0, 0.08)' 
            : isSelected
              ? '0 10px 24px rgba(0, 0, 0, 0.05)'
              : '0 4px 12px rgba(0, 0, 0, 0.02)',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: hovered ? 'translateY(-4px)' : 'none',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Card Visual Header Bar (Represents Header Banner) */}
          <div style={{
            height: '42%',
            background: `linear-gradient(135deg, ${primaryColor}f0 0%, ${secondaryColor}cc 100%)`,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {/* Visual pattern/lines inside banner */}
            <div style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.08,
              backgroundImage: 'radial-gradient(circle at 1px 1px, #FFF 1px, transparent 0)',
              backgroundSize: '8px 8px',
            }} />
            
            {/* Template icon in badge */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 2,
            }}>
              {tpl.icon}
            </div>

            {/* Template Badge label */}
            <div style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '8px',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              {tpl.key}
            </div>
          </div>

          {/* Card Text Content */}
          <div style={{
            flex: 1,
            padding: '20px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: '#FFFFFF',
            textAlign: 'left',
          }}>
            <div style={{ width: '100%' }}>
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-serif)',
                fontSize: '15px',
                fontWeight: 650,
                color: '#1E293B',
                marginBottom: '6px',
              }}>
                {tpl.label}
              </span>
              
              <span style={{
                display: 'block',
                fontSize: '11px',
                color: '#64748B',
                lineHeight: 1.4,
                marginBottom: '10px',
              }}>
                {tpl.desc}
              </span>
            </div>

            {/* Bottom tags */}
            <div style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '10px',
              borderTop: '1px solid #F1F5F9',
            }}>
              <span style={{
                fontSize: '9px',
                color: primaryColor,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                {activePreset.name}
              </span>
              
              <span style={{
                fontSize: '10px',
                color: isSelected ? primaryColor : '#94A3B8',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}>
                {isSelected ? 'Selected ✓' : 'Use Template'}
              </span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

export default function CreateEventWizard() {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  
  // Wizard steps state
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [slugStatus, setSlugStatus] = useState(null);
  const [suggestedSlug, setSuggestedSlug] = useState('');
  const [mounted, setMounted] = useState(false);

  // Core Event Payload fields
  const [templateType, setTemplateType] = useState('wedding');
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

  // Selected preset indexes per template
  const [selectedPresets, setSelectedPresets] = useState({
    wedding: 0,
    engagement: 0,
    corporate: 0,
    birthday: 0,
    gala: 0,
    custom: 0,
  });

  // Mock phone screen interactivity
  const [mockAttending, setMockAttending] = useState(true);
  const [mockMeal, setMockMeal] = useState('Beef');
  const [mockGuests, setMockGuests] = useState(1);
  const [mockSuccess, setMockSuccess] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  // Auth Protection check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const orgId = localStorage.getItem('org_id');
      if (!orgId) router.push('/login');
    }
  }, [router]);

  // Sync template type changes to load default preset colors
  useEffect(() => {
    const activeTemplate = TEMPLATES.find(t => t.key === templateType);
    if (activeTemplate) {
      const idx = selectedPresets[templateType] || 0;
      const preset = activeTemplate.presets[idx];
      setCustomColors({
        primary: preset.primary,
        secondary: preset.secondary,
        accent: preset.accent,
        background: preset.background,
      });
    }
  }, [templateType, selectedPresets]);

  // Generate URL slug from title
  useEffect(() => {
    if (title) {
      const generated = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      setSlug(generated);
    }
  }, [title]);

  // Debounce check slug availability
  useEffect(() => {
    if (!slug || slug.length < 3) { setSlugStatus(null); return; }
    setSlugStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl}/public/events/${slug}`);
        if (res.status === 404) setSlugStatus('available');
        else if (res.ok) { 
          setSlugStatus('taken'); 
          setSuggestedSlug(`${slug}-${new Date().getFullYear()}`); 
        } else {
          setSlugStatus('error');
        }
      } catch { setSlugStatus('error'); }
    }, 500);
    return () => clearTimeout(timer);
  }, [slug, apiUrl]);

  const handleTemplateSelect = (tplKey) => {
    setTemplateType(tplKey);
    setMockSuccess(false);
  };

  const handlePresetSelect = (tplKey, presetIdx) => {
    setSelectedPresets(prev => ({ ...prev, [tplKey]: presetIdx }));
    setMockSuccess(false);
  };

  const canProceed = useCallback(() => {
    if (step === 0) return !!templateType;
    if (step === 1) return !!title && !!slug && !!eventDate && slugStatus !== 'taken';
    if (step === 2) return true;
    return true;
  }, [step, templateType, title, slug, eventDate, slugStatus]);

  // Post Payload to Backend
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
      
      const res = await fetch(`${apiUrl}/events`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        credentials: 'include', 
        body: JSON.stringify(payload) 
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === 'SLUG_TAKEN') { 
          setSlugStatus('taken'); 
          setSuggestedSlug(data.suggestedSlug); 
          setStep(1); 
          throw new Error('This event URL is already taken.'); 
        }
        throw new Error(data.message || 'Failed to create event');
      }
      
      router.push('/dashboard');
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  };

  const selectedTemplate = TEMPLATES.find(t => t.key === templateType);
  const activePresetIdx = selectedPresets[templateType] || 0;
  const activePresetColors = selectedTemplate.presets[activePresetIdx];

  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fancyrsvp.com';

  /* ── Input styling helpers ── */
  const FancyInput = ({ label, required, children, hint }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {label && (
        <label style={{ fontSize: '11px', fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-sans)' }}>
          {label} {required && <span style={{ color: C.gold, fontSize: '13px' }}>*</span>}
        </label>
      )}
      {children}
      {hint && <span style={{ fontSize: '11px', color: C.stone, opacity: 0.75 }}>{hint}</span>}
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
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 30px ${C.goldGlow}`; }}}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${C.goldGlow}`; }}}
    >
      {label}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: step === 0 ? `radial-gradient(circle at top, #FFFFFF 0%, ${C.linen} 100%)` : C.softBg, fontFamily: 'var(--font-sans)', transition: 'background 0.8s ease' }}>

      {/* ═══ TOPBAR ═══ */}
      <div style={{
        padding: '0 32px', height: '64px',
        background: 'rgba(255,255,255,0.92)',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 100,
        transition: 'all 0.5s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard" style={{ fontSize: '13px', color: C.stone, textDecoration: 'none', fontWeight: 600, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14L6 9L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <div style={{ width: '1px', height: '20px', background: C.border }} />
          <span style={{ fontFamily: 'var(--font-script)', fontSize: '24px', color: C.gold, letterSpacing: '1px' }}>Fancy</span>
        </div>
        
        {/* Progress dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {STEPS.map((s, i) => (
            <div key={s.key} onClick={() => { if (i < step) setStep(i); }} style={{
              width: i === step ? '32px' : '8px', height: '8px', borderRadius: '4px',
              background: i === step ? `linear-gradient(90deg, ${C.gold}, ${C.champagne})` : i < step ? C.gold : C.border,
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: i < step ? 'pointer' : 'default',
            }} />
          ))}
        </div>
      </div>

      {/* ═══ STEPPER BAR (for steps > 0) ═══ */}
      {step > 0 && (
        <div style={{ maxWidth: '1200px', margin: '28px auto 0', padding: '0 24px', animation: 'ce-fadeIn 0.4s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, background: C.white, borderRadius: '14px', padding: '6px', border: `1px solid ${C.border}`, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            {STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <button onClick={() => { if (i < step) setStep(i); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: i <= step ? 'pointer' : 'default', background: step === i ? `linear-gradient(135deg, ${C.gold}, ${C.champagne})` : 'transparent', color: step === i ? C.white : i < step ? C.gold : C.stone, fontWeight: step === i ? 700 : 500, fontSize: '13px', fontFamily: 'var(--font-sans)', transition: 'all 0.3s', opacity: i > step ? 0.35 : 1 }}>
                  {i < step ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill={C.gold} opacity="0.12"/><path d="M4.5 7L6 8.5L9.5 5.5" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> : <span style={{ fontSize: '14px' }}>{s.icon}</span>}
                  <span className="ce-step-label">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div style={{ width: '32px', height: '2px', borderRadius: '1px', background: i < step ? `linear-gradient(90deg, ${C.gold}, ${C.champagne})` : C.border, transition: 'background 0.5s ease', flexShrink: 0 }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Main wizard wrappers */}
      <div style={{ maxWidth: step === 0 ? '1240px' : '900px', margin: '0 auto', padding: step === 0 ? '0 24px 80px' : '28px 24px 80px', transition: 'max-width 0.5s ease' }}>

        {/* ════════════════════════════════════════
           STEP 0 — TEMPLATE SELECTION (Interactive Specs & 3D cards)
           ════════════════════════════════════════ */}
        {step === 0 && (
          <div style={{ position: 'relative', paddingTop: '40px' }}>
            <FloatingParticles />

            {/* Header section */}
            <div style={{
              position: 'relative', zIndex: 1, textAlign: 'center',
              marginBottom: '48px',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(24px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 18px', borderRadius: '100px',
                background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)',
                marginBottom: '20px',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.gold, animation: 'ce-pulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: C.gold, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  Create Elegant Event
                </span>
              </div>

              <h2 style={{
                fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: 500, color: C.charcoal, margin: '0 0 12px', letterSpacing: '-0.02em', lineHeight: 1.2
              }}>
                Choose Your Invitation
              </h2>

              <p style={{ color: C.stone, fontSize: '14px', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
                Hover cards to unfold the digital envelopes. Pick color palettes and test the interactive phone simulator live.
              </p>
            </div>

            {/* Split Pane Container */}
            <div className="ce-split-pane" style={{
              position: 'relative', zIndex: 1,
              display: 'grid', gridTemplateColumns: '1.2fr 1.05fr',
              gap: '40px', alignItems: 'start', marginTop: '16px'
            }}>
              
              {/* Left Column: 3D Envelopes grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '32px 24px',
                }}>
                  {TEMPLATES.map((tpl, idx) => (
                    <InvitationCard
                      key={tpl.key}
                      tpl={tpl}
                      isSelected={templateType === tpl.key}
                      onSelect={() => handleTemplateSelect(tpl.key)}
                      index={idx}
                      activePreset={tpl.presets[selectedPresets[tpl.key] || 0]}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <NextBtn onClick={() => setStep(1)} label="Customize Event Details" disabled={!canProceed()} />
                </div>
              </div>

              {/* Right Column: Spec Sheet & Phone Mockup */}
              <div style={{
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: '24px',
                padding: '32px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.03)',
                position: 'sticky',
                top: '96px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                boxSizing: 'border-box',
              }}>
                {/* Spec Panel Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', borderBottom: `1px solid ${C.border}`, paddingBottom: '18px' }}>
                  <span style={{ width: '42px', height: '42px', borderRadius: '12px', background: `linear-gradient(135deg, ${activePresetColors.primary}, ${activePresetColors.secondary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: `0 4px 14px ${activePresetColors.primary}30` }}>
                    {selectedTemplate.icon}
                  </span>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: C.charcoal, margin: 0 }}>
                      {selectedTemplate.label} Specifications
                    </h3>
                    <span style={{ fontSize: '11px', color: C.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Interactive Simulator
                    </span>
                  </div>
                </div>

                {/* Color presets */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: C.stone, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '10px' }}>
                    Curated Color Preset
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedTemplate.presets.map((preset, idx) => {
                      const isPresetSelected = activePresetIdx === idx;
                      return (
                        <button
                          key={preset.name}
                          onClick={() => handlePresetSelect(templateType, idx)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '100px',
                            border: `1.5px solid ${isPresetSelected ? C.gold : C.border}`,
                            background: isPresetSelected ? 'rgba(37,99,235,0.06)' : C.white,
                            color: isPresetSelected ? C.gold : C.stone,
                            fontSize: '12px',
                            fontWeight: isPresetSelected ? 700 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.25s ease',
                          }}
                        >
                          <span style={{ display: 'flex', gap: '2px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: preset.primary }} />
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: preset.background, border: `1px solid ${C.border}` }} />
                          </span>
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Specs List & Mobile Preview Toggle */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '24px', alignItems: 'start' }} className="ce-spec-mockup-row">
                  {/* Left: Spec list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '9px', color: C.stone, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '6px' }}>Included Features</span>
                      <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {selectedTemplate.specs.map((spec, i) => (
                          <li key={i} style={{ fontSize: '11.5px', color: C.charcoal, lineHeight: 1.45 }}>{spec}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span style={{ display: 'block', fontSize: '9px', color: C.stone, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: '6px' }}>Default Form Fields</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {selectedTemplate.fields.map(f => (
                          <span key={f} style={{ fontSize: '9.5px', background: C.softBg, color: C.stone, border: `1px solid ${C.border}`, padding: '3px 8px', borderRadius: '4px', fontWeight: 500 }}>
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Silver/Glass iPhone Simulator */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {/* Device Bezel (Silver/White iPhone) */}
                    <div style={{
                      width: '150px',
                      height: '275px',
                      background: '#FFFFFF',
                      borderRadius: '24px',
                      padding: '8px',
                      boxShadow: '0 12px 28px rgba(0,0,0,0.06), inset 0 0 0 1.5px rgba(0,0,0,0.08)',
                      border: `2px solid ${C.border}`,
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                    }}>
                      {/* Screen */}
                      <div style={{
                        flex: 1,
                        background: activePresetColors.background,
                        borderRadius: '16px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        fontSize: '9px',
                        position: 'relative',
                        color: activePresetColors.accent,
                        border: '1px solid rgba(0,0,0,0.04)',
                      }}>
                        {/* Device Notch */}
                        <div style={{ width: '45px', height: '6px', background: '#FFFFFF', borderRadius: '0 0 6px 6px', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10, border: `1.5px solid ${C.border}`, borderTop: 'none' }} />

                        {/* Top banner image placeholder */}
                        <div style={{
                          height: '48px',
                          background: `linear-gradient(135deg, ${activePresetColors.primary}bb 0%, ${activePresetColors.primary}ff 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          color: '#fff',
                          fontWeight: 700,
                          paddingTop: '6px',
                        }}>
                          {selectedTemplate.icon}
                        </div>

                        {/* Mock Form Content */}
                        <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
                          <span style={{ fontWeight: 800, fontSize: '9px', textAlign: 'center', display: 'block', textTransform: 'uppercase', color: activePresetColors.primary, letterSpacing: '0.5px' }}>
                            {selectedTemplate.label}
                          </span>

                          {mockSuccess ? (
                            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '4px', animation: 'ce-scaleIn 0.3s ease' }}>
                              <span style={{ fontSize: '16px' }}>🎉</span>
                              <span style={{ fontWeight: 700, fontSize: '8px', color: '#3B9B6D' }}>RSVP Sent!</span>
                              <button onClick={() => setMockSuccess(false)} style={{ background: 'none', border: 'none', textDecoration: 'underline', fontSize: '7px', color: activePresetColors.primary, cursor: 'pointer', padding: 0 }}>Reset</button>
                            </div>
                          ) : (
                            <>
                              <div style={{ background: 'rgba(255,255,255,0.7)', padding: '4px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                                <span style={{ display: 'block', fontSize: '6.5px', color: C.stone, fontWeight: 700 }}>FULL NAME</span>
                                <span style={{ fontSize: '7.5px', color: C.charcoal }}>Johnathan Doe</span>
                              </div>

                              <div>
                                <span style={{ display: 'block', fontSize: '6.5px', color: C.stone, fontWeight: 700, marginBottom: '2px', textAlign: 'center' }}>ATTENDING?</span>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                                  <button onClick={() => setMockAttending(true)} style={{ background: mockAttending ? activePresetColors.primary : '#fff', color: mockAttending ? '#fff' : '#666', border: '1px solid #ccc', borderRadius: '4px', padding: '2px 0', fontSize: '6.5px', fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                                  <button onClick={() => setMockAttending(false)} style={{ background: !mockAttending ? activePresetColors.primary : '#fff', color: !mockAttending ? '#fff' : '#666', border: '1px solid #ccc', borderRadius: '4px', padding: '2px 0', fontSize: '6.5px', fontWeight: 700, cursor: 'pointer' }}>No</button>
                                </div>
                              </div>

                              {mockAttending ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', animation: 'ce-slideUp 0.2s ease' }}>
                                  {templateType === 'wedding' && (
                                    <div>
                                      <span style={{ display: 'block', fontSize: '6.5px', color: C.stone, fontWeight: 700, marginBottom: '2px' }}>MEAL SELECTION</span>
                                      <select value={mockMeal} onChange={e => setMockMeal(e.target.value)} style={{ width: '100%', fontSize: '7px', padding: '2px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}>
                                        <option value="Beef">🥩 Filet Mignon</option>
                                        <option value="Fish">🐟 Salmon</option>
                                        <option value="Vegan">🥗 Risotto</option>
                                      </select>
                                    </div>
                                  )}
                                  <div>
                                    <span style={{ display: 'block', fontSize: '6.5px', color: C.stone, fontWeight: 700, marginBottom: '2px' }}>PARTY SIZE</span>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '2px 4px' }}>
                                      <button onClick={() => setMockGuests(g => Math.max(1, g - 1))} style={{ background: 'none', border: 'none', fontWeight: 700, fontSize: '8px', cursor: 'pointer', padding: '0 2px' }}>-</button>
                                      <span style={{ fontSize: '7px', fontWeight: 700 }}>{mockGuests}</span>
                                      <button onClick={() => setMockGuests(g => Math.min(6, g + 1))} style={{ background: 'none', border: 'none', fontWeight: 700, fontSize: '8px', cursor: 'pointer', padding: '0 2px' }}>+</button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ animation: 'ce-slideUp 0.2s ease' }}>
                                  <span style={{ display: 'block', fontSize: '6.5px', color: C.stone, fontWeight: 700, marginBottom: '2px' }}>SEND A MESSAGE</span>
                                  <textarea placeholder="Wish you the best!" rows={2} style={{ width: '100%', boxSizing: 'border-box', fontSize: '7px', padding: '3px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', resize: 'none' }} />
                                </div>
                              )}

                              <button onClick={() => setMockSuccess(true)} style={{ marginTop: 'auto', background: `linear-gradient(135deg, ${activePresetColors.primary}, ${activePresetColors.secondary})`, color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 0', fontSize: '7.5px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                                Send RSVP
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
           STEP 1 — EVENT DETAILS
           ════════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '44px', boxShadow: '0 4px 30px rgba(0,0,0,0.04)', animation: 'ce-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `linear-gradient(135deg, ${customColors.primary || C.gold}, ${customColors.secondary || C.champagne})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: `0 4px 12px ${customColors.primary || C.gold}30` }}>{selectedTemplate?.icon}</div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: C.charcoal, margin: 0 }}>Event Details</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: C.gold, padding: '3px 10px', borderRadius: '100px', background: 'rgba(37,99,235,0.08)', letterSpacing: '0.05em' }}>{selectedTemplate?.label} Preset</span>
                  <button onClick={() => setStep(0)} style={{ background: 'none', border: 'none', fontSize: '11px', color: C.stone, cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'underline', textUnderlineOffset: '2px', opacity: 0.7 }}>change template</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <FancyInput label="Event Title" required><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Julian & Sophia's Wedding Gala" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
              <FancyInput label="Event URL Slug" required>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <div style={{ padding: '14px 12px', background: C.ivory, border: `1.5px solid ${C.border}`, borderRadius: '12px 0 0 12px', borderRight: 'none', fontSize: '12px', color: C.stone, whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center' }}>{frontendUrl}/</div>
                  <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-'))} placeholder="your-event-slug" style={{ ...iStyle, borderRadius: '0 12px 12px 0', flex: 1, borderColor: slugStatus === 'taken' ? C.error : slugStatus === 'available' ? C.success : C.border }} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {slugStatus === 'checking' && <span style={{ color: C.stone, display: 'flex', alignItems: 'center', gap: '6px' }}><span className="ce-spinner" /> Checking availability…</span>}
                  {slugStatus === 'available' && <span style={{ color: C.success }}>✓ URL is available</span>}
                  {slugStatus === 'taken' && <span style={{ color: C.error }}>✕ Already taken — <button onClick={() => setSlug(suggestedSlug)} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '11px', fontFamily: 'var(--font-sans)' }}>Use Suggested: &ldquo;{suggestedSlug}&rdquo;</button></span>}
                </div>
              </FancyInput>
              <FancyInput label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Tell your guests about the event details and schedules…" style={{ ...iStyle, resize: 'vertical', minHeight: '88px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
              <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FancyInput label="Start Date & Time" required><input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} style={{ ...iStyle, cursor: 'pointer' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                <FancyInput label="End Date & Time" hint="Optional"><input type="datetime-local" value={eventEndDate} onChange={e => setEventEndDate(e.target.value)} style={{ ...iStyle, cursor: 'pointer' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
              </div>
              <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FancyInput label="Venue Name"><input type="text" value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="e.g. The Grand Ballroom" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                <FancyInput label="Address"><PlacesAutocomplete value={locationAddress} onChange={setLocationAddress} onPlaceSelect={(place) => { setLocationAddress(place.address); setLocationName(place.name || locationName); setLocationLat(place.lat); setLocationLng(place.lng); setLocationPlaceId(place.placeId); }} placeholder="Search venue location address…" style={iStyle} /></FancyInput>
              </div>

              <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${C.border}, transparent)`, margin: '8px 0' }} />

              {/* Template-Specific Custom Fields */}
              {templateType && templateType !== 'custom' && (
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: C.charcoal, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(37,99,235,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: C.gold }}>{selectedTemplate?.icon}</span>
                    {selectedTemplate?.label} Profile Information
                  </h3>
                  
                  {templateType === 'wedding' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <FancyInput label="Partner 1 Name"><input type="text" value={templateData.partner1Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner1Name: e.target.value }))} placeholder="Julian" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                        <FancyInput label="Partner 2 Name"><input type="text" value={templateData.partner2Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner2Name: e.target.value }))} placeholder="Sophia" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      </div>
                      <FancyInput label="Our Love Story"><textarea value={templateData.loveStory || ''} onChange={e => setTemplateData(d => ({ ...d, loveStory: e.target.value }))} rows={3} placeholder="Describe a brief history of how you met…" style={{ ...iStyle, resize: 'vertical', minHeight: '90px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <FancyInput label="Ceremony Location" hint="If different from main venue"><input type="text" value={templateData.ceremonyLocation || ''} onChange={e => setTemplateData(d => ({ ...d, ceremonyLocation: e.target.value }))} placeholder="St. Cathedral Basilica" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                        <FancyInput label="Reception Location" hint="If different from main venue"><input type="text" value={templateData.receptionLocation || ''} onChange={e => setTemplateData(d => ({ ...d, receptionLocation: e.target.value }))} placeholder="The Grand Plaza Hotel" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      </div>
                      <FancyInput label="Gift Registry URL"><input type="text" value={templateData.registryUrl || ''} onChange={e => setTemplateData(d => ({ ...d, registryUrl: e.target.value }))} placeholder="https://registry.example.com/julian-sophia" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      <FancyInput label="Guest Accommodations"><textarea value={templateData.accommodations || ''} onChange={e => setTemplateData(d => ({ ...d, accommodations: e.target.value }))} rows={2} placeholder="Hotel room blocks, discount codes, shuttle options…" style={{ ...iStyle, resize: 'vertical', minHeight: '70px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                    </div>
                  )}

                  {templateType === 'engagement' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <FancyInput label="Partner 1 Name"><input type="text" value={templateData.partner1Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner1Name: e.target.value }))} placeholder="Julian" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                        <FancyInput label="Partner 2 Name"><input type="text" value={templateData.partner2Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner2Name: e.target.value }))} placeholder="Sophia" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      </div>
                      <FancyInput label="The Proposal Story"><textarea value={templateData.ourStory || ''} onChange={e => setTemplateData(d => ({ ...d, ourStory: e.target.value }))} rows={3} placeholder="How the question was popped…" style={{ ...iStyle, resize: 'vertical', minHeight: '90px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      <FancyInput label="Gift Registry URL"><input type="text" value={templateData.registryUrl || ''} onChange={e => setTemplateData(d => ({ ...d, registryUrl: e.target.value }))} placeholder="https://registry.example.com" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                    </div>
                  )}

                  {templateType === 'corporate' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <FancyInput label="Company / Organizing Institution"><input type="text" value={templateData.companyName || ''} onChange={e => setTemplateData(d => ({ ...d, companyName: e.target.value }))} placeholder="e.g. Acme Innovations Corp" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      <FancyInput label="Event Itinerary / Agenda"><textarea value={templateData.agenda || ''} onChange={e => setTemplateData(d => ({ ...d, agenda: e.target.value }))} rows={4} placeholder="09:00 AM — Opening Remarks&#10;10:30 AM — Tech Keynote&#10;12:00 PM — Networking Lunch" style={{ ...iStyle, resize: 'vertical', minHeight: '120px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      <FancyInput label="Keynote Speakers"><textarea value={templateData.speakers || ''} onChange={e => setTemplateData(d => ({ ...d, sponsors: e.target.value }))} rows={2} placeholder="Dr. Alan Turing — AI Pioneer&#10;Grace Hopper — Compiler Architect" style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      <FancyInput label="Sponsors Showcase"><textarea value={templateData.sponsors || ''} onChange={e => setTemplateData(d => ({ ...d, sponsors: e.target.value }))} rows={2} placeholder="Mention event sponsors and partners…" style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                    </div>
                  )}

                  {templateType === 'birthday' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <FancyInput label="Birthday Celebrant Name"><input type="text" value={templateData.birthdayPersonName || ''} onChange={e => setTemplateData(d => ({ ...d, birthdayPersonName: e.target.value }))} placeholder="Emma" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                        <FancyInput label="Age Milestone"><input type="text" value={templateData.ageMilestone || ''} onChange={e => setTemplateData(d => ({ ...d, ageMilestone: e.target.value }))} placeholder="Turning 30!" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      </div>
                      <FancyInput label="Party Theme / Details"><input type="text" value={templateData.theme || ''} onChange={e => setTemplateData(d => ({ ...d, theme: e.target.value }))} placeholder="e.g. Retro Disco, Tropical Oasis, Neon Cyberpunk" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                    </div>
                  )}

                  {templateType === 'gala' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <FancyInput label="Guest(s) of Honor / Honoree"><input type="text" value={templateData.honorees || ''} onChange={e => setTemplateData(d => ({ ...d, honorees: e.target.value }))} placeholder="Dr. Arthur Pendelton & Lady Guinevere" style={iStyle} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      <FancyInput label="Evening Program Schedule"><textarea value={templateData.program || ''} onChange={e => setTemplateData(d => ({ ...d, program: e.target.value }))} rows={3} placeholder="19:00 — Champagne Reception&#10;20:00 — Fine Dinner&#10;21:30 — Live Auction" style={{ ...iStyle, resize: 'vertical', minHeight: '90px' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                      <FancyInput label="Corporate Sponsor Packages"><textarea value={templateData.sponsorTiers || ''} onChange={e => setTemplateData(d => ({ ...d, sponsorTiers: e.target.value }))} rows={2} placeholder={'Platinum Table Sponsor: $10,000\nGold Sponsor: $5,000'} style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} /></FancyInput>
                    </div>
                  )}
                </div>
              )}
              {templateType === 'custom' && (
                <div style={{ padding: '20px', borderRadius: '14px', background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.12)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '24px' }}>✨</span>
                  <span style={{ fontSize: '13px', color: C.stone, lineHeight: 1.6 }}>
                    <strong style={{ color: C.charcoal }}>Custom Canvas Selected</strong> — You can build a completely custom questionnaire and add unlimited custom form questions directly from the dashboard after creation.
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '36px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
              <BackBtn onClick={() => setStep(0)} label="Back to Templates" />
              <NextBtn onClick={() => setStep(2)} label="Continue to Settings" disabled={!canProceed()} />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
           STEP 2 — SETTINGS
           ════════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '44px', boxShadow: '0 4px 30px rgba(0,0,0,0.04)', animation: 'ce-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: C.charcoal, margin: '0 0 6px' }}>Event Settings</h2>
              <p style={{ fontSize: '13px', color: C.stone, margin: 0, opacity: 0.75 }}>Tune settings for registration cutoff, privacy controls, and branding graphics.</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
              <FancyInput label="Dress Code Guidelines">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {DRESS_CODES.map(dc => {
                    const isActive = dressCode === dc;
                    return (
                      <button
                        type="button"
                        key={dc}
                        onClick={() => setDressCode(dc)}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '100px',
                          border: `1.5px solid ${isActive ? C.gold : C.border}`,
                          background: isActive ? 'rgba(37,99,235,0.08)' : C.white,
                          color: isActive ? C.gold : C.stone,
                          fontSize: '12px',
                          fontWeight: isActive ? 700 : 500,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                          transition: 'all 0.25s ease',
                        }}
                      >
                        {dc || 'No Dress Code'}
                      </button>
                    );
                  })}
                </div>
              </FancyInput>

              <FancyInput label="RSVP Response Deadline" hint="Guests will be blocked from submitting new RSVP forms after this date.">
                <input type="datetime-local" value={rsvpDeadline} onChange={e => setRsvpDeadline(e.target.value)} style={{ ...iStyle, cursor: 'pointer' }} onFocus={onFocus} onBlur={onBlur} />
              </FancyInput>

              <FancyInput label="Invitation Privacy Visibility">
                <div className="ce-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {[
                    { key: 'public', label: 'Public Link', desc: 'Anyone with URL can RSVP', icon: '🌐' },
                    { key: 'private', label: 'Private Guest List', desc: 'Guests must be on import list', icon: '🔒' },
                    { key: 'password', label: 'Passcode Protected', desc: 'Requires a passcode to open', icon: '🔐' }
                  ].map(m => {
                    const isSelectedPrivacy = privacyMode === m.key;
                    return (
                      <button
                        type="button"
                        key={m.key}
                        onClick={() => setPrivacyMode(m.key)}
                        style={{
                          padding: '20px 14px',
                          border: `1.5px solid ${isSelectedPrivacy ? C.gold : C.border}`,
                          borderRadius: '16px',
                          background: isSelectedPrivacy ? 'rgba(37,99,235,0.04)' : C.white,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.3s ease',
                          transform: isSelectedPrivacy ? 'scale(1.02)' : 'scale(1)',
                          boxShadow: isSelectedPrivacy ? `0 6px 20px ${C.goldGlow}` : 'none',
                        }}
                      >
                        <span style={{ fontSize: '26px', display: 'block', marginBottom: '8px', transform: isSelectedPrivacy ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.3s ease' }}>{m.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: isSelectedPrivacy ? C.gold : C.charcoal, display: 'block', marginBottom: '4px' }}>{m.label}</span>
                        <span style={{ fontSize: '10.5px', color: C.stone, lineHeight: 1.3, display: 'block' }}>{m.desc}</span>
                      </button>
                    );
                  })}
                </div>
                {privacyMode === 'password' && (
                  <div style={{ marginTop: '12px', animation: 'ce-fadeIn 0.3s ease' }}>
                    <input type="text" value={accessPassword} onChange={e => setAccessPassword(e.target.value)} placeholder="Define access passcode (e.g. Sophia2026)" style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                )}
              </FancyInput>

              <FancyInput label="Event Cover Image Header" hint="Insert a link to a premium background banner (Unsplash, etc.) to showcase on your invitation.">
                <input type="url" value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)} placeholder="https://images.unsplash.com/photo-..." style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                {coverImageUrl && (
                  <div style={{ marginTop: '12px', borderRadius: '16px', overflow: 'hidden', height: '180px', position: 'relative', border: `1px solid ${C.border}` }}>
                    <img src={coverImageUrl} alt="Header Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(to top, rgba(0,0,0,0.45), transparent)' }} />
                  </div>
                )}
              </FancyInput>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '36px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
              <BackBtn onClick={() => setStep(1)} label="Back to Details" />
              <NextBtn onClick={() => setStep(3)} label="Continue to Review" />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
           STEP 3 — REVIEW & CREATE (VIP Boarding Pass Design)
           ════════════════════════════════════════ */}
        {step === 3 && (
          <div style={{ animation: 'ce-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '24px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
              
              {/* Boarding Pass Hero Header */}
              <div style={{ 
                height: '220px', 
                position: 'relative', 
                background: coverImageUrl 
                  ? `linear-gradient(to top, rgba(25,27,30,0.95), rgba(25,27,30,0.3)), url(${coverImageUrl}) center/cover` 
                  : `linear-gradient(135deg, ${activePresetColors.primary} 0%, ${activePresetColors.primary}dd 100%)`, 
                display: 'flex', 
                alignItems: 'flex-end', 
                padding: '32px' 
              }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '100px', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontSize: '13px' }}>{selectedTemplate?.icon}</span>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
                      {templateType} style
                    </span>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 500, color: C.white, margin: 0, letterSpacing: '-0.01em' }}>
                    {title || 'My Elegant Event'}
                  </h2>
                </div>
                <div style={{
                  position: 'absolute',
                  top: '32px',
                  right: '32px',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: '1.5px dashed rgba(255,255,255,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.gold,
                  fontSize: '28px',
                }}>
                  {selectedTemplate?.icon}
                </div>
              </div>

              {/* Boarding Pass Ticket Body */}
              <div style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: C.charcoal, margin: '0 0 4px' }}>Invitation Ticket Details</h3>
                  <p style={{ fontSize: '12px', color: C.stone, margin: 0 }}>Review details carefully before launching your invitation link.</p>
                </div>

                <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {[
                    { label: 'Event Link URL', value: `${frontendUrl}/${slug}`, icon: '🔗' },
                    { label: 'RSVP Template', value: `${selectedTemplate?.label} (Preset: ${activePresetColors.name})`, icon: selectedTemplate?.icon },
                    { label: 'Start Time Schedule', value: eventDate ? new Date(eventDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set', icon: '📅' },
                    { label: 'Location Venue', value: locationName || 'No physical location', icon: '📍' },
                    { label: 'Dress Code Guideline', value: dressCode || 'None specified', icon: '👔' },
                    { label: 'Privacy Setting', value: privacyMode.toUpperCase() + (privacyMode === 'password' ? ` (Passcode: ${accessPassword})` : ''), icon: privacyMode === 'public' ? '🌐' : '🔒' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', gap: '12px', padding: '16px', background: C.softBg, borderRadius: '16px', border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: '20px' }}>{item.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, fontWeight: 700, display: 'block', marginBottom: '4px' }}>{item.label}</span>
                        <span style={{ fontSize: '12.5px', color: C.charcoal, fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.4 }}>{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {description && (
                  <div style={{ padding: '16px 20px', background: C.softBg, borderRadius: '16px', border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, fontWeight: 700, display: 'block', marginBottom: '6px' }}>Event Invitation Bio</span>
                    <p style={{ fontSize: '13px', color: C.charcoal, lineHeight: 1.7, margin: 0 }}>{description}</p>
                  </div>
                )}

                <div style={{ padding: '16px 20px', borderRadius: '16px', background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.12)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px' }}>💡</span>
                  <span style={{ fontSize: '12px', color: C.stone, lineHeight: 1.6 }}>
                    This event will be created in <strong style={{ color: C.charcoal }}>draft mode</strong>. You can customize guest lists, edit fields, and fully activate it for public RSVPs anytime from your main dashboard tab.
                  </span>
                </div>

                {error && (
                  <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', fontSize: '13px', color: C.error, fontWeight: 500 }}>
                    ⚠️ {error}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '20px', borderTop: `1px solid ${C.border}` }}>
                  <BackBtn onClick={() => setStep(2)} label="Back to Settings" />
                  <button
                    disabled={submitting}
                    onClick={handleSubmit}
                    style={{
                      padding: '16px 48px',
                      border: 'none',
                      borderRadius: '16px',
                      fontWeight: 700,
                      fontSize: '15px',
                      cursor: submitting ? 'default' : 'pointer',
                      fontFamily: 'var(--font-sans)',
                      background: submitting ? C.champagne : `linear-gradient(135deg, ${C.gold}, ${C.goldHover})`,
                      color: C.white,
                      opacity: submitting ? 0.75 : 1,
                      boxShadow: submitting ? 'none' : `0 8px 28px ${C.goldGlow}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={e => { if (!submitting) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 36px ${C.goldGlow}`; }}}
                    onMouseLeave={e => { if (!submitting) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 28px ${C.goldGlow}`; }}}
                  >
                    {submitting ? (
                      <>
                        <span className="ce-spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff' }} />
                        Creating Event Draft…
                      </>
                    ) : (
                      <>🎉 Launch Event Invitation</>
                    )}
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ANIMATIONS & GRID CORRECTION ═══ */}
      <style jsx>{`
        @keyframes ce-fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ce-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ce-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ce-scaleIn { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
        @keyframes ce-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes ce-spin { to { transform: rotate(360deg); } }
        @keyframes ce-float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) scale(0.4); opacity: 0; }
        }
        @keyframes ce-drift {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(32px, -24px); }
          66% { transform: translate(-24px, 12px); }
        }
        @keyframes ce-cardEntrance {
          from { opacity: 0; transform: translateY(48px) scale(0.93); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ce-spinner {
          width: 12px; height: 12px; display: inline-block;
          border: 2px solid rgba(119,115,106,0.25);
          border-top-color: #77736A;
          border-radius: 50%;
          animation: ce-spin 0.6s linear infinite;
        }
        @media (max-width: 1024px) {
          .ce-split-pane { grid-template-columns: 1.1fr 1fr !important; gap: 24px !important; }
        }
        @media (max-width: 900px) {
          .ce-split-pane { grid-template-columns: 1fr !important; }
          .ce-step-label { display: none; }
          .ce-spec-mockup-row { grid-template-columns: 1.2fr 1fr !important; }
        }
        @media (max-width: 580px) {
          .ce-grid-2 { grid-template-columns: 1fr !important; }
          .ce-grid-3 { grid-template-columns: 1fr !important; }
          .ce-spec-mockup-row { grid-template-columns: 1fr !important; gap: 20px !important; }
        }
      `}</style>
    </div>
  );
}
