/**
 * Message-balance state, described the way a customer would describe it.
 *
 * The organizer using this product is planning a wedding, not operating a
 * messaging platform. They do not know what a segment is, they did not choose to
 * think about encodings, and "allowance" is a word from an insurance policy.
 *
 * So every value this module produces is already in the customer's terms:
 * messages left, a percentage, whether that is enough for the guests they
 * actually have, and when a message last went out. The controllers below it deal
 * in segments and ledgers; nothing above it needs to.
 *
 * Keeping this translation in ONE place is the point. The same numbers appear on
 * the event's SMS page, in the low-balance email, on the dashboard banner and in
 * the top-up modal — and if they are computed separately they will eventually
 * disagree, which reads to a customer as the platform not knowing its own state.
 */

const { normalizeSmsPricing, messagesPerPartyFor } = require('../config/smsPricing');
const { isRetiredSmsType } = require('../config/smsMessageTypes');

/**
 * Turn a wallet row into everything the UI and the alerts need.
 *
 * A missing wallet is not an error — it is an event that has not bought messages
 * yet — so it produces a complete zeroed summary rather than null. Callers should
 * not have to branch on "does a wallet exist" before they can render a number.
 *
 * @param {object|null} wallet         sms_credit_wallets row
 * @param {object|null} pricingConfig  super_admin_config.sms_pricing_config
 */
function summarizeBalance(wallet, pricingConfig = null) {
  const { alerts } = normalizeSmsPricing(pricingConfig);

  const purchased = Math.max(0, Number(wallet?.credits_purchased) || 0);
  const used = Math.max(0, Number(wallet?.credits_used) || 0);
  // Prefer the stored remaining (a generated column in some deployments) but never
  // trust it to be present or non-negative.
  const remainingRaw = wallet?.credits_remaining;
  const remaining = Math.max(0, Number.isFinite(Number(remainingRaw))
    ? Number(remainingRaw)
    : purchased - used);

  // An event that has bought nothing is at 0% used, not 100%. Dividing by zero
  // here would put a full red bar in front of someone who has done nothing wrong.
  const percentRemaining = purchased > 0
    ? Math.max(0, Math.min(100, Math.round((remaining / purchased) * 100)))
    : 0;
  const percentUsed = purchased > 0 ? 100 - percentRemaining : 0;

  const isEmpty = purchased > 0 && remaining <= 0;
  const isLow = !isEmpty && purchased > 0 && percentRemaining <= alerts.low_balance_pct;

  return {
    purchased,
    used,
    remaining,
    percentRemaining,
    percentUsed,
    isEmpty,
    isLow,
    lowThresholdPct: alerts.low_balance_pct,
    hasWallet: !!wallet,
    lastUsedAt: wallet?.last_used_at || null,
    lastUsedLabel: relativeTime(wallet?.last_used_at),
  };
}

/**
 * "2 hours ago" — the form the requirement asks for, and the only form that is
 * instantly readable. A timestamp makes the reader do arithmetic to answer the
 * question they actually have, which is "is this thing still working?".
 *
 * Deliberately coarse. "1 hour ago" and "63 minutes ago" carry the same meaning
 * to the person reading it, and the second one implies a precision that the
 * underlying stamp does not have.
 */
function relativeTime(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const seconds = Math.floor((Date.now() - then) / 1000);
  // Clock skew between the app server and the database can make a just-written
  // stamp look like the future; "just now" is the honest reading.
  if (seconds < 60) return 'just now';

  const units = [
    { limit: 3600, div: 60, one: 'a minute ago', many: (n) => `${n} minutes ago` },
    { limit: 86400, div: 3600, one: 'an hour ago', many: (n) => `${n} hours ago` },
    { limit: 604800, div: 86400, one: 'yesterday', many: (n) => `${n} days ago` },
    { limit: 2592000, div: 604800, one: 'last week', many: (n) => `${n} weeks ago` },
    { limit: Infinity, div: 2592000, one: 'last month', many: (n) => `${n} months ago` },
  ];
  for (const u of units) {
    if (seconds < u.limit) {
      const n = Math.floor(seconds / u.div);
      return n <= 1 ? u.one : u.many(n);
    }
  }
  return null;
}

/**
 * Is this balance enough for the guest list as it stands?
 *
 * Answers the question behind requirements 9 and 10 — "you have 240 guests but
 * only enough messages for about 90" — in one place, so the purchase screen, the
 * guests tab and the SMS page all draw the same conclusion from the same numbers.
 *
 * `enough` is advisory. Nothing in the system blocks a purchase or a send because
 * of it: an organizer may know perfectly well that only forty of their guests use
 * SMS. Being warned is useful; being overruled is not.
 *
 * @param {number} remaining      messages left
 * @param {number} guestCount     guests on the list (heads, not invitations)
 * @param {object|null} pricingConfig
 */
function coverageForGuests(remaining, guestCount, pricingConfig = null) {
  const cfg = normalizeSmsPricing(pricingConfig);
  const { estimator } = cfg;

  const guests = Math.max(0, Number(guestCount) || 0);
  const left = Math.max(0, Number(remaining) || 0);

  // Texts reach one primary contact per invitation, so a 240-guest list is
  // nowhere near 240 recipients. Reporting coverage per head would tell an
  // organizer they are short when they are fine.
  const invitations = guests > 0 ? Math.ceil(guests / estimator.guests_per_party) : 0;

  // What one invitation consumes over the event's whole life, taken from the SAME
  // guest-count ladder the purchase recommendation is built from.
  //
  // This used to sum the per-type frequency table instead. That was already a
  // second definition of the same idea, and the ladder made it a divergent one:
  // the purchase screen would recommend against a falling per-invitation budget
  // while this banner judged the same balance against a flat one. An organizer
  // looking at both would be told two different things about one wallet.
  //
  // Coverage is also the one place the REAL guest count is known rather than a
  // plan's cap — which is exactly what the ladder keys on, so this is the more
  // accurate of the two callers, not merely the consistent one.
  const perInvitation = messagesPerPartyFor(guests, cfg) * estimator.segments_per_message_latin;

  const coversInvitations = perInvitation > 0 ? Math.floor(left / perInvitation) : 0;
  const enough = invitations === 0 || coversInvitations >= invitations;

  return {
    guests,
    invitations,
    coversInvitations,
    enough,
    // What to buy to be comfortable again. Zero when they already are.
    shortfall: enough ? 0 : Math.max(0, Math.ceil((invitations - coversInvitations) * perInvitation)),
  };
}

/**
 * The reason a message did not arrive, in words a guest's host would use.
 *
 * This is the support tool. When someone says "my aunt never got the text", the
 * answer has to be readable in one second by whoever picks up the ticket — not a
 * constant that needs looking up, and not a phrase that blames the guest.
 *
 * Unknown codes fall through to a plain sentence rather than leaking the raw
 * value: a customer reading "NO_SMS_CONSENT" learns nothing and trusts us less.
 */
const SKIP_EXPLANATIONS = {
  NO_CONSENT: "They haven't agreed to receive texts",
  NO_SMS_CONSENT: "They haven't agreed to receive texts",
  OPTED_OUT: 'They replied STOP to a previous message',
  NO_PHONE: 'No phone number on file',
  NO_ALLOWANCE: 'You ran out of messages',
  INSUFFICIENT_CREDITS: 'You ran out of messages',
  TYPE_DISABLED: 'This kind of message is switched off',
  ADDON_INACTIVE: 'Text messaging is not switched on for this event',
  SMS_TRANSPORT_DISABLED: 'Texting was temporarily unavailable',
  CONSENT_CHECK_FAILED: 'We could not confirm their permission in time',
  DUPLICATE: 'Already sent — not sent twice',
  INVALID_PHONE: 'That phone number is not valid',
  NO_BODY: 'The message was empty',
  SEND_FAILED: 'The phone company could not deliver it',
};

/**
 * Carrier refusals, in our own words.
 *
 * These arrive as raw thrown messages (`VONAGE_15: Illegal Sender Address`), which
 * the generic fallback below used to flatten into "It could not be delivered" — a
 * sentence that sent us to the carrier's dashboard to learn something we had
 * already stored. Each of these means something specific and actionable, and the
 * difference between them is the difference between a five-minute fix and a day.
 */
const CARRIER_EXPLANATIONS = [
  [/VONAGE_FROM_MISSING/i, 'No sender number is configured for texting — set it in the server settings'],
  [/VONAGE_15\b|Illegal Sender Address/i, 'The carrier rejected our sender number. It may not be registered for texting yet, or the account is still in trial mode'],
  [/VONAGE_9\b|blacklist/i, 'This number is blocked by the phone network because they replied STOP'],
  [/VONAGE_(4|HTTP_401)\b/i, 'The texting account credentials were rejected — check the API key and secret'],
  [/VONAGE_6\b/i, 'The phone network would not accept that number'],
  [/VONAGE_(5|HTTP_5\d\d)\b/i, 'The texting service had a temporary fault — try again shortly'],
  [/VONAGE_11\b/i, 'Texting is not enabled on this account for that destination'],
  [/VONAGE_29\b/i, 'That destination country is not enabled on the texting account'],
  [/\b21610\b|unsubscribed recipient/i, 'This number is blocked by the phone network because they replied STOP'],
  [/\b21408\b|\b21606\b/i, 'The carrier will not send to that destination from this number'],
];

function explainSkip(reason) {
  if (!reason) return null;
  if (SKIP_EXPLANATIONS[reason]) return SKIP_EXPLANATIONS[reason];

  const text = String(reason);
  for (const [pattern, sentence] of CARRIER_EXPLANATIONS) {
    if (pattern.test(text)) return sentence;
  }
  return 'It could not be delivered';
}

/**
 * Whether a failed message is worth offering a Resend button for.
 *
 * Only failures the organizer can actually do something about. Offering Resend on
 * a guest who replied STOP invites them to try again at something the law forbids,
 * and offering it on a guest with no consent implies the button might override
 * that — it never will. Those rows explain themselves and stop there.
 */
const RESENDABLE = new Set(['NO_ALLOWANCE', 'INSUFFICIENT_CREDITS', 'SMS_TRANSPORT_DISABLED', 'SEND_FAILED', 'CONSENT_CHECK_FAILED']);

function isResendable(row) {
  if (!row) return false;
  if (row.status === 'sent') return false;

  // A message of a type this platform no longer sends can never be resent, and
  // offering the button is worse than useless: resendSmsMessage DELETES the
  // sms_log row before re-dispatching — correct, because the (kind, ref) unique
  // index would otherwise make the retry a silent no-op — and the re-dispatch
  // then fails on UNKNOWN_TYPE. The organizer would get an error and we would
  // have destroyed a compliance record to produce it.
  if (isRetiredSmsType(row.kind)) return false;

  return RESENDABLE.has(row.skip_reason) || (row.status === 'failed' && !row.skip_reason);
}

module.exports = {
  summarizeBalance,
  relativeTime,
  coverageForGuests,
  explainSkip,
  isResendable,
};
