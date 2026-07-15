const { supabase } = require('../../config/supabase');
const logger = require('../../utils/logger');
const { parsePagination, applyPagination, buildListResponse, escapeOrSearchTerm } = require('../../middleware/pagination');
const { logAdminAction } = require('../../middleware/adminAudit');
const { getPlatformConfig } = require('../../utils/configCache');
const { generateUniquePromoCode } = require('../../services/promoCodeService');

/**
 * Super-admin CRUD for promo codes (Master Plan-style admin surface, mirrors
 * creditController.js's shape). A promo code lets an organizer publish their
 * event immediately, free, bypassing both payment and manual review — see
 * promoCodeService.redeemPromoCodeForEvent for the redemption side.
 */

const CODE_RE = /^[A-Z0-9-]{3,32}$/;

function deriveStatus(row) {
  if (!row.is_active) return 'inactive';
  if (row.expires_at && new Date(row.expires_at) < new Date()) return 'expired';
  if (row.max_redemptions != null && row.redemption_count >= row.max_redemptions) return 'exhausted';
  return 'active';
}

/** Confirms the tier exists in the current pricing config; returns the tier or null. */
async function findTier(tierName) {
  const config = await getPlatformConfig();
  return (config.pricing_tiers || []).find((t) => (t.name || '').toLowerCase() === (tierName || '').toLowerCase()) || null;
}

/**
 * GET /api/v1/admin/promo-codes?q=&status= (paginated)
 *
 * `status` is computed from is_active/expires_at/redemption_count, not a
 * stored column, so it can't be pushed into the Supabase range/count query —
 * filtering after a ranged fetch would make `count` (and therefore
 * totalPages) reflect the pre-filter set while rows on other pages silently
 * vanish. The promo_codes catalog is small and admin-managed, so instead we
 * fetch every row matching the search term, then sort/filter/paginate here.
 */
const listPromoCodes = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['created_at', 'code', 'redemption_count'], defaultSort: 'created_at' });
  try {
    let query = supabase.from('promo_codes').select('*');
    if (p.q) {
      const term = escapeOrSearchTerm(p.q);
      query = query.or(`code.ilike.${term},description.ilike.${term}`);
    }
    query = query.order(p.sort, { ascending: p.order === 'asc' });

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map((row) => ({ ...row, computedStatus: deriveStatus(row) }));
    const filtered = req.query.status ? rows.filter((r) => r.computedStatus === req.query.status) : rows;
    const paged = filtered.slice(p.from, p.to + 1);

    return res.json({ ...buildListResponse(paged, p, filtered.length), promoCodes: paged });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/admin/promo-codes/stats — platform-wide KPIs for the console header. */
const getPromoCodeStats = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('is_active, expires_at, max_redemptions, redemption_count');
    if (error) throw error;

    const rows = data || [];
    const soonCutoff = Date.now() + 7 * 24 * 60 * 60 * 1000;

    let activeCodes = 0;
    let expiringSoon = 0;
    let totalRedemptions = 0;
    for (const row of rows) {
      totalRedemptions += row.redemption_count || 0;
      if (deriveStatus(row) === 'active') {
        activeCodes += 1;
        if (row.expires_at && new Date(row.expires_at).getTime() <= soonCutoff) expiringSoon += 1;
      }
    }

    return res.json({
      success: true,
      stats: { totalCodes: rows.length, activeCodes, totalRedemptions, expiringSoon },
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/admin/promo-codes/:promoCodeId/redemptions (paginated) */
const listPromoCodeRedemptions = async (req, res, next) => {
  const { promoCodeId } = req.params;
  const p = parsePagination(req, { sortable: ['created_at'], defaultSort: 'created_at' });
  try {
    const { data, error, count } = await applyPagination(
      supabase
        .from('promo_code_redemptions')
        .select('id, created_at, tier_name, events(title, slug), organizations(name, email)', { count: 'exact' })
        .eq('promo_code_id', promoCodeId),
      p
    );
    if (error) throw error;
    const redemptions = (data || []).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      tierName: r.tier_name,
      eventTitle: r.events?.title || null,
      eventSlug: r.events?.slug || null,
      orgName: r.organizations?.name || null,
      orgEmail: r.organizations?.email || null,
    }));
    return res.json({ ...buildListResponse(redemptions, p, count), redemptions });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/promo-codes */
const createPromoCode = async (req, res, next) => {
  const { code, description, tierName, maxRedemptions, expiresAt } = req.body || {};
  if (!tierName || !tierName.toString().trim()) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'tierName is required.' });
  }
  let tier;
  try {
    tier = await findTier(tierName);
  } catch {
    return res.status(500).json({ success: false, error: 'CONFIG_ERROR', message: 'Could not retrieve pricing configuration.' });
  }
  if (!tier) {
    return res.status(400).json({ success: false, error: 'INVALID_TIER', message: `Pricing tier '${tierName}' not found.` });
  }

  let maxR = null;
  if (maxRedemptions !== undefined && maxRedemptions !== null && maxRedemptions !== '') {
    maxR = parseInt(maxRedemptions, 10);
    if (!Number.isInteger(maxR) || maxR <= 0) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'maxRedemptions must be a positive integer, or left blank for unlimited.' });
    }
  }

  let expires = null;
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'expiresAt must be a valid date.' });
    }
    expires = d.toISOString();
  }

  let finalCode = (code || '').toString().trim().toUpperCase();
  if (finalCode && !CODE_RE.test(finalCode)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Code must be 3-32 characters: letters, numbers, and hyphens only.' });
  }

  try {
    if (!finalCode) finalCode = await generateUniquePromoCode();
    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        code: finalCode,
        description: (description || '').toString().trim() || null,
        tier_name: tier.name,
        max_redemptions: maxR,
        expires_at: expires,
        created_by: req.user?.id || null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'CODE_TAKEN', message: 'That code is already in use.' });
      }
      throw error;
    }
    await logAdminAction(req, { action: 'promo_code.create', entityType: 'promo_code', entityId: data.id, after: data });
    return res.status(201).json({ success: true, promoCode: { ...data, computedStatus: deriveStatus(data) } });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/promo-codes/:promoCodeId */
const updatePromoCode = async (req, res, next) => {
  const { promoCodeId } = req.params;
  const b = req.body || {};
  const updates = {};

  if (b.description !== undefined) updates.description = (b.description || '').toString().trim() || null;
  if (b.isActive !== undefined) updates.is_active = !!b.isActive;

  if (b.tierName !== undefined) {
    let tier;
    try {
      tier = await findTier(b.tierName);
    } catch {
      return res.status(500).json({ success: false, error: 'CONFIG_ERROR', message: 'Could not retrieve pricing configuration.' });
    }
    if (!tier) return res.status(400).json({ success: false, error: 'INVALID_TIER', message: `Pricing tier '${b.tierName}' not found.` });
    updates.tier_name = tier.name;
  }

  if (b.maxRedemptions !== undefined) {
    if (b.maxRedemptions === null || b.maxRedemptions === '') {
      updates.max_redemptions = null;
    } else {
      const maxR = parseInt(b.maxRedemptions, 10);
      if (!Number.isInteger(maxR) || maxR <= 0) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'maxRedemptions must be a positive integer, or null for unlimited.' });
      }
      updates.max_redemptions = maxR;
    }
  }

  if (b.expiresAt !== undefined) {
    if (!b.expiresAt) {
      updates.expires_at = null;
    } else {
      const d = new Date(b.expiresAt);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'expiresAt must be a valid date.' });
      }
      updates.expires_at = d.toISOString();
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'No updatable fields supplied.' });
  }
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase.from('promo_codes').update(updates).eq('id', promoCodeId).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'PROMO_CODE_NOT_FOUND', message: 'Promo code not found.' });
    await logAdminAction(req, { action: 'promo_code.update', entityType: 'promo_code', entityId: promoCodeId, after: updates });
    return res.json({ success: true, promoCode: { ...data, computedStatus: deriveStatus(data) } });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/admin/promo-codes/:promoCodeId — only when never redeemed (else deactivate instead). */
const deletePromoCode = async (req, res, next) => {
  const { promoCodeId } = req.params;
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('promo_codes')
      .select('id, redemption_count')
      .eq('id', promoCodeId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ success: false, error: 'PROMO_CODE_NOT_FOUND', message: 'Promo code not found.' });
    if (existing.redemption_count > 0) {
      return res.status(409).json({
        success: false,
        error: 'CODE_IN_USE',
        message: 'This code has already been redeemed and cannot be deleted — deactivate it instead to keep the redemption history intact.',
      });
    }

    const { error } = await supabase.from('promo_codes').delete().eq('id', promoCodeId);
    if (error) throw error;
    await logAdminAction(req, { action: 'promo_code.delete', entityType: 'promo_code', entityId: promoCodeId });
    return res.json({ success: true, message: 'Promo code deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPromoCodes,
  getPromoCodeStats,
  listPromoCodeRedemptions,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
};
