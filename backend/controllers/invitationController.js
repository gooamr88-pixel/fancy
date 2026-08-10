const invitationService = require('../services/invitationService');
const { sendOk, sendFail } = require('../utils/responseEnvelope');

/**
 * Unified invitation dispatch — one endpoint, one response shape, regardless of
 * channel. Replaces the old two-endpoint split (POST .../send-invitations for
 * email, POST .../campaigns/send-sms for SMS) whose result shapes disagreed
 * (sync counts vs. an async 202 with no counts at all).
 *
 * ── What changed in the four-type rebuild ──
 *
 * The `sms` branch used to FORWARD to the campaign blaster, which wrote directly
 * to `res` — so this file monkey-patched `res.json` and `res.status`, ran the
 * other controller, and rewrote its response on the way out. The restore path
 * lived inside the patched function, which meant any early return that never
 * reached it left `res.json` patched for the rest of the request.
 *
 * It also carried a body shape that made no sense here: `messageTemplate`,
 * `audience`, `clientToken`, `async` — an invitation endpoint accepting free text
 * and an audience segment, because that was what the thing underneath wanted.
 *
 * Now all three channels do the same thing in the same way: take a list of
 * parties, send one templated message each, count the outcomes. The proxy is
 * gone rather than fixed, which is the better outcome — there is no longer
 * anything to keep in sync.
 *
 * POST /api/v1/events/:eventId/invitations/send
 * body (channel: 'email'): { partyIds?: string[], resend?: boolean }
 * body (channel: 'qr'):    { partyIds: string[] }
 * body (channel: 'sms'):   { partyIds: string[] }
 */
const sendInvitations = async (req, res, next) => {
  const { eventId } = req.params;
  const channel = req.body?.channel;

  if (!['email', 'sms', 'qr', 'detail-sms'].includes(channel)) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'channel must be one of: email, sms, qr, detail-sms.' });
  }

  try {
    if (channel === 'email') {
      const { partyIds, resend } = req.body || {};
      const result = await invitationService.sendEmailBulk(eventId, { partyIds, resend: !!resend });
      if (result.code) {
        return sendFail(res, { status: result.code === 'EVENT_NOT_FOUND' ? 404 : 403, error: result.code, message: result.message });
      }
      return sendOk(res, {
        channel: 'email', async: false,
        queued: result.queued, sent: result.sent, skipped: result.skipped, failed: result.failed,
        failures: result.failures || [],
        message: result.message || `Invitations sent: ${result.sent}` + (result.skipped ? `, skipped ${result.skipped}` : '') + (result.failed ? `, failed ${result.failed}` : '') + '.',
      });
    }

    if (channel === 'qr') {
      const { partyIds } = req.body || {};
      if (!Array.isArray(partyIds) || partyIds.length === 0) {
        return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'partyIds is required for the qr channel.' });
      }
      let sent = 0, failed = 0, skipped = 0;
      const failures = [];
      for (const partyId of partyIds) {
        try {
          const r = await invitationService.sendQrTicketEmail(eventId, partyId);
          if (r.sent) sent++;
          else if (r.reason === 'NO_EMAIL') skipped++;
          else { failed++; failures.push({ partyId, reason: r.reason }); }
        } catch (err) {
          failed++; failures.push({ partyId, reason: err.message });
        }
      }
      return sendOk(res, { channel: 'qr', async: false, queued: partyIds.length, sent, skipped, failed, failures });
    }

    /**
     * channel === 'sms' | 'detail-sms'
     *
     * Two message types down one path. 'sms' texts the invitation; 'detail-sms'
     * texts the confirmation carrying their table, who is with them, the meals and
     * their pass link. Same gates, same batching, same billing — the only
     * difference is which template renders, which is why they share this branch
     * rather than getting a second one to keep in sync.
     */
    const { partyIds } = req.body || {};
    if (!Array.isArray(partyIds) || partyIds.length === 0) {
      return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: `partyIds is required for the ${channel} channel.` });
    }

    const result = await invitationService.sendInvitationSmsBulk(eventId, partyIds, {
      user: req.user,
      type: channel === 'detail-sms' ? 'rsvp_confirmation' : 'invitation',
    });
    if (result.code) {
      const status = result.code === 'EVENT_NOT_FOUND' ? 404
        : result.code === 'ADDON_INACTIVE' ? 402
          : result.code === 'SEND_LIMIT' ? 429
            : 400;
      return sendFail(res, { status, error: result.code, message: result.message });
    }

    return sendOk(res, {
      // Echo the channel the caller asked for, not a hardcoded 'sms' — the client
      // keys its per-button spinner off it, so reporting the wrong one leaves the
      // pressed button spinning forever.
      channel, async: false,
      queued: partyIds.length,
      sent: result.sent, skipped: result.skipped, failed: result.failed,
      // Grouped and already in plain language — "3 haven't agreed to receive
      // texts" rather than NO_CONSENT × 3. The email channel returns per-recipient
      // `failures`; SMS returns a grouped `breakdown` because its failures are
      // overwhelmingly one of five shared reasons, and 200 identical rows is not a
      // more useful answer than one row saying 200.
      breakdown: result.breakdown || [],
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendInvitations };
