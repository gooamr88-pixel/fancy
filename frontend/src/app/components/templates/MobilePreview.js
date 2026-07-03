"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EnvelopeAnimation from "./EnvelopeAnimation";
import RSVPBottomSheet from "./RSVPBottomSheet";
import InvitationCard from "./InvitationCard";

/* ═══════════════════════════════════════════════════════════════
   FitScaler — proportionally shrinks a fixed-size design to fit its
   container's width, so the self-framed phone never overflows a
   narrow viewport (or a content column on an embedding page).

   The phone is built from fixed-px utilities, so we can't fluidly
   reflow it — we scale it. The outer box is the *scaled* footprint
   (so there's no layout gap), and the inner box keeps its true
   pixel size and is transform-scaled to match. At ≥ baseWidth the
   scale is 1, so wide layouts (e.g. /templates desktop) are pixel-
   identical to before. setState lives only in the ResizeObserver
   callback, so this never triggers a synchronous-setState warning.
   ═══════════════════════════════════════════════════════════════ */
function FitScaler({ baseWidth, baseHeight, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const compute = () => setScale(Math.min(1, el.clientWidth / baseWidth));
    const ro = new ResizeObserver(compute);
    ro.observe(el); // fires once immediately, then on every resize
    return () => ro.disconnect();
  }, [baseWidth]);

  return (
    <div
      ref={ref}
      style={{ width: "100%", maxWidth: baseWidth, height: baseHeight * scale, margin: "0 auto" }}
    >
      <div style={{ width: baseWidth, height: baseHeight, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Scene Background — unique per template pattern.
   Each template gets its own distinct, premium background treatment.
   ═══════════════════════════════════════════════════════════════ */
function getSceneStyles(pattern) {
  switch (pattern) {
    case "serif": // Royale Wedding — dark marble
      return {
        background: "linear-gradient(165deg, #1a1815 0%, #2a2520 20%, #1e1b18 40%, #252220 60%, #1a1815 80%, #151310 100%)",
        overlay: "radial-gradient(ellipse at 50% 30%, rgba(184,148,79,0.08) 0%, transparent 60%)",
        vignette: "radial-gradient(120% 80% at 50% 38%, transparent 30%, rgba(10,8,5,0.50) 100%)",
      };
    case "luxury": // Eternal Love — midnight blue
      return {
        background: "linear-gradient(170deg, #0B0F1A 0%, #0D1225 25%, #111830 50%, #0A0E1C 75%, #080B15 100%)",
        overlay: "radial-gradient(ellipse at 50% 35%, rgba(215,190,128,0.06) 0%, transparent 55%)",
        vignette: "radial-gradient(110% 75% at 50% 40%, transparent 25%, rgba(5,5,15,0.55) 100%)",
      };
    case "organic": // Woodland — warm linen
      return {
        background: "linear-gradient(170deg, #E8DFD0 0%, #DDD4C4 25%, #D5CCBC 50%, #DDD5C6 75%, #E2D9CA 100%)",
        overlay: "radial-gradient(ellipse at 50% 40%, rgba(184,148,79,0.06) 0%, transparent 50%)",
        vignette: "radial-gradient(120% 80% at 50% 38%, transparent 35%, rgba(100,85,60,0.20) 100%)",
      };
    case "geo": // Conference — dark slate
      return {
        background: "linear-gradient(170deg, #1A1D24 0%, #1E2128 25%, #22252E 50%, #1C1F26 75%, #181B22 100%)",
        overlay: "radial-gradient(ellipse at 50% 35%, rgba(59,130,246,0.05) 0%, transparent 50%)",
        vignette: "radial-gradient(120% 80% at 50% 38%, transparent 30%, rgba(8,8,12,0.45) 100%)",
      };
    case "minimal": // Gala — clean white
      return {
        background: "linear-gradient(170deg, #F7F6F3 0%, #F0EFEC 25%, #EBEAE6 50%, #F0EFEC 75%, #F5F4F1 100%)",
        overlay: "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.02) 0%, transparent 50%)",
        vignette: "radial-gradient(120% 80% at 50% 38%, transparent 40%, rgba(180,175,165,0.18) 100%)",
      };
    case "floral": // Garden — soft blush
      return {
        background: "linear-gradient(170deg, #F5E6EA 0%, #F0DBE0 25%, #EBCFD6 50%, #F0DBE0 75%, #F3E2E7 100%)",
        overlay: "radial-gradient(ellipse at 50% 40%, rgba(232,143,172,0.06) 0%, transparent 50%)",
        vignette: "radial-gradient(120% 80% at 50% 38%, transparent 35%, rgba(120,60,80,0.15) 100%)",
      };
    case "custom": // Custom — warm cream
      return {
        background: "linear-gradient(170deg, #F2ECE2 0%, #EBE5DA 25%, #E5DFD4 50%, #EBE5DA 75%, #EEE8DE 100%)",
        overlay: "radial-gradient(ellipse at 50% 40%, rgba(139,115,85,0.05) 0%, transparent 50%)",
        vignette: "radial-gradient(120% 80% at 50% 38%, transparent 35%, rgba(80,65,45,0.18) 100%)",
      };
    case "tuscany": // Tuscan Vineyard — hazy olive parchment
      return {
        background: "linear-gradient(170deg, #EFE9D6 0%, #E4DEC4 25%, #DAD3B4 50%, #E4DEC4 75%, #EAE4D0 100%)",
        overlay: "radial-gradient(ellipse at 50% 38%, rgba(107,122,79,0.08) 0%, transparent 55%)",
        vignette: "radial-gradient(120% 80% at 50% 38%, transparent 32%, rgba(60,66,42,0.20) 100%)",
      };
    default: // Default — warm cream (same as custom)
      return {
        background: "linear-gradient(170deg, #F2ECE2 0%, #EBE5DA 25%, #E5DFD4 50%, #EBE5DA 75%, #EEE8DE 100%)",
        overlay: "radial-gradient(ellipse at 50% 40%, rgba(139,115,85,0.05) 0%, transparent 50%)",
        vignette: "radial-gradient(120% 80% at 50% 38%, transparent 35%, rgba(80,65,45,0.18) 100%)",
      };
  }
}

/* Ambient floating particles styled per template */
function SceneParticles({ pattern, accentColor }) {
  const isDark = ["serif", "luxury", "geo"].includes(pattern);
  const particleColor = isDark ? "rgba(255,255,255,0.12)" : `${accentColor}18`;
  const glowColor = isDark ? "rgba(215,190,128,0.15)" : `${accentColor}10`;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {[0,1,2,3,4,5].map(i => (
        <div
          key={i}
          className="mp-particle"
          style={{
            position: "absolute",
            bottom: "-8px",
            left: `${15 + i * 14}%`,
            width: 3 + (i % 3) * 2,
            height: 3 + (i % 3) * 2,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${particleColor} 0%, ${glowColor} 50%, transparent 70%)`,
            animationDelay: `${i * 1.8}s`,
            animationDuration: `${10 + (i % 3) * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

/* Pattern-specific decorative background elements */
function SceneDecor({ pattern, accentColor }) {
  if (pattern === "luxury") {
    // Subtle starfield dots
    return (
      <div className="pointer-events-none absolute inset-0 z-0" style={{ opacity: 0.5 }}>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="mp-star"
            style={{
              position: "absolute",
              width: 1.5 + (i % 3),
              height: 1.5 + (i % 3),
              borderRadius: "50%",
              background: "rgba(215,190,128,0.4)",
              top: `${5 + (i * 47 + 13) % 90}%`,
              left: `${3 + (i * 31 + 7) % 94}%`,
              animationDelay: `${(i * 0.7) % 5}s`,
            }}
          />
        ))}
      </div>
    );
  }
  if (pattern === "geo") {
    // Subtle grid dots
    return (
      <div className="pointer-events-none absolute inset-0 z-0" style={{ opacity: 0.15 }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `radial-gradient(circle, ${accentColor}40 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }} />
      </div>
    );
  }
  if (pattern === "minimal") {
    // Subtle dot grid
    return (
      <div className="pointer-events-none absolute inset-0 z-0" style={{ opacity: 0.08 }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, #666 0.5px, transparent 0.5px)",
          backgroundSize: "16px 16px",
        }} />
      </div>
    );
  }
  return null;
}


/* ═══════════════════════════════════════════════════════════════
   MobilePreview — the guest-experience simulator.

   Rebuilt for stability (see audit, Issue 2):
   • The "screen" is a fixed flex column. The scene is a fixed flex-1
     box with overflow hidden — content NEVER reflows the frame.
   • The opened invitation is a normal scroll area with the CTA bar as
     an in-flow footer (not an absolute overlay) → nothing is hidden.
   • Theme/colour changes flow through props with NO remount and NO
     loading replay → swapping presets is instant and keeps state.

   Flow steps (drivable by a parent stepper, or self-managed):
     received → envelope → opened → attending | declined
   ═══════════════════════════════════════════════════════════════ */

const OPENED_FAMILY = ["opened", "attending", "declined"];

export default function MobilePreview({
  template,
  theme,
  guestName,
  isBare = false,
  config,
  step: controlledStep,
  onStepChange,
}) {
  const sections = config?.sections || { details: true, gallery: true, messageHost: true };
  const ctaLabel = config?.ctaLabel || "RSVP Now";
  const isControlled = controlledStep !== undefined;
  const [internalStep, setInternalStep] = useState("envelope");
  const step = isControlled ? controlledStep : internalStep;

  const setStep = (next) => {
    if (isControlled) onStepChange && onStepChange(next);
    else setInternalStep(next);
  };

  // Brief "page load" only when the template LAYOUT changes (not colours).
  // Detected during render (the React-sanctioned way to reset state on a prop
  // change) so colour-only updates never replay the splash or reset the journey.
  const [isLoading, setIsLoading] = useState(true);
  const [prevPattern, setPrevPattern] = useState(template?.pattern);
  if (template?.pattern !== prevPattern) {
    setPrevPattern(template?.pattern);
    setIsLoading(true);
    if (!isControlled) setInternalStep("envelope");
  }
  // The splash is cleared from an async callback (allowed inside effects).
  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => setIsLoading(false), 450);
    return () => clearTimeout(t);
  }, [isLoading]);

  const accentColor = theme?.primary || theme?.accent || template?.accent || "#B8944F";
  const secondaryColor = theme?.secondary || "#D7BE80";
  const isOpened = OPENED_FAMILY.includes(step);
  const showSheet = step === "attending" || step === "declined";
  const pattern = template?.pattern || "serif";
  const sceneStyles = getSceneStyles(pattern);
  const isDarkScene = ["serif", "luxury", "geo"].includes(pattern);

  /* CTA gradient per template */
  const ctaGradient = `linear-gradient(135deg, ${accentColor}, ${secondaryColor}, ${accentColor})`;
  const ctaTextColor = "#191B1E";
  const ctaFooterBg = isDarkScene
    ? `linear-gradient(to top, rgba(10,8,5,0.96) 0%, rgba(10,8,5,0.82) 55%, transparent 100%)`
    : `linear-gradient(to top, rgba(60,50,35,0.92) 0%, rgba(60,50,35,0.70) 55%, transparent 100%)`;

  /* Event details card styling per scene */
  const detailsCardBg = isDarkScene ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)";
  const detailsCardBorder = isDarkScene ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.50)";
  const detailsCardText = isDarkScene ? "#E8E2D6" : "#191B1E";
  const detailsCardSubtext = isDarkScene ? "#AAA59C" : "#77736A";
  const detailsCardBackdrop = isDarkScene ? "blur(16px)" : "blur(12px)";

  /* ─── The inner screen (shared by bare + framed shells) ─── */
  const screen = (
    <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
      {/* iOS status bar (framed shell only) */}
      {!isBare && (
        <div className="flex justify-between items-center px-6 pt-3.5 pb-1 bg-white text-stone-900 font-sans z-50 shrink-0 select-none">
          <span className="text-[9.5px] font-bold tracking-tight text-stone-800">9:41</span>
          <div className="w-[72px] h-[16px] bg-black rounded-full flex items-center justify-center gap-1.5 px-2 relative -top-0.5">
            <div className="w-1.5 h-1.5 bg-stone-900 rounded-full" />
            <div className="w-5 h-0.5 bg-stone-900 rounded-full" />
            <div className="w-1 h-1 bg-indigo-950 rounded-full border border-indigo-900/30" />
          </div>
          <div className="flex items-center gap-1 text-stone-800">
            <svg className="w-3.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M2 18h2v-2H2v2zm4 0h2v-4H6v4zm4 0h2V9h-2v9zm4 0h2V5h-2v13zm4 0h2V1h-2v17z" /></svg>
            <svg className="w-3 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21l-12-12c2.5-2.5 6-4 10-4s7.5 1.5 10 4l-8 12z" /></svg>
            <div className="w-4.5 h-2.5 border border-stone-800 rounded-[3px] p-[0.7px] flex items-center"><div className="h-full w-full bg-stone-800 rounded-[1px]" /></div>
          </div>
        </div>
      )}

      {/* Browser URL bar */}
      <div className="flex items-center gap-2 px-3 pb-2.5 pt-1.5 bg-stone-50 border-b border-stone-200 text-stone-500 font-sans z-40 shrink-0 text-[10px]">
        <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        <div className="flex-1 bg-stone-200/50 rounded-lg py-1 px-2.5 flex items-center justify-between text-stone-600 text-[9.5px]">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <svg className="w-2.5 h-2.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
            <span className="truncate text-stone-500 tracking-wide font-medium">fancyrsvp.com/invite/jamil</span>
          </div>
          <svg className="w-2.5 h-2.5 opacity-40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
        </div>
      </div>

      {/* ═══ THE SCENE — fixed flex-1 stage, never reflows ═══ */}
      <div
        className="flex-1 relative overflow-hidden flex flex-col"
        style={{ background: sceneStyles.background }}
      >
        {/* Template-specific overlay glow */}
        <div className="pointer-events-none absolute inset-0 z-0" style={{ background: sceneStyles.overlay }} />
        {/* Vignette for depth */}
        <div className="pointer-events-none absolute inset-0 z-0" style={{ background: sceneStyles.vignette }} />
        {/* Template-specific decorative elements */}
        <SceneDecor pattern={pattern} accentColor={accentColor} />
        {/* Ambient floating particles */}
        <SceneParticles pattern={pattern} accentColor={accentColor} />

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              className="absolute inset-0 bg-white flex flex-col items-center justify-center z-40 text-center"
              initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            >
              <motion.div
                className="font-serif text-3xl font-light tracking-[8px] text-stone-900 select-none uppercase mb-4"
                initial={{ letterSpacing: "1px", opacity: 0 }} animate={{ letterSpacing: "8px", opacity: 1 }} transition={{ duration: 0.7, ease: "easeOut" }}
              >Fancy</motion.div>
              <div className="w-5 h-5 border-2 border-stone-200 border-t-stone-800 rounded-full animate-spin" />
            </motion.div>
          ) : step === "received" ? (
            /* ─── Phase: Received (lock-screen notification) ─── */
            <motion.div
              key="received"
              className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-10 px-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
            >
              <motion.div
                className="w-full max-w-[250px] bg-white/85 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-white/40 cursor-pointer"
                initial={{ y: 24, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
                onClick={() => setStep("envelope")}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[15px] shrink-0" style={{ background: `linear-gradient(135deg, ${accentColor}, ${secondaryColor})` }}>✉️</div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-stone-800 font-sans">Fancy Invitation</span>
                    <span className="text-[9px] text-stone-500 font-sans truncate">You&apos;ve received an invitation — tap to open</span>
                  </div>
                  <span className="text-[8px] text-stone-400 font-sans">now</span>
                </div>
              </motion.div>
              <span className="text-[9px] text-white/70 font-sans mt-3 tracking-wide">Tap the notification to continue</span>
            </motion.div>
          ) : step === "envelope" ? (
            /* ─── Phase: Envelope (closed → opening) ─── */
            <motion.div
              key="envelope"
              className="absolute inset-0 z-10"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            >
              <EnvelopeAnimation
                key={`${template?.pattern || "default"}`}
                template={template}
                theme={theme}
                guestName={guestName}
                config={config}
                onOpenComplete={() => setStep("opened")}
              />
            </motion.div>
          ) : (
            /* ─── Phase: Opened invitation (scrollable + in-flow footer) ─── */
            <motion.div
              key="opened"
              className="absolute inset-0 z-10 flex flex-col"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            >
              {/* Scrollable content — reduced padding for more room */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-3 pt-3 pb-3 flex flex-col items-center gap-3" style={{ scrollbarWidth: "none" }}>
                {/* Hero invitation card — MUCH LARGER for screen dominance */}
                <motion.div
                  className="w-[260px] shrink-0 rounded-lg overflow-hidden"
                  style={{
                    height: 380,
                    boxShadow: isDarkScene
                      ? `0 20px 50px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3), 0 0 40px ${accentColor}12`
                      : `0 20px 50px rgba(0,0,0,0.20), 0 8px 20px rgba(0,0,0,0.10), 0 0 1px rgba(0,0,0,0.08)`,
                  }}
                  initial={{ y: 16, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 120, damping: 18 }}
                >
                  <InvitationCard template={template} theme={theme} guestName={guestName} config={config} />
                </motion.div>

                {/* Event details panel — compact, styled per scene */}
                {sections.details && (
                <motion.div
                  className="w-full max-w-[260px] shrink-0 rounded-2xl p-3 flex flex-col gap-2"
                  style={{
                    background: detailsCardBg,
                    backdropFilter: detailsCardBackdrop,
                    WebkitBackdropFilter: detailsCardBackdrop,
                    border: `1px solid ${detailsCardBorder}`,
                    boxShadow: isDarkScene
                      ? "0 8px 32px rgba(0,0,0,0.3)"
                      : "0 8px 32px rgba(0,0,0,0.08)",
                  }}
                  initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 140, damping: 20 }}
                >
                  <span className="text-[8px] font-bold uppercase tracking-[2.5px] font-sans" style={{ color: accentColor }}>Event Details</span>
                  {[
                    ["📅", "Saturday, October 24, 2026", "4:00 PM"],
                    ["📍", "The Grand Ballroom", "Plaza Hotel, New York"],
                    ["👗", "Dress code", "Black tie optional"],
                  ].map(([icon, a, b]) => (
                    <div key={a} className="flex items-start gap-2">
                      <span className="text-[12px] leading-none mt-0.5">{icon}</span>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold font-sans leading-tight" style={{ color: detailsCardText }}>{a}</span>
                        <span className="text-[8.5px] font-sans leading-tight" style={{ color: detailsCardSubtext }}>{b}</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
                )}
              </div>

              {/* In-flow CTA footer — always fully visible, never overlaps content */}
              <div className="shrink-0 px-5 pt-5 pb-5 flex flex-col gap-2.5 items-center relative" style={{ background: ctaFooterBg }}>
                <button
                  onClick={() => setStep("attending")}
                  className="w-full max-w-[260px] py-2.5 rounded-full font-bold font-sans text-xs active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-[2px]"
                  style={{
                    backgroundImage: ctaGradient,
                    color: ctaTextColor,
                    border: `1px solid ${accentColor}50`,
                    boxShadow: `0 6px 24px ${accentColor}40, 0 2px 8px rgba(0,0,0,0.10)`,
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  {ctaLabel}
                </button>
                {sections.messageHost && (
                <button
                  onClick={() => setStep("attending")}
                  className="text-white/80 hover:text-white font-bold font-sans text-[10px] uppercase tracking-[1.5px] flex items-center gap-1.5 active:scale-[0.97] transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Message Host
                </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RSVP bottom sheet — overlays the scene, opened/closed by the flow step */}
        <RSVPBottomSheet
          key={step}
          isOpen={showSheet}
          initialAttending={step !== "declined"}
          onClose={() => setStep("opened")}
          onSubmit={() => {}}
          template={{ ...template, accent: accentColor }}
        />
      </div>

      {/* CSS animations for particles and stars */}
      <style jsx>{`
        @keyframes mp-float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 0.7; }
          85% { opacity: 0.5; }
          100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
        }
        .mp-particle {
          animation: mp-float linear infinite;
        }
        @keyframes mp-twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
        .mp-star {
          animation: mp-twinkle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );

  /* ─── Bare: caller supplies the device frame (PhoneSimulator / drawer) ─── */
  if (isBare) {
    return <div className="w-full h-full relative overflow-hidden flex flex-col select-none bg-white">{screen}</div>;
  }

  /* ─── Self-framed: standalone phone (used by /templates desktop and as an
        embedded visual). Wrapped in FitScaler so it shrinks gracefully on
        narrow viewports / content columns instead of overflowing. ─── */
  return (
    <FitScaler baseWidth={315} baseHeight={630}>
      <div className="w-[315px] h-[630px] bg-stone-950 p-[8px] rounded-[44px] relative shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5),_inset_0_0_2px_2px_rgba(255,255,255,0.15)] ring-1 ring-white/10 select-none flex flex-col">
        <div className="absolute inset-[8px] pointer-events-none z-50 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-60 mix-blend-overlay rounded-[36px] overflow-hidden" style={{ transform: "skewY(-30deg) scale(2.2)", transformOrigin: "center" }} />
        <div className="flex-1 flex flex-col bg-white overflow-hidden relative rounded-[36px] border border-black/10">
          {screen}
        </div>
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-stone-700 rounded-full z-50 pointer-events-none opacity-80" />
      </div>
    </FitScaler>
  );
}
