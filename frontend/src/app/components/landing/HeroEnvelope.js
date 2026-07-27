"use client";

import React, { useEffect, useRef, useState } from "react";
import { useIsClient } from "../../utils/useIsClient";
import InvitationReveal from "../guest/InvitationReveal";
import { preloadRevealAssets } from "../guest/revealAssets";

/* ═══════════════════════════════════════════════════════════════════════════
   HeroEnvelope — the landing page's showcase, and now literally the product.

   This used to be a separate, hand-built envelope: its own SVG paper, its own
   wax, its own motion, sharing nothing with what a guest actually receives.
   It was defensible when it was written — a small looping marketing demo has
   different needs from a full-screen one-shot overlay — but the argument does
   not survive contact with what the page is CLAIMING. This is the hero of the
   home page. A visitor decides whether the product is worth their event based
   on it, and it was showing them something we do not sell.

   So it is the real InvitationReveal now, `embedded`. Same photography, same
   choreography, same wax, same engraved monogram — the reveal lays itself out
   from its container's width, so at this size it renders the mobile
   composition a guest opens on their phone.

   The two things a marketing showcase needs that a guest reveal does not:

     • IT LOOPS. The guest reveal is a one-shot by contract (onComplete fires
       exactly once). Here it remounts under a new key after a beat, so a
       visitor who scrolls back still finds a sealed envelope, and one who
       missed the opening gets another.
     • IT WAITS TO BE SEEN. The envelope only starts once it is actually on
       screen — an animation that plays to an empty viewport is worse than no
       animation, because the one visitor who scrolls down at the wrong moment
       sees the aftermath instead of the reveal.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Fixed demo copy — the landing page has no event. Deliberately NOT the same
   names as the invitation-card demo elsewhere; this is the envelope, and it
   only ever shows a monogram, which deriveIdentity builds from the title. */
const DEMO_EVENT = {
  // 'demo' short-circuits useGuestAnalytics, and `embedded` withholds the slug
  // anyway — belt and braces, because this renders on the highest-traffic page
  // on the site and must never reach the reveal funnel.
  slug: "demo",
  title: "Aria & Julian",
  custom_colors: { primary: "#B8944F", secondary: "#D7BE80" },
  template_data: {},
};

const REPLAY_DELAY_MS = 2600;

export default function HeroEnvelope() {
  const isClient = useIsClient();
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  const hostRef = useRef(null);
  const replayTimer = useRef(null);

  useEffect(() => {
    if (!isClient) return undefined;
    preloadRevealAssets();

    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setStarted(true); return undefined; }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); io.disconnect(); } },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isClient]);

  useEffect(() => () => clearTimeout(replayTimer.current), []);

  // onComplete is the reveal telling us it is done. Rearming from here rather
  // than on a fixed interval keeps the loop in step with the animation even if
  // its timing is retuned later.
  const onComplete = () => {
    clearTimeout(replayTimer.current);
    replayTimer.current = setTimeout(() => setRun((n) => n + 1), REPLAY_DELAY_MS);
  };

  return (
    <div className="he-wrap">
      <div className="he-glow" aria-hidden />

      {/* The phone. Its own overflow context, so the reveal's full-bleed
          envelope is cropped by this frame exactly the way a handset crops it
          — which is the whole illusion: not a picture of an envelope, an
          envelope running off the edges of a screen. */}
      <div ref={hostRef} className="he-phone">
        {isClient && started && (
          <InvitationReveal
            key={run}
            embedded
            event={DEMO_EVENT}
            onComplete={onComplete}
          />
        )}
      </div>

      <p className="he-caption">The envelope your guests unseal.</p>

      <style jsx>{`
        .he-wrap {
          position: relative;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .he-glow {
          position: absolute;
          top: 6%;
          left: 50%;
          transform: translateX(-50%);
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(184, 148, 79, 0.13), transparent 70%);
          filter: blur(28px);
          pointer-events: none;
          z-index: 0;
        }
        .he-phone {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 300px;
          aspect-ratio: 300 / 470;
          border-radius: 30px;
          overflow: hidden;
          background: #fff;
          border: 7px solid #1c1a17;
          box-shadow: 0 30px 70px -22px rgba(28, 24, 18, 0.55);
        }
        .he-caption {
          position: relative;
          z-index: 1;
          margin: 0;
          font-family: var(--font-sans);
          font-size: 12.5px;
          letter-spacing: 0.02em;
          color: #77736a;
        }
        /* The reveal animates on its own; the frame should not also drift in
           for anyone who asked for stillness. */
        @media (prefers-reduced-motion: reduce) {
          .he-glow { display: none; }
        }
      `}</style>
    </div>
  );
}
