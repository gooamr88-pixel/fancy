const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { sendEmailViaBrevo } = require('../utils/notificationService');
const { getStripePaymentReceiptTemplate } = require('../utils/emailTemplates');

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

    // Snapshot the purchased tier ("current plan") from the checkout metadata
    // (set in createCheckoutSession). tier_max_guests arrives as a string.
    const tierName = session.metadata.tier_name || null;
    const rawCap = session.metadata.tier_max_guests;
    const parsedCap = rawCap !== undefined && rawCap !== '' ? parseInt(rawCap, 10) : NaN;
    const tierMaxGuests = Number.isFinite(parsedCap) ? parsedCap : null;
    const tierRemoveWatermark = session.metadata.tier_remove_watermark === '1';

    // SEC C5: Optimistic locking — only update if the event hasn't been paid yet.
    // A concurrent webhook/verify call that already flipped is_paid=true will cause
    // this update to return 0 rows, which we treat as "already processed".
    const { data: updatedEvent, error: eventError } = await supabase
      .from('events')
      .update({ is_paid: true, status: 'pending_review', updated_at: new Date().toISOString() })
      .eq('id', event_id)
      .eq('is_paid', false)
      .select('id')
      .maybeSingle();

    if (eventError) throw eventError;

    // If no row was updated, a concurrent call already fulfilled this event.
    if (!updatedEvent) {
      return { ok: true, type, alreadyProcessed: true, eventId: event_id };
    }

    // Persist the tier separately and best-effort: the tier_name/tier_max_guests
    // columns ship in migration 20260624000000. If it hasn't been applied yet we
    // must NOT fail (and make Stripe retry) the already-committed activation — so
    // this write is isolated and its error is only logged. Apply the migration to
    // make the "Current Plan" panel light up.
    if (tierName || tierMaxGuests !== null) {
      const { error: tierErr } = await supabase
        .from('events')
        .update({ tier_name: tierName, tier_max_guests: tierMaxGuests, tier_remove_watermark: tierRemoveWatermark })
        .eq('id', event_id);
      if (tierErr) logger.warn({ err: tierErr, eventId: event_id }, '[fulfill] tier persistence skipped (run migration 20260624000000)');
    }

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
      logger.warn({ err: e, eventId: event_id }, '[fulfill] activity_log skipped');
    }

    // Email the organizer a card-payment receipt (best-effort — never block/fault
    // the already-committed fulfillment). The event is now under review.
    try {
      const { data: ev } = await supabase
        .from('events')
        .select('title, organizations(name, email)')
        .eq('id', event_id)
        .single();
      const orgEmail = ev?.organizations?.email;
      if (orgEmail) {
        const html = getStripePaymentReceiptTemplate({
          orgName: ev.organizations.name || 'Organizer',
          eventTitle: ev.title || 'Your event',
          amountCents: session.amount_total,
          tierName: tierName || null,
          referenceNumber: session.payment_intent || session.id,
        });
        await sendEmailViaBrevo(orgEmail, `Payment Received — ${ev.title || 'Your Event'}`, html);
      }
    } catch (e) {
      logger.warn({ err: e, eventId: event_id }, '[fulfill] receipt email skipped');
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
        logger.warn({ err: e, eventId: event_id }, '[fulfill] activity_log skipped for sms purchase');
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
    .select('id, event_id, status, amount_cents')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (payment) {
    // Already fully refunded → no-op (idempotent with the admin refund path).
    if (payment.status === 'refunded') return { ok: true, alreadyProcessed: true };

    // Stripe reports the CUMULATIVE refunded amount on the charge. Record it so
    // the books match whether the refund originated here (Stripe dashboard) or
    // via the admin endpoint — and so the daily-revenue rollup is accurate. Only
    // a FULL refund reverts the event to unpaid/paused; partials leave it live.
    const fullAmount = payment.amount_cents || 0;
    const refundedCumulative = Number.isInteger(charge.amount_refunded) ? charge.amount_refunded : fullAmount;
    const isFullRefund = fullAmount === 0 || charge.refunded === true || refundedCumulative >= fullAmount;

    const update = {
      refund_amount_cents: refundedCumulative,
      refunded_at: new Date().toISOString(),
    };
    if (isFullRefund) update.status = 'refunded';

    const { error: updErr } = await supabase
      .from('event_payments')
      .update(update)
      .eq('id', payment.id);
    if (updErr) throw updErr;

    if (isFullRefund) {
      const { error: evtErr } = await supabase
        .from('events')
        .update({ is_paid: false, status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', payment.event_id);
      if (evtErr) throw evtErr;
    }

    return { ok: true, type: 'event_fee', eventId: payment.event_id, fullRefund: isFullRefund };
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
