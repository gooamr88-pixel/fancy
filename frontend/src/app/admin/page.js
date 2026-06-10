'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('events'); // 'events' | 'config'

  // Modal State for Cash Approval
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [approveAmountCents, setApproveAmountCents] = useState(7900);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Cash activation receipt states
  const [showReceiptOverlay, setShowReceiptOverlay] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Form states for Config Edit
  const [smsRate, setSmsRate] = useState(8);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);

  const [token, setToken] = useState('');
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('org_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('active_event_id');
    window.location.href = '/login';
  };

  // Auth check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('auth_token');
      const userRole = localStorage.getItem('user_role');
      if (!savedToken) {
        router.push('/login');
        return;
      }
      if (userRole !== 'super_admin') {
        router.push('/dashboard');
        return;
      }
      setToken(savedToken);
    }
  }, [router]);

  const loadAdminData = useCallback(async () => {
    if (!token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Fetch Admin Events
      const eventsRes = await fetch(`${apiUrl}/admin/events`, { headers });
      const eventsData = await eventsRes.json();
      if (eventsData.success) {
        setEvents(eventsData.events);
      }

      // 2. Fetch Pricing Config
      const configRes = await fetch(`${apiUrl}/admin/pricing`, { headers });
      const configData = await configRes.json();
      if (configData.success && configData.config) {
        setPricingConfig(configData.config);
        setSmsRate(configData.config.sms_rate_cents_per_credit || 8);
        setPricingTiers(configData.config.pricing_tiers || []);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
      setError('Could not connect to the administration API. Verify port 5000 is running.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    if (token) {
      loadAdminData();
    }
  }, [token, loadAdminData]);

  // Handle manual cash approval
  const handleApprovePayment = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setSubmittingApproval(true);
    try {
      const res = await fetch(`${apiUrl}/admin/manual-approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          amountCents: parseInt(approveAmountCents)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Manual cash approval failed.');
      }

      if (data.success) {
        setShowApprovalModal(false);
        setReceiptData({
          eventTitle: selectedEvent.title,
          orgName: selectedEvent.organizations?.name || 'Unnamed Org',
          amountCents: parseInt(approveAmountCents),
          activationDate: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
          transactionId: `TXN-ACTIV-${Math.random().toString(36).substring(2, 11).toUpperCase()}`
        });
        setSelectedEvent(null);
        setShowReceiptOverlay(true);
        loadAdminData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Handle platform configuration update
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch(`${apiUrl}/admin/pricing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pricingTiers,
          smsRateCentsPerCredit: parseInt(smsRate)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Config update failed.');
      }

      if (data.success) {
        alert('Pricing and SMS configurations updated successfully.');
        loadAdminData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTierChange = (index, field, value) => {
    const updated = [...pricingTiers];
    updated[index] = {
      ...updated[index],
      [field]: field === 'name' ? value : parseInt(value) || 0
    };
    setPricingTiers(updated);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Opening administrator console...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
          <span className="text-4xl">🔑</span>
          <h2 className="text-xl font-bold mt-4 text-rose-500">Security / Connection Error</h2>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">{error}</p>
          <button 
            onClick={() => { setLoading(true); loadAdminData(); }} 
            className="mt-6 px-5 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs rounded-lg font-bold"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const unpaidEventsCount = events.filter(e => !e.is_paid).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      
      {/* ─── Header ─── */}
      <div className="max-w-7xl mx-auto border-b border-slate-900 pb-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <span className="text-amber-500 uppercase tracking-widest text-xs font-bold">Platform Supervisor Deck</span>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Super Admin Controls</h1>
        </div>

        <div className="mt-4 md:mt-0 flex gap-3">
          <Link href="/dashboard" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold hover:bg-slate-700 transition cursor-pointer text-slate-200">
            Go to Organizer Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
            title="Sign out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* ─── KPI Metrics Cards ─── */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <span className="text-xs uppercase text-slate-400 font-bold block">Total Hosted Events</span>
          <span className="text-2xl font-black block mt-2 text-slate-100">{events.length} Events</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <span className="text-xs uppercase text-slate-400 font-bold block">Unpaid / Inactive</span>
          <span className="text-2xl font-black block mt-2 text-rose-455">{unpaidEventsCount} Pending</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <span className="text-xs uppercase text-slate-400 font-bold block">Base SMS Cost</span>
          <span className="text-2xl font-black block mt-2 text-amber-550">{smsRate}¢ per credit</span>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="max-w-7xl mx-auto flex border-b border-slate-900 gap-6 mb-8">
        <button
          onClick={() => setActiveTab('events')}
          className={`pb-3 text-xs font-extrabold uppercase tracking-widest transition-all border-b-2 cursor-pointer ${activeTab === 'events' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-350'}`}
        >
          Event Ledger
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 text-xs font-extrabold uppercase tracking-widest transition-all border-b-2 cursor-pointer ${activeTab === 'config' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-350'}`}
        >
          Pricing Configurator
        </button>
      </div>

      <div className="max-w-7xl mx-auto">
        {activeTab === 'events' ? (
          /* ─── Events Ledger Table ─── */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-base font-bold">Event Registration Ledger</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Event Details</th>
                    <th className="px-6 py-4">Organizer Account</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4">License State</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {events.length > 0 ? (
                    events.map(event => {
                      const hostName = event.organizations?.name || 'Unnamed Org';
                      const hostEmail = event.organizations?.email || '-';
                      const dateStr = new Date(event.created_at).toLocaleDateString();
                      
                      return (
                        <tr key={event.id} className="hover:bg-slate-850/30">
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-200 block">{event.title}</span>
                            <span className="text-xs text-slate-455">slug: <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-500">{event.slug}</code></span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-300 block">{hostName}</span>
                            <span className="text-xs text-slate-500">{hostEmail}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {dateStr}
                          </td>
                          <td className="px-6 py-4">
                            {event.is_paid ? (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-bold">Paid</span>
                            ) : (
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full text-xs font-bold animate-pulse">Unpaid</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {!event.is_paid && (
                              <button
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setShowApprovalModal(true);
                                }}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-bold rounded-lg text-white cursor-pointer transition"
                              >
                                Approve Cash Payment
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-12 text-slate-500">No events registered on the platform.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ─── Platform Config Editor ─── */
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold">Platform Configuration Settings</h3>
              <p className="text-xs text-slate-400 mt-1">Configure pricing tiers, capacity limits, and SMS credit base markup rates.</p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-6">
              {/* SMS Cost Rate */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold block">SMS Base Rate (cents per credit)</label>
                <input
                  type="number"
                  value={smsRate}
                  onChange={e => setSmsRate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Pricing Tiers list */}
              <div className="space-y-4">
                <label className="text-xs text-slate-400 font-bold block border-b border-slate-800 pb-1.5">Configure Pricing License Tiers</label>
                {pricingTiers.length > 0 ? (
                  pricingTiers.map((tier, idx) => (
                    <div key={idx} className="bg-slate-950 p-4 border border-slate-850 rounded-xl grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Tier Name</span>
                        <input
                          type="text"
                          value={tier.name}
                          onChange={e => handleTierChange(idx, 'name', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Price (cents)</span>
                        <input
                          type="number"
                          value={tier.price_cents}
                          onChange={e => handleTierChange(idx, 'price_cents', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Max Guest Limit</span>
                        <input
                          type="number"
                          value={tier.max_guests}
                          onChange={e => handleTierChange(idx, 'max_guests', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No pricing tiers defined. Check database seed setup.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-xs font-bold rounded-lg cursor-pointer text-white disabled:opacity-50 transition"
              >
                {savingConfig ? 'Saving Configurations...' : 'Save Config Updates'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Manual Cash Approval Modal overlay */}
      {showApprovalModal && selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Approve Offline Cash Payment</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Verify that you have received physical/offline cash payment from the event organizer before manual activation. This will bypass Stripe gates and activate the event URL page immediately.
            </p>
            
            <form onSubmit={handleApprovePayment} className="space-y-4">
              <div>
                <span className="text-xs text-slate-455 font-semibold block">Target Event:</span>
                <span className="text-sm font-bold text-slate-200 mt-1 block">{selectedEvent.title}</span>
              </div>

              <div>
                <span className="text-xs text-slate-455 font-semibold block">Organizer:</span>
                <span className="text-xs font-medium text-slate-350 block mt-1">{selectedEvent.organizations?.name || 'Unnamed Org'}</span>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Approved Amount (cents)</label>
                <input
                  type="number"
                  required
                  value={approveAmountCents}
                  onChange={e => setApproveAmountCents(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 bg-background text-foreground"
                />
                <span className="text-[10px] text-slate-550 block mt-1">Enter cash received in cents (e.g. 7900 cents = $79.00 USD).</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowApprovalModal(false);
                    setSelectedEvent(null);
                  }}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs font-bold rounded-lg transition cursor-pointer text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApproval}
                  className="px-4 py-2 bg-amber-600 text-xs font-bold rounded-lg hover:bg-amber-500 transition cursor-pointer text-white disabled:opacity-50"
                >
                  {submittingApproval ? 'Processing Approval...' : 'Approve & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Gold Receipt Activation Overlay ─── */}
      {showReceiptOverlay && receiptData && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-slate-900 border-2 border-double border-amber-500/50 w-full max-w-md rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6 text-center select-text">
            
            <div className="absolute top-[-20%] left-[-20%] w-48 h-48 bg-amber-500/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-48 h-48 bg-amber-500/5 rounded-full filter blur-3xl pointer-events-none" />

            {/* Glowing Amber Seal */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_20px_rgba(217,119,6,0.3)] border border-amber-300 flex items-center justify-center mx-auto text-amber-905 font-extrabold animate-ring-pulse">
              <svg className="w-8 h-8 text-amber-950 animate-draw-check animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.25em] text-amber-500 font-bold block">license activation</span>
              <h2 className="text-xl font-bold text-slate-100">Event Activated!</h2>
              <p className="text-xs text-slate-400">Offline payment approved and verified by Super Admin.</p>
            </div>

            {/* Receipt Details Card */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 text-left space-y-3.5 relative">
              <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-850/50">
                <span className="text-slate-500 font-medium">Receipt ID:</span>
                <span className="font-mono text-[10px] text-amber-500 font-bold">{receiptData.transactionId}</span>
              </div>
              
              <div className="space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider text-slate-550 block font-bold">Activated Event</span>
                <span className="text-sm font-bold text-slate-200 block">{receiptData.eventTitle}</span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider text-slate-550 block font-bold">Organization</span>
                <span className="text-xs text-slate-350 block font-semibold">{receiptData.orgName}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2.5 border-t border-slate-850/50">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-550 block font-bold">Amount Received</span>
                  <span className="text-sm font-black text-amber-500 block mt-0.5">${(receiptData.amountCents / 100).toFixed(2)} USD</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-550 block font-bold">Approval Date</span>
                  <span className="text-xs text-slate-300 block mt-1 font-semibold">{receiptData.activationDate}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowReceiptOverlay(false);
                setReceiptData(null);
              }}
              className="w-full py-3 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 rounded-xl font-bold tracking-wide transition shadow-lg active:scale-98 cursor-pointer mt-2"
            >
              Verify & Close Receipt
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
