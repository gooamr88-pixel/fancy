'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * THE HOMEPAGE SHOP RAIL — many pieces side by side, swiped.
 *
 * The band used to be three cards in a static three-column grid: a third of a
 * shelf that sells screens, scanners, signage, envelopes and cards, shown to
 * someone who has no way of knowing there is more. A rail shows twelve in the
 * same vertical space and says, by moving, that the catalogue is deeper.
 *
 * ── WHY THIS IS A CLIENT COMPONENT AND ITS PARENT IS NOT ───────────────────
 *
 * PrintedInvitationsSection stays an async Server Component so the products
 * are still fetched at build/revalidate time — the homepage must never flash
 * an empty band or advertise an unpublished piece. Only the arrows need a
 * browser, so only the arrows are shipped to one. A Server Component may
 * import a client COMPONENT (this default export); what it must never import
 * is a client module's VALUE — that lands as a client reference and kills the
 * production build. See faqContent.js.
 *
 * ── AND WHY THERE IS NO CSS IN HERE ────────────────────────────────────────
 *
 * Every `pis-` rule lives in the parent's one plain <style> element. A
 * <style jsx> block in a nested component does not reliably compile in this
 * build, and a scoped rule would never attach to the next/link cards below.
 */

/** Touch and trackpad already scroll this. The arrows are for a mouse. */
const NUDGE = 0.85;

export default function ShopRail({ items }) {
  const railRef = useRef(null);
  /** Which arrows can still do something. Both start false so a rail that
   *  does not overflow shows no controls at all until measurement says it
   *  does — the honest default is "nothing to scroll". */
  const [ends, setEnds] = useState({ prev: false, next: false });

  useEffect(() => {
    const el = railRef.current;
    if (!el) return undefined;

    /* Measured, not derived from items.length: whether this rail overflows
       depends on the viewport and on how wide the cards resolve to, neither
       of which exists until after layout. That is why it runs here and not
       during render. The 4px slack absorbs sub-pixel scroll positions, which
       otherwise leave "next" enabled forever at the far end. */
    const update = () => setEnds({
      prev: el.scrollLeft > 4,
      next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });

    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [items.length]);

  const nudge = (dir) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * NUDGE, behavior: 'smooth' });
  };

  const showArrows = ends.prev || ends.next;

  return (
    <div className="pis-railwrap">
      {/* ABOVE the rail, not floating over it.
          These used to be absolutely positioned across the strip, which meant
          they covered the two cards they sit on — tolerable at a desktop's
          224px card, not at a phone's 190px — so they were hidden below
          1024px and the band simply had no controls on a phone at all.
          A control cluster over the strip's top-right corner is the pattern
          that works at every width: it covers nothing, so it never has to be
          taken away.

          aria-hidden: the rail is a normal scrollable list and every card is
          a link in the tab order, so a screen reader already has a better way
          through this than two buttons. */}
      {showArrows && (
        <div className="pis-arrows" aria-hidden="true">
          <button
            type="button"
            className="pis-arrow"
            onClick={() => nudge(-1)}
            disabled={!ends.prev}
            tabIndex={-1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            className="pis-arrow"
            onClick={() => nudge(1)}
            disabled={!ends.next}
            tabIndex={-1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      <ul className="pis-rail" ref={railRef}>
        {items.map((p) => (
          <li key={p.id} className="pis-slide">
            <Link href={p.href} className="pis-card">
              <span className="pis-art">
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover.url} alt={p.cover.alt || p.title} className="pis-img" loading="lazy" />
                ) : (
                  <span className="pis-noimg" aria-hidden="true"><span>Fancy</span></span>
                )}
                {p.badge && (
                  <span className="pis-badge" style={{ background: p.badge.bg_color, color: p.badge.text_color }}>
                    {p.badge.label}
                  </span>
                )}
              </span>
              <span className="pis-name">{p.title}</span>
              <span className="pis-price">{p.price}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
