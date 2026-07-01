/**
 * Central Feature Registry — the single source of truth for every gateable
 * platform capability.
 *
 * Each feature has a machine-readable key (used in middleware + DB), a human
 * label (shown in admin UI and on the pricing page), a description (admin
 * tooltip), a category (for UI grouping), and a freeDefault flag indicating
 * whether the feature is available on unpaid / free-tier events.
 *
 * Adding a new feature:
 *   1. Add an entry here.
 *   2. Mount `requireFeature('your_key')` on the relevant route(s).
 *   3. The admin UI picks it up automatically from GET /admin/feature-registry.
 */

const PLATFORM_FEATURES = [
  // ── Guests & RSVP ──
  { key: 'rsvp_basic',           label: 'Basic RSVP forms',              description: 'Standard RSVP form with attending / declined status options.',                      category: 'Guests & RSVP',     freeDefault: true },
  { key: 'rsvp_custom_fields',   label: 'Custom RSVP form builder',      description: 'Add custom questions, dropdowns, and fields to your RSVP form.',                    category: 'Guests & RSVP',     freeDefault: false },
  { key: 'add_guest_manual',     label: 'Manual guest entry',            description: 'Organizers can manually add guests from the dashboard.',                             category: 'Guests & RSVP',     freeDefault: false },
  { key: 'import_guests_csv',    label: 'CSV guest import',              description: 'Bulk-import guest lists from a CSV file.',                                           category: 'Guests & RSVP',     freeDefault: false },
  { key: 'guest_export_csv',     label: 'Guest export (CSV)',            description: 'Download the full guest list as a CSV spreadsheet.',                                 category: 'Guests & RSVP',     freeDefault: false },
  { key: 'guest_export_excel',   label: 'Guest export (Excel)',          description: 'Download the full guest list as a formatted Excel workbook.',                        category: 'Guests & RSVP',     freeDefault: false },

  // ── Seating & Tables ──
  { key: 'seating_map',          label: 'Seating chart designer',        description: 'Visual drag-and-drop seating chart with table assignment.',                          category: 'Seating & Tables',  freeDefault: false },
  { key: 'table_management',     label: 'Table management',              description: 'Create, edit, duplicate, and position tables for your event.',                       category: 'Seating & Tables',  freeDefault: false },

  // ── Check-in ──
  { key: 'qr_checkin',           label: 'QR code check-in',             description: 'Scan QR ticket codes to check guests in at the door.',                               category: 'Check-in',          freeDefault: false },
  { key: 'manual_checkin',       label: 'Manual check-in',              description: 'Search and check in guests by name from the check-in console.',                      category: 'Check-in',          freeDefault: false },

  // ── Campaigns & SMS ──
  { key: 'sms_campaigns',        label: 'SMS campaign tools',            description: 'Send bulk SMS campaigns to guest segments with credit-based billing.',               category: 'Campaigns & SMS',   freeDefault: false },

  // ── Branding ──
  { key: 'custom_branding',      label: 'Custom themes & branding',     description: 'Apply custom colors, logos, and themes to your RSVP pages.',                         category: 'Branding',          freeDefault: false },
  { key: 'remove_watermark',     label: 'Remove Fancy watermark',       description: 'Remove the "Powered by Fancy RSVP" branding from guest-facing pages.',               category: 'Branding',          freeDefault: false },
  { key: 'white_label',          label: 'White-label solution',         description: 'Full white-label: custom domain, branding, and zero Fancy references.',              category: 'Branding',          freeDefault: false },

  // ── Analytics ──
  { key: 'analytics_basic',      label: 'Basic analytics dashboard',    description: 'View RSVP counts, response rates, and basic event metrics.',                        category: 'Analytics',         freeDefault: true },
  { key: 'analytics_advanced',   label: 'Real-time analytics & reports',description: 'Advanced charts, real-time tracking, guest demographics, and PDF reports.',          category: 'Analytics',         freeDefault: false },

  // ── Notifications ──
  { key: 'email_notifications',  label: 'Email notifications',          description: 'Automatic email confirmations and reminders for guests.',                            category: 'Notifications',    freeDefault: true },

  // ── Support ──
  { key: 'support_community',    label: 'Community support',            description: 'Access to community forums and knowledge-base articles.',                            category: 'Support',           freeDefault: true },
  { key: 'support_priority',     label: 'Priority email & chat support',description: 'Faster response times via dedicated email and live chat channels.',                  category: 'Support',           freeDefault: false },
  { key: 'support_dedicated',    label: 'Dedicated account manager',    description: 'A named account manager for onboarding, strategy, and escalations.',                 category: 'Support',           freeDefault: false },

  // ── Integrations ──
  { key: 'all_integrations',     label: 'All integrations',             description: 'Access every available third-party integration.',                                    category: 'Integrations',      freeDefault: false },
  { key: 'custom_api',           label: 'Custom integrations & API',    description: 'Build custom integrations using the Fancy RSVP developer API.',                      category: 'Integrations',      freeDefault: false },

  // ── Security ──
  { key: 'sso_team_mgmt',        label: 'SSO & team management',        description: 'Single Sign-On (SAML/OIDC) and multi-user team roles.',                              category: 'Security',          freeDefault: false },
  { key: 'advanced_security',    label: 'Advanced security & compliance',description: 'Audit logs, IP allowlisting, data-residency controls, and SOC 2 readiness.',       category: 'Security',          freeDefault: false },
];

// ── Derived lookups (computed once at require-time) ──

const _byKey = new Map(PLATFORM_FEATURES.map(f => [f.key, f]));

const FEATURE_CATEGORIES = [...new Set(PLATFORM_FEATURES.map(f => f.category))];

const FREE_TIER_FEATURES = new Set(
  PLATFORM_FEATURES.filter(f => f.freeDefault).map(f => f.key),
);

/** Returns a Map<category, feature[]> preserving insertion order. */
function getFeaturesByCategory() {
  const map = new Map();
  for (const f of PLATFORM_FEATURES) {
    if (!map.has(f.category)) map.set(f.category, []);
    map.get(f.category).push(f);
  }
  return map;
}

/** Returns the feature definition for a key, or undefined. */
function getFeatureByKey(key) {
  return _byKey.get(key);
}

/** Checks whether a key exists in the registry. */
function isValidFeatureKey(key) {
  return _byKey.has(key);
}

/**
 * Splits an array of keys into { valid, invalid }.
 * Unknown keys are silently stripped on save; the admin UI only offers valid
 * keys, so invalid ones indicate stale data or API misuse.
 */
function validateFeatureKeys(keys) {
  const valid = [];
  const invalid = [];
  for (const k of keys) {
    if (typeof k === 'string' && _byKey.has(k)) valid.push(k);
    else invalid.push(k);
  }
  return { valid, invalid };
}

module.exports = {
  PLATFORM_FEATURES,
  FEATURE_CATEGORIES,
  FREE_TIER_FEATURES,
  getFeaturesByCategory,
  getFeatureByKey,
  isValidFeatureKey,
  validateFeatureKeys,
};
