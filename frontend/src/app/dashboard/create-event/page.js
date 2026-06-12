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
};

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px',
  background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px',
  fontSize: '14px', color: C.charcoal, outline: 'none', fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.25s ease',
};
const labelStyle = {
  fontSize: '12px', fontWeight: 600, color: C.stone, display: 'block',
  marginBottom: '6px', fontFamily: 'var(--font-sans)',
};
const goldBtn = (disabled) => ({
  padding: '14px 32px', background: disabled ? C.champagne : C.gold,
  color: C.white, border: 'none', borderRadius: '8px', fontWeight: 700,
  fontSize: '14px', cursor: disabled ? 'default' : 'pointer',
  fontFamily: 'var(--font-sans)', opacity: disabled ? 0.6 : 1,
  transition: 'all 0.3s ease', letterSpacing: '0.3px',
});

/* ═══════════════════════════════════════════════
   Template Definitions
   ═══════════════════════════════════════════════ */
const TEMPLATES = [
  {
    key: 'wedding', label: 'Wedding',
    icon: '💍', desc: 'Elegant ceremony & reception RSVP with meal selection',
    colors: { primary: '#B8944F', secondary: '#D7BE80', accent: '#191B1E', background: '#F8F4EC' },
  },
  {
    key: 'engagement', label: 'Engagement',
    icon: '💎', desc: 'Celebrate your love story with a stunning invitation',
    colors: { primary: '#C27B8E', secondary: '#E8B4C0', accent: '#2D1F26', background: '#FDF5F7' },
  },
  {
    key: 'corporate', label: 'Corporate',
    icon: '🏢', desc: 'Professional event with agenda, speakers & check-in',
    colors: { primary: '#2563EB', secondary: '#60A5FA', accent: '#1E293B', background: '#F8FAFC' },
  },
  {
    key: 'birthday', label: 'Birthday',
    icon: '🎂', desc: 'Fun and colorful birthday party invitation',
    colors: { primary: '#E85D75', secondary: '#F9A8B8', accent: '#3D1520', background: '#FFF5F7' },
  },
  {
    key: 'gala', label: 'Gala / Formal',
    icon: '🥂', desc: 'Black-tie galas, fundraisers, and prestigious events',
    colors: { primary: '#1E293B', secondary: '#475569', accent: '#B8944F', background: '#F1F5F9' },
  },
  {
    key: 'custom', label: 'Custom',
    icon: '✨', desc: 'Start from scratch — fully customizable event page',
    colors: { primary: '#B8944F', secondary: '#D7BE80', accent: '#191B1E', background: '#F8F4EC' },
  },
];

/* ═══════════════════════════════════════════════
   Wizard Steps
   ═══════════════════════════════════════════════ */
const STEPS = [
  { key: 'template', label: 'Template', icon: '🎨' },
  { key: 'details', label: 'Event Details', icon: '📋' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
  { key: 'preview', label: 'Preview & Create', icon: '👁️' },
];

export default function CreateEventWizard() {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [slugStatus, setSlugStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [suggestedSlug, setSuggestedSlug] = useState('');

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
        } else {
          setSlugStatus('taken');
          setSuggestedSlug(`${slug}-${new Date().getFullYear()}`);
        }
      } catch {
        setSlugStatus('available'); // Network error = probably available
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

  return (
    <div style={{ minHeight: '100vh', background: C.softBg, fontFamily: 'var(--font-sans)' }}>

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        padding: '16px 32px', background: C.white, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard" style={{ fontSize: '13px', color: C.stone, textDecoration: 'none', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
            ← Back to Dashboard
          </Link>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: C.charcoal, margin: 0 }}>
            Create New Event
          </h1>
        </div>
      </div>

      {/* ═══ STEP INDICATOR ═══ */}
      <div style={{ maxWidth: '800px', margin: '32px auto 0', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '40px' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <div
                onClick={() => { if (i < step) setStep(i); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                  borderRadius: '20px', cursor: i < step ? 'pointer' : 'default',
                  background: step === i ? C.gold : i < step ? 'rgba(184,148,79,0.1)' : C.white,
                  color: step === i ? C.white : i < step ? C.gold : C.stone,
                  border: `1px solid ${step === i ? C.gold : i < step ? 'rgba(184,148,79,0.2)' : C.border}`,
                  fontWeight: step === i ? 700 : 400, fontSize: '12px',
                  transition: 'all 0.3s ease',
                }}
              >
                <span>{s.icon}</span> {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: '32px', height: '2px', background: i < step ? C.gold : C.border, borderRadius: '2px', transition: 'background 0.3s' }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ═══ STEP CONTENT ═══ */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px 64px' }}>

        {/* ════ STEP 0: TEMPLATE SELECTION ════ */}
        {step === 0 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 500, color: C.charcoal }}>
                Choose Your Event Template
              </h2>
              <p style={{ color: C.stone, fontSize: '14px', marginTop: '8px', fontWeight: 300 }}>
                Select the type of event you're hosting. Each template comes with tailored fields and styling.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.key}
                  onClick={() => handleTemplateSelect(tpl)}
                  style={{
                    padding: '32px 20px', border: `2px solid ${templateType === tpl.key ? C.gold : C.border}`,
                    borderRadius: '16px', background: templateType === tpl.key ? 'rgba(184,148,79,0.04)' : C.white,
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s ease',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
                  onMouseLeave={e => { if (templateType !== tpl.key) e.currentTarget.style.borderColor = C.border; }}
                >
                  <span style={{ fontSize: '40px', display: 'block' }}>{tpl.icon}</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: C.charcoal }}>{tpl.label}</span>
                  <span style={{ fontSize: '12px', color: C.stone, lineHeight: 1.5 }}>{tpl.desc}</span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    {Object.values(tpl.colors).map((color, i) => (
                      <div key={i} style={{ width: '16px', height: '16px', borderRadius: '50%', background: color, border: '1px solid rgba(0,0,0,0.1)' }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ════ STEP 1: EVENT DETAILS ════ */}
        {step === 1 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '24px' }}>{selectedTemplate?.icon}</span>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 500, color: C.charcoal, margin: 0 }}>
                  Event Details
                </h2>
                <span style={{ fontSize: '12px', color: C.stone }}>Template: {selectedTemplate?.label}</span>
              </div>
            </div>

            {/* Title */}
            <div>
              <label style={labelStyle}>Event Title <span style={{ color: C.error }}>*</span></label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Julian & Sophia's Wedding Gala"
                style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
            </div>

            {/* Slug with availability */}
            <div>
              <label style={labelStyle}>Event URL <span style={{ color: C.error }}>*</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
                <div style={{
                  padding: '12px 14px', background: C.ivory, border: `1px solid ${C.border}`,
                  borderRadius: '8px 0 0 8px', borderRight: 'none', fontSize: '13px', color: C.stone,
                  whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
                }}>
                  {frontendUrl}/
                </div>
                <input
                  type="text" value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-'))}
                  placeholder="your-event-slug"
                  style={{ ...inputStyle, borderRadius: '0 8px 8px 0', flex: 1, borderColor: slugStatus === 'taken' ? C.error : slugStatus === 'available' ? C.success : C.border }}
                  onFocus={e => e.target.style.borderColor = C.gold}
                  onBlur={e => e.target.style.borderColor = slugStatus === 'taken' ? C.error : C.border}
                />
              </div>
              <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 500 }}>
                {slugStatus === 'checking' && <span style={{ color: C.stone }}>⏳ Checking availability...</span>}
                {slugStatus === 'available' && <span style={{ color: C.success }}>✓ This URL is available</span>}
                {slugStatus === 'taken' && (
                  <span style={{ color: C.error }}>
                    ✕ Already taken.{' '}
                    <button onClick={() => setSlug(suggestedSlug)} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '11px', fontFamily: 'var(--font-sans)' }}>
                      Try "{suggestedSlug}"
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                placeholder="Tell your guests about the event..."
                style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Event Date & Time <span style={{ color: C.error }}>*</span></label>
                <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }} />
              </div>
              <div>
                <label style={labelStyle}>End Date & Time <span style={{ fontSize: '10px', color: C.stone }}>(optional)</span></label>
                <input type="datetime-local" value={eventEndDate} onChange={e => setEventEndDate(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }} />
              </div>
            </div>

            {/* Location */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Venue Name</label>
                <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                  placeholder="e.g. The Grand Ballroom" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
              <div>
                <label style={labelStyle}>Full Address</label>
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
                  placeholder="Search for a venue or address..."
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Template-Specific Fields */}
            {templateType && templateType !== 'custom' && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '24px' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 500, color: C.charcoal, marginBottom: '16px' }}>
                  {selectedTemplate?.icon} {selectedTemplate?.label} Details
                </h3>

                {/* Wedding Fields */}
                {templateType === 'wedding' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={labelStyle}>Partner 1 Name</label>
                        <input type="text" value={templateData.partner1Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner1Name: e.target.value }))} placeholder="e.g. Julian" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                      </div>
                      <div>
                        <label style={labelStyle}>Partner 2 Name</label>
                        <input type="text" value={templateData.partner2Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner2Name: e.target.value }))} placeholder="e.g. Sophia" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Our Love Story</label>
                      <textarea value={templateData.loveStory || ''} onChange={e => setTemplateData(d => ({ ...d, loveStory: e.target.value }))} rows={4} placeholder="Share how you met and your journey together..." style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={labelStyle}>Ceremony Location <span style={{ fontSize: '10px', color: C.stone }}>(if different)</span></label>
                        <input type="text" value={templateData.ceremonyLocation || ''} onChange={e => setTemplateData(d => ({ ...d, ceremonyLocation: e.target.value }))} placeholder="e.g. St. Patrick's Cathedral" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                      </div>
                      <div>
                        <label style={labelStyle}>Reception Location <span style={{ fontSize: '10px', color: C.stone }}>(if different)</span></label>
                        <input type="text" value={templateData.receptionLocation || ''} onChange={e => setTemplateData(d => ({ ...d, receptionLocation: e.target.value }))} placeholder="e.g. The Plaza Hotel" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Registry URL</label>
                      <input type="text" value={templateData.registryUrl || ''} onChange={e => setTemplateData(d => ({ ...d, registryUrl: e.target.value }))} placeholder="https://www.zola.com/registry/..." style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Accommodations Info</label>
                      <textarea value={templateData.accommodations || ''} onChange={e => setTemplateData(d => ({ ...d, accommodations: e.target.value }))} rows={3} placeholder="Hotel blocks, travel tips, parking info..." style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                  </div>
                )}

                {/* Engagement Fields */}
                {templateType === 'engagement' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={labelStyle}>Partner 1 Name</label>
                        <input type="text" value={templateData.partner1Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner1Name: e.target.value }))} placeholder="e.g. Julian" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                      </div>
                      <div>
                        <label style={labelStyle}>Partner 2 Name</label>
                        <input type="text" value={templateData.partner2Name || ''} onChange={e => setTemplateData(d => ({ ...d, partner2Name: e.target.value }))} placeholder="e.g. Sophia" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Our Story</label>
                      <textarea value={templateData.ourStory || ''} onChange={e => setTemplateData(d => ({ ...d, ourStory: e.target.value }))} rows={4} placeholder="Share how you met and your engagement story..." style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Registry URL</label>
                      <input type="text" value={templateData.registryUrl || ''} onChange={e => setTemplateData(d => ({ ...d, registryUrl: e.target.value }))} placeholder="https://www.zola.com/registry/..." style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                  </div>
                )}

                {/* Corporate Fields */}
                {templateType === 'corporate' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={labelStyle}>Company / Organization Name</label>
                      <input type="text" value={templateData.companyName || ''} onChange={e => setTemplateData(d => ({ ...d, companyName: e.target.value }))} placeholder="e.g. Acme Corporation" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Agenda / Schedule</label>
                      <textarea value={templateData.agenda || ''} onChange={e => setTemplateData(d => ({ ...d, agenda: e.target.value }))} rows={6} placeholder="List your event agenda with times..." style={{ ...inputStyle, resize: 'vertical', minHeight: '140px' }} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Speakers / Presenters</label>
                      <textarea value={templateData.speakers || ''} onChange={e => setTemplateData(d => ({ ...d, speakers: e.target.value }))} rows={3} placeholder="Name - Title - Topic, one per line" style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Sponsors</label>
                      <textarea value={templateData.sponsors || ''} onChange={e => setTemplateData(d => ({ ...d, sponsors: e.target.value }))} rows={2} placeholder="List event sponsors..." style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Networking Notes</label>
                      <input type="text" value={templateData.networkingNotes || ''} onChange={e => setTemplateData(d => ({ ...d, networkingNotes: e.target.value }))} placeholder="e.g. Networking reception follows the keynote" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                  </div>
                )}

                {/* Birthday Fields */}
                {templateType === 'birthday' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={labelStyle}>Birthday Person's Name</label>
                        <input type="text" value={templateData.birthdayPersonName || ''} onChange={e => setTemplateData(d => ({ ...d, birthdayPersonName: e.target.value }))} placeholder="e.g. Emma" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                      </div>
                      <div>
                        <label style={labelStyle}>Age / Milestone</label>
                        <input type="text" value={templateData.ageMilestone || ''} onChange={e => setTemplateData(d => ({ ...d, ageMilestone: e.target.value }))} placeholder="e.g. Turning 30!" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Theme</label>
                      <input type="text" value={templateData.theme || ''} onChange={e => setTemplateData(d => ({ ...d, theme: e.target.value }))} placeholder="e.g. Tropical Luau, 90s Retro, Garden Party" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Gift Registry URL</label>
                      <input type="text" value={templateData.registryUrl || ''} onChange={e => setTemplateData(d => ({ ...d, registryUrl: e.target.value }))} placeholder="https://www.amazon.com/registry/..." style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                  </div>
                )}

                {/* Gala Fields */}
                {templateType === 'gala' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={labelStyle}>Honoree(s)</label>
                      <input type="text" value={templateData.honorees || ''} onChange={e => setTemplateData(d => ({ ...d, honorees: e.target.value }))} placeholder="e.g. Dr. Jane Smith, Community Service Award" style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Program / Entertainment</label>
                      <textarea value={templateData.program || ''} onChange={e => setTemplateData(d => ({ ...d, program: e.target.value }))} rows={4} placeholder="Describe the evening's program, performances, and entertainment..." style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div>
                      <label style={labelStyle}>Sponsor Tiers</label>
                      <textarea value={templateData.sponsorTiers || ''} onChange={e => setTemplateData(d => ({ ...d, sponsorTiers: e.target.value }))} rows={3} placeholder={'Platinum: $10,000\nGold: $5,000\nSilver: $2,500'} style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Template Note */}
            {templateType === 'custom' && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '24px' }}>
                <div style={{ padding: '16px', background: 'rgba(184,148,79,0.06)', border: '1px solid rgba(184,148,79,0.15)', borderRadius: '8px', fontSize: '13px', color: C.stone, lineHeight: 1.7 }}>
                  ✨ <strong>Custom templates</strong> have no pre-built sections. Use the <strong>Form Builder</strong> from the dashboard to add custom questions after creating your event.
                </div>
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: '20px' }}>
              <button onClick={() => setStep(0)} style={{ background: 'none', border: 'none', fontSize: '13px', color: C.stone, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                ← Change Template
              </button>
              <button disabled={!canProceed()} onClick={() => setStep(2)} style={goldBtn(!canProceed())}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ════ STEP 2: SETTINGS ════ */}
        {step === 2 && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 500, color: C.charcoal }}>
              ⚙️ Event Settings
            </h2>
            <p style={{ fontSize: '13px', color: C.stone, marginTop: '-12px' }}>These are optional — you can always change them later from the dashboard.</p>

            {/* Dress Code */}
            <div>
              <label style={labelStyle}>Dress Code</label>
              <select value={dressCode} onChange={e => setDressCode(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">No dress code specified</option>
                <option value="Black Tie">Black Tie</option>
                <option value="Black Tie Optional">Black Tie Optional</option>
                <option value="Cocktail Attire">Cocktail Attire</option>
                <option value="Semi-Formal">Semi-Formal</option>
                <option value="Business Casual">Business Casual</option>
                <option value="Casual">Casual</option>
                <option value="White Party">White Party</option>
                <option value="Themed">Themed / Costume</option>
              </select>
            </div>

            {/* RSVP Deadline */}
            <div>
              <label style={labelStyle}>RSVP Deadline</label>
              <input type="datetime-local" value={rsvpDeadline} onChange={e => setRsvpDeadline(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }} />
              <span style={{ fontSize: '11px', color: C.stone, marginTop: '4px', display: 'block' }}>
                After this date, guests will not be able to submit RSVPs
              </span>
            </div>

            {/* Privacy Mode */}
            <div>
              <label style={labelStyle}>Event Visibility</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                {[
                  { key: 'public', label: 'Public', desc: 'Anyone with the link', icon: '🌐' },
                  { key: 'private', label: 'Private', desc: 'Invite-only access', icon: '🔒' },
                  { key: 'password', label: 'Password', desc: 'Requires a passcode', icon: '🔐' },
                ].map(mode => (
                  <button key={mode.key} onClick={() => setPrivacyMode(mode.key)} style={{
                    padding: '16px', border: `2px solid ${privacyMode === mode.key ? C.gold : C.border}`,
                    borderRadius: '10px', background: privacyMode === mode.key ? 'rgba(184,148,79,0.04)' : C.white,
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  }}>
                    <span style={{ fontSize: '20px', display: 'block', marginBottom: '6px' }}>{mode.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: C.charcoal, display: 'block' }}>{mode.label}</span>
                    <span style={{ fontSize: '10px', color: C.stone }}>{mode.desc}</span>
                  </button>
                ))}
              </div>
              {privacyMode === 'password' && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ ...labelStyle, fontSize: '11px' }}>Event Password</label>
                  <input type="text" value={accessPassword} onChange={e => setAccessPassword(e.target.value)}
                    placeholder="Enter access password" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              )}
            </div>

            {/* Cover Image */}
            <div>
              <label style={labelStyle}>Cover Image URL <span style={{ fontSize: '10px', color: C.stone }}>(optional)</span></label>
              <input type="url" value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..." style={inputStyle}
                onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
              {coverImageUrl && (
                <div style={{ marginTop: '12px', borderRadius: '8px', overflow: 'hidden', height: '160px', background: C.ivory }}>
                  <img src={coverImageUrl} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => e.target.style.display = 'none'} />
                </div>
              )}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: '20px' }}>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', fontSize: '13px', color: C.stone, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                ← Back
              </button>
              <button onClick={() => setStep(3)} style={goldBtn(false)}>
                Review & Create →
              </button>
            </div>
          </div>
        )}

        {/* ════ STEP 3: PREVIEW & CREATE ════ */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Preview Card */}
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden' }}>
              {/* Hero Preview */}
              <div style={{
                height: '200px', background: coverImageUrl
                  ? `linear-gradient(to top, rgba(25,27,30,0.85), rgba(25,27,30,0.3)), url(${coverImageUrl}) center/cover`
                  : `linear-gradient(135deg, ${customColors.primary || C.gold}, ${customColors.accent || C.charcoal})`,
                display: 'flex', alignItems: 'flex-end', padding: '32px',
              }}>
                <div>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '3px', color: C.champagne, fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                    {templateType} invitation
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, color: C.white, margin: 0 }}>
                    {title || 'Untitled Event'}
                  </h2>
                </div>
              </div>

              {/* Details Preview */}
              <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: C.charcoal }}>Event Summary</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {[
                    { label: 'URL', value: `${frontendUrl}/${slug}`, icon: '🔗' },
                    { label: 'Template', value: selectedTemplate?.label, icon: selectedTemplate?.icon },
                    { label: 'Date', value: eventDate ? new Date(eventDate).toLocaleString() : 'Not set', icon: '📅' },
                    { label: 'Location', value: locationName || 'Not specified', icon: '📍' },
                    { label: 'Dress Code', value: dressCode || 'None', icon: '👔' },
                    { label: 'Privacy', value: privacyMode.charAt(0).toUpperCase() + privacyMode.slice(1), icon: privacyMode === 'public' ? '🌐' : privacyMode === 'password' ? '🔐' : '🔒' },
                    { label: 'RSVP Deadline', value: rsvpDeadline ? new Date(rsvpDeadline).toLocaleDateString() : 'No deadline', icon: '⏰' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', background: C.ivory, borderRadius: '8px', border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: '16px' }}>{item.icon}</span>
                      <div>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, fontWeight: 700, display: 'block' }}>{item.label}</span>
                        <span style={{ fontSize: '13px', color: C.charcoal, fontWeight: 500, wordBreak: 'break-all' }}>{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {description && (
                  <div style={{ padding: '16px', background: C.ivory, borderRadius: '8px', border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, fontWeight: 700, display: 'block', marginBottom: '6px' }}>Description</span>
                    <p style={{ fontSize: '13px', color: C.charcoal, lineHeight: 1.6, margin: 0 }}>{description}</p>
                  </div>
                )}

                {/* Important Notice */}
                <div style={{ padding: '16px', background: 'rgba(184,148,79,0.06)', border: '1px solid rgba(184,148,79,0.15)', borderRadius: '8px', fontSize: '12px', color: C.stone, lineHeight: 1.7 }}>
                  💡 <strong>Note:</strong> Your event will be created in <strong>draft</strong> state. Complete payment from the dashboard to activate it and make it publicly accessible. You can configure form fields, tables, and seating after creation.
                </div>

                {error && (
                  <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', fontSize: '12px', color: C.error }}>
                    ⚠️ {error}
                  </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: '20px' }}>
                  <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', fontSize: '13px', color: C.stone, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                    ← Back to Settings
                  </button>
                  <button disabled={submitting} onClick={handleSubmit}
                    style={{ ...goldBtn(submitting), padding: '14px 40px', fontSize: '15px' }}
                    onMouseEnter={e => { if (!submitting) e.target.style.background = C.goldHover; }}
                    onMouseLeave={e => { if (!submitting) e.target.style.background = C.gold; }}
                  >
                    {submitting ? '⏳ Creating Event...' : '🎉 Create Event'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr 1fr !important; }
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
