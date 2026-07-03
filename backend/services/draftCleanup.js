/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ABANDONED DRAFT CLEANUP
 *
 * getEvents returns every event an organizer has ever created, including
 * never-launched drafts from the create-event wizard. Nothing previously
 * expired these — an organizer who starts and abandons the wizard leaves a
 * placeholder row (title "Untitled Event", no real guests, never paid) that
 * accumulates in their dashboard and Drafts tab forever.
 *
 * This periodically deletes events that are still 'draft', were never paid,
 * and haven't been touched in DRAFT_EXPIRY_DAYS — cascades to the (empty,
 * since the event never launched) related rows via existing FK ON DELETE
 * CASCADE, same as the organizer-triggered deleteEvent endpoint.
 *
 * Safety / behaviour (mirrors revenueRollup / emailScheduler / smsCampaignWorker):
 *   • ON by default. Set DRAFT_CLEANUP_ENABLED=false to disable.
 *   • Single-leader: in a pm2 cluster only instance 0 schedules.
 *   • Best-effort: a failed run logs a warning and never crashes the server.
 *   • Re-entrancy guarded so a slow run can't overlap itself.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

let running = false;

/** Delete abandoned drafts once. Resolves regardless of success (best-effort). */
async function runOnce(trigger = 'interval') {
  if (running) {
    logger.info('[draft-cleanup] previous run still in progress — skipping');
    return { ok: false, skipped: true };
  }
  running = true;
  const t0 = Date.now();
  try {
    const expiryDays = Math.max(1, parseInt(process.env.DRAFT_EXPIRY_DAYS, 10) || 30);
    const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: deleted, error } = await supabase
      .from('events')
      .delete()
      .eq('status', 'draft')
      .eq('is_paid', false)
      .lt('updated_at', cutoff)
      .select('id');

    if (error) throw error;

    const count = deleted?.length || 0;
    if (count > 0) {
      logger.info({ count, expiryDays, ms: Date.now() - t0, trigger }, '[draft-cleanup] removed abandoned drafts');
    }
    return { ok: true, count };
  } catch (err) {
    logger.warn({ err, trigger }, '[draft-cleanup] run failed (non-fatal)');
    return { ok: false, error: err };
  } finally {
    running = false;
  }
}

let timer = null;
function start() {
  if (process.env.DRAFT_CLEANUP_ENABLED === 'false') {
    logger.info('[draft-cleanup] disabled via DRAFT_CLEANUP_ENABLED=false');
    return;
  }
  // Single-leader in a pm2 cluster: only instance 0 schedules.
  const instance = process.env.NODE_APP_INSTANCE;
  if (instance !== undefined && instance !== '0') {
    logger.info(`[draft-cleanup] standby on instance ${instance} (leader is instance 0)`);
    return;
  }
  const intervalMin = Math.max(60, parseInt(process.env.DRAFT_CLEANUP_INTERVAL_MIN, 10) || 1440);
  logger.info(`[draft-cleanup] enabled — sweeping abandoned drafts every ${intervalMin} min`);
  timer = setInterval(() => runOnce('interval').catch(() => {}), intervalMin * 60 * 1000);
  if (timer.unref) timer.unref();
  // Prime shortly after boot rather than waiting a full interval on a fresh deploy.
  setTimeout(() => runOnce('startup').catch(() => {}), 30 * 1000).unref();
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, runOnce };
