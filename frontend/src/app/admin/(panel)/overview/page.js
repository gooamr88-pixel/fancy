'use client';

import { useEffect, useState } from 'react';
import adminApi from '../../_lib/adminApi';
import StatCard from '../../_components/StatCard';
import DataTable from '../../_components/DataTable';
import { T, card } from '../../_components/theme';

/**
 * Executive Overview (Master Plan §1) rebuilt on the new shell + primitives.
 * Reads GET /admin/overview and renders KPI cards, a revenue trend, and the
 * recent activity feed. This is the first section migrated into the (panel)
 * shell, proving the foundation end-to-end.
 */
const fmtMoney = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OverviewPage() {
  const [ov, setOv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await adminApi.get('/overview');
        if (!ignore) setOv(res?.overview || null);
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load overview');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  if (loading) return <p style={{ color: T.text500 }}>Loading overview…</p>;
  if (error) return <p style={{ color: T.danger }}>{error}</p>;
  if (!ov) return <p style={{ color: T.text500 }}>No data available.</p>;

  const maxTrend = Math.max(1, ...(ov.revenue?.trend || []).map((t) => t.cents));

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>Executive Overview</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Platform-wide health at a glance.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Gross Revenue" value={fmtMoney(ov.revenue?.grossCents)} sub={`${fmtMoney(ov.revenue?.pendingCents)} pending`} accent={T.success} icon="💳" />
        <StatCard label="Organizations" value={ov.organizations ?? 0} icon="🏢" />
        <StatCard label="Events" value={ov.events?.total ?? 0} sub={`${ov.events?.paid ?? 0} paid`} icon="🎉" />
        <StatCard label="RSVPs" value={ov.rsvps?.total ?? 0} sub={`${ov.rsvps?.attendingGuests ?? 0} attending guests`} icon="🧑‍🤝‍🧑" />
        <StatCard label="Check-ins" value={ov.checkIns ?? 0} icon="✅" />
        <StatCard label="SMS Credits" value={ov.sms?.remaining ?? 0} sub={`${ov.sms?.used ?? 0} used`} icon="✉️" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 24 }}>
        <div style={{ ...card, padding: '24px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text900, margin: '0 0 4px', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>Revenue — last 6 months</h3>
          <p style={{ fontSize: 12, color: T.text500, margin: '0 0 20px' }}>Completed payments by month</p>
          
          <div style={{ position: 'relative', height: '160px', marginTop: '10px', padding: '0 10px' }}>
            {/* Gridlines */}
            <div style={{ position: 'absolute', inset: '0 0 24px 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ borderTop: `1px dashed ${T.border}`, width: '100%', height: 0 }} />
              ))}
            </div>
            {/* Bars container */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '16px', height: '100%', paddingBottom: '24px', zIndex: 1 }}>
              {(ov.revenue?.trend || []).map((t) => {
                const percent = (t.cents / maxTrend) * 100;
                return (
                  <div key={t.month} className="chart-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '10px', color: T.text900, fontWeight: 800, opacity: 0, transition: 'opacity 0.2s', marginBottom: '2px', background: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${T.border}`, whiteSpace: 'nowrap' }} className="chart-val">
                      {t.cents ? fmtMoney(t.cents).replace('.00', '') : '$0'}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '38px',
                        height: `${percent}%`,
                        minHeight: t.cents ? '6px' : '0',
                        background: `linear-gradient(180deg, rgba(197, 168, 107, 0.9), ${T.primary})`,
                        borderRadius: '6px 6px 0 0',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        cursor: 'pointer',
                        boxShadow: '0 0 12px rgba(197, 168, 107, 0.1)'
                      }}
                      className="chart-bar"
                      title={`${t.label}: ${fmtMoney(t.cents)}`}
                    />
                    <div style={{ fontSize: 11, color: T.text500, fontWeight: 700 }}>{t.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ ...card, padding: '24px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text900, margin: '0 0 20px', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>Events by status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.entries(ov.events?.byStatus || {}).map(([status, count]) => {
              const total = ov.events?.total || 1;
              const pct = (count / total) * 100;
              return (
                <div key={status}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                    <span style={{ color: T.text700, textTransform: 'capitalize', fontWeight: 600 }}>{status.replace('_', ' ')}</span>
                    <span style={{ fontWeight: 800, color: T.text900 }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: T.surfaceAlt, borderRadius: 3, overflow: 'hidden', border: `1px solid ${T.border}` }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: T.primary, borderRadius: 3, boxShadow: `0 0 8px ${T.primary}` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .chart-col:hover .chart-val {
          opacity: 1 !important;
        }
        .chart-bar:hover {
          background: linear-gradient(180deg, #FFFFFF, ${T.primary}) !important;
          box-shadow: 0 0 25px rgba(197, 168, 107, 0.35) !important;
          transform: scaleX(1.05);
        }
      `}</style>

      <DataTable
        title="Recent activity"
        columns={[
          { key: 'action', header: 'Action', render: (r) => <span style={{ fontWeight: 600 }}>{r.action}</span> },
          { key: 'entityType', header: 'Entity' },
          { key: 'eventTitle', header: 'Event', render: (r) => r.eventTitle || '—' },
          { key: 'createdAt', header: 'When', render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        rows={ov.recentActivity || []}
        rowKey={(r) => r.id}
        emptyText="No recent activity."
      />
    </div>
  );
}
