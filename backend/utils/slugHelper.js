/**
 * Slug utilities for auto-generating unique, URL-safe event links.
 *
 * The PRD requires the platform to "automatically generate a unique event link"
 * upon publication. These helpers turn human text (couple names, title, etc.) into
 * a clean slug and resolve collisions against existing events.
 */

/**
 * Convert arbitrary text into a lowercase, dash-separated, URL-safe slug.
 * Strips diacritics and any non-alphanumeric characters.
 * Mirrors the format enforced by the slug regex in eventController:
 *   /^[a-z0-9]+(?:-[a-z0-9]+)*$/
 */
const slugify = (text) =>
  String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents (combining diacritical marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics -> dash
    .replace(/-{2,}/g, '-') // collapse repeats
    .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes

/**
 * Derive a base slug from event details, preferring the most identifying names
 * per template type (e.g. couple names for weddings) and falling back to title.
 */
const deriveBaseSlug = ({ title, templateType, templateData = {} } = {}) => {
  const td = templateData || {};
  let source;

  switch (templateType) {
    case 'wedding':
    case 'engagement':
      if (td.partner1 || td.partner2) {
        source = [td.partner1, td.partner2].filter(Boolean).join('-');
      }
      break;
    case 'birthday':
      source = td.celebrant;
      break;
    case 'gala':
      source = td.honoree;
      break;
    case 'corporate':
      source = td.company;
      break;
    default:
      source = undefined;
  }

  const base = slugify(source) || slugify(title);
  // Guard against empty/degenerate input
  return base || `event-${Date.now().toString(36)}`;
};

/**
 * Return a slug guaranteed not to collide with an existing event.
 * Tries the base, then `base-<year>`, then `base-2`, `base-3`, ...,
 * and finally falls back to a short random suffix.
 *
 * The DB UNIQUE constraint on events.slug remains the source of truth; this only
 * reduces the chance of a collision before insert.
 */
const generateUniqueSlug = async (supabase, base, { year } = {}) => {
  const exists = async (candidate) => {
    const { data } = await supabase
      .from('events')
      .select('id')
      .eq('slug', candidate)
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  };

  if (!(await exists(base))) return base;

  if (year) {
    const withYear = `${base}-${year}`;
    if (!(await exists(withYear))) return withYear;
  }

  for (let i = 2; i <= 100; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }

  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
};

module.exports = { slugify, deriveBaseSlug, generateUniqueSlug };
