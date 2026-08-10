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
 * ── The economics these defaults encode ──
 *
 * One segment costs us about 1.1 cents all-in: Vonage US outbound is $0.00809,
 * and US carriers add roughly $0.002-0.003 of pass-through fees on top. That
 * figure lives in `super_admin_config.sms_rate_cents_per_credit`, not here.
 *
 * List price is 3.0 cents a segment — a markup of 172.73%, or about 63% gross
 * margin on revenue. Two mechanisms then push the effective price DOWN as an
 * event grows, and they compound:
 *
 *   1. `guest_bands` — messages budgeted per invitation falls from 3 to 1.5 as
 *      the guest list grows. The third text is worth less at 3,000 guests than
 *      at 200, but costs exactly the same.
 *   2. `volume_discounts` — the price of each segment falls with order size.
 *
 * Together they take the per-guest cost of an English event from about $0.060 at
 * 200 guests to about $0.032 at 3,000 — a 47% drop — while the gross margin never
 * falls below roughly 51%.
 */

/** The shipped model. Also the fallback for any field an admin leaves unset. */
const DEFAULT_SMS_PRICING = Object.freeze({
  // Tiered, NOT cumulative: the single best-matching tier applies. Cumulative
  // stacking is the classic way a discount table quietly reaches 100% off.
  volume_discounts: [
    { min_segments: 10000, discount_pct: 30 },
    { min_segments: 5000, discount_pct: 25 },
    { min_segments: 2000, discount_pct: 18 },
    { min_segments: 500, discount_pct: 10 },
  ],
  bounds: { min: 50, max: 50000, step: 50 },
  estimator: {
    // Invitations go to households and couples, and SMS reaches one primary
    // contact per party — so a 200-guest cap is nowhere near 200 recipients.
    guests_per_party: 2.2,
    /**
     * MEASURED, not assumed. These were 1.4 and 2.6, and both were wrong — which
     * meant the platform under-quoted every allowance it ever sold by about 40%,
     * and organizers ran out of messages partway through their own event.
     *
     * The arithmetic is unforgiving and worth writing down. A GSM-7 segment holds
     * 160 characters. The mandatory compliance footer is 78 of them. A short link
     * is 32. That leaves about 50 characters for a guest's name, the event title
     * and the words joining them — and "Alexandra Whitmore, you're invited to The
     * Whitmore-Hassan Wedding." is 66 on its own.
     *
     * So two segments is the floor for a personalised English message carrying a
     * link, not the ceiling. Measured across a realistic spread of names and event
     * titles, ZERO of them fit in one segment. Pretending otherwise does not make
     * messages cheaper; it makes the number we quote wrong.
     */
    segments_per_message_latin: 2.0,
    /**
     * Arabic forces UCS-2, where a segment holds only 70 characters and the
     * (English, unavoidable) compliance footer alone consumes more than one.
     *
     * 3.0 assumes short links are in use. With the raw 89-character RSVP URL it
     * measures 4.0 — which is the whole reason short links exist: they are a
     * permanent 25% cut on every Arabic event.
     */
    segments_per_message_arabic: 3.0,
    unlimited_tier_assumed_guests: 500,
  },

  /**
   * THE ALLOWANCE LADDER — messages budgeted per INVITATION, by guest count.
   *
   * The model this replaced multiplied a flat per-type frequency by party count,
   * so a 3,000-guest event was quoted almost exactly ten times a 300-guest one.
   * That is arithmetically consistent and commercially useless: large events are
   * where texting has to feel affordable, and it made them look ruinous.
   *
   * Ascending by threshold. The LAST entry must have `max_guests: null` — the
   * open band — or an event above every threshold prices at zero messages.
   * normalizeSmsPricing enforces that rather than trusting it.
   */
  guest_bands: [
    { max_guests: 300, messages_per_party: 3 },
    { max_guests: 1000, messages_per_party: 2.5 },
    { max_guests: 3000, messages_per_party: 2 },
    { max_guests: null, messages_per_party: 1.5 },
  ],

  /**
   * How a band's budget is split between the GUEST message types.
   *
   * RELATIVE shares, not absolutes — only the ratios matter, and scaling all
   * three by the same factor changes nothing. Kept separate from
   * `type_frequencies` below because the two mean genuinely different things, and
   * one key meaning both is how a wrong invoice gets written two years from now.
   */
  type_weights: {
    invitation: 1.0,
    // The heaviest: fires when the guest is seated, and again just before the day.
    seating_reminder: 1.2,
    // Most events never change. Small, but never zero — the one time it is needed
    // is the worst possible moment to discover the allowance did not cover it.
    event_update: 0.3,
  },

  /**
   * ABSOLUTE messages per EVENT, for ORGANIZER-audience types only.
   *
   * An organizer gets the same handful of reports whether they invite 20 people
   * or 2,000, so this must never be multiplied by party count.
   */
  type_frequencies: {
    organizer_report: 3,
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
  /**
   * 50, not 90.
   *
   * At 1.1c cost and a 3.0c list price, the break-even discount is 63.3%. The old
   * cap of 90% meant a mistyped `85` would clamp to 85, save without complaint,
   * and lose money on every large order — the exact orders the tier exists to
   * win. 50% leaves real room to discount (down to 1.5c a segment, still a 27%
   * margin) while making a below-cost tier unreachable by typo.
   *
   * An admin who genuinely wants to sell at a loss has to change this constant,
   * which is a code review rather than a keystroke.
   */
  discountPct: { min: 0, max: 50 },
  minSegments: { min: 1, max: 1000000 },
  bound: { min: 1, max: 1000000 },
  step: { min: 1, max: 10000 },
  guestsPerParty: { min: 1, max: 20 },     // < 1 would invent recipients
  segmentsPerMsg: { min: 1, max: 10 },     // a segment is the indivisible unit
  assumedGuests: { min: 1, max: 1000000 },
  frequency: { min: 0, max: 100 },
  bandGuests: { min: 1, max: 10000000 },
  messagesPerParty: { min: 0, max: 20 },
  typeWeight: { min: 0, max: 100 },
  deliveredMin: { min: 0, max: 10000000 },
  maxPerSend: { min: 0, max: 1000000 },    // 0 = unlimited
  lowBalancePct: { min: 1, max: 90 },      // 0 would never warn; 100 always would
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

  /* ── The allowance ladder ──
   * Ascending, deduplicated on threshold, and guaranteed to END in an open band.
   * A table whose every entry has a finite max_guests would price an event above
   * the top threshold at zero messages — a free "purchase" that unlocks the
   * add-on and then cannot send anything. Rather than reject the save (which
   * would leave the admin unable to fix a bad row through the UI), the last entry
   * is coerced open, which is what every sane version of the table means anyway. */
  const rawBands = Array.isArray(src.guest_bands) && src.guest_bands.length
    ? src.guest_bands
    : D.guest_bands;
  const seenBandKeys = new Set();
  const guest_bands = rawBands
    .filter((b) => b && typeof b === 'object')
    .map((b) => ({
      // null / undefined / '' all mean "the open band". Number('') is 0, so this
      // has to be tested before coercion or an empty field becomes a band that
      // matches nothing.
      max_guests: (b.max_guests === null || b.max_guests === undefined || b.max_guests === '')
        ? null
        : Math.round(clamp(num(b.max_guests, 0), LIMITS.bandGuests)),
      messages_per_party: round2(clamp(num(b.messages_per_party, 0), LIMITS.messagesPerParty)),
    }))
    .filter((b) => {
      const key = b.max_guests === null ? 'open' : b.max_guests;
      if (seenBandKeys.has(key)) return false;
      seenBandKeys.add(key);
      return true;
    })
    // Ascending, with the open band last — so band selection is "the first one
    // you fit inside", mirroring how volume discounts resolve in the other
    // direction.
    .sort((a, b) => {
      if (a.max_guests === null) return 1;
      if (b.max_guests === null) return -1;
      return a.max_guests - b.max_guests;
    });

  if (guest_bands.length === 0) {
    guest_bands.push(...D.guest_bands.map((b) => ({ ...b })));
  } else if (guest_bands[guest_bands.length - 1].max_guests !== null) {
    guest_bands[guest_bands.length - 1] = {
      ...guest_bands[guest_bands.length - 1],
      max_guests: null,
    };
  }

  /* ── Per-type weights and frequencies ──
   * Both keyed off the DEFAULTS, not off the submitted object: that way an admin
   * payload can never introduce an unknown message type or resurrect a retired
   * one, and a type added in a later release automatically appears with its
   * shipped value instead of silently costing zero. */
  const w = src.type_weights || {};
  const type_weights = {};
  for (const [key, fallback] of Object.entries(D.type_weights)) {
    type_weights[key] = round2(clamp(num(w[key], fallback), LIMITS.typeWeight));
  }

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
  const rawBandsRamp = Array.isArray(src.limits?.ramp_up) ? src.limits.ramp_up : D.limits.ramp_up;
  const seenBands = new Set();
  const ramp_up = rawBandsRamp
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
    guest_bands,
    type_weights,
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
 * The band an event of `guestCount` guests falls into.
 *
 * Bands are pre-sorted ascending with the open band last, so the first band whose
 * ceiling the event fits under is the right one. Accepts either a normalized
 * model's `guest_bands` array or nothing at all.
 */
function bandForGuests(guestCount, guestBands) {
  const bands = (Array.isArray(guestBands) && guestBands.length)
    ? guestBands
    : DEFAULT_SMS_PRICING.guest_bands;
  const guests = Math.max(0, Number(guestCount) || 0);
  for (const band of bands) {
    if (band.max_guests === null || guests <= band.max_guests) return band;
  }
  // Only reachable if the table has no open band and normalization was skipped.
  return bands[bands.length - 1];
}

/**
 * Messages budgeted per INVITATION for an event of this size.
 *
 * The single number the estimator and the coverage check both build on. They must
 * agree: if the purchase screen quotes one model and the "your balance covers 90
 * of your 240 guests" banner quotes another, one of them is lying to a customer
 * who is looking at both.
 */
function messagesPerPartyFor(guestCount, pricingConfigOrNormalized) {
  /**
   * ALWAYS normalize. The previous version skipped it when the argument merely
   * *had* a `guest_bands` key — which is true of a raw jsonb column straight out
   * of the database, where the bands may be unsorted, may duplicate a threshold,
   * or may have no open band at all.
   *
   * bandForGuests relies on ascending order with the open band last, so an
   * unsorted raw config would silently return the wrong band and misprice the
   * event. Normalizing twice costs a few object allocations; getting the band
   * wrong costs the customer money.
   */
  const cfg = normalizeSmsPricing(pricingConfigOrNormalized);
  return bandForGuests(guestCount, cfg.guest_bands).messages_per_party;
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
      notes.push(`A discount of ${tier.discount_pct}% was capped at ${LIMITS.discountPct.max}% — beyond that a large order starts costing us more than it earns.`);
    }
  }

  const submittedBands = Array.isArray(src.guest_bands) ? src.guest_bands : null;
  if (submittedBands) {
    if (submittedBands.length > normalized.guest_bands.length) {
      notes.push(`${submittedBands.length - normalized.guest_bands.length} guest band(s) were dropped — two bands cannot share the same guest ceiling.`);
    }
    const last = submittedBands[submittedBands.length - 1];
    const lastIsOpen = last && (last.max_guests === null || last.max_guests === undefined || last.max_guests === '');
    if (submittedBands.length > 0 && !lastIsOpen) {
      notes.push('The largest guest band was made open-ended — without one, an event bigger than every band would be quoted zero messages.');
    }
  }

  if (Array.isArray(src.guest_bands) && src.guest_bands.some((b) => num(b?.messages_per_party, 1) === 0)) {
    notes.push('A band set to 0 messages per invitation will quote nothing for events of that size — check that is what you meant.');
  }

  return notes;
}

module.exports = {
  DEFAULT_SMS_PRICING,
  LIMITS,
  normalizeSmsPricing,
  discountPctFor,
  maxPerSendFor,
  bandForGuests,
  messagesPerPartyFor,
  describeSmsPricingAdjustments,
};
