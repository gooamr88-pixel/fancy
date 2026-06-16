const { supabase } = require('../config/supabase');

const VALID_ROLES = ['organizer', 'super_admin'];
const VALID_EVENT_STATUSES = ['draft', 'active', 'paused', 'completed'];

/**
 * Lists platform users (organizers) with their current role so a Super Admin can
 * promote/demote them. Roles default to 'organizer' when no user_roles row exists.
 * GET /api/v1/admin/users
 */
const listPlatformUsers = async (req, res, next) => {
  try {
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, owner_user_id, name, email, phone, created_at')
      .order('created_at', { ascending: false });

    if (orgError) throw orgError;

    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (roleError) throw roleError;

    // Per-org event counts (single query, aggregated in JS to avoid N+1).
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('org_id, is_paid');

    if (eventsError) throw eventsError;

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
        eventCount: counts.total,
        paidEventCount: counts.paid,
        role: roleByUser.get(o.owner_user_id) || 'organizer',
      };
    });

    return res.json({ success: true, users });
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
    const [
      eventsRes,
      orgsCountRes,
      rsvpsRes,
      checkInsCountRes,
      paymentsRes,
      walletsRes,
      activityRes,
    ] = await Promise.all([
      supabase.from('events').select('id, status, is_paid, created_at, event_date'),
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      supabase.from('rsvps').select('response, party_size'),
      supabase.from('check_ins').select('id', { count: 'exact', head: true }),
      supabase.from('event_payments').select('amount_cents, status, payment_method, created_at, completed_at'),
      supabase.from('sms_credit_wallets').select('credits_purchased, credits_used'),
      supabase
        .from('activity_logs')
        .select('id, action, entity_type, created_at, event_id, events(title)')
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

    if (eventsRes.error) throw eventsRes.error;

    const events = eventsRes.data || [];
    const eventsByStatus = { draft: 0, active: 0, paused: 0, completed: 0 };
    let paidEvents = 0;
    events.forEach(e => {
      if (eventsByStatus[e.status] !== undefined) eventsByStatus[e.status] += 1;
      if (e.is_paid) paidEvents += 1;
    });

    const rsvps = rsvpsRes.data || [];
    let attendingParties = 0;
    let attendingGuests = 0;
    let declined = 0;
    let pendingRsvps = 0;
    rsvps.forEach(r => {
      if (r.response === 'yes') { attendingParties += 1; attendingGuests += (r.party_size || 1); }
      else if (r.response === 'no') declined += 1;
      else pendingRsvps += 1;
    });

    const payments = paymentsRes.data || [];
    let grossRevenueCents = 0;
    let pendingRevenueCents = 0;
    let refundedCents = 0;
    payments.forEach(p => {
      if (p.status === 'completed') grossRevenueCents += (p.amount_cents || 0);
      else if (p.status === 'pending') pendingRevenueCents += (p.amount_cents || 0);
      else if (p.status === 'refunded') refundedCents += (p.amount_cents || 0);
    });

    // Revenue trend: last 6 months of completed payments, keyed by YYYY-MM.
    const revenueByMonth = {};
    payments.forEach(p => {
      if (p.status !== 'completed') return;
      const d = new Date(p.completed_at || p.created_at);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[key] = (revenueByMonth[key] || 0) + (p.amount_cents || 0);
    });
    const revenueTrend = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueTrend.push({
        month: key,
        label: d.toLocaleString(undefined, { month: 'short' }),
        cents: revenueByMonth[key] || 0,
      });
    }

    const wallets = walletsRes.data || [];
    let smsPurchased = 0;
    let smsUsed = 0;
    wallets.forEach(w => { smsPurchased += (w.credits_purchased || 0); smsUsed += (w.credits_used || 0); });

    return res.json({
      success: true,
      overview: {
        events: {
          total: events.length,
          paid: paidEvents,
          unpaid: events.length - paidEvents,
          byStatus: eventsByStatus,
        },
        organizations: orgsCountRes.count || 0,
        rsvps: {
          total: rsvps.length,
          attendingParties,
          attendingGuests,
          declined,
          pending: pendingRsvps,
        },
        checkIns: checkInsCountRes.count || 0,
        revenue: {
          grossCents: grossRevenueCents,
          pendingCents: pendingRevenueCents,
          refundedCents,
          trend: revenueTrend,
        },
        sms: {
          purchased: smsPurchased,
          used: smsUsed,
          remaining: smsPurchased - smsUsed,
        },
        recentActivity: (activityRes.data || []).map(a => ({
          id: a.id,
          action: a.action,
          entityType: a.entity_type,
          createdAt: a.created_at,
          eventTitle: a.events?.title || null,
        })),
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
  try {
    const [orgsRes, eventsRes, paymentsRes] = await Promise.all([
      supabase
        .from('organizations')
        .select('id, owner_user_id, name, email, phone, stripe_customer_id, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('events').select('id, org_id, is_paid, status'),
      supabase.from('event_payments').select('event_id, amount_cents, status'),
    ]);

    if (orgsRes.error) throw orgsRes.error;
    if (eventsRes.error) throw eventsRes.error;

    const events = eventsRes.data || [];
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
        eventCount: s.total,
        paidEventCount: s.paid,
        activeEventCount: s.active,
        lifetimeRevenueCents: revenueByOrg.get(o.id) || 0,
      };
    });

    return res.json({ success: true, organizations });
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
  try {
    let query = supabase
      .from('event_payments')
      .select('*, events(title, slug, organizations(name, email))')
      .order('created_at', { ascending: false })
      .limit(500);

    if (status && ['pending', 'completed', 'failed', 'refunded'].includes(status)) {
      query = query.eq('status', status);
    }
    if (method && ['stripe', 'cash_manual'].includes(method)) {
      query = query.eq('payment_method', method);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ success: true, payments: data || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * Marks a completed payment as refunded (book-keeping only — does not call Stripe).
 * POST /api/v1/admin/payments/:paymentId/refund
 */
const refundPayment = async (req, res, next) => {
  const { paymentId } = req.params;
  try {
    const { data: payment, error: findError } = await supabase
      .from('event_payments')
      .select('id, event_id, status, amount_cents')
      .eq('id', paymentId)
      .single();

    if (findError || !payment) {
      return res.status(404).json({ success: false, error: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });
    }
    if (payment.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'NOT_REFUNDABLE', message: 'Only completed payments can be refunded.' });
    }

    const { error: updateError } = await supabase
      .from('event_payments')
      .update({ status: 'refunded' })
      .eq('id', paymentId);

    if (updateError) throw updateError;

    await supabase.from('activity_logs').insert({
      event_id: payment.event_id,
      actor_id: req.user.id,
      action: 'event_payment_refunded',
      entity_type: 'event_payment',
      entity_id: paymentId,
      metadata: { amount_cents: payment.amount_cents },
    });

    return res.json({ success: true, message: 'Payment marked as refunded.' });
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
 * PATCH /api/v1/admin/events/:eventId  body: { status?, isPaid? }
 */
const updateEventAdmin = async (req, res, next) => {
  const { eventId } = req.params;
  const { status, isPaid } = req.body;

  const updates = {};
  if (status !== undefined) {
    if (!VALID_EVENT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'INVALID_STATUS', message: `status must be one of: ${VALID_EVENT_STATUSES.join(', ')}.` });
    }
    updates.status = status;
  }
  if (isPaid !== undefined) {
    updates.is_paid = !!isPaid;
    if (isPaid) updates.manual_override = true;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Provide status and/or isPaid to update.' });
  }
  updates.updated_at = new Date().toISOString();

  try {
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
  try {
    const { data, error } = await supabase
      .from('sms_credit_wallets')
      .select('event_id, credits_purchased, credits_used, credits_remaining, updated_at, events(title, slug, organizations(name, email))')
      .order('updated_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    return res.json({ success: true, wallets: data || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * Global activity feed across all events (audit trail).
 * GET /api/v1/admin/activity?limit=
 */
const getGlobalActivity = async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 300);
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('id, action, entity_type, entity_id, metadata, created_at, actor_id, event_id, events(title)')
      .order('created_at', { ascending: false })
      .limit(limit);

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

    return res.json({ success: true, logs });
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
  refundPayment,
  declineManualPayment,
  updateEventAdmin,
  grantSmsCredits,
  listSmsWallets,
  getGlobalActivity,
};
