'use client';

import { useState } from 'react';
import { T } from './theme';
import Sidebar from './Sidebar';
import usePermissions from '../_hooks/usePermissions';

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
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, colorScheme: 'dark', fontFamily: 'var(--font-sans)' }}>
      <Sidebar can={can} open={sidebarOpen} onNavigate={() => {}} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header
          style={{
            height: 64,
            background: 'rgba(18, 20, 26, 0.75)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${T.border}`,
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
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${T.border}`,
              width: 36,
              height: 36,
              borderRadius: T.radiusSm,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: T.text700,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = T.primary; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = T.text700; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: T.primary,
                background: T.primarySoft,
                border: `1px solid rgba(197, 168, 107, 0.25)`,
                padding: '4px 12px',
                borderRadius: 20,
                textTransform: 'uppercase',
              }}
            >
              {isSuperAdmin ? 'Super Admin' : (me.roles && me.roles[0]) || 'Admin'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text900 }}>{me.name || 'Admin'}</span>
              <span style={{ fontSize: 11, color: T.text500 }}>{me.email}</span>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: '32px clamp(20px, 4vw, 40px)', maxWidth: 1440, width: '100%', boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, colorScheme: 'dark', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {children}
    </div>
  );
}
