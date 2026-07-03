'use client';

import { T, card } from './theme';

/**
 * Compact KPI card for dashboards (Design Requirements — Cards/KPIs).
 * @param {{ label: string, value: React.ReactNode, sub?: string, accent?: string, icon?: string }} props
 */
export default function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div
      className="admin-stat-card"
      style={{
        ...card,
        padding: '22px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent || 'transparent' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.text500, fontWeight: 800 }}>
          {label}
        </span>
        {icon && (
          <span style={{
            fontSize: 16,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: T.surfaceAlt,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${T.border}`,
          }}>
            {icon}
          </span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, marginTop: 12, color: T.text900, lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: T.text500, marginTop: 8, fontWeight: 500 }}>{sub}</div>}

      <style jsx global>{`
        .admin-stat-card:hover {
          transform: translateY(-3px);
          border-color: ${T.borderStrong} !important;
          box-shadow: ${T.shadowMd} !important;
        }
      `}</style>
    </div>
  );
}
