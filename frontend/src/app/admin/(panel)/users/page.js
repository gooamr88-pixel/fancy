'use client';

import { useState } from 'react';
import adminApi from '../../_lib/adminApi';
import useAdminList from '../../_hooks/useAdminList';
import DataTable from '../../_components/DataTable';
import FilterBar from '../../_components/FilterBar';
import Modal, { Button, StatusBadge } from '../../_components/Modal';
import { T } from '../../_components/theme';

/**
 * User Management (Master Plan §4): paginated list with search, lifecycle
 * actions (suspend / ban / restore) and a detail modal showing sessions and
 * login history with per-session revocation.
 */
export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const { rows, pagination, loading, reload } = useAdminList(
    '/users',
    { page, limit: 25, q },
    (res) => res?.data || res?.users || []
  );

  const openDetail = async (userId) => {
    setDetail({ loading: true });
    try {
      const res = await adminApi.get(`/users/${userId}`);
      setDetail({ loading: false, user: res?.user || null });
    } catch (err) {
      setDetail({ loading: false, error: err.message });
    }
  };

  const changeStatus = async (userId, status) => {
    let reason = '';
    if (status !== 'active') {
      reason = window.prompt(`Reason for ${status}:`, '') || '';
    }
    setBusy(true);
    try {
      await adminApi.patch(`/users/${userId}/status`, { status, reason });
      reload();
      if (detail?.user) await openDetail(userId);
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const revokeSession = async (userId, sessionId) => {
    setBusy(true);
    try {
      await adminApi.post(`/users/${userId}/sessions/${sessionId}/revoke`);
      await openDetail(userId);
    } catch (err) {
      alert(err.message || 'Revoke failed');
    } finally {
      setBusy(false);
    }
  };

  const u = detail?.user;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0 }}>Users</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Manage accounts, sessions and lifecycle.</p>
      </header>

      <FilterBar onSearch={(val) => { setPage(1); setQ(val); }} placeholder="Search name or email…" />

      <DataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.userId}
        pagination={pagination}
        onPageChange={setPage}
        columns={[
          { key: 'name', header: 'Name', render: (r) => r.name || '—' },
          { key: 'email', header: 'Email', render: (r) => <span style={{ color: T.text500 }}>{r.email}</span> },
          { key: 'eventCount', header: 'Events', align: 'right' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status || 'active'} /> },
          { key: 'actions', header: '', align: 'right', render: (r) => <Button variant="ghost" onClick={() => openDetail(r.userId)}>Manage</Button> },
        ]}
      />

      <Modal open={!!detail} title={u ? (u.name || u.email) : 'User'} onClose={() => setDetail(null)} width={640}
        footer={u && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {u.status !== 'active' && <Button variant="primary" disabled={busy} onClick={() => changeStatus(u.userId, 'active')}>Restore</Button>}
            {u.status === 'active' && <Button variant="warning" disabled={busy} onClick={() => changeStatus(u.userId, 'suspended')}>Suspend</Button>}
            {u.status !== 'banned' && <Button variant="danger" disabled={busy} onClick={() => changeStatus(u.userId, 'banned')}>Ban</Button>}
          </div>
        )}
      >
        {detail?.loading && <p style={{ color: T.text500 }}>Loading…</p>}
        {detail?.error && <p style={{ color: T.danger }}>{detail.error}</p>}
        {u && (
          <div style={{ fontSize: 13, color: T.text700 }}>
            <Row label="Status"><StatusBadge status={u.status} /></Row>
            <Row label="Email">{u.email}</Row>
            <Row label="Phone">{u.phone || '—'}</Row>
            <Row label="Role">{u.role}</Row>
            <Row label="Events">{u.eventCount}</Row>
            <Row label="Joined">{new Date(u.createdAt).toLocaleDateString()}</Row>
            {u.suspendedReason && <Row label="Reason">{u.suspendedReason}</Row>}

            <h4 style={{ margin: '18px 0 8px', fontSize: 13, fontWeight: 700, color: T.text900 }}>Active sessions</h4>
            {(u.sessions || []).filter((s) => !s.revoked_at).length === 0 ? (
              <p style={{ color: T.text400, fontSize: 12 }}>No active sessions.</p>
            ) : (u.sessions || []).filter((s) => !s.revoked_at).map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 12.5 }}>{s.device_label || s.user_agent || 'Unknown device'}</div>
                  <div style={{ fontSize: 11, color: T.text400 }}>{s.ip} · {new Date(s.created_at).toLocaleString()}</div>
                </div>
                <Button variant="ghost" disabled={busy} onClick={() => revokeSession(u.userId, s.id)}>Revoke</Button>
              </div>
            ))}

            <h4 style={{ margin: '18px 0 8px', fontSize: 13, fontWeight: 700, color: T.text900 }}>Recent logins</h4>
            {(u.loginHistory || []).length === 0 ? (
              <p style={{ color: T.text400, fontSize: 12 }}>No login history.</p>
            ) : (u.loginHistory || []).map((l, i) => (
              <div key={i} style={{ fontSize: 12, color: T.text500, padding: '4px 0' }}>
                <span style={{ color: l.success ? T.success : T.danger, fontWeight: 600 }}>{l.success ? '✓' : '✗'}</span>{' '}
                {new Date(l.created_at).toLocaleString()} · {l.ip} {l.failure_reason ? `· ${l.failure_reason}` : ''}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0' }}>
      <span style={{ width: 90, color: T.text400, fontSize: 12 }}>{label}</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}
