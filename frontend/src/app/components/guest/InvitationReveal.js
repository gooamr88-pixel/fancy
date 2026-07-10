"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform } from "framer-motion";
import { lighten, darken, alpha } from "../../utils/color";
import { getCelebrationPreset } from "../../utils/patternCelebration";
import { FloatingParticles, ConfettiExplosion } from "./GuestAnimations";

/* ═══════════════════════════════════════════════════════════════════════════
   InvitationReveal — "The Unsealing"

   ONE cinematic, fully-generated wax-seal opening, shared by both guest-facing
   reveals (it replaces the old GuestEnvelopeReveal + DigitalEnvelope):

     • mode="invitation"  the first thing a guest sees on the event page /[slug].
                          Dissolves into the live invitation page underneath.
     • mode="rsvp"        gates the RSVP route /[slug]/rsvp. The seal is
                          personalised with the guest's own name; on open it
                          cross-dissolves into the RSVP form beneath it.

   Everything is generated as crisp SVG/CSS vectors — there are NO image
   uploads. The wax + light palette is derived from the event's own
   custom_colors, so every event unseals into its own colour story instead of
   a single fixed bronze.

   The 7 beats: settle → seal focus → press (crack) → unseal (flap lifts on a
   3D gold-lined hinge) → light (god-rays + bloom) → handoff → done.

   CONTRACT (kept stable for callers + tests):
     • data-testid="guest-envelope-reveal" on the root
     • data-testid="guest-envelope-skip" on the always-available skip control
     • calls onComplete() exactly once when finished or skipped
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Radial-symmetry geometry for the seal (computed once at module load) ─── */
const C = 110; // medallion centre (viewBox 0 0 220 220)
const INNER_PETALS = Array.from({ length: 12 }, (_, i) => i * 30);
const ACCENT_DOTS = Array.from({ length: 12 }, (_, i) => i * 30 + 15);
const BAND_BEADS = Array.from({ length: 24 }, (_, i) => i * 15);
const GUILLOCHE_TICKS = Array.from({ length: 48 }, (_, i) => i * 7.5);

const PETAL_PATH = "M110 30 C 129 53 127 75 110 89 C 93 75 91 53 110 30 Z";
const PETAL_VEIN = "M110 41 C 119 55 119 70 110 83 C 101 70 101 55 110 41 Z";
const PETAL_PATH_SM = "M110 50 C 121 64 120 78 110 88 C 100 78 99 64 110 50 Z";

const isArabic = (s) => typeof s === "string" && /[؀-ۿ]/.test(s);

/* ─── Wax + gold palette derived from the event's own colours ───────────────
   Primary drives the wax dome; secondary (the accent) drives the gilded
   monogram, rims and the light bloom, so the seal always feels bespoke. */
function buildWaxPalette(primary, secondary) {
  const p = primary || "#B8944F";
  const s = secondary || lighten(p, 0.3);
  return {
    // wax body
    waxLite: lighten(p, 0.34),
    waxMid: p,
    waxDeep: darken(p, 0.5),
    waxEdge: darken(p, 0.72),
    // gilded accents + light
    gold: s,
    goldLite: lighten(s, 0.5),
    goldDeep: darken(s, 0.28),
    goldShadow: darken(s, 0.55),
    goldBright: lighten(s, 0.42),
    // grounds
    ivory: lighten(s, 0.84),
    ivoryDeep: lighten(s, 0.72),
    champagne: lighten(s, 0.3),
    champagneLt: lighten(s, 0.55),
    white: "#FFFCEF",
    ink: darken(p, 0.62),
  };
}

/* Two full "skins" for the seal — a resting wax skin and a lit/molten skin —
   cross-faded on activation over identical geometry so the morph stays
   perfectly registered. */
function buildSkins(P) {
  return {
    rest: {
      disc: [P.waxLite, P.waxMid, P.waxDeep, P.waxEdge],
      bevel: [P.goldLite, P.goldDeep],
      orn: [lighten(P.waxLite, 0.12), P.waxLite, P.waxMid],
      ornStroke: P.waxEdge,
      center: [P.waxDeep, P.waxEdge],
      mono: [P.goldLite, P.gold, P.goldDeep],
      monoStroke: P.goldShadow,
    },
    lit: {
      disc: [lighten(P.waxLite, 0.24), lighten(P.waxMid, 0.18), P.waxMid, P.waxDeep],
      bevel: [P.white, P.gold],
      orn: [P.goldLite, P.gold, P.goldDeep],
      ornStroke: P.goldShadow,
      center: [darken(P.gold, 0.15), P.goldDeep],
      mono: [P.white, P.goldLite, P.gold],
      monoStroke: P.goldShadow,
    },
  };
}

/* ─── Name + monogram derivation from real event data ─── */
function deriveIdentity(event, lang) {
  const td = event?.template_data || {};
  const a = (td.groom_name || td.partner1Name || td.partner1 || td.celebrant || td.honoree || td.company || "").trim();
  const b = (td.bride_name || td.partner2Name || td.partner2 || "").trim();

  let full;
  if (a && b) full = `${a} & ${b}`;
  else if (a) full = a;
  else full = (lang === "ar" && (event?.title_ar || td.title_ar)) ? (event?.title_ar || td.title_ar) : (event?.title || "");

  // Seal centrepiece — organizer override (`template_data.seal_text`) wins, so an
  // Arabic event can show its exact calligraphic name. Otherwise derived from
  // real event data: an Arabic name renders as a calligraphic word, a Latin
  // event as a refined monogram.
  let sealText = (td.seal_text || "").trim();
  if (!sealText) {
    const arabicSource = [a, b, event?.title_ar, td.title_ar, event?.title].find((s) => isArabic(s));
    if (arabicSource) {
      sealText = arabicSource.trim().split(/\s+/).filter(Boolean)[0] || arabicSource.trim();
    } else if (a && b) {
      sealText = `${a[0]}${b[0]}`.toUpperCase();
    } else if (a) {
      sealText = a.slice(0, 2).toUpperCase();
    } else {
      const words = (event?.title || "").trim().split(/\s+/).filter(Boolean);
      sealText = words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    }
  }
  sealText = sealText || "✦";

  return { full: full || "You're Invited", sealText, sealArabic: isArabic(sealText) };
}

/* Collapse a long guest name to legible initials for the seal centre. */
function guestSealText(guestName) {
  const raw = (guestName || "").trim();
  if (!raw) return null;
  if (raw.length <= 12) return raw;
  return raw.split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 3).toUpperCase();
}

/* Small detail presenter row for the reduced-motion stationery card */
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

/* Four engraved corner flourishes, framing a stationery card */
function CornerOrnaments({ color }) {
  const corners = [
    { top: 10, left: 10, rotate: "0deg" },
    { top: 10, right: 10, rotate: "90deg" },
    { bottom: 10, right: 10, rotate: "180deg" },
    { bottom: 10, left: 10, rotate: "270deg" },
  ];
  return corners.map((pos, i) => (
    <svg
      key={i} width="32" height="32" viewBox="0 0 40 40" aria-hidden
      style={{ position: "absolute", top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, transform: `rotate(${pos.rotate})`, opacity: 0.6, pointerEvents: "none" }}
    >
      <path d="M3 3 Q3 12 8 18 Q14 24 22 26" fill="none" stroke={color} strokeWidth="0.8" />
      <path d="M3 3 Q12 3 18 8 Q24 14 26 22" fill="none" stroke={color} strokeWidth="0.8" />
      <path d="M5 5 Q5 10 9 14 Q13 18 18 20" fill="none" stroke={color} strokeWidth="0.5" opacity="0.6" />
      <path d="M5 5 Q10 5 14 9 Q18 13 20 18" fill="none" stroke={color} strokeWidth="0.5" opacity="0.6" />
      <circle cx="3" cy="3" r="1.5" fill={color} />
      <circle cx="22" cy="26" r="1" fill={color} opacity="0.8" />
      <circle cx="26" cy="22" r="1" fill={color} opacity="0.8" />
    </svg>
  ));
}

/* ─── The wax seal artwork — one skin (rest or lit) ─── */
/* `uid` keeps every instance's gradient ids unique (no cross-SVG collisions). */
function MedallionSkin({ skin, name, uid, text, arabic }) {
  const s = `${name}-${uid}`;
  const len = (text || "").length;
  const sealFontSize = arabic
    ? (len <= 3 ? 52 : len <= 5 ? 42 : 32)
    : (len <= 2 ? 36 : len <= 3 ? 29 : 22);
  return (
    <g>
      <defs>
        <radialGradient id={`disc-${s}`} cx="38%" cy="32%" r="78%">
          <stop offset="0%" stopColor={skin.disc[0]} />
          <stop offset="42%" stopColor={skin.disc[1]} />
          <stop offset="76%" stopColor={skin.disc[2]} />
          <stop offset="100%" stopColor={skin.disc[3]} />
        </radialGradient>
        <linearGradient id={`bevel-${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={skin.bevel[0]} />
          <stop offset="50%" stopColor={skin.bevel[1]} />
          <stop offset="100%" stopColor={skin.bevel[0]} />
        </linearGradient>
        <linearGradient id={`orn-${s}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={skin.orn[0]} />
          <stop offset="52%" stopColor={skin.orn[1]} />
          <stop offset="100%" stopColor={skin.orn[2]} />
        </linearGradient>
        <radialGradient id={`center-${s}`} cx="50%" cy="38%" r="72%">
          <stop offset="0%" stopColor={skin.center[0]} />
          <stop offset="100%" stopColor={skin.center[1]} />
        </radialGradient>
        <linearGradient id={`mono-${s}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={skin.mono[0]} />
          <stop offset="55%" stopColor={skin.mono[1]} />
          <stop offset="100%" stopColor={skin.mono[2]} />
        </linearGradient>
      </defs>

      {/* Disc + gilded beveled rim */}
      <circle cx={C} cy={C} r="104" fill={`url(#disc-${s})`} stroke={`url(#bevel-${s})`} strokeWidth="3.5" />
      <circle cx={C} cy={C} r="99" fill="none" stroke={skin.ornStroke} strokeOpacity="0.35" strokeWidth="0.8" />
      <circle cx={C} cy={C} r="96.5" fill="none" stroke={skin.orn[0]} strokeOpacity="0.5" strokeWidth="0.8" />

      {/* Outer bead band */}
      {BAND_BEADS.map((deg) => (
        <rect
          key={`bead-${deg}`}
          x="106" y="13.5" width="8" height="8" rx="1.4"
          fill={`url(#orn-${s})`} stroke={skin.ornStroke} strokeOpacity="0.4" strokeWidth="0.5"
          transform={`rotate(${deg} ${C} ${C}) rotate(45 110 17.5)`}
        />
      ))}

      {/* Guilloché double-ring with fine ticks */}
      <circle cx={C} cy={C} r="84" fill="none" stroke={skin.orn[1]} strokeOpacity="0.4" strokeWidth="1" />
      <circle cx={C} cy={C} r="79" fill="none" stroke={skin.ornStroke} strokeOpacity="0.3" strokeWidth="0.8" />
      {GUILLOCHE_TICKS.map((deg) => (
        <line
          key={`tick-${deg}`}
          x1={C} y1="26.5" x2={C} y2="31" stroke={skin.orn[0]} strokeOpacity="0.4" strokeWidth="0.7"
          transform={`rotate(${deg} ${C} ${C})`}
        />
      ))}

      {/* Inner mandala — 12 ogee petals + inner veins */}
      {INNER_PETALS.map((deg) => (
        <g key={`petal-${deg}`} transform={`rotate(${deg} ${C} ${C})`}>
          <path d={PETAL_PATH} fill={`url(#orn-${s})`} stroke={skin.ornStroke} strokeOpacity="0.3" strokeWidth="0.7" />
          <path d={PETAL_VEIN} fill="none" stroke={skin.ornStroke} strokeOpacity="0.2" strokeWidth="0.6" />
        </g>
      ))}
      {ACCENT_DOTS.map((deg) => (
        <path key={`pet2-${deg}`} d={PETAL_PATH_SM} fill={`url(#orn-${s})`} fillOpacity="0.9" stroke={skin.ornStroke} strokeOpacity="0.3" strokeWidth="0.5" transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      {ACCENT_DOTS.map((deg) => (
        <circle key={`dot-${deg}`} cx={C} cy="44" r="1.9" fill={skin.orn[0]} transform={`rotate(${deg} ${C} ${C})`} />
      ))}

      {/* Centre cartouche + gilded monogram */}
      <circle cx={C} cy={C} r="31" fill={`url(#center-${s})`} stroke={skin.orn[1]} strokeOpacity="0.85" strokeWidth="1.4" />
      <circle cx={C} cy={C} r="27" fill="none" stroke={skin.ornStroke} strokeOpacity="0.6" strokeWidth="0.7" />
      <text
        x={C} y={C} textAnchor="middle" dominantBaseline="central" fill={`url(#mono-${s})`}
        stroke={skin.monoStroke} strokeWidth="0.6" strokeOpacity="0.5"
        style={{
          fontFamily: arabic ? "var(--font-arabic-display), 'Aref Ruqaa', serif" : "var(--font-serif), serif",
          fontSize: sealFontSize,
          fontWeight: 700,
          letterSpacing: arabic ? 0 : 0.5,
          paintOrder: "stroke fill",
        }}
      >
        {text}
      </text>
    </g>
  );
}

/* ─── A single peel-away envelope flap (one of four), gold-lined underside ─── */
function Flap({ side, open, patternUrl, delay, gold }) {
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
      {/* Gold-foil lining, only seen as the flap peels back */}
      <div style={{ position: "absolute", inset: 0, background: gold, clipPath: cfg.style.clipPath, opacity: open ? 0.9 : 0, mixBlendMode: "overlay", transition: "opacity 0.5s ease", pointerEvents: "none" }} />
    </motion.div>
  );
}

export default function InvitationReveal({
  event,
  mode = "invitation",
  guestName = "",
  musicRef,
  sessionKey = null,
  lang: langProp = null,
  onComplete,
}) {
  const prefersReduced = useReducedMotion();

  // stage: 0 preload · 1 paper · 2 seal-focus(resting) · 3 activating · 4 opening · 5 light · 6 reveal · 7 done
  const [stage, setStage] = useState(0);
  const [lang, setLang] = useState(langProp || "en");

  const timers = useRef([]);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);

  const colors = event?.custom_colors || {};
  const P = useMemo(() => buildWaxPalette(colors.primary, colors.secondary), [colors.primary, colors.secondary]);
  const skins = useMemo(() => buildSkins(P), [P]);
  const theme = {
    primary: colors.primary || "#B8944F",
    secondary: colors.secondary || "#D7BE80",
    deep: P.ink,
  };

  const td = event?.template_data || {};
  const hasArabic = !!(event?.title_ar || td.title_ar || isArabic(event?.title));
  const identity = useMemo(() => deriveIdentity(event, lang), [event, lang]);

  // In rsvp mode the seal is personalised with the guest's own name.
  const gSeal = mode === "rsvp" ? guestSealText(guestName) : null;
  const sealText = gSeal || identity.sealText;
  const sealArabic = isArabic(sealText);

  // Ambient atmosphere (petals / snow / gold dust) matched to this event.
  const ambient = useMemo(() => getCelebrationPreset(event?.template_type), [event?.template_type]);

  /* Per-session "seen" memory (rsvp mode) so a return visit within the session
     doesn't replay the full sequence. Omit sessionKey to always replay. */
  const seenStorageKey = sessionKey ? `fancy_envelope_seen_${sessionKey}` : null;
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  const markSeen = useCallback(() => {
    if (!seenStorageKey || typeof window === "undefined") return;
    try { window.sessionStorage.setItem(seenStorageKey, "1"); } catch { /* storage unavailable */ }
  }, [seenStorageKey]);
  const [alreadySeen] = useState(
    () => !!(seenStorageKey && typeof window !== "undefined" && (() => { try { return window.sessionStorage.getItem(seenStorageKey) === "1"; } catch { return false; } })())
  );
  useEffect(() => {
    if (alreadySeen) onCompleteRef.current && onCompleteRef.current();
    // Only ever runs once, on mount, for the "already seen" check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Magnetic tilt: the seal leans toward the finger before it's tapped, like a
     real medallion catching the light. Disabled once activation begins. */
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const sealRotateX = useTransform(tiltY, [-0.5, 0.5], [10, -10]);
  const sealRotateY = useTransform(tiltX, [-0.5, 0.5], [-10, 10]);
  const handleTilt = useCallback((e) => {
    if (stage >= 3) return;
    const rect = e.currentTarget.getBoundingClientRect();
    tiltX.set((e.clientX - rect.left) / rect.width - 0.5);
    tiltY.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [tiltX, tiltY, stage]);
  const resetTilt = useCallback(() => { tiltX.set(0); tiltY.set(0); }, [tiltX, tiltY]);

  const copy = {
    en: {
      eyebrow: "You are invited",
      special: "You are invited for our special day",
      tap: "Tap the seal",
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
  const arTitle = event?.title_ar || td.title_ar;
  const displayTitle = isRTL && arTitle ? arTitle : event?.title;
  const dateStr = event?.event_date
    ? new Date(event.event_date).toLocaleDateString(isRTL ? "ar-EG" : "en-US", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        timeZone: "UTC",
      })
    : "";
  const locationStr = event?.location_name || "";

  /* Tileable embossed-arabesque stationery, encoded once as a data-URI so the
     same paper texture paints the backdrop AND every envelope flap. Tinted to
     the event's wax colour. */
  const patternHex = (theme.primary || "#b8944f").replace("#", "");
  const patternUrl = useMemo(() => {
    const stroke = `%23${patternHex}`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='46' height='46' viewBox='0 0 46 46'>`
      + `<g fill='none' stroke='${stroke}' stroke-opacity='0.18' stroke-width='0.9'>`
      + `<rect x='9' y='9' width='28' height='28'/>`
      + `<rect x='9' y='9' width='28' height='28' transform='rotate(45 23 23)'/>`
      + `<rect x='15' y='15' width='16' height='16'/>`
      + `<rect x='15' y='15' width='16' height='16' transform='rotate(45 23 23)'/>`
      + `<circle cx='23' cy='23' r='3'/>`
      + `<circle cx='0' cy='0' r='3'/><circle cx='46' cy='0' r='3'/><circle cx='0' cy='46' r='3'/><circle cx='46' cy='46' r='3'/>`
      + `<path d='M23 0 V9 M23 37 V46 M0 23 H9 M37 23 H46'/>`
      + `<path d='M9 9 L0 0 M37 9 L46 0 M9 37 L0 46 M37 37 L46 46'/>`
      + `</g>`
      + `<g fill='none' stroke='%23ffffff' stroke-opacity='0.45' stroke-width='0.6'>`
      + `<rect x='9.6' y='9.6' width='28' height='28'/>`
      + `<rect x='9.6' y='9.6' width='28' height='28' transform='rotate(45 23.6 23.6)'/>`
      + `</g></svg>`;
    return `url("data:image/svg+xml,${svg}")`;
  }, [patternHex]);

  const goldLining = `linear-gradient(135deg, ${P.goldDeep}, ${P.goldLite} 24%, ${P.gold} 46%, ${P.champagneLt} 64%, ${P.goldDeep} 84%, ${P.gold})`;

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
    markSeen();
    setStage(7);
    onComplete && onComplete();
  }, [clearTimers, markSeen, onComplete]);

  // Drive the cinematic opening once the guest activates the seal. Guarded by a
  // ref so nothing can restart an in-progress sequence.
  const openSeal = useCallback(() => {
    if (startedRef.current || finishedRef.current) return;
    startedRef.current = true;
    resetTilt();
    // Started synchronously inside the tap so the browser counts it as a real
    // user gesture (autoplay). Logged, not thrown, if blocked.
    musicRef?.current?.play().catch((err) => console.error('Background music playback failed:', err));
    setStage(3);                       // ACTIVATION — wax → molten, glow, dust
    after(620, () => setStage(4));     // OPENING — flaps peel back
    after(1180, () => setStage(5));    // LIGHT — golden volumetric bloom
    after(1820, () => finish());       // dissolve straight into the page/form beneath
  }, [after, finish, musicRef, resetTilt]);

  /* Choreography after mount: preload → paper → seal focus (resting). Opening
     only ever happens from the guest's own tap on the seal. */
  useEffect(() => {
    if (prefersReduced) return; // reduced-motion: render the static fallback only
    if (alreadySeen) return;
    after(120, () => setStage(1));   // PAPER stationery + flaps settle in
    after(900, () => setStage(2));   // SEAL FOCUS — resting, awaiting a tap
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Already opened this session — hand off immediately, render nothing.
  if (alreadySeen) return null;

  /* ═══ Reduced-motion fallback: a full luxury stationery card, without the
     envelope-opening choreography. ═══ */
  if (prefersReduced) {
    return (
      <motion.div
        data-testid="guest-envelope-reveal"
        role="dialog"
        aria-label="Open your invitation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        dir={isRTL ? "rtl" : "ltr"}
        style={{ ...overlayBase, background: `radial-gradient(125% 95% at 50% 24%, ${P.white} 0%, ${P.ivory} 38%, ${P.ivoryDeep} 70%, ${P.champagne} 100%)` }}
      >
        <style dangerouslySetInnerHTML={{ __html: RM_CSS }} />

        <div aria-hidden className="rm-aurora" style={{ position: "absolute", inset: 0, background: `linear-gradient(120deg, transparent 20%, ${alpha(P.gold, 0.2)} 45%, transparent 70%)`, pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: patternUrl, backgroundSize: "46px 46px", opacity: 0.3, mixBlendMode: "multiply", pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: `radial-gradient(62% 52% at 50% 26%, ${alpha(P.white, 0.55)}, transparent 70%), radial-gradient(120% 120% at 50% 100%, ${alpha(P.waxDeep, 0.22)}, transparent 60%)`, pointerEvents: "none" }} />
        {SPARKLES.map((s, i) => (
          <span key={i} aria-hidden className="rm-twinkle" style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, borderRadius: "50%", background: i % 2 ? P.gold : P.goldBright, boxShadow: `0 0 6px ${alpha(P.goldBright, 0.8)}`, animationDelay: `${s.delay}s`, pointerEvents: "none" }} />
        ))}

        <div style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineEnd: 16, zIndex: 6 }}>
          <button
            type="button"
            onClick={() => hasArabic && setLang((l) => (l === "en" ? "ar" : "en"))}
            aria-label={hasArabic ? "Toggle language" : "Language"}
            style={langChipStyle(!!hasArabic, P)}
          >
            <span aria-hidden style={{ fontSize: 15, opacity: 0.7 }}>🌐</span>
            <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{lang === "en" ? "EN" : "ع"}</span>
          </button>
        </div>

        <button type="button" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation" style={skipStyle(P)}>
          Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
        </button>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } } }}
          style={{
            position: "relative", zIndex: 2, width: "100%", maxWidth: 440,
            background: `linear-gradient(155deg, ${alpha(P.white, 0.94)}, ${alpha(P.ivory, 0.9)})`,
            border: `1px solid ${alpha(theme.primary, 0.22)}`,
            borderRadius: 24,
            boxShadow: `0 34px 76px -22px ${alpha(P.waxDeep, 0.38)}, inset 0 1px 0 ${alpha(P.white, 0.65)}`,
            padding: "40px 28px 34px",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            overflow: "hidden",
            textAlign: "center",
          }}
        >
          <CornerOrnaments color={theme.primary} />
          <div aria-hidden style={{ position: "absolute", inset: 9, border: `0.6px solid ${alpha(theme.primary, 0.15)}`, borderRadius: 17, pointerEvents: "none" }} />

          <motion.div variants={fadeUp} style={{ position: "relative", display: "inline-block" }}>
            <div aria-hidden className="rm-halo" style={{ position: "absolute", inset: "-26%", borderRadius: "50%", background: `radial-gradient(circle, ${alpha(P.goldBright, 0.55)} 0%, ${alpha(P.gold, 0.22)} 46%, transparent 72%)`, filter: "blur(5px)" }} />
            <svg width="138" height="138" viewBox="0 0 220 220" role="img" aria-label="Invitation seal" style={{ position: "relative", display: "block", filter: `drop-shadow(0 14px 26px ${alpha(P.waxDeep, 0.32)})` }}>
              <MedallionSkin skin={skins.lit} name="lit" uid="rm" text={sealText} arabic={sealArabic} />
            </svg>
            <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", pointerEvents: "none" }}>
              <div className="rm-sheen" />
            </div>
          </motion.div>

          <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "22px 0 12px" }}>
            <span aria-hidden style={{ height: 1, width: 28, background: `linear-gradient(90deg, transparent, ${theme.primary})` }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, letterSpacing: "0.34em", textTransform: "uppercase", color: theme.primary, fontWeight: 700 }}>
              {copy.eyebrow}
            </span>
            <span aria-hidden style={{ height: 1, width: 28, background: `linear-gradient(270deg, transparent, ${theme.primary})` }} />
          </motion.div>

          <motion.h1 variants={fadeUp} style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(24px,7vw,34px)", color: P.ink, margin: 0, fontWeight: 500, lineHeight: 1.22, textShadow: `0 1px 0 ${alpha(P.white, 0.7)}` }}>
            {displayTitle}
          </motion.h1>

          {copy.join && (
            <motion.p variants={fadeUp} style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 14, color: darken(theme.primary, 0.2), margin: "12px 0 0", letterSpacing: "0.02em" }}>
              {copy.join}
            </motion.p>
          )}

          {(dateStr || locationStr) && (
            <>
              <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "20px 0" }}>
                <span aria-hidden style={{ height: 1, width: 26, background: alpha(theme.primary, 0.33) }} />
                <span style={{ fontSize: 15, color: theme.primary }}>✦</span>
                <span aria-hidden style={{ height: 1, width: 26, background: alpha(theme.primary, 0.33) }} />
              </motion.div>
              <motion.div variants={fadeUp} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 6 }}>
                {dateStr && <DetailRow icon="📅" label={isRTL ? "التاريخ" : "When"} value={dateStr} />}
                {locationStr && <DetailRow icon="📍" label={isRTL ? "المكان" : "Where"} value={[locationStr, event?.location_address].filter(Boolean).join(" · ")} />}
              </motion.div>
            </>
          )}

          <motion.div variants={fadeUp} style={{ marginTop: 26 }}>
            <motion.button
              type="button"
              onClick={() => { musicRef?.current?.play().catch((err) => console.error('Background music playback failed:', err)); finish(); }}
              whileHover={{ scale: 1.035, boxShadow: `0 16px 34px ${alpha(theme.primary, 0.33)}, inset 0 1px 0 ${alpha(P.white, 0.45)}` }}
              whileTap={{ scale: 0.97 }}
              style={enterBtnStyle(theme)}
            >
              {copy.enter}
              <span aria-hidden style={{ fontSize: 14, marginInlineStart: 9 }}>{isRTL ? "←" : "→"}</span>
            </motion.button>
          </motion.div>
        </motion.div>
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
      style={{ ...overlayBase, background: `radial-gradient(130% 100% at 50% 32%, ${P.white} 0%, ${P.ivory} 52%, ${P.ivoryDeep} 100%)` }}
    >
      <style dangerouslySetInnerHTML={{ __html: REVEAL_CSS }} />

      {/* Ambient atmosphere matched to this event (petals / snow / gold dust) */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{ opacity: lit ? 0 : 1 }}
        transition={{ duration: 0.6 }}
        style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}
      >
        <FloatingParticles count={20} color={ambient.ambientColor || theme.secondary} shape={ambient.ambient} />
      </motion.div>

      {/* Embossed arabesque stationery wash + warm vignette */}
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: patternUrl, backgroundSize: "46px 46px", opacity: lit ? 0.12 : 0.5, transition: "opacity 0.8s ease" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: `radial-gradient(70% 60% at 50% 38%, ${alpha(P.white, 0.35)}, transparent 70%), radial-gradient(120% 120% at 50% 100%, ${alpha(P.waxDeep, 0.14)}, transparent 60%)`, pointerEvents: "none" }} />

      {/* Top-end language chip */}
      <div style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineEnd: 16, zIndex: 6 }}>
        <button
          type="button"
          onClick={() => hasArabic && setLang((l) => (l === "en" ? "ar" : "en"))}
          aria-label={hasArabic ? "Toggle language" : "Language"}
          style={langChipStyle(!!hasArabic, P)}
        >
          <span aria-hidden style={{ fontSize: 15, opacity: 0.7 }}>🌐</span>
          <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{lang === "en" ? "EN" : "ع"}</span>
        </button>
      </div>

      {/* Skip — always available */}
      <button type="button" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation animation" style={skipStyle(P)}>
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
          {mode === "rsvp" && guestName ? (isRTL ? `مرحباً ${guestName}` : `Welcome, ${guestName}`) : copy.eyebrow}
        </span>
        {displayTitle && (
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(22px,6.4vw,34px)", fontWeight: 500, lineHeight: 1.18, color: P.ink, margin: 0, textShadow: `0 1px 0 ${alpha(P.white, 0.6)}` }}>
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
        {/* Interior panel revealed when the flaps open (warm, gold-lined light pool) */}
        <div aria-hidden style={{ position: "absolute", inset: "8%", borderRadius: 10, background: `radial-gradient(60% 60% at 50% 45%, ${P.white} 0%, ${P.champagneLt} 60%, ${P.champagne} 100%)`, boxShadow: `inset 0 0 0 2px ${alpha(P.gold, 0.4)}, inset 0 0 40px ${alpha(P.waxMid, 0.25)}` }} />

        {/* ── Volumetric golden light from inside the envelope ── */}
        <div aria-hidden style={{ position: "absolute", inset: "-60%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
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
                background: `repeating-conic-gradient(from 0deg at 50% 50%, ${alpha(P.goldBright, 0)} 0deg, ${alpha(P.goldBright, 0.55)} 3deg, ${alpha(P.goldBright, 0)} 7deg)`,
                WebkitMaskImage: "radial-gradient(circle, #000 8%, rgba(0,0,0,0.5) 38%, transparent 70%)",
                maskImage: "radial-gradient(circle, #000 8%, rgba(0,0,0,0.5) 38%, transparent 70%)",
              }}
            />
          </motion.div>
          <motion.div
            initial={false}
            animate={{ opacity: lit ? 1 : 0, scale: revealing ? 1.5 : lit ? 1 : 0.3 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ position: "absolute", width: "62%", height: "62%", borderRadius: "50%", background: `radial-gradient(circle, ${P.white} 0%, ${alpha(P.goldBright, 0.8)} 26%, ${alpha(P.gold, 0.55)} 52%, transparent 74%)`, filter: "blur(6px)" }}
          />
        </div>

        {/* Downward chevron beam */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ x: "-50%", opacity: lit ? 0.85 : 0, scaleY: lit ? 1 : 0.2 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          style={{
            position: "absolute", left: "50%", top: "52%", width: "78%", height: "90%",
            transformOrigin: "top center", zIndex: 2,
            background: `linear-gradient(180deg, ${alpha(P.goldBright, 0.85)} 0%, ${alpha(P.gold, 0.35)} 40%, transparent 78%)`,
            clipPath: "polygon(50% 0, 100% 0, 50% 100%, 0 0)", filter: "blur(7px)", pointerEvents: "none",
          }}
        />

        {/* Four peel-away flaps with gold-foil lining */}
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d", zIndex: 3 }}>
          <Flap side="top" open={opening} patternUrl={patternUrl} delay={0} gold={goldLining} />
          <Flap side="left" open={opening} patternUrl={patternUrl} delay={0.06} gold={goldLining} />
          <Flap side="right" open={opening} patternUrl={patternUrl} delay={0.06} gold={goldLining} />
          <Flap side="bottom" open={opening} patternUrl={patternUrl} delay={0.12} gold={goldLining} />
        </div>

        {/* Themed ignition burst as the seal floods with light */}
        {stage === 5 && (
          <ConfettiExplosion active duration={1300} particleCount={40} spread={0.6} colors={ambient.colors} shapes={ambient.shapes} />
        )}

        {/* ── The wax seal (centred via inset so framer-motion owns transform) ── */}
        <motion.button
          type="button"
          onClick={openSeal}
          onPointerMove={handleTilt}
          onPointerLeave={resetTilt}
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
            filter: `drop-shadow(0 14px 22px ${alpha(P.waxDeep, 0.34)})`,
          }}
        >
          {/* Glow halo behind the seal (ramps up on activation) */}
          <motion.span
            aria-hidden
            className={stage === 2 ? "ger-glow-idle" : ""}
            initial={false}
            animate={{ opacity: stage >= 3 ? 1 : 0, scale: stage >= 3 ? 1.35 : 1.0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ position: "absolute", inset: "-26%", borderRadius: "50%", background: `radial-gradient(circle, ${alpha(P.goldBright, 0.7)} 0%, ${alpha(P.gold, 0.32)} 45%, transparent 72%)`, pointerEvents: "none", filter: "blur(3px)" }}
          />

          {/* The medallion: resting wax skin with a molten skin cross-faded on top.
              Magnetic tilt applied to the inner wrapper. */}
          <motion.div
            className={stage === 2 ? "ger-breathe" : ""}
            style={{ position: "relative", width: "100%", height: "100%", rotateX: sealRotateX, rotateY: sealRotateY, transformStyle: "preserve-3d" }}
          >
            <svg viewBox="0 0 220 220" width="100%" height="100%" style={{ display: "block", position: "relative", zIndex: 1 }} role="img" aria-label="Invitation wax seal">
              <MedallionSkin skin={skins.rest} name="rest" uid="main" text={sealText} arabic={sealArabic} />
            </svg>
            <motion.svg
              viewBox="0 0 220 220" width="100%" height="100%"
              initial={false}
              animate={{ opacity: stage >= 3 ? 1 : 0 }}
              transition={{ duration: 0.85, ease: "easeInOut" }}
              style={{ display: "block", position: "absolute", inset: 0, zIndex: 2 }}
              aria-hidden
            >
              <MedallionSkin skin={skins.lit} name="lit" uid="main" text={sealText} arabic={sealArabic} />
            </motion.svg>

            {/* Light-reflection sweep across the wax */}
            <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", zIndex: 3, pointerEvents: "none" }}>
              <div className={stage <= 2 ? "ger-sheen" : "ger-sheen ger-sheen-burst"} />
            </div>
          </motion.div>
        </motion.button>

        {/* Rising gold dust on activation */}
        {stage >= 3 && !revealing && (
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
            {DUST.map((d, i) => (
              <span key={i} className="ger-dust" style={{ left: `${d.x}%`, bottom: "44%", width: d.s, height: d.s, animationDelay: `${d.delay}s`, background: i % 2 ? P.gold : P.goldBright }} />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Resting prompt (hidden once opening begins) ── */}
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
            <div className="ger-prompt" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 20px", borderRadius: 999, background: alpha(P.white, 0.6), border: `1px solid ${alpha(theme.primary, 0.3)}`, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", boxShadow: `0 6px 20px ${alpha(P.waxMid, 0.12)}` }}>
              <span aria-hidden style={{ fontSize: 13 }}>✦</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: theme.deep }}>
                {copy.tap}
              </span>
            </div>
            <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 13, color: darken(theme.primary, 0.15), marginTop: 16, letterSpacing: "0.04em" }}>
              {copy.special}
            </p>
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

const skipStyle = (P) => ({
  position: "absolute",
  top: "max(16px, env(safe-area-inset-top))",
  insetInlineStart: 20,
  zIndex: 8,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  minHeight: 44,
  borderRadius: 999,
  border: `1px solid ${alpha(P.waxDeep, 0.22)}`,
  background: alpha(P.white, 0.5),
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: P.ink,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
});

const langChipStyle = (active, P) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  minHeight: 44,
  borderRadius: 999,
  border: `1px solid ${alpha(P.waxDeep, 0.18)}`,
  background: alpha(P.white, 0.62),
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  color: P.ink,
  fontSize: 13,
  fontFamily: "var(--font-sans)",
  cursor: active ? "pointer" : "default",
  boxShadow: `0 4px 14px ${alpha(P.waxMid, 0.1)}`,
});

const enterBtnStyle = (theme) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px 38px",
  borderRadius: 999,
  border: `1px solid ${alpha(theme.secondary || "#D7BE80", 0.6)}`,
  background: `linear-gradient(135deg, ${theme.secondary || "#D7BE80"} 0%, ${theme.primary} 55%, ${darken(theme.primary, 0.25)} 100%)`,
  color: "#fffdf6",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow: `0 10px 28px ${alpha(theme.primary, 0.25)}, inset 0 1px 0 rgba(255,255,255,0.4)`,
});

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

/* Rising-dust particle field (positions fixed so SSR/CSR match) */
const DUST = [
  { x: 30, s: 5, delay: 0 }, { x: 44, s: 4, delay: 0.25 }, { x: 56, s: 6, delay: 0.1 },
  { x: 68, s: 4, delay: 0.4 }, { x: 38, s: 3, delay: 0.55 }, { x: 62, s: 5, delay: 0.7 },
  { x: 50, s: 4, delay: 0.18 }, { x: 35, s: 5, delay: 0.85 }, { x: 65, s: 3, delay: 0.62 },
];

/* Ambient twinkle field for the reduced-motion stationery backdrop (fixed positions) */
const SPARKLES = [
  { x: 12, y: 18, s: 5, delay: 0 }, { x: 85, y: 14, s: 4, delay: 0.6 },
  { x: 8, y: 76, s: 4, delay: 1.1 }, { x: 90, y: 68, s: 5, delay: 0.3 },
  { x: 48, y: 8, s: 3, delay: 1.6 }, { x: 22, y: 88, s: 3, delay: 0.9 },
  { x: 78, y: 90, s: 4, delay: 1.3 }, { x: 64, y: 5, s: 3, delay: 0.45 },
];

/* Low-amplitude ambient CSS for the reduced-motion fallback */
const RM_CSS = `
@keyframes rmAurora { 0%,100% { opacity: 0.5; } 50% { opacity: 0.9; } }
.rm-aurora { animation: rmAurora 9s ease-in-out infinite; }

@keyframes rmTwinkle { 0%,100% { opacity: 0.15; transform: scale(0.85); } 50% { opacity: 0.9; transform: scale(1.15); } }
.rm-twinkle { animation: rmTwinkle 3.6s ease-in-out infinite; }

@keyframes rmHalo { 0%,100% { opacity: 0.55; } 50% { opacity: 0.85; } }
.rm-halo { animation: rmHalo 4.4s ease-in-out infinite; }

@keyframes rmSheen { 0% { transform: translateX(-130%) rotate(8deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateX(130%) rotate(8deg); opacity: 0; } }
.rm-sheen {
  position: absolute; top: -25%; left: 0; width: 55%; height: 150%;
  background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.8) 50%, transparent 62%);
  animation: rmSheen 1.8s ease-out 0.6s 1;
}
`;

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
