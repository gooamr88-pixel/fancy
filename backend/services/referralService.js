const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { getPlatformConfig } = require('../utils/configCache');

// Excludes visually-ambiguous characters (0/O, 1/I/L) so a code read off a
// screen or spoken aloud can't be mistyped into a different valid code.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function randomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS.charAt(crypto.randomInt(CODE_CHARS.length));
  return code;
}

/** Generates a referral code guaranteed unique among organizations.referral_code. */
async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const { data } = await supabase.from('organizations').select('id').eq('referral_code', code).limit(1);
    if (!data || data.length === 0) return code;
  }
  // Astronomically unlikely fallback after 8 collisions — still unique in practice.
  return `${randomCode().slice(0, 4)}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

/** Resolves a referral code from a registration link to the referring org's id, or null. */
async function resolveReferrerOrgId(rawCode) {
  const code = (rawCode || '').toString().trim().toUpperCase();
  if (!code) return null;
  const { data } = await supabase.from('organizations').select('id').eq('referral_code', code).maybeSingle();
  return data?.id || null;
}

/** Sum of an org's referral_credit_ledger — the current spendable balance. */
async function getReferralCreditBalance(orgId) {
  if (!orgId) return 0;
  const { data, error } = await supabase.from('referral_credit_ledger').select('amount_cents').eq('org_id', orgId);
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + (row.amount_cents || 0), 0);
}

// Hold lifetimes. A card hold only needs to outlive the Stripe Checkout session
// (which itself expires in 24h) — after that an abandoned checkout's credit
// frees itself. A manual/bank transfer sits pending until a human approves or
// declines it, so its hold must not expire out from under the payment; it's
// released explicitly on decline instead.
const CARD_HOLD_TTL_MINUTES = 24 * 60;       // 24 hours
const MANUAL_HOLD_TTL_MINUTES = 30 * 24 * 60; // 30 days

/**
 * ATOMICALLY earmarks the affordable slice of an org's credit against a charge,
 * returning what was actually reserved and the hold that owns it.
 *
 * This replaces the old read-balance-then-apply approach, which could not close
 * the TOCTOU race: two checkouts opened at once both read the same balance and
 * both applied it. reserve_referral_credit() takes a per-org advisory lock, so
 * concurrent callers serialize and the second sees the first's hold already
 * subtracted from availability.
 *
 * Degrades safely: any failure returns zero credit (the customer simply pays
 * full price) rather than breaking checkout.
 */
async function reserveReferralCredit({ orgId, eventId = null, requestedCents, ttlMinutes = CARD_HOLD_TTL_MINUTES, reference = null }) {
  if (!orgId || !Number.isFinite(requestedCents) || requestedCents <= 0) return { reservedCents: 0, holdId: null };
  try {
    const { data, error } = await supabase.rpc('reserve_referral_credit', {
      p_org_id: orgId,
      p_event_id: eventId,
      p_requested_cents: Math.round(requestedCents),
      p_ttl_minutes: ttlMinutes,
      p_reference: reference,
    });
    if (error) throw error;
    return {
      reservedCents: Number(data?.reserved_cents) || 0,
      holdId: data?.hold_id || null,
    };
  } catch (err) {
    logger.warn({ err, orgId, eventId }, '[referral] reserve failed — applying no credit');
    return { reservedCents: 0, holdId: null };
  }
}

/**
 * Converts a hold into a real spend once the payment is confirmed: flips the
 * hold to 'captured' and writes the 'redeemed' ledger row in ONE transaction.
 * Idempotent — a racing capture (webhook vs. synchronous verify) reports
 * already_captured instead of double-debiting.
 */
async function captureReferralHold({ holdId, paymentId = null, note = null }) {
  if (!holdId) return { captured: false, capturedCents: 0 };
  try {
    const { data, error } = await supabase.rpc('capture_referral_hold', {
      p_hold_id: holdId,
      p_payment_id: paymentId,
      p_note: note,
    });
    if (error) throw error;
    return {
      captured: !!data?.captured,
      alreadyCaptured: !!data?.already_captured,
      capturedCents: Number(data?.captured_cents) || 0,
    };
  } catch (err) {
    logger.error({ err, holdId, paymentId }, '[referral] capture failed — discount applied but ledger not debited, needs reconciliation');
    return { captured: false, error: true };
  }
}

/** Frees an unused hold (checkout abandoned, manual payment declined, activation lost a race). */
async function releaseReferralHold(holdId) {
  if (!holdId) return { released: false };
  try {
    const { error } = await supabase.rpc('release_referral_hold', { p_hold_id: holdId });
    if (error) throw error;
    return { released: true };
  } catch (err) {
    // Non-fatal: an un-released hold still self-heals when it expires.
    logger.warn({ err, holdId }, '[referral] release failed — hold will expire on its own');
    return { released: false };
  }
}

/**
 * LEGACY spend path — records a redemption directly, with no hold behind it.
 *
 * Superseded by reserve/capture (which is atomic). It remains only as a fallback
 * for payments that were created BEFORE the holds migration and are still
 * in-flight: those carry a referral_credit_applied_cents snapshot but no
 * referral_hold_id, so there is no hold to capture and the spend must be written
 * directly. Do not use it for new flows.
 *
 * Idempotent: guarded by the DB's unique partial index on (payment_id) WHERE
 * type='redeemed'.
 */
async function spendReferralCredit({ orgId, amountCents, eventId = null, paymentId = null, note = null }) {
  if (!orgId || !Number.isFinite(amountCents) || amountCents <= 0) return { spent: false };
  const { error } = await supabase.from('referral_credit_ledger').insert({
    org_id: orgId,
    amount_cents: -Math.abs(Math.round(amountCents)),
    type: 'redeemed',
    event_id: eventId,
    payment_id: paymentId,
    note,
  });
  if (error) {
    if (error.code === '23505') return { spent: false, alreadyProcessed: true };
    throw error;
  }
  return { spent: true };
}

/**
 * Rewards the org that referred `referredOrgId`, once — triggered the first
 * time that referred org converts to a paying customer (a real tier
 * purchase, card or cash; never a genuinely free tier). Idempotent via the
 * DB's unique partial index on (referred_org_id) WHERE type='earned', so
 * calling this from every payment-fulfillment path is always safe even
 * under concurrent/retried calls.
 */
async function grantReferralRewardIfEligible({ referredOrgId, eventId = null }) {
  if (!referredOrgId) return { granted: false };
  try {
    const { data: referred } = await supabase
      .from('organizations')
      .select('id, referred_by_org_id')
      .eq('id', referredOrgId)
      .maybeSingle();
    const referrerOrgId = referred?.referred_by_org_id;
    if (!referrerOrgId) return { granted: false };

    const config = await getPlatformConfig();
    if (config.referral_program_enabled === false) return { granted: false };
    const rewardCents = Number(config.referral_reward_cents) || 0;
    if (rewardCents <= 0) return { granted: false };

    const { error } = await supabase.from('referral_credit_ledger').insert({
      org_id: referrerOrgId,
      amount_cents: rewardCents,
      type: 'earned',
      referred_org_id: referredOrgId,
      event_id: eventId,
      note: 'Referral reward — referred organizer converted to a paying customer',
    });
    if (error) {
      if (error.code === '23505') return { granted: false, alreadyProcessed: true };
      throw error;
    }
    return { granted: true, referrerOrgId, rewardCents };
  } catch (err) {
    // Never let a reward-grant failure fault an already-committed payment fulfillment.
    logger.error({ err, referredOrgId }, '[referral] grantReferralRewardIfEligible failed');
    return { granted: false, error: true };
  }
}

/**
 * Reverses the referral side-effects of a payment that has been FULLY refunded
 * or lost to a chargeback. Two independent, individually-idempotent actions:
 *
 *   1. Restore any credit the payment consumed (a positive 'redeemed_reversal'
 *      row), so a refunded credit-funded purchase doesn't silently burn the
 *      customer's balance.
 *   2. Claw back the reward the referrer earned from THIS org's conversion, if
 *      the refunded payment was for the very event that triggered it (a negative
 *      'earned_reversal' row) — closing the self-referral refund loop.
 *
 * Idempotent via the DB's unique partial indexes on (payment_id) WHERE
 * type='redeemed_reversal' and (referred_org_id) WHERE type='earned_reversal',
 * so it's safe to call from BOTH the admin-refund path (stripeRefundService)
 * and the Stripe webhook (handleChargeRefunded) — whichever runs, the other
 * becomes a no-op. Never throws (best-effort — the money movement it follows is
 * already committed); logs and swallows.
 */
async function reverseReferralForRefundedPayment(payment) {
  if (!payment?.id || !payment.event_id) return { reversed: false };
  try {
    const { data: ev } = await supabase.from('events').select('org_id').eq('id', payment.event_id).maybeSingle();
    const orgId = ev?.org_id;
    if (!orgId) return { reversed: false };

    // 1. Restore consumed credit.
    const applied = payment.referral_credit_applied_cents || 0;
    if (applied > 0) {
      const { error } = await supabase.from('referral_credit_ledger').insert({
        org_id: orgId,
        amount_cents: Math.abs(applied),
        type: 'redeemed_reversal',
        event_id: payment.event_id,
        payment_id: payment.id,
        note: 'Referral credit restored — payment refunded',
      });
      if (error && error.code !== '23505') {
        logger.error({ err: error, paymentId: payment.id }, '[referral] credit restore failed on refund');
      }
    }

    // 2. Claw back the reward this org's conversion earned for its referrer —
    // only when the refunded payment is for the event that triggered the reward.
    const { data: earned } = await supabase
      .from('referral_credit_ledger')
      .select('id, org_id, amount_cents, event_id')
      .eq('referred_org_id', orgId)
      .eq('type', 'earned')
      .maybeSingle();
    if (earned && earned.event_id === payment.event_id) {
      const { error } = await supabase.from('referral_credit_ledger').insert({
        org_id: earned.org_id,
        amount_cents: -Math.abs(earned.amount_cents),
        type: 'earned_reversal',
        referred_org_id: orgId,
        event_id: payment.event_id,
        note: 'Referral reward reversed — referred customer refunded/disputed',
      });
      if (error && error.code !== '23505') {
        logger.error({ err: error, paymentId: payment.id }, '[referral] reward clawback failed on refund');
      }
    }

    return { reversed: true };
  } catch (err) {
    logger.error({ err, paymentId: payment?.id }, '[referral] reverseReferralForRefundedPayment failed');
    return { reversed: false, error: true };
  }
}

/** Full "My Referrals" overview for the organizer dashboard. */
async function getReferralOverview(orgId) {
  const [{ data: org }, { data: referredOrgs }, { data: ledger }, config] = await Promise.all([
    supabase.from('organizations').select('referral_code').eq('id', orgId).single(),
    supabase.from('organizations').select('id, name, created_at').eq('referred_by_org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('referral_credit_ledger').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    getPlatformConfig().catch(() => null),
  ]);

  const earnedForReferredOrgIds = new Set((ledger || []).filter((l) => l.type === 'earned').map((l) => l.referred_org_id));
  const balanceCents = (ledger || []).reduce((sum, row) => sum + (row.amount_cents || 0), 0);

  const referrals = (referredOrgs || []).map((o) => ({
    name: o.name,
    joinedAt: o.created_at,
    status: earnedForReferredOrgIds.has(o.id) ? 'converted' : 'pending',
  }));

  return {
    referralCode: org?.referral_code || null,
    programEnabled: config ? config.referral_program_enabled !== false : true,
    rewardCents: config ? (Number(config.referral_reward_cents) || 0) : 0,
    creditBalanceCents: balanceCents,
    referralCount: referrals.length,
    convertedCount: referrals.filter((r) => r.status === 'converted').length,
    referrals,
    ledger: (ledger || []).map((l) => ({
      id: l.id,
      amountCents: l.amount_cents,
      type: l.type,
      note: l.note,
      createdAt: l.created_at,
    })),
  };
}

module.exports = {
  generateUniqueReferralCode,
  resolveReferrerOrgId,
  getReferralCreditBalance,
  reserveReferralCredit,
  captureReferralHold,
  releaseReferralHold,
  spendReferralCredit, // legacy fallback only — see its doc comment
  grantReferralRewardIfEligible,
  reverseReferralForRefundedPayment,
  getReferralOverview,
  CARD_HOLD_TTL_MINUTES,
  MANUAL_HOLD_TTL_MINUTES,
};
