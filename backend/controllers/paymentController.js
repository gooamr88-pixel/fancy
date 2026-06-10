const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const { supabase } = require('../config/supabase');

/**
 * Creates a Stripe Checkout Session for event payment fees.
 * POST /api/v1/payments/create-checkout
 */
const createCheckoutSession = async (req, res, next) => {
  const { eventId, tierName } = req.body;

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
      success_url: `${process.env.FRONTEND_URL}/events/${eventId}/setup?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/events/${eventId}/payment?payment=cancelled`
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
  const { eventId, creditCount } = req.body;

  if (!eventId || !creditCount || creditCount < 50) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'eventId and creditCount (minimum 50) are required.'
    });
  }

  try {
    // 1. Fetch SMS rates
    const { data: config } = await supabase
      .from('super_admin_config')
      .select('sms_rate_cents_per_credit')
      .single();

    const unitPrice = config.sms_rate_cents_per_credit;
    let totalCents = unitPrice * creditCount;

    // Apply volume discount (12.5% discount for 500+ credits)
    if (creditCount >= 500) {
      totalCents = Math.round(totalCents * 0.875);
    }

    // 2. Fetch customer details
    const { data: eventData } = await supabase
      .from('events')
      .select('org_id, organizations(stripe_customer_id)')
      .eq('id', eventId)
      .single();

    const customerId = eventData.organizations?.stripe_customer_id;

    // 3. Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(totalCents / creditCount),
          product_data: {
            name: `Fancy RSVP - SMS Credits (${creditCount} Pack)`,
            description: `Pre-paid SMS credits for event invitations`
          }
        },
        quantity: creditCount
      }],
      metadata: {
        event_id: eventId,
        type: 'sms_credits',
        credit_count: creditCount.toString()
      },
      success_url: `${process.env.FRONTEND_URL}/events/${eventId}/sms?purchase=success`,
      cancel_url: `${process.env.FRONTEND_URL}/events/${eventId}/sms?purchase=cancelled`
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
  if (process.env.NODE_ENV === 'production' && (!webhookSecret || webhookSecret === 'whsec_placeholder')) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is missing or invalid in production!');
    return res.status(500).json({ success: false, error: 'Webhook secret is not configured.' });
  }

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      webhookSecret || 'whsec_placeholder'
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

        // Fetch wallet to see if it exists
        const { data: wallets } = await supabase
          .from('sms_credit_wallets')
          .select('id, credits_purchased')
          .eq('event_id', event_id);

        let wallet = wallets && wallets[0];
        let walletId;

        if (!wallet) {
          // Try inserting a new wallet
          const { data: newWallet, error: insertError } = await supabase
            .from('sms_credit_wallets')
            .insert({
              event_id,
              credits_purchased: 0,
              credits_used: 0
            })
            .select()
            .single();

          if (insertError) {
            // Handle race condition on duplicate wallet creation
            if (insertError.code === '23505' || insertError.message.includes('duplicate key')) {
              const { data: refetchedWallets } = await supabase
                .from('sms_credit_wallets')
                .select('id, credits_purchased')
                .eq('event_id', event_id);
              wallet = refetchedWallets && refetchedWallets[0];
              if (!wallet) throw new Error('Failed to resolve wallet after unique constraint collision');
              walletId = wallet.id;
            } else {
              throw insertError;
            }
          } else {
            walletId = newWallet.id;
            wallet = newWallet;
          }
        } else {
          walletId = wallet.id;
        }

        // Atomically insert the ledger entry first to guarantee idempotency
        const { error: ledgerError } = await supabase.from('sms_credit_ledger').insert({
          wallet_id: walletId,
          event_id,
          transaction_type: 'purchase',
          credits: creditCount,
          stripe_payment_intent_id: session.payment_intent
        });

        if (ledgerError) {
          if (ledgerError.code === '23505' || ledgerError.message.includes('duplicate key')) {
            console.log(`[Webhook] Duplicate SMS ledger insert caught for payment intent: ${session.payment_intent}`);
            return res.json({ received: true });
          }
          throw ledgerError;
        }

        // Atomically increment wallet credits via database RPC (prevents race conditions)
        const { error: walletUpdateError } = await supabase
          .rpc('increment_sms_credits', { p_event_id: event_id, p_credit_amount: creditCount });

        if (walletUpdateError) throw walletUpdateError;

        // Audit log
        await supabase.from('activity_logs').insert({
          event_id,
          action: 'sms_credits_purchased',
          entity_type: 'sms_wallet',
          metadata: { credit_count: creditCount }
        });
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

  try {
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

    return res.status(200).json({
      success: true,
      message: 'Event manually approved and activated.',
      paymentId: data.payment_id
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
  const { pricingTiers, smsRateCentsPerCredit, smsMarkupPercentage, platformCommissionPct } = req.body;

  const updates = {};
  if (pricingTiers) updates.pricing_tiers = pricingTiers;
  if (smsRateCentsPerCredit !== undefined) updates.sms_rate_cents_per_credit = smsRateCentsPerCredit;
  if (smsMarkupPercentage !== undefined) updates.sms_markup_percentage = smsMarkupPercentage;
  if (platformCommissionPct !== undefined) updates.platform_commission_pct = platformCommissionPct;
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

module.exports = {
  createCheckoutSession,
  purchaseSMSCredits,
  stripeWebhook,
  manualCashApproval,
  updatePricingConfig,
  getPricingConfig
};
