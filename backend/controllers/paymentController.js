const crypto = require('crypto');
const { stripeEnabled, smsEnabled } = require('../config/features');

/**
 * Lazy, boot-safe Stripe client. We MUST NOT construct Stripe (or throw) at module
 * load: before go-live there may be no key, and card payments are disabled via
 * PAYMENTS_STRIPE_ENABLED — the app still runs fully on the manual-payment path.
 * Returns null when no key is configured.
 */
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = require('stripe')(key);
  return _stripe;
}

/** Standard 503 when card payments are off — the UI falls back to manual payment. */
const stripeDisabledResponse = (res) => res.status(503).json({
  success: false,
  error: 'STRIPE_DISABLED',
  message: 'Card payments are temporarily unavailable. Please use manual / bank transfer.',
});

const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { sendEmailViaBrevo } = require('../utils/notificationService');
const { getCashPaymentApprovedTemplate } = require('../utils/emailTemplates');
const { computeSmsChargeCents } = require('../utils/pricing');
const { fulfillCheckoutSession, handleChargeRefunded, handleDisputeEvent } = require('../services/paymentFulfillment');
const { getPlatformConfig, invalidate: invalidateConfigCache } = require('../utils/configCache');

// FRONTEND_URL may be a comma-separated allowlist (see app.js CORS).
const allowedReturnOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

/**
 * Resolves the frontend origin to send the user back to after Stripe Checkout.
 *
 * Returning to a DIFFERENT origin than the one the user started on logs them out:
 * `localStorage` (org_id) and the auth cookie are both per-origin, so they'd land
 * on the login page and on the wrong section. We therefore echo back the exact
 * origin the checkout request came from (validated against the FRONTEND_URL
 * allowlist), falling back to the first configured origin only if we can't match.
 */
const resolveReturnBase = (req) => {
  const fromOrigin = (req.headers.origin || '').trim().replace(/\/$/, '');
  if (fromOrigin && allowedReturnOrigins.includes(fromOrigin)) return fromOrigin;

  // Fall back to the Referer's origin (e.g. some browsers omit Origin on same-site).
  if (req.headers.referer) {
    try {
      const u = new URL(req.headers.referer);
      const refOrigin = `${u.protocol}//${u.host}`;
      if (allowedReturnOrigins.includes(refOrigin)) return refOrigin;
    } catch { /* malformed referer — ignore */ }
  }

  return allowedReturnOrigins[0] || 'http://localhost:3000';
};

/**
 * Best-effort write for columns introduced by migration 20260616300000
 * (manual_method, payer_reference, verified_by, verified_at, admin_note,
 * manual_payment_methods). If that migration hasn't been applied yet the column
 * won't exist and a normal update would throw — which previously broke the whole
 * payment flow. Here we swallow the error so the core flow always succeeds; apply
 * the migration to actually persist this metadata.
 */
const setOptionalColumns = async (table, match, fields) => {
  // Drop undefined/empty so we never send an empty update.
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  if (Object.keys(clean).length === 0) return;
  try {
    const { error } = await supabase.from(table).update(clean).match(match);
    if (error) logger.warn(`[optional-columns] '${table}' update skipped (run migration 20260616300000): ${error.message}`);
  } catch (e) {
    logger.warn(`[optional-columns] '${table}' update skipped (run migration 20260616300000): ${e.message}`);
  }
};

/**
 * Creates a Stripe Checkout Session for event payment fees.
 * POST /api/v1/payments/create-checkout
 */
const createCheckoutSession = async (req, res, next) => {
  // Card payments off (pre-live / no live keys) → tell the client to use manual.
  if (!stripeEnabled()) return stripeDisabledResponse(res);
  const stripe = getStripe();

  // SECURITY: the event is authorized by verifyEventOwner on the PATH param, so
  // the operation MUST key off the same identifier. Trusting req.body.eventId
  // (which ownership was never checked against) is an IDOR.
  const eventId = req.params.eventId;
  const { tierName } = req.body;

  // Where to send the browser back to after Checkout. Restricted to in-app dashboard
  // paths so a caller can't turn it into an open redirect. Defaults to the creation
  // wizard (the original flow); the Events section passes '/dashboard' so paying for
  // an already-created event returns there instead of the wizard.
  const rawReturn = (req.body.returnPath || '').toString();
  const returnPath = /^\/dashboard(?:\/[A-Za-z0-9_-]+)*$/.test(rawReturn) ? rawReturn : '/dashboard/create-event';

  if (!eventId || !tierName) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'eventId and tierName are required.'
    });
  }

  try {
    // 1. Fetch pricing tiers from super_admin_config (cached singleton)
    let adminConfig;
    try {
      adminConfig = await getPlatformConfig();
    } catch {
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
      .select('org_id, is_paid, tier_name, organizations(stripe_customer_id, email, name)')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'Event not found.'
      });
    }

    // PRICING-1: an upgrade charges only the DIFFERENCE from the already-paid plan,
    // never the new tier's full price again — the organizer already paid for the
    // base tier once. `events.tier_name` only changes when a checkout/manual
    // payment is actually fulfilled, so it's still the pre-upgrade tier here even
    // if an earlier upgrade attempt is sitting pending.
    let previousTier = null;
    if (eventData.is_paid && eventData.tier_name) {
      previousTier = adminConfig.pricing_tiers.find(t => t.name.toLowerCase() === eventData.tier_name.toLowerCase()) || null;
    }
    const isUpgrade = !!previousTier;
    if (isUpgrade && tier.price_cents <= previousTier.price_cents) {
      return res.status(400).json({
        success: false,
        error: 'NOT_AN_UPGRADE',
        message: `'${tier.name}' is not more expensive than your current plan ('${previousTier.name}'). Choose a higher tier to upgrade.`
      });
    }

    // Per-tier event cap: a tier's max_events (0/null = unlimited) limits how many of
    // this org's OTHER paid events may already be on that same tier.
    if (Number(tier.max_events) > 0) {
      const { count } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', eventData.org_id)
        .eq('is_paid', true)
        .ilike('tier_name', tier.name)
        .neq('id', eventId);
      if ((count || 0) >= tier.max_events) {
        return res.status(409).json({
          success: false,
          error: 'TIER_LIMIT_REACHED',
          message: `You've reached the maximum number of events (${tier.max_events}) allowed on the '${tier.name}' plan.`
        });
      }
    }

    const chargeAmountCents = isUpgrade ? (tier.price_cents - previousTier.price_cents) : tier.price_cents;

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
          unit_amount: chargeAmountCents,
          product_data: {
            name: isUpgrade ? `Fancy RSVP - Upgrade to ${tier.name} License` : `Fancy RSVP - ${tier.name} License`,
            description: isUpgrade
              ? `License for ${tier.max_guests ? `up to ${tier.max_guests}` : 'unlimited'} guests. Full price $${(tier.price_cents / 100).toFixed(2)}, credited $${(previousTier.price_cents / 100).toFixed(2)} already paid for ${previousTier.name}.`
              : `License for ${tier.max_guests ? `up to ${tier.max_guests}` : 'unlimited'} guests`
          }
        },
        quantity: 1
      }],
      metadata: {
        event_id: eventId,
        tier_name: tier.name,
        tier_max_guests: tier.max_guests != null ? String(tier.max_guests) : '',
        tier_remove_watermark: tier.remove_watermark ? '1' : '0',
        type: 'event_fee',
        is_upgrade: isUpgrade ? '1' : '0',
        previous_tier_name: isUpgrade ? previousTier.name : '',
        previous_amount_cents: isUpgrade ? String(previousTier.price_cents) : '',
      },
      // Return the user to the WIZARD (not the dashboard) at the payment step, and
      // carry session_id so the frontend can synchronously verify + show success
      // even if the async webhook hasn't landed yet.
      success_url: `${resolveReturnBase(req)}${returnPath}?payment=success&event=${eventId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${resolveReturnBase(req)}${returnPath}?payment=cancelled&event=${eventId}`
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
  // Credit top-ups are bought via Stripe Checkout — gated with card payments.
  if (!stripeEnabled()) return stripeDisabledResponse(res);
  const stripe = getStripe();

  // SECURITY: authorize and operate on the same (path) identifier — see note in
  // createCheckoutSession. req.body.eventId is ignored.
  const eventId = req.params.eventId;
  // Coerce + integer-check up front. A non-numeric body value (e.g. "abc") used to
  // slip past `creditCount < 50 || creditCount > 50000` (NaN comparisons are false),
  // then flowed into computeSmsChargeCents → NaN → Stripe 500. Validate it's a whole
  // number in range BEFORE any pricing/Stripe work.
  const creditCount = Number(req.body.creditCount);

  if (!eventId || !Number.isInteger(creditCount) || creditCount < 50 || creditCount > 50000) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'eventId and creditCount (a whole number, minimum 50, maximum 50000) are required.'
    });
  }

  try {
    // 1. Fetch SMS rates (cached singleton)
    let config;
    try {
      config = await getPlatformConfig();
    } catch {
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
      success_url: `${resolveReturnBase(req)}/dashboard/campaigns?purchase=success&event=${eventId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${resolveReturnBase(req)}/dashboard/campaigns?purchase=cancelled&event=${eventId}`
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
  // Card payments off → no Stripe events are expected; acknowledge and ignore so a
  // stray delivery can never error. Re-enabling is just a flag + key flip.
  if (!stripeEnabled()) return res.json({ received: true, skipped: 'stripe_disabled' });
  const stripe = getStripe();

  const sig = req.headers['stripe-signature'];
  let stripeEvent;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not configured!');
    return res.status(500).json({ success: false, error: 'Webhook secret is not configured.' });
  }

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      webhookSecret
    );
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // All write logic lives in the shared, idempotent fulfillment service so the
    // webhook and the synchronous /verify endpoint can never diverge.
    if (stripeEvent.type === 'checkout.session.completed') {
      await fulfillCheckoutSession(stripeEvent.data.object);
    } else if (stripeEvent.type === 'charge.refunded') {
      await handleChargeRefunded(stripeEvent.data.object);
    } else if (stripeEvent.type === 'charge.dispute.created' || stripeEvent.type === 'charge.dispute.updated' || stripeEvent.type === 'charge.dispute.closed') {
      await handleDisputeEvent(stripeEvent.data.object);
    }
  } catch (processingErr) {
    // Log the error but ALWAYS return 200 to Stripe — never let processing
    // errors cause 500s which trigger Stripe's retry storm.
    logger.error({ err: processingErr, eventType: stripeEvent.type }, 'Stripe webhook processing error');
  }

  return res.json({ received: true });
};

/**
 * Synchronously confirms a Checkout Session on the browser redirect and applies
 * the same idempotent fulfillment as the webhook. This makes the success UX
 * independent of webhook timing/delivery: whichever path runs first wins, the
 * other becomes a safe no-op.
 * GET /api/v1/payments/verify?session_id=cs_...
 */
const verifyCheckoutSession = async (req, res, next) => {
  if (!stripeEnabled()) return stripeDisabledResponse(res);
  const stripe = getStripe();

  const sessionId = req.query.session_id;
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'A valid session_id is required.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Defense-in-depth: a valid session_id is effectively a bearer token (it lives
    // in the user's own redirect URL), but we still confirm the authenticated
    // caller owns the event this session belongs to — so a leaked/guessed id can't
    // be used to probe another org's payment, or trigger fulfillment on their event.
    const sessionEventId = session.metadata?.event_id;
    if (!req.user?.isSuperAdmin) {
      // A non-admin must own a concrete event tied to this session. A session with
      // no event_id metadata can't be ownership-checked at all — so rather than
      // silently SKIPPING the guard (which would let any logged-in organizer
      // fulfill/probe an event-less session), we reject outright. Only a super
      // admin may verify a session whose event can't be resolved.
      if (!sessionEventId) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to verify this payment.' });
      }
      const { data: ownerRow } = await supabase
        .from('events')
        .select('organizations(owner_user_id)')
        .eq('id', sessionEventId)
        .single();
      const ownerId = ownerRow?.organizations?.owner_user_id;
      if (ownerId !== req.user?.id) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to verify this payment.' });
      }
    }

    if (session.payment_status !== 'paid') {
      return res.status(200).json({
        success: true,
        paid: false,
        status: session.payment_status,
        type: session.metadata?.type || null,
        eventId: session.metadata?.event_id || null,
      });
    }

    const result = await fulfillCheckoutSession(session);

    return res.status(200).json({
      success: true,
      paid: true,
      type: result.type,
      eventId: result.eventId,
      alreadyProcessed: result.alreadyProcessed,
      amountCents: session.amount_total,
      creditCount: session.metadata?.credit_count ? parseInt(session.metadata.credit_count, 10) : undefined,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Super Admin manual approval of event payments bypass.
 * POST /api/v1/admin/manual-approve
 */
const manualCashApproval = async (req, res, next) => {
  const { eventId } = req.body;
  // amountCents is persisted and charged against — guard it instead of only
  // checking it's defined. Must be a whole, non-negative number of cents within a
  // sane ceiling ($1,000,000) so a malformed/fat-fingered value can't be stored.
  const amountCents = Number(req.body.amountCents);
  const MAX_CENTS = 100_000_000;

  if (!eventId || !Number.isInteger(amountCents) || amountCents < 0 || amountCents > MAX_CENTS) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'eventId and a whole, non-negative amountCents (in cents, up to 100000000) are required.'
    });
  }

  try {
    // 1. Check if there is an existing pending cash_manual payment record
    const { data: pendingPayment, error: findError } = await supabase
      .from('event_payments')
      .select('id, amount_cents, stripe_checkout_session_id, reference_number, tier_name, tier_max_guests, tier_remove_watermark')
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
        .eq('status', 'pending')
        .select()
        .maybeSingle();

      if (updateErr) throw updateErr;
      if (!updatedPayment) {
        // Another concurrent request already approved this payment between
        // our lookup and this update — don't double-process or overwrite it.
        return res.status(409).json({
          success: false,
          error: 'ALREADY_PROCESSED',
          message: 'This cash payment has already been approved.'
        });
      }
      paymentId = updatedPayment.id;
      refNumber = updatedPayment.reference_number || updatedPayment.stripe_checkout_session_id;

      // Activate the event + persist the purchased tier ("current plan") snapshotted
      // on the pending payment, so the dashboard/wizard show the right plan.
      const { error: eventUpdateErr } = await supabase
        .from('events')
        .update({
          is_paid: true,
          status: 'active',
          tier_name: pendingPayment[0].tier_name || null,
          tier_max_guests: pendingPayment[0].tier_max_guests ?? null,
          tier_remove_watermark: !!pendingPayment[0].tier_remove_watermark,
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
  const { pricingTiers, smsRateCentsPerCredit, smsMarkupPercentage, platformCommissionPct, manualPaymentMethods, landingStats } = req.body;

  const updates = {};
  if (pricingTiers !== undefined) {
    if (!Array.isArray(pricingTiers)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'pricingTiers must be an array.' });
    }
    if (pricingTiers.length > 20) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Maximum 20 pricing tiers allowed.' });
    }
    const { validateFeatureKeys } = require('../config/featureRegistry');
    updates.pricing_tiers = pricingTiers
      .filter(t => t && (t.name || '').toString().trim())
      .map(t => {
        const features = Array.isArray(t.features) ? t.features : [];
        const { valid } = validateFeatureKeys(features);
        return {
          name: String(t.name).trim(),
          price_cents: Number(t.price_cents) || 0,
          max_guests: Number(t.max_guests) || 0,
          max_events: Number(t.max_events) || 0,
          remove_watermark: !!t.remove_watermark,
          recommended: !!t.recommended,
          is_custom: !!t.is_custom,
          features: valid,
          price_label: (t.price_label || '').toString().trim(),
          cta_label: (t.cta_label || '').toString().trim(),
          description: (t.description || '').toString().trim(),
        };
      });
  }
  if (smsRateCentsPerCredit !== undefined) updates.sms_rate_cents_per_credit = smsRateCentsPerCredit;
  if (smsMarkupPercentage !== undefined) updates.sms_markup_percentage = smsMarkupPercentage;
  if (platformCommissionPct !== undefined) updates.platform_commission_pct = platformCommissionPct;
  if (landingStats !== undefined) {
    if (!Array.isArray(landingStats)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'landingStats must be an array.' });
    }
    // Normalize each stat to the shape the landing page's counter animation expects.
    updates.landing_stats = landingStats
      .filter(s => s && (s.label || '').trim())
      .map((s) => ({
        label: String(s.label).trim(),
        target: Number(s.target) || 0,
        suffix: s.suffix || '',
        decimals: Number(s.decimals) || 0,
      }));
  }
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

    // Pricing changed — drop the cached config so reads reflect it immediately.
    invalidateConfigCache();

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
      config,
      // Tells the dashboard which paid integrations are live right now, so the
      // payment step can render manual-first and hide card / SMS-purchase CTAs.
      features: { stripeEnabled: stripeEnabled(), smsEnabled: smsEnabled() },
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
    // 1. Resolve the selected tier FIRST. The manual record must reflect the plan the
    //    organizer actually picked — even when they change it after a first attempt.
    let adminConfig;
    try {
      adminConfig = await getPlatformConfig();
    } catch {
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
    // Contact-Sales tiers have no fixed price and can't be paid offline either.
    if (tier.is_custom === true) {
      return res.status(400).json({
        success: false,
        error: 'CUSTOM_TIER',
        message: `The '${tier.name}' plan is custom-priced — please contact sales to activate it.`
      });
    }
    const tierMaxGuests = Number.isFinite(tier.max_guests) ? tier.max_guests : null;

    // PRICING-1: an upgrade charges only the DIFFERENCE from the already-paid plan
    // — mirrors createCheckoutSession's logic exactly so card and manual payment
    // never disagree on what an upgrade costs.
    const { data: eventRow } = await supabase
      .from('events')
      .select('is_paid, tier_name, org_id')
      .eq('id', eventId)
      .single();
    let previousTier = null;
    if (eventRow?.is_paid && eventRow.tier_name) {
      previousTier = adminConfig.pricing_tiers.find(t => t.name.toLowerCase() === eventRow.tier_name.toLowerCase()) || null;
    }
    const isUpgrade = !!previousTier;
    if (isUpgrade && tier.price_cents <= previousTier.price_cents) {
      return res.status(400).json({
        success: false,
        error: 'NOT_AN_UPGRADE',
        message: `'${tier.name}' is not more expensive than your current plan ('${previousTier.name}'). Choose a higher tier to upgrade.`
      });
    }

    // Per-tier event cap — mirrors the same check in createCheckoutSession.
    if (Number(tier.max_events) > 0 && eventRow?.org_id) {
      const { count } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', eventRow.org_id)
        .eq('is_paid', true)
        .ilike('tier_name', tier.name)
        .neq('id', eventId);
      if ((count || 0) >= tier.max_events) {
        return res.status(409).json({
          success: false,
          error: 'TIER_LIMIT_REACHED',
          message: `You've reached the maximum number of events (${tier.max_events}) allowed on the '${tier.name}' plan.`
        });
      }
    }

    const chargeAmountCents = isUpgrade ? (tier.price_cents - previousTier.price_cents) : tier.price_cents;

    // 2. If a pending cash payment already exists, REFRESH it to the currently
    //    selected plan (price + tier) instead of blindly returning the stale one —
    //    otherwise switching plans before approval would silently have no effect.
    const { data: existingPending } = await supabase
      .from('event_payments')
      .select('id, reference_number')
      .eq('event_id', eventId)
      .eq('payment_method', 'cash_manual')
      .eq('status', 'pending')
      .limit(1);

    if (existingPending && existingPending.length > 0) {
      const patch = {
        amount_cents: chargeAmountCents,
        tier_name: tier.name,
        tier_max_guests: tierMaxGuests,
        tier_remove_watermark: !!tier.remove_watermark,
      };
      if (methodLabel !== undefined) patch.manual_method = (methodLabel || '').toString().slice(0, 200);
      if (payerReference !== undefined) patch.payer_reference = (payerReference || '').toString().slice(0, 300);
      const { data: updated } = await supabase
        .from('event_payments')
        .update(patch)
        .eq('id', existingPending[0].id)
        .select()
        .single();
      return res.status(200).json({
        success: true,
        message: 'Pending cash payment updated to the selected plan.',
        referenceNumber: existingPending[0].reference_number,
        payment: updated || existingPending[0]
      });
    }

    // 3. Generate a random reference number
    const refChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let refCode = 'CASH-';
    for (let i = 0; i < 6; i++) {
      refCode += refChars.charAt(crypto.randomInt(refChars.length));
    }

    // 4. Insert pending cash payment. Snapshot the tier so that when a Super Admin
    // later approves it, the event's "current plan" reflects what was actually paid.
    const { data, error } = await supabase
      .from('event_payments')
      .insert({
        event_id: eventId,
        reference_number: refCode,
        amount_cents: chargeAmountCents,
        status: 'pending',
        payment_method: 'cash_manual',
        currency: 'usd',
        tier_name: tier.name,
        tier_max_guests: Number.isFinite(tier.max_guests) ? tier.max_guests : null,
        tier_remove_watermark: !!tier.remove_watermark,
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
      metadata: { ref_code: refCode, tier_name: tier.name, is_upgrade: isUpgrade, previous_tier_name: previousTier?.name || null }
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

/**
 * Public, unauthenticated pricing for the marketing/landing page.
 *
 * Single source of truth: the same `super_admin_config.pricing_tiers` that the
 * event-creation payment step reads and that checkout actually charges against.
 * This endpoint exposes ONLY the customer-safe presentation fields — it never
 * leaks manual payment account details, SMS carrier rates, or commission.
 * GET /api/v1/payments/public-pricing
 */
const getPublicPricing = async (req, res, next) => {
  try {
    const config = await getPlatformConfig();
    const { getFeatureByKey } = require('../config/featureRegistry');
    const tiers = Array.isArray(config?.pricing_tiers) ? config.pricing_tiers : [];

    const publicTiers = tiers.map((t) => {
      // Convert feature keys to human-readable labels for the public page.
      const featureLabels = Array.isArray(t.features)
        ? t.features
            .map(key => { const feat = getFeatureByKey(key); return feat ? feat.label : null; })
            .filter(Boolean)
        : [];
      return {
        name: String(t.name || ''),
        price_cents: Number(t.price_cents) || 0,
        max_guests: Number(t.max_guests) || 0,
        features: featureLabels,
        recommended: t.recommended === true,
        is_custom: t.is_custom === true,
        price_label: (t.price_label || '').toString().trim(),
        cta_label: (t.cta_label || '').toString().trim(),
        description: (t.description || '').toString().trim(),
      };
    });

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.json({
      success: true,
      tiers: publicTiers,
      features: { stripeEnabled: stripeEnabled(), smsEnabled: smsEnabled() },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCheckoutSession,
  purchaseSMSCredits,
  stripeWebhook,
  verifyCheckoutSession,
  manualCashApproval,
  updatePricingConfig,
  getPricingConfig,
  getPublicPricing,
  initiateManualPayment,
  getPendingPayments
};

