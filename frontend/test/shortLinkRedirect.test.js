import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { GET } from '../src/app/i/[code]/route';

/**
 * THE SHORT-LINK REDIRECT, UNDER PRODUCTION'S ACTUAL CONDITIONS.
 *
 * Every short link sent guests to the homepage instead of their invitation. It took
 * two attempts to fix, and the first attempt is the reason this file is written the
 * way it is.
 *
 * ── What was wrong, twice ──
 *
 * The handler compared the stored target against `request.url`: first by ORIGIN,
 * then — after the first fix — by HOSTNAME. Both failed, because `request.url` in a
 * Next route handler is built from the socket the Node process listens on, not from
 * anything nginx forwards. Production said so in one line:
 *
 *     [short-link] target host fancyrsvp.com is not localhost
 *
 * nginx sets `Host: fancyrsvp.com` correctly; Next simply does not use it. So the
 * host is `localhost`, the scheme is `http`, and NOTHING derived from `request.url`
 * identifies this site.
 *
 * ── Why the first fix passed its own tests ──
 *
 * Those tests built requests as `http://fancyrsvp.com/i/...` — the shape I ASSUMED
 * Next produced. They proved the scheme mismatch was handled and never touched the
 * real failure, because the fixture encoded the same wrong assumption as the code.
 *
 * **Every request here is therefore `http://localhost:3000`** — what the server
 * actually receives. A fixture that names the public host would once again be
 * testing a situation that does not occur.
 */

const ok = (url) => ({ ok: true, status: 200, json: async () => ({ success: true, url }) });
const miss = () => ({ ok: false, status: 404, json: async () => ({ success: false }) });

/**
 * A request exactly as Next presents it behind nginx: the LISTEN address, not the
 * public host. This is the whole point of the file.
 */
const proxiedRequest = (code) => new Request(`http://localhost:3000/i/${code}`);

const call = (code) => GET(proxiedRequest(code), { params: Promise.resolve({ code }) });

let warn;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('short-link redirect', () => {
  /* ── The regression that shipped twice ─────────────────────────────────── */

  test('a public https target resolves even though the server thinks it is localhost', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok('https://fancyrsvp.com/smith-wedding/rsvp?g=abc'));

    const res = await call('k7m2xq4p');

    expect(res.status).toBe(307);
    // Relative: the browser resolves it against the origin it is already on, so the
    // guest stays on fancyrsvp.com without the server needing to know its own name.
    expect(res.headers.get('location')).toBe('/smith-wedding/rsvp?g=abc');
  });

  test('the redirect never points at the server’s own listen address', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok('https://fancyrsvp.com/e/party'));

    const res = await call('k7m2xq4p');

    const location = res.headers.get('location');
    expect(location).not.toContain('localhost');
    expect(location).not.toMatch(/^https?:\/\//);
  });

  test('www and apex both work, because neither is compared to anything', async () => {
    for (const host of ['https://fancyrsvp.com', 'https://www.fancyrsvp.com']) {
      global.fetch = vi.fn().mockResolvedValue(ok(`${host}/e/party`));
      const res = await call('k7m2xq4p');
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('/e/party');
    }
  });

  test('a stored RELATIVE target works the same as an absolute one', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok('/smith-wedding/rsvp?g=abc'));

    const res = await call('k7m2xq4p');

    expect(res.headers.get('location')).toBe('/smith-wedding/rsvp?g=abc');
  });

  /* ── Open redirect is now impossible by construction ───────────────────── */

  test('a target on another domain cannot send the guest off-site', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok('https://evil.example/steal?x=1'));

    const res = await call('k7m2xq4p');

    // Only the path survives, so the worst case is a 404 on our own domain. No
    // hostname check to keep correct, and nothing to get wrong later.
    const location = res.headers.get('location');
    expect(location).toBe('/steal?x=1');
    expect(location).not.toContain('evil.example');
  });

  test('a protocol-relative target cannot escape either', async () => {
    // `//evil.example/x` is the classic open-redirect payload: a browser reads it
    // as an absolute URL on the current scheme.
    global.fetch = vi.fn().mockResolvedValue(ok('//evil.example/x'));

    const res = await call('k7m2xq4p');

    const location = res.headers.get('location');
    expect(location).toBe('/x');
    expect(location).not.toContain('evil.example');
  });

  /* ── Failures are distinguishable, and none of them claims expiry ──────── */

  test('an unknown code lands on the homepage and says 404 in the log', async () => {
    global.fetch = vi.fn().mockResolvedValue(miss());

    const res = await call('k7m2xq4p');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/?link=invalid');
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
    expect(res.headers.get('location')).toBe('/?link=invalid');
  });

  // Nothing in this system expires: short_links has no expiry column and nothing
  // prunes it. Telling a guest their link expired was a guess presented as fact.
  test('no failure claims the link expired', async () => {
    global.fetch = vi.fn().mockResolvedValue(miss());

    const res = await call('k7m2xq4p');

    expect(res.headers.get('location')).not.toContain('expired');
  });
});
