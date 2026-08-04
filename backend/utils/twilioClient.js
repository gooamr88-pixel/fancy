const logger = require('./logger');
const { smsEnabled } = require('../config/features');

let twilioClient = null;

function getTwilioClient() {
  // Feature-gated kill switch: when SMS is disabled (pre-live / no live keys),
  // return null so every caller falls into its existing mock path — messages are
  // logged, never dispatched, and no send code is bypassed. Flip SMS_ENABLED=true
  // (with TWILIO_* set) to go live; no code changes needed.
  if (!smsEnabled()) return null;

  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    logger.warn('Twilio credentials not set. SMS will be logged to console (mock mode).');
    return null;
  }
  
  try {
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Twilio client');
    return null;
  }
}

/**
 * The verified sender number. Returns null when unset — never a placeholder.
 *
 * This used to fall back to +15005550006, Twilio's magic test number. With real
 * credentials and an unset TWILIO_PHONE_NUMBER that fallback made every send fail
 * at the carrier (error 21212) one message at a time, after the wallet had already
 * been debited and refunded — a loud-looking failure with a silent, and wrong,
 * root cause. smsEnabled() now also requires this value, so an unset number stops
 * the subsystem at the gate instead of at the carrier.
 */
function getTwilioFromNumber() {
  const num = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
  return num ? num.trim() : null;
}

/**
 * The WhatsApp sender, for the organizer's own new-RSVP notification.
 *
 * Was hardcoded to whatsapp:+14155238886 — Twilio's shared public SANDBOX number,
 * which only delivers to handsets that have manually joined that sandbox. In
 * production it silently reached nobody. Unset now means the WhatsApp notification
 * is skipped rather than sent into a void.
 */
function getTwilioWhatsAppFrom() {
  const num = process.env.TWILIO_WHATSAPP_FROM;
  if (!num) return null;
  const trimmed = num.trim();
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}

module.exports = { getTwilioClient, getTwilioFromNumber, getTwilioWhatsAppFrom };
