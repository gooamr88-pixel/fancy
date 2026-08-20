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

/** Line-art stand-ins, by category slug, for pieces with no photograph yet.
 *  An obviously-drawn placeholder is better than a stretched stock photo: it
 *  cannot be mistaken for the product.
 *
 *  Not exported — `artFor` is the only way in, so a caller cannot index this
 *  directly and get `undefined` for a category an admin has just added. */
const CATEGORY_ART = {
  'wedding-cards': '<rect x="18" y="26" width="64" height="44" rx="2"/><path d="M30 40h40M30 50h40M30 60h24"/>',
  'screens-displays': '<rect x="14" y="18" width="72" height="46" rx="3"/><path d="M50 64v12M36 76h28"/>',
  'scanners-door': '<rect x="30" y="14" width="40" height="58" rx="6"/><path d="M40 30h20M40 40h20M40 50h12"/><circle cx="50" cy="66" r="3"/>',
  'printed-materials': '<rect x="28" y="16" width="44" height="62" rx="2"/><path d="M38 32h24M38 42h24M38 52h16"/>',
  signage: '<rect x="24" y="14" width="52" height="40" rx="2"/><path d="M50 54v22M38 76h24"/>',
  'envelopes-extras': '<rect x="16" y="28" width="68" height="42" rx="2"/><path d="M16 30l34 24 34-24"/>',
};

/** An admin can add a category at any time, and a slug with no drawing must
 *  not render an empty box — it falls back to the generic card glyph. */
export function artFor(slug) {
  return CATEGORY_ART[slug] || CATEGORY_ART['wedding-cards'];
}
