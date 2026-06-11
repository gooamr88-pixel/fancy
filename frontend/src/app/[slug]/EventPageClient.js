'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { translations } from '../utils/translations';

export default function EventPageClient({ initialEvent, slug: serverSlug }) {
  const [slug, setSlug] = useState(serverSlug || '');
  const [event, setEvent] = useState(initialEvent || null);
  const [loading, setLoading] = useState(!initialEvent);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState({});
  const [lang, setLang] = useState('en');

  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const fetchEventWithPasswordRef = useRef(null);

  const fetchEvent = useCallback(async (password) => {
    try {
      if (slug === 'demo-wedding' || slug === 'demo') {
        setEvent({
          id: 'demo-uuid',
          title: 'Julian & Sophia\'s Wedding Gala',
          title_ar: 'حفل زفاف جوليان وصوفيا الأنيق',
          description: 'Join us as we celebrate our love and write the next chapter of our story together. An evening of elegance, dinner, and dancing will follow the ceremony.',
          description_ar: 'يسعدنا انضمامكم إلينا لمشاركتنا فرحة العمر والاحتفال بعهد حبنا الجديد. تبدأ مراسم الزفاف يتبعها مأدبة عشاء فاخر وسهرة ممتعة.',
          event_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(),
          location_name: 'The Glasshouse Chelsea',
          location_address: '545 W 25th St, New York, NY 10001',
          template_type: 'wedding',
          dress_code: 'Black Tie Optional',
          dress_code_ar: 'ملابس رسمية أنيقة (Black Tie)',
          rsvp_deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
          cover_image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070',
          custom_colors: { primary: '#B8944F', secondary: '#D7BE80', accent: '#191B1E', background: '#F8F4EC' }
        });
        setLoading(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const headers = {};
      if (password) headers['x-event-password'] = password;
      const res = await fetch(`${apiUrl}/public/events/${slug}`, { headers });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 402) throw new Error('PAYMENT_REQUIRED');
        if (res.status === 401 && data.requiresPassword) { setPasswordRequired(true); setLoading(false); return; }
        if (res.status === 403 && data.error === 'EVENT_PRIVATE') { setIsPrivate(true); setLoading(false); return; }
        throw new Error('EVENT_NOT_FOUND');
      }
      const data = await res.json();
      setEvent(data.event);
      setPasswordRequired(false);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [slug]);

  useEffect(() => {
    fetchEventWithPasswordRef.current = (pw) => { setLoading(true); setError(null); fetchEvent(pw); };
  }, [fetchEvent]);

  useEffect(() => {
    if (!slug || initialEvent) return;
    fetchEvent();
  }, [slug, fetchEvent, initialEvent]);

  useEffect(() => {
    if (!event) return;
    const timer = setInterval(() => {
      const difference = +new Date(event.event_date) - +new Date();
      let newTimeLeft = {};
      if (difference > 0) {
        newTimeLeft = {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      }
      setTimeLeft(newTimeLeft);
    }, 1000);
    return () => clearInterval(timer);
  }, [event]);

  useEffect(() => {
    if (event) {
      document.title = `${event.title} | Fancy RSVP`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) { metaDesc.setAttribute('content', event.description || `RSVP to ${event.title}`); }
      else { const meta = document.createElement('meta'); meta.name = 'description'; meta.content = event.description || `RSVP to ${event.title}`; document.head.appendChild(meta); }
    }
  }, [event]);

  // LOADING
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#77736A', fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 300 }}>Curating your experience...</p>
        </div>
      </div>
    );
  }

  // PAYMENT REQUIRED
  if (error === 'PAYMENT_REQUIRED') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', background: '#FFFFFF', border: '1px solid #E8E2D6', padding: '48px 32px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: '48px' }}>💳</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: '#B8944F', marginTop: '12px' }}>Event Unpaid</h1>
          <p style={{ color: '#77736A', marginTop: '12px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>This Fancy RSVP event page is currently offline pending license activation.</p>
        </div>
      </div>
    );
  }

  // PRIVATE
  if (isPrivate) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', background: '#FFFFFF', border: '1px solid #E8E2D6', padding: '48px 32px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '64px', height: '64px', margin: '0 auto 16px', borderRadius: '50%', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '32px' }}>🔒</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: '#191B1E' }}>Private Event</h1>
          <p style={{ color: '#77736A', marginTop: '12px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>This event is private and can only be accessed through a direct invitation link from the host.</p>
          <Link href="/" style={{ display: 'inline-block', marginTop: '24px', padding: '12px 28px', background: '#B8944F', color: '#FFFFFF', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>Go to Homepage</Link>
        </div>
      </div>
    );
  }

  // PASSWORD
  if (passwordRequired) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', background: '#FFFFFF', border: '1px solid #E8E2D6', padding: '48px 32px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '64px', height: '64px', margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(184,148,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '32px' }}>🔐</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: '#191B1E' }}>Password Protected</h1>
          <p style={{ color: '#77736A', marginTop: '12px', marginBottom: '24px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>This event requires a password to access. Please enter the password provided by the host.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (passwordInput.trim() && fetchEventWithPasswordRef.current) fetchEventWithPasswordRef.current(passwordInput.trim()); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Enter event password" autoFocus
              style={{ width: '100%', boxSizing: 'border-box', padding: '14px', background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '8px', fontSize: '16px', textAlign: 'center', letterSpacing: '4px', color: '#191B1E', outline: 'none', fontFamily: 'var(--font-sans)' }}
              onFocus={(e) => e.target.style.borderColor = '#B8944F'} onBlur={(e) => e.target.style.borderColor = '#E8E2D6'} />
            <button type="submit" style={{ width: '100%', padding: '14px', background: '#B8944F', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Access Event</button>
          </form>
          {error && <p style={{ color: '#C45E5E', fontSize: '13px', marginTop: '12px' }}>Incorrect password. Please try again.</p>}
        </div>
      </div>
    );
  }

  // NOT FOUND
  if (error || !event) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <span style={{ fontSize: '56px' }}>🔍</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: '#191B1E', marginTop: '12px' }}>Event Not Found</h1>
          <p style={{ color: '#77736A', marginTop: '12px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>The event link you clicked seems to be incorrect or has been archived by the host.</p>
          <Link href="/" style={{ display: 'inline-block', marginTop: '24px', padding: '12px 28px', background: '#B8944F', color: '#FFFFFF', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>Go to Homepage</Link>
        </div>
      </div>
    );
  }

  const isWedding = event.template_type === 'wedding';
  const customColors = event.custom_colors || {};
  const themeColor = customColors.primary || (isWedding ? '#B8944F' : '#191B1E');
  const isRTL = lang === 'ar';
  const t = translations[lang];
  const localizedTitle = isRTL && event.title_ar ? event.title_ar : event.title;
  const localizedDesc = isRTL && event.description_ar ? event.description_ar : event.description;
  const localizedDressCode = isRTL && event.dress_code_ar ? event.dress_code_ar : event.dress_code;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      minHeight: '100vh', position: 'relative',
      backgroundColor: customColors.background || '#F8F4EC', color: '#191B1E',
      fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left',
    }}>

      {/* Language Toggle */}
      <div style={{ position: 'absolute', top: '24px', zIndex: 30, display: 'flex', gap: '8px', ...(isRTL ? { left: '24px' } : { right: '24px' }) }}>
        {['en', 'ar'].map(l => (
          <button key={l} onClick={() => setLang(l)} aria-label={l === 'en' ? 'Switch to English' : 'التبديل إلى العربية'} style={{
            padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            border: lang === l ? '1px solid #B8944F' : '1px solid #E8E2D6',
            background: lang === l ? '#B8944F' : 'rgba(255,255,255,0.9)',
            color: lang === l ? '#FFFFFF' : '#77736A',
            fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
          }}>
            {l === 'en' ? 'English' : 'العربية'}
          </button>
        ))}
      </div>

      {/* Hero Image */}
      <div style={{ position: 'relative', height: '65vh', width: '100%', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{
          position: 'absolute', inset: 0, backgroundSize: 'cover', backgroundPosition: 'center', transform: 'scale(1.05)',
          backgroundImage: `url(${event.cover_image_url || 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?q=80&w=2070'})`,
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(25,27,30,0.85), rgba(25,27,30,0.3), transparent)' }} />

        <div style={{ position: 'relative', textAlign: 'center', paddingBottom: '64px', padding: '0 24px 64px', maxWidth: '800px', zIndex: 10 }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '4px', color: '#D7BE80', fontWeight: 700, display: 'block', marginBottom: '12px', fontFamily: 'var(--font-sans)' }}>
            {isRTL ? (event.template_type === 'wedding' ? 'بطاقة زفاف' : 'تفاصيل الفعالية') : `${event.template_type} invitation`}
          </span>
          <h1 style={{ fontSize: '48px', fontWeight: isWedding ? 400 : 700, color: '#FFFFFF', letterSpacing: '1px', marginBottom: '16px', fontFamily: isWedding ? 'var(--font-serif)' : 'var(--font-sans)', lineHeight: 1.15 }}>
            {localizedTitle}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', maxWidth: '640px', margin: '0 auto', fontWeight: 300, fontSize: '15px', lineHeight: 1.7 }}>
            {localizedDesc}
          </p>
        </div>
      </div>

      {/* Event Details & RSVP */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '64px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '48px' }}>

        {/* Left: Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '16px', border: '1px solid #E8E2D6', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: '#191B1E' }}>{t.details_title}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, display: 'block', marginBottom: '4px' }}>{t.when}</span>
                <span style={{ fontSize: '15px', color: '#191B1E', fontWeight: 500, display: 'block' }}>
                  {new Date(event.event_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span style={{ fontSize: '13px', color: '#77736A', display: 'block', marginTop: '2px' }}>
                  {t.starting_at} {new Date(event.event_date).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, display: 'block', marginBottom: '4px' }}>{t.where}</span>
                <span style={{ fontSize: '15px', color: '#191B1E', fontWeight: 500, display: 'block' }}>{event.location_name}</span>
                <span style={{ fontSize: '13px', color: '#77736A', display: 'block', marginTop: '2px' }}>{event.location_address}</span>
              </div>
              {event.dress_code && (
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                  <span style={{ fontSize: '10px', color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, display: 'block', marginBottom: '4px' }}>{t.dress_code}</span>
                  <span style={{ fontSize: '14px', color: '#77736A', fontStyle: 'italic' }}>{localizedDressCode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Countdown */}
          {timeLeft.days !== undefined ? (
            <div style={{ background: '#191B1E', padding: '32px', borderRadius: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
              {[
                { val: timeLeft.days, label: t.days },
                { val: timeLeft.hours, label: t.hours },
                { val: timeLeft.minutes, label: t.minutes },
                { val: timeLeft.seconds, label: t.seconds },
              ].map((item, i) => (
                <div key={i} style={{ width: '80px', padding: '8px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 900, color: '#B8944F', display: 'block', fontFamily: 'var(--font-sans)' }}>{item.val}</span>
                  <span style={{ fontSize: '10px', color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'var(--font-sans)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          ) : event && event.event_date && new Date(event.event_date) < new Date() && (
            <div style={{ background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.2)', padding: '24px', borderRadius: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>⏰</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#C45E5E' }}>
                {lang === 'ar' ? 'لقد انتهت هذه الفعالية' : 'This event has already occurred'}
              </h3>
              <p style={{ color: '#77736A', fontSize: '13px', marginTop: '8px', lineHeight: 1.6 }}>
                {lang === 'ar' ? 'كان موعد الفعالية قد مضى. شكراً لكم على اهتمامكم.' : 'The event date has passed. Thank you for your interest.'}
              </p>
            </div>
          )}
        </div>

        {/* Right: RSVP Card */}
        <div>
          <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '16px', border: '1px solid #E8E2D6', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: '#191B1E' }}>{t.card_title}</h3>
            <p style={{ fontSize: '13px', color: '#77736A', lineHeight: 1.6 }}>
              {t.reply_by} <strong style={{ color: '#191B1E' }}>{event.rsvp_deadline ? new Date(event.rsvp_deadline).toLocaleDateString(lang === 'ar' ? 'ar-EG' : undefined) : 'N/A'}</strong> {t.card_desc}
            </p>
            <Link href={`/${slug}/rsvp?lang=${lang}`} style={{
              display: 'block', width: '100%', padding: '14px', textAlign: 'center', color: '#FFFFFF', fontWeight: 700,
              fontSize: '14px', borderRadius: '8px', textDecoration: 'none', fontFamily: 'var(--font-sans)',
              background: themeColor, transition: 'all 0.3s ease', letterSpacing: '0.5px',
            }}>
              {t.rsvp_now}
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 2fr 1fr"] { grid-template-columns: 1fr !important; }
          h1[style*="font-size: 48px"] { font-size: 32px !important; }
        }
      `}</style>
    </div>
  );
}
