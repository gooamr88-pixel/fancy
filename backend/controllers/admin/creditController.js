const { supabase } = require('../../config/supabase');
const { logAdminAction } = require('../../middleware/adminAudit');

/**
 * Credit package catalog management (Master Plan §10 — catalog scope).
 * Live SMS wallet grants continue through the existing
 * POST /admin/events/:eventId/grant-sms endpoint.
 */

const VALID_TYPES = ['sms', 'email', 'qr'];

/** GET /api/v1/admin/credits/packages */
const listPackages = async (req, res, next) => {
  try {
    let query = supabase.from('credit_packages').select('*').order('type').order('sort_order');
    if (req.query.type && VALID_TYPES.includes(req.query.type)) query = query.eq('type', req.query.type);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ success: true, packages: data || [] });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/credits/packages */
const createPackage = async (req, res, next) => {
  const { type, name, credits, bonusCredits, priceCents, currency, sortOrder } = req.body || {};
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: `type must be one of: ${VALID_TYPES.join(', ')}.` });
  }
  if (!name) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'name is required.' });
  const c = parseInt(credits, 10);
  const price = parseInt(priceCents, 10);
  if (!Number.isInteger(c) || c <= 0) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'credits must be a positive integer.' });
  if (!Number.isInteger(price) || price < 0) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'priceCents must be a non-negative integer.' });

  try {
    const { data, error } = await supabase
      .from('credit_packages')
      .insert({
        type,
        name,
        credits: c,
        bonus_credits: bonusCredits != null ? Math.max(0, parseInt(bonusCredits, 10) || 0) : 0,
        price_cents: price,
        currency: currency || 'usd',
        sort_order: sortOrder != null ? parseInt(sortOrder, 10) || 0 : 0,
      })
      .select()
      .single();
    if (error) throw error;
    await logAdminAction(req, { action: 'credit_package.create', entityType: 'credit_package', entityId: data.id, after: data });
    return res.status(201).json({ success: true, package: data });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/credits/packages/:packageId */
const updatePackage = async (req, res, next) => {
  const { packageId } = req.params;
  const b = req.body || {};
  const updates = {};
  if (b.name !== undefined) updates.name = b.name;
  if (b.credits !== undefined) {
    const c = parseInt(b.credits, 10);
    if (!Number.isInteger(c) || c <= 0) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'credits must be a positive integer.' });
    updates.credits = c;
  }
  if (b.bonusCredits !== undefined) updates.bonus_credits = Math.max(0, parseInt(b.bonusCredits, 10) || 0);
  if (b.priceCents !== undefined) {
    const price = parseInt(b.priceCents, 10);
    if (!Number.isInteger(price) || price < 0) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'priceCents must be a non-negative integer.' });
    updates.price_cents = price;
  }
  if (b.currency !== undefined) updates.currency = b.currency;
  if (b.isActive !== undefined) updates.is_active = !!b.isActive;
  if (b.sortOrder !== undefined) updates.sort_order = parseInt(b.sortOrder, 10) || 0;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'No updatable fields supplied.' });
  }
  try {
    const { data, error } = await supabase.from('credit_packages').update(updates).eq('id', packageId).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'PACKAGE_NOT_FOUND', message: 'Package not found.' });
    await logAdminAction(req, { action: 'credit_package.update', entityType: 'credit_package', entityId: packageId, after: updates });
    return res.json({ success: true, package: data });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/admin/credits/packages/:packageId */
const deletePackage = async (req, res, next) => {
  const { packageId } = req.params;
  try {
    const { error } = await supabase.from('credit_packages').delete().eq('id', packageId);
    if (error) throw error;
    await logAdminAction(req, { action: 'credit_package.delete', entityType: 'credit_package', entityId: packageId });
    return res.json({ success: true, message: 'Package deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listPackages, createPackage, updatePackage, deletePackage };
