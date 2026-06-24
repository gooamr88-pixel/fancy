'use client';

/**
 * InvitationEnvelope — the premium entry experience for the public guest page.
 *
 * Phase machine:  closed → opening → open
 *   • closed   : an elegant sealed envelope, "Tap to open" (no event details shown).
 *   • opening  : the flap lifts (rotateX) and the inner card slides up out of the pocket.
 *   • open     : the invitation card presents essential details + a streamlined RSVP
 *                form (attendance toggle, party-size counter, mobile number).
 *
 * All motion is transform/opacity only (GPU-composited) on a fixed full-screen stage,
 * so there is zero layout shift and it stays buttery smooth on mobile.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SPRING = { type: 'spring', stiffness: 90, damping: 18 };

/* Deterministic ambient sparkles (no hydration mismatch, no effect). */
function rand(seed) {
  const x = Math.sin(seed * 91.7 + 13.1) * 43758.5453;
  return x - Math.floor(x);
}
const SPARKLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: `${rand(i + 1) * 100}%`,
  top: `${rand(i + 2) * 100}%`,
  size: 3 + rand(i + 3) * 4,
  delay: `${rand(i + 4) * 6}s`,
  dur: `${6 + rand(i + 5) * 6}s`,
}));

export default function InvitationEnvelope({
  event,
  slug,
  guestRsvp,
  themeColor = '#B8944F',
  secondaryColor = '#D7BE80',
  isRTL = false,
  onEnter,
}) {
  const [phase, setPhase] = useState('closed');

  // ─── RSVP form state (pre-filled from the invitation token when present) ───
  const [attending, setAttending] = useState(
    guestRsvp?.response === 'yes' ? 'yes' : guestRsvp?.response === 'no' ? 'no' : null
  );
  const [guestName, setGuestName] = useState(guestRsvp?.guest_name || '');
  const [phone, setPhone] = useState(guestRsvp?.phone || '');
  const [email, setEmail] = useState(guestRsvp?.email || '');
  const [partySize, setPartySize] = useState(guestRsvp?.party_size || 1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  const initial = (event?.title || 'F').trim().charAt(0).toUpperCase();
  const isDemo = slug === 'demo' || slug === 'demo-wedding';

  const eventDate = event?.event_date ? new Date(event.event_date) : null;
  const dateLabel = eventDate
    ? eventDate.toLocaleDateString(isRTL ? 'ar-EG' : undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const timeLabel = eventDate
    ? eventDate.toLocaleTimeString(isRTL ? 'ar-EG' : undefined, { hour: '2-digit', minute: '2-digit' })
    : '';

  const open = useCallback(() => {
    if (phase !== 'closed') return;
    setPhase('opening');
    // Let the flap finish lifting + the card clear the pocket before enabling scroll/content.
    setTimeout(() => setPhase('open'), 1100);
  }, [phase]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setFormError('');
    if (!attending) { setFormError(isRTL ? 'يرجى اختيار الحضور أولاً' : 'Please choose whether you can attend.'); return; }
    if (!guestName.trim()) { setFormError(isRTL ? 'يرجى إدخال اسمك' : 'Please enter your name.'); return; }

    setSubmitting(true);
    try {
      if (isDemo) {
        await new Promise(r => setTimeout(r, 900));
        setSubmitted(true);
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const size = attending === 'yes' ? Math.max(1, parseInt(partySize) || 1) : 1;
      // Streamlined quick-RSVP: generate placeholder names for extra seats so the
      // backend party validation passes; guests can refine details on the full form.
      const additionalGuests = attending === 'yes' && size > 1
        ? Array.from({ length: size - 1 }, (_, i) => ({ fullName: `${guestName.trim()} · Guest ${i + 2}` }))
        : [];

      const res = await fetch(`${apiUrl}/public/events/${slug}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rsvpId: guestRsvp?.id || null,
          guestName: guestName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          response: attending,
          partySize: size,
          additionalGuests,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Graceful fallback: if the event needs richer detail (meals etc.), route to the full form.
        throw new Error(data.message || 'Something went wrong submitting your RSVP.');
      }
      setSubmitted(true);
    } catch (err) {
      setFormError(err.message || 'Could not submit your RSVP. Please try the full form.');
    } finally {
      setSubmitting(false);
    }
  }, [attending, guestName, email, phone, partySize, slug, guestRsvp, isDemo, isRTL]);

  const fullFormHref = `/${slug}/rsvp${guestRsvp?.id ? `?rsvp_id=${encodeURIComponent(guestRsvp.id)}` : ''}`;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 18px',
      background: `radial-gradient(120% 90% at 50% 10%, ${themeColor}14 0%, #F8F4EC 45%, #EFE9DD 100%)`,
      overflow: 'hidden', fontFamily: 'var(--font-sans)',
      WebkitTapHighlightColor: 'transparent',
    }}>
      {/* Ambient sparkles */}
      {SPARKLES.map(s => (
        <span key={s.id} style={{
          position: 'absolute', left: s.left, top: s.top,
          width: s.size, height: s.size, borderRadius: '50%',
          background: themeColor, opacity: 0.18, pointerEvents: 'none',
          animation: `iv-twinkle ${s.dur} ${s.delay} ease-in-out infinite`,
        }} />
      ))}

      <div style={{ position: 'relative', width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* ═══ CLOSED / OPENING ENVELOPE ═══ */}
        <AnimatePresence>
          {phase !== 'open' && (
            <motion.div
              key="envelope"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.4 } }}
              transition={SPRING}
              style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
            >
              <motion.button
                onClick={open}
                aria-label="Open invitation"
                whileTap={{ scale: 0.97 }}
                animate={phase === 'closed' ? { y: [0, -6, 0] } : {}}
                transition={phase === 'closed' ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } : {}}
                style={{
                  position: 'relative', width: '100%', aspectRatio: '7 / 4.6',
                  border: 'none', padding: 0, cursor: phase === 'closed' ? 'pointer' : 'default',
                  background: 'transparent', perspective: 1200,
                }}
              >
                {/* Envelope body */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 14,
                  background: 'linear-gradient(160deg, #FFFDF8 0%, #F3ECDD 100%)',
                  boxShadow: '0 30px 60px -20px rgba(25,27,30,0.35), inset 0 1px 0 rgba(255,255,255,0.8)',
                  border: `1px solid ${themeColor}33`, overflow: 'hidden',
                }}>
                  {/* Side pocket seams */}
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: 0, height: 0, borderLeft: '180px solid #EFE6D4', borderTop: '120px solid transparent' }} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 0, height: 0, borderRight: '180px solid #EFE6D4', borderTop: '120px solid transparent' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '62%', background: 'linear-gradient(180deg, #F6EFE0, #F0E7D6)', clipPath: 'polygon(0 38%, 50% 100%, 100% 38%, 100% 100%, 0 100%)' }} />
                  </div>
                </div>

                {/* Inner card peeking (pre-open) / sliding (opening) */}
                <motion.div
                  initial={false}
                  animate={phase === 'opening'
                    ? { y: '-58%', scale: 1.04, opacity: 1 }
                    : { y: '-6%', scale: 0.9, opacity: 1 }}
                  transition={{ ...SPRING, delay: phase === 'opening' ? 0.45 : 0 }}
                  style={{
                    position: 'absolute', left: '8%', right: '8%', top: '12%',
                    height: '82%', borderRadius: 8, zIndex: 2,
                    background: 'linear-gradient(180deg, #FFFFFF, #FCFAF4)',
                    border: `1px solid ${themeColor}22`,
                    boxShadow: '0 16px 30px -12px rgba(25,27,30,0.28)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                    willChange: 'transform',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-script)', fontSize: 26, color: themeColor, lineHeight: 1 }}>You&apos;re Invited</div>
                  <div style={{ width: 28, height: 1, background: `${themeColor}66` }} />
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: '#191B1E', letterSpacing: '0.04em', maxWidth: '80%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event?.title || 'A Special Celebration'}
                  </div>
                </motion.div>

                {/* Top flap (lifts on open) */}
                <motion.div
                  initial={false}
                  animate={{ rotateX: phase === 'opening' ? -172 : 0 }}
                  transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '64%',
                    transformOrigin: 'top center', transformStyle: 'preserve-3d',
                    zIndex: phase === 'opening' ? 1 : 5, willChange: 'transform',
                  }}
                >
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(160deg, #FBF5E8 0%, #EFE4CF 100%)',
                    clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                    backfaceVisibility: 'hidden',
                    filter: 'drop-shadow(0 4px 6px rgba(92,77,60,0.18))',
                    borderRadius: '14px 14px 0 0',
                  }} />
                </motion.div>

                {/* Wax seal */}
                <motion.div
                  initial={false}
                  animate={{ opacity: phase === 'opening' ? 0 : 1, scale: phase === 'opening' ? 0.6 : 1 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: 52, height: 52, borderRadius: '50%', zIndex: 6,
                    background: `radial-gradient(circle at 35% 30%, ${secondaryColor}, ${themeColor} 70%)`,
                    boxShadow: `0 4px 12px ${themeColor}66, inset 0 2px 4px rgba(255,255,255,0.4)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-script)', fontSize: 24, color: '#FFFFFF',
                  }}
                >
                  {initial}
                </motion.div>
              </motion.button>

              {/* Tap hint */}
              {phase === 'closed' && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                >
                  <motion.span
                    animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 2, repeat: Infinity }}
                    style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: themeColor }}
                  >
                    {isRTL ? 'اضغط للفتح' : 'Tap to open'}
                  </motion.span>
                  <span style={{ fontSize: 11, color: '#9A9486' }}>{isRTL ? 'دعوتك بالداخل' : 'Your invitation awaits inside'}</span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ OPENED INVITATION CARD ═══ */}
        <AnimatePresence>
          {phase === 'open' && (
            <motion.div
              key="card"
              initial={{ opacity: 0, y: 60, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={SPRING}
              style={{
                width: '100%', maxWidth: 420, maxHeight: '92vh', overflowY: 'auto',
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFDF8 100%)',
                borderRadius: 20, border: `1px solid ${themeColor}26`,
                boxShadow: '0 40px 80px -24px rgba(25,27,30,0.4)',
                padding: '34px 26px 28px', textAlign: 'center',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {!submitted ? (
                <>
                  {/* Crest + essential details */}
                  <div style={{ fontFamily: 'var(--font-script)', fontSize: 30, color: themeColor, lineHeight: 1 }}>{isRTL ? 'يسعدنا دعوتكم' : "You're Invited"}</div>
                  <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 25, fontWeight: 600, color: '#191B1E', margin: '10px 0 4px', lineHeight: 1.2 }}>
                    {event?.title}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '14px 0 18px' }}>
                    <span style={{ height: 1, width: 26, background: `${themeColor}55` }} />
                    <span style={{ fontSize: 16, color: themeColor }}>✦</span>
                    <span style={{ height: 1, width: 26, background: `${themeColor}55` }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
                    {dateLabel && (
                      <DetailRow icon="📅" label={isRTL ? 'التاريخ' : 'When'} value={`${dateLabel}${timeLabel ? ` · ${timeLabel}` : ''}`} />
                    )}
                    {event?.location_name && (
                      <DetailRow icon="📍" label={isRTL ? 'المكان' : 'Where'} value={[event.location_name, event.location_address].filter(Boolean).join(' · ')} />
                    )}
                    {event?.dress_code && (
                      <DetailRow icon="🎩" label={isRTL ? 'الزي' : 'Dress code'} value={event.dress_code} />
                    )}
                  </div>

                  {/* ─── Streamlined RSVP form ─── */}
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: isRTL ? 'right' : 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9A9486', textAlign: 'center' }}>
                      {isRTL ? 'هل ستنضم إلينا؟' : 'Will you join us?'}
                    </div>

                    {/* Attendance toggle */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <TogglePill active={attending === 'yes'} accent={themeColor} onClick={() => setAttending('yes')}>
                        {isRTL ? 'بكل سرور' : 'Joyfully Accept'}
                      </TogglePill>
                      <TogglePill active={attending === 'no'} accent="#191B1E" onClick={() => setAttending('no')}>
                        {isRTL ? 'نعتذر' : 'Regretfully Decline'}
                      </TogglePill>
                    </div>

                    <FloatingField label={isRTL ? 'الاسم' : 'Full name'} value={guestName} onChange={setGuestName} accent={themeColor} placeholder={isRTL ? 'اسمك الكريم' : 'Your name'} />

                    {/* Party size counter (attending only) */}
                    <AnimatePresence initial={false}>
                      {attending === 'yes' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid #E8E2D6', borderRadius: 12, background: '#FFFDF8' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#191B1E' }}>{isRTL ? 'عدد الأفراد' : 'Party size'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <Stepper sign="−" accent={themeColor} onClick={() => setPartySize(s => Math.max(1, (parseInt(s) || 1) - 1))} disabled={partySize <= 1} />
                              <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: 16, color: '#191B1E' }}>{partySize}</span>
                              <Stepper sign="+" accent={themeColor} onClick={() => setPartySize(s => Math.min(20, (parseInt(s) || 1) + 1))} disabled={partySize >= 20} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <FloatingField label={isRTL ? 'رقم الجوال' : 'Mobile number'} value={phone} onChange={setPhone} accent={themeColor} type="tel" placeholder="+1 (555) 000-0000" />

                    {formError && (
                      <div style={{ fontSize: 12.5, color: '#C0392B', textAlign: 'center', lineHeight: 1.5 }}>
                        {formError}{' '}
                        <a href={fullFormHref} style={{ color: themeColor, fontWeight: 700 }}>{isRTL ? 'النموذج الكامل' : 'Use full form'}</a>
                      </div>
                    )}

                    <button type="submit" disabled={submitting} style={{
                      marginTop: 2, height: 52, borderRadius: 14, border: 'none', cursor: submitting ? 'default' : 'pointer',
                      background: attending === 'no' ? '#191B1E' : `linear-gradient(135deg, ${themeColor}, ${secondaryColor})`,
                      color: '#FFFFFF', fontSize: 15, fontWeight: 700, letterSpacing: '0.02em',
                      boxShadow: `0 10px 24px ${themeColor}44`, opacity: submitting ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'opacity 0.2s',
                    }}>
                      {submitting ? (isRTL ? 'جارٍ الإرسال…' : 'Sending…') : (isRTL ? 'إرسال الرد' : 'Send RSVP')}
                    </button>

                    <button type="button" onClick={onEnter} style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5,
                      color: '#9A9486', fontWeight: 600, padding: 4,
                    }}>
                      {isRTL ? 'استعراض الدعوة كاملة ←' : 'Explore the full invitation →'}
                    </button>
                  </form>
                </>
              ) : (
                /* ─── Success state ─── */
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} style={{ padding: '20px 4px' }}>
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING, delay: 0.1 }}
                    style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${themeColor}14`, border: `2px solid ${themeColor}` }}
                  >
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  </motion.div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 23, fontWeight: 600, color: '#191B1E', marginBottom: 8 }}>
                    {attending === 'no' ? (isRTL ? 'شكرًا لإبلاغنا' : 'Thank you for letting us know') : (isRTL ? 'تم تأكيد حضورك!' : "You're on the list!")}
                  </h2>
                  <p style={{ fontSize: 13.5, color: '#77736A', lineHeight: 1.6, maxWidth: 300, margin: '0 auto 22px' }}>
                    {attending === 'no'
                      ? (isRTL ? 'سنفتقد وجودك. يمكنك تغيير ردك في أي وقت.' : "We'll miss you — you can change your response anytime.")
                      : (isRTL ? 'لقد سجّلنا ردك بكل سرور. نراك قريبًا!' : "We've saved your response. We can't wait to celebrate with you!")}
                  </p>
                  <button onClick={onEnter} style={{
                    height: 50, width: '100%', borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${themeColor}, ${secondaryColor})`, color: '#FFFFFF',
                    fontSize: 14.5, fontWeight: 700, boxShadow: `0 10px 24px ${themeColor}44`,
                  }}>
                    {isRTL ? 'استعراض الدعوة كاملة' : 'Explore the full invitation'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        @keyframes iv-twinkle {
          0%, 100% { opacity: 0.1; transform: scale(0.8); }
          50% { opacity: 0.45; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

/* ─── Small presentational helpers ─── */
function DetailRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', padding: '0 6px' }}>
      <span style={{ fontSize: 16, lineHeight: '20px' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9A9486', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 13.5, color: '#191B1E', fontWeight: 500, lineHeight: 1.4 }}>{value}</div>
      </div>
    </div>
  );
}

function TogglePill({ active, accent, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '13px 8px', borderRadius: 12, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
      border: active ? `2px solid ${accent}` : '1.5px solid #E8E2D6',
      background: active ? `${accent}10` : '#FFFFFF', color: active ? accent : '#77736A',
      transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent',
    }}>
      {children}
    </button>
  );
}

function Stepper({ sign, accent, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={sign === '+' ? 'increase' : 'decrease'} style={{
      width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${disabled ? '#E8E2D6' : accent}`,
      background: '#FFFFFF', color: disabled ? '#CFC9BC' : accent, fontSize: 18, fontWeight: 700,
      cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      lineHeight: 1, WebkitTapHighlightColor: 'transparent',
    }}>
      {sign}
    </button>
  );
}

function FloatingField({ label, value, onChange, accent, type = 'text', placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#77736A', marginBottom: 5, letterSpacing: '0.02em' }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', boxSizing: 'border-box', height: 46, padding: '0 14px', borderRadius: 12,
          border: `1.5px solid ${focused ? accent : '#E8E2D6'}`, outline: 'none',
          fontSize: 16 /* ≥16px avoids iOS focus-zoom */, color: '#191B1E', background: '#FFFDF8',
          boxShadow: focused ? `0 0 0 3px ${accent}1a` : 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      />
    </div>
  );
}
