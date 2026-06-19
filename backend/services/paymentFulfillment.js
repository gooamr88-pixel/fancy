const { supabase } = require('../config/supabase');

/**
 * Single source of truth for fulfilling a completed Stripe Checkout Session.
 *
 * Called from BOTH the Stripe webhook (async, the backstop) and the synchronous
 * /payments/verify endpoint (hit on the browser redirect). Because either path
 * may run first — and Stripe retries webhooks — every write here is idempotent:
 *   • event_fee   → guarded by the unique event_payments.stripe_checkout_session_id
 *   • sms_credits → guarded inside record_sms_purchase() (unique payment_intent)
 *
 * Returns { ok, type, alreadyProcessed, eventId } so callers can shape a response.
 * Throws only on genuine/unexpected DB failures (so the webhook can 5xx → retry).
 */
const fulfillCheckoutSession = async (session) => {
  const { event_id, type } = session.metadata || {};

  if (!event_id || !type) {
    // Nothing we can do with an unidentifiable session — treat as a no-op so a
    // stray event never wedges the webhook into a retry loop.
    return { ok: true, type: type || null, alreadyProcessed: false, eventId: event_id || null, skipped: 'missing_metadata' };
  }

  if (type === 'event_fee') {
    // Idempotency: has this checkout session already been recorded?
    const { data: existingPayment } = await supabase
      .from('event_payments')
      .select('id')
      .eq('stripe_checkout_session_id', session.id)
      .limit(1);

    if (existingPayment && existingPayment.length > 0) {
      return { ok: true, type, alreadyProcessed: true, eventId: event_id };
    }

    // Mark paid and hold for review. A self-serve card payment does NOT make the
    // event publicly live on its own — a Super Admin promotes it to 'active'
    // (see migration 20260618000000). Guest-facing controllers require 'active'.
    const { error: eventError } = await supabase
      .from('events')
      .update({ is_paid: true, status: 'pending_review', updated_at: new Date().toISOString() })
      .eq('id', event_id);
    if (eventError) throw eventError;

    // Record the payment.
    const { error: insertError } = await supabase.from('event_payments').insert({
      event_id,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent,
      amount_cents: session.amount_total,
      currency: session.currency,
      status: 'completed',
      payment_method: 'stripe',
      completed_at: new Date().toISOString(),
    });

    if (insertError) {
      // A racing call (webhook vs verify) may insert first — treat the unique
      // violation as "already processed" rather than an error.
      if (insertError.code === '23505' || (insertError.message || '').includes('duplicate key')) {
        return { ok: true, type, alreadyProcessed: true, eventId: event_id };
      }
      throw insertError;
    }

    // Audit log is best-effort — never fail fulfillment (and never make Stripe
    // retry an already-committed activation) because of a logging hiccup.
    try {
      await supabase.from('activity_logs').insert({
        event_id,
        action: 'event_payment_completed',
        entity_type: 'event_payment',
        metadata: { amount_cents: session.amount_total },
      });
    } catch (e) {
      console.warn(`[fulfill] activity_log skipped for event ${event_id}: ${e.message}`);
    }

    return { ok: true, type, alreadyProcessed: false, eventId: event_id };
  }

  if (type === 'sms_credits') {
    const creditCount = parseInt(session.metadata.credit_count, 10);
    if (!Number.isInteger(creditCount) || creditCount <= 0) {
      throw new Error(`Invalid credit_count value: ${session.metadata.credit_count}`);
    }

    // Single transactional RPC: ensures wallet, writes the idempotency ledger row,
    // and credits the wallet atomically. Duplicate delivery → already_processed.
    const { data: purchaseResult, error: purchaseError } = await supabase.rpc('record_sms_purchase', {
      p_event_id: event_id,
      p_credits: creditCount,
      p_payment_intent: session.payment_intent,
    });

    if (purchaseError) throw purchaseError;
    if (purchaseResult && purchaseResult.success === false) {
      throw new Error(`record_sms_purchase failed: ${purchaseResult.error}`);
    }

    if (!purchaseResult?.already_processed) {
      try {
        await supabase.from('activity_logs').insert({
          event_id,
          action: 'sms_credits_purchased',
          entity_type: 'sms_wallet',
          metadata: { credit_count: creditCount },
        });
      } catch (e) {
        console.warn(`[fulfill] activity_log skipped for sms purchase ${event_id}: ${e.message}`);
      }
    }

    return { ok: true, type, alreadyProcessed: !!purchaseResult?.already_processed, eventId: event_id };
  }

  return { ok: true, type, alreadyProcessed: false, eventId: event_id, skipped: 'unknown_type' };
};

/**
 * Reverts a payment when Stripe reports a refund (charge.refunded). Idempotent:
 * an already-refunded payment / already-recorded SMS refund is left untouched.
 */
const handleChargeRefunded = async (charge) => {
  const paymentIntentId = charge.payment_intent;
  if (!paymentIntentId) return { ok: true, skipped: 'missing_payment_intent' };

  // 1. Event fee refund → revert activation.
  const { data: payment } = await supabase
    .from('event_payments')
    .select('id, event_id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (payment) {
    if (payment.status === 'refunded') return { ok: true, alreadyProcessed: true };
    const { error: updErr } = await supabase
      .from('event_payments')
      .update({ status: 'refunded' })
      .eq('id', payment.id);
    if (updErr) throw updErr;

    const { error: evtErr } = await supabase
      .from('events')
      .update({ is_paid: false, status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', payment.event_id);
    if (evtErr) throw evtErr;

    return { ok: true, type: 'event_fee', eventId: payment.event_id };
  }

  // 2. SMS credit refund → deduct via ledger.
  const { data: ledgerEntry } = await supabase
    .from('sms_credit_ledger')
    .select('id, wallet_id, event_id, credits')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .eq('transaction_type', 'purchase')
    .maybeSingle();

  if (!ledgerEntry) return { ok: true, skipped: 'no_matching_payment' };

  const refundCredits = Math.abs(ledgerEntry.credits);

  const { data: existingRefund } = await supabase
    .from('sms_credit_ledger')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .eq('transaction_type', 'refund')
    .limit(1);
  if (existingRefund && existingRefund.length > 0) return { ok: true, alreadyProcessed: true };

  const { data: wallet, error: wErr } = await supabase
    .from('sms_credit_wallets')
    .select('id, credits_purchased')
    .eq('id', ledgerEntry.wallet_id)
    .single();
  if (wErr) throw wErr;

  const { error: updWErr } = await supabase
    .from('sms_credit_wallets')
    .update({
      credits_purchased: Math.max(0, (wallet.credits_purchased || 0) - refundCredits),
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);
  if (updWErr) throw updWErr;

  const { error: ledErr } = await supabase
    .from('sms_credit_ledger')
    .insert({
      wallet_id: wallet.id,
      event_id: ledgerEntry.event_id,
      transaction_type: 'refund',
      credits: -refundCredits,
      stripe_payment_intent_id: paymentIntentId,
    });
  if (ledErr) throw ledErr;

  return { ok: true, type: 'sms_credits', eventId: ledgerEntry.event_id };
};

/**
 * Records a Stripe dispute / chargeback (charge.dispute.created and updates) into
 * payment_disputes (Master Plan §9). Idempotent on stripe_dispute_id.
 */
const handleDisputeEvent = async (dispute) => {
  if (!dispute || !dispute.id) return { ok: true, skipped: 'missing_dispute' };

  // Link to the originating payment via the charge's payment_intent when present.
  let paymentId = null;
  const paymentIntentId = dispute.payment_intent;
  if (paymentIntentId) {
    const { data: payment } = await supabase
      .from('event_payments')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();
    paymentId = payment?.id || null;
  }

  const row = {
    payment_id: paymentId,
    stripe_dispute_id: dispute.id,
    stripe_charge_id: dispute.charge || null,
    status: dispute.status || null,
    amount_cents: dispute.amount ?? null,
    currency: dispute.currency || 'usd',
    reason: dispute.reason || null,
    evidence_due_at: dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('payment_disputes')
    .upsert(row, { onConflict: 'stripe_dispute_id' });
  if (error) throw error;

  return { ok: true, disputeId: dispute.id, paymentId };
};

module.exports = { fulfillCheckoutSession, handleChargeRefunded, handleDisputeEvent };
