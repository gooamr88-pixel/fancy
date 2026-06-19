const jwt = require('jsonwebtoken');

// Reuse the same signing secret as the QR ticket subsystem. A dedicated
// `purpose` claim namespaces these tokens so an RSVP-invite token can never be
// replayed as a check-in ticket (or vice-versa) even though the key is shared.
const RSVP_JWT_SECRET = process.env.QR_JWT_SECRET;
if (!RSVP_JWT_SECRET) throw new Error('FATAL: QR_JWT_SECRET environment variable is required');

const PURPOSE = 'rsvp_invite';

// Canonical responses an invitation button may carry. These are the public,
// human-facing verbs; mapResponse() converts them to the DB `response` column.
const VALID_INTENTS = ['accepted', 'declined', 'maybe'];

/**
 * Maps an invitation intent (or any stored response) to the DB `response` value.
 * 'accepted' -> 'yes', 'declined' -> 'no', 'maybe' -> 'maybe'.
 */
function mapIntentToResponse(intent) {
  switch (String(intent || '').toLowerCase().trim()) {
    case 'accepted':
    case 'yes':
    case 'attending':
      return 'yes';
    case 'declined':
    case 'no':
    case 'not attending':
      return 'no';
    case 'maybe':
      return 'maybe';
    default:
      return null;
  }
}

/**
 * Signs a per-guest, per-response invitation token. `response` is optional: the
 * three email buttons each embed a fixed response, while a generic "manage my
 * RSVP" link can omit it and let the guest choose on the landing page.
 *
 * The token deliberately carries no expiry tied to a single click — it remains
 * valid until the event's RSVP window closes (enforced server-side), so a guest
 * can revisit the same email link to change their mind.
 */
function generateRsvpToken({ rsvpId, eventId, response }, expiresIn = '90d') {
  if (!rsvpId || !eventId) throw new Error('rsvpId and eventId are required');
  const payload = { purpose: PURPOSE, rsvpId, eventId };
  if (response) payload.response = response;
  return jwt.sign(payload, RSVP_JWT_SECRET, { expiresIn });
}

/**
 * Verifies and decodes an RSVP invitation token. Throws 'INVALID_RSVP_TOKEN'
 * on any tampering, expiry, or wrong-purpose token.
 */
function verifyRsvpToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, RSVP_JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw new Error('INVALID_RSVP_TOKEN');
  }
  if (!decoded || decoded.purpose !== PURPOSE || !decoded.rsvpId || !decoded.eventId) {
    throw new Error('INVALID_RSVP_TOKEN');
  }
  return decoded;
}

module.exports = {
  generateRsvpToken,
  verifyRsvpToken,
  mapIntentToResponse,
  VALID_INTENTS,
};
