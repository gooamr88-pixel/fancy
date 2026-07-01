const jwt = require('jsonwebtoken');

const QR_SECRET = process.env.QR_JWT_SECRET;
if (!QR_SECRET) throw new Error('FATAL: QR_JWT_SECRET environment variable is required');

/**
 * Generates a signed JWT for an RSVP invite action.
 * @param {{ rsvpId: string, eventId: string, response?: string }} opts
 * @returns {string} signed JWT
 */
const generateRsvpToken = ({ rsvpId, eventId, response } = {}) => {
  if (!rsvpId || !eventId) {
    throw new Error('rsvpId and eventId are required');
  }
  const payload = { purpose: 'rsvp_invite', rsvpId, eventId };
  if (response !== undefined) {
    payload.response = response;
  }
  return jwt.sign(payload, QR_SECRET, { algorithm: 'HS256' });
};

/**
 * Verifies a JWT RSVP token. Returns the decoded payload on success.
 * Throws an error matching /INVALID_RSVP_TOKEN/ on any failure or if the
 * purpose claim is not 'rsvp_invite' (prevents cross-subsystem replay).
 */
const verifyRsvpToken = (token) => {
  try {
    const decoded = jwt.verify(token, QR_SECRET, { algorithms: ['HS256'] });
    if (decoded.purpose !== 'rsvp_invite') {
      throw new Error('wrong purpose');
    }
    return decoded;
  } catch (_err) {
    throw new Error('INVALID_RSVP_TOKEN');
  }
};

/**
 * Maps human-friendly RSVP intent strings to canonical DB response values.
 */
const INTENT_MAP = {
  accepted: 'yes',
  yes: 'yes',
  attending: 'yes',
  declined: 'no',
  no: 'no',
  maybe: 'maybe'
};

const mapIntentToResponse = (intent) => {
  if (intent == null) return null;
  return INTENT_MAP[String(intent).toLowerCase()] || null;
};

module.exports = {
  generateRsvpToken,
  verifyRsvpToken,
  mapIntentToResponse
};
