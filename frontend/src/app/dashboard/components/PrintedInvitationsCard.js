'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../utils/apiClient';
import {
  SHOP_PATH, categoryPath, productPath, priceLine, coverImage,
  isShopLive, buildWhatsappUrl,
} from '../../utils/shopLinks';
/* The catalogue's own line drawings, imported rather than re-invented: an
   uncovered collection must wear the SAME face here that it wears on the shop's
   plates and in its shelf index, or the dashboard is showing the organizer a
   different object under the same name. shopTheme is a plain constants module —
   no 'use client', no stylesheet — so this pulls in nothing but the paths. */
import { artFor, ART_VIEWBOX } from '../../shop/shopTheme';

/**
 * THE STUDIO CARD — the dashboard offer.
 *
 * The best possible buyer for a hand-finished piece is somebody who has just
 * finished designing the digital invitation for the same event: they have the
 * date, the wording and the guest count already, and they are the only audience
 * the marketing site never reaches, because they are logged in.
 *
 * Deliberately quiet. It sits near the bottom of the overview and disappears
 * entirely when there is nothing to offer — the section switched off, the
 * dashboard placement switched off, nothing published, or no WhatsApp number to
 * reach. An upsell that renders a dead button is worse than one that renders
 * nothing.
 *
 * ── 2026-08-22: IT SHOWS COLLECTIONS, NOT THREE CARDS ─────────────────────
 *
 * It was headed "Printed invitations for this event" and showed three featured
 * products. Both were wrong, and wrong in the same direction:
 *
 *   • The catalogue stopped being print-only in August — SHOP_LABEL is plain
 *     "Shop" now, and it carries menus, signage, welcome screens and door
 *     scanners as well as cards. An organizer who needed table numbers read a
 *     heading about invitations and concluded we do not sell them.
 *   • Three cherry-picked products describe a sixth of the range and go stale
 *     the moment the admin re-orders the catalogue.
 *
 * The collections ARE the range, they are named by the admin rather than
 * hardcoded here, and each one is a shelf rather than a single piece. Products
 * remain the fallback for a deployment whose shop_categories columns predate
 * migration 20260827000000 — getPublicShop logs and serves `categories: []` in
 * that case, and a card that vanishes on a schema mismatch is how an outage
 * goes unnoticed.
 */

const C = {
  ivory: '#F8F4EC', charcoal: '#191B1E', gold: '#B8944F', goldSoft: '#D7BE80',
  goldCta: '#8A6D34', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF',
};

/** How many shelves fit before the card starts competing with the dashboard. */
const MAX_COLLECTIONS = 6;
/** Fallback only — see the header note. */
const MAX_PRODUCTS = 3;

export default function PrintedInvitationsCard() {
  const [state, setState] = useState({ products: [], categories: [], settings: null, ready: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/public/shop');
        if (cancelled) return;
        setState({
          products: res?.products || [],
          categories: res?.categories || [],
          settings: res?.settings || null,
          ready: true,
          enabled: res?.enabled !== false,
        });
      } catch {
        // A marketing card must never surface an error inside the dashboard.
        if (!cancelled) setState({ products: [], categories: [], settings: null, ready: true });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const { products, categories, settings, ready, enabled } = state;
  if (!ready || !enabled || !settings) return null;
  if (settings.show_in_dashboard === false) return null;
  if (!isShopLive(settings)) return null;

  // A collection with nothing published on it is a shelf that leads to an empty
  // page, so it is counted out rather than shown with "0 pieces".
  const countFor = (categoryId) => products.filter((p) => p.category_id === categoryId).length;
  const shelves = (categories || [])
    .map((c) => ({ ...c, count: countFor(c.id) }))
    .filter((c) => c.slug && c.count > 0)
    .slice(0, MAX_COLLECTIONS);

  const picks = shelves.length > 0 ? [] : [...products]
    .sort((a, b) => (Number(b.is_featured) - Number(a.is_featured))
      || ((a.sort_order ?? 0) - (b.sort_order ?? 0)))
    .slice(0, MAX_PRODUCTS);

  if (shelves.length === 0 && picks.length === 0) return null;

  const waUrl = buildWhatsappUrl({ settings });

  /**
   * The product URL carries its category segment: /shop/<collection>/<piece>.
   *
   * This card linked to /shop/<piece> until 2026-08-22. That is ONE segment,
   * so the router resolved it against /shop/[category], found no collection by
   * that slug, and 404'd — every product tap on the dashboard was dead. Same
   * bug the catalogue's "You may also like" rail had.
   *
   * "all" is the route's own redirect segment, not a guess: the product page
   * derives the real category from the product itself and sends the reader on
   * (categorySlugOf falls back to 'all' for exactly this). It matters here
   * because the products branch only renders when NO collection resolved —
   * which is the same condition that leaves this lookup with nothing to find.
   * Without the fallback the piece would be unreachable from its own card.
   */
  const slugForCategory = (categoryId) =>
    (categories || []).find((c) => c.id === categoryId)?.slug || 'all';

  return (
    <div className="pic">
      <div className="pic-head">
        <div className="pic-head-copy">
          <span className="pic-kicker">ALSO FROM THE STUDIO</span>
          <h3 className="pic-title">Everything else this event needs</h3>
          <p className="pic-body">
            Not just invitations. Matching pieces for the rest of the day, made by
            the same studio and delivered to your door. Tell us what you need and
            the quantity, and we will quote it.
          </p>
        </div>
        {waUrl && (
          // No onClick beacon here, deliberately. This CTA carries no product,
          // and the interest report is keyed on one — recordShopInquiry()
          // returns immediately without a product id, so a call here would look
          // like tracking while recording nothing. Per-piece taps on the
          // catalogue are what get counted.
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="pic-wa">
            Ask the studio
          </a>
        )}
      </div>

      {shelves.length > 0 ? (
        <div className="pic-grid">
          {shelves.map((c) => (
            <Link key={c.id} href={categoryPath(c.slug)} className="pic-item">
              <div className="pic-art pic-art--sq">
                {c.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover_image_url} alt={c.cover_image_alt || c.name} className="pic-img" loading="lazy" />
                ) : (
                  // Its own drawing, not the wordmark. Four uncovered shelves in
                  // a row were four identical "Fancy" plates, which said nothing
                  // about any of them and read as four copies of one thing.
                  <div className="pic-noimg" aria-hidden="true">
                    <svg
                      viewBox={ART_VIEWBOX} className="pic-art-mark" fill="none"
                      stroke="#8A6D34" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
                      dangerouslySetInnerHTML={{ __html: artFor(c.slug) }}
                    />
                  </div>
                )}
              </div>
              <span className="pic-name">{c.name}</span>
              <span className="pic-price">{c.count} {c.count === 1 ? 'piece' : 'pieces'}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="pic-grid">
          {picks.map((p) => {
            const cover = coverImage(p);
            return (
              <Link key={p.id} href={productPath(slugForCategory(p.category_id), p.slug)} className="pic-item">
                <div className="pic-art">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.url} alt={cover.alt || p.title} className="pic-img" loading="lazy" />
                  ) : (
                    <div className="pic-noimg" aria-hidden="true"><span>Fancy</span></div>
                  )}
                </div>
                <span className="pic-name">{p.title}</span>
                <span className="pic-price">{priceLine(p)}</span>
              </Link>
            );
          })}
        </div>
      )}

      <Link href={SHOP_PATH} className="pic-all">
        See the full shop
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>

      <style jsx global>{`
        .pic {
          background: ${C.white}; border: 1px solid ${C.border}; border-radius: 12px;
          padding: clamp(18px, 3vw, 26px); margin-top: 20px;
        }
        .pic-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; flex-wrap: wrap; margin-bottom: 20px;
        }
        .pic-head-copy { min-width: 0; flex: 1 1 260px; }
        .pic-kicker {
          display: block; font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
          color: ${C.goldCta}; font-weight: 700; margin-bottom: 8px;
        }
        .pic-title {
          font-family: var(--font-serif); font-size: 19px; color: ${C.charcoal};
          margin: 0 0 6px; letter-spacing: -.01em;
        }
        .pic-body { font-size: 13.5px; line-height: 1.65; color: ${C.stone}; margin: 0; max-width: 52ch; }
        .pic-wa {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 44px; padding: 0 18px; border-radius: 8px; flex: 0 0 auto;
          background: ${C.goldCta}; color: ${C.white}; text-decoration: none;
          font-size: 13px; font-weight: 600; transition: background .2s ease;
        }
        .pic-wa:hover { background: #765C2B; }

        /* auto-fit, not repeat(N, 1fr): fixed columns put a 90px-wide card on a
           phone. min() keeps the track honest below 320px. */
        .pic-grid {
          display: grid; gap: 14px; min-width: 0;
          grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
        }
        .pic-item { display: block; text-decoration: none; min-width: 0; }
        .pic-art {
          position: relative; aspect-ratio: 4 / 5; overflow: hidden;
          border: 1px solid ${C.border}; border-radius: 8px; background: ${C.ivory}; margin-bottom: 10px;
        }
        /* A collection is a shelf, not a piece — square, like the plates on the
           catalogue's own index, so the two surfaces do not disagree about what
           a collection looks like. */
        .pic-art--sq { aspect-ratio: 1 / 1; }
        .pic-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s cubic-bezier(.16,1,.3,1); }
        .pic-item:hover .pic-img { transform: scale(1.04); }
        .pic-noimg {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-family: var(--font-script); font-size: 28px; color: ${C.goldSoft};
          background: linear-gradient(135deg, ${C.ivory}, #EFE7D8);
        }
        /* A percentage keeps the drawing proportional to the plate, which is
           itself fluid — the grid is auto-fit, so a track is ~150px on a phone
           and ~250px on a wide dashboard. */
        .pic-art-mark { width: 38%; height: 38%; opacity: .85; }
        .pic-name { display: block; font-size: 14px; font-weight: 600; color: ${C.charcoal}; margin-bottom: 2px; }
        .pic-item:hover .pic-name { color: ${C.goldCta}; }
        .pic-price { display: block; font-size: 12.5px; color: ${C.stone}; }

        .pic-all {
          display: inline-flex; align-items: center; gap: 8px; margin-top: 18px;
          font-size: 13px; font-weight: 600; color: ${C.charcoal}; text-decoration: none;
        }
        .pic-all:hover { color: ${C.goldCta}; }
      `}</style>
    </div>
  );
}
