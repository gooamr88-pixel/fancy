"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import { useIsClient } from "../../utils/useIsClient";
import { motion, AnimatePresence } from "framer-motion";
import InvitationCard from "../templates/InvitationCard";

/* ═══════════════════════════════════════════════════════════════
   HeroSection — Fancy RSVP (Page 09 Brand Guide — Pixel Perfect)
   
   Layout from mockup (Desktop):
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │  BEAUTIFULLY DESIGNED                    ┌────────────────┐  │
   │  RSVP EXPERIENCES                        │                │  │
   │                                          │  Interactive   │  │
   │  Elegant RSVPs.                          │   Envelope     │  │
   │  Effortless Planning.                    │   Animation    │  │
   │                                          │                │  │
   │  The all-in-one RSVP and guest           └────────────────┘  │
   │  management platform for weddings                            │
   │  and special events.                                         │
   │                                                              │
   │  [Get Started]  [View Features]                              │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════════ */

/* ─── Medallion constants and graphics for the wax seal ─── */
const C = 110;
const BAND_BEADS = Array.from({ length: 24 }, (_, i) => i * 15);
const GUILLOCHE_TICKS = Array.from({ length: 48 }, (_, i) => i * 7.5);
const INNER_PETALS = Array.from({ length: 12 }, (_, i) => i * 30);
const ACCENT_DOTS = Array.from({ length: 12 }, (_, i) => i * 30 + 15);
const PETAL_PATH = "M110 30 C 129 53 127 75 110 89 C 93 75 91 53 110 30 Z";
const PETAL_VEIN = "M110 41 C 119 55 119 70 110 83 C 101 70 101 55 110 41 Z";
const PETAL_PATH_SM = "M110 50 C 121 64 120 78 110 88 C 100 78 99 64 110 50 Z";

const METAL_GOLD = {
  disc: ["#fff3cf", "#f3cd72", "#caa033", "#7e601a"],
  bevel: ["#fffbe9", "#b6892a"],
  orn: ["#fff7df", "#f2cf6a", "#9c7b22"],
  ornStroke: "#7a5c16",
  center: ["#b08e36", "#6e521a"],
  mono: "#fff6cf"
};

function WaxMedallion({ text = "S&J" }) {
  const m = METAL_GOLD;
  const s = "gold-hero";
  return (
    <svg className="w-[78px] h-[78px] drop-shadow-xl select-none" viewBox="0 0 220 220" style={{ transformStyle: "preserve-3d" }}>
      <defs>
        <radialGradient id={`disc-${s}`} cx="38%" cy="32%" r="78%">
          <stop offset="0%" stopColor={m.disc[0]} />
          <stop offset="42%" stopColor={m.disc[1]} />
          <stop offset="76%" stopColor={m.disc[2]} />
          <stop offset="100%" stopColor={m.disc[3]} />
        </radialGradient>
        <linearGradient id={`bevel-${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={m.bevel[0]} />
          <stop offset="50%" stopColor={m.bevel[1]} />
          <stop offset="100%" stopColor={m.bevel[0]} />
        </linearGradient>
        <linearGradient id={`orn-${s}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={m.orn[0]} />
          <stop offset="52%" stopColor={m.orn[1]} />
          <stop offset="100%" stopColor={m.orn[2]} />
        </linearGradient>
        <radialGradient id={`center-${s}`} cx="50%" cy="38%" r="72%">
          <stop offset="0%" stopColor={m.center[0]} />
          <stop offset="100%" stopColor={m.center[1]} />
        </radialGradient>
      </defs>

      {/* Disc + beveled rim */}
      <circle cx={C} cy={C} r="104" fill={`url(#disc-${s})`} stroke={`url(#bevel-${s})`} strokeWidth="3.5" />
      <circle cx={C} cy={C} r="99" fill="none" stroke={m.ornStroke} strokeOpacity="0.35" strokeWidth="0.8" />
      <circle cx={C} cy={C} r="96.5" fill="none" stroke={m.orn[0]} strokeOpacity="0.5" strokeWidth="0.8" />

      {/* Outer bead band */}
      {BAND_BEADS.map((deg) => (
        <rect
          key={`bead-${deg}`}
          x="106" y="13.5" width="8" height="8" rx="1.4"
          fill={`url(#orn-${s})`} stroke={m.ornStroke} strokeOpacity="0.4" strokeWidth="0.5"
          transform={`rotate(${deg} ${C} ${C}) rotate(45 110 17.5)`}
        />
      ))}

      {/* Guilloché double-ring with fine ticks */}
      <circle cx={C} cy={C} r="84" fill="none" stroke={m.orn[1]} strokeOpacity="0.55" strokeWidth="1" />
      <circle cx={C} cy={C} r="79" fill="none" stroke={m.ornStroke} strokeOpacity="0.4" strokeWidth="0.8" />
      {GUILLOCHE_TICKS.map((deg) => (
        <line
          key={`tick-${deg}`}
          x1={C} y1="26.5" x2={C} y2="31" stroke={m.orn[0]} strokeOpacity="0.6" strokeWidth="0.7"
          transform={`rotate(${deg} ${C} ${C})`}
        />
      ))}

      {/* Inner mandala — 12 ogee petals + inner veins */}
      {INNER_PETALS.map((deg) => (
        <g key={`petal-${deg}`} transform={`rotate(${deg} ${C} ${C})`}>
          <path d={PETAL_PATH} fill={`url(#orn-${s})`} stroke={m.ornStroke} strokeOpacity="0.45" strokeWidth="0.7" />
          <path d={PETAL_VEIN} fill="none" stroke={m.ornStroke} strokeOpacity="0.3" strokeWidth="0.6" />
        </g>
      ))}
      {/* Secondary petal layer, interleaved between the primaries */}
      {ACCENT_DOTS.map((deg) => (
        <path key={`pet2-${deg}`} d={PETAL_PATH_SM} fill={`url(#orn-${s})`} fillOpacity="0.9" stroke={m.ornStroke} strokeOpacity="0.3" strokeWidth="0.5" transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      {ACCENT_DOTS.map((deg) => (
        <circle key={`dot-${deg}`} cx={C} cy="44" r="1.9" fill={m.orn[0]} transform={`rotate(${deg} ${C} ${C})`} />
      ))}

      {/* Centre cartouche + monogram */}
      <circle cx={C} cy={C} r="31" fill={`url(#center-${s})`} stroke={m.orn[1]} strokeOpacity="0.7" strokeWidth="1.4" />
      <circle cx={C} cy={C} r="27" fill="none" stroke={m.ornStroke} strokeOpacity="0.5" strokeWidth="0.7" />
      <text
        x={C}
        y={C}
        textAnchor="middle"
        dominantBaseline="central"
        fill={m.mono}
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        {text}
      </text>
    </svg>
  );
}

/* ═══ Interactive Hero Envelope Component ═══ */
function HeroCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCardOut, setIsCardOut] = useState(false);
  const [showTapIndicator, setShowTapIndicator] = useState(true);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const isClient = useIsClient();
  // Sparkle positions are randomized once per mount and never regenerated;
  // computed lazily so Math.random() only runs once. They're never part of
  // the SSR output (gated by `isClient` below), so no hydration mismatch.
  const [sparkles] = useState(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: 5 + Math.random() * 90,
    y: 5 + Math.random() * 90,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 6,
    dur: 2 + Math.random() * 3,
  })));

  // Auto-open teaser on page load
  useEffect(() => {
    if (!isClient) return;
    const t = setTimeout(() => {
      if (!isOpen) {
        setIsOpen(true);
        setShowTapIndicator(false);
        setTimeout(() => setIsCardOut(true), 600);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [isClient, isOpen]);

  const handleOpen = () => {
    if (isOpen) return;
    setIsOpen(true);
    setShowTapIndicator(false);
    setTimeout(() => setIsCardOut(true), 600);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setIsCardOut(false);
    setTimeout(() => {
      setIsOpen(false);
      setShowTapIndicator(true);
    }, 800);
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
    setTilt({ x, y });
  };
  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  if (!isClient) return <div style={{ width: '100%', maxWidth: 320, height: 440 }} />;

  const template = { pattern: "serif" };
  const theme = { primary: "#B8944F", secondary: "#D7BE80" };
  const cardData = {
    names: "Sophia & James",
    monogram: "S&J",
    dateLine: "SATURDAY, JUNE 20, 2026",
    venueLine: "The Plaza · New York",
  };

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
        aria-label={isOpen ? 'Click to close invitation' : 'Click to open invitation'}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={isOpen ? undefined : handleOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!isOpen) handleOpen(); } }}
        style={{
          perspective: 1400,
          transformStyle: "preserve-3d",
          transform: `perspective(1400px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <div className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }}>
          {/* Layer 1: Envelope body. Width matches the card exactly (260/left 30)
              and height is (stage height 440 − top flap height 120) so the
              flap and body tile edge-to-edge with no gap between them. */}
          <div
            className="absolute rounded-b-lg border-x border-b border-amber-900/15 shadow-xl bg-[#F1E9D8]"
            style={{
              width: 260,
              left: 30,
              bottom: 0,
              height: 320,
              zIndex: 10,
              transformStyle: "preserve-3d",
            }}
          >
            {/* Fold seam where the flap meets the body */}
            <div
              className="absolute left-0 right-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(122,92,22,0.4), transparent)" }}
            />
            {/* Interior lining panel */}
            <div
              className="absolute inset-2 top-1.5 bg-gradient-to-b from-[#E4D6B8] via-[#FAF6EC] to-[#FAF9F6] rounded-b-md"
              style={{ transform: "translateZ(1px)" }}
            />
          </div>

          {/* Layer 2: Invitation card sliding out */}
          <motion.div
            className="absolute shadow-2xl rounded-lg overflow-hidden bg-[#FCFAF6]"
            style={{
              width: 260,
              height: 360,
              left: 30, // Centered inside the 320px stage
              bottom: 20,
              transformOrigin: "bottom center",
              // Constant: above the envelope body (10) and the opened flap (5)
              // so it's visible throughout, but below the closed flap (31)
              // so the seal/flap still conceals it before opening.
              zIndex: 25,
            }}
            initial={{ y: 0, scale: 0.9, opacity: 0 }}
            animate={{
              y: isCardOut ? -180 : 0,
              scale: isCardOut ? 1.05 : 0.9,
              opacity: isOpen ? 1 : 0,
            }}
            transition={{
              y: { type: "spring", stiffness: 85, damping: 16 },
              scale: { type: "spring", stiffness: 85, damping: 16 },
              opacity: { duration: 0.3 }
            }}
          >
            <InvitationCard template={template} theme={theme} guestName="Sophia & James" data={cardData} />

            {/* Close button inside card (only active when card is out) */}
            {isCardOut && (
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-stone-200 shadow-md flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors z-50 cursor-pointer"
                aria-label="Close invitation"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </motion.div>

          {/* Layer 4: Top folding flap — same width/left as the body below it */}
          <motion.div
            className="absolute transform-style-3d"
            style={{
              width: 260,
              left: 30,
              height: 120,
              top: 0,
              transformOrigin: "top center",
              originY: 0,
            }}
            initial={{ rotateX: 0, zIndex: 31 }}
            animate={{
              rotateX: isOpen ? 180 : 0,
              zIndex: isOpen ? 5 : 31,
            }}
            transition={{
              rotateX: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
              zIndex: { delay: isOpen ? 0.35 : 0 },
            }}
          >
            {/* Front flap (closed) */}
            <div className="absolute inset-0 backface-hidden" style={{ zIndex: 32 }}>
              <svg className="w-full h-full filter drop-shadow-sm" viewBox="0 0 100 45" preserveAspectRatio="none">
                <polygon points="0,0 50,45 100,0" fill="#F7F0DF" stroke="#B8944F" strokeOpacity="0.35" strokeWidth="0.6" />
              </svg>
            </div>

            {/* Back flap with gold lining (open) */}
            <div className="absolute inset-0 backface-hidden animate-none" style={{ transform: "rotateY(180deg)", zIndex: 31 }}>
              <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 45" preserveAspectRatio="none">
                <polygon points="0,0 50,45 100,0" fill="#FAF9F6" />
                <polygon points="4,1 50,41 96,1" fill="url(#goldLiningHero)" />
                <defs>
                  <linearGradient id="goldLiningHero" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#C5A059" /><stop offset="20%" stopColor="#FDF0CD" />
                    <stop offset="40%" stopColor="#D4AF37" /><stop offset="60%" stopColor="#F3E5AB" />
                    <stop offset="80%" stopColor="#AA7A1E" /><stop offset="100%" stopColor="#D4AF37" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </motion.div>

          {/* Layer 5: Wax Seal */}
          <AnimatePresence>
            {!isOpen && (
              <motion.div
                className="absolute left-1/2 cursor-pointer"
                style={{
                  top: 120, // centered on the fold seam (flap height 120)
                  x: "-50%",
                  y: "-50%",
                  zIndex: 45,
                }}
                exit={{
                  scale: 0.6,
                  opacity: 0,
                  rotate: 15,
                  transition: { duration: 0.45 }
                }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpen}
              >
                <WaxMedallion text="S&J" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tap click indicator overlay */}
          {showTapIndicator && (
            <div
              className="absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ height: 165, zIndex: 50 }}
            >
              <div className="relative flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-14 w-14 rounded-full opacity-35 bg-[#B8944F]" />
                <span className="relative inline-flex rounded-full h-10 w-10 items-center justify-center shadow-lg text-white bg-[#B8944F]">
                  <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </span>
              </div>
              <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mt-3 bg-white/90 backdrop-blur-sm py-1.5 px-3 rounded-full border border-stone-200/50 shadow-sm animate-pulse">
                Click to Open
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Label */}
      <div className={`hc-label ${isOpen ? 'hc-label-flip' : ''}`}>
        <div className="hc-label-dot" />
        <span>{isOpen ? 'Gilded Wedding Invitation' : 'Interactive Envelope Reveal'}</span>
        {isOpen ? (
          <span className="hc-label-action cursor-pointer" onClick={handleClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Click to close
          </span>
        ) : (
          <span className="hc-label-action cursor-pointer" onClick={handleOpen}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Click to open
          </span>
        )}
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

        /* ═══ 3D STAGE ═══ */
        .hc-stage {
          width: 100%; max-width: 320px;
          height: 440px;
          cursor: pointer; position: relative; z-index: 2;
        }

        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }

        /* ═══ LABEL ═══ */
        .hc-label {
          display: flex; align-items: center; gap: 10px;
          font-size: 11px; font-weight: 500; letter-spacing: .1em;
          text-transform: uppercase; color: #9A9590;
          font-family: var(--font-sans);
          transition: all .4s ease;
          width: 100%;
          max-width: 320px;
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
