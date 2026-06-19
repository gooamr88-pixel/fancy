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
export default function Sidebar({ can, open, onNavigate }) {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: 248,
        flex: '0 0 248px',
        background: T.surface,
        borderRight: `1px solid ${T.border}`,
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        padding: '18px 12px',
        display: open ? 'block' : 'none',
      }}
      data-admin-sidebar
    >
      <div style={{ padding: '6px 10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>✦</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: T.text900 }}>Control Center</span>
      </div>

      {NAV_GROUPS.map((group) => {
        const visible = group.items.filter((it) => can(it.perm));
        if (visible.length === 0) return null;
        return (
          <div key={group.heading} style={{ marginBottom: 14 }}>
            <div style={{ padding: '4px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.text400, fontWeight: 700 }}>
              {group.heading}
            </div>
            {visible.map((it) => {
              const active = pathname === it.href;
              const inner = (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{it.icon}</span>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {!it.ready && (
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: T.text400, background: T.surfaceAlt, padding: '2px 6px', borderRadius: 6 }}>
                      soon
                    </span>
                  )}
                </span>
              );
              const baseStyle = {
                display: 'flex',
                alignItems: 'center',
                padding: '9px 10px',
                borderRadius: T.radiusSm,
                fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                color: active ? T.primary : T.text700,
                background: active ? T.primarySoft : 'transparent',
                marginBottom: 2,
              };
              return it.ready ? (
                <Link key={it.key} href={it.href} onClick={onNavigate} style={{ ...baseStyle, textDecoration: 'none' }}>
                  {inner}
                </Link>
              ) : (
                <div key={it.key} style={{ ...baseStyle, color: T.text400, cursor: 'not-allowed' }} title="Coming soon">
                  {inner}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
