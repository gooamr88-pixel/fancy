/**
 * Single source of truth for every signed JWT the guest experience hands
 * out: email-invitation links, the generic "manage my RSVP" link, and QR
 * check-in tickets. Previously these lived in two separate files
 * (rsvpToken.js, qrHelper.js) that both signed with the SAME secret but only
 * one of them actually checked a `purpose` claim on verify — the QR-ticket
 * verifier accepted ANY token signed with that secret, regardless of what it
 * was originally issued for. Every purpose is now signed AND verified
 * against an explicit discriminator, closing that gap structurally instead
 * of relying on field-name mismatches to fail closed by accident.
 */
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.QR_JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: QR_JWT_SECRET environment variable is required');

const PURPOSES = {
  RSVP_INVITE: 'rsvp_invite',
  QR_TICKET: 'qr_ticket',
};

// Canonical human-facing verbs an invitation button may carry. mapIntentToResponse()
// converts them to the DB `response` enum value.
const VALID_INTENTS = ['accepted', 'declined', 'maybe'];

/** Maps an invitation intent (or any already-stored response) to the DB response value. */
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

function sign(purpose, payload, { expiresIn = '90d' } = {}) {
  if (!Object.values(PURPOSES).includes(purpose)) throw new Error(`Unknown token purpose: ${purpose}`);
  return jwt.sign({ ...payload, purpose }, JWT_SECRET, { expiresIn, algorithm: 'HS256' });
}

function verify(token, expectedPurpose) {
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new Error('INVALID_TOKEN');
  }
  if (!decoded || decoded.purpose !== expectedPurpose) {
    throw new Error('INVALID_TOKEN');
  }
  return decoded;
}

/**
 * Per-party, per-response invitation link. `response` omitted signs a generic
 * "manage my RSVP" link that lets the guest choose on the landing page.
 * No expiry tied to a single click — valid until the event's RSVP window
 * closes (enforced server-side against the party/event, not the token), so a
 * guest can revisit the same email link to change their mind.
 */
function signRsvpInvite({ partyId, eventId, response }) {
  if (!partyId || !eventId) throw new Error('partyId and eventId are required');
  const payload = { partyId, eventId };
  if (response) payload.response = response;
  // Token expires in 30 days — enforced by jwt.verify() in verifyRsvpInvite.
  // Guests can revisit the same email link to change their mind within this window.
  return sign(PURPOSES.RSVP_INVITE, payload, { expiresIn: '30d' });
}

function verifyRsvpInvite(token) {
  const decoded = verify(token, PURPOSES.RSVP_INVITE);
  if (!decoded.partyId || !decoded.eventId) throw new Error('INVALID_TOKEN');
  return decoded;
}

/**
 * QR check-in ticket for one PARTY (the whole group checks in together via
 * one scan; the underlying check_ins rows stay per-individual-guest for
 * fine-grained arrival tracking — see checkinController.scanCheckIn).
 * Expiry tracks the event date (+1 day buffer) so the ticket stays valid
 * through the event but not indefinitely; falls back to 30 days if the
 * event date is missing or already past.
 */
function signQrTicket({ partyId, eventId, tableName, partySize, eventDate }) {
  if (!partyId || !eventId) throw new Error('partyId and eventId are required');
  let expiresIn = '30d';
  if (eventDate) {
    const expiryMs = (new Date(eventDate).getTime() + 24 * 60 * 60 * 1000) - Date.now();
    if (expiryMs > 0) expiresIn = Math.ceil(expiryMs / 1000);
  }
  return sign(PURPOSES.QR_TICKET, { partyId, eventId, tableName, partySize }, { expiresIn });
}

function verifyQrTicket(token) {
  const decoded = verify(token, PURPOSES.QR_TICKET);
  if (!decoded.partyId || !decoded.eventId) throw new Error('INVALID_TOKEN');
  return decoded;
}

/**
 * Mints a QR ticket for a party as soon as they're a confirmed "yes" —
 * deliberately NOT gated on a seating assignment existing. checkinController's
 * scanCheckIn re-queries the live table assignment at scan time rather than
 * trusting the token's tableName (see checkinController.js), so a ticket
 * signed before seating is finalized is fully valid at the door; the table
 * just reads "Unassigned" until the organizer seats them. Returns null for
 * "maybe"/"no" — there's nothing to check in for an unconfirmed guest.
 *
 * Deliberately swallows its own errors: every caller sits inside an RSVP
 * read/write that has ALREADY succeeded (the party's response is recorded
 * either way), so a ticket-signing hiccup must never turn an otherwise-
 * successful RSVP into a 500 for the guest. Worst case they see the existing
 * "sent separately" placeholder instead of an immediate pass — never a
 * failed request for something that actually worked.
 */
function signQrTicketForResponse({ response, partyId, eventId, tableName, partySize, eventDate }) {
  if (response !== 'yes') return null;
  try {
    return signQrTicket({ partyId, eventId, tableName: tableName || null, partySize, eventDate });
  } catch (err) {
    logger.error({ err, partyId, eventId }, 'Failed to mint QR ticket for RSVP response');
    return null;
  }
}

module.exports = {
  PURPOSES,
  VALID_INTENTS,
  mapIntentToResponse,
  signRsvpInvite,
  verifyRsvpInvite,
  signQrTicket,
  verifyQrTicket,
  signQrTicketForResponse,
};
