'use client';

import { useState } from 'react';
import adminApi from '../../_lib/adminApi';
import useAdminList from '../../_hooks/useAdminList';
import usePermissions from '../../_hooks/usePermissions';
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
  const { can } = usePermissions();
  const [tab, setTab] = useState('sessions');
  const [busy, setBusy] = useState(false);

  const [sessionsPage, setSessionsPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const [loginsPage, setLoginsPage] = useState(1);

  const sessions = useAdminList('/security/sessions', { page: sessionsPage, limit: 25 }, (r) => r?.sessions || []);
  const events = useAdminList('/security/events', { page: eventsPage, limit: 25 }, (r) => r?.events || []);
  const logins = useAdminList('/security/login-history', { page: loginsPage, limit: 25 }, (r) => r?.history || []);

  const revoke = async (sessionId) => {
    setBusy(true);
    try {
      await adminApi.post(`/security/sessions/${sessionId}/revoke`);
      sessions.reload();
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
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>Security Center</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Sessions, anomalies and login monitoring.</p>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: `1px solid ${T.border}` }}>
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ border: 'none', background: 'transparent', padding: '10px 4px', marginRight: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: tab === k ? T.primary : T.text500, borderBottom: tab === k ? `2px solid ${T.primary}` : '2px solid transparent' }}>{label}</button>
        ))}
      </div>

      {tab === 'sessions' && (<>
        {sessions.error && <p style={{ color: T.danger, fontSize: 13 }}>{sessions.error}</p>}
        <DataTable
          loading={sessions.loading} rows={sessions.rows} rowKey={(r) => r.id}
          pagination={sessions.pagination} onPageChange={setSessionsPage}
          columns={[
            { key: 'ownerEmail', header: 'User', render: (r) => r.ownerEmail || r.user_id },
            { key: 'device_label', header: 'Device', render: (r) => r.device_label || r.user_agent || '—' },
            { key: 'ip', header: 'IP' },
            { key: 'last_seen_at', header: 'Last seen', render: (r) => new Date(r.last_seen_at || r.created_at).toLocaleString() },
            ...(can('security.manage') ? [{ key: 'actions', header: '', align: 'right', render: (r) => <Button variant="ghost" disabled={busy} onClick={() => revoke(r.id)}>Revoke</Button> }] : []),
          ]}
        />
      </>)}

      {tab === 'events' && (<>
        {events.error && <p style={{ color: T.danger, fontSize: 13 }}>{events.error}</p>}
        <DataTable
          loading={events.loading} rows={events.rows} rowKey={(r) => r.id}
          pagination={events.pagination} onPageChange={setEventsPage}
          emptyText="No security events recorded."
          columns={[
            { key: 'type', header: 'Type', render: (r) => <span style={{ fontFamily: 'monospace' }}>{r.type}</span> },
            { key: 'severity', header: 'Severity', render: (r) => <span style={{ color: r.severity === 'critical' ? T.danger : r.severity === 'warning' ? T.warning : T.text500, fontWeight: 600 }}>{r.severity}</span> },
            { key: 'ip', header: 'IP', render: (r) => r.ip || '—' },
            { key: 'created_at', header: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
          ]}
        />
      </>)}

      {tab === 'logins' && (<>
        {logins.error && <p style={{ color: T.danger, fontSize: 13 }}>{logins.error}</p>}
        <DataTable
          loading={logins.loading} rows={logins.rows} rowKey={(r) => r.id}
          pagination={logins.pagination} onPageChange={setLoginsPage}
          columns={[
            { key: 'success', header: 'Result', render: (r) => <span style={{ color: r.success ? T.success : T.danger, fontWeight: 700 }}>{r.success ? 'Success' : 'Failed'}</span> },
            { key: 'email', header: 'Email' },
            { key: 'ip', header: 'IP' },
            { key: 'failure_reason', header: 'Reason', render: (r) => r.failure_reason || '—' },
            { key: 'created_at', header: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
          ]}
        />
      </>)}
    </div>
  );
}
