/* ═══════════════════════════════════════════════════════════════════════════
   THE PRICING PAGE'S DERIVATIONS — pure functions, nothing else.

   NO 'use client' IN THIS FILE, EVER.

   pricing/page.js is a Server Component: it builds the <title>, the meta
   description and the Product/FAQPage structured data from these values. When
   a Server Component imports from a 'use client' module it does not receive
   the module's values — every export is replaced by a client REFERENCE the
   bundler ships to the browser. That compiles, passes every test, renders in
   development, and then fails the production build at page-data collection.
   components/landing/faqContent.js carries the same warning for the same
   reason, in that case after the build had already broken once.

   So: pure functions here, imported by BOTH sides. The consequence that
   matters is that the structured data and the visible page are computed from
   one set of functions and cannot drift apart.

   The server fetch lives in pricingFetch.js instead — see the note there.
   ═══════════════════════════════════════════════════════════════════════════ */

import { REFUND_SUMMARY, REFUND_HOW } from '../utils/refundPolicy';

export const SITE = 'https://fancyrsvp.com';

/* ── Formatting ─────────────────────────────────────────────────────────── */

/** 3000 → "3,000". The plan cards printed "Up to 3000 guests" while the plan
 *  finder two sections down printed "3,000+", from the same number. */
export function formatCount(n) {
  return Number(n).toLocaleString('en-US');
}

/**
 * A tier's price, split into the parts the page sets in different type.
 *
 * `amount` is what goes in the display face; `note` is the sans caption under
 * it. The caption says "once, per event" rather than "/ event" because "/
 * event" is the notation a monthly subscription uses too, and the single
 * most common misreading of this page is that it bills every month.
 */
export function priceOf(tier) {
  /* Two fields, and no `isFree` / `isCustom` flags beside them. They were
     here and nothing ever branched on them — the caller that would have has
     `tier.is_custom` in hand already. A returned flag nobody reads is a second
     source of truth waiting to disagree with the first. */
  if (tier.is_custom) {
    return { amount: tier.price_label || 'Custom', note: 'Quoted for your event' };
  }
  if (!tier.price_cents) {
    return { amount: tier.price_label || 'Free', note: 'No card needed' };
  }
  const dollars = tier.price_cents / 100;
  const amount = Number.isInteger(dollars) ? `$${formatCount(dollars)}` : `$${dollars.toFixed(2)}`;
  return { amount, note: 'once, per event' };
}

/**
 * A tier's guest cap as a NUMBER and a unit, not as a sentence.
 *
 * This is the reason the comparison table used to claim that the $299 plan
 * could not hold 100 guests. `tierGuestLine()` renders "Up to 100 guests",
 * which the old page pushed into each tier's FEATURE list — and the table
 * matches features by exact string, so every tier got a tick on its own
 * capacity sentence and a dash on all five others. Six rows of the table read
 * as "this plan does not include Up to 100 guests".
 *
 * Capacity is a scalar. It gets a value per plan, never a tick.
 */
export function capacityOf(tier) {
  return tier.max_guests > 0
    ? { value: formatCount(tier.max_guests), unit: 'guests', unlimited: false }
    : { value: 'Unlimited', unit: 'guests', unlimited: true };
}

/**
 * How many events the plan may publish — the cap that was enforced in four
 * places on the payment path and printed on no public surface.
 *
 * 0 means unlimited, which is both the stored default and what most tiers
 * carry, so most plans still say "Unlimited".
 */
export function eventsOf(tier) {
  const n = Number(tier.max_events) || 0;
  return n > 0
    ? { value: formatCount(n), unit: n === 1 ? 'event' : 'events', unlimited: false }
    : { value: 'Unlimited', unit: 'events', unlimited: true };
}

export function ctaOf(tier) {
  if (tier.cta_label) return tier.cta_label;
  if (tier.is_custom) return 'Talk to us';
  if (!tier.price_cents) return 'Start free';
  return `Choose ${tier.name}`;
}

export function hrefOf(tier) {
  return tier.is_custom ? '/contact?subject=enterprise' : '/register';
}

/* ── The ladder ─────────────────────────────────────────────────────────── */

/** How many added features a ladder row names before it says "and N more". */
const ADDS_NAMED = 3;

/**
 * The plans as a ladder: one row each, in the order an admin configured them.
 *
 * This replaced six equal-height CARDS, and the reason is arithmetic rather
 * than taste. `pricing_tiers` is a JSONB column an admin edits — the schema
 * seeds three, production runs six — and a card grid has to answer "how many
 * across?" for a number nobody here controls. Six went 3+3, which breaks a
 * price ladder across two rows: the rise stops being readable left to right,
 * and the recommended plan lands at the END of the first row. Two previous
 * passes fixed a column count and the next tier count broke it again.
 *
 * A row per plan has no column count to get wrong, stacks on a phone with no
 * breakpoint at all, and — the defect that survived both previous passes —
 * cannot leave a hole. Equal-height cards must all be as tall as the tallest,
 * and these deltas are wildly uneven: Premium adds nine features over Classic
 * while Enterprise+ adds exactly ONE. That card was a $599 price over a single
 * line of text and ~250px of white, at every width.
 *
 * `adds` is the delta over the previous tier, and ONLY when containment
 * actually holds. Nothing in the product enforces that a higher tier contains
 * a lower one — an admin ticks each tier independently — so "Everything in
 * Classic, plus" can be a false claim on a pricing page. When it does not
 * hold the row falls back to naming the tier's own headline features, which
 * is always true.
 */
export function buildLadder(tiers) {
  const list = Array.isArray(tiers) ? tiers : [];
  return list.map((tier, i) => {
    const own = tier.features || [];
    const prev = i > 0 ? list[i - 1] : null;
    const prevFeatures = prev ? (prev.features || []) : [];
    const inherits = prevFeatures.length > 0 && prevFeatures.every((f) => own.includes(f));
    const delta = inherits ? own.filter((f) => !prevFeatures.includes(f)) : own;

    return {
      key: tier.key || tier.name,
      name: tier.name,
      description: tier.description,
      recommended: tier.recommended === true,
      price: priceOf(tier),
      capacity: capacityOf(tier),
      events: eventsOf(tier),
      inheritsFrom: inherits ? prev.name : null,
      adds: delta,
      named: delta.slice(0, ADDS_NAMED),
      moreCount: Math.max(0, delta.length - ADDS_NAMED),
      cta: ctaOf(tier),
      href: hrefOf(tier),
    };
  });
}

/* ── The comparison that used to live here ──────────────────────────────
   buildComparison() built a grouped feature matrix for a table below the
   ladder. Both are gone as of 2026-08-21: on a phone the matrix was ~25
   features of chips under two value rows, and the organizer's verdict was
   that it was very bad there. It is deleted rather than hidden below 768,
   because a branch nothing renders is the kind of code that rots quietly.

   Two facts it uniquely disclosed had to survive it, and did: the guest cap
   is the numeral on every ladder row, and the event allowance is the
   "Covers N events" line, printed on any plan that sets one. capacityOf()
   and eventsOf() above are what both read.

   If it comes back, it comes back desktop-only, and it must never put a
   capacity SENTENCE in a feature list again — see capacityOf(). */

/* ── The questions ──────────────────────────────────────────────────────── */

/**
 * The FAQ, computed from the live tiers so it cannot contradict the prices
 * above it, and imported by the Server Component to build FAQPage structured
 * data from the SAME strings a visitor reads.
 *
 * `stripeEnabled` comes from the endpoint, which has always returned it and
 * which this page has always thrown away. The answer about payment methods
 * used to be hardcoded to "all major credit and debit cards via Stripe" —
 * true on fancyrsvp.com, false on any install where PAYMENTS_STRIPE_ENABLED
 * is unset or the secret key is missing (config/features.js requires both,
 * and .env.example ships it off). The truth was in the payload.
 */
export function buildFaqs(tiers, { stripeEnabled } = {}) {
  const list = Array.isArray(tiers) ? tiers : [];
  const fixed = list.filter((t) => !t.is_custom);
  const largest = [...fixed].sort((a, b) => (b.max_guests || 0) - (a.max_guests || 0))[0] || null;
  const custom = list.find((t) => t.is_custom) || null;
  const capped = fixed.filter((t) => Number(t.max_events) > 0);

  const faqs = [
    {
      q: 'Do I pay once, or every month?',
      a: 'Once. You pay for an event, not for a subscription — pick the plan that fits that event, pay for it once, and it stays active for that event. There is nothing to cancel and nothing renews.',
    },
    {
      q: 'What happens when more guests reply than my plan allows?',
      a: largest
        ? `Nothing is charged automatically — there is no per-guest overage fee anywhere on this platform. When an event reaches its plan's guest limit, new replies pause until you move that event up a plan, and moving up only charges the difference between what you already paid and the new plan.${custom ? ` If your event is bigger than every plan listed here, that is what ${custom.name} is for: we agree the guest number and the price with you before anything is charged.` : ''}`
        : 'Nothing is charged automatically — there is no per-guest overage fee. When an event reaches its plan\'s guest limit, new replies pause until you move that event up a plan, and moving up only charges the difference.',
    },
    {
      q: 'Can I move an event up to a bigger plan later?',
      a: 'Yes, from that event\'s payment settings, at any time. You are charged only the difference between the plan you already paid for and the new one, and the change takes effect immediately. Moving an event back down to a smaller plan is not something you can do yourself — contact us and we will sort it out.',
    },
  ];

  /* Only asked when an admin has actually set a cap, because on a config
     where every tier is unlimited the question invents a restriction that
     does not exist. Computed from the tiers for the same reason nothing else
     here is hardcoded: max_events is admin-editable and would go stale. */
  if (capped.length > 0) {
    faqs.push({
      q: 'Is there a limit on how many events I can run?',
      a: `Most plans here are unlimited — you buy each event separately, so you can run as many as you like. ${capped.map((t) => `${t.name} covers ${formatCount(t.max_events)} ${Number(t.max_events) === 1 ? 'event' : 'events'}`).join(', ')}. Once a plan's allowance is used up, the next event is simply bought on whichever plan suits it.`,
    });
  }

  faqs.push(
    {
      q: 'How do I pay?',
      a: stripeEnabled
        ? 'By credit or debit card, handled by Stripe — we never see or store your card details. If your account is set up for bank transfer instead, that option appears at checkout.'
        : 'Payment is arranged directly with our team — bank transfer and the other methods set up for your account are offered at checkout. Card payment is not switched on for this site.',
    },
    {
      q: 'Can I get a refund?',
      /* ONE STRING, SHARED — see utils/refundPolicy.js.
         Three documents on this site answered this three different ways: this
         page said refunds were "case-by-case", the homepage FAQ promised a
         full refund within 14 days, and /terms described annual and monthly
         SUBSCRIPTIONS this product does not sell. The last one was the cause:
         a clause written around renewal dates cannot apply to a one-off fee
         per event, so every other surface improvised, and each improvised
         differently. /terms now describes the real product and this prints the
         summary verbatim rather than wording it again. */
      a: `${REFUND_SUMMARY} ${REFUND_HOW}`,
      link: { href: '/terms', label: 'Read the refund terms' },
    },
    {
      q: 'Is there an app for checking guests in at the door?',
      /* Names no tier, and no longer points at a table. `checkin_app` is a
         feature an admin can move between tiers in Admin → Config at any
         time, so a plan name here would go stale silently — this used to
         defer to the comparison table, which was removed on 2026-08-21 for
         being unreadable on a phone, so it defers to a person instead.
         It also does not promise the
         browser scanner as a universal fallback: /checkin looks ungated
         because the page loads for anyone, but checkinRoutes.js puts
         requireFeature on both qr_checkin and manual_checkin, so on a plan
         without them it opens and then 403s the moment somebody scans a
         guest at the door. */
      a: 'Yes — Fancy Check-in is an Android app that turns a tablet into a door scanner. It keeps your whole guest list on the device, so it carries on working in a venue with no signal and catches up with your dashboard afterwards. There is also a scanner that runs in a browser on any device with a connection. Ask us which plans include each one and we will tell you before you buy.',
      link: { href: '/checkin-app', label: 'See how the door app works' },
    },
    {
      q: 'What if I need something that is not listed?',
      a: 'Tell us about the event — guest numbers, dates, venue — and we will say plainly which plan fits, or quote you for something built around it. We would rather do that than sell you a plan that turns out to be the wrong shape.',
      link: { href: '/contact', label: 'Talk to us' },
    },
  );

  return faqs;
}
