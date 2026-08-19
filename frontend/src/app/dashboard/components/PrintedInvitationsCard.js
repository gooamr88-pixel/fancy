'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../utils/apiClient';
import {
  SHOP_PATH, priceLine, coverImage, isShopLive, buildWhatsappUrl,
} from '../../utils/shopLinks';

/**
 * PRINTED INVITATIONS — the dashboard offer.
 *
 * The best possible buyer for a hand-finished printed card is somebody who has
 * just finished designing the digital one for the same event: they have the
 * date, the wording and the guest count already, and they are the only
 * audience the marketing site never reaches, because they are logged in.
 *
 * Deliberately quiet. It sits near the bottom of the overview, shows three
 * pieces and a link, and disappears entirely when there is nothing to offer —
 * the section switched off, the dashboard placement switched off, no published
 * products, or no WhatsApp number to reach. An upsell that renders a dead
 * button is worse than one that renders nothing.
 */

const C = {
  ivory: '#F8F4EC', charcoal: '#191B1E', gold: '#B8944F', goldSoft: '#D7BE80',
  goldCta: '#8A6D34', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF',
};

export default function PrintedInvitationsCard() {
  const [state, setState] = useState({ products: [], settings: null, ready: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/public/shop');
        if (cancelled) return;
        setState({
          products: res?.products || [],
          settings: res?.settings || null,
          ready: true,
          enabled: res?.enabled !== false,
        });
      } catch {
        // A marketing card must never surface an error inside the dashboard.
        if (!cancelled) setState({ products: [], settings: null, ready: true });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const { products, settings, ready, enabled } = state;
  if (!ready || !enabled || !settings) return null;
  if (settings.show_in_dashboard === false) return null;
  if (!isShopLive(settings)) return null;

  const picks = [...products]
    .sort((a, b) => (Number(b.is_featured) - Number(a.is_featured))
      || ((a.sort_order ?? 0) - (b.sort_order ?? 0)))
    .slice(0, 3);
  if (picks.length === 0) return null;

  const waUrl = buildWhatsappUrl({ settings });

  return (
    <div className="pic">
      <div className="pic-head">
        <div className="pic-head-copy">
          <span className="pic-kicker">ALSO FROM THE STUDIO</span>
          <h3 className="pic-title">Printed invitations for this event</h3>
          <p className="pic-body">
            Matching cards, pressed and foiled by hand and delivered to your door.
            Tell us the piece and the quantity and we will quote it.
          </p>
        </div>
        {waUrl && (
          // No onClick beacon here, deliberately. This CTA is about printing in
          // general and carries no product, and the interest report is keyed on
          // one — recordShopInquiry() returns immediately without a product id,
          // so a call here would look like tracking while recording nothing.
          // Per-piece taps below and on the catalogue are what get counted.
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="pic-wa">
            Ask about printing
          </a>
        )}
      </div>

      <div className="pic-grid">
        {picks.map((p) => {
          const cover = coverImage(p);
          return (
            <Link key={p.id} href={`${SHOP_PATH}/${p.slug}`} className="pic-item">
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

      <Link href={SHOP_PATH} className="pic-all">
        See the full printed collection
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

        /* auto-fit, not repeat(3, 1fr): three fixed columns put a 90px-wide
           card on a phone. min() keeps the track honest below 320px. */
        .pic-grid {
          display: grid; gap: 14px; min-width: 0;
          grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
        }
        .pic-item { display: block; text-decoration: none; min-width: 0; }
        .pic-art {
          position: relative; aspect-ratio: 4 / 5; overflow: hidden;
          border: 1px solid ${C.border}; border-radius: 8px; background: ${C.ivory}; margin-bottom: 10px;
        }
        .pic-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s cubic-bezier(.16,1,.3,1); }
        .pic-item:hover .pic-img { transform: scale(1.04); }
        .pic-noimg {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-family: var(--font-script); font-size: 28px; color: ${C.goldSoft};
          background: linear-gradient(135deg, ${C.ivory}, #EFE7D8);
        }
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
