"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { lighten, darken, alpha, mix, luminance } from "../../utils/color";
import Icon from "../icons/Icon";

/* ═══════════════════════════════════════════════════════════════════════════
   InvitationReveal — "The Unsealing"

   ONE cinematic opening shared by both guest reveals:

     • mode="invitation"  first thing a guest sees on the event page /[slug].
     • mode="rsvp"        gates the RSVP route; per-session "seen" memory.

   Four envelope-flap photos (three plain sides, the top carrying an embossed
   scroll flourish — the real artwork, not a generated recreation) meet at a
   circular tap-to-open wax seal. Tap it: the "tap to open" text cuts
   instantly, the seal zooms and dissolves, and the flaps peel outward
   together (top/bottom staying in place, the side pair fading once clear)
   — quick and immediate, not a slow multi-second reveal — handing straight
   back to the real page underneath with no intermediate summary card.

   The flap/seal/flourish artwork (public/images/reveal/) is a fixed, shared
   asset set — deliberately NOT tinted per event's custom_colors: it's the one
   photoreal look for every event. The seal artwork itself ships blank, with
   the organizer's own monogram ("Seal Name / Monogram" in the dashboard →
   template_data.seal_text, auto-derived from the couple/event name when left
   empty) drawn over it as an SVG engraving — so one shared image still
   personalises per event. The rest of the personalisation lives in the text
   below the seal (guest welcome line, event title, date).

   CONTRACT (kept stable for callers + tests):
     • data-testid="guest-envelope-reveal" on the root
     • data-testid="guest-envelope-skip" on the always-available skip control
     • calls onComplete() exactly once when finished or skipped
   ═══════════════════════════════════════════════════════════════════════════ */

const isArabic = (s) => typeof s === "string" && /[؀-ۿ]/.test(s);

const REVEAL_ASSETS = {
  flapDeco: "/images/reveal/flap-deco.webp",
  flapPlain: "/images/reveal/flap-plain.webp",
  seal: "/images/reveal/seal.webp",
  flourish: "/images/reveal/flourish.webp",
};

/* The engraved-monogram look on the wax seal: a mid-gold fill with a light
   highlight above and a darker shadow below, so the organizer's text reads as
   raised gold pressed into the wax rather than flat type sitting on a photo.
   Kept as plain objects (not a CSS class) because the reduced-motion fallback
   below returns before REVEAL_CSS is injected and so can't rely on one. */
const SEAL_TEXT_SVG_STYLE = {
  position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
  filter: "drop-shadow(0 -0.6px 0 rgba(255,250,232,.5)) drop-shadow(0 0.9px 0.7px rgba(86,58,16,.45))",
  // Set here (and inherited by the <text> below) rather than as a font-family
  // presentation attribute — var() is not reliably supported inside SVG
  // presentation attributes, but works fine in an inline style.
  fontFamily: "var(--font-serif), Georgia, serif",
};
const SEAL_TEXT_FILL = "#8d6c2c";

/* ─── Name + monogram derivation from real event data ─── */
function deriveIdentity(event, lang) {
  const td = event?.template_data || {};
  const a = (td.groom_name || td.partner1Name || td.partner1 || td.celebrant || td.honoree || td.company || "").trim();
  const b = (td.bride_name || td.partner2Name || td.partner2 || "").trim();

  let full;
  if (a && b) full = `${a} & ${b}`;
  else if (a) full = a;
  else full = (lang === "ar" && (event?.title_ar || td.title_ar)) ? (event?.title_ar || td.title_ar) : (event?.title || "");

  // What gets engraved on the wax. The organizer's own "Seal Name / Monogram"
  // (template_data.seal_text, set in the dashboard) always wins; everything
  // below is only the auto-fallback for organizers who left it blank.
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

  const P = useMemo(() => buildRevealPalette(event?.custom_colors), [event?.custom_colors]);
  const paletteVars = useMemo(() => ({
    "--card": P.card, "--card-hi": P.cardHi, "--card-edge": P.cardEdge,
    "--ink": P.ink, "--ink-soft": P.inkSoft,
    "--accent": P.accent, "--gold": P.gold, "--gold-hi": P.goldHi,
    "--liner-lite": P.linerLite, "--liner-mid": P.linerMid, "--liner-deep": P.linerDeep,
    "--bloom": P.bloom,
    // Scoped locally to this overlay only — NOT a change to the platform's
    // global --font-serif/--font-script (InvitationCard, HeroSection, etc.
    // keep whatever they already had). CSS custom properties only cascade
    // to descendants of the element they're set on, and this component's
    // root is never an ancestor of the rest of the guest page, so this is
    // scoping by construction, not by convention.
    // Resolved from the SELF-HOSTED next/font variables declared on <html> in
    // layout.js, not from a family name that only exists if a third-party
    // stylesheet loaded. The literal names stay as the fallback so the reveal
    // still renders correctly if a face ever fails to resolve.
    "--font-serif": "var(--font-heading), 'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    "--font-script": "var(--font-delafield), 'Mrs Saint Delafield', cursive",
  }), [P]);

  // The two reveal display faces are now SELF-HOSTED via next/font in layout.js
  // (Cormorant Garamond as --font-heading, Mrs Saint Delafield as --font-delafield).
  // This used to inject a <link> to fonts.googleapis.com on every mount, which made
  // the envelope — the very first thing a guest sees — wait on a third-party host
  // that is blackholed in several countries and by many corporate proxies. A
  // blackholed host hangs rather than failing, and a <head> stylesheet blocks paint
  // while pending, so those guests got a frozen reveal and never reached the
  // invitation at all. Nothing to load at runtime now.

  const td = event?.template_data || {};
  const hasArabic = !!(event?.title_ar || td.title_ar || isArabic(event?.title));
  const identity = useMemo(() => deriveIdentity(event, lang), [event, lang]);
  // A known guest (resolved from their personal link/token — private events,
  // or a public event's per-guest invite) is personalised via the reveal
  // panel's own welcome line — the seal is deliberately NOT personalised per
  // guest: it carries the couple/event's own monogram, the same for every
  // guest, the way a real wax seal would.
  const sealText = identity.sealText;
  // Same 0–100 units as the SVG overlay's viewBox, so the engraving scales
  // with the seal at any button size. Longer text steps down through the
  // ladder instead of overflowing the wax face.
  const sealFontSize = sealText.length <= 2 ? 26 : sealText.length <= 4 ? 19 : sealText.length <= 7 ? 13.5 : sealText.length <= 10 ? 10 : 8;

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
  const noiseVars = useMemo(() => ({
    "--ir-paper-noise": "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/></filter><rect width='140' height='140' filter='url(%23p)'/></svg>\")",
  }), []);

  /* ─── Sequence control ─── */
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const after = useCallback((ms, fn) => { timers.current.push(setTimeout(fn, ms)); }, []);
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    markSeen();
    onComplete && onComplete();
  }, [markSeen, onComplete]);

  const openSeal = useCallback(() => {
    if (startedRef.current || finishedRef.current) return;
    startedRef.current = true;
    clearTimers(); // cancel any still-pending intro timers (e.g. the resting-prompt timer)
    musicRef?.current?.play().catch((err) => console.error("Background music playback failed:", err));
    // "pressing" hides the prompt instantly (see .ir2-pressing rule) so
    // there's no frame where "tap to open" is still visible while the
    // flaps are already moving.
    setStage("pressing");
    after(60, () => setStage("opening"));
    after(800, finish);
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
          <div style={{ width: 76, height: 76, margin: "0 auto 18px", position: "relative", borderRadius: "50%", overflow: "hidden" }}>
            <img src={REVEAL_ASSETS.seal} alt="" aria-hidden="true" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <svg viewBox="0 0 100 100" aria-hidden style={SEAL_TEXT_SVG_STYLE}>
              <text
                x="50" y="50" textAnchor="middle" dominantBaseline="central"
                fontSize={sealFontSize}
                fontWeight="600" letterSpacing="0.5" fill={SEAL_TEXT_FILL}
              >
                {sealText}
              </text>
            </svg>
          </div>
          <div style={{ fontSize: 10.5, letterSpacing: isRTL ? "normal" : "0.36em", textTransform: isRTL ? "none" : "uppercase", color: P.accent, fontWeight: 700 }}>{guestName ? (isRTL ? `مرحباً ${guestName}` : `Welcome, ${guestName}`) : copy.eyebrow}</div>
          <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "clamp(26px,7vw,38px)", margin: "12px 0 6px", color: P.ink, fontWeight: 500 }}>{displayTitle}</h1>
          <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontSize: 14, color: P.inkSoft, margin: 0 }}>{copy.join}</p>
          {dateStr && <div style={{ marginTop: 18, fontSize: 12, letterSpacing: isRTL ? "normal" : "0.2em", textTransform: isRTL ? "none" : "uppercase", color: P.inkSoft, fontWeight: 600 }}>{dateStr}</div>}
          <button type="button" onClick={() => { musicRef?.current?.play().catch(() => {}); finish(); }} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 24, padding: "14px 32px", borderRadius: 999,
            border: "none", background: `linear-gradient(180deg, ${P.goldHi}, ${P.gold})`, color: "#2c2010",
            fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: isRTL ? "normal" : "0.14em", textTransform: isRTL ? "none" : "uppercase", cursor: "pointer",
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
          <div className="ir2-flap top"><img src={REVEAL_ASSETS.flapDeco} alt="" aria-hidden="true" /></div>
          <div className="ir2-flap bottom"><img src={REVEAL_ASSETS.flapPlain} alt="" aria-hidden="true" /></div>
          <div className="ir2-flap left"><img src={REVEAL_ASSETS.flapPlain} alt="" aria-hidden="true" /></div>
          <div className="ir2-flap right"><img src={REVEAL_ASSETS.flapPlain} alt="" aria-hidden="true" /></div>

          <button
            type="button"
            className="ir2-seal-btn"
            onClick={openSeal}
            aria-label="Tap to open your invitation"
          >
            <span className="ir2-seal-face" aria-hidden="true">
              <img src={REVEAL_ASSETS.seal} alt="" />
              {/* The organizer's monogram, engraved into the wax. Drawn as an
                  SVG overlay in the same 0–100 space as the artwork so it
                  tracks the seal at every size, and shaded light-above /
                  dark-below (see .ir2-seal-text) so it reads as raised gold
                  rather than flat text sitting on a photo. */}
              <svg viewBox="0 0 100 100" aria-hidden style={SEAL_TEXT_SVG_STYLE}>
                <text
                  x="50" y="50" textAnchor="middle" dominantBaseline="central"
                  fontSize={sealFontSize}
                  fontWeight="600" letterSpacing="0.5" fill={SEAL_TEXT_FILL}
                >
                  {sealText}
                </text>
              </svg>
            </span>
          </button>
        </div>

        {/* A sibling of .ir2-seal-stage (not nested inside it) — that stage is
            a fixed square sized for the flap geometry, and its own
            non-absolute children lay out in a row; nesting this here made
            "tap to open" render BESIDE the seal instead of centered below
            it. .ir2-scene's own column flex direction stacks it correctly.
            Stays mounted through pressing/opening (not just "rest") so its
            hide timing is driven by REVEAL_CSS's own .ir2-pressing/.ir2-
            opening rules — cut the instant the seal is tapped, before any
            flap motion starts — instead of racing an unmount against the
            flap CSS transitions. */}
        <AnimatePresence>
          {(stage === "rest" || stage === "pressing" || stage === "opening") && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="ir2-prompt"
            >
              <div className="ir2-prompt-pill"><span aria-hidden style={{ fontSize: 12 }}>✦</span> {copy.tap}</div>
              <img className="ir2-prompt-flourish" src={REVEAL_ASSETS.flourish} alt="" aria-hidden="true" />
              <p className="ir2-prompt-sub">{copy.special}</p>
            </motion.div>
          )}
        </AnimatePresence>
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

.ir2-seal-stage{ position:relative; width:min(52vw,300px); aspect-ratio:1; display:flex; align-items:center; justify-content:center; }

/* Four envelope-flap panels meeting at the seal. First pass ported the
   reference's own ti/dt timing verbatim (a ~1.5s dead beat before anything
   moved, ~5s total) — live testing showed that read as broken (nothing
   happens when you tap) rather than premium, so this is deliberately much
   faster: the prompt cuts the instant you tap, the seal and flaps all
   start moving together with only a hair of stagger between pairs, and the
   whole thing resolves in well under a second. Direction/fade-vs-stay
   pattern (top/bottom stay, left/right fade) is kept from the source. */
.ir2-flap{ position:absolute; top:50%; left:50%; width:min(70vw,340px); aspect-ratio:700/524; }
.ir2-flap img{ width:100%; height:100%; display:block; object-fit:fill; filter:drop-shadow(0 6px 14px rgba(40,26,8,.2)); }
.ir2-flap.top    { transform:translate(-50%,-100%) rotate(180deg); transition:transform .55s cubic-bezier(.4,0,.2,1); }
.ir2-flap.bottom { transform:translate(-50%,0%) rotate(0deg); transition:transform .55s cubic-bezier(.4,0,.2,1); }
.ir2-flap.left   { transform:translate(-100%,-50%) rotate(270deg); transition:transform .55s cubic-bezier(.4,0,.2,1) .06s, opacity .2s ease .45s; }
.ir2-flap.right  { transform:translate(0%,-50%) rotate(90deg); transition:transform .55s cubic-bezier(.4,0,.2,1) .06s, opacity .2s ease .45s; }

.ir2-root.ir2-opening .ir2-flap.top    { transform:translate(-50%,-210%) rotate(180deg); }
.ir2-root.ir2-opening .ir2-flap.bottom { transform:translate(-50%,110%) rotate(0deg); }
.ir2-root.ir2-opening .ir2-flap.left   { transform:translate(-210%,-50%) rotate(270deg); opacity:0; }
.ir2-root.ir2-opening .ir2-flap.right  { transform:translate(110%,-50%) rotate(90deg); opacity:0; }

.ir2-seal-btn{ width:38%; aspect-ratio:1; border-radius:50%; border:none; padding:0; cursor:pointer;
  position:relative; z-index:5; background:none; filter:drop-shadow(0 14px 26px rgba(40,26,8,.35));
  transition:transform .4s cubic-bezier(.34,1.56,.64,1), opacity .35s ease; }
.ir2-seal-face{ position:absolute; inset:0; border-radius:50%; display:block; overflow:hidden;
  box-shadow:inset 0 2px 4px rgba(255,255,255,.25); }
.ir2-seal-face img{ width:100%; height:100%; display:block; object-fit:cover; }
.ir2-seal-btn:hover .ir2-seal-face{ filter:brightness(1.06); }
.ir2-seal-btn:active{ transform:scale(.96); }
.ir2-root.ir2-opening .ir2-seal-btn{ transform:scale(1.22); opacity:0; pointer-events:none; }

/* Cuts the instant the seal is tapped — no lingering "tap to open" visible
   while the flaps are already moving. */
.ir2-prompt{ position:relative; z-index:12; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center;
  margin-top:clamp(16px,4dvh,30px); padding:0 24px;
  transition:opacity .12s ease; }
.ir2-root.ir2-pressing .ir2-prompt,
.ir2-root.ir2-opening .ir2-prompt{ opacity:0; }
.ir2-prompt-pill{ display:inline-flex; align-items:center; gap:8px; padding:9px 18px; border-radius:999px;
  background:rgba(255,255,255,.6); border:1px solid color-mix(in srgb,var(--accent) 36%, transparent);
  -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);
  font-family:var(--font-sans); font-size:10px; font-weight:700; letter-spacing:.2em; text-transform:uppercase; color:var(--accent); animation:ir2Nudge 2.4s ease-in-out infinite; }
/* Wide tracking is a deliberate look on English all-caps — but Arabic script
   needs its letters to stay connected to render properly, so the same
   tracking pries them apart into disjointed, "broken"-looking text. */
[dir="rtl"] .ir2-prompt-pill{ letter-spacing:normal; text-transform:none; }
@keyframes ir2Nudge{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-4px) } }
.ir2-prompt-flourish{ width:min(46vw,180px); height:auto; opacity:.8; margin-top:2px; display:block; }
.ir2-prompt-sub{ font-family:var(--font-serif), Georgia, serif; font-style:italic; font-size:13px; color:var(--ink-soft); margin:10px 0 0; }

@media (prefers-reduced-motion:reduce){
  .ir2-prompt-pill{ animation:none; }
  .ir2-flap,.ir2-seal-btn,.ir2-prompt{ transition-duration:.001ms !important; transition-delay:0s !important; }
}

/* On-brand gold focus rings on every interactive element in this overlay. */
.ir2-skip:focus-visible, .ir2-langchip:focus-visible, .ir2-seal-btn:focus-visible{
  outline:2px solid var(--gold); outline-offset:3px;
}
`;
