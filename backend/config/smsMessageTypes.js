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
 *   • services/emailScheduler                    — decides SMS-or-email per job
 *   • controllers/rsvpController                 — the immediate (non-scheduled) types
 *   • the events.sms_settings default in migration 20260818000000
 *   • the organizer's settings UI, which renders this list directly
 *
 * ── The two fields that carry the compliance weight ──
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
 * moment. True for short, complete notifications where two channels would be
 * noise and double cost. False where the email carries something SMS structurally
 * cannot — an entry pass with a scannable QR image, or a formatted report — so the
 * text is a companion pointing at it, not a substitute for it.
 *
 * ── Adding a type ──
 *   1. Add an entry here.
 *   2. Add its templates (en + ar) to utils/smsTemplates.js.
 *   3. Call sendTransactionalSms with the key at the trigger point.
 *   4. Add the key to the events.sms_settings default in a migration.
 * The settings UI and the allowance estimator pick it up automatically.
 */

const SMS_MESSAGE_TYPES = [
  {
    key: 'rsvp_confirmation',
    label: 'RSVP confirmation',
    description: "Confirms a guest's response the moment they submit it.",
    audience: 'guest',
    trigger: 'immediate',
    defaultEnabled: true,
    // The confirmation email carries the entry pass and the full event detail.
    // The text is a short receipt, not a replacement for it.
    replacesEmail: false,
    // Roughly how many of these one party generates over an event's life. Used
    // only by the allowance estimator; see utils/smsEstimator.js.
    perPartyEstimate: 1,
  },
  {
    key: 'rsvp_reminder',
    label: 'RSVP reminder',
    description: 'Nudges guests who have not responded as the deadline nears.',
    audience: 'guest',
    trigger: 'scheduled',
    defaultEnabled: true,
    replacesEmail: true,
    // Only pending parties get one, and most events do not remind everyone.
    perPartyEstimate: 0.6,
  },
  {
    key: 'event_reminder',
    label: 'Event reminder',
    description: 'Reminds confirmed guests shortly before the event, with their table.',
    audience: 'guest',
    trigger: 'scheduled',
    defaultEnabled: true,
    replacesEmail: true,
    perPartyEstimate: 0.7,
  },
  {
    key: 'qr_ticket',
    label: 'Entry pass link',
    description: 'Sends attending guests a link to their scannable entry pass.',
    audience: 'guest',
    trigger: 'immediate',
    defaultEnabled: true,
    // An SMS cannot carry the QR image itself, only a link to it. The email that
    // holds the actual pass must still go out.
    replacesEmail: false,
    perPartyEstimate: 0.7,
  },
  {
    key: 'decline_ack',
    label: 'Decline acknowledgement',
    description: 'Thanks a guest who declined.',
    audience: 'guest',
    trigger: 'immediate',
    // OFF by default. Of the seven, this is the one whose text form reliably
    // reads as unwanted: the guest has just said they are not coming, and a
    // charged message telling them "thanks" is rarely what an organizer wants to
    // spend an allowance on. Opt in, do not opt out.
    defaultEnabled: false,
    replacesEmail: true,
    perPartyEstimate: 0.2,
  },
  {
    key: 'organizer_report',
    label: 'Organizer alerts & reports',
    description: 'Final headcount and event-day summaries, texted to the organizer.',
    audience: 'organizer',
    trigger: 'scheduled',
    defaultEnabled: true,
    // The report email contains the actual numbers; the text is the heads-up.
    replacesEmail: false,
    // Per EVENT, not per party — excluded from the per-party arithmetic and added
    // as a small flat allowance instead.
    perPartyEstimate: 0,
    perEventEstimate: 3,
  },
  {
    key: 'campaign',
    label: 'Custom campaigns',
    description: 'Messages the organizer writes and sends to a chosen audience.',
    audience: 'guest',
    trigger: 'manual',
    defaultEnabled: true,
    // Has no email counterpart at all — there is nothing to fall back to.
    replacesEmail: false,
    // Two sends to the average party is a realistic working budget; the organizer
    // can size the allowance up or down freely at checkout.
    perPartyEstimate: 2,
  },
];

/* ── Derived lookups (computed once at require-time) ── */

const _byKey = new Map(SMS_MESSAGE_TYPES.map((t) => [t.key, t]));

const SMS_TYPE_KEYS = SMS_MESSAGE_TYPES.map((t) => t.key);

/** The shape stored in events.sms_settings for a brand-new event. */
const DEFAULT_SMS_SETTINGS = Object.freeze(
  Object.fromEntries(SMS_MESSAGE_TYPES.map((t) => [t.key, t.defaultEnabled])),
);

function getSmsType(key) {
  return _byKey.get(key) || null;
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
 * or smuggle non-boolean values into the jsonb column.
 */
function sanitizeSmsSettings(raw) {
  const out = { ...DEFAULT_SMS_SETTINGS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const key of SMS_TYPE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) out[key] = !!raw[key];
  }
  return out;
}

module.exports = {
  SMS_MESSAGE_TYPES,
  SMS_TYPE_KEYS,
  DEFAULT_SMS_SETTINGS,
  getSmsType,
  isTypeEnabled,
  sanitizeSmsSettings,
};
