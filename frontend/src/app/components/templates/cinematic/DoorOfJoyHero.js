'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import HeroCardDownload from './HeroCardDownload';

/* ═══════════════════════════════════════════════════════════════
   DOOR OF JOY — the hero.

   What lies beyond the door: a garden gate with doves lifting off it, on a
   loop. The opening starts fetching this video on the first knock, so by the
   time the door has finished swinging it is usually decoded and ready.

   The poster carries the composition until then, and the video is only faded
   in once a real frame exists (`loadeddata`) — the alternative is a black
   rectangle appearing under the names for a beat, which is worse than a
   still image that never moves. On `prefers-reduced-motion` the still is all
   there ever is.
   ═══════════════════════════════════════════════════════════════ */

export default function DoorOfJoyHero({
  template, names, tagline, dateLine, coupleNames,
  invitationPattern, invitationTheme, invitationGuestName, invitationData,
  title, isRTL,
}) {
  const copy = template.copy[isRTL ? 'ar' : 'en'];
  const videoRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const el = videoRef.current;
    if (!el) return undefined;

    const show = () => setReady(true);
    // Already buffered — the opening's head start did its job.
    if (el.readyState >= 2) show();
    const events = ['loadeddata', 'canplay', 'playing'];
    events.forEach((type) => el.addEventListener(type, show));

    // A refused autoplay leaves the poster, which is a complete composition
    // in its own right. Nothing to recover from.
    const played = el.play?.();
    if (played?.catch) played.catch(() => {});

    return () => events.forEach((type) => el.removeEventListener(type, show));
  }, [reduceMotion]);

  return (
    <div
      className="cine-hero cine-dhero"
      style={{ ...template.cssVars, backgroundImage: `url("${template.assets.heroPoster}")` }}
      data-cine-stage
      data-testid="cine-hero-door"
    >
      {!reduceMotion && (
        <video
          ref={videoRef}
          className={`cine-dhero__vid ${ready ? 'is-ready' : ''}`}
          poster={template.assets.heroPoster}
          src={template.assets.heroVideo}
          muted
          loop
          playsInline
          webkit-playsinline="true"
          preload="auto"
          aria-hidden="true"
        />
      )}
      <div className="cine-dhero__veil" aria-hidden="true" />

      <div className="cine-hero__inner cine-dhero__inner">
        <p className="cine-dhero__kicker">{copy.kicker}</p>
        <span className="cine-dhero__orn" aria-hidden="true">✿</span>

        <h1 className="cine-dhero__names">
          {coupleNames ? (
            <>
              <span className="cine-hero__name">{coupleNames[0]}</span>
              <span className="cine-dhero__amp" aria-hidden="true">&amp;</span>
              <span className="cine-hero__name">{coupleNames[1]}</span>
            </>
          ) : (
            <span className="cine-hero__name">{names}</span>
          )}
        </h1>

        {dateLine && <p className="cine-dhero__date">{dateLine}</p>}
        {tagline && <p className="cine-dhero__sub">{tagline}</p>}

        <HeroCardDownload
          pattern={invitationPattern}
          theme={invitationTheme}
          guestName={invitationGuestName}
          data={invitationData}
          title={title}
          isRTL={isRTL}
        />

        <span className="cine-hero__cue" aria-hidden="true">
          <span className="cine-hero__cue-label">{copy.scroll}</span>
          <span className="cine-hero__cue-arrow">&#8595;</span>
        </span>
      </div>
    </div>
  );
}
