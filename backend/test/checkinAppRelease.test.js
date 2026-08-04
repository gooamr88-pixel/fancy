/**
 * Fancy Check-in app — release metadata + signed download.
 *
 * Two independent gates guard this, and the tests below exist because they are
 * easy to conflate:
 *   • the FEATURE gate (requireFeature('checkin_app')) answers "has this event's
 *     plan paid for the door app" — covered by featureGate.test.js;
 *   • `super_admin_config.checkin_app.enabled` answers "is this build fit to
 *     stand at a real door". The app has never run on physical hardware, so it
 *     ships closed and an admin opens it. A regression that let `enabled: false`
 *     serve an APK would put an untested build at a wedding.
 */
require('./helpers/env');

const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { injectModule } = require('./helpers/inject');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

let configResult = {};
injectModule('../../utils/configCache', {
  getPlatformConfig: async () => configResult,
  invalidate: () => {},
});

const controller = require('../controllers/checkinAppController');

const RELEASE = {
  enabled: true,
  version: '1.3.0',
  versionCode: 11,
  minAndroid: '8.0',
  sizeBytes: 63_000_000,
  sha256: 'a'.repeat(64),
  releaseNotes: 'Offline bundle verification.',
  releasedAt: '2026-08-01T00:00:00Z',
  storagePath: 'releases/fancy-checkin-1.3.0.apk',
};

/** Captures storage calls; `signed` false simulates a missing object. */
function setupStorage({ signed = true } = {}) {
  const cap = { signCalls: [], inserts: [] };
  mock.supabase.storage = {
    from: (bucket) => ({
      createSignedUrl: async (path, ttl, opts) => {
        cap.signCalls.push({ bucket, path, ttl, opts });
        return signed
          ? { data: { signedUrl: 'https://storage.example/signed?token=abc' }, error: null }
          : { data: null, error: { message: 'Object not found' } };
      },
    }),
  };
  mock.setResolver((s) => {
    if (s.table === 'activity_logs' && s.op === 'insert') { cap.inserts.push(s.payload); return { data: null }; }
    return {};
  });
  return cap;
}

const req = () => mockReq({ params: { eventId: 'evt-1' }, user: { id: 'user-1' } });

t.beforeEach(() => { mock.reset(); configResult = {}; });

// ── Release metadata ────────────────────────────────────────────────────────

test('an unconfigured platform reports the app as unavailable rather than erroring', async () => {
  configResult = {};
  const { res } = await invoke(controller.getRelease, req());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.available, false);
  assert.equal(res.body.data.version, '');
});

test('release metadata never leaks the storage path', async () => {
  configResult = { checkin_app: RELEASE };
  const { res } = await invoke(controller.getRelease, req());
  const body = JSON.stringify(res.body);
  assert.equal(res.body.data.available, true);
  assert.equal(res.body.data.sha256, RELEASE.sha256, 'the checksum IS meant to be published');
  assert.ok(
    !body.includes(RELEASE.storagePath),
    'the object key would let a caller bypass the gate, the readiness switch and the audit row',
  );
});

test('a build that exists but has not been opened up is not available', async () => {
  configResult = { checkin_app: { ...RELEASE, enabled: false } };
  const { res } = await invoke(controller.getRelease, req());
  assert.equal(res.body.data.available, false);
  // The version still comes back: the dashboard says "1.3.0 — coming soon",
  // which is a better answer than a blank card.
  assert.equal(res.body.data.version, '1.3.0');
});

test('enabled with no uploaded artefact is not available either', async () => {
  configResult = { checkin_app: { ...RELEASE, storagePath: '' } };
  const { res } = await invoke(controller.getRelease, req());
  assert.equal(res.body.data.available, false);
});

// ── Download ────────────────────────────────────────────────────────────────

test('the download is refused while the release is closed', async () => {
  configResult = { checkin_app: { ...RELEASE, enabled: false } };
  const cap = setupStorage();
  const { res } = await invoke(controller.downloadApk, req());
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'RELEASE_UNAVAILABLE');
  assert.equal(cap.signCalls.length, 0, 'no URL should even be minted');
});

test('an entitled organizer is redirected to a short-lived signed URL', async () => {
  configResult = { checkin_app: RELEASE };
  const cap = setupStorage();
  const { res } = await invoke(controller.downloadApk, req());

  assert.equal(res.statusCode, 302);
  assert.equal(res.redirectedTo, 'https://storage.example/signed?token=abc');
  assert.equal(res.body, undefined, 'the APK must not be proxied through the API process');
  assert.equal(cap.signCalls.length, 1);
  const call = cap.signCalls[0];
  assert.equal(call.bucket, 'checkin-app');
  assert.equal(call.path, RELEASE.storagePath);
  assert.ok(call.ttl > 0 && call.ttl <= 300, 'a signed URL must expire quickly, not be shareable');
  assert.match(call.opts.download, /fancy-checkin-1\.3\.0\.apk/, 'the saved file should be named, not a UUID');
});

test('the download is recorded against the event and the build', async () => {
  configResult = { checkin_app: RELEASE };
  const cap = setupStorage();
  await invoke(controller.downloadApk, req());
  // Best-effort and fire-and-forget, so give the promise a turn to settle.
  await new Promise((r) => setImmediate(r));

  assert.equal(cap.inserts.length, 1);
  assert.equal(cap.inserts[0].action, 'checkin_app_downloaded');
  assert.equal(cap.inserts[0].event_id, 'evt-1');
  assert.equal(cap.inserts[0].metadata.version, '1.3.0');
});

test('a config pointing at a missing object fails softly, not with a stack trace', async () => {
  configResult = { checkin_app: RELEASE };
  setupStorage({ signed: false });
  const { res } = await invoke(controller.downloadApk, req());
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'RELEASE_UNAVAILABLE');
  assert.ok(!JSON.stringify(res.body).includes(RELEASE.storagePath), 'an operator mistake must not leak the key');
});

// ── Registry ────────────────────────────────────────────────────────────────

test('checkin_app is a real registry key and is not free', () => {
  const { getFeatureByKey } = require('../config/featureRegistry');
  const feat = getFeatureByKey('checkin_app');
  assert.ok(feat, 'the routes gate on this key; without it requireFeature denies everyone');
  assert.equal(feat.freeDefault, false);
  assert.equal(feat.category, 'Check-in');
  assert.ok(feat.label && feat.description, 'the public pricing page renders the label verbatim');
});
