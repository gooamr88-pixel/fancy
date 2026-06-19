'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiClient';

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('org_id');
      const role = localStorage.getItem('user_role');
      setOrgId(id);
      setUserRole(role);
      setIsLoggedIn(!!id);
      setLoading(false);
    }
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

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    localStorage.removeItem('org_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('active_event_id');
    setIsLoggedIn(false);
    setOrgId(null);
    setUserRole(null);
    window.location.href = '/login';
  };

  return { isLoggedIn, orgId, userRole, loading, logout };
}
