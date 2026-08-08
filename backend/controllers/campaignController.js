const crypto = require('crypto');
const { SMS_MESSAGE_TYPES, sanitizeSmsSettings } = require('../config/smsMessageTypes');
const { resolveProvider, resolveWebhookProvider } = require('../services/smsProviders');
const { normalizeSmsPricing, maxPerSendFor } = require('../config/smsPricing');
const { getPlatformConfig } = require('../utils/configCache');
const { summarizeBalance, coverageForGuests, explainSkip, isResendable } = require('../utils/smsUsage');
const { normalizeToE164 } = require('../utils/phone');
const { SMS_CONSENT_TEXT_VERSION, logSmsConsentDecision } = require('../utils/smsConsent');
const { describeSmsCharge, volumeDiscountsFromConfig } = require('../utils/pricing');
const { getPublicBaseUrl } = require('../utils/publicUrl');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const {
  chunk, sleep, normalizePhone, isValidPhone,
  normalizeAudiences, fetchRecipients, getTableMap, personalize, sendRecipient,
  getOptedOutSet, canonicalPhone, getConsentedPhoneSet, COMPLIANCE_FOOTER, HELP_REPLY,
} = require('../services/smsDispatch');

/**
 * The per-send cap for this event's organization. `{ maxPerSend: 0 }` = unlimited.
 *
 * Shared by the middleware (explicit recipient lists) and the audience path
 * below, so both answer the ramp-up question identically. Fails OPEN for the same
 * reason the middleware does: this is abuse friction, not an entitlement check,
 * and every gate that protects consent or billing has already run and fails closed.
 */
async function resolveSendLimit(eventId, user, preloadedConfig = null) {
  if (user?.isSuperAdmin) return { maxPerSend: 0, delivered: 0 };
  try {
    const { data: event } = await supabase.from('events').select('org_id').eq('id', eventId).single();
    if (!event?.org_id) return { maxPerSend: 0, delivered: 0 };

    // Callers that already hold the platform config pass it in — the settings
    // endpoint fetches it for the balance summary and would otherwise pay for the
    // identical row twice on one request.
    const [{ data: org }, config] = await Promise.all([
      supabase.from('organizations').select('sms_delivered_total').eq('id', event.org_id).maybeSingle(),
      preloadedConfig ? Promise.resolve(preloadedConfig) : getPlatformConfig().catch(() => null),
    ]);

    const pricing = normalizeSmsPricing(config?.sms_pricing_config);
    const delivered = Number(org?.sms_delivered_total) || 0;
    return { maxPerSend: maxPerSendFor(delivered, pricing.limits.ramp_up), delivered };
  } catch (err) {
    logger.warn({ err, eventId }, 'send-limit lookup failed — allowing the send');
    return { maxPerSend: 0, delivered: 0 };
  }
}

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

  // Terms §5 ("Host Consent Obligations"): every launch requires the organizer's
  // recorded attestation. Recorded on the campaign row (async) or in
  // activity_logs metadata (sync). String 'true' is tolerated for
  // form-encoded/hand-rolled API clients.
  //
  // This is an ADDITIONAL gate, never a substitute for the guest's own consent.
  // Since 2026-08-04 the audience query and sendRecipient both require
  // rsvp_parties.sms_consent = true, so an attestation cannot authorize a send
  // to anyone who did not personally opt in (Twilio TFV 30475).
  const consentAttested = req.body?.consentAttested === true || req.body?.consentAttested === 'true';
  if (!consentAttested) {
    return res.status(400).json({
      success: false, error: 'CONSENT_ATTESTATION_REQUIRED',
      message: "Confirm you have each recipient's prior consent to receive texts about this event before sending.",
    });
  }

  try {
    const { data: event, error: eventError } = await supabase
      .from('events').select('slug, title').eq('id', eventId).single();
    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    let recipients = await fetchRecipients(eventId, {
      audiences: segments, guestIds: useCustom ? guestIds : null, limit: MAX_TOTAL + 1,
    });

    // Opted-out numbers are removed up front so recipient counts and the credit
    // pre-check reflect reality; sendRecipient re-checks per message as the
    // final guard (covers a STOP that arrives after a campaign is queued).
    const optedOut = await getOptedOutSet(recipients.map((r) => r.phone));
    const suppressedCount = recipients.filter((r) => optedOut.has(canonicalPhone(r.phone))).length;
    if (suppressedCount > 0) recipients = recipients.filter((r) => !optedOut.has(canonicalPhone(r.phone)));

    if (recipients.length === 0) {
      return res.status(200).json({
        success: true,
        message: suppressedCount > 0
          ? 'Every matching guest has opted out of SMS — nothing was sent.'
          : 'No matching guests have a recorded SMS consent. A guest can be texted once they opt in on their RSVP form, or once you confirm their consent when adding or importing them.',
        sentCount: 0, failedCount: 0, skippedCount: 0, creditsUsed: 0, recipientCount: 0, suppressedCount,
      });
    }
    if (recipients.length > MAX_TOTAL) {
      return res.status(413).json({
        success: false, error: 'TOO_MANY_RECIPIENTS',
        message: `This audience has ${recipients.length} recipients, above the ${MAX_TOTAL} per-campaign limit.`,
        recipientCount: recipients.length, maxRecipients: MAX_TOTAL,
      });
    }

    // Anti-abuse ramp-up, enforced HERE for audience-based sends. The middleware
    // can only check an explicit recipient list; an audience ("everyone who
    // hasn't replied") has no knowable size until it is resolved, which is now.
    // Same limit, same message, applied at the first point the number exists.
    const sendLimit = await resolveSendLimit(eventId, req.user);
    if (sendLimit.maxPerSend > 0 && recipients.length > sendLimit.maxPerSend) {
      return res.status(429).json({
        success: false, error: 'SEND_LIMIT_EXCEEDED',
        maxPerSend: sendLimit.maxPerSend, requested: recipients.length,
        message: `You can send up to ${sendLimit.maxPerSend} messages at a time while your account is new. This group has ${recipients.length} — send it in smaller batches, or pick a narrower audience. The limit lifts automatically as you send more.`,
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
      return await enqueueCampaign(req, res, { eventId, event, recipients, messageTemplate, audienceLabel, clientToken, suppressedCount });
    }

    // ── Small → synchronous bounded/paced dispatch ──
    // Preloaded consent set: sendRecipient re-verifies consent per message, and
    // without this it would issue one lookup per recipient. Not a substitute for
    // that check — just the batched form of it.
    const consented = await getConsentedPhoneSet(eventId);
    return await dispatchInline(res, { eventId, event, recipients, messageTemplate, audienceLabel, clientToken, suppressedCount, attestedBy: req.user?.id || null, optedOut, consented });
  } catch (err) {
    next(err);
  }
};

/** Synchronous path for small campaigns. */
async function dispatchInline(res, { eventId, event, recipients, messageTemplate, audienceLabel, clientToken, suppressedCount = 0, attestedBy = null, optedOut = null, consented = null }) {
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

  // Whatever the active carrier hands back; null when unconfigured, which
  // sendRecipient's transport gate turns into a skip rather than a charge.
  const twilio = resolveProvider().getTransport();
  const fromNumber = null;
  const sent = [], failed = [], skipped = [];
  let creditsUsed = 0;

  const batches = chunk(prepared, BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    const results = await Promise.allSettled(batches[i].map(async ({ guest, body, segments }) => {
      const result = await sendRecipient({
        eventId, phone: guest.phone, body, segments,
        idemKey: `sms:${campaignToken}:${guest.id}`, twilio, fromNumber, optedOut, consented,
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
      // consent_attested_*: the sync path creates no sms_campaigns row, so the
      // organizer's Terms §5 consent attestation is recorded here instead.
      metadata: { audience: audienceLabel, total_recipients: recipients.length, sent: sent.length, failed: failed.length, skipped: skipped.length, suppressed: suppressedCount, credits_used: creditsUsed, mode: 'sync', consent_attested: true, consent_attested_by: attestedBy, consent_attested_at: new Date().toISOString() },
    });
  } catch (e) { logger.warn({ err: e }, 'SMS campaign audit log failed (non-fatal).'); }

  return res.status(200).json({
    success: true, async: false,
    message: `Campaign complete — sent ${sent.length}, failed ${failed.length}${skipped.length ? `, skipped ${skipped.length}` : ''}.`,
    sentCount: sent.length, failedCount: failed.length, skippedCount: skipped.length,
    creditsUsed, recipientCount: recipients.length, suppressedCount,
    failedMessages: failed.slice(0, 100),
  });
}

/** Async path — create the campaign + recipient job rows, then nudge the worker. */
async function enqueueCampaign(req, res, { eventId, event, recipients, messageTemplate, audienceLabel, clientToken, suppressedCount = 0 }) {
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

  const baseCampaign = { event_id: eventId, message_template: messageTemplate, audience: audienceLabel, status: 'queued', total_recipients: rows.length, client_token: token };
  // Persist the organizer's Terms §5 consent attestation on the campaign row.
  let { data: campaign, error: cErr } = await supabase
    .from('sms_campaigns')
    .insert({ ...baseCampaign, consent_attested_at: new Date().toISOString(), consent_attested_by: req.user?.id || null })
    .select('id')
    .single();

  // Pre-migration tolerance: if consent_attested_* don't exist yet, record the
  // attestation in the log and insert without them (matches the missing-RPC
  // fallbacks elsewhere in the SMS stack).
  if (cErr && /consent_attested/i.test(cErr.message || '')) {
    logger.warn('sms_campaigns.consent_attested_* missing — apply 20260809000000_sms_compliance.sql (attestation recorded in logs only).');
    logger.info({ eventId, attestedBy: req.user?.id || null }, 'SMS campaign consent attestation (schema fallback)');
    ({ data: campaign, error: cErr } = await supabase
      .from('sms_campaigns').insert(baseCampaign).select('id').single());
  }

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
    recipientCount: rows.length, estimatedCredits, suppressedCount,
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
      // The composer needs the EXACT footer the server appends in order to
      // estimate segments — and therefore cost — correctly. It used to keep its
      // own copy of the string, so editing one side silently made every price
      // shown to the organizer wrong. Served from the one definition instead.
      complianceFooter: COMPLIANCE_FOOTER,
      pagination: { page, limit, count: (ledger || []).length, total: totalCount },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Twilio delivery-status webhook → reconcile + auto-refund undelivered/failed SMS.
 * Public + signature-verified. Idempotent: the refund deletes the consumption row,
 * so repeated callbacks for the same SID are no-ops.
 *
 * POST /api/v1/public/sms/status   (Twilio statusCallback target)
 */
const handleSmsStatusCallback = async (req, res) => {
  // Routed by PAYLOAD SHAPE, not by SMS_PROVIDER: a receipt for a message sent
  // before a carrier switch must still be understood, or its failure never
  // refunds. See resolveWebhookProvider.
  const provider = resolveWebhookProvider(req);

  // Resembles neither carrier (mock/dev, a probe, a misconfigured URL) → nothing
  // to reconcile. 200 stops the sender retrying into an endpoint that can never
  // do anything with it.
  if (!provider) return res.status(200).send('ok');

  // Shaped like a carrier we cannot verify. REFUSE rather than trust it: this
  // endpoint issues refunds, so accepting an unverifiable receipt would let anyone
  // who knows the URL mint credit by forging a failure.
  if (!provider.isConfigured()) {
    logger.warn({ provider: provider.name }, 'Rejected SMS status callback: payload is for a carrier that is not configured, so it cannot be verified');
    return res.status(403).send('unverifiable');
  }

  // Both carriers fail closed here, for the same reason: this endpoint triggers
  // automatic refunds, so an unverified request is a request that can move money.
  if (!provider.verifyStatusWebhook(req)) {
    logger.warn({ provider: provider.name }, 'Rejected SMS status callback: signature verification failed');
    return res.status(403).send('invalid signature');
  }

  // Carrier vocabulary in, ours out — reconcile_sms_delivery keeps receiving the
  // `failed`/`delivered` values it already understands, whichever carrier sent.
  const parsed = provider.parseStatusWebhook(req.body || {});
  if (!parsed) return res.status(200).send('ok');

  const { id: sid, status, errorCode } = parsed;
  if (!sid) return res.status(200).send('ok');

  // The carrier knows about an opt-out we may not. On toll-free, STOP is enforced
  // network-side, so a guest can be blocked without our inbound webhook ever seeing
  // the keyword — this receipt is then the ONLY signal. Recording it keeps our
  // suppression list in step with the network instead of paying to retry a number
  // that can never receive. Best-effort: it must never block the refund below.
  if (parsed.to && parsed.errorCode && typeof provider.isBlacklistError === 'function'
      && provider.isBlacklistError(parsed.errorCode)) {
    supabase.from('sms_opt_outs').upsert(
      {
        phone: parsed.to,
        opted_out_at: new Date().toISOString(),
        keyword: 'carrier-blocked',
        message_sid: parsed.id,
        opted_back_in_at: null,
      },
      { onConflict: 'phone' },
    ).then(
      ({ error }) => {
        if (error) logger.warn({ err: error, phone: parsed.to }, 'carrier-reported opt-out not recorded');
        else logger.info({ phone: parsed.to, provider: provider.name, code: parsed.errorCode }, 'Opt-out recorded from carrier delivery receipt');
      },
      (err) => logger.warn({ err, phone: parsed.to }, 'carrier-reported opt-out rejected'),
    );
  }

  // When the carrier reports what it actually charged, record it — that is what
  // turns the admin P&L from an estimate into a measurement.
  if (parsed.costCents != null) {
    supabase.from('sms_credit_ledger').update({ cost_cents: parsed.costCents }).eq('sms_sid', sid)
      .then(({ error }) => { if (error) logger.warn({ err: error, sid }, 'carrier cost stamp failed'); },
            (err) => logger.warn({ err, sid }, 'carrier cost stamp rejected'));
  }

  try {
    const { data, error } = await supabase.rpc('reconcile_sms_delivery', {
      // The RPC decides failure from the status word, so hand it a value it
      // recognises rather than the carrier's own dialect.
      p_sms_sid: sid, p_status: parsed.failed ? 'failed' : (status || 'delivered'), p_error_code: errorCode,
    });
    if (error) {
      const undef = error.code === '42883' || error.code === 'PGRST202' ||
        /Could not find the function|does not exist/i.test(error.message || '');
      if (undef) {
        logger.warn('reconcile_sms_delivery missing — apply 20260628000000_sms_delivery_reconcile.sql');
        return res.status(200).send('ok'); // don't trigger Twilio retry loops
      }
      throw error;
    }
    if (data && data.refunded) {
      logger.info({ sid, status, credits: data.credits, campaignId: data.campaign_id }, 'SMS delivery failed → credits refunded');
      if (data.campaign_id) {
        try { await require('../services/smsCampaignWorker').refreshCampaignProgress(data.campaign_id); } catch (e) { /* best-effort */ }
      }
    }
    return res.status(200).send('ok');
  } catch (err) {
    logger.error({ err, sid, status }, 'SMS status reconciliation failed');
    return res.status(500).send('error'); // 5xx → Twilio retries later
  }
};

/* ─── Inbound SMS (STOP/HELP) webhook ──────────────────────────────────────── */

// CTIA opt-out keyword set (mirrors the Privacy Policy §3 and Terms §5 lists).
const OPT_OUT_KEYWORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']);
const OPT_IN_KEYWORDS = new Set(['start', 'unstop', 'yes']);
const HELP_KEYWORDS = new Set(['help', 'info']);

/**
 * Twilio inbound-message webhook → record STOP/UNSUBSCRIBE/CANCEL/END/QUIT
 * opt-outs (and START/UNSTOP/YES opt-back-ins) in sms_opt_outs, which every
 * send path enforces (smsDispatch.sendRecipient + the campaign audience filter).
 *
 * Auto-replies are deliberately NOT sent from here: toll-free STOP/UNSTOP
 * handling is network-level (cannot be disabled) and sends the carrier-mandated
 * confirmations itself; HELP gets Twilio's default auto-response and is not
 * forwarded to this webhook at all without a Messaging Service (which this
 * codebase does not use). Replying here too would double-message the guest.
 * This webhook is the app-side system of record, returning empty TwiML.
 *
 * POST /api/v1/public/sms/inbound   (Twilio "A message comes in" target)
 */
const handleInboundSms = async (req, res) => {
  // Twilio expects TwiML; Vonage only needs a 200. An empty TwiML document is a
  // valid 200 to both, so one response satisfies either carrier.
  const twiml = () => res.type('text/xml').status(200).send('<Response/>');

  // Routed by PAYLOAD SHAPE (see resolveWebhookProvider): a STOP sent to the
  // previous carrier's number after a switch must still register. Dropping it
  // because the payload is the "wrong" shape is a TCPA violation.
  const provider = resolveWebhookProvider(req);
  // Resembles neither carrier (mock/dev, a probe) → nothing real can arrive here.
  if (!provider) return twiml();
  // Shaped like a carrier we cannot verify: refuse rather than act on it.
  if (!provider.isConfigured()) {
    logger.warn({ provider: provider.name }, 'Rejected inbound SMS webhook: payload is for a carrier that is not configured');
    return res.status(403).send('unverifiable');
  }

  // Note the asymmetry with the status webhook above, which fails CLOSED: a
  // forged inbound can only SUPPRESS a number, and dropping a genuine STOP is a
  // TCPA violation while recording a spurious one is a nuisance. So each provider
  // decides — Twilio always verifies, Vonage accepts unsigned with a warning.
  if (!provider.verifyInboundWebhook(req)) {
    logger.warn({ provider: provider.name }, 'Rejected inbound SMS webhook: signature verification failed');
    return res.status(403).send('invalid signature');
  }

  const parsed = provider.parseInboundWebhook(req.body || {});
  if (!parsed || !parsed.from) return twiml();

  const from = parsed.from;
  const sid = parsed.messageId;
  // Keyword matching per CTIA: single-word commands, case-insensitive, tolerant
  // of trailing punctuation ("STOP.", "Stop!"). Vonage already extracts and
  // uppercases the first word, so its value is preferred when present; Twilio
  // sends the whole body and it is derived here.
  const keyword = String(parsed.keyword || parsed.text || '')
    .trim().toLowerCase().replace(/[.!,]+$/, '');

  try {
    if (OPT_OUT_KEYWORDS.has(keyword)) {
      const { error } = await supabase.from('sms_opt_outs').upsert(
        { phone: from, opted_out_at: new Date().toISOString(), keyword, message_sid: sid, opted_back_in_at: null },
        { onConflict: 'phone' },
      );
      if (error) throw error;
      logger.info({ from, keyword }, 'SMS opt-out recorded');
      return twiml();
    }
    if (OPT_IN_KEYWORDS.has(keyword)) {
      const { error } = await supabase
        .from('sms_opt_outs')
        .update({ opted_back_in_at: new Date().toISOString() })
        .eq('phone', from);
      if (error) throw error;
      logger.info({ from, keyword }, 'SMS opt-back-in recorded');
      return twiml();
    }
    if (HELP_KEYWORDS.has(keyword)) {
      logger.info({ from, provider: provider.name }, 'SMS HELP received');
      // Answer it ourselves only where the carrier does not. Twilio replies from
      // the number's own configured HELP response, so replying here too would
      // double-message; Vonage's keyword service does not cover toll-free, so
      // staying silent there would leave a mandatory CTIA keyword unanswered.
      if (!provider.handlesHelpKeyword) {
        // Deliberately NOT routed through sendTransactionalSms. A legally mandated
        // reply is not a billable message: it must not deduct credits, must not
        // require the paid add-on, and must not be withheld on a zero balance.
        // A failure here is logged, never surfaced — the carrier must still get
        // its 200 or it will retry the opt-out/HELP record indefinitely.
        try {
          await provider.send({ to: from, body: HELP_REPLY, transport: provider.getTransport() });
          logger.info({ from }, 'HELP reply sent (this carrier does not answer HELP itself)');
        } catch (helpErr) {
          logger.error({ err: helpErr, from }, 'HELP reply failed to send');
        }
      }
      return twiml();
    }
    // Any other inbound content: acknowledged, never auto-replied.
    return twiml();
  } catch (err) {
    if (/relation .* does not exist|Could not find the table/i.test(err.message || '') || err.code === '42P01') {
      logger.error('sms_opt_outs missing — apply 20260809000000_sms_compliance.sql. Opt-out NOT recorded!');
      return twiml(); // don't make Twilio retry into the same missing table
    }
    logger.error({ err, from, keyword }, 'Inbound SMS processing failed');
    return res.status(500).send('error'); // 5xx → Twilio retries later
  }
};

/* ─── SMS settings: the add-on's status and the per-type switches ─────────── */

/**
 * Everything the organizer's SMS panel needs, in one call.
 * GET /api/v1/events/:eventId/campaigns/settings
 *
 * Deliberately NOT behind requireSmsAddon: an event that has not bought the add-on
 * is exactly the one that needs to see this screen, so it can be told what SMS
 * would give it and offered the purchase.
 */
const getSmsSettings = async (req, res, next) => {
  const { eventId } = req.params;
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, sms_addon_purchased_at, sms_settings')
      .eq('id', eventId)
      .single();
    if (error || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    // Issued together rather than awaited one after another: none of them depends
    // on another's result, and run sequentially they made the Messages page wait
    // on five separate round trips before rendering a single number.
    const [
      { data: wallet },
      config,
      { count: guestCount },
      { data: skipRows },
      organization,
    ] = await Promise.all([
      supabase.from('sms_credit_wallets')
        .select('credits_purchased, credits_used, credits_remaining, last_used_at')
        .eq('event_id', eventId).maybeSingle(),
      getPlatformConfig().catch(() => null),
      supabase.from('guests').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId).then((r) => r, () => ({ count: 0 })),
      // GROUP BY in the database. This previously pulled up to 5,000 skipped rows
      // and tallied them in JavaScript on every page load, to render six numbers.
      supabase.rpc('sms_skip_summary', { p_event_id: eventId }).then((r) => r, () => ({ data: null })),
      supabase.from('events').select('organizations(sms_consent, sms_phone)')
        .eq('id', eventId).single()
        .then((r) => {
          const o = r.data?.organizations;
          return Array.isArray(o) ? o[0] : o;
        }, () => null),
    ]);

    // Everything already translated into the customer's terms — messages left, a
    // percentage, when one last went out. See utils/smsUsage.js for why that
    // translation lives in one place.
    const balance = summarizeBalance(wallet, config?.sms_pricing_config);

    // How far the remaining balance goes against the guest list as it stands.
    // This is what turns "1,350 messages" into something actionable.
    const coverage = coverageForGuests(balance.remaining, guestCount || 0, config?.sms_pricing_config);

    // Skip totals let the page answer "why didn't my guests get this?" without
    // making the organizer read a log line by line. A null result means the RPC
    // is not applied yet — diagnostic data, so it degrades to empty.
    const skipSummary = (skipRows && typeof skipRows === 'object') ? skipRows : {};

    // The config is already in hand; passing it through saves resolveSendLimit
    // re-fetching the very same row.
    const sendLimit = await resolveSendLimit(eventId, req.user, config);

    return res.json({
      success: true,
      addonActive: !!event.sms_addon_purchased_at,
      purchasedAt: event.sms_addon_purchased_at,
      settings: sanitizeSmsSettings(event.sms_settings),
      messageTypes: SMS_MESSAGE_TYPES,
      wallet: wallet || { credits_purchased: 0, credits_used: 0, credits_remaining: 0 },
      balance,
      coverage,
      sendLimit,
      // The organizer's own opt-in. Without this the settings panel cannot show
      // the state of the one message type addressed to them — which is how it
      // came to ship as a toggle over a flag nothing could set.
      organizerSms: {
        consent: !!organization?.sms_consent,
        phone: organization?.sms_phone || null,
      },
      skipSummary,
      skipLabels: Object.fromEntries(
        Object.keys(skipSummary).map((r) => [r, explainSkip(r)]),
      ),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Record (or withdraw) the ORGANIZER's own opt-in to operational texts.
 * PATCH /api/v1/events/:eventId/campaigns/organizer-sms   body: { phone, consent }
 *
 * This is the missing half of the organizer_report message type. Its consent flag
 * and phone number existed on `organizations` from the day the type shipped, but
 * nothing ever wrote them — so the flag stayed false, every report skipped with
 * NO_CONSENT, and the estimate charged three messages an event for something that
 * could not fire.
 *
 * The organizer is our customer rather than a third party, but that is not a
 * licence to text them unasked. They get the same treatment a guest gets:
 *
 *   • an explicit opt-in, never implied by having an account or buying the add-on
 *   • the canonical consent wording, version-stamped on the record
 *   • an append-only entry in sms_consent_log, refusals included
 *   • the same global STOP suppression — and, as on /sms-opt-in, a deliberate
 *     opt-in here lifts an earlier STOP, because that is plainly a change of mind
 *
 * Scoped to an event route because that is where the settings panel lives, but it
 * writes the ORGANIZATION: one number, one decision, across all their events.
 * verifyEventOwner has already established they own this event, hence the org.
 */
const updateOrganizerSmsConsent = async (req, res, next) => {
  const { eventId } = req.params;
  const consent = req.body?.consent === true || req.body?.consent === 'true';
  const rawPhone = req.body?.phone;

  try {
    const { data: event, error: eventErr } = await supabase
      .from('events').select('org_id').eq('id', eventId).single();
    if (eventErr || !event?.org_id) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    // A consent with nowhere to send is not a consent. Rejected rather than
    // stored, so the organizer is told now instead of wondering later why no
    // alert ever arrived.
    let phone = null;
    if (rawPhone !== undefined && rawPhone !== null && String(rawPhone).trim() !== '') {
      phone = normalizeToE164(rawPhone);
      if (!phone) {
        return res.status(400).json({
          success: false, error: 'VALIDATION_ERROR',
          message: 'Enter a valid phone number in international format (e.g. +1 555 123 4567).',
        });
      }
    }
    if (consent && !phone) {
      return res.status(400).json({
        success: false, error: 'VALIDATION_ERROR',
        message: 'Add a mobile number to receive text alerts.',
      });
    }

    const nowISO = new Date().toISOString();
    const patch = {
      sms_consent: consent,
      sms_consent_at: nowISO,
      sms_phone: phone,
      sms_consent_text_version: consent ? SMS_CONSENT_TEXT_VERSION : null,
      sms_consent_ip: consent ? (req.ip || null) : null,
    };

    const { error: updErr } = await supabase
      .from('organizations').update(patch).eq('id', event.org_id);
    if (updErr) {
      // The provenance columns arrive in 20260821000000; on a database without
      // them the consent itself must still be recordable.
      if (/sms_consent_text_version|sms_consent_ip/i.test(updErr.message || '')) {
        logger.warn('organizations.sms_consent_text_version missing — apply 20260821000000_sms_organizer_optin_and_perf.sql');
        const { error: retryErr } = await supabase
          .from('organizations')
          .update({ sms_consent: consent, sms_consent_at: nowISO, sms_phone: phone })
          .eq('id', event.org_id);
        if (retryErr) throw retryErr;
      } else {
        throw updErr;
      }
    }

    if (phone) {
      // Opting in after a STOP is a change of mind, and the only way to act on it
      // — nothing else can clear a suppression. Matches /sms-opt-in exactly.
      if (consent) {
        const { error: liftErr } = await supabase
          .from('sms_opt_outs')
          .update({ opted_back_in_at: nowISO })
          .eq('phone', phone)
          .is('opted_back_in_at', null);
        if (liftErr) logger.warn({ err: liftErr }, 'organizer opt-in: lifting suppression failed');
      }

      // Logged either way. A dated refusal is evidence the question was asked
      // separately and freely answered — the same reason guest refusals are kept.
      logSmsConsentDecision({
        eventId, phone, consent, source: 'organizer_settings',
      });
    }

    return res.json({
      success: true,
      organizerSms: { consent, phone },
      message: consent
        ? 'You will now get text alerts about your events.'
        : 'Text alerts turned off.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Price a top-up BEFORE the organizer commits to it.
 * GET /api/v1/events/:eventId/campaigns/topup-quote?messages=N
 *
 * Requirement: never let someone reach Stripe and discover the price there. The
 * figure comes from describeSmsCharge — the same function the checkout charges
 * with — so the quote and the invoice cannot disagree.
 *
 * Also returns what that quantity would COVER, because "500 messages for $44" is
 * only meaningful next to "enough for your 180 guests".
 */
const getTopUpQuote = async (req, res, next) => {
  const { eventId } = req.params;
  try {
    const config = await getPlatformConfig();
    const pricing = normalizeSmsPricing(config.sms_pricing_config);

    const requested = Number(req.query.messages);
    const messages = Number.isFinite(requested)
      ? Math.min(Math.max(Math.round(requested), pricing.bounds.min), pricing.bounds.max)
      : pricing.bounds.min;

    const charge = describeSmsCharge({
      unitPriceCents: config.sms_rate_cents_per_credit,
      creditCount: messages,
      markupPct: config.sms_markup_percentage,
      volumeDiscounts: volumeDiscountsFromConfig(config),
    });

    let coverage = null;
    try {
      const { count } = await supabase
        .from('guests').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
      coverage = coverageForGuests(messages, count || 0, config.sms_pricing_config);
    } catch { /* advisory */ }

    return res.json({
      success: true,
      messages,
      priceCents: charge.chargeCents,
      discountPct: charge.discountPct,
      bounds: pricing.bounds,
      coverage,
      // Never expose baseCostCents / profitCents here: this endpoint is reachable
      // by any event owner, and what the carrier charges us is not their business.
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Re-send ONE previously-failed message.
 * POST /api/v1/events/:eventId/campaigns/resend/:logId
 *
 * Requirement: a failed message should be one button, not a whole new campaign.
 * Building a campaign to reach one guest is both absurd and dangerous — the
 * audience filters would sweep in everyone else who matches.
 *
 * Only failures the organizer can actually fix are resendable (see
 * smsUsage.isResendable). A guest who replied STOP, or who never agreed to texts,
 * is not offered a retry: the button would imply it might override their choice,
 * and it never will.
 */
const resendSmsMessage = async (req, res, next) => {
  const { eventId, logId } = req.params;
  try {
    const { data: row, error } = await supabase
      .from('sms_log')
      .select('id, kind, ref, party_id, event_id, status, skip_reason')
      .eq('id', logId)
      .eq('event_id', eventId)   // scope to the authorized event — never trust the id alone
      .maybeSingle();

    if (error || !row) {
      return res.status(404).json({ success: false, error: 'MESSAGE_NOT_FOUND', message: 'That message could not be found.' });
    }
    if (!isResendable(row)) {
      return res.status(400).json({
        success: false, error: 'NOT_RESENDABLE',
        message: row.status === 'sent'
          ? 'That message was already delivered.'
          : `This one can't be resent — ${(explainSkip(row.skip_reason) || 'it could not be delivered').toLowerCase()}.`,
      });
    }

    // Clear the old attempt first. sendTransactionalSms refuses duplicates on
    // (kind, ref), which is exactly right for a scheduler re-run and exactly
    // wrong for a deliberate retry — without this the resend would report
    // "already sent" and do nothing.
    await supabase.from('sms_log').delete().eq('id', row.id);

    const { sendTransactionalSms } = require('../services/smsDispatch');
    const result = await sendTransactionalSms({
      type: row.kind,
      eventId,
      partyId: row.party_id,
      ref: row.ref,
      context: await buildResendContext(eventId, row),
    });

    if (result.sent) {
      return res.json({ success: true, message: 'Message sent.' });
    }
    return res.status(200).json({
      success: false,
      error: result.reason,
      message: `Still not sent — ${(explainSkip(result.reason) || 'it could not be delivered').toLowerCase()}.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Rebuild the template values for a resend.
 *
 * The original context is not stored — sms_log records what happened, not the
 * variables that produced it. Re-deriving from current data is also more correct
 * than replaying stale values: if the guest's name or their table changed since
 * the failed attempt, the resend should carry the new one.
 */
async function buildResendContext(eventId, row) {
  // Seeded with safe defaults for EVERY value any template interpolates. A
  // template reads its context blindly, so a missing key renders the literal
  // "undefined" into a message a guest receives — and an organizer report resent
  // without stats would read "Gala: undefined attending, undefined awaiting
  // reply." Defaults first, real values over the top.
  const ctx = {
    guestName: 'Guest',
    eventTitle: '',
    response: null,
    tableName: null,
    ticketUrl: null,
    dateLabel: 'soon',
    attending: 0,
    pending: 0,
    rsvpUrl: `${getPublicBaseUrl()}/dashboard`,
    dashboardUrl: `${getPublicBaseUrl()}/dashboard`,
  };

  try {
    const { data: event } = await supabase
      .from('events').select('title, slug, event_date').eq('id', eventId).single();
    ctx.eventTitle = event?.title || '';
    if (event?.slug && row.party_id) {
      ctx.rsvpUrl = `${getPublicBaseUrl()}/${event.slug}/rsvp?g=${row.party_id}`;
    }

    if (row.party_id) {
      const { data: party } = await supabase
        .from('rsvp_parties')
        .select('label, response, seating_assignments(tables(table_name))')
        .eq('id', row.party_id).maybeSingle();
      if (party?.label) ctx.guestName = party.label;
      ctx.response = party?.response ?? null;
      ctx.tableName = party?.seating_assignments?.[0]?.tables?.table_name || null;
    }

    // Only the organizer-facing report needs live counts, and only it pays for
    // the extra query.
    if (row.kind === 'organizer_report') {
      const { getEventStats } = require('../utils/emailContext');
      const stats = await getEventStats(eventId);
      ctx.attending = stats?.attending ?? 0;
      ctx.pending = stats?.pending ?? 0;
    }
  } catch { /* the defaults above still render a correct, if plainer, message */ }

  return ctx;
}

/**
 * Update the per-type switches.
 * PATCH /api/v1/events/:eventId/campaigns/settings   body: { settings: {...} }
 *
 * The payload is passed through sanitizeSmsSettings, so unknown keys and
 * non-boolean values can never reach the jsonb column — the switches are read at
 * send time to decide whether to spend an organizer's money, and a smuggled value
 * there would be read as truthy.
 */
const updateSmsSettings = async (req, res, next) => {
  const { eventId } = req.params;
  try {
    const settings = sanitizeSmsSettings(req.body?.settings);
    const { data, error } = await supabase
      .from('events')
      .update({ sms_settings: settings, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .select('id, sms_settings')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    return res.json({ success: true, settings: sanitizeSmsSettings(data.sms_settings) });
  } catch (err) {
    next(err);
  }
};

/**
 * Recent send attempts, skips included.
 * GET /api/v1/events/:eventId/campaigns/log
 *
 * The skipped rows are the point. A campaign reporting "sent 52, skipped 3" is
 * only actionable if the organizer can see WHICH three and WHY.
 */
const getSmsLog = async (req, res, next) => {
  const { eventId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  try {
    const { data, error } = await supabase
      .from('sms_log')
      .select('id, kind, recipient, party_id, status, skip_reason, segments, credits, error, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const rows = data || [];

    // Resolve guest names in ONE query. A log listing phone numbers is unreadable
    // to the organizer and useless to support: nobody recognises +1555… as their
    // aunt, which is the exact question a "why didn't they get it?" ticket asks.
    const partyIds = [...new Set(rows.map((r) => r.party_id).filter(Boolean))];
    const names = {};
    if (partyIds.length > 0) {
      const { data: parties } = await supabase
        .from('rsvp_parties').select('id, label').in('id', partyIds);
      for (const p of (parties || [])) names[p.id] = p.label;
    }

    // Every row is decorated server-side so the reason a message did not arrive is
    // stated identically in the dashboard, in support tooling, and anywhere else
    // this is read — rather than each client inventing its own wording for the
    // same code, or worse, showing the raw code.
    const entries = rows.map((r) => ({
      ...r,
      guestName: r.party_id ? (names[r.party_id] || null) : null,
      // The whole outcome in one readable phrase.
      outcome: r.status === 'sent' ? 'Delivered' : 'Not sent',
      reason: r.status === 'sent' ? null : explainSkip(r.skip_reason || r.error),
      canResend: isResendable(r),
    }));

    return res.json({ success: true, entries });
  } catch (err) {
    // The log is diagnostic; a missing table (migration not yet applied) must
    // degrade to an empty list rather than break the settings screen.
    logger.warn({ err, eventId }, 'sms log read failed — returning empty');
    return res.status(200).json({ success: true, entries: [] });
  }
};

module.exports = {
  sendBulkSMSCampaign,
  getCampaignStatus,
  getCampaignHistory,
  getSmsSettings,
  updateSmsSettings,
  getSmsLog,
  getTopUpQuote,
  resendSmsMessage,
  updateOrganizerSmsConsent,
  handleSmsStatusCallback,
  handleInboundSms,
};
