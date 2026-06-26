'use client';

import { useState } from 'react';
import adminApi from '../../_lib/adminApi';
import useAdminList from '../../_hooks/useAdminList';
import DataTable from '../../_components/DataTable';
import FilterBar from '../../_components/FilterBar';
import Modal, { Button, StatusBadge } from '../../_components/Modal';
import { T } from '../../_components/theme';
import { useAlert } from '../../_components/AlertContext';

const money = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OrganizersPage() {
  const { showAlert, showConfirm, showToast } = useAlert();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgDetails, setOrgDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [impersonating, setImpersonating] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const { rows, pagination, loading, reload } = useAdminList(
    '/organizations',
    { page, limit: 25, q },
    (res) => res?.data || res?.organizations || []
  );

  const openDetail = async (org) => {
    setSelectedOrg(org);
    setLoadingDetails(true);
    setTempPassword('');
    try {
      const res = await adminApi.get(`/organizers/${org.ownerUserId}`);
      setOrgDetails(res?.user || res || null);
    } catch (err) {
      await showAlert(err.message || 'Failed to load details', 'Error', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetail = () => {
    setSelectedOrg(null);
    setOrgDetails(null);
    setTempPassword('');
  };

  const handleImpersonate = async (ownerUserId) => {
    setImpersonating(true);
    try {
      const res = await adminApi.post(`/organizers/${ownerUserId}/impersonate`);
      await showAlert(res?.message || 'Impersonation session established. Redirecting…', 'Success', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err) {
      await showAlert(err.message || 'Impersonation failed', 'Error', 'error');
    } finally {
      setImpersonating(false);
    }
  };

  const handleResetPassword = async (ownerUserId) => {
    if (!await showConfirm('Reset this organizer password to a temporary password? This will revoke all active sessions.', 'Reset Password', 'warning')) return;
    try {
      const res = await adminApi.post(`/organizers/${ownerUserId}/reset-password`);
      setTempPassword(res?.tempPassword || '');
      await showAlert('Temporary password set successfully.', 'Success', 'success');
    } catch (err) {
      await showAlert(err.message || 'Failed to reset password', 'Error', 'error');
    }
  };

  const handleToggleSuspend = async (ownerUserId, currentStatus) => {
    const nextStatus = currentStatus === 'banned' ? 'active' : 'banned';
    if (!await showConfirm(`Are you sure you want to set this organizer status to ${nextStatus.toUpperCase()}?`, 'Update Status', 'warning')) return;
    setChangingStatus(true);
    try {
      await adminApi.patch(`/organizers/${ownerUserId}/status`, { status: nextStatus });
      setOrgDetails(prev => prev ? { ...prev, status: nextStatus } : null);
      await showAlert(`Account status updated to ${nextStatus}.`, 'Success', 'success');
      reload();
    } catch (err) {
      await showAlert(err.message || 'Failed to update status', 'Error', 'error');
    } finally {
      setChangingStatus(false);
    }
  };

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>Organizers</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Manage organizer organizations, credentials, status and impersonation.</p>
      </header>

      <FilterBar onSearch={(val) => { setPage(1); setQ(val); }} placeholder="Search organizations…" />

      <DataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.id}
        pagination={pagination}
        onPageChange={setPage}
        columns={[
          { key: 'name', header: 'Organization', render: (r) => <b>{r.name || 'Unnamed'}</b> },
          { key: 'email', header: 'Contact', render: (r) => (
              <div>
                <span style={{ display: 'block', color: T.text700 }}>{r.email || '—'}</span>
                <span style={{ fontSize: 11, color: T.text400 }}>{r.phone || ''}</span>
              </div>
            )
          },
          { key: 'eventCount', header: 'Events', render: (r) => `${r.eventCount} (${r.paidEventCount} paid)` },
          { key: 'activeEventCount', header: 'Active Events' },
          { key: 'lifetimeRevenueCents', header: 'Lifetime Revenue', render: (r) => <span style={{ color: T.success, fontWeight: 700 }}>{money(r.lifetimeRevenueCents)}</span> },
          { key: 'billing', header: 'Billing', render: (r) => r.hasStripeCustomer ? <StatusBadge status="completed" label="Stripe" /> : <StatusBadge status="draft" label="None" /> },
          { key: 'createdAt', header: 'Joined', render: (r) => new Date(r.createdAt).toLocaleDateString() },
          { key: 'actions', header: '', align: 'right', render: (r) => <Button variant="ghost" onClick={() => openDetail(r)}>Manage</Button> },
        ]}
      />

      <Modal open={!!selectedOrg} title="Manage Organizer Account" onClose={closeDetail} width={520}>
        {loadingDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
            <div style={{ width: '24px', height: '24px', border: `2px solid ${T.border}`, borderTop: `2px solid ${T.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
            <span style={{ fontSize: '13px', color: T.text500 }}>Loading account details…</span>
            <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          selectedOrg && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${T.border}`, paddingBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: T.text900 }}>{selectedOrg.name || 'Unnamed Organization'}</div>
                  <div style={{ fontSize: '12px', color: T.text500, marginTop: '2px' }}>{orgDetails?.email || selectedOrg.email || '—'}</div>
                </div>
                <StatusBadge status={orgDetails?.status || 'active'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', color: T.text700 }}>
                <div>
                  <span style={{ display: 'block', color: T.text400, fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Joined Date</span>
                  <span style={{ fontWeight: 600 }}>{new Date(selectedOrg.createdAt).toLocaleDateString()}</span>
                </div>
                <div>
                  <span style={{ display: 'block', color: T.text400, fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Lifetime Revenue</span>
                  <span style={{ fontWeight: 600, color: T.success }}>{money(selectedOrg.lifetimeRevenueCents)}</span>
                </div>
              </div>

              {tempPassword && (
                <div style={{ background: T.warningSoft, border: `1px dashed ${T.warning}`, borderRadius: '12px', padding: '14px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: T.warning, fontWeight: 700 }}>Temporary Password Generated</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <code style={{ fontSize: '14px', fontWeight: 700, color: T.text900, background: T.surfaceAlt, padding: '4px 8px', borderRadius: '4px', border: `1px solid ${T.border}` }}>{tempPassword}</code>
                    <button type="button" style={{ background: 'transparent', border: `1px solid ${T.border}`, padding: '4px 8px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', color: T.text700 }} onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      showToast('Copied to clipboard!');
                    }}>Copy</button>
                  </div>
                  <p style={{ fontSize: '11px', color: T.text500, marginTop: '8px', marginBottom: 0 }}>Provide this password securely to the organizer. They will be prompted to change it upon login.</p>
                </div>
              )}

              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button
                  variant="primary"
                  disabled={impersonating}
                  onClick={() => handleImpersonate(selectedOrg.ownerUserId)}
                >
                  {impersonating ? 'Redirection session active…' : '👤 Impersonate Organizer'}
                </Button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button
                    variant="default"
                    onClick={() => handleResetPassword(selectedOrg.ownerUserId)}
                  >
                    🔑 Reset Password
                  </Button>

                  <Button
                    variant={orgDetails?.status === 'banned' ? 'primary' : 'danger'}
                    disabled={changingStatus}
                    onClick={() => handleToggleSuspend(selectedOrg.ownerUserId, orgDetails?.status)}
                  >
                    {changingStatus ? 'Updating…' : orgDetails?.status === 'banned' ? '🔓 Reactivate Account' : '🚫 Suspend Account'}
                  </Button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Button variant="ghost" onClick={closeDetail}>Close</Button>
              </div>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
