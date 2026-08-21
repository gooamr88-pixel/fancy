/* ═══════════════════════════════════════════════════════════════════════════
   THE SHOP'S VOCABULARY.

   Deliberately the SAME palette and type roles as the landing page's
   landingTokens.js rather than a second set: a store that does not look like
   the site it sits inside reads as a third-party plugin, which is exactly what
   the old catalogue looked like.

   It is a separate file rather than an import of landingTokens because the two
   surfaces have different owners and different reasons to change — the landing
   page's palette moving should not silently repaint a price list — and because
   this one carries shop-specific values (the card ramp, the swatch set) that
   have no business in a marketing token file.

   Type: Cormorant Garamond for display, Aboreto for tracked micro-labels only
   (it is a CAPITALS-ONLY face — never a sentence), Google Sans for everything
   a person reads at length.
   ═══════════════════════════════════════════════════════════════════════════ */

export const S = {
  paper: '#FCFBF8',
  paper2: '#F5F0E6',
  paper3: '#EFE8DA',
  border: '#E3DBCB',
  /** The hairline one step darker, for a card that is being hovered. */
  borderLift: '#CFC3AC',

  ink: '#191815',
  inkSoft: '#5C574E',

  /** Ornament and hairlines only. */
  gold: '#A98A4E',
  /** The readable gold: clears 4.5:1 on paper. Labels, numerals, links. */
  goldInk: '#8A6D34',

  ivory: '#F6F2E9',
};

export const ST = {
  display: 'var(--font-cormorant), Georgia, "Noto Naskh Arabic", serif',
  /** Two or three words, uppercase, wide tracking. Never a sentence. */
  label: 'var(--font-heading), "Aboreto", Georgia, serif',
  body: 'var(--font-sans)',
};

/* NO SWATCH SET HERE.
   The approved mockup showed a row of finish swatches on every card, and this
   file briefly carried the eight material colours for it. There is no column
   on shop_products holding a product's finishes, so nothing could ever fill
   them — the export sat unused, which is how a palette that means nothing ends
   up being copied into a real component later. Bringing swatches back is a
   schema change first (a `facets jsonb`, or a shop_product_facets table). */

export const SHADOW = {
  /** The only one the grid uses: a card lifting under the pointer. */
  cardHover: '0 18px 40px -24px rgba(25, 24, 21, 0.45)',
};

/* ── THE DRAWINGS ──────────────────────────────────────────────────────────
   Line art, by category slug, for a shelf or a piece with no photograph yet.
   An obviously-drawn plate is better than a stretched stock photo: it cannot
   be mistaken for the product.

   TWO SETS, ON PURPOSE, BOTH ON A 48x48 GRID.

   `artFor` is the full drawing — an inner rule on the card, the text lines,
   the poured wax seal — and is only legible from about 40px up: it is what a
   category plate and a product placeholder show.

   `markFor` is the same subject reduced to the two or three strokes that
   survive at 16-20px, for the shelf index inside a category. Shrinking the
   full drawing there produced a grey smudge — the seal and the inner rule
   collapse into the outline — which is the opposite of premium.

   Neither map is exported: the `…For` functions are the only way in, so a
   caller cannot index them directly and get `undefined` for a category an
   admin added this morning.

   The gold fills come from S so a palette change reaches the drawings too. */
const CATEGORY_ART = {
  // An invitation: the card, its printed rule, the type, a wax seal below.
  'wedding-cards':
    '<rect x="12" y="4" width="24" height="39" rx="1"/>'
    + '<path d="M16 8.5h16v26H16z" stroke-width="0.9" opacity="0.6"/>'
    + '<path d="M20 15h8M20 20h8M20 25h5"/>'
    + `<circle cx="24" cy="38.5" r="3.6" fill="${S.gold}" stroke-width="0.9"/>`,
  // A welcome screen on its pedestal.
  'screens-displays':
    '<rect x="5" y="9" width="38" height="23" rx="2"/>'
    + '<path d="M13 17h22M13 24h14"/>'
    + '<path d="M24 32v6M16 42h16"/>',
  // A code being read: the finder squares, and the beam crossing them.
  'scanners-door':
    '<rect x="8" y="8" width="32" height="32" rx="2"/>'
    + '<rect x="13" y="13" width="8" height="8"/><rect x="27" y="13" width="8" height="8"/>'
    + '<rect x="13" y="27" width="8" height="8"/>'
    + '<path d="M27 28h4M31 33h4M27 36h3"/>'
    + `<path d="M4 24h40" stroke="${S.gold}" stroke-width="1.5"/>`,
  // A menu standing behind a tented place card.
  'printed-materials':
    '<rect x="9" y="4" width="20" height="27"/>'
    + '<path d="M13.5 11h11M13.5 17h11M13.5 23h7"/>'
    + '<path d="M22 42l10-9 10 9z"/><path d="M28 39h8"/>',
  // A board on an easel — splayed legs are what tells it from a screen.
  signage:
    '<rect x="9" y="5" width="30" height="23"/>'
    + '<path d="M15 12h18M15 18h12"/>'
    + '<path d="M15 28l-4 14M33 28l4 14M13 38h22"/>',
  // An envelope, sealed.
  'envelopes-extras':
    '<rect x="6" y="13" width="36" height="24" rx="1.5"/>'
    + '<path d="M6.8 14.2L24 27.2 41.2 14.2"/>'
    + `<circle cx="24" cy="29.5" r="4.4" fill="${S.gold}" stroke-width="0.9"/>`,
};

const CATEGORY_MARK = {
  'wedding-cards':
    '<rect x="12" y="4" width="24" height="39" rx="1"/><path d="M20 16h8M20 23h8"/>'
    + `<circle cx="24" cy="35" r="3.4" fill="${S.gold}" stroke-width="1.2"/>`,
  'screens-displays': '<rect x="5" y="9" width="38" height="23" rx="2"/><path d="M24 32v6M16 42h16"/>',
  'scanners-door':
    '<rect x="8" y="8" width="32" height="32" rx="2"/><rect x="13" y="13" width="8" height="8"/>'
    + '<rect x="27" y="13" width="8" height="8"/><rect x="13" y="27" width="8" height="8"/>',
  'printed-materials': '<rect x="9" y="4" width="20" height="27"/><path d="M13.5 12h11M13.5 19h11"/><path d="M22 42l10-9 10 9z"/>',
  signage: '<rect x="9" y="5" width="30" height="23"/><path d="M15 28l-4 14M33 28l4 14M13 38h22"/>',
  'envelopes-extras': '<rect x="6" y="13" width="36" height="24" rx="1.5"/><path d="M6.8 14.2L24 27.2 41.2 14.2"/>',
};

/** The whole catalogue, for the "All pieces" entry in the shelf index. A
 *  compass rose rather than a seventh product: it is not a shelf. */
export const ALL_MARK = '<path d="M24 6l4.6 13.4L42 24l-13.4 4.6L24 42l-4.6-13.4L6 24l13.4-4.6z"/>';

/** Every drawing is authored in this box. Callers must not guess it: the set
 *  moved from 100x92 to 48x48 once, and a stale viewBox does not error — it
 *  silently crops the drawing to a corner. */
export const ART_VIEWBOX = '0 0 48 48';

/** An admin can add a category at any time, and a slug with no drawing must
 *  not render an empty box — it falls back to the invitation card. */
export function artFor(slug) {
  return CATEGORY_ART[slug] || CATEGORY_ART['wedding-cards'];
}

/** The same subject at index size. Same fallback rule as artFor. */
export function markFor(slug) {
  return CATEGORY_MARK[slug] || CATEGORY_MARK['wedding-cards'];
}
