'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '../../utils/translations';
import { normalizeToE164 } from '../../utils/phone';
import { publicApiFetch } from '../../utils/publicApi';
import { useGuestAnalytics, useRsvpFunnelTracking, useAbandonmentTracking } from '../../utils/useGuestAnalytics';
import { isSeatingRevealed } from '../../utils/seating';
import { stepVariants, stepTransition, findMealField } from './styles';
import { usePartySearch } from './hooks/usePartySearch';
import { useSeatingLookup } from './hooks/useSeatingLookup';
import { FloatingParticles } from '../../components/guest/GuestAnimations';
import StepRail from './StepRail';
import StepIdentify from './steps/StepIdentify';
import StepAttendance from './steps/StepAttendance';
import StepPartyDetails from './steps/StepPartyDetails';
import StepCustomQuestions from './steps/StepCustomQuestions';
import StepSuccess from './steps/StepSuccess';

/**
 * RsvpWizard — the multi-step input surface for the public RSVP form, rendered
 * as a child of <RsvpExperience> (which owns resolution, the already-responded
 * lock, terminal statuses, and the single idempotent submit). This shell owns
 * only step navigation, the wizard's own local form state, and validation; the
 * actual per-step UI lives in ./steps/*.
 */
export default function RsvpWizard({ event, guest, context, submit: doSubmit, rememberGuest }) {
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
  const [primaryMeal, setPrimaryMeal] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [partyId, setPartyId] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [assignedTableName, setAssignedTableName] = useState(null);

  const [maybeFollowUp, setMaybeFollowUp] = useState(null);
  const [declineReason, setDeclineReason] = useState(null);
  const [showTableLookup, setShowTableLookup] = useState(false);

  const searchApi = usePartySearch(slug);
  const seatingApi = useSeatingLookup(slug);

  /* ═══ Analytics ═══ */
  const { trackEvent } = useGuestAnalytics(slug);
  useRsvpFunnelTracking(slug, step);
  useAbandonmentTracking(slug, step, step === 5);

  useEffect(() => { trackEvent('rsvp_started'); }, [trackEvent]);

  // When the form is pre-filled programmatically (from an invitation token), we must
  // NOT let the name-change reset below wipe the resolved partyId — otherwise the
  // submission would create a duplicate record instead of updating the invited party.
  const skipNameResetRef = useRef(false);

  useEffect(() => {
    if (skipNameResetRef.current) { skipNameResetRef.current = false; return; }
    searchApi.reset();
    setPartyId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestName]);

  const goToStep = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const [prevLangParam, setPrevLangParam] = useState(langParam);
  if (langParam !== prevLangParam) { setPrevLangParam(langParam); setLang(langParam); }

  /* ═══ Prefill from the engine-resolved guest ═══
     The unified <RsvpExperience> engine resolves the event + this party (via token,
     ?g=, ?party_id, or a remembered id) and renders this form only in the 'ready'
     phase. We pre-fill the known fields once. A responded guest reaches here only in
     edit mode (host allowed edits), so we also seed their previous response and skip
     the name-search step. Resolution / lock / status now live in the engine. */
  useEffect(() => {
    if (!guest) return;
    skipNameResetRef.current = true;
    // Synchronizing local form state to the engine-resolved `guest` prop, which
    // only becomes available asynchronously — this is the prop-to-state sync
    // case the rule's "subscribe to external updates" carve-out is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (guest.id) setPartyId(guest.id);
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
     Unlike the engine's resolution this never locks the view — it only fills in the
     table name (if seating has been revealed) for the celebratory pass card. */
  const fetchAssignedTable = async (id) => {
    if (!id) return;
    try {
      const data = await publicApiFetch(`/public/rsvp/guest/${id}`);
      if (data.guest?.table_name) setAssignedTableName(data.guest.table_name);
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
      return () => { if (document.head.contains(link)) document.head.removeChild(link); };
    }
  }, [event]);

  /* ═══ Sync additional guests with party size ═══ */
  useEffect(() => {
    const size = parseInt(partySize) || 1;
    // Deriving the additionalGuests array length from partySize — kept as an
    // effect (not render-time derivation) because it must preserve each
    // existing guest's already-typed name/meal fields across resizes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (size <= 1) { setAdditionalGuests([]); return; }
    const diff = size - 1;
    setAdditionalGuests(prev => {
      const copy = [...prev];
      if (copy.length < diff) {
        while (copy.length < diff)
          copy.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, fullName: '', mealSelection: '', dietaryNotes: '', customAnswers: {} });
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

  const localizedTitle = isRTL && event?.title_ar ? event.title_ar : (event?.title || '');
  const isContinueDisabled = partySize > 1 && additionalGuests.some(g => !g.fullName || !g.fullName.trim());
  const coverImage = event?.cover_image_url;
  // The seating chart (table search + personal map) is hidden until 24h before the event.
  const seatingRevealed = event?.event_date ? isSeatingRevealed(event.event_date) : false;

  // The meal field is shown as its own dedicated picker in step 3 (driven by the
  // organizer's configured options) rather than asked again as a generic custom
  // question in step 4.
  const allCustomFields = event?.custom_form_fields || [];
  const mealField = findMealField(allCustomFields);
  const customQuestionFields = mealField ? allCustomFields.filter(f => f.id !== mealField.id) : allCustomFields;

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

  const setCompanionAnswer = (guestIndex, fieldId, value) => {
    setAdditionalGuests(prev => {
      const copy = [...prev];
      copy[guestIndex] = { ...copy[guestIndex], customAnswers: { ...(copy[guestIndex].customAnswers || {}), [fieldId]: value } };
      return copy;
    });
  };

  const toggleCompanionMultiAnswer = (guestIndex, fieldId, opt) => {
    setAdditionalGuests(prev => {
      const copy = [...prev];
      const cur = ((copy[guestIndex].customAnswers || {})[fieldId] || '').split(',').map(s => s.trim()).filter(Boolean);
      const idx = cur.indexOf(opt);
      if (idx >= 0) cur.splice(idx, 1); else cur.push(opt);
      copy[guestIndex] = { ...copy[guestIndex], customAnswers: { ...(copy[guestIndex].customAnswers || {}), [fieldId]: cur.join(', ') } };
      return copy;
    });
  };

  /* ═══ Compute total steps and current progress ═══
     The "maybe"/"decline" variants of step 3 use 3.1/3.2 rather than the
     ordinal 4 + epsilon (e.g. 35/36) precisely so they sort BETWEEN 3 and 4 —
     goToStep()'s `nextStep > step` direction check depends on that ordering;
     values greater than 4 made the 3.x ↔ 4 transitions slide backward. */
  const totalSteps = 5; // 1-Name, 2-Attend, 3/3.1/3.2-Details, 4-Questions, 5-Success
  const currentProgress = step === 3.1 || step === 3.2 ? 3 : step;

  const handleSelectSearchResult = (result) => {
    setPartyId(result.id);
    setGuestName(result.guestName);
    if (result.partySize) setPartySize(result.partySize);
    goToStep(2);
  };
  const handleContinueAsNew = () => { setPartyId(null); goToStep(2); };

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
      partyId, guestName, email, phone: normalizedPhone, response: attending,
      partySize: attending === 'yes' ? partySize : 1,
      notes: enrichedNotes, primaryGuestMeal: primaryMeal,
      additionalGuests: attending === 'yes' ? additionalGuests.map(g => ({ ...g, customAnswers: g.customAnswers || {} })) : [],
      customAnswers: Object.keys(customAnswers).map(fieldId => ({ fieldId, value: customAnswers[fieldId] })),
      decline_reason: attending === 'no' ? declineReason : undefined,
      maybe_confirm_by: attending === 'maybe' ? maybeFollowUp : undefined,
    };

    const r = await doSubmit({ url: `/public/events/${slug}/rsvp`, body, reconcileId: partyId });
    setSubmitting(false);
    if (r.ok) {
      const resolvedId = r.data?.partyId || partyId;
      if (resolvedId) {
        setPartyId(resolvedId);
        rememberGuest(slug, resolvedId);
        if (attending === 'yes') fetchAssignedTable(resolvedId);
      }
      goToStep(5);
    }
    // r.reason === 'LOCKED' -> engine has already swapped to the locked card.
  };

  /* ═══ Render ═══ */
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      background: 'radial-gradient(120% 100% at 50% 0%, rgba(231,212,168,0.4) 0%, #F8F4EC 45%, #EFE6D4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left',
    }}>
      {/* Ambient gold dust — a quiet echo of the envelope's ignition, never competing with it. */}
      <FloatingParticles count={16} color="#D7BE80" />

      <motion.div
        initial={{ opacity: 0, y: 34, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 1, maxWidth: '540px', width: '100%',
          borderRadius: '22px', padding: '1.5px',
          background: 'linear-gradient(135deg, #D7BE80, #B8944F 45%, #E7D4A8)',
          boxShadow: '0 36px 90px -24px rgba(110,74,34,0.38), 0 10px 30px rgba(25,27,30,0.07)',
        }}
      >
        <div style={{ background: '#FFFFFF', borderRadius: '20.5px', overflow: 'hidden' }}>
          <div style={{
            background: coverImage
              ? `linear-gradient(180deg, rgba(25,27,30,0.32) 0%, rgba(25,27,30,0.88) 100%), url(${coverImage}) center/cover`
              : 'linear-gradient(135deg, #191B1E 0%, #2a2d32 100%)',
            color: '#FFFFFF', padding: '38px 32px 32px', textAlign: 'center', position: 'relative',
            minHeight: coverImage ? '170px' : 'auto',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}>
            {/* Corner flourish — a quiet nod to the invitation's print-stationery roots. */}
            <span aria-hidden style={{
              position: 'absolute', top: '12px', ...(isRTL ? { right: '16px' } : { left: '16px' }),
              fontSize: '13px', letterSpacing: '4px', color: 'rgba(215,190,128,0.55)', zIndex: 2,
            }}>✦</span>

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
                    backdropFilter: 'blur(8px)', transition: 'all 0.2s',
                  }}
                >{l.label}</motion.button>
              ))}
            </div>

            <motion.span initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '4px', color: '#D7BE80', fontWeight: 700, display: 'block', marginBottom: '10px', fontFamily: 'var(--font-sans)' }}>
              {t.rsvp_portal}
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }}
              style={{ fontFamily: event?.custom_fonts?.card_title || 'var(--font-serif)', fontSize: '22px', fontWeight: 400, letterSpacing: '0.5px', lineHeight: 1.3 }}>
              {localizedTitle}
            </motion.h1>
            <motion.div aria-hidden initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.55, duration: 0.7 }}
              className="gold-shimmer-line" style={{ width: '64px', margin: '14px auto 0' }} />
          </div>

          <div style={{ padding: '28px 32px 32px' }}>
            {step < 5 && <StepRail currentStep={currentProgress} totalSteps={4} isRTL={isRTL} color={themeColor} />}

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={step} custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={stepTransition}>

              {step === 1 && (
                <StepIdentify
                  t={t} isRTL={isRTL}
                  guestName={guestName} setGuestName={setGuestName}
                  validationErrors={validationErrors} setValidationErrors={setValidationErrors}
                  searchApi={searchApi} seatingApi={seatingApi} seatingRevealed={seatingRevealed}
                  onSelectResult={handleSelectSearchResult} onContinueNew={handleContinueAsNew}
                  showTableLookup={showTableLookup} setShowTableLookup={setShowTableLookup}
                />
              )}

              {step === 2 && (
                <StepAttendance
                  t={t} isRTL={isRTL} guestName={guestName} attending={attending}
                  onBack={() => goToStep(1)}
                  onSelect={(val) => {
                    setAttending(val);
                    setTimeout(() => {
                      if (val === 'yes') goToStep(3);
                      else if (val === 'maybe') goToStep(3.1);
                      else goToStep(3.2);
                    }, 400);
                  }}
                />
              )}

              {(step === 3 || step === 3.1 || step === 3.2) && (
                <StepPartyDetails
                  t={t} isRTL={isRTL} attending={attending}
                  partySize={partySize} setPartySize={setPartySize}
                  mealField={mealField} primaryMeal={primaryMeal} setPrimaryMeal={setPrimaryMeal}
                  additionalGuests={additionalGuests} setAdditionalGuests={setAdditionalGuests}
                  email={email} setEmail={setEmail} phone={phone} setPhone={setPhone}
                  validationErrors={validationErrors} isContinueDisabled={isContinueDisabled}
                  onBack={() => goToStep(2)} onContinue={() => goToStep(4)}
                  maybeFollowUp={maybeFollowUp} setMaybeFollowUp={setMaybeFollowUp}
                  declineReason={declineReason} setDeclineReason={setDeclineReason}
                />
              )}

              {step === 4 && (
                <StepCustomQuestions
                  t={t} isRTL={isRTL} fields={customQuestionFields}
                  customAnswers={customAnswers} setAnswer={setAnswer} toggleMultiAnswer={toggleMultiAnswer}
                  additionalGuests={attending === 'yes' ? additionalGuests : []}
                  setCompanionAnswer={setCompanionAnswer}
                  toggleCompanionMultiAnswer={toggleCompanionMultiAnswer}
                  notes={notes} setNotes={setNotes} validationErrors={validationErrors}
                  submitting={submitting}
                  onBack={() => {
                    if (attending === 'yes') goToStep(3);
                    else if (attending === 'maybe') goToStep(3.1);
                    else if (attending === 'no') goToStep(3.2);
                    else goToStep(2);
                  }}
                  onSubmit={handleSubmit}
                />
              )}

              {step === 5 && (
                <StepSuccess
                  t={t} isRTL={isRTL} attending={attending} event={event} localizedTitle={localizedTitle}
                  guestName={guestName} email={email} partySize={partySize} partyId={partyId} slug={slug}
                  themeColor={themeColor} assignedTableName={assignedTableName}
                  maybeFollowUp={maybeFollowUp} declineReason={declineReason}
                  seatingApi={seatingApi} seatingRevealed={seatingRevealed}
                />
              )}

            </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  );
}
