'use client';

import { useEffect, useState } from 'react';
import adminApi from '../../_lib/adminApi';
import useAdminList from '../../_hooks/useAdminList';
import DataTable from '../../_components/DataTable';
import FilterBar from '../../_components/FilterBar';
import Modal, { Button, StatusBadge } from '../../_components/Modal';
import { T } from '../../_components/theme';
import { useAlert } from '../../_components/AlertContext';

const money = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EventsPage() {
  const { showAlert, showConfirm } = useAlert();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Modals state
  const [approval, setApproval] = useState(null); // { event, amountCents }
  const [grantModal, setGrantModal] = useState(null); // { eventId, title }
  const [grantAmount, setGrantAmount] = useState(100);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Grant Free Event modal — requires a tier (sets the guest cap) + a reason
  // (so the comp shows up in the audit log instead of looking like a silent
  // unlimited-guest plan). See backend/controllers/adminController.js updateEventAdmin.
  const [freeEventModal, setFreeEventModal] = useState(null); // { eventId, title }
  const [pricingTiers, setPricingTiers] = useState([]);
  const [selectedTierName, setSelectedTierName] = useState('');
  const [compReason, setCompReason] = useState('');
  const [submittingFreeGrant, setSubmittingFreeGrant] = useState(false);

  const { rows, pagination, loading, reload } = useAdminList(
    '/events',
    { page, limit: 25, q, status: statusFilter },
    (res) => res?.data || res?.events || []
  );

  useEffect(() => {
    adminApi.get('/pricing').then((res) => {
      setPricingTiers(res?.config?.pricing_tiers || []);
    }).catch(() => { /* tier dropdown just stays empty — modal shows a message */ });
  }, []);

  const handleStatusChange = async (eventId, status) => {
    setBusyId(eventId);
    try {
      await adminApi.patch(`/events/${eventId}`, { status });
      await showAlert(`Event status updated to ${status}.`, 'Success', 'success');
      reload();
    } catch (err) {
      await showAlert(err.message || 'Failed to change status', 'Error', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openFreeEventModal = (eventId, title) => {
    setSelectedTierName(pricingTiers[0]?.name || '');
    setCompReason('');
    setFreeEventModal({ eventId, title });
  };

  const handleGrantFreeEvent = async (e) => {
    e.preventDefault();
    if (!freeEventModal || !selectedTierName || !compReason.trim()) return;
    setSubmittingFreeGrant(true);
    try {
      await adminApi.patch(`/events/${freeEventModal.eventId}`, {
        isPaid: true,
        tierName: selectedTierName,
        compReason: compReason.trim(),
      });
      await showAlert('Event activated as complimentary.', 'Success', 'success');
      setFreeEventModal(null);
      reload();
    } catch (err) {
      await showAlert(err.message || 'Failed to grant free event', 'Error', 'error');
    } finally {
      setSubmittingFreeGrant(false);
    }
  };

  const handleUnpay = async (eventId) => {
    if (!await showConfirm('Revoke paid access? This clears any granted tier and locks paid features until paid/granted again.', 'Revoke Access', 'danger')) return;
    setBusyId(eventId);
    try {
      await adminApi.patch(`/events/${eventId}`, { isPaid: false });
      await showAlert('Marked as unpaid.', 'Success', 'success');
      reload();
    } catch (err) {
      await showAlert(err.message || 'Failed to update paid status', 'Error', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteEvent = async (eventId, title) => {
    if (!await showConfirm(`Permanently delete "${title}" and ALL its RSVPs, seating, payments and check-ins? This cannot be undone.`, 'Delete Event', 'danger')) return;
    setBusyId(eventId);
    try {
      await adminApi.del(`/events/${eventId}`);
      await showAlert('Event deleted successfully.', 'Success', 'success');
      reload();
    } catch (err) {
      await showAlert(err.message || 'Failed to delete event', 'Error', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveCash = async (e) => {
    e.preventDefault();
    if (!approval) return;
    setSubmittingApproval(true);
    try {
      await adminApi.post('/manual-approve', {
        eventId: approval.event.id,
        amountCents: parseInt(approval.amountCents, 10)
      });
      await showAlert('Manual payment approved & event activated.', 'Success', 'success');
      setApproval(null);
      reload();
    } catch (err) {
      await showAlert(err.message || 'Approval failed', 'Error', 'error');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleGrantSms = async (e) => {
    e.preventDefault();
    if (!grantModal) return;
    setBusyId(grantModal.eventId);
    try {
      await adminApi.post(`/events/${grantModal.eventId}/grant-sms`, {
        credits: parseInt(grantAmount, 10)
      });
      await showAlert(`Granted ${grantAmount} SMS credits.`, 'Success', 'success');
      setGrantModal(null);
      reload();
    } catch (err) {
      await showAlert(err.message || 'Failed to grant credits', 'Error', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>Event Registry</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Monitor, approve, configure license tiers, or delete events on the platform.</p>
      </header>

      <FilterBar onSearch={(val) => { setPage(1); setQ(val); }} placeholder="Search events / slugs…">
        <select
          value={statusFilter}
          aria-label="Filter status"
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          style={{
            padding: '9px 12px',
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            fontSize: 13,
            background: T.surface,
            color: T.text700,
            cursor: 'pointer',
          }}
        >
          <option value="">All statuses</option>
          {['draft', 'pending_review', 'active', 'paused', 'completed'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </FilterBar>

      <DataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.id}
        pagination={pagination}
        onPageChange={setPage}
        columns={[
          {
            key: 'title', header: 'Event', render: (r) => (
              <div>
                <span style={{ fontWeight: 700, color: T.text900, display: 'block' }}>{r.title}</span>
                <code style={{ background: T.surfaceAlt, padding: '2px 6px', borderRadius: '4px', color: T.primary, fontSize: '10.5px', border: `1px solid ${T.border}` }}>{r.slug}</code>
              </div>
            )
          },
          {
            key: 'organizer', header: 'Organizer', render: (r) => (
              <div>
                <span style={{ color: T.text700, display: 'block' }}>{r.organizations?.name || 'Unnamed'}</span>
                <span style={{ fontSize: 11, color: T.text500 }}>{r.organizations?.email || '—'}</span>
              </div>
            )
          },
          { key: 'event_date', header: 'Date', render: (r) => new Date(r.event_date).toLocaleDateString() },
          {
            key: 'status', header: 'Status', render: (r) => {
              const busy = busyId === r.id;
              return (
                <select value={r.status || 'draft'} disabled={busy} onChange={e => handleStatusChange(r.id, e.target.value)}
                  style={{ padding: '6px 8px', fontSize: '12px', cursor: 'pointer', background: T.surface, color: T.text700, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
                  {['draft', 'pending_review', 'active', 'paused', 'completed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              );
            }
          },
          {
            key: 'license', header: 'License', render: (r) => {
              const pending = r.event_payments?.find(p => p.payment_method === 'cash_manual' && p.status === 'pending');
              if (r.is_paid && r.manual_override) {
                return (
                  <div title={r.comp_reason || ''}>
                    <StatusBadge status="active" label={`Complimentary · ${r.tier_name || 'No tier'}`} />
                  </div>
                );
              }
              return r.is_paid
                ? <StatusBadge status="active" label={r.tier_name || 'Paid'} />
                : pending
                  ? <StatusBadge status="pending" label={`Cash ${money(pending.amount_cents)}`} />
                  : <StatusBadge status="failed" label="Unpaid" />;
            }
          },
          {
            key: 'actions', header: '', align: 'right', render: (r) => {
              const busy = busyId === r.id;
              const pending = r.event_payments?.find(p => p.payment_method === 'cash_manual' && p.status === 'pending');
              return (
                <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {r.status === 'pending_review' && (
                    <Button variant="primary" disabled={busy} onClick={() => handleStatusChange(r.id, 'active')}>Approve &amp; Go Live</Button>
                  )}
                  {!r.is_paid && (
                    <Button variant="primary" disabled={busy} onClick={() => setApproval({ event: r, amountCents: pending ? pending.amount_cents : 7900 })}>Approve Cash</Button>
                  )}
                  {r.is_paid
                    ? <Button variant="ghost" disabled={busy} onClick={() => handleUnpay(r.id)}>Revoke</Button>
                    : <Button variant="ghost" disabled={busy} onClick={() => openFreeEventModal(r.id, r.title)}>Grant Free</Button>}
                  <Button variant="ghost" disabled={busy} onClick={() => setGrantModal({ eventId: r.id, title: r.title })}>+ SMS</Button>
                  <a href={`/${r.slug}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <Button variant="default">View</Button>
                  </a>
                  <Button variant="danger" disabled={busy} onClick={() => handleDeleteEvent(r.id, r.title)}>Delete</Button>
                </div>
              );
            }
          },
        ]}
      />

      {/* Approve Modal */}
      <Modal open={!!approval} title="Confirm Payment Received" onClose={() => setApproval(null)}>
        <p style={{ fontSize: '12.5px', color: T.text500, lineHeight: 1.6, marginBottom: '20px' }}>Verify the transfer landed in your account, then confirm. This marks the payment as received and activates the event immediately.</p>
        {approval && (
          <form onSubmit={handleApproveCash} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: T.text400, fontWeight: 700, textTransform: 'uppercase' }}>Event</span>
              <div style={{ fontSize: '14px', fontWeight: 700, color: T.text900 }}>{approval.event?.title}</div>
            </div>
            
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 11, color: T.text400, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Approved Amount (cents)</span>
              <input type="number" required value={approval.amountCents} onChange={e => setApproval(a => ({ ...a, amountCents: e.target.value }))}
                style={{ width: '100%', padding: '9px 11px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, background: T.surfaceAlt, color: T.text900, outline: 'none' }} />
              <span style={{ fontSize: '11px', color: T.text400, marginTop: 4, display: 'block' }}>e.g. 7900 = $79.00</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 12 }}>
              <Button variant="ghost" onClick={() => setApproval(null)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={submittingApproval}>{submittingApproval ? 'Processing…' : 'Approve & Activate'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Grant Free Event Modal */}
      <Modal open={!!freeEventModal} title="Grant Complimentary Event" onClose={() => setFreeEventModal(null)}>
        <p style={{ fontSize: '12.5px', color: T.text500, lineHeight: 1.6, marginBottom: '20px' }}>
          Activate <b style={{ color: T.text900 }}>{freeEventModal?.title}</b> for free. Pick the tier to grant so the guest cap and features match a real plan, and record why — this is logged to the audit trail and shown to the organizer.
        </p>
        <form onSubmit={handleGrantFreeEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 11, color: T.text400, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Tier to Grant</span>
            {pricingTiers.length > 0 ? (
              <select required value={selectedTierName} onChange={e => setSelectedTierName(e.target.value)}
                style={{ width: '100%', padding: '9px 11px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, background: T.surfaceAlt, color: T.text900, outline: 'none', cursor: 'pointer' }}>
                {pricingTiers.map(t => (
                  <option key={t.name} value={t.name}>{t.name} — {t.max_guests || '∞'} guests</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '12px', color: T.text500 }}>No pricing tiers configured yet — set them up under Configuration first.</span>
            )}
          </label>

          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 11, color: T.text400, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Reason (required)</span>
            <textarea required rows={3} value={compReason} onChange={e => setCompReason(e.target.value)}
              placeholder="e.g. sponsor partnership, support gesture, internal test event"
              style={{ width: '100%', padding: '9px 11px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, background: T.surfaceAlt, color: T.text900, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 12 }}>
            <Button variant="ghost" onClick={() => setFreeEventModal(null)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submittingFreeGrant || pricingTiers.length === 0}>
              {submittingFreeGrant ? 'Activating…' : 'Activate as Complimentary'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Grant SMS Modal */}
      <Modal open={!!grantModal} title="Grant Complimentary SMS Credits" onClose={() => setGrantModal(null)}>
        <p style={{ fontSize: '12.5px', color: T.text500, lineHeight: 1.6, marginBottom: '20px' }}>Add complimentary SMS credits to <b style={{ color: T.text900 }}>{grantModal?.title}</b>. Use for support gestures or compensation.</p>
        <form onSubmit={handleGrantSms} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 11, color: T.text400, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Credits to Grant</span>
            <input type="number" min="1" max="50000" required value={grantAmount} onChange={e => setGrantAmount(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, background: T.surfaceAlt, color: T.text900, outline: 'none' }} />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 12 }}>
            <Button variant="ghost" onClick={() => setGrantModal(null)}>Cancel</Button>
            <Button type="submit" variant="primary">Grant Credits</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
