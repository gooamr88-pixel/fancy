'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PlacesAutocomplete from '../../components/PlacesAutocomplete';

/* ═══════════════════════════════════════════════
   Brand Design Tokens
   ═══════════════════════════════════════════════ */
const C = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF',
  softBg: '#FAFAF8', error: '#C45E5E', success: '#3B9B6D',
  darkBg: '#0F1114', darkCard: 'rgba(255,255,255,0.04)', goldGlow: 'rgba(184,148,79,0.25)',
};

/* ═══════════════════════════════════════════════
   Template Definitions
   ═══════════════════════════════════════════════ */
const TEMPLATES = [
  {
    key: 'wedding', label: 'Wedding',
    icon: '💍', desc: 'Elegant ceremony & reception RSVP with meal selection',
    colors: { primary: '#B8944F', secondary: '#D7BE80', accent: '#191B1E', background: '#F8F4EC' },
    gradient: 'linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)',
  },
  {
    key: 'engagement', label: 'Engagement',
    icon: '💎', desc: 'Celebrate your love story with a stunning invitation',
    colors: { primary: '#C27B8E', secondary: '#E8B4C0', accent: '#2D1F26', background: '#FDF5F7' },
    gradient: 'linear-gradient(135deg, #C27B8E 0%, #E8B4C0 100%)',
  },
  {
    key: 'corporate', label: 'Corporate',
    icon: '🏢', desc: 'Professional event with agenda, speakers & check-in',
    colors: { primary: '#2563EB', secondary: '#60A5FA', accent: '#1E293B', background: '#F8FAFC' },
    gradient: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)',
  },
  {
    key: 'birthday', label: 'Birthday',
    icon: '🎂', desc: 'Fun and colorful birthday party invitation',
    colors: { primary: '#E85D75', secondary: '#F9A8B8', accent: '#3D1520', background: '#FFF5F7' },
    gradient: 'linear-gradient(135deg, #E85D75 0%, #F9A8B8 100%)',
  },
  {
    key: 'gala', label: 'Gala / Formal',
    icon: '🥂', desc: 'Black-tie galas, fundraisers, and prestigious events',
    colors: { primary: '#1E293B', secondary: '#475569', accent: '#B8944F', background: '#F1F5F9' },
    gradient: 'linear-gradient(135deg, #1E293B 0%, #475569 100%)',
  },
  {
    key: 'custom', label: 'Custom',
    icon: '✨', desc: 'Start from scratch — fully customizable event page',
    colors: { primary: '#B8944F', secondary: '#D7BE80', accent: '#191B1E', background: '#F8F4EC' },
    gradient: 'linear-gradient(135deg, #B8944F 0%, #8B6F3A 100%)',
  },
];

/* ═══════════════════════════════════════════════
   Wizard Steps
   ═══════════════════════════════════════════════ */
const STEPS = [
  { key: 'template', label: 'Template', icon: '🎨' },
  { key: 'details', label: 'Details', icon: '📋' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
  { key: 'preview', label: 'Create', icon: '🚀' },
];

/* ═══════════════════════════════════════════════
   Dress Code Options
   ═══════════════════════════════════════════════ */
const DRESS_CODES = [
  '', 'Black Tie', 'Black Tie Optional', 'Cocktail Attire',
  'Semi-Formal', 'Business Casual', 'Casual', 'White Party', 'Themed',
];

export default function CreateEventWizard() {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [slugStatus, setSlugStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [suggestedSlug, setSuggestedSlug] = useState('');
  const [mounted, setMounted] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);

  // Form state
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

  // Mount animation
  useEffect(() => { setMounted(true); }, []);

  // Auth check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const orgId = localStorage.getItem('org_id');
      if (!orgId) router.push('/login');
    }
  }, [router]);

  // Auto-generate slug from title
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

  // Debounced slug availability check
  useEffect(() => {
    if (!slug || slug.length < 3) { setSlugStatus(null); return; }
    setSlugStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl}/public/events/${slug}`);
        if (res.status === 404) {
          setSlugStatus('available');
        } else if (res.ok) {
          setSlugStatus('taken');
          setSuggestedSlug(`${slug}-${new Date().getFullYear()}`);
        } else {
          setSlugStatus('error');
        }
      } catch {
        setSlugStatus('error');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [slug, apiUrl]);

  // Template selection handler
  const handleTemplateSelect = (tpl) => {
    setTemplateType(tpl.key);
    setCustomColors(tpl.colors);
    setTemplateData({});
    setStep(1);
  };

  // Validation per step
  const canProceed = useCallback(() => {
    if (step === 0) return !!templateType;
    if (step === 1) return !!title && !!slug && !!eventDate && slugStatus !== 'taken';
    if (step === 2) return true; // settings are optional
    return true;
  }, [step, templateType, title, slug, eventDate, slugStatus]);

  // Submit event
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        slug, templateType, title, description, eventDate,
        eventEndDate: eventEndDate || undefined,
        locationName: locationName || undefined,
        locationAddress: locationAddress || undefined,
        locationLat: locationLat || undefined,
        locationLng: locationLng || undefined,
        locationPlaceId: locationPlaceId || undefined,
        dressCode: dressCode || undefined,
        rsvpDeadline: rsvpDeadline || undefined,
        privacyMode,
        accessPassword: privacyMode === 'password' ? accessPassword : undefined,
        coverImageUrl: coverImageUrl || undefined,
        customColors,
        templateData: Object.keys(templateData).length > 0 ? templateData : undefined,
      };

      const res = await fetch(`${apiUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'SLUG_TAKEN') {
          setSlugStatus('taken');
          setSuggestedSlug(data.suggestedSlug);
          setStep(1);
          throw new Error('This event URL is already taken. Please choose a different one.');
        }
        throw new Error(data.message || 'Failed to create event');
      }

      // Success — redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTemplate = TEMPLATES.find(t => t.key === templateType);
  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fancyrsvp.com';

  /* ═══════════════════════════════════════
     Reusable styled input
     ═══════════════════════════════════════ */
  const Input = ({ label, required, children, hint }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {label && (
        <label style={{
          fontSize: '12px', fontWeight: 700, color: C.stone, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontFamily: 'var(--font-sans)',
        }}>
          {label} {required && <span style={{ color: C.gold }}>*</span>}
        </label>
      )}
      {children}
      {hint && <span style={{ fontSize: '11px', color: C.stone, lineHeight: 1.4 }}>{hint}</span>}
    </div>
  );

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px',
    background: C.white, border: `1.5px solid ${C.border}`, borderRadius: '12px',
    fontSize: '14px', color: C.charcoal, outline: 'none', fontFamily: 'var(--font-sans)',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  const handleFocus = (e) => {
    e.target.style.borderColor = C.gold;
    e.target.style.boxShadow = `0 0 0 3px ${C.goldGlow}`;
  };
  const handleBlur = (e) => {
    e.target.style.borderColor = C.border;
    e.target.style.boxShadow = 'none';
  };

  return (
    <div style={{ minHeight: '100vh', background: step === 0 ? C.darkBg : C.softBg, fontFamily: 'var(--font-sans)', transition: 'background 0.6s ease' }}>

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        padding: '0 32px', height: '64px',
        background: step === 0 ? 'rgba(15,17,20,0.95)' : C.white,
        borderBottom: step === 0 ? '1px solid rgba(184,148,79,0.15)' : `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100,
        transition: 'all 0.4s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/dashboard" style={{
            fontSize: '13px', color: step === 0 ? 'rgba(255,255,255,0.5)' : C.stone,
            textDecoration: 'none', fontWeight: 600, fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'color 0.2s',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.7 }}>
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Dashboard
          </Link>
          <div style={{ width: '1px', height: '20px', background: step === 0 ? 'rgba(255,255,255,0.1)' : C.border }} />
          <h1 style={{
            fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 700,
            color: step === 0 ? C.white : C.charcoal, margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Create Event
          </h1>
        </div>

        {/* Step indicator mini */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{
              width: i === step ? '24px' : '8px', height: '8px',
              borderRadius: '4px',
              background: i === step ? C.gold : i < step ? C.champagne : (step === 0 ? 'rgba(255,255,255,0.15)' : C.border),
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: i < step ? 'pointer' : 'default',
            }} onClick={() => { if (i < step) setStep(i); }} />
          ))}
        </div>
      </div>

      {/* ═══ STEP INDICATOR BAR ═══ */}
      {step > 0 && (
        <div style={{
          maxWidth: '900px', margin: '32px auto 0', padding: '0 24px',
          animation: 'ce-fadeIn 0.4s ease',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0',
            background: C.white, borderRadius: '16px', padding: '6px',
            border: `1px solid ${C.border}`,
            boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          }}>
            {STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <button
                  onClick={() => { if (i < step) setStep(i); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px', borderRadius: '12px', border: 'none',
                    cursor: i <= step ? 'pointer' : 'default',
                    background: step === i
                      ? `linear-gradient(135deg, ${C.gold}, ${C.champagne})`
                      : 'transparent',
                    color: step === i ? C.white : i < step ? C.gold : C.stone,
                    fontWeight: step === i ? 700 : 500, fontSize: '13px',
                    fontFamily: 'var(--font-sans)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    opacity: i > step ? 0.4 : 1,
                  }}
                >
                  {i < step ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill={C.gold} opacity="0.15"/>
                      <path d="M5 8L7 10L11 6" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span style={{ fontSize: '14px' }}>{s.icon}</span>
                  )}
                  <span className="ce-step-label">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div style={{
                    width: '32px', height: '2px', borderRadius: '1px',
                    background: i < step
                      ? `linear-gradient(90deg, ${C.gold}, ${C.champagne})`
                      : C.border,
                    transition: 'background 0.5s ease',
                    flexShrink: 0,
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ═══ STEP CONTENT ═══ */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: step === 0 ? '0' : '32px 24px 80px' }}>

        {/* ════ STEP 0: TEMPLATE SELECTION ════ */}
        {step === 0 && (
          <div style={{
            padding: '60px 24px 80px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* Hero Header */}
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '100px',
                background: 'rgba(184,148,79,0.1)', border: '1px solid rgba(184,148,79,0.2)',
                marginBottom: '24px',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.gold, animation: 'ce-pulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: C.champagne, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Step 1 of 4
                </span>
              </div>
              <h2 style={{
                fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: 600, color: C.white, margin: '0 0 16px',
                letterSpacing: '-0.02em', lineHeight: 1.2,
              }}>
                Choose Your{' '}
                <span style={{
                  background: `linear-gradient(135deg, ${C.gold}, ${C.champagne})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Template
                </span>
              </h2>
              <p style={{
                color: 'rgba(255,255,255,0.45)', fontSize: '15px', fontWeight: 400,
                maxWidth: '480px', margin: '0 auto', lineHeight: 1.7,
              }}>
                Each template is tailored with unique fields, color schemes, and styling to match your occasion perfectly.
              </p>
              {/* Gold ornament line */}
              <div style={{
                width: '60px', height: '2px', margin: '28px auto 0',
                background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
                borderRadius: '1px',
              }} />
            </div>

            {/* Template Grid */}
            <div className="ce-template-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px', maxWidth: '860px', margin: '0 auto',
            }}>
              {TEMPLATES.map((tpl, idx) => {
                const isSelected = templateType === tpl.key;
                const isHovered = hoveredCard === tpl.key;
                return (
                  <button
                    key={tpl.key}
                    onClick={() => handleTemplateSelect(tpl)}
                    onMouseEnter={() => setHoveredCard(tpl.key)}
                    onMouseLeave={() => setHoveredCard(null)}
                    style={{
                      position: 'relative', padding: '36px 24px 28px',
                      border: `1.5px solid ${isSelected ? C.gold : isHovered ? 'rgba(184,148,79,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '20px',
                      background: isSelected
                        ? 'rgba(184,148,79,0.08)'
                        : isHovered
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(255,255,255,0.02)',
                      backdropFilter: 'blur(12px)',
                      cursor: 'pointer', textAlign: 'center',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                      transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                      boxShadow: isSelected
                        ? `0 0 0 1px ${C.gold}, 0 8px 32px rgba(184,148,79,0.2)`
                        : isHovered
                          ? '0 12px 40px rgba(0,0,0,0.3)'
                          : '0 4px 16px rgba(0,0,0,0.15)',
                      animation: `ce-fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.08}s both`,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Selected badge */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute', top: '12px', right: '12px',
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'ce-scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M3 6L5 8L9 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}

                    {/* Icon with gradient circle */}
                    <div style={{
                      width: '72px', height: '72px', borderRadius: '50%',
                      background: tpl.gradient, opacity: isSelected || isHovered ? 1 : 0.7,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '32px', transition: 'all 0.4s ease',
                      boxShadow: isHovered ? `0 4px 20px ${tpl.colors.primary}40` : 'none',
                      transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                    }}>
                      {tpl.icon}
                    </div>

                    {/* Label */}
                    <span style={{
                      fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600,
                      color: C.white, letterSpacing: '-0.01em',
                    }}>
                      {tpl.label}
                    </span>

                    {/* Description */}
                    <span style={{
                      fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6,
                      fontWeight: 400, maxWidth: '200px',
                    }}>
                      {tpl.desc}
                    </span>

                    {/* Color dots */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      {Object.values(tpl.colors).map((color, i) => (
                        <div key={i} style={{
                          width: '12px', height: '12px', borderRadius: '50%', background: color,
                          border: '1.5px solid rgba(255,255,255,0.15)',
                          transition: 'transform 0.3s ease',
                          transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                        }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ STEP 1: EVENT DETAILS ════ */}
        {step === 1 && (
          <div style={{
            background: C.white, border: `1px solid ${C.border}`,
            borderRadius: '20px', padding: '48px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
            animation: 'ce-fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '36px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: selectedTemplate?.gradient || C.gold,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px',
              }}>
                {selectedTemplate?.icon}
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: C.charcoal, margin: 0 }}>
                  Event Details
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, color: C.gold,
                    padding: '2px 10px', borderRadius: '100px',
                    background: 'rgba(184,148,79,0.1)',
                  }}>
                    {selectedTemplate?.label}
                  </span>
                  <button onClick={() => setStep(0)} style={{
                    background: 'none', border: 'none', fontSize: '11px',
                    color: C.stone, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    textDecoration: 'underline', textUnderlineOffset: '2px',
                  }}>
                    Change
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Title */}
              <Input label="Event Title" required>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Julian & Sophia's Wedding Gala"
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </Input>

              {/* Slug with availability */}
              <Input label="Event URL" required>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <div style={{
                    padding: '14px 14px', background: C.ivory, border: `1.5px solid ${C.border}`,
                    borderRadius: '12px 0 0 12px', borderRight: 'none', fontSize: '13px', color: C.stone,
                    whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center',
                  }}>
                    {frontendUrl}/
                  </div>
                  <input
                    type="text" value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-'))}
                    placeholder="your-event-slug"
                    style={{
                      ...inputStyle, borderRadius: '0 12px 12px 0', flex: 1,
                      borderColor: slugStatus === 'taken' ? C.error : slugStatus === 'available' ? C.success : C.border,
                    }}
                    onFocus={handleFocus} onBlur={handleBlur}
                  />
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {slugStatus === 'checking' && (
                    <span style={{ color: C.stone, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '12px', height: '12px', border: `2px solid ${C.stone}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'ce-spin 0.6s linear infinite', display: 'inline-block' }} />
                      Checking availability…
                    </span>
                  )}
                  {slugStatus === 'available' && (
                    <span style={{ color: C.success, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill={C.success} opacity="0.15"/><path d="M4.5 7L6 8.5L9.5 5.5" stroke={C.success} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Available
                    </span>
                  )}
                  {slugStatus === 'taken' && (
                    <span style={{ color: C.error, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill={C.error} opacity="0.15"/><path d="M5 5L9 9M9 5L5 9" stroke={C.error} strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Taken —{' '}
                      <button onClick={() => setSlug(suggestedSlug)} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>
                        Try &ldquo;{suggestedSlug}&rdquo;
                      </button>
                    </span>
                  )}
                  {slugStatus === 'error' && <span style={{ color: C.stone }}>⚠ Could not verify. Try again.</span>}
                </div>
              </Input>

              {/* Description */}
              <Input label="Description">
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  placeholder="Tell your guests about the event…"
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '90px' }}
                  onFocus={handleFocus} onBlur={handleBlur} />
              </Input>

              {/* Dates */}
              <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Input label="Event Date & Time" required>
                  <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }} onFocus={handleFocus} onBlur={handleBlur} />
                </Input>
                <Input label="End Date & Time" hint="Optional">
                  <input type="datetime-local" value={eventEndDate} onChange={e => setEventEndDate(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }} onFocus={handleFocus} onBlur={handleBlur} />
                </Input>
              </div>

              {/* Location */}
              <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Input label="Venue Name">
                  <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                    placeholder="e.g. The Grand Ballroom" style={inputStyle}
                    onFocus={handleFocus} onBlur={handleBlur} />
                </Input>
                <Input label="Full Address">
                  <PlacesAutocomplete
                    value={locationAddress}
                    onChange={setLocationAddress}
                    onPlaceSelect={(place) => {
                      setLocationAddress(place.address);
                      setLocationName(place.name || locationName);
                      setLocationLat(place.lat);
                      setLocationLng(place.lng);
                      setLocationPlaceId(place.placeId);
                    }}
                    placeholder="Search for a venue or address…"
                    style={inputStyle}
                  />
                </Input>
              </div>

              {/* ─── Divider ─── */}
              <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${C.border}, transparent)`, margin: '8px 0' }} />

              {/* Template-Specific Fields */}
              {templateType && templateType !== 'custom' && (
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600,
                    color: C.charcoal, marginBottom: '20px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <span style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: 'rgba(184,148,79,0.1)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px',
                    }}>
                      {selectedTemplate?.icon}
                    </span>
                    {selectedTemplate?.label} Details
                  </h3>

                  {/* Wedding Fields */}
                  {templateType === 'wedding' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <Input label="Partner 1 Name">
                          <input type="text" value={templateData.partner1Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner1Name: e.target.value }))} placeholder="e.g. Julian" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </Input>
                        <Input label="Partner 2 Name">
                          <input type="text" value={templateData.partner2Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner2Name: e.target.value }))} placeholder="e.g. Sophia" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </Input>
                      </div>
                      <Input label="Our Love Story">
                        <textarea value={templateData.loveStory || ''} onChange={e => setTemplateData(d => ({ ...d, loveStory: e.target.value }))} rows={4} placeholder="Share how you met and your journey together…" style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                      <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <Input label="Ceremony Location" hint="If different from main venue">
                          <input type="text" value={templateData.ceremonyLocation || ''} onChange={e => setTemplateData(d => ({ ...d, ceremonyLocation: e.target.value }))} placeholder="e.g. St. Patrick's Cathedral" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </Input>
                        <Input label="Reception Location" hint="If different from main venue">
                          <input type="text" value={templateData.receptionLocation || ''} onChange={e => setTemplateData(d => ({ ...d, receptionLocation: e.target.value }))} placeholder="e.g. The Plaza Hotel" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </Input>
                      </div>
                      <Input label="Registry URL">
                        <input type="text" value={templateData.registryUrl || ''} onChange={e => setTemplateData(d => ({ ...d, registryUrl: e.target.value }))} placeholder="https://www.zola.com/registry/…" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                      <Input label="Accommodations Info">
                        <textarea value={templateData.accommodations || ''} onChange={e => setTemplateData(d => ({ ...d, accommodations: e.target.value }))} rows={3} placeholder="Hotel blocks, travel tips, parking info…" style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                    </div>
                  )}

                  {/* Engagement Fields */}
                  {templateType === 'engagement' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <Input label="Partner 1 Name">
                          <input type="text" value={templateData.partner1Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner1Name: e.target.value }))} placeholder="e.g. Julian" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </Input>
                        <Input label="Partner 2 Name">
                          <input type="text" value={templateData.partner2Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner2Name: e.target.value }))} placeholder="e.g. Sophia" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </Input>
                      </div>
                      <Input label="Our Story">
                        <textarea value={templateData.ourStory || ''} onChange={e => setTemplateData(d => ({ ...d, ourStory: e.target.value }))} rows={4} placeholder="Share how you met and your engagement story…" style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                      <Input label="Registry URL">
                        <input type="text" value={templateData.registryUrl || ''} onChange={e => setTemplateData(d => ({ ...d, registryUrl: e.target.value }))} placeholder="https://www.zola.com/registry/…" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                    </div>
                  )}

                  {/* Corporate Fields */}
                  {templateType === 'corporate' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <Input label="Company / Organization Name">
                        <input type="text" value={templateData.companyName || ''} onChange={e => setTemplateData(d => ({ ...d, companyName: e.target.value }))} placeholder="e.g. Acme Corporation" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                      <Input label="Agenda / Schedule">
                        <textarea value={templateData.agenda || ''} onChange={e => setTemplateData(d => ({ ...d, agenda: e.target.value }))} rows={6} placeholder="List your event agenda with times…" style={{ ...inputStyle, resize: 'vertical', minHeight: '140px' }} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                      <Input label="Speakers / Presenters">
                        <textarea value={templateData.speakers || ''} onChange={e => setTemplateData(d => ({ ...d, speakers: e.target.value }))} rows={3} placeholder="Name — Title — Topic, one per line" style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                      <Input label="Sponsors">
                        <textarea value={templateData.sponsors || ''} onChange={e => setTemplateData(d => ({ ...d, sponsors: e.target.value }))} rows={2} placeholder="List event sponsors…" style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                      <Input label="Networking Notes">
                        <input type="text" value={templateData.networkingNotes || ''} onChange={e => setTemplateData(d => ({ ...d, networkingNotes: e.target.value }))} placeholder="e.g. Networking reception follows the keynote" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                    </div>
                  )}

                  {/* Birthday Fields */}
                  {templateType === 'birthday' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <Input label="Birthday Person's Name">
                          <input type="text" value={templateData.birthdayPersonName || ''} onChange={e => setTemplateData(d => ({ ...d, birthdayPersonName: e.target.value }))} placeholder="e.g. Emma" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </Input>
                        <Input label="Age / Milestone">
                          <input type="text" value={templateData.ageMilestone || ''} onChange={e => setTemplateData(d => ({ ...d, ageMilestone: e.target.value }))} placeholder="e.g. Turning 30!" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </Input>
                      </div>
                      <Input label="Theme">
                        <input type="text" value={templateData.theme || ''} onChange={e => setTemplateData(d => ({ ...d, theme: e.target.value }))} placeholder="e.g. Tropical Luau, 90s Retro, Garden Party" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                      <Input label="Gift Registry URL">
                        <input type="text" value={templateData.registryUrl || ''} onChange={e => setTemplateData(d => ({ ...d, registryUrl: e.target.value }))} placeholder="https://www.amazon.com/registry/…" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                    </div>
                  )}

                  {/* Gala Fields */}
                  {templateType === 'gala' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <Input label="Honoree(s)">
                        <input type="text" value={templateData.honorees || ''} onChange={e => setTemplateData(d => ({ ...d, honorees: e.target.value }))} placeholder="e.g. Dr. Jane Smith, Community Service Award" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                      <Input label="Program / Entertainment">
                        <textarea value={templateData.program || ''} onChange={e => setTemplateData(d => ({ ...d, program: e.target.value }))} rows={4} placeholder="Describe the evening's program, performances, and entertainment…" style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                      <Input label="Sponsor Tiers">
                        <textarea value={templateData.sponsorTiers || ''} onChange={e => setTemplateData(d => ({ ...d, sponsorTiers: e.target.value }))} rows={3} placeholder={'Platinum: $10,000\nGold: $5,000\nSilver: $2,500'} style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} onFocus={handleFocus} onBlur={handleBlur} />
                      </Input>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Template Note */}
              {templateType === 'custom' && (
                <div style={{
                  padding: '20px', borderRadius: '14px',
                  background: 'rgba(184,148,79,0.04)',
                  border: '1px solid rgba(184,148,79,0.12)',
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                }}>
                  <span style={{ fontSize: '20px' }}>✨</span>
                  <div style={{ fontSize: '13px', color: C.stone, lineHeight: 1.7 }}>
                    <strong style={{ color: C.charcoal }}>Custom templates</strong> have no pre-built sections. Use the <strong style={{ color: C.charcoal }}>Form Builder</strong> from the dashboard to add custom questions after creating your event.
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '36px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setStep(0)} style={{
                background: 'none', border: `1.5px solid ${C.border}`, borderRadius: '12px',
                padding: '12px 24px', fontSize: '13px', color: C.stone, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontWeight: 600, transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Templates
              </button>
              <button disabled={!canProceed()} onClick={() => setStep(2)} style={{
                padding: '14px 32px', border: 'none', borderRadius: '12px', fontWeight: 700,
                fontSize: '14px', cursor: canProceed() ? 'pointer' : 'default',
                fontFamily: 'var(--font-sans)', letterSpacing: '0.3px',
                background: canProceed() ? `linear-gradient(135deg, ${C.gold}, ${C.goldHover})` : C.border,
                color: canProceed() ? C.white : C.stone,
                transition: 'all 0.3s ease',
                boxShadow: canProceed() ? '0 4px 16px rgba(184,148,79,0.3)' : 'none',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                Continue
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* ════ STEP 2: SETTINGS ════ */}
        {step === 2 && (
          <div style={{
            background: C.white, border: `1px solid ${C.border}`,
            borderRadius: '20px', padding: '48px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
            animation: 'ce-fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <div style={{ marginBottom: '36px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: C.charcoal, margin: '0 0 8px' }}>
                Event Settings
              </h2>
              <p style={{ fontSize: '13px', color: C.stone, margin: 0 }}>
                These are optional — you can always change them later from the dashboard.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* Dress Code as Chips */}
              <Input label="Dress Code">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {DRESS_CODES.map(dc => {
                    const isActive = dressCode === dc;
                    const label = dc || 'No dress code';
                    return (
                      <button key={dc} onClick={() => setDressCode(dc)} style={{
                        padding: '10px 18px', borderRadius: '100px',
                        border: `1.5px solid ${isActive ? C.gold : C.border}`,
                        background: isActive ? 'rgba(184,148,79,0.08)' : C.white,
                        color: isActive ? C.gold : C.stone,
                        fontSize: '13px', fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        transition: 'all 0.25s ease',
                      }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Input>

              {/* RSVP Deadline */}
              <Input label="RSVP Deadline" hint="After this date, guests will not be able to submit RSVPs">
                <input type="datetime-local" value={rsvpDeadline} onChange={e => setRsvpDeadline(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }} onFocus={handleFocus} onBlur={handleBlur} />
              </Input>

              {/* Privacy Mode */}
              <Input label="Event Visibility">
                <div className="ce-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {[
                    { key: 'public', label: 'Public', desc: 'Anyone with the link', icon: '🌐' },
                    { key: 'private', label: 'Private', desc: 'Invite-only access', icon: '🔒' },
                    { key: 'password', label: 'Password', desc: 'Requires a passcode', icon: '🔐' },
                  ].map(mode => {
                    const isActive = privacyMode === mode.key;
                    return (
                      <button key={mode.key} onClick={() => setPrivacyMode(mode.key)} style={{
                        padding: '20px 16px', border: `1.5px solid ${isActive ? C.gold : C.border}`,
                        borderRadius: '16px',
                        background: isActive ? 'rgba(184,148,79,0.05)' : C.white,
                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s ease',
                        transform: isActive ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: isActive ? `0 4px 16px ${C.goldGlow}` : 'none',
                      }}>
                        <span style={{
                          fontSize: '28px', display: 'block', marginBottom: '10px',
                          transition: 'transform 0.3s ease',
                          transform: isActive ? 'scale(1.15)' : 'scale(1)',
                        }}>{mode.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: isActive ? C.gold : C.charcoal, display: 'block', marginBottom: '4px' }}>
                          {mode.label}
                        </span>
                        <span style={{ fontSize: '11px', color: C.stone }}>{mode.desc}</span>
                      </button>
                    );
                  })}
                </div>
                {privacyMode === 'password' && (
                  <div style={{ marginTop: '12px', animation: 'ce-fadeInUp 0.3s ease' }}>
                    <input type="text" value={accessPassword} onChange={e => setAccessPassword(e.target.value)}
                      placeholder="Enter access password" style={inputStyle}
                      onFocus={handleFocus} onBlur={handleBlur} />
                  </div>
                )}
              </Input>

              {/* Cover Image */}
              <Input label="Cover Image URL" hint="Paste a link to your event's hero image">
                <input type="url" value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/…" style={inputStyle}
                  onFocus={handleFocus} onBlur={handleBlur} />
                {coverImageUrl && (
                  <div style={{
                    marginTop: '8px', borderRadius: '14px', overflow: 'hidden',
                    height: '180px', position: 'relative',
                  }}>
                    <img src={coverImageUrl} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => e.target.style.display = 'none'} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
                    }} />
                  </div>
                )}
              </Input>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '36px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setStep(1)} style={{
                background: 'none', border: `1.5px solid ${C.border}`, borderRadius: '12px',
                padding: '12px 24px', fontSize: '13px', color: C.stone, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontWeight: 600, transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Back
              </button>
              <button onClick={() => setStep(3)} style={{
                padding: '14px 32px', border: 'none', borderRadius: '12px', fontWeight: 700,
                fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldHover})`,
                color: C.white, transition: 'all 0.3s ease', letterSpacing: '0.3px',
                boxShadow: '0 4px 16px rgba(184,148,79,0.3)',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                Review & Create
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* ════ STEP 3: PREVIEW & CREATE ════ */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'ce-fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {/* Preview Card */}
            <div style={{
              background: C.white, border: `1px solid ${C.border}`,
              borderRadius: '20px', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}>
              {/* Hero Preview */}
              <div style={{
                height: '220px', position: 'relative',
                background: coverImageUrl
                  ? `linear-gradient(to top, rgba(25,27,30,0.9), rgba(25,27,30,0.2)), url(${coverImageUrl}) center/cover`
                  : `linear-gradient(135deg, ${customColors.primary || C.gold} 0%, ${customColors.accent || C.charcoal} 100%)`,
                display: 'flex', alignItems: 'flex-end', padding: '36px',
              }}>
                {/* Decorative overlay pattern */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'radial-gradient(circle at 20% 80%, rgba(184,148,79,0.15) 0%, transparent 50%)',
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 12px', borderRadius: '100px',
                    background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                    marginBottom: '12px', border: '1px solid rgba(255,255,255,0.1)',
                  }}>
                    <span style={{ fontSize: '12px' }}>{selectedTemplate?.icon}</span>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                      {templateType} Event
                    </span>
                  </div>
                  <h2 style={{
                    fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 3vw, 32px)',
                    fontWeight: 500, color: C.white, margin: 0, letterSpacing: '-0.01em',
                  }}>
                    {title || 'Untitled Event'}
                  </h2>
                </div>
              </div>

              {/* Details Preview */}
              <div style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: C.charcoal, margin: 0 }}>
                  Event Summary
                </h3>

                <div className="ce-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { label: 'Event URL', value: `${frontendUrl}/${slug}`, icon: '🔗' },
                    { label: 'Template', value: selectedTemplate?.label, icon: selectedTemplate?.icon },
                    { label: 'Date', value: eventDate ? new Date(eventDate).toLocaleString() : 'Not set', icon: '📅' },
                    { label: 'Location', value: locationName || 'Not specified', icon: '📍' },
                    { label: 'Dress Code', value: dressCode || 'None', icon: '👔' },
                    { label: 'Privacy', value: privacyMode.charAt(0).toUpperCase() + privacyMode.slice(1), icon: privacyMode === 'public' ? '🌐' : privacyMode === 'password' ? '🔐' : '🔒' },
                    { label: 'RSVP Deadline', value: rsvpDeadline ? new Date(rsvpDeadline).toLocaleDateString() : 'No deadline', icon: '⏰' },
                  ].map(item => (
                    <div key={item.label} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '14px 16px', background: C.softBg, borderRadius: '14px',
                      border: `1px solid ${C.border}`,
                    }}>
                      <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, fontWeight: 700, display: 'block', marginBottom: '2px' }}>{item.label}</span>
                        <span style={{ fontSize: '13px', color: C.charcoal, fontWeight: 500, wordBreak: 'break-all', lineHeight: 1.4 }}>{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {description && (
                  <div style={{ padding: '18px', background: C.softBg, borderRadius: '14px', border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, fontWeight: 700, display: 'block', marginBottom: '8px' }}>Description</span>
                    <p style={{ fontSize: '13px', color: C.charcoal, lineHeight: 1.7, margin: 0 }}>{description}</p>
                  </div>
                )}

                {/* Note */}
                <div style={{
                  padding: '18px 20px', borderRadius: '14px',
                  background: 'rgba(184,148,79,0.04)',
                  border: '1px solid rgba(184,148,79,0.12)',
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: '16px' }}>💡</span>
                  <span style={{ fontSize: '12px', color: C.stone, lineHeight: 1.7 }}>
                    Your event will be created in <strong style={{ color: C.charcoal }}>draft</strong> state. Complete payment from the dashboard to activate it and make it publicly accessible.
                  </span>
                </div>

                {error && (
                  <div style={{
                    padding: '14px 18px', borderRadius: '14px',
                    background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)',
                    fontSize: '13px', color: C.error, display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill={C.error} opacity="0.15"/><path d="M8 5V8.5M8 10.5V11" stroke={C.error} strokeWidth="1.5" strokeLinecap="round"/></svg>
                    {error}
                  </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => setStep(2)} style={{
                    background: 'none', border: `1.5px solid ${C.border}`, borderRadius: '12px',
                    padding: '12px 24px', fontSize: '13px', color: C.stone, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Settings
                  </button>
                  <button disabled={submitting} onClick={handleSubmit}
                    style={{
                      padding: '16px 40px', border: 'none', borderRadius: '14px',
                      fontWeight: 700, fontSize: '15px',
                      cursor: submitting ? 'default' : 'pointer',
                      fontFamily: 'var(--font-sans)',
                      background: submitting ? C.champagne : `linear-gradient(135deg, ${C.gold}, ${C.goldHover})`,
                      color: C.white, opacity: submitting ? 0.7 : 1,
                      transition: 'all 0.3s ease', letterSpacing: '0.3px',
                      boxShadow: submitting ? 'none' : '0 6px 24px rgba(184,148,79,0.35)',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                  >
                    {submitting ? (
                      <>
                        <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'ce-spin 0.6s linear infinite', display: 'inline-block' }} />
                        Creating…
                      </>
                    ) : (
                      <>
                        🎉 Create Event
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ CSS Animations ═══ */}
      <style jsx>{`
        @keyframes ce-fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ce-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ce-scaleIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes ce-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes ce-spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 900px) {
          .ce-template-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .ce-step-label { display: none; }
        }
        @media (max-width: 640px) {
          .ce-template-grid { grid-template-columns: 1fr !important; }
          .ce-grid-2 { grid-template-columns: 1fr !important; }
          .ce-grid-3 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
