"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { lighten, darken, alpha, mix, luminance } from "../../utils/color";
import Icon from "../icons/Icon";

/* ═══════════════════════════════════════════════════════════════════════════
   InvitationReveal — "The Unsealing"

   ONE cinematic opening shared by both guest reveals:

     • mode="invitation"  first thing a guest sees on the event page /[slug].
     • mode="rsvp"        gates the RSVP route; seal personalised with the
                          guest's own name; per-session "seen" memory.

   Four envelope-flap shapes (the two side flaps plain, the top/bottom pair
   carrying an embossed scroll flourish — the same "one asset reused at four
   rotations" technique as the reference this was built from) meet at a
   circular tap-to-open seal carrying the couple/event's own generated
   monogram (never a photo — it's a seal, not a picture frame). Tap it: the
   "tap to open" text cuts instantly, the seal zooms and dissolves, and the
   flaps peel outward together (top/bottom staying in place, the side pair
   fading once clear) — quick and immediate, not a slow multi-second reveal
   — handing straight back to the real page underneath with no intermediate
   summary card.

   Everything is generated — NO image uploads anywhere in this component.
   Every material (flaps, seal) is tinted from the event's own custom_colors.

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
  // personalised: it always carries the couple/event's own monogram, the
  // same for every guest, the way a real wax seal would. Always the
  // generated wax-seal monogram, never the event's cover photo — a photo
  // there read as a random picture, not a seal.
  const sealText = identity.sealText;
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
          <div style={{ width: 76, height: 76, margin: "0 auto 18px", position: "relative" }}>
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

      {/* shared flap + seal artwork, tinted from the palette above. The two
          flap shapes below are a generated recreation of what the reference
          file's own two images actually are (downloaded and inspected
          directly): a plain envelope-flap silhouette, and the same flap
          with a symmetric embossed scroll flourish near its point — not
          botanical art. Same "one asset, four rotations" technique as the
          source, just generated instead of hotlinking someone else's
          Tilda-hosted PNGs. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <radialGradient id="ir2-waxg" cx="37%" cy="31%" r="78%">
            <stop offset="0%" style={{ stopColor: "var(--wax-hi)" }} />
            <stop offset="48%" style={{ stopColor: "var(--wax)" }} />
            <stop offset="100%" style={{ stopColor: "var(--wax-lo)" }} />
          </radialGradient>
          <linearGradient id="ir2-paperG" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--card-hi)" }} />
            <stop offset="100%" style={{ stopColor: "var(--card)" }} />
          </linearGradient>

          <symbol id="ir2-flap-plain" viewBox="0 0 300 170">
            <path d="M4,4 L296,4 L152,162 Q150,167 148,162 Z" fill="url(#ir2-paperG)" style={{ stroke: "var(--flap-edge)" }} strokeWidth="1" />
          </symbol>
          <symbol id="ir2-flap-deco" viewBox="0 0 300 170">
            <path d="M4,4 L296,4 L152,162 Q150,167 148,162 Z" fill="url(#ir2-paperG)" style={{ stroke: "var(--flap-edge)" }} strokeWidth="1" />
            <g fill="none" style={{ stroke: "var(--flap-emboss)" }} strokeWidth="1.4" opacity=".6" strokeLinecap="round">
              <path d="M150,28 C150,42 146,52 150,64 C154,52 150,42 150,28 Z" style={{ fill: "var(--flap-emboss)" }} opacity=".5" stroke="none" />
              <path d="M150,64 C122,68 98,64 82,49 C93,64 102,71 119,73 C106,77 92,75 79,66" />
              <path d="M150,64 C178,68 202,64 218,49 C207,64 198,71 181,73 C194,77 208,75 221,66" />
              <circle cx="82" cy="49" r="2.2" style={{ fill: "var(--flap-emboss)" }} stroke="none" />
              <circle cx="218" cy="49" r="2.2" style={{ fill: "var(--flap-emboss)" }} stroke="none" />
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
          <div className="ir2-flap top"><svg viewBox="0 0 300 170" aria-hidden><use href="#ir2-flap-deco" /></svg></div>
          <div className="ir2-flap bottom"><svg viewBox="0 0 300 170" aria-hidden><use href="#ir2-flap-deco" /></svg></div>
          <div className="ir2-flap left"><svg viewBox="0 0 300 170" aria-hidden><use href="#ir2-flap-plain" /></svg></div>
          <div className="ir2-flap right"><svg viewBox="0 0 300 170" aria-hidden><use href="#ir2-flap-plain" /></svg></div>

          <button
            type="button"
            className="ir2-seal-btn"
            onClick={openSeal}
            aria-label="Tap to open your invitation"
          >
            <span className="ir2-seal-ring" aria-hidden="true" />
            <span className="ir2-seal-face" aria-hidden="true">
              <svg viewBox="0 0 100 100" aria-hidden>
                <circle cx="50" cy="50" r="50" fill="url(#ir2-waxg)" />
                <ellipse cx="40" cy="34" rx="16" ry="11" fill="#fff" opacity=".14" />
                <text x="50" y="53" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-serif)" fontSize={sealFontSize} style={{ fill: "var(--wax-lo)" }} opacity=".85" letterSpacing="1">{sealText}</text>
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
  --flap-edge: color-mix(in srgb, var(--card) 72%, #000 8%);
  --flap-emboss: color-mix(in srgb, var(--card) 55%, var(--gold) 20%);
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
.ir2-flap{ position:absolute; top:50%; left:50%; width:min(70vw,340px); height:min(70vw,340px); color:var(--gold); }
.ir2-flap svg{ width:100%; height:100%; display:block; }
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
.ir2-seal-ring{ position:absolute; inset:-9%; border-radius:50%; border:1.5px solid var(--gold); opacity:.55; }
.ir2-seal-face{ position:absolute; inset:0; border-radius:50%; display:block; overflow:hidden;
  box-shadow:inset 0 2px 4px rgba(255,255,255,.25); }
.ir2-seal-face svg{ width:100%; height:100%; display:block; }
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
