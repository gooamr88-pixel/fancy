'use client';

// Guest self-scan ticket view — reached by scanning the QR code emailed from
// the organizer dashboard's RSVPs tab ("Resend QR ticket email"). The token
// IS the authentication (a signed, purpose-scoped JWT — see
// backend/services/tokenService.js signQrTicket/verifyQrTicket), so this page
// needs no login and no slug: everything is decoded server-side from the
// token in GET /public/ticket/:token.
//
// Reuses <SeatingResultPanel> (the same "find my seat" component shown right
// after a guest submits their RSVP) so the guarantee that a guest only ever
// sees their OWN table + own party on the real venue map — never who else is
// seated where — lives in one place instead of being re-implemented here.

import React, { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { publicApiFetch, PublicApiError, API_URL } from '../../utils/publicApi';
import SeatingResultPanel from '../../[slug]/rsvp/steps/SeatingResultPanel';
import Icon from '../../components/icons/Icon';

function TicketRoute({ token }) {
  const searchParams = useSearchParams();
  const isRTL = searchParams.get('lang') === 'ar';

  const [status, setStatus] = useState('loading'); // 'loading' | 'error' | 'locked' | 'ready'
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await publicApiFetch(`/public/ticket/${encodeURIComponent(token)}`);
        if (cancelled) return;
        setPayload(data);
        setStatus(data.locked ? 'locked' : 'ready');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof PublicApiError && err.code === 'INVALID_TICKET'
          ? (isRTL ? 'هذه التذكرة غير صالحة أو منتهية الصلاحية.' : 'This ticket is invalid or has expired.')
          : (isRTL ? 'تعذّر تحميل تذكرتك. برجاء المحاولة مرة أخرى لاحقاً.' : 'Could not load your ticket. Please try again later.');
        setErrorMessage(message);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token, isRTL]);

  const event = payload?.event;
  const guest = payload?.guest;
  const themeColor = event?.custom_colors?.primary || '#B8944F';
  const formattedDate = event?.event_date
    ? new Date(event.event_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : '';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      minHeight: '100dvh', position: 'relative',
      background: 'radial-gradient(120% 100% at 50% 0%, #EFE2C233 0%, #F8F4EC 45%, #EFE6D4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', maxWidth: '540px', width: '100%',
          borderRadius: '22px', padding: '1.5px',
          background: `linear-gradient(135deg, #D7BE80, ${themeColor} 45%, #D7BE80)`,
          boxShadow: '0 36px 90px -24px rgba(110,74,34,0.38), 0 10px 30px rgba(25,27,30,0.07)',
        }}
      >
        <div style={{ background: '#FFFFFF', borderRadius: '20.5px', overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(135deg, #191B1E 0%, #2a2d32 100%)',
            color: '#FFFFFF', padding: '32px 32px 26px', textAlign: 'center',
          }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '4px', color: themeColor, fontWeight: 700, display: 'block', marginBottom: '10px' }}>
              {isRTL ? 'تذكرتك' : 'Your Ticket'}
            </span>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400, lineHeight: 1.3, color: '#FFFFFF' }}>
              {event?.title || (isRTL ? 'الفعالية' : 'Event')}
            </h1>
            {formattedDate && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>{formattedDate}</p>
            )}
            {event?.location_name && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Icon name="mapPin" size={12} strokeWidth={1.6} /> {event.location_name}</p>
            )}
          </div>

          <div style={{ padding: '28px 32px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {status === 'loading' && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: '32px', height: '32px', border: '3px solid #E8E2D6', borderTop: `3px solid ${themeColor}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ color: '#77736A', fontSize: '13px' }}>{isRTL ? 'جاري تحميل تذكرتك...' : 'Loading your ticket...'}</p>
              </div>
            )}

            {status === 'error' && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Icon name="warning" size={34} color="#C45E5E" strokeWidth={1.3} />
                <p style={{ color: '#191B1E', fontSize: '14px', fontWeight: 600, marginTop: '12px' }}>{errorMessage}</p>
              </div>
            )}

            {status === 'locked' && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Icon name="lock" size={34} color={themeColor} strokeWidth={1.3} />
                <p style={{ color: '#191B1E', fontSize: '14px', fontWeight: 600, marginTop: '12px' }}>
                  {isRTL ? 'خريطة الجلوس لسه مش متاحة.' : "The seating chart isn't available yet."}
                </p>
                <p style={{ color: '#77736A', fontSize: '12px', marginTop: '6px' }}>
                  {isRTL ? 'هتظهر قبل الفعالية بيوم واحد.' : 'It unlocks 24 hours before the event.'}
                </p>
              </div>
            )}

            {status === 'ready' && guest && (
              <>
                <div style={{ textAlign: 'center', paddingBottom: '4px', borderBottom: '1px solid #F0ECE3' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#77736A', fontWeight: 700 }}>
                    {isRTL ? 'الضيف' : 'Guest'}
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '19px', fontWeight: 600, color: '#191B1E', marginTop: '4px' }}>{guest.guest_name}</h2>
                  <span style={{ fontSize: '12px', color: '#77736A' }}>{isRTL ? `عدد الأفراد: ${guest.party_size}` : `Party of ${guest.party_size}`}</span>
                </div>

                {/* The actual entrance credential — this page is reached via the same
                    signed token the door scanner verifies, so the QR rendered here (the
                    backend's own PNG, not a client-side re-encode) is always the real,
                    working ticket, unlike the decorative preview shown right after RSVP. */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px 0' }}>
                  <div style={{ padding: '14px', background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '16px', boxShadow: '0 8px 24px rgba(25,27,30,0.06)' }}>
                    <img
                      src={`${API_URL}/public/qr/${encodeURIComponent(token)}.png`}
                      alt={isRTL ? 'رمز الدخول' : 'Entrance QR code'}
                      width={200}
                      height={200}
                      style={{ display: 'block', width: '200px', height: '200px' }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: '#A09A91', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                    {isRTL ? 'اعرض هذا الرمز عند الدخول' : 'Show this at the door'}
                  </span>
                </div>

                <SeatingResultPanel
                  view={{ myTableName: payload.myTableName, myTableId: payload.myTableId, party: payload.party, tables: payload.tables }}
                  loading={false}
                  isRTL={isRTL}
                />
              </>
            )}
          </div>
        </div>
      </motion.div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function TicketPage({ params }) {
  const { token } = use(params);
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <TicketRoute token={token} />
    </Suspense>
  );
}
