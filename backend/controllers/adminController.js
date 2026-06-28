const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { parsePagination, applyPagination, buildListResponse, escapeOrSearchTerm } = require('../middleware/pagination');
const { logAdminAction } = require('../middleware/adminAudit');
const { refundEventPayment } = require('../services/stripeRefundService');
const { sendEmailViaBrevo } = require('../utils/notificationService');
const { getEventLiveTemplate, getPublicBaseUrl } = require('../utils/emailTemplates');
const { getPlatformConfig } = require('../utils/configCache');

const VALID_ROLES = ['organizer', 'super_admin'];
const VALID_EVENT_STATUSES = ['draft', 'pending_review', 'active', 'paused', 'completed'];

/**
 * Lists platform users (organizers) with their current role so a Super Admin can
 * promote/demote them. Roles default to 'organizer' when no user_roles row exists.
 * GET /api/v1/admin/users
 */
const listPlatformUsers = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['created_at', 'name', 'email'], defaultSort: 'created_at' });
  try {
    // Paginate organizations first; scope the aggregate queries to this page only
    // (Master Plan B2/B3 — no more unbounded full-table scans).
    let orgQuery = supabase
      .from('organizations')
      .select('id, owner_user_id, name, email, phone, created_at, status', { count: 'exact' });
    if (p.q) {
      const term = escapeOrSearchTerm(p.q);
      orgQuery = orgQuery.or(`name.ilike.${term},email.ilike.${term}`);
    }

    const { data: orgs, error: orgError, count } = await applyPagination(orgQuery, p);
    if (orgError) throw orgError;

    const orgIds = (orgs || []).map(o => o.id);
    const ownerIds = (orgs || []).map(o => o.owner_user_id);

    const [{ data: roles }, { data: events }] = await Promise.all([
      ownerIds.length
        ? supabase.from('user_roles').select('user_id, role').in('user_id', ownerIds)
        : Promise.resolve({ data: [] }),
      orgIds.length
        ? supabase.from('events').select('org_id, is_paid').in('org_id', orgIds)
        : Promise.resolve({ data: [] }),
    ]);

    const eventCountByOrg = new Map();
    (events || []).forEach(e => {
      const c = eventCountByOrg.get(e.org_id) || { total: 0, paid: 0 };
      c.total += 1;
      if (e.is_paid) c.paid += 1;
      eventCountByOrg.set(e.org_id, c);
    });

    const roleByUser = new Map((roles || []).map(r => [r.user_id, r.role]));

    const users = (orgs || []).map(o => {
      const counts = eventCountByOrg.get(o.id) || { total: 0, paid: 0 };
      return {
        userId: o.owner_user_id,
        orgId: o.id,
        name: o.name,
        email: o.email,
        phone: o.phone,
        createdAt: o.created_at,
        status: o.status || 'active',
        eventCount: counts.total,
        paidEventCount: counts.paid,
        role: roleByUser.get(o.owner_user_id) || 'organizer',
      };
    });

    return res.json({ ...buildListResponse(users, p, count), users });
  } catch (err) {
    next(err);
  }
};

/**
 * Assigns a role (organizer | super_admin) to a user.
 * PATCH /api/v1/admin/users/role  body: { userId, role }
 */
const setUserRole = async (req, res, next) => {
  const { userId, role } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'userId and role are required.' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'INVALID_ROLE', message: `role must be one of: ${VALID_ROLES.join(', ')}.` });
  }
  // Prevent a super admin from demoting themselves (avoids accidental lockout).
  if (userId === req.user.id && role !== 'super_admin') {
    return res.status(400).json({
      success: false,
      error: 'SELF_DEMOTION_FORBIDDEN',
      message: 'You cannot remove your own Super Admin role. Ask another Super Admin to do it.',
    });
  }

  try {
    const { data, error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, message: 'User role updated successfully.', userRole: data });
  } catch (err) {
    next(err);
  }
};

/**
 * Platform-wide KPI snapshot for the Super Admin overview tab.
 * GET /api/v1/admin/overview
 */
const getPlatformOverview = async (req, res, next) => {
  try {
    // Single set-based aggregation in Postgres (Master Plan B2 fix) — no more
    // pulling every row into Node.
    const { data, error } = await supabase.rpc('get_executive_overview');
    if (error) throw error;

    const ov = data || {};

    // Build the 6-month trend array (with localized labels) from the byMonth map
    // the RPC returns. This is O(6) — no table scan.
    const byMonth = (ov.revenue && ov.revenue.byMonth) || {};
    const trend = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trend.push({
        month: key,
        label: d.toLocaleString(undefined, { month: 'short' }),
        cents: byMonth[key] || 0,
      });
    }

    return res.json({
      success: true,
      overview: {
        events: ov.events || { total: 0, paid: 0, unpaid: 0, byStatus: {} },
        organizations: ov.organizations || 0,
        rsvps: ov.rsvps || { total: 0, attendingParties: 0, attendingGuests: 0, declined: 0, pending: 0 },
        checkIns: ov.checkIns || 0,
        revenue: {
          grossCents: ov.revenue?.grossCents || 0,
          pendingCents: ov.revenue?.pendingCents || 0,
          refundedCents: ov.revenue?.refundedCents || 0,
          trend,
        },
        sms: ov.sms || { purchased: 0, used: 0, remaining: 0 },
        recentActivity: ov.recentActivity || [],
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Lists every organization on the platform with aggregate stats.
 * GET /api/v1/admin/organizations
 */
const listOrganizations = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['created_at', 'name', 'email'], defaultSort: 'created_at' });
  try {
    let orgQuery = supabase
      .from('organizations')
      .select('id, owner_user_id, name, email, phone, stripe_customer_id, created_at, status', { count: 'exact' });
    if (p.q) {
      const term = escapeOrSearchTerm(p.q);
      orgQuery = orgQuery.or(`name.ilike.${term},email.ilike.${term}`);
    }

    const orgsRes = await applyPagination(orgQuery, p);
    if (orgsRes.error) throw orgsRes.error;

    const pageOrgIds = (orgsRes.data || []).map(o => o.id);

    // Scope event + payment aggregation to the organizations on this page only.
    const [eventsRes, eventIdsForPayments] = await Promise.all([
      pageOrgIds.length
        ? supabase.from('events').select('id, org_id, is_paid, status').in('org_id', pageOrgIds)
        : Promise.resolve({ data: [] }),
      Promise.resolve(null),
    ]);
    if (eventsRes.error) throw eventsRes.error;

    const events = eventsRes.data || [];
    const eventIds = events.map(e => e.id);
    const paymentsRes = eventIds.length
      ? await supabase.from('event_payments').select('event_id, amount_cents, status').in('event_id', eventIds)
      : { data: [] };

    const payments = paymentsRes.data || [];

    // Map event -> org so payment revenue can be attributed back to the org.
    const orgByEvent = new Map(events.map(e => [e.id, e.org_id]));
    const revenueByOrg = new Map();
    payments.forEach(p => {
      if (p.status !== 'completed') return;
      const orgId = orgByEvent.get(p.event_id);
      if (!orgId) return;
      revenueByOrg.set(orgId, (revenueByOrg.get(orgId) || 0) + (p.amount_cents || 0));
    });

    const statsByOrg = new Map();
    events.forEach(e => {
      const s = statsByOrg.get(e.org_id) || { total: 0, paid: 0, active: 0 };
      s.total += 1;
      if (e.is_paid) s.paid += 1;
      if (e.status === 'active') s.active += 1;
      statsByOrg.set(e.org_id, s);
    });

    const organizations = (orgsRes.data || []).map(o => {
      const s = statsByOrg.get(o.id) || { total: 0, paid: 0, active: 0 };
      return {
        id: o.id,
        ownerUserId: o.owner_user_id,
        name: o.name,
        email: o.email,
        phone: o.phone,
        hasStripeCustomer: !!o.stripe_customer_id,
        createdAt: o.created_at,
        status: o.status || 'active',
        eventCount: s.total,
        paidEventCount: s.paid,
        activeEventCount: s.active,
        lifetimeRevenueCents: revenueByOrg.get(o.id) || 0,
      };
    });

    return res.json({ ...buildListResponse(organizations, p, orgsRes.count), organizations });
  } catch (err) {
    next(err);
  }
};

/**
 * Full payment ledger across the platform (any status / method) with org+event
 * context for the revenue tab. GET /api/v1/admin/payments?status=&method=
 */
const listAllPayments = async (req, res, next) => {
  const { status, method } = req.query;
  const p = parsePagination(req, { sortable: ['created_at', 'completed_at', 'amount_cents'], defaultSort: 'created_at' });
  try {
    let query = supabase
      .from('event_payments')
      .select('*, events(title, slug, organizations(name, email))', { count: 'exact' });

    if (status && ['pending', 'completed', 'failed', 'refunded'].includes(status)) {
      query = query.eq('status', status);
    }
    if (method && ['stripe', 'cash_manual'].includes(method)) {
      query = query.eq('payment_method', method);
    }

    const { data, error, count } = await applyPagination(query, p);
    if (error) throw error;

    // Envelope { data, pagination } + legacy `payments` alias for the existing UI.
    return res.json({ ...buildListResponse(data, p, count), payments: data || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * Issues a REAL refund (Master Plan §9 / fixes B1). For card payments this calls
 * Stripe to actually return the money; for offline payments it performs the
 * book-keeping refund. Supports partial refunds via body.amountCents.
 * POST /api/v1/admin/payments/:paymentId/refund  body: { reason?, amountCents? }
 */
const refundPayment = async (req, res, next) => {
  const { paymentId } = req.params;
  const { reason } = req.body || {};
  const amountCents = req.body?.amountCents !== undefined ? parseInt(req.body.amountCents, 10) : undefined;
  try {
    const { data: payment, error: findError } = await supabase
      .from('event_payments')
      .select('id, event_id, status, amount_cents, refund_amount_cents, payment_method, stripe_payment_intent_id')
      .eq('id', paymentId)
      .single();

    if (findError || !payment) {
      return res.status(404).json({ success: false, error: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });
    }
    if (payment.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'NOT_REFUNDABLE', message: 'Only completed payments can be refunded.' });
    }

    let result;
    try {
      result = await refundEventPayment(payment, { actorId: req.user.id, reason, amountCents });
    } catch (refundErr) {
      if (refundErr.code === 'NOT_REFUNDABLE') {
        return res.status(400).json({ success: false, error: 'NOT_REFUNDABLE', message: refundErr.message });
      }
      // Stripe API failures surface as a clear 502 rather than a generic 500.
      if (refundErr.type && String(refundErr.type).startsWith('Stripe')) {
        logger.error({ err: refundErr, paymentId }, 'Stripe refund failed');
        return res.status(502).json({ success: false, error: 'STRIPE_REFUND_FAILED', message: refundErr.message || 'The refund could not be processed by Stripe.' });
      }
      throw refundErr;
    }

    await supabase.from('activity_logs').insert({
      event_id: payment.event_id,
      actor_id: req.user.id,
      action: 'event_payment_refunded',
      entity_type: 'event_payment',
      entity_id: paymentId,
      metadata: { amount_cents: result.amountCents, stripe_refund_id: result.stripeRefundId, offline: result.offline, reason: reason || null },
    });
    await logAdminAction(req, {
      action: 'payment.refund',
      entityType: 'event_payment',
      entityId: paymentId,
      after: { amount_cents: result.amountCents, stripe_refund_id: result.stripeRefundId, offline: result.offline },
      metadata: { reason: reason || null },
    });

    return res.json({
      success: true,
      message: result.offline
        ? 'Offline payment marked as refunded.'
        : `Refunded ${(result.amountCents / 100).toFixed(2)} via Stripe.`,
      refund: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Lists Stripe disputes / chargebacks recorded from webhooks (Master Plan §9).
 * GET /api/v1/admin/payments/disputes
 */
const listDisputes = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['created_at', 'amount_cents'], defaultSort: 'created_at' });
  try {
    const query = supabase
      .from('payment_disputes')
      .select('*, event_payments(event_id, events(title, slug))', { count: 'exact' });
    const { data, error, count } = await applyPagination(query, p);
    if (error) throw error;
    return res.json({ ...buildListResponse(data, p, count), disputes: data || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * Declines a pending manual/cash payment — the money never arrived.
 * Marks the payment 'failed' (not 'refunded', since nothing was collected) and
 * records the reason. The event stays unpaid.
 * POST /api/v1/admin/payments/:paymentId/decline  body: { reason? }
 */
const declineManualPayment = async (req, res, next) => {
  const { paymentId } = req.params;
  const reason = (req.body.reason || '').toString().slice(0, 500);
  try {
    const { data: payment, error: findError } = await supabase
      .from('event_payments')
      .select('id, event_id, status, amount_cents, payment_method')
      .eq('id', paymentId)
      .single();

    if (findError || !payment) {
      return res.status(404).json({ success: false, error: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });
    }
    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'NOT_PENDING', message: 'Only pending payments can be declined.' });
    }

    const { error: updateError } = await supabase
      .from('event_payments')
      .update({
        status: 'failed',
        verified_by: req.user.id,
        verified_at: new Date().toISOString(),
        admin_note: reason || 'Declined — payment not received.',
      })
      .eq('id', paymentId);

    if (updateError) throw updateError;

    await supabase.from('activity_logs').insert({
      event_id: payment.event_id,
      actor_id: req.user.id,
      action: 'event_payment_declined',
      entity_type: 'event_payment',
      entity_id: paymentId,
      metadata: { amount_cents: payment.amount_cents, reason },
    });

    return res.json({ success: true, message: 'Payment declined — money was not received.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates administrative state on any event (status and/or paid flag).
 *
 * Granting a complimentary event (isPaid: true on an unpaid event) requires a
 * tierName + compReason: without a tier, tier_max_guests stays NULL and the
 * RSVP cap silently becomes "unlimited" with no record of why the event was
 * comped. Revoking (isPaid: false) clears the override and its granted tier
 * so a future grant doesn't inherit stale data.
 *
 * PATCH /api/v1/admin/events/:eventId  body: { status?, isPaid?, tierName?, compReason? }
 */
const updateEventAdmin = async (req, res, next) => {
  const { eventId } = req.params;
  const { status, isPaid, tierName, compReason } = req.body;

  const updates = {};
  if (status !== undefined) {
    if (!VALID_EVENT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'INVALID_STATUS', message: `status must be one of: ${VALID_EVENT_STATUSES.join(', ')}.` });
    }
    updates.status = status;
  }
  if (isPaid !== undefined) {
    updates.is_paid = !!isPaid;
    if (isPaid) {
      if (!tierName || !compReason || !compReason.trim()) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'tierName and compReason are required when granting a complimentary event.',
        });
      }
      let adminConfig;
      try {
        adminConfig = await getPlatformConfig();
      } catch {
        return res.status(500).json({ success: false, error: 'CONFIG_ERROR', message: 'Could not retrieve pricing configuration.' });
      }
      const tier = (adminConfig.pricing_tiers || []).find(t => (t.name || '').toLowerCase() === tierName.toLowerCase());
      if (!tier) {
        return res.status(400).json({ success: false, error: 'INVALID_TIER', message: `Pricing tier '${tierName}' not found.` });
      }
      updates.manual_override = true;
      updates.tier_name = tier.name;
      updates.tier_max_guests = Number.isFinite(tier.max_guests) ? tier.max_guests : null;
      updates.comp_reason = compReason.trim();
    } else {
      // Revoking removes the granted tier/reason too — a real Stripe/cash payment
      // re-populates these from checkout metadata, so nothing legitimate is lost.
      updates.manual_override = false;
      updates.tier_name = null;
      updates.tier_max_guests = null;
      updates.comp_reason = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Provide status and/or isPaid to update.' });
  }
  updates.updated_at = new Date().toISOString();

  try {
    // Snapshot prior state + organizer contact so we can notify on the first go-live.
    const { data: prior } = await supabase
      .from('events')
      .select('status, slug, title, organizations(name, email)')
      .eq('id', eventId)
      .single();

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select('id, title, status, is_paid')
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    await supabase.from('activity_logs').insert({
      event_id: eventId,
      actor_id: req.user.id,
      action: 'event_admin_updated',
      entity_type: 'event',
      entity_id: eventId,
      metadata: updates,
    });

    // Notify the organizer the first time their event is promoted to live.
    if (updates.status === 'active' && prior && prior.status !== 'active') {
      const orgEmail = prior.organizations?.email;
      if (orgEmail) {
        try {
          const title = prior.title || data.title || 'Your event';
          const html = getEventLiveTemplate({
            orgName: prior.organizations.name || 'Organizer',
            eventTitle: title,
            eventUrl: `${getPublicBaseUrl()}/${prior.slug || ''}`,
          });
          await sendEmailViaBrevo(orgEmail, `Your Event is Live: ${title}`, html);
        } catch (e) {
          logger.warn({ err: e, eventId }, 'Event-live email failed (non-fatal)');
        }
      }
    }

    return res.json({ success: true, message: 'Event updated.', event: data });
  } catch (err) {
    next(err);
  }
};

/**
 * Grants complimentary SMS credits to an event (admin comp / support gesture).
 * POST /api/v1/admin/events/:eventId/grant-sms  body: { credits }
 */
const grantSmsCredits = async (req, res, next) => {
  const { eventId } = req.params;
  const credits = parseInt(req.body.credits, 10);

  if (!credits || credits <= 0 || credits > 50000) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'credits must be between 1 and 50000.' });
  }

  try {
    // Ensure a wallet exists, then atomically increment via the existing RPC.
    await supabase
      .from('sms_credit_wallets')
      .upsert({ event_id: eventId, credits_purchased: 0, credits_used: 0 }, { onConflict: 'event_id', ignoreDuplicates: true });

    const { error: incError } = await supabase.rpc('increment_sms_credits', {
      p_event_id: eventId,
      p_credit_amount: credits,
    });
    if (incError) throw incError;

    await supabase.from('activity_logs').insert({
      event_id: eventId,
      actor_id: req.user.id,
      action: 'sms_credits_granted',
      entity_type: 'sms_wallet',
      metadata: { credit_count: credits, complimentary: true },
    });

    return res.json({ success: true, message: `Granted ${credits} complimentary SMS credits.` });
  } catch (err) {
    next(err);
  }
};

/**
 * SMS credit wallet overview across all events.
 * GET /api/v1/admin/sms-wallets
 */
const listSmsWallets = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['updated_at', 'credits_remaining', 'credits_purchased'], defaultSort: 'updated_at' });
  try {
    const query = supabase
      .from('sms_credit_wallets')
      .select('event_id, credits_purchased, credits_used, credits_remaining, updated_at, events(title, slug, organizations(name, email))', { count: 'exact' });

    const { data, error, count } = await applyPagination(query, p);
    if (error) throw error;

    return res.json({ ...buildListResponse(data, p, count), wallets: data || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * Global activity feed across all events (audit trail).
 * GET /api/v1/admin/activity?limit=
 */
const getGlobalActivity = async (req, res, next) => {
  const p = parsePagination(req, { sortable: ['created_at'], defaultSort: 'created_at' });
  try {
    const query = supabase
      .from('activity_logs')
      .select('id, action, entity_type, entity_id, metadata, created_at, actor_id, event_id, events(title)', { count: 'exact' });

    const { data, error, count } = await applyPagination(query, p);
    if (error) throw error;

    // Resolve actor_id -> organizer name/email for readable audit rows.
    const actorIds = [...new Set((data || []).map(a => a.actor_id).filter(Boolean))];
    let actorMap = new Map();
    if (actorIds.length) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('owner_user_id, name, email')
        .in('owner_user_id', actorIds);
      actorMap = new Map((orgs || []).map(o => [o.owner_user_id, o]));
    }

    const logs = (data || []).map(a => ({
      id: a.id,
      action: a.action,
      entityType: a.entity_type,
      metadata: a.metadata,
      createdAt: a.created_at,
      eventTitle: a.events?.title || null,
      actor: a.actor_id ? (actorMap.get(a.actor_id)?.name || actorMap.get(a.actor_id)?.email || 'System') : 'System',
    }));

    return res.json({ ...buildListResponse(logs, p, count), logs });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPlatformUsers,
  setUserRole,
  getPlatformOverview,
  listOrganizations,
  listAllPayments,
  listDisputes,
  refundPayment,
  declineManualPayment,
  updateEventAdmin,
  grantSmsCredits,
  listSmsWallets,
  getGlobalActivity,
};
