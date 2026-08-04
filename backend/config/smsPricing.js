/**
 * SMS PRICING MODEL — defaults, normalization and validation.
 *
 * Everything that decides what an organizer is quoted for text messaging, and
 * what Fancy earns on it, is editable from the super-admin dashboard and stored
 * in `super_admin_config.sms_pricing_config`. This module is the only thing that
 * interprets that column.
 *
 * ── Why normalization is not optional here ──
 *
 * The stored value is jsonb, so the database enforces nothing about its shape. A
 * config row that is partially filled (an older row, a half-completed save), or
 * carries a nonsensical value (a negative rate, a 200% discount, zero guests per
 * party), flows directly into a Stripe `unit_amount`. Getting that wrong does not
 * fail loudly — it silently charges every organizer the wrong price, or hands
 * Stripe an amount it rejects, breaking checkout for everyone at once.
 *
 * So `normalizeSmsPricing` is applied on BOTH sides:
 *   • on READ, so any historical or partial row still produces a complete, sane
 *     model rather than undefined arithmetic;
 *   • on WRITE, so what the admin saves is already clamped, and the dashboard
 *     reflects back exactly what will be charged.
 *
 * Every default reproduces the constant the code used before these values became
 * editable, so an unconfigured platform behaves exactly as it always did.
 */

/** The shipped model. Also the fallback for any field an admin leaves unset. */
const DEFAULT_SMS_PRICING = Object.freeze({
  // Tiered, NOT cumulative: the single best-matching tier applies. Cumulative
  // stacking is the classic way a discount table quietly reaches 100% off.
  volume_discounts: [{ min_segments: 500, discount_pct: 12.5 }],
  bounds: { min: 50, max: 50000, step: 50 },
  estimator: {
    // Invitations go to households and couples, and SMS reaches one primary
    // contact per party — so a 200-guest cap is nowhere near 200 recipients.
    guests_per_party: 2.2,
    // A typical body plus the mandatory 77-character compliance footer lands just
    // over one 160-character GSM-7 segment.
    segments_per_message_latin: 1.4,
    // Arabic forces UCS-2, where a segment holds only 70 characters — so the same
    // message costs two to three times as much.
    segments_per_message_arabic: 2.6,
    unlimited_tier_assumed_guests: 500,
  },
  // Messages per PARTY over the event's life, except organizer_report which is
  // per EVENT (the registry marks which is which).
  type_frequencies: {
    rsvp_confirmation: 1,
    rsvp_reminder: 0.6,
    event_reminder: 0.7,
    qr_ticket: 0.7,
    decline_ack: 0.2,
    organizer_report: 3,
    campaign: 2,
  },
  limits: {
    /**
     * Anti-abuse ramp-up: the most messages one request may send, rising with the
     * organization's lifetime delivered count (organizations.sms_delivered_total).
     *
     * Keyed on delivered volume rather than account age or payment history
     * deliberately. Age punishes the organizer whose wedding is next week and
     * merely inconveniences a patient spammer. Payment history caps every
     * first-time customer on the one event they most need it for. Delivered
     * volume is the only signal that rises through genuine use and stays flat for
     * a throwaway account — so a real organizer's limit lifts itself, and the
     * blast we actually want to stop is the very first one.
     *
     * max_per_send: 0 means unlimited. Bands are matched highest-first.
     */
    ramp_up: [
      { delivered_min: 0, max_per_send: 50 },
      { delivered_min: 200, max_per_send: 500 },
      { delivered_min: 1000, max_per_send: 0 },
    ],
  },
  alerts: {
    /**
     * Warn the organizer once when the balance falls to this percentage, while
     * there is still time to top up. The previous behaviour only alerted at zero
     * — after guests had already stopped receiving messages, which is precisely
     * too late to be useful.
     */
    low_balance_pct: 20,
  },
});

/* ── Hard limits ────────────────────────────────────────────────────────────
 * These are not preferences — they are the range outside which the platform
 * misbehaves rather than merely charges differently. The admin form can pick any
 * value inside them; anything outside is clamped rather than rejected, so a
 * fat-fingered entry degrades to the nearest sane price instead of failing a save
 * or, worse, taking checkout down.
 */
const LIMITS = {
  discountPct: { min: 0, max: 90 },        // 100% would make messages free
  minSegments: { min: 1, max: 1000000 },
  bound:       { min: 1, max: 1000000 },
  step:        { min: 1, max: 10000 },
  guestsPerParty:   { min: 1, max: 20 },   // < 1 would invent recipients
  segmentsPerMsg:   { min: 1, max: 10 },   // a segment is the indivisible unit
  assumedGuests:    { min: 1, max: 1000000 },
  frequency:        { min: 0, max: 100 },
  deliveredMin:     { min: 0, max: 10000000 },
  maxPerSend:       { min: 0, max: 1000000 }, // 0 = unlimited
  lowBalancePct:    { min: 1, max: 90 },      // 0 would never warn; 100 always would
};

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (n, { min, max }) => Math.min(Math.max(n, min), max);
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Turn whatever is stored (or submitted) into a complete, sane pricing model.
 * Never throws, never returns a partial object.
 *
 * @param {object|null} raw  the jsonb value, an admin's form payload, or null
 * @returns {typeof DEFAULT_SMS_PRICING}
 */
function normalizeSmsPricing(raw) {
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const D = DEFAULT_SMS_PRICING;

  /* ── Volume discounts ── */
  const rawTiers = Array.isArray(src.volume_discounts) ? src.volume_discounts : D.volume_discounts;
  const seenThresholds = new Set();
  const volume_discounts = rawTiers
    .filter((t) => t && typeof t === 'object')
    .map((t) => ({
      min_segments: Math.round(clamp(num(t.min_segments, 0), LIMITS.minSegments)),
      discount_pct: round2(clamp(num(t.discount_pct, 0), LIMITS.discountPct)),
    }))
    .filter((t) => {
      // A zero-discount tier is noise, and two tiers at the same threshold make
      // "which one applies" a coin flip — drop both rather than pick arbitrarily.
      if (t.discount_pct <= 0) return false;
      if (seenThresholds.has(t.min_segments)) return false;
      seenThresholds.add(t.min_segments);
      return true;
    })
    // Descending, so tier selection is "the first one you qualify for" — which
    // makes the best (highest-threshold) tier win without extra comparison logic.
    .sort((a, b) => b.min_segments - a.min_segments);

  /* ── Purchase bounds ── */
  let min = Math.round(clamp(num(src.bounds?.min, D.bounds.min), LIMITS.bound));
  let max = Math.round(clamp(num(src.bounds?.max, D.bounds.max), LIMITS.bound));
  // An inverted range would make every purchase impossible; swapping preserves
  // the admin's evident intent instead of bricking the buy flow.
  if (min > max) [min, max] = [max, min];
  const step = Math.round(clamp(num(src.bounds?.step, D.bounds.step), LIMITS.step));

  /* ── Estimator assumptions ── */
  const e = src.estimator || {};
  const estimator = {
    guests_per_party: round2(clamp(num(e.guests_per_party, D.estimator.guests_per_party), LIMITS.guestsPerParty)),
    segments_per_message_latin: round2(clamp(num(e.segments_per_message_latin, D.estimator.segments_per_message_latin), LIMITS.segmentsPerMsg)),
    segments_per_message_arabic: round2(clamp(num(e.segments_per_message_arabic, D.estimator.segments_per_message_arabic), LIMITS.segmentsPerMsg)),
    unlimited_tier_assumed_guests: Math.round(clamp(num(e.unlimited_tier_assumed_guests, D.estimator.unlimited_tier_assumed_guests), LIMITS.assumedGuests)),
  };

  /* ── Per-type frequencies ──
   * Keyed off the DEFAULTS, not off the submitted object: that way an admin
   * payload can never introduce an unknown message type, and a type added in a
   * later release automatically appears with its shipped frequency instead of
   * silently costing zero. */
  const f = src.type_frequencies || {};
  const type_frequencies = {};
  for (const [key, fallback] of Object.entries(D.type_frequencies)) {
    type_frequencies[key] = round2(clamp(num(f[key], fallback), LIMITS.frequency));
  }

  /* ── Anti-abuse ramp-up ──
   * Sorted DESCENDING by threshold so band selection is "the first one you
   * qualify for", matching how volume discounts resolve. An empty table means no
   * cap at all, which is a legitimate configuration (a private deployment with no
   * untrusted signups) — but the shipped default is not empty. */
  const rawBands = Array.isArray(src.limits?.ramp_up) ? src.limits.ramp_up : D.limits.ramp_up;
  const seenBands = new Set();
  const ramp_up = rawBands
    .filter((b) => b && typeof b === 'object')
    .map((b) => ({
      delivered_min: Math.round(clamp(num(b.delivered_min, 0), LIMITS.deliveredMin)),
      max_per_send: Math.round(clamp(num(b.max_per_send, 0), LIMITS.maxPerSend)),
    }))
    .filter((b) => {
      // Two bands at one threshold make "which cap applies" arbitrary.
      if (seenBands.has(b.delivered_min)) return false;
      seenBands.add(b.delivered_min);
      return true;
    })
    .sort((a, b) => b.delivered_min - a.delivered_min);

  const low_balance_pct = Math.round(
    clamp(num(src.alerts?.low_balance_pct, D.alerts.low_balance_pct), LIMITS.lowBalancePct),
  );

  return {
    volume_discounts,
    bounds: { min, max, step },
    estimator,
    type_frequencies,
    limits: { ramp_up },
    alerts: { low_balance_pct },
  };
}

/**
 * The most messages one request may send, given the organization's lifetime
 * delivered count. `0` means unlimited.
 *
 * Bands are pre-sorted descending, so the first qualifying band is the most
 * permissive one earned. An organization below every threshold — which cannot
 * happen with the shipped defaults, since the first band starts at 0 — falls back
 * to unlimited rather than zero: a misconfigured table must not silently block
 * all sending platform-wide.
 */
function maxPerSendFor(deliveredTotal, rampUp) {
  const bands = Array.isArray(rampUp) ? rampUp : DEFAULT_SMS_PRICING.limits.ramp_up;
  if (bands.length === 0) return 0;
  const delivered = Math.max(0, Number(deliveredTotal) || 0);
  for (const band of bands) {
    if (delivered >= band.delivered_min) return band.max_per_send;
  }
  return 0;
}

/**
 * The discount percentage that applies to an order of `segments`.
 * Tiers are pre-sorted descending, so the first match is the best one.
 */
function discountPctFor(segments, volumeDiscounts) {
  const tiers = Array.isArray(volumeDiscounts) ? volumeDiscounts : DEFAULT_SMS_PRICING.volume_discounts;
  const qty = Number(segments) || 0;
  for (const tier of tiers) {
    if (qty >= tier.min_segments) return tier.discount_pct;
  }
  return 0;
}

/**
 * Human-readable problems with a submitted model — for the admin form to show as
 * warnings. Deliberately NOT used to reject a save: normalizeSmsPricing has
 * already made the value safe, and blocking a save would leave the admin unable
 * to correct a bad row through the UI. This tells them what was adjusted and why.
 */
function describeSmsPricingAdjustments(raw, normalized) {
  const notes = [];
  const src = (raw && typeof raw === 'object') ? raw : {};

  const submittedTiers = Array.isArray(src.volume_discounts) ? src.volume_discounts.length : 0;
  if (submittedTiers > normalized.volume_discounts.length) {
    notes.push(`${submittedTiers - normalized.volume_discounts.length} discount tier(s) were dropped — a tier needs a discount above 0% and a threshold no other tier already uses.`);
  }
  if (num(src.bounds?.min, 0) > num(src.bounds?.max, 0) && src.bounds) {
    notes.push('The minimum purchase was above the maximum, so the two were swapped.');
  }
  for (const tier of (Array.isArray(src.volume_discounts) ? src.volume_discounts : [])) {
    if (num(tier?.discount_pct, 0) > LIMITS.discountPct.max) {
      notes.push(`A discount of ${tier.discount_pct}% was capped at ${LIMITS.discountPct.max}% — a full discount would make messages free.`);
    }
  }
  return notes;
}

module.exports = {
  DEFAULT_SMS_PRICING,
  LIMITS,
  normalizeSmsPricing,
  discountPctFor,
  maxPerSendFor,
  describeSmsPricingAdjustments,
};
