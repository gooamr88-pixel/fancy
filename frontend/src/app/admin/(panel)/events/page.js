'use client';

import { useState } from 'react';
import adminApi from '../../_lib/adminApi';
import useAdminList from '../../_hooks/useAdminList';
import DataTable from '../../_components/DataTable';
import FilterBar from '../../_components/FilterBar';
import Modal, { Button, StatusBadge } from '../../_components/Modal';
import { T } from '../../_components/theme';

const money = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EventsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  
  // Modals state
  const [approval, setApproval] = useState(null); // { event, amountCents }
  const [grantModal, setGrantModal] = useState(null); // { eventId, title }
  const [grantAmount, setGrantAmount] = useState(100);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const { rows, pagination, loading, reload } = useAdminList(
    '/events',
    { page, limit: 25, q, status: statusFilter },
    (res) => res?.data || res?.events || []
  );

  const handleStatusChange = async (eventId, status) => {
    setBusyId(eventId);
    try {
      await adminApi.patch(`/events/${eventId}`, { status });
      alert(`Event status updated to ${status}.`);
      reload();
    } catch (err) {
      alert(err.message || 'Failed to change status');
    } finally {
      setBusyId(null);
    }
  };

  const handleTogglePaid = async (eventId, isPaid) => {
    setBusyId(eventId);
    try {
      await adminApi.patch(`/events/${eventId}`, { isPaid });
      alert(isPaid ? 'Marked as Paid.' : 'Marked as Unpaid.');
      reload();
    } catch (err) {
      alert(err.message || 'Failed to update paid status');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteEvent = async (eventId, title) => {
    if (!window.confirm(`Permanently delete "${title}" and ALL its RSVPs, seating, payments and check-ins? This cannot be undone.`)) return;
    setBusyId(eventId);
    try {
      await adminApi.del(`/events/${eventId}`);
      alert('Event deleted successfully.');
      reload();
    } catch (err) {
      alert(err.message || 'Failed to delete event');
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
      alert('Manual payment approved & event activated.');
      setApproval(null);
      reload();
    } catch (err) {
      alert(err.message || 'Approval failed');
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
      alert(`Granted ${grantAmount} SMS credits.`);
      setGrantModal(null);
      reload();
    } catch (err) {
      alert(err.message || 'Failed to grant credits');
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
              return r.is_paid
                ? <StatusBadge status="active" />
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
                    ? <Button variant="ghost" disabled={busy} onClick={() => handleTogglePaid(r.id, false)}>Unpay</Button>
                    : <Button variant="ghost" disabled={busy} onClick={() => handleTogglePaid(r.id, true)}>Mark Paid</Button>}
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
