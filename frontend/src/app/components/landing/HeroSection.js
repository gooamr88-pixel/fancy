"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";

/* ═══════════════════════════════════════════════════════════════
   HeroSection — Fancy RSVP (Page 09 Brand Guide — Pixel Perfect)
   
   Layout from mockup (Desktop):
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │  BEAUTIFULLY DESIGNED                    ┌────────────────┐  │
   │  RSVP EXPERIENCES                        │                │  │
   │                                          │  Wedding Hero  │  │
   │  Elegant RSVPs.                          │    Photo       │  │
   │  Effortless Planning.                    │                │  │
   │                                          └────────────────┘  │
   │  The all-in-one RSVP and guest                               │
   │  management platform for weddings                            │
   │  and special events.                                         │
   │                                                              │
   │  [Get Started]  [View Features]                              │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
   
   Below Hero:
   ┌──────────────────────────────────────────────────────────────┐
   │         PERFECT FOR ANY OCCASION                             │
   │     Weddings, events, and more.                              │
   │  ┌──────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐          │
   │  │ 💍   │ │ 🥂       │ │ 🎀     │ │ 🏢           │          │
   │  │Wedd. │ │Engage.   │ │Showers │ │Corp. Events  │          │
   │  └──────┘ └──────────┘ └────────┘ └──────────────┘          │
   └──────────────────────────────────────────────────────────────┘
   
   Then Features:
   ┌──────────────────────────────────────────────────────────────┐
   │  POWERFUL FEATURES                                           │
   │  Everything you need          ┌─────────────────────────┐    │
   │  to host with confidence.     │  Dashboard Mockup       │    │
   │  • Custom RSVP forms...       │  + Invitation Image     │    │
   │  [Explore All Features]       └─────────────────────────┘    │
   └──────────────────────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════════ */

/* ═══ Interactive Hero Card Component ═══ */
function HeroCard() {
  const [flipped, setFlipped] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [sparkles, setSparkles] = useState([]);

  useEffect(() => {
    setMounted(true);
    // Generate sparkle positions
    setSparkles(Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      y: 5 + Math.random() * 90,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 6,
      dur: 2 + Math.random() * 3,
    })));
  }, []);

  // Auto-flip
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => { if (!flipped) setFlipped(true); }, 5000);
    return () => clearTimeout(t);
  }, [mounted, flipped]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 18;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -18;
    setTilt({ x, y });
  };
  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  if (!mounted) return <div style={{ width: '100%', maxWidth: 420, aspectRatio: '3/4' }} />;

  return (
    <div className="hc-wrap animate-slide-in-right">
      {/* Ambient glows */}
      <div className="hc-amb hc-amb-1" />
      <div className="hc-amb hc-amb-2" />
      <div className="hc-amb hc-amb-3" />

      {/* Sparkle particles */}
      <div className="hc-sparkles">
        {sparkles.map(s => (
          <div key={s.id} className="hc-spark" style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: `${s.size}px`, height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
          }} />
        ))}
      </div>

      {/* 3D Perspective Container */}
      <div
        className="hc-stage"
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Flip card to front' : 'Flip card to see RSVP'}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => setFlipped(!flipped)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped(!flipped); } }}
      >
        <div
          className={`hc-card ${flipped ? 'hc-flipped' : ''}`}
          style={{
            transform: flipped
              ? `perspective(1400px) rotateY(180deg) rotateX(${tilt.y * 0.3}deg)`
              : `perspective(1400px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
          }}
        >
          {/* ── FRONT FACE ── */}
          <div className="hc-face hc-front">
            <img src="/images/hero-card-front.png" alt="Wedding invitation" className="hc-img" />
            {/* Gold border glow */}
            <div className="hc-border-glow" />
            {/* Shimmer sweep */}
            <div className="hc-shimmer" />
            {/* Hover light spot */}
            <div className="hc-light" style={{
              background: `radial-gradient(circle at ${50 + tilt.x * 3}% ${50 - tilt.y * 3}%, rgba(215,190,128,.12) 0%, transparent 50%)`,
            }} />
          </div>

          {/* ── BACK FACE ── */}
          <div className="hc-face hc-back">
            <img src="/images/hero-card-back.png" alt="RSVP response" className="hc-img" />
            <div className="hc-border-glow" />
            <div className="hc-shimmer hc-shimmer-back" />
          </div>
        </div>
      </div>

      {/* Label */}
      <div className={`hc-label ${flipped ? 'hc-label-flip' : ''}`}>
        <div className="hc-label-dot" />
        <span>{flipped ? 'RSVP Response Preview' : 'Interactive Invitation Preview'}</span>
        <span className="hc-label-action">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Tap to {flipped ? 'flip back' : 'see RSVP'}
        </span>
      </div>

      <style jsx>{`
        .hc-wrap {
          position: relative; width: 100%;
          display: flex; flex-direction: column;
          align-items: center; gap: 20px;
        }

        /* ═══ AMBIENT GLOWS ═══ */
        .hc-amb {
          position: absolute; border-radius: 50%; pointer-events: none;
          filter: blur(40px);
        }
        .hc-amb-1 {
          width: 320px; height: 320px; top: 10%; right: 5%;
          background: rgba(184,148,79,.06);
          animation: hcAmb1 6s ease-in-out infinite;
        }
        .hc-amb-2 {
          width: 250px; height: 250px; bottom: 10%; left: 10%;
          background: rgba(184,148,79,.04);
          animation: hcAmb2 8s ease-in-out infinite;
        }
        .hc-amb-3 {
          width: 180px; height: 180px; top: 40%; left: 30%;
          background: rgba(215,190,128,.05);
          animation: hcAmb1 5s ease-in-out infinite reverse;
        }
        @keyframes hcAmb1 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 1; }
          50% { transform: translate(10px, -15px) scale(1.15); opacity: .5; }
        }
        @keyframes hcAmb2 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: .8; }
          50% { transform: translate(-8px, 12px) scale(1.1); opacity: .4; }
        }

        /* ═══ SPARKLES ═══ */
        .hc-sparkles { position: absolute; inset: -20px; pointer-events: none; z-index: 0; }
        .hc-spark {
          position: absolute; border-radius: 50%;
          background: #D7BE80;
          animation: hcSparkle ease-in-out infinite;
        }
        @keyframes hcSparkle {
          0%, 100% { opacity: 0; transform: scale(.5); }
          50% { opacity: .6; transform: scale(1.2); }
        }

        /* ═══ 3D CARD ═══ */
        .hc-stage {
          width: 100%; max-width: 420px;
          aspect-ratio: 3/4.2;
          cursor: pointer; position: relative; z-index: 2;
        }
        .hc-card {
          width: 100%; height: 100%;
          transform-style: preserve-3d;
          transition: transform .9s cubic-bezier(.25, .8, .25, 1);
          position: relative;
        }

        .hc-face {
          position: absolute; inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border-radius: 8px;
          overflow: hidden;
        }
        .hc-img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }

        /* ── Border Glow ── */
        .hc-border-glow {
          position: absolute; inset: 0; border-radius: 8px;
          box-shadow:
            inset 0 0 0 1px rgba(215,190,128,.2),
            inset 0 0 0 2px rgba(215,190,128,.05),
            0 0 40px rgba(184,148,79,.08),
            0 20px 60px rgba(0,0,0,.15),
            0 40px 100px rgba(0,0,0,.08);
          pointer-events: none;
          animation: hcBorderPulse 4s ease-in-out infinite;
        }
        @keyframes hcBorderPulse {
          0%, 100% { box-shadow: inset 0 0 0 1px rgba(215,190,128,.2), inset 0 0 0 2px rgba(215,190,128,.05), 0 0 40px rgba(184,148,79,.08), 0 20px 60px rgba(0,0,0,.15), 0 40px 100px rgba(0,0,0,.08); }
          50% { box-shadow: inset 0 0 0 1px rgba(215,190,128,.35), inset 0 0 0 2px rgba(215,190,128,.1), 0 0 60px rgba(184,148,79,.12), 0 20px 60px rgba(0,0,0,.15), 0 40px 100px rgba(0,0,0,.08); }
        }

        /* ── Shimmer ── */
        .hc-shimmer {
          position: absolute; inset: 0; z-index: 3; pointer-events: none;
          border-radius: 8px;
          background: linear-gradient(
            110deg,
            transparent 30%,
            rgba(255,255,255,.03) 38%,
            rgba(215,190,128,.08) 42%,
            rgba(255,255,255,.14) 50%,
            rgba(215,190,128,.08) 58%,
            rgba(255,255,255,.03) 62%,
            transparent 70%
          );
          background-size: 250% 100%;
          animation: hcShimmer 5s ease-in-out infinite;
        }
        .hc-shimmer-back { animation-delay: 1s; }
        @keyframes hcShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Light follow cursor ── */
        .hc-light {
          position: absolute; inset: 0; z-index: 2;
          pointer-events: none; border-radius: 8px;
          transition: background .1s ease;
        }

        /* ── Back ── */
        .hc-back {
          transform: rotateY(180deg);
        }

        /* ═══ LABEL ═══ */
        .hc-label {
          display: flex; align-items: center; gap: 10px;
          font-size: 11px; font-weight: 500; letter-spacing: .1em;
          text-transform: uppercase; color: #9A9590;
          font-family: var(--font-sans);
          transition: all .4s ease;
        }
        .hc-label-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #B8944F;
          animation: hcDotPulse 2s ease-in-out infinite;
        }
        @keyframes hcDotPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(184,148,79,.3); }
          50% { opacity: .6; box-shadow: 0 0 0 4px rgba(184,148,79,0); }
        }
        .hc-label-action {
          display: flex; align-items: center; gap: 4px;
          color: #B8944F; font-weight: 600;
          margin-left: auto;
          animation: hcActionFloat 2.5s ease-in-out infinite;
        }
        @keyframes hcActionFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}

export default function HeroSection() {
  const { isLoggedIn, loading } = useAuth();

  return (
    <>
      {/* ════════════════════════════════════════════
          HERO SECTION
          ════════════════════════════════════════════ */}
      <section
        id="hero"
        style={{
          width: "100%",
          background: "#FFFFFF",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle warm ivory gradient overlay at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "200px",
            background: "linear-gradient(to bottom, transparent, #F8F4EC)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "80px 48px 100px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "64px",
            alignItems: "center",
            position: "relative",
            zIndex: 2,
          }}
          className="hero-grid"
        >
          {/* ─── Left Column: Text Content ─── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "28px",
            }}
            className="animate-fade-in-up"
          >
            {/* Eyebrow Label */}
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "#B8944F",
              }}
            >
              Beautifully Designed RSVP Experiences
            </span>

            {/* Main Headline */}
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "52px",
                fontWeight: 500,
                lineHeight: 1.12,
                color: "#191B1E",
                letterSpacing: "-0.5px",
              }}
              className="hero-headline"
            >
              Elegant RSVPs.
              <br />
              Effortless Planning.
            </h1>

            {/* Subtext */}
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "17px",
                fontWeight: 300,
                lineHeight: 1.7,
                color: "#77736A",
                maxWidth: "440px",
              }}
            >
              The all-in-one RSVP and guest management platform for weddings and special events.
            </p>

            {/* CTA Buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginTop: "8px",
              }}
              className="hero-buttons"
            >
              <Link
                href={!loading && isLoggedIn ? "/dashboard" : "/register"}
                className="btn-gold"
                style={{
                  padding: "15px 36px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
                id="hero-cta-get-started"
              >
                {!loading && isLoggedIn ? "Go to Dashboard" : "Get Started"}
              </Link>
              <Link
                href="/features"
                className="btn-outline"
                style={{
                  padding: "15px 36px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
                id="hero-cta-view-features"
              >
                View Features
              </Link>
            </div>
          </div>

          {/* ─── Right Column: Interactive Card Preview ─── */}
          <HeroCard />
        </div>
      </section>

      {/* ════════════════════════════════════════════
          OCCASIONS SECTION — "Perfect for Any Occasion"
          ════════════════════════════════════════════ */}
      <section
        id="occasions"
        style={{
          width: "100%",
          background: "#F8F4EC",
          padding: "80px 0",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "0 48px",
            textAlign: "center",
          }}
        >
          {/* Eyebrow */}
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#B8944F",
              display: "block",
              marginBottom: "12px",
            }}
          >
            Perfect for Any Occasion
          </span>

          {/* Section Title */}
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "36px",
              fontWeight: 500,
              color: "#191B1E",
              marginBottom: "56px",
              letterSpacing: "-0.3px",
            }}
          >
            Weddings, custom, and eternal love.
          </h2>

          {/* Occasion Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "24px",
              maxWidth: "960px",
              margin: "0 auto",
            }}
            className="occasions-grid"
          >
            {[
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#D7BE80" strokeWidth="1" />
                    <path d="M14 28C14 28 16 24 20 24C24 24 26 28 26 28" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="15" cy="14" r="3" stroke="#B8944F" strokeWidth="1.2" fill="none" />
                    <circle cx="25" cy="14" r="3" stroke="#B8944F" strokeWidth="1.2" fill="none" />
                    <path d="M18 11L20 8L22 11" stroke="#D7BE80" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                ),
                title: "Weddings",
                desc: "Celebrate your big day with elegant RSVPs.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#D7BE80" strokeWidth="1" />
                    <path d="M13 27L15 25M18 22L27 13C28.1 11.9 28.1 10.1 27 9C25.9 7.9 24.1 7.9 23 9L14 18M14 18L12 24L18 22" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M25 8L27 10" stroke="#D7BE80" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                ),
                title: "Custom",
                desc: "Design custom event pages tailored to your style.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#D7BE80" strokeWidth="1" />
                    <path d="M15 16C15 13.2 17.2 11 20 11C21.6 11 22.8 11.8 23.5 12.6C24.2 11.8 25.4 11 27 11C29.8 11 32 13.2 32 16C32 20.8 24.2 25.2 23.5 25.2C22.8 25.2 15 20.8 15 16Z" stroke="#B8944F" strokeWidth="1.5" />
                    <path d="M8 19C8 16.8 9.8 15 12 15C13.3 15 14.2 15.6 14.8 16.3M14.8 26.2C14.2 26.2 8 22.8 8 19C8 18 8.3 17 9 16.2" stroke="#D7BE80" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                ),
                title: "Eternal Love",
                desc: "Toast to love with beautiful, eternal pages.",
              },
            ].map((card) => (
              <div key={card.title} className="occasion-card">
                <div style={{ marginBottom: "20px" }}>{card.icon}</div>
                <h3
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "#191B1E",
                    marginBottom: "10px",
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 300,
                    color: "#77736A",
                    lineHeight: 1.6,
                  }}
                >
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FEATURES SECTION — "Powerful Features"
          ════════════════════════════════════════════ */}
      <section
        id="features"
        style={{
          width: "100%",
          background: "#FFFFFF",
          padding: "100px 0",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "0 48px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "64px",
            alignItems: "center",
          }}
          className="features-grid"
        >
          {/* ─── Left Column: Feature List ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Eyebrow */}
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "#B8944F",
              }}
            >
              Powerful Features
            </span>

            {/* Headline */}
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "38px",
                fontWeight: 500,
                color: "#191B1E",
                lineHeight: 1.2,
                letterSpacing: "-0.3px",
              }}
              className="features-headline"
            >
              Everything you need to host with confidence.
            </h2>

            {/* Feature Bullets */}
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                marginTop: "8px",
              }}
            >
              {[
                "Custom RSVP forms and event pages",
                "Guest list management and plus-ones",
                "Dietary preferences and meal selections",
                "Real-time tracking and smart analytics",
                "Seating charts and table arrangements",
                "Beautiful design, seamless experience",
              ].map((feature) => (
                <li
                  key={feature}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    fontWeight: 400,
                    color: "#191B1E",
                    lineHeight: 1.5,
                  }}
                >
                  {/* Gold checkmark bullet */}
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#B8944F",
                      flexShrink: 0,
                    }}
                  />
                  {feature}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Link
              href="/pricing"
              className="btn-gold"
              style={{
                padding: "14px 32px",
                fontSize: "14px",
                alignSelf: "flex-start",
                marginTop: "8px",
                textDecoration: "none",
                display: "inline-block",
              }}
              id="features-cta-explore"
            >
              Explore All Features
            </Link>
          </div>

          {/* ─── Right Column: Dashboard + Stationery Image ─── */}
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            {/* Dashboard mockup card */}
            <div
              style={{
                width: "100%",
                maxWidth: "480px",
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E8E2D6",
                padding: "28px",
                boxShadow: "0 16px 50px rgba(0,0,0,0.06)",
                position: "relative",
                zIndex: 2,
              }}
            >
              {/* Mini Dashboard Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "24px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid #E8E2D6",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#191B1E",
                  }}
                >
                  RSVP Overview
                </span>
              </div>

              {/* Stats Row */}
              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                {[
                  { label: "Accepted", value: "198", color: "#B8944F" },
                  { label: "Declined", value: "32", color: "#77736A" },
                  { label: "Pending", value: "20", color: "#D7BE80" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: stat.color,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                          fontWeight: 300,
                          color: "#77736A",
                        }}
                      >
                        {stat.label}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "#191B1E",
                        }}
                      >
                        {stat.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Donut Chart Placeholder */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "24px",
                }}
              >
                <div style={{ position: "relative", width: "120px", height: "120px" }}>
                  <svg viewBox="0 0 120 120" width="120" height="120">
                    {/* Background ring */}
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke="#E8E2D6"
                      strokeWidth="12"
                    />
                    {/* Accepted segment (79%) */}
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke="#B8944F"
                      strokeWidth="12"
                      strokeDasharray={`${0.79 * 2 * Math.PI * 48} ${2 * Math.PI * 48}`}
                      strokeDashoffset={2 * Math.PI * 48 * 0.25}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 1s ease" }}
                    />
                    {/* Declined segment (12.8%) */}
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke="#77736A"
                      strokeWidth="12"
                      strokeDasharray={`${0.128 * 2 * Math.PI * 48} ${2 * Math.PI * 48}`}
                      strokeDashoffset={2 * Math.PI * 48 * 0.25 - 0.79 * 2 * Math.PI * 48}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Center Text */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "24px",
                        fontWeight: 900,
                        color: "#191B1E",
                        lineHeight: 1,
                      }}
                    >
                      79%
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "10px",
                        fontWeight: 400,
                        color: "#77736A",
                        marginTop: "2px",
                      }}
                    >
                      Accepted
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#77736A",
                    letterSpacing: "0.5px",
                    marginBottom: "12px",
                    textTransform: "uppercase",
                  }}
                >
                  Recent Activity
                </div>
                {[
                  { name: "Taylor Guest", action: "responded", status: "Accepts", time: "2m ago" },
                  { name: "Jordan Lee", action: "responded", status: "Declines", time: "15m ago" },
                  { name: "Sam & Alex", action: "responded", status: "Accepts", time: "1h ago" },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: i < 2 ? "1px solid #F0ECE3" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background:
                            item.status === "Accepts" ? "#B8944F" : "#77736A",
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                          color: "#191B1E",
                        }}
                      >
                        <strong>{item.name}</strong>{" "}
                        <span style={{ color: "#77736A", fontWeight: 300 }}>
                          {item.action}
                        </span>{" "}
                        <span
                          style={{
                            color:
                              item.status === "Accepts" ? "#B8944F" : "#77736A",
                            fontWeight: 600,
                          }}
                        >
                          {item.status}
                        </span>
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "11px",
                        color: "#A09A91",
                        fontWeight: 300,
                      }}
                    >
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* RSVP Stationery Image — overlapping bottom-right */}
            <div
              style={{
                position: "absolute",
                bottom: "-40px",
                right: "-30px",
                width: "220px",
                height: "280px",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 16px 40px rgba(0,0,0,0.1)",
                zIndex: 1,
                transform: "rotate(3deg)",
              }}
              className="features-stationery-img"
            >
              <Image
                src="/images/rsvp-stationery.png"
                alt="Elegant RSVP stationery with gold wax seal"
                fill
                style={{ objectFit: "cover" }}
                sizes="220px"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Responsive Styles ─── */}
      <style jsx>{`
        @media (max-width: 1024px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            padding: 48px 32px 64px !important;
            gap: 40px !important;
            text-align: center;
          }
          .hero-headline {
            font-size: 42px !important;
          }
          .hero-buttons {
            justify-content: center !important;
          }
          .occasions-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .features-grid {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
          .features-stationery-img {
            display: none !important;
          }
          .features-headline {
            font-size: 32px !important;
          }
        }
        @media (max-width: 640px) {
          .hero-headline {
            font-size: 34px !important;
          }
          .hero-buttons {
            flex-direction: column !important;
            width: 100%;
          }
          .occasions-grid {
            grid-template-columns: 1fr !important;
            max-width: 360px !important;
          }
        }
      `}</style>
    </>
  );
}
