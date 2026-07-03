'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { T } from './theme';
import Sidebar from './Sidebar';
import usePermissions from '../_hooks/usePermissions';
import { logout } from '../../utils/apiClient';
import LogoutModal from '../../components/LogoutModal';
import { AlertProvider } from './AlertContext';
import { NAV_GROUPS } from './nav';

// Flat pathname -> required permission map, derived once from the same nav
// model the sidebar uses to decide what's visible.
const PERM_BY_PATH = NAV_GROUPS.flatMap((g) => g.items).reduce((map, item) => {
  map[item.href] = item.perm;
  return map;
}, {});

/**
 * The Super Admin Control Center shell (Foundation F3): permission-gated sidebar
 * + topbar + content area. Handles loading and not-an-admin states centrally so
 * section pages can assume an authorized context.
 *
 * Responsive: on narrow viewports the sidebar collapses behind a ☰ toggle.
 */
export default function AdminShell({ children }) {
  const { me, loading, error, can, isSuperAdmin } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const pathname = usePathname();

  if (loading) {
    return (
      <Centered>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: '40px', height: '40px', border: `3px solid ${T.border}`, borderTop: `3px solid ${T.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <div style={{ color: T.text500, fontSize: 13, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Loading Control Center…</div>
          <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Centered>
    );
  }

  if (error || !me) {
    return (
      <Centered>
        <div style={{ textAlign: 'center', maxWidth: 400, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '40px 32px', boxShadow: T.shadowMd }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, color: T.primary }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text900, margin: '0 0 12px', fontFamily: 'var(--font-serif)' }}>Access Restricted</h2>
          <p style={{ fontSize: 14, color: T.text500, margin: '0 0 24px', lineHeight: 1.6 }}>
            {error || 'You do not have administrative access to this area.'}
          </p>
          <a href="/dashboard" style={{ display: 'inline-block', background: T.primary, color: '#FFFFFF', padding: '10px 24px', borderRadius: T.radiusSm, fontSize: 13, fontWeight: 700, textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Return to Dashboard
          </a>
        </div>
      </Centered>
    );
  }

  // Sidebar only hides links the admin can't reach — it never stopped a direct
  // URL visit (bookmark, typed address, or a permission revoked mid-session)
  // from rendering the page anyway, which then just broke on its own data
  // fetch. Block on the specific permission the current route needs before
  // rendering its content, same as the "not an admin at all" case above.
  const requiredPerm = PERM_BY_PATH[pathname];
  if (requiredPerm && !isSuperAdmin && !can(requiredPerm)) {
    return (
      <Centered>
        <div style={{ textAlign: 'center', maxWidth: 400, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '40px 32px', boxShadow: T.shadowMd }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, color: T.primary }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text900, margin: '0 0 12px', fontFamily: 'var(--font-serif)' }}>Access Restricted</h2>
          <p style={{ fontSize: 14, color: T.text500, margin: '0 0 24px', lineHeight: 1.6 }}>
            Your role doesn&apos;t include permission to view this section. Ask another admin to grant it if you need access.
          </p>
          <Link href="/admin/overview" style={{ display: 'inline-block', background: T.primary, color: '#FFFFFF', padding: '10px 24px', borderRadius: T.radiusSm, fontSize: 13, fontWeight: 700, textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Back to Overview
          </Link>
        </div>
      </Centered>
    );
  }

  return (
    <AlertProvider>
      <div style={{ display: 'flex', minHeight: '100dvh', background: T.bg, color: T.text900, fontFamily: 'var(--font-sans)' }}>
        <Sidebar can={can} open={sidebarOpen} onNavigate={() => {}} onLogout={() => setShowLogoutModal(true)} onClose={() => setSidebarOpen(false)} />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Topbar */}
          <header
            style={{
              height: 64,
              background: 'rgba(25, 27, 30, 0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle navigation"
              style={{
                border: 'none',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                width: 36,
                height: 36,
                borderRadius: T.radiusSm,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#A19E95',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; e.currentTarget.style.color = '#A19E95'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: '#B8944F',
                  background: 'rgba(184, 148, 79, 0.15)',
                  border: '1px solid rgba(184, 148, 79, 0.3)',
                  padding: '4px 12px',
                  borderRadius: 20,
                  textTransform: 'uppercase',
                }}
              >
                {isSuperAdmin ? 'Super Admin' : (me.roles && me.roles[0]) || 'Admin'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>{me.name || 'Admin'}</span>
                <span style={{ fontSize: 11, color: '#A19E95' }}>{me.email}</span>
              </div>
            </div>
          </header>

          <main style={{ flex: 1, padding: '32px clamp(20px, 4vw, 40px)', maxWidth: 1440, width: '100%', boxSizing: 'border-box' }}>
            {children}
          </main>
        </div>
        <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={logout} />
      </div>
    </AlertProvider>
  );
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100dvh', background: T.bg, colorScheme: 'light', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {children}
    </div>
  );
}
