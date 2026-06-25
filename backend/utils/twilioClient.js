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

function getTwilioFromNumber() {
  const num = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER || '+15005550006';
  return num.trim();
}

module.exports = { getTwilioClient, getTwilioFromNumber };
