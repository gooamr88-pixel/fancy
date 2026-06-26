'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi from '../../_lib/adminApi';
import useAdminList from '../../_hooks/useAdminList';
import usePermissions from '../../_hooks/usePermissions';
import DataTable from '../../_components/DataTable';
import Modal, { Button, StatusBadge } from '../../_components/Modal';
import { T, card } from '../../_components/theme';
import { useAlert } from '../../_components/AlertContext';

/**
 * Subscription Management (Master Plan §11). First-class plans (CRUD +
 * enable/disable) seeded from the legacy pricing tiers, plus the per-organization
 * subscriptions ledger.
 */
const fmt = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const INTERVAL_LABEL = { one_time: 'one-time', monthly: '/mo', yearly: '/yr' };
const EMPTY_PLAN = { key: '', name: '', description: '', price: '', interval: 'one_time', currency: 'usd', features: '', maxGuests: '', maxEvents: '', sortOrder: '0' };

export default function SubscriptionsPage() {
  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0 }}>Subscription Management</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Manage plans and review active subscriptions.</p>
      </header>
      <Plans />
      <div style={{ height: 28 }} />
      <SubscriptionsLedger />
    </div>
  );
}

function Plans() {
  const { showAlert, showConfirm } = useAlert();
  const { can } = usePermissions();
  const manage = can('subscriptions.manage');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const [editing, setEditing] = useState(null); // plan row or 'new'
  const [form, setForm] = useState(EMPTY_PLAN);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await adminApi.get('/subscriptions/plans');
        if (!ignore) { setPlans(res?.plans || []); setError(null); }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load plans');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [nonce]);

  const openNew = () => { setForm(EMPTY_PLAN); setEditing('new'); };
  const openEdit = (p) => {
    setForm({
      key: p.key, name: p.name, description: p.description || '',
      price: ((p.price_cents || 0) / 100).toFixed(2), interval: p.interval || 'one_time',
      currency: p.currency || 'usd', features: (p.features || []).join('\n'),
      maxGuests: p.max_guests != null ? String(p.max_guests) : '',
      maxEvents: p.max_events != null ? String(p.max_events) : '',
      sortOrder: String(p.sort_order || 0),
    });
    setEditing(p);
  };

  const save = async () => {
    const features = form.features.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const base = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priceCents: Math.round(parseFloat(form.price) * 100) || 0,
      interval: form.interval,
      currency: form.currency || 'usd',
      features,
      maxGuests: form.maxGuests === '' ? null : parseInt(form.maxGuests, 10),
      maxEvents: form.maxEvents === '' ? null : parseInt(form.maxEvents, 10),
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    };
    if (!base.name) { await showAlert('Name is required.', 'Validation Error', 'warning'); return; }
    if (editing === 'new') {
      const key = form.key.trim().toLowerCase();
      if (!/^[a-z][a-z0-9_]*$/.test(key)) { await showAlert('Key must be lowercase snake_case (e.g. pro_plan).', 'Validation Error', 'warning'); return; }
      base.key = key;
    }
    setBusy(true);
    try {
      if (editing === 'new') await adminApi.post('/subscriptions/plans', base);
      else await adminApi.patch(`/subscriptions/plans/${editing.id}`, base);
      setEditing(null);
      reload();
    } catch (err) {
      await showAlert(err.message || 'Save failed', 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p) => {
    try { await adminApi.patch(`/subscriptions/plans/${p.id}/active`, { isActive: !p.is_active }); reload(); }
    catch (err) { await showAlert(err.message || 'Update failed', 'Error', 'error'); }
  };

  const remove = async (p) => {
    if (!await showConfirm(`Delete plan "${p.name}"? Plans with active subscriptions cannot be deleted — disable instead.`, 'Delete Plan', 'danger')) return;
    try { await adminApi.del(`/subscriptions/plans/${p.id}`); reload(); }
    catch (err) { await showAlert(err.message || 'Delete failed', 'Error', 'error'); }
  };

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text900, margin: 0 }}>Plans</h2>
        {manage && <Button variant="primary" onClick={openNew}>+ New plan</Button>}
      </div>

      {error && <p style={{ color: T.danger }}>{error}</p>}
      {loading ? (
        <p style={{ color: T.text500 }}>Loading plans…</p>
      ) : plans.length === 0 ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: T.text400, fontSize: 13 }}>No plans yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
          {plans.map((p) => (
            <div key={p.id} style={{ ...card, padding: 18, opacity: p.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 700, color: T.text900 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: T.text400, fontFamily: 'monospace' }}>{p.key}</div>
                </div>
                {!p.is_active && <span style={{ fontSize: 10, color: T.text400, fontWeight: 700 }}>DISABLED</span>}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text900, marginTop: 8 }}>
                {fmt(p.price_cents)} <span style={{ fontSize: 12, fontWeight: 600, color: T.text400 }}>{INTERVAL_LABEL[p.interval] || ''}</span>
              </div>
              {p.max_guests != null && <div style={{ fontSize: 12, color: T.text500, marginTop: 4 }}>Up to {p.max_guests.toLocaleString()} guests</div>}
              {(p.features || []).length > 0 && (
                <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', fontSize: 12, color: T.text500 }}>
                  {(p.features || []).slice(0, 4).map((f, i) => <li key={i} style={{ padding: '2px 0' }}>✓ {f}</li>)}
                </ul>
              )}
              {manage && (
                <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                  <Button variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
                  <Button variant="ghost" onClick={() => toggleActive(p)}>{p.is_active ? 'Disable' : 'Enable'}</Button>
                  <Button variant="ghost" onClick={() => remove(p)}>Delete</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        title={editing === 'new' ? 'New plan' : 'Edit plan'}
        onClose={() => setEditing(null)}
        width={560}
        footer={<>
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>
        </>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {editing === 'new' && (
            <Field label="Key (snake_case)"><input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="pro_plan" style={inputStyle} /></Field>
          )}
          <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} /></Field>
          <Field label="Price (USD)"><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={inputStyle} /></Field>
          <Field label="Interval">
            <select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} style={inputStyle}>
              <option value="one_time">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field label="Max guests"><input type="number" min="0" value={form.maxGuests} onChange={(e) => setForm({ ...form, maxGuests: e.target.value })} placeholder="unlimited" style={inputStyle} /></Field>
          <Field label="Max events"><input type="number" min="0" value={form.maxEvents} onChange={(e) => setForm({ ...form, maxEvents: e.target.value })} placeholder="unlimited" style={inputStyle} /></Field>
          <Field label="Sort order"><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} style={inputStyle} /></Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} /></Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Features (one per line)">
            <textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
        </div>
      </Modal>
    </section>
  );
}

function SubscriptionsLedger() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { rows, pagination, loading, error } = useAdminList(
    '/subscriptions',
    { page, limit: 25, status },
    (res) => res?.data || res?.subscriptions || []
  );

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text900, margin: 0 }}>Subscriptions</h2>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          style={{ padding: '8px 12px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, background: T.surface, color: T.text700, cursor: 'pointer' }}
        >
          {[['', 'All statuses'], ['active', 'Active'], ['trialing', 'Trialing'], ['past_due', 'Past due'], ['canceled', 'Canceled']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {error && <p style={{ color: T.danger }}>{error}</p>}
      <DataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.id}
        pagination={pagination}
        onPageChange={setPage}
        emptyText="No subscriptions yet."
        columns={[
          { key: 'org', header: 'Organization', render: (r) => <span style={{ fontWeight: 600, color: T.text900 }}>{r.organizations?.name || '—'}</span> },
          { key: 'plan', header: 'Plan', render: (r) => r.plans?.name || '—' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'period', header: 'Current period', render: (r) => (
              <span style={{ color: T.text500 }}>
                {r.current_period_start ? new Date(r.current_period_start).toLocaleDateString() : '—'}
                {' → '}
                {r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : '—'}
              </span>
            ),
          },
          { key: 'created_at', header: 'Created', render: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />
    </section>
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

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 4 }}>
      <span style={{ display: 'block', fontSize: 11, color: T.text400, fontWeight: 600, marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}
