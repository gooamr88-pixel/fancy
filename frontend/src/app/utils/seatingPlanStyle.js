/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Seating map — THE look of the guest's floor plan.
 *
 * `seatingGeometry.js` answers *where* an element sits. This answers what it
 * looks like once it gets there, for the two surfaces a GUEST sees:
 *
 *   • [slug]/rsvp/SeatingMiniMap.js        — the thumbnail under the QR code
 *   • [slug]/rsvp/SeatingMapFullscreen.js  — the expanded, pannable plan
 *
 * It exists for the same reason seatingGeometry does. Those two files drew the
 * same room from two hand-written sets of inline styles, and the styles had
 * already diverged in ways nobody could see side by side (different radii,
 * different borders, a pulse ring in one and not the other). One module means a
 * change to how a table reads lands on the thumbnail and the full plan together.
 *
 * The organizer's editor (dashboard/seating-map) deliberately does NOT read from
 * here. It is a work surface: it needs names, capacities, occupancy counts and
 * selection handles on every element, and its density is a feature. These two are
 * a finished artefact handed to a guest, and their job is the opposite — one
 * table matters and the rest is context.
 *
 * ── THE RULE THIS MODULE ENFORCES ──
 *
 * NOTHING ON THE PLAN IS NAMED. Tables carry a NUMBER; zones carry a glyph.
 *
 * The distinction is the whole point. "Table 12" is a name — eight characters
 * that render at about seven pixels on the thumbnail, unreadable, while still
 * pulling the eye evenly across fifteen tables, which is the exact opposite of
 * what this map is for. "12" is a number: one or two characters, so it can be
 * set three times larger in the same space and actually be read, the way a
 * numeral is set on a printed floor plan or a seating card.
 *
 * So the word "Table" is dropped, not the identity. It is stated once, in full,
 * in serif, immediately above the map ("Your table: Table 12") — where there is
 * room for it — and the plan itself carries only the numeral.
 *
 * Zones lose their text entirely: "Dance Floor" has no number, and a zone is
 * identified by its glyph and colour, named once in the legend beneath the
 * expanded plan.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { shapeMeta, isZone, elWidth, elHeight } from './seatingGeometry';

/** The product's gold. Matches BRAND.gold in the email templates. */
/* Module-private. Both maps import the STYLE helpers, never the raw colour —
   an exported constant is an invitation to hand-roll a variant element beside
   the ones this module draws, which is the drift it exists to prevent.
   (`GOLD_INK`, exported alongside this and imported by nobody, is gone.) */
const GOLD = '#B8944F';

/** How far a chair sits from the edge of its table, in world px. */
const SEAT_GAP = 9;
/** A chair's diameter in world px, and the floor it never renders below. */
const SEAT_SIZE = 10;
const SEAT_MIN_PX = 1.8;
/** One floor module — the ruled grid on the paper, in world px. */
const FLOOR_MODULE = 100;

/**
 * Chair positions for one element, in world px relative to its own top-left.
 *
 * The single detail that makes this read as a venue rather than a diagram: a
 * bare circle is a shape, a circle with ten chairs around it is a table for ten.
 * It also makes size mean something — a head table for twelve and a round table
 * for ten stop being "a long one and a small one".
 *
 * Capped at 14 because past that the pips merge into a solid ring at any scale
 * this map is ever drawn at, and a solid ring reads as a border, not as seats.
 */
export function seatPositions(el) {
  const meta = shapeMeta(el.shape);
  const capacity = Math.min(Number(el.capacity) || meta.defaultCap || 10, 14);
  const w = elWidth(el);
  const h = elHeight(el);
  const out = [];

  if (meta.round) {
    // Elliptical, not circular: an oval table is 132×86, and a circular ring
    // around it would float off the ends and cut through the sides.
    const rx = w / 2 + SEAT_GAP;
    const ry = h / 2 + SEAT_GAP;
    for (let i = 0; i < capacity; i += 1) {
      const a = (i / capacity) * Math.PI * 2 - Math.PI / 2;
      out.push({ x: w / 2 + Math.cos(a) * rx, y: h / 2 + Math.sin(a) * ry });
    }
    return out;
  }

  // Rectangles seat along the two long edges, which is how the room is actually
  // laid out — nobody seats a guest at the end of a banquet table.
  const perSide = Math.ceil(capacity / 2);
  for (let i = 0; i < perSide; i += 1) {
    const x = ((i + 0.5) / perSide) * w;
    out.push({ x, y: -SEAT_GAP });
    if (i * 2 + 1 < capacity) out.push({ x, y: h + SEAT_GAP });
  }
  return out;
}

/** Chair diameter at a given scale, with a floor so it survives the thumbnail. */
const seatPx = (scale) => Math.max(SEAT_MIN_PX, SEAT_SIZE * scale);

/**
 * The paper the plan is printed on.
 *
 * An engraved double rule drawn entirely with inset shadows — white keyline,
 * ivory gutter, gold hairline — so the frame costs no extra element and cannot
 * be clipped by the elements sitting on top of it.
 */
export const planSurfaceStyle = (radius = 14) => ({
  background: '#F7F2E7',
  borderRadius: `${radius}px`,
  boxShadow: [
    'inset 0 0 0 1px rgba(255,255,255,0.85)',
    'inset 0 0 0 4px #F7F2E7',
    'inset 0 0 0 5px rgba(138,109,52,0.26)',
    '0 1px 0 rgba(255,255,255,0.7)',
    '0 10px 26px -14px rgba(60,45,20,0.45)',
  ].join(', '),
});

/**
 * The ruled floor. `scale` is world px → screen px, so the module stays a
 * property of the ROOM: zoom in and the ruling grows with the tables, exactly as
 * a printed plan would.
 */
export const floorGrainStyle = (scale) => ({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  backgroundImage:
    'linear-gradient(rgba(138,109,52,0.045) 1px, transparent 1px), '
    + 'linear-gradient(90deg, rgba(138,109,52,0.045) 1px, transparent 1px)',
  backgroundSize: `${FLOOR_MODULE * scale}px ${FLOOR_MODULE * scale}px`,
});

/** Corner shading — enough to stop the paper reading as a flat fill. */
export const floorVignetteStyle = () => ({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background:
    'radial-gradient(120% 95% at 50% 40%, rgba(255,255,255,0.32) 0%, '
    + 'rgba(255,255,255,0) 34%, rgba(92,70,34,0.11) 100%)',
});

/**
 * How one element is painted.
 *
 * `dimOthers` is passed only when the guest actually HAS a table. With no
 * assignment there is nothing to point at, so the room renders at full strength
 * rather than uniformly muted — a plan where everything is dimmed just looks
 * broken.
 *
 * Note the dim is 0.82 and there is no desaturation. An earlier pass dropped the
 * room to 0.58 and desaturated it, which did make the gold table jump out — off
 * a plan so washed the guest could no longer tell the bar from the buffet. The
 * gold is the only warm object on cool paper; that contrast is doing the work,
 * and it does not need the rest of the room sacrificed to it.
 */
export function elementStyle(el, { scale, mine = false, dimOthers = false }) {
  const zone = isZone(el);
  const meta = shapeMeta(el.shape);
  const color = el.color || meta.color || GOLD;

  const base = {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: meta.round
      ? '50%'
      : `${Math.max(3, (zone ? 12 : 9) * scale)}px`,
    zIndex: mine ? 6 : zone ? 1 : 2,
    ...(dimOthers && !mine ? { opacity: 0.82 } : null),
  };

  if (zone) {
    return {
      ...base,
      background: `linear-gradient(160deg, ${color}2E 0%, ${color}1A 100%)`,
      border: `1px solid ${color}5E`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(60,45,25,0.07)',
    };
  }

  if (mine) {
    return {
      ...base,
      background: 'linear-gradient(145deg, #F8E8C4 0%, #EBD199 46%, #D6B26E 100%)',
      border: `${Math.max(1.4, 9.6 * scale)}px solid ${GOLD}`,
      boxShadow: [
        'inset 0 1px 0 rgba(255,255,255,0.7)',
        `0 0 0 ${Math.max(3, 21 * scale)}px rgba(184,148,79,0.15)`,
        `0 ${Math.max(3, 42 * scale)}px ${Math.max(8, 90 * scale)}px -6px rgba(138,109,52,0.55)`,
      ].join(', '),
    };
  }

  return {
    ...base,
    background: 'linear-gradient(160deg, #FFFDF8 0%, #EFE7D6 100%)',
    border: '1px solid rgba(112,92,60,0.34)',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.9)',
      '0 1px 1px rgba(60,45,25,0.07)',
      `0 ${Math.max(2, 21 * scale)}px ${Math.max(4, 45 * scale)}px -6px rgba(60,45,25,0.4)`,
    ].join(', '),
  };
}

/** A chair. */
export const seatStyle = (pos, scale, mine) => {
  const d = seatPx(scale);
  return {
    position: 'absolute',
    width: `${d}px`,
    height: `${d}px`,
    borderRadius: '50%',
    left: `${pos.x * scale - d / 2}px`,
    top: `${pos.y * scale - d / 2}px`,
    background: mine ? 'rgba(138,109,52,0.62)' : 'rgba(112,92,60,0.38)',
    pointerEvents: 'none',
  };
};

/**
 * The spotlight under the guest's table.
 *
 * Positioned by the CALLER in plan coordinates rather than as a child of the
 * table, because a child would be clipped by the table's own `border-radius:
 * 50%` and inherit its rotation — a glow that rotates with a table reads as a
 * smear.
 */
export const spotlightStyle = (left, top, w, h) => {
  const gw = w * 3.4;
  const gh = h * 3.4;
  return {
    position: 'absolute',
    left: `${left + w / 2 - gw / 2}px`,
    top: `${top + h / 2 - gh / 2}px`,
    width: `${gw}px`,
    height: `${gh}px`,
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 4,
    background:
      'radial-gradient(circle, rgba(184,148,79,0.30) 0%, rgba(184,148,79,0.12) 38%, rgba(184,148,79,0) 68%)',
  };
};

/**
 * The marker above the guest's table — a mark, not a word.
 *
 * This replaced a "★ You're here" pill. The pill was 8px text on the thumbnail
 * (illegible), and it was wider than the 96px table it pointed at, so on a dense
 * plan it covered the two neighbouring tables. A star in a gold disc reads at
 * every scale, needs no translation, and never overlaps anything but the table
 * it belongs to.
 */
export const markerStyle = (w) => {
  const s = Math.max(11, Math.min(w * 0.44, 30));
  return {
    position: 'absolute',
    top: `-${s * 0.72}px`,
    left: '50%',
    transform: 'translateX(-50%)',
    width: `${s}px`,
    height: `${s}px`,
    borderRadius: '50%',
    background: `linear-gradient(140deg, #E8CE95, ${GOLD})`,
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${s * 0.56}px`,
    lineHeight: 1,
    boxShadow: `0 ${s * 0.18}px ${s * 0.44}px -2px rgba(138,109,52,0.6), inset 0 1px 0 rgba(255,255,255,0.5)`,
    zIndex: 7,
  };
};

/**
 * The numeral a table is marked with on the plan.
 *
 * Organizer table names in this product are overwhelmingly a bare number — see
 * the note on formatTableLabel, which exists because "5" alone reads
 * ambiguously in prose. On a floor plan the opposite is true: inside a drawn
 * circle a bare numeral is unambiguous, and it is the only form short enough to
 * be set large enough to read.
 *
 * The cases, in order:
 *   "5"            → "5"     already a numeral
 *   "Table 12"     → "12"    the word is dropped, the number kept
 *   "طاولة ٧"       → "٧"     Arabic-Indic digits count as digits
 *   "Table A3"     → "A3"    a section letter is part of the number
 *   "VIP"          → "VIP"   short enough to set as-is
 *   "Rose Garden"  → "RG"    initials, so a named table is still marked
 *   ""             → null    nothing to draw
 *
 * Never longer than three characters, because four is the point at which the
 * type has to shrink below the table's own legibility floor.
 */
const DIGITS = '0-9\\u0660-\\u0669\\u06F0-\\u06F9';
/**
 * The leading `(?:^|[\s.·-])` is load-bearing. Without it the optional letter
 * group is free to start mid-word and match the TAIL of the preceding one, so
 * "Table 12" comes out as "LE12". Anchoring the group to a word boundary means
 * a letter is only kept when it is genuinely a section marker of its own.
 */
const TRAILING_NUMBER = new RegExp(
  `(?:^|[\\s.·-])([A-Za-z\\u0621-\\u064A]{0,2})[\\s.·-]*([${DIGITS}]{1,3})\\s*$`,
);

export function planNumeral(tableName) {
  const name = String(tableName || '').trim();
  if (!name) return null;
  // Whitespace stripped, not preserved: "T 3" is one mark on a plan, and the gap
  // would be set at the numeral's own size — a third of the table taken by a
  // space.
  if (name.length <= 3) return name.replace(/\s+/g, '').toUpperCase();

  const m = name.match(TRAILING_NUMBER);
  if (m) return `${m[1]}${m[2]}`.toUpperCase();

  const initials = name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0));
  return initials.join('').toUpperCase() || null;
}

/**
 * How that numeral is set.
 *
 * Serif, because the rest of this product's headings are, and because a numeral
 * in a text face is what an engraved plan or a place card looks like — a
 * geometric sans numeral in a circle reads as a data label.
 *
 * `0.42 × height` rather than the old `height / 3`: two characters instead of
 * eight buys three times the type size in the same table. The 7px floor is what
 * keeps the thumbnail honest — below that the numeral is decoration, and a
 * decoration that looks like information is worse than nothing, so the caller
 * skips it entirely (see `numeralFits`).
 */
export const NUMERAL_MIN_PX = 7;
export const numeralFits = (h) => h * 0.42 >= NUMERAL_MIN_PX - 1.5;

export const numeralStyle = (h, mine, rotation = 0) => ({
  fontFamily: 'var(--font-serif)',
  fontSize: `${Math.max(NUMERAL_MIN_PX, Math.min(h * 0.42, 30))}px`,
  fontWeight: mine ? 700 : 500,
  // Tabular figures so "11" and "17" occupy the same width and a row of tables
  // reads as a row rather than as a ransom note.
  fontVariantNumeric: 'tabular-nums lining-nums',
  letterSpacing: '0.01em',
  lineHeight: 1,
  color: mine ? '#5A4212' : 'rgba(74,59,34,0.74)',
  // Counter-rotated. The numeral is a child of the table, and the table carries
  // `rotate(Ndeg)`, so without this a plan with angled tables makes the guest
  // tilt their head to read "12" — exactly the cheapness this redesign removes.
  ...(rotation ? { transform: `rotate(${-rotation}deg)` } : null),
  pointerEvents: 'none',
  userSelect: 'none',
});

/** Glyph size for a zone, from its drawn size. */
export const zoneGlyphSize = (w, h) => Math.max(9, Math.min(Math.min(w, h) * 0.42, 46));
export const ZONE_GLYPH_OPACITY = 0.82;

/**
 * The zones present on a plan, de-duplicated by shape, for the legend.
 *
 * The legend is what makes removing the zone names cost the guest nothing: the
 * plan stays clean, and "what is that purple square" is answered once underneath
 * it. Ordered by the catalogue rather than by position so the same venue always
 * produces the same legend.
 */
export function planLegend(elements) {
  const seen = new Map();
  for (const el of elements || []) {
    if (!el || !isZone(el)) continue;
    const meta = shapeMeta(el.shape);
    const key = el.shape === 'rectangular' ? 'rectangle' : el.shape;
    if (!seen.has(key)) {
      seen.set(key, { shape: key, label: meta.label, icon: meta.icon, color: meta.color || GOLD });
    }
  }
  return [...seen.values()];
}
