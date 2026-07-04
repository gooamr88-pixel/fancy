'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeInUp, StaggerChildren, StaggerItem, GlowPulse } from '../../../components/guest/GuestAnimations';
import { PremiumButton, FormField, inputFocus, inputBlur } from '../../../components/guest/GuestUI';
import { S } from '../styles';

const INPUT_TYPE_FOR = { email: 'email', phone: 'tel', url: 'url', number: 'number', date: 'date' };

/** Step 4 — organizer-configured custom questions + the free-text note. */
export default function StepCustomQuestions({
  t, isRTL, fields, guestName, companionFields = [], customAnswers, setAnswer, toggleMultiAnswer,
  additionalGuests = [], setCompanionAnswer, toggleCompanionMultiAnswer,
  notes, setNotes, validationErrors, submitting, onBack, onSubmit,
}) {

  /* Renders a set of custom question fields for a given answers object and handlers.
     `fieldSet` lets the companion section render guest-scoped questions (with
     real required/error wiring) instead of always repeating the party-scoped
     `fields` with required hardcoded to false. */
  const renderFields = (fieldSet, answers, onSetAnswer, onToggleMulti, keyPrefix, errorPrefix) => (
    fieldSet.map(field => {
      // NOTE: custom questions have no Arabic-translation mechanism today
      // (custom_form_fields has no field_label_ar/options_ar column) — always
      // show them exactly as the organizer typed them.
      const label = field.field_label;
      const opts = field.options;
      const value = (answers || {})[field.id] || '';
      const fieldKey = `${keyPrefix}_${field.id}`;
      const error = errorPrefix ? validationErrors[`${errorPrefix}_field_${field.id}`] : null;
      const errorStyle = error ? { borderColor: '#ef4444' } : {};

      return (
        <StaggerItem key={fieldKey}>
          <FormField label={label} required={field.is_required} error={error}>
            {['text', 'email', 'phone', 'url', 'number', 'date'].includes(field.field_type) && (
              <input
                type={INPUT_TYPE_FOR[field.field_type] || 'text'}
                value={value}
                onChange={e => onSetAnswer(field.id, e.target.value)}
                style={{ ...S.inputBase, ...errorStyle }}
                onFocus={e => inputFocus(e)}
                onBlur={e => inputBlur(e, !!error)}
              />
            )}
            {field.field_type === 'textarea' && (
              <textarea
                value={value}
                onChange={e => onSetAnswer(field.id, e.target.value)}
                rows={3}
                style={{ ...S.inputBase, ...errorStyle, resize: 'vertical', minHeight: '80px' }}
                onFocus={e => inputFocus(e)}
                onBlur={e => inputBlur(e, !!error)}
              />
            )}
            {field.field_type === 'select' && (
              <select value={value} onChange={e => onSetAnswer(field.id, e.target.value)} style={{ ...S.inputBase, ...errorStyle, cursor: 'pointer' }}>
                <option value="">{t.select_placeholder}</option>
                {opts?.map((opt, i) => (<option key={i} value={opt}>{opt}</option>))}
              </select>
            )}
            {field.field_type === 'radio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {opts?.map((opt, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#191B1E', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    <input type="radio" name={fieldKey} value={opt} checked={value === opt} onChange={() => onSetAnswer(field.id, opt)} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {field.field_type === 'multiselect' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {opts?.map((opt, i) => {
                  const selected = (value || '').split(',').map(s => s.trim()).filter(Boolean).includes(opt);
                  return (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#191B1E', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      <input type="checkbox" checked={selected} onChange={() => onToggleMulti(field.id, opt)} />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}
            {field.field_type === 'checkbox' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#191B1E', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <input type="checkbox" checked={value === 'Yes'} onChange={e => onSetAnswer(field.id, e.target.checked ? 'Yes' : '')} />
                {isRTL ? 'نعم' : 'Yes'}
              </label>
            )}
          </FormField>
        </StaggerItem>
      );
    })
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {fields.length > 0 && (
        <>
          <FadeInUp y={15}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E' }}>{t.additional_details}</h3>
          </FadeInUp>

          <StaggerChildren staggerDelay={0.08}>
            {fields.map(field => {
              const label = field.field_label;
              const opts = field.options;
              const error = validationErrors[`field_${field.id}`];
              const errorStyle = error ? { borderColor: '#ef4444' } : {};
              const value = customAnswers[field.id] || '';

              return (
                <StaggerItem key={field.id}>
                  <FormField label={label} required={field.is_required} error={error}>
                    {['text', 'email', 'phone', 'url', 'number', 'date'].includes(field.field_type) && (
                      <input
                        type={INPUT_TYPE_FOR[field.field_type] || 'text'}
                        value={value}
                        onChange={e => setAnswer(field.id, e.target.value)}
                        style={{ ...S.inputBase, ...errorStyle }}
                        onFocus={e => inputFocus(e)}
                        onBlur={e => inputBlur(e, !!error)}
                      />
                    )}
                    {field.field_type === 'textarea' && (
                      <textarea
                        value={value}
                        onChange={e => setAnswer(field.id, e.target.value)}
                        rows={3}
                        style={{ ...S.inputBase, ...errorStyle, resize: 'vertical', minHeight: '80px' }}
                        onFocus={e => inputFocus(e)}
                        onBlur={e => inputBlur(e, !!error)}
                      />
                    )}
                    {field.field_type === 'select' && (
                      <select value={value} onChange={e => setAnswer(field.id, e.target.value)} style={{ ...S.inputBase, ...errorStyle, cursor: 'pointer' }}>
                        <option value="">{t.select_placeholder}</option>
                        {opts?.map((opt, i) => (<option key={i} value={opt}>{opt}</option>))}
                      </select>
                    )}
                    {field.field_type === 'radio' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {opts?.map((opt, i) => (
                          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#191B1E', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            <input type="radio" name={`field_${field.id}`} value={opt} checked={value === opt} onChange={() => setAnswer(field.id, opt)} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                    {field.field_type === 'multiselect' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {opts?.map((opt, i) => {
                          const selected = (value || '').split(',').map(s => s.trim()).filter(Boolean).includes(opt);
                          return (
                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#191B1E', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                              <input type="checkbox" checked={selected} onChange={() => toggleMultiAnswer(field.id, opt)} />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {field.field_type === 'checkbox' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#191B1E', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        <input type="checkbox" checked={value === 'Yes'} onChange={e => setAnswer(field.id, e.target.checked ? 'Yes' : '')} />
                        {isRTL ? 'نعم' : 'Yes'}
                      </label>
                    )}
                  </FormField>
                </StaggerItem>
              );
            })}
          </StaggerChildren>
        </>
      )}

      {/* ═══ Primary guest's own guest-scoped questions ═══ */}
      {/* Guest-scoped questions ("once per person") were previously only ever
          asked of companions — the primary guest (the person actually filling
          out the form) was never asked their own answer at all, and a
          required guest-scoped question was silently unenforced whenever a
          guest RSVP'd solo. This mirrors how Meal Selection already asks the
          primary guest unconditionally, then loops over companions. Answers
          share the same `customAnswers` bucket as party-scoped `fields` —
          field IDs never collide between scopes. */}
      {companionFields.length > 0 && (
        <FadeInUp y={12}>
          <div style={{
            border: '1px solid #F0ECE3', borderRadius: '14px', padding: '18px 16px',
            background: 'rgba(248,244,236,0.45)',
          }}>
            <h4 style={{
              fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 500,
              color: '#191B1E', marginBottom: '14px', paddingBottom: '10px',
              borderBottom: '1px solid #F0ECE3',
            }}>
              {guestName || (isRTL ? 'إجاباتك' : 'Your Answers')}
            </h4>
            <StaggerChildren staggerDelay={0.06}>
              {renderFields(companionFields, customAnswers, setAnswer, toggleMultiAnswer, 'primary', 'primary')}
            </StaggerChildren>
          </div>
        </FadeInUp>
      )}

      {/* ═══ Companion custom questions (guest-scoped only) ═══ */}
      {companionFields.length > 0 && additionalGuests.length > 0 && additionalGuests.map((guest, gIdx) => (
        <FadeInUp key={guest.id || gIdx} y={12} delay={0.1 * (gIdx + 1)}>
          <div style={{
            border: '1px solid #F0ECE3', borderRadius: '14px', padding: '18px 16px',
            background: 'rgba(248,244,236,0.45)',
          }}>
            <h4 style={{
              fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 500,
              color: '#191B1E', marginBottom: '14px', paddingBottom: '10px',
              borderBottom: '1px solid #F0ECE3',
            }}>
              {guest.fullName || `${isRTL ? 'ضيف' : 'Guest'} ${gIdx + 2}`}
            </h4>
            <StaggerChildren staggerDelay={0.06}>
              {renderFields(
                companionFields,
                guest.customAnswers,
                (fieldId, value) => setCompanionAnswer(gIdx, fieldId, value),
                (fieldId, opt) => toggleCompanionMultiAnswer(gIdx, fieldId, opt),
                `companion_${gIdx}`,
                `companion_${gIdx}`,
              )}
            </StaggerChildren>
          </div>
        </FadeInUp>
      ))}

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

      <AnimatePresence>
        {Object.keys(validationErrors).length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', fontSize: '12px', color: '#ef4444' }}
          >
            ⚠️ {isRTL ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill in all required fields before submitting.'}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', justifyContent: onBack ? 'space-between' : 'flex-end', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
        {onBack && <button onClick={onBack} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>}
        <GlowPulse color="#B8944F" intensity={submitting ? 0 : 0.2}>
          <PremiumButton testId="rsvp-submit" disabled={submitting} loading={submitting} onClick={onSubmit}>
            {submitting ? t.submitting : t.submit_rsvp}
          </PremiumButton>
        </GlowPulse>
      </div>
    </div>
  );
}
