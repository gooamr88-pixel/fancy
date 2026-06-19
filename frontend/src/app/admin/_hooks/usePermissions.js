'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi from '../_lib/adminApi';

/**
 * Loads the current admin's identity + permission set from GET /admin/me and
 * exposes a `can(key)` helper (Foundation F1/F3). super_admin returns ['*'] and
 * `can` always resolves true for it.
 *
 * Returns { me, loading, error, can, isSuperAdmin, reload }.
 */
export function usePermissions() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumping this triggers the fetch effect; keeps setState out of the effect body.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await adminApi.get('/me');
        if (!ignore) {
          setMe(res?.me || null);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Failed to load permissions');
          setMe(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  const isSuperAdmin = !!me?.isSuperAdmin;

  const can = useCallback(
    (key) => {
      if (!me) return false;
      if (me.isSuperAdmin) return true;
      const perms = me.permissions || [];
      return perms.includes('*') || perms.includes(key);
    },
    [me]
  );

  return { me, loading, error, can, isSuperAdmin, reload };
}

export default usePermissions;
