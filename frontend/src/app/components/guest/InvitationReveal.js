"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { lighten, darken, alpha, mix, luminance } from "../../utils/color";

/* ═══════════════════════════════════════════════════════════════════════════
   InvitationReveal — "The Unsealing"

   ONE cinematic opening shared by both guest reveals:

     • mode="invitation"  first thing a guest sees on the event page /[slug].
     • mode="rsvp"        gates the RSVP route; seal personalised with the
                          guest's own name; per-session "seen" memory.

   A styled flatlay: a botanical envelope with a ribbon-tied wax seal rests
   on a sunlit wood table among loose eucalyptus and baby's-breath. Tap the
   seal to lift the flap, reveal the watercolour liner, and let a wreathed
   invitation card rise, come into focus, and dissolve into the live page.

   Everything is generated — NO image uploads. Every material (foliage,
   paper, wax, ribbon) is tinted from the event's own custom_colors.

   CONTRACT (kept stable for callers + tests):
     • data-testid="guest-envelope-reveal" on the root
     • data-testid="guest-envelope-skip" on the always-available skip control
     • calls onComplete() exactly once when finished or skipped
   ═══════════════════════════════════════════════════════════════════════════ */

const isArabic = (s) => typeof s === "string" && /[؀-ۿ]/.test(s);

/* ─── Name + monogram derivation from real event data ─── */
function deriveIdentity(event, lang) {
  const td = event?.template_data || {};
  const a = (td.groom_name || td.partner1Name || td.partner1 || td.celebrant || td.honoree || td.company || "").trim();
  const b = (td.bride_name || td.partner2Name || td.partner2 || "").trim();

  let full;
  if (a && b) full = `${a} & ${b}`;
  else if (a) full = a;
  else full = (lang === "ar" && (event?.title_ar || td.title_ar)) ? (event?.title_ar || td.title_ar) : (event?.title || "");

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
  return { full: full || "You're Invited", sealText };
}

function guestSealText(guestName) {
  const raw = (guestName || "").trim();
  if (!raw) return null;
  if (raw.length <= 12) return raw;
  return raw.split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 3).toUpperCase();
}

/* ─── Botanical palette derived from the event's own custom_colors ───
   Clamped to a legible mid-tone band so any organizer color reads as
   real foliage/wax/ribbon against the bright paper, never washed out
   or muddy. The wood table + card stock stay a constant sunlit neutral —
   only the "product" (envelope, wax, ribbon, greenery) carries the brand. */
function buildBotanicalPalette(customColors) {
  const c = customColors || {};
  let accent = c.primary || c.secondary || "#5f8154";
  let gold = c.secondary || c.accent || "#c6a24d";

  const aLum = luminance(accent);
  if (aLum > 0.72) accent = darken(accent, 0.35);
  else if (aLum < 0.16) accent = lighten(accent, 0.3);

  const gLum = luminance(gold);
  if (gLum > 0.85) gold = darken(gold, 0.2);
  else if (gLum < 0.22) gold = lighten(gold, 0.35);

  return {
    wood: "#e3d3b8", woodHi: "#f0e3ce", woodLo: "#c9b48f",
    paper: mix(accent, "#f2ecd8", 0.74), paperHi: mix(accent, "#f8f3e2", 0.84), paperLo: mix(accent, "#dccfa8", 0.55),
    seam: mix(accent, "#c9b48f", 0.4),
    linerLite: lighten(accent, 0.6), linerMid: accent, linerDeep: darken(accent, 0.32),
    card: "#fbf8ef", cardHi: "#fffefa", cardEdge: mix(gold, "#fbf8ef", 0.3),
    ink: mix(darken(accent, 0.5), "#2c2c20", 0.45), inkSoft: mix(accent, "#5c5c48", 0.55),
    wax: gold, waxHi: lighten(gold, 0.32), waxLo: darken(gold, 0.36),
    accent, gold, goldHi: lighten(gold, 0.26),
    stamp: darken(accent, 0.22),
    ribbon: darken(accent, 0.1), ribbonDk: darken(accent, 0.3),
    bloom: mix(gold, "#fff8ea", 0.7),
  };
}

const STAGE_CLASSES = {
  preload: [],
  settled: ["ir2-settled"],
  rest: ["ir2-settled", "ir2-rest"],
  pressing: ["ir2-settled", "ir2-pressing"],
  opening: ["ir2-settled", "ir2-opening", "ir2-lift"],
  rise: ["ir2-settled", "ir2-opening", "ir2-lift", "ir2-rise"],
  grow: ["ir2-settled", "ir2-opening", "ir2-lift", "ir2-grow"],
};

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

  const [stage, setStage] = useState("preload");
  const [lang, setLang] = useState(langProp || "en");
  const timers = useRef([]);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);

  const P = useMemo(() => buildBotanicalPalette(event?.custom_colors), [event?.custom_colors]);
  const paletteVars = useMemo(() => ({
    "--wood": P.wood, "--wood-hi": P.woodHi, "--wood-lo": P.woodLo,
    "--paper": P.paper, "--paper-hi": P.paperHi, "--paper-lo": P.paperLo, "--seam": P.seam,
    "--liner-lite": P.linerLite, "--liner-mid": P.linerMid, "--liner-deep": P.linerDeep,
    "--card": P.card, "--card-hi": P.cardHi, "--card-edge": P.cardEdge,
    "--ink": P.ink, "--ink-soft": P.inkSoft,
    "--wax": P.wax, "--wax-hi": P.waxHi, "--wax-lo": P.waxLo,
    "--accent": P.accent, "--gold": P.gold, "--gold-hi": P.goldHi, "--stamp": P.stamp,
    "--ribbon": P.ribbon, "--ribbon-dk": P.ribbonDk, "--bloom": P.bloom,
  }), [P]);

  const td = event?.template_data || {};
  const hasArabic = !!(event?.title_ar || td.title_ar || isArabic(event?.title));
  const identity = useMemo(() => deriveIdentity(event, lang), [event, lang]);
  // A known guest (resolved from their personal link/token — private events,
  // or a public event's per-guest invite) is personalised the same way in
  // either mode: the seal, the card's welcome line, and the envelope's own
  // handwritten-style address line all carry their name instead of generic copy.
  const gSeal = guestSealText(guestName);
  const sealText = gSeal || identity.sealText;
  const sealFontSize = sealText.length <= 2 ? 28 : sealText.length <= 4 ? 21 : sealText.length <= 7 ? 15 : sealText.length <= 10 ? 11 : 9;

  /* Per-session "seen" memory (rsvp mode). */
  const seenKey = sessionKey ? `fancy_envelope_seen_${sessionKey}` : null;
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  const markSeen = useCallback(() => {
    if (!seenKey || typeof window === "undefined") return;
    try { window.sessionStorage.setItem(seenKey, "1"); } catch { /* unavailable */ }
  }, [seenKey]);
  const [alreadySeen] = useState(
    () => !!(seenKey && typeof window !== "undefined" && (() => { try { return window.sessionStorage.getItem(seenKey) === "1"; } catch { return false; } })())
  );
  useEffect(() => {
    if (alreadySeen) onCompleteRef.current && onCompleteRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = {
    en: { eyebrow: "You are invited", tap: "Tap the seal to open", special: "You are invited to our special day", enter: "View invitation", join: "request the honour of your presence", details: "View Details" },
    ar: { eyebrow: "أنت مدعو", tap: "اضغط على الختم", special: "أنت مدعوّ ليومنا المميّز", enter: "عرض الدعوة", join: "يشرّفنا حضوركم", details: "عرض التفاصيل" },
  }[lang];
  const isRTL = lang === "ar";
  const arTitle = event?.title_ar || td.title_ar;
  const displayTitle = isRTL && arTitle ? arTitle : identity.full;
  const dateStr = event?.event_date
    ? new Date(event.event_date).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "";
  const locationStr = event?.location_name || "";

  const noiseVars = useMemo(() => ({
    "--ir-paper-noise": "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/></filter><rect width='140' height='140' filter='url(%23p)'/></svg>\")",
    "--ir-wood-noise": "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='560' height='200'><filter id='w'><feTurbulence type='fractalNoise' baseFrequency='0.011 0.085' numOctaves='4' seed='4'/><feColorMatrix type='matrix' values='0 0 0 0 0.40 0 0 0 0 0.30 0 0 0 0 0.18 0 0 0 0.10 0'/></filter><rect width='560' height='200' filter='url(%23w)'/></svg>\")",
  }), []);

  /* ─── Sequence control ─── */
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const after = useCallback((ms, fn) => { timers.current.push(setTimeout(fn, ms)); }, []);
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();
    markSeen();
    onComplete && onComplete();
  }, [clearTimers, markSeen, onComplete]);

  const openSeal = useCallback(() => {
    if (startedRef.current || finishedRef.current) return;
    startedRef.current = true;
    clearTimers(); // cancel any still-pending intro timers (e.g. the resting-prompt timer)
    musicRef?.current?.play().catch((err) => console.error("Background music playback failed:", err));
    setStage("pressing");
    after(400, () => setStage("opening"));
    after(1300, () => setStage("rise"));    // 1.6s rise transition, completes ~2900
    after(3000, () => setStage("grow"));    // starts only once rise has fully settled
    after(4400, finish);                    // a beat to admire the grown card before dissolving
  }, [after, clearTimers, finish, musicRef]);

  useEffect(() => {
    if (prefersReduced || alreadySeen) return;
    after(150, () => setStage("settled"));
    after(1150, () => setStage("rest"));
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (alreadySeen) return null;

  /* ═══ Reduced-motion fallback — a static bright card, no choreography. ═══ */
  if (prefersReduced) {
    return (
      <motion.div
        data-testid="guest-envelope-reveal" role="dialog" aria-label="Open your invitation"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
        dir={isRTL ? "rtl" : "ltr"}
        style={{ ...overlayBase, ...paletteVars, background: `linear-gradient(180deg, ${P.woodHi}, ${P.wood} 46%, ${P.woodLo})` }}
      >
        <button type="button" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation" style={skipStyle(P)}>
          Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
        </button>
        <div style={{
          position: "relative", width: "100%", maxWidth: 420, textAlign: "center", padding: "44px 30px",
          borderRadius: 8, color: P.ink, backgroundColor: P.card,
          backgroundImage: `radial-gradient(120% 90% at 50% 0%, ${P.cardHi}, ${P.card} 76%)`,
          border: `1px solid ${alpha(P.gold, 0.4)}`,
          boxShadow: "0 40px 90px -30px rgba(40,30,16,.45), inset 0 0 0 1px rgba(255,255,255,.4)",
          maxHeight: "calc(100dvh - 48px)", overflowY: "auto",
        }}>
          <div style={{ width: 76, height: 76, margin: "0 auto 18px", position: "relative" }}>
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <radialGradient id="ir2rm-wax" cx="37%" cy="31%" r="78%">
                  <stop offset="0%" stopColor={P.waxHi} />
                  <stop offset="48%" stopColor={P.wax} />
                  <stop offset="100%" stopColor={P.waxLo} />
                </radialGradient>
              </defs>
              <path d="M50 3 C61 3 63 12 72 15 C83 18 84 30 89 38 C95 47 90 56 91 66 C92 78 82 80 74 87 C65 94 57 90 50 92 C42 90 34 95 26 87 C17 79 9 79 9 66 C9 55 5 47 11 38 C16 30 17 18 28 15 C37 12 39 3 50 3 Z" fill="url(#ir2rm-wax)" />
              <text x="50" y="53" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-serif)" fontSize={sealFontSize} fill={P.waxLo} opacity=".85" letterSpacing="1">{sealText}</text>
            </svg>
          </div>
          <div style={{ fontSize: 10.5, letterSpacing: "0.36em", textTransform: "uppercase", color: P.accent, fontWeight: 700 }}>{guestName ? (isRTL ? `مرحباً ${guestName}` : `Welcome, ${guestName}`) : copy.eyebrow}</div>
          <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "clamp(26px,7vw,38px)", margin: "12px 0 6px", color: P.ink, fontWeight: 500 }}>{displayTitle}</h1>
          <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontSize: 14, color: P.inkSoft, margin: 0 }}>{copy.join}</p>
          {dateStr && <div style={{ marginTop: 18, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: P.inkSoft, fontWeight: 600 }}>{dateStr}</div>}
          <button type="button" onClick={() => { musicRef?.current?.play().catch(() => {}); finish(); }} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 24, padding: "14px 32px", borderRadius: 999,
            border: "none", background: `linear-gradient(180deg, ${P.goldHi}, ${P.gold})`, color: "#2c2010",
            fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
            boxShadow: `0 12px 28px ${alpha(P.gold, 0.35)}, inset 0 1px 0 rgba(255,255,255,.5)`,
          }}>
            {copy.enter} <span aria-hidden style={{ marginInlineStart: 8 }}>{isRTL ? "←" : "→"}</span>
          </button>
        </div>
      </motion.div>
    );
  }

  const rootClassName = ["ir2-root", ...(STAGE_CLASSES[stage] || [])].join(" ");

  return (
    <motion.div
      data-testid="guest-envelope-reveal" role="dialog" aria-label="Open your invitation"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } }}
      transition={{ duration: 0.6 }}
      dir={isRTL ? "rtl" : "ltr"}
      className={rootClassName}
      style={{ ...overlayBase, ...paletteVars, ...noiseVars }}
    >
      <style dangerouslySetInnerHTML={{ __html: REVEAL_CSS }} />

      {/* shared botanical + flourish artwork, tinted from the palette above */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <filter id="ir2-wc" x="-22%" y="-22%" width="144%" height="144%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="0.55" />
          </filter>
          <linearGradient id="ir2-leafG" x1="0.12" y1="0" x2="0.85" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--liner-lite)" }} />
            <stop offset="52%" style={{ stopColor: "var(--liner-mid)" }} />
            <stop offset="100%" style={{ stopColor: "var(--liner-deep)" }} />
          </linearGradient>
          <radialGradient id="ir2-waxg" cx="37%" cy="31%" r="78%">
            <stop offset="0%" style={{ stopColor: "var(--wax-hi)" }} />
            <stop offset="48%" style={{ stopColor: "var(--wax)" }} />
            <stop offset="100%" style={{ stopColor: "var(--wax-lo)" }} />
          </radialGradient>

          <symbol id="ir2-leaf" viewBox="0 0 22 28">
            <path d="M11 0 C18 2 22 9 22 15 C22 23 16 28 11 28 C6 28 0 23 0 15 C0 9 4 2 11 0 Z" fill="url(#ir2-leafG)" style={{ stroke: "var(--liner-deep)" }} strokeWidth=".6" strokeOpacity=".28" />
            <path d="M11 3 C15 4 18 9 18 14 C18 19 15 22 11 22 C9 22 6 20 6 15 C6 10 8 5 11 3 Z" style={{ fill: "var(--liner-lite)" }} opacity=".4" />
            <path d="M11 4 C11 12 11 19 11 25" fill="none" style={{ stroke: "var(--liner-deep)" }} strokeWidth=".7" opacity=".26" />
          </symbol>
          <symbol id="ir2-leafs" viewBox="0 0 14 34">
            <path d="M7 0 C11 6 12 15 7 34 C2 15 3 6 7 0 Z" fill="url(#ir2-leafG)" style={{ stroke: "var(--liner-deep)" }} strokeWidth=".5" strokeOpacity=".26" />
            <path d="M7 3 C7 12 7 22 7 31" fill="none" style={{ stroke: "var(--liner-deep)" }} strokeWidth=".6" opacity=".24" />
          </symbol>
          <symbol id="ir2-leaf-mono" viewBox="0 0 22 28">
            <path d="M11 0 C18 2 22 9 22 15 C22 23 16 28 11 28 C6 28 0 23 0 15 C0 9 4 2 11 0 Z" fill="currentColor" />
            <path d="M11 4 C11 12 11 19 11 25" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".45" />
          </symbol>
          <symbol id="ir2-flower" viewBox="0 0 40 40">
            <g filter="url(#ir2-wc)">
              <circle cx="20" cy="13" r="8.4" style={{ fill: "var(--bloom)" }} opacity=".92" />
              <circle cx="11" cy="21" r="8.2" style={{ fill: "var(--bloom)" }} opacity=".88" />
              <circle cx="29" cy="21" r="8.2" style={{ fill: "var(--bloom)" }} opacity=".88" />
              <circle cx="14" cy="30" r="7.4" style={{ fill: "var(--bloom)" }} opacity=".82" />
              <circle cx="26" cy="30" r="7.4" style={{ fill: "var(--bloom)" }} opacity=".82" />
              <circle cx="20" cy="23" r="5.6" style={{ fill: "var(--gold)" }} opacity=".55" />
              <circle cx="20" cy="23" r="2.4" style={{ fill: "var(--gold-hi)" }} opacity=".8" />
            </g>
          </symbol>
          <symbol id="ir2-babysbreath" viewBox="0 0 60 90">
            <path d="M30 88 C30 60 26 40 20 20 M30 60 C34 48 40 40 46 30 M28 50 C22 42 16 36 8 30 M30 40 C30 28 28 18 24 6"
              fill="none" stroke="currentColor" strokeWidth="1" opacity=".5" />
            <circle cx="20" cy="18" r="2.6" fill="currentColor" opacity=".85" />
            <circle cx="14" cy="24" r="2" fill="currentColor" opacity=".7" />
            <circle cx="46" cy="28" r="2.4" fill="currentColor" opacity=".8" />
            <circle cx="50" cy="22" r="1.8" fill="currentColor" opacity=".65" />
            <circle cx="8" cy="28" r="2.2" fill="currentColor" opacity=".75" />
            <circle cx="4" cy="22" r="1.6" fill="currentColor" opacity=".6" />
            <circle cx="24" cy="4" r="2.4" fill="currentColor" opacity=".8" />
            <circle cx="28" cy="10" r="1.8" fill="currentColor" opacity=".65" />
            <circle cx="24" cy="52" r="1.8" fill="currentColor" opacity=".6" />
          </symbol>

          <symbol id="ir2-sprig" viewBox="0 0 220 262">
            <g filter="url(#ir2-wc)">
              <path d="M176 260 C150 212 150 150 120 100 C100 66 92 40 80 14" fill="none" stroke="currentColor" strokeWidth="2.6" opacity=".38" />
              <circle cx="168" cy="238" r="3.4" fill="currentColor" opacity=".55" />
              <circle cx="176" cy="230" r="2.8" fill="currentColor" opacity=".5" />
              <use href="#ir2-leaf" width="22" height="28" transform="translate(150 206) rotate(-48) scale(1.55)" opacity=".9" />
              <use href="#ir2-leaf" width="22" height="28" transform="translate(178 196) rotate(52) scale(1.5)" />
              <use href="#ir2-leaf" width="22" height="28" transform="translate(132 168) rotate(-44) scale(1.4)" opacity=".92" />
              <use href="#ir2-leaf" width="22" height="28" transform="translate(160 158) rotate(56) scale(1.36)" />
              <use href="#ir2-leaf" width="22" height="28" transform="translate(114 132) rotate(-40) scale(1.24)" opacity=".92" />
              <use href="#ir2-leaf" width="22" height="28" transform="translate(142 122) rotate(58) scale(1.2)" />
              <use href="#ir2-leaf" width="22" height="28" transform="translate(100 98) rotate(-34) scale(1.08)" opacity=".9" />
              <use href="#ir2-leaf" width="22" height="28" transform="translate(124 90) rotate(60) scale(1.02)" />
              <use href="#ir2-leafs" width="14" height="34" transform="translate(92 66) rotate(-26) scale(.92)" opacity=".88" />
              <use href="#ir2-leafs" width="14" height="34" transform="translate(110 58) rotate(54) scale(.84)" />
              <use href="#ir2-leafs" width="14" height="34" transform="translate(84 30) rotate(8) scale(.74)" opacity=".85" />
            </g>
          </symbol>

          <symbol id="ir2-wreath" viewBox="0 0 300 300">
            <g filter="url(#ir2-wc)">
              <use href="#ir2-flower" width="30" height="30" transform="translate(135 10) rotate(0)" />
              <use href="#ir2-leaf" width="20" height="26" transform="translate(198 26) rotate(32) scale(1.1)" />
              <use href="#ir2-leaf" width="20" height="26" transform="translate(242 68) rotate(60) scale(1.15)" />
              <use href="#ir2-babysbreath" width="24" height="38" transform="translate(258 128) rotate(90)" />
              <use href="#ir2-flower" width="28" height="28" transform="translate(238 208) rotate(120) scale(.95)" />
              <use href="#ir2-leaf" width="20" height="26" transform="translate(198 254) rotate(148) scale(1.1)" />
              <use href="#ir2-leaf" width="20" height="26" transform="translate(140 270) rotate(180) scale(1.15)" />
              <use href="#ir2-leaf" width="20" height="26" transform="translate(84 254) rotate(212) scale(1.1)" />
              <use href="#ir2-flower" width="28" height="28" transform="translate(38 206) rotate(240) scale(.95)" />
              <use href="#ir2-babysbreath" width="24" height="38" transform="translate(22 118) rotate(270)" />
              <use href="#ir2-leaf" width="20" height="26" transform="translate(42 66) rotate(300) scale(1.1)" />
              <use href="#ir2-leaf" width="20" height="26" transform="translate(84 24) rotate(328) scale(1.1)" />
              <use href="#ir2-leaf" width="15" height="20" transform="translate(182 50) rotate(45) scale(.9)" opacity=".85" />
              <use href="#ir2-leaf" width="15" height="20" transform="translate(182 220) rotate(135) scale(.9)" opacity=".85" />
              <use href="#ir2-leaf" width="15" height="20" transform="translate(98 220) rotate(225) scale(.9)" opacity=".85" />
              <use href="#ir2-leaf" width="15" height="20" transform="translate(98 50) rotate(315) scale(.9)" opacity=".85" />
            </g>
          </symbol>

          <symbol id="ir2-flourish-corner" viewBox="0 0 90 90">
            <path d="M6,52 C6,26 26,6 52,6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M52,6 C64,6 71,9.5 73,16 C75,21.6 70,25.6 64,23" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M6,52 C6,64 9.5,71 16,73 C21.6,75 25.6,70 23,64" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="73" cy="16" r="1.6" fill="currentColor" />
            <circle cx="16" cy="73" r="1.6" fill="currentColor" />
            <use href="#ir2-leaf" width="16" height="20" transform="translate(22 22) rotate(-45) scale(.95)" opacity=".85" />
          </symbol>

          <symbol id="ir2-flourish-divider" viewBox="0 0 220 24">
            <path d="M4,16 C22,4 36,22 54,12 C64,6 74,9 84,11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
            <path d="M216,16 C198,4 184,22 166,12 C156,6 146,9 136,11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
            <circle cx="4" cy="16" r="1.7" fill="currentColor" opacity=".75" />
            <circle cx="216" cy="16" r="1.7" fill="currentColor" opacity=".75" />
            <rect x="106.5" y="8.5" width="7" height="7" transform="rotate(45 110 12)" fill="currentColor" />
          </symbol>

          <symbol id="ir2-bow" viewBox="0 0 100 70">
            <path d="M50 30 C50 30 20 8 8 20 C-2 32 12 48 50 34" fill="currentColor" opacity=".92" />
            <path d="M50 30 C50 30 80 8 92 20 C102 32 88 48 50 34" fill="currentColor" opacity=".92" />
            <path d="M45 32 L34 68 L46 58 L50 34 Z" fill="currentColor" opacity=".85" />
            <path d="M55 32 L66 68 L54 58 L50 34 Z" fill="currentColor" opacity=".85" />
            <ellipse cx="50" cy="32" rx="9" ry="6.5" fill="currentColor" />
            <ellipse cx="50" cy="32" rx="9" ry="6.5" fill="#000" opacity=".14" />
          </symbol>
        </defs>
      </svg>

      <div className="ir2-grain" aria-hidden />
      <div className="ir2-daylight" aria-hidden />
      <div className="ir2-vignette" aria-hidden />
      <div className="ir2-grade" aria-hidden />

      {/* language chip */}
      <div style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineEnd: 16, zIndex: 20 }}>
        <button type="button" onClick={() => hasArabic && setLang((l) => (l === "en" ? "ar" : "en"))} aria-label={hasArabic ? "Toggle language" : "Language"} style={langChipStyle(!!hasArabic, P)}>
          <span aria-hidden style={{ fontSize: 15, opacity: 0.7 }}>🌐</span>
          <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{lang === "en" ? "EN" : "ع"}</span>
        </button>
      </div>

      <button type="button" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation animation" style={skipStyle(P)}>
        Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
      </button>

      <div className="ir2-scene">
        {/* styled flatlay props scattered on the table */}
        <svg className="ir2-table-prop tp1" viewBox="0 0 220 262" style={{ color: "var(--liner-mid)" }} aria-hidden><use href="#ir2-sprig" width="220" height="262" /></svg>
        <svg className="ir2-table-prop tp2" viewBox="0 0 60 90" style={{ color: "var(--liner-deep)" }} aria-hidden><use href="#ir2-babysbreath" width="60" height="90" /></svg>
        <svg className="ir2-table-prop tp3" viewBox="0 0 220 262" style={{ color: "var(--liner-deep)" }} aria-hidden><use href="#ir2-sprig" width="220" height="262" /></svg>
        <svg className="ir2-table-prop tp4" viewBox="0 0 60 90" style={{ color: "var(--liner-mid)" }} aria-hidden><use href="#ir2-babysbreath" width="60" height="90" /></svg>

        <div className="ir2-env-wrap">
          <div className="ir2-floaty">
            <div className="ir2-bloom" aria-hidden />
            <div className="ir2-contact" aria-hidden />

            <div
              className="ir2-envelope"
              role="button" tabIndex={0}
              aria-label="Tap to open your invitation"
              onClick={openSeal}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSeal(); } }}
            >
              <div className="ir2-liner">
                <svg viewBox="0 0 200 104" preserveAspectRatio="xMidYMax slice" style={{ color: "var(--liner-deep)" }} aria-hidden>
                  <use href="#ir2-sprig" width="220" height="262" transform="translate(-26 6) scale(.6)" />
                  <use href="#ir2-sprig" width="220" height="262" transform="translate(214 8) scale(-.56,.56)" />
                </svg>
              </div>

              <div className="ir2-card-vellum-wrap">
                <div className="ir2-card-vellum ir2-deckle" aria-hidden />
              </div>

              <div className="ir2-card-wrap">
                <div className="ir2-card ir2-deckle">
                  <div className="ir2-card-inner">
                    <div className="ir2-card-frame" />
                    <div className="ir2-card-frame-inner" />
                    <svg className="ir2-c-wreath" viewBox="0 0 300 300" style={{ color: "var(--liner-mid)" }} aria-hidden><use href="#ir2-wreath" width="300" height="300" /></svg>
                    <svg className="ir2-flourish-corner tl" viewBox="0 0 90 90" style={{ color: "var(--gold)" }} aria-hidden><use href="#ir2-flourish-corner" width="90" height="90" /></svg>
                    <svg className="ir2-flourish-corner tr" viewBox="0 0 90 90" style={{ color: "var(--gold)" }} aria-hidden><use href="#ir2-flourish-corner" width="90" height="90" /></svg>
                    <svg className="ir2-flourish-corner bl" viewBox="0 0 90 90" style={{ color: "var(--gold)" }} aria-hidden><use href="#ir2-flourish-corner" width="90" height="90" /></svg>
                    <svg className="ir2-flourish-corner br" viewBox="0 0 90 90" style={{ color: "var(--gold)" }} aria-hidden><use href="#ir2-flourish-corner" width="90" height="90" /></svg>

                    <div className="ir2-card-content">
                      <div className="ir2-fl-row">
                        <span className="ir2-fl-line" />
                        <div className="ir2-c-eyebrow">{guestName ? (isRTL ? `مرحباً ${guestName}` : `Welcome, ${guestName}`) : copy.eyebrow}</div>
                        <span className="ir2-fl-line" />
                      </div>
                      <div className="ir2-c-names">{displayTitle}</div>
                      <svg className="ir2-c-divider" viewBox="0 0 220 24" aria-hidden>
                        <use href="#ir2-flourish-divider" width="220" height="24" style={{ color: "var(--gold)" }} />
                        <use href="#ir2-leaf" width="13" height="17" x="78" y="0" transform="rotate(96 84.5 8.5)" style={{ color: "var(--liner-mid)" }} opacity=".85" />
                        <use href="#ir2-leaf" width="13" height="17" x="129" y="0" transform="rotate(-96 135.5 8.5)" style={{ color: "var(--liner-mid)" }} opacity=".85" />
                      </svg>
                      {dateStr && <div className="ir2-c-date">{dateStr}</div>}
                      <div className="ir2-c-extra">
                        {locationStr && <div className="ir2-c-venue">{locationStr}</div>}
                        <button type="button" className="ir2-c-btn" onClick={finish}>{copy.details}</button>
                      </div>
                    </div>
                    <div className="ir2-card-foil" aria-hidden />
                  </div>
                </div>
              </div>

              <div className="ir2-body ir2-paper-tex" />

              <svg className="ir2-flourish-corner env bl" viewBox="0 0 90 90" style={{ color: "var(--gold)" }} aria-hidden><use href="#ir2-flourish-corner" width="90" height="90" /></svg>
              <svg className="ir2-flourish-corner env br" viewBox="0 0 90 90" style={{ color: "var(--gold)" }} aria-hidden><use href="#ir2-flourish-corner" width="90" height="90" /></svg>

              <div className="ir2-stamp">
                <svg viewBox="0 0 60 74" aria-hidden>
                  <rect x="1" y="1" width="58" height="72" rx="2" style={{ fill: "var(--card-hi)", stroke: "var(--paper-lo)" }} strokeWidth="2.2" strokeDasharray="1.6 2.2" />
                  <rect x="5" y="5" width="50" height="64" rx="1" style={{ fill: "var(--stamp)" }} opacity=".94" />
                  <use href="#ir2-sprig" width="220" height="262" transform="translate(9 6) scale(.19)" style={{ color: "#eef4ea" }} />
                  <circle cx="45" cy="19" r="10" fill="none" stroke="#eef4ea" strokeWidth="1" opacity=".5" />
                  <text x="30" y="66" textAnchor="middle" fontFamily="var(--font-serif)" fontSize="6.5" fill="#eef4ea" opacity=".85" letterSpacing="1">FOREVER</text>
                </svg>
              </div>

              <div className="ir2-addr">
                <div className="ir2-addr-hi">{guestName || copy.eyebrow}</div>
                <div className="ir2-addr-to">{displayTitle}</div>
              </div>

              <div className="ir2-flap-shadow" />
              <div className="ir2-flap">
                <div className="ir2-flap-face front ir2-paper-tex" />
                <div className="ir2-flap-face back" />
              </div>

              <div className="ir2-ribbon-band" />
              <svg className="ir2-bow" viewBox="0 0 100 70" style={{ color: "var(--ribbon)" }} aria-hidden><use href="#ir2-bow" width="100" height="70" /></svg>

              <div className="ir2-seal">
                <svg viewBox="0 0 100 100" aria-hidden>
                  <path d="M50 3 C61 3 63 12 72 15 C83 18 84 30 89 38 C95 47 90 56 91 66 C92 78 82 80 74 87 C65 94 57 90 50 92 C42 90 34 95 26 87 C17 79 9 79 9 66 C9 55 5 47 11 38 C16 30 17 18 28 15 C37 12 39 3 50 3 Z" fill="url(#ir2-waxg)" />
                  <ellipse cx="40" cy="34" rx="16" ry="11" fill="#fff" opacity=".14" />
                  <circle cx="50" cy="50" r="34" fill="none" style={{ stroke: "var(--wax-lo)" }} strokeWidth="1.2" opacity=".5" />
                  <circle cx="50" cy="50" r="38" fill="none" style={{ stroke: "var(--wax-hi)" }} strokeWidth="1" opacity=".38" />
                  <use href="#ir2-leaf-mono" width="9" height="12" transform="translate(29 63) rotate(198) scale(.82)" style={{ color: "var(--wax-lo)" }} opacity=".5" />
                  <use href="#ir2-leaf-mono" width="9" height="12" transform="translate(26 55) rotate(213) scale(.78)" style={{ color: "var(--wax-lo)" }} opacity=".55" />
                  <use href="#ir2-leaf-mono" width="9" height="12" transform="translate(26 47) rotate(228) scale(.73)" style={{ color: "var(--wax-lo)" }} opacity=".58" />
                  <use href="#ir2-leaf-mono" width="9" height="12" transform="translate(29 40) rotate(243) scale(.68)" style={{ color: "var(--wax-lo)" }} opacity=".6" />
                  <use href="#ir2-leaf-mono" width="9" height="12" transform="translate(71 63) rotate(-18) scale(.82)" style={{ color: "var(--wax-lo)" }} opacity=".5" />
                  <use href="#ir2-leaf-mono" width="9" height="12" transform="translate(74 55) rotate(-33) scale(.78)" style={{ color: "var(--wax-lo)" }} opacity=".55" />
                  <use href="#ir2-leaf-mono" width="9" height="12" transform="translate(74 47) rotate(-48) scale(.73)" style={{ color: "var(--wax-lo)" }} opacity=".58" />
                  <use href="#ir2-leaf-mono" width="9" height="12" transform="translate(71 40) rotate(-63) scale(.68)" style={{ color: "var(--wax-lo)" }} opacity=".6" />
                  <text x="50" y="53" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-serif)" fontSize={sealFontSize} style={{ fill: "var(--wax-lo)" }} opacity=".82" letterSpacing="1">{sealText}</text>
                  <text x="49" y="52" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-serif)" fontSize={sealFontSize} style={{ fill: "var(--wax-hi)" }} opacity=".42" letterSpacing="1">{sealText}</text>
                </svg>
                <div className="ir2-seal-sheen" />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {stage === "rest" && (
              <motion.div
                key="prompt"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.3 } }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="ir2-prompt"
              >
                <div className="ir2-prompt-pill"><span aria-hidden style={{ fontSize: 12 }}>✦</span> {copy.tap}</div>
                <p className="ir2-prompt-sub">{copy.special}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── shared styles ─── */
const overlayBase = {
  position: "fixed", inset: 0, zIndex: 1000, overflow: "hidden",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  fontFamily: "var(--font-sans)",
  padding: "max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))",
};
const skipStyle = (P) => ({
  position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineStart: 20, zIndex: 20,
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", minHeight: 44, borderRadius: 999,
  border: `1px solid ${alpha(P.gold, 0.4)}`, background: "rgba(255,255,255,.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  color: P.ink, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "var(--font-sans)",
});
const langChipStyle = (active, P) => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", minHeight: 44, borderRadius: 999,
  border: `1px solid ${alpha(P.gold, 0.35)}`, background: "rgba(255,255,255,.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  color: P.ink, fontSize: 13, fontFamily: "var(--font-sans)", cursor: active ? "pointer" : "default",
});

const REVEAL_CSS = `
.ir2-root{
  position:fixed; inset:0; overflow:hidden;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  font-family:var(--font-sans);
  background:
    radial-gradient(120% 100% at 50% -6%, var(--wood-hi), transparent 55%),
    linear-gradient(180deg, var(--wood-hi), var(--wood) 46%, var(--wood-lo));
}
.ir2-grain{ position:absolute; inset:0; pointer-events:none; opacity:.5; mix-blend-mode:multiply;
  background-image:var(--ir-wood-noise); background-size:560px 100%; }
.ir2-daylight{ position:absolute; inset:0; pointer-events:none; mix-blend-mode:screen; opacity:.6;
  background:radial-gradient(60% 45% at 32% 14%, rgba(255,250,235,.75), transparent 60%); }
.ir2-vignette{ position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(88% 74% at 50% 48%, transparent 58%, rgba(70,50,26,.17)); }
.ir2-grade{ position:absolute; inset:0; pointer-events:none; mix-blend-mode:soft-light; opacity:.55;
  background:linear-gradient(133deg, rgba(255,246,218,.55) 0%, transparent 38%, transparent 64%, rgba(36,46,66,.2) 100%); }

.ir2-fl-row{ display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:.55em; }
.ir2-fl-line{ position:relative; width:26px; height:1px; background:var(--gold); opacity:.6; }
.ir2-fl-line::after{ content:""; position:absolute; top:50%; width:4px; height:4px; background:var(--gold);
  transform:translateY(-50%) rotate(45deg); opacity:.9; }
.ir2-fl-row .ir2-fl-line:first-child::after{ right:-2px; }
.ir2-fl-row .ir2-fl-line:last-child::after{ left:-2px; }

.ir2-scene{ position:relative; z-index:3; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; }

.ir2-table-prop{ position:absolute; height:auto; pointer-events:none; z-index:2; opacity:.8;
  filter:blur(1.6px); transition:opacity .7s ease; }
.ir2-table-prop.tp1{ width:min(32vw,230px); left:1%; bottom:6%; transform:rotate(-27deg); }
.ir2-table-prop.tp2{ width:min(11vw,84px); left:15%; bottom:24%; transform:rotate(18deg); opacity:.72; }
.ir2-table-prop.tp3{ width:min(27vw,196px); right:-2%; top:6%; transform:rotate(158deg) scaleX(-1); }
.ir2-table-prop.tp4{ width:min(9vw,66px); right:16%; top:22%; transform:rotate(-30deg); opacity:.68; }
.ir2-root.ir2-grow .ir2-table-prop{ opacity:0; }

.ir2-env-wrap{ position:relative; z-index:3; perspective:1900px; transform:translate(-3%,-1%);
  /* width is capped by both viewport width AND height so a short/landscape
     phone never forces the envelope + prompt to overflow top-to-bottom;
     the plain min() is a fallback for browsers without dvh support. */
  width:min(88vw,486px);
  width:min(88vw,486px,calc(56dvh * 1.52));
}
.ir2-floaty{ position:relative; transform-style:preserve-3d; animation:ir2Floaty 8s ease-in-out infinite; }
@keyframes ir2Floaty{ 0%,100%{ transform:translateY(0) rotateX(3deg) rotateZ(-.3deg); } 50%{ transform:translateY(-7px) rotateX(6deg) rotateZ(.3deg); } }
.ir2-root.ir2-opening .ir2-floaty{ animation-play-state:paused; }

.ir2-bloom{ position:absolute; left:50%; top:44%; width:120%; aspect-ratio:1; transform:translate(-50%,-50%); z-index:0; pointer-events:none;
  background:radial-gradient(circle, color-mix(in srgb,var(--card-hi) 90%, #fff) 0%, transparent 58%); filter:blur(10px); opacity:0; transition:opacity 1s ease; }
.ir2-root.ir2-rise .ir2-bloom, .ir2-root.ir2-grow .ir2-bloom{ opacity:.9; }

.ir2-envelope{ position:relative; width:100%; aspect-ratio:1.52/1; transform-style:preserve-3d;
  transition:transform 1.35s cubic-bezier(.16,1,.3,1), opacity 1s ease;
  opacity:0; transform:translateY(24px) rotate(-7deg) scale(.93); cursor:pointer; }
.ir2-root.ir2-settled .ir2-envelope{ opacity:1; transform:translateY(0) rotate(-4deg) scale(1); }
.ir2-root.ir2-rest .ir2-envelope{ transform:translateY(0) rotate(0deg) scale(1); }
.ir2-root.ir2-lift .ir2-envelope{ transform:translateY(8px) rotate(0deg) scale(.975); }

.ir2-contact{ position:absolute; left:4%; right:4%; bottom:-9%; height:22%; z-index:-1;
  background:radial-gradient(58% 100% at 50% 38%, rgba(74,52,26,.42), transparent 72%); filter:blur(16px);
  transition:opacity .9s ease, transform 1.2s ease; }
.ir2-root.ir2-opening .ir2-contact{ opacity:.7; transform:scaleX(1.05); }

.ir2-paper-tex{ background-color:var(--paper);
  background-image:var(--ir-paper-noise), linear-gradient(150deg,var(--paper-hi),var(--paper) 52%,var(--paper-lo));
  background-blend-mode:multiply,normal; background-size:130px 130px, cover; }

.ir2-body{ position:absolute; inset:0; border-radius:8px; z-index:2;
  box-shadow:0 24px 50px -22px rgba(60,44,22,.5), inset 0 1px 0 rgba(255,255,255,.5), inset 0 0 40px rgba(90,70,40,.07);
  transition:filter .9s ease; }
.ir2-body::before{ content:""; position:absolute; inset:0; border-radius:8px; pointer-events:none;
  background:radial-gradient(72% 62% at 28% 20%, rgba(255,255,255,.5), transparent 60%); }
.ir2-root.ir2-rise .ir2-body, .ir2-root.ir2-grow .ir2-body{ filter:blur(2.4px); }

.ir2-flourish-corner{ position:absolute; width:16%; height:auto; pointer-events:none; }
.ir2-flourish-corner.env{ width:12%; z-index:4; opacity:.4; transition:opacity .4s ease; }
.ir2-flourish-corner.env.bl{ bottom:5%; left:5.5%; transform:scaleY(-1); }
.ir2-flourish-corner.env.br{ bottom:5%; right:5.5%; transform:scale(-1,-1); }
.ir2-root.ir2-opening .ir2-flourish-corner.env{ opacity:0; }

.ir2-ribbon-band{ position:absolute; left:50%; top:2%; bottom:2%; width:9%; transform:translateX(-50%); z-index:7;
  background:linear-gradient(90deg, var(--ribbon-dk), var(--ribbon) 30%, var(--ribbon) 70%, var(--ribbon-dk));
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.08), 0 3px 8px rgba(40,30,16,.25);
  transition:opacity .5s ease, transform .7s cubic-bezier(.4,0,.2,1); }
.ir2-root.ir2-opening .ir2-ribbon-band{ opacity:0; transform:translateX(-50%) scaleY(.7); }
.ir2-bow{ position:absolute; left:50%; top:47%; width:32%; aspect-ratio:100/70; transform:translate(-50%,-50%); z-index:8;
  transition:transform .8s cubic-bezier(.5,0,.2,1), opacity .7s ease;
  filter:drop-shadow(0 5px 9px rgba(60,34,14,.4)); }
.ir2-root.ir2-pressing .ir2-bow{ transform:translate(-50%,-50%) scale(.95); }
.ir2-root.ir2-opening .ir2-bow{ transform:translate(-50%,-94%) scale(.55) rotate(11deg); opacity:0; }

.ir2-deckle{ clip-path:polygon(
    0% 1%, 16% 0.3%, 34% 1%, 52% 0.2%, 70% 0.9%, 86% 0.2%, 100% 1%,
    99.3% 18%, 100% 38%, 99.4% 58%, 100% 78%, 99.3% 93%, 100% 99%,
    84% 99.3%, 66% 100%, 48% 99.2%, 30% 100%, 14% 99.4%, 0% 99%,
    0.5% 82%, 0% 62%, 0.6% 42%, 0% 24%, 0.5% 10%, 0% 3%); }

/* ── card emergence: a synced clip-path + tilt "slides out from under the
   flap" instead of a fade, so it reads as a physical object being drawn out
   rather than materialising mid-air. Each phase (rise, then grow) completes
   its own transition fully before the next begins — no mid-flight retarget. */
.ir2-card-vellum-wrap{ position:absolute; left:8%; right:8%; top:7%; bottom:7%; z-index:1;
  transform-origin:center center; opacity:0;
  transform:translateY(2%) scale(.98) rotateX(-12deg);
  clip-path:inset(0 0 100% 0); }
.ir2-root.ir2-rise .ir2-card-vellum-wrap{ opacity:.85; clip-path:inset(0 0 0% 0);
  transform:translateY(-66%) translate(10px,7px) scale(1) rotateX(0deg);
  transition:transform 1.6s cubic-bezier(.16,1,.3,1) .05s, clip-path 1.6s cubic-bezier(.16,1,.3,1) .05s, opacity .3s ease .05s; }
.ir2-root.ir2-grow .ir2-card-vellum-wrap{ opacity:.85; clip-path:inset(0 0 0% 0); filter:blur(.8px);
  transform:translateY(-66%) translate(17px,13px) scale(1.82) rotateX(0deg);
  transition:transform 1.1s cubic-bezier(.16,1,.3,1) .05s, opacity .3s ease, filter .9s ease; }
.ir2-card-vellum{ position:absolute; inset:0; border-radius:5px; overflow:hidden;
  background:color-mix(in srgb, var(--card) 55%, transparent);
  box-shadow:0 18px 40px -20px rgba(60,44,22,.4), inset 0 0 0 1px color-mix(in srgb, var(--card-edge) 70%, transparent); }

.ir2-card-wrap{ position:absolute; left:8%; right:8%; top:7%; bottom:7%; z-index:1;
  transform-origin:center center;
  transform:translateY(2%) scale(.98) rotateX(-12deg);
  clip-path:inset(0 0 100% 0); }
.ir2-root.ir2-rise .ir2-card-wrap{ z-index:8; clip-path:inset(0 0 0% 0);
  transform:translateY(-66%) scale(1) rotateX(0deg);
  transition:transform 1.6s cubic-bezier(.16,1,.3,1), clip-path 1.6s cubic-bezier(.16,1,.3,1), z-index 0s linear .2s; }
.ir2-root.ir2-grow .ir2-card-wrap{ z-index:8; clip-path:inset(0 0 0% 0);
  transform:translateY(-66%) scale(1.82) rotateX(0deg);
  transition:transform 1.1s cubic-bezier(.16,1,.3,1); }
.ir2-card{ position:absolute; inset:0; border-radius:5px; overflow:hidden; background:var(--card);
  box-shadow:0 22px 46px -20px rgba(60,44,22,.55), inset 0 0 0 1px var(--card-edge); }

.ir2-card-inner{ position:absolute; inset:0;
  background:radial-gradient(125% 96% at 50% 0%, var(--card-hi), var(--card) 76%); }
.ir2-card-frame{ position:absolute; inset:6.4%; border:1px solid color-mix(in srgb,var(--gold) 50%, transparent); border-radius:2px; pointer-events:none; z-index:0; }
.ir2-card-frame-inner{ position:absolute; inset:8.6%; border:1px solid color-mix(in srgb,var(--gold) 26%, transparent); border-radius:1px; pointer-events:none; z-index:0; }
.ir2-c-wreath{ position:absolute; inset:9%; z-index:1; pointer-events:none; }
.ir2-card .ir2-flourish-corner{ width:15%; opacity:.95; z-index:3; }
.ir2-card .ir2-flourish-corner.tl{ top:6%; left:6%; }
.ir2-card .ir2-flourish-corner.tr{ top:6%; right:6%; transform:scaleX(-1); }
.ir2-card .ir2-flourish-corner.bl{ bottom:6%; left:6%; transform:scaleY(-1); }
.ir2-card .ir2-flourish-corner.br{ bottom:6%; right:6%; transform:scale(-1,-1); }

.ir2-card-content{ position:relative; z-index:2; width:100%; height:100%; padding:10% 11%;
  display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
.ir2-c-names{ font-family:var(--font-serif), Georgia, serif; color:var(--ink); font-weight:500; font-size:clamp(13px,3.4vw,18px); margin:0 0 .5em; letter-spacing:.07em; word-break:break-word; }
.ir2-c-divider{ display:block; width:150px; max-width:58%; height:16px; margin:0 auto .8em; }
.ir2-c-date{ font-size:9px; letter-spacing:.24em; text-transform:uppercase; color:var(--ink-soft); line-height:1.85; }
.ir2-c-extra{ max-height:0; opacity:0; overflow:hidden; transition:max-height .8s ease, opacity .5s ease .2s; }
.ir2-root.ir2-grow .ir2-c-extra{ max-height:130px; opacity:1; }
.ir2-c-venue{ font-size:8px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-soft); line-height:2; margin-top:1em; }
.ir2-c-btn{ appearance:none; font-family:var(--font-sans); display:inline-block; margin-top:1em; padding:9px 22px; border:1px solid var(--accent); background:transparent; color:var(--accent);
  font-size:9px; letter-spacing:.24em; text-transform:uppercase; font-weight:700; border-radius:2px; cursor:pointer; }
.ir2-c-eyebrow{ font-family:var(--font-serif), Georgia, serif; font-size:clamp(15px,4vw,22px); color:var(--ink); letter-spacing:.03em; }

.ir2-card-foil{ position:absolute; inset:0; z-index:4; pointer-events:none; mix-blend-mode:overlay; opacity:.6;
  background:linear-gradient(115deg, transparent 34%, rgba(255,255,255,.95) 48%, transparent 62%);
  background-size:280% 280%; background-position:-50% -50%;
  transition:background-position 1.6s ease .15s; }
.ir2-root.ir2-grow .ir2-card-foil{ background-position:150% 150%; }

.ir2-liner{ position:absolute; left:2%; right:2%; top:1.5%; height:52%; z-index:1; border-radius:8px 8px 0 0; overflow:hidden;
  opacity:0; transition:opacity .6s ease .1s, filter .9s ease;
  background:linear-gradient(180deg, color-mix(in srgb,var(--liner-lite) 46%, var(--card)), var(--card)); }
.ir2-root.ir2-opening .ir2-liner{ opacity:1; }
.ir2-root.ir2-rise .ir2-liner, .ir2-root.ir2-grow .ir2-liner{ filter:blur(2.4px); }
.ir2-liner svg{ position:absolute; inset:0; width:100%; height:100%; }

.ir2-flap{ position:absolute; left:0; right:0; top:0; height:52%; z-index:6; transform-origin:50% 0%;
  transform-style:preserve-3d; transform:rotateX(0deg); transition:transform 1.25s cubic-bezier(.62,-0.02,.2,1), z-index 0s linear .55s; }
.ir2-root.ir2-opening .ir2-flap{ transform:rotateX(-170deg); z-index:0; }
.ir2-flap-face{ position:absolute; inset:0; clip-path:polygon(0 0,100% 0,50% 100%); backface-visibility:hidden;
  border-radius:8px 8px 0 0; box-shadow:0 5px 12px rgba(60,44,22,.24); }
.ir2-flap-face.front::after{ content:""; position:absolute; inset:0; clip-path:polygon(0 0,100% 0,50% 100%);
  background:linear-gradient(180deg, rgba(255,255,255,.28), transparent 46%); }
.ir2-flap-face.back{ transform:rotateX(180deg); background:linear-gradient(180deg, color-mix(in srgb,var(--liner-lite) 48%, var(--card)), var(--card)); }
.ir2-flap-shadow{ position:absolute; left:0; right:0; top:0; height:52%; z-index:5; pointer-events:none;
  background:linear-gradient(180deg, rgba(60,44,22,.12), transparent 80%); clip-path:polygon(0 0,100% 0,50% 100%);
  opacity:1; transition:opacity .5s ease; }
.ir2-root.ir2-opening .ir2-flap-shadow{ opacity:0; }

.ir2-seal{ position:absolute; left:50%; top:47%; width:20%; aspect-ratio:1; transform:translate(-50%,-50%); z-index:9;
  transition:transform .8s cubic-bezier(.5,0,.2,1), opacity .7s ease; filter:drop-shadow(0 7px 11px rgba(60,34,14,.5)); }
.ir2-root.ir2-pressing .ir2-seal{ transform:translate(-50%,-50%) scale(.94); }
.ir2-root.ir2-opening .ir2-seal{ transform:translate(-50%,-98%) scale(.6) rotate(-8deg); opacity:0; }
.ir2-seal svg{ position:absolute; inset:0; width:100%; height:100%; display:block; }
.ir2-seal-sheen{ position:absolute; inset:6%; border-radius:50%; overflow:hidden; pointer-events:none; }
.ir2-seal-sheen::before{ content:""; position:absolute; inset:-40%;
  background:linear-gradient(116deg, transparent 42%, rgba(255,255,255,.5) 50%, transparent 58%);
  transform:translateX(-60%); animation:ir2Sheen 5s ease-in-out infinite; }
@keyframes ir2Sheen{ 0%,72%{ transform:translateX(-60%) } 86%{ transform:translateX(60%) } 100%{ transform:translateX(60%) } }
.ir2-root.ir2-opening .ir2-seal-sheen::before{ animation-play-state:paused; }

.ir2-stamp{ position:absolute; top:9%; right:9%; width:15%; z-index:4; transform:rotate(4deg); transition:opacity .5s ease; }
.ir2-root.ir2-opening .ir2-stamp{ opacity:0; }
.ir2-stamp svg{ width:100%; height:auto; display:block; filter:drop-shadow(0 2px 3px rgba(60,44,22,.28)); }

.ir2-addr{ position:absolute; left:12%; top:60%; z-index:4; text-align:start; line-height:1.05; transition:opacity .45s ease; }
.ir2-root.ir2-opening .ir2-addr{ opacity:0; }
.ir2-addr-hi{ font-family:var(--font-script), cursive; font-size:clamp(22px,6vw,32px); color:var(--ink); }
.ir2-addr-to{ font-family:var(--font-serif), Georgia, serif; font-size:clamp(11px,3vw,14px); color:var(--ink-soft); letter-spacing:.04em; margin-top:1px; }
.ir2-root[dir="rtl"] .ir2-addr-hi{ font-family:var(--font-arabic-display), var(--font-serif), serif; }
.ir2-root[dir="rtl"] .ir2-c-names{ font-family:var(--font-arabic-display), var(--font-serif), serif; }

.ir2-prompt{ position:relative; z-index:12; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center;
  margin-top:clamp(16px,4vh,30px);
  margin-top:clamp(16px,4dvh,30px);
  padding:0 24px; }
.ir2-prompt-pill{ display:inline-flex; align-items:center; gap:8px; padding:9px 18px; border-radius:999px;
  background:rgba(255,255,255,.6); border:1px solid color-mix(in srgb,var(--accent) 36%, transparent);
  -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);
  font-family:var(--font-sans); font-size:10px; font-weight:700; letter-spacing:.2em; text-transform:uppercase; color:var(--accent); animation:ir2Nudge 2.4s ease-in-out infinite; }
@keyframes ir2Nudge{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-4px) } }
.ir2-prompt-sub{ font-family:var(--font-serif), Georgia, serif; font-style:italic; font-size:13px; color:var(--ink-soft); margin:10px 0 0; }

@media (max-width:640px){
  /* the desktop-tuned 1.82x close-up bleeds a lot of the decorative frame
     off-screen on phone-width viewports; a slightly gentler zoom keeps the
     card's edge intentionally near the frame instead of aggressively clipped. */
  .ir2-root.ir2-grow .ir2-card-wrap{ transform:translateY(-66%) scale(1.6) rotateX(0deg); }
  .ir2-root.ir2-grow .ir2-card-vellum-wrap{ transform:translateY(-66%) translate(15px,11px) scale(1.6) rotateX(0deg); }
}

@media (prefers-reduced-motion:reduce){
  .ir2-floaty{ animation:none; }
  .ir2-prompt-pill{ animation:none; }
  .ir2-seal-sheen::before{ animation:none; }
  .ir2-envelope,.ir2-card-wrap,.ir2-card-vellum-wrap,.ir2-card-foil,.ir2-flap,.ir2-seal,.ir2-bow,.ir2-ribbon-band,.ir2-body,.ir2-liner{ transition-duration:.001ms !important; }
  .ir2-body,.ir2-liner,.ir2-card-vellum-wrap{ filter:none !important; }
}
`;
