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
        <div style={{ color: T.text500, fontSize: 14 }}>Loading Control Center…</div>
      </Centered>
    );
  }

  if (error || !me) {
    return (
      <Centered>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text900, margin: '0 0 8px' }}>Access restricted</h2>
          <p style={{ fontSize: 14, color: T.text500, margin: 0 }}>
            {error || 'You do not have administrative access to this area.'}
          </p>
        </div>
      </Centered>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, colorScheme: 'dark' }}>
      <Sidebar can={can} open={sidebarOpen} onNavigate={() => {}} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header
          style={{
            height: 60,
            background: T.surface,
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle navigation"
            style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: T.text700 }}
          >
            ☰
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: isSuperAdmin ? T.primary : T.text700,
                background: isSuperAdmin ? T.primarySoft : T.surfaceAlt,
                border: `1px solid ${T.border}`,
                padding: '4px 10px',
                borderRadius: 20,
                textTransform: 'capitalize',
              }}
            >
              {isSuperAdmin ? 'Super Admin' : (me.roles && me.roles[0]) || 'Admin'}
            </span>
            <span style={{ fontSize: 13, color: T.text500 }}>{me.email}</span>
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px clamp(16px, 3vw, 32px)', maxWidth: 1400, width: '100%' }}>
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
