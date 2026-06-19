'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi from '../_lib/adminApi';

/**
 * Lint-safe paginated list loader for admin sections (Foundation F4).
 *
 * The fetch runs inside the effect as an inline async IIFE (with an ignore flag)
 * so no setState is called synchronously within the effect body — satisfying
 * React 19's react-hooks/set-state-in-effect rule. Refetch is triggered via a
 * nonce that `reload()` bumps.
 *
 * @param {string} path        admin API path (e.g. '/users')
 * @param {Object} params      query params (page, limit, q, …)
 * @param {(res:any)=>any[]} pick  extracts the row array from the response
 */
export function useAdminList(path, params, pick = (r) => r?.data || []) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  const key = JSON.stringify(params || {});

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await adminApi.get(path, params);
        if (!ignore) {
          setRows(pick(res));
          setPagination(res?.pagination || null);
          setError(null);
        }
      } catch (e) {
        if (!ignore) setError(e.message || 'Failed to load');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
    // params is captured via its serialized `key`; pick is stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { rows, pagination, loading, error, reload };
}

export default useAdminList;
