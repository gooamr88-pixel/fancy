'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../utils/apiClient';

const D = {
  bg: '#0a0c10', card: '#111318', cardBorder: '#1e2028', borderLight: '#2d303a',
  text100: '#f0f1f3', text200: '#d8dae0', text300: '#b8bcc5', text400: '#8b8fa0', text500: '#5f6375',
  amber: '#f59e0b', amberHover: '#eab308', amberDark: '#d97706',
  rose: '#f43f5e', roseLight: '#fb7185',
  emerald: '#34d399',
  white: '#FFFFFF',
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('events');

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [approveAmountCents, setApproveAmountCents] = useState(7900);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const [showReceiptOverlay, setShowReceiptOverlay] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const [smsRate, setSmsRate] = useState(8);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [smsMarkupPercentage, setSmsMarkupPercentage] = useState(40.0);
  const [platformCommissionPct, setPlatformCommissionPct] = useState(0.0);
  const [savingConfig, setSavingConfig] = useState(false);


  const [authChecked, setAuthChecked] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const handleLogout = logout;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const orgId = localStorage.getItem('org_id');
      const userRole = localStorage.getItem('user_role');
      if (!orgId) { router.push('/login'); return; }
      if (userRole !== 'super_admin') { router.push('/dashboard'); return; }
      // Server-side role verification: attempt to fetch admin data
      // If the server returns 401/403, the localStorage role was spoofed
      fetch(`${apiUrl}/admin/events`, { credentials: 'include' })
        .then(async (res) => {
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('user_role');
            router.push('/dashboard');
            return;
          }
          try {
            const data = await res.json();
            if (data.success) setInitialData(data);
          } catch {}
          setAuthChecked(true);
        })
        .catch(() => {
          // Network error — still set authChecked so the normal error UI shows
          setAuthChecked(true);
        });
    }
  }, [router, apiUrl]);

  const loadAdminData = useCallback(async () => {
    if (!authChecked) return;
    try {
      if (initialData) {
        setEvents(initialData.events);
        setInitialData(null);
      } else {
        const eventsRes = await fetch(`${apiUrl}/admin/events`, { credentials: 'include' });
        const eventsData = await eventsRes.json();
        if (eventsData.success) setEvents(eventsData.events);
      }

      const configRes = await fetch(`${apiUrl}/admin/pricing`, { credentials: 'include' });
      const configData = await configRes.json();
      if (configData.success && configData.config) {
        setPricingConfig(configData.config);
        setSmsRate(configData.config.sms_rate_cents_per_credit || 8);
        setPricingTiers(configData.config.pricing_tiers || []);
        setSmsMarkupPercentage(configData.config.sms_markup_percentage !== undefined ? configData.config.sms_markup_percentage : 40.0);
        setPlatformCommissionPct(configData.config.platform_commission_pct !== undefined ? configData.config.platform_commission_pct : 0.0);
      }
      setError(null);
    } catch (err) {
      // Admin data loading failed
      setError('Could not connect to the administration API. Verify port 5000 is running.');
    } finally { setLoading(false); }
  }, [apiUrl, authChecked, initialData]);

  useEffect(() => { if (authChecked) loadAdminData(); }, [authChecked, loadAdminData]);

  const handleApprovePayment = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setSubmittingApproval(true);
    try {
      const res = await fetch(`${apiUrl}/admin/manual-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId: selectedEvent.id, amountCents: parseInt(approveAmountCents) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Manual cash approval failed.');
      if (data.success) {
        setShowApprovalModal(false);
        setReceiptData({
          eventTitle: selectedEvent.title,
          orgName: selectedEvent.organizations?.name || 'Unnamed Org',
          amountCents: parseInt(approveAmountCents),
          activationDate: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
          transactionId: data.receiptId || data.transactionId || 'pending'
        });
        setSelectedEvent(null);
        setShowReceiptOverlay(true);
        loadAdminData();
      }
    } catch (err) { alert(err.message); }
    finally { setSubmittingApproval(false); }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch(`${apiUrl}/admin/pricing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pricingTiers,
          smsRateCentsPerCredit: parseInt(smsRate),
          smsMarkupPercentage: parseFloat(smsMarkupPercentage),
          platformCommissionPct: parseFloat(platformCommissionPct)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Config update failed.');
      if (data.success) { alert('Pricing and SMS configurations updated successfully.'); loadAdminData(); }
    } catch (err) { alert(err.message); }
    finally { setSavingConfig(false); }
  };

  const handleTierChange = (index, field, value) => {
    const updated = [...pricingTiers];
    updated[index] = { ...updated[index], [field]: field === 'name' ? value : parseInt(value) || 0 };
    setPricingTiers(updated);
  };

  const inputStyle = { width: '100%', background: D.bg, border: `1px solid ${D.cardBorder}`, borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: D.text200, outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box', transition: 'border-color 0.2s' };
  const cardStyle = { background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: '16px' };

  if (!authChecked || loading) {
    return (
      <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: `3px solid ${D.cardBorder}`, borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: D.text400, fontFamily: 'var(--font-sans)', fontSize: '14px' }}>Opening administrator console...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', ...cardStyle, padding: '48px 32px', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          <span style={{ fontSize: '48px' }}>🔑</span>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginTop: '16px', color: D.rose, fontFamily: 'var(--font-sans)' }}>Security / Connection Error</h2>
          <p style={{ color: D.text400, marginTop: '8px', fontSize: '13px', lineHeight: 1.7 }}>{error}</p>
          <button onClick={() => { setLoading(true); loadAdminData(); }}
            style={{ marginTop: '24px', padding: '10px 20px', background: D.cardBorder, border: `1px solid ${D.borderLight}`, borderRadius: '8px', color: D.text200, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const unpaidEventsCount = events.filter(e => !e.is_paid).length;

  return (
    <div style={{ minHeight: '100vh', background: D.bg, color: D.text100, padding: '32px', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', borderBottom: `1px solid ${D.card}`, paddingBottom: '24px', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <span style={{ color: D.amber, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '11px', fontWeight: 700 }}>Platform Supervisor Deck</span>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', marginTop: '4px', color: D.text100, fontFamily: 'var(--font-sans)' }}>Super Admin Controls</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/dashboard" style={{ padding: '8px 16px', background: D.cardBorder, border: `1px solid ${D.borderLight}`, borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: D.text200, textDecoration: 'none', fontFamily: 'var(--font-sans)' }}>Go to Organizer Dashboard</Link>
          <button onClick={handleLogout}
            aria-label="Sign out"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: D.text500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'color 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = D.roseLight; e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = D.text500; e.currentTarget.style.background = 'none'; }}>
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }} className="admin-kpi-grid">
        <div style={{ ...cardStyle, padding: '24px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: D.text400, fontWeight: 700, display: 'block' }}>Total Hosted Events</span>
          <span style={{ fontSize: '22px', fontWeight: 900, display: 'block', marginTop: '8px', color: D.text100 }}>{events.length} Events</span>
        </div>
        <div style={{ ...cardStyle, padding: '24px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: D.text400, fontWeight: 700, display: 'block' }}>Unpaid / Inactive</span>
          <span style={{ fontSize: '22px', fontWeight: 900, display: 'block', marginTop: '8px', color: D.roseLight }}>{unpaidEventsCount} Pending</span>
        </div>
        <div style={{ ...cardStyle, padding: '24px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: D.text400, fontWeight: 700, display: 'block' }}>Base SMS Cost</span>
          <span style={{ fontSize: '22px', fontWeight: 900, display: 'block', marginTop: '8px', color: D.amber }}>{smsRate}¢ per credit</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', borderBottom: `1px solid ${D.card}`, gap: '24px', marginBottom: '32px' }}>
        {[{ key: 'events', label: 'Event Ledger' }, { key: 'config', label: 'Pricing Configurator' }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ paddingBottom: '12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', borderBottom: activeTab === tab.key ? `2px solid ${D.amber}` : '2px solid transparent', color: activeTab === tab.key ? D.amber : D.text500, transition: 'all 0.2s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {activeTab === 'events' ? (
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: `1px solid ${D.cardBorder}` }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: D.text100 }}>Event Registration Ledger</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: D.bg, borderBottom: `1px solid ${D.cardBorder}` }}>
                    {['Event Details', 'Organizer Account', 'Created Date', 'License State', ''].map((h, i) => (
                      <th key={i} style={{ padding: '12px 24px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.text400, fontWeight: 700, textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.length > 0 ? events.map(event => {
                    const hostName = event.organizations?.name || 'Unnamed Org';
                    const hostEmail = event.organizations?.email || '-';
                    const dateStr = new Date(event.created_at).toLocaleDateString();
                    return (
                      <tr key={event.id} style={{ borderBottom: `1px solid ${D.cardBorder}` }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ fontWeight: 700, color: D.text200, display: 'block' }}>{event.title}</span>
                          <span style={{ fontSize: '11px', color: D.text500 }}>slug: <code style={{ background: D.bg, padding: '2px 6px', borderRadius: '4px', color: D.amber, fontSize: '10px' }}>{event.slug}</code></span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ fontWeight: 500, color: D.text300, display: 'block' }}>{hostName}</span>
                          <span style={{ fontSize: '11px', color: D.text500 }}>{hostEmail}</span>
                        </td>
                        <td style={{ padding: '16px 24px', color: D.text400 }}>{dateStr}</td>
                        <td style={{ padding: '16px 24px' }}>
                          {event.is_paid ? (
                            <span style={{ background: 'rgba(16,185,129,0.1)', color: D.emerald, border: '1px solid rgba(16,185,129,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>Paid</span>
                          ) : (() => {
                            const pendingPayment = event.event_payments?.find(p => p.payment_method === 'cash_manual' && p.status === 'pending');
                            return pendingPayment ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ background: 'rgba(245,158,11,0.1)', color: D.amber, border: '1px solid rgba(245,158,11,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, width: 'fit-content' }}>Pending Cash</span>
                                <span style={{ fontSize: '10px', color: D.text400 }}>Ref: <code style={{ color: D.amber }}>{pendingPayment.reference_number}</code></span>
                                <span style={{ fontSize: '10px', color: D.text400 }}>Amt: ${(pendingPayment.amount_cents / 100).toFixed(2)}</span>
                              </div>
                            ) : (
                              <span style={{ background: 'rgba(244,63,94,0.1)', color: D.roseLight, border: '1px solid rgba(244,63,94,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>Unpaid</span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          {!event.is_paid && (
                            <button onClick={() => {
                              setSelectedEvent(event);
                              const pendingPayment = event.event_payments?.find(p => p.payment_method === 'cash_manual' && p.status === 'pending');
                              setApproveAmountCents(pendingPayment ? pendingPayment.amount_cents : 7900);
                              setShowApprovalModal(true);
                            }}
                              style={{ padding: '6px 14px', background: D.amberDark, fontSize: '11px', fontWeight: 700, borderRadius: '8px', color: D.white, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'background 0.2s' }}
                              onMouseEnter={e => e.currentTarget.style.background = D.amber}
                              onMouseLeave={e => e.currentTarget.style.background = D.amberDark}>
                              Approve Cash Payment
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: D.text500 }}>No events registered on the platform.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ ...cardStyle, padding: '24px', maxWidth: '640px' }}>
            <div style={{ borderBottom: `1px solid ${D.cardBorder}`, paddingBottom: '16px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: D.text100 }}>Platform Configuration Settings</h3>
              <p style={{ fontSize: '12px', color: D.text400, marginTop: '4px' }}>Configure pricing tiers, capacity limits, and SMS credit base markup rates.</p>
            </div>
            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: D.text400, fontWeight: 600, display: 'block', marginBottom: '6px' }}>SMS Base Rate (¢)</label>
                  <input type="number" value={smsRate} onChange={e => setSmsRate(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = D.amber} onBlur={e => e.target.style.borderColor = D.cardBorder} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: D.text400, fontWeight: 600, display: 'block', marginBottom: '6px' }}>SMS Markup (%)</label>
                  <input type="number" step="0.1" value={smsMarkupPercentage} onChange={e => setSmsMarkupPercentage(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = D.amber} onBlur={e => e.target.style.borderColor = D.cardBorder} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: D.text400, fontWeight: 600, display: 'block', marginBottom: '6px' }}>Platform Commission (%)</label>
                  <input type="number" step="0.1" value={platformCommissionPct} onChange={e => setPlatformCommissionPct(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = D.amber} onBlur={e => e.target.style.borderColor = D.cardBorder} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: D.text400, fontWeight: 700, display: 'block', borderBottom: `1px solid ${D.cardBorder}`, paddingBottom: '8px', marginBottom: '16px' }}>Configure Pricing License Tiers</label>
                {pricingTiers.length > 0 ? pricingTiers.map((tier, idx) => (
                  <div key={idx} style={{ background: D.bg, padding: '16px', border: `1px solid ${D.cardBorder}`, borderRadius: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    {[{ label: 'Tier Name', field: 'name', val: tier.name, type: 'text' }, { label: 'Price (cents)', field: 'price_cents', val: tier.price_cents, type: 'number' }, { label: 'Max Guest Limit', field: 'max_guests', val: tier.max_guests, type: 'number' }].map(f => (
                      <div key={f.field}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: D.text500, fontWeight: 700, display: 'block', marginBottom: '4px' }}>{f.label}</span>
                        <input type={f.type} value={f.val} onChange={e => handleTierChange(idx, f.field, e.target.value)}
                          style={{ ...inputStyle, background: D.card, fontSize: '12px', padding: '8px 10px' }}
                          onFocus={e => e.target.style.borderColor = D.amber} onBlur={e => e.target.style.borderColor = D.cardBorder} />
                      </div>
                    ))}
                  </div>
                )) : (
                  <p style={{ fontSize: '12px', color: D.text500, fontStyle: 'italic' }}>No pricing tiers defined. Check database seed setup.</p>
                )}
              </div>
              <button type="submit" disabled={savingConfig}
                style={{ padding: '10px 20px', background: D.amberDark, fontSize: '12px', fontWeight: 700, borderRadius: '8px', color: D.white, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', opacity: savingConfig ? 0.5 : 1, transition: 'background 0.2s', alignSelf: 'flex-start' }}
                onMouseEnter={e => e.currentTarget.style.background = D.amber}
                onMouseLeave={e => e.currentTarget.style.background = D.amberDark}>
                {savingConfig ? 'Saving Configurations...' : 'Save Config Updates'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Cash Approval Modal */}
      {showApprovalModal && selectedEvent && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(10,12,16,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ ...cardStyle, width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: D.text100, marginBottom: '8px' }}>Approve Offline Cash Payment</h3>
            <p style={{ fontSize: '12px', color: D.text400, lineHeight: 1.6, marginBottom: '20px' }}>Verify that you have received physical/offline cash payment from the event organizer before manual activation. This will bypass Stripe gates and activate the event URL page immediately.</p>
            <form onSubmit={handleApprovePayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: D.text500, fontWeight: 600, display: 'block' }}>Target Event:</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: D.text200, marginTop: '4px', display: 'block' }}>{selectedEvent.title}</span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: D.text500, fontWeight: 600, display: 'block' }}>Organizer:</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: D.text300, marginTop: '4px', display: 'block' }}>{selectedEvent.organizations?.name || 'Unnamed Org'}</span>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: D.text400, fontWeight: 600, display: 'block', marginBottom: '6px' }}>Approved Amount (cents)</label>
                <input type="number" required value={approveAmountCents} onChange={e => setApproveAmountCents(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = D.amber} onBlur={e => e.target.style.borderColor = D.cardBorder} />
                <span style={{ fontSize: '10px', color: D.text500, marginTop: '4px', display: 'block' }}>Enter cash received in cents (e.g. 7900 cents = $79.00 USD).</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
                <button type="button" onClick={() => { setShowApprovalModal(false); setSelectedEvent(null); }}
                  style={{ padding: '8px 16px', background: D.cardBorder, border: `1px solid ${D.borderLight}`, borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: D.text300, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={submittingApproval}
                  style={{ padding: '8px 16px', background: D.amberDark, borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: D.white, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', opacity: submittingApproval ? 0.5 : 1 }}>
                  {submittingApproval ? 'Processing Approval...' : 'Approve & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Overlay */}
      {showReceiptOverlay && receiptData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(10,12,16,0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: D.card, border: `2px double rgba(245,158,11,0.4)`, width: '100%', maxWidth: '440px', borderRadius: '20px', padding: '32px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20%', left: '-20%', width: '192px', height: '192px', background: 'rgba(245,158,11,0.05)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-20%', right: '-20%', width: '192px', height: '192px', background: 'rgba(245,158,11,0.05)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />

            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #b45309)', boxShadow: '0 0 20px rgba(217,119,6,0.3)', border: '1px solid #fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <svg style={{ width: '32px', height: '32px', color: '#1c1917' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.25em', color: D.amber, fontWeight: 700, display: 'block' }}>license activation</span>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: D.text100, marginTop: '4px' }}>Event Activated!</h2>
              <p style={{ fontSize: '12px', color: D.text400, marginTop: '4px' }}>Offline payment approved and verified by Super Admin.</p>
            </div>

            <div style={{ background: D.bg, padding: '20px', borderRadius: '16px', border: `1px solid ${D.cardBorder}`, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', paddingBottom: '10px', borderBottom: `1px solid ${D.cardBorder}`, marginBottom: '14px' }}>
                <span style={{ color: D.text500, fontWeight: 500 }}>Receipt ID:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: D.amber, fontWeight: 700 }}>{receiptData.transactionId}</span>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.text500, fontWeight: 700, display: 'block' }}>Activated Event</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: D.text200, marginTop: '4px', display: 'block' }}>{receiptData.eventTitle}</span>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.text500, fontWeight: 700, display: 'block' }}>Organization</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: D.text300, marginTop: '4px', display: 'block' }}>{receiptData.orgName}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '10px', borderTop: `1px solid ${D.cardBorder}` }}>
                <div>
                  <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.text500, fontWeight: 700, display: 'block' }}>Amount Received</span>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: D.amber, marginTop: '4px', display: 'block' }}>${(receiptData.amountCents / 100).toFixed(2)} USD</span>
                </div>
                <div>
                  <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.text500, fontWeight: 700, display: 'block' }}>Approval Date</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: D.text300, marginTop: '4px', display: 'block' }}>{receiptData.activationDate}</span>
                </div>
              </div>
            </div>

            <button onClick={() => { setShowReceiptOverlay(false); setReceiptData(null); }}
              style={{ width: '100%', padding: '14px', background: `linear-gradient(135deg, #fbbf24, ${D.amber}, ${D.amberDark})`, color: '#1c1917', borderRadius: '12px', fontWeight: 700, letterSpacing: '0.04em', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '13px', boxShadow: '0 4px 16px rgba(245,158,11,0.25)', transition: 'all 0.2s' }}>
              Verify & Close Receipt
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .admin-kpi-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .admin-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
