"use client";

import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useIsClient } from "../../utils/useIsClient";

/* ═══════════════════════════════════════════════════════════════════════════
   HeroEnvelope — a compact, toggleable showcase built from the same botanical
   "wax-sealed envelope → wreathed invitation card" reveal used for real guests
   (see components/guest/InvitationReveal.js). This is a deliberately separate,
   self-contained implementation — not a reuse of that component — because the
   guest reveal is a full-viewport, one-shot overlay tied to real event/RSVP
   data, while this is a small embedded, endlessly-toggleable marketing demo.
   It borrows the same materials and motion language: a ribbon-tied wax seal,
   a watercolour wreath card, a deckled paper edge, and a clip-path + tilt
   emergence (not a fade) so the card genuinely looks like it slides out from
   under the flap.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HeroEnvelope() {
  const isClient = useIsClient();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const teaserRef = useRef(null);

  // Sparkle positions randomised once per mount; gated behind isClient so
  // Math.random() never runs during SSR (would cause a hydration mismatch).
  const [sparkles] = useState(() => Array.from({ length: 14 }, (_, i) => ({
    id: i,
    x: 4 + Math.random() * 92,
    y: 4 + Math.random() * 92,
    size: 2 + Math.random() * 3.4,
    delay: Math.random() * 6,
    dur: 2.4 + Math.random() * 3,
  })));

  useEffect(() => {
    if (!isClient || reduceMotion) return;
    teaserRef.current = setTimeout(() => setOpen(true), 2200);
    return () => clearTimeout(teaserRef.current);
  }, [isClient, reduceMotion]);

  const toggle = () => {
    if (teaserRef.current) clearTimeout(teaserRef.current);
    setInteracted(true);
    setOpen((o) => !o);
  };

  if (!isClient) return <div style={{ width: "100%", maxWidth: 300, height: 400 }} />;

  return (
    <div className="he-wrap animate-slide-in-right">
      <div className="he-amb he-amb-1" aria-hidden />
      <div className="he-amb he-amb-2" aria-hidden />
      <div className="he-sparkles" aria-hidden>
        {sparkles.map((s) => (
          <div key={s.id} className="he-spark" style={{
            left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px`,
            animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`,
          }} />
        ))}
      </div>

      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <filter id="he-wc" x="-22%" y="-22%" width="144%" height="144%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
          <linearGradient id="he-leafG" x1="0.12" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#f0e2b4" />
            <stop offset="52%" stopColor="#cba556" />
            <stop offset="100%" stopColor="#8f6d2c" />
          </linearGradient>
          <radialGradient id="he-waxg" cx="37%" cy="31%" r="78%">
            <stop offset="0%" stopColor="#ecca86" />
            <stop offset="48%" stopColor="#b8944f" />
            <stop offset="100%" stopColor="#755522" />
          </radialGradient>

          <symbol id="he-leaf" viewBox="0 0 22 28">
            <path d="M11 0 C18 2 22 9 22 15 C22 23 16 28 11 28 C6 28 0 23 0 15 C0 9 4 2 11 0 Z" fill="url(#he-leafG)" stroke="#8f6d2c" strokeWidth=".6" strokeOpacity=".28" />
            <path d="M11 3 C15 4 18 9 18 14 C18 19 15 22 11 22 C9 22 6 20 6 15 C6 10 8 5 11 3 Z" fill="#f0e2b4" opacity=".4" />
            <path d="M11 4 C11 12 11 19 11 25" fill="none" stroke="#8f6d2c" strokeWidth=".7" opacity=".26" />
          </symbol>
          <symbol id="he-leaf-mono" viewBox="0 0 22 28">
            <path d="M11 0 C18 2 22 9 22 15 C22 23 16 28 11 28 C6 28 0 23 0 15 C0 9 4 2 11 0 Z" fill="currentColor" />
            <path d="M11 4 C11 12 11 19 11 25" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".45" />
          </symbol>
          <symbol id="he-flower" viewBox="0 0 40 40">
            <g filter="url(#he-wc)">
              <circle cx="20" cy="13" r="8.4" fill="#f8ecd2" opacity=".92" />
              <circle cx="11" cy="21" r="8.2" fill="#f8ecd2" opacity=".88" />
              <circle cx="29" cy="21" r="8.2" fill="#f8ecd2" opacity=".88" />
              <circle cx="14" cy="30" r="7.4" fill="#f8ecd2" opacity=".82" />
              <circle cx="26" cy="30" r="7.4" fill="#f8ecd2" opacity=".82" />
              <circle cx="20" cy="23" r="5.6" fill="#c9a24b" opacity=".55" />
              <circle cx="20" cy="23" r="2.4" fill="#e6c069" opacity=".8" />
            </g>
          </symbol>
          <symbol id="he-sprig" viewBox="0 0 220 262">
            <g filter="url(#he-wc)">
              <path d="M176 260 C150 212 150 150 120 100 C100 66 92 40 80 14" fill="none" stroke="currentColor" strokeWidth="2.6" opacity=".38" />
              <use href="#he-leaf" width="22" height="28" transform="translate(150 206) rotate(-48) scale(1.55)" opacity=".9" />
              <use href="#he-leaf" width="22" height="28" transform="translate(178 196) rotate(52) scale(1.5)" />
              <use href="#he-leaf" width="22" height="28" transform="translate(132 168) rotate(-44) scale(1.4)" opacity=".92" />
              <use href="#he-leaf" width="22" height="28" transform="translate(160 158) rotate(56) scale(1.36)" />
              <use href="#he-leaf" width="22" height="28" transform="translate(114 132) rotate(-40) scale(1.24)" opacity=".92" />
              <use href="#he-leaf" width="22" height="28" transform="translate(142 122) rotate(58) scale(1.2)" />
            </g>
          </symbol>
          <symbol id="he-wreath" viewBox="0 0 300 300">
            <g filter="url(#he-wc)">
              <use href="#he-flower" width="30" height="30" transform="translate(135 10) rotate(0)" />
              <use href="#he-leaf" width="20" height="26" transform="translate(198 26) rotate(32) scale(1.1)" />
              <use href="#he-leaf" width="20" height="26" transform="translate(242 68) rotate(60) scale(1.15)" />
              <use href="#he-flower" width="28" height="28" transform="translate(238 208) rotate(120) scale(.95)" />
              <use href="#he-leaf" width="20" height="26" transform="translate(198 254) rotate(148) scale(1.1)" />
              <use href="#he-leaf" width="20" height="26" transform="translate(140 270) rotate(180) scale(1.15)" />
              <use href="#he-leaf" width="20" height="26" transform="translate(84 254) rotate(212) scale(1.1)" />
              <use href="#he-flower" width="28" height="28" transform="translate(38 206) rotate(240) scale(.95)" />
              <use href="#he-leaf" width="20" height="26" transform="translate(42 66) rotate(300) scale(1.1)" />
              <use href="#he-leaf" width="20" height="26" transform="translate(84 24) rotate(328) scale(1.1)" />
              <use href="#he-leaf" width="15" height="20" transform="translate(182 50) rotate(45) scale(.9)" opacity=".85" />
              <use href="#he-leaf" width="15" height="20" transform="translate(182 220) rotate(135) scale(.9)" opacity=".85" />
              <use href="#he-leaf" width="15" height="20" transform="translate(98 220) rotate(225) scale(.9)" opacity=".85" />
              <use href="#he-leaf" width="15" height="20" transform="translate(98 50) rotate(315) scale(.9)" opacity=".85" />
            </g>
          </symbol>
          <symbol id="he-flourish-corner" viewBox="0 0 90 90">
            <path d="M6,52 C6,26 26,6 52,6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M52,6 C64,6 71,9.5 73,16 C75,21.6 70,25.6 64,23" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M6,52 C6,64 9.5,71 16,73 C21.6,75 25.6,70 23,64" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="73" cy="16" r="1.6" fill="currentColor" />
            <circle cx="16" cy="73" r="1.6" fill="currentColor" />
            <use href="#he-leaf" width="16" height="20" transform="translate(22 22) rotate(-45) scale(.95)" opacity=".85" />
          </symbol>
          <symbol id="he-flourish-divider" viewBox="0 0 220 24">
            <path d="M4,16 C22,4 36,22 54,12 C64,6 74,9 84,11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
            <path d="M216,16 C198,4 184,22 166,12 C156,6 146,9 136,11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
            <circle cx="4" cy="16" r="1.7" fill="currentColor" opacity=".75" />
            <circle cx="216" cy="16" r="1.7" fill="currentColor" opacity=".75" />
            <rect x="106.5" y="8.5" width="7" height="7" transform="rotate(45 110 12)" fill="currentColor" />
          </symbol>
          <symbol id="he-bow" viewBox="0 0 100 70">
            <path d="M50 30 C50 30 20 8 8 20 C-2 32 12 48 50 34" fill="currentColor" opacity=".92" />
            <path d="M50 30 C50 30 80 8 92 20 C102 32 88 48 50 34" fill="currentColor" opacity=".92" />
            <path d="M45 32 L34 68 L46 58 L50 34 Z" fill="currentColor" opacity=".85" />
            <path d="M55 32 L66 68 L54 58 L50 34 Z" fill="currentColor" opacity=".85" />
            <ellipse cx="50" cy="32" rx="9" ry="6.5" fill="currentColor" />
            <ellipse cx="50" cy="32" rx="9" ry="6.5" fill="#000" opacity=".14" />
          </symbol>
        </defs>
      </svg>

      <div
        className={`he-stage${open ? " open" : ""}`}
        role="button" tabIndex={0}
        aria-label={open ? "Close invitation preview" : "Open invitation preview"}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
      >
        {/* the aria-label above already fully describes this control, so the
            envelope/card artwork (including its placeholder example text) is
            purely decorative — hidden as a whole rather than piecemeal. */}
        <div className="he-floaty" aria-hidden="true">
          <div className="he-contact" />
          <div className="he-envelope">
            <div className="he-liner" aria-hidden>
              <svg viewBox="0 0 200 104" preserveAspectRatio="xMidYMax slice" style={{ color: "#8f6d2c" }}>
                <use href="#he-sprig" width="220" height="262" transform="translate(-26 6) scale(.6)" />
                <use href="#he-sprig" width="220" height="262" transform="translate(214 8) scale(-.56,.56)" />
              </svg>
            </div>

            <div className="he-card-wrap">
              <div className="he-card he-deckle">
                <div className="he-card-inner">
                  <div className="he-card-frame" />
                  <div className="he-card-frame-inner" />
                  <svg className="he-wreath-art" viewBox="0 0 300 300" style={{ color: "#cba556" }} aria-hidden><use href="#he-wreath" width="300" height="300" /></svg>
                  <svg className="he-flourish-corner tl" viewBox="0 0 90 90" style={{ color: "#c9a24b" }} aria-hidden><use href="#he-flourish-corner" width="90" height="90" /></svg>
                  <svg className="he-flourish-corner tr" viewBox="0 0 90 90" style={{ color: "#c9a24b" }} aria-hidden><use href="#he-flourish-corner" width="90" height="90" /></svg>
                  <svg className="he-flourish-corner bl" viewBox="0 0 90 90" style={{ color: "#c9a24b" }} aria-hidden><use href="#he-flourish-corner" width="90" height="90" /></svg>
                  <svg className="he-flourish-corner br" viewBox="0 0 90 90" style={{ color: "#c9a24b" }} aria-hidden><use href="#he-flourish-corner" width="90" height="90" /></svg>

                  <div className="he-card-content">
                    <div className="he-fl-row">
                      <span className="he-fl-line" />
                      <div className="he-c-eyebrow">You Are Invited</div>
                      <span className="he-fl-line" />
                    </div>
                    <div className="he-c-names">Sophia &amp; James</div>
                    <svg className="he-c-divider" viewBox="0 0 220 24" aria-hidden>
                      <use href="#he-flourish-divider" width="220" height="24" style={{ color: "#c9a24b" }} />
                    </svg>
                    <div className="he-c-date">Saturday, June 20, 2026</div>
                    <div className="he-c-venue">The Plaza &middot; New York</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="he-body" />

            <div className="he-flap-shadow" aria-hidden />
            <div className="he-flap" aria-hidden>
              <div className="he-flap-face front" />
              <div className="he-flap-face back" />
            </div>

            <div className="he-ribbon" aria-hidden />
            <svg className="he-bow" viewBox="0 0 100 70" style={{ color: "#8a6d34" }} aria-hidden><use href="#he-bow" width="100" height="70" /></svg>

            <div className="he-seal" aria-hidden>
              <svg viewBox="0 0 100 100">
                <path d="M50 3 C61 3 63 12 72 15 C83 18 84 30 89 38 C95 47 90 56 91 66 C92 78 82 80 74 87 C65 94 57 90 50 92 C42 90 34 95 26 87 C17 79 9 79 9 66 C9 55 5 47 11 38 C16 30 17 18 28 15 C37 12 39 3 50 3 Z" fill="url(#he-waxg)" />
                <circle cx="50" cy="50" r="34" fill="none" stroke="#755522" strokeWidth="1.2" opacity=".5" />
                <use href="#he-leaf-mono" width="9" height="12" transform="translate(29 63) rotate(198) scale(.82)" style={{ color: "#755522" }} opacity=".5" />
                <use href="#he-leaf-mono" width="9" height="12" transform="translate(26 55) rotate(213) scale(.78)" style={{ color: "#755522" }} opacity=".55" />
                <use href="#he-leaf-mono" width="9" height="12" transform="translate(26 47) rotate(228) scale(.73)" style={{ color: "#755522" }} opacity=".58" />
                <use href="#he-leaf-mono" width="9" height="12" transform="translate(71 63) rotate(-18) scale(.82)" style={{ color: "#755522" }} opacity=".5" />
                <use href="#he-leaf-mono" width="9" height="12" transform="translate(74 55) rotate(-33) scale(.78)" style={{ color: "#755522" }} opacity=".55" />
                <use href="#he-leaf-mono" width="9" height="12" transform="translate(74 47) rotate(-48) scale(.73)" style={{ color: "#755522" }} opacity=".58" />
                <text x="50" y="53" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-serif)" fontSize="28" fill="#755522" opacity=".82" letterSpacing="1">SJ</text>
                <text x="49" y="52" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-serif)" fontSize="28" fill="#ecca86" opacity=".42" letterSpacing="1">SJ</text>
              </svg>
              <div className="he-seal-sheen" />
            </div>
          </div>
        </div>
      </div>

      <div className="he-tap-row" aria-hidden="true">
        {!open && !interacted && <span className="he-tap-pill">Tap to open</span>}
      </div>

      <div className={`he-label${open ? " he-label-flip" : ""}`}>
        <div className="he-label-dot" />
        <span>{open ? "Gilded Wedding Invitation" : "Interactive Envelope Reveal"}</span>
        <span className="he-label-action" onClick={toggle}>
          {open ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Click to close
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Click to open
            </>
          )}
        </span>
      </div>

      <style jsx>{`
        .he-wrap{ position:relative; width:100%; display:flex; flex-direction:column; align-items:center; gap:18px; }

        .he-amb{ position:absolute; border-radius:50%; pointer-events:none; filter:blur(40px); }
        .he-amb-1{ width:300px; height:300px; top:8%; right:6%; background:rgba(184,148,79,.07); animation:heAmb1 6s ease-in-out infinite; }
        .he-amb-2{ width:220px; height:220px; bottom:10%; left:8%; background:rgba(215,190,128,.05); animation:heAmb2 8s ease-in-out infinite; }
        @keyframes heAmb1{ 0%,100%{transform:translate(0,0) scale(1);opacity:1} 50%{transform:translate(10px,-14px) scale(1.14);opacity:.5} }
        @keyframes heAmb2{ 0%,100%{transform:translate(0,0) scale(1);opacity:.8} 50%{transform:translate(-8px,10px) scale(1.1);opacity:.4} }

        .he-sparkles{ position:absolute; inset:-18px; pointer-events:none; z-index:0; }
        .he-spark{ position:absolute; border-radius:50%; background:#d7be80; animation:heSparkle ease-in-out infinite; }
        @keyframes heSparkle{ 0%,100%{opacity:0;transform:scale(.5)} 50%{opacity:.55;transform:scale(1.15)} }

        .he-stage{ position:relative; z-index:2; width:100%; max-width:300px; cursor:pointer; }
        .he-floaty{ position:relative; transform-style:preserve-3d; animation:heFloaty 7.5s ease-in-out infinite; }
        @keyframes heFloaty{ 0%,100%{transform:translateY(0) rotateX(3deg) rotateZ(-.3deg)} 50%{transform:translateY(-6px) rotateX(5.5deg) rotateZ(.3deg)} }
        .he-stage.open .he-floaty{ animation-play-state:paused; }

        .he-contact{ position:absolute; left:6%; right:6%; bottom:-8%; height:20%; z-index:-1;
          background:radial-gradient(58% 100% at 50% 38%, rgba(90,66,26,.28), transparent 72%); filter:blur(14px); }

        .he-envelope{ position:relative; width:100%; aspect-ratio:1.52/1; transform-style:preserve-3d; perspective:1400px; }

        .he-body{ position:absolute; inset:0; border-radius:8px; z-index:2; background:#efe4cb;
          background-image:linear-gradient(150deg,#faf3e0,#efe4cb 52%,#d8c49c);
          box-shadow:0 20px 40px -18px rgba(70,52,20,.45), inset 0 1px 0 rgba(255,255,255,.5); }

        .he-flourish-corner{ position:absolute; width:16%; height:auto; pointer-events:none; }

        .he-ribbon{ position:absolute; left:50%; top:2%; bottom:2%; width:9%; transform:translateX(-50%); z-index:7;
          background:linear-gradient(90deg,#6b5427,#8a6d34 30%,#8a6d34 70%,#6b5427);
          box-shadow:inset 0 0 0 1px rgba(0,0,0,.08), 0 3px 6px rgba(40,30,16,.22);
          transition:opacity .5s ease, transform .6s cubic-bezier(.4,0,.2,1); }
        .he-stage.open .he-ribbon{ opacity:0; transform:translateX(-50%) scaleY(.7); }

        .he-bow{ position:absolute; left:50%; top:47%; width:30%; aspect-ratio:100/70; transform:translate(-50%,-50%); z-index:8;
          transition:transform .7s cubic-bezier(.5,0,.2,1), opacity .6s ease;
          filter:drop-shadow(0 4px 7px rgba(60,34,14,.35)); }
        .he-stage.open .he-bow{ transform:translate(-50%,-90%) scale(.55) rotate(10deg); opacity:0; }

        .he-deckle{ clip-path:polygon(
            0% 1%, 18% 0.3%, 36% 1%, 54% 0.2%, 72% 0.9%, 88% 0.2%, 100% 1%,
            99.3% 20%, 100% 42%, 99.4% 64%, 100% 86%, 99.3% 97%, 100% 99%,
            82% 99.3%, 64% 100%, 46% 99.2%, 28% 100%, 12% 99.4%, 0% 99%,
            0.5% 80%, 0% 58%, 0.6% 36%, 0% 18%, 0.5% 8%, 0% 3%); }

        .he-card-wrap{ position:absolute; left:9%; right:9%; top:8%; bottom:8%; z-index:1;
          transform-origin:center center;
          transform:translateY(2%) scale(.97) rotateX(-10deg);
          clip-path:inset(0 0 100% 0);
          transition:transform 1.05s cubic-bezier(.16,1,.3,1) .12s, clip-path 1.05s cubic-bezier(.16,1,.3,1) .12s, z-index 0s linear .2s; }
        .he-stage.open .he-card-wrap{ z-index:9; clip-path:inset(0 0 0% 0);
          transform:translateY(-58%) scale(1.36) rotateX(0deg); }
        .he-card{ position:absolute; inset:0; border-radius:4px; overflow:hidden; background:#fbf6ea;
          box-shadow:0 16px 34px -16px rgba(70,52,20,.5), inset 0 0 0 1px #ecdfc2; }
        .he-card-inner{ position:absolute; inset:0; background:radial-gradient(125% 96% at 50% 0%, #fffef8, #fbf6ea 76%); }
        .he-card-frame{ position:absolute; inset:6.5%; border:1px solid rgba(201,162,75,.5); border-radius:2px; pointer-events:none; }
        .he-card-frame-inner{ position:absolute; inset:8.8%; border:1px solid rgba(201,162,75,.26); border-radius:1px; pointer-events:none; }
        .he-wreath-art{ position:absolute; inset:9%; z-index:1; pointer-events:none; }
        .he-card .he-flourish-corner{ width:15%; opacity:.95; z-index:3; display:block; }
        .he-card .he-flourish-corner.tl{ top:6%; left:6%; }
        .he-card .he-flourish-corner.tr{ top:6%; right:6%; transform:scaleX(-1); }
        .he-card .he-flourish-corner.bl{ bottom:6%; left:6%; transform:scaleY(-1); }
        .he-card .he-flourish-corner.br{ bottom:6%; right:6%; transform:scale(-1,-1); }

        .he-card-content{ position:relative; z-index:2; width:100%; height:100%; padding:11% 12%;
          display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
        .he-fl-row{ display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:.5em; }
        .he-fl-line{ width:18px; height:1px; background:#c9a24b; opacity:.6; }
        .he-c-eyebrow{ font-family:var(--font-serif),Georgia,serif; font-size:clamp(11px,3.4vw,15px); color:#3c3323; letter-spacing:.03em; }
        .he-c-names{ font-family:var(--font-serif),Georgia,serif; color:#3c3323; font-weight:500; font-size:clamp(11px,3vw,15px); margin:.4em 0 .5em; letter-spacing:.05em; }
        .he-c-divider{ display:block; width:100px; max-width:56%; height:12px; margin:0 auto .6em; }
        .he-c-date{ font-size:7.5px; letter-spacing:.18em; text-transform:uppercase; color:#8a744a; }
        .he-c-venue{ font-size:6.5px; letter-spacing:.12em; text-transform:uppercase; color:#8a744a; margin-top:.5em; }

        .he-liner{ position:absolute; left:2%; right:2%; top:1.5%; height:52%; z-index:1; border-radius:8px 8px 0 0; overflow:hidden;
          opacity:0; transition:opacity .4s ease .1s;
          background:linear-gradient(180deg, #f2e6c2, #fbf6ea); }
        .he-stage.open .he-liner{ opacity:1; }
        .he-liner svg{ position:absolute; inset:0; width:100%; height:100%; }

        .he-flap{ position:absolute; left:0; right:0; top:0; height:52%; z-index:6; transform-origin:50% 0%;
          transform-style:preserve-3d; transform:rotateX(0deg); transition:transform .9s cubic-bezier(.62,-0.02,.2,1), z-index 0s linear .4s; }
        .he-stage.open .he-flap{ transform:rotateX(-168deg); z-index:0; }
        .he-flap-face{ position:absolute; inset:0; clip-path:polygon(0 0,100% 0,50% 100%); backface-visibility:hidden; border-radius:8px 8px 0 0; }
        .he-flap-face.front{ background:#efe4cb; background-image:linear-gradient(150deg,#faf3e0,#efe4cb 52%,#d8c49c); box-shadow:0 4px 10px rgba(70,52,20,.2); }
        .he-flap-face.back{ transform:rotateX(180deg); background:linear-gradient(180deg,#f2e6c2,#fbf6ea); }
        .he-flap-shadow{ position:absolute; left:0; right:0; top:0; height:52%; z-index:5; pointer-events:none;
          background:linear-gradient(180deg, rgba(70,52,20,.12), transparent 80%); clip-path:polygon(0 0,100% 0,50% 100%);
          opacity:1; transition:opacity .45s ease; }
        .he-stage.open .he-flap-shadow{ opacity:0; }

        .he-seal{ position:absolute; left:50%; top:47%; width:22%; aspect-ratio:1; transform:translate(-50%,-50%); z-index:9;
          transition:transform .7s cubic-bezier(.5,0,.2,1), opacity .55s ease; filter:drop-shadow(0 5px 8px rgba(60,34,14,.45)); }
        .he-stage.open .he-seal{ transform:translate(-50%,-92%) scale(.6) rotate(-8deg); opacity:0; }
        .he-seal svg{ position:absolute; inset:0; width:100%; height:100%; display:block; }
        .he-seal-sheen{ position:absolute; inset:6%; border-radius:50%; overflow:hidden; pointer-events:none; }
        .he-seal-sheen::before{ content:""; position:absolute; inset:-40%;
          background:linear-gradient(116deg, transparent 42%, rgba(255,255,255,.5) 50%, transparent 58%);
          transform:translateX(-60%); animation:heSheen 4.5s ease-in-out infinite; }
        @keyframes heSheen{ 0%,72%{transform:translateX(-60%)} 86%{transform:translateX(60%)} 100%{transform:translateX(60%)} }

        .he-tap-row{ display:flex; justify-content:center; min-height:34px; pointer-events:none; }
        .he-tap-pill{ display:inline-flex; align-items:center; padding:8px 16px; border-radius:999px;
          background:rgba(255,255,255,.9); border:1px solid rgba(201,162,75,.35); box-shadow:0 4px 14px rgba(60,44,20,.12);
          font-family:var(--font-sans); font-size:10px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:#8a6d34;
          animation:heNudge 2.2s ease-in-out infinite; }
        @keyframes heNudge{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }

        .he-label{ display:flex; align-items:center; gap:10px; font-size:11px; font-weight:500; letter-spacing:.1em;
          text-transform:uppercase; color:#9a9590; font-family:var(--font-sans); width:100%; max-width:300px; }
        .he-label-dot{ width:6px; height:6px; border-radius:50%; background:#b8944f; animation:heDotPulse 2s ease-in-out infinite; }
        @keyframes heDotPulse{ 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(184,148,79,.3)} 50%{opacity:.6;box-shadow:0 0 0 4px rgba(184,148,79,0)} }
        .he-label-action{ display:flex; align-items:center; gap:4px; color:#b8944f; font-weight:600; margin-left:auto; cursor:pointer; }

        @media (prefers-reduced-motion:reduce){
          .he-floaty{ animation:none; }
          .he-tap-pill{ animation:none; }
          .he-seal-sheen::before{ animation:none; }
          .he-flap,.he-seal,.he-bow,.he-ribbon,.he-card-wrap,.he-liner{ transition-duration:.001ms !important; }
        }
      `}</style>
    </div>
  );
}
