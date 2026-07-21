'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLiteralTheme, alpha } from '../theme';

/* ProgressDotNav — the reference file's hand-authored enhancement layer:
   a top scroll-progress bar with a gliding bead, a right-side dot-nav with
   hover labels + active-state tracking, and an auto-hiding "scroll down"
   hint. Fully self-contained (its own scroll listener + IntersectionObserver
   scoped to `containerRef`) — deliberately NOT sharing heritageArch/shared.js's
   dead DotNav, so this can never affect any other template's rendering.
   Respects prefers-reduced-motion throughout. */
export default function ProgressDotNav({ containerRef, sections, isRTL, showHint }) {
  const C = useLiteralTheme();
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  // Tracks only "the guest dismissed it" (by scrolling, or the 5s timeout) —
  // never reset back to false — so the effect below only ever calls setState
  // from a genuine callback (the scroll listener / timeout), never as a
  // direct statement in the effect body itself.
  const [hintDismissed, setHintDismissed] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const hintVisible = showHint && !hintDismissed;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let ticking = false;
    const updateProgress = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const max = scrollHeight - clientHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { requestAnimationFrame(updateProgress); ticking = true; }
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    updateProgress();

    const els = Array.from(container.querySelectorAll('[data-ccs-section]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const idx = els.indexOf(entry.target);
        if (idx !== -1 && entry.isIntersecting && entry.intersectionRatio > 0.5) setActiveIndex(idx);
      });
    }, { root: container, threshold: [0.5] });
    els.forEach((el) => observer.observe(el));

    return () => { container.removeEventListener('scroll', onScroll); observer.disconnect(); };
  }, [containerRef, sections.length]);

  // Scroll hint: appears once the cover is opened, fades out on first scroll
  // or after 5s — same auto-hide behavior as the reference file. Only ever
  // calls setState from the timeout/scroll callbacks below, never directly
  // in the effect body.
  useEffect(() => {
    if (!showHint || hintDismissed) return undefined;
    const container = containerRef.current;
    const dismiss = () => setHintDismissed(true);
    const timeout = setTimeout(dismiss, 5000);
    container?.addEventListener('scroll', dismiss, { passive: true, once: true });
    return () => { clearTimeout(timeout); container?.removeEventListener('scroll', dismiss); };
  }, [showHint, hintDismissed, containerRef]);

  const scrollToSection = (i) => {
    const el = containerRef.current?.querySelector(`#${sections[i].id}`);
    el?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <>
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 45, background: alpha(C.gold, 0.15) }}>
        <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldSoft})`, transition: reduceMotion ? undefined : 'width 0.15s ease-out' }} />
      </div>

      <nav
        aria-label={isRTL ? 'التنقل بين الأقسام' : 'Section navigation'}
        style={{
          position: 'fixed', top: '50%', transform: 'translateY(-50%)', zIndex: 45,
          ...(isRTL ? { left: 16 } : { right: 16 }),
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        {sections.map((s, i) => {
          const labelShown = hoveredIndex === i;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(i)}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex((prev) => (prev === i ? -1 : prev))}
              onFocus={() => setHoveredIndex(i)}
              onBlur={() => setHoveredIndex((prev) => (prev === i ? -1 : prev))}
              aria-label={s.label}
              aria-current={activeIndex === i ? 'true' : undefined}
              style={{
                position: 'relative', width: activeIndex === i ? 10 : 7, height: activeIndex === i ? 10 : 7,
                borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                background: activeIndex === i ? C.gold : alpha(C.gold, 0.35),
                transition: 'all 0.25s ease',
              }}
            >
              <span style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap',
                ...(isRTL ? { right: 20 } : { left: 20 }),
                background: C.paper, color: C.gold, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700,
                padding: '5px 12px', borderRadius: 4, boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
                opacity: labelShown ? 1 : 0, visibility: labelShown ? 'visible' : 'hidden', transition: 'opacity 0.2s ease',
              }}>
                {s.label}
              </span>
            </button>
          );
        })}
      </nav>

      {hintVisible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} exit={{ opacity: 0 }}
          style={{
            position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 45,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: C.gold, fontFamily: 'var(--font-sans)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
            pointerEvents: 'none',
          }}
        >
          <span>{isRTL ? 'مرر للأسفل' : 'Scroll'}</span>
          <motion.svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
            animate={reduceMotion ? undefined : { y: [0, 6, 0] }}
            transition={reduceMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path d="M6 9l6 6 6-6" />
          </motion.svg>
        </motion.div>
      )}
    </>
  );
}
