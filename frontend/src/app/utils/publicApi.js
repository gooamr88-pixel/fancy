const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export class PublicApiError extends Error {
  constructor(message, { status, code, meta } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

/**
 * Fetches an unauthenticated `/public/...` (or other) endpoint and unwraps the
 * standardized `{success, data}` / `{success, error, message}` envelope, so
 * call sites get the inner payload directly instead of reaching through
 * `.data` everywhere. No credentials, no auth-redirect — this is for the
 * guest-facing surfaces, which never carry a session cookie.
 */
export async function publicApiFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, options);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new PublicApiError(err.message || 'Network error', { status: 0, code: 'NETWORK_ERROR' });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new PublicApiError(body.message || 'Request failed', { status: res.status, code: body.error, meta: body.meta });
  }
  if (body.data !== undefined) {
    return body.data;
  }
  const { success, ...rest } = body;
  return rest;
}

export { API_URL };
