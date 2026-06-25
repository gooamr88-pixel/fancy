// Lazy, boot-safe Stripe client — never construct (or throw) at module load. Card
// refunds need a key; offline (cash_manual) refunds never touch Stripe, so the
// service must load and run even with no key configured (pre-live / manual mode).
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = require('stripe')(key);
  return _stripe;
}
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Real refund execution (Master Plan §9 / fixes B1).
 *
 * The previous admin "refund" only flipped a DB flag and never moved money.
 * This service issues an actual Stripe refund for card payments, then records
 * the refund context and reverts the event. For offline (cash_manual) payments
 * there is no Stripe charge to reverse, so it performs the book-keeping refund.
 *
 * Idempotent with the charge.refunded webhook (handleChargeRefunded): both check
 * status === 'refunded' and no-op if already done.
 */

/**
 * @param {Object} payment  event_payments row (id, event_id, status, amount_cents,
 *                          payment_method, stripe_payment_intent_id)
 * @param {Object} opts
 * @param {string} opts.actorId    super-admin user id performing the refund
 * @param {string} [opts.reason]
 * @param {number} [opts.amountCents]  partial refund amount; defaults to full
 * @returns {Promise<{ ok: true, stripeRefundId: string|null, amountCents: number, offline: boolean }>}
 */
async function refundEventPayment(payment, { actorId, reason, amountCents } = {}) {
  if (!payment) throw new Error('refundEventPayment: payment is required');
  if (payment.status !== 'completed') {
    const err = new Error('Only completed payments can be refunded.');
    err.code = 'NOT_REFUNDABLE';
    throw err;
  }

  const fullAmount = payment.amount_cents || 0;
  // Refunds accumulate: a payment may already carry a prior partial refund. The
  // most we can return now is what's left (full - already refunded), never more —
  // so repeated partials can't over-refund or overwrite the running total.
  const alreadyRefunded = Math.max(0, payment.refund_amount_cents || 0);
  const remaining = Math.max(0, fullAmount - alreadyRefunded);
  if (remaining <= 0) {
    const err = new Error('This payment has already been fully refunded.');
    err.code = 'NOT_REFUNDABLE';
    throw err;
  }
  const refundAmount = Number.isInteger(amountCents) && amountCents > 0 && amountCents <= remaining
    ? amountCents
    : remaining;
  const refundedTotal = alreadyRefunded + refundAmount;

  let stripeRefundId = null;
  let offline = true;

  // Card payment → issue a genuine Stripe refund.
  if (payment.payment_method === 'stripe' && payment.stripe_payment_intent_id) {
    offline = false;
    const stripe = getStripe();
    if (!stripe) {
      const err = new Error('Card refunds are unavailable because Stripe is not configured.');
      err.code = 'NOT_REFUNDABLE';
      throw err;
    }
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      amount: refundAmount, // this transaction's amount; always explicit
      reason: 'requested_by_customer',
      metadata: { event_id: payment.event_id, refunded_by: actorId || 'admin' },
    }, {
      // Dedupe retries (network failure / double-click) so the same logical refund
      // can never issue two real Stripe refunds. Keyed on payment + cumulative
      // total: a true retry reuses the original refund, while a further partial
      // (which advances the running total) is allowed. Stripe keys expire after
      // 24h, so legitimate later refunds are unaffected.
      idempotencyKey: `refund_${payment.id}_${refundedTotal}`,
    });
    stripeRefundId = refund.id;
    logger.info({ paymentId: payment.id, stripeRefundId, refundAmount, refundedTotal }, 'Stripe refund created');
  }

  // Record refund context + status. Idempotent with the webhook path.
  const isFullRefund = refundedTotal >= fullAmount;
  const { error: updErr } = await supabase
    .from('event_payments')
    .update({
      status: isFullRefund ? 'refunded' : 'completed', // partial keeps it 'completed'
      stripe_refund_id: stripeRefundId,
      refund_amount_cents: refundedTotal, // cumulative total, not just this slice
      refunded_at: new Date().toISOString(),
      refunded_by: actorId || null,
      refund_reason: (reason || '').toString().slice(0, 500) || null,
    })
    .eq('id', payment.id)
    .eq('status', 'completed'); // guard against double-processing
  if (updErr) throw updErr;

  // Full refund reverts the event to unpaid/paused (mirrors handleChargeRefunded).
  if (isFullRefund) {
    const { error: evtErr } = await supabase
      .from('events')
      .update({ is_paid: false, status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', payment.event_id);
    if (evtErr) throw evtErr;
  }

  return { ok: true, stripeRefundId, amountCents: refundAmount, offline };
}

module.exports = { refundEventPayment };
