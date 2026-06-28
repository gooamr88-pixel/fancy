const invitationService = require('../services/invitationService');
const { sendOk, sendFail } = require('../utils/responseEnvelope');

/**
 * Unified invitation dispatch — one endpoint, one response shape, regardless
 * of channel. Replaces the old two-endpoint split (POST .../send-invitations
 * for email, POST .../campaigns/send-sms for SMS) whose result shapes
 * disagreed (sync counts vs. an async 202 with no counts at all).
 *
 * `channel: 'sms'` forwards to the existing campaign dispatcher — that
 * subsystem owns segment-accurate atomic credit billing and sync/async
 * dispatch, and is deliberately not re-derived here (see invitationService.js
 * header comment). Its response is normalized into the same envelope before
 * returning.
 *
 * POST /api/v1/events/:eventId/invitations/send
 * body (channel: 'email'): { partyIds?: string[], resend?: boolean }
 * body (channel: 'qr'):    { partyIds: string[] }
 * body (channel: 'sms'):   { messageTemplate, audience?|audiences?, guestIds?, clientToken?, async? }
 */
const sendInvitations = async (req, res, next) => {
  const { eventId } = req.params;
  const channel = req.body?.channel;

  if (!['email', 'sms', 'qr'].includes(channel)) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'channel must be one of: email, sms, qr.' });
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

    // channel === 'sms' — delegate to the existing campaign dispatcher, then
    // normalize whatever it sent into the unified envelope. It writes directly
    // to `res`, so we intercept via a thin response proxy.
    const campaignController = require('./campaignController');
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    let statusCode = 200;
    res.status = (code) => { statusCode = code; return res; };
    res.json = (body) => {
      const normalized = {
        success: body.success,
        data: body.success ? {
          channel: 'sms',
          async: !!body.async,
          queued: body.recipientCount ?? 0,
          sent: body.sentCount ?? 0,
          skipped: body.skippedCount ?? 0,
          failed: body.failedCount ?? 0,
          creditsUsed: body.creditsUsed,
          campaignId: body.campaignId,
          message: body.message,
        } : undefined,
        error: body.success ? undefined : body.error,
        message: body.success ? undefined : body.message,
      };
      
      originalStatus(statusCode);
      return originalJson(normalized);
    };
    return campaignController.sendBulkSMSCampaign(req, res, next);
  } catch (err) {
    next(err);
  }
};

module.exports = { sendInvitations };
