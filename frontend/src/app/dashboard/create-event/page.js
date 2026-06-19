'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { supabase } from '../../utils/supabaseClient';
import { startSmsCreditPurchase } from '../../utils/smsPurchase';

/* ═══════════════════════════════════════════════════════
   LAZY-LOADED STAGE COMPONENTS
   ═══════════════════════════════════════════════════════ */
const WizardShell = dynamic(() => import('./components/WizardShell'), { ssr: false });
const Stage1_TemplatesSimulator = dynamic(() => import('./components/Stage1_TemplatesSimulator'), { ssr: false });
const Stage2_FormConfiguration = dynamic(() => import('./components/Stage2_FormConfiguration'), { ssr: false });
const StagePayment = dynamic(() => import('./components/StagePayment'), { ssr: false });
const StageTables = dynamic(() => import('./components/StageTables'), { ssr: false });
const Stage3_Distribution = dynamic(() => import('./components/Stage3_Distribution'), { ssr: false });

/* Wizard step labels (drives the top progress bar) */
const WIZARD_LABELS = ['Templates', 'Configure', 'Payment', 'Tables', 'Distribute'];
const LAST_STEP = 4;

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
/* Three premium, curated templates. The retired categories (corporate,
   birthday, gala) are intentionally absent from the picker — their render
   patterns still live in the guest renderer so existing events keep working. */
const TEMPLATES = [
  {
    key: 'engagement', label: 'Eternal Love', icon: '💎', tier: 'Engagement',
    tagline: 'Romantic · Luxury',
    desc: 'An elegant, romantic invitation with soft gradients, shimmering accents and gentle motion — built to make the moment feel unforgettable.',
    presets: [
      { name: 'Blush Gold', primary: '#D4A574', secondary: '#F5E6D3', accent: '#D4A574', background: '#FFFCF8' },
      { name: 'Champagne Sparkle', primary: '#C5A059', secondary: '#FDF0CD', accent: '#C5A059', background: '#FFFDF5' },
      { name: 'Sage Garden', primary: '#6B8E6B', secondary: '#D5E8D5', accent: '#6B8E6B', background: '#F8FAF8' },
    ],
    specs: ['Animated Rings & Particles', 'Soft Gradient Card', 'Premium Typography', 'Interactive RSVP'],
    fields: ['Partner Names', 'Proposal Story', 'Gift Registry'],
  },
  {
    key: 'wedding', label: 'Royale Wedding', icon: '💍', tier: 'Wedding',
    tagline: 'Cinematic · Gold',
    desc: 'A high-end, cinematic wedding invitation with glassmorphism, elegant gold accents and a dynamic reveal — comparable to premium invitation platforms.',
    presets: [
      { name: 'Royale Gold', primary: '#B8944F', secondary: '#D7BE80', accent: '#B8944F', background: '#FFFDF7' },
      { name: 'Emerald Ivy', primary: '#1B6B3A', secondary: '#A3D5A5', accent: '#1B6B3A', background: '#F5FAF7' },
      { name: 'Burgundy Velvet', primary: '#800020', secondary: '#F2C9D0', accent: '#800020', background: '#FFF8F9' },
    ],
    specs: ['Cinematic Envelope Reveal', 'Modern Glassmorphism', 'Gold Accents', 'RSVP + Meal Selection'],
    fields: ['Partner Names', 'Love Story', 'Ceremony & Reception', 'Gift Registry'],
  },
  {
    key: 'custom', label: 'Custom Canvas', icon: '✨', tier: 'Build your own',
    tagline: 'Fully editable',
    desc: 'Start from a clean slate and design your own page — colors, typography, background, cover image, CTA and sections, all updating live as you build.',
    presets: [
      { name: 'Clean Linen', primary: '#8B7355', secondary: '#D4C5A9', accent: '#8B7355', background: '#FAF8F5' },
      { name: 'Warm Cream', primary: '#A0845C', secondary: '#E8D5B7', accent: '#A0845C', background: '#FFFCF5' },
      { name: 'Obsidian Slate', primary: '#475569', secondary: '#94A3B8', accent: '#475569', background: '#F8FAFC' },
    ],
    specs: ['Editable Colors & Fonts', 'Custom Cover Image', 'Editable CTA', 'Toggle Sections'],
    fields: ['Custom Questionnaire'],
  },
];

/* Defaults for the guided Custom builder (Template #3). */
const DEFAULT_CUSTOM_CONFIG = {
  headingFont: 'serif',          // serif | sans | script
  primary: '#8B7355',
  secondary: '#D4C5A9',
  accent: '#8B7355',
  background: '#FAF8F5',
  headline: 'You’re Invited',
  ctaLabel: 'RSVP Now',
  coverImageUrl: '',
  sections: { details: true, gallery: true, messageHost: true },
};

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

  /* ─── Draft event + payment state ─── */
  const [eventId, setEventId] = useState(null);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [manualMethods, setManualMethods] = useState([]);
  const [selectedTierName, setSelectedTierName] = useState('');
  const [manualRef, setManualRef] = useState('');
  const [payProcessing, setPayProcessing] = useState(false);
  const [payError, setPayError] = useState('');
  /* Post-Stripe redirect handling (card flow) */
  const [paymentConfirmed, setPaymentConfirmed] = useState(false); // verified paid
  const [paymentNotice, setPaymentNotice] = useState('');          // banner text
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  /* ─── Template & Preset State ─── */
  const [templateType, setTemplateType] = useState('engagement');
  const [selectedPresets, setSelectedPresets] = useState({
    engagement: 0, wedding: 0, custom: 0,
  });

  /* ─── Guided Custom builder config (Template #3) ─── */
  const [customConfig, setCustomConfig] = useState(DEFAULT_CUSTOM_CONFIG);

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
  const [coverImageUploading, setCoverImageUploading] = useState(false);
  const [backgroundMusicUrl, setBackgroundMusicUrl] = useState('');
  const [musicUploading, setMusicUploading] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [galleryUploading, setGalleryUploading] = useState(false);

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

  /* ─── SMS credit wallet (distribution step) ─── */
  const [smsCredits, setSmsCredits] = useState(null);
  const [smsCreditsLoading, setSmsCreditsLoading] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [creditError, setCreditError] = useState('');

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

  /* ═══ Resume after returning from Stripe Checkout (card flow) ═══
     The card flow leaves this SPA entirely, so before redirecting we stash a
     small resume payload in sessionStorage. On return Stripe appends
     ?payment=success|cancelled&session_id=…; we rehydrate, jump back to the
     payment step, synchronously verify the session (so success no longer depends
     on the async webhook), then clean the URL. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment !== 'success' && payment !== 'cancelled') return;

    let resume = {};
    try { resume = JSON.parse(sessionStorage.getItem('ce_resume') || '{}'); } catch { resume = {}; }
    sessionStorage.removeItem('ce_resume');

    const resumedEventId = params.get('event') || resume.eventId || null;
    if (resumedEventId) setEventId(resumedEventId);
    if (resume.selectedTierName) setSelectedTierName(resume.selectedTierName);
    if (resume.slug) setSlug(resume.slug);

    // Land back on the Payment step where the user left off.
    setDirection(1);
    setStep(2);

    // Strip the payment params so a refresh doesn't re-run this.
    const clean = `${window.location.pathname}`;
    window.history.replaceState({}, '', clean);

    if (payment === 'cancelled') {
      setPaymentNotice('Payment was cancelled. You can try again or choose another method.');
      return;
    }

    const sessionId = params.get('session_id');
    if (!sessionId) {
      // No session to verify — fall back to a soft success notice; the webhook
      // remains the backstop that flips the event to paid.
      setPaymentNotice('Returned from checkout. If your payment went through, it will be confirmed shortly.');
      return;
    }

    setVerifyingPayment(true);
    setPayProcessing(true);
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/payments/verify?session_id=${encodeURIComponent(sessionId)}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.paid) {
          setPaymentConfirmed(true);
          setPaymentNotice('Payment received — your event is now under review. It goes live to guests once approved; you can keep setting it up in the meantime.');
        } else if (data.success && !data.paid) {
          setPaymentNotice('Payment is still processing. It will be confirmed automatically once it clears.');
        } else {
          setPaymentNotice(data.message || 'We could not confirm the payment yet. It will be confirmed automatically shortly.');
        }
      } catch {
        setPaymentNotice('We could not reach the server to confirm payment. It will be confirmed automatically shortly.');
      } finally {
        setVerifyingPayment(false);
        setPayProcessing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  /* ═══ Fetch platform pricing tiers (for the payment step) ═══ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/payments/pricing-config`, { credentials: 'include' });
        const data = await res.json();
        if (!cancelled && data.success && data.config?.pricing_tiers) {
          setPricingTiers(data.config.pricing_tiers);
          // Don't clobber a tier already restored from a post-Stripe resume.
          if (data.config.pricing_tiers[0]) setSelectedTierName(prev => prev || data.config.pricing_tiers[0].name);
          setManualMethods((data.config.manual_payment_methods || []).filter(m => m && m.is_active !== false));
        }
      } catch { /* non-fatal — payment step shows a skip option */ }
    })();
    return () => { cancelled = true; };
  }, [apiUrl]);

  /* ═══ Sync colors → customColors ═══
     Custom template follows the live builder config; the others follow the
     selected preset swatch. */
  useEffect(() => {
    if (templateType === 'custom') {
      setCustomColors({
        primary: customConfig.primary,
        secondary: customConfig.secondary,
        accent: customConfig.accent || customConfig.primary,
        background: customConfig.background,
      });
      return;
    }
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
  }, [templateType, selectedPresets, customConfig]);

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

  /* ═══ Guided Custom builder updates ═══ */
  const handleCustomConfigChange = useCallback((patch) => {
    setCustomConfig(prev => ({
      ...prev,
      ...patch,
      sections: patch.sections ? { ...prev.sections, ...patch.sections } : prev.sections,
    }));
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

  /* ═══ Cover image upload (Supabase storage, base64 fallback) ═══ */
  const handleCoverImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('File exceeds 8MB. Please use a smaller file or paste an external URL.');
      return;
    }
    setCoverImageUploading(true);
    try {
      if (!supabase) throw new Error('Storage client not configured.');
      const ext = file.name.split('.').pop();
      const filePath = `covers/wizard-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('event-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('event-assets').getPublicUrl(filePath);
      setCoverImageUrl(publicUrl);
    } catch (err) {
      console.error('Cover image upload failed, falling back to inline encoding:', err);
      const reader = new FileReader();
      reader.onload = (ev) => { setCoverImageUrl(ev.target.result); setCoverImageUploading(false); };
      reader.readAsDataURL(file);
      return;
    }
    setCoverImageUploading(false);
  }, []);

  /* ═══ Background music upload (Supabase storage, base64 fallback) ═══ */
  const handleMusicUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('File exceeds 8MB. Please use a smaller file or paste an external URL.');
      return;
    }
    setMusicUploading(true);
    try {
      if (!supabase) throw new Error('Storage client not configured.');
      const ext = file.name.split('.').pop();
      const filePath = `music/wizard-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('event-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('event-assets').getPublicUrl(filePath);
      setBackgroundMusicUrl(publicUrl);
    } catch (err) {
      console.error('Music upload failed, falling back to inline encoding:', err);
      const reader = new FileReader();
      reader.onload = (ev) => { setBackgroundMusicUrl(ev.target.result); setMusicUploading(false); };
      reader.readAsDataURL(file);
      return;
    }
    setMusicUploading(false);
  }, []);

  /* ═══ Gallery image upload (Supabase storage, base64 fallback) ═══ */
  const handleGalleryUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setGalleryUploading(true);
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) {
        alert(`"${file.name}" exceeds 8MB and was skipped.`);
        continue;
      }
      try {
        if (!supabase) throw new Error('Storage client not configured.');
        const ext = file.name.split('.').pop();
        const filePath = `gallery/wizard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('event-assets')
          .upload(filePath, file, { cacheControl: '3600', upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('event-assets').getPublicUrl(filePath);
        setGalleryUrls(prev => [...prev, publicUrl]);
      } catch (err) {
        console.error('Gallery upload failed, falling back to inline encoding:', err);
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => { setGalleryUrls(prev => [...prev, ev.target.result]); resolve(); };
          reader.onerror = resolve;
          reader.readAsDataURL(file);
        });
      }
    }
    setGalleryUploading(false);
  }, []);

  const addGalleryUrl = useCallback((url) => {
    const trimmed = (url || '').trim();
    if (trimmed) setGalleryUrls(prev => [...prev, trimmed]);
  }, []);

  const removeGalleryUrl = useCallback((index) => {
    setGalleryUrls(prev => prev.filter((_, i) => i !== index));
  }, []);

  /* ═══ Step navigation ═══ */
  const goNext = useCallback(() => {
    setDirection(1);
    setStep(prev => Math.min(prev + 1, LAST_STEP));
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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

  /* ═══ Template data, with the Custom builder design folded in ═══ */
  const buildTemplateData = useCallback(() => {
    const merged = templateType === 'custom'
      ? { ...templateData, customDesign: customConfig }
      : templateData;
    return Object.keys(merged).length > 0 ? merged : undefined;
  }, [templateType, templateData, customConfig]);

  /* ═══ Build the create (camelCase) payload from current state ═══ */
  const buildCreatePayload = useCallback(() => ({
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
    galleryUrls: galleryUrls.length > 0 ? galleryUrls : undefined,
    customColors,
    templateData: buildTemplateData(),
    eventType: templateType,
    backgroundMusicUrl: backgroundMusicUrl || '',
  }), [
    slug, templateType, title, description, eventDate, eventEndDate,
    locationName, locationAddress, locationLat, locationLng, locationPlaceId,
    dressCode, rsvpDeadline, privacyMode, accessPassword, coverImageUrl,
    galleryUrls, customColors, buildTemplateData, backgroundMusicUrl,
  ]);

  /* ═══ Create the draft event (first time) or update it (on revisits) ═══ */
  const ensureDraftEvent = useCallback(async () => {
    // Returns the eventId. Creates a draft if none exists yet, otherwise PATCHes it.
    if (!eventId) {
      const res = await fetch(`${apiUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(buildCreatePayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'SLUG_TAKEN') {
          setSlugStatus('taken');
          setSuggestedSlug(data.suggestedSlug || `${slug}-${new Date().getFullYear()}`);
          const e = new Error('This event URL is already taken. Please choose a different slug.');
          e.code = 'SLUG_TAKEN';
          throw e;
        }
        throw new Error(data.message || 'Failed to create event.');
      }
      setEventId(data.event.id);
      return data.event.id;
    }

    // Existing draft → push the latest details (PATCH uses snake_case fields).
    const res = await fetch(`${apiUrl}/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        slug,
        template_type: templateType,
        title,
        description: description || null,
        event_date: eventDate,
        event_end_date: eventEndDate || null,
        location_name: locationName || null,
        location_address: locationAddress || null,
        location_lat: locationLat || null,
        location_lng: locationLng || null,
        location_place_id: locationPlaceId || null,
        dress_code: dressCode || null,
        rsvp_deadline: rsvpDeadline || null,
        privacy_mode: privacyMode,
        access_password: privacyMode === 'password' ? accessPassword : null,
        cover_image_url: coverImageUrl || null,
        gallery_urls: galleryUrls,
        background_music_url: backgroundMusicUrl || null,
        custom_colors: customColors,
        template_data: buildTemplateData() || {},
        event_type: templateType,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error === 'SLUG_TAKEN') {
        setSlugStatus('taken');
        const e = new Error('This event URL is already taken. Please choose a different slug.');
        e.code = 'SLUG_TAKEN';
        throw e;
      }
      throw new Error(data.message || 'Failed to update event.');
    }
    return eventId;
  }, [
    eventId, apiUrl, buildCreatePayload, slug, templateType, title, description,
    eventDate, eventEndDate, locationName, locationAddress, locationLat, locationLng,
    locationPlaceId, dressCode, rsvpDeadline, privacyMode, accessPassword,
    coverImageUrl, galleryUrls, customColors, buildTemplateData, backgroundMusicUrl,
  ]);

  /* ═══ Advance from Configure → create/update draft, then go to Payment ═══ */
  const handleConfigureNext = useCallback(async () => {
    if (submitting) return;
    if (!title || !slug || !eventDate) {
      setError('Please complete the title, URL, and date before continuing.');
      return;
    }
    if (slugStatus === 'taken') {
      setError('Please choose an available event URL.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await ensureDraftEvent();
      goNext();
    } catch (err) {
      if (err.code === 'SLUG_TAKEN') {
        setError('This event URL is already taken. Please choose a different slug.');
      } else {
        setError(err.message || 'Could not save your event. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [submitting, title, slug, eventDate, slugStatus, ensureDraftEvent, goNext]);

  /* ═══ Payment handlers ═══ */
  const handlePayStripe = useCallback(async () => {
    if (!eventId || !selectedTierName) return;
    setPayProcessing(true);
    setPayError('');
    try {
      const res = await fetch(`${apiUrl}/payments/events/${eventId}/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId, tierName: selectedTierName }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) throw new Error(data.message || 'Could not start checkout.');
      // The card flow leaves the SPA — stash just enough to resume the wizard on
      // return (the full event draft already lives server-side from the Configure
      // step). See the resume effect above.
      try {
        sessionStorage.setItem('ce_resume', JSON.stringify({ eventId, selectedTierName, slug }));
      } catch { /* sessionStorage unavailable — resume still works via ?event= */ }
      window.location.href = data.checkoutUrl; // redirect to Stripe
    } catch (err) {
      setPayError(err.message || 'Payment could not be started.');
      setPayProcessing(false);
    }
  }, [apiUrl, eventId, selectedTierName, slug]);

  const handlePayManual = useCallback(async (methodLabel = '', payerReference = '') => {
    if (!eventId || !selectedTierName) return;
    setPayProcessing(true);
    setPayError('');
    try {
      const res = await fetch(`${apiUrl}/payments/events/${eventId}/manual-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tierName: selectedTierName, methodLabel, payerReference }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not record manual payment.');
      setManualRef(data.referenceNumber);
    } catch (err) {
      setPayError(err.message || 'Manual payment could not be recorded.');
    } finally {
      setPayProcessing(false);
    }
  }, [apiUrl, eventId, selectedTierName]);

  /* ═══ SMS credit balance + top-up (distribution step) ═══ */
  const fetchSmsCredits = useCallback(async () => {
    if (!eventId) return;
    setSmsCreditsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/campaigns/history`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setSmsCredits(data.wallet?.credits_remaining ?? 0);
    } catch { /* leave previous value */ }
    finally { setSmsCreditsLoading(false); }
  }, [apiUrl, eventId]);

  // Refresh the balance whenever the user returns to this tab (e.g. after finishing
  // the credit purchase in the Stripe tab we opened) so the count stays live without
  // leaving the wizard. Initial load happens on navigation (goToDistribution).
  useEffect(() => {
    if (step !== LAST_STEP || !eventId) return;
    const onFocus = () => fetchSmsCredits();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [step, eventId, fetchSmsCredits]);

  // Advance from the tables step into distribution and prime the credit balance.
  const goToDistribution = useCallback(() => {
    goNext();
    fetchSmsCredits();
  }, [goNext, fetchSmsCredits]);

  const handleBuyCredits = useCallback(async (creditCount) => {
    if (!eventId || buyingCredits) return;
    setCreditError('');
    setBuyingCredits(true);
    try {
      // Shared with the campaigns page so both top-up entry points behave the same.
      await startSmsCreditPurchase({ apiUrl, eventId, creditCount });
    } catch (err) {
      setCreditError(err.message || 'Credit purchase could not be started.');
    } finally {
      setBuyingCredits(false);
    }
  }, [apiUrl, eventId, buyingCredits]);

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
      /* ─── 1. Ensure the event exists (it normally does from the Configure step) ─── */
      let id = eventId;
      if (!id) {
        try {
          id = await ensureDraftEvent();
        } catch (err) {
          if (err.code === 'SLUG_TAKEN') {
            setDirection(-1);
            setStep(1);
            setError('This event URL is already taken. Please choose a different slug.');
            setSubmitting(false);
            return;
          }
          throw err;
        }
      }

      /* ─── 2. Batch-save custom form fields ─── */
      if (id && customFields.length > 0) {
        const fieldPromises = customFields.map((field, idx) =>
          fetch(`${apiUrl}/events/${id}/fields`, {
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
      console.error('Event finalization failed:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, title, slug, eventDate, eventId, ensureDraftEvent, customFields, apiUrl]);

  /* ═══ Loading state ═══ */
  if (!mounted) {
    return (
      <div style={{
        minHeight: '100vh', background: '#FAF8F5',
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
    <WizardShell step={step} onStepClick={goToStep} labels={WIZARD_LABELS}>
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
              customConfig={customConfig}
              onCustomConfigChange={handleCustomConfigChange}
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
              onCoverImageUpload={handleCoverImageUpload} coverImageUploading={coverImageUploading}
              backgroundMusicUrl={backgroundMusicUrl} setBackgroundMusicUrl={setBackgroundMusicUrl}
              onMusicUpload={handleMusicUpload} musicUploading={musicUploading}
              galleryUrls={galleryUrls} onGalleryUpload={handleGalleryUpload}
              galleryUploading={galleryUploading} onAddGalleryUrl={addGalleryUrl} onRemoveGalleryUrl={removeGalleryUrl}
              customFields={customFields} onFieldsChange={setCustomFields}
              onNext={handleConfigureNext} onBack={goBack}
            />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="stagePayment"
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <StagePayment
              tiers={pricingTiers}
              manualMethods={manualMethods}
              selectedTierName={selectedTierName}
              onSelectTier={setSelectedTierName}
              onPayStripe={handlePayStripe}
              onPayManual={handlePayManual}
              manualRef={manualRef}
              processing={payProcessing}
              error={payError}
              paymentConfirmed={paymentConfirmed}
              paymentNotice={paymentNotice}
              verifying={verifyingPayment}
              onContinue={goNext}
              onBack={goBack}
              onSkip={goNext}
            />
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="stageTables"
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <StageTables
              apiUrl={apiUrl}
              eventId={eventId}
              onContinue={goToDistribution}
              onBack={goBack}
            />
          </motion.div>
        )}

        {step === 4 && (
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
              smsCredits={smsCredits}
              smsCreditsLoading={smsCreditsLoading}
              onRefreshCredits={fetchSmsCredits}
              onBuyCredits={handleBuyCredits}
              buyingCredits={buyingCredits}
              creditError={creditError}
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
