'use client';

import { useEffect, useState } from 'react';
import adminApi from '../../_lib/adminApi';
import StatCard from '../../_components/StatCard';
import { T, card } from '../../_components/theme';

/**
 * Financial Command Center (Master Plan §22). Reads GET /admin/finance/summary
 * (backed by the mv_daily_revenue rollup) and renders gross/net/refunded/profit
 * KPIs, a daily net bar chart, and a simple forecast.
 */
const fmt = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function FinancePage() {
  const [fin, setFin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await adminApi.get('/finance/summary');
        if (!ignore) setFin(res?.finance || null);
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load financials');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  if (loading) return <p style={{ color: T.text500 }}>Loading financials…</p>;
  if (error) return <p style={{ color: T.danger }}>{error}</p>;
  if (!fin) return <p style={{ color: T.text500 }}>No financial data.</p>;

  const t = fin.totals || {};
  const series = fin.series || [];
  const maxNet = Math.max(1, ...series.map((s) => s.net_cents || 0));

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0 }}>Financial Command Center</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>
          {fin.range?.from} → {fin.range?.to}
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard label="Gross Revenue" value={fmt(t.grossCents)} accent={T.success} icon="💰" />
        <StatCard label="Net Revenue" value={fmt(t.netCents)} sub={`${fmt(t.refundedCents)} refunded`} icon="💵" />
        <StatCard label="Platform Profit" value={fmt(t.platformProfitCents)} sub={`${t.commissionPct || 0}% commission`} accent={T.primary} icon="💹" />
        <StatCard label="Payments" value={t.paymentCount || 0} icon="🧾" />
        <StatCard label="Forecast (30d net)" value={fmt(fin.forecast?.next30DaysNetCents)} sub={`${fmt(fin.forecast?.avgDailyNetCents)}/day avg`} accent={T.warning} icon="📈" />
      </div>

      <div style={{ ...card, padding: '18px 20px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text900, margin: '0 0 16px' }}>Daily net revenue</h3>
        {series.length === 0 ? (
          <p style={{ color: T.text400, fontSize: 13 }}>No revenue recorded in this window.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, overflowX: 'auto' }}>
            {series.map((s) => (
              <div
                key={s.day}
                title={`${s.day}: ${fmt(s.net_cents)}`}
                style={{
                  flex: '1 0 8px',
                  minWidth: 8,
                  height: `${Math.max(2, ((s.net_cents || 0) / maxNet) * 150)}px`,
                  background: T.primary,
                  opacity: 0.85,
                  borderRadius: '4px 4px 0 0',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
