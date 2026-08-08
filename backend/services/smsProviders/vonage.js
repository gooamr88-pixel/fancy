/**
 * Vonage (SMS API), behind the provider interface.
 *
 * Built on the legacy SMS API — POST https://rest.nexmo.com/sms/json with an
 * api_key/api_secret pair — rather than the Messages API, so going live needs two
 * credentials from the dashboard and no Application, JWT or private key on the
 * server.
 *
 * ── The three places Vonage differs from Twilio in ways that bite ──
 *
 * 1. ENCODING IS NOT AUTOMATIC. Twilio detects Arabic and switches to UCS-2 on
 *    its own. Vonage sends whatever `type` says, so an Arabic message left as
 *    `text` arrives as question marks. We already classify every body to bill it
 *    (utils/smsSegments computeSmsSegments → 'GSM-7' | 'UCS-2'), so `type` is
 *    derived from that same call: the encoding we charge for and the encoding we
 *    send can never disagree.
 *
 * 2. SUCCESS IS A STRING, NOT AN EXCEPTION. A rejected message still returns
 *    HTTP 200 with `status: "4"` and an `error-text`. Treating a 200 as success —
 *    the natural thing to write — would mark undelivered messages as sent and
 *    bill for them. Every entry is checked.
 *
 * 3. A LONG MESSAGE IS N MESSAGES. The response carries one entry per part, each
 *    with its own message-id, and Vonage later sends one delivery receipt per
 *    part. Correlation therefore rides on `client-ref` (echoed on both), and the
 *    repeat receipts are harmless: reconcile_sms_delivery deletes the consumption
 *    row when it refunds, so the second receipt finds nothing and no-ops.
 */
const crypto = require('crypto');
const logger = require('../../utils/logger');
const { computeSmsSegments } = require('../../utils/smsSegments');

const SEND_URL = () => {
  // api | api-eu | api-us | api-ap — the SMS API is served from rest.nexmo.com,
  // which is global; the region var exists so a future move is one env change.
  const host = process.env.VONAGE_API_HOST || 'rest.nexmo.com';
  return `https://${host}/sms/json`;
};

const SIGNATURE_METHODS = new Set(['md5hash', 'md5', 'sha1', 'sha256', 'sha512']);

/**
 * Rebuild Vonage's signature over a webhook's parameters.
 *
 * Documented algorithm: drop `sig`, sort the rest by key, replace `&` and `=`
 * inside VALUES with `_`, join as `&key=value&key=value` (note the leading
 * ampersand), then either append the secret and MD5 it (`md5hash`) or HMAC the
 * string with the secret (`md5` / `sha1` / `sha256` / `sha512`).
 */
function computeSignature(params, secret, method) {
  const parts = Object.keys(params || {})
    .filter((k) => k !== 'sig')
    .sort()
    .map((k) => {
      const raw = params[k] == null ? '' : String(params[k]);
      // `&` and `=` inside a value would otherwise be indistinguishable from the
      // separators, letting a crafted value forge a different parameter set.
      return `&${k}=${raw.replace(/[&=]/g, '_')}`;
    });
  const base = parts.join('');

  if (method === 'md5hash') {
    return crypto.createHash('md5').update(Buffer.from(base + secret, 'utf-8')).digest('hex');
  }
  return crypto.createHmac(method, secret).update(Buffer.from(base, 'utf-8')).digest('hex');
}

/** Constant-time hex comparison, matching how the Twilio signature is compared. */
function signatureMatches(params, secret, method) {
  const received = params?.sig;
  if (!received || !secret) return false;

  let expected;
  try {
    expected = computeSignature(params, secret, method);
  } catch (err) {
    logger.warn({ err, method }, 'Vonage signature computation failed');
    return false;
  }

  const a = Buffer.from(String(expected).toLowerCase());
  const b = Buffer.from(String(received).toLowerCase());
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}

function signatureMethod() {
  const m = String(process.env.VONAGE_SIGNATURE_METHOD || 'sha256').toLowerCase();
  return SIGNATURE_METHODS.has(m) ? m : 'sha256';
}

/** Vonage wants bare digits; our numbers are stored +E.164. */
const stripPlus = (n) => String(n || '').replace(/^\+/, '');

module.exports = {
  name: 'vonage',

  // Same ceiling we already validate against; Vonage concatenates beyond one part.
  maxBodyLength: 1600,

  /**
   * Does the CARRIER answer HELP, or must we?
   *
   * Vonage's keyword service (Opt-Out Assist) is documented for 10DLC and short
   * codes, is opt-in, and does not list toll-free — so on a toll-free number we
   * cannot assume HELP is answered for us. STOP is different and genuinely is
   * network-level: US carriers enforce it and send the "NETWORK MSG:" confirmation
   * themselves, which is why STOP stays un-replied here.
   *
   * The asymmetry is deliberate. Answering HELP when the carrier also answers it
   * costs one duplicate message; NOT answering when nobody does is a CTIA
   * violation. So this defaults to false (we reply) and VONAGE_CARRIER_HELP=true
   * turns our reply off once you have confirmed Vonage handles it.
   */
  get handlesHelpKeyword() {
    return process.env.VONAGE_CARRIER_HELP === 'true';
  },

  /**
   * Did VONAGE send this webhook? See twilio.matchesWebhook for why this exists.
   * Detection ROUTES; it never authorizes — the signature check still runs.
   */
  matchesWebhook(req) {
    const b = req?.body || {};
    // msisdn is on both the delivery receipt and the inbound message; message-id
    // and api-key appear on receipts. Twilio sends none of these.
    return !!(b.msisdn || b['message-id'] || b.messageId || b['api-key'] || b['client-ref']);
  },

  isConfigured() {
    return !!(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET && process.env.VONAGE_FROM);
  },

  /**
   * There is no client object to build — the API is one HTTP call. A truthy
   * sentinel is returned so smsDispatch's transport gate ("is there any way to
   * send?") reads identically for both carriers.
   */
  getTransport() {
    return this.isConfigured() ? { provider: 'vonage' } : null;
  },

  /**
   * @throws on any non-zero status, so smsDispatch's existing catch refunds.
   */
  async send({ to, body, clientRef }) {
    // No `transport` to honour: the SMS API is a single HTTP call, so there is no
    // client object. The suite stubs global fetch instead.
    // The SAME classification that decides what we bill decides what we send.
    const { encoding } = computeSmsSegments(body);

    const payload = {
      api_key: process.env.VONAGE_API_KEY,
      api_secret: process.env.VONAGE_API_SECRET,
      from: stripPlus(process.env.VONAGE_FROM),
      to: stripPlus(to),
      text: body,
      type: encoding === 'UCS-2' ? 'unicode' : 'text',
      'status-report-req': 1,
    };
    // Echoed back on the delivery receipt — how a receipt finds its ledger row
    // when a long message produced several ids. Capped at the documented 100.
    if (clientRef) payload['client-ref'] = String(clientRef).slice(0, 100);
    const cb = process.env.SMS_STATUS_CALLBACK_URL;
    if (cb) payload.callback = cb;

    const res = await fetch(SEND_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`VONAGE_HTTP_${res.status}`);
    }

    const data = await res.json();
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    if (messages.length === 0) throw new Error('VONAGE_EMPTY_RESPONSE');

    // A rejected message still comes back HTTP 200. Any failed part fails the
    // whole send: the guest received a partial message at best, and billing for
    // a fragment is worse than refunding and retrying.
    const failed = messages.find((m) => String(m.status) !== '0');
    if (failed) {
      throw new Error(`VONAGE_${failed.status}: ${failed['error-text'] || 'send rejected'}`);
    }

    // Real carrier cost, summed across parts — better than the config estimate,
    // and what makes the admin P&L measured rather than assumed.
    const priceUnits = messages.reduce((sum, m) => sum + (Number(m['message-price']) || 0), 0);
    const costCents = priceUnits > 0 ? priceUnits * 100 : null;

    return { id: messages[0]['message-id'], costCents };
  },

  /**
   * Delivery receipts FAIL CLOSED without a signature secret.
   *
   * This endpoint triggers automatic refunds. Unsigned, anyone who learns the URL
   * can POST a forged `status=failed` and credit a wallet — a financial hole, not
   * a theoretical one. Refusing every receipt costs delivery reconciliation until
   * the secret is configured; accepting them costs money.
   */
  verifyStatusWebhook(req) {
    const secret = process.env.VONAGE_SIGNATURE_SECRET;
    if (!secret) {
      logger.error('Vonage delivery receipt REFUSED: VONAGE_SIGNATURE_SECRET is not set. Unsigned receipts could be forged to refund credits. Enable signed webhooks in the Vonage dashboard and set the secret.');
      return false;
    }
    return signatureMatches(req.body || {}, secret, signatureMethod());
  },

  /**
   * Inbound FAILS SAFE. A forged inbound can only SUPPRESS a number — recording
   * an unwanted opt-out is a nuisance, while dropping a genuine STOP is a TCPA
   * violation. So an unsigned inbound is accepted with a loud warning rather than
   * refused. When a secret IS configured it is enforced.
   */
  verifyInboundWebhook(req) {
    const secret = process.env.VONAGE_SIGNATURE_SECRET;
    if (!secret) {
      logger.warn('Vonage inbound webhook accepted UNSIGNED (VONAGE_SIGNATURE_SECRET not set). A STOP must never be dropped, so this fails safe — but set the secret.');
      return true;
    }
    return signatureMatches(req.body || {}, secret, signatureMethod());
  },

  /**
   * Vonage reports both a `status` word and an `err-code`. A non-zero err-code is
   * authoritative: the docs state any DLR with a non-zero error code means the
   * message did not reach the handset, whatever the status word says.
   */
  parseStatusWebhook(body = {}) {
    const id = body.messageId || body['message-id'] || null;
    const status = String(body.status || '').toLowerCase();
    if (!id && !body['client-ref']) return null;

    const errCode = body['err-code'] != null && body['err-code'] !== '' ? String(body['err-code']) : null;
    const errored = errCode != null && errCode !== '0';
    const failedStatus = ['failed', 'rejected', 'expired', 'undeliverable'].includes(status);

    const price = Number(body.price);

    return {
      id,
      clientRef: body['client-ref'] || null,
      status,
      // Who it was going to — needed to record an opt-out the network already knows
      // about (see isBlacklistError).
      to: body.msisdn ? `+${stripPlus(body.msisdn)}` : null,
      failed: errored || failedStatus,
      errorCode: errCode,
      costCents: Number.isFinite(price) && price > 0 ? price * 100 : null,
    };
  },

  /**
   * Error 9 — "Illegal Number … you tried to send a message to a blacklisted phone
   * number". On US toll-free, STOP is enforced at network level, so a guest can be
   * blocked by the carrier without our inbound webhook ever seeing the STOP. This
   * receipt is the only signal we get, and ignoring it means paying to retry a
   * number that can never receive.
   */
  isBlacklistError(code) {
    return String(code) === '9';
  },

  parseInboundWebhook(body = {}) {
    const from = body.msisdn ? `+${stripPlus(body.msisdn)}` : '';
    if (!from) return null;
    return {
      from,
      text: String(body.text || ''),
      messageId: body.messageId || null,
      // Vonage already uppercases the first word — exactly what STOP matching wants.
      keyword: body.keyword ? String(body.keyword) : null,
    };
  },

  logConfigWarnings() {
    if (!this.isConfigured()) {
      logger.warn('Vonage selected but not fully configured — SMS is disabled until VONAGE_API_KEY, VONAGE_API_SECRET and VONAGE_FROM are all set.');
    }
    if (!process.env.VONAGE_SIGNATURE_SECRET) {
      logger.warn('VONAGE_SIGNATURE_SECRET is not set — delivery receipts will be REFUSED, so failed messages will not be auto-refunded.');
    }
  },

  // Exported for the signature tests.
  __computeSignature: computeSignature,
};
