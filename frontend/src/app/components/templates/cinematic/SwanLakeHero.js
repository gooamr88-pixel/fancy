'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { getCinematicCopy } from './cinematicThemes';
import HeroCardDownload from './HeroCardDownload';

/* ═══════════════════════════════════════════════════════════════
   SWAN LAKE — the hero.

   The envelope's card rises out embossed in ivory. This is that same card,
   and the effect is that the COLOUR floods into it: the engraving becomes a
   painted swan lake, and the card grows to fill the screen.

   ── One photograph, not two ──────────────────────────────────────────────
   The embossed state is `lake.jpg` under a desaturating filter, not a second
   asset. Two files would have to be kept in register by hand forever — and
   the moment the photograph is retouched and the relief is not, the join
   becomes visible. A filter cannot drift from its own source.

   ── Why the bloom is tied to the opening, not to mount ────────────────────
   This hero mounts with the rest of the page, UNDERNEATH the opening, several
   seconds before the guest can see it. Running the bloom on mount would spend
   the whole effect behind a cover — the guest would arrive at a page that had
   already finished doing the one thing it was built to do. So it waits on
   `openingActive` going false, which is the same `showReveal` that dismisses
   the cover, and the two run together.

   An event with the opening turned off never had an envelope to be embossed
   FROM, so it renders coloured from the first frame rather than performing a
   transition out of a state the guest never saw.
   ═══════════════════════════════════════════════════════════════ */

export default function SwanLakeHero({
  template, names, tagline, dateLine, coupleNames, coverImageUrl,
  invitationPattern, invitationTheme, invitationGuestName, invitationData,
  title, isRTL, occasion = null, openingActive = false,
}) {
  const copy = getCinematicCopy(template, { isRTL, occasion });
  const reduceMotion = useReducedMotion();

  /* Whether an opening has ever covered this hero. A ref, not state: it only
     ever decides which branch the effect below takes, and re-rendering on it
     would be a render that changes nothing. */
  const sawOpening = useRef(openingActive);
  const [embossed, setEmbossed] = useState(openingActive && !reduceMotion);

  useEffect(() => {
    // Reduced motion gets the finished picture. The bloom is decorative and
    // a 2.2s filter animation across a full-bleed photograph is exactly the
    // kind of thing the preference is asking us not to do.
    if (reduceMotion) { setEmbossed(false); return undefined; }
    if (openingActive) { sawOpening.current = true; setEmbossed(true); return undefined; }
    if (!sawOpening.current) { setEmbossed(false); return undefined; }

    /* Released on the next frame so the browser has a painted embossed state
       to interpolate FROM — clearing it in the same commit produces no
       transition at all, just the end state.

       The timer is not redundant: requestAnimationFrame does not fire in a
       backgrounded tab, and a guest who opened the invitation and switched
       apps would come back to a permanently grey hero. */
    const raf = requestAnimationFrame(() => setEmbossed(false));
    const backstop = setTimeout(() => setEmbossed(false), 140);
    return () => { cancelAnimationFrame(raf); clearTimeout(backstop); };
  }, [openingActive, reduceMotion]);

  /* NO EMBLEM HERE, deliberately — Velvet Ring has one and this does not.
     Its stage is a dark, empty room, so a small gold mark in the corner reads
     as jewellery on velvet. This photograph has burgundy callas hanging into
     every corner and a treeline down both edges: the same mark, at any size
     that is not intrusive, was invisible against them in the screenshot pass.
     An easter egg nobody can see is not an easter egg, and an unlabelled
     interactive element nobody can see is worse than none.

     The drifting blooms still play across the whole page — AmbientFx mounts
     them at the page level from this template's `fx` recipe, so removing the
     local pool costs the guest nothing. */

  return (
    <div
      className={`cine-hero cine-shero ${embossed ? 'is-embossed' : ''}`}
      style={template.cssVars}
      data-cine-stage
      data-testid="cine-hero-swans"
    >
      <div
        className="cine-shero__scene"
        aria-hidden="true"
        style={{ backgroundImage: `url("${template.assets.lake}")` }}
      />

      <div className="cine-hero__inner cine-shero__inner">
        <p className="cine-shero__kicker">{copy.kicker}</p>

        {coverImageUrl && (
          <div className="cine-shero__photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImageUrl} alt="" />
          </div>
        )}

        <h1 className="cine-shero__names">
          {coupleNames ? (
            <>
              <span className="cine-hero__name">{coupleNames[0]}</span>
              <span className="cine-shero__amp" aria-hidden="true">&amp;</span>
              <span className="cine-hero__name">{coupleNames[1]}</span>
            </>
          ) : (
            <span className="cine-hero__name">{names}</span>
          )}
        </h1>

        {tagline && <p className="cine-shero__sub">{tagline}</p>}

        {dateLine && (
          <p className="cine-shero__date">
            <span className="cine-shero__rule" aria-hidden="true" />
            <span>{dateLine}</span>
            <span className="cine-shero__rule" aria-hidden="true" />
          </p>
        )}

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
