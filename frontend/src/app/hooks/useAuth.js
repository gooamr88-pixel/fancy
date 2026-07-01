'use client';
import { useState, useEffect } from 'react';
import { apiFetch, logout as centralLogout } from '../utils/apiClient';

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('org_id');
      const role = localStorage.getItem('user_role');
      if (isMounted) {
        setOrgId(id);
        setUserRole(role);
        setIsLoggedIn(!!id);
        setLoading(false);
      }
    }
    return () => { isMounted = false; };
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
