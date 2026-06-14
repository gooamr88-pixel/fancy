'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../../utils/apiClient';

const C = { gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC', champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8', error: '#C45E5E', success: '#3B9B6D' };

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
  const [smsRateCents, setSmsRateCents] = useState(8);

  const [authChecked, setAuthChecked] = useState(false);
  const [eventId, setEventId] = useState('');
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const handleLogout = logout;

  const handleBuySMSCredits = async (e) => {
    e.preventDefault();
    if (smsCreditsToBuy < 50) {
      alert('Minimum credit purchase count is 50.');
      return;
    }
    setBuyingCredits(true);
    try {
      const res = await fetch(`${apiUrl}/payments/events/${eventId}/sms-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
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
      const orgId = localStorage.getItem('org_id');
      if (!orgId) {
        router.push('/login');
        return;
      }
      const savedEventId = localStorage.getItem('active_event_id') || 'demo-event';
      setEventId(savedEventId);
      setAuthChecked(true);
    }
  }, [router]);

  // Load campaign wallet, ledger, and calculate targets
  const loadCampaignData = useCallback(async () => {
    if (!eventId) return;
    try {

      // 1. Fetch wallet and history
      const historyRes = await fetch(`${apiUrl}/events/${eventId}/campaigns/history`, { credentials: 'include' });
      const historyData = await historyRes.json();
      if (historyData.success) {
        setCreditsPurchased(historyData.wallet.credits_purchased || 0);
        setCreditsUsed(historyData.wallet.credits_used || 0);
        if (historyData.smsRateCents !== undefined) {
          setSmsRateCents(historyData.smsRateCents);
        }
        
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
      const rsvpsRes = await fetch(`${apiUrl}/events/${eventId}/rsvps`, { credentials: 'include' });
      const rsvpsData = await rsvpsRes.json();
      if (rsvpsData.success) {
        // Calculate number of guests who are response === 'pending' and have a phone number
        const pendingWithPhone = rsvpsData.rsvps.filter(r => r.response === 'pending' && r.phone);
        setRecipientCount(pendingWithPhone.length);
      }
      
      setError(null);
    } catch (err) {
      // Campaign data loading failed
      setError('Could not connect to SMS server. Make sure the backend server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, eventId]);

  useEffect(() => {
    if (!eventId) return;
    loadCampaignData();
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
          'Content-Type': 'application/json'
        },
        credentials: 'include',
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
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, border: `4px solid ${C.border}`, borderTop: `4px solid ${C.gold}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: C.stone, fontWeight: 500, fontFamily: 'var(--font-sans)', fontSize: 14 }}>Loading campaign dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ maxWidth: 440, width: '100%', textAlign: 'center', background: C.white, border: `1px solid ${C.border}`, padding: 32, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: 40 }}>🔌</span>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 16, color: C.error, fontFamily: 'var(--font-serif)' }}>Backend Connection Error</h2>
          <p style={{ color: C.stone, marginTop: 8, fontSize: 13, lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>{error}</p>
          <button 
            onClick={() => { setLoading(true); loadCampaignData(); }} 
            style={{ marginTop: 24, padding: '8px 20px', background: 'transparent', border: `1px solid ${C.border}`, color: C.gold, fontSize: 12, borderRadius: 8, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}
            onMouseEnter={e => { e.currentTarget.style.background = C.softBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.ivory, color: C.charcoal, padding: 32, fontFamily: 'var(--font-sans)' }}>
      
      {/* ─── Header ─── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', borderBottom: `1px solid ${C.border}`, paddingBottom: 24, marginBottom: 32, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/dashboard" style={{ color: C.gold, fontSize: 13, textDecoration: 'none', fontFamily: 'var(--font-sans)' }}
              onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
            >← Back to List</Link>
            <span style={{ color: C.border }}>/</span>
            <span style={{ fontSize: 10, textTransform: 'uppercase', color: C.stone, fontWeight: 700, letterSpacing: '0.1em' }}>SMS Engine</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 4, fontFamily: 'var(--font-serif)', color: C.charcoal }}>SMS Campaign Manager</h1>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={() => setShowSMSModal(true)}
            style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', color: C.gold, fontFamily: 'var(--font-sans)' }}
            onMouseEnter={e => { e.currentTarget.style.background = C.softBg; e.currentTarget.style.borderColor = C.gold; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.border; }}
          >
            Buy SMS Credits
          </button>
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: C.stone, background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}
            onMouseEnter={e => { e.currentTarget.style.color = C.error; e.currentTarget.style.background = 'rgba(196,94,94,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.stone; e.currentTarget.style.background = 'transparent'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: 32 }}>
        
        {/* Left/Middle Column: Template Composer & Campaign launcher */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* 1. Wallet Status Widget */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: 24, borderRadius: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: 10, textTransform: 'uppercase', color: C.stone, fontWeight: 700, display: 'block', letterSpacing: '0.1em' }}>Purchased</span>
              <span style={{ fontSize: 20, fontWeight: 900, display: 'block', marginTop: 8, color: C.charcoal }}>{creditsPurchased}</span>
            </div>
            <div>
              <span style={{ fontSize: 10, textTransform: 'uppercase', color: C.stone, fontWeight: 700, display: 'block', letterSpacing: '0.1em' }}>Consumed</span>
              <span style={{ fontSize: 20, fontWeight: 900, display: 'block', marginTop: 8, color: C.stone }}>{creditsUsed}</span>
            </div>
            <div style={{ borderLeft: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', color: C.stone, fontWeight: 700, display: 'block', letterSpacing: '0.1em' }}>Remaining Balance</span>
              <span style={{ fontSize: 22, fontWeight: 900, display: 'block', marginTop: 6, color: C.gold }}>{creditsRemaining} Credits</span>
            </div>
          </div>

          {/* 2. Composer */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: 24, borderRadius: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, borderBottom: `1px solid ${C.border}`, paddingBottom: 12, fontFamily: 'var(--font-serif)', color: C.charcoal }}>Campaign Composer & Live Mobile Preview</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 32, alignItems: 'start', marginTop: 24 }}>
              
              {/* Form Block */}
              <form onSubmit={handleLaunchCampaign} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, color: C.stone, fontWeight: 600, display: 'block' }}>Message Body</label>
                  <textarea
                    value={messageTemplate}
                    onChange={e => setMessageTemplate(e.target.value)}
                    rows={5}
                    style={{ width: '100%', background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: C.charcoal, outline: 'none', lineHeight: 1.7, fontFamily: 'var(--font-sans)', resize: 'vertical', boxSizing: 'border-box' }}
                    placeholder="Enter invitation message..."
                    onFocus={e => { e.currentTarget.style.borderColor = C.gold; }}
                    onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
                  />
                  <span style={{ fontSize: 10, color: C.stone, display: 'block', lineHeight: 1.7, marginTop: 2 }}>
                    Supported dynamic tags: <code style={{ background: C.softBg, padding: '2px 4px', borderRadius: 3, color: C.gold, fontFamily: 'monospace', fontSize: 10 }}>{`{name}`}</code> for guest name, <code style={{ background: C.softBg, padding: '2px 4px', borderRadius: 3, color: C.gold, fontFamily: 'monospace', fontSize: 10 }}>{`{url}`}</code> for direct unique guest RSVP invitation links.
                  </span>
                </div>

                {recipientCount > 0 ? (
                  <div style={{ background: C.softBg, padding: 16, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: C.stone, fontWeight: 600 }}>Target Recipients:</span>
                      <span style={{ fontWeight: 700, color: C.charcoal }}>{recipientCount} pending guests</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 10, fontWeight: 700 }}>
                      <span style={{ color: C.stone }}>Total Credits Required:</span>
                      <span style={{ color: C.gold }}>{recipientCount} Credits</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: C.softBg, padding: 16, border: `1px solid ${C.border}`, borderRadius: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: C.stone }}>All pending guest lists have already been notified. No pending SMS targets left.</p>
                  </div>
                )}

                {recipientCount > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, color: C.stone, textAlign: 'center', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                      Estimated Cost: <strong style={{ color: C.gold }}>${((recipientCount * smsRateCents) / 100).toFixed(2)} USD</strong> ({smsRateCents}¢/SMS)
                    </div>
                    <button
                      type="submit"
                      disabled={sending}
                      style={{ width: '100%', padding: '12px 0', background: C.gold, fontWeight: 700, borderRadius: 8, fontSize: 12, border: 'none', cursor: 'pointer', transition: 'all 0.2s', color: C.white, opacity: sending ? 0.5 : 1, boxShadow: '0 2px 8px rgba(184,148,79,0.25)', fontFamily: 'var(--font-sans)' }}
                      onMouseEnter={e => { if (!sending) e.currentTarget.style.background = C.goldHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = C.gold; }}
                    >
                      {sending ? 'Dispatching campaign...' : `Launch SMS Campaign to ${recipientCount} Guests`}
                    </button>
                  </div>
                )}
              </form>

              {/* Smartphone Mockup Preview Block */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.stone, fontWeight: 700, marginBottom: 12 }}>Live SMS Preview</span>
                
                {/* Smartphone Shell */}
                <div style={{ width: 220, aspectRatio: '9/18', borderRadius: '2.2rem', border: '8px solid #3a3a3c', background: C.softBg, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 8, userSelect: 'none' }}>
                  {/* Top Notch speaker */}
                  <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 56, height: 12, background: '#3a3a3c', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2a2a2c', position: 'absolute', left: 8 }}></div>
                  </div>

                  {/* Screen Content */}
                  <div style={{ width: '100%', height: '100%', background: '#ebebeb', borderRadius: '1.6rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 20, color: C.charcoal, position: 'relative' }}>
                    
                    {/* Mock SMS App Header */}
                    <div style={{ background: '#f5f5f5', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: C.ivory }}>
                        F
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', fontSize: 7.5, lineHeight: 1 }}>
                        <span style={{ fontWeight: 700 }}>Fancy RSVP</span>
                        <span style={{ fontSize: 5.5, color: C.stone, marginTop: 2 }}>iMessage / SMS</span>
                      </div>
                    </div>

                    {/* Chat Messages Body */}
                    <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 12, overflowY: 'auto' }}>
                      
                      {/* Incoming text message bubble */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', textAlign: 'left', maxWidth: '85%', alignSelf: 'flex-start' }}>
                        <div style={{ background: '#e9e9eb', padding: 10, borderRadius: 16, borderBottomLeftRadius: 4, fontSize: 8.5, lineHeight: 1.7, color: '#3a3a3c', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.04)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {messageTemplate
                            .replaceAll('{name}', 'Alexander')
                            .replaceAll('{url}', 'fancyrsvp.com/s/e5x2')
                          }
                        </div>
                        <span style={{ fontSize: 5.5, color: C.stone, paddingLeft: 4, fontWeight: 600 }}>Today 10:24 AM</span>
                      </div>

                    </div>

                    {/* Chat footer input bar */}
                    <div style={{ background: '#f5f5f5', borderTop: '1px solid rgba(0,0,0,0.06)', padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ flex: 1, background: C.white, border: `1px solid ${C.border}`, borderRadius: 9999, padding: '2px 8px', fontSize: 6, color: C.stone, textAlign: 'left' }}>
                        iMessage
                      </div>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white }}>
                        <svg style={{ width: 10, height: 10, transform: 'rotate(90deg)' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>

            {campaignReport && (
              <div style={{ padding: 16, background: 'rgba(59,155,109,0.08)', border: `1px solid rgba(59,155,109,0.2)`, color: C.success, borderRadius: 12, fontSize: 13, marginTop: 24 }}>
                <strong>🟢 Campaign Dispatched:</strong> {campaignReport.message}
              </div>
            )}
          </div>

          </div>

        {/* Right Column: Transaction Logs Ledger */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: 24, borderRadius: 12, display: 'flex', flexDirection: 'column', height: 460, overflow: 'hidden' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 16, fontFamily: 'var(--font-serif)', color: C.charcoal }}>Transaction History</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
            {ledger.length === 0 && <p style={{ fontSize: 13, color: C.stone, textAlign: 'center', marginTop: 24, fontFamily: 'var(--font-sans)' }}>No campaign history yet.</p>}
            {ledger.map(row => {
              const isPurchase = row.type === 'purchase';
              return (
                <div key={row.id} style={{ background: C.softBg, padding: 16, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.ivory; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.softBg; }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.charcoal, display: 'block', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.description}>
                      {row.description}
                    </span>
                    <span style={{ fontSize: 10, color: C.stone, display: 'block' }}>{row.timestamp}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, display: 'block', color: isPurchase ? C.success : C.stone }}>
                      {isPurchase ? `+${row.credits}` : row.credits}
                    </span>
                    <span style={{ fontSize: 9, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginTop: 2 }}>Credits</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>

      {/* Purchase SMS Credits Modal Overlay */}
      {showSMSModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(25,27,30,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, width: '100%', maxWidth: 440, borderRadius: 16, padding: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: C.charcoal, fontFamily: 'var(--font-serif)' }}>Purchase SMS Credits</h3>
            <p style={{ fontSize: 12, color: C.stone, lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>
              SMS credits are used to send bulk mobile invitations to your guests. Volume discount of 12.5% is automatically applied on packages of 500 credits or more.
            </p>
            <form onSubmit={handleBuySMSCredits} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: C.stone, fontWeight: 600, display: 'block', marginBottom: 4 }}>Number of Credits</label>
                <input
                  type="number"
                  min="50"
                  required
                  value={smsCreditsToBuy}
                  onChange={e => setSmsCreditsToBuy(e.target.value)}
                  placeholder="e.g. 100"
                  style={{ width: '100%', background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.charcoal, outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
                  onFocus={e => { e.currentTarget.style.borderColor = C.gold; }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
                />
                <span style={{ fontSize: 10, color: C.stone, display: 'block', marginTop: 4 }}>Minimum purchase of 50 credits.</span>
              </div>
              
              <div style={{ background: C.softBg, padding: 16, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: C.stone }}>Price Per Credit:</span>
                  <span style={{ fontWeight: 600, color: C.charcoal }}>{smsRateCents}¢</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: C.stone }}>Subtotal:</span>
                  <span style={{ fontWeight: 600, color: C.charcoal }}>${((smsCreditsToBuy * smsRateCents) / 100).toFixed(2)} USD</span>
                </div>
                {smsCreditsToBuy >= 500 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: C.success }}>
                    <span>Volume Discount (12.5%):</span>
                    <span>-${(((smsCreditsToBuy * smsRateCents) / 100) * 0.125).toFixed(2)} USD</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderTop: `1px solid ${C.border}`, paddingTop: 8, fontWeight: 700, color: C.gold }}>
                  <span>Total Amount:</span>
                  <span>
                    ${(
                      smsCreditsToBuy >= 500
                        ? ((smsCreditsToBuy * smsRateCents) / 100) * 0.875
                        : (smsCreditsToBuy * smsRateCents) / 100
                    ).toFixed(2)}{' '}
                    USD
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowSMSModal(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${C.border}`, color: C.stone, fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.softBg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={buyingCredits}
                  style={{ padding: '8px 16px', background: C.gold, color: C.white, fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s', opacity: buyingCredits ? 0.5 : 1, fontFamily: 'var(--font-sans)' }}
                  onMouseEnter={e => { if (!buyingCredits) e.currentTarget.style.background = C.goldHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.gold; }}
                >
                  {buyingCredits ? 'Connecting to Stripe...' : 'Proceed to Checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
