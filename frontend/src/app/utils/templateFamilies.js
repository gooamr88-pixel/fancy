/* ═══════════════════════════════════════════════════════════════
   Which templates behave as which kind of event.

   These lists were duplicated in five files, each carrying a "keep in sync
   with…" comment — which is an admission that they will not stay in sync.
   This is the copy the guest renderer and the invitation-card builder share;
   the wizard and settings screens still hold their own (they gate different
   things, and merging them is a larger change than this one).

   `template_type` is a free-text column with no CHECK constraint, so nothing
   below is enforced by the database. Anything not named here falls through to
   the default handling, which is why the lists are inclusive rather than
   exhaustive.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Curated templates that are visual variants of a wedding — same content
 * schema (partner names, ceremony/reception) and the same "wedding" chrome as
 * the base template, differing only in artwork and colour story.
 */
export const WEDDING_VARIANT_TEMPLATES = [
  'tuscany', 'marrakesh', 'kyoto', 'nordic', 'havana',
  'estate', 'roseAtelier', 'orchid', 'clay', 'alpine', 'coastal', 'heritageArch',
  /* Door of Joy is NOT here any more, and neither is any other cinematic
     template. Being on this list means "this artwork IS a wedding" — the
     wedding card copy, the "wedding invitation" label and the Groom's/Bride's
     Side wording, regardless of what the organizer is celebrating. That is
     precisely what stopped a birthday from using the knocking door. The
     cinematic templates carry a `defaultOccasion` instead (see
     cinematic/cinematicThemes.js), which the organizer's own answer overrides.

     What is left here is the retired visual variants, which have no such
     entry and no picker to answer in. */
];
