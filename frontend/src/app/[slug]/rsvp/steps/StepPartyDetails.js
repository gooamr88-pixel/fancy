'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeInUp, StaggerChildren, StaggerItem } from '../../../components/guest/GuestAnimations';
import { PremiumButton, PartySizeStepper, FormField, inputFocus, inputBlur } from '../../../components/guest/GuestUI';
import { S } from '../styles';

const MAYBE_OPTIONS = [
  { value: '24 Hours', icon: '⚡', labelEn: 'Within 24 Hours', labelAr: 'خلال ٢٤ ساعة', subEn: "I'll know very soon", subAr: 'سأعلمكم قريباً جداً' },
  { value: '3 Days', icon: '📅', labelEn: 'Within 3 Days', labelAr: 'خلال ٣ أيام', subEn: 'I need a short while to confirm', subAr: 'أحتاج وقت قصير للتأكد' },
  { value: '1 Week', icon: '🗓️', labelEn: 'Within 1 Week', labelAr: 'خلال أسبوع', subEn: "I'm working out some details", subAr: 'أنتظر ترتيب بعض الأمور' },
];

const DECLINE_REASONS = [
  { value: 'Travel', icon: '✈️', labelEn: 'Travel Commitment', labelAr: 'ارتباط بسفر' },
  { value: 'Schedule Conflict', icon: '📋', labelEn: 'Schedule Conflict', labelAr: 'تعارض في الجدول' },
  { value: 'Health', icon: '🏥', labelEn: 'Health Reasons', labelAr: 'أسباب صحية' },
  { value: 'Other', icon: '💭', labelEn: 'Other Reasons', labelAr: 'أسباب أخرى' },
];

/** Step 3 (attending=yes: party details) / 3B (maybe: follow-up) / 3C (no: decline reason). */
export default function StepPartyDetails({
  t, isRTL, attending,
  partySize, setPartySize, mealField, primaryMeal, setPrimaryMeal,
  additionalGuests, setAdditionalGuests, email, setEmail, phone, setPhone,
  validationErrors, isContinueDisabled, onBack, onContinue,
  maybeFollowUp, setMaybeFollowUp, declineReason, setDeclineReason,
}) {
  if (attending === 'maybe') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <FadeInUp y={15}>
          <div style={{ textAlign: 'center' }}>
            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>🤔</motion.span>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E', lineHeight: 1.4 }}>
              {isRTL ? 'متى يمكننا توقع تأكيدك؟' : 'When can we expect your confirmation?'}
            </h3>
            <p style={{ fontSize: '13px', color: '#77736A', marginTop: '6px' }}>
              {isRTL ? 'حتى نتمكن من المتابعة معك' : "So we can follow up with you at the right time"}
            </p>
          </div>
        </FadeInUp>

        <StaggerChildren staggerDelay={0.1}>
          {MAYBE_OPTIONS.map(opt => (
            <StaggerItem key={opt.value}>
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMaybeFollowUp(opt.value)}
                animate={maybeFollowUp === opt.value ? { borderColor: '#6366f1', boxShadow: '0 0 25px rgba(99,102,241,0.15)' } : { borderColor: '#E8E2D6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                style={{
                  width: '100%', padding: '20px',
                  border: `2px solid ${maybeFollowUp === opt.value ? '#6366f1' : '#E8E2D6'}`,
                  borderRadius: '14px', cursor: 'pointer',
                  background: maybeFollowUp === opt.value ? 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(99,102,241,0.02))' : '#FFFFFF',
                  fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '16px',
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                <span style={{ fontSize: '28px', flexShrink: 0 }}>{opt.icon}</span>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '14px', display: 'block', color: maybeFollowUp === opt.value ? '#6366f1' : '#191B1E' }}>
                    {isRTL ? opt.labelAr : opt.labelEn}
                  </span>
                  <span style={{ fontSize: '12px', color: '#77736A', marginTop: '2px', display: 'block' }}>
                    {isRTL ? opt.subAr : opt.subEn}
                  </span>
                </div>
                {maybeFollowUp === opt.value && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    style={{ marginLeft: 'auto', width: '24px', height: '24px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </motion.div>
                )}
              </motion.button>
            </StaggerItem>
          ))}
        </StaggerChildren>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
          <button onClick={onBack} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>
          <PremiumButton disabled={!maybeFollowUp} onClick={onContinue}>{t.continue}</PremiumButton>
        </div>
      </div>
    );
  }

  if (attending === 'no') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <FadeInUp y={15}>
          <div style={{ textAlign: 'center' }}>
            <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }} style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>💌</motion.span>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E', lineHeight: 1.4 }}>
              {isRTL ? 'نتفهم ذلك ونتمنى لك كل الخير' : 'We understand and wish you well'}
            </h3>
            <p style={{ fontSize: '13px', color: '#77736A', marginTop: '6px', lineHeight: 1.6 }}>
              {isRTL ? 'لو تكرمت بإخبارنا بالسبب (اختياري)' : 'Would you mind sharing the reason? (optional)'}
            </p>
          </div>
        </FadeInUp>

        <StaggerChildren staggerDelay={0.08}>
          {DECLINE_REASONS.map(reason => (
            <StaggerItem key={reason.value}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDeclineReason(reason.value)}
                animate={declineReason === reason.value ? { borderColor: '#ef4444', boxShadow: '0 0 20px rgba(239,68,68,0.1)' } : { borderColor: '#E8E2D6', boxShadow: 'none' }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                style={{
                  width: '100%', padding: '16px 20px',
                  border: `2px solid ${declineReason === reason.value ? '#ef4444' : '#E8E2D6'}`,
                  borderRadius: '14px', cursor: 'pointer',
                  background: declineReason === reason.value ? 'linear-gradient(135deg, rgba(239,68,68,0.04), rgba(239,68,68,0.01))' : '#FFFFFF',
                  fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '14px',
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                <span style={{ fontSize: '22px' }}>{reason.icon}</span>
                <span style={{ fontWeight: 600, fontSize: '14px', color: declineReason === reason.value ? '#ef4444' : '#191B1E' }}>
                  {isRTL ? reason.labelAr : reason.labelEn}
                </span>
                {declineReason === reason.value && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    style={{ marginLeft: 'auto', width: '22px', height: '22px', borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </motion.div>
                )}
              </motion.button>
            </StaggerItem>
          ))}
        </StaggerChildren>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
          <button onClick={onBack} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>
          <PremiumButton onClick={onContinue}>{t.continue}</PremiumButton>
        </div>
      </div>
    );
  }

  // attending === 'yes'
  const mealOptions = isRTL && mealField?.options_ar ? mealField.options_ar : mealField?.options;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <FadeInUp y={15}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E' }}>{t.party_details}</h3>
      </FadeInUp>

      <FadeInUp delay={0.1} y={15}>
        <PartySizeStepper value={partySize} onChange={setPartySize} label={t.party_size_label} isRTL={isRTL} />
      </FadeInUp>

      {mealField && (
        <FadeInUp delay={0.2} y={15}>
          <div style={{ background: '#F8F4EC', padding: '20px', borderRadius: '14px' }}>
            <FormField label={(isRTL && mealField.field_label_ar ? mealField.field_label_ar : mealField.field_label).replace('{name}', '')}>
              <select value={primaryMeal} onChange={e => setPrimaryMeal(e.target.value)} style={{ ...S.inputBase, cursor: 'pointer' }}>
                <option value="">{t.meal_select_placeholder}</option>
                {mealOptions?.map((opt, i) => (<option key={i} value={opt}>{opt}</option>))}
              </select>
            </FormField>
          </div>
        </FadeInUp>
      )}

      <AnimatePresence>
        {additionalGuests.map((g, index) => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
            style={{ padding: '20px', border: '1px solid #E8E2D6', borderRadius: '14px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '12px' }}
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
            {mealField && (
              <FormField label={t.guest_meal_label}>
                <select
                  value={g.mealSelection}
                  onChange={e => { const copy = [...additionalGuests]; copy[index].mealSelection = e.target.value; setAdditionalGuests(copy); }}
                  style={{ ...S.inputBase, cursor: 'pointer' }}
                >
                  <option value="">{t.meal_select_placeholder}</option>
                  {mealOptions?.map((opt, i) => (<option key={i} value={opt}>{opt}</option>))}
                </select>
              </FormField>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      <FadeInUp delay={0.15} y={15}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
          <FormField label={t.email_label} error={validationErrors.email}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" style={S.inputBase}
              onFocus={e => inputFocus(e)} onBlur={e => inputBlur(e, !!validationErrors.email)} />
          </FormField>
          <FormField label={t.phone_label} error={validationErrors.phone}>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" style={S.inputBase}
              onFocus={e => inputFocus(e)} onBlur={e => inputBlur(e, !!validationErrors.phone)} />
          </FormField>
        </div>
      </FadeInUp>

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
        <button onClick={onBack} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>
        <PremiumButton testId="rsvp-next" disabled={isContinueDisabled} onClick={onContinue}>{t.continue}</PremiumButton>
      </div>
    </div>
  );
}
