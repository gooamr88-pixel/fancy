require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mockRes } = require('./helpers/http');
const { csrfOriginGuard } = require('../middleware/csrf');

// FRONTEND_URL is unset in tests → allowlist defaults to http://localhost:3000.
const run = (overrides) => {
  const res = mockRes();
  let nextCalled = false;
  const req = { method: 'POST', originalUrl: '/api/v1/events', headers: {}, ...overrides };
  csrfOriginGuard(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
};

test('allows safe methods (GET) regardless of Origin', () => {
  const { nextCalled } = run({ method: 'GET', headers: { origin: 'https://evil.example' } });
  assert.equal(nextCalled, true);
});

test('allows a same-origin POST (Origin on the allowlist)', () => {
  const { nextCalled } = run({ headers: { origin: 'http://localhost:3000' } });
  assert.equal(nextCalled, true);
});

test('M2: BLOCKS a cross-site POST with a forged Origin (403 CSRF_ORIGIN_REJECTED)', () => {
  const { res, nextCalled } = run({ headers: { origin: 'https://evil.example' } });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'CSRF_ORIGIN_REJECTED');
});

test('M2: blocks a cross-site POST identified by Referer when Origin is absent', () => {
  const { res, nextCalled } = run({ headers: { referer: 'https://evil.example/attack.html' } });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('non-breaking: allows clients that send neither Origin nor Referer (mobile/API/curl)', () => {
  const { nextCalled } = run({ headers: {} });
  assert.equal(nextCalled, true);
});

test('exempts the Stripe webhook (server-to-server, signature-verified)', () => {
  const { nextCalled } = run({ originalUrl: '/api/v1/payments/webhook', headers: { origin: 'https://api.stripe.com' } });
  assert.equal(nextCalled, true);
});
