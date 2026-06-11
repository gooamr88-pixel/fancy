"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

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

  useEffect(() => { setMounted(true); }, []);

  // Auto-flip after 6s for users who don't click
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => { if (!flipped) setFlipped(true); }, 6000);
    return () => clearTimeout(t);
  }, [mounted, flipped]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 14;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -14;
    setTilt({ x, y });
  };
  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  if (!mounted) return <div style={{ width: '100%', maxWidth: 480, aspectRatio: '3/4' }} />;

  return (
    <div className="hero-card-wrap animate-slide-in-right">
      {/* Ambient glow */}
      <div className="hc-glow" />

      {/* Floating gold particles */}
      <div className="hc-particles">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="hc-particle" style={{
            left: `${12 + Math.random() * 76}%`,
            top: `${10 + Math.random() * 80}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${4 + Math.random() * 4}s`,
            width: `${3 + Math.random() * 5}px`,
            height: `${3 + Math.random() * 5}px`,
          }} />
        ))}
      </div>

      {/* 3D Card */}
      <div
        className="hc-perspective"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => setFlipped(!flipped)}
      >
        <div
          className={`hc-card ${flipped ? 'hc-flipped' : ''}`}
          style={{ transform: `perspective(1200px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)` }}
        >
          {/* ── FRONT ── */}
          <div className="hc-face hc-front">
            <img src="/images/demo-venue.png" alt="" className="hc-bg" />
            <div className="hc-overlay" />
            <div className="hc-shimmer" />
            <div className="hc-frame">
              <div className="hc-frame-inner">
                {/* Corner SVGs */}
                <svg className="hcf-c hcf-tl" width="28" height="28" viewBox="0 0 28 28"><path d="M2 26C2 12 12 2 26 2" stroke="#D7BE80" strokeWidth="1.2" fill="none"/><circle cx="26" cy="2" r="1.5" fill="#D7BE80" opacity=".5"/></svg>
                <svg className="hcf-c hcf-tr" width="28" height="28" viewBox="0 0 28 28"><path d="M26 26C26 12 16 2 2 2" stroke="#D7BE80" strokeWidth="1.2" fill="none"/><circle cx="2" cy="2" r="1.5" fill="#D7BE80" opacity=".5"/></svg>
                <svg className="hcf-c hcf-bl" width="28" height="28" viewBox="0 0 28 28"><path d="M2 2C2 16 12 26 26 26" stroke="#D7BE80" strokeWidth="1.2" fill="none"/><circle cx="26" cy="26" r="1.5" fill="#D7BE80" opacity=".5"/></svg>
                <svg className="hcf-c hcf-br" width="28" height="28" viewBox="0 0 28 28"><path d="M26 2C26 16 16 26 2 26" stroke="#D7BE80" strokeWidth="1.2" fill="none"/><circle cx="2" cy="26" r="1.5" fill="#D7BE80" opacity=".5"/></svg>

                <div className="hc-content">
                  <div className="hc-orn"><span className="hc-ln"/><span className="hc-st">✦</span><span className="hc-ln"/></div>
                  <p className="hc-lbl">THE WEDDING CELEBRATION OF</p>
                  <h2 className="hc-names">
                    <span className="hc-script">Sophia</span>
                    <span className="hc-and">&</span>
                    <span className="hc-script">Alexander</span>
                  </h2>
                  <div className="hc-div"><span/><span className="hc-dm">◆</span><span/></div>
                  <p className="hc-date">SEPTEMBER 20, 2025</p>
                  <p className="hc-venue">THE GRAND ROSEWOOD ESTATE</p>
                  <div className="hc-orn"><span className="hc-ln"/><span className="hc-st">✦</span><span className="hc-ln"/></div>
                </div>
              </div>
            </div>
          </div>

          {/* ── BACK ── */}
          <div className="hc-face hc-back">
            <div className="hc-back-inner">
              <div className="hcb-ornament">✦</div>
              <p className="hcb-title">RSVP</p>
              <div className="hcb-line"><span/><span className="hcb-dm">◆</span><span/></div>

              <div className="hcb-field">
                <label>Guest Name</label>
                <div className="hcb-input">Sophia & James Mitchell</div>
              </div>

              <div className="hcb-field">
                <label>Attendance</label>
                <div className="hcb-accept">
                  <span className="hcb-radio-active" />
                  <span>Joyfully Accepts</span>
                </div>
              </div>

              <div className="hcb-field">
                <label>Number of Guests</label>
                <div className="hcb-guest-count">
                  <span className="hcb-cnt-btn">−</span>
                  <span className="hcb-cnt-num">2</span>
                  <span className="hcb-cnt-btn">+</span>
                </div>
              </div>

              <div className="hcb-field">
                <label>Dinner Selection</label>
                <div className="hcb-meal">
                  <span className="hcb-meal-radio-active" />
                  <div>
                    <strong>Filet Mignon</strong>
                    <small>Herb-crusted, truffle jus</small>
                  </div>
                </div>
              </div>

              <div className="hcb-submit">Response Sent ✓</div>
              <div className="hcb-ornament">✦</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tap hint */}
      <p className={`hc-hint ${flipped ? 'hc-hint-dim' : ''}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {flipped ? 'Tap to flip back' : 'Tap to reveal RSVP'}
      </p>

      <style jsx>{`
        .hero-card-wrap {
          position: relative; width: 100%; display: flex;
          flex-direction: column; align-items: center; gap: 16px;
        }
        .hc-glow {
          position: absolute; width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(184,148,79,.08) 0%, transparent 70%);
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          animation: hcGlow 5s ease-in-out infinite; pointer-events: none;
        }
        @keyframes hcGlow {
          0%, 100% { transform: translate(-50%,-50%) scale(1); opacity:1; }
          50% { transform: translate(-50%,-50%) scale(1.2); opacity:.5; }
        }

        .hc-particles { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
        .hc-particle {
          position: absolute; border-radius: 50%;
          background: radial-gradient(circle, rgba(215,190,128,.6) 0%, transparent 70%);
          animation: hcFloat ease-in-out infinite alternate;
        }
        @keyframes hcFloat { 0% { transform: translateY(0) scale(1); opacity:.4; } 100% { transform: translateY(-16px) scale(1.2); opacity:.15; } }

        /* Perspective container */
        .hc-perspective {
          width: 100%; max-width: 400px; aspect-ratio: 3/4;
          cursor: pointer; position: relative; z-index: 2;
        }
        .hc-card {
          width: 100%; height: 100%;
          transform-style: preserve-3d;
          transition: transform .8s cubic-bezier(.4,0,.2,1);
          position: relative;
        }
        .hc-flipped { transform: perspective(1200px) rotateY(180deg) !important; }

        .hc-face {
          position: absolute; inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        /* ── FRONT ── */
        .hc-front {
          overflow: hidden;
          box-shadow: 0 30px 60px rgba(0,0,0,.12), 0 0 0 1px rgba(215,190,128,.12);
        }
        .hc-bg {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; filter: brightness(.3) saturate(.8);
        }
        .hc-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(10,10,12,.2) 0%, rgba(10,10,12,.05) 40%, rgba(10,10,12,.05) 60%, rgba(10,10,12,.3) 100%);
        }
        .hc-shimmer {
          position: absolute; inset: 0; z-index: 3; pointer-events: none;
          background: linear-gradient(105deg, transparent 40%, rgba(215,190,128,.06) 45%, rgba(215,190,128,.12) 50%, rgba(215,190,128,.06) 55%, transparent 60%);
          background-size: 300% 100%;
          animation: hcShimmer 4s ease-in-out infinite;
        }
        @keyframes hcShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .hc-frame { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
        .hc-frame-inner {
          position: absolute; inset: 16px;
          border: 1px solid rgba(215,190,128,.3);
        }
        .hc-frame-inner::after {
          content: ''; position: absolute; inset: 4px;
          border: 1px solid rgba(215,190,128,.12); pointer-events: none;
        }

        .hcf-c { position: absolute; z-index: 2; }
        .hcf-tl { top: -1px; left: -1px; }
        .hcf-tr { top: -1px; right: -1px; }
        .hcf-bl { bottom: -1px; left: -1px; }
        .hcf-br { bottom: -1px; right: -1px; }

        .hc-content {
          position: relative; z-index: 4;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100%; padding: 40px 28px; text-align: center;
        }
        .hc-orn { display: flex; align-items: center; gap: 10px; margin: 16px 0; }
        .hc-ln { width: 32px; height: 1px; background: linear-gradient(90deg, transparent, rgba(215,190,128,.5), transparent); }
        .hc-st { color: #D7BE80; font-size: 10px; opacity: .7; }

        .hc-lbl {
          font-size: 8px; font-weight: 700; letter-spacing: .3em;
          color: rgba(215,190,128,.7); margin: 0 0 16px; font-family: var(--font-sans);
        }
        .hc-names { margin: 0; line-height: 1; }
        .hc-script {
          font-family: var(--font-script); font-size: 42px; color: #FFFFFF;
          display: block; text-shadow: 0 2px 16px rgba(184,148,79,.2);
        }
        .hc-and {
          font-family: var(--font-serif); font-size: 16px; color: #D7BE80;
          display: block; font-style: italic; margin: 4px 0;
        }
        .hc-div {
          display: flex; align-items: center; gap: 8px; margin: 16px 0;
        }
        .hc-div span:first-child, .hc-div span:last-child {
          width: 40px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(215,190,128,.4), transparent);
        }
        .hc-dm { color: #D7BE80; font-size: 7px; opacity: .6; }

        .hc-date {
          font-size: 9px; font-weight: 700; letter-spacing: .25em;
          color: rgba(255,255,255,.6); margin: 0 0 4px; font-family: var(--font-sans);
        }
        .hc-venue {
          font-family: var(--font-serif); font-size: 10px; letter-spacing: .18em;
          color: rgba(215,190,128,.7); margin: 0;
        }

        /* ── BACK ── */
        .hc-back {
          transform: rotateY(180deg);
          background: linear-gradient(170deg, #FFFDF9 0%, #FBF8F2 40%, #F8F4EC 100%);
          box-shadow: 0 30px 60px rgba(0,0,0,.12), 0 0 0 1px rgba(215,190,128,.15);
          overflow: hidden;
        }
        .hc-back::before {
          content: ''; position: absolute; inset: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23D7BE80' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          pointer-events: none;
        }
        .hc-back-inner {
          position: relative; z-index: 1;
          padding: 28px 24px; height: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center;
        }
        .hcb-ornament { color: #D7BE80; font-size: 12px; letter-spacing: 4px; }
        .hcb-title {
          font-family: var(--font-serif); font-size: 22px; font-weight: 600;
          color: #B8944F; letter-spacing: .2em; margin: 8px 0;
        }
        .hcb-line { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
        .hcb-line span:first-child, .hcb-line span:last-child { width: 40px; height: 1px; background: linear-gradient(90deg, transparent, #D7BE80, transparent); }
        .hcb-dm { color: #D7BE80; font-size: 6px; }

        .hcb-field { width: 100%; text-align: left; margin-bottom: 14px; }
        .hcb-field label {
          display: block; font-size: 8px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .2em; color: #9A9590; margin-bottom: 5px; font-family: var(--font-sans);
        }
        .hcb-input {
          padding: 10px 12px; border: 1px solid #E8E2D6; background: rgba(255,255,255,.6);
          font-family: var(--font-serif); font-size: 13px; color: #191B1E;
        }
        .hcb-accept {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border: 1px solid #B8944F; background: rgba(184,148,79,.04);
          font-family: var(--font-serif); font-size: 13px; color: #4A4A4A;
        }
        .hcb-radio-active {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid #B8944F; background: #B8944F;
          box-shadow: inset 0 0 0 2px #FFFDF9; flex-shrink: 0;
        }
        .hcb-guest-count {
          display: flex; align-items: center; justify-content: center; gap: 16px;
        }
        .hcb-cnt-btn {
          width: 32px; height: 32px; border: 1px solid #E8E2D6;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; color: #77736A; font-family: var(--font-sans);
        }
        .hcb-cnt-num {
          font-family: var(--font-serif); font-size: 20px; font-weight: 700;
          color: #191B1E; min-width: 24px; text-align: center;
        }
        .hcb-meal {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 12px; border: 1px solid #B8944F; background: rgba(184,148,79,.04);
        }
        .hcb-meal-radio-active {
          width: 12px; height: 12px; border-radius: 50%;
          border: 2px solid #B8944F; background: #B8944F;
          box-shadow: inset 0 0 0 2px #FFFDF9; flex-shrink: 0; margin-top: 2px;
        }
        .hcb-meal strong { display: block; font-size: 12px; color: #191B1E; font-family: var(--font-sans); font-weight: 600; }
        .hcb-meal small { display: block; font-size: 10px; color: #77736A; margin-top: 1px; }

        .hcb-submit {
          margin-top: 12px; padding: 12px; width: 100%;
          background: linear-gradient(135deg, #B8944F, #D7BE80); color: #FFF;
          font-size: 11px; font-weight: 700; text-align: center;
          font-family: var(--font-sans); letter-spacing: .08em; text-transform: uppercase;
        }

        .hc-hint {
          font-size: 11px; font-weight: 500; letter-spacing: .12em;
          text-transform: uppercase; color: #9A9590;
          display: flex; align-items: center; gap: 6px;
          margin: 0; animation: hcHintFloat 3s ease-in-out infinite;
          transition: opacity .4s;
        }
        .hc-hint-dim { opacity: .4; }
        @keyframes hcHintFloat { 0%,100% { transform:translateY(0); opacity:.7; } 50% { transform:translateY(-3px); opacity:1; } }
      `}</style>
    </div>
  );
}

export default function HeroSection() {

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
    }
  };

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
              <a
                href="/register"
                className="btn-gold"
                style={{
                  padding: "15px 36px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "6px",
                }}
                id="hero-cta-get-started"
              >
                Get Started
              </a>
              <button
                onClick={() => scrollToSection("features")}
                className="btn-outline"
                style={{
                  padding: "15px 36px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "6px",
                }}
                id="hero-cta-view-features"
              >
                View Features
              </button>
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
            Weddings, events, and more.
          </h2>

          {/* Occasion Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
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
                    <path d="M14 26V18L20 14L26 18V26" stroke="#B8944F" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
                    <path d="M17 26V22H23V26" stroke="#B8944F" strokeWidth="1.2" fill="none" />
                    <circle cx="20" cy="11" r="1.5" fill="#D7BE80" />
                  </svg>
                ),
                title: "Engagements",
                desc: "Toast to love with beautiful event pages.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#D7BE80" strokeWidth="1" />
                    <rect x="13" y="15" width="14" height="12" rx="2" stroke="#B8944F" strokeWidth="1.5" fill="none" />
                    <path d="M16 15V13C16 11.3431 17.3431 10 19 10H21C22.6569 10 24 11.3431 24 13V15" stroke="#B8944F" strokeWidth="1.2" />
                    <path d="M17 20H23" stroke="#D7BE80" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                ),
                title: "Showers",
                desc: "Plan seamlessly and gather with ease.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#D7BE80" strokeWidth="1" />
                    <rect x="12" y="13" width="16" height="14" rx="1.5" stroke="#B8944F" strokeWidth="1.5" fill="none" />
                    <line x1="12" y1="18" x2="28" y2="18" stroke="#B8944F" strokeWidth="1" />
                    <line x1="20" y1="18" x2="20" y2="27" stroke="#D7BE80" strokeWidth="0.8" />
                    <circle cx="16" cy="22" r="1" fill="#D7BE80" />
                    <circle cx="24" cy="22" r="1" fill="#D7BE80" />
                  </svg>
                ),
                title: "Corporate Events",
                desc: "Professional invitations for every occasion.",
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
            <button
              onClick={() => scrollToSection("pricing")}
              className="btn-gold"
              style={{
                padding: "14px 32px",
                fontSize: "14px",
                alignSelf: "flex-start",
                marginTop: "8px",
              }}
              id="features-cta-explore"
            >
              Explore All Features
            </button>
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
