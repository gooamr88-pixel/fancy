require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

/**
 * THE CARRIER SWAP.
 *
 * Twilio's toll-free verification is pending, so Vonage has to be able to carry
 * the same traffic. Everything above the transport — consent, STOP suppression,
 * atomic billing, refund-on-failure — is carrier-blind by design, and these tests
 * are what keep it that way.
 *
 * Two properties matter above all:
 *
 *   1. BOTH CARRIERS SPEAK OUR VOCABULARY. reconcile_sms_delivery understands
 *      `failed`; Vonage says `rejected` / `expired` / non-zero `err-code`. If a
 *      provider leaks its own dialect upward, failed messages stop being refunded
 *      and nobody notices until the ledger is audited.
 *
 *   2. A REJECTED SEND THROWS. Vonage returns HTTP 200 for a message it refused,
 *      with the real outcome in a string field. Treating 200 as success — the
 *      natural way to write it — would bill for messages that never left.
 */

const { PROVIDERS, resolveProvider, DEFAULT_PROVIDER } = require('../services/smsProviders');
const twilio = PROVIDERS.twilio;
const vonage = PROVIDERS.vonage;

const ENV_KEYS = [
  'SMS_PROVIDER', 'VONAGE_API_KEY', 'VONAGE_API_SECRET', 'VONAGE_FROM',
  'VONAGE_SIGNATURE_SECRET', 'VONAGE_SIGNATURE_METHOD', 'SMS_STATUS_CALLBACK_URL',
  'VONAGE_CARRIER_HELP', 'SMS_INBOUND_WEBHOOK_URL',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
];
let saved;
t.beforeEach(() => { saved = {}; for (const k of ENV_KEYS) saved[k] = process.env[k]; });
t.afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const configureVonage = () => {
  process.env.VONAGE_API_KEY = 'abcd1234';
  process.env.VONAGE_API_SECRET = 'topsecret';
  process.env.VONAGE_FROM = '+15551110000';
};

/** Stub global fetch for one call, capturing what was sent. */
function stubFetch(response, { ok = true, status = 200 } = {}) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { ok, status, json: async () => response };
  };
  return { calls, restore: () => { global.fetch = original; } };
}

/* ── Selection ───────────────────────────────────────────────────────────── */

test('SMS_PROVIDER selects the carrier, and defaults to Twilio', () => {
  delete process.env.SMS_PROVIDER;
  assert.equal(resolveProvider().name, DEFAULT_PROVIDER,
    'an unset value must keep the reviewed, working carrier');

  process.env.SMS_PROVIDER = 'vonage';
  assert.equal(resolveProvider().name, 'vonage');

  process.env.SMS_PROVIDER = 'TWILIO';   // case/whitespace tolerant
  assert.equal(resolveProvider().name, 'twilio');
});

test('a typo in SMS_PROVIDER falls back rather than crashing the API', () => {
  process.env.SMS_PROVIDER = 'vonagge';
  assert.equal(resolveProvider().name, DEFAULT_PROVIDER,
    'a misspelling should degrade to the working carrier, not take the server down at boot');
});

test('both providers implement the whole interface', () => {
  const required = ['name', 'maxBodyLength', 'isConfigured', 'getTransport', 'send',
    'verifyStatusWebhook', 'verifyInboundWebhook', 'parseStatusWebhook', 'parseInboundWebhook'];
  for (const p of [twilio, vonage]) {
    for (const key of required) {
      assert.ok(p[key] !== undefined, `${p.name} is missing ${key}`);
    }
  }
});

test('smsEnabled() follows the ACTIVE carrier, not whichever keys happen to exist', () => {
  const restore = { ...process.env };
  try {
    process.env.SMS_ENABLED = 'true';
    process.env.SMS_PROVIDER = 'vonage';
    delete process.env.VONAGE_API_KEY;
    delete process.env.VONAGE_API_SECRET;
    delete process.env.VONAGE_FROM;

    delete require.cache[require.resolve('../config/features')];
    let { smsEnabled } = require('../config/features');
    assert.equal(smsEnabled(), false,
      'leftover Twilio keys must not make an unconfigured Vonage look ready');

    configureVonage();
    delete require.cache[require.resolve('../config/features')];
    ({ smsEnabled } = require('../config/features'));
    assert.equal(smsEnabled(), true);
  } finally {
    process.env = restore;
    delete require.cache[require.resolve('../config/features')];
  }
});

/* ── Vonage send ─────────────────────────────────────────────────────────── */

test('the send body matches the documented SMS API shape', async () => {
  configureVonage();
  process.env.SMS_STATUS_CALLBACK_URL = 'https://x.co/status';
  const f = stubFetch({ 'message-count': '1', messages: [{ 'message-id': 'ID1', status: '0', 'message-price': '0.0333' }] });
  try {
    const res = await vonage.send({ to: '+15559998888', body: 'Hello', clientRef: 'smstx:rsvp_reminder:rsvp:abc' });

    const sent = f.calls[0].body;
    assert.match(f.calls[0].url, /rest\.nexmo\.com\/sms\/json$/);
    assert.equal(sent.api_key, 'abcd1234');
    assert.equal(sent.api_secret, 'topsecret');
    assert.equal(sent.text, 'Hello');
    assert.equal(sent['status-report-req'], 1, 'delivery receipts drive the auto-refund');
    assert.equal(sent.callback, 'https://x.co/status');
    assert.equal(sent['client-ref'], 'smstx:rsvp_reminder:rsvp:abc');
    assert.equal(res.id, 'ID1');
  } finally { f.restore(); }
});

test('numbers are sent without the leading +', async () => {
  configureVonage();
  const f = stubFetch({ messages: [{ 'message-id': 'ID1', status: '0' }] });
  try {
    await vonage.send({ to: '+15559998888', body: 'Hi' });
    assert.equal(f.calls[0].body.to, '15559998888');
    assert.equal(f.calls[0].body.from, '15551110000');
  } finally { f.restore(); }
});

test('Arabic is sent as unicode — the trap Twilio hides', async () => {
  configureVonage();
  const f = stubFetch({ messages: [{ 'message-id': 'ID1', status: '0' }] });
  try {
    await vonage.send({ to: '+15551234567', body: 'مرحبا بك في حفلنا' });
    assert.equal(f.calls[0].body.type, 'unicode',
      'left as "text" an Arabic message arrives as question marks — Vonage does not auto-detect');
  } finally { f.restore(); }
});

test('plain Latin text is not needlessly sent as unicode', async () => {
  configureVonage();
  const f = stubFetch({ messages: [{ 'message-id': 'ID1', status: '0' }] });
  try {
    await vonage.send({ to: '+15551234567', body: 'See you at the wedding' });
    assert.equal(f.calls[0].body.type, 'text',
      'unicode would halve the characters per part and double the bill for nothing');
  } finally { f.restore(); }
});

test('a rejected message THROWS even though the HTTP call succeeded', async () => {
  configureVonage();
  const f = stubFetch({ messages: [{ status: '4', 'error-text': 'Bad Credentials' }] });
  try {
    await assert.rejects(
      () => vonage.send({ to: '+15551234567', body: 'Hi' }),
      /VONAGE_4/,
      'a 200 with status!=0 must reach smsDispatch as a throw, or the wallet is charged for nothing',
    );
  } finally { f.restore(); }
});

test('a partly-rejected multi-part send fails as a whole', async () => {
  configureVonage();
  const f = stubFetch({ messages: [
    { 'message-id': 'A', status: '0' },
    { 'message-id': 'B', status: '9', 'error-text': 'Partner quota exceeded' },
  ] });
  try {
    await assert.rejects(() => vonage.send({ to: '+15551234567', body: 'x'.repeat(400) }),
      /VONAGE_9/, 'half a message delivered is not a success');
  } finally { f.restore(); }
});

test('multi-part success takes the first id and SUMS the real price', async () => {
  configureVonage();
  const f = stubFetch({ messages: [
    { 'message-id': 'A', status: '0', 'message-price': '0.0100' },
    { 'message-id': 'B', status: '0', 'message-price': '0.0200' },
  ] });
  try {
    const res = await vonage.send({ to: '+15551234567', body: 'long' });
    assert.equal(res.id, 'A');
    assert.ok(Math.abs(res.costCents - 3) < 0.0001,
      'the carrier price is what makes the admin P&L measured instead of estimated');
  } finally { f.restore(); }
});

test('an HTTP error throws so the refund path runs', async () => {
  configureVonage();
  const f = stubFetch({}, { ok: false, status: 503 });
  try {
    await assert.rejects(() => vonage.send({ to: '+15551234567', body: 'Hi' }), /VONAGE_HTTP_503/);
  } finally { f.restore(); }
});

/* ── Status normalization ────────────────────────────────────────────────── */

test("Vonage's failure vocabulary maps onto ours", () => {
  const cases = [
    [{ messageId: 'X', status: 'delivered', 'err-code': '0' }, false],
    [{ messageId: 'X', status: 'accepted', 'err-code': '0' }, false],
    [{ messageId: 'X', status: 'failed', 'err-code': '0' }, true],
    [{ messageId: 'X', status: 'rejected', 'err-code': '0' }, true],
    [{ messageId: 'X', status: 'expired', 'err-code': '0' }, true],
    // A non-zero error code is authoritative whatever the word says.
    [{ messageId: 'X', status: 'delivered', 'err-code': '9' }, true],
  ];
  for (const [body, expected] of cases) {
    assert.equal(vonage.parseStatusWebhook(body).failed, expected,
      `${body.status}/err-code=${body['err-code']} should be failed=${expected}`);
  }
});

test('Twilio status normalization is unchanged', () => {
  assert.equal(twilio.parseStatusWebhook({ MessageSid: 'SM1', MessageStatus: 'delivered' }).failed, false);
  assert.equal(twilio.parseStatusWebhook({ MessageSid: 'SM1', MessageStatus: 'undelivered' }).failed, true);
  assert.equal(twilio.parseStatusWebhook({ MessageSid: 'SM1', MessageStatus: 'failed' }).failed, true);
  assert.equal(twilio.parseStatusWebhook({ MessageSid: 'SM1', MessageStatus: 'queued' }).failed, false);
});

test('a delivery receipt carries the real price and the client ref', () => {
  const parsed = vonage.parseStatusWebhook({
    messageId: 'ID1', status: 'delivered', 'err-code': '0', price: '0.0333', 'client-ref': 'smstx:x:y',
  });
  assert.equal(parsed.clientRef, 'smstx:x:y');
  assert.ok(Math.abs(parsed.costCents - 3.33) < 0.0001);
});

/* ── Inbound ─────────────────────────────────────────────────────────────── */

test('inbound restores the + and prefers the keyword Vonage already extracted', () => {
  const parsed = vonage.parseInboundWebhook({ msisdn: '15551234567', text: 'STOP', keyword: 'STOP', messageId: 'M1' });
  assert.equal(parsed.from, '+15551234567',
    'sms_opt_outs is keyed on +E.164; a bare msisdn would never match a stored number');
  assert.equal(parsed.keyword, 'STOP');
});

/* ── Signature verification ──────────────────────────────────────────────── */

/** Build a correctly-signed parameter set the way Vonage documents. */
function sign(params, secret, method) {
  const sig = vonage.__computeSignature(params, secret, method);
  return { ...params, sig };
}

test('a correctly signed webhook passes, on every supported algorithm', () => {
  configureVonage();
  process.env.VONAGE_SIGNATURE_SECRET = 'sekrit';
  for (const method of ['md5hash', 'md5', 'sha1', 'sha256', 'sha512']) {
    process.env.VONAGE_SIGNATURE_METHOD = method;
    const body = sign({ messageId: 'M1', status: 'delivered', timestamp: '1700000000' }, 'sekrit', method);
    assert.equal(vonage.verifyStatusWebhook({ body }), true, `${method} should verify`);
  }
});

test('a tampered value fails verification', () => {
  configureVonage();
  process.env.VONAGE_SIGNATURE_SECRET = 'sekrit';
  process.env.VONAGE_SIGNATURE_METHOD = 'sha256';
  const body = sign({ messageId: 'M1', status: 'delivered' }, 'sekrit', 'sha256');
  body.status = 'failed';   // flipping this is what would trigger a refund
  assert.equal(vonage.verifyStatusWebhook({ body }), false);
});

test('the wrong secret fails verification', () => {
  configureVonage();
  process.env.VONAGE_SIGNATURE_SECRET = 'sekrit';
  process.env.VONAGE_SIGNATURE_METHOD = 'sha256';
  const body = sign({ messageId: 'M1', status: 'delivered' }, 'not-the-secret', 'sha256');
  assert.equal(vonage.verifyStatusWebhook({ body }), false);
});

test('a missing sig fails verification', () => {
  configureVonage();
  process.env.VONAGE_SIGNATURE_SECRET = 'sekrit';
  assert.equal(vonage.verifyStatusWebhook({ body: { messageId: 'M1', status: 'delivered' } }), false);
});

test('& and = inside a value cannot forge a different parameter set', () => {
  // Unescaped, a value containing "&x=y" would be indistinguishable from a real
  // extra parameter, letting a crafted payload collide with a legitimate one.
  const a = vonage.__computeSignature({ text: 'a&b=c' }, 's', 'sha256');
  const b = vonage.__computeSignature({ text: 'a_b_c' }, 's', 'sha256');
  assert.equal(a, b, 'both must reduce to the same escaped form — that is the point of the rule');
});

/* ── The money test ──────────────────────────────────────────────────────── */

test('WITHOUT a signature secret, delivery receipts are REFUSED', () => {
  configureVonage();
  delete process.env.VONAGE_SIGNATURE_SECRET;

  assert.equal(vonage.verifyStatusWebhook({ body: { messageId: 'M1', status: 'failed' } }), false,
    'an unsigned receipt endpoint lets anyone forge a failure and refund a wallet — this is money, not theory');
});

test('WITHOUT a signature secret, inbound STOP is still accepted', () => {
  configureVonage();
  delete process.env.VONAGE_SIGNATURE_SECRET;

  assert.equal(vonage.verifyInboundWebhook({ body: { msisdn: '15551234567', keyword: 'STOP' } }), true,
    'a forged inbound can only suppress a number; dropping a genuine STOP is a TCPA violation, so this fails SAFE');
});

/* ── Twilio's signature — previously untested ────────────────────────────────
 *
 * This is the check that decides whether a delivery receipt may issue a REFUND
 * and whether a STOP is recorded. It had no coverage at all: the algorithm was
 * moved verbatim out of campaignController when the providers were split, and a
 * silent break either way is severe — always-fail means no refunds and dropped
 * opt-outs, always-pass means anyone can forge a failure and mint credit.
 */

const { resolveWebhookProvider } = require('../services/smsProviders');

const configureTwilio = () => {
  process.env.TWILIO_ACCOUNT_SID = 'AC0000000000000000000000000000';
  process.env.TWILIO_AUTH_TOKEN = 'twilio-auth-token';
  process.env.TWILIO_PHONE_NUMBER = '+18005550000';
};

/** Build the signature Twilio would send: HMAC-SHA1(token, url + sorted k+v), base64. */
function twilioSignature(url, params, token) {
  let data = String(url);
  for (const k of Object.keys(params).sort()) data += k + params[k];
  return crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');
}

const TW_URL = 'https://fancyrsvp.com/api/v1/public/sms/status';
const TW_BODY = { MessageSid: 'SM123', MessageStatus: 'delivered', To: '+15551234567' };

test('a correctly signed Twilio receipt passes', () => {
  configureTwilio();
  process.env.SMS_STATUS_CALLBACK_URL = TW_URL;
  const sig = twilioSignature(TW_URL, TW_BODY, 'twilio-auth-token');

  assert.equal(twilio.verifyStatusWebhook({ headers: { 'x-twilio-signature': sig }, body: TW_BODY }), true);
});

test('a tampered Twilio payload fails — the signature covers every parameter', () => {
  configureTwilio();
  process.env.SMS_STATUS_CALLBACK_URL = TW_URL;
  const sig = twilioSignature(TW_URL, TW_BODY, 'twilio-auth-token');

  // Flip "delivered" to "failed" — the exact edit that would trigger a refund.
  const tampered = { ...TW_BODY, MessageStatus: 'failed' };
  assert.equal(twilio.verifyStatusWebhook({ headers: { 'x-twilio-signature': sig }, body: tampered }), false,
    'forging a failure is how you would steal credit; it must not verify');
});

test('the wrong auth token fails', () => {
  configureTwilio();
  process.env.SMS_STATUS_CALLBACK_URL = TW_URL;
  const sig = twilioSignature(TW_URL, TW_BODY, 'someone-elses-token');

  assert.equal(twilio.verifyStatusWebhook({ headers: { 'x-twilio-signature': sig }, body: TW_BODY }), false);
});

test('a missing Twilio signature header fails', () => {
  configureTwilio();
  process.env.SMS_STATUS_CALLBACK_URL = TW_URL;

  assert.equal(twilio.verifyStatusWebhook({ headers: {}, body: TW_BODY }), false);
});

test('the signature is bound to the URL, so a receipt cannot be replayed at the inbound endpoint', () => {
  configureTwilio();
  process.env.SMS_STATUS_CALLBACK_URL = TW_URL;
  process.env.SMS_INBOUND_WEBHOOK_URL = 'https://fancyrsvp.com/api/v1/public/sms/inbound';
  const sig = twilioSignature(TW_URL, TW_BODY, 'twilio-auth-token');

  assert.equal(twilio.verifyInboundWebhook({ headers: { 'x-twilio-signature': sig }, body: TW_BODY }), false);
});

/* ── Cross-carrier webhook routing ───────────────────────────────────────────
 *
 * Receipts and STOP replies arrive long after the send, and carriers retry for
 * hours. Resolving them with SMS_PROVIDER meant a carrier switch made everything
 * still in flight unreadable: old receipts failed verification (so failures were
 * never refunded) and an old STOP parsed to nothing and was silently dropped.
 */

const TWILIO_DLR = { body: { MessageSid: 'SM1', MessageStatus: 'failed', AccountSid: 'AC1' }, headers: {} };
const TWILIO_IN = { body: { From: '+15551234567', Body: 'STOP', MessageSid: 'SM2' }, headers: {} };
const VONAGE_DLR = { body: { messageId: 'V1', status: 'delivered', msisdn: '15551234567' }, headers: {} };
const VONAGE_IN = { body: { msisdn: '15551234567', text: 'STOP', keyword: 'STOP' }, headers: {} };

test('a Twilio webhook is still recognised while Vonage is the active carrier', () => {
  process.env.SMS_PROVIDER = 'vonage';
  configureVonage();

  assert.equal(resolveWebhookProvider(TWILIO_DLR)?.name, 'twilio',
    'a receipt for a message Twilio sent must stay readable after the switch, or its failure never refunds');
  assert.equal(resolveWebhookProvider(TWILIO_IN)?.name, 'twilio',
    'dropping a STOP because the carrier changed is a TCPA violation');
});

test('a Vonage webhook is still recognised while Twilio is the active carrier', () => {
  process.env.SMS_PROVIDER = 'twilio';
  configureTwilio();

  assert.equal(resolveWebhookProvider(VONAGE_DLR)?.name, 'vonage');
  assert.equal(resolveWebhookProvider(VONAGE_IN)?.name, 'vonage');
});

test('the x-twilio-signature header alone identifies Twilio', () => {
  process.env.SMS_PROVIDER = 'vonage';
  assert.equal(resolveWebhookProvider({ headers: { 'x-twilio-signature': 'abc' }, body: {} })?.name, 'twilio');
});

test('a payload resembling neither carrier resolves to nothing', () => {
  process.env.SMS_PROVIDER = 'vonage';
  assert.equal(resolveWebhookProvider({ headers: {}, body: { hello: 'world' } }), null,
    'unknown payloads must not be forced onto a carrier — the handler answers 200 and does nothing');
});

test('routing never authorizes: an identified payload still has to pass that carrier signature', () => {
  process.env.SMS_PROVIDER = 'vonage';
  configureVonage();
  process.env.VONAGE_SIGNATURE_SECRET = 'sec';
  process.env.SMS_STATUS_CALLBACK_URL = TW_URL;   // as production always sets it
  delete process.env.TWILIO_AUTH_TOKEN;

  const matched = resolveWebhookProvider(TWILIO_DLR);
  assert.equal(matched.name, 'twilio', 'it is routed to Twilio…');
  assert.equal(matched.verifyStatusWebhook(TWILIO_DLR), false,
    '…and with no Twilio token it cannot verify, so it is refused rather than trusted');
});

/* ── HELP, and the opt-outs the carrier already knows about ──────────────── */

test('Twilio answers HELP itself; Vonage does not, unless told otherwise', () => {
  assert.equal(twilio.handlesHelpKeyword, true,
    'Twilio replies from the number own configured HELP response — replying again would double-message');

  delete process.env.VONAGE_CARRIER_HELP;
  assert.equal(vonage.handlesHelpKeyword, false,
    'Opt-Out Assist covers 10DLC and short codes, not toll-free, so we must answer HELP ourselves');

  process.env.VONAGE_CARRIER_HELP = 'true';
  assert.equal(vonage.handlesHelpKeyword, true, 'the kill switch turns our reply off once Vonage is confirmed to handle it');
});

test('the HELP reply is one GSM-7 segment and carries what CTIA requires', () => {
  const { HELP_REPLY } = require('../services/smsDispatch');
  assert.ok(HELP_REPLY.length <= 160, `HELP responses must fit 160 chars (got ${HELP_REPLY.length})`);
  assert.ok(/Fancy RSVP/.test(HELP_REPLY), 'must identify the sender');
  assert.ok(/STOP/.test(HELP_REPLY), 'must restate how to opt out');
  assert.ok(/rates may apply/i.test(HELP_REPLY), 'must carry the rates disclosure');
  // eslint-disable-next-line no-control-regex
  assert.ok(!/[^\x00-\x7F]/.test(HELP_REPLY), 'any non-ASCII character would force UCS-2 and halve the segment budget');
});

test('a blacklist error code is recognised as an opt-out the network already made', () => {
  assert.equal(vonage.isBlacklistError('9'), true, 'Vonage 9 = Illegal Number, i.e. blocked by the network after a STOP');
  assert.equal(vonage.isBlacklistError('1'), false);
  assert.equal(twilio.isBlacklistError('21610'), true, 'Twilio 21610 = attempt to send to an unsubscribed recipient');
  assert.equal(twilio.isBlacklistError('30007'), false);
});

test('the destination rides on the parsed receipt, so the opt-out can be recorded against it', () => {
  assert.equal(twilio.parseStatusWebhook({ MessageSid: 'SM1', MessageStatus: 'failed', To: '+15551234567' }).to, '+15551234567');
  assert.equal(vonage.parseStatusWebhook({ messageId: 'V1', status: 'failed', msisdn: '15551234567' }).to, '+15551234567',
    'Vonage omits the +; it is restored so both carriers yield one canonical form');
});
