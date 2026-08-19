const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { getPlatformConfig } = require('../utils/configCache');
const { resolveTier, tierSnapshot } = require('../utils/tierResolver');
const { sendEmailViaBrevo } = require('../utils/notificationService');
const { getEventLiveTemplate, getPublicBaseUrl } = require('../utils/emailTemplates');

// Same ambiguity-free alphabet as referral codes (generateUniqueReferralCode
// in referralService.js) — excludes 0/O and 1/I/L so a code read off a
// screen or spoken aloud at an event can't be mistyped into a different
// valid code.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function randomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS.charAt(crypto.randomInt(CODE_CHARS.length));
  return code;
}

/** Generates a promo code guaranteed unique among promo_codes.code. */
async function generateUniquePromoCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const { data, error } = await supabase.from('promo_codes').select('id').eq('code', code).limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return code;
  }
  return `${randomCode().slice(0, 4)}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

const ERROR_MESSAGES = {
  INVALID_CODE: 'That promo code is not valid.',
  CODE_INACTIVE: 'That promo code is no longer active.',
  CODE_EXPIRED: 'That promo code has expired.',
  CODE_LIMIT_REACHED: 'That promo code has reached its redemption limit.',
  EVENT_ALREADY_REDEEMED: 'This event has already redeemed a promo code.',
  // The code is valid, but the plan it grants has been deleted from the
  // pricing config. Activating anyway used to hand out an uncapped event.
  TIER_GONE: 'This code grants a plan that is no longer available. Please contact support.',
};

/**
 * Redeems a promo code for an event: validates + records the redemption
 * atomically via the redeem_promo_code RPC (advisory-lock + row-lock, same
 * pattern as reserve_referral_credit — closes the TOCTOU race where two
 * concurrent redemptions of a near-exhausted code could both succeed), then
 * — on success — comps the event exactly the way a super admin granting a
 * tier via updateEventAdmin does: is_paid, status: 'active', manual_override,
 * the tier's guest cap / watermark snapshot, and a comp_reason referencing
 * the code for the audit trail. Sends the same "event is live" email a real
 * admin approval would.
 *
 * Never throws for an invalid/expired/exhausted code — returns
 * { ok: false, error, message } so the caller can show it inline.
 */
async function redeemPromoCodeForEvent({ code, eventId, orgId, actorId }) {
  const { data: rpcData, error: rpcError } = await supabase.rpc('redeem_promo_code', {
    p_code: code,
    p_event_id: eventId,
    p_org_id: orgId,
    p_actor: actorId || null,
  });
  if (rpcError) {
    logger.error({ err: rpcError, eventId }, '[promoCode] redeem_promo_code RPC failed');
    return { ok: false, error: 'REDEEM_FAILED', message: 'Could not redeem this code right now. Please try again.' };
  }
  if (!rpcData?.ok) {
    const errCode = rpcData?.error || 'INVALID_CODE';
    return { ok: false, error: errCode, message: ERROR_MESSAGES[errCode] || 'This promo code could not be redeemed.' };
  }

  const tierName = rpcData.tier_name;
  const tierKey = rpcData.tier_key || null;
  let adminConfig;
  try {
    adminConfig = await getPlatformConfig();
  } catch (err) {
    logger.error({ err, eventId, tierName }, '[promoCode] could not load pricing config after redemption');
    return { ok: false, error: 'CONFIG_ERROR', message: 'Could not activate your event right now. Please contact support — your code has been recorded.' };
  }
  const { tier } = resolveTier(adminConfig.pricing_tiers, { key: tierKey, name: tierName });

  // A code whose tier no longer exists must NOT be redeemable.
  //
  // It used to fall through with `tier` undefined, and every field then
  // degraded in the customer's favour: tier_max_guests became null — which the
  // guest-cap trigger reads as UNLIMITED — with no features and no watermark
  // removal. So renaming a plan silently converted its promo codes into
  // uncapped free events. Refusing is the only safe answer: the redemption has
  // already been recorded by the RPC, so this returns an error the caller
  // surfaces rather than activating something nobody priced.
  if (!tier) {
    logger.error({ eventId, tierName, tierKey, code: code.toUpperCase().trim() },
      '[promoCode] code grants a tier that no longer exists — refusing to activate');

    // UNDO the redemption the RPC already recorded.
    //
    // This is not tidiness. The RPC has, by this point, inserted a
    // promo_code_redemptions row and incremented redemption_count — and that
    // row is what makes any FUTURE redemption on this event fail with
    // EVENT_ALREADY_REDEEMED. Leaving it means the organizer's code is spent,
    // their event is permanently blocked from redeeming any other code, and
    // they got nothing: the worst possible outcome of an admin deleting a
    // plan. Best-effort, and the message below tells the truth about which
    // way it went rather than assuming.
    let rolledBack = false;
    try {
      const { error: delErr } = await supabase
        .from('promo_code_redemptions')
        .delete()
        .eq('promo_code_id', rpcData.promo_code_id)
        .eq('event_id', eventId);
      if (!delErr) {
        const { data: row } = await supabase
          .from('promo_codes').select('redemption_count').eq('id', rpcData.promo_code_id).maybeSingle();
        if (row && Number(row.redemption_count) > 0) {
          await supabase.from('promo_codes')
            .update({ redemption_count: Number(row.redemption_count) - 1 })
            .eq('id', rpcData.promo_code_id);
        }
        rolledBack = true;
      }
    } catch (err) {
      logger.error({ err, eventId, code: code.toUpperCase().trim() },
        '[promoCode] could not roll back a redemption for a deleted tier — the code is spent and the event is blocked');
    }

    return {
      ok: false,
      error: 'TIER_GONE',
      message: rolledBack
        ? 'This code grants a plan that is no longer available, so your event was not activated. Your code has not been used up — please contact us and we will sort it out.'
        : 'This code grants a plan that is no longer available. Please contact support quoting your event name — we will activate it manually.',
    };
  }

  const updates = {
    is_paid: true,
    status: 'active',
    manual_override: true,
    ...tierSnapshot(tier),
    comp_reason: `Promo code: ${code.toUpperCase().trim()}`,
    updated_at: new Date().toISOString(),
  };

  const { data: prior } = await supabase
    .from('events')
    .select('status, slug, title, organizations(name, email)')
    .eq('id', eventId)
    .single();

  const { data: event, error: updateError } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select('id, title, slug, status, is_paid, tier_name, tier_max_guests')
    .single();

  if (updateError || !event) {
    logger.error({ err: updateError, eventId }, '[promoCode] event activation failed after redemption was recorded');
    return { ok: false, error: 'ACTIVATION_FAILED', message: 'Your code was accepted, but activating your event failed. Please contact support.' };
  }

  const { error: activityLogError } = await supabase.from('activity_logs').insert({
    event_id: eventId,
    actor_id: actorId || null,
    action: 'event_promo_code_redeemed',
    entity_type: 'event',
    entity_id: eventId,
    metadata: { code: code.toUpperCase().trim(), tier_name: updates.tier_name },
  });
  if (activityLogError) {
    logger.warn({ err: activityLogError, eventId }, '[promoCode] activity_logs insert failed (non-fatal)');
  }

  if (prior && prior.status !== 'active') {
    const orgEmail = prior.organizations?.email;
    if (orgEmail) {
      try {
        const title = prior.title || event.title || 'Your event';
        const html = getEventLiveTemplate({
          orgName: prior.organizations.name || 'Organizer',
          eventTitle: title,
          eventUrl: `${getPublicBaseUrl()}/${prior.slug || event.slug || ''}`,
        });
        await sendEmailViaBrevo(orgEmail, `Your Event is Live: ${title}`, html);
      } catch (err) {
        logger.warn({ err, eventId }, '[promoCode] event-live email failed (non-fatal)');
      }
    }
  }

  return { ok: true, event };
}

module.exports = {
  generateUniquePromoCode,
  redeemPromoCodeForEvent,
};
