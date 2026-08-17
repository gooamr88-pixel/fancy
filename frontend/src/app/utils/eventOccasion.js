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
 * Which occasions a template may be used for.
 *
 * A template is artwork, and some artwork only means one thing. Velvet Ring
 * is a ring box opening onto a ring: there is no reading of it under which it
 * is a baby shower, so it declares `occasions: ['engagement']`. Door of Joy,
 * Swan Lake and Custom Canvas declare `'any'` — a door, a sealed envelope and
 * a blank canvas each suit whatever is being celebrated.
 *
 * The retired keys are locked to whatever they have always been: they cannot
 * be created new, and an event already on one was built for that shape.
 *
 * @returns {string[]|'any'}
 */
export function allowedOccasionsFor(templateType) {
  const declared = getCinematicTemplate(templateType)?.occasions;
  if (declared) return declared;
  // Custom Canvas is the build-your-own template; it is 'any' by definition.
  if (templateType === 'custom' || !templateType) return 'any';
  const retired = RETIRED_TEMPLATE_OCCASION[templateType];
  return retired ? [retired] : 'any';
}

/** True when the template allows exactly one occasion, so there is no choice. */
export function isOccasionLocked(templateType) {
  const allowed = allowedOccasionsFor(templateType);
  return allowed !== 'any' && allowed.length <= 1;
}

/** True when `occasion` is one this template may be used for. */
export function isOccasionAllowed(templateType, occasion) {
  const allowed = allowedOccasionsFor(templateType);
  return allowed === 'any' ? !!CUSTOM_CATEGORY_BY_KEY[occasion] : allowed.includes(occasion);
}

/**
 * The occasion for an event: the organizer's own answer, else the template's
 * default — CLAMPED to what the template allows.
 *
 * The clamp is the safety net that makes a locked template actually locked.
 * `custom_category` is free-form JSON on a row anybody with API access can
 * write, and an event that carried `birthday` on Velvet Ring would otherwise
 * render a birthday kicker over a ring box. Clamping on READ means no
 * migration is needed to enforce a policy change either: the next render is
 * already correct.
 *
 * @param {string} templateType   event.template_type
 * @param {object} [templateData] event.template_data
 * @returns {string} an occasion key, or '' when nothing implies one.
 */
export function resolveOccasion(templateType, templateData) {
  const chosen = templateData?.custom_category;
  // Guarded, not trusted: neither a key the catalogue has never heard of nor
  // one this template is not for may reach the page.
  if (chosen && CUSTOM_CATEGORY_BY_KEY[chosen] && isOccasionAllowed(templateType, chosen)) {
    return chosen;
  }
  return defaultOccasionFor(templateType);
}

/** The catalogue entry for an event's occasion, or null. */
export function occasionMetaFor(templateType, templateData) {
  return CUSTOM_CATEGORY_BY_KEY[resolveOccasion(templateType, templateData)] || null;
}

/**
 * What the template card should promise, and what the pickers should offer.
 *
 * One source for both, so a card can never advertise a freedom the picker
 * refuses — or hide one it allows.
 *
 * @returns {{locked: boolean, allowed: string[]|'any', occasion: string,
 *            label: string, iconName: string, note: string}}
 */
export function occasionPolicyFor(templateType) {
  const allowed = allowedOccasionsFor(templateType);
  const locked = isOccasionLocked(templateType);
  const occasion = locked ? allowed[0] : defaultOccasionFor(templateType);
  const meta = CUSTOM_CATEGORY_BY_KEY[occasion];

  return {
    locked,
    allowed,
    occasion,
    // The badge on the template card.
    label: locked ? (meta?.label || occasion) : 'Any occasion',
    // EventCategoryIcon keys are the occasion keys; 'sparkle' is the
    // catch-all the unlocked badge uses.
    iconName: locked ? occasion : 'celebration',
    note: locked
      ? `This template is made for ${(meta?.label || occasion).toLowerCase()} invitations, so the occasion is fixed.`
      : 'Use this template for any occasion — you choose which, and the invitation words itself to match.',
  };
}
