'use client';

import { useEffect, useState } from 'react';
import adminApi from '../../_lib/adminApi';
import StatCard from '../../_components/StatCard';
import { PageLoading } from '../../_components/Spinner';
import { T, card } from '../../_components/theme';
import { money } from '../../_lib/format';

/**
 * Financial Command Center (Master Plan §22). Reads GET /admin/finance/summary
 * (backed by the mv_daily_revenue rollup) and renders gross/net/refunded/profit
 * KPIs, a daily net bar chart, and a simple forecast.
 */
const fmt = (cents) => money(cents, 0);

const ICONS = {
  gross: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  net: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>,
  commission: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  payments: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  forecast: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><path d="M3 20h18" /></svg>,
};

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

  if (loading) return <PageLoading label="Loading financials…" />;
  if (error) return <p style={{ color: T.danger }}>{error}</p>;
  if (!fin) return <p style={{ color: T.text500 }}>No financial data.</p>;

  const t = fin.totals || {};
  const series = fin.series || [];
  const maxNet = Math.max(1, ...series.map((s) => s.net_cents || 0));

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>Financial Command Center</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>
          {fin.range?.from} → {fin.range?.to}
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard label="Gross Revenue" value={fmt(t.grossCents)} accent={T.success} icon={ICONS.gross} />
        <StatCard label="Net Revenue" value={fmt(t.netCents)} sub={`${fmt(t.refundedCents)} refunded`} icon={ICONS.net} />
        <StatCard label="Platform Profit" value={fmt(t.platformProfitCents)} sub={`${t.commissionPct || 0}% commission`} accent={T.primary} icon={ICONS.commission} />
        <StatCard label="Payments" value={t.paymentCount || 0} icon={ICONS.payments} />
        <StatCard label="Forecast (30d net)" value={fmt(fin.forecast?.next30DaysNetCents)} sub={`${fmt(fin.forecast?.avgDailyNetCents)}/day avg`} accent={T.warning} icon={ICONS.forecast} />
      </div>

      <div style={{ ...card, padding: '18px 20px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text900, margin: '0 0 16px' }}>Daily net revenue</h3>
        {series.length === 0 ? (
          <p style={{ color: T.text400, fontSize: 13 }}>No revenue recorded in this window.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, overflowX: 'auto' }}>
            {series.map((s) => {
              const net = s.net_cents || 0;
              // A day with more refunds than gross has negative net — flooring that
              // straight into the same height formula used to still draw a small
              // gold bar, visually implying revenue on a day that was actually a
              // net loss. Render those as a distinct (red) minimum-height marker.
              const isNegative = net < 0;
              const heightPx = isNegative ? 2 : Math.max(2, (net / maxNet) * 150);
              return (
                <div
                  key={s.day}
                  title={`${s.day}: ${fmt(net)}`}
                  style={{
                    flex: '1 0 8px',
                    minWidth: 8,
                    height: `${heightPx}px`,
                    background: isNegative ? T.danger : T.primary,
                    opacity: 0.85,
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
