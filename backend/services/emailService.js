const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { sendEmailViaBrevo } = require('../utils/notificationService');

/**
 * Centralized, idempotent, audited email dispatch.
 *
 * Every automated/transactional email should flow through `dispatch()` so that:
 *   • a (kind, ref) idempotency key prevents duplicate sends (the scheduler can
 *     re-run safely), backed by the UNIQUE index on email_log(kind, ref);
 *   • every send (and failure) is recorded in email_log for a full audit trail.
 *
 * All bookkeeping is best-effort: if email_log doesn't exist yet (migration not
 * applied) the email still sends — the per-entity "*_sent_at" stamps the sweeps
 * use are the primary idempotency guard, this ledger is the safety net + audit.
 */

async function alreadyLogged(kind, ref) {
  if (!ref) return false;
  try {
    const { data } = await supabase
      .from('email_log').select('id').eq('kind', kind).eq('ref', ref).limit(1);
    return !!(data && data.length);
  } catch {
    return false; // table missing → fall through to the per-entity flag guard
  }
}

async function record(kind, ref, recipient, eventId, subject, status, error) {
  try {
    await supabase.from('email_log').insert({
      kind, ref: ref || null, recipient: recipient || null,
      event_id: eventId || null, subject: subject || null, status, error: error || null,
    });
  } catch { /* non-fatal */ }
}

/**
 * @param {{kind:string, ref?:string, to:string, subject:string, html:string, eventId?:string}} o
 * @returns {Promise<{sent:boolean, skipped?:string}>}
 */
async function dispatch({ kind, ref, to, subject, html, eventId }) {
  if (!to) return { sent: false, skipped: 'no_recipient' };
  if (ref && await alreadyLogged(kind, ref)) return { sent: false, skipped: 'duplicate' };

  let ok = false;
  try {
    ok = await sendEmailViaBrevo(to, subject, html);
  } catch (err) {
    logger.warn({ err, kind, to }, 'emailService: send threw');
    ok = false;
  }
  await record(kind, ref, to, eventId, subject, ok ? 'sent' : 'failed', ok ? null : 'delivery_failed');
  return { sent: ok, skipped: false };
}

module.exports = { dispatch, alreadyLogged };
