'use client';

import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Organizer-uploaded looping hero video (template_data.ha_hero_video_url).
 *
 * Drawn through a canvas so the bottom edge can fade to transparent
 * (destination-out punch-through) instead of cutting off hard — the video
 * element itself is invisible and serves only as the canvas's source frame.
 * Falls back to nothing (the parent keeps whatever background it painted) if
 * the video never becomes playable.
 *
 * SHARED on purpose. All three surfaces mount this same component:
 *   • the full-page snap-scroll engine → heritageArch/sections/HeroSection
 *   • the continuous-scroll page       → [slug]/EventPageClient's #lg-hero
 *   • the wizard's phone card          → templates/MobilePreview
 * These paths have drifted apart repeatedly in this codebase; a second copy of
 * the canvas/autoplay logic would drift again the first time either one is
 * touched, so there is exactly one.
 */

// Both hero hosts keep every section mounted for the whole visit (SnapShell
// renders all ~20; the legacy page is one long document), so nothing unmounts
// this when the guest scrolls past. Without the observer below the rAF loop
// would keep copying frames for the entire session while off screen.
const IO_OPTIONS = { threshold: 0 };

// Never allocate more canvas pixels than the element actually displays. The
// source can be 4K while this paints into a ~300px phone-simulator card;
// copying 8.3M pixels per frame into a 300px box is pure heat and nothing else.
const MAX_CANVAS_WIDTH = 1920;

export default function HeroVideoBackground({ src, zIndex = 0 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!video || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = null;
    let running = false;
    let visible = false;

    const resize = () => {
      if (!video.videoWidth) return;
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      const cssW = canvas.clientWidth || video.videoWidth;
      const targetW = Math.max(1, Math.min(
        video.videoWidth,
        Math.ceil(cssW * dpr),
        MAX_CANVAS_WIDTH,
      ));
      // Keep the source's aspect ratio so the canvas's object-fit: cover crops
      // exactly the way the raw video would have.
      const targetH = Math.max(1, Math.round(video.videoHeight * (targetW / video.videoWidth)));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    // HAVE_CURRENT_DATA is enough — paint whenever a frame exists rather than
    // only while playing. A video the browser declines to autoplay (iOS low
    // power mode, an OS-level autoplay block) then shows its first frame
    // instead of an empty canvas, which is what "no video at all" looked like.
    const paint = () => {
      if (video.readyState < 2 || !video.videoWidth) return;
      if (!canvas.width || canvas.width === 300) resize();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const gradient = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = gradient;
      ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);
      ctx.globalCompositeOperation = 'source-over';
    };

    const loop = () => {
      if (!running) return;
      paint();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduceMotion) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };
    const play = () => { if (!reduceMotion) video.play().catch(() => {}); };

    // prefers-reduced-motion: show the footage as a still rather than dropping
    // it entirely, so the organizer's imagery survives while the motion does
    // not. Every other animated surface here honours this setting (SnapShell,
    // the envelope reveal, HeroSection's own float) — a looping video is
    // precisely what it is meant to stop.
    const showPosterFrame = () => {
      resize();
      paint();
    };
    const seekPoster = () => { try { video.currentTime = 0.05; } catch { /* seek unsupported */ } };

    const onLoadedMeta = () => {
      resize();
      if (reduceMotion) seekPoster();
    };
    const onCanPlay = () => { if (visible) play(); };

    video.addEventListener('loadedmetadata', onLoadedMeta);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('seeked', showPosterFrame);
    video.addEventListener('loadeddata', showPosterFrame);

    // The listeners above are attached from an effect, i.e. after the element
    // has already begun loading. A cached video reaches HAVE_ENOUGH_DATA before
    // passive effects flush, so `loadedmetadata`/`canplay` have already fired
    // and will never fire again: the canvas kept its default 300x150 and the
    // video was never asked to play, leaving the hero blank under the scrim on
    // every reload. Catch up on whatever the element already did.
    resize();
    if (reduceMotion && video.readyState >= 1) seekPoster();

    // Re-derive the backing-store size when the box changes (window resize, or
    // MobilePreview's FitScaler changing its scale).
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resize());
      ro.observe(canvas);
    }

    let io;
    if (!reduceMotion) {
      if (typeof IntersectionObserver !== 'undefined' && wrap) {
        io = new IntersectionObserver((entries) => {
          visible = entries.some((e) => e.isIntersecting);
          if (visible) { play(); start(); }
          else { video.pause(); stop(); }
        }, IO_OPTIONS);
        io.observe(wrap);
      } else {
        visible = true;
        if (video.readyState >= 3) play();
        start();
      }
    }

    return () => {
      stop();
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('seeked', showPosterFrame);
      video.removeEventListener('loadeddata', showPosterFrame);
    };
  }, [src, reduceMotion]);

  return (
    <div ref={wrapRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex, overflow: 'hidden' }}>
      {/* preload="metadata", not "auto": this file is allowed up to 100MB and
          the hero mounts on first paint, so "auto" told every guest's phone to
          pull the whole clip down before they had even opened the envelope.
          Playback is started explicitly once the hero is actually on screen.
          opacity, not visibility: hidden — the source element has to stay
          rendered or the browser is free to stop decoding frames for it, and
          drawImage would then copy the same still frame forever. */}
      <video
        ref={videoRef} src={src} muted loop playsInline preload="metadata"
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: 0, pointerEvents: 'none' }}
      />
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {/* Neutral dark scrim — works over any organizer-uploaded footage, unlike
          a theme-colored one which could clash with the video itself. Keeps
          foreground text legible regardless of what was uploaded.
          It has to release over the same band the canvas punches out above
          (70% → 100%), otherwise the bottom of the hero is a half-black bar
          laid over the page background with no video left behind it — the
          opposite of the "fades to nothing at the bottom" this promises. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.34) 55%, rgba(0,0,0,0.32) 70%, rgba(0,0,0,0) 100%)',
      }} />
    </div>
  );
}
