'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { translations } from '../utils/translations';

export default function EventPage({ params }) {
  const [slug, setSlug] = useState('');
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState({});
  const [lang, setLang] = useState('en'); // 'en' or 'ar'

  useEffect(() => {
    async function resolveParams() {
      const resolvedParams = await params;
      setSlug(resolvedParams.slug);
    }
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!slug) return;

    async function fetchEvent() {
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
            custom_colors: {
              primary: '#6b5b95',
              secondary: '#feb236',
              accent: '#d64161',
              background: '#fafaf9'
            }
          });
          setLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
        const res = await fetch(`${apiUrl}/public/events/${slug}`);
        if (!res.ok) {
          if (res.status === 402) throw new Error('PAYMENT_REQUIRED');
          throw new Error('EVENT_NOT_FOUND');
        }
        const data = await res.json();
        setEvent(data.event);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [slug]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-stone-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-stone-600 font-medium">Curating your experience...</p>
        </div>
      </div>
    );
  }

  if (error === 'PAYMENT_REQUIRED') {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center bg-stone-850 p-8 rounded-2xl border border-stone-800 shadow-2xl">
          <span className="text-4xl">💳</span>
          <h1 className="text-2xl font-bold mt-4 text-amber-500">Event Unpaid</h1>
          <p className="text-stone-400 mt-2">This Fancy RSVP event page is currently offline pending license activation. If you are the organizer, please complete payment from your dashboard.</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <span className="text-5xl">🔍</span>
          <h1 className="text-3xl font-bold mt-4 text-stone-800">Event Not Found</h1>
          <p className="text-stone-600 mt-2">The event link you clicked seems to be incorrect or has been archived by the host.</p>
          <div className="mt-6">
            <Link href="/" className="inline-block px-6 py-2 bg-stone-850 text-white rounded-lg hover:bg-stone-800 transition">
              Go to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isWedding = event.template_type === 'wedding';
  const customColors = event.custom_colors || {};
  const themeColor = customColors.primary || (isWedding ? '#8c7853' : '#0f172a');
  
  // Translation toggle helpers
  const isRTL = lang === 'ar';
  const t = translations[lang];

  // Dynamic values
  const localizedTitle = isRTL && event.title_ar ? event.title_ar : event.title;
  const localizedDesc = isRTL && event.description_ar ? event.description_ar : event.description;
  const localizedDressCode = isRTL && event.dress_code_ar ? event.dress_code_ar : event.dress_code;

  return (
    <div 
      className={`min-h-screen relative selection:bg-amber-100 selection:text-amber-900 transition-all duration-300 ${isRTL ? 'font-sans text-right' : 'font-sans text-left'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ backgroundColor: customColors.background || '#fafaf9', color: '#1c1917' }}
    >
      
      {/* ─── Language Bar Floating Top Right ─── */}
      <div className={`absolute top-6 z-30 flex gap-2 ${isRTL ? 'left-6' : 'right-6'}`}>
        <button 
          onClick={() => setLang('en')} 
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm border ${lang === 'en' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white/80 text-stone-700 border-stone-200 hover:bg-white'}`}
        >
          English
        </button>
        <button 
          onClick={() => setLang('ar')} 
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm border ${lang === 'ar' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white/80 text-stone-700 border-stone-200 hover:bg-white'}`}
        >
          العربية
        </button>
      </div>
      
      {/* ─── Hero Image Section ─── */}
      <div className="relative h-[65vh] w-full overflow-hidden flex items-end justify-center">
        <div 
          className="absolute inset-0 bg-cover bg-center transform scale-105 transition duration-700" 
          style={{ backgroundImage: `url(${event.cover_image_url || 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?q=80&w=2070'})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/40 to-transparent" />
        
        <div className="relative text-center pb-16 px-6 max-w-4xl z-10">
          <span className="text-xs uppercase tracking-[0.3em] text-amber-400 font-bold mb-3 block">
            {isRTL ? (event.template_type === 'wedding' ? 'بطاقة زفاف' : 'تفاصيل الفعالية') : `${event.template_type} invitation`}
          </span>
          <h1 className={`text-4xl md:text-6xl font-light text-white tracking-wide mb-4 ${isWedding ? 'font-serif' : 'font-sans font-bold'}`}>
            {localizedTitle}
          </h1>
          <p className="text-stone-300 max-w-2xl mx-auto font-light text-sm md:text-base leading-relaxed">
            {localizedDesc}
          </p>
        </div>
      </div>

      {/* ─── Event Details & Action ─── */}
      <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        
        {/* Left Column: Date & Venue */}
        <div className="md:col-span-2 space-y-8">
          
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 space-y-6">
            <h2 className="text-xl font-bold tracking-tight text-stone-850">{t.details_title}</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-xs text-stone-400 uppercase tracking-widest font-bold block">{t.when}</span>
                <span className="text-base text-stone-750 font-medium">
                  {new Date(event.event_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="text-sm text-stone-500 block">
                  {t.starting_at} {new Date(event.event_date).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-stone-400 uppercase tracking-widest font-bold block">{t.where}</span>
                <span className="text-base text-stone-750 font-medium block">{event.location_name}</span>
                <span className="text-sm text-stone-500 block">{event.location_address}</span>
              </div>

              {event.dress_code && (
                <div className="space-y-1 sm:col-span-2 border-t border-stone-50 pt-4">
                  <span className="text-xs text-stone-400 uppercase tracking-widest font-bold block">{t.dress_code}</span>
                  <span className="text-sm text-stone-600 italic block">{localizedDressCode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Countdown Clock */}
          {timeLeft.days !== undefined && (
            <div className="bg-stone-900 text-white p-8 rounded-2xl flex flex-wrap justify-around text-center shadow-lg border border-stone-800">
              <div className="w-20 p-2">
                <span className="text-3xl md:text-4xl font-extrabold text-amber-500 block">{timeLeft.days}</span>
                <span className="text-xs text-stone-450 uppercase tracking-widest">{t.days}</span>
              </div>
              <div className="w-20 p-2">
                <span className="text-3xl md:text-4xl font-extrabold text-amber-500 block">{timeLeft.hours}</span>
                <span className="text-xs text-stone-450 uppercase tracking-widest">{t.hours}</span>
              </div>
              <div className="w-20 p-2">
                <span className="text-3xl md:text-4xl font-extrabold text-amber-500 block">{timeLeft.minutes}</span>
                <span className="text-xs text-stone-450 uppercase tracking-widest">{t.minutes}</span>
              </div>
              <div className="w-20 p-2">
                <span className="text-3xl md:text-4xl font-extrabold text-amber-500 block">{timeLeft.seconds}</span>
                <span className="text-xs text-stone-450 uppercase tracking-widest">{t.seconds}</span>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: RSVP Actions */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-md border border-stone-150 text-center space-y-6 sticky top-8">
            <h3 className="text-lg font-bold tracking-tight text-stone-850">{t.card_title}</h3>
            <p className="text-sm text-stone-500">
              {t.reply_by} <strong>{event.rsvp_deadline ? new Date(event.rsvp_deadline).toLocaleDateString(lang === 'ar' ? 'ar-EG' : undefined) : 'N/A'}</strong> {t.card_desc}
            </p>
            
            <Link 
              href={`/${slug}/rsvp?lang=${lang}`}
              className="w-full inline-block py-3 px-6 text-white font-medium tracking-wide rounded-xl shadow-sm hover:opacity-95 transition"
              style={{ backgroundColor: themeColor }}
            >
              {t.rsvp_now}
            </Link>
          </div>
        </div>

      </div>

    </div>
  );
}
