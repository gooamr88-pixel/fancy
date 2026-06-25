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

async function verifyTurnstile(req, res, next) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return next(); // not configured → disabled, no behavior change

  const token = req.body && req.body.captchaToken;
  if (!token) {
    return res.status(400).json({ success: false, error: 'CAPTCHA_REQUIRED', message: 'Please complete the verification challenge.' });
  }

  try {
    const params = new URLSearchParams({ secret, response: String(token) });
    if (req.ip) params.append('remoteip', req.ip);
    const resp = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = await resp.json();
    if (!data.success) {
      return res.status(403).json({ success: false, error: 'CAPTCHA_FAILED', message: 'Verification failed. Please try again.' });
    }
    return next();
  } catch (err) {
    // Fail OPEN on a verification-service outage: a guest must never be locked out of
    // RSVPing because Cloudflare is unreachable. The rate limiter still applies.
    logger.warn({ err: err.message }, 'Turnstile verification unavailable — allowing request');
    return next();
  }
}

module.exports = { verifyTurnstile };
