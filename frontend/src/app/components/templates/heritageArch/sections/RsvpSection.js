'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PartySizeStepper, FormField, CalendarButton, ShareButton } from '../../../guest/GuestUI';
import { ConfettiExplosion } from '../../../guest/GuestAnimations';
import PhoneNumberInput from '../../../PhoneNumberInput';
import { useIdempotentRsvpSubmit } from '../../../guest/rsvp/useIdempotentRsvpSubmit';
import { getCelebrationPreset } from '../../../../utils/patternCelebration';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading } from '../shared';
import { findMealField } from '../../../../utils/mealField';

const ALLERGY_OPTIONS = ['Gluten-free / Celiac', 'Lactose-free', 'Nut allergy', 'Seafood'];

export default function RsvpSection({ event, slug, guestRsvp, hasResponded, responseStatus, allowGuestEdits, effectiveRsvpId, mealOptions: mealOptionsProp, isRTL, trackEvent }) {
  const C = useFullPageTheme();
  // Defined inside the component so they read the themed palette (C).
  const fieldStyle = {
    width: '100%', boxSizing: 'border-box', padding: '13px 15px',
    background: C.cream, border: `1px solid ${C.border}`, borderRadius: '10px',
    fontSize: '14px', color: C.ink, outline: 'none', fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.2s ease',
  };
  const onFieldFocus = (e) => { e.target.style.borderColor = C.maroon; };
  const onFieldBlur = (e, invalid) => { e.target.style.borderColor = invalid ? '#C45E5E' : C.border; };
  const labelStyle = { fontSize: '12px', fontWeight: 700, color: C.ink, opacity: 0.75, display: 'block', marginBottom: '6px' };
  const locked = hasResponded && !allowGuestEdits;

  // ── Form Builder integration ──────────────────────────────────────────────
  // This inline RSVP previously rendered a fixed field set and ignored the
  // organizer's custom_form_fields entirely (custom questions never appeared and
  // customAnswers submitted as []). Wire them in: the dedicated meal picker
  // prefers the builder's flagged meal field — falling back to the template's
  // ha_meal_options (mealOptionsProp) only when none is configured — and every
  // other custom question is rendered + submitted below. Mirrors the standard
  // RsvpWizard/StepCustomQuestions path so both RSVP surfaces behave the same.
  const allCustomFields = event?.custom_form_fields || [];
  const mealField = findMealField(allCustomFields);
  const mealOptions = (mealField?.options && mealField.options.length > 0) ? mealField.options : mealOptionsProp;
  const customQuestions = mealField ? allCustomFields.filter((f) => f.id !== mealField.id) : allCustomFields;
  // scope==='guest' questions are asked once per person — of the primary guest
  // (in "A few more details" below) AND of every companion in their own block —
  // matching submit_rsvp_v2, which stores/validates them per guest_id.
  const guestScopedQuestions = customQuestions.filter((f) => f.scope === 'guest');
  // 'always' questions are asked of the primary guest for EVERY response (rendered
  // outside the "attending only" block); 'attending' questions only when they RSVP
  // yes. Companions exist only when attending, so their guest-scoped block is
  // unaffected. Matches submit_rsvp_v2, which stores/validates by condition.
  const alwaysQuestions = customQuestions.filter((f) => f.condition === 'always');
  const attendingQuestions = customQuestions.filter((f) => f.condition !== 'always');

  const [guestName, setGuestName] = useState(guestRsvp?.guest_name || '');
  const [phone, setPhone] = useState(guestRsvp?.phone || '');
  const [email, setEmail] = useState(guestRsvp?.email || '');
  const [attending, setAttending] = useState(hasResponded ? (guestRsvp.response === 'no' ? 'no' : 'yes') : null);
  const [partySize, setPartySize] = useState(1);
  const [additionalGuests, setAdditionalGuests] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [otherAllergy, setOtherAllergy] = useState('');
  const [meal, setMeal] = useState('');
  const [songRequest, setSongRequest] = useState('');
  const [message, setMessage] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [customAnswers, setCustomAnswers] = useState({});

  const { submit, submitting } = useIdempotentRsvpSubmit({
    onSuccess: () => setSubmitted(true),
    onLocked: () => setSubmitted(true),
  });

  const toggleAllergy = (opt) => {
    setAllergies((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  };

  const updateAdditionalGuest = (idx, patch) => {
    setAdditionalGuests((prev) => {
      const copy = [...prev];
      copy[idx] = { ...(copy[idx] || {}), ...patch };
      return copy;
    });
  };

  const handlePartySizeChange = (v) => {
    setPartySize(v);
    setAdditionalGuests((prev) => prev.slice(0, Math.max(0, v - 1)));
  };

  const setCustomAnswer = (fieldId, value) => {
    setCustomAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[`field_${fieldId}`]; return n; });
  };
  // Multiselect answers are stored as a comma-joined string — the exact shape
  // custom_form_fields rejects commas inside options for (fieldController.js) and
  // that submit_rsvp_v2 reads back, so the guest's selections round-trip cleanly.
  const toggleCustomMulti = (fieldId, opt) => {
    setCustomAnswers((prev) => {
      const cur = (prev[fieldId] || '').split(',').map((s) => s.trim()).filter(Boolean);
      const i = cur.indexOf(opt);
      if (i >= 0) cur.splice(i, 1); else cur.push(opt);
      return { ...prev, [fieldId]: cur.join(', ') };
    });
    setErrors((prev) => { const n = { ...prev }; delete n[`field_${fieldId}`]; return n; });
  };

  const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

  const setCompanionCustomAnswer = (gIdx, fieldId, value) => {
    setAdditionalGuests((prev) => {
      const copy = [...prev];
      copy[gIdx] = { ...(copy[gIdx] || {}), customAnswers: { ...((copy[gIdx] || {}).customAnswers || {}), [fieldId]: value } };
      return copy;
    });
    setErrors((prev) => { const k = `companion_${gIdx}_field_${fieldId}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
  };
  const toggleCompanionCustomMulti = (gIdx, fieldId, opt) => {
    setAdditionalGuests((prev) => {
      const copy = [...prev];
      const cur = (((copy[gIdx] || {}).customAnswers || {})[fieldId] || '').split(',').map((s) => s.trim()).filter(Boolean);
      const idx = cur.indexOf(opt);
      if (idx >= 0) cur.splice(idx, 1); else cur.push(opt);
      copy[gIdx] = { ...(copy[gIdx] || {}), customAnswers: { ...((copy[gIdx] || {}).customAnswers || {}), [fieldId]: cur.join(', ') } };
      return copy;
    });
    setErrors((prev) => { const k = `companion_${gIdx}_field_${fieldId}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
  };

  const CUSTOM_INPUT_TYPE = { email: 'email', phone: 'tel', url: 'url', number: 'number', date: 'date' };
  const optionRowStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: C.ink, cursor: 'pointer', minHeight: '44px' };
  const errorTextStyle = { display: 'block', marginTop: '6px', fontSize: '12px', color: '#C45E5E', fontWeight: 600 };
  // The shared "pill" the whole form speaks in — every selectable choice (attend
  // yes/no, meal, custom radio/multiselect) renders as the same rounded chip with
  // a 44px minimum tap target, so the surface reads as one cohesive system on
  // mobile and desktop alike.
  const pillStyle = (selected, { size = 'md', full = false } = {}) => ({
    padding: size === 'sm' ? '9px 15px' : '11px 18px',
    minHeight: '44px', boxSizing: 'border-box',
    borderRadius: full ? '14px' : '999px', cursor: 'pointer',
    fontFamily: 'var(--font-sans)', fontSize: size === 'sm' ? '13px' : '14px', fontWeight: 600,
    border: selected ? `1.5px solid ${C.maroon}` : `1px solid ${C.border}`,
    background: selected ? C.maroon : C.cream,
    color: selected ? '#FFFDF8' : C.ink,
    transition: 'all 0.18s ease',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
  });
  // Reusable across the primary guest and every companion — the caller supplies
  // the current value, the setters, and the invalid flag so the same premium
  // controls drive both `customAnswers` (primary) and each companion's own
  // `customAnswers` bucket.
  const renderCustomControl = (field, { value, onSet, onToggle, invalid }) => {
    const type = field.field_type;
    const inputStyle = invalid ? { ...fieldStyle, borderColor: '#C45E5E' } : fieldStyle;
    if (['text', 'email', 'phone', 'url', 'number', 'date'].includes(type)) {
      return <input type={CUSTOM_INPUT_TYPE[type] || 'text'} value={value} aria-invalid={invalid} onChange={(e) => onSet(e.target.value)} style={inputStyle} onFocus={onFieldFocus} onBlur={(e) => onFieldBlur(e, invalid)} />;
    }
    if (type === 'textarea') {
      return <textarea rows={3} value={value} aria-invalid={invalid} onChange={(e) => onSet(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} onFocus={onFieldFocus} onBlur={(e) => onFieldBlur(e, invalid)} />;
    }
    if (type === 'select') {
      return (
        <select value={value} aria-invalid={invalid} onChange={(e) => onSet(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} onFocus={onFieldFocus} onBlur={(e) => onFieldBlur(e, invalid)}>
          <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
          {(field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
        </select>
      );
    }
    if (type === 'radio') {
      return (
        <div role="radiogroup" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
          {(field.options || []).map((opt, i) => (
            <button type="button" key={i} role="radio" aria-checked={value === opt} onClick={() => onSet(opt)} style={pillStyle(value === opt, { size: 'sm' })}>
              {opt}
            </button>
          ))}
        </div>
      );
    }
    if (type === 'multiselect') {
      const chosen = value.split(',').map((s) => s.trim()).filter(Boolean);
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
          {(field.options || []).map((opt, i) => {
            const on = chosen.includes(opt);
            return (
              <button type="button" key={i} aria-pressed={on} onClick={() => onToggle(opt)} style={pillStyle(on, { size: 'sm' })}>
                {on ? '✓ ' : ''}{opt}
              </button>
            );
          })}
        </div>
      );
    }
    if (type === 'checkbox') {
      return (
        <label style={optionRowStyle}>
          <input type="checkbox" checked={value === 'Yes'} onChange={(e) => onSet(e.target.checked ? 'Yes' : '')} />
          {isRTL ? 'نعم' : 'Yes'}
        </label>
      );
    }
    return null;
  };

  // Bind the reusable control to a specific answers bucket + error namespace.
  const primaryControl = (field) => renderCustomControl(field, {
    value: customAnswers[field.id] || '',
    onSet: (v) => setCustomAnswer(field.id, v),
    onToggle: (opt) => toggleCustomMulti(field.id, opt),
    invalid: !!errors[`field_${field.id}`],
  });
  const companionControl = (gIdx, field) => renderCustomControl(field, {
    value: (additionalGuests[gIdx]?.customAnswers || {})[field.id] || '',
    onSet: (v) => setCompanionCustomAnswer(gIdx, field.id, v),
    onToggle: (opt) => toggleCompanionCustomMulti(gIdx, field.id, opt),
    invalid: !!errors[`companion_${gIdx}_field_${field.id}`],
  });

  const validate = () => {
    const e = {};
    if (!guestName.trim()) e.guestName = true;
    if (!phone.trim()) e.phone = true;
    if (!email.trim()) e.email = true;
    if (!attending) e.attending = true;
    // The backend requires affirmative SMS consent on every RSVP submission
    // (TCPA/A2P compliance), regardless of yes/no — not just when attending.
    if (!smsConsent) e.smsConsent = true;
    if (attending === 'yes' && partySize > 1) {
      for (let i = 0; i < partySize - 1; i++) {
        const g = additionalGuests[i];
        if (!g?.fullName?.trim() || !g?.email?.trim() || !g?.phone?.trim()) e.additionalGuests = true;
        guestScopedQuestions.filter((f) => f.is_required).forEach((f) => {
          const v = (g?.customAnswers || {})[f.id];
          if (!v || !v.toString().trim()) e[`companion_${i}_field_${f.id}`] = true;
        });
      }
    }
    // 'always'-condition required questions apply to every response.
    alwaysQuestions.filter((f) => f.is_required).forEach((f) => {
      const v = customAnswers[f.id];
      if (!v || !v.toString().trim()) e[`field_${f.id}`] = true;
    });
    // Required meal + 'attending'-only required questions are asked of attendees.
    if (attending === 'yes') {
      if (mealField?.is_required && !meal.trim()) e.meal = true;
      attendingQuestions.filter((f) => f.is_required).forEach((f) => {
        const v = customAnswers[f.id];
        if (!v || !v.toString().trim()) e[`field_${f.id}`] = true;
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const dietaryNotes = [...allergies, otherAllergy.trim()].filter(Boolean).join(', ') || null;
    // "Song request" has no dedicated backend column and custom_answers requires
    // a pre-existing organizer-configured field id — folding it into the free-text
    // notes keeps this correct against the real submit_rsvp_v2 contract without
    // any extra setup step for the organizer.
    const notes = [songRequest.trim() ? `🎵 Song request: ${songRequest.trim()}` : null, message.trim() || null]
      .filter(Boolean).join('\n\n') || null;

    const body = {
      partyId: guestRsvp?.party_id || effectiveRsvpId || undefined,
      guestName: guestName.trim(),
      email: email.trim(),
      phone,
      response: attending,
      partySize: attending === 'yes' ? partySize : 1,
      notes,
      primaryGuestMeal: attending === 'yes' ? (meal || null) : null,
      primaryGuestDietaryNotes: attending === 'yes' ? dietaryNotes : null,
      additionalGuests: attending === 'yes'
        ? additionalGuests.slice(0, partySize - 1).map((g) => ({ ...g, customAnswers: g.customAnswers || {} }))
        : [],
      // 'always' answers are sent for every response; 'attending' answers only
      // when coming. The RPC re-checks condition, so stale attending answers left
      // over from toggling yes→no are filtered out server-side regardless.
      customAnswers: Object.keys(customAnswers)
        .filter((fieldId) => attending === 'yes' || alwaysQuestions.some((f) => f.id === fieldId))
        .map((fieldId) => ({ fieldId, value: customAnswers[fieldId] })),
      smsConsent,
    };

    trackEvent?.('rsvp_started');
    await submit({ url: `/public/events/${slug}/rsvp`, body, reconcileId: body.partyId });
  };

  if (locked || submitted) {
    // "Attending" covers yes + tentative; only an explicit "no" is a decline.
    const isYes = attending === 'yes' || (!!guestRsvp?.response && guestRsvp.response !== 'no');
    const label = responseStatus?.label || (isYes ? (isRTL ? 'تأكيد الحضور' : 'Attending') : (isRTL ? 'الاعتذار عن الحضور' : 'Declined'));
    const celebration = getCelebrationPreset(event?.template_type);
    return (
      <SectionShell background={C.paper}>
        {/* Confetti only on a fresh submit this session — not every time a
            already-responded guest revisits the locked page. */}
        {submitted && isYes && (
          <ConfettiExplosion active duration={4200} particleCount={110} colors={celebration.colors} shapes={celebration.shapes} spread={1.1} />
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          aria-hidden="true"
          style={{
            width: '76px', height: '76px', borderRadius: '50%', marginBottom: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px',
            background: isYes ? `${C.maroon}14` : 'rgba(160,154,145,0.16)',
          }}
        >
          {isYes ? '🎉' : '💌'}
        </motion.div>

        <SectionHeading isRTL={isRTL}>{isRTL ? 'شكراً لك!' : 'Thank you!'}</SectionHeading>

        <p style={{ fontSize: '15px', color: C.ink, opacity: 0.85, textAlign: 'center', maxWidth: '440px', lineHeight: 1.75 }}>
          {isYes
            ? (isRTL ? 'يسعدنا انضمامكم إلينا — تم تسجيل ردكم بنجاح.' : "We're so happy you'll be joining us — your response is recorded.")
            : (isRTL ? 'شكراً لإعلامنا. سنفتقد وجودكم، ونتمنى لكم كل الخير.' : "Thank you for letting us know — you'll be missed, and we wish you all the best.")}
        </p>

        <div style={{ marginTop: '14px', padding: '9px 20px', borderRadius: '999px', background: C.cream, border: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', color: C.maroon }}>{label}</span>
        </div>

        {isYes && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '22px' }}>
            <CalendarButton event={event} isRTL={isRTL} />
            <ShareButton title={event.title} text={event.description} isRTL={isRTL} />
          </div>
        )}
      </SectionShell>
    );
  }

  return (
    <SectionShell background={C.paper} style={{ paddingBottom: '96px' }}>
      <SectionHeading isRTL={isRTL}>{isRTL ? 'الرد على الدعوة' : 'RSVP'}</SectionHeading>

      <div style={{ width: '100%', maxWidth: '480px', background: C.cream, borderRadius: '20px', border: `1px solid ${C.border}`, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <FormField label={isRTL ? 'الاسم الكامل' : 'Full name'} required error={errors.guestName ? (isRTL ? 'مطلوب' : 'Required') : null}>
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={isRTL ? 'اسمك' : 'Your name'} style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur} />
        </FormField>

        <div>
          <label style={labelStyle}>{isRTL ? 'رقم الهاتف' : 'Phone number'} <span style={{ color: '#C45E5E' }}>*</span></label>
          <PhoneNumberInput value={phone} onChange={setPhone} hasError={!!errors.phone} />
        </div>

        <FormField label={isRTL ? 'البريد الإلكتروني' : 'Email'} required error={errors.email ? (isRTL ? 'مطلوب' : 'Required') : null}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur} />
        </FormField>

        <div>
          <label id="ha-attending-label" style={labelStyle}>{isRTL ? 'هل ستحضر؟' : 'Will you attend?'} <span style={{ color: '#C45E5E' }}>*</span></label>
          <div role="radiogroup" aria-labelledby="ha-attending-label" style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              role="radio"
              aria-checked={attending === 'yes'}
              onClick={() => { setAttending('yes'); clearError('attending'); }}
              style={{ ...pillStyle(attending === 'yes', { full: true }), flex: 1 }}
            >
              ✓ {isRTL ? 'نعم، سأحضر' : "Yes, I'll be there"}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={attending === 'no'}
              onClick={() => { setAttending('no'); clearError('attending'); }}
              style={{ ...pillStyle(attending === 'no', { full: true }), flex: 1 }}
            >
              {isRTL ? 'لا، أعتذر' : "Can't make it"}
            </button>
          </div>
          {errors.attending && <span style={errorTextStyle}>{isRTL ? 'يرجى اختيار إجابة' : 'Please choose an answer'}</span>}
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: C.ink, opacity: 0.85, cursor: 'pointer' }}>
          <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} style={{ marginTop: '2px' }} />
          {isRTL ? 'أوافق على تلقي تحديثات عبر الرسائل النصية حول هذه الفعالية.' : 'I agree to receive SMS updates about this event.'}
        </label>

        {/* "Always Show" custom questions — asked of the primary guest regardless
            of the yes/no choice (companions, who exist only when attending, get
            these in their own blocks below). */}
        {alwaysQuestions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px', paddingTop: '18px', borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.maroon, opacity: 0.9 }}>
              {isRTL ? 'تفاصيل إضافية' : 'A few more details'}
            </span>
            {alwaysQuestions.map((field) => (
              <FormField
                key={field.id}
                label={field.field_label}
                required={field.is_required}
                error={errors[`field_${field.id}`] ? (isRTL ? 'مطلوب' : 'Required') : null}
              >
                {primaryControl(field)}
              </FormField>
            ))}
          </div>
        )}

        {attending === 'yes' && (
          <>
            {/* Meal choice — surfaced immediately after "Yes" (not buried below
                party size / allergies) and rendered as clear selectable pills so
                it's unmistakable. */}
            {mealOptions && mealOptions.length > 0 && (
              <div style={{ padding: '16px', borderRadius: '14px', border: `1px solid ${errors.meal ? '#C45E5E' : `${C.maroon}33`}`, background: `${C.maroon}08` }}>
                <label style={{ ...labelStyle, opacity: 1 }}>🍽 {isRTL ? 'اختر وجبتك' : 'Choose your meal'}{mealField?.is_required && <span style={{ color: '#C45E5E' }}> *</span>}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                  {mealOptions.map((opt) => (
                    <button type="button" key={opt} aria-pressed={meal === opt} onClick={() => { setMeal(opt); clearError('meal'); }} style={pillStyle(meal === opt)}>
                      {opt}
                    </button>
                  ))}
                </div>
                {errors.meal && <span style={errorTextStyle}>{isRTL ? 'يرجى اختيار وجبة' : 'Please select a meal'}</span>}
              </div>
            )}

            <PartySizeStepper value={partySize} onChange={handlePartySizeChange} label={isRTL ? 'عدد الضيوف (بما فيهم أنت)' : 'Number of guests (including yourself)'} isRTL={isRTL} />

            {Array.from({ length: Math.max(0, partySize - 1) }).map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', border: `1px solid ${C.border}`, borderRadius: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: C.maroon }}>{isRTL ? `ضيف ${i + 2}` : `Guest ${i + 2}`}</span>
                <input placeholder={isRTL ? 'الاسم الكامل' : 'Full name'} value={additionalGuests[i]?.fullName || ''} onChange={(e) => updateAdditionalGuest(i, { fullName: e.target.value })} style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur} />
                <input type="email" placeholder="Email" value={additionalGuests[i]?.email || ''} onChange={(e) => updateAdditionalGuest(i, { email: e.target.value })} style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur} />
                <PhoneNumberInput value={additionalGuests[i]?.phone || ''} onChange={(v) => updateAdditionalGuest(i, { phone: v })} />
                {mealOptions && mealOptions.length > 0 && (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: C.ink, opacity: 0.7 }}>🍽 {isRTL ? 'الوجبة' : 'Meal'}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {mealOptions.map((opt) => {
                        const sel = additionalGuests[i]?.mealSelection === opt;
                        return (
                          <button type="button" key={opt} aria-pressed={sel} onClick={() => updateAdditionalGuest(i, { mealSelection: opt })} style={pillStyle(sel, { size: 'sm' })}>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <input
                  placeholder={isRTL ? 'حساسية أو قيود غذائية (اختياري)' : 'Allergies / dietary notes (optional)'}
                  value={additionalGuests[i]?.dietaryNotes || ''} onChange={(e) => updateAdditionalGuest(i, { dietaryNotes: e.target.value })}
                  style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur}
                />
                {/* Per-guest custom questions (scope='guest') — asked of each companion. */}
                {guestScopedQuestions.map((field) => (
                  <FormField
                    key={field.id}
                    label={field.field_label}
                    required={field.is_required}
                    error={errors[`companion_${i}_field_${field.id}`] ? (isRTL ? 'مطلوب' : 'Required') : null}
                  >
                    {companionControl(i, field)}
                  </FormField>
                ))}
              </div>
            ))}

            <div>
              <label style={labelStyle}>⚠ {isRTL ? 'الحساسية وقيود الطعام' : 'Food allergies and intolerances'}</label>
              <p style={{ fontSize: '12px', color: C.ink, opacity: 0.7, margin: '0 0 10px' }}>
                {isRTL ? 'من المهم جدًا معرفة أي قيود غذائية:' : 'It is very important for us to know any dietary restrictions. Select all that apply:'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {ALLERGY_OPTIONS.map((opt) => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: C.ink, cursor: 'pointer' }}>
                    <input type="checkbox" checked={allergies.includes(opt)} onChange={() => toggleAllergy(opt)} />
                    {opt}
                  </label>
                ))}
              </div>
              <input
                placeholder={isRTL ? 'حساسية أخرى أو قيود' : 'Other allergies or restrictions'}
                value={otherAllergy} onChange={(e) => setOtherAllergy(e.target.value)}
                style={{ ...fieldStyle, marginTop: '10px' }} onFocus={onFieldFocus} onBlur={onFieldBlur}
              />
            </div>

            <FormField label={`🎵 ${isRTL ? 'اقتراح أغنية للحفلة' : 'Song request for the party'}`}>
              <input placeholder={isRTL ? 'مثال: أغنية مفضلة' : 'E.g. "Dancing Queen" by ABBA'} value={songRequest} onChange={(e) => setSongRequest(e.target.value)} style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur} />
            </FormField>

            {/* "If Attending" custom questions from the Form Builder — shown only
                to attendees (the 'always' ones already appear above). */}
            {attendingQuestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px', paddingTop: '18px', borderTop: `1px solid ${C.border}` }}>
                <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.maroon, opacity: 0.9 }}>
                  {isRTL ? 'تفاصيل الحضور' : 'A few details for your visit'}
                </span>
                {attendingQuestions.map((field) => (
                  <FormField
                    key={field.id}
                    label={field.field_label}
                    required={field.is_required}
                    error={errors[`field_${field.id}`] ? (isRTL ? 'مطلوب' : 'Required') : null}
                  >
                    {primaryControl(field)}
                  </FormField>
                ))}
              </div>
            )}
          </>
        )}

        <FormField label={isRTL ? 'رسالة للعروسين (اختياري)' : 'Message for the couple (optional)'}>
          <textarea rows={3} placeholder={isRTL ? 'اكتب لنا بضع كلمات...' : 'Write us a few words...'} value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...fieldStyle, resize: 'vertical' }} onFocus={onFieldFocus} onBlur={onFieldBlur} />
        </FormField>

        {Object.keys(errors).length > 0 && (
          <p style={{ fontSize: '12px', color: '#C45E5E', margin: 0 }}>
            {isRTL ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill in all required fields.'}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
            background: submitting ? '#A9A08C' : C.maroon, color: '#FFF', fontWeight: 700, fontSize: '14px',
            cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em',
          }}
        >
          {submitting ? (isRTL ? 'جارٍ الإرسال...' : 'Sending...') : (isRTL ? 'إرسال الرد' : 'Send RSVP')}
        </button>
      </div>
    </SectionShell>
  );
}
