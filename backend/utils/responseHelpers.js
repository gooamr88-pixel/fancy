/**
 * Normalizes RSVP response checking across the backend.
 * Mirrors the frontend helper (frontend/src/app/utils/responseHelpers.js).
 * Handles: 'yes', 'YES', 'Yes', 'Accepted', 'accepted', 'attending', etc.
 */
function isAcceptedResponse(response) {
  if (!response) return false;
  const r = String(response).toLowerCase().trim();
  return ['yes', 'accepted', 'attending'].includes(r);
}

function isDeclinedResponse(response) {
  if (!response) return false;
  const r = String(response).toLowerCase().trim();
  return ['no', 'declined', 'not attending'].includes(r);
}

module.exports = { isAcceptedResponse, isDeclinedResponse };
