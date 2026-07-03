'use client';
import { toast } from '../../utils/toast';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../../utils/apiClient';
import LogoutModal from '../../components/LogoutModal';
import { startSmsCreditPurchase } from '../../utils/smsPurchase';
import { computeSmsSegments, renderTemplate } from '../../utils/smsSegments';

const C = { gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC', champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8', error: '#C45E5E', success: '#3B9B6D' };

export default function CampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creditsPurchased, setCreditsPurchased] = useState(0);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const creditsRemaining = creditsPurchased - creditsUsed;

  const [ledger, setLedger] = useState([]);

  const [messageTemplate, setMessageTemplate] = useState('Hello {name}, you are cordially invited to Sophia & Julian\'s Wedding Gala on Oct 24th. Kindly RSVP at: {url}');
  const [rsvps, setRsvps] = useState([]);
  const [audiences, setAudiences] = useState(['pending']);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [sending, setSending] = useState(false);
  const [campaignReport, setCampaignReport] = useState(null);

  const [showSMSModal, setShowSMSModal] = useState(false);
  const [showConfirmSendModal, setShowConfirmSendModal] = useState(false);
  const [smsCreditsToBuy, setSmsCreditsToBuy] = useState(100);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [smsRate, setSmsRate] = useState(8);
  // Whether SMS credit top-ups (Stripe Checkout) are live. Default OFF until the
  // server reports it — keeps the buy entry hidden in pre-live / manual mode.
  const [smsEnabled, setSmsEnabled] = useState(false);

  const [authChecked, setAuthChecked] = useState(false);
  const [eventId, setEventId] = useState('');
  // null = loading, true/false once known. sms_campaigns is a gated feature
  // key (see UpgradeModal.FEATURE_TITLES) but this page never actually
  // checked it — any organizer could open the composer regardless of plan.
  const [hasCampaignFeature, setHasCampaignFeature] = useState(null);
  const [purchaseNotice, setPurchaseNotice] = useState('');
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const purchaseHandledRef = useRef(false);
  // Stable per-launch token → server dedups by (token, guest), so a retry after a
  // timeout never double-charges or double-sends. Reset only after a clean success.
  const clientTokenRef = useRef(null);
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  // ─── Derived audience counts + segment-aware cost (mirrors server billing) ───
  const audienceCounts = useMemo(() => {
    const hasPhone = (r) => r.phone && String(r.phone).trim() && r.phone !== '-';
    const attending = (r) => ['yes', 'accepted', 'attending'].includes(r.response);
    const declined = (r) => ['no', 'declined'].includes(r.response);
    return {
      pending: rsvps.filter(r => hasPhone(r) && r.response === 'pending').length,
      attending: rsvps.filter(r => hasPhone(r) && attending(r)).length,
      maybe: rsvps.filter(r => hasPhone(r) && r.response === 'maybe').length,
      declined: rsvps.filter(r => hasPhone(r) && declined(r)).length,
      all: rsvps.filter(r => hasPhone(r)).length,
    };
  }, [rsvps]);

  // Segments are mutually exclusive by response, so a multi-select union is just a sum.
  const recipientCount = useMemo(() => {
    if (audiences.includes('all')) return audienceCounts.all;
    return audiences.reduce((sum, a) => sum + (audienceCounts[a] || 0), 0);
  }, [audiences, audienceCounts]);

  const audienceLabel = useMemo(() => (
    audiences.includes('all') ? 'all guests' : audiences.join(' + ')
  ), [audiences]);

  const toggleAudience = (key) => {
    setAudiences(prev => {
      if (key === 'all') return ['all'];
      let next = prev.filter(a => a !== 'all');
      next = next.includes(key) ? next.filter(a => a !== key) : [...next, key];
      return next.length === 0 ? ['pending'] : next;
    });
  };

  const segmentInfo = useMemo(() => {
    // Estimate with representative values; the server measures each guest exactly.
    const sampleUrl = 'https://fancyrsvp.com/your-event/rsvp?g=00000000-0000-0000-0000-000000000000';
    let body = renderTemplate(messageTemplate, {
      name: 'Alexander', url: sampleUrl, rsvp_link: sampleUrl,
      table_number: '12', table: '12', event: 'Your Event', event_name: 'Your Event',
    });
    const branding = ' - Fancy RSVP'; // GSM-7-safe, matches the server suffix exactly
    if (!body.endsWith(branding)) body += branding;
    return computeSmsSegments(body);
  }, [messageTemplate]);
  const segmentsPerMsg = segmentInfo.segments;
  const estimatedCredits = recipientCount * segmentsPerMsg;

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleBuySMSCredits = async (e) => {
    e.preventDefault();
    if (!smsEnabled) {
      toast.error('SMS credit top-ups are temporarily unavailable.');
      return;
    }
    if (smsCreditsToBuy < 50) {
      toast.error('Minimum credit purchase count is 50.');
      return;
    }
    setBuyingCredits(true);
    try {
      // Shared with the wizard: opens checkout in a new tab and preserves this page
      // (and the composer draft). The return is handled by the purchase effect below.
      await startSmsCreditPurchase({ apiUrl, eventId, creditCount: parseInt(smsCreditsToBuy) });
      setShowSMSModal(false);
    } catch (err) {
      toast.error(err.message);
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
      // Prefer the event returned from a Stripe credits purchase (?event=…) so the
      // wallet/history shown matches the event the user just topped up.
      const returnedId = new URLSearchParams(window.location.search).get('event');
      const savedEventId = returnedId || localStorage.getItem('active_event_id') || '';
      if (!savedEventId) {
        setError('Please select an event first. Go to the Dashboard to create or select an event.');
        setLoading(false);
      }
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

      // 2. Fetch RSVPs so we can size every audience segment (phone + response).
      const rsvpsRes = await fetch(`${apiUrl}/events/${eventId}/rsvps`, { credentials: 'include' });
      const rsvpsData = await rsvpsRes.json();
      if (rsvpsData.success) {
        setRsvps((rsvpsData.rsvps || []).map(r => ({ id: r.id, response: r.response, phone: r.phone || '' })));
      }

      // 3. Fetch pricing configuration for dynamic SMS rates
      const configRes = await fetch(`${apiUrl}/payments/pricing-config`, { credentials: 'include' });
      const configData = await configRes.json();
      if (configData.success && configData.config) {
        setSmsRate(configData.config.sms_rate_cents_per_credit || 8);
      }
      if (configData.features) setSmsEnabled(!!configData.features.smsEnabled);
      
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

  // Feature-gate check: fetch the event's resolved tier once we know eventId.
  useEffect(() => {
    if (!eventId) return;
    fetch(`${apiUrl}/events/${eventId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data?.event) {
          const features = Array.isArray(data.event.tier_features) ? data.event.tier_features : [];
          setHasCampaignFeature(!!data.event.manual_override || features.includes('sms_campaigns'));
        } else {
          setHasCampaignFeature(false);
        }
      })
      .catch(() => setHasCampaignFeature(false));
  }, [apiUrl, eventId]);

  // Keep the wallet live when the user returns from the checkout tab we opened
  // (the purchase completes in that tab; this is the opener). Mirrors the wizard.
  useEffect(() => {
    if (!eventId) return;
    const onFocus = () => loadCampaignData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [eventId, loadCampaignData]);

  // Handle return from a Stripe SMS-credit purchase: synchronously verify the
  // session (so the balance updates even if the webhook is delayed), show a
  // confirmation, then refresh the wallet. Runs once.
  useEffect(() => {
    if (!eventId || purchaseHandledRef.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get('purchase');
    if (purchase !== 'success' && purchase !== 'cancelled') return;
    purchaseHandledRef.current = true;

    const sessionId = params.get('session_id');
    // Strip purchase/session params (keep ?event= so the wallet stays scoped).
    const url = new URL(window.location.href);
    url.searchParams.delete('purchase');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.pathname + url.search);

    if (purchase === 'cancelled') {
      setPurchaseNotice('Credit purchase was cancelled — no charge was made.');
      return;
    }

    (async () => {
      try {
        if (sessionId) {
          const res = await fetch(`${apiUrl}/payments/verify?session_id=${encodeURIComponent(sessionId)}`, { credentials: 'include' });
          const data = await res.json();
          if (data.success && data.paid) {
            setPurchaseSuccess(true);
            setPurchaseNotice(`Payment received — ${data.creditCount ? `${data.creditCount} ` : ''}SMS credits added to your wallet.`);
          } else {
            setPurchaseNotice('Payment is processing. Your credits will appear here shortly.');
          }
        } else {
          setPurchaseNotice('Returned from checkout. Your credits will appear once the payment clears.');
        }
      } catch {
        setPurchaseNotice('Could not confirm the purchase yet. Your credits will appear shortly.');
      } finally {
        loadCampaignData();
      }
    })();
  }, [eventId, apiUrl, loadCampaignData]);

  // Poll an in-flight async campaign until it reaches a terminal state.
  useEffect(() => {
    if (!activeCampaign?.id || !eventId) return;
    const terminal = ['completed', 'partial', 'failed', 'cancelled'];
    if (terminal.includes(activeCampaign.status)) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/events/${eventId}/campaigns/status/${activeCampaign.id}`, { credentials: 'include' });
        const data = await res.json();
        if (cancelled || !data.success || !data.campaign) return;
        setActiveCampaign(data.campaign);
        if (terminal.includes(data.campaign.status)) {
          clearInterval(timer);
          if ((data.campaign.failedCount || 0) > 0) {
            toast.error(`Campaign finished — ${data.campaign.sentCount} sent, ${data.campaign.failedCount} failed (refunded).`);
          } else {
            toast.success(`Campaign complete — ${data.campaign.sentCount} sent · ${data.campaign.creditsUsed} credits used.`);
          }
          clientTokenRef.current = null; // fresh token for the next campaign
          loadCampaignData();
        }
      } catch { /* transient — keep polling */ }
    }, 2500);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaign?.id, eventId, apiUrl]);

  const campaignInFlight = activeCampaign && !['completed', 'partial', 'failed', 'cancelled'].includes(activeCampaign.status);

  // Handle campaign dispatch API call
  const handleLaunchCampaign = (e) => {
    e.preventDefault();
    if (!eventId) return;
    if (recipientCount === 0) {
      toast.error('No guests with a phone number in this audience.');
      return;
    }
    if (estimatedCredits > creditsRemaining) {
      toast.error(`Insufficient credits. This send needs about ${estimatedCredits} credits (${recipientCount} × ${segmentsPerMsg} segment${segmentsPerMsg !== 1 ? 's' : ''}), but you have ${creditsRemaining}.`);
      return;
    }
    // Mint a launch token now; reused on retry so a timeout can't double-charge.
    if (!clientTokenRef.current) {
      clientTokenRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    setShowConfirmSendModal(true);
  };

  const executeLaunchCampaign = async () => {
    setSending(true);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/campaigns/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageTemplate, audiences, clientToken: clientTokenRef.current })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send campaign');
      }

      if (data.success && data.async) {
        // Large send → queued to the background worker. Show the live progress panel.
        setCampaignReport(null);
        setActiveCampaign({
          id: data.campaignId, status: data.status || 'queued',
          totalRecipients: data.recipientCount, sentCount: 0, failedCount: 0,
          skippedCount: 0, creditsUsed: 0, progress: 0,
        });
        toast.success(`Queued ${data.recipientCount} message${data.recipientCount !== 1 ? 's' : ''} — delivering in the background.`);
        // Token is reset by the poller once the campaign reaches a terminal state.
      } else if (data.success) {
        setCampaignReport({
          success: true,
          sent: data.sentCount,
          failed: data.failedCount,
          skipped: data.skippedCount,
          credits: data.creditsUsed,
          message: data.message
        });
        if (data.failedCount > 0) {
          toast.error(`${data.failedCount} message${data.failedCount !== 1 ? 's' : ''} couldn't be delivered — ${data.sentCount} sent. Failed sends were not charged.`);
        } else {
          toast.success(`${data.sentCount} message${data.sentCount !== 1 ? 's' : ''} sent · ${data.creditsUsed} credit${data.creditsUsed !== 1 ? 's' : ''} used.`);
        }
        // Clean success → next distinct campaign gets a fresh idempotency token.
        clientTokenRef.current = null;
        await loadCampaignData();
      }
    } catch (err) {
      // Keep the token so the user can safely retry the SAME launch without re-charging.
      toast.error(err.message);
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

  if (hasCampaignFeature === false) {
    return (
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', background: C.white, border: `1px solid ${C.border}`, padding: '64px 32px', borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px', background: 'linear-gradient(135deg, rgba(215,190,128,0.15) 0%, rgba(184,148,79,0.15) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: C.charcoal, margin: 0 }}>SMS Campaigns</h2>
          <p style={{ fontSize: '14px', color: C.stone, maxWidth: 340, margin: '12px auto 0', lineHeight: 1.7 }}>
            Send bulk SMS invitations and reminders to your guests. This feature isn't included in your current plan.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              marginTop: 32, padding: '14px 36px', background: 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
              color: C.white, border: 'none', borderRadius: '30px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            View Plans &amp; Upgrade →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.ivory, color: C.charcoal, padding: 32, fontFamily: 'var(--font-sans)' }}>

      {/* ─── Stripe purchase return banner ─── */}
      {purchaseNotice && (
        <div style={{
          maxWidth: 1200, margin: '0 auto 20px',
          background: purchaseSuccess ? 'rgba(59,155,109,0.08)' : 'rgba(184,148,79,0.08)',
          border: `1px solid ${purchaseSuccess ? 'rgba(59,155,109,0.3)' : 'rgba(184,148,79,0.3)'}`,
          borderRadius: 12, padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: purchaseSuccess ? C.success : C.charcoal }}>
            {purchaseSuccess ? '✓ ' : ''}{purchaseNotice}
          </span>
          <button onClick={() => setPurchaseNotice('')} aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.stone, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>×</button>
        </div>
      )}

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
          {/* Credit top-ups go through Stripe — hidden while card payments are off. */}
          {smsEnabled && (
            <button
              onClick={() => setShowSMSModal(true)}
              style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', color: C.gold, fontFamily: 'var(--font-sans)' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.softBg; e.currentTarget.style.borderColor = C.gold; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.border; }}
            >
              Buy SMS Credits
            </button>
          )}
          <button
            onClick={() => setShowLogoutModal(true)}
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
            {/* Wallets are scoped per-event: credits bought here only spend on THIS event. */}
            <div style={{ gridColumn: '1 / -1', borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>🔒</span>
              <span style={{ fontSize: 11, color: C.stone, fontWeight: 600, lineHeight: 1.5 }}>
                This balance belongs to this event only — credits aren&apos;t shared across your other events.
              </span>
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
                    Tags (also accept <code style={{ fontFamily: 'monospace' }}>{`{{double}}`}</code>):{' '}
                    {['name', 'rsvp_link', 'table_number', 'event'].map((t, i) => (
                      <React.Fragment key={t}>
                        {i > 0 ? ' ' : ''}
                        <code style={{ background: C.softBg, padding: '2px 4px', borderRadius: 3, color: C.gold, fontFamily: 'monospace', fontSize: 10 }}>{`{${t}}`}</code>
                      </React.Fragment>
                    ))}
                    . <code style={{ fontFamily: 'monospace' }}>{`{url}`}</code> = each guest&apos;s unique RSVP link.
                  </span>
                </div>

                {/* Audience segment selector (multi-select) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, color: C.stone, fontWeight: 600, display: 'block' }}>Audience <span style={{ fontWeight: 400 }}>· select one or more</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { key: 'pending', label: 'Pending' },
                      { key: 'attending', label: 'Attending' },
                      { key: 'maybe', label: 'Maybe' },
                      { key: 'declined', label: 'Declined' },
                      { key: 'all', label: 'All guests' },
                    ].map(a => {
                      const active = audiences.includes(a.key);
                      const count = audienceCounts[a.key] ?? 0;
                      return (
                        <button type="button" key={a.key} onClick={() => toggleAudience(a.key)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 20,
                            cursor: 'pointer', border: `1px solid ${active ? C.gold : C.border}`,
                            background: active ? 'rgba(184,148,79,0.08)' : C.white, color: active ? C.gold : C.stone,
                            fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                          }}>
                          {active && <span style={{ fontSize: 11, lineHeight: 1 }}>✓</span>}
                          {a.label}
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: active ? C.gold : C.softBg, color: active ? C.white : C.stone }}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 10, color: C.stone }}>Combine segments freely (e.g. Pending + Maybe). Only guests with a phone number count; each gets their own unique RSVP link.</span>
                </div>

                {recipientCount > 0 ? (
                  <div style={{ background: C.softBg, padding: 16, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: C.stone, fontWeight: 600 }}>Recipients:</span>
                      <span style={{ fontWeight: 700, color: C.charcoal }}>{recipientCount} · {audienceLabel}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: C.stone, fontWeight: 600 }}>Message size:</span>
                      <span style={{ fontWeight: 700, color: segmentsPerMsg > 1 ? C.error : C.charcoal }}>
                        {segmentInfo.length} chars · {segmentInfo.encoding} · {segmentsPerMsg} SMS{segmentsPerMsg !== 1 ? ' segments' : ' segment'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: C.stone, fontWeight: 600 }}>Cost Per SMS Segment:</span>
                      <span style={{ fontWeight: 700, color: C.charcoal }}>${(smsRate / 100).toFixed(2)} ({smsRate}¢)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10, fontWeight: 700 }}>
                      <span style={{ color: C.stone }}>Credits Required:</span>
                      <span style={{ color: C.gold }}>~{estimatedCredits} Credits</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
                      <span style={{ color: C.stone }}>Estimated Cost:</span>
                      <span style={{ color: C.gold }}>${((estimatedCredits * smsRate) / 100).toFixed(2)} USD</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                      <span style={{ color: C.stone }}>Wallet Balance:</span>
                      <span style={{ fontWeight: 700, color: creditsRemaining >= estimatedCredits ? C.success : C.error }}>
                        {creditsRemaining} Credits available
                      </span>
                    </div>
                    {segmentsPerMsg > 1 && (
                      <span style={{ fontSize: 10, color: C.stone, lineHeight: 1.6 }}>
                        This message spans {segmentsPerMsg} segments, so each guest costs {segmentsPerMsg} credits. Shorten it (or switch off special characters) to drop to a single segment.
                      </span>
                    )}
                    {/* UCS-2 (Arabic, accents, emoji) caps a segment at 70 chars vs 160 — so the
                        same length costs far more credits. Surface this explicitly. */}
                    {segmentInfo.encoding === 'UCS-2' && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(196,94,94,0.06)', border: `1px solid rgba(196,94,94,0.25)`, borderRadius: 8, padding: '8px 10px' }}>
                        <span style={{ fontSize: 12, lineHeight: 1.4 }}>⚠️</span>
                        <span style={{ fontSize: 10, color: C.charcoal, lineHeight: 1.6 }}>
                          <strong>Arabic / special characters detected.</strong> This switches the message to Unicode, where each SMS segment holds only <strong>70 characters</strong> (vs 160 for Latin text) — so it can cost up to <strong>3× the credits</strong> per guest. Use plain Latin text to keep messages to a single segment.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: C.softBg, padding: 16, border: `1px solid ${C.border}`, borderRadius: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: C.stone }}>No guests with a phone number in the <strong>{audienceLabel}</strong> segment.</p>
                  </div>
                )}

                {recipientCount > 0 && (
                  <button
                    type="submit"
                    disabled={sending || campaignInFlight}
                    style={{ width: '100%', padding: '12px 0', background: C.gold, fontWeight: 700, borderRadius: 8, fontSize: 12, border: 'none', cursor: (sending || campaignInFlight) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', color: C.white, opacity: (sending || campaignInFlight) ? 0.5 : 1, boxShadow: '0 2px 8px rgba(184,148,79,0.25)', fontFamily: 'var(--font-sans)' }}
                    onMouseEnter={e => { if (!sending && !campaignInFlight) e.currentTarget.style.background = C.goldHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = C.gold; }}
                  >
                    {campaignInFlight ? 'Campaign in progress…' : sending ? 'Dispatching campaign...' : `Review & Launch · ${recipientCount} · ${audienceLabel}`}
                  </button>
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
                          {renderTemplate(messageTemplate, {
                            name: 'Alexander', url: 'fancyrsvp.com/s/e5x2', rsvp_link: 'fancyrsvp.com/s/e5x2',
                            table_number: '12', table: '12', event: 'Your Event', event_name: 'Your Event',
                          })}
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

            {activeCampaign && (() => {
              const terminal = ['completed', 'partial', 'failed', 'cancelled'];
              const done = terminal.includes(activeCampaign.status);
              const total = activeCampaign.totalRecipients || 0;
              const processed = (activeCampaign.sentCount || 0) + (activeCampaign.failedCount || 0) + (activeCampaign.skippedCount || 0);
              const pct = activeCampaign.progress != null ? activeCampaign.progress : (total ? Math.round((processed / total) * 100) : 0);
              const statusColor = activeCampaign.status === 'failed' ? C.error : (activeCampaign.status === 'partial' ? C.gold : (done ? C.success : C.gold));
              const statusLabel = { queued: 'Queued', processing: 'Sending…', completed: 'Completed', partial: 'Completed with errors', failed: 'Failed', cancelled: 'Cancelled' }[activeCampaign.status] || activeCampaign.status;
              return (
                <div style={{ padding: 18, borderRadius: 12, fontSize: 13, marginTop: 24, background: C.white, border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!done && <span style={{ width: 14, height: 14, border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />}
                      <strong style={{ color: statusColor }}>{statusLabel}</strong>
                      <span style={{ color: C.stone, fontSize: 12 }}>· {processed}/{total} processed</span>
                    </div>
                    {done && (
                      <button onClick={() => setActiveCampaign(null)} aria-label="Dismiss"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.stone, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>×</button>
                    )}
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: C.softBg, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.champagne})`, borderRadius: 4, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: C.stone }}>Sent: <strong style={{ color: C.success }}>{activeCampaign.sentCount || 0}</strong></span>
                    <span style={{ fontSize: 12, color: C.stone }}>Failed: <strong style={{ color: (activeCampaign.failedCount || 0) > 0 ? C.error : C.charcoal }}>{activeCampaign.failedCount || 0}</strong></span>
                    {(activeCampaign.skippedCount || 0) > 0 && <span style={{ fontSize: 12, color: C.stone }}>Skipped: <strong style={{ color: C.charcoal }}>{activeCampaign.skippedCount}</strong></span>}
                    <span style={{ fontSize: 12, color: C.stone, marginLeft: 'auto' }}>Credits used: <strong style={{ color: C.gold }}>{activeCampaign.creditsUsed || 0}</strong></span>
                  </div>
                  {activeCampaign.lastError && <p style={{ fontSize: 11, color: C.error, marginTop: 8 }}>{activeCampaign.lastError}</p>}
                </div>
              );
            })()}

            {campaignReport && (
              <div style={{
                padding: 16, borderRadius: 12, fontSize: 13, marginTop: 24,
                background: campaignReport.failed > 0 ? 'rgba(184,148,79,0.08)' : 'rgba(59,155,109,0.08)',
                border: `1px solid ${campaignReport.failed > 0 ? 'rgba(184,148,79,0.25)' : 'rgba(59,155,109,0.2)'}`,
                color: campaignReport.failed > 0 ? C.charcoal : C.success,
              }}>
                <strong>{campaignReport.failed > 0 ? '⚠ Campaign Finished' : '🟢 Campaign Dispatched'}:</strong>{' '}
                {campaignReport.sent} sent{campaignReport.failed > 0 ? `, ${campaignReport.failed} failed (refunded)` : ''}
                {campaignReport.skipped > 0 ? `, ${campaignReport.skipped} already sent` : ''}
                {' '}· <strong>{campaignReport.credits}</strong> credit{campaignReport.credits !== 1 ? 's' : ''} used.
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

      {/* Confirm Send Campaign Modal Overlay */}
      {showConfirmSendModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(25,27,30,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, width: '100%', maxWidth: 400, borderRadius: 16, padding: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: C.charcoal, fontFamily: 'var(--font-serif)' }}>Confirm Campaign Launch</h3>
            <p style={{ fontSize: 13, color: C.stone, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
              You&apos;re about to text <strong>{recipientCount}</strong> guests ({audienceLabel})
              {' '}— {segmentsPerMsg} SMS segment{segmentsPerMsg !== 1 ? 's' : ''} each.
              {recipientCount > 50 && <span style={{ display: 'block', marginTop: 6, color: C.gold, fontWeight: 600 }}>Large list — this runs in the background and you can watch live progress.</span>}
            </p>
            <div style={{ background: C.softBg, padding: 16, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.stone }}>Est. credits to use:</span>
                <strong style={{ color: C.charcoal }}>~{estimatedCredits} Credits</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.stone }}>Remaining balance:</span>
                <strong style={{ color: C.gold }}>{creditsRemaining} Credits</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                <span style={{ color: C.stone }}>Est. balance after:</span>
                <strong style={{ color: C.charcoal }}>{creditsRemaining - estimatedCredits} Credits</strong>
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.stone, fontFamily: 'var(--font-sans)', fontStyle: 'italic' }}>
              Credits are charged per delivered segment — failed sends are automatically refunded. Final usage may vary slightly with each guest&apos;s name length.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowConfirmSendModal(false)}
                style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${C.border}`, color: C.stone, fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.softBg; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmSendModal(false);
                  await executeLaunchCampaign();
                }}
                style={{ padding: '8px 16px', background: C.gold, color: C.white, fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.goldHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.gold; }}
              >
                Launch Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase SMS Credits Modal Overlay */}
      {showSMSModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(25,27,30,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, width: '100%', maxWidth: 440, borderRadius: 16, padding: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: C.charcoal, fontFamily: 'var(--font-serif)' }}>Purchase SMS Credits</h3>
            <p style={{ fontSize: 12, color: C.stone, lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>
              SMS credits are used to send bulk mobile invitations to your guests. Volume discount of 12.5% is automatically applied on packages of 500 credits or more.
            </p>
            <p style={{ fontSize: 11, color: C.stone, lineHeight: 1.6, fontFamily: 'var(--font-sans)', background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', margin: 0 }}>
              🔒 These credits are added to <strong>this event&apos;s wallet only</strong> — each event keeps its own balance, so they can&apos;t be moved to or shared with another event.
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
                  <span style={{ fontWeight: 600, color: C.charcoal }}>{smsRate}¢</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: C.stone }}>Subtotal:</span>
                  <span style={{ fontWeight: 600, color: C.charcoal }}>${((smsCreditsToBuy * smsRate) / 100).toFixed(2)} USD</span>
                </div>
                {smsCreditsToBuy >= 500 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: C.success }}>
                    <span>Volume Discount (12.5%):</span>
                    <span>-${(((smsCreditsToBuy * smsRate) / 100) * 0.125).toFixed(2)} USD</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderTop: `1px solid ${C.border}`, paddingTop: 8, fontWeight: 700, color: C.gold }}>
                  <span>Total Amount:</span>
                  <span>
                    ${(
                      smsCreditsToBuy >= 500
                        ? ((smsCreditsToBuy * smsRate) / 100) * 0.875
                        : (smsCreditsToBuy * smsRate) / 100
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
      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={logout} />
    </div>
  );
}
