'use client';

import React, { useState } from 'react';

const C = {
  gold: '#B8944F', goldHover: '#a6833f',
  charcoal: '#191B1E', ivory: '#F8F4EC',
  stone: '#77736A', border: '#E8E2D6',
  white: '#FFFFFF', softBg: '#FAFAF8',
  error: '#C45E5E', success: '#3B9B6D',
};

const METHOD_ICON = { bank: '🏦', wallet: '📱', instapay: '⚡', cash: '💵', paypal: '🅿️', other: '💳' };

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button type="button"
      onClick={() => { navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      style={{ border: `1px solid ${C.border}`, background: C.white, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: copied ? C.success : C.gold, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

/**
 * Step 3 — Platform Fee Payment.
 *   • Pay by card  → redirect to Stripe Checkout
 *   • Manual/Cash  → choose one of the Super-Admin-configured methods, transfer
 *     to those details, submit the proof reference, get a reference code; a Super
 *     Admin then verifies the money arrived and activates the event.
 */
export default function StagePayment({
  tiers, manualMethods = [], selectedTierName, onSelectTier,
  onPayStripe, onPayManual, manualRef,
  processing, error, onContinue, onBack, onSkip,
  isPaid = false, currentTierName = '', currentTierMaxGuests = null,
}) {
  const fmt = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;
  const [showManual, setShowManual] = useState(false);
  const [chosenMethod, setChosenMethod] = useState('');
  const [payerRef, setPayerRef] = useState('');
  // When already paid, the plans stay locked on the current plan until the user
  // explicitly chooses to upgrade.
  const [upgrading, setUpgrading] = useState(false);

  const activeMethods = (manualMethods || []).filter(m => m && m.is_active !== false);
  // "Contact Sales" tiers have no fixed price, so they can't be paid online here.
  const billableTiers = (tiers || []).filter(t => t && t.is_custom !== true);

  // Resolve the current plan from the live tier list (falls back to the snapshot
  // saved on the event if the tier was later renamed/removed by an admin).
  const currentTier = (tiers || []).find(t => t.name === currentTierName) || null;
  const currentPrice = currentTier ? currentTier.price_cents : null;
  // Only strictly more expensive tiers count as an upgrade (full price charged).
  const upgradeTiers = currentPrice == null
    ? billableTiers
    : billableTiers.filter(t => t.price_cents > currentPrice);
  // Tiers shown in the selectable grid depend on the mode.
  const selectableTiers = (isPaid && upgrading) ? upgradeTiers : billableTiers;
  // The locked "Current Plan" view: paid and not actively upgrading.
  const showCurrentPlan = isPaid && !!currentTierName && !upgrading;
  const currentMaxGuests = currentTier ? currentTier.max_guests : currentTierMaxGuests;
  const currentFeatures = Array.isArray(currentTier?.features) ? currentTier.features.filter(Boolean) : [];

  const submitManual = () => {
    const label = chosenMethod || (activeMethods[0]?.label || 'Manual Transfer');
    onPayManual(label, payerRef.trim());
  };

  const startUpgrade = () => {
    setUpgrading(true);
    if (upgradeTiers[0]) onSelectTier(upgradeTiers[0].name);
  };
  const cancelUpgrade = () => {
    setUpgrading(false);
    setShowManual(false);
  };

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
            {showCurrentPlan ? 'Step 3 — Your Plan' : upgrading ? 'Step 3 — Upgrade Plan' : 'Step 3 — Platform Fee'}
          </span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: C.charcoal, margin: 0 }}>
          {showCurrentPlan ? 'Your Event is Active' : upgrading ? 'Upgrade Your Plan' : 'Activate Your Event'}
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: C.stone, margin: '8px 0 0' }}>
          {showCurrentPlan
            ? 'Your platform fee is paid and your event is live. Here is your current plan.'
            : upgrading
              ? 'Choose a higher tier below. Upgrading is a one-time charge for the new license.'
              : 'Choose a license tier and complete the one-time platform fee. Your event stays a private draft until paid.'}
        </p>
      </div>

      {/* Current Plan (locked) — shown after successful payment */}
      {showCurrentPlan && (
        <div style={{
          background: 'linear-gradient(135deg, #FFFDF7 0%, #FFFFFF 100%)',
          border: `2px solid ${C.gold}`, borderRadius: 18, padding: 26, marginBottom: 24,
          boxShadow: '0 8px 30px rgba(184,148,79,0.12)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Current Plan</span>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: C.charcoal, margin: '4px 0 0' }}>{currentTierName}</h3>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 100,
              background: 'rgba(59,155,109,0.10)', border: '1px solid rgba(59,155,109,0.25)',
              fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 700, color: C.success, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.success }} /> Active
            </span>
          </div>
          {currentTier && (
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: C.gold, margin: '14px 0 2px' }}>{fmt(currentTier.price_cents)}</div>
          )}
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, margin: '4px 0 0' }}>
            {currentMaxGuests > 0 ? `Up to ${currentMaxGuests} guests` : 'Unlimited guests'}
          </p>
          {currentFeatures.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {currentFeatures.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 13, color: C.charcoal }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 13l4 4L19 7" /></svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
            {upgradeTiers.length > 0 ? (
              <button onClick={startUpgrade} disabled={processing} style={{
                height: 48, padding: '0 26px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #B8944F, #a6833f)', color: C.white,
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                cursor: processing ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(184,148,79,0.28)',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                Upgrade Plan
              </button>
            ) : (
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone, margin: 0 }}>
                ✓ You&apos;re on the highest available plan.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tier cards (selection / upgrade) */}
      {!showCurrentPlan && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        {selectableTiers.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone, fontStyle: 'italic' }}>
            {upgrading ? 'You are already on the highest available plan.' : 'No pricing tiers are configured yet. You can skip and pay later from the dashboard.'}
          </p>
        ) : selectableTiers.map((tier) => {
          const isActive = selectedTierName === tier.name;
          const features = Array.isArray(tier.features) ? tier.features.filter(Boolean) : [];
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
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600, color: C.charcoal, margin: 0 }}>
                  {tier.name}
                  {tier.recommended && (
                    <span style={{ marginLeft: 8, fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, color: C.gold, background: 'rgba(184,148,79,0.12)', padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.05em', verticalAlign: 'middle' }}>Popular</span>
                  )}
                </h3>
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
                {tier.max_guests > 0 ? `Up to ${tier.max_guests} guests` : 'Unlimited guests'}
              </p>
              {features.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 12, color: C.charcoal }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 13l4 4L19 7" /></svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        </div>
      )}

      {/* Cancel upgrade — return to the locked current-plan view */}
      {upgrading && !manualRef && (
        <button onClick={cancelUpgrade} disabled={processing} style={{
          background: 'none', border: 'none', color: C.stone, marginBottom: 20,
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
          cursor: processing ? 'not-allowed' : 'pointer', textDecoration: 'underline',
        }}>
          ← Keep my current plan ({currentTierName})
        </button>
      )}

      {/* Manual reference confirmation */}
      {manualRef && (
        <div style={{
          background: 'rgba(59,155,109,0.06)', border: '1px solid rgba(59,155,109,0.25)',
          borderRadius: 12, padding: '18px 20px', marginBottom: 20,
        }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: C.charcoal, margin: '0 0 8px', fontWeight: 700 }}>
            ✓ Payment submitted — pending verification
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone }}>Reference code:</span>
            <code style={{ background: C.ivory, padding: '4px 10px', borderRadius: 6, color: C.gold, fontWeight: 700, fontSize: 14 }}>{manualRef}</code>
            <CopyBtn value={manualRef} />
          </div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, margin: 0, lineHeight: 1.6 }}>
            Make sure you have sent the transfer using this reference as the note. A Super Admin will confirm the money arrived and your event will go live automatically. You can continue setting up tables now.
          </p>
        </div>
      )}

      {/* Payment method selection */}
      {!manualRef && !showCurrentPlan && (
        <>
          {!showManual ? (
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
                onClick={() => setShowManual(true)}
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
                🏦 Manual / Bank Transfer
              </button>
            </div>
          ) : (
            <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: C.charcoal, margin: 0 }}>Pay by Manual Transfer</h3>
                <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', color: C.stone, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-sans)' }}>← Other methods</button>
              </div>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone, margin: '0 0 18px', lineHeight: 1.6 }}>
                Transfer the platform fee to one of the accounts below, then submit your proof. We&apos;ll verify and activate your event.
              </p>

              {activeMethods.length === 0 ? (
                <div style={{ background: C.softBg, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 18 }}>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone, margin: 0 }}>
                    No payment accounts are published yet. You can still generate a reference code and our team will share transfer details with you.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
                  {activeMethods.map((m, i) => {
                    const sel = (chosenMethod || activeMethods[0]?.label) === m.label;
                    return (
                      <div key={m.id || i}
                        onClick={() => setChosenMethod(m.label)}
                        style={{
                          border: sel ? `2px solid ${C.gold}` : `1.5px solid ${C.border}`,
                          background: sel ? 'rgba(184,148,79,0.05)' : C.white,
                          borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'all 0.2s',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: m.details || m.instructions ? 10 : 0 }}>
                          <span style={{ fontSize: 18 }}>{METHOD_ICON[m.type] || METHOD_ICON.other}</span>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, color: C.charcoal, flex: 1 }}>{m.label}</span>
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
                            <code style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, color: C.charcoal, fontWeight: 600, flex: 1, wordBreak: 'break-all' }}>{m.details}</code>
                            <CopyBtn value={m.details} />
                          </div>
                        )}
                        {m.instructions && (
                          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, margin: 0, lineHeight: 1.5 }}>ℹ️ {m.instructions}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, color: C.charcoal, marginBottom: 6 }}>
                Proof of transfer <span style={{ color: C.stone, fontWeight: 500 }}>(transaction ID / sender number — optional but speeds up approval)</span>
              </label>
              <input
                value={payerRef}
                onChange={(e) => setPayerRef(e.target.value)}
                placeholder="e.g. Txn #889217734 from 0100-123-4567"
                style={{
                  width: '100%', boxSizing: 'border-box', height: 46, padding: '0 14px',
                  border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 14,
                  fontFamily: 'var(--font-sans)', color: C.charcoal, outline: 'none', marginBottom: 18,
                }}
              />

              <button
                onClick={submitManual}
                disabled={processing || !selectedTierName}
                style={{
                  width: '100%', height: 52,
                  background: (processing || !selectedTierName) ? '#C9C4BA' : 'linear-gradient(135deg, #B8944F, #a6833f)',
                  color: C.white, border: 'none', borderRadius: 14,
                  fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
                  cursor: (processing || !selectedTierName) ? 'not-allowed' : 'pointer',
                  boxShadow: (processing || !selectedTierName) ? 'none' : '0 4px 18px rgba(184,148,79,0.3)',
                }}
              >
                {processing ? 'Submitting…' : "I've Transferred — Get Reference Code"}
              </button>
            </div>
          )}
        </>
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
            {!isPaid && (
              <button onClick={onSkip} disabled={processing} style={{
                background: 'none', border: 'none', color: C.stone,
                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
                cursor: processing ? 'not-allowed' : 'pointer', textDecoration: 'underline',
              }}>
                Skip &amp; pay later
              </button>
            )}
            {(() => {
              // Paid events can always proceed; unpaid require a submitted manual ref.
              const continueReady = isPaid || !!manualRef;
              return (
                <button onClick={onContinue} disabled={processing || !continueReady} style={{
                  height: 52, padding: '0 32px',
                  background: (processing || !continueReady) ? '#C9C4BA' : 'linear-gradient(135deg, #B8944F, #a6833f)',
                  color: C.white, border: 'none', borderRadius: 14,
                  fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
                  cursor: (processing || !continueReady) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  Continue
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
