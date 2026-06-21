'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { translations } from '../utils/translations';
import { useGuestAnalytics } from '../utils/useGuestAnalytics';
import {
  FadeInUp,
  StaggerChildren,
  StaggerItem,
  ScaleIn,
  ParallaxHero,
  FloatingParticles,
  CountdownDigit,
  AnimatedText,
  ShimmerPlaceholder,
  PageTransition,
  GlowPulse,
} from '../components/guest/GuestAnimations';
import {
  GlassmorphismCard,
  PremiumButton,
  GalleryLightbox,
  CalendarButton,
  ShareButton,
  inputStyle,
  inputFocus,
  inputBlur,
} from '../components/guest/GuestUI';
import GuestEnvelopeReveal from '../components/templates/GuestEnvelopeReveal';

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function sanitizeFontName(name) {
  if (!name) return null;
  return name.replace(/[^a-zA-Z0-9 -]/g, '');
}

function getDirectionsUrl(lat, lng, address) {
  const destination = lat && lng ? `${lat},${lng}` : encodeURIComponent(address || '');
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) return `https://maps.apple.com/?daddr=${destination}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function EventPageClient({ initialEvent, slug: serverSlug }) {
  const [slug, setSlug] = useState(serverSlug || '');
  const [event, setEvent] = useState(initialEvent || null);
  const [loading, setLoading] = useState(!initialEvent);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState({});
  const [lang, setLang] = useState('en');

  // Analytics
  const { trackEvent } = useGuestAnalytics(slug);

  // Seating
  const [seatingSearchQuery, setSeatingSearchQuery] = useState('');
  const [seatingSearching, setSeatingSearching] = useState(false);
  const [seatingResults, setSeatingResults] = useState(null);
  const [seatingError, setSeatingError] = useState('');

  // Audio
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // Gallery lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Floating CTA visibility
  const heroRef = useRef(null);
  const rsvpCardRef = useRef(null);
  const heroInView = useInView(heroRef, { amount: 0.1 });
  const rsvpCardInView = useInView(rsvpCardRef, { amount: 0.3 });
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);

  // Dress code expand
  const [dressCodeExpanded, setDressCodeExpanded] = useState(false);

  // One-time premium envelope reveal (the first time a guest opens this link).
  // Defaults to false so SSR/first paint render the page normally (no hydration
  // mismatch); the decision is made client-side once the event has loaded.
  const [showReveal, setShowReveal] = useState(false);

  useEffect(() => {
    setShowFloatingCTA(!heroInView && !rsvpCardInView);
  }, [heroInView, rsvpCardInView]);

  // Decide whether to play the envelope reveal. Only on the fully-loaded public
  // event page — never over the loading/password/private/review/error states.
  useEffect(() => {
    if (!event || loading || error || passwordRequired || isPrivate || underReview) return;
    if (typeof window === 'undefined') return;
    try {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const seen = window.localStorage.getItem(`fancy_envelope_seen_${event.id}`);
      // Canonical SSR-safe "decide after mount" read: localStorage/matchMedia can't
      // be known during SSR, so the flip to true must happen post-mount in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!reduceMotion && !seen) setShowReveal(true);
    } catch {
      /* localStorage/matchMedia unavailable → simply skip the reveal */
    }
  }, [event, loading, error, passwordRequired, isPrivate, underReview]);

  const handleRevealComplete = useCallback(() => {
    setShowReveal(false);
    try {
      if (event?.id) window.localStorage.setItem(`fancy_envelope_seen_${event.id}`, '1');
    } catch { /* non-fatal */ }
  }, [event]);

  // Auth states
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [underReview, setUnderReview] = useState(false);
  const fetchEventWithPasswordRef = useRef(null);

  /* ─── Seating Search ─── */
  const handleSeatingSearch = async (e) => {
    e.preventDefault();
    if (!seatingSearchQuery.trim()) return;
    setSeatingSearching(true);
    setSeatingError('');
    setSeatingResults(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/events/${slug}/seating/search?query=${encodeURIComponent(seatingSearchQuery)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Search failed');
      setSeatingResults(data.results || []);
      trackEvent('seating_search', { query: seatingSearchQuery });
    } catch (err) {
      setSeatingError(err.message || 'Something went wrong');
    } finally {
      setSeatingSearching(false);
    }
  };

  /* ─── Audio ─── */
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          trackEvent('audio_play');
        })
        .catch((err) => {
          console.error('Audio play failed:', err);
          alert('Please interact with the page first or check if the audio URL is valid.');
        });
    }
  };

  /* ─── Data Fetching ─── */
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
          custom_colors: { primary: '#B8944F', secondary: '#D7BE80', accent: '#191B1E', background: '#F8F4EC' },
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
        if (res.status === 403 && data.error === 'EVENT_UNDER_REVIEW') { setUnderReview(true); setLoading(false); return; }
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

  /* ─── Countdown ─── */
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

  /* ─── Document meta & fonts ─── */
  useEffect(() => {
    if (event) {
      document.title = `${event.title} | Fancy RSVP`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) { metaDesc.setAttribute('content', event.description || `RSVP to ${event.title}`); }
      else { const meta = document.createElement('meta'); meta.name = 'description'; meta.content = event.description || `RSVP to ${event.title}`; document.head.appendChild(meta); }

      if (event.custom_fonts) {
        const headingFont = sanitizeFontName(event.custom_fonts.heading) || 'Playfair Display';
        const bodyFont = sanitizeFontName(event.custom_fonts.body) || 'Inter';
        [headingFont, bodyFont].forEach(fontName => {
          const id = `font-link-${fontName.replace(/ /g, '-').toLowerCase()}`;
          if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}&display=swap`;
            document.head.appendChild(link);
          }
        });
      }
    }
  }, [event]);

  // Track page view once event loads
  useEffect(() => {
    if (event && !loading && !error) {
      trackEvent('page_view', { template: event.template_type });
    }
  }, [event, loading, error, trackEvent]);

  /* ═══════════════════════════════════════════════════════════════
     STATUS SCREENS
     ═══════════════════════════════════════════════════════════════ */

  // ─── LOADING ───
  if (loading) {
    return (
      <PageTransition>
        <div style={{ minHeight: '100vh', background: '#F8F4EC', fontFamily: 'var(--font-sans)' }}>
          {/* Hero shimmer */}
          <ShimmerPlaceholder width="100%" height="70vh" borderRadius="0" />
          {/* Content shimmers */}
          <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '48px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ShimmerPlaceholder width="100%" height="220px" borderRadius="20px" />
              <ShimmerPlaceholder width="100%" height="120px" borderRadius="20px" />
              <ShimmerPlaceholder width="60%" height="24px" />
              <ShimmerPlaceholder width="90%" height="16px" />
              <ShimmerPlaceholder width="75%" height="16px" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ShimmerPlaceholder width="100%" height="240px" borderRadius="20px" />
              <ShimmerPlaceholder width="100%" height="200px" borderRadius="20px" />
            </div>
          </div>
        </div>
        <style>{`
          @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          @media (max-width: 768px) {
            div[style*="grid-template-columns: 2fr 1fr"] { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </PageTransition>
    );
  }

  // ─── PAYMENT REQUIRED ───
  if (error === 'PAYMENT_REQUIRED') {
    return (
      <PageTransition>
        <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
          <ScaleIn>
            <GlassmorphismCard bg="rgba(255,255,255,0.92)" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '48px 32px' }}>
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.2 }} style={{ fontSize: '48px', display: 'block' }}>💳</motion.span>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: '#B8944F', marginTop: '12px' }}>Event Unpaid</h1>
              <p style={{ color: '#77736A', marginTop: '12px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>This Fancy RSVP event page is currently offline pending license activation.</p>
            </GlassmorphismCard>
          </ScaleIn>
        </div>
      </PageTransition>
    );
  }

  // ─── UNDER REVIEW ───
  if (underReview) {
    return (
      <PageTransition>
        <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
          <ScaleIn>
            <GlassmorphismCard bg="rgba(255,255,255,0.92)" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '48px 32px' }}>
              <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.2 }} style={{ fontSize: '48px', display: 'block' }}>✨</motion.span>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: '#B8944F', marginTop: '12px' }}>Almost Ready</h1>
              <p style={{ color: '#77736A', marginTop: '12px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>
                This invitation is being given its final touches and will be live very soon. Please check back shortly.
              </p>
            </GlassmorphismCard>
          </ScaleIn>
        </div>
      </PageTransition>
    );
  }

  // ─── PRIVATE ───
  if (isPrivate) {
    return (
      <PageTransition>
        <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
          <ScaleIn>
            <GlassmorphismCard bg="rgba(255,255,255,0.92)" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '48px 32px' }}>
              <div style={{ width: '64px', height: '64px', margin: '0 auto 16px', borderRadius: '50%', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} style={{ fontSize: '32px' }}>🔒</motion.span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: '#191B1E' }}>Private Event</h1>
              <p style={{ color: '#77736A', marginTop: '12px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>This event is private and can only be accessed through a direct invitation link from the host.</p>
              <Link href="/" style={{ display: 'inline-block', marginTop: '24px', padding: '12px 28px', background: '#B8944F', color: '#FFFFFF', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>Go to Homepage</Link>
            </GlassmorphismCard>
          </ScaleIn>
        </div>
      </PageTransition>
    );
  }

  // ─── PASSWORD ───
  if (passwordRequired) {
    return (
      <PageTransition>
        <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
          <ScaleIn>
            <GlassmorphismCard bg="rgba(255,255,255,0.92)" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '48px 32px' }}>
              <div style={{ width: '64px', height: '64px', margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(184,148,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.15 }} style={{ fontSize: '32px' }}>🔐</motion.span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: '#191B1E' }}>Password Protected</h1>
              <p style={{ color: '#77736A', marginTop: '12px', marginBottom: '24px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>This event requires a password to access. Please enter the password provided by the host.</p>
              <form onSubmit={(e) => { e.preventDefault(); if (passwordInput.trim() && fetchEventWithPasswordRef.current) fetchEventWithPasswordRef.current(passwordInput.trim()); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Enter event password" autoFocus
                  style={{ ...inputStyle, textAlign: 'center', letterSpacing: '4px' }}
                  onFocus={inputFocus} onBlur={(e) => inputBlur(e)} />
                <PremiumButton variant="gold" fullWidth onClick={() => { if (passwordInput.trim() && fetchEventWithPasswordRef.current) fetchEventWithPasswordRef.current(passwordInput.trim()); }}>
                  Access Event
                </PremiumButton>
              </form>
              {error && <p style={{ color: '#C45E5E', fontSize: '13px', marginTop: '12px' }}>Incorrect password. Please try again.</p>}
            </GlassmorphismCard>
          </ScaleIn>
        </div>
      </PageTransition>
    );
  }

  // ─── NOT FOUND ───
  if (error || !event) {
    return (
      <PageTransition>
        <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
          <ScaleIn>
            <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }} style={{ fontSize: '56px', display: 'block' }}>🔍</motion.span>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: '#191B1E', marginTop: '12px' }}>Event Not Found</h1>
              <p style={{ color: '#77736A', marginTop: '12px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>The event link you clicked seems to be incorrect or has been archived by the host.</p>
              <Link href="/" style={{ display: 'inline-block', marginTop: '24px', padding: '12px 28px', background: '#B8944F', color: '#FFFFFF', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>Go to Homepage</Link>
            </div>
          </ScaleIn>
        </div>
      </PageTransition>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     MAIN EVENT PAGE
     ═══════════════════════════════════════════════════════════════ */

  const isWedding = event.template_type === 'wedding';
  const customColors = event.custom_colors || {};
  const themeColor = customColors.primary || (isWedding ? '#B8944F' : '#191B1E');
  const isRTL = lang === 'ar';
  const t = translations[lang];
  const localizedTitle = isRTL && event.title_ar ? event.title_ar : event.title;
  const localizedDesc = isRTL && event.description_ar ? event.description_ar : event.description;
  const localizedDressCode = isRTL && event.dress_code_ar ? event.dress_code_ar : event.dress_code;
  const musicUrl = event.background_music_url || event.template_data?.bg_music_url;
  const eventPassed = event.event_date && new Date(event.event_date) < new Date();

  return (
    <PageTransition>
      {/* One-time premium envelope reveal — fixed overlay above the page; the
          page tree below is rendered untouched underneath it. */}
      <AnimatePresence>
        {showReveal && (
          <GuestEnvelopeReveal key="guest-reveal" event={event} onComplete={handleRevealComplete} />
        )}
      </AnimatePresence>
      <div dir={isRTL ? 'rtl' : 'ltr'} style={{
        minHeight: '100vh', position: 'relative',
        backgroundColor: customColors.background || '#F8F4EC', color: '#191B1E',
        fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left',
      }}>
        {/* ─── Custom Font Override ─── */}
        {event.custom_fonts && (() => {
          const headingFont = sanitizeFontName(event.custom_fonts.heading) || 'Playfair Display';
          const bodyFont = sanitizeFontName(event.custom_fonts.body) || 'Inter';
          return (
            <style dangerouslySetInnerHTML={{ __html: `
              h1, h2, h3, h4, h5, h6, .font-serif {
                font-family: '${headingFont}', Georgia, serif !important;
              }
              .font-sans, button, input, select, textarea, label {
                font-family: '${bodyFont}', sans-serif !important;
              }
              div, p, span, a, td, th {
                font-family: '${bodyFont}', sans-serif;
              }
            `}} />
          );
        })()}

        {/* ═══ LANGUAGE TOGGLE ═══ */}
        <div className="ep-lang-toggle" style={{ position: 'absolute', top: '24px', zIndex: 30, display: 'flex', gap: '8px', ...(isRTL ? { left: '24px' } : { right: '24px' }) }}>
          {['en', 'ar'].map(l => (
            <motion.button
              key={l}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setLang(l)}
              aria-label={l === 'en' ? 'Switch to English' : 'التبديل إلى العربية'}
              style={{
                padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                border: lang === l ? '1px solid rgba(184,148,79,0.4)' : '1px solid rgba(255,255,255,0.3)',
                background: lang === l ? 'rgba(184,148,79,0.9)' : 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                color: lang === l ? '#FFFFFF' : 'rgba(255,255,255,0.85)',
                fontFamily: 'var(--font-sans)', transition: 'all 0.3s ease',
              }}
            >
              {l === 'en' ? 'English' : 'العربية'}
            </motion.button>
          ))}
        </div>

        {/* ═══ CINEMATIC HERO ═══ */}
        <div ref={heroRef}>
          <ParallaxHero
            imageUrl={event.cover_image_url || 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?q=80&w=2070'}
            height="70vh"
            overlayGradient="linear-gradient(to top, rgba(25,27,30,0.92) 0%, rgba(25,27,30,0.5) 40%, rgba(25,27,30,0.15) 70%, transparent 100%)"
            style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <FloatingParticles count={25} color={themeColor} />
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '100%', width: '100%' }}>
              <div style={{ textAlign: 'center', paddingBottom: '72px', padding: '0 24px 72px', maxWidth: '800px', width: '100%' }}>
                {/* Event type badge */}
                <FadeInUp delay={0.1} y={20}>
                  <span style={{
                    fontSize: '11px', textTransform: 'uppercase', letterSpacing: '5px', color: '#D7BE80',
                    fontWeight: 700, display: 'inline-block', marginBottom: '16px', fontFamily: 'var(--font-sans)',
                    padding: '6px 20px', borderRadius: '20px',
                    background: 'rgba(215,190,128,0.1)', border: '1px solid rgba(215,190,128,0.2)',
                    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  }}>
                    {isRTL ? (event.template_type === 'wedding' ? 'بطاقة زفاف' : 'تفاصيل الفعالية') : `${event.template_type} invitation`}
                  </span>
                </FadeInUp>

                {/* Animated title */}
                <AnimatedText
                  text={localizedTitle}
                  tag="h1"
                  delay={0.3}
                  style={{
                    fontSize: '48px', fontWeight: isWedding ? 400 : 700, color: '#FFFFFF',
                    letterSpacing: '1px', marginBottom: '20px',
                    fontFamily: isWedding ? 'var(--font-serif)' : 'var(--font-sans)',
                    lineHeight: 1.15, textShadow: '0 4px 30px rgba(0,0,0,0.3)',
                  }}
                  className="ep-hero-title"
                />

                {/* Description */}
                <FadeInUp delay={0.7} y={20}>
                  <p style={{
                    color: 'rgba(255,255,255,0.75)', maxWidth: '640px', margin: '0 auto',
                    fontWeight: 300, fontSize: '15px', lineHeight: 1.8,
                  }}>
                    {localizedDesc}
                  </p>
                </FadeInUp>

                {/* Hero action buttons */}
                <FadeInUp delay={0.9} y={20}>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '28px', flexWrap: 'wrap' }}>
                    <CalendarButton event={event} isRTL={isRTL} />
                    <ShareButton title={event.title} text={event.description} isRTL={isRTL} />
                  </div>
                </FadeInUp>
              </div>
            </div>
          </ParallaxHero>
        </div>

        {/* ═══ MAIN CONTENT GRID ═══ */}
        <div className="ep-content-grid" style={{ maxWidth: '960px', margin: '0 auto', padding: '64px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '48px' }}>

          {/* ─── LEFT COLUMN: Details ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* Event Details Card */}
            <FadeInUp delay={0.1}>
              <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)" style={{ padding: '36px' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: '#191B1E', marginBottom: '24px' }}>{t.details_title}</h2>

                <StaggerChildren staggerDelay={0.12} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="ep-details-grid">
                  {/* When */}
                  <StaggerItem>
                    <div>
                      <span style={{ fontSize: '10px', color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                        📅 {t.when}
                      </span>
                      <span style={{ fontSize: '15px', color: '#191B1E', fontWeight: 500, display: 'block' }}>
                        {new Date(event.event_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      <span style={{ fontSize: '13px', color: '#77736A', display: 'block', marginTop: '4px' }}>
                        {t.starting_at} {new Date(event.event_date).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </StaggerItem>

                  {/* Where */}
                  <StaggerItem>
                    <div>
                      <span style={{ fontSize: '10px', color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                        📍 {t.where}
                      </span>
                      <span style={{ fontSize: '15px', color: '#191B1E', fontWeight: 500, display: 'block' }}>{event.location_name}</span>
                      <span style={{ fontSize: '13px', color: '#77736A', display: 'block', marginTop: '4px' }}>{event.location_address}</span>
                      {(event.location_lat && event.location_lng || event.location_address) && (
                        <a
                          href={getDirectionsUrl(event.location_lat, event.location_lng, event.location_address)}
                          target="_blank" rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px',
                            fontSize: '12px', fontWeight: 600, color: themeColor, textDecoration: 'none',
                          }}
                        >
                          🧭 {isRTL ? 'احصل على الاتجاهات' : 'Get Directions'} →
                        </a>
                      )}
                    </div>
                  </StaggerItem>

                  {/* Dress Code (expandable) */}
                  {event.dress_code && (
                    <StaggerItem style={{ gridColumn: '1 / -1' }}>
                      <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                        <button
                          onClick={() => setDressCodeExpanded(!dressCodeExpanded)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-sans)',
                          }}
                        >
                          <span style={{ fontSize: '10px', color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>
                            👔 {t.dress_code}
                          </span>
                          <motion.span animate={{ rotate: dressCodeExpanded ? 180 : 0 }} transition={{ duration: 0.25 }} style={{ fontSize: '12px', color: '#77736A' }}>
                            ▼
                          </motion.span>
                        </button>
                        <AnimatePresence>
                          {dressCodeExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <span style={{ fontSize: '14px', color: '#77736A', fontStyle: 'italic', display: 'block', marginTop: '8px' }}>
                                {localizedDressCode}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {!dressCodeExpanded && (
                          <span style={{ fontSize: '14px', color: '#77736A', fontStyle: 'italic', display: 'block', marginTop: '6px' }}>
                            {localizedDressCode}
                          </span>
                        )}
                      </div>
                    </StaggerItem>
                  )}
                </StaggerChildren>
              </GlassmorphismCard>
            </FadeInUp>

            {/* ═══ COUNTDOWN ═══ */}
            {timeLeft.days !== undefined ? (
              <FadeInUp delay={0.2}>
                <GlassmorphismCard
                  bg="rgba(25,27,30,0.95)"
                  border="rgba(255,255,255,0.08)"
                  blur={24}
                  hoverable={false}
                  style={{ padding: '36px 24px', borderRadius: '20px' }}
                >
                  <p style={{ textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '20px', fontFamily: 'var(--font-sans)' }}>
                    {t.countdown_title || (isRTL ? 'متبقي على الاحتفال' : 'Celebrating In')}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <CountdownDigit value={timeLeft.days} label={t.days} color={themeColor} />
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '28px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '28px', fontWeight: 300 }}>:</span>
                    </div>
                    <CountdownDigit value={timeLeft.hours} label={t.hours} color={themeColor} />
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '28px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '28px', fontWeight: 300 }}>:</span>
                    </div>
                    <CountdownDigit value={timeLeft.minutes} label={t.minutes} color={themeColor} />
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '28px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '28px', fontWeight: 300 }}>:</span>
                    </div>
                    <CountdownDigit value={timeLeft.seconds} label={t.seconds} color={themeColor} />
                  </div>
                </GlassmorphismCard>
              </FadeInUp>
            ) : eventPassed && (
              <FadeInUp delay={0.2}>
                <GlassmorphismCard bg="rgba(196,94,94,0.06)" border="rgba(196,94,94,0.2)" hoverable={false} style={{ textAlign: 'center', padding: '32px' }}>
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>⏰</motion.span>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#C45E5E' }}>
                    {lang === 'ar' ? 'لقد انتهت هذه الفعالية' : 'This event has already occurred'}
                  </h3>
                  <p style={{ color: '#77736A', fontSize: '13px', marginTop: '8px', lineHeight: 1.6 }}>
                    {lang === 'ar' ? 'كان موعد الفعالية قد مضى. شكراً لكم على اهتمامكم.' : 'The event date has passed. Thank you for your interest.'}
                  </p>
                </GlassmorphismCard>
              </FadeInUp>
            )}

            {/* ═══════════════════════════════════════════
                TEMPLATE-SPECIFIC SECTIONS
                ═══════════════════════════════════════════ */}

            {/* ─── WEDDING ─── */}
            {event.template_type === 'wedding' && event.template_data && (
              <FadeInUp delay={0.15}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Partners */}
                  {(event.template_data.partner1Name || event.template_data.partner2Name || event.template_data.groom_name || event.template_data.bride_name) && (
                    <ScaleIn>
                      <div style={{
                        textAlign: 'center', padding: '32px 24px',
                        background: `linear-gradient(135deg, rgba(184,148,79,0.06), rgba(184,148,79,0.02))`,
                        borderRadius: '16px', border: '1px solid rgba(184,148,79,0.15)',
                        position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '80px', opacity: 0.04 }}>💍</div>
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '30px', color: themeColor, fontWeight: 500, lineHeight: 1.4 }}>
                          {event.template_data.groom_name || event.template_data.partner1Name}
                          <span style={{ display: 'block', fontSize: '18px', opacity: 0.5, margin: '4px 0' }}>&amp;</span>
                          {event.template_data.bride_name || event.template_data.partner2Name}
                        </span>
                      </div>
                    </ScaleIn>
                  )}

                  {/* Family names */}
                  {event.template_data.family_names && (
                    <FadeInUp>
                      <div style={{ textAlign: 'center', padding: '12px', color: '#77736A', fontSize: '13px', fontStyle: 'italic' }}>
                        {isRTL ? 'بدعوة من' : 'With the honor of'} {event.template_data.family_names}
                      </div>
                    </FadeInUp>
                  )}

                  {/* Love Story — Timeline style */}
                  {event.template_data.loveStory && (
                    <FadeInUp>
                      <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)">
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                          <div style={{
                            width: '4px', minHeight: '60px', borderRadius: '2px', flexShrink: 0,
                            background: `linear-gradient(to bottom, ${themeColor}, rgba(184,148,79,0.2))`,
                          }} />
                          <div>
                            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 600, color: '#191B1E', marginBottom: '12px' }}>
                              {isRTL ? 'قصة حبنا' : 'Our Love Story'}
                            </h4>
                            <p style={{ fontSize: '14px', color: '#77736A', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{event.template_data.loveStory}</p>
                          </div>
                        </div>
                      </GlassmorphismCard>
                    </FadeInUp>
                  )}

                  {/* Ceremony & Reception — Timeline Cards */}
                  {(event.template_data.ceremonyLocation || event.template_data.receptionLocation || event.template_data.ceremony_time || event.template_data.reception_time) && (
                    <StaggerChildren staggerDelay={0.15} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="ep-ceremony-grid">
                      {(event.template_data.ceremonyLocation || event.template_data.ceremony_time) && (
                        <StaggerItem>
                          <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)" style={{ padding: '24px', textAlign: 'center' }}>
                            <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>💒</span>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#77736A', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                              {isRTL ? 'مراسم الزواج' : 'Ceremony'}
                            </span>
                            <span style={{ fontSize: '14px', color: '#191B1E', fontWeight: 500 }}>{event.template_data.ceremony_time || event.template_data.ceremonyLocation}</span>
                          </GlassmorphismCard>
                        </StaggerItem>
                      )}
                      {(event.template_data.receptionLocation || event.template_data.reception_time) && (
                        <StaggerItem>
                          <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)" style={{ padding: '24px', textAlign: 'center' }}>
                            <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>🥂</span>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#77736A', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                              {isRTL ? 'حفل الاستقبال' : 'Reception'}
                            </span>
                            <span style={{ fontSize: '14px', color: '#191B1E', fontWeight: 500 }}>{event.template_data.reception_time || event.template_data.receptionLocation}</span>
                          </GlassmorphismCard>
                        </StaggerItem>
                      )}
                    </StaggerChildren>
                  )}

                  {/* Accommodations */}
                  {event.template_data.accommodations && (
                    <FadeInUp>
                      <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)">
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: '#191B1E', marginBottom: '10px' }}>🏨 {isRTL ? 'الإقامة' : 'Accommodations'}</h4>
                        <p style={{ fontSize: '13px', color: '#77736A', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{event.template_data.accommodations}</p>
                      </GlassmorphismCard>
                    </FadeInUp>
                  )}

                  {/* Gift Registry */}
                  {event.template_data.registryUrl && (
                    <FadeInUp>
                      <a href={event.template_data.registryUrl} target="_blank" rel="noopener noreferrer" style={{
                        display: 'block', textAlign: 'center', padding: '16px',
                        background: 'rgba(184,148,79,0.06)', border: '1px solid rgba(184,148,79,0.15)',
                        borderRadius: '14px', color: themeColor, fontWeight: 600, fontSize: '13px', textDecoration: 'none',
                        transition: 'all 0.3s ease',
                      }}>
                        🎁 {isRTL ? 'عرض قائمة الهدايا' : 'View Our Gift Registry'} →
                      </a>
                    </FadeInUp>
                  )}
                </div>
              </FadeInUp>
            )}

            {/* ─── ENGAGEMENT ─── */}
            {event.template_type === 'engagement' && event.template_data && (
              <FadeInUp delay={0.15}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {(event.template_data.partner1Name || event.template_data.partner2Name) && (
                    <ScaleIn>
                      <div style={{
                        textAlign: 'center', padding: '28px', borderRadius: '16px',
                        background: 'rgba(194,123,142,0.04)', border: '1px solid rgba(194,123,142,0.12)',
                      }}>
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: themeColor }}>
                          {event.template_data.partner1Name} &amp; {event.template_data.partner2Name}
                        </span>
                      </div>
                    </ScaleIn>
                  )}
                  {event.template_data.ourStory && (
                    <FadeInUp>
                      <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)">
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: '#191B1E', marginBottom: '12px' }}>
                          {isRTL ? 'قصتنا' : 'Our Story'}
                        </h4>
                        <p style={{ fontSize: '14px', color: '#77736A', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{event.template_data.ourStory}</p>
                      </GlassmorphismCard>
                    </FadeInUp>
                  )}
                  {event.template_data.registryUrl && (
                    <FadeInUp>
                      <a href={event.template_data.registryUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '14px', background: 'rgba(194,123,142,0.06)', border: '1px solid rgba(194,123,142,0.15)', borderRadius: '14px', color: themeColor, fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
                        🎁 {isRTL ? 'عرض قائمة الهدايا' : 'View Our Gift Registry'} →
                      </a>
                    </FadeInUp>
                  )}
                </div>
              </FadeInUp>
            )}

            {/* ─── CORPORATE ─── */}
            {event.template_type === 'corporate' && event.template_data && (
              <FadeInUp delay={0.15}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {(event.template_data.companyName || event.template_data.company_name) && (
                    <ScaleIn>
                      <div style={{ textAlign: 'center', padding: '18px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.5px' }}>
                          {isRTL ? 'بتنظيم من' : 'Hosted by'} {event.template_data.company_name || event.template_data.companyName}
                        </span>
                      </div>
                    </ScaleIn>
                  )}
                  {/* Agenda — animated card */}
                  {event.template_data.agenda && (
                    <FadeInUp>
                      <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)">
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: '#191B1E', marginBottom: '12px' }}>📋 {isRTL ? 'أجندة الفعالية' : 'Event Agenda'}</h4>
                        <div style={{ fontSize: '14px', color: '#77736A', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{event.template_data.agenda}</div>
                      </GlassmorphismCard>
                    </FadeInUp>
                  )}
                  {event.template_data.speakers && (
                    <FadeInUp>
                      <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)">
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: '#191B1E', marginBottom: '12px' }}>🎤 {isRTL ? 'المتحدثون' : 'Speakers & Presenters'}</h4>
                        <div style={{ fontSize: '14px', color: '#77736A', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{event.template_data.speakers}</div>
                      </GlassmorphismCard>
                    </FadeInUp>
                  )}
                  {event.template_data.sponsors && (
                    <FadeInUp>
                      <div style={{ textAlign: 'center', padding: '18px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#77736A', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                          {isRTL ? 'برعاية' : 'Sponsored By'}
                        </span>
                        <span style={{ fontSize: '14px', color: '#1E293B' }}>{event.template_data.sponsors}</span>
                      </div>
                    </FadeInUp>
                  )}
                  {event.template_data.networkingNotes && (
                    <FadeInUp>
                      <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)" style={{ padding: '20px' }}>
                        <span style={{ fontSize: '13px', color: '#77736A', lineHeight: 1.7 }}>
                          🤝 {event.template_data.networkingNotes}
                        </span>
                      </GlassmorphismCard>
                    </FadeInUp>
                  )}
                </div>
              </FadeInUp>
            )}

            {/* ─── BIRTHDAY ─── */}
            {event.template_type === 'birthday' && event.template_data && (
              <FadeInUp delay={0.15}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {event.template_data.birthdayPersonName && (
                    <ScaleIn>
                      <div style={{
                        textAlign: 'center', padding: '28px',
                        background: 'rgba(232,93,117,0.04)', borderRadius: '16px', border: '1px solid rgba(232,93,117,0.12)',
                      }}>
                        <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.3 }} style={{ fontSize: '36px', display: 'block', marginBottom: '10px' }}>🎉</motion.span>
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: themeColor, display: 'block' }}>
                          {event.template_data.birthdayPersonName}
                        </span>
                        {event.template_data.ageMilestone && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.5 }} style={{
                            display: 'inline-block', marginTop: '10px', padding: '5px 20px',
                            background: themeColor, color: '#FFFFFF', borderRadius: '20px',
                            fontSize: '13px', fontWeight: 700,
                          }}>
                            {event.template_data.ageMilestone}
                          </motion.span>
                        )}
                      </div>
                    </ScaleIn>
                  )}
                  {event.template_data.theme && (
                    <FadeInUp>
                      <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)" style={{ textAlign: 'center', padding: '20px' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#77736A', fontWeight: 700, display: 'block', marginBottom: '6px' }}>🎭 {isRTL ? 'ثيم الحفلة' : 'Party Theme'}</span>
                        <span style={{ fontSize: '15px', color: '#191B1E', fontWeight: 500 }}>{event.template_data.theme}</span>
                      </GlassmorphismCard>
                    </FadeInUp>
                  )}
                  {event.template_data.registryUrl && (
                    <FadeInUp>
                      <a href={event.template_data.registryUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '14px', background: 'rgba(232,93,117,0.06)', border: '1px solid rgba(232,93,117,0.15)', borderRadius: '14px', color: themeColor, fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
                        🎁 {isRTL ? 'عرض قائمة الهدايا' : 'View Gift Registry'} →
                      </a>
                    </FadeInUp>
                  )}
                </div>
              </FadeInUp>
            )}

            {/* ─── GALA ─── */}
            {event.template_type === 'gala' && event.template_data && (
              <FadeInUp delay={0.15}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {event.template_data.honorees && (
                    <ScaleIn>
                      <div style={{ textAlign: 'center', padding: '24px', background: 'rgba(184,148,79,0.04)', borderRadius: '16px', border: '1px solid rgba(184,148,79,0.12)' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#B8944F', fontWeight: 700, display: 'block', marginBottom: '10px' }}>✨ {isRTL ? 'تكريم' : 'Honoring'}</span>
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: '#191B1E' }}>{event.template_data.honorees}</span>
                      </div>
                    </ScaleIn>
                  )}
                  {event.template_data.program && (
                    <FadeInUp>
                      <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)">
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: '#191B1E', marginBottom: '12px' }}>🎶 {isRTL ? 'البرنامج والترفيه' : 'Program & Entertainment'}</h4>
                        <div style={{ fontSize: '14px', color: '#77736A', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{event.template_data.program}</div>
                      </GlassmorphismCard>
                    </FadeInUp>
                  )}
                  {event.template_data.sponsorTiers && (
                    <FadeInUp>
                      <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)">
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: '#191B1E', marginBottom: '12px' }}>🏆 {isRTL ? 'فئات الرعاة' : 'Sponsor Tiers'}</h4>
                        <div style={{ fontSize: '14px', color: '#77736A', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{event.template_data.sponsorTiers}</div>
                      </GlassmorphismCard>
                    </FadeInUp>
                  )}
                </div>
              </FadeInUp>
            )}

          </div>

          {/* ─── RIGHT COLUMN: RSVP & Seating ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '32px', alignSelf: 'start' }}>

            {/* RSVP Card */}
            <div ref={rsvpCardRef}>
              <ScaleIn delay={0.2}>
                <GlassmorphismCard bg="rgba(255,255,255,0.94)" border="rgba(232,226,214,0.6)" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', padding: '36px 28px' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: '#191B1E' }}>{t.card_title}</h3>
                  <p style={{ fontSize: '13px', color: '#77736A', lineHeight: 1.6 }}>
                    {t.reply_by} <strong style={{ color: '#191B1E' }}>{event.rsvp_deadline ? new Date(event.rsvp_deadline).toLocaleDateString(lang === 'ar' ? 'ar-EG' : undefined) : 'N/A'}</strong> {t.card_desc}
                  </p>
                  <GlowPulse color={themeColor} intensity={0.25}>
                    <Link href={`/${slug}/rsvp?lang=${lang}`} style={{
                      display: 'block', width: '100%', padding: '16px', textAlign: 'center', color: '#FFFFFF', fontWeight: 700,
                      fontSize: '14px', borderRadius: '12px', textDecoration: 'none', fontFamily: 'var(--font-sans)',
                      background: themeColor, letterSpacing: '0.5px', boxSizing: 'border-box',
                    }}>
                      {t.rsvp_now}
                    </Link>
                  </GlowPulse>
                </GlassmorphismCard>
              </ScaleIn>
            </div>

            {/* Seating Finder */}
            <ScaleIn delay={0.35}>
              <GlassmorphismCard bg="rgba(255,255,255,0.94)" border="rgba(232,226,214,0.6)" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', padding: '32px 28px' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#191B1E' }}>{t.find_table_title}</h3>
                <p style={{ fontSize: '12px', color: '#77736A', lineHeight: 1.6 }}>{t.find_table_desc}</p>

                <form onSubmit={handleSeatingSearch} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text"
                    value={seatingSearchQuery}
                    onChange={(e) => setSeatingSearchQuery(e.target.value)}
                    placeholder={t.find_table_placeholder}
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '13px', padding: '12px 14px' }}
                    onFocus={inputFocus}
                    onBlur={(e) => inputBlur(e)}
                  />
                  <PremiumButton
                    variant="gold"
                    fullWidth
                    size="sm"
                    loading={seatingSearching}
                    onClick={handleSeatingSearch}
                    style={{ background: themeColor }}
                  >
                    {t.find_table_btn}
                  </PremiumButton>
                </form>

                {/* Results */}
                <AnimatePresence>
                  {seatingResults !== null && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ marginTop: '4px', textAlign: isRTL ? 'right' : 'left', overflow: 'hidden' }}
                    >
                      {seatingResults.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#C45E5E', textAlign: 'center' }}>{t.find_table_no_results}</p>
                      ) : (
                        <StaggerChildren staggerDelay={0.08} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {seatingResults.map((res, i) => (
                            <StaggerItem key={i}>
                              <div style={{
                                background: 'rgba(184,148,79,0.04)', border: '1px solid rgba(184,148,79,0.12)',
                                borderRadius: '10px', padding: '14px',
                              }}>
                                <span style={{ fontWeight: 600, fontSize: '13px', color: '#191B1E', display: 'block' }}>
                                  {t.find_table_assigned.replace('{name}', res.guestName).replace('{tableName}', res.tableName)}
                                </span>
                                <span style={{ fontSize: '11px', color: '#77736A', display: 'block', marginTop: '4px' }}>
                                  {t.find_table_party.replace('{partySize}', res.partySize.toString())}
                                </span>
                              </div>
                            </StaggerItem>
                          ))}
                        </StaggerChildren>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {seatingError && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: '12px', color: '#C45E5E', marginTop: '4px' }}>{seatingError}</motion.p>
                )}
              </GlassmorphismCard>
            </ScaleIn>
          </div>
        </div>

        {/* ═══ PHOTO GALLERY ═══ */}
        {event.gallery_urls && Array.isArray(event.gallery_urls) && event.gallery_urls.length > 0 && (
          <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px' }}>
            <FadeInUp>
              <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)" style={{ padding: '36px' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: '#191B1E', marginBottom: '24px', textAlign: 'center' }}>
                  {isRTL ? 'معرض الصور' : 'Photo Gallery'}
                </h2>
                <StaggerChildren
                  staggerDelay={0.08}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: event.gallery_urls.length === 1 ? '1fr' : event.gallery_urls.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
                    gap: '12px',
                  }}
                  className="ep-gallery-grid"
                >
                  {event.gallery_urls.map((url, i) => (
                    <StaggerItem key={i}>
                      <motion.div
                        whileHover={{ scale: 1.03 }}
                        transition={{ duration: 0.3 }}
                        onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                        style={{
                          borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
                          height: event.gallery_urls.length <= 2 ? '280px' : '200px',
                          background: '#F0ECE3', position: 'relative',
                        }}
                      >
                        <img
                          src={url}
                          alt={`Gallery photo ${i + 1}`}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
                          onError={e => e.target.style.display = 'none'}
                        />
                        {/* Hover overlay */}
                        <div style={{
                          position: 'absolute', inset: 0, background: 'rgba(25,27,30,0)', transition: 'background 0.3s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(25,27,30,0.25)'; e.currentTarget.querySelector('span').style.opacity = '1'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(25,27,30,0)'; e.currentTarget.querySelector('span').style.opacity = '0'; }}
                        >
                          <span style={{ color: '#FFFFFF', fontSize: '24px', opacity: 0, transition: 'opacity 0.3s' }}>⤢</span>
                        </div>
                      </motion.div>
                    </StaggerItem>
                  ))}
                </StaggerChildren>
              </GlassmorphismCard>
            </FadeInUp>

            {/* Lightbox */}
            <AnimatePresence>
              {lightboxOpen && (
                <GalleryLightbox
                  images={event.gallery_urls}
                  initialIndex={lightboxIndex}
                  onClose={() => setLightboxOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ═══ MAP EMBED ═══ */}
        {event.location_lat && event.location_lng && (
          <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 64px' }}>
            <FadeInUp>
              <GlassmorphismCard bg="rgba(255,255,255,0.92)" border="rgba(232,226,214,0.6)" style={{ padding: '36px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: '#191B1E' }}>
                    {isRTL ? 'الموقع' : 'Location'}
                  </h2>
                  <a
                    href={getDirectionsUrl(event.location_lat, event.location_lng, event.location_address)}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '8px 18px', borderRadius: '10px',
                      background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.15)',
                      color: themeColor, fontWeight: 600, fontSize: '12px', textDecoration: 'none',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    🧭 {isRTL ? 'الاتجاهات' : 'Get Directions'}
                  </a>
                </div>
                <div style={{ borderRadius: '14px', overflow: 'hidden', height: '300px', border: '1px solid #E8E2D6' }}>
                  {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                    <iframe
                      title="Event Location Map"
                      width="100%" height="100%" style={{ border: 0 }}
                      loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${event.location_lat},${event.location_lng}&zoom=15`}
                    />
                  ) : (
                    <iframe
                      title="Event Location Map"
                      width="100%" height="100%" style={{ border: 0 }}
                      loading="lazy"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${event.location_lng - 0.01},${event.location_lat - 0.01},${event.location_lng + 0.01},${event.location_lat + 0.01}&layer=mapnik&marker=${event.location_lat},${event.location_lng}`}
                    />
                  )}
                </div>
                {event.location_address && (
                  <p style={{ fontSize: '13px', color: '#77736A', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📍 {event.location_address}
                  </p>
                )}
              </GlassmorphismCard>
            </FadeInUp>
          </div>
        )}

        {/* ═══ FLOATING RSVP CTA ═══ */}
        <AnimatePresence>
          {showFloatingCTA && !eventPassed && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
                background: 'rgba(25,27,30,0.95)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                padding: '14px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px',
              }}
              className="ep-floating-cta"
            >
              <div style={{ flex: 1, minWidth: 0, maxWidth: '400px' }}>
                <p style={{
                  fontSize: '13px', fontWeight: 600, color: '#FFFFFF', margin: 0,
                  fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {localizedTitle}
                </p>
                {event.rsvp_deadline && (
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: '2px 0 0', fontFamily: 'var(--font-sans)' }}>
                    {t.reply_by} {new Date(event.rsvp_deadline).toLocaleDateString(lang === 'ar' ? 'ar-EG' : undefined, { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
              <GlowPulse color={themeColor} intensity={0.3} style={{ flexShrink: 0 }}>
                <Link href={`/${slug}/rsvp?lang=${lang}`} style={{
                  display: 'inline-block', padding: '10px 28px', background: themeColor, color: '#FFFFFF',
                  fontWeight: 700, fontSize: '13px', borderRadius: '10px', textDecoration: 'none',
                  fontFamily: 'var(--font-sans)', letterSpacing: '0.3px', whiteSpace: 'nowrap',
                }}>
                  {t.rsvp_now}
                </Link>
              </GlowPulse>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ BACKGROUND MUSIC PLAYER ═══ */}
        {musicUrl && (
          <>
            <audio ref={audioRef} src={musicUrl} loop />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 1 }}
              style={{
                position: 'fixed',
                bottom: showFloatingCTA && !eventPassed ? '80px' : '24px',
                zIndex: 60,
                transition: 'bottom 0.3s ease',
                ...(isRTL ? { left: '24px' } : { right: '24px' }),
              }}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={togglePlay}
                style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.95)',
                  border: `2px solid ${themeColor}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', outline: 'none',
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                }}
                title="Background Music"
              >
                {isPlaying ? (
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '18px' }}>
                    <span style={{ width: '3px', background: themeColor, borderRadius: '1px', height: '14px', animation: 'pulseBar 0.8s infinite alternate' }} />
                    <span style={{ width: '3px', background: themeColor, borderRadius: '1px', height: '8px', animation: 'pulseBar 0.5s infinite alternate' }} />
                    <span style={{ width: '3px', background: themeColor, borderRadius: '1px', height: '18px', animation: 'pulseBar 0.7s infinite alternate' }} />
                  </div>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2.5">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                )}
              </motion.button>
            </motion.div>
          </>
        )}

        {/* ═══ FOOTER ═══ */}
        <FadeInUp>
          <div style={{
            textAlign: 'center', padding: '48px 24px 32px',
            borderTop: '1px solid rgba(232,226,214,0.4)',
          }}>
            <p style={{ fontSize: '11px', color: '#77736A', fontFamily: 'var(--font-sans)', fontWeight: 300, letterSpacing: '0.05em' }}>
              {isRTL ? 'صُمم بعناية بواسطة' : 'Crafted with elegance by'}{' '}
              <span style={{ fontWeight: 600, color: '#B8944F' }}>Fancy RSVP</span>
            </p>
          </div>
        </FadeInUp>

        {/* ═══ GLOBAL STYLES ═══ */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulseBar {
            0% { height: 4px; }
            100% { height: 18px; }
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }

          /* ─── Mobile Responsive ─── */
          @media (max-width: 768px) {
            .ep-content-grid {
              grid-template-columns: 1fr !important;
              padding: 40px 16px !important;
              gap: 32px !important;
            }
            .ep-hero-title {
              font-size: 32px !important;
            }
            .ep-details-grid {
              grid-template-columns: 1fr !important;
            }
            .ep-ceremony-grid {
              grid-template-columns: 1fr !important;
            }
            .ep-gallery-grid {
              grid-template-columns: 1fr 1fr !important;
            }
            .ep-floating-cta {
              padding: 12px 16px !important;
              gap: 12px !important;
            }
            .ep-lang-toggle {
              top: 16px !important;
            }
          }

          @media (max-width: 480px) {
            .ep-hero-title {
              font-size: 26px !important;
            }
            .ep-gallery-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </PageTransition>
  );
}
