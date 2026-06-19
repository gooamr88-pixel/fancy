import { apiFetch } from '../../utils/apiClient';

/**
 * Thin wrapper over apiFetch scoped to the /admin/* surface (Foundation F3).
 * Centralizes the prefix and JSON body handling so admin section pages stay
 * declarative. Query params are passed as a plain object.
 */

function toQuery(params) {
  if (!params) return '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    usp.append(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const adminApi = {
  get: (path, params) => apiFetch(`/admin${path}${toQuery(params)}`),
  post: (path, body) => apiFetch(`/admin${path}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path, body) => apiFetch(`/admin${path}`, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: (path, body) => apiFetch(`/admin${path}`, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: (path) => apiFetch(`/admin${path}`, { method: 'DELETE' }),
};

export default adminApi;
