import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { GET } from '../src/app/i/[code]/route';

/**
 * THE SHORT-LINK REDIRECT, UNDER PRODUCTION'S ACTUAL CONDITIONS.
 *
 * Every short link in production redirected to the homepage. The cause was a
 * same-ORIGIN check between two values that can never be equal behind a reverse
 * proxy:
 *
 *   • `request.url` is built by Next from the connection it received. nginx
 *     proxies to http://127.0.0.1:3000 and Next does not apply
 *     X-Forwarded-Proto to it, so the handler sees "http://fancyrsvp.com/i/...".
 *   • the stored target comes from getPublicBaseUrl, which strictly prefers the
 *     https origin — "https://fancyrsvp.com/...".
 *
 * The old check compared those origins, so it rejected 100% of valid links and
 * called every one of them expired.
 *
 * It passed locally because in development both sides are http://localhost:3000.
 * That is the whole lesson of this file: a test that exercises the redirect on a
 * single scheme proves nothing. The scheme MISMATCH is the test.
 */

const ok = (url) => ({ ok: true, status: 200, json: async () => ({ success: true, url }) });
const miss = () => ({ ok: false, status: 404, json: async () => ({ success: false }) });

/** A request as Next actually presents it behind nginx: http, public hostname. */
const proxiedRequest = (code, host = 'fancyrsvp.com') =>
  new Request(`http://${host}/i/${code}`);

const call = (code, host) => GET(proxiedRequest(code, host), { params: Promise.resolve({ code }) });

let warn;

beforeEach(() => {
  // The handler logs the reason for every miss; keep the test output readable
  // while still letting a test assert on what was logged.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('short-link redirect', () => {
  test('an https target reached over a proxied http request still redirects', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok('https://fancyrsvp.com/smith-wedding/rsvp?g=abc'));

    const res = await call('k7m2xq4p');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://fancyrsvp.com/smith-wedding/rsvp?g=abc');
  });

  test('the guest is sent to the canonical https origin, not back over http', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok('https://fancyrsvp.com/e/party'));

    const res = await call('k7m2xq4p');

    expect(res.headers.get('location')).toMatch(/^https:/);
  });

  // nginx serves both names from the same app, so they are not different sites.
  test('www and the apex domain are the same site in both directions', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok('https://fancyrsvp.com/e/party'));
    const fromWww = await call('k7m2xq4p', 'www.fancyrsvp.com');
    expect(fromWww.status).toBe(307);
    expect(fromWww.headers.get('location')).toBe('https://fancyrsvp.com/e/party');

    global.fetch = vi.fn().mockResolvedValue(ok('https://www.fancyrsvp.com/e/party'));
    const toWww = await call('k7m2xq4p', 'fancyrsvp.com');
    expect(toWww.status).toBe(307);
  });

  /* ── The check still has to do its job ──────────────────────────────────── */

  test('a target on someone else\'s domain is refused', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok('https://evil.example/steal'));

    const res = await call('k7m2xq4p');

    expect(res.headers.get('location')).toContain('/?link=invalid');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('evil.example'));
  });

  test('a lookalike subdomain is refused', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok('https://fancyrsvp.com.evil.example/steal'));

    const res = await call('k7m2xq4p');

    expect(res.headers.get('location')).toContain('/?link=invalid');
  });

  /* ── Failures are distinguishable, which they were not ──────────────────── */

  test('an unknown code lands on the homepage and says so in the log', async () => {
    global.fetch = vi.fn().mockResolvedValue(miss());

    const res = await call('k7m2xq4p');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/?link=invalid');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('404'));
  });

  test('an unreachable API is logged as a lookup failure, not as a bad code', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));

    const res = await call('k7m2xq4p');

    expect(res.status).toBe(307);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  test('a malformed code never reaches the network', async () => {
    global.fetch = vi.fn();

    const res = await call('not a code!');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/?link=invalid');
  });

  // Nothing in this system expires: short_links has no expiry column and nothing
  // prunes it. Telling a guest their link expired was a guess presented as a fact.
  test('no failure claims the link expired', async () => {
    global.fetch = vi.fn().mockResolvedValue(miss());

    const res = await call('k7m2xq4p');

    expect(res.headers.get('location')).not.toContain('expired');
  });
});
