import React from 'react';
import Link from 'next/link';
import { SHOP_PATH, productPath, priceLine, coverImage } from '../../utils/shopLinks';
import { C as TOKENS } from './landingTokens';
import ShopRail from './ShopRail';

/**
 * PRINTED INVITATIONS — the homepage teaser.
 *
 * The landing page sells one thing the platform does: a digital invitation a
 * guest opens on a phone. It said nothing at all about the physical cards the
 * same studio makes by hand, which is the higher-value order and the one
 * nobody can discover by browsing the app.
 *
 * A Server Component on purpose. The three pieces shown here are real rows
 * fetched at build/revalidate time, so the homepage can never advertise a card
 * that has been unpublished or renamed — and there is no client-side fetch
 * flashing an empty band on first paint.
 *
 * It renders NOTHING when there is nothing honest to show: section disabled,
 * homepage placement switched off, or no published products. A teaser for an
 * empty catalogue is worse than no teaser.
 */

const API_URL = process.env.INTERNAL_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:5000/api/v1';

/* The palette was a seventh private copy of the same eight hex values. It now
   comes from landingTokens.js like every other band; `goldCta` was character
   for character the token now called `goldInk` (the darkened gold that clears
   4.5:1 as text on a light ground), so this is a rename, not a restyle. */
const C = { ...TOKENS, goldCta: TOKENS.goldInk };

async function fetchShop() {
  try {
    const res = await fetch(`${API_URL}/public/shop`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // The homepage must render even when the API is down — this band simply
    // disappears rather than taking the whole page with it.
    return null;
  }
}

export default async function PrintedInvitationsSection() {
  const data = await fetchShop();
  const settings = data?.settings || {};

  if (!data || data.enabled === false || settings.show_on_homepage === false) return null;

  // Featured first, then the admin's own order — the same "make this one show
  // first" control the catalogue uses, not a second ranking invented here.
  //
  // TWELVE, up from three. Three was a third of a shelf that also sells
  // screens, scanners, signage and envelopes, shown to someone with no way of
  // knowing there was more; the rail below fits twelve in the same band and
  // says so by moving. Still a cap, not the whole catalogue — this is a
  // teaser, and /shop is one tap away.
  const all = data.products || [];
  const byCategory = new Map((data.categories || []).map((c) => [c.id, c.slug]));

  const picks = [...all]
    .sort((a, b) => (Number(b.is_featured) - Number(a.is_featured))
      || ((a.sort_order ?? 0) - (b.sort_order ?? 0)))
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      title: p.title,
      price: priceLine(p),
      cover: coverImage(p),
      badge: (p.badges || [])[0] || null,
      /* A piece lives at /shop/<category>/<slug>. This band linked
         /shop/<slug> — ONE segment — which the router hands to the category
         route, where an unknown category slug is a 404. Every card in the
         homepage's shop teaser was a dead link, the same defect the product
         page's "You may also like" carried. The category slug is in the same
         payload; productPath falls back to "all", which the product route
         redirects, so an uncategorised piece is a hop rather than a wall. */
      href: productPath(byCategory.get(p.category_id), p.slug),
    }));

  if (picks.length === 0) return null;

  return (
    <section className="pis" aria-labelledby="pis-title">
      <div className="fx-container fx-container--4xl fx-gutter">
        <div className="pis-head">
          <div className="pis-head-copy">
            <p className="pis-kicker">ALSO FROM THE STUDIO</p>
            <h2 id="pis-title" className="pis-title">
              Some invitations
              <br />
              are meant to be held
            </h2>
          </div>
          <p className="pis-lede">
            Alongside the digital invitations, we make printed ones — foiled, pressed and
            finished by hand, then delivered to your door. Every piece is quoted personally.
          </p>
        </div>

      </div>

      {/* OUTSIDE the container on purpose: the rail is its own scroll port and
          carries the gutter itself, so the first card lines up with the
          heading while the rest run off the edge of the screen. That edge is
          the whole affordance — a strip that stops neatly at the margin looks
          like a grid that happens to be cut off. */}
      <ShopRail items={picks} />

      <div className="fx-container fx-container--4xl fx-gutter">
        <div className="pis-cta">
          <Link href={SHOP_PATH} className="pis-btn">See the printed collection</Link>
        </div>
      </div>

      <style>{`
        /* padding was clamp(64px, 9vw, 108px) — 216px of vertical air on a
           desktop for a three-card teaser. --fx-pad-y-sm is the rhythm the
           rest of the page now keeps. */
        .pis { background: ${C.paper}; padding: var(--fx-pad-y-sm) 0; }
        .pis-head {
          display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: clamp(20px, 4vw, 56px); align-items: end; margin-bottom: 32px;
        }
        /* 767.98, not the 800 that was here: AGENTS.md allows four breakpoint
           values and 800 is not one of them. It bought nothing — the two-column
           head is comfortable down to the md line — and an off-scale value is
           how a page ends up with a layout that changes at a width nothing else
           on the site changes at. */
        @media (max-width: 767.98px) { .pis-head { grid-template-columns: minmax(0, 1fr); align-items: start; } }
        .pis-kicker {
          font-size: 11px; letter-spacing: .24em; text-transform: uppercase;
          color: ${C.goldCta}; margin: 0 0 14px; font-weight: 600;
        }
        .pis-title {
          font-family: var(--font-cormorant), Georgia, serif; font-size: clamp(28px, 4.4vw, 48px);
          line-height: 1.1; letter-spacing: -.02em; color: ${C.ink}; margin: 0;
        }
        .pis-lede { font-size: 15.5px; line-height: 1.8; color: ${C.inkSoft}; margin: 0; }

        /* ── THE RAIL ──
           A scroll port rather than a grid, because the band now carries up to
           twelve pieces and a grid of twelve is a page, not a teaser.
           position: relative is what the arrows are positioned against. */
        .pis-railwrap { position: relative; margin-bottom: 30px; }
        .pis-rail {
          display: flex;
          gap: 14px;
          margin: 0;
          list-style: none;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
          /* The gutter is padding on the SCROLL PORT, so the strip starts in
             line with the heading and still reaches the screen edge. And
             scroll-padding, or snapping would align card one to the padding
             EDGE on load and silently eat that gutter. */
          padding-inline: max(var(--fx-pad-x), var(--fx-safe-l));
          padding-block: 4px;
          scroll-padding-inline-start: max(var(--fx-pad-x), var(--fx-safe-l));
          scrollbar-width: none;
          max-width: var(--fx-w-4xl);
          margin-inline: auto;
        }
        .pis-rail::-webkit-scrollbar { display: none; }
        .pis-slide { flex: 0 0 auto; width: 190px; min-width: 0; scroll-snap-align: start; }

        /* A cluster above the strip's right edge — in the flow, covering
           nothing, so it works at every width. Same gutter and measure as the
           rail below it, or the buttons would not line up with the last card. */
        .pis-arrows {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin: 0 auto 12px;
          max-width: var(--fx-w-4xl);
          padding-inline: max(var(--fx-pad-x), var(--fx-safe-l));
        }
        .pis-arrow {
          display: inline-flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; padding: 0;
          border: 1px solid ${C.border}; border-radius: 999px;
          background: ${C.paper}; color: ${C.ink}; cursor: pointer;
          transition: background .25s ease, color .25s ease, opacity .25s ease;
        }
        .pis-arrow svg { width: 20px; height: 20px; }
        .pis-arrow:hover:not(:disabled) { background: ${C.ink}; color: ${C.paper}; }
        /* Dimmed, not removed: a lone arrow that appears and disappears as you
           scroll reads as a glitch, and 0.3 still says "this way is closed". */
        .pis-arrow:disabled { opacity: 0.3; cursor: default; }

        .pis-card { display: block; text-decoration: none; min-width: 0; }
        .pis-art {
          display: block;
          position: relative; aspect-ratio: 4 / 5; overflow: hidden;
          border: 1px solid ${C.border}; border-radius: 3px; background: ${C.paper}; margin-bottom: 14px;
        }
        .pis-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .7s cubic-bezier(.16,1,.3,1); }
        .pis-card:hover .pis-img { transform: scale(1.05); }
        .pis-noimg {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-family: var(--font-script); font-size: 30px; color: ${C.gold};
          background: linear-gradient(135deg, ${C.paper}, #EFE7D8);
        }
        .pis-badge {
          position: absolute; top: 12px; left: 12px; padding: 5px 10px; border-radius: 2px;
          font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
        }
        /* Two lines with a floor, so a long piece name cannot make its card
           taller than the one beside it and knock the prices out of line. */
        .pis-name {
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          font-family: var(--font-cormorant), Georgia, serif; font-size: 17px; line-height: 1.22;
          color: ${C.ink}; margin: 0 0 4px; letter-spacing: -.01em; min-height: 41px;
        }
        .pis-card:hover .pis-name { color: ${C.goldCta}; }
        .pis-price { display: block; font-size: 13px; color: ${C.inkSoft}; }

        .pis-cta { text-align: center; }
        .pis-btn {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 50px; padding: 0 32px; border: 1px solid ${C.ink}; border-radius: 2px;
          background: transparent; color: ${C.ink}; text-decoration: none;
          font-family: var(--font-sans); font-size: 13px; font-weight: 600;
          letter-spacing: .1em; text-transform: uppercase;
          transition: all .25s cubic-bezier(.16,1,.3,1);
        }
        .pis-btn:hover { background: ${C.ink}; color: ${C.paper}; }

        /* Arrows from 1024 up only. Below that the rail is swiped, and a pair
           of floating buttons over a 190px card is chrome on top of the thing
           it is meant to reveal. */
        @media (min-width: 1024px) {
          .pis-slide { width: 224px; }
          .pis-name { font-size: 18px; min-height: 44px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .pis-img, .pis-arrow, .pis-btn { transition: none; }
          .pis-card:hover .pis-img { transform: none; }
          .pis-rail { scroll-behavior: auto; }
        }
      `}</style>
    </section>
  );
}
