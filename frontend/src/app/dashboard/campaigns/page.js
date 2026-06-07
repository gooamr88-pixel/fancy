'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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

  const eventId = 'demo-event';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  // Load campaign wallet, ledger, and calculate targets
  const loadCampaignData = async () => {
    try {
      // 1. Fetch wallet and history
      const historyRes = await fetch(`${apiUrl}/events/${eventId}/campaigns/history`);
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
      const rsvpsRes = await fetch(`${apiUrl}/events/${eventId}/rsvps`);
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
  };

  useEffect(() => {
    loadCampaignData();
  }, []);

  // Handle campaign dispatch API call
  const handleLaunchCampaign = async (e) => {
    e.preventDefault();
    if (recipientCount > creditsRemaining) {
      alert(`Insufficient credits. You need ${recipientCount} credits, but only have ${creditsRemaining} remaining.`);
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/campaigns/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          <button className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm hover:bg-slate-700 transition">
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
              <span className="text-xs uppercase text-slate-450 font-bold block">Remaining Balance</span>
              <span className="text-2xl font-black block mt-1.5 text-amber-400">{creditsRemaining} Credits</span>
            </div>
          </div>

          {/* 2. Composer */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold">Compose Invitation Template</h3>
            
            <form onSubmit={handleLaunchCampaign} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold block">Message Body</label>
                <textarea
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
                <span className="text-[10px] text-slate-550 block leading-relaxed mt-1">
                  Supported dynamic tags: <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-500 font-mono">{`{name}`}</code> for guest name, <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-500 font-mono">{`{url}`}</code> for direct unique guest RSVP invitation links.
                </span>
              </div>

              {recipientCount > 0 ? (
                <div className="bg-slate-950/50 p-4 border border-slate-850 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Target Recipients (Pending RSVPs with Phone):</span>
                    <span className="font-bold text-slate-200">{recipientCount} Guests</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t border-slate-850/40 pt-2">
                    <span className="text-slate-400">Total Credits Required:</span>
                    <span className="font-bold text-amber-400">{recipientCount} Credits</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/30 p-4 border border-slate-850 rounded-xl text-center">
                  <p className="text-xs text-slate-500">All pending guest lists have already been notified. No pending SMS targets left.</p>
                </div>
              )}

              {recipientCount > 0 && (
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3 bg-amber-600 font-bold rounded-xl text-sm hover:bg-amber-500 transition disabled:opacity-50 shadow-lg shadow-amber-950/10"
                >
                  {sending ? 'Dispatching campaign...' : `Launch SMS Campaign to ${recipientCount} Guests`}
                </button>
              )}
            </form>

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

    </div>
  );
}
