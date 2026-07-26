"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { lighten, darken, alpha, mix, luminance } from "../../utils/color";
import Icon from "../icons/Icon";

/* ═══════════════════════════════════════════════════════════════════════════
   InvitationReveal — "The Unsealing"

   ONE cinematic opening shared by both guest reveals:

     • mode="invitation"  first thing a guest sees on the event page /[slug].
     • mode="rsvp"        gates the RSVP route; per-session "seen" memory.

   This is a faithful reproduction of the reference design (the Tilda T396
   export kept in the `opening-envelope` design folder, record 2339662043) —
   not a reinterpretation of it. A full-bleed envelope, larger than the
   viewport and cropped by it, built from four overlapping flap photographs
   with a wax seal at the centre and "tap to open" printed on the paper just
   below it. Tap the seal: the label and flourish fade, the seal swells and
   dissolves, and the four flaps slide apart — sideways pair first and
   fading, top and bottom riding straight off the artboard.

   EVERY position, size, distance, duration and delay below is transcribed
   from that export rather than re-derived, and lives in one table (LAYERS)
   so it stays checkable against the source. See the ARTBOARD block.

   THE ONE DEPARTURE FROM THE REFERENCE — deliberate, and the reason this is
   a component and not a static page: the reference bakes its wax seal,
   engraving and all, into a single rendered image per invitation. Ours ships
   a BLANK seal and draws the organizer's own monogram over it as an SVG
   engraving ("Seal Name / Monogram" in the dashboard → template_data
   .seal_text, auto-derived from the couple/event name when left empty), so
   one shared image personalises itself per event with no asset pipeline.

   Two smaller, unavoidable substitutions: the reference's display face
   ("Template1") is a Tilda-hosted font that is not part of the export — it
   already falls back to Arial there — so the tap label uses the platform's
   own self-hosted serif; and the skip control and language chip are ours,
   required by the contract below and by bilingual events, and sit outside
   the artboard where the reference has nothing.

   CONTRACT (kept stable for callers + tests):
     • data-testid="guest-envelope-reveal" on the root
     • data-testid="guest-envelope-skip" on the always-available skip control
     • calls onComplete() exactly once when finished or skipped
   ═══════════════════════════════════════════════════════════════════════════ */

const isArabic = (s) => typeof s === "string" && /[؀-ۿ]/.test(s);

/* The reference's own artwork, at the resolution the reference displays it:
   the flaps are painted as large as 1000x800 CSS px, so anything downscaled
   renders visibly soft at that size. */
const REVEAL_ASSETS = {
  flapDeco: "/images/reveal/flap-deco.webp",
  flapPlain: "/images/reveal/flap-plain.webp",
  seal: "/images/reveal/seal.webp",
  flourish: "/images/reveal/flourish.webp",
};

/* ═══════════════════════════════════════════════════════════════════════════
   ARTBOARD — the reference design, transcribed.

   The reference is a Tilda "zero block": a fixed 1200x850 artboard of
   absolutely-positioned elements, with per-breakpoint overrides. Its x values
   are measured from the LEFT EDGE OF THE LAYOUT GRID, not from the centre,
   which is why rendering one needs that breakpoint's grid half-width:

       left = 50% - half + x

   Keeping x in the export's own coordinate system (instead of pre-resolving
   it to an offset from centre) is what makes every number below directly
   checkable against `opening-envelope-section.html` — d.x is the element's
   data-field-left-value, s960.x its data-field-left-res-960-value, and so on.

   Overrides are emitted as-is, so the CSS cascades exactly the way the
   export's does: a breakpoint that omits y keeps the y from the one above it.
   ═══════════════════════════════════════════════════════════════════════════ */

const ARTBOARD_H = 850;

/* max: the media query's max-width (null = the unqualified base block).
   half: that breakpoint's grid half-width. key: the LAYERS override to use. */
const SCREENS = [
  { max: null, half: 600, key: "d" },
  { max: 1199, half: 480, key: "s960" },
  { max: 959, half: 320, key: "s640" },
  { max: 639, half: 240, key: "s480" },
  { max: 479, half: 160, key: "s320" },
];

/* DOM order is the export's own element order, and with no z-index anywhere
   it is also the paint order: the two side flaps, then the bottom flap over
   them, then the embossed top flap over everything — the order an envelope is
   actually folded. The flourish, seal and label print on top of the paper.

   move/zoom/fade are the export's `data-animate-sbs-opts` keyframes: ms is
   that step's `ti` (duration) and delay is the accumulated `dt` at which the
   step begins. Easing is linear, matching the reference's `ea:'0'`. */
const LAYERS = [
  {
    cls: "fr", asset: "flapPlain", rot: 90,
    d: { x: 421, y: 25, w: 867, h: 800 },
    s960: { x: 295 }, s640: { x: 135 }, s480: { x: 55 },
    s320: { x: -75, y: 83, w: 856, h: 684 },
    move: { x: 559, ms: 650, delay: 800 },
    fade: { ms: 150, delay: 1450 },
  },
  {
    cls: "fl", asset: "flapPlain", rot: 270,
    d: { x: -87, y: 25, w: 867, h: 800 },
    s960: { x: -205 }, s640: { x: -360 }, s480: { x: -441 },
    s320: { x: -475, y: 105, w: 856, h: 640 },
    move: { x: -559, ms: 650, delay: 800 },
    fade: { ms: 150, delay: 1450 },
  },
  {
    cls: "fb", asset: "flapPlain", rot: 180,
    d: { x: 100, y: 221, w: 1000, h: 785 },
    s960: { x: -25 }, s640: { x: -185 }, s480: { x: -265 },
    s320: { x: -247, w: 815, h: 787 },
    move: { y: 606, ms: 500, delay: 800 },
  },
  {
    cls: "ft", asset: "flapDeco", rot: 0,
    d: { x: 105, y: -98, w: 991, h: 583 },
    s960: { x: -15, y: -102, h: 586 },
    s640: { x: -175, y: -116, h: 593 },
    s480: { x: -255, w: 992, h: 598 },
    s320: { x: -244, y: -99, w: 807, h: 569 },
    move: { y: -430, ms: 500, delay: 800 },
  },
  {
    cls: "fw", asset: "flourish",
    d: { x: 506, y: 510, w: 188, h: 45 },
    s960: { x: 386 }, s640: { x: 226 }, s480: { x: 146 }, s320: { x: 66 },
    fade: { ms: 500, delay: 0 },
  },
  {
    cls: "sl", kind: "seal",
    d: { x: 520, y: 310, w: 160, h: 160 },
    s960: { x: 400 }, s640: { x: 235 }, s480: { x: 155 }, s320: { x: 80 },
    zoom: { scale: 1.22, ms: 500, delay: 350 },
    fade: { ms: 500, delay: 350 },
  },
  {
    cls: "tx", kind: "text",
    d: { x: 492, y: 468, w: 217 },
    s960: { x: 372 }, s640: { x: 212 }, s480: { x: 132 }, s320: { x: 52 },
    fade: { ms: 500, delay: 0 },
  },
];

/* How long the reference's sequence actually runs, read off the table rather
   than restated: the last thing to finish is the side flaps' fade at
   1450 + 150ms. finish() is scheduled on this, so re-timing a step in LAYERS
   can never leave the handoff out of sync with the animation. */
const OPEN_DURATION = Math.max(
  ...LAYERS.flatMap((l) => [l.move, l.zoom, l.fade].filter(Boolean).map((s) => s.delay + s.ms))
);

function buildArtboardCSS() {
  return SCREENS.map(({ max, half, key }) => {
    const rules = LAYERS.map((l) => {
      const v = l[key];
      if (!v) return "";
      const d = [];
      if (v.x !== undefined) d.push(`left:calc(50% - ${half}px + ${v.x}px)`);
      if (v.y !== undefined) d.push(`top:${v.y}px`);
      if (v.w !== undefined) d.push(`width:${v.w}px`);
      if (v.h !== undefined) d.push(`height:${v.h}px`);
      return d.length ? `.ir3-${l.cls}{${d.join(";")}}` : "";
    }).filter(Boolean).join("");
    return max === null ? rules : `@media screen and (max-width:${max}px){${rules}}`;
  }).join("\n");
}

function buildMotionCSS() {
  return LAYERS.map((l) => {
    const transitions = [];
    const opened = [];
    if (l.move) {
      transitions.push(`transform ${l.move.ms}ms linear ${l.move.delay}ms`);
      if (l.move.x) opened.push(`--mx:${l.move.x}px`);
      if (l.move.y) opened.push(`--my:${l.move.y}px`);
    }
    if (l.zoom) {
      transitions.push(`transform ${l.zoom.ms}ms linear ${l.zoom.delay}ms`);
      opened.push(`--sc:${l.zoom.scale}`);
    }
    if (l.fade) {
      transitions.push(`opacity ${l.fade.ms}ms linear ${l.fade.delay}ms`);
      opened.push("opacity:0");
    }
    if (!transitions.length) return "";
    return `.ir3-${l.cls}{transition:${transitions.join(",")}}` +
      `.ir3-root.is-open .ir3-${l.cls}{${opened.join(";")}}`;
  }).filter(Boolean).join("\n");
}

/* The rotation lives on the inner .ir3-atom, never on the positioned layer —
   exactly as the export splits it (`.tn-elem` is animated, `.tn-atom` is
   rotated). Keeping them on separate elements is what lets the slide-apart
   transform stay in plain screen space instead of having to be composed with
   each flap's own rotation. */
function buildRotationCSS() {
  return LAYERS.filter((l) => l.rot).map((l) => `.ir3-${l.cls} .ir3-atom{transform:rotate(${l.rot}deg)}`).join("\n");
}

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

/* ─── Palette derived from the event's own custom_colors ───
   The artboard itself is NOT tinted — it is the reference's one photoreal
   look for every event. This palette dresses the two pieces of chrome that
   are ours (skip control, language chip) and the reduced-motion fallback
   card, and is clamped to a legible mid-tone band so any organizer colour
   stays readable rather than washing out or going muddy. */
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

  const [open, setOpen] = useState(false);
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
  // or a public event's per-guest invite) is personalised via the reduced-motion
  // card's welcome line — the seal is deliberately NOT personalised per guest:
  // it carries the couple/event's own monogram, the same for every guest, the
  // way a real wax seal would.
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
    en: { eyebrow: "You are invited", tap: "Tap to open", enter: "View invitation", join: "request the honour of your presence" },
    ar: { eyebrow: "أنت مدعو", tap: "اضغط للفتح", enter: "عرض الدعوة", join: "يشرّفنا حضوركم" },
  }[lang];
  const isRTL = lang === "ar";
  const arTitle = event?.title_ar || td.title_ar;
  const displayTitle = isRTL && arTitle ? arTitle : identity.full;
  const dateStr = event?.event_date
    ? new Date(event.event_date).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "";

  /* ─── Sequence control ─── */
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const after = useCallback((ms, fn) => { timers.current.push(setTimeout(fn, ms)); }, []);
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    markSeen();
    onComplete && onComplete();
  }, [markSeen, onComplete]);

  // One flag drives the whole sequence: every element's own delay and duration
  // is already declared in LAYERS, so tapping the seal only has to say "go".
  const openSeal = useCallback(() => {
    if (startedRef.current || finishedRef.current) return;
    startedRef.current = true;
    musicRef?.current?.play().catch((err) => console.error("Background music playback failed:", err));
    setOpen(true);
    after(OPEN_DURATION, finish);
  }, [after, finish, musicRef]);

  useEffect(() => clearTimers, [clearTimers]);

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
            <img src={REVEAL_ASSETS.seal} alt="" aria-hidden="true" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
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

  return (
    <motion.div
      data-testid="guest-envelope-reveal" role="dialog" aria-label="Open your invitation"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } }}
      transition={{ duration: 0.5 }}
      dir={isRTL ? "rtl" : "ltr"}
      className={`ir3-root${open ? " is-open" : ""}`}
      style={paletteVars}
    >
      <style dangerouslySetInnerHTML={{ __html: REVEAL_CSS }} />

      {/* Ours, not the reference's: kept outside the artboard so nothing in the
          transcribed layout has to make room for them. */}
      <div style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineEnd: 16, zIndex: 20 }}>
        <button type="button" className="ir3-langchip" onClick={() => hasArabic && setLang((l) => (l === "en" ? "ar" : "en"))} aria-label={hasArabic ? "Toggle language" : "Language"} style={langChipStyle(!!hasArabic, P)}>
          <Icon name="globe" size={14} strokeWidth={1.6} style={{ opacity: 0.7 }} />
          <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{lang === "en" ? "EN" : "ع"}</span>
        </button>
      </div>

      <button type="button" className="ir3-skip" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation animation" style={skipStyle(P)}>
        Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
      </button>

      {/* The 1200x850 artboard, centred in the viewport. The envelope is drawn
          larger than it on every side and is meant to be cropped — full-bleed
          paper running off the screen, not a card sitting in the middle of
          it. */}
      <div className="ir3-artboard">
        <div className="ir3-layer ir3-fr"><span className="ir3-atom"><img src={REVEAL_ASSETS.flapPlain} alt="" aria-hidden="true" /></span></div>
        <div className="ir3-layer ir3-fl"><span className="ir3-atom"><img src={REVEAL_ASSETS.flapPlain} alt="" aria-hidden="true" /></span></div>
        <div className="ir3-layer ir3-fb"><span className="ir3-atom"><img src={REVEAL_ASSETS.flapPlain} alt="" aria-hidden="true" /></span></div>
        <div className="ir3-layer ir3-ft"><span className="ir3-atom"><img src={REVEAL_ASSETS.flapDeco} alt="" aria-hidden="true" /></span></div>
        <div className="ir3-layer ir3-fw"><span className="ir3-atom"><img src={REVEAL_ASSETS.flourish} alt="" aria-hidden="true" /></span></div>

        <button
          type="button"
          className="ir3-layer ir3-sl"
          onClick={openSeal}
          aria-label="Tap to open your invitation"
        >
          <span className="ir3-atom ir3-seal-face" aria-hidden="true">
            <img src={REVEAL_ASSETS.seal} alt="" />
            {/* The organizer's monogram, engraved into the wax — the one thing
                here the reference bakes into its artwork and we don't. Drawn in
                the same 0–100 space as the seal image so it tracks it at every
                size, and shaded light-above / dark-below so it reads as raised
                gold rather than flat text sitting on a photo. */}
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

        <div className="ir3-layer ir3-tx">{copy.tap}</div>
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
.ir3-root{
  position:fixed; inset:0; z-index:1000; overflow:hidden;
  background:#fff;
  font-family:var(--font-sans);
}

/* The reference's artboard: a fixed 1200x850 coordinate space, centred in the
   viewport. Its own children are positioned in artboard px, so nothing here
   needs a viewport-relative unit.

   It deliberately does NOT clip, even though the reference's does: there the
   artboard is a page section and its 850px edge IS the edge of what you see,
   but here the overlay fills the screen, so clipping at 850 would draw a hard
   horizontal seam across the paper on any viewport taller than that. The
   equivalent of the reference's crop, for a full-screen overlay, is the
   viewport itself — which .ir3-root already clips to. */
.ir3-artboard{
  position:absolute; left:0; right:0; top:50%;
  height:${ARTBOARD_H}px; margin-top:${-ARTBOARD_H / 2}px;
}

/* --mx/--my/--sc are what the open sequence animates; every layer starts at
   rest and the generated .is-open rules below supply that layer's own
   destination, duration and delay. */
.ir3-layer{
  position:absolute; margin:0; padding:0; border:0;
  transform:translate(var(--mx,0px),var(--my,0px)) scale(var(--sc,1));
  /* These boxes are hundreds of px across and several of them are painted
     above the seal, so only the seal itself may take a pointer — otherwise
     the label's box alone would swallow taps along the seal's bottom edge. */
  pointer-events:none;
}
.ir3-atom{ display:block; width:100%; height:100%; }
/* object-fit:fill is deliberate, not an oversight: the reference paints these
   triangles at box sizes that do not match the artwork's own aspect ratio,
   and that stretch is part of how its envelope is shaped. */
.ir3-layer img{ display:block; width:100%; height:100%; object-fit:fill; }

.ir3-tx{
  color:#866739; text-align:center;
  font-family:var(--font-serif), Georgia, serif;
  font-size:20px; line-height:1.55; font-weight:400;
}

.ir3-sl{ background:none; cursor:pointer; pointer-events:auto; -webkit-tap-highlight-color:transparent; }
.ir3-seal-face{ position:relative; }
/* No circular clip on the wax: its silhouette is a hand-pressed wavy edge and
   the artwork carries its own transparency, so masking it to a circle would
   shave exactly the detail that makes it read as wax. */
.ir3-root.is-open .ir3-sl{ pointer-events:none; }

/* On-brand gold focus rings on every interactive element in this overlay. */
.ir3-skip:focus-visible, .ir3-langchip:focus-visible, .ir3-sl:focus-visible{
  outline:2px solid var(--gold); outline-offset:3px;
}

/* Users who asked for reduced motion get the static fallback card above and
   never reach this stylesheet; this is belt-and-braces for anyone who flips
   the setting mid-reveal. */
@media (prefers-reduced-motion:reduce){
  .ir3-layer{ transition-duration:.001ms !important; transition-delay:0s !important; }
}

${buildRotationCSS()}

${buildArtboardCSS()}

${buildMotionCSS()}
`;
