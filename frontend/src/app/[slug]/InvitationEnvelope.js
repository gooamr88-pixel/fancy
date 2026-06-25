'use client';

/**
 * InvitationEnvelope — the premium entry experience for the public guest page.
 *
 * Phase machine:  closed → opening → open
 *   • closed   : an elegant sealed envelope, "Tap to open" (no event details shown).
 *   • opening  : the flap lifts (rotateX) and the inner card slides up out of the pocket.
 *   • open     : the invitation card presents essential details + a single CTA into the
 *                unified RSVP form (/[slug]/rsvp). The actual RSVP — including the
 *                "already responded" lock and duplicate prevention — is owned by the
 *                <RsvpExperience> engine on that page, so there is exactly ONE form.
 *
 * All motion is transform/opacity only (GPU-composited) on a fixed full-screen stage,
 * so there is zero layout shift and it stays buttery smooth on mobile.
 */

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
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

/* Build a maps deep-link to the venue. Prefers exact coordinates, falls back to
   the venue name/address. Uses Apple Maps on iOS, Google Maps elsewhere. */
function buildDirectionsUrl(event) {
  const hasCoords = event?.location_lat != null && event?.location_lng != null;
  const dest = hasCoords
    ? `${event.location_lat},${event.location_lng}`
    : encodeURIComponent([event?.location_name, event?.location_address].filter(Boolean).join(', '));
  if (!dest) return null;
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIOS ? `https://maps.apple.com/?daddr=${dest}` : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

/* Build the embeddable map URL. Uses the Google Maps Embed API when a key is
   configured (works from either coordinates or a free-text address), otherwise
   falls back to a keyless OpenStreetMap embed, which needs coordinates. */
function buildMapEmbedSrc(event) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasCoords = event?.location_lat != null && event?.location_lng != null;
  const query = hasCoords
    ? `${event.location_lat},${event.location_lng}`
    : [event?.location_name, event?.location_address].filter(Boolean).join(', ');
  if (!query) return null;
  if (apiKey) {
    return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(query)}&zoom=15`;
  }
  if (hasCoords) {
    const { location_lat: lat, location_lng: lng } = event;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008},${lat - 0.006},${lng + 0.008},${lat + 0.006}&layer=mapnik&marker=${lat},${lng}`;
  }
  return null;
}

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

  // If this guest already answered (known only when opened via an invitation token),
  // the CTA reflects it and the destination form's engine shows the locked/edit card.
  const respondedStatus = guestRsvp && ['yes', 'no', 'maybe'].includes(guestRsvp.response)
    ? guestRsvp.response
    : null;
  const STATUS_LABEL = {
    yes: isRTL ? 'حاضر' : 'Attending',
    maybe: isRTL ? 'ربما' : 'Tentative',
    no: isRTL ? 'معتذر' : 'Declined',
  };

  const initial = (event?.title || 'F').trim().charAt(0).toUpperCase();

  // ─── Venue location / map ───
  const hasLocation = !!(event?.location_name || event?.location_address ||
    (event?.location_lat != null && event?.location_lng != null));
  const mapEmbedSrc = buildMapEmbedSrc(event);
  const directionsUrl = buildDirectionsUrl(event);

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

  // Destination = the ONE unified RSVP form. Carry the invitation token (so the
  // engine resolves the right guest) and the language.
  const rsvpParams = new URLSearchParams();
  if (guestRsvp?.id) rsvpParams.set('rsvp_id', guestRsvp.id);
  if (isRTL) rsvpParams.set('lang', 'ar');
  const fullFormHref = `/${slug}/rsvp${rsvpParams.toString() ? `?${rsvpParams.toString()}` : ''}`;

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

              {/* ─── Venue map ─── */}
              {hasLocation && (mapEmbedSrc || directionsUrl) && (
                <div style={{ marginBottom: 22 }}>
                  {mapEmbedSrc ? (
                    <div style={{
                      position: 'relative', borderRadius: 14, overflow: 'hidden',
                      border: `1px solid ${themeColor}26`,
                      boxShadow: '0 10px 26px -14px rgba(25,27,30,0.32)',
                    }}>
                      <iframe
                        title={isRTL ? 'خريطة موقع الحدث' : 'Event location map'}
                        src={mapEmbedSrc}
                        width="100%" height="168"
                        style={{ border: 0, display: 'block', filter: 'saturate(1.02)' }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                      {directionsUrl && (
                        <a
                          href={directionsUrl} target="_blank" rel="noopener noreferrer"
                          style={{
                            position: 'absolute', bottom: 10, [isRTL ? 'left' : 'right']: 10,
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '8px 13px', borderRadius: 10, textDecoration: 'none',
                            background: '#FFFFFF', border: `1px solid ${themeColor}33`,
                            color: themeColor, fontSize: 11.5, fontWeight: 700,
                            boxShadow: '0 4px 12px -4px rgba(25,27,30,0.35)',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          🧭 {isRTL ? 'الاتجاهات' : 'Directions'}
                        </a>
                      )}
                    </div>
                  ) : (
                    <a
                      href={directionsUrl} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '13px 16px', borderRadius: 12, textDecoration: 'none',
                        background: `${themeColor}10`, border: `1px solid ${themeColor}2E`,
                        color: themeColor, fontSize: 13, fontWeight: 700,
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      🧭 {isRTL ? 'احصل على الاتجاهات' : 'Get Directions'}
                    </a>
                  )}
                </div>
              )}

              {/* ─── RSVP — a single CTA into the one unified form (/[slug]/rsvp). ─── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {respondedStatus && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 999, alignSelf: 'center',
                    background: `${themeColor}12`, border: `1px solid ${themeColor}33`,
                    color: themeColor, fontSize: 12.5, fontWeight: 700,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: themeColor }} />
                    {isRTL ? 'تم تسجيل ردّك بالفعل' : "You've already responded"} · {STATUS_LABEL[respondedStatus]}
                  </div>
                )}

                <Link href={fullFormHref} style={{
                  height: 52, borderRadius: 14, textDecoration: 'none',
                  background: `linear-gradient(135deg, ${themeColor}, ${secondaryColor})`,
                  color: '#FFFFFF', fontSize: 15, fontWeight: 700, letterSpacing: '0.02em',
                  boxShadow: `0 10px 24px ${themeColor}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  {respondedStatus
                    ? (isRTL ? 'عرض / تعديل ردّك' : 'View / update your RSVP')
                    : (isRTL ? 'تأكيد الحضور' : 'RSVP')}
                </Link>

                <button type="button" onClick={onEnter} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5,
                  color: '#9A9486', fontWeight: 600, padding: 4,
                }}>
                  {isRTL ? 'استعراض الدعوة كاملة ←' : 'Explore the full invitation →'}
                </button>
              </div>
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
