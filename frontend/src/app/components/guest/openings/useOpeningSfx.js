'use client';

import { useCallback, useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Sound for an opening — with a floor it can never fall through.

   An opening that knocks on a door has to make a knocking sound, and Web
   Audio on mobile is a minefield:

     • A context created inside the gesture is running but has nothing
       decoded yet, so the first knock is silent. A context created at mount
       can decode, but starts SUSPENDED. So: create early, and gate every
       playback on resume() actually resolving. Firing a buffer immediately
       after calling resume() schedules it onto a still-closed output — which
       is precisely why a first knock goes missing.

     • iOS routes Web Audio through the ringer channel by default, so a phone
       on silent hears nothing at all — unlike a YouTube iframe, which
       ignores the switch. Declaring the session as `playback` says "this is
       media, not an alert" and lets it through. iOS 16.4+, feature-detected.

     • Safari still wants decodeAudioData's callback form; newer engines
       return a promise. Both are wired.

   And the floor: when a sample is missing or fails to decode, a synthesised
   equivalent plays instead. The three recordings this expects are NOT in the
   repository, so the synth path is what actually runs today — a knock built
   from a pitch-dropping sine plus filtered noise, a door built from a latch,
   a slow detuning creak and a band-passed grain bed, and a wax seal built
   from a bright snap over a paper rustle. Dropping real files in at the
   configured paths upgrades it with no code change.
   ═══════════════════════════════════════════════════════════════ */

export default function useOpeningSfx({ knockUrl, doorUrl, sealUrl } = {}) {
  const ctxRef = useRef(null);
  const buffersRef = useRef({ knock: null, door: null, seal: null });

  const getContext = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctxRef.current = new Ctor();
    } catch {
      return null;
    }
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch { /* pre-16.4, or not iOS */ }
    return ctxRef.current;
  }, []);

  // Decode at mount so the first knock is instant. A suspended context
  // decodes perfectly well; only playback needs the gesture.
  useEffect(() => {
    const ctx = getContext();
    if (!ctx || typeof fetch !== 'function') return undefined;
    let cancelled = false;

    const load = (key, url) => {
      if (!url) return;
      fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('missing'))))
        .then((bytes) => new Promise((resolve, reject) => {
          const maybe = ctx.decodeAudioData(bytes, resolve, reject);
          if (maybe?.then) maybe.then(resolve, reject);
        }))
        .then((buffer) => { if (!cancelled) buffersRef.current[key] = buffer; })
        .catch(() => { /* the synthesiser covers it */ });
    };

    load('knock', knockUrl);
    load('door', doorUrl);
    load('seal', sealUrl);

    return () => {
      cancelled = true;
      try { ctxRef.current?.close?.(); } catch { /* already closed */ }
      ctxRef.current = null;
    };
  }, [getContext, knockUrl, doorUrl, sealUrl]);

  /** Runs `fn` once the context is genuinely open, not merely asked to open. */
  const whenLive = useCallback((fn) => {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'running') { fn(ctx); return; }
    try {
      const resumed = ctx.resume();
      if (resumed?.then) resumed.then(() => fn(ctx), () => {});
      else fn(ctx);
    } catch { /* nothing to play through */ }
  }, [getContext]);

  /** @returns true when a decoded sample handled it, false to fall through. */
  const playSample = useCallback((key, gain = 1, rate) => {
    const ctx = getContext();
    const buffer = buffersRef.current[key];
    if (!ctx || !buffer) return false;
    whenLive(() => {
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        if (rate) source.playbackRate.value = rate;
        const gainNode = ctx.createGain();
        gainNode.gain.value = gain;
        source.connect(gainNode).connect(ctx.destination);
        source.start();
      } catch { /* decorative */ }
    });
    return true;
  }, [getContext, whenLive]);

  const synthKnock = useCallback((ctx) => {
    try {
      const t = ctx.currentTime;

      // The thud: a sine dropping fast through the low mids.
      const body = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(150, t);
      body.frequency.exponentialRampToValueAtTime(58, t + 0.12);
      bodyGain.gain.setValueAtTime(0.8, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      body.connect(bodyGain).connect(ctx.destination);
      body.start(t);
      body.stop(t + 0.18);

      // The rap: 60ms of band-passed noise on top, which is what makes it
      // read as knuckle-on-wood rather than as a drum.
      const length = Math.floor(ctx.sampleRate * 0.06);
      const noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 850;
      band.Q.value = 1.1;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.45;
      source.connect(band).connect(noiseGain).connect(ctx.destination);
      source.start(t);
    } catch { /* decorative */ }
  }, []);

  const synthDoor = useCallback((ctx) => {
    try {
      const t = ctx.currentTime;

      // Latch releasing.
      const latch = ctx.createOscillator();
      const latchGain = ctx.createGain();
      latch.type = 'triangle';
      latch.frequency.setValueAtTime(112, t);
      latch.frequency.exponentialRampToValueAtTime(48, t + 0.2);
      latchGain.gain.setValueAtTime(0.34, t);
      latchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      latch.connect(latchGain).connect(ctx.destination);
      latch.start(t);
      latch.stop(t + 0.26);

      // The long creak: a detuning saw under a closing low-pass, wobbled so
      // it sounds like weight moving rather than a synth sweep.
      const creak = ctx.createOscillator();
      const wobble = ctx.createOscillator();
      const wobbleDepth = ctx.createGain();
      const creakFilter = ctx.createBiquadFilter();
      const creakGain = ctx.createGain();
      creak.type = 'sawtooth';
      creak.frequency.setValueAtTime(83, t + 0.08);
      creak.frequency.exponentialRampToValueAtTime(43, t + 3.3);
      wobble.type = 'sine';
      wobble.frequency.value = 3.7;
      wobbleDepth.gain.value = 13;
      wobble.connect(wobbleDepth).connect(creak.frequency);
      creakFilter.type = 'lowpass';
      creakFilter.frequency.setValueAtTime(520, t);
      creakFilter.frequency.exponentialRampToValueAtTime(190, t + 3.3);
      creakFilter.Q.value = 2.2;
      creakGain.gain.setValueAtTime(0.001, t);
      creakGain.gain.linearRampToValueAtTime(0.13, t + 0.28);
      creakGain.gain.setValueAtTime(0.13, t + 2.35);
      creakGain.gain.exponentialRampToValueAtTime(0.001, t + 3.45);
      creak.connect(creakFilter).connect(creakGain).connect(ctx.destination);
      wobble.start(t + 0.08);
      creak.start(t + 0.08);
      wobble.stop(t + 3.5);
      creak.stop(t + 3.5);

      // Grain: pulsed noise under the creak, so the wood has texture.
      const duration = 3.25;
      const length = Math.floor(ctx.sampleRate * duration);
      const grainBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const grainData = grainBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        const p = i / length;
        const pulse = 0.35 + 0.65 * Math.abs(Math.sin(p * Math.PI * 7.5));
        grainData[i] = (Math.random() * 2 - 1) * pulse * Math.sin(Math.PI * p);
      }
      const grain = ctx.createBufferSource();
      grain.buffer = grainBuffer;
      const grainFilter = ctx.createBiquadFilter();
      grainFilter.type = 'bandpass';
      grainFilter.frequency.value = 430;
      grainFilter.Q.value = 0.75;
      const grainGain = ctx.createGain();
      grainGain.gain.setValueAtTime(0.001, t + 0.12);
      grainGain.gain.linearRampToValueAtTime(0.055, t + 0.45);
      grainGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      grain.connect(grainFilter).connect(grainGain).connect(ctx.destination);
      grain.start(t + 0.12);
    } catch { /* decorative */ }
  }, []);

  const synthSeal = useCallback((ctx) => {
    try {
      const t = ctx.currentTime;

      /* The snap. Wax breaking is almost pure transient — 25ms of bright
         noise with a near-instant decay. Anything longer reads as a crunch
         (something being crushed) rather than as a disc cracking cleanly in
         two, which is what the footage shows. */
      const snapLength = Math.floor(ctx.sampleRate * 0.025);
      const snapBuffer = ctx.createBuffer(1, snapLength, ctx.sampleRate);
      const snapData = snapBuffer.getChannelData(0);
      for (let i = 0; i < snapLength; i += 1) {
        snapData[i] = (Math.random() * 2 - 1) * (1 - i / snapLength) ** 3;
      }
      const snap = ctx.createBufferSource();
      snap.buffer = snapBuffer;
      const snapFilter = ctx.createBiquadFilter();
      snapFilter.type = 'bandpass';
      snapFilter.frequency.value = 2600;
      snapFilter.Q.value = 0.9;
      const snapGain = ctx.createGain();
      snapGain.gain.value = 0.5;
      snap.connect(snapFilter).connect(snapGain).connect(ctx.destination);
      snap.start(t);

      /* A low knock under it, so the seal has mass. Much shorter and quieter
         than synthKnock's — this is wax parting from paper, not a fist. */
      const body = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(190, t);
      body.frequency.exponentialRampToValueAtTime(74, t + 0.07);
      bodyGain.gain.setValueAtTime(0.34, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      body.connect(bodyGain).connect(ctx.destination);
      body.start(t);
      body.stop(t + 0.12);

      /* The card sliding out: a high band of noise swelling and fading over
         ~1.1s, starting a beat after the snap. This is the sound the eye is
         actually watching for — the flaps falling open and the paper moving. */
      const slideDuration = 1.1;
      const slideLength = Math.floor(ctx.sampleRate * slideDuration);
      const slideBuffer = ctx.createBuffer(1, slideLength, ctx.sampleRate);
      const slideData = slideBuffer.getChannelData(0);
      for (let i = 0; i < slideLength; i += 1) {
        const p = i / slideLength;
        // Sin envelope so it swells and settles rather than clicking on/off.
        slideData[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * p) ** 1.5;
      }
      const slide = ctx.createBufferSource();
      slide.buffer = slideBuffer;
      const slideFilter = ctx.createBiquadFilter();
      slideFilter.type = 'bandpass';
      slideFilter.frequency.setValueAtTime(1500, t + 0.16);
      slideFilter.frequency.exponentialRampToValueAtTime(4200, t + 0.16 + slideDuration);
      slideFilter.Q.value = 0.6;
      const slideGain = ctx.createGain();
      slideGain.gain.value = 0.085;
      slide.connect(slideFilter).connect(slideGain).connect(ctx.destination);
      slide.start(t + 0.16);
    } catch { /* decorative */ }
  }, []);

  /* Each knock is pitched a hair above the last. Without it three plays of
     one sample read as a loop rather than as three separate raps. */
  const playKnock = useCallback((index = 0) => {
    if (playSample('knock', 0.92, 1 + index * 0.03)) return;
    whenLive(synthKnock);
  }, [playSample, whenLive, synthKnock]);

  /* 0.7, not 1: the recording peaks at 1.376, so unity gain clips it. */
  const playDoor = useCallback(() => {
    if (playSample('door', 0.7)) return;
    whenLive(synthDoor);
  }, [playSample, whenLive, synthDoor]);

  /* 0.8: the wax snap is a transient, and a transient at unity reads as a
     click on small speakers. */
  const playSeal = useCallback(() => {
    if (playSample('seal', 0.8)) return;
    whenLive(synthSeal);
  }, [playSample, whenLive, synthSeal]);

  /** Opens the output inside a gesture, before anything needs to be heard. */
  const prime = useCallback(() => { whenLive(() => {}); }, [whenLive]);

  return { playKnock, playDoor, playSeal, prime };
}
