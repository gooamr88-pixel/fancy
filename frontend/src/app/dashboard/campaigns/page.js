'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creditsPurchased, setCreditsPurchased] = useState(0);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const creditsRemaining = creditsPurchased - creditsUsed;

  const [ledger, setLedger] = useState([]);

  const [messageTemplate, setMessageTemplate] = useState('Hello {name}, you are cordially invited to Sophia & Julian\'s Wedding Gala on Oct 24th. Kindly RSVP at: {url}');
  const [recipientCount, setRecipientCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [campaignReport, setCampaignReport] = useState(null);

  const [showSMSModal, setShowSMSModal] = useState(false);
  const [smsCreditsToBuy, setSmsCreditsToBuy] = useState(100);
  const [buyingCredits, setBuyingCredits] = useState(false);

  const [token, setToken] = useState('');
  const [eventId, setEventId] = useState('');
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const handleBuySMSCredits = async (e) => {
    e.preventDefault();
    if (smsCreditsToBuy < 50) {
      alert('Minimum credit purchase count is 50.');
      return;
    }
    setBuyingCredits(true);
    try {
      const res = await fetch(`${apiUrl}/payments/sms-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          eventId,
          creditCount: parseInt(smsCreditsToBuy)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to initiate purchase.');
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned from the server.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setBuyingCredits(false);
    }
  };

  // Auth and event initializer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('auth_token');
      if (!savedToken) {
        router.push('/login');
        return;
      }
      setTimeout(() => {
        setToken(savedToken);
        const savedEventId = localStorage.getItem('active_event_id') || 'demo-event';
        setEventId(savedEventId);
      }, 0);
    }
  }, [router]);

  // Load campaign wallet, ledger, and calculate targets
  const loadCampaignData = useCallback(async () => {
    if (!eventId) return;
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      // 1. Fetch wallet and history
      const historyRes = await fetch(`${apiUrl}/events/${eventId}/campaigns/history`, { headers });
      const historyData = await historyRes.json();
      if (historyData.success) {
        setCreditsPurchased(historyData.wallet.credits_purchased || 0);
        setCreditsUsed(historyData.wallet.credits_used || 0);
        
        // Format ledger timestamps
        const formattedLedger = (historyData.history || []).map(item => ({
          id: item.id,
          type: item.transaction_type,
          credits: item.credits,
          timestamp: new Date(item.created_at).toLocaleString(),
          description: item.transaction_type === 'purchase' 
            ? 'Credit bundle purchase via Stripe' 
            : `Bulk SMS sent to ${item.sms_recipient || 'guest'}`
        }));
        setLedger(formattedLedger);
      }

      // 2. Fetch RSVPs to calculate pending counts
      const rsvpsRes = await fetch(`${apiUrl}/events/${eventId}/rsvps`, { headers });
      const rsvpsData = await rsvpsRes.json();
      if (rsvpsData.success) {
        // Calculate number of guests who are response === 'pending' and have a phone number
        const pendingWithPhone = rsvpsData.rsvps.filter(r => r.response === 'pending' && r.phone);
        setRecipientCount(pendingWithPhone.length);
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to load campaign data:', err);
      setError('Could not connect to SMS server. Make sure the backend server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, eventId, token]);

  useEffect(() => {
    if (!eventId) return;
    setTimeout(() => {
      loadCampaignData();
    }, 0);
  }, [loadCampaignData, eventId]);

  // Handle campaign dispatch API call
  const handleLaunchCampaign = async (e) => {
    e.preventDefault();
    if (!eventId) return;
    if (recipientCount > creditsRemaining) {
      alert(`Insufficient credits. You need ${recipientCount} credits, but only have ${creditsRemaining} remaining.`);
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/campaigns/send-sms`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ messageTemplate })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send campaign');
      }

      if (data.success) {
        setCampaignReport({
          success: true,
          sent: data.sentCount,
          failed: data.failedCount,
          message: data.message
        });
        
        // Reload layout
        await loadCampaignData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Loading campaign dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
          <span className="text-4xl">🔌</span>
          <h2 className="text-xl font-bold mt-4 text-rose-500">Backend Connection Error</h2>
          <p className="text-slate-455 mt-2 text-sm leading-relaxed">{error}</p>
          <button 
            onClick={() => { setLoading(true); loadCampaignData(); }} 
            className="mt-6 px-5 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs rounded-lg font-bold"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      
      {/* ─── Header ─── */}
      <div className="max-w-7xl mx-auto border-b border-slate-900 pb-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-amber-500 text-sm hover:underline">← Back to List</Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs uppercase text-slate-500 font-bold">SMS Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">SMS Campaign Manager</h1>
        </div>

        <div className="mt-4 md:mt-0 flex gap-3">
          <button 
            onClick={() => setShowSMSModal(true)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm hover:bg-slate-700 transition cursor-pointer text-slate-200"
          >
            Buy SMS Credits
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle Column: Template Composer & Campaign launcher */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Wallet Status Widget */}
          <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl grid grid-cols-3 gap-6 text-center">
            <div>
              <span className="text-xs uppercase text-slate-400 font-bold block">Purchased</span>
              <span className="text-xl font-black block mt-2 text-slate-200">{creditsPurchased}</span>
            </div>
            <div>
              <span className="text-xs uppercase text-slate-400 font-bold block">Consumed</span>
              <span className="text-xl font-black block mt-2 text-slate-350">{creditsUsed}</span>
            </div>
            <div className="border-l border-slate-800">
              <span className="text-xs uppercase text-slate-455 font-bold block">Remaining Balance</span>
              <span className="text-2xl font-black block mt-1.5 text-amber-400">{creditsRemaining} Credits</span>
            </div>
          </div>

          {/* 2. Composer */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
            <h3 className="text-lg font-bold border-b border-slate-800 pb-3">Campaign Composer & Live Mobile Preview</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              
              {/* Form Block (Col span 7) */}
              <form onSubmit={handleLaunchCampaign} className="md:col-span-7 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold block">Message Body</label>
                  <textarea
                    value={messageTemplate}
                    onChange={e => setMessageTemplate(e.target.value)}
                    rows={5}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed bg-background text-foreground"
                    placeholder="Enter invitation message..."
                  />
                  <span className="text-[10px] text-slate-500 block leading-relaxed mt-1">
                    Supported dynamic tags: <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-500 font-mono">{`{name}`}</code> for guest name, <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-500 font-mono">{`{url}`}</code> for direct unique guest RSVP invitation links.
                  </span>
                </div>

                {recipientCount > 0 ? (
                  <div className="bg-slate-950/50 p-4 border border-slate-850 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-semibold">Target Recipients:</span>
                      <span className="font-bold text-slate-200">{recipientCount} pending guests</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-slate-850/40 pt-2.5 font-bold">
                      <span className="text-slate-400">Total Credits Required:</span>
                      <span className="text-amber-500">{recipientCount} Credits</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/30 p-4 border border-slate-850 rounded-xl text-center">
                    <p className="text-xs text-slate-550">All pending guest lists have already been notified. No pending SMS targets left.</p>
                  </div>
                )}

                {recipientCount > 0 && (
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full py-3 bg-amber-600 font-bold rounded-xl text-sm hover:bg-amber-500 transition disabled:opacity-50 shadow-lg active:scale-98 cursor-pointer text-white"
                  >
                    {sending ? 'Dispatching campaign...' : `Launch SMS Campaign to ${recipientCount} Guests`}
                  </button>
                )}
              </form>

              {/* Smartphone Mockup Preview Block (Col span 5) */}
              <div className="md:col-span-5 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-550 font-bold mb-3">Live SMS Preview</span>
                
                {/* Smartphone Shell */}
                <div className="w-[220px] aspect-[9/18] rounded-[2.2rem] border-[8px] border-zinc-800 bg-slate-900 shadow-xl relative overflow-hidden flex flex-col p-2 select-none">
                  {/* Top Notch speaker */}
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-14 h-3 bg-zinc-800 rounded-full flex items-center justify-center z-20">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 absolute left-2"></div>
                  </div>

                  {/* Screen Content */}
                  <div className="w-full h-full bg-[#ebebeb] dark:bg-zinc-950 rounded-[1.6rem] overflow-hidden flex flex-col justify-between pt-5 text-zinc-900 dark:text-slate-100 relative">
                    
                    {/* Mock SMS App Header */}
                    <div className="bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200/50 dark:border-zinc-800/40 py-1.5 px-3 flex items-center gap-1.5 text-left">
                      <div className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center text-[9px] font-black text-amber-100">
                        F
                      </div>
                      <div className="flex flex-col text-[7.5px] leading-none">
                        <span className="font-bold">Fancy RSVP</span>
                        <span className="text-[5.5px] text-slate-500 mt-0.5">iMessage / SMS</span>
                      </div>
                    </div>

                    {/* Chat Messages Body */}
                    <div className="flex-1 p-2 space-y-3 overflow-y-auto no-scrollbar flex flex-col justify-start">
                      
                      {/* Incoming text message bubble */}
                      <div className="flex flex-col gap-1 items-start text-left max-w-[85%] self-start">
                        <div className="bg-[#e9e9eb] dark:bg-zinc-850 p-2.5 rounded-2xl rounded-bl-sm text-[8.5px] leading-relaxed text-zinc-855 dark:text-zinc-200 shadow-sm border border-zinc-200/30 dark:border-zinc-805/20 whitespace-pre-wrap break-words">
                          {messageTemplate
                            .replaceAll('{name}', 'Alexander')
                            .replaceAll('{url}', 'fancyrsvp.com/s/e5x2')
                          }
                        </div>
                        <span className="text-[5.5px] text-slate-500 px-1 font-semibold">Today 10:24 AM</span>
                      </div>

                    </div>

                    {/* Chat footer input bar */}
                    <div className="bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200/50 dark:border-zinc-850 py-1.5 px-2 flex items-center justify-between gap-1.5">
                      <div className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-300/40 dark:border-zinc-800 rounded-full px-2 py-0.5 text-[6px] text-zinc-400 text-left">
                        iMessage
                      </div>
                      <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                        <svg className="w-2.5 h-2.5 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>

            {campaignReport && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-sm">
                <strong>🟢 Campaign Dispatched:</strong> {campaignReport.message}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Transaction Logs Ledger */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col h-[460px] overflow-hidden">
          <h3 className="text-base font-bold border-b border-slate-800 pb-3 mb-4">Transaction History</h3>
          
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {ledger.map(row => {
              const isPurchase = row.type === 'purchase';
              return (
                <div key={row.id} className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-200 block max-w-[170px] truncate" title={row.description}>
                      {row.description}
                    </span>
                    <span className="text-[10px] text-slate-550 block">{row.timestamp}</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-bold text-sm block ${isPurchase ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {isPurchase ? `+${row.credits}` : row.credits}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest block mt-0.5">Credits</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Purchase SMS Credits Modal Overlay */}
      {showSMSModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Purchase SMS Credits</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              SMS credits are used to send bulk mobile invitations to your guests. Volume discount of 12.5% is automatically applied on packages of 500 credits or more.
            </p>
            <form onSubmit={handleBuySMSCredits} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Number of Credits</label>
                <input
                  type="number"
                  min="50"
                  required
                  value={smsCreditsToBuy}
                  onChange={e => setSmsCreditsToBuy(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 bg-background text-foreground"
                />
                <span className="text-[10px] text-slate-550 block mt-1">Minimum purchase of 50 credits.</span>
              </div>
              
              <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-450">Price Per Credit:</span>
                  <span className="font-semibold text-slate-200">8¢</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-455">Subtotal:</span>
                  <span className="font-semibold text-slate-200">${((smsCreditsToBuy * 8) / 100).toFixed(2)} USD</span>
                </div>
                {smsCreditsToBuy >= 500 && (
                  <div className="flex justify-between items-center text-xs text-emerald-400">
                    <span>Volume Discount (12.5%):</span>
                    <span>-${(((smsCreditsToBuy * 8) / 100) * 0.125).toFixed(2)} USD</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm border-t border-slate-850 pt-2 font-bold text-amber-500">
                  <span>Total Amount:</span>
                  <span>
                    ${(
                      smsCreditsToBuy >= 500
                        ? ((smsCreditsToBuy * 8) / 100) * 0.875
                        : (smsCreditsToBuy * 8) / 100
                    ).toFixed(2)}{' '}
                    USD
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSMSModal(false)}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs font-bold rounded-lg transition cursor-pointer text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={buyingCredits}
                  className="px-4 py-2 bg-amber-600 text-xs font-bold rounded-lg hover:bg-amber-500 transition cursor-pointer text-white disabled:opacity-50"
                >
                  {buyingCredits ? 'Connecting to Stripe...' : 'Proceed to Checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
