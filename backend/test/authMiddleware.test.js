require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, mockRes, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { requireAuth, requireSuperAdmin, verifyEventOwner } = require('../middleware/auth');
const rbac = require('../services/rbacService');

const JWT_SECRET = process.env.JWT_SECRET;
// SEC-6: every session must be server-side revocable, so requireAuth now requires a
// jti and a live session row. These access-gate tests sign with a jti and mock a
// live session (a revoked/forged/no-jti token is covered by the M1 tests below).
const tokenFor = (payload) => jwt.sign({ jti: 'sess-1', ...payload }, JWT_SECRET, { algorithm: 'HS256' });
const LIVE_SESSION = { revoked_at: null, expires_at: null };

t.beforeEach(() => { mock.reset(); rbac.invalidateAll(); });

test('requireAuth rejects a request with no token (401 UNAUTHENTICATED)', async () => {
  const res = mockRes();
  let nextCalled = false;
  await requireAuth(mockReq(), res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'UNAUTHENTICATED');
  assert.equal(nextCalled, false);
});

test('requireAuth rejects a token signed with the wrong secret (401 INVALID_TOKEN)', async () => {
  const forged = jwt.sign({ id: 'u1' }, 'attacker-secret', { algorithm: 'HS256' });
  const res = mockRes();
  await requireAuth(mockReq({ cookies: { fancy_session: forged } }), res, () => {});
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'INVALID_TOKEN');
});

test('requireAuth accepts a valid organizer token and populates req.user', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'sessions') return { data: LIVE_SESSION };
    if (table === 'organizations') return { data: { id: 'org-1', status: 'active' } };
    if (table === 'admin_users') return { data: null };
    return {};
  });
  const req = mockReq({ cookies: { fancy_session: tokenFor({ id: 'u1', email: 'o@x.com', role: 'organizer' }) } });
  let nextCalled = false;
  await requireAuth(req, mockRes(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.user.id, 'u1');
  assert.equal(req.user.access.isOrganizer, true);
  assert.equal(req.user.isSuperAdmin, false);
});

test('requireAuth rejects a token whose user no longer exists (401)', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'sessions') return { data: LIVE_SESSION };
    if (table === 'organizations') return { data: null };
    if (table === 'admin_users') return { data: null };
    return {};
  });
  const res = mockRes();
  await requireAuth(mockReq({ cookies: { fancy_session: tokenFor({ id: 'ghost' }) } }), res, () => {});
  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /no longer exists/);
});

test('requireAuth denies a banned organizer (403 ACCOUNT_BANNED)', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'sessions') return { data: LIVE_SESSION };
    if (table === 'organizations') return { data: { id: 'org-1', status: 'banned' } };
    if (table === 'admin_users') return { data: null };
    return {};
  });
  const res = mockRes();
  await requireAuth(mockReq({ cookies: { fancy_session: tokenFor({ id: 'u-banned' }) } }), res, () => {});
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'ACCOUNT_BANNED');
});

test('requireAuth reads a Bearer token from the Authorization header (mobile/API clients)', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'sessions') return { data: LIVE_SESSION };
    if (table === 'organizations') return { data: { id: 'org-1', status: 'active' } };
    if (table === 'admin_users') return { data: null };
    return {};
  });
  const req = mockReq({ headers: { authorization: `Bearer ${tokenFor({ id: 'u2' })}` } });
  let nextCalled = false;
  await requireAuth(req, mockRes(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.user.id, 'u2');
});

// ── M1: session revocation (a token asserting a jti must map to a live session) ──

const tokenForJti = (payload) => jwt.sign({ ...payload, jti: 'sess-1' }, JWT_SECRET, { algorithm: 'HS256' });

test('requireAuth denies a token whose session was revoked (401 SESSION_REVOKED) — M1', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'sessions') return { data: { revoked_at: '2026-01-01T00:00:00Z', expires_at: null } };
    return {};
  });
  const res = mockRes();
  await requireAuth(mockReq({ cookies: { fancy_session: tokenForJti({ id: 'u1' }) } }), res, () => {});
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'SESSION_REVOKED');
});

test('requireAuth FAILS CLOSED when the session lookup errors (M1 — previously fail-open)', async () => {
  // A transient DB error on the sessions lookup must DENY, not allow a revoked/forged token through.
  mock.setResolver(({ table }) => {
    if (table === 'sessions') return { error: { message: 'sessions table unavailable' } };
    return {};
  });
  const res = mockRes();
  await requireAuth(mockReq({ cookies: { fancy_session: tokenForJti({ id: 'u1' }) } }), res, () => {});
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'SESSION_REVOKED');
});

test('requireAuth accepts a token backed by a live, non-revoked session — M1', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'sessions') return { data: { revoked_at: null, expires_at: null } };
    if (table === 'organizations') return { data: { id: 'org-1', status: 'active' } };
    if (table === 'admin_users') return { data: null };
    return {};
  });
  const req = mockReq({ cookies: { fancy_session: tokenForJti({ id: 'u1', role: 'organizer' }) } });
  let nextCalled = false;
  await requireAuth(req, mockRes(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.user.jti, 'sess-1');
});

// ── requireSuperAdmin ──

test('requireSuperAdmin blocks a non-admin (403) and allows a super admin', () => {
  const denied = mockRes();
  requireSuperAdmin(mockReq({ user: { access: { isSuperAdmin: false } } }), denied, () => {});
  assert.equal(denied.statusCode, 403);

  let allowed = false;
  requireSuperAdmin(mockReq({ user: { access: { isSuperAdmin: true } } }), mockRes(), () => { allowed = true; });
  assert.equal(allowed, true);
});

// ── verifyEventOwner (IDOR guard) ──

test('verifyEventOwner returns 403 when the caller is not the event owner', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'events') return { data: { org_id: 'org-1', organizations: { owner_user_id: 'owner-REAL' } } };
    return {};
  });
  const res = mockRes();
  await verifyEventOwner(mockReq({ params: { eventId: 'evt-1' }, user: { id: 'attacker' } }), res, () => {});
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'FORBIDDEN');
});

test('verifyEventOwner calls next() for the legitimate owner', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'events') return { data: { org_id: 'org-1', organizations: { owner_user_id: 'owner-1' } } };
    return {};
  });
  let nextCalled = false;
  await verifyEventOwner(mockReq({ params: { eventId: 'evt-1' }, user: { id: 'owner-1' } }), mockRes(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('verifyEventOwner lets a super admin bypass ownership', async () => {
  mock.setResolver(() => ({}));
  let nextCalled = false;
  await verifyEventOwner(mockReq({ params: { eventId: 'evt-1' }, user: { id: 'admin', isSuperAdmin: true } }), mockRes(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
