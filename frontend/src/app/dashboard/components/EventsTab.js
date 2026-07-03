'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../utils/apiClient';
import EventSharePanel from './EventSharePanel';

/* ═══ Design Tokens ═══ */
const C = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF',
  softBg: '#FAFAF8', green: '#4A7C59', greenLight: 'rgba(74,124,89,0.08)',
  red: '#C45E5E', redLight: 'rgba(196,94,94,0.08)', purple: '#8B7EC8',
};

const STATUS_CFG = {
  active: { bg: 'rgba(74,124,89,0.07)', color: '#3A8B55', border: 'rgba(74,124,89,0.18)', label: 'Active', dot: '#4A7C59', pulse: true },
  pending_review: { bg: 'rgba(184,148,79,0.08)', color: '#9A7B2E', border: 'rgba(184,148,79,0.22)', label: 'Under Review', dot: '#B8944F', pulse: true },
  live: { bg: 'rgba(74,124,89,0.07)', color: '#3A8B55', border: 'rgba(74,124,89,0.18)', label: 'Live', dot: '#4A7C59', pulse: true },
  paused: { bg: 'rgba(210,160,60,0.07)', color: '#B08A1A', border: 'rgba(210,160,60,0.18)', label: 'Paused', dot: '#D2A03C', pulse: false },
  draft: { bg: 'rgba(210,160,60,0.07)', color: '#B08A1A', border: 'rgba(210,160,60,0.18)', label: 'Draft', dot: '#D2A03C', pulse: false },
  completed: { bg: 'rgba(107,142,174,0.07)', color: '#4A7A9B', border: 'rgba(107,142,174,0.18)', label: 'Completed', dot: '#6B8EAE', pulse: false },
  ended: { bg: 'rgba(107,142,174,0.07)', color: '#4A7A9B', border: 'rgba(107,142,174,0.18)', label: 'Ended', dot: '#6B8EAE', pulse: false },
};

const GRADS = [
  'linear-gradient(135deg, #B8944F 0%, #D7BE80 50%, #E8D5A8 100%)',
  'linear-gradient(135deg, #6B8EAE 0%, #A3C1D9 50%, #C4DAE8 100%)',
  'linear-gradient(135deg, #8B7EC8 0%, #B0A6D9 50%, #CFC9E8 100%)',
  'linear-gradient(135deg, #4A7C59 0%, #7AB08A 50%, #A3D4B0 100%)',
  'linear-gradient(135deg, #C4787A 0%, #E0A6A8 50%, #F0C8C9 100%)',
  'linear-gradient(135deg, #C4956A 0%, #E0B98E 50%, #F0D5B8 100%)',
];

/* ═══ CSS Keyframes ═══ */
const STYLES_ID = 'events-tab-v2-styles';
const CSS = `
@keyframes evtSlideUp {
  from { opacity:0; transform:translateY(24px) scale(0.97); }
  to   { opacity:1; transform:translateY(0) scale(1); }
}
@keyframes evtPulse {
  0%,100% { box-shadow:0 0 0 0 rgba(74,124,89,0.4); }
  50% { box-shadow:0 0 0 5px rgba(74,124,89,0); }
}
@keyframes evtExpandIn {
  from { opacity:0; max-height:0; padding-top:0; padding-bottom:0; }
  to   { opacity:1; max-height:2000px; padding-top:20px; padding-bottom:20px; }
}
@keyframes evtCollapseOut {
  from { opacity:1; max-height:2000px; padding-top:20px; padding-bottom:20px; }
  to   { opacity:0; max-height:0; padding-top:0; padding-bottom:0; }
}
@keyframes evtStatPop {
  from { opacity:0; transform:translateY(12px) scale(0.9); }
  to   { opacity:1; transform:translateY(0) scale(1); }
}
@keyframes evtShimmer {
  0% { background-position:-200% 0; }
  100% { background-position:200% 0; }
}
@keyframes evtRingDraw {
  from { stroke-dashoffset: var(--ring-len); }
  to   { stroke-dashoffset: var(--ring-offset); }
}
@keyframes evtFloat {
  0%,100% { transform:translateY(0); }
  50% { transform:translateY(-6px); }
}
@keyframes evtGradShift {
  0% { background-position:0% 50%; }
  50% { background-position:100% 50%; }
  100% { background-position:0% 50%; }
}
@keyframes evtCounterPulse {
  0%,100% { transform:scale(1); }
  50% { transform:scale(1.06); }
}
@keyframes evtDotPop {
  from { transform:scale(0); opacity:0; }
  to   { transform:scale(1); opacity:1; }
}

.evt2-card {
  position:relative; display:flex; flex-direction:column;
  background:#fff; border:1px solid #E8E2D6; border-radius:16px;
  overflow:hidden; cursor:pointer;
  transition:all 0.35s cubic-bezier(.22,1,.36,1);
  box-shadow:0 1px 4px rgba(0,0,0,0.03);
}
.evt2-card:hover {
  transform:translateY(-3px);
  box-shadow:0 16px 48px rgba(0,0,0,0.06),0 4px 12px rgba(184,148,79,0.06);
  border-color:rgba(184,148,79,0.25);
}
.evt2-card[data-active="true"] {
  border-color:#B8944F;
  box-shadow:0 4px 24px rgba(184,148,79,0.12);
}
.evt2-card[data-expanded="true"] {
  box-shadow:0 20px 60px rgba(0,0,0,0.08),0 4px 16px rgba(184,148,79,0.08);
}
.evt2-top { display:flex; align-items:stretch; }
.evt2-cover {
  width:120px; min-height:130px; flex-shrink:0;
  position:relative; overflow:hidden;
  transition:width 0.3s ease;
}
.evt2-cover::after {
  content:''; position:absolute; inset:0;
  background:linear-gradient(135deg,transparent 30%,rgba(0,0,0,0.1) 100%);
  pointer-events:none;
}
.evt2-actions { display:flex; align-items:center; gap:6px; margin-top:6px; }
.evt2-action-btn {
  display:inline-flex; align-items:center; gap:5px;
  padding:6px 14px; border-radius:8px;
  border:1px solid #E8E2D6; background:#fff;
  color:#77736A; font-size:11px; font-weight:600;
  font-family:var(--font-sans); cursor:pointer;
  transition:all 0.22s ease; white-space:nowrap;
}
.evt2-action-btn:hover {
  background:#F8F4EC; color:#B8944F;
  border-color:rgba(184,148,79,0.3);
  transform:translateY(-1px);
  box-shadow:0 3px 10px rgba(184,148,79,0.08);
}
.evt2-action-btn[data-variant="primary"] {
  background:linear-gradient(135deg,#B8944F,#D7BE80);
  color:#fff; border-color:transparent;
}
.evt2-action-btn[data-variant="primary"]:hover {
  box-shadow:0 4px 16px rgba(184,148,79,0.3);
  transform:translateY(-2px); color:#fff;
}
.evt2-action-btn[data-copied="true"] {
  background:rgba(74,124,89,0.06); border-color:rgba(74,124,89,0.25); color:#3A8B55;
}
.evt2-expand-panel {
  overflow:hidden; border-top:1px solid #F0ECE3;
  animation:evtExpandIn 0.45s cubic-bezier(.22,1,.36,1) forwards;
}
.evt2-create-btn {
  display:inline-flex; align-items:center; gap:8px;
  padding:10px 24px; border-radius:10px;
  background:linear-gradient(135deg,#B8944F,#D7BE80);
  background-size:200% 200%; animation:evtGradShift 4s ease infinite;
  color:#fff; font-size:13px; font-weight:700;
  font-family:var(--font-sans); text-decoration:none;
  letter-spacing:0.3px; transition:all 0.3s ease;
  box-shadow:0 4px 16px rgba(184,148,79,0.25); border:none; cursor:pointer;
}
.evt2-create-btn:hover {
  transform:translateY(-2px);
  box-shadow:0 8px 32px rgba(184,148,79,0.35);
}
@media(max-width:640px){
  .evt2-cover { width:80px; min-height:100px; }
  .evt2-actions { flex-wrap:wrap; }
}
`;

/* ═══ Helpers ═══ */
function fmtDate(d, end) {
  if (!d) return 'Date TBD';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 'Date TBD';
  const dOpts = { month: 'short', day: 'numeric', year: 'numeric' };
  const tOpts = { hour: 'numeric', minute: '2-digit', hour12: true };
  const dp = dt.toLocaleDateString('en-US', dOpts);
  const tp = dt.toLocaleTimeString('en-US', tOpts);
  if (end) {
    const ed = new Date(end);
    if (!isNaN(ed.getTime())) {
      if (dt.toDateString() === ed.toDateString()) return `${dp} · ${tp} — ${ed.toLocaleTimeString('en-US', tOpts)}`;
      return `${dp} — ${ed.toLocaleDateString('en-US', dOpts)}`;
    }
  }
  return `${dp} · ${tp}`;
}

function relDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  const days = Math.ceil((dt.getTime() - Date.now()) / 864e5);
  if (days < 0) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `In ${days}d`;
  return null;
}

function copyText(t) { navigator.clipboard?.writeText(t); }

/* ═══ Animated Counter Hook ═══ */
function useCounter(target, duration = 1200, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) { setVal(0); return; }
    const timer = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 4);
        setVal(Math.round(ease * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, duration, delay]);
  return val;
}

/* ═══ Mini Donut Ring ═══ */
function MiniDonut({ accepted, declined, pending, size = 64 }) {
  const total = accepted + declined + pending;
  if (total === 0) return null;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pctA = accepted / total;
  const pctD = declined / total;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background ring */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0ECE3" strokeWidth="5" />
      {/* Pending (full ring base) */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.champagne} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={0}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ '--ring-len': circ, '--ring-offset': circ * (1 - 1), animation: `evtRingDraw 1s ease-out 0.3s both` }}
      />
      {/* Declined */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.stone} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - (pctA + pctD))}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ '--ring-len': circ, '--ring-offset': circ * (1 - (pctA + pctD)), animation: `evtRingDraw 1s ease-out 0.5s both` }}
      />
      {/* Accepted */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.gold} strokeWidth="5.5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pctA)}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        strokeLinecap="round"
        style={{ '--ring-len': circ, '--ring-offset': circ * (1 - pctA), animation: `evtRingDraw 1s ease-out 0.4s both` }}
      />
      {/* Center text */}
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 14, fontWeight: 700, fill: C.charcoal, fontFamily: 'var(--font-sans)' }}>
        {Math.round(pctA * 100)}%
      </text>
    </svg>
  );
}

/* ═══ Stat Mini Card ═══ */
function MiniStat({ label, value, color, delay, icon }) {
  const animated = useCounter(value, 1000, delay);
  return (
    <div style={{
      flex: 1, minWidth: 100, padding: '14px 16px', borderRadius: 12,
      background: C.white, border: `1px solid ${C.border}`,
      animation: `evtStatPop 0.5s cubic-bezier(.22,1,.36,1) ${delay}ms both`,
      transition: 'all 0.25s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: C.stone, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || C.charcoal, fontFamily: 'var(--font-sans)', lineHeight: 1 }}>
        {animated}
      </div>
    </div>
  );
}

/* ═══ Payment method icons ═══ */
const METHOD_ICON = { bank: '🏦', wallet: '📱', instapay: '⚡', cash: '💵', paypal: '🅿️', other: '💳' };

function PayCopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button type="button"
      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      style={{ border: `1px solid ${C.border}`, background: C.white, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: copied ? C.green : C.gold, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

/* ═══ Event Payment / Activation Panel ═══ */
function EventPaymentPanel({ eventId, event, upgradeFromTier = null }) {
  const [pricingTiers, setPricingTiers] = useState([]);
  const [manualMethods, setManualMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [chosenMethod, setChosenMethod] = useState('');
  const [payerRef, setPayerRef] = useState('');
  const [pendingRef, setPendingRef] = useState(null);
  const [activatedFree, setActivatedFree] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const isUpgrade = !!upgradeFromTier;
  const initialPendingPayment = event.event_payments?.find(
    p => p.payment_method === 'cash_manual' && p.status === 'pending'
  );

  useEffect(() => {
    if (initialPendingPayment) {
      setPendingRef(initialPendingPayment.reference_number || initialPendingPayment.stripe_checkout_session_id);
    }
    const loadPricing = async () => {
      try {
        const res = await apiFetch('/payments/pricing-config');
        if (res.success && res.config?.pricing_tiers) {
          const all = res.config.pricing_tiers;
          setPricingTiers(all);
          setManualMethods((res.config.manual_payment_methods || []).filter(m => m && m.is_active !== false));
          // Default selection: first billable (and, in upgrade mode, strictly
          // higher-priced) tier — an upgrade charges only the difference from the
          // already-paid plan (see dueNowCents below), never the full new price.
          const billable = all.filter(t => t && t.is_custom !== true);
          const curPrice = upgradeFromTier ? (all.find(t => t.name === upgradeFromTier)?.price_cents ?? null) : null;
          const disp = (upgradeFromTier && curPrice != null) ? billable.filter(t => t.price_cents > curPrice) : billable;
          setSelectedTier(disp[0] || null);
        }
      } catch (e) {
        console.error('Failed to load pricing config', e);
      } finally {
        setLoading(false);
      }
    };
    loadPricing();
  }, [initialPendingPayment, upgradeFromTier]);

  // Tiers shown: billable only; in upgrade mode, only strictly higher-priced.
  const billableTiers = pricingTiers.filter(t => t && t.is_custom !== true);
  const currentPrice = upgradeFromTier ? (pricingTiers.find(t => t.name === upgradeFromTier)?.price_cents ?? null) : null;
  const displayTiers = (isUpgrade && currentPrice != null)
    ? billableTiers.filter(t => t.price_cents > currentPrice)
    : billableTiers;
  // PRICING-1: mirrors the backend's createCheckoutSession/initiateManualPayment
  // proration — an upgrade is charged the difference, never the new tier's full price.
  const isProratedTier = (tierPriceCents) => currentPrice != null && tierPriceCents > currentPrice;
  const dueNowCents = (tierPriceCents) => isProratedTier(tierPriceCents) ? tierPriceCents - currentPrice : tierPriceCents;

  const handleStripePayment = async () => {
    if (!selectedTier) return;
    setProcessing(true);
    setError('');
    try {
      const res = await apiFetch(`/payments/events/${eventId}/create-checkout`, {
        method: 'POST',
        body: JSON.stringify({ eventId, tierName: selectedTier.name, returnPath: '/dashboard' })
      });
      if (res.activated) {
        // Free ($0) tier — activated synchronously server-side, no Stripe round-trip.
        setActivatedFree(true);
        setTimeout(() => window.location.reload(), 1200);
      } else if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch (e) {
      setError(e.message || 'An error occurred during payment processing.');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualPayment = async () => {
    if (!selectedTier) return;
    setProcessing(true);
    setError('');
    try {
      const methodLabel = chosenMethod || (manualMethods[0]?.label || 'Manual Transfer');
      const res = await apiFetch(`/payments/events/${eventId}/manual-payment`, {
        method: 'POST',
        body: JSON.stringify({
          tierName: selectedTier.name,
          methodLabel,
          payerReference: payerRef.trim() || undefined,
        })
      });
      if (res.success && res.referenceNumber) {
        setPendingRef(res.referenceNumber);
      } else {
        throw new Error(res.message || 'Manual payment initiation failed.');
      }
    } catch (e) {
      setError(e.message || 'An error occurred during payment processing.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    // Skeleton mirrors the pricing-tier list shape so the panel doesn't jump when
    // tiers arrive. Reuses the file's existing `evtShimmer` keyframe.
    const skel = (w, h, r = 8) => ({
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #F0ECE3 25%, #F8F5EF 37%, #F0ECE3 63%)',
      backgroundSize: '200% 100%', animation: 'evtShimmer 1.4s ease-in-out infinite',
    });
    return (
      <div aria-busy="true" aria-label="Loading pricing" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
        <div style={{ ...skel('150px', 14), marginBottom: '4px' }} />
        {[0, 1].map(i => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #F0ECE3', borderRadius: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={skel('120px', 13)} />
              <div style={skel('80px', 11)} />
            </div>
            <div style={skel('64px', 24, 12)} />
          </div>
        ))}
        <div style={{ ...skel('100%', 44, 22), marginTop: '4px' }} />
      </div>
    );
  }

  if (activatedFree) {
    return (
      <div style={{ padding: '20px 24px', background: 'rgba(59,155,109,0.06)', border: '1px solid rgba(59,155,109,0.25)', borderRadius: '12px', textAlign: 'center' }}>
        <span style={{ fontSize: '32px' }}>✓</span>
        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: C.charcoal, margin: '8px 0 4px' }}>Plan Activated</h4>
        <p style={{ fontSize: '12px', color: C.stone, lineHeight: 1.5, margin: 0, fontFamily: 'var(--font-sans)' }}>
          Your free plan is now active. Refreshing…
        </p>
      </div>
    );
  }

  if (pendingRef) {
    return (
      <div style={{ padding: '20px 24px', background: 'rgba(245,158,11,0.05)', border: `1px solid rgba(245,158,11,0.2)`, borderRadius: '12px', textAlign: 'center' }}>
        <span style={{ fontSize: '32px' }}>⏳</span>
        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: '#D97706', margin: '8px 0 4px' }}>Payment Pending</h4>
        <p style={{ fontSize: '12px', color: C.stone, lineHeight: 1.5, margin: '0 0 16px', fontFamily: 'var(--font-sans)' }}>
          Your offline cash payment request has been submitted successfully. Please share this reference code with the coordinator for manual activation:
        </p>
        <div style={{ background: '#FFFFFF', border: `1px solid rgba(245,158,11,0.2)`, display: 'inline-block', padding: '10px 24px', borderRadius: '8px', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: '#D97706', letterSpacing: '1px' }}>
          {pendingRef}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'evtStatPop 0.5s ease both' }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: '12px' }}>
        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: C.charcoal, margin: 0 }}>{isUpgrade ? 'Upgrade Your Plan' : 'Activate Event Page'}</h4>
        <p style={{ fontSize: '12px', color: C.stone, margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>
          {isUpgrade
            ? 'Choose a higher tier below. Upgrading is a one-time charge for the new license.'
            : 'This event is currently offline. Choose a license tier to bring it online.'}
        </p>
      </div>

      {displayTiers.length === 0 ? (
        <p style={{ fontSize: '12px', color: C.stone, fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
          You&apos;re already on the highest available plan.
        </p>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {displayTiers.map(tier => {
          const isSelected = selectedTier && selectedTier.name === tier.name;
          return (
            <div key={tier.name} onClick={() => setSelectedTier(tier)}
              style={{
                background: isSelected ? 'rgba(184,148,79,0.05)' : C.white,
                border: isSelected ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
                borderRadius: '10px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s',
              }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: C.charcoal, display: 'block' }}>{tier.name} License</span>
              <span style={{ fontSize: '11px', color: C.stone, display: 'block', marginTop: '2px' }}>Up to {tier.max_guests} Guests</span>
              {isProratedTier(tier.price_cents) && (
                <span style={{ fontSize: '11px', color: C.stone, display: 'block', marginTop: '8px', textDecoration: 'line-through', opacity: 0.7 }}>
                  ${(tier.price_cents / 100).toFixed(2)}
                </span>
              )}
              <span style={{ fontSize: '16px', fontWeight: 900, color: C.gold, display: 'block', marginTop: isProratedTier(tier.price_cents) ? '2px' : '10px' }}>
                ${(dueNowCents(tier.price_cents) / 100).toFixed(2)} USD{isProratedTier(tier.price_cents) ? ' due now' : ''}
              </span>
            </div>
          );
        })}
      </div>
      )}

      {error && (
        <div style={{ fontSize: '12px', color: '#C45E5E', background: '#FEF2F2', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {!showManual ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button onClick={handleStripePayment} disabled={processing || !selectedTier}
            style={{
              flex: '1 1 180px', height: 48,
              background: (processing || !selectedTier) ? '#C9C4BA' : 'linear-gradient(135deg, #B8944F, #a6833f)',
              color: '#FFFFFF', border: 'none', borderRadius: 12,
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
              cursor: (processing || !selectedTier) ? 'not-allowed' : 'pointer',
              boxShadow: (processing || !selectedTier) ? 'none' : '0 4px 16px rgba(184,148,79,0.28)',
              transition: 'all 0.2s',
            }}>
            {processing ? 'Processing...' : `💳 ${isUpgrade ? 'Pay & Upgrade with Card' : 'Pay with Card'}${selectedTier ? ` · $${(dueNowCents(selectedTier.price_cents) / 100).toFixed(2)}` : ''}`}
          </button>
          <button onClick={() => setShowManual(true)} disabled={processing || !selectedTier}
            style={{
              flex: '1 1 180px', height: 48,
              background: C.white, color: C.charcoal,
              border: `1.5px solid ${C.charcoal}`, borderRadius: 12,
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
              cursor: (processing || !selectedTier) ? 'not-allowed' : 'pointer',
              opacity: (processing || !selectedTier) ? 0.5 : 1,
              transition: 'all 0.2s',
            }}>
            🏦 Manual / Bank Transfer
          </button>
        </div>
      ) : (
        <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: C.charcoal, margin: 0 }}>Pay by Manual Transfer</h4>
            <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', color: C.stone, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-sans)' }}>← Other methods</button>
          </div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, margin: '0 0 14px', lineHeight: 1.6 }}>
            Transfer the platform fee to one of the accounts below, then submit your proof. We&apos;ll verify and activate your event.
          </p>

          {selectedTier && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              background: 'rgba(184,148,79,0.06)', border: '1px solid rgba(184,148,79,0.2)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.charcoal, fontWeight: 600 }}>
                {isUpgrade ? 'Upgrading to ' : 'Activating '}<strong>{selectedTier.name}</strong>
                {selectedTier.max_guests > 0 ? ` · up to ${selectedTier.max_guests} guests` : ' · unlimited guests'}
                {isProratedTier(selectedTier.price_cents) && (
                  <span style={{ display: 'block', fontWeight: 400, color: C.stone, fontSize: 11, marginTop: 2 }}>
                    Full price ${(selectedTier.price_cents / 100).toFixed(2)} − ${(currentPrice / 100).toFixed(2)} already paid
                  </span>
                )}
              </span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: C.gold }}>${(dueNowCents(selectedTier.price_cents) / 100).toFixed(2)}</span>
            </div>
          )}

          {manualMethods.length === 0 ? (
            <div style={{ background: C.softBg, border: `1px dashed ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, margin: 0 }}>
                No payment accounts are published yet. You can still generate a reference code and our team will share transfer details with you.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {manualMethods.map((m, i) => {
                const sel = (chosenMethod || manualMethods[0]?.label) === m.label;
                return (
                  <div key={m.id || i} onClick={() => setChosenMethod(m.label)}
                    style={{
                      border: sel ? `2px solid ${C.gold}` : `1.5px solid ${C.border}`,
                      background: sel ? 'rgba(184,148,79,0.05)' : C.white,
                      borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: (m.details || m.instructions) ? 10 : 0 }}>
                      <span style={{ fontSize: 18 }}>{METHOD_ICON[m.type] || METHOD_ICON.other}</span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: C.charcoal, flex: 1 }}>{m.label}</span>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        border: sel ? `2px solid ${C.gold}` : `2px solid ${C.border}`,
                        background: sel ? C.gold : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    {m.details && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.softBg, borderRadius: 8, padding: '8px 12px', marginBottom: m.instructions ? 8 : 0 }}>
                        <code style={{ fontFamily: 'monospace', fontSize: 12, color: C.charcoal, fontWeight: 600, flex: 1, wordBreak: 'break-all' }}>{m.details}</code>
                        <PayCopyBtn value={m.details} />
                      </div>
                    )}
                    {m.instructions && (
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.stone, margin: 0, lineHeight: 1.5 }}>ℹ️ {m.instructions}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Your Transfer Reference (optional)
            </label>
            <input type="text" value={payerRef} onChange={e => setPayerRef(e.target.value)}
              placeholder="e.g. transaction ID, sender name"
              style={{
                width: '100%', padding: '10px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10,
                fontFamily: 'var(--font-sans)', fontSize: 13, color: C.charcoal,
                outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = C.gold; }}
              onBlur={e => { e.target.style.borderColor = C.border; }}
            />
          </div>

          <button onClick={handleManualPayment} disabled={processing || !selectedTier}
            style={{
              width: '100%', height: 44,
              background: (processing || !selectedTier) ? '#C9C4BA' : 'linear-gradient(135deg, #B8944F, #a6833f)',
              color: '#FFFFFF', border: 'none', borderRadius: 10,
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
              cursor: (processing || !selectedTier) ? 'not-allowed' : 'pointer',
              boxShadow: (processing || !selectedTier) ? 'none' : '0 3px 14px rgba(184,148,79,0.25)',
              transition: 'all 0.2s',
            }}>
            {processing ? 'Processing...' : (isUpgrade ? 'Submit Upgrade Transfer' : 'Submit Transfer Request')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══ Current Plan + Upgrade (paid events) ═══ */
function CurrentPlanBlock({ eventId, event }) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [hasUpgrades, setHasUpgrades] = useState(null);
  const isComplimentary = !!event.manual_override;
  const planName = event.tier_name || (isComplimentary ? 'Complimentary Plan' : 'Active Plan');
  const maxGuests = event.tier_max_guests;

  // Check whether higher tiers exist so we can hide the "Upgrade" button at the ceiling.
  useEffect(() => {
    const check = async () => {
      try {
        const res = await apiFetch('/payments/pricing-config');
        if (res.success && res.config?.pricing_tiers) {
          const all = res.config.pricing_tiers;
          const curTier = all.find(t => t.name === event.tier_name);
          // Custom / enterprise tiers are the ceiling — no upgrades available.
          if (curTier?.is_custom) { setHasUpgrades(false); return; }
          const billable = all.filter(t => t && t.is_custom !== true);
          const curPrice = curTier?.price_cents ?? null;
          const higher = (curPrice != null) ? billable.filter(t => t.price_cents > curPrice) : [];
          setHasUpgrades(higher.length > 0);
        } else {
          setHasUpgrades(false);
        }
      } catch {
        setHasUpgrades(false);
      }
    };
    if (event.tier_name) check();
    else setHasUpgrades(true);
  }, [event.tier_name]);

  // Manual payment receipt data for approved cash payments. An event can have
  // more than one completed cash_manual row (the original payment, then a later
  // upgrade) — take the most recently completed one, not just the first match,
  // or the receipt keeps showing the old plan's price after an upgrade.
  const manualPayment = (event.event_payments || [])
    .filter(p => p.payment_method === 'cash_manual' && p.status === 'completed')
    .sort((a, b) => new Date(b.completed_at || b.created_at || 0) - new Date(a.completed_at || a.created_at || 0))[0];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFFDF7 0%, #FFFFFF 100%)',
      border: `1.5px solid ${C.gold}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-sans)' }}>Current Plan</span>
          <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: C.charcoal, margin: '2px 0 2px' }}>
            {planName}
            {isComplimentary && (
              <span style={{
                marginLeft: 8, fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 700, color: C.gold,
                background: 'rgba(184,148,79,0.10)', border: '1px solid rgba(184,148,79,0.25)',
                padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle',
              }}>Complimentary</span>
            )}
          </h4>
          <span style={{ fontSize: 12, color: C.stone, fontFamily: 'var(--font-sans)' }}>
            {maxGuests > 0 ? `Up to ${maxGuests} guests` : 'Unlimited guests'}
          </span>
          {isComplimentary && event.comp_reason && (
            <span style={{ display: 'block', fontSize: 11, color: C.stone, fontFamily: 'var(--font-sans)', marginTop: 2 }}>
              Granted by Fancy RSVP — {event.comp_reason}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100,
            background: 'rgba(74,124,89,0.10)', border: '1px solid rgba(74,124,89,0.25)',
            fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: '#3A8B55', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A7C59' }} /> Active
          </span>
          {hasUpgrades === true && (
            <button onClick={() => setShowUpgrade(s => !s)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none',
              background: showUpgrade ? C.white : 'linear-gradient(135deg, #B8944F, #D7BE80)',
              color: showUpgrade ? C.stone : C.white, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', boxShadow: showUpgrade ? 'none' : '0 3px 12px rgba(184,148,79,0.28)',
              ...(showUpgrade ? { border: `1px solid ${C.border}` } : {}),
            }}>
              {showUpgrade ? 'Close' : (<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>Upgrade Plan</>)}
            </button>
          )}
          {hasUpgrades === false && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 100,
              background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.18)',
              fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z"/></svg>
              Max Plan
            </span>
          )}
        </div>
      </div>
      {/* Manual payment receipt */}
      {manualPayment && (
        <div style={{ marginTop: 14, padding: '14px 16px', background: '#FAFAF8', border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
            💵 Manual Payment Receipt
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, fontFamily: 'var(--font-sans)', color: C.charcoal }}>
            {manualPayment.reference_number && (
              <div><span style={{ color: C.stone }}>Ref: </span><strong>{manualPayment.reference_number}</strong></div>
            )}
            {manualPayment.amount_cents != null && (
              <div><span style={{ color: C.stone }}>Amount: </span><strong>${(manualPayment.amount_cents / 100).toFixed(2)}</strong></div>
            )}
            {manualPayment.manual_method && (
              <div><span style={{ color: C.stone }}>Method: </span>{manualPayment.manual_method}</div>
            )}
            {manualPayment.completed_at && (
              <div><span style={{ color: C.stone }}>Approved: </span>{new Date(manualPayment.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            )}
          </div>
        </div>
      )}

      {showUpgrade && (
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
          <EventPaymentPanel eventId={eventId} event={event} upgradeFromTier={event.tier_name || null} />
        </div>
      )}
    </div>
  );
}

/* ═══ Expanded Panel ═══ */
function ExpandedPanel({ eventId, event, onClose }) {
  const isPaid = event.is_paid;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(!isPaid ? false : true);

  useEffect(() => {
    if (!isPaid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch(`/events/${eventId}/stats`);
        if (!cancelled) setStats(res.stats);
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [eventId, isPaid]);

  if (!isPaid) {
    return (
      <div className="evt2-expand-panel" style={{ padding: '20px 24px', background: '#FDFCFA' }}>
        <EventPaymentPanel eventId={eventId} event={event} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="evt2-expand-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{
              flex: 1, height: 72, borderRadius: 12,
              background: 'linear-gradient(90deg, #F0ECE3 25%, #FAF8F4 37%, #F0ECE3 63%)',
              backgroundSize: '800px 100%', animation: 'evtShimmer 1.4s ease infinite',
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const accepted = stats.attendingGuests || 0;
  const declined = stats.declinedGuests || 0;
  const pending = stats.pendingGuests || 0;
  const total = accepted + declined + pending;
  const checkedIn = stats.checkedInGuests || 0;
  const seated = stats.seatingAssignedGuests || 0;

  return (
    <div className="evt2-expand-panel" style={{ padding: '20px 24px', background: '#FDFCFA' }}>
      {/* Current Plan + Upgrade */}
      <CurrentPlanBlock eventId={eventId} event={event} />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Donut */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'evtStatPop 0.5s ease both' }}>
          <MiniDonut accepted={accepted} declined={declined} pending={pending} size={72} />
          <div style={{ fontSize: 10, color: C.stone, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>RSVP Rate</div>
        </div>

        {/* Stats grid */}
        <div style={{ flex: 1, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <MiniStat label="Attending" value={accepted} color={C.green} delay={100}
            icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
          />
          <MiniStat label="Declined" value={declined} color={C.red} delay={180}
            icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
          />
          <MiniStat label="Pending" value={pending} color={C.champagne} delay={260}
            icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.champagne} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <MiniStat label="Checked In" value={checkedIn} color={C.purple} delay={340}
            icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          />
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: C.stone, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Response Progress</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.gold, fontFamily: 'var(--font-sans)' }}>{total} total</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#F0ECE3', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${(accepted/total)*100}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.champagne})`, borderRadius: 3, transition: 'width 1s ease' }} />
            <div style={{ width: `${(declined/total)*100}%`, background: C.stone, transition: 'width 1s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {[{ l: 'Accepted', c: C.gold, v: accepted }, { l: 'Declined', c: C.stone, v: declined }, { l: 'Pending', c: C.champagne, v: pending }].map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.stone, fontFamily: 'var(--font-sans)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.c }} />
                {s.l}: <strong style={{ color: C.charcoal }}>{s.v}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meal summary if present */}
      {stats.mealSummary && Object.keys(stats.mealSummary).length > 0 && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, animation: 'evtStatPop 0.6s ease 0.4s both' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.stone, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>🍽 Meal Selections</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(stats.mealSummary).map(([meal, count]) => (
              <span key={meal} style={{ padding: '3px 10px', borderRadius: 8, background: 'rgba(184,148,79,0.06)', fontSize: 11, fontFamily: 'var(--font-sans)', color: C.charcoal, fontWeight: 500 }}>
                {meal}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Share & QR Code Section */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.stone, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          🔗 Share &amp; QR Code
        </div>
        <EventSharePanel event={event} compact />
      </div>
    </div>
  );
}

/* ═══ Icons ═══ */
const PlusIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
const ChevronIcon = ({ open }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transition: 'transform 0.3s ease', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}><polyline points="6 9 12 15 18 9"/></svg>);

/* ═══ Event Card ═══ */
const EventCard = React.memo(function EventCard({ event, index, isActive, onSelect }) {
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isPaid = event.is_paid;
  const status = !isPaid
    ? { bg: 'rgba(196,94,94,0.08)', color: '#C45E5E', border: 'rgba(196,94,94,0.18)', label: 'Payment Required', dot: '#C45E5E', pulse: false }
    : (STATUS_CFG[event.status] || STATUS_CFG.active);
  const gradient = GRADS[index % GRADS.length];
  const eventDate = event.event_date || event.date;
  const rel = relDate(eventDate);

  const handleCopy = useCallback((e) => {
    e.stopPropagation();
    copyText(`${window.location.origin}/${event.slug || event.id}`);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 1800);
  }, [event.slug, event.id]);

  const toggleExpand = useCallback((e) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  }, []);

  const goSettings = useCallback((e) => {
    e.stopPropagation();
    onSelect(event.id, 'settings');
  }, [event.id, onSelect]);

  // "Pay Later" activation: open the inline payment panel so organizers can review
  // their pricing tiers and choose card vs. offline cash before heading to Stripe.
  // (The panel's own CTA performs the create-checkout + full-page redirect.)
  const handleActivateNow = useCallback((e) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  }, []);

  return (
    <div
      className="evt2-card"
      data-active={isActive}
      data-expanded={expanded}
      style={{ animation: `evtSlideUp 0.55s cubic-bezier(.22,1,.36,1) ${index * 0.08}s both` }}
    >
      {/* ── Top Row (Clickable) ── */}
      <div className="evt2-top"
        role="button" tabIndex={0}
        data-testid={`event-card-${event.slug}`}
        onClick={() => onSelect(event.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(event.id); }}
      >
        {/* Cover */}
        <div className="evt2-cover" style={{
          background: event.cover_image_url
            ? `url(${event.cover_image_url}) center/cover no-repeat`
            : gradient,
        }}>
          {!event.cover_image_url && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 34, fontFamily: 'var(--font-serif)',
              fontWeight: 700, textShadow: '0 2px 10px rgba(0,0,0,0.2)',
            }}>
              {event.title ? event.title.charAt(0).toUpperCase() : 'E'}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, minWidth: 0 }}>
          {/* Title + Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h3 style={{
              fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700,
              color: C.charcoal, margin: 0, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {event.title}
            </h3>
            <span style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 20,
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              background: status.bg, color: status.color, border: `1px solid ${status.border}`,
              fontFamily: 'var(--font-sans)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: status.dot,
                animation: status.pulse ? 'evtPulse 2s ease-in-out infinite' : 'none',
              }} />
              {status.label}
            </span>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.stone, fontFamily: 'var(--font-sans)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>{fmtDate(eventDate, event.end_date || event.event_end_date)}</span>
              {rel && (
                <span style={{
                  padding: '1px 8px', borderRadius: 10,
                  background: rel === 'Today' ? C.greenLight : 'rgba(184,148,79,0.08)',
                  color: rel === 'Today' ? '#3A8B55' : C.gold,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                }}>
                  {rel}
                </span>
              )}
            </div>
            {(event.location_name || event.location_address) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.stone, fontFamily: 'var(--font-sans)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                  {event.location_name || event.location_address}
                </span>
              </div>
            )}
            {isPaid && event.tier_name && (
              <div title={event.manual_override ? (event.comp_reason || 'Granted free by Fancy RSVP') : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.gold, fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z"/></svg>
                <span>{event.manual_override ? `Complimentary — ${event.tier_name}` : event.tier_name}</span>
              </div>
            )}
          </div>

          {/* ── Pay-Later Activation CTA (unpaid / draft events) ── */}
          {!isPaid && (
            <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
              <button
                onClick={handleActivateNow}
                aria-expanded={expanded}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '13px 18px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #B8944F 0%, #D7BE80 50%, #B8944F 100%)',
                  backgroundSize: '200% 100%',
                  color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 800,
                  letterSpacing: '0.02em', cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(184,148,79,0.35)',
                  animation: expanded ? 'none' : 'evtGradShift 4s ease infinite',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(184,148,79,0.45)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(184,148,79,0.35)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                {expanded ? 'Hide payment options' : 'Complete Payment · Activate Event'}
                <ChevronIcon open={expanded} />
              </button>
              <span style={{ display: 'block', margin: '6px auto 0', textAlign: 'center', fontSize: 11, color: C.stone, fontFamily: 'var(--font-sans)' }}>
                Choose a tier · pay by card or offline cash
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="evt2-actions">
            <button className="evt2-action-btn" data-variant="primary" onClick={toggleExpand}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
              {expanded ? 'Hide Stats' : 'View Dashboard'}
              <ChevronIcon open={expanded} />
            </button>
            <button className="evt2-action-btn" onClick={goSettings}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Settings
            </button>
            <button className="evt2-action-btn" data-copied={copiedSlug ? "true" : "false"} onClick={handleCopy}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {copiedSlug ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Expanded Stats Panel ── */}
      {expanded && (
        <ExpandedPanel eventId={event.id} event={event} onClose={() => setExpanded(false)} />
      )}
    </div>
  );
});

/* ═══ Empty State ═══ */
function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', textAlign: 'center' }}>
      <div style={{ animation: 'evtFloat 3s ease-in-out infinite', marginBottom: 28 }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="36" stroke="#E8E2D6" strokeWidth="1.5" strokeDasharray="4 3" />
          <rect x="24" y="22" width="32" height="36" rx="4" fill="#F8F4EC" stroke="#D7BE80" strokeWidth="1.2" />
          <line x1="30" y1="18" x2="30" y2="26" stroke="#D7BE80" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="50" y1="18" x2="50" y2="26" stroke="#D7BE80" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="24" y1="32" x2="56" y2="32" stroke="#D7BE80" strokeWidth="1" />
          <circle cx="33" cy="40" r="2" fill="#B8944F" opacity="0.5" /><circle cx="40" cy="40" r="2" fill="#B8944F" opacity="0.7" /><circle cx="47" cy="40" r="2" fill="#B8944F" opacity="0.5" />
          <path d="M60 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#B8944F" opacity="0.3" />
        </svg>
      </div>
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, color: C.charcoal, margin: '0 0 8px' }}>No Events Yet</h3>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone, maxWidth: 340, lineHeight: 1.65, margin: '0 0 32px' }}>
        Create your first event to begin managing invitations, RSVPs, and seating — all from one elegant dashboard.
      </p>
      <Link href="/dashboard/create-event" className="evt2-create-btn"><PlusIcon /> Create Your First Event</Link>
    </div>
  );
}

/* ═══ Main ═══ */
export default function EventsTab({ events = [], activeEventId, onSelectEvent, onRefresh }) {
  const [refreshSpin, setRefreshSpin] = useState(false);

  // Unfinished drafts live in their own Drafts tab — keep this list to real events only.
  const visibleEvents = events.filter(e => !(e && e.status === 'draft' && !e.is_paid));

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById(STYLES_ID)) {
      const el = document.createElement('style');
      el.id = STYLES_ID; el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshSpin(true);
    onRefresh?.();
    setTimeout(() => setRefreshSpin(false), 800);
  }, [onRefresh]);

  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #F0ECE3', paddingBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: C.charcoal, margin: 0 }}>Your Events</h2>
          {visibleEvents.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 26, height: 26, padding: '0 8px', borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(184,148,79,0.10), rgba(215,190,128,0.10))',
              color: C.gold, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
              border: '1px solid rgba(184,148,79,0.18)',
            }}>
              {visibleEvents.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onRefresh && (
            <button onClick={handleRefresh} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, borderRadius: 10, border: `1px solid ${C.border}`,
              background: C.white, color: C.stone, cursor: 'pointer',
              transition: 'all 0.3s ease',
              transform: refreshSpin ? 'rotate(180deg)' : 'rotate(0)',
            }} title="Refresh">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
          )}
          <Link href="/dashboard/create-event" className="evt2-create-btn"><PlusIcon /> Create Event</Link>
        </div>
      </div>

      {/* Event List */}
      {visibleEvents.length === 0 ? <EmptyState /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {visibleEvents.map((evt, i) => (
            <EventCard key={evt.id} event={evt} index={i} isActive={evt.id === activeEventId} onSelect={onSelectEvent} />
          ))}
        </div>
      )}
    </div>
  );
}
