'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import useOpeningSfx from './useOpeningSfx';
import { getCinematicCopy } from '../../templates/cinematic/cinematicThemes';
import { useMediaReadiness, useOpeningMemory, useScrollLock, watchOpeningVideo } from './openingSafety';

/* ═══════════════════════════════════════════════════════════════
   DOOR OF JOY — the opening.

   A carved door. Knock three times and it opens onto the light.

   Three details carry this, and each one exists because the obvious
   implementation is wrong:

     THE MUSIC STARTS ON THE THIRD KNOCK, SYNCHRONOUSLY.
     Not in a timeout after it, not in a promise chain from it. iOS grants
     audio permission to the call stack of the gesture itself, and a
     setTimeout of even one millisecond has left that stack. The third knock
     is a real touch and therefore the one chance to start the music without
     making the guest hunt for a speaker button.

     THE HINGE SOUND IS TIMED TO THE VIDEO'S CLOCK, NOT TO play().
     Both leaves are still shut for the first beat of the footage. Firing the
     creak on play() creaks at a closed door. It fires at currentTime ≥ 1.3s,
     with a wall-clock backstop in case timeupdate stalls.

     THE HERO VIDEO STARTS LOADING ON KNOCK ONE.
     The knocks and the door take about eight seconds. Spending them fetching
     the next video means the hero is decoded by the time anyone arrives at
     it, instead of showing a poster that pops.
   ═══════════════════════════════════════════════════════════════ */

/** Lets the third knock land before the door answers it. */
const DOOR_START_DELAY_MS = 280;
/** timeupdate can stall on low-power mode; this fires the hinge regardless. */
const SFX_BACKSTOP_PADDING_MS = 900;
/** Grace after the footage ends, so the last frame is not cut off. */
const FINISH_PADDING_MS = 600;
const ASSUMED_DOOR_DURATION_S = 5;
const KNOCK_KICK_MS = 170;
const RIPPLE_LIFETIME_MS = 760;
const FADE_OUT_MS = 1200;
const REDUCED_MOTION_HOLD_MS = 700;

export default function KnockDoorOpening({
  template,
  names,
  lang = 'en',
  // Door of Joy is always a wedding — accepted and forwarded so every opening
  // reads its copy through the one accessor. See VelvetBoxOpening.
  occasion = null,
  sessionKey = null,
  onComplete,
  onGesture,
  onFirstKnock,
}) {
  const isRTL = lang === 'ar';
  const copy = getCinematicCopy(template, { isRTL, occasion });
  const { poster, video: videoSrc, knockSfx, doorSfx } = template.assets;
  const required = template.knocksRequired || 3;

  const videoRef = useRef(null);
  const tapsRef = useRef(null);
  const timersRef = useRef([]);
  const watchRef = useRef(null);
  const knocksRef = useRef(0);
  const openedRef = useRef(false);
  const finishedRef = useRef(false);

  const reduceMotion = useReducedMotion();
  const { playKnock, playDoor, prime } = useOpeningSfx({ knockUrl: knockSfx, doorUrl: doorSfx });
  useMediaReadiness(videoRef, { enabled: !reduceMotion });
  const [alreadySeen, remember] = useOpeningMemory(sessionKey);

  const [knocks, setKnocks] = useState(0);
  const [kicked, setKicked] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | playing | done

  useScrollLock(phase !== 'done');

  /* Same contract as InvitationReveal: a sessionKey means "once per session".
     Nobody should have to knock their way back in to change an RSVP. */
  useEffect(() => {
    if (alreadySeen && !openedRef.current) {
      openedRef.current = true;
      onComplete?.();
    }
  }, [alreadySeen, onComplete]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      watchRef.current?.cancel();
    };
  }, []);

  const after = useCallback((ms, fn) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  /* Latched, because there are deliberately several ways to arrive here and
     they race by design: the duration timer, the video's `ended` event, and
     the watchdog all end the opening, and whichever is first is correct. The
     door footage is ~5s while the watchdog's never-started rung fires at 6s,
     so on a device that never reports playback BOTH land — without this
     latch onComplete fires twice and the guest's arrival is counted, and
     animated, twice over. */
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('done');
    remember();
    // Held mounted through its own fade-out, so the door dissolves into the
    // hero rather than being cut away from in front of it.
    after(FADE_OUT_MS, () => onComplete?.());
  }, [after, onComplete, remember]);

  const openDoor = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setPhase('playing');

    const el = videoRef.current;
    let swung = false;
    const swing = () => {
      if (swung) return;
      swung = true;
      playDoor();
    };

    if (!el) { swing(); finish(); return; }

    const atSeconds = template.doorSfxAtSeconds ?? 1.3;
    const onTime = () => { if ((Number(el.currentTime) || 0) >= atSeconds) swing(); };
    el.addEventListener('timeupdate', onTime);

    const played = el.play?.();
    // A refused play means the hinge is the only signal the guest will get
    // that anything happened — so give it to them immediately and move on.
    if (played?.catch) played.catch(() => { swing(); after(400, finish); });

    after((atSeconds * 1000) + SFX_BACKSTOP_PADDING_MS, swing);

    const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : ASSUMED_DOOR_DURATION_S;
    after((duration * 1000) + FINISH_PADDING_MS, finish);

    watchRef.current = watchOpeningVideo(el, {
      onReveal: () => { el.removeEventListener('timeupdate', onTime); finish(); },
      onFallback: () => { el.removeEventListener('timeupdate', onTime); swing(); after(400, finish); },
    });
  }, [after, finish, playDoor, template.doorSfxAtSeconds]);

  const knock = useCallback((event) => {
    if (openedRef.current) return;

    const index = knocksRef.current;
    knocksRef.current = index + 1;
    const count = index + 1;
    setKnocks(count);

    if (count === 1) {
      // Open the audio output and start fetching the hero on the very first
      // touch — both are free here and expensive later.
      prime();
      onFirstKnock?.();
    }

    // The ripple lands where the finger did. A ripple from a fixed point
    // reads as a UI response; one from the touch reads as contact.
    const layer = tapsRef.current;
    if (layer && !reduceMotion) {
      /* The layer's own document and window. In the organizer's preview this
         page lives inside an iframe (PreviewFrame.js) while `window` and
         `document` still point at the dashboard — so the centred fallback
         ripple landed off-frame, and the element was created in the wrong
         document and only survived because appendChild silently adopts it. */
      const doc = layer.ownerDocument || document;
      const view = doc.defaultView || window;
      const x = typeof event?.clientX === 'number' ? event.clientX : view.innerWidth / 2;
      const y = typeof event?.clientY === 'number' ? event.clientY : view.innerHeight / 2;
      const ripple = doc.createElement('span');
      ripple.className = 'cine-door__ripple';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      layer.appendChild(ripple);
      setTimeout(() => ripple.remove(), RIPPLE_LIFETIME_MS);
    }

    setKicked(true);
    after(KNOCK_KICK_MS, () => setKicked(false));

    playKnock(index);
    if (navigator.vibrate) {
      try { navigator.vibrate(24); } catch { /* unsupported */ }
    }

    if (count >= required) {
      // Synchronous, inside this handler — see the note at the top.
      onGesture?.();
      if (reduceMotion) {
        openedRef.current = true;
        finishedRef.current = true;
        setPhase('done');
        remember();
        after(REDUCED_MOTION_HOLD_MS, () => onComplete?.());
        return;
      }
      after(DOOR_START_DELAY_MS, openDoor);
    }
  }, [after, openDoor, playKnock, prime, reduceMotion, remember, required, onGesture, onFirstKnock, onComplete]);

  return (
    <div
      className={`cine-open cine-door ${kicked ? 'is-knocked' : ''} ${phase === 'playing' ? 'is-playing' : ''} ${phase === 'done' ? 'is-done is-playing' : ''}`}
      /* The poster is painted on the CONTAINER as well as set on the <video>.
         A video's own `poster` only shows while that element has no frame and
         is discarded the moment it does — so a video that fails to load,
         is blocked, or is still fetching leaves nothing behind it but flat
         colour, and the guest is asked to knock on an empty brown rectangle.
         Backing the container means the door is on screen from first paint
         whatever the video does. (Velvet Ring gets the same guarantee a
         different way: its poster is a real <img> layer under the video.) */
      style={{ ...template.cssVars, backgroundImage: `url("${poster}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      dir={isRTL ? 'rtl' : 'ltr'}
      data-testid="cine-opening"
      data-opening="knockDoor"
    >
      <video
        ref={videoRef}
        className="cine-door__vid"
        poster={poster}
        src={videoSrc}
        muted
        playsInline
        webkit-playsinline="true"
        preload="auto"
      />
      <div className="cine-door__veil" aria-hidden="true" />
      <div className="cine-door__taps" ref={tapsRef} aria-hidden="true" />

      <button
        type="button"
        className="cine-open__tap"
        onPointerDown={knock}
        aria-label={copy.hint}
        data-testid="cine-opening-tap"
      />

      <div className="cine-door__ui">
        <p className="cine-door__names">{names}</p>
        <p className="cine-door__hint" data-testid="cine-opening-hint">{copy.hint}</p>
        <div className="cine-door__knocks" aria-hidden="true">
          {Array.from({ length: required }, (_, i) => (
            <span key={i} className={`cine-door__dot ${i < knocks ? 'is-hit' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
