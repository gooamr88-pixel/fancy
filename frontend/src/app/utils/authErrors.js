/**
 * Translates any thrown auth error into a clear, user-facing message.
 *
 * The backend already returns specific, friendly `message` strings (e.g.
 * "Invalid email or password.", "Please verify your email before logging in.")
 * and apiFetch surfaces those as `err.message`. This helper passes those
 * through untouched, while catching the cases where a raw/technical string
 * would otherwise leak to the user:
 *   - network failures ("Failed to fetch", "NetworkError")
 *   - request timeouts / aborts
 *   - server faults ("Request failed with status 500", "unexpected")
 *   - empty messages
 *
 * @param {unknown} err      The caught error (or any value).
 * @param {string} [fallback] Message to use when nothing more specific applies.
 * @returns {string} A clear message safe to show in a toast or inline alert.
 */
export function getAuthErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const msg = (err && err.message ? String(err.message) : String(err || '')).trim();

  if (!msg) return fallback;

  // Connection problems — the request never reached the server.
  if (/Failed to fetch|NetworkError|network\s*request\s*failed|ERR_NETWORK/i.test(msg)) {
    return "Can't reach the server. Please check your internet connection and try again.";
  }

  // Client-side timeout / abort.
  if (/timed out|timeout|aborted|AbortError/i.test(msg)) {
    return 'The request took too long to respond. Please try again.';
  }

  // Expired/invalid session.
  if (/session expired/i.test(msg)) {
    return 'Your session has expired. Please sign in again.';
  }

  // Server-side faults — never show the raw status code to the user.
  if (/status\s*5\d\d/i.test(msg) || /\bunexpected\b/i.test(msg) || /internal server error/i.test(msg)) {
    return 'Our server ran into a problem. Please try again in a moment.';
  }

  // Generic "Request failed with status NNN" with no useful message attached.
  if (/^request failed with status\s*\d+/i.test(msg)) {
    return fallback;
  }

  // Otherwise it's already a clear, intentional message from the API — show it.
  return msg;
}
