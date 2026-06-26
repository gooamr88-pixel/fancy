'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { T } from './theme';
import { NAV_GROUPS } from './nav';

/**
 * Permission-gated sidebar navigation for the admin shell (Foundation F3).
 * Items the current admin cannot access are hidden; sections not yet built are
 * shown disabled with a "soon" tag.
 */
const ICONS = {
  overview: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  operations: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>,
  health: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  organizers: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="16"/><path d="M9 16h6v6"/><line x1="8" y1="6" x2="8.01" y2="6"/><line x1="16" y1="6" x2="16.01" y2="6"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="16" y1="11" x2="16.01" y2="11"/></svg>,
  support: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  events: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  invitations: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  guests: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  payments: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  credits: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="6"/><circle cx="18" cy="18" r="4"/><line x1="12" y1="12" x2="2" y2="22"/></svg>,
  subscriptions: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  finance: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  marketing: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>,
  cms: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  config: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  "feature-flags": <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  "auth-config": <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  notifications: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  analytics: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  insights: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  roles: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  security: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  audit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  data: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>,
};

/**
 * Permission-gated sidebar navigation for the admin shell (Foundation F3).
 * Items the current admin cannot access are hidden; sections not yet built are
 * shown disabled with a "soon" tag.
 */
export default function Sidebar({ can, open, onNavigate, onLogout }) {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: 256,
        flex: '0 0 256px',
        background: 'rgba(25, 27, 30, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(184, 148, 79, 0.08)',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        padding: '24px 16px',
        display: open ? 'flex' : 'none',
        flexDirection: 'column',
        gap: 20,
        boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
      }}
      data-admin-sidebar
    >
      <div style={{ padding: '4px 8px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <span style={{ fontSize: 20, color: '#D7BE80', textShadow: '0 0 12px rgba(215, 190, 128, 0.5)' }}>✦</span>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#FFFFFF', letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)' }}>Control Center</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((it) => can(it.perm));
          if (visible.length === 0) return null;
          return (
            <div key={group.heading} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ padding: '0 8px 4px', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#77736A', fontWeight: 800 }}>
                {group.heading}
              </div>
              {visible.map((it) => {
                const active = pathname === it.href;
                const icon = ICONS[it.key] || <span style={{ fontSize: 14 }}>⚙️</span>;
                const inner = (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <span 
                      className="sidebar-icon-container"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: T.radiusSm,
                        background: active ? 'rgba(184, 148, 79, 0.12)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${active ? 'rgba(184, 148, 79, 0.25)' : 'transparent'}`,
                        color: active ? '#D7BE80' : '#A19E95',
                        transition: 'all 0.2s',
                      }}
                    >
                      {icon}
                    </span>
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {!it.ready && (
                      <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', color: '#A19E95', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>
                        soon
                      </span>
                    )}
                  </span>
                );
                const baseStyle = {
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: T.radiusSm,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#D7BE80' : '#A19E95',
                  background: active ? 'rgba(184, 148, 79, 0.08)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                };
                return it.ready ? (
                  <Link
                    key={it.key}
                    href={it.href}
                    onClick={onNavigate}
                    className={`sidebar-item ${active ? 'active' : ''}`}
                    style={{
                      ...baseStyle,
                      textDecoration: 'none',
                    }}
                  >
                    {active && (
                      <span style={{ position: 'absolute', left: -4, top: 10, bottom: 10, width: 3, background: '#D7BE80', borderRadius: 2 }} />
                    )}
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={it.key}
                    style={{ ...baseStyle, color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }}
                    title="Coming soon"
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Exit/Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16 }}>
        <Link
          href="/dashboard"
          className="sidebar-exit-btn dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 10px',
            borderRadius: T.radiusSm,
            fontSize: 13,
            fontWeight: 600,
            color: '#D7BE80',
            background: 'rgba(184, 148, 79, 0.08)',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
        >
          <span className="exit-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: T.radiusSm, background: 'rgba(184, 148, 79, 0.12)', color: '#D7BE80', transition: 'all 0.2s' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 21 9 9 15 9 15 21"/></svg>
          </span>
          <span>Organizer Dashboard</span>
        </Link>

        <button
          onClick={onLogout}
          className="sidebar-exit-btn signout"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 10px',
            borderRadius: T.radiusSm,
            fontSize: 13,
            fontWeight: 600,
            color: '#EF4444',
            background: 'rgba(239, 68, 68, 0.04)',
            border: 'none',
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <span className="exit-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: T.radiusSm, background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', transition: 'all 0.2s' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </span>
          <span>Sign Out</span>
        </button>
      </div>

      <style jsx global>{`
        .sidebar-item {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sidebar-item:hover {
          background: rgba(255, 255, 255, 0.03) !important;
          color: #FFFFFF !important;
        }
        .sidebar-item:hover .sidebar-icon-container {
          transform: scale(1.05);
          background: rgba(184, 148, 79, 0.15) !important;
          color: #D7BE80 !important;
          border-color: rgba(184, 148, 79, 0.3) !important;
        }
        .sidebar-item.active {
          background: rgba(184, 148, 79, 0.08) !important;
          color: #D7BE80 !important;
        }
        .sidebar-item.active .sidebar-icon-container {
          background: rgba(184, 148, 79, 0.12) !important;
          border-color: rgba(184, 148, 79, 0.25) !important;
          color: #D7BE80 !important;
        }
        .sidebar-exit-btn {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sidebar-exit-btn.dashboard:hover {
          background: rgba(184, 148, 79, 0.15) !important;
        }
        .sidebar-exit-btn.dashboard:hover .exit-icon {
          transform: scale(1.05);
          background: rgba(184, 148, 79, 0.22) !important;
        }
        .sidebar-exit-btn.signout:hover {
          background: rgba(239, 68, 68, 0.1) !important;
        }
        .sidebar-exit-btn.signout:hover .exit-icon {
          transform: scale(1.05);
          background: rgba(239, 68, 68, 0.15) !important;
        }
      `}</style>
    </nav>
  );
}
