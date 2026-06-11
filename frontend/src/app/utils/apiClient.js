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

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Send httpOnly auth cookie with every request
  });
  
  // Handle 401 - session expired
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      // Clear local metadata (non-sensitive display data)
      localStorage.removeItem('org_id');
      localStorage.removeItem('user_role');
      localStorage.removeItem('active_event_id');
      // Redirect to login — the server already invalidated the cookie
      window.location.href = '/login';
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
}

export async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // If the server call fails, still clear local state
  }
  localStorage.removeItem('org_id');
  localStorage.removeItem('user_role');
  localStorage.removeItem('active_event_id');
  window.location.href = '/login';
}

export { API_URL };
