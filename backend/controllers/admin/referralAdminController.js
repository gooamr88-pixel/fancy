const { supabase } = require('../../config/supabase');
const { logAdminAction } = require('../../middleware/adminAudit');
const { getPlatformConfig, invalidate: invalidateConfigCache } = require('../../utils/configCache');
const { getReferralCreditBalance } = require('../../services/referralService');

/**
 * Referral / affiliate program oversight for the "Marketing" admin section
 * (permissions.marketing.view / marketing.manage already anticipate this —
 * seeded description: "Manage coupons / campaigns / referrals").
 */

/** GET /api/v1/admin/referrals */
const listReferrals = async (req, res, next) => {
  try {
    const [{ data: ledger, error: ledgerError }, { data: referredOrgs, error: referredError }] = await Promise.all([
      supabase.from('referral_credit_ledger').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('organizations').select('id, name, email, created_at, referred_by_org_id').not('referred_by_org_id', 'is', null).order('created_at', { ascending: false }).limit(300),
    ]);
    if (ledgerError) throw ledgerError;
    if (referredError) throw referredError;

    const config = await getPlatformConfig().catch(() => null);

    // Resolve org names for everyone referenced across both result sets with a
    // single follow-up query (the ledger table has two FKs into organizations,
    // so a PostgREST embedded join would be ambiguous — resolve manually instead).
    const orgIds = new Set();
    (ledger || []).forEach((l) => { if (l.org_id) orgIds.add(l.org_id); if (l.referred_org_id) orgIds.add(l.referred_org_id); });
    (referredOrgs || []).forEach((o) => { orgIds.add(o.id); if (o.referred_by_org_id) orgIds.add(o.referred_by_org_id); });

    const { data: orgRows } = orgIds.size > 0
      ? await supabase.from('organizations').select('id, name, email').in('id', [...orgIds])
      : { data: [] };
    const orgById = new Map((orgRows || []).map((o) => [o.id, o]));

    const earnedForReferredOrgIds = new Set((ledger || []).filter((l) => l.type === 'earned').map((l) => l.referred_org_id));

    const referrals = (referredOrgs || []).map((o) => ({
      referredOrgId: o.id,
      referredOrgName: o.name,
      referredOrgEmail: o.email,
      referrerOrgId: o.referred_by_org_id,
      referrerOrgName: orgById.get(o.referred_by_org_id)?.name || null,
      joinedAt: o.created_at,
      status: earnedForReferredOrgIds.has(o.id) ? 'converted' : 'pending',
    }));

    const totals = (ledger || []).reduce((acc, l) => {
      const amt = l.amount_cents || 0;
      acc.balanceCents += amt;
      if (l.type === 'earned') acc.earnedCents += amt;
      else if (l.type === 'redeemed') acc.redeemedCents += Math.abs(amt);
      else if (l.type === 'admin_grant') acc.adminGrantedCents += amt;
      else if (l.type === 'admin_deduct') acc.adminDeductedCents += Math.abs(amt);
      return acc;
    }, { balanceCents: 0, earnedCents: 0, redeemedCents: 0, adminGrantedCents: 0, adminDeductedCents: 0 });

    return res.json({
      success: true,
      config: config ? {
        referralProgramEnabled: config.referral_program_enabled !== false,
        referralRewardCents: Number(config.referral_reward_cents) || 0,
      } : null,
      totals,
      referrals,
      ledger: (ledger || []).map((l) => ({
        id: l.id,
        orgId: l.org_id,
        orgName: orgById.get(l.org_id)?.name || null,
        amountCents: l.amount_cents,
        type: l.type,
        referredOrgId: l.referred_org_id,
        referredOrgName: l.referred_org_id ? (orgById.get(l.referred_org_id)?.name || null) : null,
        note: l.note,
        createdAt: l.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/referrals/config */
const updateReferralConfig = async (req, res, next) => {
  const { referralProgramEnabled, referralRewardCents } = req.body || {};
  const updates = {};
  if (referralProgramEnabled !== undefined) updates.referral_program_enabled = !!referralProgramEnabled;
  if (referralRewardCents !== undefined) {
    const cents = Number(referralRewardCents);
    if (!Number.isInteger(cents) || cents < 0) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'referralRewardCents must be a non-negative whole number.' });
    }
    updates.referral_reward_cents = cents;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'No updatable fields supplied.' });
  }
  updates.updated_at = new Date().toISOString();
  updates.updated_by = req.user.id;

  try {
    const { data, error } = await supabase
      .from('super_admin_config')
      .update(updates)
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select()
      .single();
    if (error) throw error;

    invalidateConfigCache();
    await logAdminAction(req, { action: 'referral_config.update', entityType: 'super_admin_config', after: updates });

    return res.json({
      success: true,
      config: { referralProgramEnabled: data.referral_program_enabled, referralRewardCents: data.referral_reward_cents },
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/referrals/adjust — manual goodwill/support credit grant or deduction. */
const adjustCredit = async (req, res, next) => {
  const { orgId, amountCents, direction, note } = req.body || {};
  const cents = Number(amountCents);

  if (!orgId) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'orgId is required.' });
  if (!Number.isInteger(cents) || cents <= 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'amountCents must be a positive whole number.' });
  }
  if (!['grant', 'deduct'].includes(direction)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: "direction must be 'grant' or 'deduct'." });
  }

  try {
    const { data: org } = await supabase.from('organizations').select('id, name').eq('id', orgId).maybeSingle();
    if (!org) return res.status(404).json({ success: false, error: 'ORG_NOT_FOUND', message: 'Organization not found.' });

    if (direction === 'deduct') {
      const balance = await getReferralCreditBalance(orgId);
      if (cents > balance) {
        return res.status(400).json({
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          message: `Cannot deduct $${(cents / 100).toFixed(2)} — ${org.name} only has $${(balance / 100).toFixed(2)} in referral credit.`,
        });
      }
    }

    const { data, error } = await supabase
      .from('referral_credit_ledger')
      .insert({
        org_id: orgId,
        amount_cents: direction === 'grant' ? cents : -cents,
        type: direction === 'grant' ? 'admin_grant' : 'admin_deduct',
        note: note ? note.toString().slice(0, 500) : null,
        created_by: req.user.id,
      })
      .select()
      .single();
    if (error) throw error;

    await logAdminAction(req, {
      action: `referral_credit.${direction}`,
      entityType: 'referral_credit_ledger',
      entityId: data.id,
      after: { orgId, orgName: org.name, amountCents: cents, direction },
    });

    return res.status(201).json({ success: true, entry: data });
  } catch (err) {
    next(err);
  }
};

module.exports = { listReferrals, updateReferralConfig, adjustCredit };
