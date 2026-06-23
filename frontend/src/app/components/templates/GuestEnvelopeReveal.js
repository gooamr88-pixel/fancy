"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════════════════
   GuestEnvelopeReveal — the cinematic, one-time luxury invitation opening.

   This is the first thing a real guest sees when they open their /[slug] link.
   It is a full-screen, mobile-first sequence designed to feel like unsealing a
   physical, hand-pressed wedding invitation:

     1. PRELOAD      soft ivory bloom, brand flourish fades in
     2. PAPER        embossed arabesque stationery + folded envelope flaps
     3. SEAL FOCUS   a bronze metallic medallion with a light-reflection sweep
     4. ACTIVATION   tap → the seal warms bronze → gold, glow + rising dust
     5. OPENING      the four paper flaps peel back on real 3D hinges
     6. LIGHT        volumetric golden light blooms from inside the envelope
     7. REVEAL       the invitation lockup (REAL event data) rises on parallax
     8. HANDOFF      the overlay dissolves seamlessly into the live event page

   CONTRACT (must stay stable — EventPageClient depends on it):
     • props: { event, onComplete }
     • renders a fixed overlay above the page (z 1000); page markup untouched
     • data-testid="guest-envelope-reveal" on the root
     • data-testid="guest-envelope-skip" on the always-available skip control
     • calls onComplete() exactly once when finished or skipped

   The parent (EventPageClient) already plays this only once per event
   (localStorage) and never under reduced-motion; we still defend internally.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Radial-symmetry geometry for the seal (computed once at module load) ─── */
const C = 110; // medallion centre (viewBox 0 0 220 220)
const INNER_PETALS = Array.from({ length: 12 }, (_, i) => i * 30);
const ACCENT_DOTS = Array.from({ length: 12 }, (_, i) => i * 30 + 15);
const BAND_BEADS = Array.from({ length: 24 }, (_, i) => i * 15);
const GUILLOCHE_TICKS = Array.from({ length: 48 }, (_, i) => i * 7.5);

const PETAL_PATH = "M110 30 C 129 53 127 75 110 89 C 93 75 91 53 110 30 Z";
const PETAL_VEIN = "M110 41 C 119 55 119 70 110 83 C 101 70 101 55 110 41 Z";

/* Two complete metal "skins" for the medallion, cross-faded on activation so the
   bronze→gold morph stays perfectly registered (identical geometry underneath). */
const METAL = {
  bronze: {
    disc: ["#d8b884", "#b07e44", "#7c5024", "#4a2c12"],
    bevel: ["#f1d8aa", "#7c5024"],
    orn: ["#e7c79a", "#b07e44", "#5f3d1c"],
    ornStroke: "#3f2810",
    center: ["#5a3a1c", "#321f0f"],
    mono: "#f3dcae",
  },
  gold: {
    disc: ["#fff3cf", "#f3cd72", "#caa033", "#7e601a"],
    bevel: ["#fffbe9", "#b6892a"],
    orn: ["#fff7df", "#f2cf6a", "#9c7b22"],
    ornStroke: "#7a5c16",
    center: ["#b08e36", "#6e521a"],
    mono: "#fff6cf",
  },
};

/* ─── Name + monogram derivation from real event data ─── */
const isArabic = (s) => typeof s === "string" && /[؀-ۿ]/.test(s);

function deriveIdentity(event, lang) {
  const td = event?.template_data || {};
  const a = (td.groom_name || td.partner1Name || "").trim();
  const b = (td.bride_name || td.partner2Name || "").trim();

  let full;
  if (a && b) full = `${a} & ${b}`;
  else if (a) full = a;
  else full = (lang === "ar" && event?.title_ar) ? event.title_ar : (event?.title || "");

  // Monogram: couple initials → otherwise first letters of the first two words.
  let mono;
  if (a && b) mono = `${a[0]}${b[0]}`;
  else if (a) mono = a.slice(0, 2);
  else {
    const words = (event?.title || "").trim().split(/\s+/).filter(Boolean);
    mono = words.slice(0, 2).map((w) => w[0]).join("");
  }
  mono = (mono || "").toUpperCase().slice(0, 3) || "✦";

  return { full: full || "You're Invited", mono, monoArabic: isArabic(mono) || isArabic(full) };
}

/* ─── The medallion artwork — one metal skin (bronze or gold) ─── */
/* `uid` keeps every instance's gradient ids unique (no cross-SVG collisions). */
function MedallionSkin({ skin, uid, mono, monoArabic }) {
  const m = METAL[skin];
  const s = `${skin}-${uid}`;
  return (
    <g>
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
      {ACCENT_DOTS.map((deg) => (
        <circle key={`dot-${deg}`} cx={C} cy="48" r="2.1" fill={m.orn[0]} transform={`rotate(${deg} ${C} ${C})`} />
      ))}

      {/* Centre cartouche + monogram */}
      <circle cx={C} cy={C} r="31" fill={`url(#center-${s})`} stroke={m.orn[1]} strokeOpacity="0.7" strokeWidth="1.4" />
      <circle cx={C} cy={C} r="27" fill="none" stroke={m.ornStroke} strokeOpacity="0.5" strokeWidth="0.7" />
      <text
        x={C} y={C} textAnchor="middle" dominantBaseline="central" fill={m.mono}
        style={{
          fontFamily: monoArabic ? "var(--font-serif)" : "var(--font-script), var(--font-serif)",
          fontSize: monoArabic ? 30 : 40,
          fontWeight: 500,
          letterSpacing: monoArabic ? 0 : 1,
        }}
      >
        {mono}
      </text>
    </g>
  );
}

/* ─── A single peel-away envelope flap (one of four) ─── */
function Flap({ side, open, patternUrl, delay }) {
  // Each flap is a triangle hinged on its OUTER edge; the tip meets the seal.
  const cfg = {
    top: {
      style: { top: 0, left: 0, right: 0, height: "50%", transformOrigin: "top center", clipPath: "polygon(0 0, 100% 0, 50% 100%)" },
      animate: { rotateX: open ? -172 : 0 },
      shade: "linear-gradient(180deg, #f5ecda 0%, #e7d8be 78%, #d8c4a2 100%)",
      crease: "linear-gradient(180deg, transparent 55%, rgba(95,68,35,0.16) 100%)",
    },
    bottom: {
      style: { bottom: 0, left: 0, right: 0, height: "50%", transformOrigin: "bottom center", clipPath: "polygon(50% 0, 0 100%, 100% 100%)" },
      animate: { rotateX: open ? 172 : 0 },
      shade: "linear-gradient(0deg, #efe2cb 0%, #e3d2b5 78%, #d3bd98 100%)",
      crease: "linear-gradient(0deg, transparent 55%, rgba(95,68,35,0.16) 100%)",
    },
    left: {
      style: { top: 0, bottom: 0, left: 0, width: "50%", transformOrigin: "center left", clipPath: "polygon(0 0, 100% 50%, 0 100%)" },
      animate: { rotateY: open ? 172 : 0 },
      shade: "linear-gradient(90deg, #f2e8d5 0%, #e5d6ba 80%, #d6c19d 100%)",
      crease: "linear-gradient(90deg, transparent 55%, rgba(95,68,35,0.16) 100%)",
    },
    right: {
      style: { top: 0, bottom: 0, right: 0, width: "50%", transformOrigin: "center right", clipPath: "polygon(100% 0, 100% 100%, 0 50%)" },
      animate: { rotateY: open ? -172 : 0 },
      shade: "linear-gradient(270deg, #f2e8d5 0%, #e5d6ba 80%, #d6c19d 100%)",
      crease: "linear-gradient(270deg, transparent 55%, rgba(95,68,35,0.16) 100%)",
    },
  }[side];

  return (
    <motion.div
      aria-hidden
      initial={false}
      animate={cfg.animate}
      transition={{ duration: 1.05, ease: [0.76, 0, 0.24, 1], delay: open ? delay : 0 }}
      style={{
        position: "absolute",
        ...cfg.style,
        backgroundColor: "#ece0c8",
        backgroundImage: `${patternUrl}, ${cfg.shade}`,
        backgroundBlendMode: "multiply, normal",
        backgroundSize: "46px 46px, cover",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        boxShadow: open ? "0 12px 40px rgba(80,55,25,0.28)" : "inset 0 0 22px rgba(120,90,50,0.10)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: cfg.crease, clipPath: cfg.style.clipPath, pointerEvents: "none" }} />
    </motion.div>
  );
}

export default function GuestEnvelopeReveal({ event, onComplete }) {
  const prefersReduced = useReducedMotion();

  // stage: 0 preload · 1 paper · 2 seal-focus(resting) · 3 activating · 4 opening · 5 light · 6 reveal · 7 done
  const [stage, setStage] = useState(0);
  const [lang, setLang] = useState("en");
  const timers = useRef([]);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);

  const colors = event?.custom_colors || {};
  const theme = {
    primary: colors.primary || "#B8944F",
    secondary: colors.secondary || "#D7BE80",
    deep: "#3a2a14",
  };

  const hasArabic = !!(event?.title_ar || isArabic(event?.title));
  const identity = useMemo(() => deriveIdentity(event, lang), [event, lang]);

  const copy = {
    en: {
      eyebrow: "You are invited",
      special: "You are invited for our special day",
      tap: "Tap to open",
      enter: "View invitation",
      join: "We would be honoured by your presence",
    },
    ar: {
      eyebrow: "أنت مدعو",
      special: "أنت مدعوّ ليومنا المميّز",
      tap: "اضغط للفتح",
      enter: "عرض الدعوة",
      join: "يشرّفنا حضوركم",
    },
  }[lang];

  const isRTL = lang === "ar";
  const displayTitle = isRTL && event?.title_ar ? event.title_ar : event?.title;
  const displayName = isRTL && event?.title_ar && !event?.template_data?.groom_name ? event.title_ar : identity.full;
  const dateStr = event?.event_date
    ? new Date(event.event_date).toLocaleDateString(isRTL ? "ar-EG" : "en-US", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "";
  const locationStr = event?.location_name || "";

  /* Tileable embossed-arabesque stationery, encoded once as a data-URI so the
     same paper texture paints the backdrop AND every envelope flap. */
  const patternUrl = useMemo(() => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='46' viewBox='0 0 46 46'>`
      + `<g fill='none' stroke='%23b8944f' stroke-opacity='0.16' stroke-width='1'>`
      + `<rect x='11' y='11' width='24' height='24'/>`
      + `<rect x='11' y='11' width='24' height='24' transform='rotate(45 23 23)'/>`
      + `<circle cx='23' cy='23' r='4.5'/>`
      + `<path d='M23 0 V7 M23 39 V46 M0 23 H7 M39 23 H46'/>`
      + `</g>`
      + `<g fill='none' stroke='%23ffffff' stroke-opacity='0.5' stroke-width='0.7'>`
      + `<rect x='11.6' y='11.6' width='24' height='24'/>`
      + `<rect x='11.6' y='11.6' width='24' height='24' transform='rotate(45 23.6 23.6)'/>`
      + `</g></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
  }, []);

  /* ─── Sequence control ─── */
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const after = useCallback((ms, fn) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();
    setStage(7);
    onComplete && onComplete();
  }, [clearTimers, onComplete]);

  // Drive the cinematic opening once the guest activates the seal. Guarded by a
  // ref so the idle auto-open can never restart an in-progress sequence.
  const openSeal = useCallback(() => {
    if (startedRef.current || finishedRef.current) return;
    startedRef.current = true;
    setStage(3);                       // ACTIVATION — bronze → gold, glow, dust
    after(620, () => setStage(4));     // OPENING — flaps peel back
    after(1180, () => setStage(5));    // LIGHT — golden volumetric bloom
    after(1820, () => setStage(6));    // REVEAL — invitation lockup rises
    after(4600, () => finish());       // HANDOFF — dissolve into the live page
  }, [after, finish]);

  /* Choreography after mount: preload → paper → seal focus (resting). */
  useEffect(() => {
    if (prefersReduced) return; // reduced-motion: render the static fallback only
    after(120, () => setStage(1));   // PAPER stationery + flaps settle in
    after(900, () => setStage(2));   // SEAL FOCUS — resting, awaiting a tap
    after(8000, () => openSeal());   // gentle fallback so passive guests still see it
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hard safety net — never trap a guest on the overlay.
  useEffect(() => {
    const t = setTimeout(() => finish(), 16000);
    return () => clearTimeout(t);
  }, [finish]);

  /* ═══ Reduced-motion fallback: an elegant, static, instantly-skippable card ═══ */
  if (prefersReduced) {
    return (
      <motion.div
        data-testid="guest-envelope-reveal"
        role="dialog"
        aria-label="Open your invitation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        style={{ ...overlayBase, background: "radial-gradient(120% 100% at 50% 35%, #fbf6ec 0%, #f2e9d6 60%, #e8dcc2 100%)" }}
      >
        <button type="button" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation" style={skipStyle}>
          Skip ›
        </button>
        <div style={{ textAlign: "center", padding: "24px", maxWidth: 460 }}>
          <svg width="150" height="150" viewBox="0 0 220 220" role="img" aria-label="Invitation seal">
            <MedallionSkin skin="bronze" uid="rm" mono={identity.mono} monoArabic={identity.monoArabic} />
          </svg>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", color: theme.primary, fontWeight: 700, margin: "20px 0 10px" }}>
            {copy.eyebrow}
          </p>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(24px,7vw,34px)", color: "#2a1f12", margin: 0, fontWeight: 500 }}>
            {displayTitle}
          </h1>
          <button type="button" onClick={finish} style={enterBtnStyle(theme)}>{copy.enter}</button>
        </div>
      </motion.div>
    );
  }

  const opening = stage >= 4;
  const lit = stage >= 5;
  const revealing = stage >= 6;

  // Responsive stage square — phone-first, capped on larger screens.
  const stageSize = "min(86vw, 420px)";

  return (
    <motion.div
      data-testid="guest-envelope-reveal"
      role="dialog"
      aria-label="Open your invitation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      dir={isRTL ? "rtl" : "ltr"}
      style={{ ...overlayBase, background: "radial-gradient(130% 100% at 50% 32%, #fcf8ef 0%, #f4ecda 52%, #e9ddc4 100%)" }}
    >
      <style dangerouslySetInnerHTML={{ __html: REVEAL_CSS }} />

      {/* Embossed arabesque stationery wash + warm vignette */}
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: patternUrl, backgroundSize: "46px 46px", opacity: lit ? 0.12 : 0.55, transition: "opacity 0.8s ease" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 60% at 50% 38%, rgba(255,255,255,0.35), transparent 70%), radial-gradient(120% 120% at 50% 100%, rgba(120,90,45,0.16), transparent 60%)", pointerEvents: "none" }} />

      {/* Top-right language chip — mirrors the live event page composition */}
      <div style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineEnd: 16, zIndex: 6 }}>
        <button
          type="button"
          onClick={() => hasArabic && setLang((l) => (l === "en" ? "ar" : "en"))}
          aria-label={hasArabic ? "Toggle language" : "Language"}
          style={langChipStyle(!!hasArabic)}
        >
          <span aria-hidden style={{ fontSize: 15, opacity: 0.7 }}>🌐</span>
          <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{lang === "en" ? "EN" : "ع"}</span>
        </button>
      </div>

      {/* Skip — always available, never blocks the page beneath */}
      <button type="button" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation animation" style={skipStyle}>
        Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
      </button>

      {/* ── Eyebrow + title above the envelope ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: stage >= 1 && !revealing ? 1 : 0, y: stage >= 1 && !revealing ? 0 : 10 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", zIndex: 4, textAlign: "center", marginBottom: "clamp(20px,5vh,40px)", maxWidth: 520, padding: "0 24px" }}
      >
        <span style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.42em", fontWeight: 700, color: theme.primary, marginBottom: 12, paddingInlineStart: "0.42em" }}>
          {copy.eyebrow}
        </span>
        {displayTitle && (
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(22px,6.4vw,34px)", fontWeight: 500, lineHeight: 1.18, color: "#2c2113", margin: 0, textShadow: "0 1px 0 rgba(255,255,255,0.6)" }}>
            {displayTitle}
          </h1>
        )}
      </motion.div>

      {/* ── The envelope stage (flaps + light + seal) ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 14 }}
        animate={{ opacity: stage >= 1 ? 1 : 0, scale: stage >= 1 ? 1 : 0.9, y: stage >= 1 ? 0 : 14 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", zIndex: 3, width: stageSize, height: stageSize, perspective: "1400px", WebkitPerspective: "1400px" }}
      >
        {/* Interior panel revealed when the flaps open (warm light pool) */}
        <div aria-hidden style={{ position: "absolute", inset: "8%", borderRadius: 10, background: "radial-gradient(60% 60% at 50% 45%, #fff7e3 0%, #f3e2bd 60%, #e6cf9f 100%)", boxShadow: "inset 0 0 40px rgba(150,110,55,0.25)" }} />

        {/* ── Volumetric golden light from inside the envelope ── */}
        <div aria-hidden style={{ position: "absolute", inset: "-60%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
          {/* Sunburst rays — framer scales the wrapper, CSS spins the inner layer */}
          <motion.div
            initial={false}
            animate={{ opacity: lit ? 0.9 : 0, scale: lit ? 1.15 : 0.5 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            style={{ position: "absolute", width: "100%", height: "100%" }}
          >
            <div
              className="ger-rays"
              style={{
                width: "100%", height: "100%", borderRadius: "50%",
                background: "repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,233,170,0) 0deg, rgba(255,233,170,0.55) 3deg, rgba(255,233,170,0) 7deg)",
                WebkitMaskImage: "radial-gradient(circle, #000 8%, rgba(0,0,0,0.5) 38%, transparent 70%)",
                maskImage: "radial-gradient(circle, #000 8%, rgba(0,0,0,0.5) 38%, transparent 70%)",
              }}
            />
          </motion.div>
          {/* Core bloom */}
          <motion.div
            initial={false}
            animate={{ opacity: lit ? 1 : 0, scale: revealing ? 1.5 : lit ? 1 : 0.3 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ position: "absolute", width: "62%", height: "62%", borderRadius: "50%", background: "radial-gradient(circle, #ffffff 0%, #fff1c4 26%, rgba(247,205,114,0.55) 52%, transparent 74%)", filter: "blur(6px)" }}
          />
        </div>

        {/* Downward chevron beam echoing the reference's V of light */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ x: "-50%", opacity: lit ? 0.85 : 0, scaleY: lit ? 1 : 0.2 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          style={{
            position: "absolute", left: "50%", top: "52%", width: "78%", height: "90%",
            transformOrigin: "top center", zIndex: 2,
            background: "linear-gradient(180deg, rgba(255,239,190,0.85) 0%, rgba(255,224,150,0.35) 40%, transparent 78%)",
            clipPath: "polygon(50% 0, 100% 0, 50% 100%, 0 0)", filter: "blur(7px)", pointerEvents: "none",
          }}
        />

        {/* Four peel-away flaps */}
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d", zIndex: 3 }}>
          <Flap side="top" open={opening} patternUrl={patternUrl} delay={0} />
          <Flap side="left" open={opening} patternUrl={patternUrl} delay={0.06} />
          <Flap side="right" open={opening} patternUrl={patternUrl} delay={0.06} />
          <Flap side="bottom" open={opening} patternUrl={patternUrl} delay={0.12} />
        </div>

        {/* ── The seal medallion (centred via inset so framer-motion can own transform) ── */}
        <motion.button
          type="button"
          onClick={openSeal}
          aria-label={copy.tap}
          disabled={stage >= 3}
          initial={false}
          animate={{
            scale: revealing ? 0.7 : stage === 3 ? [1, 1.07, 1.0] : 1,
            y: revealing ? "-58%" : opening ? "-12%" : 0,
            opacity: revealing ? 0 : 1,
            filter: lit ? "brightness(1.18)" : "brightness(1)",
          }}
          transition={{
            scale: { duration: stage === 3 ? 0.62 : 1.0, ease: [0.34, 1.56, 0.64, 1] },
            y: { duration: 1.1, ease: [0.4, 0, 0.2, 1] },
            opacity: { duration: 0.8, ease: "easeIn" },
            filter: { duration: 0.7 },
          }}
          style={{
            position: "absolute", inset: "23%", zIndex: 4,
            border: "none", background: "transparent", padding: 0,
            cursor: stage >= 3 ? "default" : "pointer",
            WebkitTapHighlightColor: "transparent",
            filter: "drop-shadow(0 14px 22px rgba(70,45,18,0.34))",
          }}
        >
          {/* Glow halo behind the seal (ramps up on activation) */}
          <motion.span
            aria-hidden
            className={stage === 2 ? "ger-glow-idle" : ""}
            initial={false}
            animate={{ opacity: stage >= 3 ? 1 : 0, scale: stage >= 3 ? 1.35 : 1.0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ position: "absolute", inset: "-26%", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,221,130,0.7) 0%, rgba(255,200,90,0.32) 45%, transparent 72%)", pointerEvents: "none", filter: "blur(3px)" }}
          />

          {/* The medallion: bronze base with a gold skin cross-faded on top */}
          <div className={stage === 2 ? "ger-breathe" : ""} style={{ position: "relative", width: "100%", height: "100%" }}>
            <svg viewBox="0 0 220 220" width="100%" height="100%" style={{ display: "block", position: "relative", zIndex: 1 }} role="img" aria-label="Invitation wax seal">
              <MedallionSkin skin="bronze" uid="main" mono={identity.mono} monoArabic={identity.monoArabic} />
            </svg>
            <motion.svg
              viewBox="0 0 220 220" width="100%" height="100%"
              initial={false}
              animate={{ opacity: stage >= 3 ? 1 : 0 }}
              transition={{ duration: 0.85, ease: "easeInOut" }}
              style={{ display: "block", position: "absolute", inset: 0, zIndex: 2 }}
              aria-hidden
            >
              <MedallionSkin skin="gold" uid="main" mono={identity.mono} monoArabic={identity.monoArabic} />
            </motion.svg>

            {/* Light-reflection sweep across the metal */}
            <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", zIndex: 3, pointerEvents: "none" }}>
              <div className={stage <= 2 ? "ger-sheen" : "ger-sheen ger-sheen-burst"} />
            </div>
          </div>
        </motion.button>

        {/* Rising gold dust on activation */}
        {stage >= 3 && !revealing && (
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
            {DUST.map((d, i) => (
              <span key={i} className="ger-dust" style={{ left: `${d.x}%`, bottom: "44%", width: d.s, height: d.s, animationDelay: `${d.delay}s`, background: i % 2 ? theme.secondary : "#ffe6a0" }} />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Resting prompts (hidden once opening begins) ── */}
      <AnimatePresence>
        {stage === 2 && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.3 } }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ position: "relative", zIndex: 4, textAlign: "center", marginTop: "clamp(22px,5vh,40px)", padding: "0 24px" }}
          >
            <div className="ger-prompt" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 20px", borderRadius: 999, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(184,148,79,0.3)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", boxShadow: "0 6px 20px rgba(120,90,45,0.12)" }}>
              <span aria-hidden style={{ fontSize: 13 }}>✦</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: theme.deep }}>
                {copy.tap}
              </span>
            </div>
            <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 13, color: "#8a7350", marginTop: 16, letterSpacing: "0.04em" }}>
              {copy.special}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STAGE 7: the invitation lockup rises from the light ── */}
      <AnimatePresence>
        {revealing && (
          <motion.div
            key="lockup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{ position: "absolute", inset: 0, zIndex: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "32px 26px", pointerEvents: "none" }}
          >
            <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 60% at 50% 45%, rgba(255,250,238,0.78), rgba(250,242,225,0.4) 60%, transparent 85%)" }} />

            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: "relative", marginBottom: 22 }}
            >
              <svg width="92" height="92" viewBox="0 0 220 220" aria-hidden style={{ filter: "drop-shadow(0 8px 18px rgba(150,110,40,0.3))" }}>
                <MedallionSkin skin="gold" uid="lock" mono={identity.mono} monoArabic={identity.monoArabic} />
              </svg>
            </motion.div>

            <motion.span
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.7 }}
              style={{ position: "relative", fontFamily: "var(--font-sans)", fontSize: 11, letterSpacing: "0.4em", textTransform: "uppercase", fontWeight: 700, color: theme.primary, marginBottom: 14 }}
            >
              {copy.eyebrow}
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              style={{ position: "relative", fontFamily: "var(--font-serif)", fontSize: "clamp(26px,8vw,42px)", fontWeight: 500, lineHeight: 1.15, color: "#2a1f12", margin: 0, maxWidth: 600 }}
            >
              {displayName}
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.7, duration: 0.7 }}
              style={{ position: "relative", width: 120, height: 1, margin: "18px 0", background: `linear-gradient(90deg, transparent, ${theme.primary}, transparent)` }}
            />

            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.82, duration: 0.7 }}
              style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}
            >
              {dateStr && <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "#6f5a3a", fontWeight: 600 }}>{dateStr}</span>}
              {locationStr && <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 15, color: "#8a7350" }}>{locationStr}</span>}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 13, color: "#a08a63", marginTop: 6 }}>{copy.join}</span>
            </motion.div>

            <motion.button
              type="button"
              onClick={finish}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              style={{ ...enterBtnStyle(theme), position: "relative", pointerEvents: "auto" }}
            >
              {copy.enter} <span aria-hidden style={{ marginInlineStart: 6 }}>→</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Shared style objects ─── */
const overlayBase = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-sans)",
  padding: "24px",
};

const skipStyle = {
  position: "absolute",
  top: "max(16px, env(safe-area-inset-top))",
  insetInlineStart: 20,
  zIndex: 8,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid rgba(120,90,45,0.22)",
  background: "rgba(255,255,255,0.5)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: "#6f5a3a",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

const langChipStyle = (active) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(120,90,45,0.18)",
  background: "rgba(255,255,255,0.62)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: "#5a4a30",
  fontSize: 13,
  fontFamily: "var(--font-sans)",
  cursor: active ? "pointer" : "default",
  boxShadow: "0 4px 14px rgba(120,90,45,0.1)",
});

const enterBtnStyle = (theme) => ({
  marginTop: 26,
  display: "inline-flex",
  alignItems: "center",
  padding: "13px 30px",
  borderRadius: 999,
  border: "none",
  background: `linear-gradient(135deg, ${theme.primary}, #a6833f)`,
  color: "#fffdf6",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow: "0 10px 28px rgba(184,148,79,0.36)",
});

/* Rising-dust particle field (positions fixed so SSR/CSR match) */
const DUST = [
  { x: 30, s: 5, delay: 0 }, { x: 44, s: 4, delay: 0.25 }, { x: 56, s: 6, delay: 0.1 },
  { x: 68, s: 4, delay: 0.4 }, { x: 38, s: 3, delay: 0.55 }, { x: 62, s: 5, delay: 0.7 },
  { x: 50, s: 4, delay: 0.18 }, { x: 35, s: 5, delay: 0.85 }, { x: 65, s: 3, delay: 0.62 },
];

/* Ambient CSS loops — cheaper & smoother on the compositor than per-frame JS */
const REVEAL_CSS = `
@keyframes gerBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.018); } }
.ger-breathe { animation: gerBreathe 4.2s ease-in-out infinite; will-change: transform; }

@keyframes gerGlowIdle { 0%,100% { opacity: 0.18; } 50% { opacity: 0.4; } }
.ger-glow-idle { animation: gerGlowIdle 3.4s ease-in-out infinite; }

@keyframes gerSheen { 0% { transform: translateX(-130%) rotate(8deg); } 100% { transform: translateX(130%) rotate(8deg); } }
.ger-sheen {
  position: absolute; top: -25%; left: 0; width: 55%; height: 150%;
  background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.55) 50%, transparent 62%);
  animation: gerSheen 4.6s ease-in-out infinite; animation-delay: 1.2s;
}
.ger-sheen-burst { animation-duration: 1.1s; animation-iteration-count: 1; animation-delay: 0s;
  background: linear-gradient(105deg, transparent 34%, rgba(255,255,255,0.85) 50%, transparent 66%); }

@keyframes gerPrompt { 0%,100% { opacity: 0.62; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
.ger-prompt { animation: gerPrompt 2.1s ease-in-out infinite; }

@keyframes gerDust {
  0% { opacity: 0; transform: translateY(0) scale(0.6); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-180px) scale(1.1); }
}
.ger-dust { position: absolute; border-radius: 50%; opacity: 0;
  animation: gerDust 2.6s ease-out infinite; box-shadow: 0 0 6px rgba(255,220,140,0.8); }

@keyframes gerRays { to { transform: rotate(360deg); } }
.ger-rays { animation: gerRays 22s linear infinite; will-change: transform; }

@media (prefers-reduced-motion: reduce) {
  .ger-breathe, .ger-glow-idle, .ger-sheen, .ger-prompt, .ger-dust, .ger-rays { animation: none !important; }
}
`;
