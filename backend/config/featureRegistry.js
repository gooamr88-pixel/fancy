/**
 * Central Feature Registry — the single source of truth for every gateable
 * platform capability.
 *
 * Each feature has a machine-readable key (used in middleware + DB), a human
 * label (shown in admin UI and on the pricing page), a description (admin
 * tooltip), a category (for UI grouping), and a freeDefault flag indicating
 * whether the feature is available on unpaid / free-tier events.
 *
 * `builtIn: false` marks a feature that exists only as a pricing-page bullet —
 * no route mounts `requireFeature()` for it yet, so toggling it per-tier has
 * no real effect on access. Ship the capability + mount the gate, then flip
 * this to true (or remove the flag; it defaults to true).
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
  // The dedicated Android door app, distinct from qr_checkin (which is the
  // browser kiosk at /checkin and needs a live connection). This one gates the
  // APK download; assign it to whichever tiers should get it in
  // Admin -> Config -> Subscription Tiers. Nothing is assigned by default.
  { key: 'checkin_app',          label: 'Fancy Check-in app (offline door scanner)', description: 'Dedicated Android app for the door: scans tickets and checks guests in with no internet at the venue.', category: 'Check-in', freeDefault: false },

  // ── Campaigns & SMS ──
  /**
   * TEXT MESSAGING — a REAL tier gate again, and a metered one.
   *
   * ── The history, because it explains the two-part rule ──
   *
   * This started as an ordinary tier feature, then became decorative
   * (`builtIn: false`, `supersededBy: 'sms_addon'`) when SMS moved to a per-event
   * add-on bought at checkout: any plan could buy it, so gating it by tier was
   * wrong. The key stayed only so existing tiers would not show an unknown-key
   * warning, and its own comment said to delete it.
   *
   * It is now switched on from Admin -> Config -> Subscription Tiers, and it means
   * something again. The two questions are DIFFERENT, and both are asked:
   *
   *   1. May this plan use texting at all?   ← this feature, set per tier
   *   2. Has this event paid for messages?   ← events.sms_addon_purchased_at
   *
   * A plan without the feature never sees the surface; a plan with it sees the
   * surface and buys an allowance. Neither answer implies the other, which is
   * exactly why the old single-question design could not express "available on
   * Professional and above, still charged per message".
   *
   * ── meteredNote ──
   *
   * Every other feature in this registry is included in the price of the plan.
   * This one is not: switching it on grants ACCESS to buy, not messages. The note
   * rides with the feature so every surface that lists plan contents — the public
   * pricing page, the payment step's tier cards, the admin toggle — says so in
   * the same words, instead of three places inventing their own caveat or, worse,
   * listing it as though it were included.
   *
   * Grandfathering lives in middleware/smsAddonGate.js: an event that already
   * bought credits keeps sending even if its tier later loses this feature. You
   * do not take away something somebody paid for.
   */
  {
    key: 'sms_campaigns',
    label: 'Text messaging',
    description: 'Lets this plan send invitations, reminders and entry passes by SMS. Access only — messages are bought separately per event.',
    category: 'Campaigns & SMS',
    freeDefault: false,
    meteredNote: 'Charged separately per message',
  },

  // ── Branding ──
  { key: 'custom_branding',      label: 'Custom themes & branding',     description: 'Apply custom colors, logos, and themes to your RSVP pages.',                         category: 'Branding',          freeDefault: false, builtIn: false },
  { key: 'remove_watermark',     label: 'Remove Fancy watermark',       description: 'Remove the "Powered by Fancy RSVP" branding from guest-facing pages.',               category: 'Branding',          freeDefault: false },
  { key: 'white_label',          label: 'White-label solution',         description: 'Full white-label: custom domain, branding, and zero Fancy references.',              category: 'Branding',          freeDefault: false, builtIn: false },

  // ── Analytics ──
  { key: 'analytics_basic',      label: 'Basic analytics dashboard',    description: 'View RSVP counts, response rates, and basic event metrics.',                        category: 'Analytics',         freeDefault: true },
  { key: 'analytics_advanced',   label: 'Real-time analytics & reports',description: 'Advanced charts, real-time tracking, guest demographics, and PDF reports.',          category: 'Analytics',         freeDefault: false, builtIn: false },

  // ── Notifications ──
  { key: 'email_notifications',  label: 'Email notifications',          description: 'Automatic email confirmations and reminders for guests.',                            category: 'Notifications',    freeDefault: true },

  // ── Support ──
  { key: 'support_community',    label: 'Community support',            description: 'Access to community forums and knowledge-base articles.',                            category: 'Support',           freeDefault: true },
  { key: 'support_priority',     label: 'Priority email & chat support',description: 'Faster response times via dedicated email and live chat channels.',                  category: 'Support',           freeDefault: false, builtIn: false },
  { key: 'support_dedicated',    label: 'Dedicated account manager',    description: 'A named account manager for onboarding, strategy, and escalations.',                 category: 'Support',           freeDefault: false, builtIn: false },

  // ── Integrations ──
  { key: 'all_integrations',     label: 'All integrations',             description: 'Access every available third-party integration.',                                    category: 'Integrations',      freeDefault: false, builtIn: false },
  { key: 'custom_api',           label: 'Custom integrations & API',    description: 'Build custom integrations using the Fancy RSVP developer API.',                      category: 'Integrations',      freeDefault: false, builtIn: false },

  // ── Security ──
  { key: 'sso_team_mgmt',        label: 'SSO & team management',        description: 'Single Sign-On (SAML/OIDC) and multi-user team roles.',                              category: 'Security',          freeDefault: false, builtIn: false },
  { key: 'advanced_security',    label: 'Advanced security & compliance',description: 'Audit logs, IP allowlisting, data-residency controls, and SOC 2 readiness.',       category: 'Security',          freeDefault: false, builtIn: false },
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

/**
 * key -> the "this costs extra" caption, for every feature that is access-only.
 *
 * One map, handed to every surface that prints plan contents, so the caveat is
 * worded identically on the public pricing page, the payment step's tier cards
 * and the admin toggle. Without it each of those three invents its own — and the
 * one that forgets lists a metered add-on as though the plan included it.
 */
const FEATURE_NOTES = Object.fromEntries(
  PLATFORM_FEATURES.filter((f) => f.meteredNote).map((f) => [f.key, f.meteredNote]),
);

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
  FEATURE_NOTES,
  getFeaturesByCategory,
  getFeatureByKey,
  isValidFeatureKey,
  validateFeatureKeys,
};
