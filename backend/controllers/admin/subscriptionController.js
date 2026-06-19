const { supabase } = require('../../config/supabase');
const { parsePagination, applyPagination, buildListResponse } = require('../../middleware/pagination');
const { logAdminAction } = require('../../middleware/adminAudit');

/**
 * Plans & Subscriptions management (Master Plan §11).
 */

const VALID_INTERVALS = ['one_time', 'monthly', 'yearly'];

/** GET /api/v1/admin/subscriptions/plans */
const listPlans = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('price_cents', { ascending: true });
    if (error) throw error;
    return res.json({ success: true, plans: data || [] });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/subscriptions/plans */
const createPlan = async (req, res, next) => {
  const { key, name, description, priceCents, interval, currency, features, maxGuests, maxEvents, sortOrder } = req.body || {};
  if (!key || !name) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'key and name are required.' });
  }
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return res.status(400).json({ success: false, error: 'INVALID_KEY', message: 'key must be lowercase snake_case.' });
  }
  if (interval && !VALID_INTERVALS.includes(interval)) {
    return res.status(400).json({ success: false, error: 'INVALID_INTERVAL', message: `interval must be one of: ${VALID_INTERVALS.join(', ')}.` });
  }
  const price = parseInt(priceCents, 10);
  if (!Number.isInteger(price) || price < 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'priceCents must be a non-negative integer.' });
  }
  try {
    const { data, error } = await supabase
      .from('plans')
      .insert({
        key,
        name,
        description: description || null,
        price_cents: price,
        interval: interval || 'one_time',
        currency: currency || 'usd',
        features: Array.isArray(features) ? features : [],
        max_guests: maxGuests != null ? parseInt(maxGuests, 10) : null,
        max_events: maxEvents != null ? parseInt(maxEvents, 10) : null,
        sort_order: sortOrder != null ? parseInt(sortOrder, 10) : 0,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ success: false, error: 'PLAN_EXISTS', message: 'A plan with that key already exists.' });
      throw error;
    }
    await logAdminAction(req, { action: 'plan.create', entityType: 'plan', entityId: data.id, after: data });
    return res.status(201).json({ success: true, plan: data });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/subscriptions/plans/:planId */
const updatePlan = async (req, res, next) => {
  const { planId } = req.params;
  const b = req.body || {};
  const updates = {};
  if (b.name !== undefined) updates.name = b.name;
  if (b.description !== undefined) updates.description = b.description;
  if (b.priceCents !== undefined) {
    const price = parseInt(b.priceCents, 10);
    if (!Number.isInteger(price) || price < 0) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'priceCents must be a non-negative integer.' });
    updates.price_cents = price;
  }
  if (b.interval !== undefined) {
    if (!VALID_INTERVALS.includes(b.interval)) return res.status(400).json({ success: false, error: 'INVALID_INTERVAL', message: `interval must be one of: ${VALID_INTERVALS.join(', ')}.` });
    updates.interval = b.interval;
  }
  if (b.currency !== undefined) updates.currency = b.currency;
  if (b.features !== undefined) updates.features = Array.isArray(b.features) ? b.features : [];
  if (b.maxGuests !== undefined) updates.max_guests = b.maxGuests != null ? parseInt(b.maxGuests, 10) : null;
  if (b.maxEvents !== undefined) updates.max_events = b.maxEvents != null ? parseInt(b.maxEvents, 10) : null;
  if (b.sortOrder !== undefined) updates.sort_order = parseInt(b.sortOrder, 10) || 0;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'No updatable fields supplied.' });
  }
  try {
    const { data, error } = await supabase.from('plans').update(updates).eq('id', planId).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'PLAN_NOT_FOUND', message: 'Plan not found.' });
    await logAdminAction(req, { action: 'plan.update', entityType: 'plan', entityId: planId, after: updates });
    return res.json({ success: true, plan: data });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/subscriptions/plans/:planId/active  body: { isActive } */
const setPlanActive = async (req, res, next) => {
  const { planId } = req.params;
  const isActive = !!req.body?.isActive;
  try {
    const { data, error } = await supabase.from('plans').update({ is_active: isActive }).eq('id', planId).select('id, key, is_active').single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'PLAN_NOT_FOUND', message: 'Plan not found.' });
    await logAdminAction(req, { action: isActive ? 'plan.enable' : 'plan.disable', entityType: 'plan', entityId: planId });
    return res.json({ success: true, plan: data });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/admin/subscriptions/plans/:planId */
const deletePlan = async (req, res, next) => {
  const { planId } = req.params;
  try {
    // Refuse deletion if any subscription references the plan; disable instead.
    const { count } = await supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('plan_id', planId);
    if (count && count > 0) {
      return res.status(409).json({ success: false, error: 'PLAN_IN_USE', message: 'Plan has active subscriptions; disable it instead of deleting.' });
    }
    const { error } = await supabase.from('plans').delete().eq('id', planId);
    if (error) throw error;
    await logAdminAction(req, { action: 'plan.delete', entityType: 'plan', entityId: planId });
    return res.json({ success: true, message: 'Plan deleted.' });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/admin/subscriptions  (paginated) */
const listSubscriptions = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['created_at', 'status'], defaultSort: 'created_at' });
  try {
    let query = supabase
      .from('subscriptions')
      .select('*, plans(key, name, price_cents), organizations(name, email)', { count: 'exact' });
    if (req.query.status) query = query.eq('status', req.query.status);
    const { data, error, count } = await applyPagination(query, p);
    if (error) throw error;
    return res.json({ ...buildListResponse(data, p, count), subscriptions: data || [] });
  } catch (err) {
    next(err);
  }
};

module.exports = { listPlans, createPlan, updatePlan, setPlanActive, deletePlan, listSubscriptions };
