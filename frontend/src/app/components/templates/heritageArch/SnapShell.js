'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HERITAGE_ARCH_COLORS as C } from './defaultContent';
import { LangPill, MusicToggle, DotNav } from './shared';

/* Full-viewport, scroll-snapped page shell: one 100dvh section per screen,
   a side dot-nav tracking which section is in view, a top-corner language
   pill, and a bottom-corner music toggle (when the event has music). */
export default function SnapShell({ sections, lang, setLang, isRTL, musicPlaying, toggleMusic, hasBackgroundMusic }) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const els = Array.from(container.querySelectorAll('[data-ha-section]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          const idx = els.indexOf(entry.target);
          if (idx !== -1) setActiveIndex(idx);
        }
      });
    }, { root: container, threshold: [0.5] });
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
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
      {sections.map((s) => (
        <div
          key={s.id}
          id={s.id}
          data-ha-section
          style={{ minHeight: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always', position: 'relative' }}
        >
          {s.content}
        </div>
      ))}

      <DotNav count={sections.length} active={activeIndex} onSelect={scrollToIndex} isRTL={isRTL} />
      <LangPill lang={lang} setLang={setLang} isRTL={isRTL} />
      {hasBackgroundMusic && <MusicToggle playing={musicPlaying} onToggle={toggleMusic} isRTL={isRTL} />}
    </div>
  );
}
