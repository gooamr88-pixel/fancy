const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { getPlatformConfig } = require('../utils/configCache');
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
  let adminConfig;
  try {
    adminConfig = await getPlatformConfig();
  } catch (err) {
    logger.error({ err, eventId, tierName }, '[promoCode] could not load pricing config after redemption');
    return { ok: false, error: 'CONFIG_ERROR', message: 'Could not activate your event right now. Please contact support — your code has been recorded.' };
  }
  const tier = (adminConfig.pricing_tiers || []).find((t) => (t.name || '').toLowerCase() === (tierName || '').toLowerCase());

  const updates = {
    is_paid: true,
    status: 'active',
    manual_override: true,
    tier_name: tier?.name || tierName,
    tier_max_guests: Number.isFinite(tier?.max_guests) ? tier.max_guests : null,
    tier_remove_watermark: !!tier?.remove_watermark,
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
