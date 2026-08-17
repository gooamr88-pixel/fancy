'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { createFxPool } from '../../guest/fx/fxPool';
import { getCinematicCopy } from './cinematicThemes';
import HeroCardDownload from './HeroCardDownload';

/* ═══════════════════════════════════════════════════════════════
   VELVET RING — the hero.

   The opening dissolves straight into this, so it opens on the same
   photograph the box was revealed in: the frame is continuous, and the names
   settle onto the image the guest was already looking at rather than
   arriving on a new screen.

   The photograph is full-bleed (100vw regardless of the page's own max-width)
   and fades into the velvet ground at its foot, so it has no visible bottom
   edge and the sections below feel like the same room.
   ═══════════════════════════════════════════════════════════════ */

export default function VelvetRingHero({
  template, names, tagline, dateLine, coupleNames, coverImageUrl,
  invitationPattern, invitationTheme, invitationGuestName, invitationData,
  title, isRTL, occasion = null,
}) {
  const copy = getCinematicCopy(template, { isRTL, occasion });
  const emblemRef = useRef(null);
  const fxRef = useRef(null);
  const poolRef = useRef(null);

  useEffect(() => {
    const layer = fxRef.current;
    if (layer) poolRef.current = createFxPool(layer);
    return () => poolRef.current?.destroy();
  }, []);

  /* The easter egg. Nothing signposts it and nothing depends on it — it is
     there for the guests who tap at things. */
  const burstHearts = useCallback(() => {
    const el = emblemRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    poolRef.current?.burstHearts(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, []);

  return (
    <div
      className="cine-hero cine-vhero"
      style={template.cssVars}
      data-cine-stage
      data-testid="cine-hero-ring"
    >
      <div
        className="cine-vhero__scene"
        aria-hidden="true"
        style={{ backgroundImage: `url("${template.assets.revealed}")` }}
      />

      <button
        type="button"
        ref={emblemRef}
        className="cine-vhero__emblem"
        onClick={burstHearts}
        aria-label={isRTL ? 'لمسة فرح' : 'A touch of joy'}
      >
        <svg viewBox="0 0 40 46" aria-hidden="true">
          <circle cx="20" cy="28" r="11" fill="none" stroke="var(--cine-gold)" strokeWidth="3.4" />
          <polygon points="13,12 20,5 27,12 20,20" fill="#eef8ff" stroke="var(--cine-gold)" strokeWidth="1" />
        </svg>
      </button>

      <div className="cine-hero__inner">
        <p className="cine-vhero__latin" aria-hidden="true">{copy.latin}</p>
        <p className="cine-vhero__kicker">{copy.kicker}</p>

        {coverImageUrl && (
          <div className="cine-vhero__photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImageUrl} alt="" />
          </div>
        )}

        <h1 className="cine-vhero__names">
          {coupleNames ? (
            <>
              <span className="cine-hero__name">{coupleNames[0]}</span>
              <span className="cine-vhero__amp" aria-hidden="true">&amp;</span>
              <span className="cine-hero__name">{coupleNames[1]}</span>
            </>
          ) : (
            <span className="cine-hero__name">{names}</span>
          )}
        </h1>

        {tagline && <p className="cine-vhero__sub">{tagline}</p>}
        {dateLine && <p className="cine-vhero__date">{dateLine}</p>}

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
          <span className="cine-hero__cue-arrow">&#9662;</span>
        </span>
      </div>

      <div className="cine-fx" ref={fxRef} aria-hidden="true" />
    </div>
  );
}
