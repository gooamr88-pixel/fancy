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

  // Replaces the small in-place card with a full-screen reveal rendered via
  // a portal (see below — needed because .ir2-envelope's 3D transforms
  // would otherwise trap a nested `position:fixed` panel instead of
  // letting it cover the real viewport). `closing` gives that portal its
  // own fade-out instead of popping instantly the moment this component
  // unmounts — see `finish` below for why that distinction matters.
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => { setPortalReady(true); }, []);
  const dustCanvasRef = useRef(null);
  const sealRef = useRef(null);
  const fireDustBurstRef = useRef(() => {});

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
  // or a public event's per-guest invite) is personalised via the card's
  // welcome line and the envelope's own handwritten-style address line —
  // both carry their name instead of generic copy. The wax seal itself is
  // deliberately NOT personalised: it always carries the couple/event's own
  // monogram, the same for every guest, the way a real wax seal would.
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
    "--ir-wood-noise": "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='560' height='200'><filter id='w'><feTurbulence type='fractalNoise' baseFrequency='0.011 0.085' numOctaves='4' seed='4'/><feColorMatrix type='matrix' values='0 0 0 0 0.40 0 0 0 0 0.30 0 0 0 0 0.18 0 0 0 0.10 0'/></filter><rect width='560' height='200' filter='url(%23w)'/></svg>\")",
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
    // if it was never shown (Skip pressed before the envelope opened, or
    // this is the prefersReduced branch below, which never sets `expanded`
    // at all) there's nothing to sync with, and reduced-motion users in
    // particular should never get an artificial wait added on top of
    // choosing less motion.
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
    fireDustBurstRef.current();
    setStage("pressing");
    // Tightened from the original 400/1300/3000/4400ms. 'rise' no longer
    // needs to wait out its own full 1.6s before 'grow' starts — grow (and
    // the full-screen expand) fires while rise is still ~85% through its
    // transition, so the browser retargets it live into one continuous
    // accelerating motion instead of rise-stop-then-grow. The small in-place
    // card itself is suppressed entirely once 'opening' hits (see CSS) —
    // the envelope opens directly into the one full-screen reveal.
    after(350, () => setStage("opening"));
    after(950, () => setStage("rise"));
    after(1250, () => { setStage("grow"); setExpanded(true); });
    after(2650, finish); // a beat to admire the invitation before auto-dismissing
  }, [after, clearTimers, finish, musicRef]);

  useEffect(() => {
    if (prefersReduced || alreadySeen) return;
    after(150, () => setStage("settled"));
    after(1150, () => setStage("rest"));
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ambient gold dust drifting through the tabletop scene, plus a short
  // burst fired from the seal's own live position (openSeal, above) right
  // as it cracks. Canvas rather than DOM nodes so it stays smooth at any
  // particle count (see the dataviz/motion guidance on generative graphics).
  // No-ops entirely for prefersReduced — that case never renders the
  // <canvas> this reads from, and alreadySeen unmounts before paint.
  useEffect(() => {
    if (prefersReduced || alreadySeen) return undefined;
    const canvas = dustCanvasRef.current;
    const scene = canvas?.closest(".ir2-scene");
    if (!canvas || !scene) return undefined;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, raf;

    const size = () => {
      W = scene.clientWidth; H = scene.clientHeight;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener("resize", size);
    size();

    const motes = Array.from({ length: 30 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.1 + 0.3,
      vy: -(Math.random() * 0.08 + 0.02),
      vx: (Math.random() - 0.5) * 0.03,
      a: Math.random() * 0.35 + 0.08,
      tw: Math.random() * Math.PI * 2,
    }));
    const burst = [];
    fireDustBurstRef.current = () => {
      const sealEl = sealRef.current;
      if (!sealEl) return;
      const sr = sealEl.getBoundingClientRect();
      const pr = scene.getBoundingClientRect();
      const cx = sr.left - pr.left + sr.width / 2;
      const cy = sr.top - pr.top + sr.height / 2;
      for (let i = 0; i < 26; i++) {
        const ang = Math.random() * Math.PI * 2, spd = Math.random() * 2.4 + 0.8;
        burst.push({
          x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 0.4,
          r: Math.random() * 1.4 + 0.5, life: 1, decay: Math.random() * 0.014 + 0.012,
        });
      }
    };

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#F3D67A";
      motes.forEach((p) => {
        p.y += p.vy; p.x += p.vx; p.tw += 0.015;
        if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
        ctx.globalAlpha = p.a * (0.55 + 0.45 * Math.sin(p.tw));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      if (burst.length) {
        ctx.fillStyle = "#FFF3D6";
        for (let i = burst.length - 1; i >= 0; i--) {
          const b = burst[i];
          b.x += b.vx; b.y += b.vy; b.vy += 0.05; b.vx *= 0.97; b.life -= b.decay;
          if (b.life <= 0) { burst.splice(i, 1); continue; }
          ctx.globalAlpha = Math.max(b.life, 0);
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", size);
      cancelAnimationFrame(raf);
      fireDustBurstRef.current = () => {};
    };
  }, [prefersReduced, alreadySeen]);

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

  // The full-screen reveal is a portal into document.body — .ir2-env-wrap's
  // own 3D perspective/transform would otherwise become the containing
  // block for a nested `position:fixed` panel, trapping it inside the
  // envelope's box instead of letting it cover the real viewport. `closing`
  // (see `finish` above) gives it its own fade instead of popping away the
  // instant this component unmounts.
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
          {/* subtle hand-poured irregularity on the wax seal only */}
          <filter id="ir2-wax-relief" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
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
        <button type="button" className="ir2-langchip" onClick={() => hasArabic && setLang((l) => (l === "en" ? "ar" : "en"))} aria-label={hasArabic ? "Toggle language" : "Language"} style={langChipStyle(!!hasArabic, P)}>
          <Icon name="globe" size={14} strokeWidth={1.6} style={{ opacity: 0.7 }} />
          <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{lang === "en" ? "EN" : "ع"}</span>
        </button>
      </div>

      <button type="button" className="ir2-skip" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation animation" style={skipStyle(P)}>
        Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
      </button>

      <div className="ir2-scene">
        <canvas ref={dustCanvasRef} id="ir2Dust" aria-hidden="true" />
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

              {/* The small in-place card (vellum + wreathed card content) that
                  used to rise and grow here was retired when the full-screen
                  portal (below, outside this transformed tree) took over as
                  the actual reveal — see the ENHANCEMENTS block in
                  REVEAL_CSS. Its markup was removed rather than left
                  permanently hidden. */}

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

              <div className="ir2-seal" ref={sealRef}>
                <svg className="ir2-crack" viewBox="0 0 100 100" aria-hidden>
                  <path d="M50 5 L44 18 L53 26 L41 37 L52 47 L38 58 L49 66 L40 79 L47 95" />
                  <path d="M50 5 L56 16 L46 24 L58 33 L47 44 L60 54 L49 63 L59 76 L52 95" opacity=".55" />
                  <path d="M44 18 L34 20 M53 26 L64 24 M38 58 L27 55 M49 66 L61 68" opacity=".4" strokeWidth="1" />
                </svg>
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

              <div className="ir2-flash" aria-hidden />
              <div className="ir2-chip c1" aria-hidden />
              <div className="ir2-chip c2" aria-hidden />
              <div className="ir2-chip c3" aria-hidden />
              <div className="ir2-chip c4" aria-hidden />
              <div className="ir2-chip c5" aria-hidden />
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

/* z-index above .ir2-flap (6) and .ir2-flap-shadow (5): the stamp sits in the
   top-right corner, which the closed flap's downward-pointing triangle
   (clip-path polygon 0 0,100% 0,50% 100%) geometrically covers almost
   entirely at that height — at z-index 4 (below the flap) only a sliver of
   the stamp peeked out from under it, looking cropped. A real stamp is
   affixed on top of the envelope paper, not tucked under the flap fold, so
   raising it above the flap (but still below the wax seal at 9) fixes both
   the visual logic and shows the whole stamp uncropped. */
.ir2-stamp{ position:absolute; top:9%; right:9%; width:15%; z-index:8; transform:rotate(4deg); transition:opacity .5s ease; }
.ir2-root.ir2-opening .ir2-stamp{ opacity:0; }
.ir2-stamp svg{ width:100%; height:auto; display:block; filter:drop-shadow(0 2px 3px rgba(60,44,22,.28)); }

.ir2-addr{ position:absolute; left:12%; top:60%; z-index:4; text-align:start; line-height:1.05; transition:opacity .45s ease; }
.ir2-root.ir2-opening .ir2-addr{ opacity:0; }
.ir2-addr-hi{ font-family:var(--font-script), cursive; font-size:clamp(22px,6vw,32px); color:var(--ink); }
.ir2-addr-to{ font-family:var(--font-serif), Georgia, serif; font-size:clamp(11px,3vw,14px); color:var(--ink-soft); letter-spacing:.04em; margin-top:1px; }
.ir2-root[dir="rtl"] .ir2-addr-hi{ font-family:var(--font-arabic-display), var(--font-serif), serif; }

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

@media (prefers-reduced-motion:reduce){
  .ir2-floaty{ animation:none; }
  .ir2-prompt-pill{ animation:none; }
  .ir2-seal-sheen::before{ animation:none; }
  .ir2-envelope,.ir2-flap,.ir2-seal,.ir2-bow,.ir2-ribbon-band,.ir2-body,.ir2-liner{ transition-duration:.001ms !important; }
  .ir2-body,.ir2-liner{ filter:none !important; }
}

/* ═══════════════════════════════════════════════════════════════
   ENHANCEMENTS — everything below is additive on top of the design
   above; no selector above was renamed or removed. Note this whole
   block, and its own @media(prefers-reduced-motion) coverage, is
   irrelevant when prefersReduced is true — that case returns the
   completely separate static-card branch above in the component body
   before any of .ir2-root ever renders, so there's nothing to gate here.
   ═══════════════════════════════════════════════════════════════ */

/* Atmosphere: real directional light + falloff instead of a flat two-stop
   gradient, so the table reads as a physically lit surface. */
.ir2-root{
  background:
    radial-gradient(46% 38% at 38% 8%, rgba(255,252,240,.65) 0%, transparent 60%),
    radial-gradient(120% 100% at 50% -6%, var(--wood-hi), transparent 55%),
    radial-gradient(80% 70% at 82% 96%, color-mix(in srgb, var(--wood-lo) 70%, #000 8%) 0%, transparent 60%),
    linear-gradient(180deg, var(--wood-hi), var(--wood) 46%, var(--wood-lo));
}
.ir2-grain{ opacity:.38; }
.ir2-vignette{ background:radial-gradient(90% 76% at 50% 46%, transparent 50%, rgba(46,32,14,.32) 100%); }

/* Ambient gold dust drifting through the scene (see the #ir2Dust canvas +
   its draw loop in the component below) — the single biggest thing that
   separates a lit scene with depth from a flat sticker-on-background look. */
#ir2Dust{ position:absolute; inset:0; z-index:2; pointer-events:none; }

/* The wax seal: same silhouette/gradient, a slightly irregular hand-poured
   edge instead of a perfectly smooth vector blob (feDisplacementMap, see
   the ir2-wax-relief filter def in the component), a harder closer
   highlight, and a real cast shadow. */
.ir2-seal svg{ filter:url(#ir2-wax-relief); }
.ir2-seal{ filter:drop-shadow(0 10px 16px rgba(40,26,8,.55)) drop-shadow(0 2px 3px rgba(40,26,8,.4)); }
.ir2-seal-sheen::before{ background:linear-gradient(116deg, transparent 40%, rgba(255,255,255,.65) 50%, transparent 60%); }

/* The seal actually shatters now instead of just floating off intact: a
   crack draws across it as it's pressed, then a light-burst flash plus
   five small wax chips fly outward with rotation right as it breaks. Both
   sit at the seal's own coordinates so they track the envelope's floaty/
   press/lift transforms correctly. */
.ir2-crack{ position:absolute; inset:0; pointer-events:none; opacity:0; }
.ir2-crack path{
  fill:none; stroke:var(--wax-hi); stroke-width:1.4; stroke-linecap:round;
  stroke-dasharray:120; stroke-dashoffset:120;
  filter:drop-shadow(0 0 3px rgba(255,240,200,.9));
}
.ir2-root.ir2-pressing .ir2-crack{ opacity:1; transition:opacity .05s linear; }
.ir2-root.ir2-pressing .ir2-crack path{ animation:ir2CrackDraw .3s cubic-bezier(.3,.8,.4,1) forwards; }
.ir2-root.ir2-opening .ir2-crack{ opacity:0; transition:opacity .25s ease .15s; }
@keyframes ir2CrackDraw{ to{ stroke-dashoffset:0; } }

.ir2-flash{
  position:absolute; left:50%; top:47%; width:34%; aspect-ratio:1; z-index:10;
  transform:translate(-50%,-50%) scale(.4); border-radius:50%; pointer-events:none; opacity:0;
  background:radial-gradient(circle, rgba(255,248,222,.95) 0%, rgba(255,224,150,.55) 38%, transparent 72%);
}
.ir2-root.ir2-opening .ir2-flash{ animation:ir2Flash .45s ease-out forwards; }
@keyframes ir2Flash{
  0%{ opacity:0; transform:translate(-50%,-50%) scale(.4); }
  32%{ opacity:1; transform:translate(-50%,-50%) scale(1.35); }
  100%{ opacity:0; transform:translate(-50%,-50%) scale(2.3); }
}

.ir2-chip{
  position:absolute; left:50%; top:47%; width:9%; aspect-ratio:1; z-index:9.5;
  background:linear-gradient(145deg, var(--wax-hi), var(--wax) 55%, var(--wax-lo));
  clip-path:polygon(50% 0%, 100% 38%, 78% 100%, 12% 84%, 0% 30%);
  opacity:0; pointer-events:none;
  transform:translate(-50%,-50%) scale(.35) rotate(0deg);
  transition:transform .6s cubic-bezier(.15,.7,.3,1), opacity .5s ease;
}
.ir2-root.ir2-opening .ir2-chip{ opacity:1; }
.ir2-root.ir2-lift .ir2-chip{ opacity:0; transition-delay:.4s; }
.ir2-root.ir2-opening .ir2-chip.c1{ transform:translate(calc(-50% - 15%), calc(-47% - 13%)) scale(.85) rotate(-75deg); }
.ir2-root.ir2-opening .ir2-chip.c2{ transform:translate(calc(-50% + 17%), calc(-47% - 9%)) scale(.65) rotate(58deg); }
.ir2-root.ir2-opening .ir2-chip.c3{ transform:translate(calc(-50% + 11%), calc(-47% + 15%)) scale(.8) rotate(122deg); }
.ir2-root.ir2-opening .ir2-chip.c4{ transform:translate(calc(-50% - 13%), calc(-47% + 14%)) scale(.55) rotate(-108deg); }
.ir2-root.ir2-opening .ir2-chip.c5{ transform:translate(-50%, calc(-47% - 20%)) scale(.7) rotate(28deg); }

/* the wax "gives" a beat before it actually cracks */
.ir2-root.ir2-pressing .ir2-bow{ animation:ir2BowWobble .4s ease-in-out; }
@keyframes ir2BowWobble{
  0%,100%{ transform:translate(-50%,-50%) scale(.95) rotate(0deg); }
  35%{ transform:translate(-50%,-50%) scale(.95) rotate(-3.5deg); }
  70%{ transform:translate(-50%,-50%) scale(.95) rotate(2.5deg); }
}

/* the flap overshoots slightly past vertical before settling back — real
   card-stock "give" instead of a rigid door hinge — gains a harder shadow
   mid-swing, and a crease highlight along its fold hinge while lifted. */
.ir2-root.ir2-opening .ir2-flap{
  transform:rotateX(-182deg);
  transition:transform 1.4s cubic-bezier(.3,1.4,.35,1), z-index 0s linear .55s;
}
.ir2-flap-face{ filter:drop-shadow(0 0 0 rgba(0,0,0,0)); transition:filter 1.2s ease; }
.ir2-root.ir2-lift .ir2-flap-face{ filter:drop-shadow(0 14px 22px rgba(20,12,4,.35)); }
.ir2-flap-face.front{ position:relative; }
.ir2-flap-face.front::before{
  content:''; position:absolute; left:6%; right:6%; top:0; height:2px;
  background:linear-gradient(90deg, transparent, rgba(255,250,232,.85) 50%, transparent);
  opacity:0; transition:opacity .5s ease;
}
.ir2-root.ir2-lift .ir2-flap-face.front::before{ opacity:.85; }
.ir2-root.ir2-rise .ir2-flap-face.front::before{ opacity:0; }
.ir2-flap-face.front::after{ background:linear-gradient(180deg, rgba(255,255,255,.4), transparent 50%); }
.ir2-root.ir2-opening .ir2-liner{ box-shadow: inset 0 -18px 30px -10px rgba(0,0,0,.18); }
.ir2-body{ box-shadow:0 30px 60px -22px rgba(40,26,8,.55), 0 6px 16px -6px rgba(40,26,8,.35), inset 0 1px 0 rgba(255,255,255,.55), inset 0 0 40px rgba(90,70,40,.08); }

/* the whole tabletop very slightly pushes in and fades as the reveal
   grows, like a camera dollying toward the invitation rather than a flat
   element being CSS-scaled in place; table props soften out of focus.
   The fade (not just the scale) is what actually clears the scene out of
   the way for the expand panel — 'grow' and `expanded` are set in the same
   breath in openSeal below, so this stays in sync with it without needing
   its own separate state to read across from the portal. */
.ir2-scene{ transition:transform 1.6s cubic-bezier(.16,1,.3,1), opacity 1.2s ease .3s; }
.ir2-root.ir2-grow .ir2-scene{ transform:scale(1.035); opacity:0; pointer-events:none; }
.ir2-table-prop{ transition:opacity .7s ease, filter 1.1s ease; }
.ir2-root.ir2-rise .ir2-table-prop{ filter:blur(3px); }

/* The small in-place card that used to be visible for a beat during
   'rise' before fading into a completely different-looking full-screen
   panel — reading as two unrelated designs stitched together regardless
   of how well either was executed — has been removed entirely (both its
   markup above and its own CSS) rather than left invisible-but-present.
   The full-screen reveal that replaces it: a generously large stationery
   sheet (not the cramped small card, not a boundary-less void) reusing the
   same deckle edge / corner flourish / wreath artwork already used
   elsewhere in this design, expanding from roughly the envelope's own
   position. Rendered through a React portal into document.body (see the
   component) because .ir2-env-wrap's 3D perspective/transform would
   otherwise trap a nested `position:fixed` panel instead of letting it
   cover the real viewport. */
.ir2-expand{
  position:fixed; inset:0; z-index:1500;
  display:flex; align-items:center; justify-content:center;
  padding:5vh 5vw;
  opacity:0; pointer-events:none;
  transition:opacity .35s ease;
}
.ir2-expand.ir2-expand-visible{ opacity:1; pointer-events:auto; }
.ir2-expand.ir2-expand-closing{ opacity:0 !important; transition:opacity .8s ease; pointer-events:none; }

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

/* the calligraphic "Welcome, {name}" address label on the closed envelope,
   promoted to a bolder size so it reads as real handwriting on stationery. */
.ir2-addr-hi{ font-size:clamp(26px,7vw,38px); }

/* On-brand gold focus rings on every interactive element in this overlay —
   none of them had :focus-visible styling before, meaning a keyboard user
   got the browser-default blue outline, clashing with this palette. */
.ir2-skip:focus-visible, .ir2-langchip:focus-visible, .ir2-envelope:focus-visible, .ir2-e-cta:focus-visible{
  outline:2px solid var(--gold); outline-offset:3px;
}
`;
