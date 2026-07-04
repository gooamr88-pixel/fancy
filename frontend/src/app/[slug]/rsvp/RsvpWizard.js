'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { translations } from '../../utils/translations';
import { normalizeToE164 } from '../../utils/phone';
import { publicApiFetch } from '../../utils/publicApi';
import { useGuestAnalytics, useRsvpFunnelTracking, useAbandonmentTracking } from '../../utils/useGuestAnalytics';
import { isSeatingRevealed } from '../../utils/seating';
import { splitName } from '../../utils/nameFields';
import { findMealField } from './styles';
import { useSeatingLookup } from './hooks/useSeatingLookup';
import { lighten } from '../../utils/color';
import { getCelebrationPreset } from '../../utils/patternCelebration';
import { FloatingParticles } from '../../components/guest/GuestAnimations';
import TurnstileWidget, { turnstileEnabled } from '../../components/guest/TurnstileWidget';
import StepAttendance from './steps/StepAttendance';
import StepPartyDetails from './steps/StepPartyDetails';
import StepCustomQuestions from './steps/StepCustomQuestions';
import StepSuccess from './steps/StepSuccess';

/**
 * RsvpWizard — the single-page input surface for the public RSVP form, rendered
 * as a child of <RsvpExperience> (which owns resolution, the already-responded
 * lock, terminal statuses, and the single idempotent submit). Sections reveal
 * progressively on ONE scrollable page (name -> attendance -> details/
 * questions -> submit) instead of step-by-step navigation; this shell owns the
 * form's local state and validation, the actual per-section UI lives in ./steps/*.
 */
export default function RsvpWizard({ event, guest, context, submit: doSubmit, rememberGuest, embedded = false, lang: langProp, onGuestIdentified }) {
  const slug = context?.slug || event?.slug;
  const searchParams = useSearchParams();
  const langParam = langProp || searchParams.get('lang') || 'en';

  const [lang, setLang] = useState(langParam);
  const [submitted, setSubmitted] = useState(false);

  const [guestName, setGuestName] = useState('');
  const [attending, setAttending] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [additionalGuests, setAdditionalGuests] = useState([]);
  const [customAnswers, setCustomAnswers] = useState({});
  const [notes, setNotes] = useState('');
  const [primaryMeal, setPrimaryMeal] = useState('');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [side, setSide] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [partyId, setPartyId] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [assignedTableName, setAssignedTableName] = useState(null);

  const [maybeFollowUp, setMaybeFollowUp] = useState(null);
  const [declineReason, setDeclineReason] = useState(null);
  const [showTableLookup, setShowTableLookup] = useState(false);

  // Cloudflare Turnstile: only active when NEXT_PUBLIC_TURNSTILE_SITEKEY is set,
  // mirroring the backend gate. The solved token rides along in the submit body
  // as `captchaToken`; the ref lets us request a fresh one after a failed submit.
  const [captchaToken, setCaptchaToken] = useState(null);
  const turnstileRef = useRef(null);

  const seatingApi = useSeatingLookup(slug);

  /* ═══ Analytics ═══
     The funnel/abandonment trackers just want a numeric "how far along" signal —
     derive it from the page's reveal state instead of a navigable step index. */
  const analyticsStep = submitted ? 5 : (attending ? 3 : 2);
  const { trackEvent } = useGuestAnalytics(slug);
  useRsvpFunnelTracking(slug, analyticsStep);
  useAbandonmentTracking(slug, analyticsStep, submitted);

  useEffect(() => { trackEvent('rsvp_started'); }, [trackEvent]);

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
    // Synchronizing local form state to the engine-resolved `guest` prop, which
    // only becomes available asynchronously — this is the prop-to-state sync
    // case the rule's "subscribe to external updates" carve-out is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (guest.id) setPartyId(guest.id);
    if (guest.guest_name) setGuestName(guest.guest_name);
    if (guest.email) setEmail(guest.email);
    if (guest.phone) setPhone(guest.phone);
    if (guest.party_size) setPartySize(guest.party_size);
    // BUG FIX: the primary guest's own meal choice was never pre-filled here
    // (only companions' were, via additionalGuests below), so reopening an
    // editable RSVP silently reset the host's meal picker to blank — and
    // resubmitting overwrote their saved meal_selection with NULL.
    if (guest.primary_meal) setPrimaryMeal(guest.primary_meal);
    if (guest.primary_dietary_notes) setDietaryNotes(guest.primary_dietary_notes);
    // Pre-fill companions already on file (e.g. entered by the organizer during guest
    // import) so the form asks the responder to confirm/edit each real person instead
    // of generating blank "Guest 2", "Guest 3" fields that silently discard their names.
    if (Array.isArray(guest.additionalGuests) && guest.additionalGuests.length > 0) {
      setAdditionalGuests(guest.additionalGuests.map(g => ({
        id: g.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        fullName: g.fullName || '', mealSelection: g.mealSelection || '', dietaryNotes: g.dietaryNotes || '',
        phone: g.phone || '',
        customAnswers: {},
      })));
    }
    if (guest.notes) setNotes(guest.notes);
    if (guest.side) setSide(guest.side);
    if (guest.sms_consent) setSmsConsent(true);
    if (['yes', 'no', 'maybe'].includes(guest.response)) setAttending(guest.response);
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
  const fetchAssignedTable = async (id, attempt = 0) => {
    if (!id) return;
    try {
      const data = await publicApiFetch(`/public/rsvp/guest/${id}`);
      if (data.guest?.table_name) setAssignedTableName(data.guest.table_name);
    } catch (err) {
      console.error('Table fetch failed:', err);
      // One quiet retry — a transient network blip right after submit shouldn't
      // permanently hide the table name from the success screen.
      if (attempt === 0) setTimeout(() => fetchAssignedTable(id, 1), 1500);
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

  /* ═══ Sync additional guests with party size ═══
     Only ever GROWS the underlying array — never truncates it. A guest who taps
     the party-size stepper down (e.g. to fix a typo) and back up used to lose
     every companion's already-typed name/email/meal, because this effect
     `splice`d the array down to the new size and regrowth only ever pushed
     fresh blank entries. Trimming for render/submit now happens separately
     (see additionalGuests.slice below and in handleSubmit), so a transient dip
     in party size no longer discards data — it reappears when size goes back up. */
  useEffect(() => {
    const size = parseInt(partySize) || 1;
    const diff = Math.max(size - 1, 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdditionalGuests(prev => {
      if (diff <= prev.length) return prev;
      const copy = [...prev];
      while (copy.length < diff)
        copy.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          fullName: '', mealSelection: '', dietaryNotes: '',
          phone: '',
          customAnswers: {},
        });
      return copy;
    });
  }, [partySize]);

  // The visible/submittable slice of additionalGuests — always exactly
  // partySize-1 entries, even though the underlying state array may hold more
  // (preserved from a larger party size the guest dialed back from).
  const visibleAdditionalGuests = additionalGuests.slice(0, Math.max((parseInt(partySize) || 1) - 1, 0));

  const themeColor = event?.custom_colors?.primary || '#B8944F';
  // Falls back to a lightened tint of the primary when the event has no
  // explicit secondary, so the card's frame/accents still feel bespoke
  // instead of defaulting to the fixed gold-on-cream look for every template.
  const secondaryColor = event?.custom_colors?.secondary || lighten(themeColor, 0.35);
  // Ties the whole page's ambient atmosphere to the chosen template family —
  // drifting petals for a garden theme, slow snow for a winter theme — while
  // still using this event's own color, not a generic preset.
  const celebration = getCelebrationPreset(event?.template_type);
  const isRTL = lang === 'ar';
  const t = translations[lang];

  // A11Y-3: keep the document's language/direction in sync with the guest's choice
  // so screen readers announce content in the right language and RTL is correct.
  useEffect(() => {
    const rtl = lang === 'ar';
    document.documentElement.lang = rtl ? 'ar' : 'en';
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [lang]);

  const localizedTitle = isRTL && (event?.title_ar || event?.template_data?.title_ar) ? (event?.title_ar || event?.template_data?.title_ar) : (event?.title || '');
  const coverImage = event?.cover_image_url;
  // The seating chart (table search + personal map) is hidden until 24h before
  // the event — UNLESS the organizer specifically added this guest (CSV import /
  // Add Guest), in which case it's visible immediately since their identity is
  // already confirmed by the organizer.
  const seatingRevealed = guest?.createdByOrganizer === true
    || (event?.event_date ? isSeatingRevealed(event.event_date) : false);

  // The meal field is shown as its own dedicated picker in step 3 (driven by the
  // organizer's configured options) rather than asked again as a generic custom
  // question in step 4.
  const allCustomFields = event?.custom_form_fields || [];
  const mealField = findMealField(allCustomFields);
  const customQuestionFields = mealField ? allCustomFields.filter(f => f.id !== mealField.id) : allCustomFields;
  // scope === 'guest' fields are asked once per companion (e.g. dietary needs);
  // everything else is party-scoped and asked once for the whole party.
  const partyScopedFields = customQuestionFields.filter(f => f.scope !== 'guest');
  const guestScopedFields = customQuestionFields.filter(f => f.scope === 'guest');

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

  /* ═══ Submit Handler — delegates to the engine's idempotent submit ═══
     Validation stays local; idempotency, lost-response reconciliation, the
     DUPLICATE_RSVP -> lock transition and the CLOSED / GUEST_LIMIT toasts are all
     owned by the engine. We react only to a clean success here. */
  const handleSubmit = async () => {
    const errors = {};
    const { title: hTitle, first: hFirst, last: hLast } = splitName(guestName);
    if (!hTitle) errors.guestNameTitle = 'Title is required';
    if (!hFirst.trim()) errors.guestNameFirst = 'First name is required';
    if (!hLast.trim()) errors.guestNameLast = 'Last name is required';
    if (!email || !email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Invalid email format';
    }

    // Phone is required regardless of attendance.
    const normalizedPhone = phone.trim() ? normalizeToE164(phone) : '';
    if (!normalizedPhone) {
      errors.phone = phone.trim() ? (t.phone_invalid || 'Enter a valid phone number') : (t.phone_required || 'Phone number is required');
    }
    // TCPA/A2P 10DLC: a phone number is being collected, so affirmative SMS
    // consent must be captured too — mirrored server-side (rsvpController.js).
    if (!smsConsent) {
      errors.smsConsent = isRTL
        ? 'يرجى الموافقة على تلقي رسائل نصية بخصوص هذه الفعالية للمتابعة.'
        : 'Please agree to receive SMS updates about this event to continue.';
    }

    if (partySize < 1 || partySize > 20) errors.partySize = 'Party size must be between 1 and 20';
    if (attending === 'yes') {
      // Meal requiredness was previously enforced ONLY by the backend RPC, and
      // only when it happened to find the field by a hardcoded key — the
      // frontend never checked this at all, so a guest could submit with every
      // meal picker left blank whenever that lookup missed (see mealField.js).
      if (mealField?.is_required && (!primaryMeal || !primaryMeal.trim())) {
        errors.primaryMeal = 'Meal selection is required';
      }
      // These used to be gated by a per-section "Continue" button that's gone
      // now everything lives on one page — enforce them at submit instead.
      if (partySize > 1) {
        visibleAdditionalGuests.forEach((g, index) => {
          const { title: cTitle, first: cFirst, last: cLast } = splitName(g.fullName);
          if (!cTitle) errors[`additionalGuest_title_${index}`] = 'Title is required';
          if (!cFirst.trim()) errors[`additionalGuest_${index}`] = 'First name is required';
          if (!cLast.trim()) errors[`additionalGuest_last_${index}`] = 'Last name is required';
          if (!g.email || !g.email.trim()) {
            errors[`additionalGuest_email_${index}`] = 'Email is required';
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email)) {
            errors[`additionalGuest_email_${index}`] = 'Invalid email format';
          }
          const normalizedCompanionPhone = g.phone && g.phone.trim() ? normalizeToE164(g.phone) : '';
          if (!normalizedCompanionPhone) {
            errors[`additionalGuest_phone_${index}`] = g.phone && g.phone.trim() ? 'Enter a valid phone number' : 'Phone number is required';
          }
          if (mealField?.is_required && (!g.mealSelection || !g.mealSelection.trim())) {
            errors[`additionalGuest_meal_${index}`] = 'Meal selection is required';
          }
          // Guest-scoped required custom questions (e.g. dietary needs) — these
          // were previously never checked for companions at all: the UI showed
          // them with required={false} and nothing validated them here, so an
          // organizer's "required" question could be silently skipped for
          // every companion.
          guestScopedFields.filter(f => f.is_required).forEach(field => {
            const val = (g.customAnswers || {})[field.id];
            if (!val || !val.toString().trim()) {
              errors[`companion_${index}_field_${field.id}`] = `${field.field_label} is required for Guest #${index + 2}`;
            }
          });
        });
      }
      partyScopedFields.filter(f => f.is_required).forEach(field => {
        if (!customAnswers[field.id] || !customAnswers[field.id].toString().trim()) {
          errors[`field_${field.id}`] = `${field.field_label} is required`;
        }
      });
      // Guest-scoped required questions now also apply to the primary guest
      // (previously only companions were ever asked/validated) — same
      // customAnswers bucket as party-scoped fields, since the two never
      // share field IDs.
      guestScopedFields.filter(f => f.is_required).forEach(field => {
        if (!customAnswers[field.id] || !customAnswers[field.id].toString().trim()) {
          errors[`primary_field_${field.id}`] = `${field.field_label} is required`;
        }
      });
    }
    if (attending === 'maybe' && !maybeFollowUp) errors.maybeFollowUp = 'Please select a follow-up timeframe';
    // Bot check — only enforced when Turnstile is configured (matches the backend).
    if (turnstileEnabled && !captchaToken) {
      errors.captcha = t.captcha_required || (isRTL ? 'يرجى إكمال التحقق الأمني.' : 'Please complete the security check.');
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
      notes: enrichedNotes, primaryGuestMeal: primaryMeal, primaryGuestDietaryNotes: dietaryNotes,
      additionalGuests: attending === 'yes' ? visibleAdditionalGuests.map(g => ({ ...g, customAnswers: g.customAnswers || {} })) : [],
      customAnswers: Object.keys(customAnswers).map(fieldId => ({ fieldId, value: customAnswers[fieldId] })),
      decline_reason: attending === 'no' ? declineReason : undefined,
      maybe_confirm_by: attending === 'maybe' ? maybeFollowUp : undefined,
      side: event?.track_guest_side ? (side || undefined) : undefined,
      smsConsent,
      ...(captchaToken ? { captchaToken } : {}),
    };

    const r = await doSubmit({ url: `/public/events/${slug}/rsvp`, body, reconcileId: partyId });
    setSubmitting(false);
    if (!r.ok) {
      // Turnstile tokens are single-use — force a fresh challenge before any retry.
      if (turnstileEnabled) { turnstileRef.current?.reset(); setCaptchaToken(null); }
    }
    if (r.ok) {
      const resolvedId = r.data?.partyId || partyId;
      if (resolvedId) {
        setPartyId(resolvedId);
        rememberGuest(slug, resolvedId);
        if (attending === 'yes') fetchAssignedTable(resolvedId);
      }
      // Tell the host page (EventPageClient) the guest's real name — its own
      // invitation greeting/envelope is fetched once on page load and has no
      // way to know a name was just typed in and submitted here, so without
      // this it keeps showing the generic "Esteemed Guest" placeholder until
      // the page is reloaded.
      onGuestIdentified?.({ id: resolvedId, guest_name: guestName, response: attending });
      setSubmitted(true);
    }
    // r.reason === 'LOCKED' -> engine has already swapped to the locked card.
  };

  /* ═══ Render ═══
     `embedded` mode (mounted as a section inside EventPageClient) drops the
     full-viewport centering shell, ambient particles, and the inner language
     toggle — the host page already supplies page-level background/chrome and
     its own language control. The card itself is unchanged either way. */
  const outerStyle = embedded
    ? {
        position: 'relative', width: '100%',
        display: 'flex', justifyContent: 'center',
        fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left',
      }
    : {
        minHeight: '100dvh', position: 'relative', overflow: 'hidden',
        background: `radial-gradient(120% 100% at 50% 0%, ${secondaryColor}66 0%, #F8F4EC 45%, #EFE6D4 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left',
      };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={outerStyle}>
      {/* Ambient dust — a quiet echo of the envelope's ignition, tinted to this event's own theme and shaped to its template family. */}
      {!embedded && <FloatingParticles count={18} color={secondaryColor} shape={celebration.ambient} />}

      <motion.div
        initial={{ opacity: 0, y: 34, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 1, maxWidth: '540px', width: '100%',
          borderRadius: '22px', padding: '1.5px',
          background: `linear-gradient(135deg, ${secondaryColor}, ${themeColor} 45%, ${secondaryColor})`,
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
              fontSize: '13px', letterSpacing: '4px', color: `${secondaryColor}8C`, zIndex: 2,
            }}>✦</span>

            {!embedded && (
              <div style={{ position: 'absolute', top: '14px', ...(isRTL ? { left: '14px' } : { right: '14px' }), display: 'flex', gap: '6px', zIndex: 2 }}>
                {[{ code: 'en', label: 'EN' }, { code: 'ar', label: 'عربي' }].map(l => (
                  <motion.button
                    key={l.code}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLang(l.code)}
                    style={{
                      fontSize: '10px', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer',
                      border: lang === l.code ? `1px solid ${themeColor}` : '1px solid rgba(255,255,255,0.2)',
                      background: lang === l.code ? themeColor : 'rgba(255,255,255,0.08)',
                      color: lang === l.code ? '#191B1E' : 'rgba(255,255,255,0.7)',
                      fontWeight: lang === l.code ? 700 : 400, fontFamily: 'var(--font-sans)',
                      backdropFilter: 'blur(8px)', transition: 'all 0.2s',
                    }}
                  >{l.label}</motion.button>
                ))}
              </div>
            )}

            <motion.span initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '4px', color: secondaryColor, fontWeight: 700, display: 'block', marginBottom: '10px', fontFamily: 'var(--font-sans)' }}>
              {t.rsvp_portal}
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }}
              style={{ fontFamily: event?.custom_fonts?.card_title || 'var(--font-serif)', fontSize: '22px', fontWeight: 400, letterSpacing: '0.5px', lineHeight: 1.3 }}>
              {localizedTitle}
            </motion.h1>
            <motion.div aria-hidden initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.55, duration: 0.7 }}
              className="gold-shimmer-line" style={{ width: '64px', margin: '14px auto 0' }} />
          </div>

          <div style={{ padding: '28px 32px 32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {submitted ? (
              <StepSuccess
                t={t} isRTL={isRTL} attending={attending} event={event} localizedTitle={localizedTitle}
                guestName={guestName} email={email} partySize={partySize} partyId={partyId} slug={slug}
                themeColor={themeColor} assignedTableName={assignedTableName}
                maybeFollowUp={maybeFollowUp} declineReason={declineReason}
                seatingApi={seatingApi} seatingRevealed={seatingRevealed}
              />
            ) : (
              <>
                <StepAttendance
                  t={t} isRTL={isRTL} guestName={guestName} attending={attending}
                  onSelect={(val) => setAttending(val)}
                  themeColor={themeColor}
                />

                {attending && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                    style={{ borderTop: '1px solid #F0ECE3', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    <StepPartyDetails
                      t={t} isRTL={isRTL} attending={attending}
                      guestName={guestName} setGuestName={setGuestName}
                      partySize={partySize} setPartySize={setPartySize}
                      mealField={mealField} primaryMeal={primaryMeal} setPrimaryMeal={setPrimaryMeal}
                      dietaryNotes={dietaryNotes} setDietaryNotes={setDietaryNotes}
                      additionalGuests={visibleAdditionalGuests} setAdditionalGuests={setAdditionalGuests}
                      email={email} setEmail={setEmail} phone={phone} setPhone={setPhone}
                      validationErrors={validationErrors} setValidationErrors={setValidationErrors}
                      maybeFollowUp={maybeFollowUp} setMaybeFollowUp={setMaybeFollowUp}
                      declineReason={declineReason} setDeclineReason={setDeclineReason}
                      side={side} setSide={setSide}
                      showSidePicker={!!event?.track_guest_side}
                      isWedding={event?.event_type === 'wedding'}
                      smsConsent={smsConsent} setSmsConsent={setSmsConsent}
                    />

                    {turnstileEnabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <TurnstileWidget
                          ref={turnstileRef}
                          onVerify={(token) => {
                            setCaptchaToken(token);
                            setValidationErrors(prev => { const n = { ...prev }; delete n.captcha; return n; });
                          }}
                          onExpire={() => setCaptchaToken(null)}
                        />
                        {validationErrors.captcha && (
                          <span style={{ fontSize: '12px', color: '#ef4444' }}>{validationErrors.captcha}</span>
                        )}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '24px' }}>
                      <StepCustomQuestions
                        t={t} isRTL={isRTL} fields={attending === 'yes' ? partyScopedFields : []}
                        guestName={guestName}
                        companionFields={attending === 'yes' ? guestScopedFields : []}
                        customAnswers={customAnswers} setAnswer={setAnswer} toggleMultiAnswer={toggleMultiAnswer}
                        additionalGuests={attending === 'yes' ? visibleAdditionalGuests : []}
                        setCompanionAnswer={setCompanionAnswer}
                        toggleCompanionMultiAnswer={toggleCompanionMultiAnswer}
                        notes={notes} setNotes={setNotes} validationErrors={validationErrors}
                        submitting={submitting}
                        onSubmit={handleSubmit}
                      />
                    </div>
                  </motion.div>
                )}
              </>
            )}
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
