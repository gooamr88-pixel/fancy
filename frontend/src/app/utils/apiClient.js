const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
export const API_URL = rawApiUrl.endsWith('/api/v1') ? rawApiUrl : `${rawApiUrl}/api/v1`;
export const API_BASE_URL = API_URL.replace(/\/api\/v1$/, '');

export async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = {
    ...options.headers,
  };

  // Only set Content-Type to JSON if we're not sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Add request timeout (30 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Send httpOnly auth cookie with every request
      signal: options.signal || controller.signal,
    });
    clearTimeout(timeoutId);
  
    // Handle 401. On a PROTECTED page this means the auth cookie is missing/expired
    // → bounce to login. On an AUTH page (login/register/forgot-password) a 401 is an
    // authentication FAILURE (wrong credentials, etc.), NOT an expired session — so we
    // surface the server's specific message instead of a misleading "session expired".
    if (response.status === 401) {
      const authPaths = ['/login', '/register', '/forgot-password'];
      const onAuthPage = typeof window !== 'undefined' && authPaths.includes(window.location.pathname);

      if (typeof window !== 'undefined' && !onAuthPage) {
        // Auth is a backend-issued httpOnly JWT (fancy_session) with a fixed 24h
        // expiry and no refresh-token exchange — this app never establishes a
        // Supabase Auth session, so there is nothing to refresh. A 401 here means
        // the cookie is missing or expired: clear local display state and send the
        // user to log in again.
        localStorage.removeItem('org_id');
        localStorage.removeItem('user_role');
        localStorage.removeItem('active_event_id');
        window.location.href = '/login';
        return; // Don't throw — we're redirecting
      }

      // Auth page (or SSR): pass through the API's real error message so the form can
      // show "Invalid email or password.", "Please verify your email.", etc.
      let data = null;
      try { data = await response.json(); } catch { /* missing/non-JSON body */ }
      throw new Error((data && data.message) || 'Invalid email or password.');
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return { success: true };
    }

    // Check Content-Type before parsing
    const contentType = response.headers.get('content-type') || '';

    // Handle binary/blob responses (CSV export, Excel export, file downloads).
    // Excel exports come back as the long spreadsheetml MIME type, so match the
    // generic "spreadsheet"/"excel" substrings rather than enumerating each one.
    if (
      contentType.includes('text/csv') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('spreadsheetml') ||
      contentType.includes('spreadsheet') ||
      contentType.includes('excel')
    ) {
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response.blob();
    }

    // Handle plain text responses
    if (contentType.includes('text/plain')) {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Request failed with status ${response.status}`);
      }
      return text;
    }

    // Default: parse as JSON
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return { success: true };
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
}

export async function logout() {
  if (typeof window === 'undefined') return;
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // If the server call fails, still clear local state
  }
  localStorage.removeItem('org_id');
  localStorage.removeItem('user_role');
  localStorage.removeItem('active_event_id');
  // The session cookie is httpOnly — only the server can clear it, which the
  // /auth/logout call above already did. A client-side `document.cookie =`
  // assignment here can never touch it (JS has no access to httpOnly cookies).
  window.location.href = '/login';
}
