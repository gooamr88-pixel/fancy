import { getCinematicTemplate } from '../components/templates/cinematic/cinematicThemes';
import { WEDDING_VARIANT_TEMPLATES } from './templateFamilies';
import { CUSTOM_CATEGORY_BY_KEY } from './customEventCategories';

/* ═══════════════════════════════════════════════════════════════
   What kind of event this is — one answer, one place.

   A template is artwork now, not an occasion: the organizer picks from
   customEventCategories.js on any template, and the template only supplies a
   fallback for the events created before that picker existed.

   ── Why this is its own module ───────────────────────────────────────────
   The fallback chain was written out three times — in the wizard's Stage 2,
   in EventSettings, and in HeritageArchPage — as

       templateData.custom_category
         || getCinematicTemplate(t)?.defaultOccasion
         || (WEDDING_STYLE_TEMPLATE_KEYS.includes(t) ? 'wedding' : '')

   and every copy was subtly wrong in the same way: the RETIRED Engagement
   template has no cinematic entry and is not a wedding variant, so it fell
   through to '' — no occasion, and therefore no partner-name fields on either
   screen. An event created as Engagement lost its couple's names from every
   edit surface. Three copies is also three chances to fix it in only two.

   `template_type` is free text with no CHECK constraint, so an unknown key
   resolves to '' rather than throwing; callers treat that as "not answered".
   ═══════════════════════════════════════════════════════════════ */

/**
 * The occasion a template means when the organizer has not chosen one.
 *
 * The cinematic templates carry their own `defaultOccasion`. Everything else
 * here is retired from the picker and cannot be created new — it is listed so
 * that events already on those keys keep the content shape they were built
 * with.
 */
const RETIRED_TEMPLATE_OCCASION = {
  wedding: 'wedding',
  // The reason this file exists. Retired, still renderable, and the only
  // full-page template whose occasion is neither cinematic nor a wedding.
  engagement: 'engagement',
};
WEDDING_VARIANT_TEMPLATES.forEach((key) => { RETIRED_TEMPLATE_OCCASION[key] = 'wedding'; });

/** @returns {string} an occasion key, or '' when the template implies none. */
export function defaultOccasionFor(templateType) {
  return getCinematicTemplate(templateType)?.defaultOccasion
    || RETIRED_TEMPLATE_OCCASION[templateType]
    || '';
}

/**
 * The occasion for an event: the organizer's own answer, else the template's
 * default.
 *
 * @param {string} templateType   event.template_type
 * @param {object} [templateData] event.template_data
 * @returns {string} an occasion key, or '' when nothing implies one.
 */
export function resolveOccasion(templateType, templateData) {
  const chosen = templateData?.custom_category;
  // Guarded, not trusted: a stale or hand-edited key must not resolve to an
  // occasion nothing downstream can render.
  if (chosen && CUSTOM_CATEGORY_BY_KEY[chosen]) return chosen;
  return defaultOccasionFor(templateType);
}

/** The catalogue entry for an event's occasion, or null. */
export function occasionMetaFor(templateType, templateData) {
  return CUSTOM_CATEGORY_BY_KEY[resolveOccasion(templateType, templateData)] || null;
}
