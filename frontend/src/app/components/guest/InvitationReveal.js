"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { lighten, darken, alpha } from "../../utils/color";
import { getCelebrationPreset } from "../../utils/patternCelebration";
import { FloatingParticles } from "./GuestAnimations";
import WaxSeal3D from "./WaxSeal3D";

/* ═══════════════════════════════════════════════════════════════════════════
   InvitationReveal — "The Unsealing"

   ONE cinematic opening shared by both guest reveals (replaces the old
   GuestEnvelopeReveal + DigitalEnvelope):

     • mode="invitation"  first thing a guest sees on the event page /[slug].
     • mode="rsvp"        gates the RSVP route; seal personalised with the
                          guest's own name; per-session "seen" memory.

   A candlelit envelope holds a REAL 3D metallic wax seal (WaxSeal3D, WebGL2).
   Tap the seal → it cracks → the envelope unfolds on a 3D gold-lined hinge →
   a large invitation card rises out → the overlay dissolves into the live page.

   Everything is generated — NO image uploads. The seal's metal + the scene's
   gold are derived from the event's own custom_colors.

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

/* Four engraved corner flourishes for a stationery card. */
function CornerOrnaments({ color }) {
  const corners = [
    { top: 10, left: 10, rotate: "0deg" },
    { top: 10, right: 10, rotate: "90deg" },
    { bottom: 10, right: 10, rotate: "180deg" },
    { bottom: 10, left: 10, rotate: "270deg" },
  ];
  return corners.map((pos, i) => (
    <svg key={i} width="30" height="30" viewBox="0 0 40 40" aria-hidden
      style={{ position: "absolute", top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, transform: `rotate(${pos.rotate})`, opacity: 0.55, pointerEvents: "none" }}>
      <path d="M3 3 Q3 12 8 18 Q14 24 22 26" fill="none" stroke={color} strokeWidth="0.9" />
      <path d="M3 3 Q12 3 18 8 Q24 14 26 22" fill="none" stroke={color} strokeWidth="0.9" />
      <circle cx="3" cy="3" r="1.5" fill={color} />
    </svg>
  ));
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

  // 0 preload · 1 settle · 2 rest · 3 pressing · 4 opening · 5 done
  const [stage, setStage] = useState(0);
  const [lang, setLang] = useState(langProp || "en");
  const timers = useRef([]);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);

  const colors = event?.custom_colors || {};
  const metal = colors.secondary || colors.primary || "#e0b24e";
  const gold = colors.secondary || "#e7c778";
  const P = useMemo(() => ({
    metal,
    g1: lighten(gold, 0.5),
    g2: gold,
    g3: darken(gold, 0.22),
    g4: darken(gold, 0.45),
    ink: "#f3ead6",
    soft: "#c9b48c",
    paperInk: "#2a2011",
  }), [metal, gold]);

  const td = event?.template_data || {};
  const hasArabic = !!(event?.title_ar || td.title_ar || isArabic(event?.title));
  const identity = useMemo(() => deriveIdentity(event, lang), [event, lang]);
  const gSeal = mode === "rsvp" ? guestSealText(guestName) : null;
  const sealText = gSeal || identity.sealText;
  const ambient = useMemo(() => getCelebrationPreset(event?.template_type), [event?.template_type]);

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
    en: { eyebrow: "You are invited", tap: "Tap the seal to open", special: "You are invited to our special day", enter: "View invitation", join: "request the honour of your presence" },
    ar: { eyebrow: "أنت مدعو", tap: "اضغط على الختم", special: "أنت مدعوّ ليومنا المميّز", enter: "عرض الدعوة", join: "يشرّفنا حضوركم" },
  }[lang];
  const isRTL = lang === "ar";
  const arTitle = event?.title_ar || td.title_ar;
  const displayTitle = isRTL && arTitle ? arTitle : identity.full;
  const dateStr = event?.event_date
    ? new Date(event.event_date).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "";
  const locationStr = event?.location_name || "";

  /* Paper + grain textures (data-URIs, built once). */
  const paper = useMemo(() =>
    "var(--ir-paper-noise), linear-gradient(158deg,#f3e9d1,#ddcba6 72%,#ccb787)", []);
  const noiseVars = useMemo(() => ({
    "--ir-paper-noise": "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/></filter><rect width='120' height='120' filter='url(%23p)'/></svg>\")",
  }), []);

  /* ─── Sequence control ─── */
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const after = useCallback((ms, fn) => { timers.current.push(setTimeout(fn, ms)); }, []);
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();
    markSeen();
    setStage(5);
    onComplete && onComplete();
  }, [clearTimers, markSeen, onComplete]);

  const openSeal = useCallback(() => {
    if (startedRef.current || finishedRef.current) return;
    startedRef.current = true;
    musicRef?.current?.play().catch((err) => console.error("Background music playback failed:", err));
    setStage(3);                      // seal cracks
    after(640, () => setStage(4));    // envelope unfolds, card rises, light
    after(1780, () => finish());      // dissolve into the live page
  }, [after, finish, musicRef]);

  useEffect(() => {
    if (prefersReduced || alreadySeen) return;
    after(120, () => setStage(1));
    after(920, () => setStage(2));
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (alreadySeen) return null;

  /* ═══ Reduced-motion fallback — a static luxury card, no choreography. ═══ */
  if (prefersReduced) {
    return (
      <motion.div
        data-testid="guest-envelope-reveal" role="dialog" aria-label="Open your invitation"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
        dir={isRTL ? "rtl" : "ltr"} style={{ ...overlayBase, background: SCENE_BG }}
      >
        <button type="button" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation" style={skipStyle(P)}>
          Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
        </button>
        <div style={{ position: "relative", width: "100%", maxWidth: 420, textAlign: "center", padding: "44px 30px", borderRadius: 12, color: P.paperInk, backgroundColor: "#e9dfc6", backgroundImage: paper, backgroundSize: "120px 120px, cover", border: `1px solid ${alpha(P.g4, 0.5)}`, boxShadow: "0 40px 90px -30px #000, inset 0 0 0 1px rgba(255,255,255,.3)", ...noiseVars }}>
          <CornerOrnaments color={P.g3} />
          <div style={{ width: 128, height: 128, margin: "0 auto 16px", position: "relative" }}>
            <WaxSeal3D text={sealText} color={metal} interactive={false} animate={false} />
          </div>
          <div style={{ fontSize: 10.5, letterSpacing: "0.36em", textTransform: "uppercase", color: P.g4, fontWeight: 700 }}>{copy.eyebrow}</div>
          <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "clamp(26px,7vw,38px)", margin: "12px 0 6px", color: "#3a2a12", fontWeight: 500 }}>{displayTitle}</h1>
          <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontSize: 14, color: "#6a5a3c", margin: 0 }}>{copy.join}</p>
          {dateStr && <div style={{ marginTop: 18, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#4a3a20", fontWeight: 600 }}>{dateStr}</div>}
          <button type="button" onClick={() => { musicRef?.current?.play().catch(() => {}); finish(); }} style={enterBtnStyle(P)}>
            {copy.enter} <span aria-hidden style={{ marginInlineStart: 8 }}>{isRTL ? "←" : "→"}</span>
          </button>
        </div>
      </motion.div>
    );
  }

  const pressing = stage === 3;
  const opening = stage >= 4;
  const sceneClass = `ir-scene${pressing ? " pressing" : ""}${opening ? " opening" : ""}`;

  return (
    <motion.div
      data-testid="guest-envelope-reveal" role="dialog" aria-label="Open your invitation"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.35, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } }}
      transition={{ duration: 0.6 }}
      dir={isRTL ? "rtl" : "ltr"}
      className={sceneClass}
      style={{ ...overlayBase, background: SCENE_BG, ...noiseVars }}
    >
      <style dangerouslySetInnerHTML={{ __html: REVEAL_CSS }} />
      <div className="ir-flicker" aria-hidden />

      {/* ambient particles matched to the event */}
      <motion.div aria-hidden initial={false} animate={{ opacity: opening ? 0 : 1 }} transition={{ duration: 0.6 }} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
        <FloatingParticles count={18} color={ambient.ambientColor || P.g2} shape={ambient.ambient} />
      </motion.div>

      {/* language chip */}
      <div style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineEnd: 16, zIndex: 8 }}>
        <button type="button" onClick={() => hasArabic && setLang((l) => (l === "en" ? "ar" : "en"))} aria-label={hasArabic ? "Toggle language" : "Language"} style={langChipStyle(!!hasArabic, P)}>
          <span aria-hidden style={{ fontSize: 15, opacity: 0.7 }}>🌐</span>
          <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{lang === "en" ? "EN" : "ع"}</span>
        </button>
      </div>

      <button type="button" data-testid="guest-envelope-skip" onClick={finish} aria-label="Skip invitation animation" style={skipStyle(P)}>
        Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
      </button>

      {/* eyebrow + title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: stage >= 1 && !opening ? 1 : 0, y: stage >= 1 && !opening ? 0 : 10 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", zIndex: 4, textAlign: "center", marginBottom: "clamp(14px,3vh,26px)", padding: "0 24px" }}
      >
        <span style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.42em", fontWeight: 700, color: P.g2, marginBottom: 9 }}>
          {mode === "rsvp" && guestName ? (isRTL ? `مرحباً ${guestName}` : `Welcome, ${guestName}`) : copy.eyebrow}
        </span>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "clamp(20px,4.8vw,30px)", fontWeight: 500, lineHeight: 1.15, color: "#efe2c4", margin: 0, textShadow: "0 2px 18px rgba(0,0,0,.6)" }}>
          {displayTitle}
        </h1>
      </motion.div>

      {/* ── the envelope ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 14 }}
        animate={{ opacity: stage >= 1 ? 1 : 0, scale: stage >= 1 ? 1 : 0.92, y: stage >= 1 ? 0 : 14 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="ir-envStage"
        onClick={openSeal}
      >
        <div className="ir-glow" aria-hidden />
        <div className="ir-env">
          <div className="ir-pocket ir-paper" aria-hidden />
          <div className="ir-card ir-paper">
            <div className="ir-cardInner">
              <div className="ir-crest" aria-hidden>✦</div>
              <div className="ir-cn-ov">{copy.eyebrow}</div>
              <div className="ir-cn-nm">{displayTitle}</div>
              {dateStr && <div className="ir-cn-dt">{dateStr}</div>}
              {locationStr && <div className="ir-cn-loc">{locationStr}</div>}
            </div>
          </div>
          <div className="ir-front" aria-hidden>
            <svg viewBox="0 0 340 197" preserveAspectRatio="none">
              <defs><linearGradient id="irpf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9dcbe" /><stop offset="1" stopColor="#cbb488" /></linearGradient></defs>
              <path d="M0,0 L162,120 L0,197 Z" fill="#e2d2ac" />
              <path d="M340,0 L178,120 L340,197 Z" fill="#e2d2ac" />
              <path d="M0,197 L170,86 L340,197 Z" fill="url(#irpf)" />
              <path d="M0,197 L170,86 L340,197 Z" fill="none" stroke="rgba(90,60,30,.16)" strokeWidth="1" />
            </svg>
          </div>
          <div className="ir-flapShadow" aria-hidden />
          <div className="ir-flap" aria-hidden><div className="ir-flapFace ir-paper" /></div>
          <div className="ir-sealMount">
            <WaxSeal3D text={sealText} color={metal} breaking={stage >= 3} interactive={stage < 3} />
          </div>
        </div>
      </motion.div>

      {/* volumetric gold light on open */}
      <div className="ir-rays" aria-hidden />
      <div className="ir-bloom" aria-hidden />

      {/* resting prompt */}
      <AnimatePresence>
        {stage === 2 && (
          <motion.div key="p" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.3 } }} transition={{ duration: 0.6, delay: 0.2 }}
            style={{ position: "relative", zIndex: 4, textAlign: "center", marginTop: "clamp(16px,4vh,30px)", padding: "0 24px" }}>
            <div className="ir-prompt" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 20px", borderRadius: 999, background: "rgba(255,246,224,.06)", border: `1px solid ${alpha(P.g2, 0.32)}`, backdropFilter: "blur(6px)" }}>
              <span aria-hidden style={{ fontSize: 12 }}>✦</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: P.g1 }}>{copy.tap}</span>
            </div>
            <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontSize: 13, color: P.soft, marginTop: 14 }}>{copy.special}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── shared styles ─── */
const SCENE_BG = "radial-gradient(65% 55% at 50% 34%, #33220f 0%, #1a1310 46%, #0b0809 78%, #07060a 100%)";
const overlayBase = {
  position: "fixed", inset: 0, zIndex: 1000, overflow: "hidden",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  fontFamily: "var(--font-sans)", padding: 24,
};
const skipStyle = (P) => ({
  position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineStart: 20, zIndex: 8,
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", minHeight: 44, borderRadius: 999,
  border: `1px solid ${alpha(P.g2, 0.3)}`, background: "rgba(255,246,224,.06)", backdropFilter: "blur(8px)",
  color: P.g1, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "var(--font-sans)",
});
const langChipStyle = (active, P) => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", minHeight: 44, borderRadius: 999,
  border: `1px solid ${alpha(P.g2, 0.25)}`, background: "rgba(255,246,224,.06)", backdropFilter: "blur(8px)",
  color: P.g1, fontSize: 13, fontFamily: "var(--font-sans)", cursor: active ? "pointer" : "default",
});
const enterBtnStyle = (P) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 24, padding: "14px 32px", borderRadius: 999,
  border: "none", background: `linear-gradient(180deg, ${P.g1}, ${P.g3})`, color: "#241a06",
  fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
  boxShadow: `0 12px 28px ${alpha(P.g3, 0.4)}, inset 0 1px 0 rgba(255,255,255,.5)`,
});

const REVEAL_CSS = `
.ir-flicker{ position:absolute; inset:0; z-index:1; pointer-events:none;
  background:radial-gradient(42% 36% at 50% 34%, rgba(255,206,130,.16), transparent 70%); animation:irFlicker 5s ease-in-out infinite; }
@keyframes irFlicker{ 0%,100%{opacity:.85} 42%{opacity:1} 55%{opacity:.78} 70%{opacity:.95} }

.ir-paper{ background-color:#e9dfc6; background-image:var(--ir-paper-noise), linear-gradient(158deg,#f3e9d1,#ddcba6 72%,#ccb787);
  background-blend-mode:multiply,normal; background-size:120px 120px, cover; }

.ir-envStage{ position:relative; z-index:3; width:min(86vw,330px); aspect-ratio:340/326; perspective:1500px; cursor:pointer; }
.ir-glow{ position:absolute; inset:-16%; border-radius:50%; z-index:-1; pointer-events:none;
  background:radial-gradient(circle,rgba(255,206,120,.3),transparent 66%); filter:blur(16px); animation:irHalo 5s ease-in-out infinite; }
@keyframes irHalo{ 0%,100%{opacity:.55} 50%{opacity:.85} }
.ir-env{ position:absolute; inset:0; transform-style:preserve-3d; transition:transform 1s cubic-bezier(.22,1,.36,1); }
.ir-scene.opening .ir-env{ transform:translateY(6px) scale(.985); }
.ir-pocket{ position:absolute; left:0; right:0; bottom:0; height:62%; border-radius:5px 5px 13px 13px;
  box-shadow:0 36px 68px -18px rgba(0,0,0,.78), inset 0 0 30px rgba(90,60,30,.22); }
.ir-pocket::after{ content:""; position:absolute; inset:6px 6px 42% 6px; border-radius:4px 4px 0 0;
  background:linear-gradient(135deg,#8a6a24,#fff2c4 24%,#c69a45 48%,#fff5d6 64%,#8a6a24 86%,#e7c778); opacity:0; transition:opacity .5s ease .35s; box-shadow:inset 0 0 26px rgba(120,80,20,.35); }
.ir-scene.opening .ir-pocket::after{ opacity:.92; }
.ir-card{ position:absolute; left:8%; right:8%; bottom:9px; height:96%; border-radius:7px; overflow:hidden; z-index:2;
  transform:translateY(0) scale(.965); transform-origin:bottom center;
  box-shadow:0 24px 54px -20px rgba(0,0,0,.7), inset 0 0 0 1px rgba(160,120,60,.28); transition:transform 1.15s cubic-bezier(.16,1,.3,1); }
.ir-scene.opening .ir-card{ transform:translateY(-50%) scale(1); z-index:8; }
.ir-cardInner{ position:absolute; top:0; left:0; right:0; padding:20px 16px 0; text-align:center; color:#2a2011; }
.ir-crest{ font-size:16px; color:#a9863d; }
.ir-cn-ov{ font-size:8px; letter-spacing:.3em; text-transform:uppercase; color:#9a8358; font-weight:700; margin-top:8px; }
.ir-cn-nm{ font-family:var(--font-serif),Georgia,serif; font-size:clamp(15px,4.4vw,21px); margin:7px 0 4px; color:#2a2011; line-height:1.15; }
.ir-cn-dt{ font-size:9px; letter-spacing:.1em; color:#7a6a4a; }
.ir-cn-loc{ font-size:8.5px; letter-spacing:.06em; color:#8a7a58; margin-top:2px; }
.ir-front{ position:absolute; left:0; right:0; bottom:0; height:62%; z-index:3; pointer-events:none; }
.ir-front svg{ width:100%; height:100%; display:block; filter:drop-shadow(0 -2px 6px rgba(70,45,18,.22)); }
.ir-flapShadow{ position:absolute; left:8%; right:8%; top:33%; height:28%; z-index:5; pointer-events:none;
  background:radial-gradient(60% 100% at 50% 0,rgba(0,0,0,.5),transparent 72%); opacity:0; transition:opacity .5s ease; }
.ir-scene.opening .ir-flapShadow{ opacity:.5; }
.ir-flap{ position:absolute; left:0; right:0; top:0; height:53%; transform-origin:50% 100%; transform-style:preserve-3d; z-index:7;
  transition:transform 1s cubic-bezier(.62,-0.15,.2,1); }
.ir-scene.opening .ir-flap{ transform:rotateX(160deg); }
.ir-flapFace{ position:absolute; inset:0; clip-path:polygon(0 0,100% 0,50% 100%); box-shadow:0 8px 18px rgba(0,0,0,.35); }
.ir-sealMount{ position:absolute; left:50%; top:47%; width:37%; aspect-ratio:1; transform:translate(-50%,-50%); z-index:9;
  filter:drop-shadow(0 12px 18px rgba(0,0,0,.55)); transition:opacity .55s ease, transform .7s cubic-bezier(.4,0,.2,1); }
.ir-scene.opening .ir-sealMount{ opacity:0; transform:translate(-50%,-84%) scale(.6); pointer-events:none; }

.ir-rays,.ir-bloom{ position:absolute; top:44%; left:50%; transform:translate(-50%,-50%); z-index:2; pointer-events:none; opacity:0; transition:opacity 1s ease; }
.ir-rays{ width:150vw; height:150vw; max-width:900px; max-height:900px;
  background:repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,226,158,0) 0deg, rgba(255,226,158,.5) 3deg, rgba(255,226,158,0) 8deg);
  -webkit-mask-image:radial-gradient(circle,#000 6%,rgba(0,0,0,.4) 34%,transparent 66%); mask-image:radial-gradient(circle,#000 6%,rgba(0,0,0,.4) 34%,transparent 66%);
  animation:irSpin 26s linear infinite; }
.ir-bloom{ width:80vw; height:80vw; max-width:520px; max-height:520px; filter:blur(8px);
  background:radial-gradient(circle at 50% 45%, #fff7e0 0%, rgba(247,205,114,.45) 26%, transparent 62%); }
@keyframes irSpin{ to{ transform:translate(-50%,-50%) rotate(360deg) } }
.ir-scene.opening .ir-rays{ opacity:.8; }
.ir-scene.opening .ir-bloom{ opacity:1; }

.ir-prompt{ animation:irNudge 2.2s ease-in-out infinite; }
@keyframes irNudge{ 0%,100%{transform:translateY(0);opacity:.82} 50%{transform:translateY(-3px);opacity:1} }

@media (prefers-reduced-motion:reduce){
  .ir-flicker,.ir-glow,.ir-rays,.ir-prompt{ animation:none !important; }
}
`;
