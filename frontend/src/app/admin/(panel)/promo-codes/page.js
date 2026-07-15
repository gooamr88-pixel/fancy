'use client';

import { useEffect, useState } from 'react';
import { T, card } from '../../_components/theme';
import DataTable from '../../_components/DataTable';
import FilterBar from '../../_components/FilterBar';
import StatCard from '../../_components/StatCard';
import Modal, { Button, StatusBadge } from '../../_components/Modal';
import { Field } from '../../_components/Field';
import { useAdminList } from '../../_hooks/useAdminList';
import { usePermissions } from '../../_hooks/usePermissions';
import { useAlert } from '../../_components/AlertContext';
import adminApi from '../../_lib/adminApi';

/**
 * Super-admin Promo Codes console (Revenue group). A promo code lets an
 * organizer publish their event immediately — free, no Stripe/manual
 * payment, no waiting for admin review — by entering it in their dashboard.
 * See backend/services/promoCodeService.js for the redemption side.
 */

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
  fontSize: 13, background: T.surface, color: T.text900, outline: 'none',
  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
};

const STATUS_META = {
  active: { badge: 'active', label: 'Active' },
  exhausted: { badge: 'past_due', label: 'Exhausted' },
  expired: { badge: 'canceled', label: 'Expired' },
  inactive: { badge: 'suspended', label: 'Inactive' },
};

const ICONS = {
  ticket: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h13a2 2 0 0 1 2 2v2.2a1.8 1.8 0 0 0 0 3.6v2.2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-2.2a1.8 1.8 0 0 0 0-3.6V8.5Z" /><path d="M14 6.5v11" strokeDasharray="1.6 2" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  gift: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C9 2 12 7 12 7z" /></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  copy: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PromoCodesPage() {
  const { can } = usePermissions();
  const manage = can('marketing.manage');
  const { showConfirm, showToast } = useAlert();

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { rows, pagination, loading, reload } = useAdminList(
    '/promo-codes',
    { page, limit: 25, q, status: statusFilter },
    (r) => r?.promoCodes || r?.data || []
  );

  const [stats, setStats] = useState(null);
  const [statsNonce, setStatsNonce] = useState(0);
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await adminApi.get('/promo-codes/stats');
        if (!ignore) setStats(res?.stats || null);
      } catch { /* stat cards just show a dash */ }
    })();
    return () => { ignore = true; };
  }, [statsNonce]);
  const refreshAll = () => { reload(); setStatsNonce((n) => n + 1); };

  const [tiers, setTiers] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.get('/pricing');
        setTiers(res?.config?.pricing_tiers || []);
      } catch { /* tier dropdown just stays empty — form still usable if the admin types a name */ }
    })();
  }, []);

  const [editing, setEditing] = useState(null); // null = closed, {} = create, {...row} = edit
  const [redemptionsFor, setRedemptionsFor] = useState(null); // promo code row, or null

  const openCreate = () => setEditing({});
  const openEdit = (row) => setEditing(row);
  const closeModal = () => setEditing(null);

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast('Code copied to clipboard.', 'success');
    } catch {
      showToast('Could not copy — select and copy it manually.', 'error');
    }
  };

  const toggleActive = async (row) => {
    try {
      await adminApi.patch(`/promo-codes/${row.id}`, { isActive: !row.is_active });
      showToast(row.is_active ? 'Code deactivated.' : 'Code reactivated.', 'success');
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Could not update the code.', 'error');
    }
  };

  const deleteCode = async (row) => {
    const confirmed = await showConfirm(
      `Delete promo code "${row.code}"? This can't be undone.`,
      'Delete Promo Code',
      'danger'
    );
    if (!confirmed) return;
    try {
      await adminApi.del(`/promo-codes/${row.id}`);
      showToast('Promo code deleted.', 'success');
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Could not delete the code.', 'error');
    }
  };

  const columns = [
    {
      key: 'code', header: 'Code',
      render: (r) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.06em', fontSize: 12.5,
              color: T.primaryDark, background: T.primarySoft, border: '1px solid rgba(184, 148, 79, 0.25)',
              padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap',
            }}
          >
            {r.code}
          </span>
          <button
            type="button"
            onClick={() => copyCode(r.code)}
            aria-label={`Copy code ${r.code}`}
            title="Copy code"
            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: T.text400, display: 'flex', transition: 'color 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.primary; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.text400; }}
          >
            {ICONS.copy}
          </button>
        </div>
      ),
    },
    {
      key: 'description', header: 'Description',
      render: (r) => <span style={{ color: T.text500 }}>{r.description || '—'}</span>,
    },
    {
      key: 'tier_name', header: 'Grants Tier',
      render: (r) => (
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text700, background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
          {r.tier_name}
        </span>
      ),
    },
    {
      key: 'redemption_count', header: 'Redemptions',
      render: (r) => {
        const pct = r.max_redemptions ? Math.min(100, Math.round((r.redemption_count / r.max_redemptions) * 100)) : null;
        return (
          <button type="button" onClick={() => setRedemptionsFor(r)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: T.primary }}>
              {r.redemption_count} <span style={{ color: T.text400, fontWeight: 600 }}>/ {r.max_redemptions ?? '∞'}</span>
            </div>
            {pct !== null && (
              <div style={{ width: 64, height: 4, background: T.surfaceAlt, borderRadius: 2, marginTop: 5, overflow: 'hidden', border: `1px solid ${T.border}` }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? T.danger : T.primary, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            )}
          </button>
        );
      },
    },
    { key: 'expires_at', header: 'Expires', render: (r) => formatDate(r.expires_at) },
    {
      key: 'computedStatus', header: 'Status',
      render: (r) => {
        const meta = STATUS_META[r.computedStatus] || { badge: 'suspended', label: r.computedStatus };
        return <StatusBadge status={meta.badge} label={meta.label} />;
      },
    },
    { key: 'created_at', header: 'Created', render: (r) => formatDate(r.created_at) },
    ...(manage ? [{
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
          <Button variant={r.is_active ? 'warning' : 'default'} onClick={() => toggleActive(r)}>{r.is_active ? 'Deactivate' : 'Activate'}</Button>
          {r.redemption_count === 0 && <Button variant="danger" onClick={() => deleteCode(r)}>Delete</Button>}
        </div>
      ),
    }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span
            style={{
              width: 40, height: 40, borderRadius: 12, background: T.primarySoft, border: '1px solid rgba(184, 148, 79, 0.25)',
              color: T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
            }}
          >
            {ICONS.ticket}
          </span>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>Promo Codes</h1>
            <p style={{ fontSize: 13.5, color: T.text500, margin: '6px 0 0', maxWidth: 620, lineHeight: 1.6 }}>
              Codes an organizer can redeem from their dashboard to publish their event immediately — free, with no payment and no manual review. Each code grants a specific pricing tier and can have a redemption cap and/or an expiry date.
            </p>
          </div>
        </div>
        {manage && <Button variant="primary" onClick={openCreate}>+ Create Code</Button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatCard label="Total Codes" value={stats ? stats.totalCodes : '—'} icon={ICONS.ticket} />
        <StatCard label="Active Codes" value={stats ? stats.activeCodes : '—'} accent={T.success} icon={ICONS.check} />
        <StatCard label="Total Redemptions" value={stats ? stats.totalRedemptions : '—'} accent={T.primary} icon={ICONS.gift} />
        <StatCard label="Expiring Soon" value={stats ? stats.expiringSoon : '—'} sub="within 7 days" accent={T.warning} icon={ICONS.clock} />
      </div>

      <FilterBar onSearch={(val) => { setPage(1); setQ(val); }} placeholder="Search by code or description…">
        <select
          value={statusFilter}
          aria-label="Filter status"
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          style={{
            minHeight: 44, padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
            fontSize: 13, background: T.surface, color: T.text700, cursor: 'pointer',
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="exhausted">Exhausted</option>
          <option value="expired">Expired</option>
          <option value="inactive">Inactive</option>
        </select>
      </FilterBar>

      <DataTable
        title="All Promo Codes"
        columns={columns}
        rows={rows}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        onRefresh={refreshAll}
        emptyText="No promo codes yet — create one to let an organizer skip payment and review."
        rowKey={(r) => r.id}
      />

      {editing !== null && (
        <PromoCodeFormModal
          initial={editing}
          tiers={tiers}
          onClose={closeModal}
          onSaved={() => { closeModal(); refreshAll(); }}
        />
      )}

      {redemptionsFor && (
        <RedemptionsModal promoCode={redemptionsFor} onClose={() => setRedemptionsFor(null)} />
      )}
    </div>
  );
}

function PromoCodeFormModal({ initial, tiers, onClose, onSaved }) {
  const isNew = !initial.id;
  const { showToast } = useAlert();
  const [code, setCode] = useState(initial.code || '');
  const [description, setDescription] = useState(initial.description || '');
  const [tierName, setTierName] = useState(initial.tier_name || tiers[0]?.name || '');
  const [maxRedemptions, setMaxRedemptions] = useState(initial.max_redemptions != null ? String(initial.max_redemptions) : '');
  const [expiresAt, setExpiresAt] = useState(initial.expires_at ? initial.expires_at.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!tierName) { setError('Choose which tier this code grants.'); return; }
    setSaving(true);
    setError('');
    try {
      const body = {
        description,
        tierName,
        maxRedemptions: maxRedemptions === '' ? null : maxRedemptions,
        expiresAt: expiresAt || null,
      };
      if (isNew) {
        body.code = code.trim() || undefined; // blank → server auto-generates
        await adminApi.post('/promo-codes', body);
        showToast('Promo code created.', 'success');
      } else {
        await adminApi.patch(`/promo-codes/${initial.id}`, body);
        showToast('Promo code updated.', 'success');
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Could not save this promo code.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={isNew ? 'Create Promo Code' : `Edit ${initial.code}`}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create Code' : 'Save Changes'}</Button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isNew && (
          <Field label="Code (optional)">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Leave blank to auto-generate"
              style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.06em', fontWeight: 700 }}
            />
          </Field>
        )}

        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Q3 wedding expo giveaway" style={inputStyle} />
        </Field>

        <Field label="Grants Tier">
          <select value={tierName} onChange={(e) => setTierName(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="" disabled>Select a tier</option>
            {tiers.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            {tierName && !tiers.some((t) => t.name === tierName) && <option value={tierName}>{tierName}</option>}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Max Redemptions">
            <input
              type="number" min="1" value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Unlimited"
              style={inputStyle}
            />
          </Field>
          <Field label="Expires On">
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: T.radiusSm, background: T.dangerSoft, color: T.dangerDark, fontSize: 13, borderLeft: `3px solid ${T.danger}` }}>
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

function RedemptionsModal({ promoCode, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await adminApi.get(`/promo-codes/${promoCode.id}/redemptions`);
        if (!ignore) setRows(res?.redemptions || res?.data || []);
      } catch { /* modal just shows the empty state */ }
      finally { if (!ignore) setLoading(false); }
    })();
    return () => { ignore = true; };
  }, [promoCode.id]);

  return (
    <Modal open title={`Redemptions — ${promoCode.code}`} onClose={onClose} width={640}>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '24px 0', color: T.text400, fontSize: 13 }}>
          <div style={{ width: 14, height: 14, border: `2px solid ${T.border}`, borderTop: `2px solid ${T.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <p style={{ color: T.text500, fontSize: 13 }}>No one has redeemed this code yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ padding: '12px 14px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: T.primarySoft, color: T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 13 }}>
                {(r.eventTitle || r.orgName || '?').charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 700, color: T.text900, fontSize: 13 }}>{r.eventTitle || 'Untitled event'}</div>
                <div style={{ fontSize: 12, color: T.text500 }}>{r.orgName || r.orgEmail || 'Unknown organizer'}</div>
              </div>
              <div style={{ fontSize: 12, color: T.text400, textAlign: 'right' }}>{formatDate(r.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
