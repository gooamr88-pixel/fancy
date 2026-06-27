'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeInUp, StaggerChildren, StaggerItem, GlowPulse } from '../../../components/guest/GuestAnimations';
import { PremiumButton, FormField, inputFocus, inputBlur } from '../../../components/guest/GuestUI';
import { S } from '../styles';

const INPUT_TYPE_FOR = { email: 'email', phone: 'tel', url: 'url', number: 'number', date: 'date' };

/** Step 4 — organizer-configured custom questions + the free-text note. */
export default function StepCustomQuestions({
  t, isRTL, fields, customAnswers, setAnswer, toggleMultiAnswer,
  notes, setNotes, validationErrors, submitting, onBack, onSubmit,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <FadeInUp y={15}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E' }}>{t.additional_details}</h3>
      </FadeInUp>

      {fields.length > 0 ? (
        <StaggerChildren staggerDelay={0.08}>
          {fields.map(field => {
            const label = isRTL && field.field_label_ar ? field.field_label_ar : field.field_label;
            const opts = isRTL && field.options_ar ? field.options_ar : field.options;
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
                      <option value="">{t.meal_select_placeholder}</option>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
        <button onClick={onBack} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>
        <GlowPulse color="#B8944F" intensity={submitting ? 0 : 0.2}>
          <PremiumButton testId="rsvp-submit" disabled={submitting} loading={submitting} onClick={onSubmit}>
            {submitting ? t.submitting : t.submit_rsvp}
          </PremiumButton>
        </GlowPulse>
      </div>
    </div>
  );
}
