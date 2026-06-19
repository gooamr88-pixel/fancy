'use client';

import { useState } from 'react';
import useAdminList from '../../_hooks/useAdminList';
import DataTable from '../../_components/DataTable';
import FilterBar from '../../_components/FilterBar';
import { T } from '../../_components/theme';

/**
 * Audit Logs (Master Plan §17): searchable, paginated view of admin actions with
 * IP / browser / OS context.
 */
export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { rows, pagination, loading } = useAdminList('/audit', { page, limit: 30, q }, (res) => res?.logs || res?.data || []);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0 }}>Audit Logs</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Every administrative action, with device context.</p>
      </header>

      <FilterBar onSearch={(val) => { setPage(1); setQ(val); }} placeholder="Search action…" />

      <DataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.id}
        pagination={pagination}
        onPageChange={setPage}
        columns={[
          { key: 'action', header: 'Action', render: (r) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.action}</span> },
          { key: 'actorName', header: 'Actor' },
          { key: 'entity_type', header: 'Entity', render: (r) => r.entity_type || '—' },
          { key: 'ip', header: 'IP', render: (r) => <span style={{ color: T.text500 }}>{r.ip || '—'}</span> },
          { key: 'browser', header: 'Device', render: (r) => [r.browser, r.os].filter(Boolean).join(' / ') || '—' },
          { key: 'created_at', header: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
        ]}
      />
    </div>
  );
}
