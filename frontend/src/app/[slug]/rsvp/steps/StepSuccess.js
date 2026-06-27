'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FadeInUp, ConfettiExplosion } from '../../../components/guest/GuestAnimations';
import { PremiumButton, CalendarButton, ShareButton } from '../../../components/guest/GuestUI';
import GuestPassCard from '../../../components/guest/GuestPassGenerator';
import SeatingResultPanel from './SeatingResultPanel';

/** Step 5 — the celebratory / follow-up / farewell screen, branched by response. */
export default function StepSuccess({
  t, isRTL, attending, event, localizedTitle, guestName, email, partySize,
  partyId, slug, themeColor, assignedTableName, maybeFollowUp, declineReason,
  seatingApi, seatingRevealed,
}) {
  const { seatingView, seatingLoading, fetchSeatingMap } = seatingApi;

  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px 0' }}>

      {attending === 'yes' && (
        <>
          <ConfettiExplosion active={true} duration={4000} />

          <FadeInUp y={20}>
            <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, delay: 0.3 }} style={{ fontSize: '56px', display: 'block' }}>🎉</motion.span>
          </FadeInUp>

          <FadeInUp delay={0.2} y={15}>
            <h2 style={{ fontFamily: event?.custom_fonts?.card_title || 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: '#191B1E' }}>
              {t.thank_you.replace('{name}', guestName)}
            </h2>
          </FadeInUp>

          <FadeInUp delay={0.35} y={10}>
            <p style={{ color: '#77736A', maxWidth: '400px', margin: '0 auto', fontSize: '14px', lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>
              {t.attending_success_desc.replace('{email}', email)}
            </p>
          </FadeInUp>

          <FadeInUp delay={0.5} y={20}>
            <GuestPassCard
              guestName={guestName}
              eventTitle={localizedTitle}
              eventDate={event.event_date}
              eventLocation={event.location_name || event.location_address}
              tableName={assignedTableName}
              response="yes"
              qrData={partyId ? `fancy-rsvp:${slug}:${partyId}` : null}
              themeColor={themeColor}
              isRTL={isRTL}
            />
          </FadeInUp>

          <FadeInUp delay={0.65} y={10}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <CalendarButton event={event} isRTL={isRTL} />
              <ShareButton
                title={localizedTitle}
                text={isRTL ? `أنا سأحضر ${localizedTitle}!` : `I'm attending ${localizedTitle}!`}
                url={typeof window !== 'undefined' ? window.location.origin + '/' + slug : ''}
                isRTL={isRTL}
              />
            </div>
          </FadeInUp>

          {partyId && seatingRevealed && (
            <FadeInUp delay={0.75} y={15}>
              {seatingView ? (
                <div style={{ marginTop: '4px' }}>
                  <SeatingResultPanel view={seatingView} loading={seatingLoading} isRTL={isRTL} />
                </div>
              ) : (
                <PremiumButton variant="outline" onClick={() => fetchSeatingMap(partyId)} loading={seatingLoading} icon="🗺️">
                  {isRTL ? 'اعرض مكان جلوسي على الخريطة' : 'View where I sit on the map'}
                </PremiumButton>
              )}
            </FadeInUp>
          )}

          <FadeInUp delay={0.85} y={5}>
            <p style={{ fontSize: '12px', color: '#A09A91', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>{t.qr_notice}</p>
          </FadeInUp>
        </>
      )}

      {attending === 'maybe' && (
        <>
          <FadeInUp y={20}>
            <motion.span animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontSize: '56px', display: 'block' }}>📅</motion.span>
          </FadeInUp>

          <FadeInUp delay={0.2} y={15}>
            <h2 style={{ fontFamily: event?.custom_fonts?.card_title || 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: '#191B1E' }}>
              {t.thank_you.replace('{name}', guestName)}
            </h2>
          </FadeInUp>

          <FadeInUp delay={0.35} y={10}>
            <p style={{ color: '#77736A', maxWidth: '400px', margin: '0 auto', fontSize: '14px', lineHeight: 1.7 }}>
              {isRTL ? 'تم تسجيل ردك المبدئي. سنتابع معك قريباً للتأكيد النهائي.' : "Your tentative response has been recorded. We'll follow up with you soon for final confirmation."}
            </p>
          </FadeInUp>

          {maybeFollowUp && (
            <FadeInUp delay={0.45} y={10}>
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', padding: '16px 24px', borderRadius: '14px', display: 'inline-block', margin: '0 auto' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6366f1', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  {isRTL ? 'المتابعة المتوقعة' : 'Expected Follow-up'}
                </span>
                <strong style={{ fontSize: '16px', color: '#6366f1', fontFamily: 'var(--font-serif)' }}>{maybeFollowUp}</strong>
              </div>
            </FadeInUp>
          )}

          <FadeInUp delay={0.5} y={20}>
            <GuestPassCard
              guestName={guestName}
              eventTitle={localizedTitle}
              eventDate={event.event_date}
              eventLocation={event.location_name || event.location_address}
              tableName={assignedTableName}
              response="maybe"
              qrData={partyId ? `fancy-rsvp:${slug}:${partyId}` : null}
              themeColor={themeColor}
              isRTL={isRTL}
            />
          </FadeInUp>

          <FadeInUp delay={0.6} y={10}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <CalendarButton event={event} isRTL={isRTL} />
              <ShareButton
                title={localizedTitle}
                text={isRTL ? `دعوة لحضور ${localizedTitle}` : `You're invited to ${localizedTitle}`}
                url={typeof window !== 'undefined' ? window.location.origin + '/' + slug : ''}
                isRTL={isRTL}
              />
            </div>
          </FadeInUp>
        </>
      )}

      {attending === 'no' && (
        <>
          <FadeInUp y={20}>
            <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }} style={{ fontSize: '56px', display: 'block' }}>✉️</motion.span>
          </FadeInUp>

          <FadeInUp delay={0.2} y={15}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: '#191B1E' }}>
              {isRTL ? 'شكراً لإعلامنا بقرارك' : 'Thank you for letting us know'}
            </h2>
          </FadeInUp>

          <FadeInUp delay={0.35} y={10}>
            <p style={{ color: '#77736A', maxWidth: '380px', margin: '0 auto', fontSize: '14px', lineHeight: 1.7 }}>{t.decline_success_desc}</p>
          </FadeInUp>

          {declineReason && (
            <FadeInUp delay={0.45} y={10}>
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', padding: '14px 20px', borderRadius: '14px', display: 'inline-block', margin: '0 auto' }}>
                <span style={{ fontSize: '13px', color: '#77736A' }}>
                  {isRTL ? 'السبب: ' : 'Reason: '}<span style={{ fontWeight: 600, color: '#191B1E' }}>{declineReason}</span>
                </span>
              </div>
            </FadeInUp>
          )}

          <FadeInUp delay={0.5} y={5}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '8px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, #E8E2D6)' }} />
              <span style={{ color: '#D7BE80', fontSize: '16px' }}>✦</span>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #E8E2D6, transparent)' }} />
            </div>
          </FadeInUp>

          <FadeInUp delay={0.55} y={10}>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#B8944F', fontStyle: 'italic', lineHeight: 1.6 }}>
              {isRTL ? 'نتمنى لك كل الخير ونأمل أن نلتقي في مناسبة قريبة' : 'We wish you all the best and hope to see you at a future celebration'}
            </p>
          </FadeInUp>
        </>
      )}

      <FadeInUp delay={0.8} y={5}>
        <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '24px' }}>
          <Link href={`/${slug}`} style={{ color: '#B8944F', fontSize: '14px', fontWeight: 600, textDecoration: 'none', fontFamily: 'var(--font-sans)' }}>
            {t.return_btn}
          </Link>
        </div>
      </FadeInUp>
    </div>
  );
}
