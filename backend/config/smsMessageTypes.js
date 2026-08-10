/**
 * SMS MESSAGE TYPE REGISTRY — the single source of truth for what this platform
 * is willing to send by text, to whom, and under what conditions.
 *
 * Modelled on config/featureRegistry.js: one declarative table, derived lookups
 * computed once, and every consumer reading from here rather than repeating a
 * literal. The consumers are:
 *
 *   • services/smsDispatch.sendTransactionalSms  — gates each send on `audience`
 *     and the event's per-type switch
 *   • services/emailScheduler                    — the automatic and scheduled types
 *   • controllers/invitationController           — the manual type
 *   • the events.sms_settings default in migration 20260822000000
 *   • the organizer's Messages page, which renders this list directly
 *   • utils/smsEstimator + utils/smsUsage, via `weight`
 *
 * ── Why there are exactly four ──
 *
 * There were seven, and no organizer could hold them in their head. Seven
 * switches on a settings page is not seven times the control, it is one decision
 * nobody makes. These four are the four moments that actually exist in an event:
 * you invite people, you tell them where to sit, you tell them if something
 * changed, and you get told how it is going. Everything the old registry had
 * beyond that was a variation on one of those four, charged separately.
 *
 * ── The three fields that carry the weight ──
 *
 * `audience` decides WHOSE consent is required, and they are not interchangeable:
 *   'guest'     → rsvp_parties.sms_consent for that specific party. TCPA express
 *                 consent; no payment, plan, or organizer attestation substitutes
 *                 for it.
 *   'organizer' → organizations.sms_consent. A different relationship (they are
 *                 the customer and gave us the number), but still an opt-in, and
 *                 still suppressed globally by a STOP reply.
 *
 * `replacesEmail` decides whether a sent SMS SUPPRESSES the email for the same
 * moment. It is FALSE on all four, and that is deliberate rather than incidental
 * — see the note on the constant below.
 *
 * `weight` is this type's RELATIVE share of the per-invitation message budget,
 * which utils/smsEstimator distributes across the guest types. Only the ratios
 * matter. Organizer types carry `perEventEstimate` instead, because an organizer
 * gets the same few reports whether they invite 20 people or 2,000.
 *
 * ── Adding a type ──
 *   1. Add an entry here.
 *   2. Add its templates (en + ar) to utils/smsTemplates.js.
 *   3. Call sendTransactionalSms with the key at the trigger point.
 *   4. Add the key to the events.sms_settings default in a migration, and to
 *      sms_pricing_config.type_weights (guest) or .type_frequencies (organizer).
 * The settings UI and the allowance estimator pick it up automatically.
 */

const SMS_MESSAGE_TYPES = [
  {
    key: 'invitation',
    label: 'Invitation',
    description: 'The invitation itself, sent by name to each guest when you choose to.',
    audience: 'guest',
    // MANUAL, and only manual. Adding or importing a guest sends nothing — the
    // organizer builds their list, checks it, and then presses a button. A list
    // half-built at 1am must not have already gone out.
    trigger: 'manual',
    defaultEnabled: true,
    // The email invitation carries the full envelope reveal; the text carries a
    // link to it. Neither replaces the other.
    replacesEmail: false,
    weight: 1.0,
  },
  {
    key: 'seating_reminder',
    label: 'Table & entry pass',
    description: "Where they're sitting and the link to their check-in pass, once you've seated them — and again just before the event.",
    audience: 'guest',
    trigger: 'automatic',
    defaultEnabled: true,
    // An SMS cannot carry the QR image itself, only a link to the page holding
    // it. The email with the actual scannable pass must still go out.
    replacesEmail: false,
    // The heaviest of the three: it fires when the guest is seated AND again in
    // the day or two before the event, because a table number read weeks early is
    // not the one anybody is looking at while standing outside the venue.
    weight: 1.2,
  },
  {
    key: 'event_update',
    label: 'Change or cancellation',
    description: 'Tells guests when the date, time or venue changes — or that the event has been called off.',
    audience: 'guest',
    trigger: 'automatic',
    defaultEnabled: true,
    // Both channels, always. A guest who does not find out the event moved is the
    // worst outcome this product has, and it is exactly the situation where one
    // channel being ignored or filtered is likeliest.
    replacesEmail: false,
    // Most events never change. Budgeted small, but never zero — the one time it
    // is needed, an empty allowance is the worst possible moment to discover it.
    weight: 0.3,
  },
  {
    key: 'organizer_report',
    label: 'Your own alerts & reports',
    description: 'Final headcount and event-day summaries, texted to you.',
    audience: 'organizer',
    trigger: 'scheduled',
    defaultEnabled: true,
    // The report email contains the actual numbers; the text is the heads-up.
    replacesEmail: false,
    // Per EVENT, not per party — excluded from the per-invitation arithmetic and
    // added as a small flat allowance instead.
    weight: 0,
    perEventEstimate: 3,
  },
];

/**
 * Every type has replacesEmail: false, and that is load-bearing rather than a
 * coincidence worth collapsing into a constant.
 *
 * emailScheduler.trySms suppresses an email only when the SMS was DELIVERED and
 * the type declares replacesEmail === true. With all four false, an SMS can never
 * silence an email — so "the guest always hears from us, whatever happened to the
 * text" is a structural property of the system rather than a rule somebody has to
 * remember at each call site.
 *
 * The old registry had it true for three types, which was defensible when those
 * types were short standalone nudges. It is not defensible for any of these four:
 * each one's email carries something a text structurally cannot — an envelope
 * reveal, a scannable pass, a formatted report — or is a cancellation, where
 * belt-and-braces is the entire point.
 *
 * If a future type sets this true, the burden is on it to prove the SMS is a
 * COMPLETE substitute, not merely a cheaper one.
 */

/* ── Retired types ──────────────────────────────────────────────────────────
 * Keys the platform used to send and no longer does. They are NOT deleted from
 * history: sms_log rows carrying them are the compliance record of what was sent
 * to whom, and sms_credit_ledger consumption rows point at the same sends.
 *
 * So the log UI still has to render them, and — more importantly — the resend
 * endpoint has to REFUSE them. resendSmsMessage deletes the sms_log row before
 * re-dispatching (correct: the (kind, ref) unique index would otherwise report
 * "already sent" and do nothing). For a retired kind the re-dispatch then fails
 * on UNKNOWN_TYPE, and the audit row is already gone. Guard on the way in.
 */
const RETIRED_SMS_TYPE_LABELS = Object.freeze({
  rsvp_confirmation: 'RSVP confirmation (no longer sent)',
  rsvp_reminder: 'RSVP reminder (no longer sent)',
  event_reminder: 'Event reminder (no longer sent)',
  qr_ticket: 'Entry pass link (no longer sent)',
  decline_ack: 'Decline acknowledgement (no longer sent)',
  campaign: 'Custom message (no longer sent)',
});

/* ── Derived lookups (computed once at require-time) ── */

const _byKey = new Map(SMS_MESSAGE_TYPES.map((t) => [t.key, t]));

const SMS_TYPE_KEYS = SMS_MESSAGE_TYPES.map((t) => t.key);

/** Guest-audience keys, in registry order. The ones the allowance ladder splits between. */
const GUEST_SMS_TYPE_KEYS = SMS_MESSAGE_TYPES
  .filter((t) => t.audience === 'guest')
  .map((t) => t.key);

/** The shape stored in events.sms_settings for a brand-new event. */
const DEFAULT_SMS_SETTINGS = Object.freeze(
  Object.fromEntries(SMS_MESSAGE_TYPES.map((t) => [t.key, t.defaultEnabled])),
);

function getSmsType(key) {
  return _byKey.get(key) || null;
}

/** True for a key this platform used to send and no longer does. */
function isRetiredSmsType(key) {
  return !_byKey.has(key) && Object.prototype.hasOwnProperty.call(RETIRED_SMS_TYPE_LABELS, key);
}

/**
 * A human label for any `sms_log.kind` ever written, live or retired.
 *
 * Falls through to a generic word rather than showing the raw key: a log row
 * reading "campaign" means nothing to an organizer, and one reading `undefined`
 * means less.
 */
function labelForKind(kind) {
  const type = _byKey.get(kind);
  if (type) return type.label;
  return RETIRED_SMS_TYPE_LABELS[kind] || 'Message';
}

/**
 * Is `key` switched on for this event?
 *
 * Defaults to the registry's own default when the settings object is missing the
 * key entirely — which is the state of every event created before a new type was
 * introduced. Treating "absent" as "off" would silently disable a type for the
 * entire existing customer base the moment it shipped.
 */
function isTypeEnabled(smsSettings, key) {
  const type = _byKey.get(key);
  if (!type) return false;
  if (!smsSettings || typeof smsSettings !== 'object') return type.defaultEnabled;
  const value = smsSettings[key];
  return value === undefined || value === null ? type.defaultEnabled : !!value;
}

/**
 * Coerce a client-supplied settings object into something safe to persist:
 * known keys only, booleans only. An organizer's PATCH cannot introduce new keys
 * or smuggle non-boolean values into the jsonb column — and cannot resurrect a
 * retired key, since those are not in SMS_TYPE_KEYS.
 */
function sanitizeSmsSettings(raw) {
  const out = { ...DEFAULT_SMS_SETTINGS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const key of SMS_TYPE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) out[key] = !!raw[key];
  }
  return out;
}

/**
 * Map a pre-rebuild seven-key settings object onto the four current keys.
 *
 * The same mapping migration 20260822000000 applies in SQL, kept here as a pure
 * function so it is testable and so any code path still holding an old object —
 * a cached row, a fixture, a replayed webhook — resolves it identically.
 *
 * The three merged sources are OR'd, not AND'd. All three defaulted ON, so an
 * AND would mean an organizer who switched off exactly one of them silently lost
 * ALL automated guest texting. The safe direction to be wrong in is a message
 * they can turn off in one click, not a silence they would never go looking for.
 */
function migrateLegacySmsSettings(raw) {
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const on = (key, fallback = true) => (
    src[key] === undefined || src[key] === null ? fallback : !!src[key]
  );
  // Already migrated: leave it alone rather than re-deriving from keys that are
  // no longer there and would all fall back to their defaults.
  if (SMS_TYPE_KEYS.some((k) => Object.prototype.hasOwnProperty.call(src, k))) {
    return sanitizeSmsSettings(src);
  }
  return {
    invitation: on('campaign'),
    seating_reminder: on('rsvp_confirmation') || on('event_reminder') || on('qr_ticket'),
    event_update: true,
    organizer_report: on('organizer_report'),
  };
}

module.exports = {
  SMS_MESSAGE_TYPES,
  SMS_TYPE_KEYS,
  GUEST_SMS_TYPE_KEYS,
  DEFAULT_SMS_SETTINGS,
  RETIRED_SMS_TYPE_LABELS,
  getSmsType,
  isRetiredSmsType,
  labelForKind,
  isTypeEnabled,
  sanitizeSmsSettings,
  migrateLegacySmsSettings,
};
