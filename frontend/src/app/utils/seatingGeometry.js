/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Seating map — THE shape catalogue and world geometry.
 *
 * Every surface that draws the venue layout reads from here:
 *   • dashboard/seating-map/page.js   — the organizer's editor + print/export
 *   • [slug]/rsvp/SeatingMiniMap.js   — the guest's inline map
 *   • [slug]/rsvp/SeatingMapFullscreen.js — the guest's expanded map
 *
 * This module exists because it used to be three hand-maintained copies, and
 * both ways they could disagree shipped as real bugs on the same day:
 *
 *   1. The catalogue drifted. The editor's palette grew to 14 venue zones while
 *      the two guest maps stayed at 6. A missing entry does not throw — it
 *      falls through to SHAPES.round, so a guest opening their seating chart
 *      saw the buffet drawn as a 96px round TABLE.
 *   2. The coordinate convention drifted. position_x/position_y is the element's
 *      TOP-LEFT corner (see elCenterX); the print/export path read it as the
 *      CENTRE, shifting every element by half its OWN size. Because sizes differ
 *      per shape, the exported layout didn't translate — it scrambled, and
 *      elements landed on top of each other.
 *
 * So: no local SHAPES object, no locally re-derived centre, in any consumer.
 * `backend/test/seatingShapeCatalogContract.test.js` enforces both — it fails if
 * a consumer re-declares its own catalogue, and it checks this list against the
 * API whitelist and the DB CHECK constraint.
 *
 * Adding a shape means editing (a) this file, (b) ZONE_SHAPES/TABLE_SHAPES in
 * backend/controllers/tableController.js, and (c) the DB `tables_shape_check`
 * via a migration. Any `icon` must exist in components/icons/Icon.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * The canvas is a large fixed logical world; positions are stored as
 * percentages (0–100) of it, so existing data keeps working at any zoom and on
 * any screen. Zones additionally store an explicit width/height in world px so
 * they can be resized; tables always take their size from the catalogue.
 */
export const WORLD_W = 2600;
export const WORLD_H = 1700;

export const SHAPES = {
  // ── seatable tables ──
  round:       { label: 'Round Table',     cat: 'table', w: 96,  h: 96,  seatable: true,  round: true,  defaultCap: 10 },
  oval:        { label: 'Oval Table',      cat: 'table', w: 132, h: 86,  seatable: true,  round: true,  defaultCap: 10 },
  square:      { label: 'Square Table',    cat: 'table', w: 96,  h: 96,  seatable: true,  round: false, defaultCap: 10 },
  rectangle:   { label: 'Rectangle Table', cat: 'table', w: 168, h: 84,  seatable: true,  round: false, defaultCap: 10 },
  /**
   * `pickable: false` — STILL RENDERED, no longer OFFERED.
   *
   * These two are Rectangle Table at different proportions: same silhouette,
   * same renderer, same seat maths, only wider. Six table buttons for two
   * actual shapes made the picker look like it held more choice than it did,
   * and an organizer who wants a long top table gets one by dropping a
   * Rectangle and dragging its handle.
   *
   * NOT DELETED, and that distinction is load-bearing. `shape` is validated and
   * drawn in four unlinked places plus a database CHECK constraint; removing a
   * key here would make every existing banquet/head table on every live event
   * fall through to "Invalid shape" or render as the wrong thing. They stay in
   * the catalogue, keep their geometry, and simply do not appear in the Add
   * panel — so old layouts are untouched and new ones stay simple.
   */
  banquet:     { label: 'Banquet Table',   cat: 'table', w: 230, h: 80,  seatable: true,  round: false, defaultCap: 10, pickable: false },
  head:        { label: 'Head Table',      cat: 'table', w: 250, h: 76,  seatable: true,  round: false, defaultCap: 10, pickable: false },
  // ── non-seating venue zones ──
  stage:        { label: 'Stage',        cat: 'zone', w: 360, h: 150, icon: 'mic',         color: '#3B3A55' },
  dance_floor:  { label: 'Dance Floor',  cat: 'zone', w: 280, h: 280, icon: 'discoBall',   color: '#6B5FA8' },
  bar:          { label: 'Bar',          cat: 'zone', w: 240, h: 92,  icon: 'cocktail',    color: '#9C5A3C' },
  dj_booth:     { label: 'DJ Booth',     cat: 'zone', w: 132, h: 112, icon: 'headphones',  color: '#2F5E8C' },
  entrance:     { label: 'Entrance',     cat: 'zone', w: 150, h: 70,  icon: 'door',        color: '#4A7C59' },
  restroom:     { label: 'WC',           cat: 'zone', w: 120, h: 100, icon: 'restroom',    color: '#3C7A89' },
  coat_check:   { label: 'Coat Check',   cat: 'zone', w: 150, h: 90,  icon: 'coatHanger',  color: '#6E5A46' },
  gift_table:   { label: 'Gift Table',   cat: 'zone', w: 150, h: 90,  icon: 'gift',        color: '#B85C7A' },
  cake_table:   { label: 'Cake Table',   cat: 'zone', w: 130, h: 100, icon: 'cake',        color: '#C97A9C' },
  photo_booth:  { label: 'Photo Booth',  cat: 'zone', w: 170, h: 130, icon: 'camera',      color: '#4A6FA5' },
  welcome_desk: { label: 'Welcome Desk', cat: 'zone', w: 170, h: 85,  icon: 'clipboard',   color: '#5A7A5E' },
  buffet:       { label: 'Buffet',       cat: 'zone', w: 220, h: 90,  icon: 'restaurant',  color: '#A2662E' },
  lounge:       { label: 'Lounge Area',  cat: 'zone', w: 220, h: 160, icon: 'sofa',        color: '#7D6A9A' },
  custom:       { label: 'Custom Area',  cat: 'zone', w: 190, h: 130, icon: 'star',        color: '#B8944F' },
};

export const TABLE_SHAPES = Object.keys(SHAPES).filter((k) => SHAPES[k].cat === 'table');
export const ZONE_SHAPES = Object.keys(SHAPES).filter((k) => SHAPES[k].cat === 'zone');

/**
 * What the Add panel offers — a subset of what the canvas can DRAW.
 *
 * Keep every consumer that validates or renders a shape reading TABLE_SHAPES /
 * ZONE_SHAPES / SHAPES. Only the picker reads these. Confusing the two is how a
 * legacy shape stops rendering.
 */
export const PICKABLE_TABLE_SHAPES = TABLE_SHAPES.filter((k) => SHAPES[k].pickable !== false);
export const PICKABLE_ZONE_SHAPES = ZONE_SHAPES.filter((k) => SHAPES[k].pickable !== false);

/**
 * Catalogue entry for a stored shape value. Maps the legacy 'rectangular' alias
 * from the original 2-shape model onto 'rectangle', and falls back to a round
 * table for anything unrecognized so a bad row degrades to a drawable element
 * instead of crashing the map. Never index SHAPES[...] directly — a raw lookup
 * returns undefined for 'rectangular' and throws on the next property access.
 */
export const shapeMeta = (shape) => SHAPES[shape === 'rectangular' ? 'rectangle' : shape] || SHAPES.round;

/**
 * Zones are non-seating venue furniture. `element_type` is authoritative when
 * present (it's what the API stores); the shape's category covers rows written
 * before that column existed.
 */
export const isZone = (el) => (el.element_type === 'zone') || (shapeMeta(el.shape).cat === 'zone');

/** Rendered size in world px. Zones honour their stored size; tables never do. */
export const elWidth = (el) => (isZone(el) ? Number(el.width) || shapeMeta(el.shape).w : shapeMeta(el.shape).w);
export const elHeight = (el) => (isZone(el) ? Number(el.height) || shapeMeta(el.shape).h : shapeMeta(el.shape).h);

/** Percentage of the world → world px. */
export const pctToPx = (pct, total) => (Number(pct) || 0) / 100 * total;

/**
 * `position_x` / `position_y` are the element's TOP-LEFT corner, as a
 * percentage of the world. That is what the editor renders from (straight into
 * CSS left/top) and what gets persisted.
 *
 * SVG wants the CENTRE instead, so it can rotate about it. Reading the stored
 * value AS a centre is silently wrong: it shifts every element up-left by half
 * its OWN size, and since sizes differ per shape (96px round table vs 360px
 * stage) the layout doesn't move, it scrambles. Always convert through these.
 */
export const elCenterX = (el) => pctToPx(el.position_x, WORLD_W) + elWidth(el) / 2;
export const elCenterY = (el) => pctToPx(el.position_y, WORLD_H) + elHeight(el) / 2;

/**
 * Axis-aligned bounding box in world px — the one primitive every hit-test,
 * fit-to-view and export bounding box should use. Ignores rotation, the same
 * simplification most box-select tools make.
 */
export const elBox = (el) => {
  const x = pctToPx(el.position_x, WORLD_W);
  const y = pctToPx(el.position_y, WORLD_H);
  const w = elWidth(el);
  const h = elHeight(el);
  return { x, y, w, h, right: x + w, bottom: y + h, cx: x + w / 2, cy: y + h / 2 };
};
