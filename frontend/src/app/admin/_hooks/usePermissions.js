'use client';

import { useEffect, useState, useCallback, useContext } from 'react';
import adminApi from '../_lib/adminApi';
import { PermissionsContext } from './PermissionsContext';

/**
 * Loads the current admin's identity + permission set from GET /admin/me and
 * exposes a `can(key)` helper (Foundation F1/F3). super_admin returns ['*'] and
 * `can` always resolves true for it.
 *
 * When rendered under a <PermissionsContext.Provider> (AdminShell mounts one,
 * already having resolved this exact same data to gate the whole route),
 * this reuses that result instead of firing its own redundant GET /admin/me —
 * every section page used to call this hook independently, doubling the
 * request on every navigation. Falls back to its own fetch when no provider
 * is present, so the hook still works standalone.
 *
 * Returns { me, loading, error, can, isSuperAdmin, reload }.
 */
export function usePermissions() {
  const ctx = useContext(PermissionsContext);

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumping this triggers the fetch effect; keeps setState out of the effect body.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (ctx) return undefined; // context already owns this data — skip the redundant fetch.
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
  }, [nonce, ctx]);

  const reload = useCallback(() => {
    if (ctx) { ctx.reload?.(); return; }
    setLoading(true);
    setNonce((n) => n + 1);
  }, [ctx]);

  const ownIsSuperAdmin = !!me?.isSuperAdmin;

  const ownCan = useCallback(
    (key) => {
      if (!me) return false;
      if (me.isSuperAdmin) return true;
      const perms = me.permissions || [];
      return perms.includes('*') || perms.includes(key);
    },
    [me]
  );

  if (ctx) {
    return { me: ctx.me, loading: ctx.loading, error: ctx.error, can: ctx.can, isSuperAdmin: ctx.isSuperAdmin, reload };
  }
  return { me, loading, error, can: ownCan, isSuperAdmin: ownIsSuperAdmin, reload };
}

export default usePermissions;
