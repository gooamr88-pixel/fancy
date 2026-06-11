'use client';
import { useState, useEffect } from 'react';

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

  const logout = async () => {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) { /* ignore */ }
    localStorage.removeItem('org_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('active_event_id');
    setIsLoggedIn(false);
    setOrgId(null);
    setUserRole(null);
    window.location.href = '/';
  };

  return { isLoggedIn, orgId, userRole, loading, logout };
}
