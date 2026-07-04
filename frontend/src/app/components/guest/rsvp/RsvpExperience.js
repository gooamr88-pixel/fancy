'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import DigitalEnvelope from '../DigitalEnvelope';
import { GlassmorphismCard, PremiumButton, CalendarButton, ShareButton } from '../GuestUI';
import { ScaleIn, FadeInUp, ShimmerPlaceholder, ConfettiExplosion } from '../GuestAnimations';
import { useRsvpResolver, rememberGuest } from './useRsvpResolver';
import { useIdempotentRsvpSubmit } from './useIdempotentRsvpSubmit';
import { useSeatingLookup } from '../../../[slug]/rsvp/hooks/useSeatingLookup';
import SeatingResultPanel from '../../../[slug]/rsvp/steps/SeatingResultPanel';

/**
 * RsvpExperience — the unified orchestration engine for the entire guest RSVP
 * journey. ONE component owns resolution, the zero-flash loading skeleton, the
 * DigitalEnvelope intro, the bulletproof "already responded" lock, every terminal
 * status (closed / under review / unpaid / unavailable), and the single idempotent
 * submit. The actual input surface (one-click confirm OR the full multi-step form)
 * is supplied as a render-prop child, so all three entry contexts share one engine
 * while keeping their legitimately-different UX.
 *
 * Usage:
 *   <RsvpExperience context={{ kind: 'token', token }} lang="en">
 *     {(api) => <QuickConfirm {...api} />}
 *   </RsvpExperience>
 *
 *   <RsvpExperience context={{ kind: 'slug', slug, guestId, partyId }} envelope lang={lang}>
 *     {(api) => <RsvpWizard {...api} />}
 *   </RsvpExperience>
 *
 * Render-prop `api`: { event, guest, intendedResponse, allowEdits, context, isRTL,
 *                      submit, submitting, lock, rememberGuest }
 */

const STONE = '#77736A';

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
      {children}
    </div>
  );
}

/** Zero-flash loading: an elegant skeleton — never mock/empty real data. */
function RsvpSkeleton() {
  return (
    <Centered>
      <div role="status" aria-busy="true" aria-label="Loading your invitation" style={{ maxWidth: '520px', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <ShimmerPlaceholder width="120px" height="14px" borderRadius="4px" />
          <ShimmerPlaceholder width="280px" height="30px" borderRadius="8px" />
          <ShimmerPlaceholder width="200px" height="14px" borderRadius="4px" />
          <div style={{ height: '8px' }} />
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <ShimmerPlaceholder width="100%" height="110px" borderRadius="16px" />
            <ShimmerPlaceholder width="100%" height="110px" borderRadius="16px" />
            <ShimmerPlaceholder width="100%" height="110px" borderRadius="16px" />
          </div>
          <ShimmerPlaceholder width="100%" height="52px" borderRadius="12px" />
        </div>
        <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ color: STONE, fontSize: '13px', marginTop: '24px', fontWeight: 500, textAlign: 'center' }}>
          Preparing your invitation…
        </motion.p>
      </div>
    </Centered>
  );
}

/** Generic terminal status card (closed / under review / unpaid / unavailable). */
function StatusCard({ icon, title, message, slug }) {
  return (
    <Centered>
      <ScaleIn>
        <GlassmorphismCard bg="rgba(255,255,255,0.92)" hoverable={false} style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '48px 32px' }}>
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.15 }} style={{ fontSize: '48px', display: 'block' }}>{icon}</motion.span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: '#B8944F', marginTop: '12px' }}>{title}</h1>
          <p style={{ color: STONE, marginTop: '12px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>{message}</p>
          {slug && (
            <div style={{ marginTop: '24px' }}>
              <Link href={`/${slug}`} style={{ textDecoration: 'none' }}>
                <PremiumButton variant="outline">View Event Details</PremiumButton>
              </Link>
            </div>
          )}
        </GlassmorphismCard>
      </ScaleIn>
    </Centered>
  );
}

const STATUS_META = {
  yes:   { label: 'Attending', color: '#10b981', soft: 'rgba(16,185,129,0.1)',  icon: '🎉' },
  maybe: { label: 'Tentative', color: '#6366f1', soft: 'rgba(99,102,241,0.1)',  icon: '🤔' },
  no:    { label: 'Declined',  color: '#ef4444', soft: 'rgba(239,68,68,0.08)',  icon: '💌' },
};

/** The bulletproof read-only lock. The input form is NOT rendered here — the only
 *  way past it is the host-gated "Update my response" action (requirement #3). */
function RsvpLockedCard({ event, guest, allowEdits, isRTL, onEdit, onReset, seatingView, seatingLoading }) {
  const meta = STATUS_META[guest?.response] || STATUS_META.yes;
  const name = guest?.guest_name || '';
  return (
    <Centered>
      <ScaleIn>
        <GlassmorphismCard bg="rgba(255,255,255,0.94)" hoverable={false} style={{ maxWidth: '460px', width: '100%', textAlign: 'center', padding: '44px 34px' }}>
          <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.8, delay: 0.2 }} style={{ fontSize: '52px', display: 'block', marginBottom: '12px' }}>{meta.icon}</motion.span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '25px', fontWeight: 600, color: '#191B1E', marginBottom: '8px' }}>
            {isRTL ? 'أنت مسجّل بالفعل' : 'You’re already registered'}
          </h1>
          <p style={{ color: STONE, fontSize: '14px', lineHeight: 1.7, maxWidth: '360px', margin: '0 auto 18px' }}>
            {name ? (isRTL ? `شكراً ${name}، ` : `Thanks ${name}, `) : ''}
            {isRTL ? 'لدينا ردك بالفعل.' : 'we already have your response on file.'}
          </p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '999px', background: meta.soft, border: `1px solid ${meta.color}33`, color: meta.color, fontWeight: 700, fontSize: '13px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color }} />
            {meta.label}
            {guest?.response === 'yes' && guest?.party_size > 1 && (
              <span style={{ color: STONE, fontWeight: 600 }}>· {isRTL ? `${guest.party_size} أشخاص` : `Party of ${guest.party_size}`}</span>
            )}
          </span>

          {(guest?.response === 'yes' || guest?.response === 'maybe') && event && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '24px' }}>
              <CalendarButton event={event} isRTL={isRTL} />
              <ShareButton title={event.title} text={isRTL ? `دعوة لحضور ${event.title}` : `You're invited to ${event.title}`} url={typeof window !== 'undefined' ? `${window.location.origin}/${event.slug}` : ''} isRTL={isRTL} />
            </div>
          )}

          {/* Seating map — a guest revisiting their (already-locked) invitation had no
              way to see where the organizer seated them; StepSuccess only ever showed
              this right after the original submit. Fetched in the parent effect below
              and rendered here whenever the lookup found a seated party. */}
          {guest?.response === 'yes' && (seatingLoading || seatingView) && (
            <div style={{ borderTop: '1px solid #F0ECE3', marginTop: '24px', paddingTop: '20px', textAlign: isRTL ? 'right' : 'left' }}>
              <SeatingResultPanel view={seatingView} loading={seatingLoading} isRTL={isRTL} />
            </div>
          )}

          <div style={{ borderTop: '1px solid #F0ECE3', marginTop: '24px', paddingTop: '20px' }}>
            {allowEdits ? (
              <>
                <p style={{ fontSize: '12px', color: '#A09A91', lineHeight: 1.6, marginBottom: '14px' }}>
                  {isRTL ? 'تغيّرت خططك؟ يمكنك تحديث ردك قبل الموعد النهائي.' : 'Plans changed? You can update your response before the deadline.'}
                </p>
                <PremiumButton variant="outline" onClick={onEdit} icon="✏️">
                  {isRTL ? 'تحديث ردّي' : 'Update my response'}
                </PremiumButton>
              </>
            ) : (
              <p style={{ fontSize: '12px', color: '#A09A91', lineHeight: 1.6 }}>
                {isRTL ? 'هل تحتاج إلى تعديل ردك؟ يُرجى التواصل مع المضيف مباشرةً.' : 'Need to change your response? Please reach out to your host directly.'}
              </p>
            )}
          </div>
          <div style={{ borderTop: '1px solid #F0ECE3', marginTop: '16px', paddingTop: '16px', textAlign: 'center' }}>
            <button
              onClick={onReset}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', color: '#A09A91', fontFamily: 'var(--font-sans)',
                textDecoration: 'underline', textUnderlineOffset: '3px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#191B1E'}
              onMouseLeave={e => e.currentTarget.style.color = '#A09A91'}
            >
              {isRTL
                ? `لست ${name}؟ سجّل كشخص آخر`
                : `Not ${name}? RSVP as someone else`}
            </button>
          </div>
        </GlassmorphismCard>
      </ScaleIn>
    </Centered>
  );
}

export default function RsvpExperience({ context, lang = 'en', envelope = false, children }) {
  const isRTL = lang === 'ar';
  const engine = useRsvpResolver(context);
  const reduceMotion = useReducedMotion();

  // DigitalEnvelope intro — plays every time this page loads (no "seen before"
  // memory, consistent with the main event page's envelope), and never when
  // the guest prefers reduced motion. Shown only for the rich (slug) experience.
  const [envelopeDismissed, setEnvelopeDismissed] = useState(false);
  const envelopeOpen = !!envelope && !reduceMotion && engine.phase !== 'resolving' && !!engine.event && !envelopeDismissed;

  const closeEnvelope = () => setEnvelopeDismissed(true);

  // The single idempotent submit. A duplicate/already-responded result ALWAYS locks
  // centrally — the child never has to reimplement the lock.
  const { submit, submitting } = useIdempotentRsvpSubmit({
    onLocked: (data) => engine.lock({ response: data.response, guest_name: data.guestName }),
    messages: {
      closed: isRTL ? 'هذا الحدث لم يعد يستقبل الردود.' : 'This event is no longer accepting RSVPs.',
      full:   isRTL ? 'اكتمل عدد الضيوف. يُرجى التواصل مع المضيف.' : 'This event has reached its guest limit. Please contact the host.',
      failed: isRTL ? 'تعذّر حفظ ردك. تحقق من اتصالك وحاول مرة أخرى.' : 'We couldn’t save your RSVP. Please check your connection and try again.',
    },
  });

  // A guest who already responded 'yes' lands straight on the locked card (never
  // back in <RsvpWizard>), so this is the only chance to show them where the
  // organizer seated them. `fetchSeatingMap` isn't memoized (new fn each render of
  // the hook), so it's deliberately left out of the deps array in favor of a
  // fetched-once-per-party ref — including it would re-fire this effect on every
  // render once seatingView's setState triggers a re-render.
  const seatingApi = useSeatingLookup(engine.event?.slug);
  const seatingFetchedFor = useRef(null);
  useEffect(() => {
    const partyId = engine.guest?.id;
    if (engine.phase === 'locked' && engine.guest?.response === 'yes' && partyId && seatingFetchedFor.current !== partyId) {
      seatingFetchedFor.current = partyId;
      seatingApi.fetchSeatingMap(partyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.phase, engine.guest?.id, engine.guest?.response]);

  // ── Zero-flash gate: never render the child (or mock data) until resolved ──
  if (engine.phase === 'resolving') return <RsvpSkeleton />;

  if (engine.phase === 'paymentRequired') return <StatusCard icon="💳" title={isRTL ? 'الفعالية غير مفعّلة' : 'Event Unpaid'} message={isRTL ? 'هذه الصفحة غير متاحة حالياً.' : 'This event page is offline pending activation.'} />;
  if (engine.phase === 'underReview')   return <StatusCard icon="✨" title={isRTL ? 'جاهز قريباً' : 'Almost Ready'} message={isRTL ? 'تتم مراجعة هذه الدعوة وستكون جاهزة قريباً.' : 'This invitation is getting its final touches and will be live shortly.'} />;
  if (engine.phase === 'closed')        return <StatusCard icon="🕊️" title={isRTL ? 'انتهت فترة الرد' : 'RSVPs Are Closed'} message={isRTL ? 'لم يعد بالإمكان الرد على هذه الدعوة.' : 'Responses are no longer being accepted for this event.'} slug={engine.event?.slug} />;
  if (engine.phase === 'unavailable')   return <StatusCard icon="🔍" title={isRTL ? 'الدعوة غير متاحة' : 'Invitation Unavailable'} message={engine.error || (isRTL ? 'تعذّر العثور على هذه الدعوة.' : 'This invitation could not be found.')} />;

  const envelopeOverlay = envelopeOpen && engine.event ? (
    <DigitalEnvelope
      guestName={engine.guest?.guest_name || ''}
      eventTitle={engine.event.title}
      isRTL={isRTL}
      themeColor={engine.event?.custom_colors?.primary || '#B8944F'}
      secondaryColor={engine.event?.custom_colors?.secondary || null}
      pattern={engine.event?.template_type}
      onOpen={closeEnvelope}
    />
  ) : null;

  if (engine.phase === 'locked') {
    return (
      <>
        <RsvpLockedCard event={engine.event} guest={engine.guest} allowEdits={engine.allowEdits} isRTL={isRTL} onEdit={engine.openEdit} onReset={() => {
          const slug = engine.event?.slug;
          if (slug && typeof window !== 'undefined') {
            try { window.localStorage.removeItem(`fancy_rsvp_${slug}`); } catch {}
          }
          engine.refetch();
        }} seatingView={seatingApi.seatingView} seatingLoading={seatingApi.seatingLoading} />
        {envelopeOverlay}
      </>
    );
  }

  // phase === 'ready' → hand control to the input surface with the unified api.
  return (
    <>
      {children({
        event: engine.event,
        guest: engine.guest,
        intendedResponse: engine.intendedResponse,
        allowEdits: engine.allowEdits,
        context,
        isRTL,
        submit,
        submitting,
        lock: engine.lock,
        rememberGuest,
      })}
      {envelopeOverlay}
    </>
  );
}

export { ConfettiExplosion };
