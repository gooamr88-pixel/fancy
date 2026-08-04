/**
 * Standardized API response envelope for the guest-experience endpoints.
 * Previously every controller hand-rolled its own success/error shape —
 * some returned `{ success, error, message }`, others `{ success, message,
 * importedCount, ... }` with no `data` field at all, and async vs. sync
 * paths for the same logical action (e.g. email vs. SMS invitations)
 * returned incompatible shapes. One envelope, used everywhere:
 *
 *   success → { success: true, data, meta? }
 *   failure → { success: false, error, message, meta? }
 */

function sendOk(res, data, { status = 200, meta } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function sendFail(res, { status = 400, error = 'ERROR', message, meta } = {}) {
  const body = { success: false, error, message: message || error };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

/** Maps a GuestService/InvitationService RPC failure code to its HTTP status. */
const ERROR_STATUS = {
  EVENT_NOT_FOUND: 404,
  PAYMENT_REQUIRED: 402,
  EVENT_UNDER_REVIEW: 403,
  EVENT_CLOSED: 403,
  EVENT_INACTIVE: 404,
  EVENT_NOT_LIVE: 403,
  DEADLINE_PASSED: 400,
  RSVP_NOT_FOUND: 404,
  GUEST_NOT_FOUND: 404,
  RSVP_OWNERSHIP_FAILED: 403,
  DUPLICATE_RSVP: 409,
  DUPLICATE_GUEST: 409,
  // A contact that already belongs to a party which has ANSWERED. Distinct from
  // DUPLICATE_RSVP (a terminal "you already responded" lock) because this one is
  // recoverable: the guest can claim the record with an explicit confirmation.
  EMAIL_ALREADY_REGISTERED: 409,
  PHONE_ALREADY_REGISTERED: 409,
  ALREADY_RESPONDED: 409,
  ALREADY_ASSIGNED: 409,
  ALREADY_CHECKED_IN: 409,
  GUEST_LIMIT_REACHED: 409,
  RESPONSE_EDITS_DISABLED: 403,
  VALIDATION_ERROR: 400,
  MEAL_REQUIRED: 400,
  MEAL_INVALID: 400,
  UNAUTHORIZED: 403,
  TABLE_NOT_FOUND: 404,
  CAPACITY_EXCEEDED: 409,
  NOT_ASSIGNED: 404,
  ASSIGNMENT_NOT_FOUND: 404,
  SAME_TABLE: 400,
  FEATURE_REQUIRES_PAYMENT: 402,
};

/**
 * Sends an RPC's `{success:false, code|error, message}` result as a standardized failure.
 *
 * `canUpdate` is forwarded into `meta` when the RPC supplies it: the
 * EMAIL_ALREADY_REGISTERED / PHONE_ALREADY_REGISTERED replies need to tell the
 * form whether to offer "That's me - update my response" or to send the guest to
 * the host, and that depends on the event's allow_guest_edits, which only the
 * RPC has already looked up.
 */
function sendRpcFailure(res, result, fallbackStatus = 400) {
  const code = result?.code || result?.error || 'ERROR';
  return sendFail(res, {
    status: ERROR_STATUS[code] || fallbackStatus,
    error: code,
    message: result?.message || 'Request could not be completed.',
    ...(result?.canUpdate !== undefined ? { meta: { canUpdate: !!result.canUpdate } } : {}),
  });
}

module.exports = { sendOk, sendFail, sendRpcFailure, ERROR_STATUS };
