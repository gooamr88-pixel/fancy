"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { lighten, darken, alpha, mix, luminance } from "../../utils/color";
import Icon from "../icons/Icon";

/* ═══════════════════════════════════════════════════════════════════════════
   InvitationReveal — "The Unsealing"

   ONE cinematic opening shared by both guest reveals:

     • mode="invitation"  first thing a guest sees on the event page /[slug].
     • mode="rsvp"        gates the RSVP route; seal personalised with the
                          guest's own name; per-session "seen" memory.

   Four botanical corner ornaments frame a circular tap-to-open seal — the
   seal shows the event's own cover photo when one exists, otherwise a
   generated monogram. Tap it: the corners swing away along their own
   diagonals and the seal gives way to a full wreathed reveal panel with the
   couple's names and details.

   Everything but the cover photo is generated — NO other image uploads.
   Every material (corner ornaments, seal, wreath) is tinted from the
   event's own custom_colors.

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

/* ─── Reveal palette derived from the event's own custom_colors ───
   Clamped to a legible mid-tone band so any organizer color reads as
   real gold/wax/foliage against the bright card stock, never washed out
   or muddy. The card stock itself stays a constant warm neutral — only
   the "product" (seal, corner ornaments, wreath) carries the brand. */
function buildRevealPalette(customColors) {
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
    card: "#fbf8ef", cardHi: "#fffefa", cardEdge: mix(gold, "#fbf8ef", 0.3),
    ink: mix(darken(accent, 0.5), "#2c2c20", 0.45), inkSoft: mix(accent, "#5c5c48", 0.55),
    wax: gold, waxHi: lighten(gold, 0.32), waxLo: darken(gold, 0.36),
    accent, gold, goldHi: lighten(gold, 0.26),
    linerLite: lighten(accent, 0.6), linerMid: accent, linerDeep: darken(accent, 0.32),
    bloom: mix(gold, "#fff8ea", 0.7),
  };
}

const STAGE_CLASSES = {
  preload: [],
  settled: ["ir2-settled"],
  rest: ["ir2-settled", "ir2-rest"],
  pressing: ["ir2-settled", "ir2-pressing"],
  opening: ["ir2-settled", "ir2-opening"],
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

  // Replaces the small in-place scene with a full-screen reveal rendered via
  // a portal — needed so it can cover the real viewport regardless of any
  // transforms on the closed-state tree. `closing` gives that portal its
  // own fade-out instead of popping instantly the moment this component
  // unmounts — see `finish` below for why that distinction matters.
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  // Lazy-initialized rather than set in an effect: `document` is undefined
  // during SSR (createPortal(..., document.body) would throw there) but
  // present on every client render, so this needs no effect to "become"
  // true after mount — it already is on the client's very first render.
  const [portalReady] = useState(() => typeof document !== "undefined");

  const P = useMemo(() => buildRevealPalette(event?.custom_colors), [event?.custom_colors]);
  const paletteVars = useMemo(() => ({
    "--card": P.card, "--card-hi": P.cardHi, "--card-edge": P.cardEdge,
    "--ink": P.ink, "--ink-soft": P.inkSoft,
    "--wax": P.wax, "--wax-hi": P.waxHi, "--wax-lo": P.waxLo,
    "--accent": P.accent, "--gold": P.gold, "--gold-hi": P.goldHi,
    "--liner-lite": P.linerLite, "--liner-mid": P.linerMid, "--liner-deep": P.linerDeep,
    "--bloom": P.bloom,
    // Scoped locally to this overlay only — NOT a change to the platform's
    // global --font-serif/--font-script (InvitationCard, HeroSection, etc.
    // keep whatever they already had). CSS custom properties only cascade
    // to descendants of the element they're set on, and this component's
    // root is never an ancestor of the rest of the guest page, so this is
    // scoping by construction, not by convention.
    "--font-serif": "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    "--font-script": "'Mrs Saint Delafield', cursive",
  }), [P]);

  // Loads the two reveal-only display faces once per mount. Same pattern
  // EventPageClient already uses for its own Google Font injection (a
  // plain <link> appended to <head> and removed on unmount) — not a new
  // convention.
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Mrs+Saint+Delafield&display=swap";
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch { /* already gone */ } };
  }, []);

  const td = event?.template_data || {};
  const hasArabic = !!(event?.title_ar || td.title_ar || isArabic(event?.title));
  const identity = useMemo(() => deriveIdentity(event, lang), [event, lang]);
  // A known guest (resolved from their personal link/token — private events,
  // or a public event's per-guest invite) is personalised via the reveal
  // panel's own welcome line — the seal itself is deliberately NOT
  // personalised: it always carries the couple/event's own monogram or
  // cover photo, the same for every guest, the way a real wax seal would.
  const sealText = identity.sealText;
  const sealFontSize = sealText.length <= 2 ? 28 : sealText.length <= 4 ? 21 : sealText.length <= 7 ? 15 : sealText.length <= 10 ? 11 : 9;
  const sealPhotoUrl = event?.cover_image_url || null;

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
    en: { eyebrow: "You are invited", tap: "Tap to open", special: "You are invited to our special day", enter: "View invitation", join: "request the honour of your presence", details: "View Details" },
    ar: { eyebrow: "أنت مدعو", tap: "اضغط للفتح", special: "أنت مدعوّ ليومنا المميّز", enter: "عرض الدعوة", join: "يشرّفنا حضوركم", details: "عرض التفاصيل" },
  }[lang];
  const isRTL = lang === "ar";
  const arTitle = event?.title_ar || td.title_ar;
  const displayTitle = isRTL && arTitle ? arTitle : identity.full;
  const dateStr = event?.event_date
    ? new Date(event.event_date).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "";
  const locationStr = event?.location_name || "";
  // Wedding/engagement-only etiquette note — this component is shared by
  // every template type (corporate, birthday, gala, custom…), so unlike
  // the wedding InvitationCard pattern this can't just always show it. Also
  // organizer-controlled (dashboard "Adults-Only Notice" toggle, event.
  // no_kids_allowed) — off by default, matching EventPageClient's
  // buildInvitationCardData so both surfaces agree.
  const showNoKids = (event?.template_type === "wedding" || event?.template_type === "engagement") && !!event?.no_kids_allowed;
  const noKidsText = isRTL ? "دعوة خاصة بالكبار فقط" : "No Kids Allowed";

  const noiseVars = useMemo(() => ({
    "--ir-paper-noise": "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/></filter><rect width='140' height='140' filter='url(%23p)'/></svg>\")",
  }), []);

  /* ─── Sequence control ─── */
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const after = useCallback((ms, fn) => { timers.current.push(setTimeout(fn, ms)); }, []);
  // The exit fade below on .ir2-root (framer-motion's own exit={{...}}) only
  // covers this component's main tree — the full-screen reveal is rendered
  // through a portal into document.body, a separate DOM subtree that
  // AnimatePresence knows nothing about and that has no exit animation of
  // its own. Without this, calling onComplete() straight away would remove
  // the whole component (portal included) the instant .ir2-root's own 0.8s
  // fade finishes, popping the full-screen reveal out instantly instead of
  // fading with it. EXIT_MS matches that 0.8s so both halves finish together.
  const EXIT_MS = 800;
  const finish = useCallback(() => {
    if (finishedRef.current || closing) return;
    // Only the full-screen expand panel needs a closing fade to wait for —
    // if it was never shown (Skip pressed before the seal was tapped) there's
    // nothing to sync with, and reduced-motion users in particular should
    // never get an artificial wait added on top of choosing less motion.
    if (!expanded) {
      finishedRef.current = true;
      markSeen();
      onComplete && onComplete();
      return;
    }
    setClosing(true);
    clearTimers();
    after(EXIT_MS, () => {
      finishedRef.current = true;
      markSeen();
      onComplete && onComplete();
    });
  }, [closing, expanded, after, clearTimers, markSeen, onComplete]);

  const openSeal = useCallback(() => {
    if (startedRef.current || finishedRef.current) return;
    startedRef.current = true;
    clearTimers(); // cancel any still-pending intro timers (e.g. the resting-prompt timer)
    musicRef?.current?.play().catch((err) => console.error("Background music playback failed:", err));
    setStage("pressing");
    // A quick squeeze, then the corners swing away along their own
    // diagonals while the seal shrinks and fades. The expand panel begins
    // fading in before the corners have fully finished retreating so the
    // two beats read as one continuous motion instead of exit-then-enter.
    after(120, () => setStage("opening"));
    after(650, () => setExpanded(true));
    after(2400, finish); // a beat to admire the invitation before auto-dismissing
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
        style={{ ...overlayBase, ...paletteVars, background: `radial-gradient(120% 90% at 50% -6%, ${P.cardHi}, ${P.card} 62%)` }}
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
            {sealPhotoUrl ? (
              <img src={sealPhotoUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", boxShadow: `0 0 0 1px ${alpha(P.gold, 0.5)}` }} />
            ) : (
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <defs>
                  <radialGradient id="ir2rm-wax" cx="37%" cy="31%" r="78%">
                    <stop offset="0%" stopColor={P.waxHi} />
                    <stop offset="48%" stopColor={P.wax} />
                    <stop offset="100%" stopColor={P.waxLo} />
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="48" fill="url(#ir2rm-wax)" />
                <text x="50" y="53" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-serif)" fontSize={sealFontSize} fill={P.waxLo} opacity=".85" letterSpacing="1">{sealText}</text>
              </svg>
            )}
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

  // The full-screen reveal is a portal into document.body so it can cover
  // the real viewport regardless of any transforms on the closed-state
  // tree. `closing` (see `finish` above) gives it its own fade instead of
  // popping away the instant this component unmounts.
  const expandClassName = ["ir2-expand", expanded && !closing ? "ir2-expand-visible" : "", closing ? "ir2-expand-closing" : ""].filter(Boolean).join(" ");

  return (
    <>
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

          {/* the pre-open corner ornament: a curling vine with three petals
              and a bud, tucked into each corner of the seal scene — the
              approved reveal-mockup design, generated per-event from the
              palette above (never a fixed gold). */}
          <symbol id="ir2-corner-blossom" viewBox="0 0 92 92">
            <path d="M6 86 C 6 40, 40 6, 86 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <g fill="currentColor">
              <ellipse cx="18" cy="66" rx="9" ry="4" transform="rotate(-35 18 66)" />
              <ellipse cx="34" cy="46" rx="10" ry="4.4" transform="rotate(-45 34 46)" />
              <ellipse cx="54" cy="30" rx="9" ry="4" transform="rotate(-58 54 30)" />
              <circle cx="72" cy="16" r="7" />
              <circle cx="72" cy="16" r="2.6" style={{ fill: "var(--card)" }} />
            </g>
          </symbol>
        </defs>
      </svg>

      <div className="ir2-grain" aria-hidden />
      <div className="ir2-daylight" aria-hidden />
      <div className="ir2-vignette" aria-hidden />

      {/* language chip */}
      <div style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineEnd: 16, zIndex: 20 }}>
        <button type="button" className="ir2-langchip" onClick={() => hasArabic && setLang((l) => (l === "en" ? "ar" : "en"))} aria-label={hasArabic ? "Toggle language" : "Language"} style={langChipStyle(!!hasArabic, P)}>
          <Icon name="globe" size={14} strokeWidth={1.6} style={{ opacity: 0.7 }} />
          <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{lang === "en" ? "EN" : "ع"}</span>
        </button>
      </div>

      <button type="button" className="ir2-skip" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation animation" style={skipStyle(P)}>
        Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
      </button>

      <div className="ir2-scene">
        <div className="ir2-seal-stage">
          <div className="ir2-corner tl"><svg viewBox="0 0 92 92" aria-hidden><use href="#ir2-corner-blossom" width="92" height="92" /></svg></div>
          <div className="ir2-corner tr"><svg viewBox="0 0 92 92" aria-hidden><use href="#ir2-corner-blossom" width="92" height="92" /></svg></div>
          <div className="ir2-corner bl"><svg viewBox="0 0 92 92" aria-hidden><use href="#ir2-corner-blossom" width="92" height="92" /></svg></div>
          <div className="ir2-corner br"><svg viewBox="0 0 92 92" aria-hidden><use href="#ir2-corner-blossom" width="92" height="92" /></svg></div>

          <button
            type="button"
            className="ir2-seal-btn"
            onClick={openSeal}
            aria-label="Tap to open your invitation"
          >
            <span className="ir2-seal-ring" aria-hidden="true" />
            <span className="ir2-seal-face" aria-hidden="true">
              {sealPhotoUrl ? (
                <img src={sealPhotoUrl} alt="" className="ir2-seal-photo" />
              ) : (
                <svg viewBox="0 0 100 100" aria-hidden>
                  <circle cx="50" cy="50" r="50" fill="url(#ir2-waxg)" />
                  <ellipse cx="40" cy="34" rx="16" ry="11" fill="#fff" opacity=".14" />
                  <text x="50" y="53" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-serif)" fontSize={sealFontSize} style={{ fill: "var(--wax-lo)" }} opacity=".85" letterSpacing="1">{sealText}</text>
                </svg>
              )}
            </span>
          </button>

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
    {portalReady && createPortal(
      <div className={expandClassName} dir={isRTL ? "rtl" : "ltr"} style={{ ...paletteVars, ...noiseVars }} aria-hidden={!expanded}>
        <div className="ir2-expand-sheet ir2-deckle">
          <div className="ir2-expand-grain" />
          <svg className="ir2-e-wreath" viewBox="0 0 300 300" aria-hidden><use href="#ir2-wreath" width="300" height="300" /></svg>
          <svg className="ir2-e-corner tl" viewBox="0 0 90 90" aria-hidden><use href="#ir2-flourish-corner" width="90" height="90" /></svg>
          <svg className="ir2-e-corner tr" viewBox="0 0 90 90" aria-hidden><use href="#ir2-flourish-corner" width="90" height="90" /></svg>
          <svg className="ir2-e-corner bl" viewBox="0 0 90 90" aria-hidden><use href="#ir2-flourish-corner" width="90" height="90" /></svg>
          <svg className="ir2-e-corner br" viewBox="0 0 90 90" aria-hidden><use href="#ir2-flourish-corner" width="90" height="90" /></svg>

          <div className="ir2-expand-inner">
            <div className="ir2-e-mono" aria-hidden>{sealText}</div>
            <p className="ir2-e-eyebrow">{guestName ? (isRTL ? `مرحباً ${guestName}` : `Welcome, ${guestName}`) : copy.eyebrow}</p>
            <h1 className="ir2-e-names">{displayTitle}</h1>
            <div className="ir2-e-hairline" />
            <div className="ir2-e-details">
              {dateStr && <div className="ir2-e-detail"><span>{isRTL ? "التاريخ" : "Date"}</span><b>{dateStr}</b></div>}
              {locationStr && <div className="ir2-e-detail"><span>{isRTL ? "المكان" : "Venue"}</span><b>{locationStr}</b></div>}
              {showNoKids && <div className="ir2-e-detail"><span>{isRTL ? "ملاحظة" : "Note"}</span><b>{noKidsText}</b></div>}
            </div>
            <button type="button" className="ir2-e-cta" onClick={finish}>{copy.details}</button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
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
    radial-gradient(46% 38% at 38% 8%, rgba(255,252,240,.65) 0%, transparent 60%),
    radial-gradient(120% 90% at 50% -6%, var(--card-hi), var(--card) 62%);
}
.ir2-grain{ position:absolute; inset:0; pointer-events:none; opacity:.05; mix-blend-mode:multiply;
  background-image:var(--ir-paper-noise); background-size:130px 130px; }
.ir2-daylight{ position:absolute; inset:0; pointer-events:none; mix-blend-mode:screen; opacity:.5;
  background:radial-gradient(60% 45% at 32% 14%, rgba(255,250,235,.6), transparent 60%); }
.ir2-vignette{ position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(90% 76% at 50% 46%, transparent 55%, rgba(70,50,26,.1) 100%); }

.ir2-scene{ position:relative; z-index:3; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; }

.ir2-seal-stage{ position:relative; width:min(76vw,340px); aspect-ratio:1; display:flex; align-items:center; justify-content:center; }

.ir2-corner{ position:absolute; width:26%; height:26%; color:var(--gold); opacity:.85;
  transition:color .5s ease, opacity .9s cubic-bezier(.22,.61,.36,1), transform .9s cubic-bezier(.22,.61,.36,1); }
.ir2-corner svg{ width:100%; height:100%; display:block; }
.ir2-corner.tl{ top:0; left:0; }
.ir2-corner.tr{ top:0; right:0; transform:scaleX(-1); }
.ir2-corner.bl{ bottom:0; left:0; transform:scaleY(-1); }
.ir2-corner.br{ bottom:0; right:0; transform:scale(-1,-1); }

/* On open, each corner ornament slides all the way off along its own
   diagonal instead of just fading in place. */
.ir2-root.ir2-opening .ir2-corner{ opacity:0; }
.ir2-root.ir2-opening .ir2-corner.tl{ transform:translate(-70%,-70%) rotate(-18deg) scale(.6); }
.ir2-root.ir2-opening .ir2-corner.tr{ transform:scaleX(-1) translate(-70%,-70%) rotate(-18deg) scale(.6); }
.ir2-root.ir2-opening .ir2-corner.bl{ transform:scaleY(-1) translate(-70%,-70%) rotate(-18deg) scale(.6); }
.ir2-root.ir2-opening .ir2-corner.br{ transform:scale(-1,-1) translate(-70%,-70%) rotate(-18deg) scale(.6); }

.ir2-seal-btn{ width:38%; aspect-ratio:1; border-radius:50%; border:none; padding:0; cursor:pointer;
  position:relative; background:none; filter:drop-shadow(0 14px 26px rgba(40,26,8,.35));
  transition:transform .7s cubic-bezier(.34,1.56,.64,1), opacity .6s ease; }
.ir2-seal-ring{ position:absolute; inset:-9%; border-radius:50%; border:1.5px solid var(--gold); opacity:.55; }
.ir2-seal-face{ position:absolute; inset:0; border-radius:50%; display:block; overflow:hidden;
  box-shadow:inset 0 2px 4px rgba(255,255,255,.25); }
.ir2-seal-face svg{ width:100%; height:100%; display:block; }
.ir2-seal-photo{ width:100%; height:100%; object-fit:cover; display:block; }
.ir2-seal-btn:hover .ir2-seal-face{ filter:brightness(1.06); }
.ir2-seal-btn:active{ transform:scale(.96); }
.ir2-root.ir2-opening .ir2-seal-btn{ transform:scale(.5) translateY(-16%); opacity:0; pointer-events:none; }

.ir2-prompt{ position:relative; z-index:12; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center;
  margin-top:clamp(16px,4dvh,30px);
  padding:0 24px; }
.ir2-prompt-pill{ display:inline-flex; align-items:center; gap:8px; padding:9px 18px; border-radius:999px;
  background:rgba(255,255,255,.6); border:1px solid color-mix(in srgb,var(--accent) 36%, transparent);
  -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);
  font-family:var(--font-sans); font-size:10px; font-weight:700; letter-spacing:.2em; text-transform:uppercase; color:var(--accent); animation:ir2Nudge 2.4s ease-in-out infinite; }
@keyframes ir2Nudge{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-4px) } }
.ir2-prompt-sub{ font-family:var(--font-serif), Georgia, serif; font-style:italic; font-size:13px; color:var(--ink-soft); margin:10px 0 0; }

@media (prefers-reduced-motion:reduce){
  .ir2-prompt-pill{ animation:none; }
  .ir2-corner,.ir2-seal-btn{ transition-duration:.001ms !important; }
}

/* ═══════════════════════════════════════════════════════════════
   Full-screen expand panel — a generously large stationery sheet
   (deckle edge, corner flourishes, wreath) that fades/scales in once
   the seal has been tapped, rendered through a portal into
   document.body so it can cover the real viewport.
   ═══════════════════════════════════════════════════════════════ */
.ir2-expand{
  position:fixed; inset:0; z-index:1500;
  display:flex; align-items:center; justify-content:center;
  padding:5vh 5vw;
  opacity:0; pointer-events:none;
  transition:opacity .35s ease;
}
.ir2-expand.ir2-expand-visible{ opacity:1; pointer-events:auto; }
.ir2-expand.ir2-expand-closing{ opacity:0 !important; transition:opacity .8s ease; pointer-events:none; }

.ir2-deckle{ clip-path:polygon(
    0% 1%, 16% 0.3%, 34% 1%, 52% 0.2%, 70% 0.9%, 86% 0.2%, 100% 1%,
    99.3% 18%, 100% 38%, 99.4% 58%, 100% 78%, 99.3% 93%, 100% 99%,
    84% 99.3%, 66% 100%, 48% 99.2%, 30% 100%, 14% 99.4%, 0% 99%,
    0.5% 82%, 0% 62%, 0.6% 42%, 0% 24%, 0.5% 10%, 0% 3%); }

.ir2-expand-sheet{
  position:relative; width:min(94vw,920px); max-height:90vh; overflow:auto;
  background:radial-gradient(120% 90% at 50% -6%, var(--card-hi), var(--card) 62%);
  box-shadow:0 70px 130px -30px rgba(20,12,4,.55), 0 22px 46px -18px rgba(20,12,4,.4),
    0 0 0 1px color-mix(in srgb, var(--gold) 55%, transparent);
  transform:scale(.14) translateY(-36vh);
  transition:transform 1s cubic-bezier(.16,1,.3,1);
}
.ir2-expand-visible .ir2-expand-sheet{ transform:scale(1) translateY(0); }

.ir2-expand-grain{ position:absolute; inset:0; opacity:.05; mix-blend-mode:multiply; pointer-events:none;
  background-image:var(--ir-paper-noise); background-size:130px 130px; }
.ir2-e-wreath{ position:absolute; inset:6%; z-index:0; pointer-events:none; opacity:.5; color:var(--liner-mid); }
.ir2-e-corner{ position:absolute; width:11%; height:auto; z-index:2; pointer-events:none; opacity:.85; color:var(--gold); }
.ir2-e-corner.tl{ top:4%; left:4%; }
.ir2-e-corner.tr{ top:4%; right:4%; transform:scaleX(-1); }
.ir2-e-corner.bl{ bottom:4%; left:4%; transform:scaleY(-1); }
.ir2-e-corner.br{ bottom:4%; right:4%; transform:scale(-1,-1); }

.ir2-expand-inner{
  position:relative; z-index:1; width:min(80%,540px); margin:0 auto; padding:11% 0;
  text-align:center;
  opacity:0; transform:translateY(14px);
  transition:opacity .8s ease, transform .8s cubic-bezier(.16,1,.3,1);
}
.ir2-expand-visible .ir2-expand-inner{ opacity:1; transform:none; transition-delay:.55s; }

.ir2-e-mono{
  width:56px; height:56px; margin:0 auto 18px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  border:1px solid color-mix(in srgb, var(--gold) 70%, transparent);
  background:color-mix(in srgb, var(--gold) 8%, transparent);
  font-family:var(--font-serif); font-style:italic; font-weight:600; font-size:17px; color:var(--ink-soft);
}
.ir2-e-eyebrow{ margin:0 0 14px; font-family:var(--font-sans); font-size:11px; font-weight:700; letter-spacing:.3em; text-transform:uppercase; color:var(--ink-soft); }
.ir2-e-names{
  margin:0 0 22px; font-family:var(--font-script); font-weight:400; line-height:1.1;
  font-size:clamp(32px,9vw,68px); color:var(--ink); text-wrap:balance;
  background:linear-gradient(110deg, var(--ink) 0%, var(--ink) 30%, var(--gold-hi) 46%, var(--ink) 62%, var(--ink) 100%);
  background-size:240% 100%; background-position:120% 0; -webkit-background-clip:text; background-clip:text; color:transparent;
}
.ir2-expand-visible .ir2-e-names{ animation:ir2NameShimmer 1.8s ease-out .95s 1 forwards; }
@keyframes ir2NameShimmer{ from{ background-position:160% 0; } to{ background-position:-40% 0; } }
.ir2-e-hairline{ width:120px; height:1px; margin:0 auto 26px; background:color-mix(in srgb, var(--gold) 45%, transparent); }
.ir2-e-details{ display:flex; flex-wrap:wrap; justify-content:center; gap:0; margin-bottom:36px; }
.ir2-e-detail{
  display:flex; flex-direction:column; gap:6px; text-align:center;
  padding:0 22px; border-inline-start:1px solid color-mix(in srgb, var(--gold) 25%, transparent);
}
.ir2-e-detail:first-child{ border-inline-start:none; padding-inline-start:0; }
.ir2-e-detail:last-child{ padding-inline-end:0; }
.ir2-e-detail span{ font-family:var(--font-sans); font-size:9.5px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--ink-soft); }
.ir2-e-detail b{ font-family:var(--font-serif); font-weight:500; font-size:14px; color:var(--ink); }
.ir2-e-cta{
  font-family:var(--font-sans); font-size:12px; font-weight:700; letter-spacing:.2em; text-transform:uppercase;
  color:#3a2a08; background:linear-gradient(180deg,var(--gold-hi),var(--gold)); border:none; border-radius:2px;
  padding:15px 34px; cursor:pointer; box-shadow:0 14px 28px -12px rgba(90,64,20,.5);
  transition:transform .2s ease, box-shadow .2s ease;
}
.ir2-e-cta:hover{ transform:translateY(-1px); box-shadow:0 18px 32px -12px rgba(90,64,20,.6); }

@media (max-width:640px){
  .ir2-e-details{ flex-direction:column; gap:18px; }
  .ir2-e-detail{ border-inline-start:none; padding-inline-start:0; }
}

/* On-brand gold focus rings on every interactive element in this overlay. */
.ir2-skip:focus-visible, .ir2-langchip:focus-visible, .ir2-seal-btn:focus-visible, .ir2-e-cta:focus-visible{
  outline:2px solid var(--gold); outline-offset:3px;
}
`;
