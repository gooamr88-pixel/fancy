'use client';

import React from 'react';

const C = {
  gold: '#B8944F', goldHover: '#a6833f',
  charcoal: '#191B1E', ivory: '#F8F4EC',
  stone: '#77736A', border: '#E8E2D6',
  white: '#FFFFFF', softBg: '#FAFAF8',
  error: '#C45E5E', success: '#3B9B6D',
};

/**
 * Step 3 — Platform Fee Payment.
 * The PRD requires the organizer to pay the fixed platform fee before the event
 * goes live. The draft event already exists at this point, so we can either:
 *   • Pay by card  → redirect to Stripe Checkout (returns to dashboard)
 *   • Manual/Cash  → generate a reference number inline; a Super Admin approves later
 */
export default function StagePayment({
  tiers, selectedTierName, onSelectTier,
  onPayStripe, onPayManual, manualRef,
  processing, error, onContinue, onBack, onSkip,
}) {
  const fmt = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;

  return (
    <div style={{ padding: '40px 24px 140px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.15)',
          borderRadius: 20, padding: '5px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, color: C.gold, fontWeight: 600, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Step 3 — Platform Fee
          </span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: C.charcoal, margin: 0 }}>
          Activate Your Event
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: C.stone, margin: '8px 0 0' }}>
          Choose a license tier and complete the one-time platform fee. Your event stays a private draft until paid.
        </p>
      </div>

      {/* Tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        {(tiers || []).length === 0 ? (
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone, fontStyle: 'italic' }}>
            No pricing tiers are configured yet. You can skip and pay later from the dashboard.
          </p>
        ) : tiers.map((tier) => {
          const isActive = selectedTierName === tier.name;
          return (
            <div key={tier.name}
              onClick={() => !processing && onSelectTier(tier.name)}
              style={{
                background: C.white,
                border: isActive ? `2px solid ${C.gold}` : `1.5px solid ${C.border}`,
                borderRadius: 16, padding: 22, cursor: processing ? 'default' : 'pointer',
                transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: isActive ? '0 4px 20px rgba(184,148,79,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600, color: C.charcoal, margin: 0 }}>{tier.name}</h3>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: isActive ? `2px solid ${C.gold}` : `2px solid ${C.border}`,
                  background: isActive ? C.gold : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isActive && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: C.gold, margin: '10px 0 4px' }}>{fmt(tier.price_cents)}</div>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, margin: 0 }}>
                Up to {tier.max_guests} guests
              </p>
            </div>
          );
        })}
      </div>

      {/* Manual reference confirmation */}
      {manualRef && (
        <div style={{
          background: 'rgba(59,155,109,0.06)', border: '1px solid rgba(59,155,109,0.25)',
          borderRadius: 12, padding: '16px 18px', marginBottom: 20,
        }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.charcoal, margin: '0 0 6px', fontWeight: 600 }}>
            ✓ Manual payment recorded
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, margin: 0, lineHeight: 1.5 }}>
            Your reference number is{' '}
            <code style={{ background: C.ivory, padding: '2px 8px', borderRadius: 6, color: C.gold, fontWeight: 700 }}>{manualRef}</code>.
            Send the transfer with this reference; a Super Admin will approve it and your event will go live. You can continue setting up tables now.
          </p>
        </div>
      )}

      {/* Payment method buttons */}
      {!manualRef && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            onClick={onPayStripe}
            disabled={processing || !selectedTierName}
            style={{
              flex: '1 1 240px', height: 54,
              background: (processing || !selectedTierName) ? '#C9C4BA' : 'linear-gradient(135deg, #B8944F, #a6833f)',
              color: C.white, border: 'none', borderRadius: 14,
              fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
              cursor: (processing || !selectedTierName) ? 'not-allowed' : 'pointer',
              boxShadow: (processing || !selectedTierName) ? 'none' : '0 4px 18px rgba(184,148,79,0.3)',
            }}
          >
            💳 Pay with Card
          </button>
          <button
            onClick={onPayManual}
            disabled={processing || !selectedTierName}
            style={{
              flex: '1 1 240px', height: 54,
              background: C.white, color: C.charcoal,
              border: `1.5px solid ${C.charcoal}`, borderRadius: 14,
              fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
              cursor: (processing || !selectedTierName) ? 'not-allowed' : 'pointer',
              opacity: (processing || !selectedTierName) ? 0.5 : 1,
            }}
          >
            🏦 Manual / Cash Transfer
          </button>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.2)',
          borderRadius: 10, padding: '12px 16px', marginTop: 16,
          color: C.error, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
        }}>⚠️ {error}</div>
      )}

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${C.border}`, padding: '16px 24px', zIndex: 50,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 860, width: '100%' }}>
          <button onClick={onBack} disabled={processing} style={{
            height: 48, padding: '0 24px', background: 'none',
            border: `1.5px solid ${C.charcoal}`, borderRadius: 12,
            fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, color: C.charcoal,
            cursor: processing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={onSkip} disabled={processing} style={{
              background: 'none', border: 'none', color: C.stone,
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
              cursor: processing ? 'not-allowed' : 'pointer', textDecoration: 'underline',
            }}>
              Skip &amp; pay later
            </button>
            <button onClick={onContinue} disabled={processing || !manualRef} style={{
              height: 52, padding: '0 32px',
              background: (processing || !manualRef) ? '#C9C4BA' : 'linear-gradient(135deg, #B8944F, #a6833f)',
              color: C.white, border: 'none', borderRadius: 14,
              fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
              cursor: (processing || !manualRef) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              Continue
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
