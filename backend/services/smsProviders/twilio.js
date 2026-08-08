/**
 * Twilio, behind the provider interface.
 *
 * Every line here is the behaviour that was already running inline in
 * smsDispatch and campaignController — the signature algorithm, the status
 * vocabulary, the credential checks. It is MOVED, not rewritten: this path is
 * compliance-reviewed and is the fallback while Vonage is proven, so a
 * refactor that quietly changed it would be the worst kind of regression.
 *
 * The only new thing is the shape it presents, so a second carrier can exist.
 */
const crypto = require('crypto');
const logger = require('../../utils/logger');
const { getTwilioClient, getTwilioFromNumber } = require('../../utils/twilioClient');

/**
 * Validate Twilio's X-Twilio-Signature without the SDK.
 * HMAC-SHA1( authToken, url + each POST param as key+value in lexical key order ),
 * base64, compared in constant time.
 */
function validateTwilioSignature(authToken, signature, url, params) {
  if (!authToken || !signature) return false;
  let data = String(url);
  for (const k of Object.keys(params || {}).sort()) {
    data += k + (params[k] == null ? '' : params[k]);
  }
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}

/** The URL Twilio signed. Behind a proxy the derived one is http:// and will not match. */
function callbackUrl(req, envVar) {
  return process.env[envVar] || `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

module.exports = {
  name: 'twilio',

  // Twilio's own hard limit on a single message body.
  maxBodyLength: 1600,

  /**
   * Twilio answers HELP itself with the response configured on the number, and
   * does not forward it to this webhook without a Messaging Service (which this
   * codebase does not use). Replying again from here would double-message.
   */
  handlesHelpKeyword: true,

  /**
   * Did TWILIO send this webhook?
   *
   * Used to route a callback to the carrier that actually sent the message rather
   * than to whichever carrier is configured right now — otherwise flipping
   * SMS_PROVIDER strands every receipt still in flight (no refunds) and drops any
   * STOP that arrives at the old number.
   *
   * Detection ROUTES; it never authorizes. Whatever this returns, the request is
   * still signature-verified below with this provider's own credentials.
   */
  matchesWebhook(req) {
    const b = req?.body || {};
    // The header is definitive — no other carrier sends it.
    if (req?.headers?.['x-twilio-signature']) return true;
    // Every Twilio webhook carries the account, and each kind its own id field.
    return !!(b.AccountSid || b.MessageSid || b.SmsSid);
  },

  isConfigured() {
    return !!(process.env.TWILIO_ACCOUNT_SID
      && process.env.TWILIO_AUTH_TOKEN
      && (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER));
  },

  /**
   * A live client, or null when unconfigured. smsDispatch's transport gate reads
   * this: null means "no way to send", and nothing may be billed.
   */
  getTransport() {
    return getTwilioClient();
  },

  /**
   * `transport` is the client smsDispatch already resolved and gated on. Using it
   * rather than resolving a second one keeps ONE decision about whether a send is
   * possible — and lets the suite inject a fake client, which is how the billing
   * and refund paths are exercised without a network.
   *
   * @throws on any failure, so smsDispatch's existing catch refunds the debit.
   */
  async send({ to, body, transport, fromNumber }) {
    const twilio = transport || getTwilioClient();
    const params = { body, from: fromNumber || getTwilioFromNumber(), to };

    // Ask for delivery receipts so undelivered messages can be reconciled and
    // auto-refunded (reconcile_sms_delivery / the status webhook).
    const cb = process.env.SMS_STATUS_CALLBACK_URL;
    if (cb) params.statusCallback = cb;

    const msg = await twilio.messages.create(params);
    // Twilio reports no price at send time; cost is estimated from config.
    return { id: msg.sid, costCents: null };
  },

  verifyStatusWebhook(req) {
    return validateTwilioSignature(
      process.env.TWILIO_AUTH_TOKEN,
      req.headers['x-twilio-signature'],
      callbackUrl(req, 'SMS_STATUS_CALLBACK_URL'),
      req.body || {},
    );
  },

  verifyInboundWebhook(req) {
    return validateTwilioSignature(
      process.env.TWILIO_AUTH_TOKEN,
      req.headers['x-twilio-signature'],
      callbackUrl(req, 'SMS_INBOUND_WEBHOOK_URL'),
      req.body || {},
    );
  },

  /**
   * Twilio's delivery statuses, normalized to ours. `failed` and `undelivered`
   * are the two that mean the guest never received it — the rest are in-flight
   * or success, and must not refund.
   */
  parseStatusWebhook(body = {}) {
    const id = body.MessageSid || body.SmsSid || null;
    const status = String(body.MessageStatus || body.SmsStatus || '').toLowerCase();
    if (!id || !status) return null;
    return {
      id,
      clientRef: null,                    // Twilio has no equivalent; correlation is by SID
      status,
      // Who it was going to — needed to record an opt-out the carrier already knows
      // about (see isBlacklistError).
      to: body.To ? String(body.To).trim() : null,
      failed: status === 'failed' || status === 'undelivered',
      errorCode: body.ErrorCode != null && body.ErrorCode !== '' ? String(body.ErrorCode) : null,
      costCents: null,
    };
  },

  /**
   * 21610 — "Attempt to send to unsubscribed recipient". The carrier is telling us
   * this number opted out, which is knowledge our own suppression list may not
   * have (a STOP can be recorded network-side without the inbound webhook firing).
   */
  isBlacklistError(code) {
    return String(code) === '21610';
  },

  parseInboundWebhook(body = {}) {
    const from = String(body.From || '').trim();
    if (!from) return null;
    return {
      from,
      // Twilio sends the raw body; the keyword is derived by the caller.
      text: String(body.Body || ''),
      messageId: body.MessageSid || body.SmsSid || null,
    };
  },

  /** Twilio's own STOP handling is network-level; we only record it. */
  logConfigWarnings() {
    if (!this.isConfigured()) {
      logger.warn('Twilio selected but not fully configured — SMS is disabled until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER are all set.');
    }
  },
};
