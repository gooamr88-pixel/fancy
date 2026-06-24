const crypto = require('crypto');
const { getTwilioClient, getTwilioFromNumber } = require('../utils/twilioClient');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const {
  chunk, sleep, normalizePhone, isValidPhone,
  normalizeAudiences, fetchRecipients, getTableMap, personalize, sendRecipient,
} = require('../services/smsDispatch');

/* ─── Tunables ─────────────────────────────────────────────────────────── */
const SYNC_MAX = 50;        // ≤ this many recipients → send inline; else enqueue async
const MAX_TOTAL = 20000;    // absolute upper bound on a single campaign
const BATCH_SIZE = 10;      // concurrent sends per batch (sync path)
const BATCH_PAUSE_MS = 1000;

/**
 * Launch an SMS campaign. Small sends run inline; large ones are enqueued to the
 * async worker and return 202 immediately (no HTTP timeout). Both paths share the
 * exact same atomic, idempotent, segment-accurate billing via smsDispatch.
 *
 * POST /api/v1/events/:eventId/campaigns/send-sms
 * body: { messageTemplate, audience?|audiences?, guestIds?, clientToken?, async? }
 */
const sendBulkSMSCampaign = async (req, res, next) => {
  const { eventId } = req.params;
  const { messageTemplate, audience, audiences, guestIds, clientToken } = req.body || {};
  const forceAsync = req.body?.async === true || req.query?.async === 'true';

  if (!messageTemplate || typeof messageTemplate !== 'string' || !messageTemplate.trim()) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'messageTemplate string is required.' });
  }
  if (messageTemplate.length > 1600) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Message template exceeds the maximum length of 1600 characters.' });
  }

  const useCustom = Array.isArray(guestIds) && guestIds.length > 0;
  const segments = normalizeAudiences(audiences != null ? audiences : audience);
  if (!useCustom && segments.length === 0) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Select at least one valid audience segment.' });
  }

  try {
    const { data: event, error: eventError } = await supabase
      .from('events').select('slug, title').eq('id', eventId).single();
    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    const recipients = await fetchRecipients(eventId, {
      audiences: segments, guestIds: useCustom ? guestIds : null, limit: MAX_TOTAL + 1,
    });

    if (recipients.length === 0) {
      return res.status(200).json({
        success: true, message: 'No matching guests with a valid phone number were found for this segment.',
        sentCount: 0, failedCount: 0, skippedCount: 0, creditsUsed: 0, recipientCount: 0,
      });
    }
    if (recipients.length > MAX_TOTAL) {
      return res.status(413).json({
        success: false, error: 'TOO_MANY_RECIPIENTS',
        message: `This audience has ${recipients.length} recipients, above the ${MAX_TOTAL} per-campaign limit.`,
        recipientCount: recipients.length, maxRecipients: MAX_TOTAL,
      });
    }

    // Fast-fail wallet pre-check (atomic per-message deduction remains the real guard).
    const { data: wallet, error: walletError } = await supabase
      .from('sms_credit_wallets').select('credits_remaining').eq('event_id', eventId).single();
    if (walletError || !wallet) {
      return res.status(402).json({ success: false, error: 'NO_CREDIT_WALLET', message: 'No SMS credit wallet exists for this event. Purchase credits first.' });
    }
    if (wallet.credits_remaining < recipients.length) {
      return res.status(402).json({
        success: false, error: 'INSUFFICIENT_CREDITS',
        message: `This campaign needs at least ${recipients.length} credits (more for multi-segment messages); your wallet has ${wallet.credits_remaining}.`,
        availableCredits: wallet.credits_remaining,
      });
    }

    const audienceLabel = useCustom ? 'custom' : segments.join('+');

    // ── Large (or explicitly async) → enqueue and return immediately ──
    if (recipients.length > SYNC_MAX || forceAsync) {
      return await enqueueCampaign(req, res, { eventId, event, recipients, messageTemplate, audienceLabel, clientToken });
    }

    // ── Small → synchronous bounded/paced dispatch ──
    return await dispatchInline(res, { eventId, event, recipients, messageTemplate, audienceLabel, clientToken });
  } catch (err) {
    next(err);
  }
};

/** Synchronous path for small campaigns. */
async function dispatchInline(res, { eventId, event, recipients, messageTemplate, audienceLabel, clientToken }) {
  const tableMap = await getTableMap(eventId);
  const campaignToken = (typeof clientToken === 'string' && clientToken.trim())
    ? clientToken.trim().slice(0, 80)
    : crypto.randomUUID();

  const prepared = recipients.map((g) => {
    const { body, segments } = personalize(messageTemplate, {
      slug: event.slug, guestName: g.guest_name, rsvpId: g.id, tableName: tableMap[g.id], eventTitle: event.title,
    });
    return { guest: g, body, segments };
  });

  const twilio = getTwilioClient();
  const fromNumber = getTwilioFromNumber();
  const sent = [], failed = [], skipped = [];
  let creditsUsed = 0;

  const batches = chunk(prepared, BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    const results = await Promise.allSettled(batches[i].map(async ({ guest, body, segments }) => {
      const result = await sendRecipient({
        eventId, phone: guest.phone, body, segments,
        idemKey: `sms:${campaignToken}:${guest.id}`, twilio, fromNumber,
      });
      return { guest, result };
    }));
    for (const r of results) {
      if (r.status !== 'fulfilled') { failed.push({ guestId: 'unknown', error: String(r.reason) }); continue; }
      const { guest, result } = r.value;
      if (result.kind === 'sent') { sent.push({ guestId: guest.id, guestName: guest.guest_name }); creditsUsed += result.credits || 0; }
      else if (result.kind === 'skipped') skipped.push({ guestId: guest.id });
      else failed.push({ guestId: guest.id, guestName: guest.guest_name, error: result.error });
    }
    if (twilio && i < batches.length - 1) await sleep(BATCH_PAUSE_MS);
  }

  try {
    await supabase.from('activity_logs').insert({
      event_id: eventId, action: 'sms_campaign_sent', entity_type: 'campaign',
      metadata: { audience: audienceLabel, total_recipients: recipients.length, sent: sent.length, failed: failed.length, skipped: skipped.length, credits_used: creditsUsed, mode: 'sync' },
    });
  } catch (e) { logger.warn({ err: e }, 'SMS campaign audit log failed (non-fatal).'); }

  return res.status(200).json({
    success: true, async: false,
    message: `Campaign complete — sent ${sent.length}, failed ${failed.length}${skipped.length ? `, skipped ${skipped.length}` : ''}.`,
    sentCount: sent.length, failedCount: failed.length, skippedCount: skipped.length,
    creditsUsed, recipientCount: recipients.length,
    failedMessages: failed.slice(0, 100),
  });
}

/** Async path — create the campaign + recipient job rows, then nudge the worker. */
async function enqueueCampaign(req, res, { eventId, event, recipients, messageTemplate, audienceLabel, clientToken }) {
  const token = (typeof clientToken === 'string' && clientToken.trim())
    ? clientToken.trim().slice(0, 80)
    : crypto.randomUUID();

  // Idempotent enqueue: an existing campaign for this token is returned as-is.
  const { data: existing } = await supabase
    .from('sms_campaigns').select('id, status, total_recipients').eq('client_token', token).maybeSingle();
  if (existing) {
    return res.status(202).json({
      success: true, async: true, duplicate: true,
      campaignId: existing.id, status: existing.status, recipientCount: existing.total_recipients,
      message: 'This campaign was already queued.',
    });
  }

  const tableMap = await getTableMap(eventId);
  const rows = recipients
    .map((g) => ({ g, norm: normalizePhone(g.phone) }))
    .filter((x) => isValidPhone(x.norm))
    .map(({ g, norm }) => {
      const { segments } = personalize(messageTemplate, {
        slug: event.slug, guestName: g.guest_name, rsvpId: g.id, tableName: tableMap[g.id], eventTitle: event.title,
      });
      return {
        event_id: eventId, rsvp_id: g.id, guest_name: g.guest_name, phone: norm,
        segments, idempotency_key: `sms:${token}:${g.id}`, status: 'queued',
      };
    });

  if (rows.length === 0) {
    return res.status(200).json({ success: true, async: false, message: 'No recipients with a valid phone number.', recipientCount: 0, sentCount: 0, failedCount: 0, skippedCount: 0, creditsUsed: 0 });
  }
  const estimatedCredits = rows.reduce((s, r) => s + r.segments, 0);

  const { data: campaign, error: cErr } = await supabase
    .from('sms_campaigns')
    .insert({ event_id: eventId, message_template: messageTemplate, audience: audienceLabel, status: 'queued', total_recipients: rows.length, client_token: token })
    .select('id')
    .single();

  if (cErr) {
    // Lost an enqueue race on the unique client_token → return the winner.
    if (cErr.code === '23505') {
      const { data: winner } = await supabase.from('sms_campaigns').select('id, status, total_recipients').eq('client_token', token).maybeSingle();
      if (winner) {
        return res.status(202).json({ success: true, async: true, duplicate: true, campaignId: winner.id, status: winner.status, recipientCount: winner.total_recipients });
      }
    }
    throw cErr;
  }

  // Bulk insert recipient job rows (chunked; idempotent on the unique key).
  for (const part of chunk(rows.map((r) => ({ ...r, campaign_id: campaign.id })), 500)) {
    const { error: rErr } = await supabase.from('sms_campaign_recipients').upsert(part, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if (rErr) logger.warn({ err: rErr, campaignId: campaign.id }, 'recipient batch insert had errors');
  }

  // Nudge the worker so processing starts now rather than at the next interval.
  try { require('../services/smsCampaignWorker').kick(); } catch (e) { logger.warn({ err: e }, 'sms-worker kick failed'); }

  return res.status(202).json({
    success: true, async: true,
    campaignId: campaign.id, status: 'queued',
    recipientCount: rows.length, estimatedCredits,
    message: `Queued ${rows.length} messages for delivery.`,
  });
}

/**
 * Live status of one async campaign (for the dashboard progress UI).
 * GET /api/v1/events/:eventId/campaigns/status/:campaignId
 */
const getCampaignStatus = async (req, res, next) => {
  const { eventId, campaignId } = req.params;
  try {
    const { data: c, error } = await supabase
      .from('sms_campaigns').select('*').eq('id', campaignId).eq('event_id', eventId).single();
    if (error || !c) return res.status(404).json({ success: false, error: 'CAMPAIGN_NOT_FOUND' });

    const processed = (c.sent_count || 0) + (c.failed_count || 0) + (c.skipped_count || 0);
    const total = c.total_recipients || 0;
    return res.json({
      success: true,
      campaign: {
        id: c.id, status: c.status, audience: c.audience,
        totalRecipients: total, sentCount: c.sent_count, failedCount: c.failed_count,
        skippedCount: c.skipped_count, creditsUsed: c.credits_used,
        progress: total > 0 ? Math.round((processed / total) * 100) : 100,
        createdAt: c.created_at, startedAt: c.started_at, completedAt: c.completed_at,
        lastError: c.last_error || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch wallet, recent campaigns, and the credit ledger.
 * GET /api/v1/events/:eventId/campaigns/history
 */
const getCampaignHistory = async (req, res, next) => {
  const { eventId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data: wallet } = await supabase
      .from('sms_credit_wallets').select('*').eq('event_id', eventId).single();

    const { data: config } = await supabase
      .from('super_admin_config').select('sms_rate_cents_per_credit')
      .eq('id', '00000000-0000-0000-0000-000000000000').single();

    const { data: campaigns } = await supabase
      .from('sms_campaigns')
      .select('id, status, audience, total_recipients, sent_count, failed_count, skipped_count, credits_used, created_at, completed_at')
      .eq('event_id', eventId).order('created_at', { ascending: false }).limit(10);

    const { data: ledger, error, count: totalCount } = await supabase
      .from('sms_credit_ledger')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;

    return res.json({
      success: true,
      wallet: wallet || { credits_purchased: 0, credits_used: 0, credits_remaining: 0 },
      campaigns: campaigns || [],
      history: ledger || [],
      smsRateCents: config?.sms_rate_cents_per_credit || 8,
      pagination: { page, limit, count: (ledger || []).length, total: totalCount },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendBulkSMSCampaign,
  getCampaignStatus,
  getCampaignHistory,
};
