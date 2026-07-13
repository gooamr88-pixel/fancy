'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import adminApi from '../../_lib/adminApi';
import useAdminList from '../../_hooks/useAdminList';
import usePermissions from '../../_hooks/usePermissions';
import DataTable from '../../_components/DataTable';
import { PageLoading } from '../../_components/Spinner';
import Modal, { Button } from '../../_components/Modal';
import { T, card } from '../../_components/theme';
import { useAlert } from '../../_components/AlertContext';
import Icon from '../../../components/icons/Icon';
import { money as fmt } from '../../_lib/format';
import { Field } from '../../_components/Field';

/**
 * Credit Management (Master Plan §10). Two surfaces:
 *  1. Credit package catalog (sms / email / qr) — full CRUD + enable/disable.
 *  2. Live SMS wallet overview with complimentary credit grants per event.
 */
const TYPE_LABEL = { sms: 'SMS', email: 'Email', qr: 'QR' };
const EMPTY_PKG = { type: 'sms', name: '', credits: '', bonusCredits: '0', price: '', currency: 'usd', sortOrder: '0', isActive: true };

export default function CreditsPage() {
  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>Credit Management</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Sell credit bundles and grant complimentary credits.</p>
      </header>
      <PackageCatalog />
      <div style={{ height: 28 }} />
      <SmsWallets />
    </div>
  );
}

function PackageCatalog() {
  const { showAlert, showConfirm } = useAlert();
  const { can } = usePermissions();
  const manage = can('credits.manage');
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const [editing, setEditing] = useState(null); // package row or 'new'
  const [form, setForm] = useState(EMPTY_PKG);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await adminApi.get('/credits/packages');
        if (!ignore) { setPackages(res?.packages || []); setError(null); }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load packages');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [nonce]);

  const openNew = () => { setForm(EMPTY_PKG); setEditing('new'); };
  const openEdit = (p) => {
    setForm({
      type: p.type, name: p.name, credits: String(p.credits), bonusCredits: String(p.bonus_credits || 0),
      price: ((p.price_cents || 0) / 100).toFixed(2), currency: p.currency || 'usd',
      sortOrder: String(p.sort_order || 0), isActive: p.is_active,
    });
    setEditing(p);
  };

  const save = async () => {
    const payload = {
      type: form.type,
      name: form.name.trim(),
      credits: parseInt(form.credits, 10),
      bonusCredits: parseInt(form.bonusCredits, 10) || 0,
      priceCents: Math.round(parseFloat(form.price) * 100) || 0,
      currency: form.currency || 'usd',
      sortOrder: parseInt(form.sortOrder, 10) || 0,
      isActive: form.isActive,
    };
    if (!payload.name || !payload.credits || payload.credits <= 0) {
      showAlert('Name and a positive credits value are required.', 'Validation Error', 'warning');
      return;
    }
    setBusy(true);
    try {
      if (editing === 'new') await adminApi.post('/credits/packages', payload);
      else await adminApi.patch(`/credits/packages/${editing.id}`, payload);
      setEditing(null);
      reload();
    } catch (err) {
      showAlert(err.message || 'Save failed', 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p) => {
    try { await adminApi.patch(`/credits/packages/${p.id}`, { isActive: !p.is_active }); reload(); }
    catch (err) { showAlert(err.message || 'Update failed', 'Error', 'error'); }
  };

  const remove = async (p) => {
    if (!await showConfirm(`Delete package "${p.name}"?`, 'Delete Package', 'danger')) return;
    try { await adminApi.del(`/credits/packages/${p.id}`); reload(); }
    catch (err) { showAlert(err.message || 'Delete failed', 'Error', 'error'); }
  };

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text900, margin: 0 }}>Credit packages</h2>
        {manage && <Button variant="primary" onClick={openNew}>+ New package</Button>}
      </div>

      {/* These packages are a display/catalog concept only — the actual price an
          organizer is charged for SMS credits is always computed live from the
          Rate + Markup settings (with a volume discount at 500+), never from a
          package's price_cents here. Editing/creating a package below has NO
          effect on what's actually charged. */}
      <div style={{ ...card, padding: '10px 14px', marginBottom: 14, background: T.primarySoft, fontSize: 12, color: T.text700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="warning" size={13} strokeWidth={1.7} /> These packages do not drive real pricing — organizers are charged from the SMS Rate + Markup settings, computed live per purchase.</span>
        <Link href="/admin/config" style={{ color: T.primary, fontWeight: 700, textDecoration: 'none' }}>Go to Pricing Settings →</Link>
      </div>

      {error && <p style={{ color: T.danger }}>{error}</p>}
      {loading ? (
        <PageLoading label="Loading packages…" />
      ) : packages.length === 0 ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: T.text400, fontSize: 13 }}>No packages yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {packages.map((p) => (
            <div key={p.id} style={{ ...card, padding: 18, opacity: p.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.primary, background: T.primarySoft, padding: '3px 8px', borderRadius: 6 }}>
                  {TYPE_LABEL[p.type] || p.type}
                </span>
                {!p.is_active && <span style={{ fontSize: 10, color: T.text400, fontWeight: 700 }}>DISABLED</span>}
              </div>
              <div style={{ fontWeight: 700, color: T.text900, marginTop: 10 }}>{p.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text900, marginTop: 6 }}>{fmt(p.price_cents)}</div>
              <div style={{ fontSize: 12, color: T.text500, marginTop: 4 }}>
                {p.credits.toLocaleString()} credits{p.bonus_credits > 0 ? ` + ${p.bonus_credits} bonus` : ''}
              </div>
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
        title={editing === 'new' ? 'New credit package' : 'Edit package'}
        onClose={() => setEditing(null)}
        width={520}
        footer={<>
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>
        </>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle} disabled={editing !== 'new'}>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="qr">QR</option>
            </select>
          </Field>
          <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} /></Field>
          <Field label="Credits"><input type="number" min="1" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} style={inputStyle} /></Field>
          <Field label="Bonus credits"><input type="number" min="0" value={form.bonusCredits} onChange={(e) => setForm({ ...form, bonusCredits: e.target.value })} style={inputStyle} /></Field>
          <Field label="Price (USD)"><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={inputStyle} /></Field>
          <Field label="Sort order"><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} style={inputStyle} /></Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: T.text700, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Active (available for purchase)
        </label>
      </Modal>
    </section>
  );
}

function SmsWallets() {
  const { showAlert } = useAlert();
  const { can } = usePermissions();
  const manage = can('credits.manage');
  const [page, setPage] = useState(1);
  const { rows, pagination, loading, error, reload } = useAdminList(
    '/sms-wallets',
    { page, limit: 25 },
    (res) => res?.data || res?.wallets || []
  );

  const [grant, setGrant] = useState(null); // wallet row
  const [credits, setCredits] = useState('');
  const [busy, setBusy] = useState(false);

  const doGrant = async () => {
    const n = parseInt(credits, 10);
    if (!n || n <= 0) { showAlert('Enter a positive number of credits.', 'Validation Error', 'warning'); return; }
    setBusy(true);
    try {
      await adminApi.post(`/events/${grant.event_id}/grant-sms`, { credits: n });
      setGrant(null); setCredits('');
      reload();
    } catch (err) {
      showAlert(err.message || 'Grant failed', 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text900, margin: '0 0 12px' }}>SMS wallets</h2>
      {error && <p style={{ color: T.danger }}>{error}</p>}
      <DataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.event_id}
        pagination={pagination}
        onPageChange={setPage}
        onRefresh={reload}
        emptyText="No SMS wallets yet."
        columns={[
          {
            key: 'event', header: 'Event / Organizer', render: (r) => (
              <div>
                <div style={{ fontWeight: 600, color: T.text900 }}>{r.events?.title || '—'}</div>
                <div style={{ fontSize: 11, color: T.text400 }}>{r.events?.organizations?.name || '—'}</div>
              </div>
            ),
          },
          { key: 'credits_purchased', header: 'Purchased', align: 'right' },
          { key: 'credits_used', header: 'Used', align: 'right' },
          { key: 'credits_remaining', header: 'Remaining', align: 'right', render: (r) => <span style={{ fontWeight: 700, color: r.credits_remaining > 0 ? T.success : T.text500 }}>{r.credits_remaining}</span> },
          ...(manage ? [{ key: 'actions', header: '', align: 'right', render: (r) => <Button variant="ghost" onClick={() => { setGrant(r); setCredits(''); }}>Grant</Button> }] : []),
        ]}
      />

      <Modal
        open={!!grant}
        title="Grant complimentary SMS credits"
        onClose={() => setGrant(null)}
        width={420}
        footer={<>
          <Button variant="ghost" onClick={() => setGrant(null)}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={doGrant}>{busy ? 'Granting…' : 'Grant credits'}</Button>
        </>}
      >
        {grant && (
          <div>
            <p style={{ fontSize: 13, color: T.text500, margin: '0 0 12px' }}>{grant.events?.title || 'Event'}</p>
            <Field label="Credits to grant (1–50000)">
              <input type="number" min="1" max="50000" value={credits} onChange={(e) => setCredits(e.target.value)} style={inputStyle} autoFocus />
            </Field>
          </div>
        )}
      </Modal>
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

