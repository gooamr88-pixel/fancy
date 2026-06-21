require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase, eqVal } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { createEvent, updateEvent } = require('../controllers/eventController');

t.beforeEach(() => mock.reset());

const owner = { id: 'owner-1' };

// ─────────────────────────────────────────────────────────────────────────────
// createEvent — validation + slug derivation / collision
// ─────────────────────────────────────────────────────────────────────────────

test('createEvent requires templateType, title and eventDate (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(createEvent, mockReq({ body: { title: 'x' }, user: owner }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
});

test('createEvent rejects an explicit slug with illegal characters (400 INVALID_SLUG)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(createEvent, mockReq({
    body: { templateType: 'wedding', title: 'T', eventDate: '2026-09-01', slug: 'Not A Slug!' },
    user: owner,
  }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_SLUG');
});

test('createEvent 403s when the authenticated user has no organization', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'organizations') return { data: null, error: { message: 'no rows' } };
    return {};
  });
  const { res } = await invoke(createEvent, mockReq({
    body: { templateType: 'wedding', title: 'T', eventDate: '2026-09-01' }, user: owner,
  }));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'ORG_NOT_FOUND');
});

test('createEvent auto-derives a slug from couple names and sanitises it', async () => {
  let inserted = null;
  mock.setResolver(({ table, op, payload, filters }) => {
    if (table === 'organizations') return { data: { id: 'org-1' } };
    // slug existence checks: nothing is taken.
    if (table === 'events' && op === 'select') return { data: [] };
    if (table === 'events' && op === 'insert') { inserted = payload; return { data: { id: 'evt-1', slug: payload.slug } }; }
    if (table === 'events' && op === 'update') return { data: null }; // QR persistence
    return {};
  });

  const { res } = await invoke(createEvent, mockReq({
    body: {
      templateType: 'wedding', title: 'Our Big Day', eventDate: '2026-09-01',
      templateData: { partner1: 'Joân', partner2: 'Jane!!' },
    },
    user: owner,
  }));

  assert.equal(res.statusCode, 201);
  // Accents stripped, punctuation collapsed to single dashes, lowercased.
  assert.equal(inserted.slug, 'joan-jane');
  assert.equal(inserted.status, 'draft');
  assert.equal(inserted.is_paid, false);
  assert.equal(inserted.org_id, 'org-1'); // org derived from the token, not the body
});

test('createEvent falls back to the title when no template names are present', async () => {
  let inserted = null;
  mock.setResolver(({ table, op, payload }) => {
    if (table === 'organizations') return { data: { id: 'org-1' } };
    if (table === 'events' && op === 'select') return { data: [] };
    if (table === 'events' && op === 'insert') { inserted = payload; return { data: { id: 'evt-1', slug: payload.slug } }; }
    if (table === 'events' && op === 'update') return { data: null };
    return {};
  });

  const { res } = await invoke(createEvent, mockReq({
    body: { templateType: 'gala', title: 'Gala @ The Plaza!!!', eventDate: '2026-09-01' },
    user: owner,
  }));

  assert.equal(res.statusCode, 201);
  assert.equal(inserted.slug, 'gala-the-plaza');
});

test('createEvent honours a valid explicit slug when it is free', async () => {
  let inserted = null;
  mock.setResolver(({ table, op, payload }) => {
    if (table === 'organizations') return { data: { id: 'org-1' } };
    if (table === 'events' && op === 'select') return { data: [] }; // free
    if (table === 'events' && op === 'insert') { inserted = payload; return { data: { id: 'evt-1', slug: payload.slug } }; }
    if (table === 'events' && op === 'update') return { data: null };
    return {};
  });

  const { res } = await invoke(createEvent, mockReq({
    body: { templateType: 'wedding', title: 'T', eventDate: '2026-09-01', slug: 'smith-wedding' },
    user: owner,
  }));
  assert.equal(res.statusCode, 201);
  assert.equal(inserted.slug, 'smith-wedding');
});

test('createEvent 409s on an explicit slug collision and suggests a free alternative', async () => {
  mock.setResolver(({ table, op, filters }) => {
    if (table === 'organizations') return { data: { id: 'org-1' } };
    if (table === 'events' && op === 'select') {
      // 'taken' is occupied; everything else (the suggestion probe) is free.
      return { data: eqVal(filters, 'slug') === 'taken' ? [{ id: 'other-evt' }] : [] };
    }
    return {};
  });

  const { res } = await invoke(createEvent, mockReq({
    body: { templateType: 'wedding', title: 'T', eventDate: '2026-09-01', slug: 'taken' },
    user: owner,
  }));

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'SLUG_TAKEN');
  // generateUniqueSlug tries `<base>-<year>` first.
  assert.equal(res.body.suggestedSlug, 'taken-2026');
});

// ─────────────────────────────────────────────────────────────────────────────
// updateEvent — slug rules + status guard + empty-string normalisation
// ─────────────────────────────────────────────────────────────────────────────

test('updateEvent forbids manually setting status to active (403)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(updateEvent, mockReq({ params: { eventId: 'evt-1' }, body: { status: 'active' }, user: owner }));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'STATUS_FORBIDDEN');
});

test('updateEvent rejects an invalid slug format (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(updateEvent, mockReq({ params: { eventId: 'evt-1' }, body: { slug: 'Bad Slug' }, user: owner }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_SLUG');
});

test('updateEvent 409s when another event already owns the requested slug', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'events' && op === 'select') return { data: [{ id: 'some-other-event' }] };
    return {};
  });
  const { res } = await invoke(updateEvent, mockReq({ params: { eventId: 'evt-1' }, body: { slug: 'duplicate' }, user: owner }));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'SLUG_TAKEN');
});

test('updateEvent normalises empty-string dates to NULL (prevents a DB syntax error)', async () => {
  let payload = null;
  mock.setResolver(({ table, op, payload: p }) => {
    if (table === 'events' && op === 'update') { payload = p; return { data: { id: 'evt-1', title: 'T' } }; }
    return {};
  });
  const { res } = await invoke(updateEvent, mockReq({
    params: { eventId: 'evt-1' },
    body: { title: 'T', rsvp_deadline: '', event_end_date: '' },
    user: owner,
  }));
  assert.equal(res.statusCode, 200);
  assert.equal(payload.rsvp_deadline, null);
  assert.equal(payload.event_end_date, null);
});

test('updateEvent allows status to be set to paused or completed by the organizer', async () => {
  let payload = null;
  mock.setResolver(({ table, op, payload: p }) => {
    if (table === 'events' && op === 'update') { payload = p; return { data: { id: 'evt-1', status: 'paused' } }; }
    return {};
  });
  const { res } = await invoke(updateEvent, mockReq({ params: { eventId: 'evt-1' }, body: { status: 'paused' }, user: owner }));
  assert.equal(res.statusCode, 200);
  assert.equal(payload.status, 'paused');
});
