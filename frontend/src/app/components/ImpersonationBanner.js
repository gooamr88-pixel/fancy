'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/apiClient';
import { toast } from '../utils/toast';
import Icon from './icons/Icon';

/**
 * Persistent indicator + escape hatch for an active admin impersonation
 * session (see backend/controllers/admin/userMgmtController.js's
 * impersonateOrganizer). Previously an admin who impersonated an organizer
 * had no visual reminder they were doing so, and no way back to their own
 * admin account short of a full logout + re-login.
 */
export default function ImpersonationBanner() {
  const [impersonatorEmail, setImpersonatorEmail] = useState(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await apiFetch('/auth/profile');
        if (!ignore && res?.profile?.impersonating) {
          setImpersonatorEmail(res.profile.impersonatorEmail || 'an admin');
        }
      } catch {
        // Silent — this banner is a safety nicety, not core page functionality.
      }
    })();
    return () => { ignore = true; };
  }, []);

  if (!impersonatorEmail) return null;

  const handleReturn = async () => {
    setReturning(true);
    try {
      await apiFetch('/auth/stop-impersonating', { method: 'POST' });
      window.location.href = '/admin/overview';
    } catch (err) {
      setReturning(false);
      toast.error(err.message || 'Could not return to your admin account. Please log out and back in.');
    }
  };

  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 9999,
        background: '#191B1E', color: '#FFFFFF',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
        gap: '12px', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)',
        borderBottom: '2px solid #B8944F', textAlign: 'center',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Icon name="lock" size={13} strokeWidth={1.7} /> Admin impersonation active — {impersonatorEmail} is viewing this account.</span>
      <button
        type="button"
        onClick={handleReturn}
        disabled={returning}
        style={{
          background: '#B8944F', color: '#191B1E', border: 'none', borderRadius: '6px',
          padding: '6px 14px', fontSize: '12px', fontWeight: 700,
          cursor: returning ? 'wait' : 'pointer',
        }}
      >
        {returning ? 'Returning…' : 'Return to Admin Account'}
      </button>
    </div>
  );
}
