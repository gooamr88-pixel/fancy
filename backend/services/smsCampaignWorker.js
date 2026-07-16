/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ASYNC SMS CAMPAIGN WORKER
 *
 * Drains queued sms_campaigns in paced slices so massive lists (1,000+) never
 * block an HTTP request. Mirrors the email scheduler: a dependency-free interval
 * loop, single-leader in a cluster, best-effort throughout.
 *
 * Per recipient it reuses smsDispatch.sendRecipient → identical atomic, idempotent,
 * segment-accurate billing as the synchronous path, with automatic refunds on
 * failure. Recipients are claimed FOR UPDATE SKIP LOCKED, and any left 'processing'
 * by a crash are re-queued, so the lifecycle is exactly-once-charged and resumable.
 *
 * Lifecycle:  queued → processing → completed | partial | failed
 * ─────────────────────────────────────────────────────────────────────────────
 */
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { getTwilioClient, getTwilioFromNumber } = require('../utils/twilioClient');
const { personalize, getTableMap, sendRecipient, sleep, getOptedOutSet } = require('./smsDispatch');

const INTERVAL_SEC = Math.max(5, parseInt(process.env.SMS_WORKER_INTERVAL_SEC, 10) || 15);
const SLICE = Math.max(10, parseInt(process.env.SMS_WORKER_SLICE, 10) || 100); // recipients/campaign/tick
const SUB_BATCH = 10;        // concurrent sends within a slice
const BATCH_PAUSE_MS = 1000; // pacing between sub-batches (~10 msg/s)
const MAX_CAMPAIGNS_PER_TICK = 5;
const STALE_SECONDS = 300;   // re-queue recipients stuck 'processing' this long
const MAX_RECIPIENT_RETRIES = 3; // max retries per recipient before dead-lettering

const nowISO = () => new Date().toISOString();

/** Persist the outcome of one recipient send onto its job row. */
async function applyRecipientResult(r, result) {
  const patch = { updated_at: nowISO() };
  if (result.kind === 'sent') {
    patch.status = 'sent';
    patch.credits_charged = result.credits || 0;
    patch.sms_sid = result.sid || null;
    patch.ledger_id = result.ledgerId || null;
    patch.error = null;
  } else if (result.kind === 'skipped') {
    patch.status = 'skipped';
    patch.ledger_id = result.ledgerId || r.ledger_id || null;
  } else {
    patch.status = 'failed';
    patch.error = String(result.error || 'FAILED').slice(0, 300);
  }
  await supabase.from('sms_campaign_recipients').update(patch).eq('id', r.id);
}

/** Recompute authoritative counts (single round trip) and finalize when drained. */
async function refreshCampaignProgress(campaignId) {
  const { data: p, error } = await supabase.rpc('sms_campaign_progress', { p_campaign_id: campaignId });
  if (error || !p) return null;

  const pendingLeft = (p.queued || 0) + (p.processing || 0);
  const patch = {
    sent_count: p.sent || 0,
    failed_count: p.failed || 0,
    skipped_count: p.skipped || 0,
    credits_used: p.credits || 0,
    updated_at: nowISO(),
  };
  if (pendingLeft === 0) {
    patch.status = (p.sent || 0) === 0 && (p.failed || 0) > 0
      ? 'failed'
      : ((p.failed || 0) > 0 ? 'partial' : 'completed');
    patch.completed_at = nowISO();
  }
  await supabase.from('sms_campaigns').update(patch).eq('id', campaignId);
  return { pendingLeft, ...p };
}

/** Process up to SLICE recipients of one campaign this tick (paced). */
async function processCampaign(campaign) {
  const eventId = campaign.event_id;

  // 0. Crash recovery — anything stuck mid-flight gets another chance.
  await supabase.rpc('requeue_stale_sms_recipients', { p_campaign_id: campaign.id, p_stale_seconds: STALE_SECONDS }).catch(() => {});

  const { data: event } = await supabase.from('events').select('slug, title').eq('id', eventId).single();
  if (!event) {
    await supabase.from('sms_campaigns').update({ status: 'failed', last_error: 'EVENT_NOT_FOUND', completed_at: nowISO(), updated_at: nowISO() }).eq('id', campaign.id);
    return;
  }

  const tableMap = await getTableMap(eventId);
  const twilio = getTwilioClient();
  const fromNumber = getTwilioFromNumber();

  let processedThisTick = 0;
  while (processedThisTick < SLICE) {
    const limit = Math.min(SUB_BATCH, SLICE - processedThisTick);
    const { data: claimed, error } = await supabase.rpc('claim_sms_recipients', { p_campaign_id: campaign.id, p_limit: limit });
    if (error) { logger.warn({ err: error, campaignId: campaign.id }, '[sms-worker] claim recipients failed'); break; }
    if (!claimed || claimed.length === 0) break; // nothing left to do this tick

    // One suppression lookup per claimed batch (not per message). Fresh enough:
    // a batch is at most SUB_BATCH sends; a STOP landing mid-batch is also
    // blocked by Twilio's carrier-level opt-out. Falls back to sendRecipient's
    // own per-message check if the batch lookup fails.
    let optedOut = null;
    try { optedOut = await getOptedOutSet(claimed.map((r) => r.phone)); }
    catch (e) { logger.warn({ err: e, campaignId: campaign.id }, '[sms-worker] batch opt-out lookup failed; using per-message checks'); }

    await Promise.allSettled(claimed.map(async (r) => {
      const retryCount = r.retry_count || 0;
      try {
        const { body, segments } = personalize(campaign.message_template, {
          slug: event.slug, guestName: r.guest_name, rsvpId: r.rsvp_id,
          tableName: tableMap[r.rsvp_id], eventTitle: event.title,
        });
        const result = await sendRecipient({ eventId, phone: r.phone, body, segments, idemKey: r.idempotency_key, twilio, fromNumber, optedOut });
        await applyRecipientResult(r, result);
      } catch (err) {
        if (retryCount >= MAX_RECIPIENT_RETRIES) {
          // Dead letter: permanently failed after max retries
          logger.error({ recipientId: r.id, phone: r.phone, retryCount, err: err.message }, '[sms-worker] DLQ: recipient permanently failed after max retries');
          await applyRecipientResult(r, { kind: 'failed', error: `DLQ: ${err.message || 'WORKER_ERROR'} (after ${retryCount} retries)` });
        } else {
          // Increment retry count and re-queue for next tick
          logger.warn({ err, recipientId: r.id, retryCount }, '[sms-worker] recipient send errored, will retry');
          await supabase.from('sms_campaign_recipients').update({
            status: 'queued',
            retry_count: retryCount + 1,
            error: String(err.message || 'WORKER_ERROR').slice(0, 300),
            updated_at: nowISO(),
          }).eq('id', r.id);
        }
      }
    }));

    processedThisTick += claimed.length;
    if (twilio && processedThisTick < SLICE) await sleep(BATCH_PAUSE_MS); // pace between sub-batches
  }

  await refreshCampaignProgress(campaign.id);
}

let running = false;
async function runOnce(trigger = 'interval') {
  if (running) return { skipped: true };
  running = true;
  const t0 = Date.now();
  let processed = 0;
  try {
    const { data: campaigns, error } = await supabase
      .from('sms_campaigns')
      .select('id, event_id, message_template, status, started_at')
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: true })
      .limit(MAX_CAMPAIGNS_PER_TICK);
    if (error) { logger.warn({ err: error }, '[sms-worker] failed to load active campaigns'); return { error: true }; }

    for (const c of (campaigns || [])) {
      if (c.status === 'queued') {
        await supabase.from('sms_campaigns').update({ status: 'processing', started_at: nowISO(), updated_at: nowISO() }).eq('id', c.id);
      }
      try {
        await processCampaign(c);
        processed++;
      } catch (err) {
        logger.warn({ err, campaignId: c.id }, '[sms-worker] campaign processing failed');
        await supabase.from('sms_campaigns').update({ last_error: String(err.message || err).slice(0, 300), updated_at: nowISO() }).eq('id', c.id).then(() => {}, () => {});
      }
    }
  } finally {
    running = false;
  }
  if (processed) logger.info({ processed, ms: Date.now() - t0, trigger }, '[sms-worker] tick complete');
  return { processed };
}

/** Fire-and-forget nudge so an enqueued campaign starts draining immediately. */
function kick() {
  setImmediate(() => runOnce('kick').catch((err) => logger.warn({ err }, '[sms-worker] kick failed')));
}

let timer = null;
function start() {
  if (process.env.SMS_WORKER_ENABLED === 'false') {
    logger.info('[sms-worker] disabled via SMS_WORKER_ENABLED=false');
    return;
  }
  // Single-leader in a pm2 cluster: only instance 0 runs the interval (recipient
  // claims are SKIP-LOCKED so an accidental extra runner still can't double-send).
  const instance = process.env.NODE_APP_INSTANCE;
  if (instance !== undefined && instance !== '0') {
    logger.info(`[sms-worker] standby on instance ${instance} (leader is instance 0)`);
    return;
  }
  logger.info(`[sms-worker] enabled — draining campaigns every ${INTERVAL_SEC}s`);
  timer = setInterval(() => runOnce('interval').catch(() => {}), INTERVAL_SEC * 1000);
  if (timer.unref) timer.unref();
  setTimeout(() => runOnce('startup').catch(() => {}), 10 * 1000).unref();
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, runOnce, kick, processCampaign, refreshCampaignProgress };
