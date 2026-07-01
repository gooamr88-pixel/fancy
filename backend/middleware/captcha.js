const logger = require('../utils/logger');

/**
 * Bot/abuse protection for the public RSVP write (SEC-3 / SEC-4).
 *
 * IP rate limiting alone is a poor fit here: it lets a single attacker spam an
 * organizer with notification emails/WhatsApp up to the limit, yet can also block
 * many legitimate guests sharing one venue NAT. A human-verification challenge
 * (Cloudflare Turnstile) cuts the abuse without penalizing real guests.
 *
 * Deliberately ZERO-CONFIG-SAFE: when TURNSTILE_SECRET is unset the middleware is a
 * no-op, so nothing breaks before you provision keys. Set TURNSTILE_SECRET on the
 * server and NEXT_PUBLIC_TURNSTILE_SITEKEY on the frontend to activate. The guest
 * sends the solved token as `captchaToken` in the RSVP body.
 */
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 5000;

// Fail-open is intentional (a Cloudflare outage must never block real guests from
// RSVPing), but it must not become a free bypass for an attacker who can force
// verification calls to error repeatedly. Track fail-open events per IP and start
// rejecting once an IP rides the fail-open path too often — a real outage still
// lets every other IP through fine, only a single IP hammering the bypass gets cut off.
const FAIL_OPEN_WINDOW_MS = 15 * 60 * 1000;
const FAIL_OPEN_MAX_PER_IP = 5;
const FAIL_OPEN_MAP_MAX_SIZE = 10000;
const failOpenCounts = new Map(); // ip -> { count, windowStart }

// SEC C6: Periodic cleanup to prevent unbounded memory growth.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failOpenCounts) {
    if (now - entry.windowStart > FAIL_OPEN_WINDOW_MS) {
      failOpenCounts.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref(); // unref so it doesn't prevent process exit

function recordFailOpenAndCheck(ip) {
  const key = ip || 'unknown';
  const now = Date.now();
  const entry = failOpenCounts.get(key);
  if (!entry || now - entry.windowStart > FAIL_OPEN_WINDOW_MS) {
    // SEC C6: Evict oldest entries if the map grows too large.
    if (failOpenCounts.size >= FAIL_OPEN_MAP_MAX_SIZE) {
      let oldestKey = null;
      let oldestTime = Infinity;
      for (const [k, v] of failOpenCounts) {
        if (v.windowStart < oldestTime) {
          oldestTime = v.windowStart;
          oldestKey = k;
        }
      }
      if (oldestKey) failOpenCounts.delete(oldestKey);
    }
    failOpenCounts.set(key, { count: 1, windowStart: now });
    return true; // allow
  }
  entry.count += 1;
  return entry.count <= FAIL_OPEN_MAX_PER_IP;
}

async function verifyTurnstile(req, res, next) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return next(); // not configured → disabled, no behavior change

  const token = req.body && req.body.captchaToken;
  if (!token) {
    return res.status(400).json({ success: false, error: 'CAPTCHA_REQUIRED', message: 'Please complete the verification challenge.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({ secret, response: String(token) });
    if (req.ip) params.append('remoteip', req.ip);
    const resp = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: controller.signal,
    });
    const data = await resp.json();
    if (!data.success) {
      return res.status(403).json({ success: false, error: 'CAPTCHA_FAILED', message: 'Verification failed. Please try again.' });
    }
    return next();
  } catch (err) {
    // Fail OPEN on a verification-service outage: a guest must never be locked out of
    // RSVPing because Cloudflare is unreachable. But cap how many times a single IP
    // can ride that bypass so it can't be used to defeat captcha at volume.
    if (!recordFailOpenAndCheck(req.ip)) {
      logger.warn({ err: err.message, ip: req.ip }, 'Turnstile verification unavailable — IP exceeded fail-open allowance, rejecting');
      return res.status(503).json({ success: false, error: 'CAPTCHA_UNAVAILABLE', message: 'Verification is temporarily unavailable. Please try again shortly.' });
    }
    logger.warn({ err: err.message, ip: req.ip }, 'Turnstile verification unavailable — allowing request');
    return next();
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { verifyTurnstile };
