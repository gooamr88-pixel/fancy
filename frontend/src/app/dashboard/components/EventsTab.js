'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../utils/apiClient';
import EventQRCode from './EventQRCode';

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
  to   { opacity:1; max-height:600px; padding-top:20px; padding-bottom:20px; }
}
@keyframes evtCollapseOut {
  from { opacity:1; max-height:600px; padding-top:20px; padding-bottom:20px; }
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

/* ═══ Event Payment / Activation Panel ═══ */
function EventPaymentPanel({ eventId, event }) {
  const [pricingTiers, setPricingTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [pendingRef, setPendingRef] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const initialPendingPayment = event.event_payments?.find(
    p => p.payment_method === 'cash_manual' && p.status === 'pending'
  );

  useEffect(() => {
    if (initialPendingPayment) {
      setPendingRef(initialPendingPayment.stripe_checkout_session_id);
    }
    const loadPricing = async () => {
      try {
        const res = await apiFetch('/payments/pricing-config');
        if (res.success && res.config?.pricing_tiers) {
          setPricingTiers(res.config.pricing_tiers);
          setSelectedTier(res.config.pricing_tiers[0]);
        }
      } catch (e) {
        console.error('Failed to load pricing config', e);
      } finally {
        setLoading(false);
      }
    };
    loadPricing();
  }, [initialPendingPayment]);

  const handlePayment = async () => {
    if (!selectedTier) return;
    setProcessing(true);
    setError('');

    try {
      if (paymentMethod === 'stripe') {
        const res = await apiFetch(`/payments/events/${eventId}/create-checkout`, {
          method: 'POST',
          body: JSON.stringify({ eventId, tierName: selectedTier.name })
        });
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else {
          throw new Error('No checkout URL returned.');
        }
      } else {
        const res = await apiFetch(`/payments/events/${eventId}/manual-payment`, {
          method: 'POST',
          body: JSON.stringify({ tierName: selectedTier.name })
        });
        if (res.success && res.referenceNumber) {
          setPendingRef(res.referenceNumber);
        } else {
          throw new Error(res.message || 'Manual payment initiation failed.');
        }
      }
    } catch (e) {
      setError(e.message || 'An error occurred during payment processing.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid rgba(184,148,79,0.2)', borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (pendingRef) {
    return (
      <div style={{ padding: '20px 24px', background: 'rgba(245,158,11,0.05)', border: `1px solid rgba(245,158,11,0.2)`, borderRadius: '12px', textAlign: 'center' }}>
        <span style={{ fontSize: '32px' }}>⏳</span>
        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: '#D97706', margin: '8px 0 4px' }}>Payment Verification Pending</h4>
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
        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: C.charcoal, margin: 0 }}>Activate Event Page</h4>
        <p style={{ fontSize: '12px', color: C.stone, margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>This event is currently offline. Choose a license tier to bring it online.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {pricingTiers.map(tier => {
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
              <span style={{ fontSize: '16px', fontWeight: 900, color: C.gold, display: 'block', marginTop: '10px' }}>
                ${(tier.price_cents / 100).toFixed(2)} USD
              </span>
            </div>
          );
        })}
      </div>

      <div>
        <span style={{ fontSize: '11px', color: C.stone, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Payment Method</span>
        <div style={{ display: 'flex', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: C.charcoal, cursor: 'pointer' }}>
            <input type="radio" name="pay_method" checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')} style={{ accentColor: C.gold }} />
            💳 Credit/Debit Card (Stripe)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: C.charcoal, cursor: 'pointer' }}>
            <input type="radio" name="pay_method" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} style={{ accentColor: C.gold }} />
            💵 Offline Cash Transfer
          </label>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: '12px', color: '#C45E5E', background: '#FEF2F2', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      <button onClick={handlePayment} disabled={processing || !selectedTier}
        style={{
          padding: '12px 24px', background: C.gold, color: '#FFFFFF', border: 'none', borderRadius: '8px',
          fontWeight: 700, fontSize: '12px', cursor: processing ? 'default' : 'pointer',
          transition: 'all 0.2s', opacity: processing ? 0.7 : 1, width: '220px', alignSelf: 'flex-start',
        }}
        onMouseEnter={e => { if (!processing) e.currentTarget.style.background = C.goldHover; }}
        onMouseLeave={e => { if (!processing) e.currentTarget.style.background = C.gold; }}>
        {processing ? 'Processing activation...' : (paymentMethod === 'stripe' ? 'Pay & Activate Online' : 'Initiate Offline Transfer')}
      </button>
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
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center' }}>
        <EventQRCode slug={event.slug} qrCodeUrl={event.qr_code_url} />
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
          </div>

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
          {events.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 26, height: 26, padding: '0 8px', borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(184,148,79,0.10), rgba(215,190,128,0.10))',
              color: C.gold, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
              border: '1px solid rgba(184,148,79,0.18)',
            }}>
              {events.length}
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
      {events.length === 0 ? <EmptyState /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {events.map((evt, i) => (
            <EventCard key={evt.id} event={evt} index={i} isActive={evt.id === activeEventId} onSelect={onSelectEvent} />
          ))}
        </div>
      )}
    </div>
  );
}
