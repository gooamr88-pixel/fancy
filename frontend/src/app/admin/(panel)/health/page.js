'use client';

import { useEffect, useState } from 'react';
import adminApi from '../../_lib/adminApi';
import { T, card } from '../../_components/theme';

/**
 * System Health Center (Master Plan §20): per-service status cards with latency,
 * auto-refreshing every 15s.
 */
const STATUS_COLOR = {
  healthy: T.success,
  configured: T.success,
  degraded: T.danger,
  unconfigured: T.warning,
};

export default function HealthPage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await adminApi.get('/health');
        if (!ignore) { setHealth(res?.health || null); setError(null); }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load health');
      }
    })();
    return () => { ignore = true; };
  }, [tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>System Health</h1>
          <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>
            {health ? `Overall: ` : 'Checking…'}
            {health && <strong style={{ color: STATUS_COLOR[health.overall] || T.text700, textTransform: 'capitalize' }}>{health.overall}</strong>}
          </p>
        </div>
        <span style={{ fontSize: 11, color: T.text400, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Auto-refresh 15s</span>
      </header>

      {error && <p style={{ color: T.danger }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {(health?.services || []).map((s) => {
          const color = STATUS_COLOR[s.status] || T.text500;
          return (
            <div key={s.name} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: T.text900, textTransform: 'capitalize' }}>{s.name}</span>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
              </div>
              <div style={{ fontSize: 13, color, fontWeight: 600, marginTop: 8, textTransform: 'capitalize' }}>{s.status}</div>
              {s.latencyMs != null && <div style={{ fontSize: 12, color: T.text400, marginTop: 4 }}>{s.latencyMs} ms</div>}
              {s.error && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>{s.error}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
