const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) throw new Error('FATAL: STRIPE_SECRET_KEY environment variable is required');
const stripe = require('stripe')(STRIPE_SECRET_KEY);
const { supabase } = require('../config/supabase');
const { sendEmailViaBrevo } = require('../utils/notificationService');
const { getCashPaymentApprovedTemplate } = require('../utils/emailTemplates');
// Bulletproof resolver: splits FRONTEND_URL on commas, repairs typos, and returns
// only the first valid https:// origin — never a raw, malformed env string.
const { getPublicBaseUrl } = require('../utils/publicUrl');
const { computeSmsChargeCents } = require('../utils/pricing');

/**
 * Creates a Stripe Checkout Session for event payment fees.
 * POST /api/v1/payments/create-checkout
 */
const createCheckoutSession = async (req, res, next) => {
  // Authoritative eventId comes from the URL param that verifyEventOwner already
  // checked ownership against — NOT from the request body. Trusting body.eventId
  // would let an authorized owner of event A start a checkout that activates an
  // arbitrary event B (parameter confusion / broken object-level authorization).
  const { eventId } = req.params;
  const { tierName } = req.body;

  if (!eventId || !tierName) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'eventId and tierName are required.'
    });
  }

  try {
    // 1. Fetch pricing tiers from super_admin_config
    const { data: adminConfig, error: configError } = await supabase
      .from('super_admin_config')
      .select('pricing_tiers')
      .single();

    if (configError || !adminConfig) {
      return res.status(500).json({
        success: false,
        error: 'CONFIG_ERROR',
        message: 'Could not retrieve pricing configuration.'
      });
    }

    const tier = adminConfig.pricing_tiers.find(t => t.name.toLowerCase() === tierName.toLowerCase());
    if (!tier) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TIER',
        message: `Pricing tier '${tierName}' not found.`
      });
    }

    // 2. Fetch or create stripe customer ID for organization
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('org_id, organizations(stripe_customer_id, email, name)')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'Event not found.'
      });
    }

    let customerId = eventData.organizations?.stripe_customer_id;
    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: eventData.organizations?.email || 'customer@example.com',
        name: eventData.organizations?.name || 'Event Organizer',
        metadata: { org_id: eventData.org_id }
      });
      customerId = customer.id;

      // Update organization table
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', eventData.org_id);
    }

    // 3. Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: tier.price_cents,
          product_data: {
            name: `Fancy RSVP - ${tier.name} License`,
            description: `License for up to ${tier.max_guests} guests`
          }
        },
        quantity: 1
      }],
      metadata: {
        event_id: eventId,
        tier_name: tier.name,
        type: 'event_fee'
      },
      success_url: `${getPublicBaseUrl()}/dashboard?payment=success&event=${eventId}`,
      cancel_url: `${getPublicBaseUrl()}/dashboard/create-event?payment=cancelled&event=${eventId}`
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Creates a Stripe Checkout Session for purchasing SMS credit packs.
 * POST /api/v1/payments/sms-credits
 */
const purchaseSMSCredits = async (req, res, next) => {
  // eventId from the ownership-verified URL param, not the body (see createCheckoutSession).
  const { eventId } = req.params;
  const { creditCount } = req.body;

  if (!eventId || !creditCount || creditCount < 50 || creditCount > 50000) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'eventId and creditCount (minimum 50, maximum 50000) are required.'
    });
  }

  try {
    // 1. Fetch SMS rates
    const { data: config } = await supabase
      .from('super_admin_config')
      .select('sms_rate_cents_per_credit, sms_markup_percentage')
      .single();

    if (!config) {
      return res.status(500).json({
        success: false,
        error: 'CONFIG_ERROR',
        message: 'Could not retrieve SMS pricing configuration.'
      });
    }

    // Base carrier cost → admin markup → volume discount, rounded once at the end.
    const totalCents = computeSmsChargeCents({
      unitPriceCents: config.sms_rate_cents_per_credit,
      creditCount,
      markupPct: config.sms_markup_percentage,
    });

    // 2. Fetch customer details
    const { data: eventData } = await supabase
      .from('events')
      .select('org_id, organizations(stripe_customer_id)')
      .eq('id', eventId)
      .single();

    if (!eventData || !eventData.organizations) {
      return res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'Event not found or has no associated organization.'
      });
    }

    const customerId = eventData.organizations.stripe_customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'NO_STRIPE_CUSTOMER',
        message: 'Please complete your first event payment before purchasing SMS credits.'
      });
    }

    // 3. Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      // Charge the computed total as a single line item. Splitting it into a
      // per-unit price × quantity would re-round per credit and silently discard
      // the markup/volume-discount cents (e.g. an intended 2188¢ collapses to 2000¢).
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: totalCents,
          product_data: {
            name: `Fancy RSVP - SMS Credits (${creditCount} Pack)`,
            description: `Pre-paid SMS credits for event invitations`
          }
        },
        quantity: 1
      }],
      metadata: {
        event_id: eventId,
        type: 'sms_credits',
        credit_count: creditCount.toString()
      },
      success_url: `${getPublicBaseUrl()}/dashboard/campaigns?event=${eventId}&purchase=success`,
      cancel_url: `${getPublicBaseUrl()}/dashboard/campaigns?event=${eventId}&purchase=cancelled`
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Processes Stripe Webhook payloads.
 * POST /api/v1/payments/webhook
 */
const stripeWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let stripeEvent;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not configured!');
    return res.status(500).json({ success: false, error: 'Webhook secret is not configured.' });
  }

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const { event_id, type } = session.metadata;

      if (type === 'event_fee') {
        // Idempotency check: see if payment was already recorded
        const { data: existingPayment } = await supabase
          .from('event_payments')
          .select('id')
          .eq('stripe_checkout_session_id', session.id)
          .limit(1);

        if (existingPayment && existingPayment.length > 0) {
          console.log(`[Webhook] Event fee checkout session already processed: ${session.id}`);
          return res.json({ received: true });
        }

        // Activate event
        await supabase
          .from('events')
          .update({ is_paid: true, status: 'active', updated_at: new Date() })
          .eq('id', event_id);

        // Record payment
        const { error: insertError } = await supabase.from('event_payments').insert({
          event_id,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          amount_cents: session.amount_total,
          currency: session.currency,
          status: 'completed',
          payment_method: 'stripe',
          completed_at: new Date()
        });

        if (insertError) {
          if (insertError.code === '23505' || insertError.message.includes('duplicate key')) {
            console.log(`[Webhook] Duplicate checkout session insert caught: ${session.id}`);
            return res.json({ received: true });
          }
          throw insertError;
        }

        // Audit log
        await supabase.from('activity_logs').insert({
          event_id,
          action: 'event_payment_completed',
          entity_type: 'event_payment',
          metadata: { amount_cents: session.amount_total }
        });

      } else if (type === 'sms_credits') {
        const creditCount = parseInt(session.metadata.credit_count);

        // Single transactional RPC: ensures the wallet, writes the idempotency
        // ledger row, and credits the wallet — all atomically. A duplicate
        // delivery is caught inside the function (already_processed) and never
        // double-credits; a mid-way failure rolls back fully for a clean retry.
        const { data: purchaseResult, error: purchaseError } = await supabase
          .rpc('record_sms_purchase', {
            p_event_id: event_id,
            p_credits: creditCount,
            p_payment_intent: session.payment_intent
          });

        if (purchaseError) throw purchaseError;
        if (purchaseResult && purchaseResult.success === false) {
          throw new Error(`record_sms_purchase failed: ${purchaseResult.error}`);
        }

        // Audit log only on the first (newly credited) delivery
        if (!purchaseResult?.already_processed) {
          await supabase.from('activity_logs').insert({
            event_id,
            action: 'sms_credits_purchased',
            entity_type: 'sms_wallet',
            metadata: { credit_count: creditCount }
          });
        }
      }
    } else if (stripeEvent.type === 'charge.refunded') {
      // Mirror the edge-function refund logic so refunds are handled no matter which
      // webhook endpoint Stripe is configured to call.
      const charge = stripeEvent.data.object;
      const paymentIntentId = charge.payment_intent;

      if (!paymentIntentId) {
        console.error('charge.refunded received but missing payment_intent.');
        return res.status(400).json({ success: false, error: 'Missing payment_intent' });
      }

      // 1. Event-fee payment? Mark refunded and pause the event.
      const { data: payment } = await supabase
        .from('event_payments')
        .select('id, event_id, status')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (payment) {
        if (payment.status === 'refunded') {
          return res.json({ received: true, message: 'Already refunded' });
        }
        await supabase.from('event_payments').update({ status: 'refunded' }).eq('id', payment.id);
        await supabase
          .from('events')
          .update({ is_paid: false, status: 'paused', updated_at: new Date().toISOString() })
          .eq('id', payment.event_id);
        await supabase.from('activity_logs').insert({
          event_id: payment.event_id,
          action: 'event_payment_refunded',
          entity_type: 'event_payment',
          entity_id: payment.id,
        });
      } else {
        // 2. SMS-credit purchase? Reverse the credits (idempotent via refund ledger row).
        const { data: ledgerEntry } = await supabase
          .from('sms_credit_ledger')
          .select('id, wallet_id, event_id, credits')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .eq('transaction_type', 'purchase')
          .maybeSingle();

        if (ledgerEntry) {
          const refundCredits = Math.abs(ledgerEntry.credits);

          // Idempotency: skip if a matching refund row already exists.
          const { data: existingRefund } = await supabase
            .from('sms_credit_ledger')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .eq('transaction_type', 'refund')
            .limit(1);

          if (existingRefund && existingRefund.length > 0) {
            return res.json({ received: true, message: 'Already refunded' });
          }

          const { data: wallet } = await supabase
            .from('sms_credit_wallets')
            .select('id, credits_purchased')
            .eq('id', ledgerEntry.wallet_id)
            .single();

          if (wallet) {
            await supabase
              .from('sms_credit_wallets')
              .update({
                credits_purchased: Math.max(0, (wallet.credits_purchased || 0) - refundCredits),
                updated_at: new Date().toISOString()
              })
              .eq('id', wallet.id);

            await supabase.from('sms_credit_ledger').insert({
              wallet_id: wallet.id,
              event_id: ledgerEntry.event_id,
              transaction_type: 'refund',
              credits: -refundCredits,
              stripe_payment_intent_id: paymentIntentId
            });
          }
        } else {
          console.warn(`[Webhook] No matching payment or SMS purchase for refunded payment intent: ${paymentIntentId}`);
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    next(err);
  }
};

/**
 * Super Admin manual approval of event payments bypass.
 * POST /api/v1/admin/manual-approve
 */
const manualCashApproval = async (req, res, next) => {
  const { eventId, amountCents } = req.body;

  if (!eventId || amountCents === undefined) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'eventId and amountCents are required.'
    });
  }

  // amountCents must be a positive integer — guard against negative/NaN/float amounts
  // being written into the financial ledger.
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_AMOUNT',
      message: 'amountCents must be a positive integer (in cents).'
    });
  }

  try {
    // 1. Check if there is an existing pending cash_manual payment record
    const { data: pendingPayment, error: findError } = await supabase
      .from('event_payments')
      .select('id, amount_cents, stripe_checkout_session_id')
      .eq('event_id', eventId)
      .eq('payment_method', 'cash_manual')
      .eq('status', 'pending')
      .limit(1);

    let paymentId;
    let refNumber;

    if (pendingPayment && pendingPayment.length > 0) {
      // Update the pending payment
      const { data: updatedPayment, error: updateErr } = await supabase
        .from('event_payments')
        .update({
          status: 'completed',
          approved_by: req.user.id,
          verified_by: req.user.id,
          verified_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          amount_cents: amountCents
        })
        .eq('id', pendingPayment[0].id)
        .select()
        .single();

      if (updateErr) throw updateErr;
      paymentId = updatedPayment.id;
      refNumber = updatedPayment.reference_number || updatedPayment.stripe_checkout_session_id;

      // Activate the event
      const { error: eventUpdateErr } = await supabase
        .from('events')
        .update({
          is_paid: true,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

      if (eventUpdateErr) throw eventUpdateErr;
      
      // Log activity
      await supabase.from('activity_logs').insert({
        event_id: eventId,
        actor_id: req.user.id,
        action: 'event_payment_manual_approved',
        entity_type: 'event_payment',
        entity_id: paymentId,
        metadata: { amount_cents: amountCents }
      });
    } else {
      // Fallback: Use approve_event_cash RPC function
      const { data, error } = await supabase.rpc('approve_event_cash', {
        p_event_id: eventId,
        p_approved_by: req.user.id,
        p_amount_cents: amountCents
      });

      if (error) throw error;

      if (!data || !data.success) {
        return res.status(400).json({
          success: false,
          error: data?.error || 'APPROVAL_FAILED',
          message: data?.message || 'Manual cash approval failed.'
        });
      }

      paymentId = data.payment_id;
      refNumber = `CASH-${paymentId.slice(0, 6).toUpperCase()}`;
    }

    // 2. Fetch event and organization details to send email receipt
    const { data: eventData } = await supabase
      .from('events')
      .select('title, organizations(email, name)')
      .eq('id', eventId)
      .single();

    if (eventData && eventData.organizations?.email) {
      const orgEmail = eventData.organizations.email;
      const orgName = eventData.organizations.name || 'Organizer';
      const eventTitle = eventData.title;

      const emailHtml = getCashPaymentApprovedTemplate(orgName, eventTitle, refNumber || `CASH-${paymentId.slice(0, 6).toUpperCase()}`, amountCents);
      await sendEmailViaBrevo(orgEmail, `Payment Approved & Event Activated: ${eventTitle}`, emailHtml);
    }

    return res.status(200).json({
      success: true,
      message: 'Event manually approved and activated.',
      paymentId
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Super Admin updates platform pricing configuration.
 * PATCH /api/v1/admin/pricing
 */
const updatePricingConfig = async (req, res, next) => {
  const { pricingTiers, smsRateCentsPerCredit, smsMarkupPercentage, platformCommissionPct, manualPaymentMethods } = req.body;

  const updates = {};
  if (pricingTiers) updates.pricing_tiers = pricingTiers;
  if (smsRateCentsPerCredit !== undefined) updates.sms_rate_cents_per_credit = smsRateCentsPerCredit;
  if (smsMarkupPercentage !== undefined) updates.sms_markup_percentage = smsMarkupPercentage;
  if (platformCommissionPct !== undefined) updates.platform_commission_pct = platformCommissionPct;
  if (manualPaymentMethods !== undefined) {
    if (!Array.isArray(manualPaymentMethods)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'manualPaymentMethods must be an array.' });
    }
    // Normalize each method to the documented shape and drop empties.
    updates.manual_payment_methods = manualPaymentMethods
      .filter(m => m && (m.label || '').trim())
      .map((m, i) => ({
        id: m.id || `method_${i}_${Date.now()}`,
        label: String(m.label).trim(),
        type: m.type || 'other',
        details: (m.details || '').trim(),
        instructions: (m.instructions || '').trim(),
        is_active: m.is_active !== false,
      }));
  }
  updates.updated_at = new Date().toISOString();
  updates.updated_by = req.user.id;

  try {
    const { data, error } = await supabase
      .from('super_admin_config')
      .update(updates)
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Platform configuration updated successfully.',
      config: data?.[0] || data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Super Admin gets current platform pricing configuration.
 * GET /api/v1/admin/pricing
 */
const getPricingConfig = async (req, res, next) => {
  try {
    const { data: config, error } = await supabase
      .from('super_admin_config')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      config
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Initiates a manual cash transfer request, pre-inserting a pending record.
 * POST /api/v1/payments/events/:eventId/manual-payment
 */
const initiateManualPayment = async (req, res, next) => {
  const { eventId } = req.params;
  const { tierName, methodLabel, payerReference } = req.body;

  if (!tierName) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'tierName is required.'
    });
  }

  try {
    // 1. Check if there is already a pending cash payment for this event
    const { data: existingPending } = await supabase
      .from('event_payments')
      .select('id, reference_number, amount_cents')
      .eq('event_id', eventId)
      .eq('payment_method', 'cash_manual')
      .eq('status', 'pending')
      .limit(1);

    if (existingPending && existingPending.length > 0) {
      // Keep the payer's declared method / proof reference fresh if they re-submit.
      if (methodLabel !== undefined || payerReference !== undefined) {
        const patch = {};
        if (methodLabel !== undefined) patch.manual_method = (methodLabel || '').toString().slice(0, 200);
        if (payerReference !== undefined) patch.payer_reference = (payerReference || '').toString().slice(0, 300);
        await supabase.from('event_payments').update(patch).eq('id', existingPending[0].id);
      }
      return res.status(200).json({
        success: true,
        message: 'Existing pending cash payment found.',
        referenceNumber: existingPending[0].reference_number,
        payment: existingPending[0]
      });
    }

    // 2. Fetch pricing tiers from super_admin_config
    const { data: adminConfig, error: configError } = await supabase
      .from('super_admin_config')
      .select('pricing_tiers')
      .single();

    if (configError || !adminConfig) {
      return res.status(500).json({
        success: false,
        error: 'CONFIG_ERROR',
        message: 'Could not retrieve pricing configuration.'
      });
    }

    const tier = adminConfig.pricing_tiers.find(t => t.name.toLowerCase() === tierName.toLowerCase());
    if (!tier) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TIER',
        message: `Pricing tier '${tierName}' not found.`
      });
    }

    // 3. Generate a random reference number
    const refChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let refCode = 'CASH-';
    for (let i = 0; i < 6; i++) {
      refCode += refChars.charAt(Math.floor(Math.random() * refChars.length));
    }

    // 4. Insert pending cash payment
    const { data, error } = await supabase
      .from('event_payments')
      .insert({
        event_id: eventId,
        reference_number: refCode,
        amount_cents: tier.price_cents,
        status: 'pending',
        payment_method: 'cash_manual',
        currency: 'usd',
        manual_method: methodLabel ? methodLabel.toString().slice(0, 200) : null,
        payer_reference: payerReference ? payerReference.toString().slice(0, 300) : null
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase.from('activity_logs').insert({
      event_id: eventId,
      actor_id: req.user.id,
      action: 'event_payment_manual_initiated',
      entity_type: 'event_payment',
      entity_id: data.id,
      metadata: { ref_code: refCode, tier_name: tier.name }
    });

    return res.status(200).json({
      success: true,
      message: 'Manual cash payment initiated.',
      referenceNumber: refCode,
      payment: data
    });
  } catch (err) {
    next(err);
  }
};

const getPendingPayments = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('event_payments')
      .select(`
        *,
        events(
          id,
          title,
          organizations(
            name,
            email
          )
        )
      `)
      .eq('status', 'pending')
      .eq('payment_method', 'cash_manual');

    if (error) throw error;

    return res.status(200).json({
      success: true,
      payments: data || []
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCheckoutSession,
  purchaseSMSCredits,
  stripeWebhook,
  manualCashApproval,
  updatePricingConfig,
  getPricingConfig,
  initiateManualPayment,
  getPendingPayments
};

