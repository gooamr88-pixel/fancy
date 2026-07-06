'use client';

import { useState } from 'react';
import adminApi from '../../_lib/adminApi';
import useAdminList from '../../_hooks/useAdminList';
import usePermissions from '../../_hooks/usePermissions';
import DataTable from '../../_components/DataTable';
import FilterBar from '../../_components/FilterBar';
import Modal, { Button, StatusBadge } from '../../_components/Modal';
import { T } from '../../_components/theme';
import { useAlert } from '../../_components/AlertContext';
import { money as fmt } from '../../_lib/format';
import { Row, Field } from '../../_components/Field';

/**
 * Payment Center (Master Plan §9). Platform-wide payment ledger with status /
 * method filters, REAL Stripe refunds (full or partial), manual-payment approve
 * / decline, and a disputes view. All mutating actions are permission-gated.
 */

const METHOD_LABEL = { stripe: 'Card (Stripe)', cash_manual: 'Manual / Cash' };

export default function PaymentsPage() {
  const [tab, setTab] = useState('payments');

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>Payment Center</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>
          Platform payments, refunds, manual approvals and disputes.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <Tab active={tab === 'payments'} onClick={() => setTab('payments')}>Payments</Tab>
        <Tab active={tab === 'disputes'} onClick={() => setTab('disputes')}>Disputes</Tab>
      </div>

      {tab === 'payments' ? <PaymentsLedger /> : <DisputesList />}
    </div>
  );
}

function PaymentsLedger() {
  const { showAlert } = useAlert();
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [active, setActive] = useState(null); // payment row open in the modal
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null); // 'refund' | 'decline' | null
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const { rows, pagination, loading, error, reload } = useAdminList(
    '/payments',
    { page, limit: 25, status, method },
    (res) => res?.data || res?.payments || []
  );

  const open = (row) => {
    setActive(row);
    setMode(null);
    setReason('');
    setAmount(((row.amount_cents || 0) / 100).toFixed(2));
  };
  const close = () => { setActive(null); setMode(null); };

  const doRefund = async () => {
    const dollars = parseFloat(amount);
    const cents = Number.isFinite(dollars) ? Math.round(dollars * 100) : undefined;
    setBusy(true);
    try {
      const res = await adminApi.post(`/payments/${active.id}/refund`, {
        amountCents: cents,
        reason: reason || undefined,
      });
      await showAlert(res?.message || 'Refund processed.', 'Success', 'success');
      close();
      reload();
    } catch (err) {
      await showAlert(err.message || 'Refund failed', 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doDecline = async () => {
    setBusy(true);
    try {
      await adminApi.post(`/payments/${active.id}/decline`, { reason: reason || undefined });
      await showAlert('Payment declined.', 'Success', 'success');
      close();
      reload();
    } catch (err) {
      await showAlert(err.message || 'Decline failed', 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doApprove = async () => {
    setBusy(true);
    try {
      await adminApi.post('/manual-approve', { eventId: active.event_id, amountCents: active.amount_cents });
      await showAlert('Manual payment approved — event activated.', 'Success', 'success');
      close();
      reload();
    } catch (err) {
      await showAlert(err.message || 'Approval failed', 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <FilterBar>
        <Select value={status} onChange={setStatus} label="Status"
          options={[['', 'All statuses'], ['completed', 'Completed'], ['pending', 'Pending'], ['failed', 'Failed'], ['refunded', 'Refunded']]} />
        <Select value={method} onChange={setMethod} label="Method"
          options={[['', 'All methods'], ['stripe', 'Card (Stripe)'], ['cash_manual', 'Manual / Cash']]} />
      </FilterBar>

      {error && <p style={{ color: T.danger, marginBottom: 12 }}>{error}</p>}

      <DataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.id}
        pagination={pagination}
        onPageChange={setPage}
        onRefresh={reload}
        emptyText="No payments match these filters."
        columns={[
          {
            key: 'event', header: 'Event / Organizer', render: (r) => (
              <div>
                <div style={{ fontWeight: 600, color: T.text900 }}>{r.events?.title || '—'}</div>
                <div style={{ fontSize: 11, color: T.text400 }}>{r.events?.organizations?.name || '—'}</div>
              </div>
            ),
          },
          { key: 'amount_cents', header: 'Amount', align: 'right', render: (r) => <span style={{ fontWeight: 700, color: T.text900 }}>{fmt(r.amount_cents)}</span> },
          { key: 'payment_method', header: 'Method', render: (r) => <span style={{ color: T.text500 }}>{METHOD_LABEL[r.payment_method] || r.payment_method}</span> },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'created_at', header: 'Date', render: (r) => <span style={{ color: T.text500 }}>{new Date(r.completed_at || r.created_at).toLocaleDateString()}</span> },
          { key: 'actions', header: '', align: 'right', render: (r) => <Button variant="ghost" onClick={() => open(r)}>Manage</Button> },
        ]}
      />

      <Modal
        open={!!active}
        title="Payment"
        onClose={close}
        width={520}
        footer={active && !mode && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {active.status === 'completed' && can('payments.refund') && (
              <Button variant="danger" onClick={() => setMode('refund')}>Refund…</Button>
            )}
            {active.status === 'pending' && active.payment_method === 'cash_manual' && can('payments.manage') && (
              <>
                <Button variant="primary" disabled={busy} onClick={doApprove}>Approve</Button>
                <Button variant="warning" onClick={() => setMode('decline')}>Decline…</Button>
              </>
            )}
          </div>
        )}
      >
        {active && (
          <div style={{ fontSize: 13, color: T.text700 }}>
            <Row label="Event">{active.events?.title || '—'}</Row>
            <Row label="Organizer">{active.events?.organizations?.name || '—'}</Row>
            <Row label="Amount">{fmt(active.amount_cents)}</Row>
            <Row label="Method">{METHOD_LABEL[active.payment_method] || active.payment_method}</Row>
            <Row label="Status"><StatusBadge status={active.status} /></Row>
            <Row label="Reference">{active.reference_number || active.stripe_payment_intent_id || '—'}</Row>
            <Row label="Date">{new Date(active.completed_at || active.created_at).toLocaleString()}</Row>
            {active.refund_amount_cents > 0 && <Row label="Refunded">{fmt(active.refund_amount_cents)}</Row>}

            {mode === 'refund' && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                <Field label="Refund amount (USD)">
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
                </Field>
                <p style={{ fontSize: 11, color: T.text400, margin: '2px 0 10px' }}>
                  Full amount {fmt(active.amount_cents)} by default. Card payments are refunded through Stripe.
                </p>
                <Field label="Reason (optional)">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. duplicate charge" style={inputStyle} />
                </Field>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
                  <Button variant="danger" disabled={busy} onClick={doRefund}>{busy ? 'Processing…' : 'Confirm refund'}</Button>
                </div>
              </div>
            )}

            {mode === 'decline' && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                <Field label="Reason (optional)">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. funds never received" style={inputStyle} />
                </Field>
                <p style={{ fontSize: 11, color: T.text400, margin: '6px 0 0' }}>The event stays unpaid — nothing was collected.</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
                  <Button variant="warning" disabled={busy} onClick={doDecline}>{busy ? 'Processing…' : 'Confirm decline'}</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DisputesList() {
  const [page, setPage] = useState(1);
  const { rows, pagination, loading, error, reload } = useAdminList(
    '/payments/disputes',
    { page, limit: 25 },
    (res) => res?.data || res?.disputes || []
  );

  return (
    <div>
      {error && <p style={{ color: T.danger, marginBottom: 12 }}>{error}</p>}
      <DataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.id}
        pagination={pagination}
        onPageChange={setPage}
        onRefresh={reload}
        emptyText="No disputes recorded."
        columns={[
          { key: 'event', header: 'Event', render: (r) => r.event_payments?.events?.title || '—' },
          { key: 'amount_cents', header: 'Amount', align: 'right', render: (r) => fmt(r.amount_cents) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'reason', header: 'Reason', render: (r) => <span style={{ color: T.text500 }}>{r.reason || '—'}</span> },
          { key: 'created_at', header: 'Opened', render: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '9px 11px',
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  fontSize: 13,
  background: T.surfaceAlt,
  color: T.text900,
  outline: 'none',
};

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        border: `1px solid ${active ? T.primary : T.border}`,
        background: active ? T.primarySoft : 'transparent',
        color: active ? T.primary : T.text500,
        borderRadius: T.radiusSm,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Select({ value, onChange, options, label }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        minHeight: 44,
        padding: '9px 12px',
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm,
        fontSize: 13,
        background: T.surface,
        color: T.text700,
        cursor: 'pointer',
      }}
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

