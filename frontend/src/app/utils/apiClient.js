const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };

  // Only set Content-Type to JSON if we're not sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });
  
  // Handle 401 - token expired
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('org_id');
      localStorage.removeItem('user_role');
      localStorage.removeItem('active_event_id');
      // Use soft redirect to preserve SPA state awareness
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

export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('org_id');
  localStorage.removeItem('user_role');
  localStorage.removeItem('active_event_id');
  window.location.href = '/login';
}

export { API_URL };

