'use client';
import { toast } from '../../utils/toast';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../../utils/apiClient';
import LogoutModal from '../../components/LogoutModal';
import { startSmsCreditPurchase } from '../../utils/smsPurchase';
import { computeSmsSegments, renderTemplate } from '../../utils/smsSegments';
import { useIsClient } from '../../utils/useIsClient';
import Icon from '../../components/icons/Icon';

const C = { gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC', champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8', error: '#C45E5E', success: '#3B9B6D' };

/**
 * "1,350 messages left" — the one number the organizer came here for.
 *
 * Replaces a three-column grid reading Purchased / Consumed / Remaining Balance,
 * which made the reader subtract two numbers to answer the only question they
 * actually had. Here the answer is the headline, the bar makes it instantly
 * legible without reading any digits at all, and "last message sent 2 hours ago"
 * confirms the thing is alive — which is the second question, and the one a
 * status page usually forgets.
 *
 * The bar turns amber then red as the balance falls, so the state is obvious at a
 * glance rather than requiring the percentage to be read and interpreted.
 */
function MessagesRemainingCard({ balance, coverage, onTopUp, canTopUp }) {
  if (!balance) return null;

  const { remaining, purchased, percentRemaining, isLow, isEmpty, lastUsedLabel } = balance;
  const barColor = isEmpty ? C.error : (isLow ? '#D08C3C' : C.gold);
  const neverBought = purchased === 0;

  return (
    <div style={{
      background: C.white, borderRadius: 14, padding: '22px 24px',
      border: `1px solid ${isEmpty ? C.error : (isLow ? '#D08C3C' : C.border)}`,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, fontWeight: 700 }}>
            Your messages
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 700, color: C.charcoal, lineHeight: 1.1, marginTop: 4 }}>
            {remaining.toLocaleString()}
            <span style={{ fontSize: 15, fontWeight: 400, color: C.stone, marginLeft: 8 }}>
              {neverBought ? 'messages' : `left of ${purchased.toLocaleString()}`}
            </span>
          </div>
        </div>
        {canTopUp && (
          <button
            type="button"
            onClick={onTopUp}
            style={{
              padding: '11px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
              color: C.white, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)',
            }}
          >
            Add more messages
          </button>
        )}
      </div>

      {!neverBought && (
        <>
          <div style={{ marginTop: 16, height: 10, borderRadius: 999, background: C.ivory, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max(2, percentRemaining)}%`, height: '100%',
              background: barColor, borderRadius: 999, transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: C.stone, fontFamily: 'var(--font-sans)' }}>
              {percentRemaining}% left
            </span>
            {lastUsedLabel && (
              <span style={{ fontSize: 12, color: C.stone, fontFamily: 'var(--font-sans)' }}>
                Last message sent {lastUsedLabel}
              </span>
            )}
          </div>
        </>
      )}

      {/* Requirement 9/10: the guest list has outgrown the balance. Stated as a
          fact with a suggested action — never as a block. */}
      {coverage && !coverage.enough && coverage.guests > 0 && (
        <p style={{
          margin: '16px 0 0', padding: '11px 13px', borderRadius: 9,
          background: 'rgba(184,148,79,0.10)', border: `1px solid ${C.border}`,
          fontSize: 12.5, lineHeight: 1.65, color: '#8A6D34', fontFamily: 'var(--font-sans)',
        }}>
          You now have <strong>{coverage.guests} guests</strong>, but only enough messages for
          about <strong>{coverage.coversInvitations}</strong> of them. Add around{' '}
          <strong>{coverage.shortfall.toLocaleString()}</strong> more so everyone hears from you.
        </p>
      )}

      {isEmpty && (
        <p style={{ margin: '14px 0 0', fontSize: 12.5, lineHeight: 1.65, color: C.error, fontFamily: 'var(--font-sans)' }}>
          You&apos;ve used all your messages. Your guests are still hearing from you by email,
          so nothing has been missed.
        </p>
      )}

      <p style={{ margin: '14px 0 0', fontSize: 11.5, color: C.stone, lineHeight: 1.5, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Icon name="lock" size={12} strokeWidth={1.6} style={{ flexShrink: 0, marginTop: 2 }} />
        These messages belong to this event only — they aren&apos;t shared with your other events.
      </p>
    </div>
  );
}

/**
 * Message history — the support tool.
 *
 * When a guest says "I never got the text", whoever picks up the ticket has to be
 * able to answer in one second. So every row states an outcome in a sentence, by
 * name, and never shows a code: nobody recognises +1555… as their aunt, and
 * "NO_SMS_CONSENT" teaches a customer nothing except that we are hard to deal
 * with. The wording is produced server-side (utils/smsUsage.explainSkip) so the
 * dashboard and any future support tooling say exactly the same thing.
 *
 * Resend appears only on failures the organizer can actually fix. Offering it on
 * a guest who replied STOP would imply the button might override their choice.
 */
function MessageHistory({ entries, loading, onResend, resendingId }) {
  if (loading) {
    return <p style={{ fontSize: 13, color: C.stone, fontFamily: 'var(--font-sans)' }}>Loading…</p>;
  }
  if (!entries || entries.length === 0) {
    return (
      <p style={{ fontSize: 13, color: C.stone, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
        No messages yet. Once your guests start receiving texts, every one will be listed here —
        including any that couldn&apos;t be delivered, and why.
      </p>
    );
  }

  const when = (iso) => {
    try { return new Date(iso).toLocaleString(); } catch { return ''; }
  };

  return (
    <div className="fx-stack" style={{ gap: 0 }}>
      {entries.map((e) => {
        const delivered = e.status === 'sent';
        return (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, padding: '11px 0', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.charcoal, fontFamily: 'var(--font-sans)' }}>
                {e.guestName || e.recipient || 'Guest'}
              </div>
              <div style={{ fontSize: 12, color: delivered ? C.success : C.error, marginTop: 2, fontFamily: 'var(--font-sans)' }}>
                {delivered ? 'Delivered' : 'Not sent'}
                {!delivered && e.reason && (
                  <span style={{ color: C.stone }}> — {e.reason}</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 11.5, color: C.stone, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                {when(e.created_at)}
              </span>
              {e.canResend && (
                <button
                  type="button"
                  disabled={resendingId === e.id}
                  onClick={() => onResend(e.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.gold}`,
                    background: 'transparent', color: C.gold, fontSize: 11.5, fontWeight: 700,
                    cursor: resendingId === e.id ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {resendingId === e.id ? 'Sending…' : 'Try again'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creditsPurchased, setCreditsPurchased] = useState(0);
  const [creditsUsed, setCreditsUsed] = useState(0);

  const [ledger, setLedger] = useState([]);

  const [messageTemplate, setMessageTemplate] = useState('Hello {name}, you are cordially invited to Sophia & Julian\'s Wedding Gala on Oct 24th. Kindly RSVP at: {url}');
  const [rsvps, setRsvps] = useState([]);
  const [audiences, setAudiences] = useState(['pending']);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [sending, setSending] = useState(false);
  const [campaignReport, setCampaignReport] = useState(null);

  const [showSMSModal, setShowSMSModal] = useState(false);
  const [showConfirmSendModal, setShowConfirmSendModal] = useState(false);
  // Terms §5 consent attestation — required (and reset) for every launch.
  const [consentAttested, setConsentAttested] = useState(false);
  const [smsCreditsToBuy, setSmsCreditsToBuy] = useState(100);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [smsRate, setSmsRate] = useState(8);
  // Mirrors smsDispatch.COMPLIANCE_FOOTER, fetched rather than duplicated. The
  // default matches the server's current value so the estimate is right on the
  // first render, before /campaigns/history resolves.
  const [complianceFooter, setComplianceFooter] = useState(' - Fancy RSVP. Msg&data rates may apply. Reply STOP to opt out, HELP for help.');
  // Whether SMS credit top-ups (Stripe Checkout) are live. Default OFF until the
  // server reports it — keeps the buy entry hidden in pre-live / manual mode.
  const [smsEnabled, setSmsEnabled] = useState(false);

  // isClient gates the localStorage/URL reads until we're past hydration (SSR
  // has neither). orgId/returnedId/storedEventId/eventId are all derived from
  // those reads — eventId is never set independently anywhere else, so no
  // separate state is needed for it (mirrors seating-map/page.js's fix).
  const isClient = useIsClient();
  const orgId = isClient ? localStorage.getItem('org_id') : null;
  // Prefer the event returned from a Stripe credits purchase (?event=…) so the
  // wallet/history shown matches the event the user just topped up.
  const returnedId = isClient ? new URLSearchParams(window.location.search).get('event') : null;
  const storedEventId = isClient ? localStorage.getItem('active_event_id') : null;
  const eventId = (isClient && orgId) ? (returnedId || storedEventId || '') : '';
  // Per-message-type switches + the catalogue describing them, and the tally of
  // why messages were skipped — all served by /campaigns/settings.
  const [smsSettings, setSmsSettings] = useState({});
  const [smsTypes, setSmsTypes] = useState([]);
  const [skipSummary, setSkipSummary] = useState({});
  const [skipLabels, setSkipLabels] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Everything already expressed in the customer's terms by the server
  // (utils/smsUsage.summarizeBalance) — messages left, a percentage, when one
  // last went out — so this page never re-derives a number the emails and the
  // dashboard banner could then disagree with.
  const [balance, setBalance] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [sendLimit, setSendLimit] = useState(null);

  const [messageLog, setMessageLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [resendingId, setResendingId] = useState(null);

  // Live top-up quote, so the price is known BEFORE Stripe rather than on it.
  const [topUpQuote, setTopUpQuote] = useState(null);

  // ONE source of truth for "how many messages are left".
  //
  // The server already computes this (utils/smsUsage.summarizeBalance) and serves
  // it to the balance card, the low-balance emails and the top-up modal. Letting
  // the composer subtract two other numbers from a DIFFERENT endpoint means the
  // same page can show two different balances depending on which request landed
  // last — which reads to a customer as the platform not knowing its own state.
  // The local subtraction survives only as the first-render fallback, before
  // /campaigns/settings resolves.
  //
  // Declared HERE, after `balance` — reading it above its useState would be a
  // temporal-dead-zone ReferenceError that crashes the page on every render.
  const creditsRemaining = balance ? balance.remaining : Math.max(0, creditsPurchased - creditsUsed);
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
    // The server appends this to EVERY body and bills the result, so the estimate
    // has to measure the same string. It is served by /campaigns/history from the
    // backend's single definition rather than copied here — a local copy silently
    // made every price wrong the moment either side was edited.
    if (complianceFooter && !body.endsWith(complianceFooter)) body += complianceFooter;
    return computeSmsSegments(body);
  }, [messageTemplate, complianceFooter]);
  const segmentsPerMsg = segmentInfo.segments;
  const estimatedCredits = recipientCount * segmentsPerMsg;

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleBuySMSCredits = async (e) => {
    e.preventDefault();
    if (!smsEnabled) {
      toast.error('Adding messages is temporarily unavailable.');
      return;
    }
    if (smsCreditsToBuy < 50) {
      toast.error('The smallest amount you can add is 50 messages.');
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

  // The redirect is a genuine imperative side effect (navigation); it no
  // longer also carries the eventId/authChecked state updates, which are now
  // plain derived values above.
  useEffect(() => {
    if (!isClient) return;
    if (!orgId) router.push('/login');
  }, [isClient, orgId, router]);

  // One-time "do we actually have an event to load?" check — adjusted during
  // render (like RsvpWizard's prevLangParam / checkin's eventIdSeeded) rather
  // than in an effect, since this only needs to run once, the moment we know
  // orgId and eventId.
  const [noEventChecked, setNoEventChecked] = useState(false);
  if (isClient && orgId && !noEventChecked) {
    setNoEventChecked(true);
    if (!eventId) {
      setError('Please select an event first. Go to the Dashboard to create or select an event.');
      setLoading(false);
    }
  }

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
        // Served by the backend from its single COMPLIANCE_FOOTER definition, so
        // the cost estimate below can never drift from what is actually appended.
        if (historyData.complianceFooter) setComplianceFooter(historyData.complianceFooter);

        // Format ledger timestamps
        const formattedLedger = (historyData.history || []).map(item => ({
          id: item.id,
          type: item.transaction_type,
          credits: item.credits,
          timestamp: new Date(item.created_at).toLocaleString(),
          description: item.transaction_type === 'purchase' 
            ? 'Messages added' 
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
    (async () => { await loadCampaignData(); })();
  }, [loadCampaignData, eventId]);

  // Access check. SMS is no longer a tier feature — it is a per-event add-on, so
  // the question is "has this event bought it?", not "which plan is it on?".
  // /campaigns/settings is deliberately ungated: an event WITHOUT the add-on is
  // exactly the one that needs this screen, to be told what it does and offered it.
  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/events/${eventId}/campaigns/settings`, { credentials: 'include' });
        const data = await res.json();
        if (data?.success) {
          setHasCampaignFeature(!!data.addonActive);
          setSmsSettings(data.settings || {});
          setSmsTypes(Array.isArray(data.messageTypes) ? data.messageTypes : []);
          setSkipSummary(data.skipSummary || {});
          setSkipLabels(data.skipLabels || {});
          setBalance(data.balance || null);
          setCoverage(data.coverage || null);
          setSendLimit(data.sendLimit || null);
        } else {
          setHasCampaignFeature(false);
        }
      } catch {
        setHasCampaignFeature(false);
      }
    })();
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
      (async () => { setPurchaseNotice('That was cancelled — you have not been charged.'); })();
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
            setPurchaseNotice('Payment is going through. Your messages will appear here shortly.');
          }
        } else {
          setPurchaseNotice('Thanks — your messages will appear once the payment clears.');
        }
      } catch {
        setPurchaseNotice('We could not confirm the payment just yet. Your messages will appear shortly.');
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
            toast.error(`Sent ${data.campaign.sentCount}. ${data.campaign.failedCount} couldn't be delivered — you weren't charged for those.`);
          } else {
            toast.success(`Sent ${data.campaign.sentCount} message${data.campaign.sentCount !== 1 ? 's' : ''}.`);
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
      toast.error(`You need about ${estimatedCredits} messages to reach these ${recipientCount} guests, but you have ${creditsRemaining} left. Add more messages to send this.`);
      return;
    }
    // Mint a launch token now; reused on retry so a timeout can't double-charge.
    if (!clientTokenRef.current) {
      clientTokenRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    setConsentAttested(false); // must be re-confirmed for every launch
    setShowConfirmSendModal(true);
  };

  const executeLaunchCampaign = async () => {
    // Send the attestation the organizer ACTUALLY made, never a literal `true`.
    // What lands in sms_campaigns.consent_attested_at is a legal record under
    // Terms §5; hardcoding it would make that record a statement by this code
    // rather than by a person, and would silently assert consent for any future
    // caller that reaches this function without the confirmation modal.
    if (!consentAttested) {
      setError('Confirm the consent statement before launching this campaign.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/campaigns/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageTemplate, audiences, clientToken: clientTokenRef.current, consentAttested })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send campaign');
      }

      // Guests excluded because they texted STOP — surfaced so a shrinking
      // audience count is explained rather than mysterious.
      const suppressedNote = data.suppressedCount > 0
        ? ` ${data.suppressedCount} opted-out guest${data.suppressedCount !== 1 ? 's were' : ' was'} excluded.`
        : '';

      if (data.success && data.async) {
        // Large send → queued to the background worker. Show the live progress panel.
        setCampaignReport(null);
        setActiveCampaign({
          id: data.campaignId, status: data.status || 'queued',
          totalRecipients: data.recipientCount, sentCount: 0, failedCount: 0,
          skippedCount: 0, creditsUsed: 0, progress: 0,
        });
        toast.success(`Queued ${data.recipientCount} message${data.recipientCount !== 1 ? 's' : ''} — delivering in the background.${suppressedNote}`);
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
          toast.error(`Sent ${data.sentCount}. ${data.failedCount} couldn't be delivered — you weren't charged for those.${suppressedNote}`);
        } else {
          toast.success(`Sent ${data.sentCount} message${data.sentCount !== 1 ? 's' : ''}.${suppressedNote}`);
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
          <Icon name="plug" size={36} color={C.error} strokeWidth={1.3} />
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

  /* Message history. Loaded once the add-on is known to be active — an event
     without it has no history worth fetching. */
  const loadMessageLog = useCallback(async () => {
    if (!eventId) return;
    setLogLoading(true);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/campaigns/log?limit=100`, { credentials: 'include' });
      const data = await res.json();
      if (data?.success) setMessageLog(data.entries || []);
    } catch { /* the history is diagnostic — its absence must not break the page */ }
    finally { setLogLoading(false); }
  }, [apiUrl, eventId]);

  useEffect(() => {
    if (hasCampaignFeature) loadMessageLog();
  }, [hasCampaignFeature, loadMessageLog]);

  /* Retry ONE failed message.
     Building a whole campaign to reach a single guest is both absurd and
     dangerous — the audience filters would sweep in everyone else who matches. */
  const handleResend = useCallback(async (logId) => {
    setResendingId(logId);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/campaigns/resend/${logId}`, {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json();
      if (data?.success) toast.success(data.message || 'Message sent.');
      else toast.error(data?.message || 'It still could not be sent.');
      await loadMessageLog();
      await loadCampaignData();
    } catch (err) {
      toast.error(err.message || 'Could not resend that message.');
    } finally {
      setResendingId(null);
    }
  }, [apiUrl, eventId, loadMessageLog, loadCampaignData]);

  /* What a top-up would cost, fetched BEFORE the organizer commits. Requirement:
     never let someone meet the price for the first time on Stripe's page. */
  useEffect(() => {
    if (!showSMSModal || !eventId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${apiUrl}/events/${eventId}/campaigns/topup-quote?messages=${encodeURIComponent(smsCreditsToBuy)}`,
          { credentials: 'include' },
        );
        const data = await res.json();
        if (!cancelled && data?.success) setTopUpQuote(data);
      } catch { if (!cancelled) setTopUpQuote(null); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [showSMSModal, smsCreditsToBuy, apiUrl, eventId]);

  /* Per-message-type switches. Saved immediately on toggle rather than behind a
     Save button: each switch is independent and instantly reversible, and a
     forgotten Save here means the organizer's allowance keeps being spent on a
     message type they believed they had turned off. Optimistic, with a rollback
     on failure so the UI never claims a change the server rejected. */
  const toggleSmsType = async (key, next) => {
    const previous = smsSettings;
    const updated = { ...smsSettings, [key]: next };
    setSmsSettings(updated);
    setSavingSettings(true);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/campaigns/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings: updated }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not save.');
      setSmsSettings(data.settings || updated);
    } catch (err) {
      setSmsSettings(previous);
      toast.error(err.message || 'Could not save that change.');
    } finally {
      setSavingSettings(false);
    }
  };

  const smsTypePanel = hasCampaignFeature && smsTypes.length > 0 && (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: C.charcoal, margin: '0 0 4px' }}>
        What gets sent by text
      </h3>
      <p style={{ fontSize: 12, color: C.stone, lineHeight: 1.6, margin: '0 0 16px', fontFamily: 'var(--font-sans)' }}>
        Switch any of these off to save your message balance. Anything switched off still
        reaches guests by email, so nothing is ever missed.
      </p>

      <div className="fx-stack" style={{ gap: 2 }}>
        {smsTypes.map((t) => {
          const on = smsSettings[t.key] !== undefined ? !!smsSettings[t.key] : !!t.defaultEnabled;
          return (
            <label key={t.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
              borderBottom: `1px solid ${C.border}`, cursor: savingSettings ? 'wait' : 'pointer',
            }}>
              <input
                type="checkbox"
                checked={on}
                disabled={savingSettings}
                onChange={(e) => toggleSmsType(t.key, e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: C.gold, flexShrink: 0 }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.charcoal, fontFamily: 'var(--font-sans)' }}>
                  {t.label}
                  {t.audience === 'organizer' && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: C.stone, fontWeight: 400 }}>(to you)</span>
                  )}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: C.stone, lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
                  {t.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {Object.keys(skipSummary).length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: C.charcoal, margin: '0 0 6px', fontFamily: 'var(--font-sans)' }}>
            Messages not sent
          </p>
          {/* Wording comes from the server so this page, the message history and
              any support tooling describe the same reason identically. */}
          {Object.entries(skipSummary).map(([reason, count]) => (
            <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11.5, color: C.stone, padding: '2px 0', fontFamily: 'var(--font-sans)' }}>
              <span>{skipLabels[reason] || 'Could not be delivered'}</span>
              <span style={{ fontWeight: 600, color: C.charcoal }}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* The top-up modal, hoisted out of the main return so the ADD-ON-INACTIVE screen
     can render it too. That screen's entire purpose is to sell text messaging, and
     a button there opening a modal that lived only in the unlocked view would do
     nothing at all. Buying from either place hits the same endpoint, whose
     fulfilment unlocks the add-on as well as crediting the wallet. */
  const purchaseModal = showSMSModal && (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(25,27,30,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, width: '100%', maxWidth: 440, borderRadius: 16, padding: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: C.charcoal, fontFamily: 'var(--font-serif)' }}>
          {hasCampaignFeature ? 'Add more SMS messages' : 'Add text messaging'}
        </h3>
        <p style={{ fontSize: 12, color: C.stone, lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>
          Messages are used for RSVP confirmations, reminders, entry-pass links and your own
          campaigns. A 12.5% volume discount applies automatically from 500 messages up.
        </p>
        <p style={{ fontSize: 11, color: C.stone, lineHeight: 1.6, fontFamily: 'var(--font-sans)', background: C.softBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', margin: 0, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <Icon name="lock" size={12} strokeWidth={1.7} style={{ flexShrink: 0, marginTop: 2 }} /> These messages are added to <strong>this event&apos;s balance only</strong> — each event keeps its own, so they can&apos;t be moved to or shared with another event.
        </p>
        <form onSubmit={handleBuySMSCredits} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: C.stone, fontWeight: 600, display: 'block', marginBottom: 4 }}>Number of messages</label>
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
            <span style={{ fontSize: 10, color: C.stone, display: 'block', marginTop: 4 }}>Minimum purchase of 50 messages.</span>
          </div>

          {/* The price comes from the SERVER, priced by the same function the
              checkout charges with, so the number here and the number on the
              invoice cannot drift apart. The old block recomputed it in the
              browser with its own copy of the discount rules — which silently
              became wrong the moment an admin edited a discount tier. */}
          <div style={{ background: C.softBg, padding: 16, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topUpQuote?.discountPct > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: C.success }}>
                <span>Bulk saving:</span>
                <span>{topUpQuote.discountPct}% off</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, fontWeight: 700, color: C.gold }}>
              <span>You&apos;ll pay:</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22 }}>
                {topUpQuote ? `$${(topUpQuote.priceCents / 100).toFixed(2)}` : '…'}
              </span>
            </div>
            {topUpQuote?.coverage?.guests > 0 && (
              <div style={{ fontSize: 11.5, color: C.stone, lineHeight: 1.55, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                {topUpQuote.coverage.enough
                  ? `Enough for all ${topUpQuote.coverage.guests} of your guests.`
                  : `Covers about ${topUpQuote.coverage.coversInvitations} of your ${topUpQuote.coverage.guests} guests.`}
              </div>
            )}
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
              {buyingCredits ? 'Connecting to Stripe...' : 'Proceed to checkout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (hasCampaignFeature === false) {
    return (
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', background: C.white, border: `1px solid ${C.border}`, padding: '64px 32px', borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px', background: 'linear-gradient(135deg, rgba(215,190,128,0.15) 0%, rgba(184,148,79,0.15) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: C.charcoal, margin: 0 }}>Text messaging</h2>
          {/* Not an upsell to a bigger PLAN — SMS is sold per event on every plan.
              Sending someone to "View Plans" would have been a dead end: no tier
              they could buy would unlock this. The action is to buy the messages. */}
          <p style={{ fontSize: '14px', color: C.stone, maxWidth: 380, margin: '12px auto 0', lineHeight: 1.7 }}>
            Reach guests on their phones: RSVP confirmations, reminders, entry-pass links
            and your own campaigns. Available on any plan — add it to this event whenever
            you like.
          </p>
          <button
            onClick={() => setShowSMSModal(true)}
            style={{
              marginTop: 32, padding: '14px 36px', background: 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
              color: C.white, border: 'none', borderRadius: '30px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Add text messaging →
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              display: 'block', margin: '14px auto 0', padding: '8px 16px', background: 'transparent',
              color: C.stone, border: 'none', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Back to dashboard
          </button>
        </div>
        {purchaseModal}
      </div>
    );
  }

  return (
    <div className="camp-page" style={{ minHeight: '100vh', background: C.ivory, color: C.charcoal, padding: 32, fontFamily: 'var(--font-sans)' }}>

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
      <div className="fx-container fx-container--4xl" style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 24, marginBottom: 32, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/dashboard" style={{ color: C.gold, fontSize: 13, textDecoration: 'none', fontFamily: 'var(--font-sans)' }}
              onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
            >← Back to List</Link>
            <span style={{ color: C.border }}>/</span>
            <span style={{ fontSize: 10, textTransform: 'uppercase', color: C.stone, fontWeight: 700, letterSpacing: '0.1em' }}>Text messages</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 4, fontFamily: 'var(--font-serif)', color: C.charcoal }}>Text messages</h1>
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
              Add messages
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

      {/* Which lifecycle messages go by text, plus why any were skipped. Sits above
          the composer because it governs the automated majority of what this event
          sends — campaigns are the manual exception, not the main channel. */}
      <div className="fx-container fx-container--4xl">
        {smsTypePanel}
      </div>

      {/* Message history — every text, delivered or not, with the reason. This is
          the screen support opens when a guest says "I never got it". */}
      {hasCampaignFeature && (
        <div className="fx-container fx-container--4xl" style={{ marginBottom: 24 }}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: C.charcoal, margin: 0 }}>
                Message history
              </h3>
              <button
                type="button"
                onClick={loadMessageLog}
                style={{ background: 'transparent', border: 'none', padding: 0, color: C.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-sans)' }}
              >
                Refresh
              </button>
            </div>
            <p style={{ fontSize: 12, color: C.stone, lineHeight: 1.6, margin: '0 0 14px', fontFamily: 'var(--font-sans)' }}>
              Every text we tried to send, and what happened to it.
            </p>
            <MessageHistory
              entries={messageLog}
              loading={logLoading}
              onResend={handleResend}
              resendingId={resendingId}
            />
          </div>
        </div>
      )}

      <div className="fx-container fx-container--4xl" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 32 }}>

        {/* Left/Middle Column: Template Composer & Campaign launcher */}
        <div className="camp-main-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* 1. Your messages — the headline. Replaces a three-column grid of
                 "Purchased / Consumed / Remaining Balance", which asked the reader
                 to subtract two numbers to answer the only question they had. */}
          <MessagesRemainingCard
            balance={balance}
            coverage={coverage}
            onTopUp={() => setShowSMSModal(true)}
            canTopUp={smsEnabled}
          />

          {/* 2. Composer */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: 24, borderRadius: 12 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, borderBottom: `1px solid ${C.border}`, paddingBottom: 12, fontFamily: 'var(--font-serif)', color: C.charcoal }}>Send an announcement</h3>
            
            <div className="camp-composer-grid" style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 32, alignItems: 'start', marginTop: 24 }}>
              
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
                  <span style={{ fontSize: 10, color: C.stone }}>Pick more than one if you like (e.g. Not replied + Maybe). Only guests with a phone number are counted, and each gets their own personal link.</span>
                </div>

                {recipientCount > 0 ? (
                  <div style={{ background: C.softBg, padding: 16, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: C.stone, fontWeight: 600 }}>Recipients:</span>
                      <span style={{ fontWeight: 700, color: C.charcoal }}>{recipientCount} · {audienceLabel}</span>
                    </div>
                    {/* Everything here is stated in messages and guests. The old
                        version reported character counts, an encoding name and a
                        per-segment rate — four technical facts the organizer has
                        to combine themselves to answer "can I afford this?". */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: C.stone, fontWeight: 600 }}>Guests you&apos;ll reach:</span>
                      <span style={{ fontWeight: 700, color: C.charcoal }}>{recipientCount}</span>
                    </div>
                    {segmentsPerMsg > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span style={{ color: C.stone, fontWeight: 600 }}>Long message — counts as:</span>
                        <span style={{ fontWeight: 700, color: '#8A6D34' }}>{segmentsPerMsg} messages each</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10, fontWeight: 700 }}>
                      <span style={{ color: C.stone }}>This will use:</span>
                      <span style={{ color: C.gold }}>about {estimatedCredits} messages</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: C.stone }}>You have:</span>
                      <span style={{ fontWeight: 700, color: creditsRemaining >= estimatedCredits ? C.success : C.error }}>
                        {creditsRemaining} left
                      </span>
                    </div>
                    {segmentsPerMsg > 1 && (
                      <span style={{ fontSize: 10.5, color: C.stone, lineHeight: 1.6 }}>
                        Your message is long, so it counts as {segmentsPerMsg} messages per guest.
                        Shortening it would make it count as one.
                      </span>
                    )}
                    {/* Arabic and emoji halve what fits in a message. Said as a cost,
                        not as an encoding — the reader does not need to know the
                        word UCS-2 to act on this. */}
                    {segmentInfo.encoding === 'UCS-2' && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(196,94,94,0.06)', border: `1px solid rgba(196,94,94,0.25)`, borderRadius: 8, padding: '8px 10px' }}>
                        <Icon name="warning" size={13} strokeWidth={1.6} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 10.5, color: C.charcoal, lineHeight: 1.6 }}>
                          <strong>Arabic or special characters detected.</strong> Phone networks fit
                          less of this kind of text into one message, so it can use up to{' '}
                          <strong>3× as many</strong> per guest. Writing in plain English keeps it to one.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: C.softBg, padding: 16, border: `1px solid ${C.border}`, borderRadius: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: C.stone }}>No guests with a phone number in <strong>{audienceLabel}</strong>.</p>
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
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.stone, fontWeight: 700, marginBottom: 12 }}>How it will look</span>
                
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
                    <span style={{ fontSize: 12, color: C.stone, marginLeft: 'auto' }}>Messages used: <strong style={{ color: C.gold }}>{activeCampaign.creditsUsed || 0}</strong></span>
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
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon name={campaignReport.failed > 0 ? 'warning' : 'check'} size={13} strokeWidth={1.8} />
                  {campaignReport.failed > 0 ? 'Campaign Finished' : 'Campaign Dispatched'}:
                </strong>{' '}
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
                    <span style={{ fontSize: 9, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginTop: 2 }}>Messages</span>
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
                <span style={{ color: C.stone }}>This will use:</span>
                <strong style={{ color: C.charcoal }}>about {estimatedCredits} messages</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.stone }}>You have:</span>
                <strong style={{ color: C.gold }}>{creditsRemaining} messages</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                <span style={{ color: C.stone }}>Left afterwards:</span>
                <strong style={{ color: C.charcoal }}>about {creditsRemaining - estimatedCredits} messages</strong>
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.stone, fontFamily: 'var(--font-sans)', fontStyle: 'italic' }}>
              You&apos;re only charged for messages that are delivered — anything that fails is refunded automatically. The exact number can vary slightly with the length of each guest&apos;s name.
            </p>
            {/* Terms §5 consent attestation — required for every launch; recorded with the campaign. */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'rgba(184,148,79,0.06)', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consentAttested}
                onChange={e => setConsentAttested(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: C.gold, flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: C.charcoal, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
                I confirm every recipient has given prior consent to receive text messages about this event — guests who
                entered their own number agreed on the RSVP form, and for any numbers I added or imported myself I have
                obtained their express consent, as required by the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.gold, fontWeight: 700, textDecoration: 'underline' }}>Terms of Service</a>.
              </span>
            </label>
            {/* Delivery is gated on a recorded consent decision per guest
                (smsDispatch: sms_consent = true), whether that came from the
                guest's own opt-in or the organizer's attestation at add/import
                time. Say so, so a partial send reads as expected, not broken. */}
            <p style={{ fontSize: 11.5, color: C.stone, lineHeight: 1.6, fontFamily: 'var(--font-sans)', margin: 0 }}>
              Texts reach guests who opted in on their RSVP form, plus guests whose consent you confirmed when
              adding or importing them. Anyone with no recorded consent — or who declined, or replied STOP — is
              skipped automatically, and you are not charged for them.
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
                disabled={!consentAttested}
                onClick={async () => {
                  if (!consentAttested) return;
                  setShowConfirmSendModal(false);
                  await executeLaunchCampaign();
                }}
                style={{ padding: '8px 16px', background: consentAttested ? C.gold : C.border, color: consentAttested ? C.white : C.stone, fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: consentAttested ? 'pointer' : 'not-allowed', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}
                onMouseEnter={e => { if (consentAttested) e.currentTarget.style.background = C.goldHover; }}
                onMouseLeave={e => { if (consentAttested) e.currentTarget.style.background = C.gold; }}
              >
                Launch Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase SMS Credits Modal Overlay */}
      {purchaseModal}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        /* MOB-11: the SMS composer's editor+preview split, the wallet stat
           row, and the outer content/audience split were all fixed grids
           with zero breakpoints — unusable side-by-side on a phone. */
        @media (max-width: 1023.98px) {
          .camp-main-grid { grid-template-columns: 1fr !important; }
          .camp-composer-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 639.98px) {
          .camp-wallet-grid { grid-template-columns: 1fr !important; }
          .camp-page { padding: 16px !important; }
        }
      `}</style>
      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={logout} />
    </div>
  );
}
