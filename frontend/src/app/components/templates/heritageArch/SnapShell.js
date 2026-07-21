'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useFullPageTheme } from './theme';
import { LangPill, MusicToggle, ScrollToRsvpHint, DotNav, ScrollProgressBar, FloatingCalendarButton } from './shared';
import { buildCalendarLinks } from '../../guest/GuestUI';

/* Full-viewport, scroll-snapped page shell: one 100dvh section per screen,
   a side dot-nav tracking which section is in view, a top-corner language
   pill, a bottom-corner music toggle (when the event has music), a floating
   "add to calendar" button, and a top scroll-progress bar. */
export default function SnapShell({ sections, lang, setLang, isRTL, musicPlaying, toggleMusic, hasBackgroundMusic, event }) {
  const C = useFullPageTheme();
  const reduceMotion = useReducedMotion();
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const calendarLinks = buildCalendarLinks(event);
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

  // Scroll-progress bar: reads scrollTop off this shell's own scrolling
  // container (containerRef), not `window` — the page scrolls inside this
  // div, so a window-scroll listener would never fire.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let ticking = false;
    const update = () => {
      const scrollable = container.scrollHeight - container.clientHeight;
      setScrollProgress(scrollable > 0 ? (container.scrollTop / scrollable) * 100 : 0);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        // Free, natural scrolling. The page previously used `scroll-snap: y
        // mandatory` + `scroll-snap-stop: always`, which forced every swipe to
        // halt on a section boundary — that's what made scrolling feel slow and
        // sticky. `scroll-behavior: smooth` is kept only so the "scroll to RSVP"
        // hint glides rather than jumps.
        height: '100dvh', overflowY: 'auto', overflowX: 'hidden',
        scrollBehavior: 'smooth',
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
            style={{ position: 'relative' }}
          >
            <div
              style={{
                opacity: show ? 1 : 0,
                transform: show ? 'none' : 'translateY(22px)',
                transition: reduceMotion ? undefined : 'opacity 0.55s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
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

      <LangPill lang={lang} setLang={setLang} isRTL={isRTL} />
      {hasBackgroundMusic && <MusicToggle playing={musicPlaying} onToggle={toggleMusic} isRTL={isRTL} />}
      {calendarLinks && <FloatingCalendarButton event={event} isRTL={isRTL} downloadIcs={calendarLinks.downloadIcs} />}
      <ScrollProgressBar progress={scrollProgress} reduceMotion={reduceMotion} />
      <DotNav sections={sections} active={activeIndex} onSelect={(i) => {
        const el = document.getElementById(sections[i].id);
        el?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }} isRTL={isRTL} />
    </div>
  );
}
