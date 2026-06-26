'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../utils/apiClient';
import LogoutModal from '../components/LogoutModal';

const D = {
  bg: '#0a0c10', bg2: '#0d0f14', card: '#111318', cardBorder: '#1e2028', borderLight: '#2d303a',
  text100: '#f0f1f3', text200: '#d8dae0', text300: '#b8bcc5', text400: '#8b8fa0', text500: '#5f6375',
  amber: '#f59e0b', amberHover: '#eab308', amberDark: '#d97706',
  rose: '#f43f5e', roseLight: '#fb7185',
  emerald: '#34d399', emeraldDark: '#059669',
  sky: '#38bdf8', violet: '#a78bfa',
  white: '#FFFFFF',
};

const NAV = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'events', label: 'Events', icon: '🎉' },
  { key: 'pending', label: 'Pending Payments', icon: '⏳' },
  { key: 'payments', label: 'Revenue & Payments', icon: '💳' },
  { key: 'organizations', label: 'Organizations', icon: '🏢' },
  { key: 'sms', label: 'SMS Credits', icon: '✉️' },
  { key: 'roles', label: 'Users & Roles', icon: '🔐' },
  { key: 'config', label: 'Pricing Config', icon: '⚙️' },
  { key: 'activity', label: 'Activity Log', icon: '📜' },
];

const cardStyle = { background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: '16px' };
const inputStyle = { width: '100%', background: D.bg, border: `1px solid ${D.cardBorder}`, borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: D.text200, outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box', transition: 'border-color 0.2s' };

const money = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateStr = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const dateTime = (d) => d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_COLORS = {
  active: { bg: 'rgba(16,185,129,0.1)', fg: D.emerald, br: 'rgba(16,185,129,0.2)' },
  pending_review: { bg: 'rgba(245,158,11,0.12)', fg: D.amber, br: 'rgba(245,158,11,0.25)' },
  draft: { bg: 'rgba(255,255,255,0.04)', fg: D.text300, br: D.cardBorder },
  paused: { bg: 'rgba(245,158,11,0.1)', fg: D.amber, br: 'rgba(245,158,11,0.2)' },
  completed: { bg: 'rgba(56,189,248,0.1)', fg: D.sky, br: 'rgba(56,189,248,0.2)' },
  pending: { bg: 'rgba(245,158,11,0.1)', fg: D.amber, br: 'rgba(245,158,11,0.2)' },
  failed: { bg: 'rgba(244,63,94,0.1)', fg: D.roseLight, br: 'rgba(244,63,94,0.2)' },
  refunded: { bg: 'rgba(167,139,250,0.1)', fg: D.violet, br: 'rgba(167,139,250,0.2)' },
};

function Badge({ status, label }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <span style={{ background: c.bg, color: c.fg, border: `1px solid ${c.br}`, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {label || status}
    </span>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ ...cardStyle, padding: '20px' }}>
      <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: D.text400, fontWeight: 700, display: 'block' }}>{label}</span>
      <span style={{ fontSize: '24px', fontWeight: 900, display: 'block', marginTop: '8px', color: color || D.text100 }}>{value}</span>
      {sub && <span style={{ fontSize: '11px', color: D.text500, display: 'block', marginTop: '4px' }}>{sub}</span>}
    </div>
  );
}

function Th({ children, align }) {
  return <th style={{ padding: '12px 20px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.text400, fontWeight: 700, textAlign: align || 'left', whiteSpace: 'nowrap' }}>{children}</th>;
}
function Td({ children, align, color }) {
  return <td style={{ padding: '14px 20px', color: color || D.text300, textAlign: align || 'left' }}>{children}</td>;
}

function TableShell({ title, subtitle, head, children, action }) {
  return (
    <div style={{ ...cardStyle, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${D.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: D.text100 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '12px', color: D.text400, marginTop: '4px' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', textAlign: 'left', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: D.bg, borderBottom: `1px solid ${D.cardBorder}` }}>{head}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

const btn = (variant = 'primary') => {
  const base = { padding: '7px 14px', fontSize: '11px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', whiteSpace: 'nowrap' };
  if (variant === 'primary') return { ...base, background: D.amberDark, color: D.white, border: 'none' };
  if (variant === 'ghost') return { ...base, background: 'transparent', color: D.text300, border: `1px solid ${D.borderLight}` };
  if (variant === 'danger') return { ...base, background: 'transparent', color: D.roseLight, border: '1px solid rgba(244,63,94,0.3)' };
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
      <aside className="admin-sidebar" style={{ width: '236px', background: D.bg2, borderRight: `1px solid ${D.cardBorder}`, padding: '24px 16px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', transform: sidebarOpen ? 'translateX(0)' : undefined }}>
        <div style={{ padding: '0 8px 20px', borderBottom: `1px solid ${D.cardBorder}`, marginBottom: '16px' }}>
          <span style={{ color: D.amber, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '10px', fontWeight: 800 }}>Fancy Platform</span>
          <h1 style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '4px', color: D.text100 }}>Super Admin</h1>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflowY: 'auto' }}>
          {NAV.map(n => {
            const active = activeTab === n.key;
            const count = n.key === 'pending' ? pendingPayments.length : null;
            return (
              <button key={n.key} onClick={() => goTab(n.key)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: active ? 700 : 500, textAlign: 'left', background: active ? 'rgba(245,158,11,0.12)' : 'transparent', color: active ? D.amber : D.text300, transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: '15px' }}>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {count ? <span style={{ background: D.amberDark, color: D.white, fontSize: '10px', fontWeight: 800, padding: '1px 7px', borderRadius: '10px' }}>{count}</span> : null}
              </button>
            );
          })}
        </nav>
        <div style={{ borderTop: `1px solid ${D.cardBorder}`, paddingTop: '12px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Link href="/dashboard" style={{ padding: '9px 12px', fontSize: '12px', fontWeight: 600, color: D.text300, textDecoration: 'none', borderRadius: '8px' }}>← Organizer Dashboard</Link>
          <button onClick={() => setShowLogoutModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: D.text400, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.color = D.roseLight}
            onMouseLeave={e => e.currentTarget.style.color = D.text400}>Sign Out</button>
        </div>
      </aside>
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 30 }} className="admin-overlay" />}

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 64px' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="admin-menu-btn" onClick={() => setSidebarOpen(true)} style={{ ...btn('ghost'), display: 'none', padding: '8px 12px' }}>☰</button>
              <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>{activeNav?.icon} {activeNav?.label}</h2>
            </div>
            <button onClick={() => refreshTab(activeTab)} style={btn('ghost')}>{tabLoading ? 'Refreshing…' : '↻ Refresh'}</button>
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

          {/* ── ORGANIZATIONS ── */}
          {activeTab === 'organizations' && (
            <TableShell title="Organizations" subtitle={`${organizations.length} registered organizers`}
              action={<input placeholder="Search organizations…" value={orgSearch} onChange={e => setOrgSearch(e.target.value)} style={{ ...inputStyle, width: '220px' }} />}
              head={<><Th>Organization</Th><Th>Contact</Th><Th>Events</Th><Th>Active</Th><Th>Lifetime Revenue</Th><Th>Billing</Th><Th>Joined</Th></>}>
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
                </tr>
              )) : <tr><td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: D.text500 }}>No organizations found.</td></tr>}
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
    <div>
      <label style={{ fontSize: small ? '9px' : '11px', textTransform: 'uppercase', color: D.text500, fontWeight: 700, display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(10,12,16,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: D.text100, marginBottom: '8px' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function OverviewTab({ overview }) {
  if (!overview) return <div style={{ ...cardStyle, padding: '48px', textAlign: 'center', color: D.text500 }}>Loading metrics…</div>;
  const { events, organizations, rsvps, checkIns, revenue, sms, recentActivity } = overview;
  const maxRev = Math.max(...revenue.trend.map(t => t.cents), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }} className="admin-stat-grid">
        <StatCard label="Gross Revenue" value={money(revenue.grossCents)} sub={`${money(revenue.pendingCents)} pending`} color={D.emerald} />
        <StatCard label="Total Events" value={events.total} sub={`${events.paid} paid · ${events.unpaid} unpaid`} color={D.amber} />
        <StatCard label="Organizations" value={organizations} sub="registered organizers" color={D.sky} />
        <StatCard label="Guests Attending" value={rsvps.attendingGuests} sub={`${rsvps.attendingParties} parties`} color={D.violet} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }} className="admin-stat-grid">
        <StatCard label="Check-ins" value={checkIns} />
        <StatCard label="RSVPs Total" value={rsvps.total} sub={`${rsvps.declined} declined · ${rsvps.pending} pending`} />
        <StatCard label="SMS Credits Sold" value={sms.purchased} sub={`${sms.remaining} remaining`} />
        <StatCard label="Refunded" value={money(revenue.refundedCents)} color={D.roseLight} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }} className="admin-overview-cols">
        {/* Revenue chart */}
        <div style={{ ...cardStyle, padding: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: D.text100, marginBottom: '4px' }}>Revenue — last 6 months</h3>
          <p style={{ fontSize: '12px', color: D.text500, marginBottom: '24px' }}>Completed payments by month</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '160px' }}>
            {revenue.trend.map(t => (
              <div key={t.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '10px', color: D.text400, fontWeight: 700 }}>{t.cents ? `$${Math.round(t.cents / 100)}` : ''}</span>
                <div style={{ width: '100%', maxWidth: '44px', height: `${(t.cents / maxRev) * 100}%`, minHeight: t.cents ? '4px' : '0', background: `linear-gradient(180deg, ${D.amber}, ${D.amberDark})`, borderRadius: '6px 6px 0 0', transition: 'height 0.3s' }} />
                <span style={{ fontSize: '11px', color: D.text500 }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status breakdown */}
        <div style={{ ...cardStyle, padding: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: D.text100, marginBottom: '20px' }}>Events by Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.entries(events.byStatus).map(([status, count]) => {
              const pct = events.total ? (count / events.total) * 100 : 0;
              const c = STATUS_COLORS[status] || STATUS_COLORS.draft;
              return (
                <div key={status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: D.text300, textTransform: 'capitalize' }}>{status}</span>
                    <span style={{ color: D.text400, fontWeight: 700 }}>{count}</span>
                  </div>
                  <div style={{ height: '8px', background: D.bg, borderRadius: '4px', overflow: 'hidden' }}>
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
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: D.text100, marginBottom: '16px' }}>Recent Activity</h3>
        {recentActivity.length ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentActivity.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < recentActivity.length - 1 ? `1px solid ${D.cardBorder}` : 'none' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: D.amber, flexShrink: 0 }} />
                <code style={{ color: D.sky, fontSize: '11px' }}>{a.action}</code>
                <span style={{ color: D.text400, fontSize: '12px', flex: 1 }}>{a.eventTitle || a.entityType || ''}</span>
                <span style={{ color: D.text500, fontSize: '11px' }}>{dateTime(a.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : <p style={{ fontSize: '12px', color: D.text500 }}>No activity yet.</p>}
      </div>

      <style jsx>{`
        @media (max-width: 880px) {
          .admin-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .admin-overview-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
