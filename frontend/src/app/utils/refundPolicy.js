/* ═══════════════════════════════════════════════════════════════════════════
   THE REFUND POLICY, IN ONE PLACE.

   ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────

   On 2026-08-21 this site answered "can I get a refund?" three different ways,
   in three documents a customer can open in three tabs:

     /pricing  — "refunds are handled case-by-case rather than automatically"
     homepage  — "a full refund within 14 days of purchase, as long as the
                  event has not gone live … pro-rated credit for an active one"
     /terms §7 — "Annual subscriptions may be refunded within 14 days …
                  Monthly subscriptions are generally non-refundable"

   The third is the one that explains the other two. /terms §7 was written for
   a SUBSCRIPTION product — monthly and annual billing cycles, renewals, failed
   recurring payments, downgrades. Fancy RSVP does not sell one and never has:
   there is a free tier and a ONE-TIME fee per event, which is what the pricing
   page, the checkout and paymentController all actually implement. A refund
   clause about renewal dates cannot be applied to a product that has none, so
   whoever wrote each surface had to improvise, and each improvised differently.

   ── WHICH ANSWER WON, AND WHY ─────────────────────────────────────────────

   The homepage one. Not because it is the friendliest, but because it is the
   only one that is BOTH specific and already published: it names a window, a
   condition and a remedy, and customers have been reading it as a promise.
   The other two are a subscription clause that cannot apply and a "case by
   case" non-answer. Between a public promise and a clause describing a product
   that does not exist, the promise is the one you keep — quietly narrowing it
   afterwards is the version of this that ends in a chargeback.

   ── HOW TO CHANGE IT ──────────────────────────────────────────────────────

   Here, once. Every surface imports from this module and none of them
   paraphrases: /terms prints TERMS, the two FAQs print SUMMARY, and
   test/refundPolicy.test.js fails if any of them starts wording it themselves.
   This is a commercial and legal decision, not a copy decision — if the real
   policy is different, change it HERE and the whole site follows.

   NO 'use client' IN THIS FILE. /terms is a client page but faqContent.js is
   imported by a Server Component to build FAQPage structured data, and a
   Server Component importing from a 'use client' module receives client
   references instead of values — which fails only in a production build, at
   page-data collection. faqContent.js carries the same warning.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The window, in days from purchase, for a full refund. */
export const REFUND_WINDOW_DAYS = 14;

/** How long a refund request waits for a human answer. Two, because /contact
 *  already promises "within one business day" for ordinary mail and a refund
 *  needs a payment looked up — promising the same day and missing it is worse
 *  than promising two and beating it. */
export const REFUND_REPLY_DAYS = 2;

/**
 * The one-sentence version, for the FAQs.
 *
 * Both of them print this string verbatim and then link to /terms. Neither
 * summarises it in its own words: a marketing page paraphrasing a legal
 * document is precisely how the three answers above came to disagree.
 */
export const REFUND_SUMMARY =
  `A full refund within ${REFUND_WINDOW_DAYS} days of purchase, as long as the event has not gone live. `
  + 'Once an event is live we issue pro-rated credit towards a future event instead, because the '
  + 'invitations are already out and the guest list is already collecting replies.';

/**
 * HOW to ask — the sentence that turns the policy into a method.
 *
 * The policy used to end at a bare mailto buried in §7 of the Terms, which is
 * a rule without a door: no structure, no label, no acknowledgement, and no
 * way for the request to be told apart from any other email. The contact form
 * already routes by subject and already accepts a `?subject=` deep link, so
 * both FAQ answers now point at it with "Refund Request" pre-selected.
 *
 * The other side is real and already built: stripeRefundService issues the
 * card refund through Stripe and records a book-keeping refund for a manually
 * paid event, exposed at POST /admin/payments/:paymentId/refund with
 * partial-amount support. Nothing here is a promise the product cannot keep.
 */
export const REFUND_HOW =
  'To ask for one, send us a refund request with the event name and the email you paid with. '
  + `We reply within ${REFUND_REPLY_DAYS} business ${REFUND_REPLY_DAYS === 1 ? 'day' : 'days'}, and an approved `
  + 'card refund is returned to the card you paid with — bank transfers are returned the same way they came in.';

/**
 * The clause itself, for /terms §7.
 *
 * Written for the product that exists: a one-off licence bought per event. It
 * says what "gone live" means, because that is the condition the whole policy
 * turns on and a customer must not have to guess where the line is.
 */
export const REFUND_TERMS =
  `**Refunds:** An event licence may be refunded in full within ${REFUND_WINDOW_DAYS} days of purchase, `
  + 'provided the event has not gone live. "Gone live" means the event has been published and its '
  + 'invitation link or QR code has been made available to guests. Once an event is live, we issue '
  + 'pro-rated credit against a future event rather than a refund. Add-ons already consumed — text '
  + 'messages sent, physical goods produced or shipped — are not refundable, since the cost has '
  + 'already been incurred on your behalf. To request either, submit a refund request through our '
  + `contact form or write to info@fancyrsvp.com with the event name and the email used to pay. We `
  + `respond within ${REFUND_REPLY_DAYS} business days. An approved card refund is returned to the `
  + 'original card; a payment made by bank transfer is returned by bank transfer.';

/**
 * How the product is actually paid for, for /terms §7's opening line.
 *
 * Kept beside the refund clause because the two cannot be written
 * independently: the refund rule turns on "per event, once", and the previous
 * clause was unusable precisely because the billing description above it
 * described something else.
 */
export const PAYMENT_MODEL =
  'Fancy RSVP is not a subscription. There is a free tier, and every paid plan is a one-time fee for '
  + 'one event: you choose the plan that fits that event, pay for it once, and it stays active for '
  + 'that event. Nothing renews, there is no billing cycle, and there is nothing to cancel.';
