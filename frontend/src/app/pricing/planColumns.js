/**
 * How many plan cards sit in a DESKTOP row, for a price list of `n` tiers.
 *
 * Its own module rather than an export of page.js: that file is an App Router
 * route, where the framework reserves what a page may export, and a helper
 * hanging off it is the kind of thing that builds locally and fails in CI.
 * PlanRecommender.js sits in this folder for the same reason.
 *
 * `pricing_tiers` is a JSONB column an admin edits — the schema seeds three,
 * production runs six — so this has to be right for a number nobody here
 * controls. Inside the 1104px grid box at 1280 (fx-container--4xl, less
 * fx-section's 48px a side):
 *
 *   n <= 5  →  n across. Five is 195px a card, which still holds a price, a
 *              plan name and a two-line feature. It is the longest ladder that
 *              still reads left to right in one scan.
 *   n >= 6  →  half of them, capped at four. Six across would be 157px — the
 *              width at which ENTERPRISE breaks across two lines — so six
 *              becomes two rows of three, seven 4+3, eight 4+4.
 *
 * The property that matters, and the one the test pins, is that it never
 * leaves ONE card alone on a second row. Both of this grid's previous layouts
 * did: auto-fit orphaned the fourth of four, and the rule that fixed that was
 * gated on `plans.length <= 4`, so six tiers orphaned the sixth.
 */
export function planColumns(n) {
  if (n <= 5) return Math.max(n, 1);
  return Math.min(4, Math.ceil(n / 2));
}

export default planColumns;
