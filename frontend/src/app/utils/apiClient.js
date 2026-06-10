const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  
  // Handle 401 - token expired
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('org_id');
      localStorage.removeItem('user_role');
      localStorage.removeItem('active_event_id');
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json();
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
