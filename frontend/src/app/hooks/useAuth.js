'use client';
import { useState, useEffect } from 'react';
import { API_URL, logout as centralLogout } from '../utils/apiClient';

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    if (typeof window === 'undefined') return;

    // localStorage.org_id alone can go stale — the httpOnly session cookie it
    // was set alongside may have since expired or been revoked (by an admin,
    // or its 24h natural expiry), which previously left public marketing pages
    // (Navbar, CTASection) showing "Dashboard / Log Out" for a dead session
    // until the visitor clicked through and got bounced by the protected page.
    // Uses a plain fetch (not apiFetch) — apiFetch's 401 handler force-redirects
    // to /login on any non-auth page, which must never happen to an anonymous
    // visitor browsing a public marketing page.
    (async () => {
      const id = localStorage.getItem('org_id');
      if (!id) { setLoading(false); return; }
      try {
        const res = await fetch(`${API_URL}/auth/profile`, { credentials: 'include' });
        if (ignore) return;
        if (res.ok) {
          setOrgId(id);
          setUserRole(localStorage.getItem('user_role'));
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem('org_id');
          localStorage.removeItem('user_role');
          setOrgId(null);
          setUserRole(null);
          setIsLoggedIn(false);
        }
      } catch {
        // Network hiccup — don't punish the visitor for a transient failure;
        // keep showing the locally-cached logged-in state.
        if (!ignore) {
          setOrgId(id);
          setUserRole(localStorage.getItem('user_role'));
          setIsLoggedIn(true);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => { ignore = true; };
  }, []);

  // Cross-tab sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (e) => {
      if (e.key === 'org_id') {
        const id = e.newValue;
        setOrgId(id);
        setIsLoggedIn(!!id);
        if (!id) {
          setUserRole(null);
        }
      }
      if (e.key === 'user_role') {
        setUserRole(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Delegate to the centralized logout (M19: eliminates duplicated cleanup logic)
  const logout = async () => {
    setIsLoggedIn(false);
    setOrgId(null);
    setUserRole(null);
    await centralLogout();
  };

  return { isLoggedIn, orgId, userRole, loading, logout };
}
