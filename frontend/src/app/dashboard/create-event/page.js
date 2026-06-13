'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

/* ═══════════════════════════════════════════════════════
   LAZY-LOADED STAGE COMPONENTS
   ═══════════════════════════════════════════════════════ */
const WizardShell = dynamic(() => import('./components/WizardShell'), { ssr: false });
const Stage1_TemplatesSimulator = dynamic(() => import('./components/Stage1_TemplatesSimulator'), { ssr: false });
const Stage2_FormConfiguration = dynamic(() => import('./components/Stage2_FormConfiguration'), { ssr: false });
const Stage3_Distribution = dynamic(() => import('./components/Stage3_Distribution'), { ssr: false });

/* ═══════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════ */
const C = {
  gold: '#B8944F', goldHover: '#a6833f', goldLight: 'rgba(184,148,79,0.15)',
  charcoal: '#191B1E', darkBg: '#0A0A0F',
  ivory: '#F8F4EC', champagne: '#D7BE80', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
  error: '#C45E5E', success: '#3B9B6D',
};

/* ═══════════════════════════════════════════════════════
   CURATED TEMPLATE DEFINITIONS
   ═══════════════════════════════════════════════════════ */
const TEMPLATES = [
  {
    key: 'wedding', label: 'Royale Wedding', icon: '💍',
    desc: 'Timeless elegance for your once-in-a-lifetime celebration. Gold foil accents with classic serif typography.',
    presets: [
      { name: 'Royale Gold', primary: '#B8944F', secondary: '#D7BE80', accent: '#B8944F', background: '#FFFDF7' },
      { name: 'Emerald Ivy', primary: '#1B6B3A', secondary: '#A3D5A5', accent: '#1B6B3A', background: '#F5FAF7' },
      { name: 'Burgundy Velvet', primary: '#800020', secondary: '#F2C9D0', accent: '#800020', background: '#FFF8F9' },
    ],
    specs: ['3D Envelope Animation', 'Luxury Serif Typography', 'Gold Foil Accents', 'RSVP + Meal Selection'],
    fields: ['Partner Names', 'Love Story', 'Ceremony & Reception', 'Gift Registry'],
  },
  {
    key: 'engagement', label: 'Eternal Love', icon: '💎',
    desc: 'Celebrate the moment with sophisticated gradients and shimmering diamond accents.',
    presets: [
      { name: 'Blush Gold', primary: '#D4A574', secondary: '#F5E6D3', accent: '#D4A574', background: '#FFFCF8' },
      { name: 'Champagne Sparkle', primary: '#C5A059', secondary: '#FDF0CD', accent: '#C5A059', background: '#FFFDF5' },
      { name: 'Sage Garden', primary: '#6B8E6B', secondary: '#D5E8D5', accent: '#6B8E6B', background: '#F8FAF8' },
    ],
    specs: ['Gradient Card Design', 'Corner Bracket Ornaments', 'Proposal Story Section', 'Interactive RSVP'],
    fields: ['Partner Names', 'Proposal Story', 'Gift Registry'],
  },
  {
    key: 'corporate', label: 'Summit Pro', icon: '🏢',
    desc: 'Professional and commanding. Dark geometric patterns for corporate events and conferences.',
    presets: [
      { name: 'Tech Sapphire', primary: '#3B82F6', secondary: '#93C5FD', accent: '#3B82F6', background: '#F0F4FF' },
      { name: 'Executive Forest', primary: '#166534', secondary: '#86EFAC', accent: '#166534', background: '#F0FDF4' },
      { name: 'Corporate Platinum', primary: '#64748B', secondary: '#CBD5E1', accent: '#64748B', background: '#F8FAFC' },
    ],
    specs: ['Geometric Dark Layout', 'Agenda Integration', 'Speaker Showcase', 'Professional RSVP'],
    fields: ['Company Name', 'Agenda', 'Speakers', 'Sponsors'],
  },
  {
    key: 'birthday', label: 'Milestone Party', icon: '🎂',
    desc: 'Vibrant and playful designs with soft floral patterns and celebration energy.',
    presets: [
      { name: 'Sunset Vibe', primary: '#E88FAC', secondary: '#FECDD3', accent: '#E88FAC', background: '#FFF5F6' },
      { name: 'Ocean Retro', primary: '#0EA5E9', secondary: '#BAE6FD', accent: '#0EA5E9', background: '#F0F9FF' },
      { name: 'Electric Fuchsia', primary: '#D946EF', secondary: '#F0ABFC', accent: '#D946EF', background: '#FDF4FF' },
    ],
    specs: ['Floral Card Pattern', 'Age Milestone Display', 'Theme Customization', 'Party RSVP'],
    fields: ['Celebrant Name', 'Age Milestone', 'Party Theme'],
  },
  {
    key: 'gala', label: 'Black Tie Gala', icon: '🥂',
    desc: 'Ultra-minimal luxury with maximum negative space. For the most refined occasions.',
    presets: [
      { name: 'Luxury Ivory', primary: '#C5A059', secondary: '#FDF0CD', accent: '#C5A059', background: '#FFFFF8' },
      { name: 'Obsidian Velvet', primary: '#8B7355', secondary: '#D4C5A9', accent: '#8B7355', background: '#FAF8F5' },
      { name: 'Imperial Royal', primary: '#7C3AED', secondary: '#C4B5FD', accent: '#7C3AED', background: '#FAF5FF' },
    ],
    specs: ['Minimal Luxury Design', 'Evening Program', 'VIP Honoree Section', 'Formal RSVP'],
    fields: ['Honoree', 'Evening Program', 'Sponsors'],
  },
  {
    key: 'custom', label: 'Custom Canvas', icon: '✨',
    desc: 'Start with a clean slate. Organic textures and rustic warmth for any occasion.',
    presets: [
      { name: 'Clean Linen', primary: '#8B7355', secondary: '#D4C5A9', accent: '#8B7355', background: '#FAF8F5' },
      { name: 'Warm Cream', primary: '#A0845C', secondary: '#E8D5B7', accent: '#A0845C', background: '#FFFCF5' },
      { name: 'Obsidian Slate', primary: '#475569', secondary: '#94A3B8', accent: '#475569', background: '#F8FAFC' },
    ],
    specs: ['Organic Textures', 'Fully Customizable', 'Rustic Card Pattern', 'Flexible RSVP'],
    fields: ['Custom Questionnaire'],
  },
];

const STEPS = [
  { key: 'templates', label: 'Templates', icon: '🎨' },
  { key: 'configure', label: 'Configure', icon: '📋' },
  { key: 'distribute', label: 'Distribute', icon: '🚀' },
];

/* ═══════════════════════════════════════════════════════
   STEP TRANSITION VARIANTS
   ═══════════════════════════════════════════════════════ */
const stepVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.3 },
      scale: { duration: 0.3 },
    },
  },
  exit: (direction) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.25 },
  }),
};

/* ═══════════════════════════════════════════════════════
   MAIN WIZARD COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function CreateEventWizard() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://fancyrsvp.com';

  /* ─── Wizard Navigation State ─── */
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  /* ─── Template & Preset State ─── */
  const [templateType, setTemplateType] = useState('wedding');
  const [selectedPresets, setSelectedPresets] = useState({
    wedding: 0, engagement: 0, corporate: 0,
    birthday: 0, gala: 0, custom: 0,
  });

  /* ─── Core Event Details ─── */
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState(null);
  const [suggestedSlug, setSuggestedSlug] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState(null);
  const [locationLng, setLocationLng] = useState(null);
  const [locationPlaceId, setLocationPlaceId] = useState('');

  /* ─── Template-Specific Data ─── */
  const [templateData, setTemplateData] = useState({});

  /* ─── Event Settings ─── */
  const [dressCode, setDressCode] = useState('');
  const [rsvpDeadline, setRsvpDeadline] = useState('');
  const [privacyMode, setPrivacyMode] = useState('private');
  const [accessPassword, setAccessPassword] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  /* ─── Custom Colors (derived from preset) ─── */
  const [customColors, setCustomColors] = useState({
    primary: '#B8944F', secondary: '#D7BE80',
    accent: '#B8944F', background: '#FFFDF7',
  });

  /* ─── Custom Form Fields (Stage 2 builder) ─── */
  const [customFields, setCustomFields] = useState([]);

  /* ─── Distribution Methods (Stage 3) ─── */
  const [distributionMethods, setDistributionMethods] = useState({
    link: true, qr: false, sms: false,
  });
  const [smsTemplate, setSmsTemplate] = useState('');

  /* ─── Slug availability debounce ref ─── */
  const slugTimerRef = useRef(null);

  /* ═══ Mount animation trigger ═══ */
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  /* ═══ Auth check ═══ */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const orgId = localStorage.getItem('org_id');
      if (!orgId) {
        window.location.href = '/login';
      }
    }
  }, []);

  /* ═══ Sync preset colors → customColors ═══ */
  useEffect(() => {
    const tpl = TEMPLATES.find(t => t.key === templateType);
    if (tpl) {
      const presetIdx = selectedPresets[templateType] || 0;
      const preset = tpl.presets[presetIdx];
      if (preset) {
        setCustomColors({
          primary: preset.primary,
          secondary: preset.secondary,
          accent: preset.accent || preset.primary,
          background: preset.background,
        });
      }
    }
  }, [templateType, selectedPresets]);

  /* ═══ Auto-generate slug from title ═══ */
  useEffect(() => {
    if (title) {
      const generated = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(generated);
    }
  }, [title]);

  /* ═══ Slug availability checker (debounced) ═══ */
  useEffect(() => {
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (!slug || slug.length < 3) {
      setSlugStatus(null);
      return;
    }
    setSlugStatus('checking');
    slugTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl}/public/events/${slug}`);
        if (res.status === 404) {
          setSlugStatus('available');
          setSuggestedSlug('');
        } else if (res.ok) {
          setSlugStatus('taken');
          const year = new Date().getFullYear();
          setSuggestedSlug(`${slug}-${year}`);
        } else {
          setSlugStatus('error');
        }
      } catch {
        setSlugStatus('error');
      }
    }, 500);
    return () => {
      if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    };
  }, [slug, apiUrl]);

  /* ═══ Derived values ═══ */
  const activeTemplate = TEMPLATES.find(t => t.key === templateType) || TEMPLATES[0];
  const activePresetIndex = selectedPresets[templateType] || 0;
  const activePresetColors = activeTemplate.presets[activePresetIndex];

  /* ═══ Template selection handlers ═══ */
  const handleTemplateSelect = useCallback((key) => {
    setTemplateType(key);
  }, []);

  const handlePresetSelect = useCallback((tplKey, presetIdx) => {
    setSelectedPresets(prev => ({ ...prev, [tplKey]: presetIdx }));
  }, []);

  /* ═══ Place selection handler ═══ */
  const handlePlaceSelect = useCallback((place) => {
    setLocationAddress(place.address);
    if (place.name) setLocationName(place.name);
    setLocationLat(place.lat);
    setLocationLng(place.lng);
    setLocationPlaceId(place.placeId);
  }, []);

  /* ═══ Distribution method toggle ═══ */
  const handleMethodToggle = useCallback((method) => {
    if (method === 'link') return; // link is always on
    setDistributionMethods(prev => ({ ...prev, [method]: !prev[method] }));
  }, []);

  /* ═══ Step validation ═══ */
  const canProceed = useCallback(() => {
    if (step === 0) return !!templateType;
    if (step === 1) {
      return !!(title && slug && eventDate && slugStatus !== 'taken');
    }
    if (step === 2) return true;
    return true;
  }, [step, templateType, title, slug, eventDate, slugStatus]);

  /* ═══ Step navigation ═══ */
  const goNext = useCallback(() => {
    if (!canProceed()) return;
    setDirection(1);
    setStep(prev => Math.min(prev + 1, 2));
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [canProceed]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep(prev => Math.max(prev - 1, 0));
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goToStep = useCallback((targetStep) => {
    if (targetStep < step) {
      setDirection(-1);
      setStep(targetStep);
      setError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  /* ═══ FINAL SUBMISSION ═══ */
  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!title || !slug || !eventDate) {
      setError('Please complete all required fields before creating.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      /* ─── 1. Create the event ─── */
      const payload = {
        slug,
        templateType,
        title,
        description: description || undefined,
        eventDate,
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

      const eventRes = await fetch(`${apiUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const eventData = await eventRes.json();

      if (!eventRes.ok) {
        if (eventData.error === 'SLUG_TAKEN') {
          setSlugStatus('taken');
          setSuggestedSlug(eventData.suggestedSlug || `${slug}-${new Date().getFullYear()}`);
          setDirection(-1);
          setStep(1);
          setError('This event URL is already taken. Please choose a different slug.');
          setSubmitting(false);
          return;
        }
        throw new Error(eventData.message || 'Failed to create event');
      }

      const createdEvent = eventData.event;
      const eventId = createdEvent?.id;

      /* ─── 2. Batch-save custom form fields ─── */
      if (eventId && customFields.length > 0) {
        const fieldPromises = customFields.map((field, idx) =>
          fetch(`${apiUrl}/events/${eventId}/fields`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              fieldKey: field.key,
              fieldLabel: field.label,
              fieldType: field.type,
              options: field.options || [],
              isRequired: field.isRequired,
              sortOrder: idx,
            }),
          }).catch(err => {
            console.error(`Failed to save field "${field.label}":`, err);
            return null;
          })
        );

        await Promise.allSettled(fieldPromises);
      }

      /* ─── 3. Success → redirect to dashboard ─── */
      window.location.href = '/dashboard';

    } catch (err) {
      console.error('Event creation failed:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting, title, slug, eventDate, templateType, description,
    eventEndDate, locationName, locationAddress, locationLat, locationLng,
    locationPlaceId, dressCode, rsvpDeadline, privacyMode, accessPassword,
    coverImageUrl, customColors, templateData, customFields, apiUrl,
  ]);

  /* ═══ Loading state ═══ */
  if (!mounted) {
    return (
      <div style={{
        minHeight: '100vh', background: C.darkBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 40, height: 40,
          border: `3px solid rgba(184,148,79,0.2)`,
          borderTopColor: C.gold,
          borderRadius: '50%',
          animation: 'ce-spin 0.6s linear infinite',
        }} />
        <style jsx>{`@keyframes ce-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ═══ RENDER ═══ */
  return (
    <WizardShell step={step} onStepClick={goToStep}>
      <AnimatePresence mode="wait" custom={direction}>
        {step === 0 && (
          <motion.div
            key="stage1"
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <Stage1_TemplatesSimulator
              templates={TEMPLATES}
              templateType={templateType}
              onTemplateSelect={handleTemplateSelect}
              selectedPresets={selectedPresets}
              onPresetSelect={handlePresetSelect}
              activePresetColors={activePresetColors}
              onNext={goNext}
            />
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="stage2"
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <Stage2_FormConfiguration
              templateType={templateType}
              templates={TEMPLATES}
              title={title} setTitle={setTitle}
              slug={slug} setSlug={setSlug}
              slugStatus={slugStatus}
              suggestedSlug={suggestedSlug}
              description={description} setDescription={setDescription}
              eventDate={eventDate} setEventDate={setEventDate}
              eventEndDate={eventEndDate} setEventEndDate={setEventEndDate}
              locationName={locationName} setLocationName={setLocationName}
              locationAddress={locationAddress} setLocationAddress={setLocationAddress}
              onPlaceSelect={handlePlaceSelect}
              templateData={templateData} setTemplateData={setTemplateData}
              dressCode={dressCode} setDressCode={setDressCode}
              rsvpDeadline={rsvpDeadline} setRsvpDeadline={setRsvpDeadline}
              privacyMode={privacyMode} setPrivacyMode={setPrivacyMode}
              accessPassword={accessPassword} setAccessPassword={setAccessPassword}
              coverImageUrl={coverImageUrl} setCoverImageUrl={setCoverImageUrl}
              customFields={customFields} onFieldsChange={setCustomFields}
              onNext={goNext} onBack={goBack}
            />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="stage3"
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <Stage3_Distribution
              slug={slug}
              distributionMethods={distributionMethods}
              onMethodToggle={handleMethodToggle}
              smsTemplate={smsTemplate}
              setSmsTemplate={setSmsTemplate}
              onSubmit={handleSubmit}
              onBack={goBack}
              submitting={submitting}
              error={error}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </WizardShell>
  );
}
