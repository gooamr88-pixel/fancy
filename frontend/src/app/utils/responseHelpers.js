/**
 * Normalizes RSVP response checking across the platform.
 * Handles: 'yes', 'YES', 'Yes', 'Accepted', 'accepted', 'attending'
 */
export function isAccepted(response) {
  if (!response) return false;
  const normalized = response.toLowerCase().trim();
  return ['yes', 'accepted', 'attending'].includes(normalized);
}

export function isDeclined(response) {
  if (!response) return false;
  const normalized = response.toLowerCase().trim();
  return ['no', 'declined', 'not attending'].includes(normalized);
}

export function isMaybe(response) {
  if (!response) return false;
  const normalized = response.toLowerCase().trim();
  return ['maybe', 'tentative'].includes(normalized);
}
