'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../utils/apiClient';
import LogoutModal from '../components/LogoutModal';
import { motion, AnimatePresence } from 'framer-motion';

const D = {
  bg: 'var(--admin-bg, #FAFAF8)', bg2: 'var(--admin-surface, #FFFFFF)', card: 'var(--admin-surface, #FFFFFF)', cardBorder: 'var(--admin-border, #E8E2D6)', borderLight: 'var(--admin-border-strong, #D7BE80)',
  text100: 'var(--admin-text-900, #191B1E)', text200: 'var(--admin-text-700, #4A4D53)', text300: 'var(--admin-text-500, #77736A)', text400: 'var(--admin-text-400, #A19E95)', text500: 'var(--admin-text-500, #BDBAB2)',
  amber: 'var(--admin-primary, #B8944F)', amberHover: 'var(--admin-primary-hover, #D7BE80)', amberDark: 'var(--admin-primary-dark, #8A6D34)',
  rose: 'var(--admin-danger, #EF4444)', roseLight: 'var(--admin-danger-light, #f43f5e)',
  emerald: 'var(--admin-success, #10B981)', emeraldDark: 'var(--admin-success-dark, #059669)',
  sky: 'var(--admin-sky, #0EA5E9)', violet: 'var(--admin-violet, #8B5CF6)',
  white: 'var(--admin-white, #FFFFFF)',
};

const ICONS = {
  overview: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  finance: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  health: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  events: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  pending: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  payments: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  organizations: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="16"/><path d="M9 16h6v6"/></svg>,
  sms: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  roles: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  config: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  activity: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
};

const NAV = [
  { key: 'overview', label: 'Dashboard', icon: ICONS.overview },
  { key: 'finance', label: 'Finance', icon: ICONS.finance },
  { key: 'health', label: 'Health', icon: ICONS.health },
  { key: 'events', label: 'Events', icon: ICONS.events },
  { key: 'pending', label: 'Review', icon: ICONS.pending },
  { key: 'payments', label: 'Ledger', icon: ICONS.payments },
  { key: 'organizations', label: 'Tenants', icon: ICONS.organizations },
  { key: 'sms', label: 'Messaging', icon: ICONS.sms },
  { key: 'roles', label: 'Access', icon: ICONS.roles },
  { key: 'config', label: 'System', icon: ICONS.config },
  { key: 'activity', label: 'Logs', icon: ICONS.activity },
];

const cardStyle = { background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: '16px', boxShadow: '0 4px 20px rgba(25, 27, 30, 0.02)', transition: 'all 0.2s' };
const inputStyle = { width: '100%', background: D.bg, border: `1px solid ${D.borderLight}`, borderRadius: '6px', padding: '10px', fontSize: '13px', color: D.text100, outline: 'none' };

const money = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateStr = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const dateTime = (d) => d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_COLORS = {
  active: { bg: 'rgba(16, 185, 129, 0.08)', fg: '#10B981', br: 'rgba(16, 185, 129, 0.2)' },
  pending_review: { bg: 'rgba(245, 158, 11, 0.08)', fg: '#D97706', br: 'rgba(245, 158, 11, 0.2)' },
  draft: { bg: '#FDFCF9', fg: '#77736A', br: '#E8E2D6' },
  paused: { bg: 'rgba(245, 158, 11, 0.08)', fg: '#D97706', br: 'rgba(245, 158, 11, 0.2)' },
  completed: { bg: 'rgba(16, 185, 129, 0.08)', fg: '#10B981', br: 'rgba(16, 185, 129, 0.2)' },
  pending: { bg: 'rgba(245, 158, 11, 0.08)', fg: '#D97706', br: 'rgba(245, 158, 11, 0.2)' },
  failed: { bg: 'rgba(239, 68, 68, 0.08)', fg: '#EF4444', br: 'rgba(239, 68, 68, 0.2)' },
  refunded: { bg: '#FDFCF9', fg: '#77736A', br: '#E8E2D6' },
  banned: { bg: 'rgba(239, 68, 68, 0.08)', fg: '#EF4444', br: 'rgba(239, 68, 68, 0.2)' },
};

function Badge({ status, label }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <span style={{ background: c.bg, color: c.fg, border: `1px solid ${c.br}`, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
      {label || status}
    </span>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ ...cardStyle, padding: '20px' }}>
      <span style={{ fontSize: '10px', color: D.text300, textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
      <div style={{ fontSize: '24px', fontWeight: 700, color: D.text100, marginTop: '8px' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: D.text400, marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function Th({ children, align }) {
  return <th style={{ padding: '12px 16px', fontSize: '10px', color: D.text300, textTransform: 'uppercase', textAlign: align || 'left', borderBottom: `1px solid ${D.cardBorder}` }}>{children}</th>;
}
function Td({ children, align, color }) {
  return <td style={{ padding: '12px 16px', color: color || D.text200, fontSize: '13px', textAlign: align || 'left' }}>{children}</td>;
}

function TableShell({ title, subtitle, head, children, action }) {
  return (
    <div style={cardStyle}>
      <div style={{ padding: '20px', borderBottom: `1px solid ${D.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: D.text100 }}>{title}</div>
          {subtitle && <div style={{ fontSize: '12px', color: D.text300 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const btn = (variant = 'primary') => {
  const base = { padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', border: 'none', transition: 'all 0.2s' };
  if (variant === 'primary') return { ...base, background: D.amber, color: '#FFFFFF' };
  if (variant === 'ghost') return { ...base, background: 'transparent', color: D.text200, border: `1px solid ${D.cardBorder}` };
  if (variant === 'danger') return { ...base, background: 'rgba(239, 68, 68, 0.08)', color: D.rose, border: `1px solid rgba(239, 68, 68, 0.15)` };
  return base;
};

export default function AdminPage() {
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminVerified, setAdminVerified] = useState(false);
  const [bootError, setBootError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Per-section data + loading state
  const [overview, setOverview] = useState(null);
  const [events, setEvents] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [smsWallets, setSmsWallets] = useState([]);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [loadedTabs, setLoadedTabs] = useState({});
  const [tabLoading, setTabLoading] = useState(false);

  // Pricing form state
  const [smsRate, setSmsRate] = useState(8);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [smsMarkupPercentage, setSmsMarkupPercentage] = useState(40.0);
  const [platformCommissionPct, setPlatformCommissionPct] = useState(0.0);
  const [manualMethods, setManualMethods] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);

  // Modals
  const [approval, setApproval] = useState(null); // { event, amountCents }
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [grantModal, setGrantModal] = useState(null); // { eventId, title }
  const [grantAmount, setGrantAmount] = useState(100);
  const [busyId, setBusyId] = useState(null);

  // Health telemetry & Financial command center data states
  const [healthData, setHealthData] = useState(null);
  const [financeData, setFinanceData] = useState(null);

  // Tenant Management Modal states
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgDetails, setOrgDetails] = useState(null);
  const [loadingOrgDetails, setLoadingOrgDetails] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [impersonating, setImpersonating] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  // Filters
  const [eventSearch, setEventSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [orgSearch, setOrgSearch] = useState('');

  const showToast = (msg, kind = 'success') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 3200); };

  const api = useCallback(async (path, options = {}) => {
    const res = await fetch(`${apiUrl}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
    let data = null;
    try { data = await res.json(); } catch { /* non-json */ }
    if (!res.ok || (data && data.success === false)) {
      throw new Error((data && data.message) || `Request failed (${res.status}).`);
    }
    return data;
  }, [apiUrl]);

  // Auth gate
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const orgId = localStorage.getItem('org_id');
    const userRole = localStorage.getItem('user_role');
    if (!orgId) { router.push('/login'); return; }
    if (userRole !== 'super_admin') { router.push('/dashboard'); return; }
    fetch(`${apiUrl}/admin/overview`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('user_role');
          router.push('/dashboard');
          return;
        }
        try {
          const data = await res.json();
          if (data.success) { setOverview(data.overview); setLoadedTabs(p => ({ ...p, overview: true })); setAdminVerified(true); }
        } catch { /* ignore */ }
        setAuthChecked(true);
      })
      .catch(() => { setBootError('Could not reach the administration API. Verify the backend is running on port 5000.'); setAuthChecked(true); });
  }, [router, apiUrl]);

  // Per-tab lazy loader
  const loadTab = useCallback(async (tab) => {
    setTabLoading(true);
    try {
      if (tab === 'overview') {
        const d = await api('/admin/overview'); setOverview(d.overview);
      } else if (tab === 'events') {
        const d = await api('/admin/events'); setEvents(d.events || []);
      } else if (tab === 'pending') {
        const d = await api('/admin/pending-payments'); setPendingPayments(d.payments || []);
      } else if (tab === 'payments') {
        const d = await api('/admin/payments'); setPayments(d.payments || []);
      } else if (tab === 'organizations') {
        const d = await api('/admin/organizations'); setOrganizations(d.organizations || []);
      } else if (tab === 'sms') {
        const d = await api('/admin/sms-wallets'); setSmsWallets(d.wallets || []);
      } else if (tab === 'roles') {
        const d = await api('/admin/users'); setUsers(d.users || []);
      } else if (tab === 'activity') {
        const d = await api('/admin/activity'); setActivity(d.logs || []);
      } else if (tab === 'health') {
        const d = await api('/admin/health'); setHealthData(d.health || null);
      } else if (tab === 'finance') {
        const d = await api('/admin/finance/summary'); setFinanceData(d.finance || null);
      } else if (tab === 'config') {
        const d = await api('/admin/pricing');
        if (d.config) {
          setPricingConfig(d.config);
          setSmsRate(d.config.sms_rate_cents_per_credit ?? 8);
          setPricingTiers(d.config.pricing_tiers || []);
          setSmsMarkupPercentage(d.config.sms_markup_percentage ?? 40.0);
          setPlatformCommissionPct(d.config.platform_commission_pct ?? 0.0);
          setManualMethods(d.config.manual_payment_methods || []);
        }
      }
      setLoadedTabs(p => ({ ...p, [tab]: true }));
    } catch (err) {
      showToast(err.message, 'error');
    } finally { setTabLoading(false); }
  }, [api]);

  // Navigation is event-driven: load a tab's data the first time it's opened.
  const goTab = useCallback((tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    if (!loadedTabs[tab]) loadTab(tab);
  }, [loadedTabs, loadTab]);

  const refreshTab = (tab) => { setLoadedTabs(p => ({ ...p, [tab]: false })); loadTab(tab); };

  // Health auto-refresh effect (15 seconds)
  useEffect(() => {
    if (activeTab !== 'health') return;
    const interval = setInterval(() => {
      refreshTab('health');
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Tenant Details and Actions Loader
  const loadOrgDetails = useCallback(async (ownerUserId) => {
    setLoadingOrgDetails(true);
    setTempPassword('');
    try {
      const d = await api(`/admin/organizers/${ownerUserId}`);
      setOrgDetails(d.user || d);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingOrgDetails(false);
    }
  }, [api]);

  const handleImpersonate = async (ownerUserId) => {
    setImpersonating(true);
    try {
      const d = await api(`/admin/organizers/${ownerUserId}/impersonate`, { method: 'POST' });
      showToast(d.message || 'Impersonation session established. Redirecting…');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setImpersonating(false);
    }
  };

  const handleResetPassword = async (ownerUserId) => {
    if (!window.confirm('Reset this organizer password to a temporary password? This will revoke all active sessions.')) return;
    try {
      const d = await api(`/admin/organizers/${ownerUserId}/reset-password`, { method: 'POST' });
      setTempPassword(d.tempPassword);
      showToast('Temporary password set successfully.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleSuspend = async (ownerUserId, currentStatus) => {
    const nextStatus = currentStatus === 'banned' ? 'active' : 'banned';
    if (!window.confirm(`Are you sure you want to set this organizer status to ${nextStatus.toUpperCase()}?`)) return;
    setChangingStatus(true);
    try {
      await api(`/admin/organizers/${ownerUserId}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      setOrgDetails(prev => prev ? { ...prev, status: nextStatus } : null);
      setOrganizations(prev => prev.map(org => org.ownerUserId === ownerUserId ? { ...org, status: nextStatus } : org));
      showToast(`Account status updated to ${nextStatus}.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setChangingStatus(false);
    }
  };

  // ── Actions ──
  const handleApprove = async (e) => {
    e.preventDefault();
    if (!approval) return;
    setSubmittingApproval(true);
    try {
      await api('/admin/manual-approve', { method: 'POST', body: JSON.stringify({ eventId: approval.event.id, amountCents: parseInt(approval.amountCents, 10) }) });
      setApproval(null);
      showToast('Payment approved & event activated.');
      refreshTab('events'); refreshTab('pending'); refreshTab('overview');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSubmittingApproval(false); }
  };

  const handleStatusChange = async (eventId, status) => {
    setBusyId(eventId);
    try {
      await api(`/admin/events/${eventId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, status } : ev));
      showToast(`Event status → ${status}.`);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusyId(null); }
  };

  const handleTogglePaid = async (eventId, isPaid) => {
    setBusyId(eventId);
    try {
      await api(`/admin/events/${eventId}`, { method: 'PATCH', body: JSON.stringify({ isPaid }) });
      setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, is_paid: isPaid } : ev));
      showToast(isPaid ? 'Event marked as paid.' : 'Event marked as unpaid.');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusyId(null); }
  };

  const handleDeleteEvent = async (eventId, title) => {
    if (!window.confirm(`Permanently delete "${title}" and ALL its RSVPs, seating, payments and check-ins? This cannot be undone.`)) return;
    setBusyId(eventId);
    try {
      await api(`/admin/events/${eventId}`, { method: 'DELETE' });
      setEvents(prev => prev.filter(ev => ev.id !== eventId));
      showToast('Event deleted.');
      refreshTab('overview');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusyId(null); }
  };

  const handleRefund = async (paymentId) => {
    if (!window.confirm('Mark this payment as refunded? (Book-keeping only — does not call Stripe.)')) return;
    setBusyId(paymentId);
    try {
      await api(`/admin/payments/${paymentId}/refund`, { method: 'POST' });
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'refunded' } : p));
      showToast('Payment marked as refunded.');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusyId(null); }
  };

  const handleGrantSms = async (e) => {
    e.preventDefault();
    if (!grantModal) return;
    setBusyId(grantModal.eventId);
    try {
      await api(`/admin/events/${grantModal.eventId}/grant-sms`, { method: 'POST', body: JSON.stringify({ credits: parseInt(grantAmount, 10) }) });
      setGrantModal(null);
      showToast(`Granted ${grantAmount} SMS credits.`);
      refreshTab('sms');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusyId(null); }
  };

  const handleSetRole = async (userId, role) => {
    setBusyId(userId);
    try {
      await api('/admin/users/role', { method: 'PATCH', body: JSON.stringify({ userId, role }) });
      setUsers(prev => prev.map(u => (u.userId === userId ? { ...u, role } : u)));
      showToast('Role updated.');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusyId(null); }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api('/admin/pricing', { method: 'PATCH', body: JSON.stringify({
        pricingTiers,
        smsRateCentsPerCredit: parseInt(smsRate, 10),
        smsMarkupPercentage: parseFloat(smsMarkupPercentage),
        platformCommissionPct: parseFloat(platformCommissionPct),
        manualPaymentMethods: manualMethods,
      }) });
      showToast('Pricing configuration saved.');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSavingConfig(false); }
  };

  // Numeric fields are coerced to int; booleans pass through; everything else
  // (name, price_label, cta_label) is kept as a string.
  const NUMERIC_TIER_FIELDS = ['price_cents', 'max_guests'];
  const handleTierChange = (index, field, value) => {
    setPricingTiers(prev => prev.map((t, i) => {
      if (i !== index) return t;
      const coerced = NUMERIC_TIER_FIELDS.includes(field) ? (parseInt(value, 10) || 0) : value;
      return { ...t, [field]: coerced };
    }));
  };
  // Features are edited as one bullet per line in a textarea.
  const handleTierFeatures = (index, text) => {
    const features = text.split('\n').map(s => s.trim()).filter(Boolean);
    setPricingTiers(prev => prev.map((t, i) => i === index ? { ...t, features } : t));
  };
  const addTier = () => setPricingTiers(prev => [...prev, {
    name: 'New Tier', price_cents: 0, max_guests: 0,
    features: [], recommended: false, is_custom: false, price_label: '', cta_label: '', description: '',
  }]);
  const removeTier = (index) => setPricingTiers(prev => prev.filter((_, i) => i !== index));

  // Manual payment method editor
  const addMethod = () => setManualMethods(prev => [...prev, { id: `m_${Date.now()}`, label: '', type: 'bank', details: '', instructions: '', is_active: true }]);
  const updateMethod = (index, field, value) => setManualMethods(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  const removeMethod = (index) => setManualMethods(prev => prev.filter((_, i) => i !== index));

  const handleDecline = async (paymentId) => {
    const reason = window.prompt('Reason for declining (the money did not arrive)? This will be logged.', 'Payment not received');
    if (reason === null) return;
    setBusyId(paymentId);
    try {
      await api(`/admin/payments/${paymentId}/decline`, { method: 'POST', body: JSON.stringify({ reason }) });
      showToast('Payment declined — marked as not received.');
      refreshTab('pending'); refreshTab('events');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusyId(null); }
  };

  // ── Loading / boot states ──
  if (!authChecked || !adminVerified) {
    return (
      <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: `3px solid ${D.cardBorder}`, borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: D.text400, fontFamily: 'var(--font-sans)', fontSize: '14px' }}>Opening administrator console…</p>
        </div>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (bootError) {
    return (
      <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', ...cardStyle, padding: '48px 32px' }}>
          <span style={{ fontSize: '48px' }}>🔑</span>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginTop: '16px', color: D.rose, fontFamily: 'var(--font-sans)' }}>Connection Error</h2>
          <p style={{ color: D.text400, marginTop: '8px', fontSize: '13px', lineHeight: 1.7 }}>{bootError}</p>
          <button onClick={() => window.location.reload()} style={{ ...btn('ghost'), marginTop: '24px', padding: '10px 20px' }}>Retry</button>
        </div>
      </div>
    );
  }

  const activeNav = NAV.find(n => n.key === activeTab);
  const filteredEvents = events.filter(e => {
    const q = eventSearch.toLowerCase();
    return !q || e.title?.toLowerCase().includes(q) || e.slug?.toLowerCase().includes(q) || e.organizations?.name?.toLowerCase().includes(q);
  });
  const filteredOrgs = organizations.filter(o => {
    const q = orgSearch.toLowerCase();
    return !q || o.name?.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: '100vh', background: D.bg, color: D.text100, fontFamily: 'var(--font-sans)', display: 'flex' }}>

      {/* Sidebar */}
      <aside className="admin-sidebar" style={{ width: '256px', background: D.bg2, borderRight: `1px solid ${D.cardBorder}`, padding: '24px 16px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', transform: sidebarOpen ? 'translateX(0)' : undefined, boxShadow: '0 4px 30px rgba(25, 27, 30, 0.03)', zIndex: 40 }}>
        <div style={{ padding: '4px 8px 16px', borderBottom: `1px solid ${D.cardBorder}`, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, color: D.amber, textShadow: '0 0 10px rgba(197, 168, 107, 0.4)' }}>✦</span>
          <div>
            <span style={{ color: D.amber, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '9px', fontWeight: 800 }}>Control Panel</span>
            <h1 style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '2px', color: D.text100, fontFamily: 'var(--font-serif)' }}>Super Admin</h1>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, overflowY: 'auto' }}>
          {NAV.map(n => {
            const active = activeTab === n.key;
            const count = n.key === 'pending' ? pendingPayments.length : null;
            return (
              <button key={n.key} onClick={() => goTab(n.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  fontWeight: active ? 700 : 500,
                  textAlign: 'left',
                  background: active ? 'rgba(197, 168, 107, 0.08)' : 'transparent',
                  color: active ? D.amber : D.text300,
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative'
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                {active && (
                  <span style={{ position: 'absolute', left: -4, top: 8, bottom: 8, width: 3, background: D.amber, borderRadius: 2 }} />
                )}
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '6px',
                  background: active ? 'rgba(184, 148, 79, 0.12)' : 'rgba(0, 0, 0, 0.02)',
                  border: `1px solid ${active ? 'rgba(184, 148, 79, 0.25)' : 'transparent'}`,
                  color: active ? D.amber : D.text400,
                  transition: 'all 0.2s'
                }} className="nav-icon-container">
                  {n.icon}
                </span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {count ? <span style={{ background: D.rose, color: D.white, fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '10px', boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)' }}>{count}</span> : null}
              </button>
            );
          })}
        </nav>
        <div style={{ borderTop: `1px solid ${D.cardBorder}`, paddingTop: '16px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Link href="/dashboard" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 12px',
            fontSize: '12px',
            fontWeight: 700,
            color: D.text300,
            textDecoration: 'none',
            borderRadius: '8px',
            transition: 'all 0.2s',
            background: 'rgba(0, 0, 0, 0.01)',
            border: `1px solid ${D.cardBorder}`
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = D.amber; e.currentTarget.style.color = D.text100; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = D.cardBorder; e.currentTarget.style.color = D.text300; }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Organizer Dashboard
          </Link>
          <button onClick={() => setShowLogoutModal(true)} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            color: D.text400,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            textAlign: 'left',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = D.roseLight}
          onMouseLeave={e => e.currentTarget.style.color = D.text400}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </aside>
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 30, backdropFilter: 'blur(4px)' }} className="admin-overlay" />}

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, padding: '32px clamp(20px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', gap: '12px', borderBottom: `1px solid ${D.cardBorder}`, paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button className="admin-menu-btn" onClick={() => setSidebarOpen(true)} style={{ ...btn('ghost'), display: 'none', padding: '8px 12px', background: D.card }}>☰</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '8px', background: 'rgba(197, 168, 107, 0.1)', color: D.amber, border: '1px solid rgba(197, 168, 107, 0.2)' }}>{activeNav?.icon}</span>
                <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)', margin: 0, color: D.text100 }}>{activeNav?.label}</h2>
              </div>
            </div>
            <button onClick={() => refreshTab(activeTab)} style={{ ...btn('ghost'), display: 'inline-flex', alignItems: 'center', gap: 8, background: D.card }}>
              {tabLoading ? (
                <div style={{ width: '12px', height: '12px', border: `2px solid ${D.cardBorder}`, borderTop: `2px solid ${D.amber}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              )}
              {tabLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <OverviewTab overview={overview} />
          )}

          {/* ── EVENTS ── */}
          {activeTab === 'events' && (
            <TableShell
              title="Event Registry"
              subtitle={`${events.length} events on the platform`}
              action={<input placeholder="Search events / orgs…" value={eventSearch} onChange={e => setEventSearch(e.target.value)} style={{ ...inputStyle, width: '220px' }} />}
              head={<>
                <Th>Event</Th><Th>Organizer</Th><Th>Date</Th><Th>Status</Th><Th>License</Th><Th align="right">Actions</Th>
              </>}>
              {filteredEvents.length ? filteredEvents.map(event => {
                const pending = event.event_payments?.find(p => p.payment_method === 'cash_manual' && p.status === 'pending');
                const busy = busyId === event.id;
                return (
                  <tr key={event.id} style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                    <Td>
                      <span style={{ fontWeight: 700, color: D.text200, display: 'block' }}>{event.title}</span>
                      <code style={{ background: D.bg, padding: '2px 6px', borderRadius: '4px', color: D.amber, fontSize: '10px' }}>{event.slug}</code>
                    </Td>
                    <Td>
                      <span style={{ color: D.text300, display: 'block' }}>{event.organizations?.name || 'Unnamed'}</span>
                      <span style={{ fontSize: '11px', color: D.text500 }}>{event.organizations?.email || '—'}</span>
                    </Td>
                    <Td color={D.text400}>{dateStr(event.event_date)}</Td>
                    <Td>
                      <select value={event.status || 'draft'} disabled={busy} onChange={e => handleStatusChange(event.id, e.target.value)}
                        style={{ ...inputStyle, width: 'auto', padding: '6px 8px', fontSize: '12px', cursor: 'pointer' }}>
                        {['draft', 'pending_review', 'active', 'paused', 'completed'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Td>
                    <Td>
                      {event.is_paid
                        ? <Badge status="active" label="Paid" />
                        : pending
                          ? <Badge status="pending" label={`Cash ${money(pending.amount_cents)}`} />
                          : <Badge status="failed" label="Unpaid" />}
                    </Td>
                    <Td align="right">
                      <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {event.status === 'pending_review' && (
                          <button disabled={busy} style={btn('primary')} onClick={() => handleStatusChange(event.id, 'active')}>Approve &amp; go live</button>
                        )}
                        {!event.is_paid && (
                          <button disabled={busy} style={btn('primary')} onClick={() => setApproval({ event, amountCents: pending ? pending.amount_cents : 7900 })}>Approve Cash</button>
                        )}
                        {event.is_paid
                          ? <button disabled={busy} style={btn('ghost')} onClick={() => handleTogglePaid(event.id, false)}>Unpay</button>
                          : <button disabled={busy} style={btn('ghost')} onClick={() => handleTogglePaid(event.id, true)}>Mark Paid</button>}
                        <button disabled={busy} style={btn('ghost')} onClick={() => setGrantModal({ eventId: event.id, title: event.title })}>+ SMS</button>
                        <a href={`/${event.slug}`} target="_blank" rel="noreferrer" style={{ ...btn('ghost'), textDecoration: 'none', display: 'inline-block' }}>View</a>
                        <button disabled={busy} style={btn('danger')} onClick={() => handleDeleteEvent(event.id, event.title)}>Delete</button>
                      </div>
                    </Td>
                  </tr>
                );
              }) : <tr><td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: D.text500 }}>No events match.</td></tr>}
            </TableShell>
          )}

          {/* ── PENDING PAYMENTS ── */}
          {activeTab === 'pending' && (
            <TableShell title="Pending Cash Payments" subtitle="Verify each offline transfer arrived, then approve to activate — or decline if the money never came."
              head={<><Th>Reference</Th><Th>Event</Th><Th>Organizer</Th><Th>Method &amp; Proof</Th><Th>Amount</Th><Th>Submitted</Th><Th align="right">Verify</Th></>}>
              {pendingPayments.length ? pendingPayments.map(p => {
                const busy = busyId === p.id;
                return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                  <Td><code style={{ color: D.amber, fontWeight: 700 }}>{p.reference_number || p.stripe_checkout_session_id || '—'}</code></Td>
                  <Td color={D.text200}><span style={{ fontWeight: 700 }}>{p.events?.title || 'Unknown'}</span></Td>
                  <Td>
                    <span style={{ display: 'block', color: D.text300 }}>{p.events?.organizations?.name || 'Unknown'}</span>
                    <span style={{ fontSize: '11px', color: D.text500 }}>{p.events?.organizations?.email || '—'}</span>
                  </Td>
                  <Td>
                    {p.manual_method
                      ? <span style={{ display: 'block', color: D.text200, fontWeight: 600 }}>{p.manual_method}</span>
                      : <span style={{ color: D.text500, fontStyle: 'italic' }}>Not specified</span>}
                    {p.payer_reference && <span style={{ fontSize: '11px', color: D.text400 }}>Proof: <code style={{ color: D.sky }}>{p.payer_reference}</code></span>}
                  </Td>
                  <Td color={D.text200}><b>{money(p.amount_cents)}</b></Td>
                  <Td color={D.text400}>{dateStr(p.created_at)}</Td>
                  <Td align="right">
                    <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button disabled={busy} style={{ ...btn('primary'), background: D.emeraldDark }} onClick={() => setApproval({ event: p.events, amountCents: p.amount_cents, method: p.manual_method, proof: p.payer_reference })}>✓ Confirm Received</button>
                      <button disabled={busy} style={btn('danger')} onClick={() => handleDecline(p.id)}>✕ Decline</button>
                    </div>
                  </Td>
                </tr>
              ); }) : <tr><td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: D.text500 }}>No pending cash payments.</td></tr>}
            </TableShell>
          )}

          {/* ── PAYMENTS / REVENUE ── */}
          {activeTab === 'payments' && (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {['all', 'completed', 'pending', 'refunded', 'failed'].map(f => (
                  <button key={f} onClick={() => setPaymentFilter(f)}
                    style={{ ...btn(paymentFilter === f ? 'primary' : 'ghost'), textTransform: 'capitalize' }}>{f}</button>
                ))}
              </div>
              <TableShell title="Payment Ledger" subtitle="All event-fee and cash transactions"
                head={<><Th>Reference</Th><Th>Event</Th><Th>Organizer</Th><Th>Method</Th><Th>Amount</Th><Th>Status</Th><Th>Date</Th><Th align="right"></Th></>}>
                {payments.filter(p => paymentFilter === 'all' || p.status === paymentFilter).length
                  ? payments.filter(p => paymentFilter === 'all' || p.status === paymentFilter).map(p => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                      <Td><code style={{ color: D.amber, fontSize: '11px' }}>{p.reference_number || p.stripe_payment_intent_id?.slice(0, 14) || p.id.slice(0, 8)}</code></Td>
                      <Td color={D.text200}>{p.events?.title || '—'}</Td>
                      <Td color={D.text400}>{p.events?.organizations?.name || '—'}</Td>
                      <Td><Badge status="draft" label={p.payment_method === 'cash_manual' ? 'Cash' : 'Stripe'} /></Td>
                      <Td color={D.text200}><b>{money(p.amount_cents)}</b></Td>
                      <Td><Badge status={p.status} /></Td>
                      <Td color={D.text400}>{dateStr(p.completed_at || p.created_at)}</Td>
                      <Td align="right">{p.status === 'completed' && <button disabled={busyId === p.id} style={btn('danger')} onClick={() => handleRefund(p.id)}>Refund</button>}</Td>
                    </tr>
                  )) : <tr><td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: D.text500 }}>No payments found.</td></tr>}
              </TableShell>
            </>
          )}

          {/* ── SYSTEM HEALTH ── */}
          {activeTab === 'health' && (
            <div>
              <p style={{ fontSize: '13px', color: D.text300, marginBottom: '20px' }}>
                Overall Platform Status: {healthData ? (
                  <strong style={{ color: healthData.overall === 'healthy' ? D.emerald : D.rose, textTransform: 'uppercase', fontWeight: 800 }}>
                    {healthData.overall}
                  </strong>
                ) : 'Checking…'}
              </p>
              {healthData ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                  {(healthData.services || []).map((s) => {
                    const statusColors = {
                      healthy: D.emerald,
                      configured: D.emerald,
                      degraded: D.rose,
                      unconfigured: D.amber,
                    };
                    const color = statusColors[s.status] || D.text300;
                    return (
                      <div key={s.name} style={{ ...cardStyle, padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: D.text100, textTransform: 'capitalize', fontSize: '14px' }}>{s.name}</span>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 8px ${color}` }} />
                        </div>
                        <div style={{ fontSize: '12px', color: color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.status}</div>
                        {s.latencyMs != null && <div style={{ fontSize: '11px', color: D.text400, marginTop: '4px' }}>Latency: {s.latencyMs} ms</div>}
                        {s.error && <div style={{ fontSize: '10px', color: D.rose, marginTop: '4px', lineHeight: 1.4 }}>{s.error}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ ...cardStyle, padding: '48px', textAlign: 'center', color: D.text500 }}>Loading health telemetry…</div>
              )}
            </div>
          )}

          {/* ── FINANCIAL COMMAND CENTER ── */}
          {activeTab === 'finance' && (
            <div>
              {financeData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                    <StatCard label="Gross Revenue" value={money(financeData.totals?.grossCents)} icon="💰" color={D.emerald} />
                    <StatCard label="Net Revenue" value={money(financeData.totals?.netCents)} sub={`${money(financeData.totals?.refundedCents)} refunded`} icon="💵" />
                    <StatCard label="Platform Profit" value={money(financeData.totals?.platformProfitCents)} sub={`${financeData.totals?.commissionPct || 0}% commission`} color={D.amber} icon="💹" />
                    <StatCard label="Payments Count" value={financeData.totals?.paymentCount || 0} icon="🧾" />
                    <StatCard label="30D Net Forecast" value={money(financeData.forecast?.next30DaysNetCents)} sub={`${money(financeData.forecast?.avgDailyNetCents)}/day avg`} color={D.amber} icon="📈" />
                  </div>
                  
                  <div style={{ ...cardStyle, padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: D.text100, marginBottom: '4px', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>Daily Net Revenue</h3>
                    <p style={{ fontSize: '12px', color: D.text500, marginBottom: '20px' }}>Platform net revenue history per day</p>
                    
                    {financeData.series?.length === 0 ? (
                      <p style={{ color: D.text400, fontSize: '13px', fontStyle: 'italic' }}>No transactions recorded in this window.</p>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '160px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {(() => {
                          const maxNet = Math.max(1, ...(financeData.series || []).map(s => s.net_cents || 0));
                          return (financeData.series || []).map((s, idx) => {
                            const percent = ((s.net_cents || 0) / maxNet) * 100;
                            return (
                              <div key={idx} title={`${s.day}: ${money(s.net_cents)}`} style={{ flex: '1 0 10px', minWidth: '10px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <div style={{ width: '100%', height: `${Math.max(2, percent)}%`, background: D.amber, borderRadius: '2px 2px 0 0', opacity: 0.85, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.85'} />
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ ...cardStyle, padding: '48px', textAlign: 'center', color: D.text500 }}>Loading financials…</div>
              )}
            </div>
          )}

          {/* ── ORGANIZATIONS ── */}
          {activeTab === 'organizations' && (
            <TableShell title="Organizations" subtitle={`${organizations.length} registered organizers`}
              action={<input placeholder="Search organizations…" value={orgSearch} onChange={e => setOrgSearch(e.target.value)} style={{ ...inputStyle, width: '220px' }} />}
              head={<><Th>Organization</Th><Th>Contact</Th><Th>Events</Th><Th>Active</Th><Th>Lifetime Revenue</Th><Th>Billing</Th><Th>Joined</Th><Th align="right">Action</Th></>}>
              {filteredOrgs.length ? filteredOrgs.map(o => (
                <tr key={o.id} style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                  <Td color={D.text200}><b>{o.name || 'Unnamed'}</b></Td>
                  <Td>
                    <span style={{ display: 'block', color: D.text300 }}>{o.email || '—'}</span>
                    <span style={{ fontSize: '11px', color: D.text500 }}>{o.phone || ''}</span>
                  </Td>
                  <Td color={D.text300}>{o.eventCount} <span style={{ color: D.text500, fontSize: '11px' }}>({o.paidEventCount} paid)</span></Td>
                  <Td color={D.text300}>{o.activeEventCount}</Td>
                  <Td color={D.emerald}><b>{money(o.lifetimeRevenueCents)}</b></Td>
                  <Td>{o.hasStripeCustomer ? <Badge status="completed" label="Stripe" /> : <Badge status="draft" label="None" />}</Td>
                  <Td color={D.text400}>{dateStr(o.createdAt)}</Td>
                  <Td align="right">
                    <button style={btn('ghost')} onClick={() => { setSelectedOrg(o); loadOrgDetails(o.ownerUserId); }}>Manage</button>
                  </Td>
                </tr>
              )) : <tr><td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: D.text500 }}>No organizations found.</td></tr>}
            </TableShell>
          )}

          {/* ── SMS CREDITS ── */}
          {activeTab === 'sms' && (
            <TableShell title="SMS Credit Wallets" subtitle="Credit balances across all events"
              head={<><Th>Event</Th><Th>Organizer</Th><Th>Purchased</Th><Th>Used</Th><Th>Remaining</Th><Th>Updated</Th><Th align="right">Action</Th></>}>
              {smsWallets.length ? smsWallets.map(w => (
                <tr key={w.event_id} style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                  <Td color={D.text200}><b>{w.events?.title || '—'}</b></Td>
                  <Td color={D.text400}>{w.events?.organizations?.name || '—'}</Td>
                  <Td color={D.text300}>{w.credits_purchased}</Td>
                  <Td color={D.text300}>{w.credits_used}</Td>
                  <Td color={w.credits_remaining > 0 ? D.emerald : D.roseLight}><b>{w.credits_remaining}</b></Td>
                  <Td color={D.text400}>{dateStr(w.updated_at)}</Td>
                  <Td align="right"><button style={btn('ghost')} onClick={() => setGrantModal({ eventId: w.event_id, title: w.events?.title || 'Event' })}>+ Grant</button></Td>
                </tr>
              )) : <tr><td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: D.text500 }}>No SMS wallets yet.</td></tr>}
            </TableShell>
          )}

          {/* ── USERS & ROLES ── */}
          {activeTab === 'roles' && (
            <TableShell title="Users & Access Control" subtitle="Promote organizers to Super Admin or revoke. You cannot remove your own Super Admin role."
              head={<><Th>Account</Th><Th>Email</Th><Th>Events</Th><Th>Joined</Th><Th>Role</Th><Th align="right">Action</Th></>}>
              {users.length ? users.map(u => {
                const isAdmin = u.role === 'super_admin';
                const busy = busyId === u.userId;
                return (
                  <tr key={u.userId} style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                    <Td color={D.text200}><b>{u.name || 'Unnamed'}</b></Td>
                    <Td color={D.text400}>{u.email || '—'}</Td>
                    <Td color={D.text300}>{u.eventCount ?? 0}</Td>
                    <Td color={D.text400}>{dateStr(u.createdAt)}</Td>
                    <Td>{isAdmin ? <Badge status="pending" label="Super Admin" /> : <Badge status="draft" label="Organizer" />}</Td>
                    <Td align="right">
                      <button disabled={busy} style={btn(isAdmin ? 'danger' : 'primary')}
                        onClick={() => handleSetRole(u.userId, isAdmin ? 'organizer' : 'super_admin')}>
                        {busy ? 'Saving…' : isAdmin ? 'Revoke Admin' : 'Promote to Admin'}
                      </button>
                    </Td>
                  </tr>
                );
              }) : <tr><td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: D.text500 }}>No users found.</td></tr>}
            </TableShell>
          )}

          {/* ── PRICING CONFIG ── */}
          {activeTab === 'config' && (
            <div style={{ ...cardStyle, padding: '24px', maxWidth: '760px' }}>
              <div style={{ borderBottom: `1px solid ${D.cardBorder}`, paddingBottom: '16px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: D.text100 }}>Platform Pricing & SMS</h3>
                <p style={{ fontSize: '12px', color: D.text400, marginTop: '4px' }}>Set license tiers, SMS base rate, markup and platform commission.</p>
              </div>
              <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="admin-config-grid">
                  <Field label="SMS Base Rate (¢)"><input type="number" value={smsRate} onChange={e => setSmsRate(e.target.value)} style={inputStyle} /></Field>
                  <Field label="SMS Markup (%)"><input type="number" step="0.1" value={smsMarkupPercentage} onChange={e => setSmsMarkupPercentage(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Platform Commission (%)"><input type="number" step="0.1" value={platformCommissionPct} onChange={e => setPlatformCommissionPct(e.target.value)} style={inputStyle} /></Field>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${D.cardBorder}`, paddingBottom: '8px', marginBottom: '16px' }}>
                    <label style={{ fontSize: '11px', color: D.text400, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>License Tiers</label>
                    <button type="button" onClick={addTier} style={btn('ghost')}>+ Add Tier</button>
                  </div>
                  <p style={{ fontSize: '11px', color: D.text500, marginBottom: '16px', lineHeight: 1.6 }}>These tiers are the single source of truth: they power the public landing-page plans, the plan cards shown during event creation, and the platform fee actually charged at checkout. Edit once here.</p>
                  {pricingTiers.length ? pricingTiers.map((tier, idx) => (
                    <div key={idx} style={{ background: D.bg, padding: '16px', border: `1px solid ${tier.recommended ? 'rgba(245,158,11,0.35)' : D.cardBorder}`, borderRadius: '12px', marginBottom: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }} className="admin-tier-row">
                        <Field small label="Tier Name"><input value={tier.name} onChange={e => handleTierChange(idx, 'name', e.target.value)} style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px' }} /></Field>
                        <Field small label={tier.is_custom ? 'Price (cents — unused)' : 'Price (cents)'}><input type="number" value={tier.price_cents} disabled={tier.is_custom} onChange={e => handleTierChange(idx, 'price_cents', e.target.value)} style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px', opacity: tier.is_custom ? 0.5 : 1 }} /></Field>
                        <Field small label="Max Guests (0 = unlimited)"><input type="number" value={tier.max_guests} onChange={e => handleTierChange(idx, 'max_guests', e.target.value)} style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px' }} /></Field>
                        <button type="button" onClick={() => removeTier(idx)} style={{ ...btn('danger'), padding: '8px 10px' }}>✕</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }} className="admin-tier-row">
                        <Field small label="Display Price Label (optional, e.g. Custom)"><input value={tier.price_label || ''} onChange={e => handleTierChange(idx, 'price_label', e.target.value)} placeholder={tier.is_custom ? 'Custom' : 'auto from price'} style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px' }} /></Field>
                        <Field small label="Button Label (optional)"><input value={tier.cta_label || ''} onChange={e => handleTierChange(idx, 'cta_label', e.target.value)} placeholder={tier.is_custom ? 'Contact Sales' : 'Get Started'} style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px' }} /></Field>
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <Field small label="Card Description (optional — shown on the pricing page)"><input value={tier.description || ''} onChange={e => handleTierChange(idx, 'description', e.target.value)} placeholder="Perfect for small gatherings and personal events." style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px' }} /></Field>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: D.text300, cursor: 'pointer' }}>
                          <input type="checkbox" checked={tier.recommended === true} onChange={e => handleTierChange(idx, 'recommended', e.target.checked)} /> ⭐ Most Popular
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: D.text300, cursor: 'pointer' }}>
                          <input type="checkbox" checked={tier.is_custom === true} onChange={e => handleTierChange(idx, 'is_custom', e.target.checked)} /> Contact Sales (custom price)
                        </label>
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <Field small label="Features (one per line — shown on landing & event-creation cards)">
                          <textarea
                            value={(tier.features || []).join('\n')}
                            onChange={e => handleTierFeatures(idx, e.target.value)}
                            rows={4}
                            placeholder={'Unlimited events\nUp to 500 guests\nSeating charts\nQR check-in'}
                            style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px', resize: 'vertical', lineHeight: 1.5 }}
                          />
                        </Field>
                      </div>
                    </div>
                  )) : <p style={{ fontSize: '12px', color: D.text500, fontStyle: 'italic' }}>No tiers defined.</p>}
                </div>

                {/* Manual payment methods */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${D.cardBorder}`, paddingBottom: '8px', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', color: D.text400, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Manual Payment Methods</label>
                    <button type="button" onClick={addMethod} style={btn('ghost')}>+ Add Method</button>
                  </div>
                  <p style={{ fontSize: '11px', color: D.text500, marginBottom: '16px', lineHeight: 1.6 }}>These are shown to organizers who choose to pay the platform fee offline. Add bank accounts, wallet numbers, InstaPay handles, etc. Toggle off to hide a method without deleting it.</p>
                  {manualMethods.length ? manualMethods.map((m, idx) => (
                    <div key={m.id || idx} style={{ background: D.bg, padding: '16px', border: `1px solid ${m.is_active === false ? D.cardBorder : 'rgba(245,158,11,0.25)'}`, borderRadius: '12px', marginBottom: '12px', opacity: m.is_active === false ? 0.6 : 1 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: '12px', alignItems: 'end', marginBottom: '12px' }} className="admin-tier-row">
                        <Field small label="Label (e.g. Bank Transfer — CIB)"><input value={m.label} onChange={e => updateMethod(idx, 'label', e.target.value)} style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px' }} /></Field>
                        <Field small label="Type">
                          <select value={m.type} onChange={e => updateMethod(idx, 'type', e.target.value)} style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px', cursor: 'pointer' }}>
                            {['bank', 'wallet', 'instapay', 'cash', 'paypal', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </Field>
                        <button type="button" onClick={() => removeMethod(idx)} style={{ ...btn('danger'), padding: '8px 10px' }}>✕</button>
                      </div>
                      <Field small label="Account / Number / Details"><input value={m.details} onChange={e => updateMethod(idx, 'details', e.target.value)} placeholder="e.g. IBAN EG12 3456 7890 / 0100-123-4567" style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px', marginBottom: '12px' }} /></Field>
                      <Field small label="Instructions to payer"><textarea value={m.instructions} onChange={e => updateMethod(idx, 'instructions', e.target.value)} rows={2} placeholder="e.g. Put the reference code in the transfer note." style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px', resize: 'vertical', fontFamily: 'var(--font-sans)' }} /></Field>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', cursor: 'pointer', fontSize: '12px', color: D.text300, fontWeight: 600 }}>
                        <input type="checkbox" checked={m.is_active !== false} onChange={e => updateMethod(idx, 'is_active', e.target.checked)} style={{ accentColor: D.amber, width: '15px', height: '15px' }} />
                        Active (visible to organizers)
                      </label>
                    </div>
                  )) : <p style={{ fontSize: '12px', color: D.text500, fontStyle: 'italic' }}>No methods configured — organizers will only see the reference code.</p>}
                </div>

                <button type="submit" disabled={savingConfig} style={{ ...btn('primary'), padding: '11px 22px', fontSize: '12px', opacity: savingConfig ? 0.5 : 1, alignSelf: 'flex-start' }}>
                  {savingConfig ? 'Saving…' : 'Save Configuration'}
                </button>
              </form>
            </div>
          )}

          {/* ── ACTIVITY LOG ── */}
          {activeTab === 'activity' && (
            <TableShell title="Platform Activity Log" subtitle="Audit trail across all events"
              head={<><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Event</Th><Th>Entity</Th></>}>
              {activity.length ? activity.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                  <Td color={D.text400}>{dateTime(a.createdAt)}</Td>
                  <Td color={D.text300}>{a.actor}</Td>
                  <Td><code style={{ color: D.sky, fontSize: '11px' }}>{a.action}</code></Td>
                  <Td color={D.text300}>{a.eventTitle || '—'}</Td>
                  <Td color={D.text500}>{a.entityType || '—'}</Td>
                </tr>
              )) : <tr><td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: D.text500 }}>No activity recorded.</td></tr>}
            </TableShell>
          )}
        </div>
      </main>

      {/* Approve modal */}
      {approval && (
        <Modal onClose={() => setApproval(null)} title="Confirm Payment Received">
          <p style={{ fontSize: '12px', color: D.text400, lineHeight: 1.6, marginBottom: '20px' }}>Verify the transfer landed in your account, then confirm. This marks the payment as received, stamps it with your verification, and activates the event immediately.</p>
          <form onSubmit={handleApprove} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div><span style={{ fontSize: '11px', color: D.text500, fontWeight: 600 }}>Event</span><div style={{ fontSize: '14px', fontWeight: 700, color: D.text200 }}>{approval.event?.title}</div></div>
            {(approval.method || approval.proof) && (
              <div style={{ background: D.bg, border: `1px solid ${D.cardBorder}`, borderRadius: '12px', padding: '14px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: D.text500, fontWeight: 700 }}>Payer declared</span>
                {approval.method && <div style={{ fontSize: '13px', color: D.text200, fontWeight: 600, marginTop: '6px' }}>{approval.method}</div>}
                {approval.proof && <div style={{ fontSize: '12px', color: D.text400, marginTop: '4px' }}>Proof / Txn: <code style={{ color: D.sky }}>{approval.proof}</code></div>}
              </div>
            )}
            <Field label="Approved Amount (cents)">
              <input type="number" required value={approval.amountCents} onChange={e => setApproval(a => ({ ...a, amountCents: e.target.value }))} style={inputStyle} />
              <span style={{ fontSize: '10px', color: D.text500 }}>e.g. 7900 = $79.00</span>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setApproval(null)} style={btn('ghost')}>Cancel</button>
              <button type="submit" disabled={submittingApproval} style={{ ...btn('primary'), opacity: submittingApproval ? 0.5 : 1 }}>{submittingApproval ? 'Processing…' : 'Approve & Activate'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Grant SMS modal */}
      {grantModal && (
        <Modal onClose={() => setGrantModal(null)} title="Grant Complimentary SMS Credits">
          <p style={{ fontSize: '12px', color: D.text400, lineHeight: 1.6, marginBottom: '20px' }}>Add free SMS credits to <b style={{ color: D.text200 }}>{grantModal.title}</b>. Use for support gestures or compensation.</p>
          <form onSubmit={handleGrantSms} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Credits to grant"><input type="number" min="1" max="50000" required value={grantAmount} onChange={e => setGrantAmount(e.target.value)} style={inputStyle} /></Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setGrantModal(null)} style={btn('ghost')}>Cancel</button>
              <button type="submit" disabled={busyId === grantModal.eventId} style={btn('primary')}>Grant Credits</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manage Tenant Modal */}
      {selectedOrg && (
        <Modal onClose={() => { setSelectedOrg(null); setOrgDetails(null); }} title="Manage Organizer Account">
          {loadingOrgDetails ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
              <div style={{ width: '24px', height: '24px', border: `2px solid ${D.cardBorder}`, borderTop: `2px solid ${D.amber}`, borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
              <span style={{ fontSize: '13px', color: D.text300 }}>Loading account details…</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${D.cardBorder}`, paddingBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: D.text100 }}>{selectedOrg.name || 'Unnamed Organization'}</div>
                  <div style={{ fontSize: '12px', color: D.text400, marginTop: '2px' }}>{orgDetails?.email || selectedOrg.email || '—'}</div>
                </div>
                <Badge status={orgDetails?.status || 'active'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', color: D.text300 }}>
                <div>
                  <span style={{ display: 'block', color: D.text400, fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Joined Date</span>
                  <span style={{ fontWeight: 600, color: D.text200 }}>{dateStr(selectedOrg.createdAt)}</span>
                </div>
                <div>
                  <span style={{ display: 'block', color: D.text400, fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Lifetime Revenue</span>
                  <span style={{ fontWeight: 600, color: D.emerald }}>{money(selectedOrg.lifetimeRevenueCents)}</span>
                </div>
              </div>

              {tempPassword && (
                <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: `1px dashed ${D.amber}`, borderRadius: '12px', padding: '14px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: D.amber, fontWeight: 700 }}>Temporary Password Generated</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <code style={{ fontSize: '14px', fontWeight: 700, color: D.text100, background: D.bg, padding: '4px 8px', borderRadius: '4px', border: `1px solid ${D.cardBorder}` }}>{tempPassword}</code>
                    <button type="button" style={{ ...btn('ghost'), padding: '4px 8px', fontSize: '11px' }} onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      showToast('Copied to clipboard!');
                    }}>Copy</button>
                  </div>
                  <p style={{ fontSize: '11px', color: D.text400, marginTop: '8px', marginBottom: 0 }}>Provide this password securely to the organizer. They will be prompted to change it upon login.</p>
                </div>
              )}

              <div style={{ borderTop: `1px solid ${D.cardBorder}`, paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  disabled={impersonating}
                  onClick={() => handleImpersonate(selectedOrg.ownerUserId)}
                  style={{ ...btn('primary'), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: impersonating ? 0.7 : 1 }}
                >
                  {impersonating ? 'Redirection session active…' : '👤 Impersonate Organizer'}
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleResetPassword(selectedOrg.ownerUserId)}
                    style={{ ...btn('ghost'), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    🔑 Reset Password
                  </button>

                  <button
                    type="button"
                    disabled={changingStatus}
                    onClick={() => handleToggleSuspend(selectedOrg.ownerUserId, orgDetails?.status)}
                    style={{ ...btn(orgDetails?.status === 'banned' ? 'primary' : 'danger'), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    {changingStatus ? 'Updating…' : orgDetails?.status === 'banned' ? '🔓 Reactivate Account' : '🚫 Suspend Account'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => { setSelectedOrg(null); setOrgDetails(null); }} style={btn('ghost')}>Close</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 80, background: toast.kind === 'error' ? 'rgba(244,63,94,0.95)' : 'rgba(16,185,129,0.95)', color: D.white, padding: '12px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.4)', maxWidth: '360px' }}>
          {toast.msg}
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 880px) {
          .admin-sidebar { position: fixed !important; z-index: 40; transform: translateX(-100%); transition: transform 0.2s; }
          .admin-menu-btn { display: inline-block !important; }
          .admin-config-grid { grid-template-columns: 1fr !important; }
          .admin-tier-row { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={logout} />
    </div>
  );
}

function Field({ label, small, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: small ? '9px' : '11px', textTransform: 'uppercase', color: D.text400, fontWeight: 800, display: 'block', letterSpacing: '0.08em' }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(25, 27, 30, 0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: '100%', maxWidth: '440px', padding: '28px', boxShadow: '0 24px 60px rgba(25, 27, 30, 0.12)', border: `1px solid ${D.cardBorder}`, animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: D.text100, marginBottom: '16px', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function OverviewTab({ overview }) {
  if (!overview) return <div style={{ ...cardStyle, padding: '48px', textAlign: 'center', color: D.text500 }}>
    <div style={{ width: '24px', height: '24px', border: `2px solid ${D.cardBorder}`, borderTop: `2px solid ${D.amber}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
    Loading metrics…
  </div>;
  const { events, organizations, rsvps, checkIns, revenue, sms, recentActivity } = overview;
  const maxRev = Math.max(...revenue.trend.map(t => t.cents), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }} className="admin-stat-grid">
        <StatCard label="Gross Revenue" value={money(revenue.grossCents)} sub={`${money(revenue.pendingCents)} pending`} color={D.emerald} />
        <StatCard label="Total Events" value={events.total} sub={`${events.paid} paid · ${events.unpaid} unpaid`} color={D.amber} />
        <StatCard label="Organizations" value={organizations} sub="registered organizers" color={D.sky} />
        <StatCard label="Guests Attending" value={rsvps.attendingGuests} sub={`${rsvps.attendingParties} parties`} color={D.violet} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }} className="admin-stat-grid">
        <StatCard label="Check-ins" value={checkIns} sub="guest entries completed" color={D.emerald} />
        <StatCard label="RSVPs Total" value={rsvps.total} sub={`${rsvps.declined} declined · ${rsvps.pending} pending`} />
        <StatCard label="SMS Credits Sold" value={sms.purchased} sub={`${sms.remaining} remaining`} color={D.sky} />
        <StatCard label="Refunded" value={money(revenue.refundedCents)} color={D.roseLight} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }} className="admin-overview-cols">
        {/* Revenue chart */}
        <div style={{ ...cardStyle, padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: D.text100, marginBottom: '2px', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>Revenue — last 6 months</h3>
          <p style={{ fontSize: '12px', color: D.text500, marginBottom: '20px' }}>Completed platform payments by month</p>
          
          <div style={{ position: 'relative', height: '180px', marginTop: '20px', padding: '0 10px' }}>
            {/* Gridlines */}
            <div style={{ position: 'absolute', inset: '0 0 24px 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ borderTop: `1px dashed ${D.cardBorder}`, width: '100%', height: 0 }} />
              ))}
            </div>
            {/* Bars container */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '16px', height: '100%', paddingBottom: '24px', zIndex: 1 }}>
              {revenue.trend.map(t => {
                const percent = (t.cents / maxRev) * 100;
                return (
                  <div key={t.month} className="chart-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '10.5px', color: D.text200, fontWeight: 800, opacity: 0, transition: 'opacity 0.2s', marginBottom: '2px', background: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${D.cardBorder}` }} className="chart-val">
                      {t.cents ? `$${Math.round(t.cents / 100).toLocaleString()}` : '$0'}
                    </span>
                    <div style={{ width: '100%', maxWidth: '38px', height: `${percent}%`, minHeight: t.cents ? '6px' : '0', background: `linear-gradient(180deg, ${D.amberHover}, ${D.amber})`, borderRadius: '6px 6px 0 0', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', cursor: 'pointer', boxShadow: '0 0 15px rgba(197, 168, 107, 0.1)' }} className="chart-bar" />
                    <span style={{ fontSize: '11px', color: D.text400, fontWeight: 700 }}>{t.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status breakdown */}
        <div style={{ ...cardStyle, padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: D.text100, marginBottom: '20px', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>Events by Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(events.byStatus).map(([status, count]) => {
              const pct = events.total ? (count / events.total) * 100 : 0;
              const c = STATUS_COLORS[status] || STATUS_COLORS.draft;
              return (
                <div key={status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                    <span style={{ color: D.text200, textTransform: 'capitalize', fontWeight: 600 }}>{status.replace(/_/g, ' ')}</span>
                    <span style={{ color: D.text100, fontWeight: 800 }}>{count}</span>
                  </div>
                  <div style={{ height: '8px', background: D.bg, borderRadius: '4px', overflow: 'hidden', border: `1px solid ${D.cardBorder}` }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: c.fg, borderRadius: '4px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ ...cardStyle, padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: D.text100, marginBottom: '16px', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>Recent Activity</h3>
        {recentActivity.length ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentActivity.map((a, i) => (
              <div key={a.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 8px', borderBottom: i < recentActivity.length - 1 ? `1px solid ${D.cardBorder}` : 'none', borderRadius: '6px', transition: 'background-color 0.2s' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: D.amber, flexShrink: 0 }} />
                <code style={{ color: D.sky, fontSize: '11px', background: 'rgba(14, 165, 233, 0.08)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(14, 165, 233, 0.15)' }}>{a.action}</code>
                <span style={{ color: D.text200, fontSize: '12.5px', flex: 1, fontWeight: 500 }}>{a.eventTitle || a.entityType || ''}</span>
                <span style={{ color: D.text500, fontSize: '11px', fontWeight: 600 }}>{dateTime(a.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : <p style={{ fontSize: '12px', color: D.text500 }}>No activity yet.</p>}
      </div>

      <style jsx>{`
        .chart-col:hover .chart-val {
          opacity: 1 !important;
        }
        .chart-bar:hover {
          background: linear-gradient(180deg, ${D.amberHover}, ${D.amber}) !important;
          box-shadow: 0 4px 15px rgba(184, 148, 79, 0.25) !important;
          transform: scaleX(1.05);
        }
        .activity-row:hover {
          background-color: rgba(0, 0, 0, 0.02);
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 880px) {
          .admin-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .admin-overview-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
