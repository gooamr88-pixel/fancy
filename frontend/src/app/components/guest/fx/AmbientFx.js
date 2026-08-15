'use client';

import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { createFxPool } from './fxPool';

/* ═══════════════════════════════════════════════════════════════
   The motion that runs the whole length of a cinematic invitation.

   Two things live here, both fixed to the viewport so they carry across
   every section rather than restarting at each one:

     • DUST — eight looping motes, declared in CSS rather than pooled.
       They never expire, so routing them through the pool would
       permanently occupy eight of its forty slots and starve the bursts.
     • DRIFT — a petal (or a blossom glyph) released on an interval, and a
       sparkle that follows the pointer.

   The pointer trail is scoped POSITIVELY: it fires only over an element
   inside [data-cine-stage], which is the hero. The alternative — firing
   everywhere and excluding content — needs a list of every surface that
   should stay clean, and quietly breaks the first time a section is added
   that isn't on it. Restricting it to the stage is one rule that cannot rot.

   Everything here is decorative, so `prefers-reduced-motion` removes it
   entirely rather than slowing it down.
   ═══════════════════════════════════════════════════════════════ */

const TRAIL_INTERVAL_MS = 90;
/** Squared pixels the pointer must travel before another sparkle. Stops a
    resting or micro-jittering finger from stacking a bright clump. */
const TRAIL_MIN_DISTANCE_SQ = 220;

export default function AmbientFx({ recipe, cssVars }) {
  const layerRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const dust = !!recipe?.dust;
  const petals = !!recipe?.petals;
  const trail = !!recipe?.trail;
  const petalEveryMs = recipe?.petalEveryMs || 3800;
  // Arrays are new on every render; join to a primitive so the effect below
  // doesn't re-subscribe each time and restart the drift.
  const glyphKey = recipe?.petalGlyphs?.join('') || '';

  useEffect(() => {
    if (reduceMotion || (!petals && !trail)) return undefined;
    const layer = layerRef.current;
    if (!layer) return undefined;

    const pool = createFxPool(layer);
    const glyphs = glyphKey ? Array.from(glyphKey) : null;
    let drift = null;
    let onMove = null;

    if (petals) {
      drift = setInterval(() => {
        // A background tab still runs timers; spawning into one banks a
        // burst that all animates at once on return.
        if (document.hidden) return;
        pool.driftPetal(window.innerWidth, window.innerHeight, glyphs);
      }, petalEveryMs);
    }

    if (trail) {
      let lastAt = 0;
      let lastX = -99;
      let lastY = -99;
      onMove = (event) => {
        const now = Date.now();
        if (now - lastAt < TRAIL_INTERVAL_MS) return;
        const point = event.touches ? event.touches[0] : event;
        if (!point) return;

        const dx = point.clientX - lastX;
        const dy = point.clientY - lastY;
        if (dx * dx + dy * dy < TRAIL_MIN_DISTANCE_SQ) return;

        if (!event.target?.closest?.('[data-cine-stage]')) return;

        lastAt = now;
        lastX = point.clientX;
        lastY = point.clientY;
        pool.trailSparkle(point.clientX, point.clientY);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
    }

    return () => {
      if (drift) clearInterval(drift);
      if (onMove) {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('touchmove', onMove);
      }
      pool.destroy();
    };
  }, [reduceMotion, petals, trail, petalEveryMs, glyphKey]);

  if (reduceMotion) return null;

  /* Both layers are position:fixed and therefore siblings of the page rather
     than descendants of the hero, so they inherit none of its custom
     properties. The template's palette has to be restated on each one or
     every particle paints with an unset colour. */
  return (
    <>
      {dust && (
        <div className="cine-dust" style={cssVars} aria-hidden="true">
          <span /><span /><span /><span /><span /><span /><span /><span />
        </div>
      )}
      <div className="cine-fx" style={cssVars} ref={layerRef} aria-hidden="true" data-testid="cine-fx-layer" />
    </>
  );
}
