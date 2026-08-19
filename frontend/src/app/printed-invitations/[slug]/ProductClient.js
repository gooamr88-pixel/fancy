'use client';

// Explicit React import — the test runner uses the classic JSX runtime; see
// the note in ShopClient.js.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  SHOP_PATH, SHOP_LABEL, formatPrice, isShopLive, buildWhatsappUrl, recordShopInquiry, coverImage,
} from '../../utils/shopLinks';
import { C, PI_BASE_CSS, WhatsappGlyph } from '../piStyles';

/**
 * PRINTED INVITATIONS — one piece.
 *
 * The reference this was briefed against showed a single photo, a price, a
 * quantity stepper and "Add to bag" — for a made-to-order object that cannot
 * be added to a bag. Everything here exists because somebody about to spend
 * money on physical cards asks it before they will message a stranger:
 *
 *   what does it look like from another angle   → gallery + lightbox
 *   what is it made of                          → specs table
 *   how much, and for how many                  → price rail + minimum
 *   when would it arrive                        → lead time, stated up front
 *   what happens after I message                → the three steps
 *   what else is like it                        → related pieces
 *
 * The CTA is a WhatsApp thread with the piece and its URL already typed in, so
 * whoever answers knows which of forty cards is meant.
 *
 * Styling: the buttons, badges and headings come from piStyles.js, which this
 * page includes itself. It cannot rely on ShopClient having declared them —
 * that is a different route, and assuming otherwise is exactly how the
 * "Order on WhatsApp" button once rendered as a bare blue link here.
 */

export default function ProductClient({ product, related = [], settings = {} }) {
  const images = product.images || [];
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const live = isShopLive(settings);
  const price = formatPrice(product.price_cents, product.currency);
  const compareAt = formatPrice(product.compare_at_cents, product.currency);
  const leadTime = product.lead_time_text || settings.default_lead_time;
  const specs = Array.isArray(product.specs) ? product.specs : [];
  const highlights = Array.isArray(product.highlights) ? product.highlights : [];

  // The link inside the WhatsApp message is built from the canonical site URL,
  // not window.location — see the note on SITE_URL in utils/shopLinks.js.
  const waUrl = live ? buildWhatsappUrl({ settings, product }) : null;

  // Escape closes the lightbox. Bound on document because the overlay is not
  // guaranteed to hold focus, and a full-screen image with no visible way out
  // is a trap on a keyboard.
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const onOrder = () => recordShopInquiry(product.id, 'whatsapp');

  return (
    <main className="pi-main pi-detail">
      <div className="fx-container fx-container--4xl fx-gutter">
        <nav className="pi-crumbs" aria-label="Breadcrumb">
          <Link href={SHOP_PATH} className="pi-crumb">{SHOP_LABEL}</Link>
          <span className="pi-crumb-sep" aria-hidden="true">/</span>
          <span className="pi-crumb pi-crumb--now">{product.title}</span>
        </nav>

        {/* ─────────────── Gallery + buy rail ─────────────── */}
        <div className="pi-detail-grid">
          {/* ── Gallery ── */}
          <div className="pi-gallery">
            <div className="pi-gallery-main">
              {images[active] ? (
                <button type="button" className="pi-gallery-zoom" onClick={() => setLightbox(true)} aria-label="View larger image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={images[active].url} alt={images[active].alt || product.title} className="pi-gallery-img" />
                </button>
              ) : (
                <div className="pi-gallery-noimg" aria-hidden="true"><span>Fancy</span></div>
              )}

              {(product.badges?.length > 0 || product.is_sold_out) && (
                <div className="pi-card-badges">
                  {product.is_sold_out && <span className="pi-badge pi-badge--out">Sold out</span>}
                  {(product.badges || []).map((b) => (
                    <span key={b.id} className="pi-badge" style={{ background: b.bg_color, color: b.text_color }}>
                      {b.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="pi-thumbs fx-scroll-x">
                {images.map((img, i) => (
                  <button
                    key={img.id || i}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`pi-thumb ${i === active ? 'pi-thumb--on' : ''}`}
                    aria-label={`View image ${i + 1} of ${images.length}`}
                    aria-current={i === active}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="pi-thumb-img" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Buy rail ── */}
          <aside className="pi-rail">
            <h1 className="pi-rail-title">{product.title}</h1>
            {product.tagline && <p className="pi-rail-tag">{product.tagline}</p>}

            <div className="pi-rail-price">
              {price ? (
                <>
                  <span className="pi-price-now">{price}</span>
                  {compareAt && <span className="pi-price-was">{compareAt}</span>}
                  {product.price_unit && <span className="pi-price-unit">{product.price_unit}</span>}
                </>
              ) : (
                <span className="pi-price-quote">Price on request</span>
              )}
            </div>

            {product.min_order_qty ? (
              <p className="pi-rail-min">Minimum order: {product.min_order_qty} cards</p>
            ) : null}

            {highlights.length > 0 && (
              <ul className="pi-highlights">
                {highlights.map((h) => (
                  <li key={h} className="pi-highlight">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.goldCta} strokeWidth="2.5" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="pi-rail-cta">
              {product.is_sold_out ? (
                <p className="pi-soldout">
                  This piece is not being made at the moment. Message us and we will tell you when it returns.
                </p>
              ) : null}

              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pi-btn pi-btn--gold pi-btn--block"
                  onClick={onOrder}
                >
                  <WhatsappGlyph />
                  {product.is_sold_out ? 'Ask about this piece' : 'Order on WhatsApp'}
                </a>
              ) : (
                // No number configured — a button here would open nothing at
                // all, so the page sends people somewhere that works instead.
                <Link href="/contact" className="pi-btn pi-btn--gold pi-btn--block">Contact us to order</Link>
              )}
              <p className="pi-rail-note">
                No online checkout. We quote every piece by hand, so the price matches the paper,
                the quantity and the finishing you actually want.
              </p>
            </div>

            {leadTime && (
              <p className="pi-rail-lead">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                {leadTime}
              </p>
            )}
          </aside>
        </div>

        {/* ─────────────── Description + specs ─────────────── */}
        {(product.description || specs.length > 0) && (
          <div className="pi-detail-body">
            {product.description && (
              <div className="pi-prose">
                <h2 className="pi-sub">About this piece</h2>
                {String(product.description).split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="pi-para">{para}</p>
                ))}
              </div>
            )}

            {specs.length > 0 && (
              <div className="pi-specs-wrap">
                <h2 className="pi-sub">Specification</h2>
                <dl className="pi-specs">
                  {specs.map((s) => (
                    <div key={s.label} className="pi-spec">
                      <dt className="pi-spec-k">{s.label}</dt>
                      <dd className="pi-spec-v">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─────────────── Related ─────────────── */}
      {related.length > 0 && (
        <section className="fx-section pi-related">
          <div className="fx-container fx-container--4xl fx-gutter">
            <h2 className="pi-sec-title" style={{ marginBottom: 28 }}>You may also like</h2>
            <div className="fx-grid fx-grid--3">
              {related.map((r) => {
                const cover = coverImage(r);
                const rPrice = formatPrice(r.price_cents, r.currency);
                return (
                  <Link key={r.id} href={`${SHOP_PATH}/${r.slug}`} className="pi-rel">
                    <div className="pi-rel-art">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover.url} alt={cover.alt || r.title} className="pi-rel-img" loading="lazy" />
                      ) : (
                        <div className="pi-card-noimg" aria-hidden="true"><span>Fancy</span></div>
                      )}
                    </div>
                    <h3 className="pi-rel-title">{r.title}</h3>
                    <span className="pi-rel-price">{rPrice || 'Price on request'}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────── Mobile sticky CTA ─────────────── */}
      {waUrl && !product.is_sold_out && (
        <div className="pi-sticky">
          <div className="pi-sticky-price">
            <span className="pi-sticky-now">{price || 'Price on request'}</span>
            {product.price_unit && price && <span className="pi-sticky-unit">{product.price_unit}</span>}
          </div>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pi-btn pi-btn--gold pi-btn--sm"
            onClick={onOrder}
          >
            <WhatsappGlyph />
            Order
          </a>
        </div>
      )}

      {/* ─────────────── Lightbox ─────────────── */}
      {lightbox && images[active] && (
        <div
          className="pi-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${product.title}, enlarged`}
          onClick={() => setLightbox(false)}
        >
          <button type="button" className="pi-lightbox-close" onClick={() => setLightbox(false)} aria-label="Close">×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[active].url} alt={images[active].alt || product.title} className="pi-lightbox-img" />
        </div>
      )}

      <ProductStyles />
    </main>
  );
}

function ProductStyles() {
  return (
    <style jsx global>{`
      ${PI_BASE_CSS}

      .pi-detail { background: ${C.white}; padding: 28px 0 0; }

      .pi-crumbs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 26px; font-size: 12.5px; }
      .pi-crumb { color: ${C.stone}; text-decoration: none; }
      .pi-crumb:hover { color: ${C.goldCta}; }
      .pi-crumb--now { color: ${C.charcoal}; font-weight: 600; }
      .pi-crumb-sep { color: ${C.border}; }

      /* Gallery beside the rail on desktop; stacked below 900px. An explicit
         minmax(0,…) on both tracks — a grid track sizes to max-content by
         default, and a long unbroken product title would otherwise widen the
         column and push the page into horizontal scroll. */
      .pi-detail-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: clamp(28px, 4vw, 56px); align-items: start; }
      @media (max-width: 900px) { .pi-detail-grid { grid-template-columns: minmax(0, 1fr); } }

      .pi-gallery { min-width: 0; }
      .pi-gallery-main { position: relative; aspect-ratio: 4 / 5; border: 1px solid ${C.border}; border-radius: 3px; overflow: hidden; background: ${C.ivory}; }
      .pi-gallery-zoom { display: block; width: 100%; height: 100%; padding: 0; border: 0; background: none; cursor: zoom-in; }
      .pi-gallery-img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .pi-gallery-noimg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--font-script); font-size: 46px; color: ${C.goldSoft}; background: linear-gradient(135deg, ${C.ivory}, #EFE7D8); }

      .pi-thumbs { display: flex; gap: 10px; margin-top: 12px; min-width: 0; }
      .pi-thumb { flex: 0 0 auto; width: 74px; height: 92px; padding: 0; border: 1px solid ${C.border}; border-radius: 2px; overflow: hidden; background: ${C.ivory}; cursor: pointer; transition: border-color .2s ease; }
      .pi-thumb:hover { border-color: ${C.goldSoft}; }
      .pi-thumb--on { border-color: ${C.goldCta}; box-shadow: 0 0 0 1px ${C.goldCta}; }
      .pi-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }

      /* ── Rail ── */
      .pi-rail { min-width: 0; }
      .pi-rail-title { font-family: var(--font-serif); font-size: clamp(26px, 3.6vw, 40px); color: ${C.charcoal}; margin: 0 0 12px; line-height: 1.15; letter-spacing: -.015em; }
      .pi-rail-tag { font-size: 15.5px; line-height: 1.7; color: ${C.stone}; margin: 0 0 22px; }
      .pi-rail-price { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; padding-bottom: 18px; border-bottom: 1px solid ${C.border}; }
      .pi-price-now { font-size: 30px; font-weight: 700; color: ${C.charcoal}; letter-spacing: -.02em; }
      .pi-price-was { font-size: 16px; color: ${C.stone}; text-decoration: line-through; }
      .pi-price-unit { font-size: 14px; color: ${C.stone}; }
      .pi-price-quote { font-family: var(--font-serif); font-size: 24px; color: ${C.goldCta}; }
      .pi-rail-min { font-size: 13px; color: ${C.stone}; margin: 12px 0 0; }

      .pi-highlights { list-style: none; padding: 0; margin: 22px 0 0; display: flex; flex-direction: column; gap: 10px; }
      .pi-highlight { display: flex; align-items: flex-start; gap: 10px; font-size: 14.5px; line-height: 1.6; color: ${C.charcoal}; }
      .pi-highlight svg { flex: 0 0 auto; margin-top: 3px; }

      .pi-rail-cta { margin-top: 26px; }
      .pi-soldout { font-size: 13.5px; line-height: 1.7; color: ${C.stone}; background: ${C.ivory}; border: 1px solid ${C.border}; border-radius: 3px; padding: 12px 14px; margin: 0 0 14px; }
      .pi-rail-note { font-size: 12.5px; line-height: 1.7; color: ${C.stone}; margin: 14px 0 0; }
      .pi-rail-lead { display: flex; align-items: center; gap: 8px; margin: 22px 0 0; padding-top: 18px; border-top: 1px solid ${C.border}; font-size: 13px; color: ${C.stone}; }

      /* ── Body ── */
      .pi-detail-body { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: clamp(28px, 4vw, 56px); margin: clamp(48px, 7vw, 84px) 0 clamp(40px, 6vw, 72px); align-items: start; }
      @media (max-width: 900px) { .pi-detail-body { grid-template-columns: minmax(0, 1fr); } }
      .pi-sub { font-family: var(--font-serif); font-size: 22px; color: ${C.charcoal}; margin: 0 0 16px; letter-spacing: -.01em; }
      .pi-prose { min-width: 0; }
      .pi-para { font-size: 15.5px; line-height: 1.85; color: ${C.stone}; margin: 0 0 16px; }
      .pi-specs-wrap { min-width: 0; }
      .pi-specs { margin: 0; padding: 0; border-top: 1px solid ${C.border}; }
      .pi-spec { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 12px; padding: 13px 0; border-bottom: 1px solid ${C.border}; }
      .pi-spec-k { margin: 0; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: ${C.stone}; }
      .pi-spec-v { margin: 0; font-size: 14.5px; color: ${C.charcoal}; line-height: 1.6; }

      /* ── Related ── */
      .pi-related { background: ${C.ivory}; }
      .pi-rel { display: block; text-decoration: none; min-width: 0; }
      .pi-rel-art { position: relative; aspect-ratio: 4 / 5; border: 1px solid ${C.border}; border-radius: 3px; overflow: hidden; background: ${C.white}; margin-bottom: 12px; }
      .pi-rel-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s cubic-bezier(.16,1,.3,1); }
      .pi-rel:hover .pi-rel-img { transform: scale(1.04); }
      .pi-rel-title { font-family: var(--font-serif); font-size: 17px; color: ${C.charcoal}; margin: 0 0 4px; }
      .pi-rel:hover .pi-rel-title { color: ${C.goldCta}; }
      .pi-rel-price { font-size: 13.5px; color: ${C.stone}; }

      /* ── Sticky mobile CTA ──
         Desktop keeps the rail in view on its own, so this is phone-only. */
      .pi-sticky { display: none; }
      @media (max-width: 900px) {
        .pi-sticky {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
          padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
          background: rgba(255,255,255,.97); backdrop-filter: blur(10px);
          border-top: 1px solid ${C.border}; box-shadow: 0 -6px 24px rgba(25,27,30,.08);
        }
        .pi-detail { padding-bottom: 88px; }
      }
      .pi-sticky-price { display: flex; flex-direction: column; min-width: 0; }
      .pi-sticky-now { font-size: 16px; font-weight: 700; color: ${C.charcoal}; }
      .pi-sticky-unit { font-size: 11.5px; color: ${C.stone}; }

      /* ── Lightbox ── */
      .pi-lightbox { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(25,27,30,.94); cursor: zoom-out; }
      .pi-lightbox-img { max-width: 100%; max-height: 100%; object-fit: contain; }
      .pi-lightbox-close { position: absolute; top: 16px; right: 20px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(248,244,236,.12); color: ${C.ivory}; font-size: 26px; line-height: 1; cursor: pointer; }
      .pi-lightbox-close:hover { background: rgba(248,244,236,.22); }
    `}</style>
  );
}
