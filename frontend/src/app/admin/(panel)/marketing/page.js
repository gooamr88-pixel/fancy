'use client';

import { useCallback, useEffect, useState } from 'react';
import adminApi from '../../_lib/adminApi';
import usePermissions from '../../_hooks/usePermissions';
import DataTable from '../../_components/DataTable';
import { PageLoading } from '../../_components/Spinner';
import Modal, { Button } from '../../_components/Modal';
import { T, card } from '../../_components/theme';
import { useAlert } from '../../_components/AlertContext';
import { Field, Row } from '../../_components/Field';

/**
 * Marketing — Referral Program oversight. Permissions marketing.view /
 * marketing.manage already anticipated this scope (seeded description:
 * "Manage coupons / campaigns / referrals").
 */

const inputStyle = {
  width: '100%', padding: '9px 11px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
  fontSize: 13, background: T.surfaceAlt, color: T.text900, outline: 'none',
  fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
};

const fmtCents = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;

function StatCard({ label, value }) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: T.text400, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)' }}>{value}</p>
    </div>
  );
}

const STATUS_BADGE = {
  converted: { bg: T.successSoft, color: T.successDark, border: 'rgba(16,185,129,0.2)', label: 'Converted' },
  pending: { bg: T.surfaceAlt, color: T.text400, border: T.border, label: 'Pending' },
};

const INQUIRY_STATUS_BADGE = {
  new: { bg: T.warningSoft, color: T.warningDark, border: 'rgba(245,158,11,0.2)', label: 'New' },
  responded: { bg: T.successSoft, color: T.successDark, border: 'rgba(16,185,129,0.2)', label: 'Responded' },
  closed: { bg: T.surfaceAlt, color: T.text400, border: T.border, label: 'Closed' },
};

const SEGMENT_LABEL = {
  general: 'General',
  planners: 'Planners',
  venues: 'Venues',
  corporate: 'Corporate',
};

export default function MarketingPage() {
  const { showAlert } = useAlert();
  const { can } = usePermissions();
  const manage = can('marketing.manage');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const [configForm, setConfigForm] = useState({ enabled: true, rewardCents: '2500' });
  const [savingConfig, setSavingConfig] = useState(false);

  const [adjustForm, setAdjustForm] = useState({ orgId: '', amount: '', direction: 'grant', note: '' });
  const [adjusting, setAdjusting] = useState(false);

  const [inquiries, setInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [inquiriesError, setInquiriesError] = useState(null);
  const [inquiriesNonce, setInquiriesNonce] = useState(0);
  const reloadInquiries = useCallback(() => setInquiriesNonce((n) => n + 1), []);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setInquiriesLoading(true);
      try {
        const res = await adminApi.get('/inquiries');
        if (!ignore) {
          setInquiries(res.inquiries || []);
          setInquiriesError(null);
        }
      } catch (err) {
        if (!ignore) setInquiriesError(err.message || 'Failed to load contact inquiries');
      } finally {
        if (!ignore) setInquiriesLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [inquiriesNonce]);

  const openReply = (inquiry) => {
    setReplyingTo(inquiry);
    setReplyText('');
  };

  const submitReply = async () => {
    if (!replyText.trim()) {
      showAlert('Please write a response before sending.', 'Validation Error', 'warning');
      return;
    }
    setSendingReply(true);
    try {
      await adminApi.post(`/inquiries/${replyingTo.id}/respond`, { message: replyText.trim() });
      setReplyingTo(null);
      setReplyText('');
      reloadInquiries();
    } catch (err) {
      showAlert(err.message || 'Failed to send response.', 'Error', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const closeInquiry = async (id) => {
    try {
      await adminApi.patch(`/inquiries/${id}/status`, { status: 'closed' });
      reloadInquiries();
    } catch (err) {
      showAlert(err.message || 'Failed to update status.', 'Error', 'error');
    }
  };

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await adminApi.get('/referrals');
        if (!ignore) {
          setData(res);
          if (res.config) {
            setConfigForm({ enabled: res.config.referralProgramEnabled, rewardCents: String(res.config.referralRewardCents) });
          }
          setError(null);
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load referral data');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [nonce]);

  const saveConfig = async () => {
    const cents = parseInt(configForm.rewardCents, 10);
    if (!Number.isInteger(cents) || cents < 0) {
      showAlert('Reward amount must be a non-negative whole number of cents.', 'Validation Error', 'warning');
      return;
    }
    setSavingConfig(true);
    try {
      await adminApi.patch('/referrals/config', { referralProgramEnabled: configForm.enabled, referralRewardCents: cents });
      reload();
    } catch (err) {
      showAlert(err.message || 'Save failed', 'Error', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const submitAdjust = async () => {
    const cents = Math.round(parseFloat(adjustForm.amount) * 100);
    if (!adjustForm.orgId.trim()) { showAlert('Organization ID is required.', 'Validation Error', 'warning'); return; }
    if (!Number.isInteger(cents) || cents <= 0) { showAlert('Amount must be a positive dollar value.', 'Validation Error', 'warning'); return; }
    setAdjusting(true);
    try {
      await adminApi.post('/referrals/adjust', {
        orgId: adjustForm.orgId.trim(),
        amountCents: cents,
        direction: adjustForm.direction,
        note: adjustForm.note.trim() || undefined,
      });
      setAdjustForm({ orgId: '', amount: '', direction: 'grant', note: '' });
      reload();
    } catch (err) {
      showAlert(err.message || 'Adjustment failed', 'Error', 'error');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>Marketing</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Referral program oversight and public-facing contact inquiries.</p>
      </header>

      <h2 style={{ fontSize: 17, fontWeight: 800, color: T.text900, margin: '0 0 4px', fontFamily: 'var(--font-serif)' }}>Referral Program</h2>
      <p style={{ fontSize: 12, color: T.text400, margin: '0 0 14px' }}>Organizers earn platform credit when someone they refer becomes a paying customer.</p>

      {error && <p style={{ color: T.danger }}>{error}</p>}
      {loading ? (
        <PageLoading label="Loading referral program…" />
      ) : (
        <>
          {/* Config */}
          <section style={{ ...card, padding: 18, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text900, margin: '0 0 14px' }}>Program Settings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="mkt-grid">
              <Field label="Program status">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: manage ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={!!configForm.enabled}
                    disabled={!manage}
                    onChange={(e) => setConfigForm((f) => ({ ...f, enabled: e.target.checked }))}
                  />
                  <span style={{ fontSize: 13, color: T.text700 }}>{configForm.enabled ? 'Enabled — new rewards are being granted' : 'Paused — no new rewards will be granted'}</span>
                </label>
              </Field>
              <Field label="Reward per conversion (USD)">
                <input
                  type="number" min="0" step="0.01" disabled={!manage}
                  value={(parseInt(configForm.rewardCents, 10) || 0) / 100}
                  onChange={(e) => setConfigForm((f) => ({ ...f, rewardCents: String(Math.round((parseFloat(e.target.value) || 0) * 100)) }))}
                  style={inputStyle}
                />
              </Field>
            </div>
            {manage && (
              <div style={{ marginTop: 14 }}>
                <Button variant="primary" disabled={savingConfig} onClick={saveConfig}>{savingConfig ? 'Saving…' : 'Save Settings'}</Button>
              </div>
            )}
          </section>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
            <StatCard label="Outstanding Balance" value={fmtCents(data?.totals?.balanceCents)} />
            <StatCard label="Total Earned" value={fmtCents(data?.totals?.earnedCents)} />
            <StatCard label="Total Redeemed" value={fmtCents(data?.totals?.redeemedCents)} />
            <StatCard label="Referrals / Converted" value={`${data?.referrals?.length || 0} / ${(data?.referrals || []).filter((r) => r.status === 'converted').length}`} />
          </div>

          {/* Manual adjustment */}
          {manage && (
            <section style={{ ...card, padding: 18, marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text900, margin: '0 0 4px' }}>Manual Credit Adjustment</h2>
              <p style={{ fontSize: 12, color: T.text400, margin: '0 0 14px' }}>Goodwill grants or support-case corrections. Find the organization ID on the Organizers page.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }} className="mkt-adjust-grid">
                <Field label="Organization ID">
                  <input value={adjustForm.orgId} onChange={(e) => setAdjustForm((f) => ({ ...f, orgId: e.target.value }))} style={inputStyle} placeholder="uuid" />
                </Field>
                <Field label="Amount (USD)">
                  <input type="number" min="0" step="0.01" value={adjustForm.amount} onChange={(e) => setAdjustForm((f) => ({ ...f, amount: e.target.value }))} style={inputStyle} placeholder="10.00" />
                </Field>
                <Field label="Direction">
                  <select value={adjustForm.direction} onChange={(e) => setAdjustForm((f) => ({ ...f, direction: e.target.value }))} style={inputStyle}>
                    <option value="grant">Grant</option>
                    <option value="deduct">Deduct</option>
                  </select>
                </Field>
              </div>
              <div style={{ marginTop: 12 }}>
                <Field label="Note (optional)">
                  <input value={adjustForm.note} onChange={(e) => setAdjustForm((f) => ({ ...f, note: e.target.value }))} style={inputStyle} placeholder="Reason for this adjustment" />
                </Field>
              </div>
              <div style={{ marginTop: 14 }}>
                <Button variant="primary" disabled={adjusting} onClick={submitAdjust}>{adjusting ? 'Submitting…' : 'Apply Adjustment'}</Button>
              </div>
            </section>
          )}

          {/* Referrals */}
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text900, margin: '0 0 12px' }}>Referrals</h2>
            <DataTable
              rows={data?.referrals || []}
              loading={false}
              onRefresh={reload}
              emptyText="No referrals yet."
              rowKey={(r) => r.referredOrgId}
              columns={[
                { key: 'referrer', header: 'Referrer', render: (r) => r.referrerOrgName || '—' },
                { key: 'referred', header: 'Referred', render: (r) => (
                  <div>
                    <div style={{ fontWeight: 700, color: T.text900 }}>{r.referredOrgName}</div>
                    <div style={{ fontSize: 11, color: T.text400 }}>{r.referredOrgEmail}</div>
                  </div>
                ) },
                { key: 'joinedAt', header: 'Joined', render: (r) => r.joinedAt ? new Date(r.joinedAt).toLocaleDateString() : '—' },
                { key: 'status', header: 'Status', render: (r) => {
                  const s = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
                  return (
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                      {s.label}
                    </span>
                  );
                } },
              ]}
            />
          </section>

          {/* Ledger */}
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text900, margin: '0 0 12px' }}>Credit Ledger</h2>
            <DataTable
              rows={data?.ledger || []}
              loading={false}
              onRefresh={reload}
              emptyText="No credit activity yet."
              rowKey={(r) => r.id}
              columns={[
                { key: 'createdAt', header: 'Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleString() : '—' },
                { key: 'orgName', header: 'Organization', render: (r) => r.orgName || '—' },
                { key: 'type', header: 'Type', render: (r) => r.type },
                { key: 'referredOrgName', header: 'Referred', render: (r) => r.referredOrgName || '—' },
                { key: 'amountCents', header: 'Amount', render: (r) => (
                  <span style={{ fontWeight: 700, color: r.amountCents >= 0 ? T.successDark : T.danger }}>
                    {r.amountCents >= 0 ? '+' : '−'}{fmtCents(Math.abs(r.amountCents))}
                  </span>
                ) },
                { key: 'note', header: 'Note', render: (r) => <span style={{ fontSize: 12, color: T.text400 }}>{r.note || '—'}</span> },
              ]}
            />
          </section>
        </>
      )}

      {/* Contact Inquiries — public Contact page + /solutions/* B2B lead forms */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text900, margin: '0 0 4px' }}>Contact Inquiries</h2>
        <p style={{ fontSize: 12, color: T.text400, margin: '0 0 12px' }}>Every submission from the public Contact page and the Planners / Venues / Corporate inquiry forms. Replying emails the sender directly.</p>
        {inquiriesError && <p style={{ color: T.danger, fontSize: 13 }}>{inquiriesError}</p>}
        <DataTable
          rows={inquiries}
          loading={inquiriesLoading}
          onRefresh={reloadInquiries}
          emptyText="No inquiries yet."
          rowKey={(r) => r.id}
          columns={[
            { key: 'createdAt', header: 'Received', render: (r) => r.created_at ? new Date(r.created_at).toLocaleString() : '—' },
            { key: 'from', header: 'From', render: (r) => (
              <div>
                <div style={{ fontWeight: 700, color: T.text900 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: T.text400 }}>{r.email}</div>
              </div>
            ) },
            { key: 'segment', header: 'Segment', render: (r) => SEGMENT_LABEL[r.segment] || r.segment },
            { key: 'company', header: 'Company', render: (r) => r.company || '—' },
            { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
            { key: 'expectedGuests', header: 'Expected Guests', render: (r) => r.expected_guests || '—' },
            { key: 'message', header: 'Message', render: (r) => (
              <span style={{ display: 'inline-block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.message}>
                {r.message}
              </span>
            ) },
            { key: 'status', header: 'Status', render: (r) => {
              const s = INQUIRY_STATUS_BADGE[r.status] || INQUIRY_STATUS_BADGE.new;
              return (
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                  {s.label}
                </span>
              );
            } },
            { key: 'actions', header: '', render: (r) => (
              manage ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={() => openReply(r)}>{r.status === 'new' ? 'Reply' : 'View / Reply'}</Button>
                  {r.status !== 'closed' && <Button variant="ghost" onClick={() => closeInquiry(r.id)}>Close</Button>}
                </div>
              ) : null
            ) },
          ]}
        />
      </section>

      {/* Reply modal */}
      <Modal
        open={!!replyingTo}
        title={replyingTo ? `Reply to ${replyingTo.name}` : ''}
        onClose={() => setReplyingTo(null)}
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplyingTo(null)}>Cancel</Button>
            <Button variant="primary" disabled={sendingReply} onClick={submitReply}>{sendingReply ? 'Sending…' : 'Send Response'}</Button>
          </>
        }
      >
        {replyingTo && (
          <div>
            <Row label="Email">{replyingTo.email}</Row>
            <Row label="Segment">{SEGMENT_LABEL[replyingTo.segment] || replyingTo.segment}</Row>
            {replyingTo.company && <Row label="Company">{replyingTo.company}</Row>}
            {replyingTo.phone && <Row label="Phone">{replyingTo.phone}</Row>}
            {replyingTo.expected_guests && <Row label="Expected Guests">{replyingTo.expected_guests}</Row>}
            <Row label="Subject">{replyingTo.subject}</Row>
            <div style={{ margin: '12px 0', padding: 12, background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, color: T.text700, whiteSpace: 'pre-wrap' }}>
              {replyingTo.message}
            </div>
            {replyingTo.admin_response && (
              <div style={{ margin: '0 0 12px', padding: 12, background: T.successSoft, border: `1px solid rgba(16,185,129,0.2)`, borderRadius: T.radiusSm, fontSize: 12, color: T.text700 }}>
                <strong style={{ color: T.successDark }}>Already replied</strong> {replyingTo.responded_at ? `on ${new Date(replyingTo.responded_at).toLocaleString()}` : ''}:
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{replyingTo.admin_response}</div>
              </div>
            )}
            <Field label="Your response">
              <textarea
                rows={5}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply — it will be emailed directly to the sender."
                style={{ ...inputStyle, resize: 'vertical', minHeight: 100, lineHeight: 1.6 }}
              />
            </Field>
          </div>
        )}
      </Modal>

      <style jsx>{`
        @media (max-width: 640px) {
          .mkt-grid { grid-template-columns: 1fr !important; }
          .mkt-adjust-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
