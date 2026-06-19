'use client';

import { T, card } from './theme';

/**
 * Compact KPI card for dashboards (Design Requirements — Cards/KPIs).
 * @param {{ label: string, value: React.ReactNode, sub?: string, accent?: string, icon?: string }} props
 */
export default function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ ...card, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.text500, fontWeight: 700 }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: 16, opacity: 0.7 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 10, color: accent || T.text900, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.text500, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
