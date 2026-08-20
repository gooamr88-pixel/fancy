'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { S, ST, SHADOW, artFor } from './shopTheme';
import { formatPrice, SHOP_MIN_ORDER_QTY } from '../utils/shopLinks';

/* ═══════════════════════════════════════════════════════════════════════════
   THE SHOP — browse.

   One component renders both surfaces, because they are the same page with a
   different filter applied:

     /shop                → every piece, with the category shelves on top
     /shop/<category>     → one shelf

   Rendering them from one source is the point: the old catalogue had a single
   flat list and a separate hand-written hero, and the two drifted — the hero
   advertised "printed invitations" while the list had grown scanners in it.

   ── WHAT THE FILTERS ARE BUILT FROM ───────────────────────────────────────

   Only from columns that exist. The approved mockup showed Material, Finish
   and Stock filters, and there are no such columns on shop_products — building
   them would mean either inventing data or parsing it out of prose, and a
   filter that silently matches nothing is worse than no filter. What is real:
   category, admin-defined filterable badges, price, and availability.

   Material/finish filtering is a schema change (a `facets jsonb` column, or a
   shop_product_facets table) and is deliberately left out rather than faked.

   ── MOBILE FIRST ──────────────────────────────────────────────────────────

   The base rules are the phone: two cards per row, filters behind a button
   rather than stacked above the grid where they push every product below the
   fold. The single media query steps up at 768.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Fixed steps rather than a slider bound to the data's own min/max: a
 *  catalogue holding a $0.35 belly band and a $1,150 display has a range no
 *  slider can express usefully, and named bands are what people actually
 *  reach for. */
const PRICE_BANDS = [
  { key: 'u1', label: 'Under $1', test: (c) => c !== null && c < 100 },
  { key: '1-3', label: '$1 – $3', test: (c) => c !== null && c >= 100 && c <= 300 },
  { key: '3-25', label: '$3 – $25', test: (c) => c !== null && c > 300 && c <= 2500 },
  { key: '25+', label: '$25 and up', test: (c) => c !== null && c > 2500 },
  { key: 'quote', label: 'Price on request', test: (c) => c === null },
];

const SORTS = [
  { key: 'featured', label: 'Featured' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'name', label: 'Name (A–Z)' },
];

/**
 * Keeps "price on request" at the bottom of either price sort.
 *
 * Returns a comparator result when at least one side has no price, and `null`
 * when both are priced so the caller can do the real comparison. Two quoted
 * pieces tie (0) rather than producing NaN.
 */
function quotedLast(a, b) {
  const aq = a.price_cents == null;
  const bq = b.price_cents == null;
  if (aq && bq) return 0;
  if (aq) return 1;
  if (bq) return -1;
  return null;
}

function PlaceholderArt({ slug }) {
  return (
    <span className="sp-art" aria-hidden="true">
      <svg viewBox="0 0 100 92" fill="none" stroke={S.gold} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.55"
        dangerouslySetInnerHTML={{ __html: artFor(slug) }} />
    </span>
  );
}

function ProductCard({ product, categorySlug, href }) {
  const img = product.images?.[0];
  const price = formatPrice(product.price_cents, product.currency);
  const was = formatPrice(product.compare_at_cents, product.currency);
  const badge = product.badges?.[0];
  const moq = product.min_order_qty || SHOP_MIN_ORDER_QTY;

  return (
    <article className="sp">
      <Link href={href} className="sp-media">
        {badge && (
          <span className="sp-badge" style={{ background: badge.bg_color || S.ivory, color: badge.text_color || S.goldInk }}>
            {badge.label}
          </span>
        )}
        {product.is_sold_out && <span className="sp-badge sp-badge--out">Sold out</span>}
        {/* `url`/`alt`, not `image_url`/`alt_text`: the row columns are the
            latter, but attachRelations() in the public controller maps them on
            the way out, and the API shape is what this component receives. */}
        {img
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img className="sp-img" src={img.url} alt={img.alt || product.title} loading="lazy" />
          : <PlaceholderArt slug={categorySlug} />}
      </Link>

      <div className="sp-body">
        <Link href={href} className="sp-title">{product.title}</Link>
        {product.tagline && <span className="sp-spec">{product.tagline}</span>}

        <span className="sp-price">
          {price
            ? <><span className="sp-amount">{price}</span>
              {product.price_unit && <span className="sp-unit"> / {product.price_unit}</span>}</>
            : <span className="sp-amount sp-amount--quote">Price on request</span>}
          {was && <span className="sp-was">{was}</span>}
        </span>

        <span className="sp-meta">
          <span className="sp-moq">Min. {moq}</span>
          {product.lead_time_text && <span className="sp-lead">{product.lead_time_text}</span>}
        </span>
      </div>
    </article>
  );
}

export default function ShopBrowse({ products, categories, badges, settings, category }) {
  const [openFilters, setOpenFilters] = useState(false);
  const [activeBadges, setActiveBadges] = useState(() => new Set());
  const [activeBands, setActiveBands] = useState(() => new Set());
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [sort, setSort] = useState('featured');

  const catBySlug = useMemo(
    () => new Map((categories || []).map((c) => [c.slug, c])),
    [categories],
  );
  const catById = useMemo(
    () => new Map((categories || []).map((c) => [c.id, c])),
    [categories],
  );

  /** The shelf being shown, or null on the shop home. */
  const shelf = category ? catBySlug.get(category) : null;

  const inShelf = useMemo(
    () => (shelf ? (products || []).filter((p) => p.category_id === shelf.id) : (products || [])),
    [products, shelf],
  );

  const filterable = useMemo(
    () => (badges || []).filter((b) => b.is_filterable),
    [badges],
  );

  const shown = useMemo(() => {
    let list = inShelf;

    if (activeBadges.size) {
      list = list.filter((p) => (p.badges || []).some((b) => activeBadges.has(b.id)));
    }
    if (activeBands.size) {
      const tests = PRICE_BANDS.filter((b) => activeBands.has(b.key));
      list = list.filter((p) => tests.some((b) => b.test(p.price_cents)));
    }
    if (hideSoldOut) list = list.filter((p) => !p.is_sold_out);

    const by = {
      // `sort_order` first, then newest — the admin's own arrangement, which
      // is what "featured" means here rather than a popularity metric nothing
      // in this system records.
      featured: (a, b) => (b.is_featured - a.is_featured)
        || (a.sort_order - b.sort_order)
        || String(a.title).localeCompare(String(b.title)),
      // Nulls are "price on request" and sort LAST in BOTH directions: they
      // are not free, and putting them at the top of "low to high" would say
      // they were.
      //
      // Quoted pieces are partitioned out rather than mapped to ±Infinity.
      // The arithmetic version returned `Infinity - Infinity` — NaN — whenever
      // two quoted pieces were compared, and a comparator that returns NaN has
      // no defined behaviour: the order it produces is whatever the engine's
      // sort happens to do with it.
      'price-asc': (a, b) => quotedLast(a, b) ?? (a.price_cents - b.price_cents),
      'price-desc': (a, b) => quotedLast(a, b) ?? (b.price_cents - a.price_cents),
      name: (a, b) => String(a.title).localeCompare(String(b.title)),
    }[sort];

    return [...list].sort(by);
  }, [inShelf, activeBadges, activeBands, hideSoldOut, sort]);

  /** Counts are computed against the shelf, not against the filtered result —
   *  a count that changes as you tick things tells you nothing about what
   *  ticking the NEXT box would do. */
  const badgeCount = (id) => inShelf.filter((p) => (p.badges || []).some((b) => b.id === id)).length;
  const bandCount = (band) => inShelf.filter((p) => band.test(p.price_cents)).length;

  const appliedCount = activeBadges.size + activeBands.size + (hideSoldOut ? 1 : 0);

  const toggle = (setter) => (value) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  });
  const toggleBadge = toggle(setActiveBadges);
  const toggleBand = toggle(setActiveBands);

  const clearAll = () => {
    setActiveBadges(new Set());
    setActiveBands(new Set());
    setHideSoldOut(false);
  };

  const hrefFor = (p) => {
    const slug = catById.get(p.category_id)?.slug;
    return slug ? `/shop/${slug}/${p.slug}` : `/shop/all/${p.slug}`;
  };

  const title = shelf ? shelf.name : (settings?.hero_title || 'Shop');
  const blurb = shelf
    ? shelf.description
    : (settings?.hero_subtitle
      || 'Cards, envelopes, signage, screens and the door hardware — priced per unit in US dollars, made to the same artwork as your digital invitation.');

  const filterPanel = (
    <div className="sf">
      <div className="sf-head">
        <span className="sf-title">Filter</span>
        {appliedCount > 0 && (
          <button type="button" className="sf-clear" onClick={clearAll}>Clear all</button>
        )}
      </div>

      {filterable.length > 0 && (
        <div className="sf-group">
          <span className="sf-legend">Labels</span>
          {filterable.map((b) => {
            const n = badgeCount(b.id);
            return (
              <label key={b.id} className={`sf-row${n === 0 ? ' sf-row--empty' : ''}`}>
                <input
                  type="checkbox"
                  checked={activeBadges.has(b.id)}
                  onChange={() => toggleBadge(b.id)}
                  disabled={n === 0}
                />
                <span className="sf-label">{b.label}</span>
                <span className="sf-count">{n}</span>
              </label>
            );
          })}
        </div>
      )}

      <div className="sf-group">
        <span className="sf-legend">Price</span>
        {PRICE_BANDS.map((band) => {
          const n = bandCount(band);
          return (
            <label key={band.key} className={`sf-row${n === 0 ? ' sf-row--empty' : ''}`}>
              <input
                type="checkbox"
                checked={activeBands.has(band.key)}
                onChange={() => toggleBand(band.key)}
                disabled={n === 0}
              />
              <span className="sf-label">{band.label}</span>
              <span className="sf-count">{n}</span>
            </label>
          );
        })}
      </div>

      <div className="sf-group">
        <span className="sf-legend">Availability</span>
        <label className="sf-row">
          <input type="checkbox" checked={hideSoldOut} onChange={() => setHideSoldOut((v) => !v)} />
          <span className="sf-label">Hide sold out</span>
          <span className="sf-count">{inShelf.filter((p) => p.is_sold_out).length}</span>
        </label>
      </div>
    </div>
  );

  return (
    <main className="shop">
      {/* ── the head ── */}
      <section className="shop-head">
        <div className="fx-container fx-container--5xl fx-gutter">
          <nav className="shop-crumb" aria-label="Breadcrumb">
            <Link href="/shop">Shop</Link>
            {shelf && <><span aria-hidden="true"> / </span><span>{shelf.name}</span></>}
          </nav>
          <h1 className="shop-h1">{title}</h1>
          {blurb && <p className="shop-blurb">{blurb}</p>}
        </div>
      </section>

      {/* ── the shelves, on the shop home only ── */}
      {!shelf && categories?.length > 0 && (
        <section className="shop-cats">
          <div className="fx-container fx-container--5xl fx-gutter">
            <span className="shop-kicker">Browse by category
              <span aria-hidden="true" className="shop-kicker__rule" /></span>
            <ul className="shop-cat-grid fx-grid" style={{ '--fx-col': '210px', '--fx-gap': '12px' }}>
              {categories.map((c) => {
                const n = (products || []).filter((p) => p.category_id === c.id).length;
                return (
                  <li key={c.id}>
                    <Link href={`/shop/${c.slug}`} className="shop-cat">
                      <span className="shop-cat__art" aria-hidden="true">
                        <svg viewBox="0 0 100 92" fill="none" stroke={S.gold} strokeWidth="2.6"
                          strokeLinecap="round" strokeLinejoin="round" opacity="0.75"
                          dangerouslySetInnerHTML={{ __html: artFor(c.slug) }} />
                      </span>
                      <span className="shop-cat__text">
                        <span className="shop-cat__name">{c.name}</span>
                        <span className="shop-cat__count">{n} {n === 1 ? 'piece' : 'pieces'}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ── the grid ── */}
      <section className="shop-body">
        <div className="fx-container fx-container--5xl fx-gutter shop-split">
          <aside className={`shop-aside${openFilters ? ' is-open' : ''}`}>{filterPanel}</aside>

          <div className="shop-main">
            <div className="shop-bar">
              <button
                type="button"
                className="shop-filterbtn"
                onClick={() => setOpenFilters((v) => !v)}
                aria-expanded={openFilters}
              >
                Filter{appliedCount > 0 && <span className="shop-pill">{appliedCount}</span>}
              </button>

              <span className="shop-count">
                <strong>{shown.length}</strong>
                {shown.length !== inShelf.length && <> of {inShelf.length}</>}
                {' '}{inShelf.length === 1 ? 'piece' : 'pieces'}
              </span>

              <label className="shop-sort">
                <span className="shop-sort__label">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
            </div>

            {/* Two different nothings.
                An empty SHELF and an over-tight FILTER look identical in the
                grid and need opposite responses — offering "clear your
                filters" to someone who has set none reads as a broken page,
                and it was what this said when the catalogue was empty or the
                backend was unreachable. */}
            {shown.length === 0 ? (
              inShelf.length === 0 ? (
                <p className="shop-empty">
                  {shelf
                    ? `Nothing is listed under ${shelf.name} yet.`
                    : 'The catalogue is being photographed. Nothing is listed yet.'}
                </p>
              ) : (
                <p className="shop-empty">
                  Nothing matches those filters yet.{' '}
                  <button type="button" onClick={clearAll} className="shop-empty__clear">Clear them</button>
                </p>
              )
            ) : (
              <ul className="shop-grid fx-grid" style={{ '--fx-col': '158px', '--fx-gap': '12px' }}>
                {shown.map((p) => (
                  <li key={p.id}>
                    <ProductCard
                      product={p}
                      categorySlug={catById.get(p.category_id)?.slug}
                      href={hrefFor(p)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* A PLAIN style element. styled-jsx stamps its hash only onto lowercase
          intrinsic elements, so every rule aimed at a class on a next/link
          here would compile to .sp-title.jsx-hash and match nothing — the bug
          that made this platform's alerts invisible in production. Classes are
          prefixed "shop-", "sp-" and "sf-" instead.

          No backticks inside these CSS comments: one would terminate the
          template literal and produce a parse error. */}
      <style>{`
        .shop { background: ${S.paper}; }

        .shop-head { padding: 26px 0 0; }
        .shop-crumb { font-size: 11px; letter-spacing: 0.08em; color: ${S.inkSoft}; }
        .shop-crumb a { color: ${S.inkSoft}; text-decoration: none; opacity: 0.8; }
        .shop-crumb a:hover { color: ${S.ink}; }
        .shop-h1 {
          font-family: ${ST.display};
          font-weight: 300;
          font-size: 32px;
          line-height: 1.06;
          letter-spacing: -0.018em;
          color: ${S.ink};
          margin: 12px 0 0;
        }
        .shop-blurb {
          font-size: 14.5px;
          font-weight: 300;
          line-height: 1.78;
          color: ${S.inkSoft};
          margin: 10px 0 0;
          max-width: 56ch;
        }

        .shop-kicker {
          display: inline-flex;
          align-items: center;
          gap: 11px;
          font-family: ${ST.label};
          font-size: 9.5px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: ${S.goldInk};
          white-space: nowrap;
        }
        .shop-kicker__rule { display: block; flex: none; width: 24px; height: 1px; background: ${S.gold}; opacity: 0.55; }

        .shop-cats { padding: 30px 0 0; }
        .shop-cat-grid { list-style: none; margin: 16px 0 0; padding: 0; }
        .shop-cat {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: ${S.paper};
          border: 1px solid ${S.border};
          text-decoration: none;
          transition: border-color 0.25s ease, background 0.25s ease;
        }
        .shop-cat:hover { border-color: ${S.borderLift}; background: ${S.paper2}; }
        .shop-cat__art {
          flex: none;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: ${S.paper2};
        }
        .shop-cat__art svg { width: 58%; }
        .shop-cat__text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .shop-cat__name {
          font-family: ${ST.display};
          font-size: 15px;
          line-height: 1.2;
          color: ${S.ink};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .shop-cat__count { font-size: 9.5px; letter-spacing: 0.1em; color: ${S.inkSoft}; opacity: 0.8; }

        .shop-body { padding: 26px 0 60px; }
        .shop-split { display: block; }

        /* ── the bar ── */
        .shop-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding-bottom: 12px;
          border-bottom: 1px solid ${S.border};
        }
        .shop-filterbtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          padding: 0 16px;
          background: ${S.paper};
          border: 1px solid ${S.ink};
          color: ${S.ink};
          font-family: ${ST.body};
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .shop-pill {
          background: ${S.ink};
          color: ${S.paper};
          border-radius: 999px;
          padding: 1px 6px;
          font-size: 10px;
        }
        .shop-count { font-size: 11.5px; color: ${S.inkSoft}; }
        .shop-count strong { color: ${S.ink}; font-weight: 600; }
        .shop-sort { display: inline-flex; align-items: center; gap: 7px; margin-left: auto; }
        .shop-sort__label {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${S.inkSoft};
        }
        .shop-sort select {
          min-height: 44px;
          /* 16px: iOS zooms the whole page in on focus for anything smaller,
             and it never zooms back out. */
          font-size: 16px;
          font-family: ${ST.body};
          color: ${S.ink};
          background: ${S.paper};
          border: 1px solid ${S.border};
          padding: 0 8px;
          border-radius: 0;
        }

        /* ── filters ── */
        .shop-aside { display: none; }
        .shop-aside.is-open { display: block; margin: 16px 0 4px; }
        .sf-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
        .sf-title { font-family: ${ST.display}; font-size: 19px; color: ${S.ink}; }
        .sf-clear {
          background: none;
          border: 0;
          border-bottom: 1px solid ${S.gold};
          padding: 0 0 3px;
          cursor: pointer;
          font-family: ${ST.body};
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${S.goldInk};
        }
        .sf-group { padding: 13px 0; border-top: 1px solid ${S.border}; }
        .sf-group:first-of-type { border-top: 0; }
        .sf-legend {
          display: block;
          font-size: 9.5px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${S.ink};
          font-weight: 600;
          margin-bottom: 6px;
        }
        .sf-row { display: flex; align-items: center; gap: 9px; min-height: 34px; cursor: pointer; }
        .sf-row--empty { opacity: 0.4; cursor: default; }
        .sf-row input { width: 15px; height: 15px; accent-color: ${S.gold}; flex: none; }
        .sf-label {
          flex: 1 1 auto;
          min-width: 0;
          font-size: 12.5px;
          color: ${S.ink};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sf-count { flex: none; font-size: 11px; color: ${S.inkSoft}; opacity: 0.7; }

        /* ── the grid ── */
        .shop-grid { list-style: none; margin: 16px 0 0; padding: 0; }
        .shop-empty { margin: 26px 0 0; font-size: 14px; color: ${S.inkSoft}; }
        .shop-empty__clear {
          background: none;
          border: 0;
          border-bottom: 1px solid ${S.gold};
          padding: 0 0 2px;
          cursor: pointer;
          font: inherit;
          color: ${S.ink};
        }

        /* ── one card ── */
        .sp {
          display: flex;
          flex-direction: column;
          min-width: 0;
          height: 100%;
          background: ${S.paper};
          border: 1px solid ${S.border};
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .sp:hover { border-color: ${S.borderLift}; box-shadow: ${SHADOW.cardHover}; }
        .sp-media { position: relative; display: block; overflow: hidden; }
        .sp-img, .sp-art {
          display: block;
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          object-position: center 18%;
          transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.3, 1);
        }
        .sp:hover .sp-img { transform: scale(1.04); }
        .sp-art {
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${S.paper3};
        }
        .sp-art svg { width: 52%; }
        .sp-badge {
          position: absolute;
          top: 7px;
          left: 7px;
          z-index: 2;
          border: 1px solid ${S.border};
          padding: 3px 7px;
          font-size: 8px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }
        .sp-badge--out { left: auto; right: 7px; background: ${S.ink}; color: ${S.ivory}; border-color: ${S.ink}; }

        .sp-body {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 10px;
          border-top: 1px solid ${S.border};
          flex: 1 1 auto;
        }
        /* Two lines, with a floor, so a wrapping title cannot make its card
           taller than its neighbours and knock the row's prices out of line. */
        .sp-title {
          font-family: ${ST.display};
          font-size: 15px;
          line-height: 1.22;
          color: ${S.ink};
          text-decoration: none;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 37px;
        }
        .sp-title:hover { color: ${S.goldInk}; }
        .sp-spec {
          font-size: 9.5px;
          color: ${S.inkSoft};
          opacity: 0.8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sp-price { display: flex; align-items: baseline; gap: 7px; margin-top: auto; padding-top: 4px; }
        .sp-amount { font-family: ${ST.display}; font-size: 19px; color: ${S.ink}; }
        .sp-amount--quote { font-size: 15px; }
        .sp-unit { font-size: 11px; color: ${S.inkSoft}; }
        .sp-was { font-size: 11px; color: ${S.inkSoft}; opacity: 0.65; text-decoration: line-through; }
        .sp-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-top: 7px;
          border-top: 1px solid ${S.border};
        }
        .sp-moq {
          font-size: 9.5px;
          color: ${S.ink};
          background: ${S.paper2};
          border: 1px solid ${S.border};
          padding: 2px 6px;
          white-space: nowrap;
        }
        .sp-lead {
          font-size: 9.5px;
          color: ${S.inkSoft};
          opacity: 0.7;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ── 768 and up ── */
        @media (min-width: 768px) {
          .shop-head { padding-top: 34px; }
          .shop-h1 { font-size: 46px; margin-top: 14px; }
          .shop-blurb { font-size: 16px; margin-top: 12px; }
          .shop-kicker { font-size: 10.5px; letter-spacing: 0.34em; gap: 14px; }
          .shop-kicker__rule { width: 38px; }
          .shop-cats { padding-top: 40px; }
          .shop-cat-grid { margin-top: 20px; }
          .shop-cat { padding: 13px; gap: 13px; }
          .shop-cat__art { width: 42px; height: 42px; }
          .shop-cat__name { font-size: 17px; }

          .shop-body { padding: 34px 0 84px; }
          .shop-split {
            display: grid;
            grid-template-columns: 216px minmax(0, 1fr);
            gap: 40px;
            align-items: start;
          }
          /* The panel is always visible beside the grid at this width, so the
             button that toggles it has nothing to do. */
          .shop-aside { display: block; }
          .shop-filterbtn { display: none; }
          .shop-grid { margin-top: 20px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .sp, .sp-img, .shop-cat { transition: none; }
        }
      `}</style>
    </main>
  );
}
