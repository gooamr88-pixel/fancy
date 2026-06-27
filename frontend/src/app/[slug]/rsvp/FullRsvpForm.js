'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '../../utils/translations';
import { normalizeToE164 } from '../../utils/phone';
import { useGuestAnalytics, useRsvpFunnelTracking, useAbandonmentTracking } from '../../utils/useGuestAnalytics';
import { isSeatingRevealed } from '../../utils/seating';
import SeatingMiniMap from './SeatingMiniMap';

/* Component Library Imports */
import {
  FadeInUp,
  StaggerChildren,
  StaggerItem,
  ConfettiExplosion,
  ShimmerPlaceholder,
  GlowPulse,
} from '../../components/guest/GuestAnimations';

import {
  PremiumButton,
  AttendanceCard,
  ProgressBar,
  CalendarButton,
  ShareButton,
  PartySizeStepper,
  FormField,
  inputFocus,
  inputBlur,
} from '../../components/guest/GuestUI';

import GuestPassCard from '../../components/guest/GuestPassGenerator';

/* ═══ Brand Inline Style Helpers ═══ */
const S = {
  inputBase: {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px',
    background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '12px',
    fontSize: '14px', color: '#191B1E', outline: 'none',
    fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
  },
  labelBase: {
    fontSize: '12px', fontWeight: 600, color: '#77736A',
    display: 'block', marginBottom: '6px', fontFamily: 'var(--font-sans)',
  },
  goldBtn: (disabled) => ({
    padding: '12px 28px', background: disabled ? '#D7BE80' : '#B8944F',
    color: '#FFFFFF', border: 'none', borderRadius: '10px', fontWeight: 700,
    fontSize: '14px', cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'var(--font-sans)', opacity: disabled ? 0.6 : 1,
    transition: 'all 0.3s ease', letterSpacing: '0.03em',
  }),
  backBtn: {
    background: 'none', border: 'none', fontSize: '13px', color: '#77736A',
    cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: '4px 0',
  },
};

/* ═══ Step slide animation variants ═══ */
const stepVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

const stepTransition = { duration: 0.4, ease: [0.4, 0, 0.2, 1] };

/* ═══ Main RSVP Content Component ═══ */
export default function FullRsvpForm({ event, guest, context, submit: doSubmit, rememberGuest }) {
  const slug = context?.slug || event?.slug;
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang') || 'en';

  const [lang, setLang] = useState(langParam);

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [guestName, setGuestName] = useState('');
  const [attending, setAttending] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [additionalGuests, setAdditionalGuests] = useState([]);

  const [customAnswers, setCustomAnswers] = useState({});
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [rsvpId, setRsvpId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [assignedTableName, setAssignedTableName] = useState(null);
  const [primaryMeal, setPrimaryMeal] = useState('');


  /* Maybe flow state */
  const [maybeFollowUp, setMaybeFollowUp] = useState(null);

  /* Decline flow state */
  const [declineReason, setDeclineReason] = useState(null);

  /* "Find my table" lookup (for guests who already RSVP'd) */
  const [tableQuery, setTableQuery] = useState('');
  const [tableResults, setTableResults] = useState([]);
  const [tableLookingUp, setTableLookingUp] = useState(false);
  const [tableLookupDone, setTableLookupDone] = useState(false);
  const [showTableLookup, setShowTableLookup] = useState(false);

  /* Personal seating map (table + own party, never other guests) */
  const [seatingView, setSeatingView] = useState(null);
  const [seatingLoading, setSeatingLoading] = useState(false);

  // Entry-context params (?g / ?rsvp_id) and the device-remembered id are now
  // resolved by the <RsvpExperience> engine, which passes the resolved guest in
  // as a prop — this form no longer reads them directly.

  /* ═══ Analytics ═══ */
  const { trackEvent } = useGuestAnalytics(slug);
  useRsvpFunnelTracking(slug, step);
  useAbandonmentTracking(slug, step, submitResult === 'SUCCESS');

  useEffect(() => { trackEvent('rsvp_started'); }, [trackEvent]);

  // When the form is pre-filled programmatically (from an invitation token), we must
  // NOT let the name-change reset below wipe the resolved rsvpId — otherwise the
  // submission would create a duplicate record instead of updating the invited guest.
  const skipNameResetRef = useRef(false);

  useEffect(() => {
    if (skipNameResetRef.current) { skipNameResetRef.current = false; return; }
    setSearchPerformed(false); setSearchResults([]); setRsvpId(null);
  }, [guestName]);

  /* ═══ Navigators with direction tracking ═══ */
  const goToStep = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  /* ═══ Search Handlers ═══ */
  const handleSearchName = async () => {
    if (!guestName.trim()) return;
    setSearching(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/events/${slug}/rsvp/search?query=${encodeURIComponent(guestName.trim())}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) { console.error(err); setSearchResults([]); }
    finally { setSearching(false); setSearchPerformed(true); }
  };

  const handleTableLookup = async () => {
    if (!tableQuery.trim()) return;
    setTableLookingUp(true);
    setTableLookupDone(false);
    setSeatingView(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/events/${slug}/seating/search?query=${encodeURIComponent(tableQuery.trim())}`);
      const data = await res.json();
      setTableResults(data.results || []);
    } catch (err) {
      console.error('Table lookup failed:', err);
      setTableResults([]);
    } finally {
      setTableLookingUp(false);
      setTableLookupDone(true);
    }
  };

  const fetchSeatingMap = async (gid) => {
    if (!gid) return;
    setSeatingLoading(true);
    setSeatingView(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/events/${slug}/seating/guest/${gid}`);
      const data = await res.json();
      if (data.success) {
        setSeatingView({
          myTableName: data.myTableName, myTableId: data.myTableId,
          party: data.party || [], tables: data.tables || [],
        });
      }
    } catch (err) {
      console.error('Seating map fetch failed:', err);
    } finally {
      setSeatingLoading(false);
    }
  };

  const [prevLangParam, setPrevLangParam] = useState(langParam);
  if (langParam !== prevLangParam) { setPrevLangParam(langParam); setLang(langParam); }

  /* ═══ Prefill from the engine-resolved guest ═══
     The unified <RsvpExperience> engine resolves the event + this guest (via token,
     ?g=, ?rsvp_id, or a remembered id) and renders this form only in the 'ready'
     phase. We pre-fill the known fields once. A responded guest reaches here only in
     edit mode (host allowed edits), so we also seed their previous response and skip
     the name-search step. Resolution / lock / status now live in the engine. */
  useEffect(() => {
    if (!guest) return;
    skipNameResetRef.current = true;
    if (guest.id) setRsvpId(guest.id);
    if (guest.guest_name) setGuestName(guest.guest_name);
    if (guest.email) setEmail(guest.email);
    if (guest.phone) setPhone(guest.phone);
    if (guest.party_size) setPartySize(guest.party_size);
    if (guest.notes) setNotes(guest.notes);
    if (['yes', 'no', 'maybe'].includes(guest.response)) setAttending(guest.response);
    setStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══ Document title ═══ */
  useEffect(() => {
    if (event) {
      document.title = `RSVP - ${event.title} | Fancy RSVP`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) { metaDesc.setAttribute('content', event.description || `RSVP to ${event.title}`); }
      else {
        const meta = document.createElement('meta');
        meta.name = 'description';
        meta.content = event.description || `RSVP to ${event.title}`;
        document.head.appendChild(meta);
      }
    }
  }, [event]);


  /* ═══ Lightweight table fetch (post-submit success screen) ═══
     Unlike fetchGuestStatus this never locks the view — it only fills in the
     table name (if seating has been revealed) for the celebratory pass card. */
  const fetchAssignedTable = async (id) => {
    if (!id) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/rsvp/guest/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.guest?.table_name) setAssignedTableName(data.guest.table_name);
    } catch (err) {
      console.error('Table fetch failed:', err);
    }
  };


  /* ═══ Dynamic Font Loader ═══ */
  useEffect(() => {
    if (!event) return;
    const titleFont = event.custom_fonts?.card_title;
    const bodyFont = event.custom_fonts?.card_body;
    const fontsToLoad = [];
    if (titleFont && titleFont !== 'Playfair Display') fontsToLoad.push(titleFont.replace(/ /g, '+'));
    if (bodyFont && bodyFont !== 'Montserrat') fontsToLoad.push(bodyFont.replace(/ /g, '+'));
    if (fontsToLoad.length > 0) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontsToLoad.join('&family=')}&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      return () => {
        if (document.head.contains(link)) document.head.removeChild(link);
      };
    }
  }, [event]);

  /* ═══ Sync additional guests with party size ═══ */
  useEffect(() => {
    const size = parseInt(partySize) || 1;
    if (size <= 1) { setAdditionalGuests([]); return; }
    const diff = size - 1;
    setAdditionalGuests(prev => {
      const copy = [...prev];
      if (copy.length < diff) {
        while (copy.length < diff)
          copy.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, fullName: '', mealSelection: '', dietaryNotes: '' });
      } else if (copy.length > diff) { copy.splice(diff); }
      return copy;
    });
  }, [partySize]);

  const themeColor = '#B8944F';
  const isRTL = lang === 'ar';
  const t = translations[lang];

  // A11Y-3: keep the document's language/direction in sync with the guest's choice
  // so screen readers announce content in the right language and RTL is correct.
  useEffect(() => {
    const rtl = lang === 'ar';
    document.documentElement.lang = rtl ? 'ar' : 'en';
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [lang]);
  const localizedTitle = isRTL && event.title_ar ? event.title_ar : event.title;
  const isContinueDisabled = partySize > 1 && additionalGuests.some(g => !g.fullName || !g.fullName.trim());
  const coverImage = event.cover_image_url;
  // The seating chart (table search + personal map) is hidden until 24h before the event.
  const seatingRevealed = isSeatingRevealed(event.event_date);

  // All custom form fields (including meal) are shown in step 4 as custom questions.
  // Meal is no longer hardcoded in step 3 — it only appears if the organizer configured it.
  const MEAL_FIELD_KEYS = ['meal_selection', 'meal', 'meal_choice', 'meal_preference', 'meal_option'];
  const mealField = (event.rsvp_form_fields || []).find(
    f => MEAL_FIELD_KEYS.includes((f.field_key || '').toLowerCase()) && ['select', 'radio'].includes(f.field_type)
  );
  const customQuestionFields = event.rsvp_form_fields || [];

  const setAnswer = (fieldId, value) => {
    setCustomAnswers(prev => ({ ...prev, [fieldId]: value }));
    setValidationErrors(prev => { const n = { ...prev }; delete n[`field_${fieldId}`]; return n; });
  };
  const toggleMultiAnswer = (fieldId, opt) => {
    setCustomAnswers(prev => {
      const cur = (prev[fieldId] || '').split(',').map(s => s.trim()).filter(Boolean);
      const idx = cur.indexOf(opt);
      if (idx >= 0) cur.splice(idx, 1); else cur.push(opt);
      return { ...prev, [fieldId]: cur.join(', ') };
    });
    setValidationErrors(prev => { const n = { ...prev }; delete n[`field_${fieldId}`]; return n; });
  };

  /* ═══ Compute total steps and current progress ═══ */
  const computeTotalSteps = () => {
    if (attending === 'yes') return 5;     // 1-Name, 2-Attend, 3-Details, 4-Questions, 5-Success
    if (attending === 'maybe') return 5;   // 1-Name, 2-Attend, 3B-MaybeFlow, 4-Questions, 5-Success
    if (attending === 'no') return 5;      // 1-Name, 2-Attend, 3C-DeclineFlow, 4-Questions, 5-Success
    return 5;
  };

  const computeCurrentProgress = () => {
    if (step <= 2) return step;
    // Steps 3/3B/3C all count as step 3
    if (step === 3 || step === 35 || step === 36) return 3;
    if (step === 4) return 4;
    if (step === 5) return 5;
    return step;
  };

  const totalSteps = computeTotalSteps();
  const currentProgress = computeCurrentProgress();

  /* ═══ Submit Handler — delegates to the engine's idempotent submit ═══
     Validation stays local; idempotency, lost-response reconciliation, the
     DUPLICATE_RSVP -> lock transition and the CLOSED / GUEST_LIMIT toasts are all
     owned by the engine. We react only to a clean success here. */
  const handleSubmit = async () => {
    const errors = {};
    if (!guestName.trim()) errors.guestName = 'Name is required';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email format';
    // Phone is required so the host can reach the guest by SMS; normalize to E.164.
    const normalizedPhone = normalizeToE164(phone);
    if (!normalizedPhone) errors.phone = phone.trim() ? (t.phone_invalid || 'Enter a valid phone number') : (t.phone_required || 'Phone number is required');
    if (partySize < 1 || partySize > 20) errors.partySize = 'Party size must be between 1 and 20';
    if (attending === 'yes') {
      const requiredFields = customQuestionFields.filter(f => f.is_required);
      requiredFields.forEach(field => {
        if (!customAnswers[field.id] || !customAnswers[field.id].toString().trim()) {
          errors[`field_${field.id}`] = `${field.field_label} is required`;
        }
      });
    }
    if (Object.keys(errors).length > 0) { setValidationErrors(errors); return; }
    setValidationErrors({});
    setSubmitting(true);

    let enrichedNotes = notes;
    if (attending === 'maybe' && maybeFollowUp) enrichedNotes = `[Follow-up: ${maybeFollowUp}] ${enrichedNotes}`.trim();
    if (attending === 'no' && declineReason) enrichedNotes = `[Decline reason: ${declineReason}] ${enrichedNotes}`.trim();

    const body = {
      rsvpId, guestName, email, phone: normalizedPhone, response: attending,
      partySize: attending === 'yes' ? partySize : 1,
      notes: enrichedNotes, primaryGuestMeal: primaryMeal,
      additionalGuests: attending === 'yes' ? additionalGuests : [],
      customAnswers: Object.keys(customAnswers).map(fieldId => ({ fieldId, value: customAnswers[fieldId] })),
      decline_reason: attending === 'no' ? declineReason : undefined,
      maybe_confirm_by: attending === 'maybe' ? maybeFollowUp : undefined,
    };

    const r = await doSubmit({ url: `/public/events/${slug}/rsvp`, body, reconcileId: rsvpId });
    setSubmitting(false);
    if (r.ok) {
      const resolvedId = r.data?.rsvpId || rsvpId;
      if (resolvedId) {
        setRsvpId(resolvedId);
        rememberGuest(slug, resolvedId);
        if (attending === 'yes') fetchAssignedTable(resolvedId);
      }
      setSubmitResult('SUCCESS');
      goToStep(5);
    }
    // r.reason === 'LOCKED' -> engine has already swapped to the locked card.
  };

  /* ═══ Render ═══ */
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      minHeight: '100vh', background: '#F8F4EC',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{
          maxWidth: '540px', width: '100%', background: '#FFFFFF',
          border: '1px solid #E8E2D6', borderRadius: '20px', overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
        }}
      >
        {/* ═══ Card Header with Cover Image ═══ */}
        <div style={{
          background: coverImage
            ? `linear-gradient(180deg, rgba(25,27,30,0.3) 0%, rgba(25,27,30,0.85) 100%), url(${coverImage}) center/cover`
            : 'linear-gradient(135deg, #191B1E 0%, #2a2d32 100%)',
          color: '#FFFFFF', padding: '36px 32px', textAlign: 'center', position: 'relative',
          minHeight: coverImage ? '160px' : 'auto',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        }}>
          {/* Language Toggle */}
          <div style={{ position: 'absolute', top: '14px', ...(isRTL ? { left: '14px' } : { right: '14px' }), display: 'flex', gap: '6px', zIndex: 2 }}>
            {[{ code: 'en', label: 'EN' }, { code: 'ar', label: 'عربي' }].map(l => (
              <motion.button
                key={l.code}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLang(l.code)}
                style={{
                  fontSize: '10px', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer',
                  border: lang === l.code ? '1px solid #B8944F' : '1px solid rgba(255,255,255,0.2)',
                  background: lang === l.code ? '#B8944F' : 'rgba(255,255,255,0.08)',
                  color: lang === l.code ? '#191B1E' : 'rgba(255,255,255,0.7)',
                  fontWeight: lang === l.code ? 700 : 400, fontFamily: 'var(--font-sans)',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.2s',
                }}
              >{l.label}</motion.button>
            ))}
          </div>

          <motion.span
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              fontSize: '10px', textTransform: 'uppercase', letterSpacing: '4px',
              color: '#D7BE80', fontWeight: 700, display: 'block', marginBottom: '10px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {t.rsvp_portal}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            style={{
              fontFamily: event?.custom_fonts?.card_title || 'var(--font-serif)',
              fontSize: '22px', fontWeight: 400, letterSpacing: '0.5px', lineHeight: 1.3,
            }}
          >
            {localizedTitle}
          </motion.h1>
        </div>

        {/* ═══ Card Body ═══ */}
        <div style={{ padding: '28px 32px 32px' }}>
          {/* Animated Progress Bar */}
          {step < 5 && (
            <ProgressBar currentStep={currentProgress} totalSteps={totalSteps} color={themeColor} />
          )}

          {/* ═══ Step Transitions ═══ */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
            >

              {/* ════════════════════════════════════════
                  STEP 1: Name Search (Enhanced)
                  ════════════════════════════════════════ */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Personalized greeting */}
                  <FadeInUp delay={0.1} y={20}>
                    <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>💌</span>
                      <h3 style={{
                        fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 500,
                        color: '#191B1E', lineHeight: 1.5,
                      }}>
                        {isRTL ? 'يسعدنا دعوتك للاحتفال معنا' : 'We would be honored by your presence'}
                      </h3>
                      <p style={{ fontSize: '13px', color: '#77736A', marginTop: '4px', lineHeight: 1.6 }}>
                        {isRTL ? 'ابحث عن اسمك في قائمة الضيوف أو سجّل كضيف جديد' : 'Find your name on the guest list or register as a new guest'}
                      </p>
                    </div>
                  </FadeInUp>

                  <FormField
                    label={t.enter_name}
                    error={validationErrors.guestName}
                  >
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={guestName}
                        onChange={e => {
                          setGuestName(e.target.value);
                          setValidationErrors(prev => { const n = { ...prev }; delete n.guestName; return n; });
                        }}
                        placeholder={t.name_placeholder}
                        disabled={searching}
                        style={{
                          ...S.inputBase, flex: 1,
                          ...(validationErrors.guestName ? { borderColor: '#ef4444' } : {}),
                        }}
                        onFocus={e => inputFocus(e)}
                        onBlur={e => inputBlur(e, !!validationErrors.guestName)}
                        onKeyDown={e => { if (e.key === 'Enter' && !searchPerformed) handleSearchName(); }}
                      />
                      {!searchPerformed && (
                        <PremiumButton
                          testId="rsvp-search"
                          disabled={!guestName.trim() || searching}
                          onClick={handleSearchName}
                          loading={searching}
                          size="md"
                        >
                          {isRTL ? 'بحث' : 'Search'}
                        </PremiumButton>
                      )}
                    </div>
                  </FormField>

                  {/* Shimmer Loading State */}
                  {searching && (
                    <FadeInUp y={10}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
                        <ShimmerPlaceholder height="56px" borderRadius="12px" />
                        <ShimmerPlaceholder height="56px" borderRadius="12px" />
                        <p style={{ color: '#77736A', fontSize: '13px', textAlign: 'center' }}>
                          {isRTL ? 'جاري البحث عن دعوتك...' : 'Searching for your invitation...'}
                        </p>
                      </div>
                    </FadeInUp>
                  )}

                  {/* Search Results */}
                  {searchPerformed && !searching && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4 }}
                      style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}
                    >
                      {searchResults.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <p style={{ fontSize: '13px', color: '#77736A', fontWeight: 500 }}>
                            {isRTL ? 'لقد وجدنا دعوتك! يرجى اختيار اسمك لتأكيد الحضور:' : 'We found your invitation! Please select your name below:'}
                          </p>
                          <StaggerChildren staggerDelay={0.08}>
                            {searchResults.map(result => (
                              <StaggerItem key={result.id}>
                                <motion.button
                                  whileHover={{ scale: 1.01, borderColor: '#B8944F' }}
                                  whileTap={{ scale: 0.99 }}
                                  onClick={() => {
                                    setRsvpId(result.id);
                                    setGuestName(result.guestName);
                                    if (result.email) setEmail(result.email);
                                    if (result.phone) setPhone(result.phone);
                                    if (result.partySize) setPartySize(result.partySize);
                                    goToStep(2);
                                  }}
                                  style={{
                                    width: '100%', textAlign: isRTL ? 'right' : 'left',
                                    padding: '16px', border: '1px solid #E8E2D6', borderRadius: '14px',
                                    background: '#FFFFFF', cursor: 'pointer',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                                  }}
                                >
                                  <div>
                                    <span style={{ fontWeight: 600, color: '#191B1E', display: 'block', fontSize: '14px' }}>
                                      {result.guestName}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#A09A91' }}>
                                      {result.email || (isRTL ? 'لا يوجد بريد مسجل' : 'No email registered')}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '11px', fontWeight: 700, padding: '4px 12px',
                                    background: '#F8F4EC', borderRadius: '8px', color: '#77736A',
                                  }}>
                                    {isRTL ? `مرافقين: ${result.partySize}` : `Party: ${result.partySize}`}
                                  </span>
                                </motion.button>
                              </StaggerItem>
                            ))}
                          </StaggerChildren>
                          <button
                            onClick={() => { setRsvpId(null); goToStep(2); }}
                            style={{
                              fontSize: '13px', color: '#B8944F', fontWeight: 600, background: 'none',
                              border: 'none', cursor: 'pointer', textAlign: 'center', textDecoration: 'underline',
                              fontFamily: 'var(--font-sans)', padding: '4px',
                            }}
                          >
                            {isRTL ? 'اسمي ليس في القائمة (المتابعة كضيف جديد)' : "My name isn't listed (Continue as a new guest)"}
                          </button>
                        </div>
                      ) : (
                        <FadeInUp y={10}>
                          <div style={{
                            fontSize: '13px', color: '#77736A',
                            background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.2)',
                            padding: '16px', borderRadius: '12px',
                          }}>
                            ⚠️ {isRTL
                              ? `لم نجد اسماً مطابقاً لـ "${guestName}" في قائمة المدعوين. لا تقلق، يمكنك الاستمرار والتسجيل كضيف جديد.`
                              : `We couldn't find an invitation matching "${guestName}". No worries, you can still RSVP as a new guest.`}
                          </div>
                          <PremiumButton testId="rsvp-continue-new" fullWidth onClick={() => { setRsvpId(null); goToStep(2); }} style={{ marginTop: '12px' }}>
                            {isRTL ? 'المتابعة كضيف جديد' : 'Continue as a New Guest'}
                          </PremiumButton>
                        </FadeInUp>
                      )}
                    </motion.div>
                  )}

                  {/* Find my table */}
                  <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                    {!showTableLookup ? (
                      <button onClick={() => setShowTableLookup(true)} style={{ ...S.backBtn, color: '#B8944F', fontWeight: 600 }}>
                        {isRTL ? 'هل سجّلت بالفعل؟ ابحث عن طاولتك' : "Already RSVP'd? Find your table"}
                      </button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.3 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                      >
                        <label style={S.labelBase}>{isRTL ? 'ابحث باسمك لعرض طاولتك' : 'Search your name to see your table'}</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text" value={tableQuery}
                            onChange={e => setTableQuery(e.target.value)}
                            placeholder={t.name_placeholder}
                            style={{ ...S.inputBase, flex: 1 }}
                            onFocus={e => inputFocus(e)} onBlur={e => inputBlur(e)}
                            onKeyDown={e => { if (e.key === 'Enter') handleTableLookup(); }}
                          />
                          <PremiumButton
                            disabled={!tableQuery.trim() || tableLookingUp}
                            onClick={handleTableLookup}
                            loading={tableLookingUp}
                            size="md"
                          >
                            {isRTL ? 'بحث' : 'Find'}
                          </PremiumButton>
                        </div>
                        {seatingView ? (
                          <SeatingResultPanel view={seatingView} loading={seatingLoading} isRTL={isRTL} onBack={() => setSeatingView(null)} />
                        ) : seatingLoading ? (
                          <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ width: '28px', height: '28px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                            <p style={{ color: '#77736A', fontSize: '12px' }}>{isRTL ? 'جاري تحميل خريطة جلوسك...' : 'Loading your seating map...'}</p>
                          </div>
                        ) : tableLookupDone && (
                          tableResults.length > 0 ? (
                            <StaggerChildren staggerDelay={0.06}>
                              {tableResults.map((r, i) => {
                                const assigned = r.tableName && r.tableName !== 'Unassigned';
                                const clickable = assigned && r.id;
                                return (
                                  <StaggerItem key={r.id || i}>
                                    <motion.button
                                      whileHover={clickable ? { scale: 1.01, borderColor: '#B8944F' } : {}}
                                      disabled={!clickable}
                                      onClick={() => clickable && fetchSeatingMap(r.id)}
                                      style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        gap: '8px', padding: '14px 16px', border: '1px solid #E8E2D6',
                                        borderRadius: '12px', background: '#FFFFFF', width: '100%',
                                        cursor: clickable ? 'pointer' : 'default',
                                        fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left',
                                        transition: 'border-color 0.2s',
                                      }}
                                    >
                                      <span style={{ fontWeight: 600, color: '#191B1E', fontSize: '14px' }}>{r.guestName}</span>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                          fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '8px',
                                          background: assigned ? 'rgba(184,148,79,0.12)' : '#F8F4EC',
                                          color: assigned ? '#B8944F' : '#A09A91',
                                        }}>
                                          {assigned ? r.tableName : (isRTL ? 'لم تُخصّص بعد' : 'Not assigned yet')}
                                        </span>
                                        {clickable && (
                                          <span style={{ fontSize: '11px', color: '#B8944F', fontWeight: 700 }}>
                                            {isRTL ? 'عرض الخريطة ←' : 'View map →'}
                                          </span>
                                        )}
                                      </span>
                                    </motion.button>
                                  </StaggerItem>
                                );
                              })}
                            </StaggerChildren>
                          ) : (
                            <p style={{ fontSize: '13px', color: '#77736A' }}>
                              {isRTL ? 'لم نعثر على حجز مطابق. تأكد من اسمك أو سجّل أعلاه.' : "No matching reservation found. Check your name or RSVP above."}
                            </p>
                          )
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════
                  STEP 2: Attendance (3 Options)
                  ════════════════════════════════════════ */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <FadeInUp y={15}>
                    <h3 style={{
                      fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500,
                      color: '#191B1E', textAlign: 'center', lineHeight: 1.4,
                    }}>
                      {t.attending_q.replace('{name}', guestName)}
                    </h3>
                  </FadeInUp>

                  <StaggerChildren staggerDelay={0.1}>
                    {['yes', 'maybe', 'no'].map(type => (
                      <StaggerItem key={type}>
                        <AttendanceCard
                          type={type}
                          selected={attending}
                          onClick={(val) => {
                            setAttending(val);
                            setTimeout(() => {
                              if (val === 'yes') goToStep(3);
                              else if (val === 'maybe') goToStep(35);
                              else goToStep(36);
                            }, 400);
                          }}
                          isRTL={isRTL}
                        />
                      </StaggerItem>
                    ))}
                  </StaggerChildren>

                  <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                    <button onClick={() => goToStep(1)} style={S.backBtn}>
                      {isRTL ? '← السابق' : '← Back'}
                    </button>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════
                  STEP 3: Party Details (Attending YES)
                  ════════════════════════════════════════ */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <FadeInUp y={15}>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E' }}>
                      {t.party_details}
                    </h3>
                  </FadeInUp>

                  {/* Party Size Stepper */}
                  <FadeInUp delay={0.1} y={15}>
                    <PartySizeStepper
                      value={partySize}
                      onChange={setPartySize}
                      label={t.party_size_label}
                      isRTL={isRTL}
                    />
                  </FadeInUp>

                  {/* Primary Meal Selection — only shown if the organizer configured a meal field */}
                  {mealField && mealField.options && mealField.options.length > 0 && (
                  <FadeInUp delay={0.2} y={15}>
                    <div style={{ background: '#F8F4EC', padding: '20px', borderRadius: '14px' }}>
                      <FormField label={(isRTL && mealField.field_label_ar ? mealField.field_label_ar : mealField.field_label) || t.meal_label.replace('{name}', guestName)}>
                        <select
                          value={primaryMeal}
                          onChange={e => setPrimaryMeal(e.target.value)}
                          style={{ ...S.inputBase, cursor: 'pointer' }}
                        >
                          <option value="">{t.meal_select_placeholder}</option>
                          {(isRTL && mealField.options_ar ? mealField.options_ar : mealField.options).map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                  </FadeInUp>
                  )}

                  {/* Additional Guest Cards */}
                  <AnimatePresence>
                    {additionalGuests.map((g, index) => (
                      <motion.div
                        key={g.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.35, delay: index * 0.08 }}
                        style={{
                          padding: '20px', border: '1px solid #E8E2D6', borderRadius: '14px',
                          background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '12px',
                        }}
                      >
                        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#B8944F', fontWeight: 700 }}>
                          {t.guest_label.replace('{index}', index + 2)}
                        </h4>
                        <FormField label={t.guest_name_label}>
                          <input
                            type="text" value={g.fullName}
                            onChange={e => { const copy = [...additionalGuests]; copy[index].fullName = e.target.value; setAdditionalGuests(copy); }}
                            placeholder={t.name_placeholder}
                            style={S.inputBase}
                            onFocus={e => inputFocus(e)} onBlur={e => inputBlur(e)}
                          />
                        </FormField>
                        {mealField && mealField.options && mealField.options.length > 0 && (
                        <FormField label={(isRTL && mealField.field_label_ar ? mealField.field_label_ar : mealField.field_label) || t.guest_meal_label}>
                          <select
                            value={g.mealSelection}
                            onChange={e => { const copy = [...additionalGuests]; copy[index].mealSelection = e.target.value; setAdditionalGuests(copy); }}
                            style={{ ...S.inputBase, cursor: 'pointer' }}
                          >
                            <option value="">{t.meal_select_placeholder}</option>
                            {(isRTL && mealField.options_ar ? mealField.options_ar : mealField.options).map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </FormField>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Contact Info */}
                  <FadeInUp delay={0.15} y={15}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                      <FormField label={t.email_label} error={validationErrors.email}>
                        <input
                          type="email" value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="name@email.com"
                          style={S.inputBase}
                          onFocus={e => inputFocus(e)} onBlur={e => inputBlur(e, !!validationErrors.email)}
                        />
                      </FormField>
                      <FormField label={t.phone_label} error={validationErrors.phone}>
                        <input
                          type="tel" value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          style={S.inputBase}
                          onFocus={e => inputFocus(e)} onBlur={e => inputBlur(e, !!validationErrors.phone)}
                        />
                      </FormField>
                    </div>
                  </FadeInUp>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                    <button onClick={() => goToStep(2)} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>
                    <PremiumButton testId="rsvp-next" disabled={isContinueDisabled} onClick={() => goToStep(4)}>
                      {t.continue}
                    </PremiumButton>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════
                  STEP 3B: Maybe Flow
                  ════════════════════════════════════════ */}
              {step === 35 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <FadeInUp y={15}>
                    <div style={{ textAlign: 'center' }}>
                      <motion.span
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}
                      >
                        🤔
                      </motion.span>
                      <h3 style={{
                        fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500,
                        color: '#191B1E', lineHeight: 1.4,
                      }}>
                        {isRTL ? 'متى يمكننا توقع تأكيدك؟' : 'When can we expect your confirmation?'}
                      </h3>
                      <p style={{ fontSize: '13px', color: '#77736A', marginTop: '6px' }}>
                        {isRTL ? 'حتى نتمكن من المتابعة معك' : "So we can follow up with you at the right time"}
                      </p>
                    </div>
                  </FadeInUp>

                  <StaggerChildren staggerDelay={0.1}>
                    {[
                      { value: '24 Hours', icon: '⚡', label: isRTL ? 'خلال ٢٤ ساعة' : 'Within 24 Hours', subtitle: isRTL ? 'سأعلمكم قريباً جداً' : "I'll know very soon" },
                      { value: '3 Days', icon: '📅', label: isRTL ? 'خلال ٣ أيام' : 'Within 3 Days', subtitle: isRTL ? 'أحتاج وقت قصير للتأكد' : 'I need a short while to confirm' },
                      { value: '1 Week', icon: '🗓️', label: isRTL ? 'خلال أسبوع' : 'Within 1 Week', subtitle: isRTL ? 'أنتظر ترتيب بعض الأمور' : "I'm working out some details" },
                    ].map(opt => (
                      <StaggerItem key={opt.value}>
                        <motion.button
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setMaybeFollowUp(opt.value)}
                          animate={maybeFollowUp === opt.value ? {
                            borderColor: '#6366f1',
                            boxShadow: '0 0 25px rgba(99,102,241,0.15)',
                          } : {
                            borderColor: '#E8E2D6',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          }}
                          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                          style={{
                            width: '100%', padding: '20px',
                            border: `2px solid ${maybeFollowUp === opt.value ? '#6366f1' : '#E8E2D6'}`,
                            borderRadius: '14px', cursor: 'pointer',
                            background: maybeFollowUp === opt.value ? 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(99,102,241,0.02))' : '#FFFFFF',
                            fontFamily: 'var(--font-sans)',
                            display: 'flex', alignItems: 'center', gap: '16px',
                            textAlign: isRTL ? 'right' : 'left',
                          }}
                        >
                          <span style={{ fontSize: '28px', flexShrink: 0 }}>{opt.icon}</span>
                          <div>
                            <span style={{
                              fontWeight: 700, fontSize: '14px', display: 'block',
                              color: maybeFollowUp === opt.value ? '#6366f1' : '#191B1E',
                            }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: '12px', color: '#77736A', marginTop: '2px', display: 'block' }}>
                              {opt.subtitle}
                            </span>
                          </div>
                          {maybeFollowUp === opt.value && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                              style={{
                                marginLeft: 'auto', width: '24px', height: '24px', borderRadius: '50%',
                                background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </motion.div>
                          )}
                        </motion.button>
                      </StaggerItem>
                    ))}
                  </StaggerChildren>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                    <button onClick={() => goToStep(2)} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>
                    <PremiumButton disabled={!maybeFollowUp} onClick={() => goToStep(4)}>
                      {t.continue}
                    </PremiumButton>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════
                  STEP 3C: Decline Flow
                  ════════════════════════════════════════ */}
              {step === 36 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <FadeInUp y={15}>
                    <div style={{ textAlign: 'center' }}>
                      <motion.span
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                        style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}
                      >
                        💌
                      </motion.span>
                      <h3 style={{
                        fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500,
                        color: '#191B1E', lineHeight: 1.4,
                      }}>
                        {isRTL ? 'نتفهم ذلك ونتمنى لك كل الخير' : 'We understand and wish you well'}
                      </h3>
                      <p style={{ fontSize: '13px', color: '#77736A', marginTop: '6px', lineHeight: 1.6 }}>
                        {isRTL ? 'لو تكرمت بإخبارنا بالسبب (اختياري)' : 'Would you mind sharing the reason? (optional)'}
                      </p>
                    </div>
                  </FadeInUp>

                  <StaggerChildren staggerDelay={0.08}>
                    {[
                      { value: 'Travel', icon: '✈️', label: isRTL ? 'ارتباط بسفر' : 'Travel Commitment' },
                      { value: 'Schedule Conflict', icon: '📋', label: isRTL ? 'تعارض في الجدول' : 'Schedule Conflict' },
                      { value: 'Health', icon: '🏥', label: isRTL ? 'أسباب صحية' : 'Health Reasons' },
                      { value: 'Other', icon: '💭', label: isRTL ? 'أسباب أخرى' : 'Other Reasons' },
                    ].map(reason => (
                      <StaggerItem key={reason.value}>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setDeclineReason(reason.value)}
                          animate={declineReason === reason.value ? {
                            borderColor: '#ef4444',
                            boxShadow: '0 0 20px rgba(239,68,68,0.1)',
                          } : {
                            borderColor: '#E8E2D6',
                            boxShadow: 'none',
                          }}
                          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                          style={{
                            width: '100%', padding: '16px 20px',
                            border: `2px solid ${declineReason === reason.value ? '#ef4444' : '#E8E2D6'}`,
                            borderRadius: '14px', cursor: 'pointer',
                            background: declineReason === reason.value ? 'linear-gradient(135deg, rgba(239,68,68,0.04), rgba(239,68,68,0.01))' : '#FFFFFF',
                            fontFamily: 'var(--font-sans)',
                            display: 'flex', alignItems: 'center', gap: '14px',
                            textAlign: isRTL ? 'right' : 'left',
                          }}
                        >
                          <span style={{ fontSize: '22px' }}>{reason.icon}</span>
                          <span style={{
                            fontWeight: 600, fontSize: '14px',
                            color: declineReason === reason.value ? '#ef4444' : '#191B1E',
                          }}>
                            {reason.label}
                          </span>
                          {declineReason === reason.value && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                              style={{
                                marginLeft: 'auto', width: '22px', height: '22px', borderRadius: '50%',
                                background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </motion.div>
                          )}
                        </motion.button>
                      </StaggerItem>
                    ))}
                  </StaggerChildren>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                    <button onClick={() => goToStep(2)} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>
                    <PremiumButton onClick={() => goToStep(4)}>
                      {t.continue}
                    </PremiumButton>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════
                  STEP 4: Custom Questions
                  ════════════════════════════════════════ */}
              {step === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <FadeInUp y={15}>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E' }}>
                      {t.additional_details}
                    </h3>
                  </FadeInUp>

                  {event.rsvp_form_fields?.length > 0 ? (
                    <StaggerChildren staggerDelay={0.08}>
                      {event.rsvp_form_fields.map(field => {
                        const label = isRTL && field.field_label_ar ? field.field_label_ar : field.field_label;
                        const opts = isRTL && field.options_ar ? field.options_ar : field.options;
                        return (
                          <StaggerItem key={field.id}>
                            <FormField
                              label={label}
                              required={field.is_required}
                              error={validationErrors[`field_${field.id}`]}
                            >
                              {field.field_type === 'text' && (
                                <input
                                  type="text"
                                  value={customAnswers[field.id] || ''}
                                  onChange={e => {
                                    setCustomAnswers({ ...customAnswers, [field.id]: e.target.value });
                                    setValidationErrors(prev => { const n = { ...prev }; delete n[`field_${field.id}`]; return n; });
                                  }}
                                  style={{
                                    ...S.inputBase,
                                    ...(validationErrors[`field_${field.id}`] ? { borderColor: '#ef4444' } : {}),
                                  }}
                                  onFocus={e => inputFocus(e)}
                                  onBlur={e => inputBlur(e, !!validationErrors[`field_${field.id}`])}
                                />
                              )}
                              {field.field_type === 'select' && (
                                <select
                                  value={customAnswers[field.id] || ''}
                                  onChange={e => setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })}
                                  style={{ ...S.inputBase, cursor: 'pointer' }}
                                >
                                  <option value="">{t.meal_select_placeholder}</option>
                                  {opts?.map((opt, i) => (<option key={i} value={opt}>{opt}</option>))}
                                </select>
                              )}
                            </FormField>
                          </StaggerItem>
                        );
                      })}
                    </StaggerChildren>
                  ) : (
                    <FadeInUp y={10}>
                      <p style={{ fontSize: '13px', color: '#77736A' }}>{t.no_questions}</p>
                    </FadeInUp>
                  )}

                  <FadeInUp delay={0.15} y={15}>
                    <FormField label={t.note_label}>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                        placeholder={t.note_placeholder}
                        style={{ ...S.inputBase, resize: 'vertical', minHeight: '80px' }}
                        onFocus={e => inputFocus(e)} onBlur={e => inputBlur(e)}
                      />
                    </FormField>
                  </FadeInUp>

                  {/* Validation Error Banner */}
                  <AnimatePresence>
                    {Object.keys(validationErrors).length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          padding: '14px 16px', borderRadius: '12px',
                          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                          fontSize: '12px', color: '#ef4444',
                        }}
                      >
                        ⚠️ {isRTL ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill in all required fields before submitting.'}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                    <button onClick={() => {
                      if (attending === 'yes') goToStep(3);
                      else if (attending === 'maybe') goToStep(35);
                      else if (attending === 'no') goToStep(36);
                      else goToStep(2);
                    }} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>
                    <GlowPulse color="#B8944F" intensity={submitting ? 0 : 0.2}>
                      <PremiumButton
                        testId="rsvp-submit"
                        disabled={submitting}
                        loading={submitting}
                        onClick={handleSubmit}
                      >
                        {submitting ? t.submitting : t.submit_rsvp}
                      </PremiumButton>
                    </GlowPulse>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════
                  STEP 5: Success Screen
                  ════════════════════════════════════════ */}
              {step === 5 && (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px 0' }}>

                  {/* ─── YES: Celebration ─── */}
                  {attending === 'yes' && (
                    <>
                      <ConfettiExplosion active={true} duration={4000} />

                      <FadeInUp y={20}>
                        <motion.span
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.8, delay: 0.3 }}
                          style={{ fontSize: '56px', display: 'block' }}
                        >
                          🎉
                        </motion.span>
                      </FadeInUp>

                      <FadeInUp delay={0.2} y={15}>
                        <h2 style={{
                          fontFamily: event?.custom_fonts?.card_title || 'var(--font-serif)',
                          fontSize: '26px', fontWeight: 600, color: '#191B1E',
                        }}>
                          {t.thank_you.replace('{name}', guestName)}
                        </h2>
                      </FadeInUp>

                      <FadeInUp delay={0.35} y={10}>
                        <p style={{
                          color: '#77736A', maxWidth: '400px', margin: '0 auto',
                          fontSize: '14px', lineHeight: 1.7, fontFamily: 'var(--font-sans)',
                        }}>
                          {t.attending_success_desc.replace('{email}', email)}
                        </p>
                      </FadeInUp>

                      {/* Guest Pass Card */}
                      <FadeInUp delay={0.5} y={20}>
                        <GuestPassCard
                          guestName={guestName}
                          eventTitle={localizedTitle}
                          eventDate={event.event_date}
                          eventLocation={event.location_name || event.location_address}
                          tableName={assignedTableName}
                          response="yes"
                          qrData={rsvpId ? `fancy-rsvp:${slug}:${rsvpId}` : null}
                          themeColor={themeColor}
                          isRTL={isRTL}
                        />
                      </FadeInUp>

                      {/* Action Buttons */}
                      <FadeInUp delay={0.65} y={10}>
                        <div style={{
                          display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap',
                        }}>
                          <CalendarButton event={event} isRTL={isRTL} />
                          <ShareButton
                            title={localizedTitle}
                            text={isRTL ? `أنا سأحضر ${localizedTitle}!` : `I'm attending ${localizedTitle}!`}
                            url={typeof window !== 'undefined' ? window.location.origin + '/' + slug : ''}
                            isRTL={isRTL}
                          />
                        </div>
                      </FadeInUp>

                      {/* Seating Map */}
                      {rsvpId && (
                        <FadeInUp delay={0.75} y={15}>
                          {seatingView ? (
                            <div style={{ marginTop: '4px' }}>
                              <SeatingResultPanel view={seatingView} loading={seatingLoading} isRTL={isRTL} onBack={() => setSeatingView(null)} />
                            </div>
                          ) : (
                            <PremiumButton
                              variant="outline"
                              onClick={() => fetchSeatingMap(rsvpId)}
                              loading={seatingLoading}
                              icon="🗺️"
                            >
                              {isRTL ? 'اعرض مكان جلوسي على الخريطة' : 'View where I sit on the map'}
                            </PremiumButton>
                          )}
                        </FadeInUp>
                      )}

                      <FadeInUp delay={0.85} y={5}>
                        <p style={{ fontSize: '12px', color: '#A09A91', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
                          {t.qr_notice}
                        </p>
                      </FadeInUp>
                    </>
                  )}

                  {/* ─── MAYBE: Follow-up ─── */}
                  {attending === 'maybe' && (
                    <>
                      <FadeInUp y={20}>
                        <motion.span
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          style={{ fontSize: '56px', display: 'block' }}
                        >
                          📅
                        </motion.span>
                      </FadeInUp>

                      <FadeInUp delay={0.2} y={15}>
                        <h2 style={{
                          fontFamily: event?.custom_fonts?.card_title || 'var(--font-serif)',
                          fontSize: '26px', fontWeight: 600, color: '#191B1E',
                        }}>
                          {t.thank_you.replace('{name}', guestName)}
                        </h2>
                      </FadeInUp>

                      <FadeInUp delay={0.35} y={10}>
                        <p style={{
                          color: '#77736A', maxWidth: '400px', margin: '0 auto',
                          fontSize: '14px', lineHeight: 1.7,
                        }}>
                          {isRTL
                            ? 'تم تسجيل ردك المبدئي. سنتابع معك قريباً للتأكيد النهائي.'
                            : "Your tentative response has been recorded. We'll follow up with you soon for final confirmation."}
                        </p>
                      </FadeInUp>

                      {maybeFollowUp && (
                        <FadeInUp delay={0.45} y={10}>
                          <div style={{
                            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                            padding: '16px 24px', borderRadius: '14px', display: 'inline-block',
                            margin: '0 auto',
                          }}>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6366f1', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                              {isRTL ? 'المتابعة المتوقعة' : 'Expected Follow-up'}
                            </span>
                            <strong style={{ fontSize: '16px', color: '#6366f1', fontFamily: 'var(--font-serif)' }}>
                              {maybeFollowUp}
                            </strong>
                          </div>
                        </FadeInUp>
                      )}

                      {/* Guest Pass for Maybe */}
                      <FadeInUp delay={0.5} y={20}>
                        <GuestPassCard
                          guestName={guestName}
                          eventTitle={localizedTitle}
                          eventDate={event.event_date}
                          eventLocation={event.location_name || event.location_address}
                          tableName={assignedTableName}
                          response="maybe"
                          qrData={rsvpId ? `fancy-rsvp:${slug}:${rsvpId}` : null}
                          themeColor={themeColor}
                          isRTL={isRTL}
                        />
                      </FadeInUp>

                      <FadeInUp delay={0.6} y={10}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <CalendarButton event={event} isRTL={isRTL} />
                          <ShareButton
                            title={localizedTitle}
                            text={isRTL ? `دعوة لحضور ${localizedTitle}` : `You're invited to ${localizedTitle}`}
                            url={typeof window !== 'undefined' ? window.location.origin + '/' + slug : ''}
                            isRTL={isRTL}
                          />
                        </div>
                      </FadeInUp>
                    </>
                  )}

                  {/* ─── NO: Farewell ─── */}
                  {attending === 'no' && (
                    <>
                      <FadeInUp y={20}>
                        <motion.span
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                          style={{ fontSize: '56px', display: 'block' }}
                        >
                          ✉️
                        </motion.span>
                      </FadeInUp>

                      <FadeInUp delay={0.2} y={15}>
                        <h2 style={{
                          fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600,
                          color: '#191B1E',
                        }}>
                          {isRTL ? 'شكراً لإعلامنا بقرارك' : 'Thank you for letting us know'}
                        </h2>
                      </FadeInUp>

                      <FadeInUp delay={0.35} y={10}>
                        <p style={{ color: '#77736A', maxWidth: '380px', margin: '0 auto', fontSize: '14px', lineHeight: 1.7 }}>
                          {t.decline_success_desc}
                        </p>
                      </FadeInUp>

                      {declineReason && (
                        <FadeInUp delay={0.45} y={10}>
                          <div style={{
                            background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)',
                            padding: '14px 20px', borderRadius: '14px', display: 'inline-block',
                            margin: '0 auto',
                          }}>
                            <span style={{ fontSize: '13px', color: '#77736A' }}>
                              {isRTL ? 'السبب: ' : 'Reason: '}
                              <span style={{ fontWeight: 600, color: '#191B1E' }}>{declineReason}</span>
                            </span>
                          </div>
                        </FadeInUp>
                      )}

                      {/* Elegant farewell divider */}
                      <FadeInUp delay={0.5} y={5}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '8px 0' }}>
                          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, #E8E2D6)' }} />
                          <span style={{ color: '#D7BE80', fontSize: '16px' }}>✦</span>
                          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #E8E2D6, transparent)' }} />
                        </div>
                      </FadeInUp>

                      <FadeInUp delay={0.55} y={10}>
                        <p style={{
                          fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#B8944F',
                          fontStyle: 'italic', lineHeight: 1.6,
                        }}>
                          {isRTL
                            ? 'نتمنى لك كل الخير ونأمل أن نلتقي في مناسبة قريبة'
                            : 'We wish you all the best and hope to see you at a future celebration'}
                        </p>
                      </FadeInUp>
                    </>
                  )}

                  {/* Return Link */}
                  <FadeInUp delay={0.8} y={5}>
                    <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '24px' }}>
                      <Link href={`/${slug}`} style={{
                        color: '#B8944F', fontSize: '14px', fontWeight: 600,
                        textDecoration: 'none', fontFamily: 'var(--font-sans)',
                      }}>
                        {t.return_btn}
                      </Link>
                    </div>
                  </FadeInUp>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>


      {/* Global keyframes */}
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  );
}

/* ═══ Seating Result Panel ═══
   Shows the guest's table + a highlighted map + the companions THEY brought.
   Deliberately never lists other parties seated at the same table. */
function SeatingResultPanel({ view, loading, isRTL, onBack }) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ width: '28px', height: '28px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
        <p style={{ color: '#77736A', fontSize: '12px' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }
  if (!view) return null;
  const assigned = !!view.myTableName;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: isRTL ? 'right' : 'left' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <span style={{
            fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px',
            color: '#77736A', fontWeight: 700, display: 'block', fontFamily: 'var(--font-sans)',
          }}>
            {isRTL ? 'طاولتك' : 'Your table'}
          </span>
          <strong style={{
            fontSize: '18px', color: assigned ? '#B8944F' : '#A09A91',
            fontFamily: 'var(--font-serif)',
          }}>
            {assigned ? view.myTableName : (isRTL ? 'لم تُخصّص بعد' : 'Not assigned yet')}
          </strong>
        </div>
        {onBack && (
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: '#77736A', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'underline',
          }}>
            {isRTL ? 'رجوع' : 'Back'}
          </button>
        )}
      </div>

      <SeatingMiniMap tables={view.tables} myTableId={view.myTableId} youLabel={isRTL ? 'مكانك' : "You're here"} />

      {view.party && view.party.length > 0 && (
        <div style={{
          background: '#FAFAF8', border: '1px solid #E8E2D6', borderRadius: '12px', padding: '14px',
        }}>
          <span style={{
            fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px',
            color: '#77736A', fontWeight: 700, display: 'block', marginBottom: '8px',
            fontFamily: 'var(--font-sans)',
          }}>
            {isRTL ? 'مرافقوك على نفس الطاولة' : 'Your party at this table'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {view.party.map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: '8px', fontSize: '13px',
              }}>
                <span style={{
                  color: '#191B1E', fontWeight: p.isPrimary ? 700 : 500,
                  fontFamily: 'var(--font-sans)',
                }}>
                  {p.name}{p.isPrimary ? (isRTL ? ' (أنت)' : ' (you)') : ''}
                </span>
                {p.meal && (
                  <span style={{ fontSize: '11px', color: '#77736A', fontFamily: 'var(--font-sans)' }}>
                    {p.meal}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <p style={{ fontSize: '11px', color: '#A09A91', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
        {isRTL ? 'الخريطة توضّح مكان طاولتك في القاعة فقط.' : 'The map shows where your table is in the venue.'}
      </p>
    </motion.div>
  );
}

