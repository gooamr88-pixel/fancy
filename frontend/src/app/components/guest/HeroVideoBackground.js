'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Organizer-uploaded looping hero video (template_data.ha_hero_video_url).
 *
 * Drawn through a canvas so the bottom edge can fade to transparent
 * (destination-out punch-through) instead of cutting off hard — the video
 * element itself is invisible and serves only as the canvas's source frame.
 * Falls back to nothing (the parent keeps whatever background it painted) if
 * the video never becomes playable.
 *
 * SHARED on purpose. Both guest render paths mount this same component:
 *   • the full-page snap-scroll engine → heritageArch/sections/HeroSection
 *   • the continuous-scroll page       → [slug]/EventPageClient's #lg-hero
 * The two paths have drifted apart repeatedly in this codebase; a second copy
 * of the canvas/autoplay logic would drift again the first time either one is
 * touched, so there is exactly one.
 */
export default function HeroVideoBackground({ src, zIndex = 0 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf;
    let running = true;

    const resize = () => {
      if (!video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };
    const draw = () => {
      if (!running) return;
      // HAVE_CURRENT_DATA is enough — draw whenever a frame exists rather than
      // only while playing. A video the browser declines to autoplay (iOS low
      // power mode, an OS-level autoplay block) then shows its first frame
      // instead of an empty canvas, which is what "no video at all" looked like.
      if (video.readyState >= 2 && video.videoWidth) {
        if (canvas.width !== video.videoWidth) resize();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const gradient = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);
        ctx.globalCompositeOperation = 'source-over';
      }
      raf = requestAnimationFrame(draw);
    };
    const play = () => video.play().catch(() => {});

    video.addEventListener('loadedmetadata', resize);
    video.addEventListener('canplay', play);
    // Both listeners are attached from an effect, i.e. after the element has
    // already begun loading. A cached video reaches HAVE_ENOUGH_DATA before
    // passive effects flush, so `loadedmetadata`/`canplay` have already fired
    // and will never fire again: the canvas kept its default 300x150 and the
    // video was never asked to play, leaving the hero blank under the scrim on
    // every reload. Catch up on whatever the element already did.
    resize();
    if (video.readyState >= 3) play();
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      video.removeEventListener('loadedmetadata', resize);
      video.removeEventListener('canplay', play);
    };
  }, [src]);

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex, overflow: 'hidden' }}>
      {/* opacity, not visibility: hidden — the source element has to stay
          rendered or the browser is free to stop decoding frames for it, and
          drawImage would then copy the same still frame forever. */}
      <video
        ref={videoRef} src={src} muted loop playsInline autoPlay preload="auto"
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
