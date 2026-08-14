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
const { computeSmsChargeCents, describeSmsCharge, volumeDiscountsFromConfig } = require('../utils/pricing');
const { sanitizeAllowanceRequest, estimateAllowance } = require('../utils/smsEstimator');
const { normalizeSmsPricing, describeSmsPricingAdjustments, DEFAULT_SMS_PRICING, LIMITS: SMS_PRICING_LIMITS } = require('../config/smsPricing');
const { SMS_MESSAGE_TYPES } = require('../config/smsMessageTypes');
const { PLATFORM_FEATURES, FEATURE_NOTES } = require('../config/featureRegistry');
const { SMS_FEATURE_KEY } = require('../middleware/smsAddonGate');

/**
 * Refuse to SELL an SMS allowance on a plan that does not include texting.
 *
 * Returns null when the request is fine, or `{ status, body }` to send back.
 *
 * ── Why this has to exist on the payment path, not just the send path ──
 *
 * The send gate grandfathers any event with `sms_addon_purchased_at` set, so
 * that an admin reorganising plan contents cannot strand a balance somebody
 * paid for. That protection is right, and it is also a loophole if the checkout
 * will sell an allowance to anyone: buy the cheapest plan, add messages in the
 * same session, and the grandfather clause permanently exempts the event from
 * the tier restriction. The plan gate would then be worth exactly the price of
 * the add-on.
 *
 * Refused rather than silently dropped from the basket: quietly charging for
 * the plan while ignoring the messages the organizer asked for produces an
 * event that cannot send and a customer who believes they paid for one that can.
 */
function assertTierAllowsSmsAddon(tier, requestedSegments) {
  if (!requestedSegments) return null;
  const features = Array.isArray(tier?.features) ? tier.features : [];
  if (features.includes(SMS_FEATURE_KEY)) return null;
  return {
    status: 400,
    body: {
      success: false,
      error: 'SMS_NOT_IN_TIER',
      message: `The '${tier?.name || 'selected'}' plan does not include text messaging. Choose a plan that includes it, or continue without the messaging add-on.`,
      upgrade_action: 'upgrade_plan',
    },
  };
}
const { fulfillCheckoutSession, handleChargeRefunded, handleDisputeEvent } = require('../services/paymentFulfillment');
const { getPlatformConfig, invalidate: invalidateConfigCache } = require('../utils/configCache');
const {
  reserveReferralCredit,
  captureReferralHold,
  releaseReferralHold,
  spendReferralCredit,
  grantReferralRewardIfEligible,
  CARD_HOLD_TTL_MINUTES,
  MANUAL_HOLD_TTL_MINUTES,
} = require('../services/referralService');
const { redeemPromoCodeForEvent } = require('../services/promoCodeService');

const { getAllowedOrigins } = require('../utils/publicUrl');

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
  const allowedReturnOrigins = getAllowedOrigins();
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
/**
 * Build a Stripe Checkout session containing ONLY the SMS add-on.
 *
 * Used on the free-tier path, where the licence itself costs nothing and so no
 * session would otherwise be created. Carries `type: 'sms_credits'` so it lands in
 * fulfillCheckoutSession's existing, already-idempotent SMS branch — which credits
 * the wallet through record_sms_purchase and flips events.sms_addon_purchased_at.
 *
 * Returns { url } or { error: true, status, body } for the caller to forward.
 */
async function createSmsAddonOnlyCheckout({
  req, stripe, eventId, orgId, organization, adminConfig, segments, returnPath,
}) {
  const amountCents = computeSmsChargeCents({
    unitPriceCents: adminConfig.sms_rate_cents_per_credit,
    creditCount: segments,
    markupPct: adminConfig.sms_markup_percentage,
    volumeDiscounts: volumeDiscountsFromConfig(adminConfig),
  });

  if (amountCents <= 0) {
    return {
      error: true,
      status: 500,
      body: { success: false, error: 'CONFIG_ERROR', message: 'SMS pricing is not configured.' },
    };
  }

  let customerId = organization?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: organization?.email || 'customer@example.com',
      name: organization?.name || 'Event Organizer',
      metadata: { org_id: orgId },
    });
    customerId = customer.id;
    await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: amountCents,
        product_data: {
          name: `Fancy RSVP - SMS Messaging Add-on (${segments} messages)`,
          description: 'Unlocks text messaging for this event: RSVP confirmations, reminders, entry-pass links and custom campaigns.',
        },
      },
      quantity: 1,
    }],
    metadata: {
      event_id: eventId,
      type: 'sms_credits',
      credit_count: String(segments),
      // Distinguishes the first purchase (which unlocks the add-on) from a later
      // top-up, so fulfilment knows whether to stamp sms_addon_purchased_at.
      sms_addon_unlock: '1',
    },
    success_url: `${resolveReturnBase(req)}${returnPath}?payment=success&event=${eventId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${resolveReturnBase(req)}${returnPath}?payment=cancelled&event=${eventId}`,
  });

  return { url: session.url };
}

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

  // Optional SMS add-on, bought in the SAME checkout as the licence. Two line
  // items, one payment: the organizer decided about text messaging on the screen
  // where they chose their plan, so making them return later for a second
  // checkout — the old flow — dropped most of them before they ever arrived.
  // null means "no add-on requested"; a malformed or out-of-range value is
  // clamped rather than trusted (sanitizeAllowanceRequest). Re-clamped against
  // the admin's configured bounds once the platform config is loaded below —
  // this first pass only establishes whether an add-on was asked for at all.
  let smsAddonSegments = sanitizeAllowanceRequest(req.body.smsAddonSegments);
  // Re-clamped against the admin's configured bounds inside the try block below,
  // once getPlatformConfig has resolved.

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

    // Re-clamp the requested allowance against the admin's ACTUAL bounds, now
    // that they are known. The first pass used the shipped defaults, which would
    // let a request slip past a floor or ceiling the admin has since changed.
    if (smsAddonSegments) {
      smsAddonSegments = sanitizeAllowanceRequest(smsAddonSegments, adminConfig.sms_pricing_config);
    }

    const tier = adminConfig.pricing_tiers.find(t => t.name.toLowerCase() === tierName.toLowerCase());
    if (!tier) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TIER',
        message: `Pricing tier '${tierName}' not found.`
      });
    }
    // Contact-Sales tiers have no fixed price — same guard as initiateManualPayment
    // below. Without this, a client could call this endpoint directly with an
    // is_custom tier's name and either activate for free (if its placeholder
    // price_cents is 0) or get charged whatever placeholder price an admin left
    // on it, bypassing the sales-quote flow entirely.
    if (tier.is_custom === true) {
      return res.status(400).json({
        success: false,
        error: 'CUSTOM_TIER',
        message: `The '${tier.name}' plan is custom-priced — please contact sales to activate it.`
      });
    }

    // The plan has to carry texting before this request may sell any. Without
    // this the tier gate is decorative: a client posts a Starter tier plus an
    // SMS allowance, pays, and fulfilment stamps sms_addon_purchased_at — which
    // the send gate grandfathers, so the plan restriction is bought around for
    // the price of the add-on. See assertTierAllowsSmsAddon.
    {
      const smsGuard = assertTierAllowsSmsAddon(tier, smsAddonSegments);
      if (smsGuard) return res.status(smsGuard.status).json(smsGuard.body);
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

    // A genuinely free tier (price_cents <= 0, fresh purchase only — an upgrade
    // can never land here since NOT_AN_UPGRADE above already requires a strictly
    // higher price) skips Stripe entirely: activate the tier the same way
    // fulfillCheckoutSession does for a real payment, just with a $0 record.
    // Referral credit never applies here — there's nothing to redeem it against.
    if (!isUpgrade && chargeAmountCents <= 0) {
      const { data: updatedEvent, error: activateError } = await supabase
        .from('events')
        .update({
          is_paid: true,
          status: 'pending_review',
          tier_name: tier.name,
          tier_max_guests: Number.isFinite(tier.max_guests) ? tier.max_guests : null,
          tier_remove_watermark: !!tier.remove_watermark,
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId)
        .eq('is_paid', false)
        .select('id')
        .maybeSingle();
      if (activateError) throw activateError;

      if (updatedEvent) {
        await supabase.from('event_payments').insert({
          event_id: eventId,
          amount_cents: 0,
          currency: 'usd',
          status: 'completed',
          payment_method: 'free_tier',
          tier_name: tier.name,
          tier_max_guests: Number.isFinite(tier.max_guests) ? tier.max_guests : null,
          tier_remove_watermark: !!tier.remove_watermark,
          completed_at: new Date().toISOString(),
        });
        await supabase.from('activity_logs').insert({
          event_id: eventId,
          action: 'event_payment_completed',
          entity_type: 'event_payment',
          metadata: { amount_cents: 0, tier_name: tier.name, free_tier: true },
        });
      }

      // A free plan does not mean no SMS. The add-on is sold per event on ANY
      // tier, so a free-tier organizer who asked for messaging still needs a
      // checkout — just one containing only the add-on. Without this branch the
      // request would return "activated" here and their SMS choice would vanish
      // silently, which is the one outcome worse than charging them.
      if (smsAddonSegments) {
        const checkout = await createSmsAddonOnlyCheckout({
          req, stripe, eventId, orgId: eventData.org_id,
          organization: eventData.organizations, adminConfig,
          segments: smsAddonSegments, returnPath,
        });
        if (checkout.error) return res.status(checkout.status).json(checkout.body);
        return res.status(200).json({
          success: true,
          activated: true,
          checkoutUrl: checkout.url,
          message: `'${tier.name}' is a free plan — activated without payment. Complete checkout to add SMS messaging.`,
        });
      }

      return res.status(200).json({
        success: true,
        activated: true,
        message: `'${tier.name}' is a free plan — activated without payment.`,
      });
    }

    // REFERRAL-1: ATOMICALLY reserve the org's available referral credit against
    // this REAL charge (the free-tier shortcut above already returned, so
    // chargeAmountCents > 0 here). The reserve cuts a HOLD — the credit is
    // earmarked immediately (so a concurrent checkout can't apply it again) but
    // only actually SPENT when the payment is confirmed (capture), so an
    // abandoned checkout never wastes it — the hold just expires. The hold id
    // travels in the session metadata so fulfillCheckoutSession captures the
    // exact reservation quoted here.
    const { reservedCents: referralCreditAppliedCents, holdId: referralHoldId } = await reserveReferralCredit({
      orgId: eventData.org_id,
      eventId,
      requestedCents: chargeAmountCents,
      ttlMinutes: CARD_HOLD_TTL_MINUTES,
      reference: `checkout:${eventId}`,
    });
    const finalChargeCents = chargeAmountCents - referralCreditAppliedCents;

    // Credit fully covers the charge — activate instantly, same as the free-tier
    // shortcut above, but spend the credit synchronously (no Stripe round trip to
    // wait on) and label the payment honestly as referral-credit-funded.
    if (finalChargeCents <= 0) {
      // BIZ-2 (mirrors fulfillCheckoutSession): re-check the tier's max_events cap
      // authoritatively at the moment of activation, not just at the top of this
      // request. Unlike the card path this activation moves no money, so if the
      // cap is exceeded we can simply refuse — release the hold (so the credit
      // isn't stranded) and bail, rather than over-provisioning the org's plan.
      if (Number(tier.max_events) > 0) {
        const { count } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', eventData.org_id)
          .eq('is_paid', true)
          .ilike('tier_name', tier.name)
          .neq('id', eventId);
        if ((count || 0) >= tier.max_events) {
          await releaseReferralHold(referralHoldId);
          return res.status(409).json({
            success: false,
            error: 'TIER_LIMIT_REACHED',
            message: `You've reached the maximum number of events (${tier.max_events}) allowed on the '${tier.name}' plan.`
          });
        }
      }

      const eventUpdate = {
        is_paid: true,
        tier_name: tier.name,
        tier_max_guests: Number.isFinite(tier.max_guests) ? tier.max_guests : null,
        tier_remove_watermark: !!tier.remove_watermark,
        updated_at: new Date().toISOString(),
      };
      if (!isUpgrade) eventUpdate.status = 'pending_review';
      // Optimistic lock so a double-submit can't double-activate / double-spend:
      // a fresh purchase guards on is_paid=false; an upgrade (already paid) guards
      // on the CURRENT tier still being the pre-upgrade one, so the second run
      // matches 0 rows (its own first run already moved the tier forward).
      let eventQuery = supabase.from('events').update(eventUpdate).eq('id', eventId);
      if (!isUpgrade) eventQuery = eventQuery.eq('is_paid', false);
      else eventQuery = eventQuery.eq('tier_name', previousTier.name);
      const { data: updatedEvent, error: activateError } = await eventQuery.select('id').maybeSingle();
      if (activateError) throw activateError;

      if (updatedEvent) {
        const { data: creditPayment } = await supabase.from('event_payments').insert({
          event_id: eventId,
          amount_cents: 0,
          currency: 'usd',
          status: 'completed',
          payment_method: 'referral_credit',
          referral_credit_applied_cents: referralCreditAppliedCents,
          referral_hold_id: referralHoldId,
          tier_name: tier.name,
          tier_max_guests: Number.isFinite(tier.max_guests) ? tier.max_guests : null,
          tier_remove_watermark: !!tier.remove_watermark,
          completed_at: new Date().toISOString(),
        }).select('id').single();

        // Convert the hold into a real spend, atomically.
        const capture = await captureReferralHold({
          holdId: referralHoldId,
          paymentId: creditPayment?.id || null,
          note: `Applied to ${tier.name} activation`,
        });
        if (!capture.captured) {
          try {
            await supabase.from('activity_logs').insert({
              event_id: eventId,
              action: 'referral_credit_capture_failed',
              entity_type: 'event_payment',
              metadata: { amount_cents: referralCreditAppliedCents, payment_id: creditPayment?.id || null, hold_id: referralHoldId },
            });
          } catch { /* best-effort breadcrumb */ }
        }

        await supabase.from('activity_logs').insert({
          event_id: eventId,
          action: 'event_payment_completed',
          entity_type: 'event_payment',
          metadata: { amount_cents: 0, tier_name: tier.name, referral_credit_applied_cents: referralCreditAppliedCents },
        });

        // NB: a fully-credit-covered activation moves NO real money, so it does
        // NOT count as the referred org "becoming a paying customer" — the
        // referrer's reward only fires on a real (card/cash) payment. If this org
        // was itself referred, its reward is granted later, the first time it
        // actually pays for something (see fulfillCheckoutSession / manual
        // approval), guarded once by the earned-once index.
      } else {
        // Lost the optimistic-lock race (a concurrent request already activated
        // this event). Nothing was charged and nothing spent — hand the credit
        // back immediately instead of letting it sit held until it expires.
        await releaseReferralHold(referralHoldId);
      }

      return res.status(200).json({
        success: true,
        activated: true,
        message: 'Your referral credit fully covered this plan — activated without payment.',
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

    // The SMS add-on rides along as a SEPARATE line item rather than being folded
    // into the licence price. Stripe shows it on its own line, the receipt itemizes
    // it, and a refund of the licence does not silently claw back messages the
    // organizer already sent. Priced through the same computeSmsChargeCents used by
    // top-ups, so the admin's markup and volume discount apply identically whether
    // the segments are bought here or later.
    const smsAddonCents = smsAddonSegments
      ? computeSmsChargeCents({
          unitPriceCents: adminConfig.sms_rate_cents_per_credit,
          creditCount: smsAddonSegments,
          markupPct: adminConfig.sms_markup_percentage,
          volumeDiscounts: volumeDiscountsFromConfig(adminConfig),
        })
      : 0;

    const lineItems = [{
      price_data: {
        currency: 'usd',
        unit_amount: finalChargeCents,
        product_data: {
          name: isUpgrade ? `Fancy RSVP - Upgrade to ${tier.name} License` : `Fancy RSVP - ${tier.name} License`,
          description: isUpgrade
            ? `License for ${tier.max_guests ? `up to ${tier.max_guests}` : 'unlimited'} guests. Full price $${(tier.price_cents / 100).toFixed(2)}, credited $${(previousTier.price_cents / 100).toFixed(2)} already paid for ${previousTier.name}.`
            : `License for ${tier.max_guests ? `up to ${tier.max_guests}` : 'unlimited'} guests`
        }
      },
      quantity: 1
    }];

    if (smsAddonSegments && smsAddonCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: smsAddonCents,
          product_data: {
            name: `Fancy RSVP - SMS Messaging Add-on (${smsAddonSegments} messages)`,
            description: 'Unlocks text messaging for this event: RSVP confirmations, reminders, entry-pass links and custom campaigns.',
          }
        },
        quantity: 1
      });
    }

    // 3. Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: lineItems,
      metadata: {
        event_id: eventId,
        tier_name: tier.name,
        tier_max_guests: tier.max_guests != null ? String(tier.max_guests) : '',
        tier_remove_watermark: tier.remove_watermark ? '1' : '0',
        type: 'event_fee',
        is_upgrade: isUpgrade ? '1' : '0',
        previous_tier_name: isUpgrade ? previousTier.name : '',
        previous_amount_cents: isUpgrade ? String(previousTier.price_cents) : '',
        referral_credit_applied_cents: String(referralCreditAppliedCents),
        referral_hold_id: referralHoldId || '',
        // Read by fulfillCheckoutSession to credit the wallet and flip
        // events.sms_addon_purchased_at. Empty string = no add-on on this session.
        sms_addon_segments: smsAddonSegments ? String(smsAddonSegments) : '',
        sms_addon_amount_cents: smsAddonSegments ? String(smsAddonCents) : '',
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

  // Cheap sanity gate, BEFORE any I/O. A non-numeric body value ("abc", null →
  // NaN/0) used to slip past a bare `< 50 || > 50000` comparison — NaN comparisons
  // are always false — and flow into computeSmsChargeCents → NaN → a Stripe 500.
  // The exact purchase floor and ceiling are admin-configurable and enforced below
  // once the config is loaded; this only rejects what is not a purchase at all.
  if (!eventId || !Number.isInteger(creditCount) || creditCount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'eventId and a positive whole-number creditCount are required.'
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

    // The purchase floor and ceiling are admin-configurable, so they are read from
    // the config rather than compared against literals here — a dashboard change
    // to the minimum order must take effect without a deploy.
    const { bounds } = normalizeSmsPricing(config.sms_pricing_config);
    if (creditCount < bounds.min || creditCount > bounds.max) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: `creditCount must be between ${bounds.min} and ${bounds.max}.`,
      });
    }

    // Base carrier cost → admin markup → volume discount, rounded once at the end.
    const totalCents = computeSmsChargeCents({
      unitPriceCents: config.sms_rate_cents_per_credit,
      creditCount,
      markupPct: config.sms_markup_percentage,
      volumeDiscounts: volumeDiscountsFromConfig(config),
    });

    // 2. Fetch customer details
    const { data: eventData } = await supabase
      .from('events')
      .select('org_id, organizations(stripe_customer_id, email)')
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
    // Trimmed, because a whitespace-only value is truthy: it would sail past the
    // guard below and reach Stripe, which rejects it — turning a clear 400 into
    // an opaque 500 from the checkout call.
    const customerEmail = String(eventData.organizations.email || '').trim() || null;

    /**
     * NO STRIPE CUSTOMER IS NOT A REASON TO REFUSE THE SALE.
     *
     * This returned 400 "Please complete your first event payment before
     * purchasing SMS credits" whenever the organization had no
     * `stripe_customer_id` — which is set in exactly one place, the card
     * checkout. So every organizer who paid any other way could never buy
     * messages, permanently:
     *
     *   • a PROMO CODE event (promoCodeService sets is_paid + manual_override
     *     and never touches Stripe),
     *   • a BANK TRANSFER event approved by an admin,
     *   • an admin comp.
     *
     * All three are fully paid events. The message told them to complete a
     * payment they had already made, in a form the platform itself had offered.
     *
     * Stripe does not need a pre-existing customer to take a payment: given
     * `customer_email` it creates one and attaches it. Fulfillment is unaffected
     * because it keys on `session.metadata.event_id`, not on the customer
     * (services/paymentFulfillment.js) — so the credits land on the right event
     * either way.
     *
     * The only genuine blocker left is having no email to bill to, which cannot
     * happen for a real organization but is checked rather than assumed.
     */
    if (!customerId && !customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'NO_BILLING_CONTACT',
        message: 'This organization has no email address on file, so a receipt cannot be sent. Add one in your profile and try again.'
      });
    }

    // 3. Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // An existing customer when we have one; otherwise let Stripe create it
      // from the email. Passing both is an error, hence the spread.
      ...(customerId ? { customer: customerId } : { customer_email: customerEmail }),
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
 * SEC C3: In-memory deduplication of Stripe webhook event IDs. Stripe may retry
 * delivery, so we track recently-processed event IDs to skip duplicates before
 * they hit the (already-idempotent) fulfillment layer — avoiding unnecessary DB
 * work and log noise.
 */
const _processedWebhookEvents = new Map(); // eventId -> timestamp
const WEBHOOK_DEDUP_TTL_MS = 60 * 60 * 1000; // 1 hour
const WEBHOOK_DEDUP_MAX_SIZE = 10000;

function _cleanupWebhookDedup() {
  const cutoff = Date.now() - WEBHOOK_DEDUP_TTL_MS;
  for (const [id, ts] of _processedWebhookEvents) {
    if (ts < cutoff) _processedWebhookEvents.delete(id);
  }
}

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

  // SEC C3: Deduplicate webhook events — if we've already processed this event
  // ID, acknowledge it immediately without re-running fulfillment logic.
  if (_processedWebhookEvents.has(stripeEvent.id)) {
    return res.json({ received: true, deduplicated: true });
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

    // SEC C3: Record the event ID after successful processing.
    _processedWebhookEvents.set(stripeEvent.id, Date.now());
    // Periodic eviction to prevent unbounded growth.
    if (_processedWebhookEvents.size > WEBHOOK_DEDUP_MAX_SIZE) _cleanupWebhookDedup();
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
/**
 * Credit messages bought on an approved bank transfer.
 *
 * The card path gets this from the Stripe webhook; a manual payment has no
 * webhook, so approval is the moment the money is confirmed and the moment the
 * messages become owed. Reuses record_sms_purchase — the same atomic, idempotent
 * RPC the card path uses — keyed on the payment id so a double-approval cannot
 * double-credit.
 *
 * Best-effort and non-throwing: the licence has already been activated by the
 * time this runs, and throwing here would fail an approval that genuinely
 * succeeded. A failure is logged loudly, leaving a paid-but-uncredited state that
 * is visible and repairable rather than an approval the admin has to retry.
 */
async function creditManualSmsAddon(eventId, payment) {
  const segments = parseInt(payment?.sms_addon_segments, 10);
  if (!Number.isInteger(segments) || segments <= 0) return;

  try {
    const { data, error } = await supabase.rpc('record_sms_purchase', {
      p_event_id: eventId,
      p_credits: segments,
      // A manual payment has no payment intent; the payment row's own id is the
      // stable, unique key that makes this idempotent.
      p_payment_intent: `manual:${payment.id}`,
      p_amount_cents: null,
    });
    if (error) throw error;
    if (data && data.success === false) throw new Error(data.error || 'RECORD_SMS_PURCHASE_FAILED');

    const { error: unlockErr } = await supabase
      .from('events')
      .update({ sms_addon_purchased_at: new Date().toISOString() })
      .eq('id', eventId)
      .is('sms_addon_purchased_at', null);
    if (unlockErr) throw unlockErr;

    try {
      await supabase.rpc('reset_sms_balance_alerts', { p_event_id: eventId });
    } catch { /* the alert simply stays quiet until the migration lands */ }

    logger.info({ eventId, segments }, '[payments] SMS messages credited from approved manual payment');
  } catch (err) {
    logger.error({ err, eventId, segments },
      '[payments] manual payment approved but its SMS messages could NOT be credited — needs manual reconciliation.');
  }
}

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
    // Snapshot whether the event was already paid BEFORE this approval — an
    // upgrade (already-paid) never counts as the referred org's first
    // conversion, mirroring the isUpgrade guard in the card/checkout path.
    const { data: eventBefore } = await supabase.from('events').select('org_id, is_paid').eq('id', eventId).maybeSingle();
    const wasAlreadyPaid = !!eventBefore?.is_paid;

    // 1. Check if there is an existing pending cash_manual payment record
    const { data: pendingPayment, error: findError } = await supabase
      .from('event_payments')
      .select('id, amount_cents, stripe_checkout_session_id, reference_number, tier_name, tier_max_guests, tier_remove_watermark, referral_credit_applied_cents, referral_hold_id, sms_addon_segments')
      .eq('event_id', eventId)
      .eq('payment_method', 'cash_manual')
      .eq('status', 'pending')
      .limit(1);

    let paymentId;
    let refNumber;
    let tierName = null;

    if (pendingPayment && pendingPayment.length > 0) {
      tierName = pendingPayment[0].tier_name || null;
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

      // REFERRAL-1/2: capture the HOLD placed at initiateManualPayment (trust the
      // snapshot, not whatever cash figure the admin confirms — mirrors how
      // tier_name/tier_max_guests are already trusted from the same snapshot
      // above), then reward whoever referred this org on its first activation.
      const appliedCredit = pendingPayment[0].referral_credit_applied_cents || 0;
      const pendingHoldId = pendingPayment[0].referral_hold_id || null;
      if (appliedCredit > 0 && eventBefore?.org_id) {
        let ok = false;
        if (pendingHoldId) {
          const capture = await captureReferralHold({
            holdId: pendingHoldId,
            paymentId,
            note: `Applied to ${tierName || 'plan'} activation (manual payment)`,
          });
          ok = capture.captured;
        } else {
          // Legacy: a payment that went pending BEFORE the holds migration has a
          // credit snapshot but no hold to capture — write the spend directly.
          try {
            await spendReferralCredit({
              orgId: eventBefore.org_id,
              amountCents: appliedCredit,
              eventId,
              paymentId,
              note: `Applied to ${tierName || 'plan'} activation (manual payment)`,
            });
            ok = true;
          } catch (e) {
            logger.error({ err: e, eventId }, '[payments] legacy referral credit spend failed after manual approval');
          }
        }
        if (!ok) {
          try {
            await supabase.from('activity_logs').insert({
              event_id: eventId,
              actor_id: req.user.id,
              action: 'referral_credit_capture_failed',
              entity_type: 'event_payment',
              entity_id: paymentId,
              metadata: { amount_cents: appliedCredit, hold_id: pendingHoldId },
            });
          } catch { /* best-effort breadcrumb */ }
        }
      }
      if (!wasAlreadyPaid && eventBefore?.org_id) {
        grantReferralRewardIfEligible({ referredOrgId: eventBefore.org_id, eventId }).catch((e) =>
          logger.warn({ err: e, eventId }, '[payments] referral reward grant skipped')
        );
      }

      // Messages bought on this transfer. The organizer already paid for them —
      // amount_cents included their price — so approving the payment has to
      // deliver them, exactly as the Stripe webhook does for a card purchase.
      await creditManualSmsAddon(eventId, pendingPayment[0]);
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

      // This legacy fallback path has no referral-credit snapshot to spend (it's
      // only reachable when initiateManualPayment was never called for this
      // event), but the referral reward still applies on first activation.
      if (!wasAlreadyPaid && eventBefore?.org_id) {
        grantReferralRewardIfEligible({ referredOrgId: eventBefore.org_id, eventId }).catch((e) =>
          logger.warn({ err: e, eventId }, '[payments] referral reward grant skipped')
        );
      }
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

      const emailHtml = getCashPaymentApprovedTemplate(orgName, eventTitle, refNumber || `CASH-${paymentId.slice(0, 6).toUpperCase()}`, amountCents, tierName);
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
  const { pricingTiers, smsRateCentsPerCredit, smsMarkupPercentage, platformCommissionPct, manualPaymentMethods, landingStats, smsPricingConfig } = req.body;

  const updates = {};
  // Notes about anything the normalizer had to adjust, surfaced back to the admin
  // so a silently-clamped value is visible rather than a mystery next time they
  // open the form.
  let smsPricingNotes = [];
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
  // A bad value here breaks Stripe checkout for every organizer at once (a
  // negative/zero unit_amount is rejected by Stripe) rather than being caught
  // at config-save time — validate ranges up front instead of trusting the
  // admin form.
  if (smsRateCentsPerCredit !== undefined) {
    const rate = Number(smsRateCentsPerCredit);
    if (!Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'smsRateCentsPerCredit must be a non-negative number.' });
    }
    updates.sms_rate_cents_per_credit = rate;
  }
  if (smsMarkupPercentage !== undefined) {
    const markup = Number(smsMarkupPercentage);
    // markup <= -100 would make the (1 + markup/100) multiplier <= 0.
    if (!Number.isFinite(markup) || markup <= -100) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'smsMarkupPercentage must be a number greater than -100.' });
    }
    updates.sms_markup_percentage = markup;
  }
  // The rest of the SMS pricing model: volume-discount tiers, purchase bounds,
  // estimator assumptions and per-message-type frequencies.
  //
  // Normalized rather than rejected. Every field is clamped to a range outside
  // which the platform misbehaves rather than merely prices differently (a 100%
  // discount makes messages free; zero guests-per-party divides by nothing), so a
  // fat-fingered entry degrades to the nearest sane value instead of failing the
  // save — or worse, being stored and taking checkout down for every organizer at
  // once. What was adjusted comes back in the response.
  if (smsPricingConfig !== undefined) {
    if (!smsPricingConfig || typeof smsPricingConfig !== 'object' || Array.isArray(smsPricingConfig)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'smsPricingConfig must be an object.' });
    }
    const normalized = normalizeSmsPricing(smsPricingConfig);
    smsPricingNotes = describeSmsPricingAdjustments(smsPricingConfig, normalized);
    updates.sms_pricing_config = normalized;
  }

  if (platformCommissionPct !== undefined) {
    const commission = Number(platformCommissionPct);
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'platformCommissionPct must be a number between 0 and 100.' });
    }
    updates.platform_commission_pct = commission;
  }
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

    const saved = data?.[0] || data;

    return res.status(200).json({
      success: true,
      message: 'Platform configuration updated successfully.',
      config: saved,
      // The normalized model as STORED, so the form can re-render the values that
      // will actually be charged rather than the ones that were typed.
      smsPricing: normalizeSmsPricing(saved?.sms_pricing_config),
      smsPricingNotes,
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

    // Per-tier SMS allowance recommendations, so the payment step can answer
    // "how many messages will I actually need?" the moment a plan is picked —
    // with the arithmetic shown, not a bare number.
    //
    // Computed here rather than mirrored into the client because the estimate and
    // the price the organizer is ultimately charged must come from one definition;
    // a drifting client copy would quote a number checkout then contradicts. Both
    // scripts are returned because the same guest count costs ~2x in Arabic (UCS-2
    // caps a segment at 70 characters), and the event's language is chosen on a
    // different step from this one.
    const smsPricing = normalizeSmsPricing(config.sms_pricing_config);

    const smsEstimates = {};
    for (const tier of (config.pricing_tiers || [])) {
      if (!tier || !tier.name || tier.is_custom === true) continue;
      const maxGuests = Number.isFinite(tier.max_guests) ? tier.max_guests : null;
      smsEstimates[tier.name] = {
        latin: estimateAllowance({ maxGuests, script: 'latin', pricingConfig: config.sms_pricing_config }),
        arabic: estimateAllowance({ maxGuests, script: 'arabic', pricingConfig: config.sms_pricing_config }),
      };
    }

    return res.json({
      success: true,
      config,
      smsEstimates,
      // The normalized model, so the admin dashboard renders exactly the values
      // that will be applied — not the raw column, which may be partial.
      smsPricing,
      smsMessageTypes: SMS_MESSAGE_TYPES,
      // Human labels for the tier feature bullets.
      //
      // pricing_tiers stores raw registry KEYS (`add_guest_manual`,
      // `guest_export_excel`), and the payment step printed them verbatim — so a
      // customer choosing which plan to buy read a list of identifiers instead of
      // a list of features. The registry already holds the labels; this hands them
      // over rather than making the client keep its own copy.
      featureLabels: Object.fromEntries(PLATFORM_FEATURES.map((f) => [f.key, f.label])),
      /**
       * key -> "this costs extra" caption, for features a plan grants ACCESS to
       * rather than includes outright.
       *
       * Text messaging is the case this exists for. It is a real tier feature
       * again — an admin switches it on per plan — but switching it on grants
       * the right to buy messages, not the messages themselves. A bullet reading
       * plain "Text messaging" on a plan card is therefore a promise the product
       * does not keep, and the organizer discovers the difference at the moment
       * they try to send. The caveat travels with the feature so every surface
       * says it in the same words.
       */
      featureNotes: FEATURE_NOTES,
      // Keys that must NOT appear as a tier bullet — features superseded by
      // another mechanism, which grant nothing and would tell a customer they
      // already have something the card below is asking them to pay for.
      // `sms_campaigns` is deliberately NOT in this list any more: it grants
      // real access again, so it belongs on the card, with its note.
      hiddenTierFeatures: PLATFORM_FEATURES.filter((f) => f.supersededBy).map((f) => f.key),
      // Tells the dashboard which paid integrations are live right now, so the
      // payment step can render manual-first and hide card / SMS-purchase CTAs.
      features: { stripeEnabled: stripeEnabled(), smsEnabled: smsEnabled() },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Price a hypothetical SMS pricing model, without saving it.
 * POST /api/v1/payments/admin/sms-pricing-preview
 * body: { smsRateCentsPerCredit?, smsMarkupPercentage?, smsPricingConfig? }
 *
 * Exists so the super admin can see what a change DOES before committing it:
 * what an organizer pays at each volume, what the carrier costs us, and what
 * Fancy actually keeps.
 *
 * Computed on the SERVER, by the same describeSmsCharge the checkout uses, rather
 * than mirrored into the dashboard's JavaScript. A client-side copy of pricing
 * maths is the classic way an admin tunes a margin against numbers that quietly
 * stopped matching what customers are charged — and pricing is precisely where
 * that must not happen. Read-only and side-effect free; nothing is persisted.
 */
const previewSmsPricing = async (req, res, next) => {
  try {
    let config;
    try {
      config = await getPlatformConfig();
    } catch {
      return res.status(500).json({ success: false, error: 'CONFIG_ERROR', message: 'Could not retrieve pricing configuration.' });
    }

    // Unspecified fields fall back to what is currently live, so the admin can
    // preview one changed knob against the real model rather than against defaults.
    const rate = req.body.smsRateCentsPerCredit !== undefined
      ? Number(req.body.smsRateCentsPerCredit)
      : Number(config.sms_rate_cents_per_credit);
    const markup = req.body.smsMarkupPercentage !== undefined
      ? Number(req.body.smsMarkupPercentage)
      : Number(config.sms_markup_percentage);

    if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(markup) || markup <= -100) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Invalid rate or markup.' });
    }

    const pricing = normalizeSmsPricing(
      req.body.smsPricingConfig !== undefined ? req.body.smsPricingConfig : config.sms_pricing_config,
    );

    // Sample volumes: the floor, each discount threshold (and one segment below it,
    // so the cliff is visible), the recommended sizes for the real pricing tiers,
    // and the ceiling. Showing the point where a discount kicks in is the whole
    // reason to look at this table.
    const points = new Set([pricing.bounds.min, pricing.bounds.max]);
    for (const tier of pricing.volume_discounts) {
      points.add(tier.min_segments);
      if (tier.min_segments > pricing.bounds.min) points.add(tier.min_segments - 1);
    }
    for (const tier of (config.pricing_tiers || [])) {
      if (!tier || tier.is_custom === true) continue;
      const maxGuests = Number.isFinite(tier.max_guests) ? tier.max_guests : null;
      const est = estimateAllowance({ maxGuests, script: 'latin', pricingConfig: pricing });
      points.add(est.recommendedSegments);
    }

    const rows = [...points]
      .filter((n) => Number.isFinite(n) && n >= pricing.bounds.min && n <= pricing.bounds.max)
      .sort((a, b) => a - b)
      .map((segments) => describeSmsCharge({
        unitPriceCents: rate,
        creditCount: segments,
        markupPct: markup,
        volumeDiscounts: pricing.volume_discounts,
      }));

    // Per-tier recommendations in both scripts — the number a real customer sees
    // on the payment screen, and what it earns.
    const tierPreviews = (config.pricing_tiers || [])
      .filter((t) => t && t.name && t.is_custom !== true)
      .map((tier) => {
        const maxGuests = Number.isFinite(tier.max_guests) ? tier.max_guests : null;
        const build = (script) => {
          const est = estimateAllowance({ maxGuests, script, pricingConfig: pricing });
          return {
            recommendedSegments: est.recommendedSegments,
            estimatedParties: est.estimatedParties,
            ...describeSmsCharge({
              unitPriceCents: rate,
              creditCount: est.recommendedSegments,
              markupPct: markup,
              volumeDiscounts: pricing.volume_discounts,
            }),
          };
        };
        return {
          tierName: tier.name,
          maxGuests,
          tierPriceCents: tier.price_cents,
          latin: build('latin'),
          arabic: build('arabic'),
        };
      });

    return res.json({
      success: true,
      pricing,
      rate,
      markup,
      rows,
      tierPreviews,
      notes: describeSmsPricingAdjustments(req.body.smsPricingConfig, pricing),
      limits: SMS_PRICING_LIMITS,
      defaults: DEFAULT_SMS_PRICING,
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

  // Text messaging can be bought on a bank transfer too. It was card-only, which
  // meant that while card payments are switched off — leaving manual as the ONLY
  // path — nobody could buy it at all, and the amount an organizer was told to
  // transfer covered the licence alone.
  const smsAddonSegments = sanitizeAllowanceRequest(req.body.smsAddonSegments);

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

    // The plan has to carry texting before this request may sell any. Without
    // this the tier gate is decorative: a client posts a Starter tier plus an
    // SMS allowance, pays, and fulfilment stamps sms_addon_purchased_at — which
    // the send gate grandfathers, so the plan restriction is bought around for
    // the price of the add-on. See assertTierAllowsSmsAddon.
    {
      const smsGuard = assertTierAllowsSmsAddon(tier, smsAddonSegments);
      if (smsGuard) return res.status(smsGuard.status).json(smsGuard.body);
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

    const licenceCents = isUpgrade ? (tier.price_cents - previousTier.price_cents) : tier.price_cents;

    // Priced with the SAME function the card path and every top-up use, so the
    // figure on the transfer instructions is the figure the customer would have
    // paid by card.
    const smsAddonCents = smsAddonSegments
      ? computeSmsChargeCents({
          unitPriceCents: adminConfig.sms_rate_cents_per_credit,
          creditCount: smsAddonSegments,
          markupPct: adminConfig.sms_markup_percentage,
          volumeDiscounts: volumeDiscountsFromConfig(adminConfig),
        })
      : 0;

    // Referral credit stays applied to the LICENCE only, matching the card path,
    // where the add-on is a separate line item the credit never touches.
    const chargeAmountCents = licenceCents + smsAddonCents;

    // REFERRAL-1: same ATOMIC reservation as createCheckoutSession. The hold
    // earmarks the credit now (so it can't also be applied to a concurrent
    // checkout) and only becomes a real spend when a Super Admin approves this
    // payment (capture, in manualCashApproval) — or is handed back if the payment
    // is declined (release, in declineManualPayment). Re-running this for the same
    // event supersedes its own prior hold, so refreshing/switching plan is safe.
    const { reservedCents: referralCreditAppliedCents, holdId: referralHoldId } = await reserveReferralCredit({
      orgId: eventRow?.org_id,
      eventId,
      requestedCents: chargeAmountCents,
      ttlMinutes: MANUAL_HOLD_TTL_MINUTES,
      reference: `manual:${eventId}`,
    });
    const dueCents = Math.max(0, chargeAmountCents - referralCreditAppliedCents);

    // The credit covers the whole thing — there is nothing to transfer, so don't
    // send the organizer off to make a $0.00 bank transfer and then wait on a
    // Super Admin to "approve" it. Activate right here, exactly as the card path
    // does when finalCharge hits 0. (This is the ONLY reachable full-coverage path
    // while card payments are disabled, so it can't just live in createCheckoutSession.)
    if (dueCents <= 0 && referralCreditAppliedCents > 0) {
      // Authoritative max_events re-check — no money moves here, so if the cap is
      // exceeded we simply refuse and hand the credit back.
      if (Number(tier.max_events) > 0 && eventRow?.org_id) {
        const { count } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', eventRow.org_id)
          .eq('is_paid', true)
          .ilike('tier_name', tier.name)
          .neq('id', eventId);
        if ((count || 0) >= tier.max_events) {
          await releaseReferralHold(referralHoldId);
          return res.status(409).json({
            success: false,
            error: 'TIER_LIMIT_REACHED',
            message: `You've reached the maximum number of events (${tier.max_events}) allowed on the '${tier.name}' plan.`
          });
        }
      }

      const eventUpdate = {
        is_paid: true,
        tier_name: tier.name,
        tier_max_guests: tierMaxGuests,
        tier_remove_watermark: !!tier.remove_watermark,
        updated_at: new Date().toISOString(),
      };
      if (!isUpgrade) eventUpdate.status = 'pending_review';
      let activateQuery = supabase.from('events').update(eventUpdate).eq('id', eventId);
      if (!isUpgrade) activateQuery = activateQuery.eq('is_paid', false);
      else activateQuery = activateQuery.eq('tier_name', previousTier.name);
      const { data: activated, error: activateErr } = await activateQuery.select('id').maybeSingle();
      if (activateErr) throw activateErr;

      if (!activated) {
        // A concurrent request already activated this event — nothing spent.
        await releaseReferralHold(referralHoldId);
        return res.status(200).json({
          success: true,
          activated: true,
          message: 'This event is already activated.',
        });
      }

      const { data: creditPayment } = await supabase.from('event_payments').insert({
        event_id: eventId,
        amount_cents: 0,
        currency: 'usd',
        status: 'completed',
        payment_method: 'referral_credit',
        referral_credit_applied_cents: referralCreditAppliedCents,
        referral_hold_id: referralHoldId,
        tier_name: tier.name,
        tier_max_guests: tierMaxGuests,
        tier_remove_watermark: !!tier.remove_watermark,
        completed_at: new Date().toISOString(),
      }).select('id').single();

      const capture = await captureReferralHold({
        holdId: referralHoldId,
        paymentId: creditPayment?.id || null,
        note: `Applied to ${tier.name} activation`,
      });
      if (!capture.captured) {
        try {
          await supabase.from('activity_logs').insert({
            event_id: eventId,
            action: 'referral_credit_capture_failed',
            entity_type: 'event_payment',
            metadata: { amount_cents: referralCreditAppliedCents, payment_id: creditPayment?.id || null, hold_id: referralHoldId },
          });
        } catch { /* best-effort breadcrumb */ }
      }

      // Supersede any stale pending cash payment for this event — the organizer no
      // longer owes anything, so leaving it 'pending' would keep it sitting in the
      // Super Admin's approval queue forever.
      await supabase
        .from('event_payments')
        .update({ status: 'failed', admin_note: 'Superseded — fully covered by referral credit.' })
        .eq('event_id', eventId)
        .eq('payment_method', 'cash_manual')
        .eq('status', 'pending');

      await supabase.from('activity_logs').insert({
        event_id: eventId,
        actor_id: req.user.id,
        action: 'event_payment_completed',
        entity_type: 'event_payment',
        metadata: { amount_cents: 0, tier_name: tier.name, referral_credit_applied_cents: referralCreditAppliedCents },
      });

      // No reward granted: a $0 credit-funded activation moves no real money, so
      // it doesn't make this org a "paying customer" (see createCheckoutSession).
      return res.status(200).json({
        success: true,
        activated: true,
        message: 'Your referral credit fully covered this plan — activated without payment.',
      });
    }

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
        amount_cents: dueCents,
        referral_credit_applied_cents: referralCreditAppliedCents,
        referral_hold_id: referralHoldId,
        sms_addon_segments: smsAddonSegments,
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
        amount_cents: dueCents,
        referral_credit_applied_cents: referralCreditAppliedCents,
        referral_hold_id: referralHoldId,
        // amount_cents above already includes these messages' price; the count is
        // kept so approval knows what the transfer actually bought.
        sms_addon_segments: smsAddonSegments,
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

/**
 * POST /api/v1/payments/events/:eventId/redeem-promo-code
 *
 * Self-service alternative to both createCheckoutSession and
 * initiateManualPayment: an organizer with a valid super-admin-issued promo
 * code publishes their event immediately, free, with no Stripe/manual
 * payment and no wait for admin review. See promoCodeService for the
 * atomic validate-and-record step and the actual event activation.
 */
const redeemPromoCode = async (req, res, next) => {
  const { eventId } = req.params;
  const { code } = req.body || {};

  if (!code || !code.toString().trim()) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'A promo code is required.' });
  }

  try {
    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id, is_paid, status, org_id')
      .eq('id', eventId)
      .single();
    if (eventError || !eventRow) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }
    if (eventRow.is_paid && eventRow.status === 'active') {
      return res.status(409).json({ success: false, error: 'ALREADY_LIVE', message: 'This event is already live.' });
    }

    const result = await redeemPromoCodeForEvent({
      code: code.toString().trim(),
      eventId,
      orgId: eventRow.org_id,
      actorId: req.user?.id,
    });

    if (!result.ok) {
      const statusByError = {
        INVALID_CODE: 400,
        CODE_INACTIVE: 400,
        CODE_EXPIRED: 400,
        CODE_LIMIT_REACHED: 409,
        EVENT_ALREADY_REDEEMED: 409,
      };
      return res.status(statusByError[result.error] || 400).json({ success: false, error: result.error, message: result.message });
    }

    // A promo code fully comps the event, bypassing payment entirely — but this
    // event may already have referral credit HELD against it from an earlier
    // createCheckoutSession/initiateManualPayment attempt the organizer abandoned
    // in favor of the code. Left alone that hold sits 'active' (earmarked, and
    // therefore unavailable for ANY other event) until it self-expires — up to
    // MANUAL_HOLD_TTL_MINUTES (30 days). Release it now, same as every other
    // activation path in this codebase does when it supersedes a prior reservation.
    // Also supersede any stale pending cash_manual record so it stops sitting in
    // the Super Admin approval queue for a payment that will never arrive.
    try {
      await supabase
        .from('referral_credit_holds')
        .update({ status: 'released', updated_at: new Date().toISOString() })
        .eq('org_id', eventRow.org_id)
        .eq('event_id', eventId)
        .eq('status', 'active');
      await supabase
        .from('event_payments')
        .update({ status: 'failed', admin_note: 'Superseded — activated via promo code.' })
        .eq('event_id', eventId)
        .eq('payment_method', 'cash_manual')
        .eq('status', 'pending');
    } catch (e) {
      logger.warn({ err: e, eventId }, '[payments] referral-hold cleanup after promo code redemption failed (non-fatal)');
    }

    return res.json({ success: true, message: 'Promo code redeemed — your event is now live!', event: result.event });
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
  previewSmsPricing,
  getPublicPricing,
  initiateManualPayment,
  getPendingPayments,
  redeemPromoCode,
};

