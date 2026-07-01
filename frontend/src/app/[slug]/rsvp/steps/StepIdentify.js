'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FadeInUp, StaggerChildren, StaggerItem, ShimmerPlaceholder } from '../../../components/guest/GuestAnimations';
import { PremiumButton, FormField, inputFocus, inputBlur } from '../../../components/guest/GuestUI';
import { S } from '../styles';
import SeatingResultPanel from './SeatingResultPanel';
import PremiumEnvelopeIcon from '../../../components/guest/PremiumEnvelopeIcon';

/** Step 1 — find your invitation by name, or "Already RSVP'd? Find your table". */
export default function StepIdentify({
  t, isRTL, guestName, setGuestName, validationErrors, setValidationErrors,
  searchApi, onSelectResult, onContinueNew, seatingApi, seatingRevealed,
  showTableLookup, setShowTableLookup,
}) {
  const { searching, searchPerformed, searchResults, search } = searchApi;
  const { verifyName, setVerifyName, verifyLast4, setVerifyLast4, verifying, verifyFailed, setVerifyFailed, seatingView, setSeatingView, seatingLoading, verifyTable } = seatingApi;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <FadeInUp delay={0.1} y={20}>
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <PremiumEnvelopeIcon />
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 500, color: '#191B1E', lineHeight: 1.5 }}>
            {isRTL ? 'يسعدنا دعوتك للاحتفال معنا' : 'We would be honored by your presence'}
          </h3>
          <p style={{ fontSize: '13px', color: '#77736A', marginTop: '4px', lineHeight: 1.6 }}>
            {isRTL ? 'يرجى إدخال اسمك للبدء في تأكيد الحضور' : 'Please enter your name to begin your RSVP'}
          </p>
        </div>
      </FadeInUp>

      <FormField label={t.enter_name} error={validationErrors.guestName}>
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
            style={{ ...S.inputBase, flex: 1, ...(validationErrors.guestName ? { borderColor: '#ef4444' } : {}) }}
            onFocus={e => inputFocus(e)}
            onBlur={e => inputBlur(e, !!validationErrors.guestName)}
            onKeyDown={e => { if (e.key === 'Enter' && !searchPerformed) search(guestName); }}
          />
          {!searchPerformed && (
            <PremiumButton testId="rsvp-search" disabled={!guestName.trim() || searching} onClick={() => search(guestName)} loading={searching} size="md">
              {isRTL ? 'متابعة' : 'Continue'}
            </PremiumButton>
          )}
        </div>
      </FormField>

      {searching && (
        <FadeInUp y={10}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
            <ShimmerPlaceholder height="56px" borderRadius="12px" />
            <ShimmerPlaceholder height="56px" borderRadius="12px" />
            <p style={{ color: '#77736A', fontSize: '13px', textAlign: 'center' }}>
              {isRTL ? 'جاري التحقق...' : 'Just a moment...'}
            </p>
          </div>
        </FadeInUp>
      )}

      {searchPerformed && !searching && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
          {searchResults.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: '#77736A', fontWeight: 500 }}>
                {isRTL ? 'لقد وجدنا دعوة باسمك! يرجى اختيارها للمتابعة:' : 'Welcome back! Please select your invitation to continue:'}
              </p>
              <StaggerChildren staggerDelay={0.08}>
                {searchResults.map((result, i) => {
                  // The backend withholds `id` for organizer-imported guests with no
                  // email on file (anti-hijacking — see searchPartiesPublic). Selecting
                  // such a card can't actually attach to that record, so it must NOT
                  // behave like a normal selectable result (that silently created a
                  // duplicate RSVP). Show it as a locked match instead.
                  const unclaimable = !result.id;
                  return (
                    <StaggerItem key={result.id || `${result.guestName}-${i}`}>
                      {unclaimable ? (
                        <div style={{
                          width: '100%', textAlign: isRTL ? 'right' : 'left',
                          padding: '16px', border: '1px dashed #E8E2D6', borderRadius: '14px',
                          background: '#FAFAF8', display: 'flex', flexDirection: 'column', gap: '6px',
                          fontFamily: 'var(--font-sans)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: '#77736A', fontSize: '14px' }}>
                              {result.guestName}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', background: '#F0ECE3', borderRadius: '8px', color: '#A09A91' }}>
                              {isRTL ? `مرافقين: ${result.partySize}` : `Party: ${result.partySize}`}
                            </span>
                          </div>
                          <span style={{ fontSize: '11.5px', color: '#A09A91', lineHeight: 1.5 }}>
                            🔒 {isRTL
                              ? 'لإثبات الهوية، يرجى استخدام الرابط الشخصي المُرسل إليك من المنظّم لتحديث هذه الدعوة.'
                              : 'For security, please use the personal link sent to you by the host to update this invitation.'}
                          </span>
                        </div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.01, borderColor: '#B8944F' }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => onSelectResult(result)}
                          style={{
                            width: '100%', textAlign: isRTL ? 'right' : 'left',
                            padding: '16px', border: '1px solid #E8E2D6', borderRadius: '14px',
                            background: '#FFFFFF', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#191B1E', fontSize: '14px' }}>
                            {result.guestName}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', background: '#F8F4EC', borderRadius: '8px', color: '#77736A' }}>
                            {isRTL ? `مرافقين: ${result.partySize}` : `Party: ${result.partySize}`}
                          </span>
                        </motion.button>
                      )}
                    </StaggerItem>
                  );
                })}
              </StaggerChildren>
              <button
                onClick={onContinueNew}
                style={{ fontSize: '13px', color: '#B8944F', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', textDecoration: 'underline', fontFamily: 'var(--font-sans)', padding: '4px' }}
              >
                {isRTL ? 'لست أنا (المتابعة كضيف جديد)' : "That's not me (Continue as a new guest)"}
              </button>
            </div>
          ) : (
            <FadeInUp y={10}>
              <div style={{ fontSize: '13px', color: '#77736A', background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.2)', padding: '16px', borderRadius: '12px' }}>
                {isRTL
                  ? `أهلاً بك، ${guestName}! يرجى المتابعة لإتمام تأكيد الحضور.`
                  : `Welcome, ${guestName}! Please continue to complete your RSVP.`}
              </div>
              <PremiumButton testId="rsvp-continue-new" fullWidth onClick={onContinueNew} style={{ marginTop: '12px' }}>
                {isRTL ? 'متابعة' : 'Continue'}
              </PremiumButton>
            </FadeInUp>
          )}
        </motion.div>
      )}

      {/* Find my table — hidden until the 24h seating reveal window opens */}
      {seatingRevealed && (
      <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
        {!showTableLookup ? (
          <button onClick={() => setShowTableLookup(true)} style={{ ...S.backBtn, color: '#B8944F', fontWeight: 600 }}>
            {isRTL ? 'هل سجّلت بالفعل؟ ابحث عن طاولتك' : "Already RSVP'd? Find your table"}
          </button>
        ) : (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {seatingView ? (
              <SeatingResultPanel view={seatingView} loading={seatingLoading} isRTL={isRTL} onBack={() => { setSeatingView(null); setVerifyFailed(false); }} />
            ) : (
              <>
                <label style={S.labelBase}>
                  {isRTL ? 'للتحقق من هويتك، أدخل اسمك وآخر 4 أرقام من موبايلك' : 'To verify it’s you, enter your name and the last 4 digits of your phone'}
                </label>
                <input
                  type="text" value={verifyName}
                  onChange={e => { setVerifyName(e.target.value); if (verifyFailed) setVerifyFailed(false); }}
                  placeholder={t.name_placeholder}
                  style={{ ...S.inputBase, width: '100%' }}
                  onFocus={e => inputFocus(e)} onBlur={e => inputBlur(e)}
                  onKeyDown={e => { if (e.key === 'Enter') verifyTable(); }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text" inputMode="numeric" maxLength={4} value={verifyLast4}
                    onChange={e => { setVerifyLast4(e.target.value.replace(/\D/g, '').slice(0, 4)); if (verifyFailed) setVerifyFailed(false); }}
                    placeholder={isRTL ? 'آخر 4 أرقام' : 'Last 4 digits'}
                    style={{ ...S.inputBase, flex: 1, letterSpacing: '0.3em', textAlign: 'center' }}
                    onFocus={e => inputFocus(e)} onBlur={e => inputBlur(e)}
                    onKeyDown={e => { if (e.key === 'Enter') verifyTable(); }}
                  />
                  <PremiumButton disabled={!verifyName.trim() || verifyLast4.length !== 4 || verifying} onClick={verifyTable} loading={verifying} size="md">
                    {isRTL ? 'عرض طاولتي' : 'Show my table'}
                  </PremiumButton>
                </div>
                {verifyFailed && (
                  <p style={{ fontSize: '13px', color: '#77736A', background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.2)', padding: '12px 14px', borderRadius: '12px' }}>
                    {isRTL
                      ? 'تعذّر التحقق من بياناتك. تأكّد من كتابة اسمك كما هو في الدعوة وآخر 4 أرقام من موبايلك، أو تواصل مع المنظّم.'
                      : "We couldn't verify your details. Make sure your name matches your invitation and the last 4 digits are correct, or contact the host."}
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}
      </div>
      )}
    </div>
  );
}
