'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi from '../../_lib/adminApi';
import DataTable from '../../_components/DataTable';
import { Button } from '../../_components/Modal';
import { T } from '../../_components/theme';
import { useAlert } from '../../_components/AlertContext';

/**
 * Security Center (Master Plan §19): active sessions (revocable), security
 * events, and platform-wide login history.
 */
export default function SecurityPage() {
  const { showAlert } = useAlert();
  const [tab, setTab] = useState('sessions');
  const [sessions, setSessions] = useState({ rows: [], pagination: null, page: 1, loading: true });
  const [events, setEvents] = useState({ rows: [], pagination: null, page: 1, loading: true });
  const [logins, setLogins] = useState({ rows: [], pagination: null, page: 1, loading: true });
  const [busy, setBusy] = useState(false);

  const loadSessions = useCallback(async (page = 1) => {
    setSessions((s) => ({ ...s, loading: true }));
    const res = await adminApi.get('/security/sessions', { page, limit: 25 });
    setSessions({ rows: res?.sessions || [], pagination: res?.pagination || null, page, loading: false });
  }, []);
  const loadEvents = useCallback(async (page = 1) => {
    setEvents((s) => ({ ...s, loading: true }));
    const res = await adminApi.get('/security/events', { page, limit: 25 });
    setEvents({ rows: res?.events || [], pagination: res?.pagination || null, page, loading: false });
  }, []);
  const loadLogins = useCallback(async (page = 1) => {
    setLogins((s) => ({ ...s, loading: true }));
    const res = await adminApi.get('/security/login-history', { page, limit: 25 });
    setLogins({ rows: res?.history || [], pagination: res?.pagination || null, page, loading: false });
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [s, e, l] = await Promise.all([
          adminApi.get('/security/sessions', { page: 1, limit: 25 }),
          adminApi.get('/security/events', { page: 1, limit: 25 }),
          adminApi.get('/security/login-history', { page: 1, limit: 25 }),
        ]);
        if (!ignore) {
          setSessions({ rows: s?.sessions || [], pagination: s?.pagination || null, page: 1, loading: false });
          setEvents({ rows: e?.events || [], pagination: e?.pagination || null, page: 1, loading: false });
          setLogins({ rows: l?.history || [], pagination: l?.pagination || null, page: 1, loading: false });
        }
      } catch {
        if (!ignore) setSessions((st) => ({ ...st, loading: false }));
      }
    })();
    return () => { ignore = true; };
  }, []);

  const revoke = async (sessionId) => {
    setBusy(true);
    try {
      await adminApi.post(`/security/sessions/${sessionId}/revoke`);
      await loadSessions(sessions.page);
    } catch (err) {
      await showAlert(err.message || 'Revoke failed', 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    ['sessions', `Active sessions${sessions.pagination ? ` (${sessions.pagination.total})` : ''}`],
    ['events', 'Security events'],
    ['logins', 'Login history'],
  ];

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0 }}>Security Center</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Sessions, anomalies and login monitoring.</p>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: `1px solid ${T.border}` }}>
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ border: 'none', background: 'transparent', padding: '10px 4px', marginRight: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: tab === k ? T.primary : T.text500, borderBottom: tab === k ? `2px solid ${T.primary}` : '2px solid transparent' }}>{label}</button>
        ))}
      </div>

      {tab === 'sessions' && (
        <DataTable
          loading={sessions.loading} rows={sessions.rows} rowKey={(r) => r.id}
          pagination={sessions.pagination} onPageChange={loadSessions}
          columns={[
            { key: 'ownerEmail', header: 'User', render: (r) => r.ownerEmail || r.user_id },
            { key: 'device_label', header: 'Device', render: (r) => r.device_label || r.user_agent || '—' },
            { key: 'ip', header: 'IP' },
            { key: 'last_seen_at', header: 'Last seen', render: (r) => new Date(r.last_seen_at || r.created_at).toLocaleString() },
            { key: 'actions', header: '', align: 'right', render: (r) => <Button variant="ghost" disabled={busy} onClick={() => revoke(r.id)}>Revoke</Button> },
          ]}
        />
      )}

      {tab === 'events' && (
        <DataTable
          loading={events.loading} rows={events.rows} rowKey={(r) => r.id}
          pagination={events.pagination} onPageChange={loadEvents}
          emptyText="No security events recorded."
          columns={[
            { key: 'type', header: 'Type', render: (r) => <span style={{ fontFamily: 'monospace' }}>{r.type}</span> },
            { key: 'severity', header: 'Severity', render: (r) => <span style={{ color: r.severity === 'critical' ? T.danger : r.severity === 'warning' ? T.warning : T.text500, fontWeight: 600 }}>{r.severity}</span> },
            { key: 'ip', header: 'IP', render: (r) => r.ip || '—' },
            { key: 'created_at', header: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
          ]}
        />
      )}

      {tab === 'logins' && (
        <DataTable
          loading={logins.loading} rows={logins.rows} rowKey={(r) => r.id}
          pagination={logins.pagination} onPageChange={loadLogins}
          columns={[
            { key: 'success', header: 'Result', render: (r) => <span style={{ color: r.success ? T.success : T.danger, fontWeight: 700 }}>{r.success ? 'Success' : 'Failed'}</span> },
            { key: 'email', header: 'Email' },
            { key: 'ip', header: 'IP' },
            { key: 'failure_reason', header: 'Reason', render: (r) => r.failure_reason || '—' },
            { key: 'created_at', header: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
          ]}
        />
      )}
    </div>
  );
}
