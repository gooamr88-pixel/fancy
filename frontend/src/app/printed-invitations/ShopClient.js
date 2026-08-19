'use client';

// React is imported explicitly because the test runner transforms JSX with the
// CLASSIC runtime (see vitest.config.mjs), which needs React in scope. Next's
// own build uses the automatic runtime and does not.
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  SHOP_PATH, priceLine, isShopLive, buildWhatsappUrl, recordShopInquiry,
  SORT_OPTIONS, sortProducts, coverImage,
} from '../utils/shopLinks';
import { C, PI_BASE_CSS, WhatsappGlyph } from './piStyles';

/**
 * PRINTED INVITATIONS — the catalogue.
 *
 * The cards on this page are physical objects sold by conversation, not by
 * checkout, and the whole layout follows from that one fact:
 *
 *   • no cart, no quantity stepper, no "add to bag" — the button starts a
 *     WhatsApp thread, and every card says so in the same words;
 *   • price is optional by design. `price_cents === null` renders "Price on
 *     request", which is the admin's way of quoting privately without hiding
 *     the piece;
 *   • filtering is admin-defined, not hardcoded. Collections come from
 *     shop_categories and the labels ("New", "Best seller", anything typed)
 *     from shop_badges, so the filter row is whatever the admin has made it.
 *
 * Styling: the buttons, badges and headings shared with the product page come
 * from piStyles.js — they must NOT be redeclared here. This component is not
 * mounted on /printed-invitations/[slug], so anything defined only in this
 * file is simply absent there, which is how the product page's main CTA once
 * shipped as a bare blue link.
 */

/** The three questions every visitor has before they will message anyone. */
const ASSURANCES = [
  {
    title: 'Finished by hand',
    body: 'Foil, letterpress and laser engraving, pressed one card at a time — not run off a desktop printer.',
  },
  {
    title: 'Made to your wording',
    body: 'Names, dates, language and layout are set for your event. Nothing here is a fixed template.',
  },
  {
    title: 'A proof before we print',
    body: 'You approve a digital proof first. Nothing goes to press until the wording is right.',
  },
];

const STEPS = [
  { n: '01', title: 'Tell us the piece', body: 'Message us the design you like and roughly how many you need.' },
  { n: '02', title: 'We quote and proof', body: 'You get a price, a paper recommendation and a digital proof to approve.' },
  { n: '03', title: 'We print and deliver', body: 'Approved artwork goes to press and ships to your door.' },
];

export default function ShopClient({ products = [], categories = [], badges = [], settings = {} }) {
  const [category, setCategory] = useState('all');
  const [badgeId, setBadgeId] = useState('all');
  const [sort, setSort] = useState(settings.default_sort || 'manual');

  const live = isShopLive(settings);

  const visible = useMemo(() => {
    let rows = products;
    if (category !== 'all') rows = rows.filter((p) => p.category_id === category);
    if (badgeId !== 'all') rows = rows.filter((p) => (p.badges || []).some((b) => b.id === badgeId));
    return sortProducts(rows, sort);
  }, [products, category, badgeId, sort]);

  // A filter chip that can only ever return nothing is worse than no chip: it
  // reads as a broken page. Collections with no published product in them are
  // dropped rather than rendered as dead ends.
  const usableCategories = useMemo(
    () => categories.filter((c) => products.some((p) => p.category_id === c.id)),
    [categories, products],
  );
  const usableBadges = useMemo(
    () => badges.filter((b) => products.some((p) => (p.badges || []).some((pb) => pb.id === b.id))),
    [badges, products],
  );

  const heroCta = live ? buildWhatsappUrl({ settings }) : null;

  return (
    <main className="pi-main">
      {/* ─────────────────────────── Hero ─────────────────────────── */}
      <section className="pi-hero">
        <div className="pi-hero-glow" aria-hidden="true" />
        <div className="fx-container fx-container--4xl fx-gutter pi-hero-inner">
          <p className="pi-kicker">{settings.hero_kicker || 'HANDCRAFTED · PRINTED · DELIVERED'}</p>
          <h1 className="pi-hero-title">{settings.hero_title || 'Printed Invitations'}</h1>
          <p className="pi-hero-sub">
            {settings.hero_subtitle
              || 'Invitations your guests can hold. Pressed, foiled and finished by hand, then delivered to your door.'}
          </p>

          <div className="pi-hero-actions">
            <a href="#pi-collection" className="pi-btn pi-btn--gold">View the collection</a>
            {heroCta && (
              <a href={heroCta} target="_blank" rel="noopener noreferrer" className="pi-btn pi-btn--onDark">
                <WhatsappGlyph />
                Talk to us on WhatsApp
              </a>
            )}
          </div>

          {settings.default_lead_time && (
            <p className="pi-hero-lead">{settings.default_lead_time}</p>
          )}
        </div>
      </section>

      {/* ───────────────────── Why these, not a print shop ───────────────────── */}
      <section className="fx-section fx-section--sm">
        <div className="fx-container fx-container--4xl fx-gutter">
          <div className="fx-grid fx-grid--3">
            {ASSURANCES.map((a) => (
              <div key={a.title} className="pi-assure">
                <span className="pi-assure-rule" aria-hidden="true" />
                <h2 className="pi-assure-title">{a.title}</h2>
                <p className="pi-assure-body">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── Collection ─────────────────────────── */}
      <section id="pi-collection" className="fx-section pi-collection">
        <div className="fx-container fx-container--4xl fx-gutter">
          <header className="pi-sec-head">
            <p className="pi-kicker pi-kicker--dark">THE COLLECTION</p>
            <h2 className="pi-sec-title">Every piece we make</h2>
          </header>

          {/* ── Filters ── */}
          {(usableCategories.length > 0 || usableBadges.length > 0 || products.length > 0) && (
            <div className="pi-filters">
              <div className="pi-chips fx-scroll-x" role="group" aria-label="Filter by collection">
                <button
                  type="button"
                  onClick={() => setCategory('all')}
                  className={`pi-chip ${category === 'all' ? 'pi-chip--on' : ''}`}
                  aria-pressed={category === 'all'}
                >
                  All pieces
                </button>
                {usableCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`pi-chip ${category === c.id ? 'pi-chip--on' : ''}`}
                    aria-pressed={category === c.id}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* The admin-written labels, doubling as filters — this is the
                  "filters we can write New on" requirement. A label is only a
                  chip here if the admin marked it filterable. */}
              {usableBadges.length > 0 && (
                <div className="pi-chips fx-scroll-x" role="group" aria-label="Filter by label">
                  <button
                    type="button"
                    onClick={() => setBadgeId('all')}
                    className={`pi-chip pi-chip--sm ${badgeId === 'all' ? 'pi-chip--on' : ''}`}
                    aria-pressed={badgeId === 'all'}
                  >
                    Any label
                  </button>
                  {usableBadges.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBadgeId(b.id)}
                      className={`pi-chip pi-chip--sm ${badgeId === b.id ? 'pi-chip--on' : ''}`}
                      aria-pressed={badgeId === b.id}
                      style={badgeId === b.id ? { background: b.bg_color, borderColor: b.bg_color, color: b.text_color } : undefined}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="pi-filters-tail">
                <span className="pi-count">
                  {visible.length} {visible.length === 1 ? 'piece' : 'pieces'}
                </span>
                <label className="pi-sort">
                  <span className="pi-sort-label">Sort</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className="pi-select">
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* ── Grid ── */}
          {visible.length === 0 ? (
            <EmptyState hasProducts={products.length > 0} onReset={() => { setCategory('all'); setBadgeId('all'); }} />
          ) : (
            <div className="fx-grid fx-grid--3 pi-grid">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} settings={settings} live={live} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────── How it works ─────────────────────────── */}
      <section className="fx-section pi-steps">
        <div className="fx-container fx-container--4xl fx-gutter">
          <header className="pi-sec-head pi-sec-head--center">
            <p className="pi-kicker">HOW ORDERING WORKS</p>
            <h2 className="pi-sec-title pi-sec-title--light">Three messages, start to finish</h2>
          </header>
          <div className="fx-grid fx-grid--3 pi-steps-grid">
            {STEPS.map((s) => (
              <div key={s.n} className="pi-step">
                <span className="pi-step-n">{s.n}</span>
                <h3 className="pi-step-title">{s.title}</h3>
                <p className="pi-step-body">{s.body}</p>
              </div>
            ))}
          </div>
          {heroCta && (
            <div className="pi-steps-cta">
              <a href={heroCta} target="_blank" rel="noopener noreferrer" className="pi-btn pi-btn--gold">
                <WhatsappGlyph />
                Start the conversation
              </a>
              <p className="pi-steps-note">
                No online checkout — we quote every piece by hand so the price matches what you actually need.
              </p>
            </div>
          )}
        </div>
      </section>

      <ShopStyles />
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Card
   ═══════════════════════════════════════════════════════════════════════ */

function ProductCard({ product, settings, live }) {
  const cover = coverImage(product);
  const hover = product.images?.[1] || null;
  const href = `${SHOP_PATH}/${product.slug}`;
  const price = priceLine(product);

  const waUrl = live ? buildWhatsappUrl({ settings, product }) : null;

  return (
    <article className="pi-card">
      <Link href={href} className="pi-card-art" aria-label={`View ${product.title}`}>
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover.url} alt={cover.alt || product.title} className="pi-card-img" loading="lazy" />
            {hover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hover.url} alt="" aria-hidden="true" className="pi-card-img pi-card-img--hover" loading="lazy" />
            )}
          </>
        ) : (
          <div className="pi-card-noimg" aria-hidden="true"><span>Fancy</span></div>
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
      </Link>

      <div className="pi-card-body">
        <h3 className="pi-card-title">
          <Link href={href} className="pi-card-link">{product.title}</Link>
        </h3>
        {product.tagline && <p className="pi-card-tag">{product.tagline}</p>}

        <div className="pi-card-foot">
          <span className={`pi-card-price ${product.price_cents == null ? 'pi-card-price--quote' : ''}`}>
            {price}
          </span>
          {product.min_order_qty ? (
            <span className="pi-card-min">Min. {product.min_order_qty}</span>
          ) : null}
        </div>

        <div className="pi-card-actions">
          <Link href={href} className="pi-btn pi-btn--ghost pi-btn--sm">View details</Link>
          {waUrl && !product.is_sold_out && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pi-btn pi-btn--gold pi-btn--sm"
              onClick={() => recordShopInquiry(product.id, 'listing')}
            >
              <WhatsappGlyph />
              Order
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyState({ hasProducts, onReset }) {
  return (
    <div className="pi-empty">
      <h3 className="pi-empty-title">
        {hasProducts ? 'Nothing matches those filters' : 'The collection is being photographed'}
      </h3>
      <p className="pi-empty-body">
        {hasProducts
          ? 'Try a different collection or label — or clear the filters to see every piece.'
          : 'New pieces are added here as they are finished. Check back shortly.'}
      </p>
      {hasProducts && (
        <button type="button" onClick={onReset} className="pi-btn pi-btn--ghost pi-btn--sm">
          Clear filters
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Styles — catalogue-only. Anything the product page also needs belongs in
   piStyles.js, which is included first below.
   ═══════════════════════════════════════════════════════════════════════ */

function ShopStyles() {
  return (
    <style jsx global>{`
      ${PI_BASE_CSS}

      /* ── Hero ── */
      .pi-hero {
        position: relative; background: ${C.charcoal}; color: ${C.ivory};
        padding: clamp(72px, 12vw, 132px) 0 clamp(60px, 9vw, 96px); overflow: hidden;
      }
      .pi-hero-glow {
        position: absolute; inset: 0;
        background:
          radial-gradient(ellipse 70% 55% at 50% 0%, rgba(184,148,79,.20), transparent 70%),
          radial-gradient(ellipse 40% 40% at 85% 90%, rgba(184,148,79,.10), transparent 70%);
        pointer-events: none;
      }
      .pi-hero-inner { position: relative; z-index: 1; text-align: center; }
      .pi-hero-title {
        font-family: var(--font-serif); font-size: clamp(38px, 7.5vw, 76px);
        line-height: 1.04; margin: 0 0 20px; letter-spacing: -.02em; color: ${C.ivory};
      }
      .pi-hero-sub {
        font-size: clamp(15px, 2vw, 18px); line-height: 1.7; color: rgba(248,244,236,.76);
        max-width: 620px; margin: 0 auto 34px;
      }
      .pi-hero-actions { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; }
      .pi-hero-lead {
        margin: 26px 0 0; font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
        color: rgba(248,244,236,.5);
      }

      /* ── Assurances ── */
      .pi-assure { min-width: 0; }
      .pi-assure-rule { display: block; width: 34px; height: 1px; background: ${C.gold}; margin-bottom: 18px; }
      .pi-assure-title {
        font-family: var(--font-serif); font-size: 19px; color: ${C.charcoal};
        margin: 0 0 10px; letter-spacing: -.01em;
      }
      .pi-assure-body { font-size: 14.5px; line-height: 1.7; color: ${C.stone}; margin: 0; }

      /* ── Collection ── */
      .pi-collection { background: ${C.ivory}; }
      .pi-filters {
        display: flex; flex-direction: column; gap: 14px;
        padding-bottom: 22px; margin-bottom: 30px; border-bottom: 1px solid ${C.border};
      }
      .pi-chips { display: flex; gap: 8px; flex-wrap: wrap; min-width: 0; }
      .pi-chip {
        min-height: 40px; padding: 0 18px; border-radius: 999px;
        border: 1px solid ${C.border}; background: ${C.white}; color: ${C.stone};
        font-family: var(--font-sans); font-size: 13px; font-weight: 500;
        cursor: pointer; transition: all .2s cubic-bezier(.16,1,.3,1); white-space: nowrap;
      }
      .pi-chip:hover { border-color: ${C.gold}; color: ${C.charcoal}; }
      .pi-chip--on { background: ${C.charcoal}; border-color: ${C.charcoal}; color: ${C.ivory}; }
      .pi-chip--sm { min-height: 34px; padding: 0 14px; font-size: 12px; }

      .pi-filters-tail { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .pi-count { font-size: 13px; color: ${C.stone}; letter-spacing: .04em; }
      .pi-sort { display: inline-flex; align-items: center; gap: 8px; }
      .pi-sort-label { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: ${C.stone}; }
      .pi-select {
        min-height: 40px; padding: 0 32px 0 12px; border: 1px solid ${C.border}; border-radius: 2px;
        background: ${C.white}; color: ${C.charcoal}; font-family: var(--font-sans);
        /* 16px: anything smaller makes iOS Safari zoom the whole page on focus. */
        font-size: 16px; cursor: pointer; appearance: none;
        background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235E5A52' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 10px center;
      }
      .pi-select:focus { outline: none; border-color: ${C.gold}; box-shadow: 0 0 0 3px rgba(184,148,79,.15); }

      .pi-grid { margin-top: 4px; }

      /* ── Card ── */
      .pi-card {
        display: flex; flex-direction: column; min-width: 0;
        background: ${C.white}; border: 1px solid ${C.border}; border-radius: 3px; overflow: hidden;
        transition: box-shadow .3s cubic-bezier(.16,1,.3,1), transform .3s cubic-bezier(.16,1,.3,1);
      }
      .pi-card:hover { box-shadow: 0 18px 44px rgba(25,27,30,.10); transform: translateY(-3px); }
      .pi-card-art {
        position: relative; display: block; aspect-ratio: 4 / 5; overflow: hidden;
        background: ${C.ivory}; text-decoration: none;
      }
      .pi-card-img {
        position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
        transition: opacity .5s ease, transform .7s cubic-bezier(.16,1,.3,1);
      }
      .pi-card-img--hover { opacity: 0; }
      .pi-card:hover .pi-card-img--hover { opacity: 1; }
      .pi-card:hover .pi-card-img { transform: scale(1.04); }
      /* .pi-card-noimg, .pi-card-badges and .pi-badge live in piStyles.js —
         the product page needs them too. */

      .pi-card-body { display: flex; flex-direction: column; gap: 8px; padding: 20px; flex: 1; min-width: 0; }
      .pi-card-title { font-family: var(--font-serif); font-size: 19px; margin: 0; letter-spacing: -.01em; line-height: 1.3; }
      .pi-card-link { color: ${C.charcoal}; text-decoration: none; }
      .pi-card-link:hover { color: ${C.goldCta}; }
      .pi-card-tag { font-size: 13.5px; line-height: 1.6; color: ${C.stone}; margin: 0; }
      .pi-card-foot { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-top: auto; padding-top: 10px; }
      .pi-card-price { font-size: 16px; font-weight: 700; color: ${C.charcoal}; }
      .pi-card-price--quote { font-size: 14px; font-weight: 600; color: ${C.goldCta}; letter-spacing: .02em; }
      .pi-card-min { font-size: 12px; color: ${C.stone}; }
      .pi-card-actions { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 12px; }
      .pi-card-actions > * { flex: 1 1 auto; }

      /* ── Empty ── */
      .pi-empty { text-align: center; padding: 64px 20px; border: 1px dashed ${C.border}; border-radius: 3px; background: ${C.white}; }
      .pi-empty-title { font-family: var(--font-serif); font-size: 22px; color: ${C.charcoal}; margin: 0 0 10px; }
      .pi-empty-body { font-size: 14.5px; color: ${C.stone}; margin: 0 auto 20px; max-width: 420px; line-height: 1.7; }

      /* ── Steps ── */
      .pi-steps { background: ${C.charcoal}; }
      .pi-steps-grid { margin-top: 8px; }
      .pi-step { min-width: 0; padding-top: 20px; border-top: 1px solid rgba(215,190,128,.25); }
      .pi-step-n { display: block; font-family: var(--font-serif); font-size: 13px; letter-spacing: .2em; color: ${C.gold}; margin-bottom: 12px; }
      .pi-step-title { font-family: var(--font-serif); font-size: 20px; color: ${C.ivory}; margin: 0 0 8px; }
      .pi-step-body { font-size: 14.5px; line-height: 1.7; color: rgba(248,244,236,.66); margin: 0; }
      .pi-steps-cta { text-align: center; margin-top: 48px; }
      .pi-steps-note { margin: 16px auto 0; max-width: 460px; font-size: 13px; line-height: 1.7; color: rgba(248,244,236,.5); }

      @media (max-width: 640px) {
        .pi-hero-actions { flex-direction: column; align-items: stretch; }
        .pi-hero-actions .pi-btn { width: 100%; }
        .pi-filters-tail { align-items: flex-start; }
        .pi-card-actions { flex-direction: column; }
      }

      /* The filter row is the most-tapped thing on this page and its chips
         measured 34–40px tall — under the 44px (--fx-touch) this codebase
         holds itself to. Raised on touch pointers only, so the desktop row
         keeps its tighter proportions. */
      @media (pointer: coarse) {
        .pi-chip, .pi-chip--sm, .pi-select { min-height: 44px; }
      }
    `}</style>
  );
}
