'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useFullPageTheme } from './theme';
import { LangPill, MusicToggle, DotNav, ScrollToRsvpHint } from './shared';

/* Full-viewport, scroll-snapped page shell: one 100dvh section per screen,
   a side dot-nav tracking which section is in view, a top-corner language
   pill, and a bottom-corner music toggle (when the event has music). */
export default function SnapShell({ sections, lang, setLang, isRTL, musicPlaying, toggleMusic, hasBackgroundMusic }) {
  const C = useFullPageTheme();
  const reduceMotion = useReducedMotion();
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Which sections have entered the viewport at least once. Each reveals with a
  // gentle fade + rise the first time the guest scrolls to it, then stays shown
  // (no re-hide on scroll-away). The hero (index 0) is revealed immediately so
  // it never fades in behind the fold. Uses the same container-rooted observer
  // below — reliable inside this nested scroll container, where a window-rooted
  // check would misfire.
  const [revealed, setRevealed] = useState(() => new Set([0]));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const els = Array.from(container.querySelectorAll('[data-ha-section]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const idx = els.indexOf(entry.target);
        if (idx === -1) return;
        // Reveal as the section starts entering; keep it revealed afterwards.
        if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
          setRevealed((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));
        }
        // The side dot-nav tracks whichever section holds the screen majority.
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          setActiveIndex(idx);
        }
      });
    }, { root: container, threshold: [0.2, 0.5] });
    els.forEach((el) => observer.observe(el));

    // Safety net: if the observer ever misses (odd viewport heights, browser
    // quirks, fast programmatic scrolls), never leave a section stuck invisible
    // — reveal everything after a short grace period regardless.
    const failsafe = setTimeout(() => {
      setRevealed((prev) => {
        if (prev.size >= els.length) return prev;
        return new Set(els.map((_, i) => i));
      });
    }, 2500);

    return () => { observer.disconnect(); clearTimeout(failsafe); };
  }, [sections.length]);

  const scrollToIndex = (i) => {
    const container = containerRef.current;
    const el = container?.querySelectorAll('[data-ha-section]')[i];
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      ref={containerRef}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        height: '100dvh', overflowY: 'auto', overflowX: 'hidden',
        scrollSnapType: 'y mandatory', scrollBehavior: 'smooth',
        position: 'relative', background: C.background,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {sections.map((s, i) => {
        const show = reduceMotion || revealed.has(i);
        return (
          <div
            key={s.id}
            id={s.id}
            data-ha-section
            style={{ minHeight: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always', position: 'relative' }}
          >
            <div
              style={{
                minHeight: '100dvh',
                opacity: show ? 1 : 0,
                transform: show ? 'none' : 'translateY(22px)',
                transition: reduceMotion ? undefined : 'opacity 0.55s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: reduceMotion ? undefined : 'opacity, transform',
              }}
            >
              {s.content}
            </div>
          </div>
        );
      })}

      {/* A single "scroll to RSVP" cue for the whole page — follows the guest
          down and hides once they reach the RSVP section (the last one). */}
      {activeIndex < sections.length - 1 && <ScrollToRsvpHint fixed isRTL={isRTL} />}

      <DotNav count={sections.length} active={activeIndex} onSelect={scrollToIndex} isRTL={isRTL} />
      <LangPill lang={lang} setLang={setLang} isRTL={isRTL} />
      {hasBackgroundMusic && <MusicToggle playing={musicPlaying} onToggle={toggleMusic} isRTL={isRTL} />}
    </div>
  );
}
