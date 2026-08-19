import React from 'react';
import Link from 'next/link';
import { SHOP_PATH, priceLine, coverImage } from '../../utils/shopLinks';

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

const C = {
  ivory: '#F8F4EC',
  charcoal: '#191B1E',
  gold: '#B8944F',
  goldSoft: '#D7BE80',
  goldCta: '#8A6D34',
  stone: '#5E5A52',
  border: '#E8E2D6',
  white: '#FFFFFF',
};

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
  const all = data.products || [];
  const picks = [...all]
    .sort((a, b) => (Number(b.is_featured) - Number(a.is_featured))
      || ((a.sort_order ?? 0) - (b.sort_order ?? 0)))
    .slice(0, 3);

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

        <div className="fx-grid fx-grid--3 pis-grid">
          {picks.map((p) => {
            const cover = coverImage(p);
            return (
              <Link key={p.id} href={`${SHOP_PATH}/${p.slug}`} className="pis-card">
                <div className="pis-art">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover.url}
                      alt={cover.alt || p.title}
                      className="pis-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="pis-noimg" aria-hidden="true"><span>Fancy</span></div>
                  )}
                  {(p.badges || []).slice(0, 1).map((b) => (
                    <span key={b.id} className="pis-badge" style={{ background: b.bg_color, color: b.text_color }}>
                      {b.label}
                    </span>
                  ))}
                </div>
                <h3 className="pis-name">{p.title}</h3>
                <span className="pis-price">{priceLine(p)}</span>
              </Link>
            );
          })}
        </div>

        <div className="pis-cta">
          <Link href={SHOP_PATH} className="pis-btn">See the printed collection</Link>
        </div>
      </div>

      <style>{`
        .pis { background: ${C.white}; padding: clamp(64px, 9vw, 108px) 0; }
        .pis-head {
          display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: clamp(20px, 4vw, 56px); align-items: end; margin-bottom: 44px;
        }
        @media (max-width: 800px) { .pis-head { grid-template-columns: minmax(0, 1fr); align-items: start; } }
        .pis-kicker {
          font-size: 11px; letter-spacing: .24em; text-transform: uppercase;
          color: ${C.goldCta}; margin: 0 0 14px; font-weight: 600;
        }
        .pis-title {
          font-family: var(--font-serif); font-size: clamp(28px, 4.4vw, 48px);
          line-height: 1.1; letter-spacing: -.02em; color: ${C.charcoal}; margin: 0;
        }
        .pis-lede { font-size: 15.5px; line-height: 1.8; color: ${C.stone}; margin: 0; }

        .pis-grid { margin-bottom: 40px; }
        .pis-card { display: block; text-decoration: none; min-width: 0; }
        .pis-art {
          position: relative; aspect-ratio: 4 / 5; overflow: hidden;
          border: 1px solid ${C.border}; border-radius: 3px; background: ${C.ivory}; margin-bottom: 14px;
        }
        .pis-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .7s cubic-bezier(.16,1,.3,1); }
        .pis-card:hover .pis-img { transform: scale(1.05); }
        .pis-noimg {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-family: var(--font-script); font-size: 38px; color: ${C.goldSoft};
          background: linear-gradient(135deg, ${C.ivory}, #EFE7D8);
        }
        .pis-badge {
          position: absolute; top: 12px; left: 12px; padding: 5px 10px; border-radius: 2px;
          font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
        }
        .pis-name { font-family: var(--font-serif); font-size: 19px; color: ${C.charcoal}; margin: 0 0 4px; letter-spacing: -.01em; }
        .pis-card:hover .pis-name { color: ${C.goldCta}; }
        .pis-price { font-size: 13.5px; color: ${C.stone}; }

        .pis-cta { text-align: center; }
        .pis-btn {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 50px; padding: 0 32px; border: 1px solid ${C.charcoal}; border-radius: 2px;
          background: transparent; color: ${C.charcoal}; text-decoration: none;
          font-family: var(--font-sans); font-size: 13px; font-weight: 600;
          letter-spacing: .1em; text-transform: uppercase;
          transition: all .25s cubic-bezier(.16,1,.3,1);
        }
        .pis-btn:hover { background: ${C.charcoal}; color: ${C.ivory}; }
      `}</style>
    </section>
  );
}
