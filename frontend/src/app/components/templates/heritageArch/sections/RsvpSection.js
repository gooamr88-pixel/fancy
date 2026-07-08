'use client';

import React, { useState } from 'react';
import { PartySizeStepper, FormField } from '../../../guest/GuestUI';
import PhoneNumberInput from '../../../PhoneNumberInput';
import { useIdempotentRsvpSubmit } from '../../../guest/rsvp/useIdempotentRsvpSubmit';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading } from '../shared';

const ALLERGY_OPTIONS = ['Gluten-free / Celiac', 'Lactose-free', 'Nut allergy', 'Seafood'];

export default function RsvpSection({ event, slug, guestRsvp, hasResponded, responseStatus, allowGuestEdits, effectiveRsvpId, mealOptions, isRTL, trackEvent }) {
  const C = useFullPageTheme();
  // Defined inside the component so they read the themed palette (C).
  const fieldStyle = {
    width: '100%', boxSizing: 'border-box', padding: '13px 15px',
    background: C.cream, border: `1px solid ${C.border}`, borderRadius: '10px',
    fontSize: '14px', color: C.ink, outline: 'none', fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.2s ease',
  };
  const onFieldFocus = (e) => { e.target.style.borderColor = C.maroon; };
  const onFieldBlur = (e) => { e.target.style.borderColor = C.border; };
  const labelStyle = { fontSize: '12px', fontWeight: 700, color: C.ink, opacity: 0.75, display: 'block', marginBottom: '6px' };
  const locked = hasResponded && !allowGuestEdits;

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
      }
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
      additionalGuests: attending === 'yes' ? additionalGuests.slice(0, partySize - 1) : [],
      customAnswers: [],
      smsConsent,
    };

    trackEvent?.('rsvp_started');
    await submit({ url: `/public/events/${slug}/rsvp`, body, reconcileId: body.partyId });
  };

  if (locked || submitted) {
    const label = responseStatus?.label || (attending === 'yes' ? (isRTL ? 'الحضور' : 'Attending') : (isRTL ? 'الاعتذار' : 'Declined'));
    return (
      <SectionShell background={C.paper}>
        <SectionHeading isRTL={isRTL}>{isRTL ? 'شكراً لك!' : 'Thank you!'}</SectionHeading>
        <p style={{ fontSize: '15px', color: C.ink, opacity: 0.85, textAlign: 'center' }}>
          {isRTL ? 'تم تسجيل ردكم:' : 'Your response has been recorded:'} <strong style={{ color: C.maroon }}>{label}</strong>
        </p>
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
          <label style={labelStyle}>{isRTL ? 'هل ستحضر؟' : 'Will you attend?'} <span style={{ color: '#C45E5E' }}>*</span></label>
          <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: C.ink, cursor: 'pointer' }}>
              <input type="radio" name="ha-attending" checked={attending === 'yes'} onChange={() => setAttending('yes')} />
              {isRTL ? 'نعم، سأحضر' : 'Yes, I will attend'}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: C.ink, cursor: 'pointer' }}>
              <input type="radio" name="ha-attending" checked={attending === 'no'} onChange={() => setAttending('no')} />
              {isRTL ? 'لا، أعتذر' : "No, I can't attend"}
            </label>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: C.ink, opacity: 0.85, cursor: 'pointer' }}>
          <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} style={{ marginTop: '2px' }} />
          {isRTL ? 'أوافق على تلقي تحديثات عبر الرسائل النصية حول هذه الفعالية.' : 'I agree to receive SMS updates about this event.'}
        </label>

        {attending === 'yes' && (
          <>
            <PartySizeStepper value={partySize} onChange={handlePartySizeChange} label={isRTL ? 'عدد الضيوف (بما فيهم أنت)' : 'Number of guests (including yourself)'} isRTL={isRTL} />

            {Array.from({ length: Math.max(0, partySize - 1) }).map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', border: `1px solid ${C.border}`, borderRadius: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: C.maroon }}>{isRTL ? `ضيف ${i + 2}` : `Guest ${i + 2}`}</span>
                <input placeholder={isRTL ? 'الاسم الكامل' : 'Full name'} value={additionalGuests[i]?.fullName || ''} onChange={(e) => updateAdditionalGuest(i, { fullName: e.target.value })} style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur} />
                <input type="email" placeholder="Email" value={additionalGuests[i]?.email || ''} onChange={(e) => updateAdditionalGuest(i, { email: e.target.value })} style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur} />
                <PhoneNumberInput value={additionalGuests[i]?.phone || ''} onChange={(v) => updateAdditionalGuest(i, { phone: v })} />
                {mealOptions && mealOptions.length > 0 && (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: C.ink, opacity: 0.7 }}>{isRTL ? 'الوجبة الرئيسية' : 'Main'}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                      {mealOptions.map((opt) => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: C.ink, cursor: 'pointer' }}>
                          <input type="radio" name={`ha-meal-${i}`} checked={additionalGuests[i]?.mealSelection === opt} onChange={() => updateAdditionalGuest(i, { mealSelection: opt })} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <input
                  placeholder={isRTL ? 'حساسية أو قيود غذائية (اختياري)' : 'Allergies / dietary notes (optional)'}
                  value={additionalGuests[i]?.dietaryNotes || ''} onChange={(e) => updateAdditionalGuest(i, { dietaryNotes: e.target.value })}
                  style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur}
                />
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

            {mealOptions && mealOptions.length > 0 && (
              <div>
                <label style={labelStyle}>{isRTL ? 'الوجبة الرئيسية' : 'Main'}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {mealOptions.map((opt) => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: C.ink, cursor: 'pointer' }}>
                      <input type="radio" name="ha-meal" checked={meal === opt} onChange={() => setMeal(opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <FormField label={`🎵 ${isRTL ? 'اقتراح أغنية للحفلة' : 'Song request for the party'}`}>
              <input placeholder={isRTL ? 'مثال: أغنية مفضلة' : 'E.g. "Dancing Queen" by ABBA'} value={songRequest} onChange={(e) => setSongRequest(e.target.value)} style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur} />
            </FormField>
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
