'use client';

import React from 'react';

/**
 * THE SHOP — the product page's button, badge and heading styling.
 *
 * ── Why this file exists ──
 *
 * These rules were originally defined only inside the catalogue component's
 * own <style jsx global> block. That works on the catalogue and fails silently
 * on the product page: the two are separate routes, so the catalogue is never
 * mounted at the product URL, and every rule it declared was simply absent
 * there.
 *
 * Since the /shop rebuild only the PRODUCT page consumes this — the browse
 * grid (ShopBrowse.js) ships its own self-contained style block and uses none
 * of the pi- classes. The file is kept rather than folded into the product
 * page because the failure it documents is what happens when shared rules live
 * inside one route's component.
 *
 * The symptom was not a crash or a missing element. It was the single most
 * important control in the whole feature — "Order on WhatsApp" — rendering as
 * a default blue underlined anchor on a page that otherwise looked finished.
 * It was found by screenshotting the page, not by reading the code or running
 * the tests, all of which passed.
 *
 * So the shared layer lives here, in one string, included by both pages.
 *
 * ── Why a CSS string and not scoped styled-jsx ──
 *
 * These rules style elements rendered by `<Link>`, and scoped styled-jsx does
 * not reach inside a child component — a scoped rule on a `<Link className>`
 * matches nothing at all. Everything is therefore global, and every selector
 * carries the `pi-` prefix so "global" cannot mean "leaks".
 */

export const C = {
  ivory: '#F8F4EC',
  charcoal: '#191B1E',
  gold: '#B8944F',
  goldSoft: '#D7BE80',
  goldCta: '#8A6D34',
  stone: '#5E5A52',
  border: '#E8E2D6',
  white: '#FFFFFF',
};

/** Buttons, badges, kickers and section headings — used by BOTH pages. */
export const PI_BASE_CSS = `
  .pi-main { background: ${C.white}; }

  .pi-kicker {
    font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase;
    color: ${C.goldSoft}; margin: 0 0 18px; font-weight: 600;
  }
  .pi-kicker--dark { color: ${C.goldCta}; }

  .pi-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 48px; padding: 0 26px; border-radius: 2px; border: 1px solid transparent;
    font-family: var(--font-sans); font-size: 13px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none;
    cursor: pointer; transition: all .25s cubic-bezier(.16,1,.3,1); white-space: nowrap;
  }
  .pi-btn--sm { min-height: 40px; padding: 0 16px; font-size: 11.5px; letter-spacing: .06em; }
  .pi-btn--block { width: 100%; }
  .pi-btn--gold { background: ${C.goldCta}; color: ${C.white}; }
  .pi-btn--gold:hover { background: #765C2B; transform: translateY(-1px); }
  .pi-btn--onDark { background: transparent; color: ${C.ivory}; border-color: rgba(215,190,128,.5); }
  .pi-btn--onDark:hover { background: rgba(215,190,128,.12); border-color: ${C.goldSoft}; }
  .pi-btn--ghost { background: transparent; color: ${C.charcoal}; border-color: ${C.border}; }
  .pi-btn--ghost:hover { border-color: ${C.gold}; color: ${C.goldCta}; }

  .pi-sec-head { margin-bottom: 36px; }
  .pi-sec-head--center { text-align: center; }
  .pi-sec-title {
    font-family: var(--font-serif); font-size: clamp(28px, 4vw, 42px);
    color: ${C.charcoal}; margin: 0; letter-spacing: -.01em; line-height: 1.15;
  }
  .pi-sec-title--light { color: ${C.ivory}; }

  .pi-card-badges {
    position: absolute; top: 12px; left: 12px; display: flex; flex-wrap: wrap; gap: 6px;
    max-width: calc(100% - 24px);
  }
  /* 11px, not the 10px this started at. Uppercase 10px with .1em tracking
     measured below the 11px floor the rest of this codebase holds, and a
     badge is the one word on a card that has to read at a glance. */
  .pi-badge {
    display: inline-block; padding: 5px 10px; border-radius: 2px;
    font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    background: ${C.goldCta}; color: ${C.white};
  }
  .pi-badge--out { background: ${C.charcoal}; color: ${C.ivory}; }

  /* Touch. The compact button is 40px, which is fine under a mouse and under
     the 44px (--fx-touch) this codebase holds itself to on a finger. Keyed on
     the pointer rather than a width so a small touchscreen laptop is covered
     too. */
  @media (pointer: coarse) {
    .pi-btn--sm { min-height: 44px; }
  }

  .pi-card-noimg {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-family: var(--font-script); font-size: 34px; color: ${C.goldSoft};
    background: linear-gradient(135deg, ${C.ivory}, #EFE7D8);
  }
`;

/** The WhatsApp mark, shared so the two CTAs cannot drift apart. */
export function WhatsappGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23a8.24 8.24 0 0 1 0 16.46z" />
    </svg>
  );
}
