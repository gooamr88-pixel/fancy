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
    (async () => {
      try {
        const res = await adminApi.get('/overview');
        setOv(res?.overview || null);
      } catch (err) {
        setError(err.message || 'Failed to load overview');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ color: T.text500 }}>Loading overview…</p>;
  if (error) return <p style={{ color: T.danger }}>{error}</p>;
  if (!ov) return <p style={{ color: T.text500 }}>No data available.</p>;

  const maxTrend = Math.max(1, ...(ov.revenue?.trend || []).map((t) => t.cents));

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0 }}>Executive Overview</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Platform-wide health at a glance.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard label="Gross Revenue" value={fmtMoney(ov.revenue?.grossCents)} sub={`${fmtMoney(ov.revenue?.pendingCents)} pending`} accent={T.success} icon="💳" />
        <StatCard label="Organizations" value={ov.organizations ?? 0} icon="🏢" />
        <StatCard label="Events" value={ov.events?.total ?? 0} sub={`${ov.events?.paid ?? 0} paid`} icon="🎉" />
        <StatCard label="RSVPs" value={ov.rsvps?.total ?? 0} sub={`${ov.rsvps?.attendingGuests ?? 0} attending guests`} icon="🧑‍🤝‍🧑" />
        <StatCard label="Check-ins" value={ov.checkIns ?? 0} icon="✅" />
        <StatCard label="SMS Credits" value={ov.sms?.remaining ?? 0} sub={`${ov.sms?.used ?? 0} used`} icon="✉️" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 22 }}>
        <div style={{ ...card, padding: '18px 20px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text900, margin: '0 0 16px' }}>Revenue — last 6 months</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
            {(ov.revenue?.trend || []).map((t) => (
              <div key={t.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 10, color: T.text500 }}>{fmtMoney(t.cents).replace('.00', '')}</div>
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(4, (t.cents / maxTrend) * 110)}px`,
                    background: T.primary,
                    borderRadius: '6px 6px 0 0',
                    opacity: 0.85,
                  }}
                  title={`${t.label}: ${fmtMoney(t.cents)}`}
                />
                <div style={{ fontSize: 11, color: T.text500, fontWeight: 600 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, padding: '18px 20px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text900, margin: '0 0 16px' }}>Events by status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(ov.events?.byStatus || {}).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: T.text700, textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
                <span style={{ fontWeight: 700, color: T.text900 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
