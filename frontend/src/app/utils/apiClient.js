const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

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
  
    // Handle 401 - session expired
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/forgot-password') {
          // Clear local metadata (non-sensitive display data)
          localStorage.removeItem('org_id');
          localStorage.removeItem('user_role');
          localStorage.removeItem('active_event_id');
          // Redirect to login — the server already invalidated the cookie
          window.location.href = '/login';
          return; // Don't throw — we're redirecting
        }
      }
      throw new Error('Session expired. Please log in again.');
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return { success: true };
    }

    // Check Content-Type before parsing
    const contentType = response.headers.get('content-type') || '';

    // Handle binary/blob responses (CSV export, file downloads)
    if (contentType.includes('text/csv') || contentType.includes('application/octet-stream')) {
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
  document.cookie = 'fancy_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; Secure; SameSite=None;';
  window.location.href = '/login';
}

export { API_URL };
