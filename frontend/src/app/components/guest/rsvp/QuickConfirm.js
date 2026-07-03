'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassmorphismCard, PremiumButton, AttendanceCard, PartySizeStepper, CalendarButton, ShareButton } from '../GuestUI';
import { FadeInUp, ScaleIn, GlowPulse, ConfettiExplosion } from '../GuestAnimations';

/**
 * QuickConfirm — the one-click email-token input surface, now a thin presentational
 * child of <RsvpExperience>. It owns ONLY its own UI + the post-success "done" screen;
 * resolution, the already-responded lock, deadline-closed, idempotency and error
 * mapping all live in the engine. This is the email flow fully folded into the engine.
 */

const RESP = {
  yes:   { label: 'Accept',  color: '#10b981' },
  maybe: { label: 'Maybe',   color: '#6366f1' },
  no:    { label: 'Decline', color: '#ef4444' },
};

export default function QuickConfirm({ event, guest, intendedResponse, isRTL, submit, submitting, context }) {
  const [selected, setSelected] = useState(intendedResponse || guest?.response || 'yes');
  const [partySize, setPartySize] = useState(guest?.party_size || 1);
  // Name-only companion list — QuickConfirm stays a one-click surface, so it
  // doesn't collect email/phone/meal per companion the way the full public
  // wizard does; without this, growing the party here left every extra
  // member as a permanent anonymous "Guest 2"/"Guest 3" placeholder.
  const [companionNames, setCompanionNames] = useState([]);
  const [done, setDone] = useState(false);
  const [finalResponse, setFinalResponse] = useState(null);

  const dateStr = event?.event_date
    ? new Date(event.event_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : null;

  const handlePartySizeChange = (size) => {
    setPartySize(size);
    const wanted = Math.max(size - 1, 0);
    setCompanionNames((prev) => {
      if (wanted === prev.length) return prev;
      if (wanted < prev.length) return prev.slice(0, wanted);
      return [...prev, ...Array.from({ length: wanted - prev.length }, () => '')];
    });
  };

  const handleConfirm = async () => {
    const additionalGuests = selected === 'yes' && partySize > 1
      ? companionNames.slice(0, partySize - 1).map((fullName) => ({ fullName }))
      : [];
    const r = await submit({
      url: '/public/rsvp/respond',
      body: { token: context.token, response: selected, partySize: selected === 'yes' ? partySize : 1, additionalGuests },
      reconcileId: guest?.id,
    });
    // A LOCKED/closed/full result is handled centrally by the engine (it swaps to the
    // locked/status card). We only render our own celebratory "done" screen on success.
    if (r.ok) { setFinalResponse(r.data?.response || selected); setDone(true); }
  };



  if (done) {
    const meta = RESP[finalResponse] || RESP.yes;
    return (
      <Shell isRTL={isRTL}>
        <ConfettiExplosion active={finalResponse === 'yes'} duration={4500} particleCount={140} />
        <div style={{ textAlign: 'center' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.15 }}
            style={{ width: '72px', height: '72px', borderRadius: '50%', background: `${meta.color}14`, border: `2px solid ${meta.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '30px', color: meta.color }}>✓</motion.div>
          <FadeInUp delay={0.2}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: '#191B1E', margin: 0 }}>
              {finalResponse === 'yes' ? (isRTL ? 'لا نطيق الانتظار لرؤيتك!' : 'We Can’t Wait to See You!') : (isRTL ? 'تم تسجيل ردك' : 'Response Recorded')}
            </h1>
          </FadeInUp>
          <FadeInUp delay={0.35}>
            <p style={{ color: '#77736A', fontSize: '14px', lineHeight: 1.8, marginTop: '14px' }}>
              {isRTL ? 'شكراً ' : 'Thank you, '}<strong style={{ color: '#B8944F' }}>{guest?.guest_name}</strong>. {isRTL ? 'أنت مسجّل كـ ' : 'You’re marked as '}<strong style={{ color: meta.color }}>{meta.label === 'Accept' ? (isRTL ? 'حاضر' : 'Attending') : meta.label}</strong>{finalResponse === 'yes' ? (isRTL ? ` ضمن مجموعة من ${partySize}.` : ` with a party of ${partySize}.`) : '.'}
            </p>
          </FadeInUp>
          {event && (
            <FadeInUp delay={0.5}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '24px' }}>
                <CalendarButton event={event} isRTL={isRTL} />
                <ShareButton title={event.title} text={isRTL ? `دعوة لحضور ${event.title}` : `You're invited to ${event.title}`} isRTL={isRTL} />
              </div>
            </FadeInUp>
          )}
          {event?.slug && (
            <FadeInUp delay={0.6}>
              <div style={{ marginTop: '16px' }}>
                <Link href={`/${event.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <PremiumButton variant="dark" fullWidth>{isRTL ? 'عرض تفاصيل الفعالية' : 'View Event Details'}</PremiumButton>
                </Link>
              </div>
            </FadeInUp>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell isRTL={isRTL}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <FadeInUp delay={0.1}>
          <span style={{ display: 'inline-block', padding: '6px 18px', background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.2)', borderRadius: '100px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.22em', color: '#8A6D34', fontWeight: 700 }}>
            {isRTL ? 'أنت مدعو' : 'You’re Invited'}
          </span>
        </FadeInUp>
        <FadeInUp delay={0.2}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: '#191B1E', margin: '14px 0 0' }}>{event?.title}</h1>
        </FadeInUp>
        {dateStr && <FadeInUp delay={0.3}><p style={{ color: '#77736A', fontSize: '13px', marginTop: '8px' }}>📅 {dateStr}</p></FadeInUp>}
      </div>

      <FadeInUp delay={0.35}>
        <p style={{ color: '#191B1E', fontSize: '15px', textAlign: 'center', marginBottom: '20px', lineHeight: 1.6 }}>
          {isRTL ? 'مرحباً ' : 'Hi '}<strong style={{ color: '#8A6D34' }}>{guest?.guest_name}</strong>{isRTL ? ' — هل ستحضر؟' : ' — will you attend?'}
        </p>
      </FadeInUp>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <AttendanceCard type="yes" variant="primary" accentColor={event?.custom_colors?.primary || '#10b981'} selected={selected} onClick={setSelected} isRTL={isRTL} />
        <div className="attendance-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
          <AttendanceCard type="maybe" variant="compact" selected={selected} onClick={setSelected} isRTL={isRTL} />
          <AttendanceCard type="no" variant="compact" selected={selected} onClick={setSelected} isRTL={isRTL} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selected === 'yes' && (
          <motion.div key="ps" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35 }} style={{ overflow: 'hidden', marginBottom: '20px' }}>
            <ScaleIn><PartySizeStepper value={partySize} onChange={handlePartySizeChange} min={1} max={20} label={isRTL ? 'إجمالي عدد الأفراد (شاملاً نفسك)' : 'Total party size (including you)'} isRTL={isRTL} /></ScaleIn>
            {partySize > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
                {companionNames.slice(0, partySize - 1).map((name, i) => (
                  <input
                    key={i}
                    value={name}
                    onChange={(e) => setCompanionNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))}
                    placeholder={isRTL ? `اسم الضيف ${i + 2} (اختياري)` : `Guest ${i + 2} name (optional)`}
                    style={{
                      padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(184,148,79,0.25)',
                      fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: 'rgba(255,255,255,0.6)',
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <FadeInUp delay={0.45}>
        <GlowPulse color={(RESP[selected] || RESP.yes).color} intensity={0.22}>
          <PremiumButton onClick={handleConfirm} disabled={submitting} loading={submitting} variant="gold" size="lg" fullWidth style={{ borderRadius: '14px' }}>
            {submitting ? (isRTL ? 'جارٍ التسجيل…' : 'Recording…') : `${isRTL ? 'تأكيد' : 'Confirm'} — ${(RESP[selected] || RESP.yes).label}`}
          </PremiumButton>
        </GlowPulse>
      </FadeInUp>
    </Shell>
  );
}

const Shell = ({ children, isRTL }) => (
  <div dir={isRTL ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: 'linear-gradient(165deg,#F8F4EC,#EDE5D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
    <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 16 }} style={{ maxWidth: '500px', width: '100%' }}>
      <GlassmorphismCard bg="rgba(255,255,255,0.9)" blur={20} hoverable={false} style={{ padding: '44px 36px', borderRadius: '24px' }}>
        {children}
      </GlassmorphismCard>
    </motion.div>
  </div>
);

