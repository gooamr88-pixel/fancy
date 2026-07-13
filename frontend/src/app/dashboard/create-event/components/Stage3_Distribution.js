'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { computeSmsSegments } from '../../../utils/smsSegments';
import Icon from '../../../components/icons/Icon';

const C = {
  gold: '#B8944F', goldHover: '#a6833f',
  charcoal: '#191B1E', ivory: '#F8F4EC',
  stone: '#77736A', border: '#E8E2D6',
  white: '#FFFFFF', softBg: '#FAFAF8',
  error: '#C45E5E', success: '#3B9B6D',
};

const CREDIT_PACKS = [50, 100, 250, 500];

// Mirrors backend/utils/pricing.js's computeSmsChargeCents (kept in sync
// manually since frontend/ and backend/ aren't set up to share code across
// the app boundary) — an ESTIMATE only, so the organizer sees a price before
// redirecting to Stripe instead of finding out only on Stripe's own page,
// unlike every other paid action in this wizard. The actual charge is always
// computed authoritatively server-side at checkout-session creation.
const SMS_VOLUME_DISCOUNT_THRESHOLD = 500;
const SMS_VOLUME_DISCOUNT_RATE = 0.875;
function estimateSmsChargeCents(unitPriceCents, creditCount, markupPct = 0) {
  if (!Number.isFinite(unitPriceCents) || !Number.isFinite(creditCount) || creditCount <= 0) return null;
  let total = unitPriceCents * creditCount * (1 + (Number(markupPct) || 0) / 100);
  if (creditCount >= SMS_VOLUME_DISCOUNT_THRESHOLD) total *= SMS_VOLUME_DISCOUNT_RATE;
  return Math.max(0, Math.round(total));
}

export default function Stage3_Distribution({
  slug, distributionMethods, onMethodToggle,
  smsTemplate, setSmsTemplate,
  smsCredits, smsCreditsLoading, onRefreshCredits, onBuyCredits, buyingCredits, creditError,
  smsRateCentsPerCredit = null, smsMarkupPercentage = 0,
  onSubmit, onBack, submitting, error, smsEnabled = true,
}) {
  const [copied, setCopied] = useState(false);
  const [creditQty, setCreditQty] = useState(100);
  const estimatedCents = estimateSmsChargeCents(smsRateCentsPerCredit, creditQty, smsMarkupPercentage);
  const eventUrl = `fancyrsvp.com/${slug || 'your-event'}`;
  // Segment-accurate counter: Arabic/emoji switch the body to Unicode (70-char
  // segments vs 160), so the per-segment cap and credit cost change with content.
  const smsSeg = computeSmsSegments(smsTemplate || '');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`https://${eventUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  }, [eventUrl]);

  const methods = [
    {
      key: 'link', icon: 'link', locked: true,
      title: 'Unique Invitation Link',
      desc: 'Share a personalized URL with your guests',
    },
    {
      key: 'qr', icon: 'mobile',
      title: 'QR Code',
      desc: 'Generate a scannable QR code for printed invitations',
    },
    {
      key: 'sms', icon: 'chat',
      title: 'SMS Invitations',
      desc: 'Send personalized text messages to your guest list',
    },
  ];

  return (
    <div className="s3-page" style={{ padding: '40px 24px 140px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.15)',
          borderRadius: 20, padding: '5px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, color: C.gold, fontWeight: 600, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Step 3 of 3 — Final Step
          </span>
        </div>
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 28,
          fontWeight: 600, color: C.charcoal, margin: 0,
        }}>Distribution Methods</h2>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 14,
          color: C.stone, margin: '8px 0 0',
        }}>Choose how you&apos;ll share your invitation with guests</p>
      </div>

      {/* Method Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {methods.map(m => {
          const isActive = distributionMethods[m.key];
          return (
            <div key={m.key}
              onClick={() => !m.locked && onMethodToggle(m.key)}
              style={{
                background: C.white,
                border: isActive ? `2px solid ${C.gold}` : `1.5px solid ${C.border}`,
                borderRadius: 16, padding: 24,
                cursor: m.locked ? 'default' : 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: isActive ? '0 4px 20px rgba(184,148,79,0.1)' : '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
              }}>
                {/* Icon */}
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: isActive ? 'rgba(184,148,79,0.08)' : C.ivory,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.2s',
                }}><Icon name={m.icon} size={20} strokeWidth={1.5} /></div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{
                      fontFamily: 'var(--font-serif)', fontSize: 16,
                      fontWeight: 600, color: C.charcoal, margin: 0,
                    }}>{m.title}</h3>
                    {/* Toggle circle */}
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      border: isActive ? `2px solid ${C.gold}` : `2px solid ${C.border}`,
                      background: isActive ? C.gold : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s', flexShrink: 0,
                    }}>
                      {isActive && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="#fff" strokeWidth="3" strokeLinecap="round">
                          <path d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-sans)', fontSize: 12,
                    color: C.stone, margin: '4px 0 0',
                  }}>{m.desc}</p>

                  {/* Expanded content per method */}
                  <AnimatePresence>
                    {isActive && m.key === 'link' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: C.ivory, border: `1px solid ${C.border}`,
                          borderRadius: 8, padding: '10px 14px', marginTop: 14,
                        }}>
                          <span style={{
                            fontFamily: 'monospace', fontSize: 13,
                            color: C.charcoal, flex: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>{eventUrl}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                            style={{
                              padding: '6px 14px', borderRadius: 6,
                              background: copied ? C.success : C.gold,
                              color: C.white, border: 'none', fontSize: 11,
                              fontWeight: 700, cursor: 'pointer',
                              fontFamily: 'var(--font-sans)',
                              transition: 'background 0.2s',
                              whiteSpace: 'nowrap',
                            }}
                          >{copied ? 'Copied! ✓' : 'Copy Link'}</button>
                        </div>
                      </motion.div>
                    )}

                    {isActive && m.key === 'qr' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          marginTop: 14, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', gap: 12,
                        }}>
                          {/* QR Placeholder */}
                          <div style={{
                            width: 160, height: 160, borderRadius: 12,
                            background: C.white, border: `2px solid ${C.border}`,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: 8,
                          }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                              stroke={C.stone} strokeWidth="1.5" strokeLinecap="round">
                              <rect x="3" y="3" width="7" height="7" rx="1"/>
                              <rect x="14" y="3" width="7" height="7" rx="1"/>
                              <rect x="3" y="14" width="7" height="7" rx="1"/>
                              <rect x="14" y="14" width="3" height="3"/>
                              <rect x="18" y="18" width="3" height="3"/>
                              <rect x="18" y="14" width="3" height="1"/>
                              <rect x="14" y="18" width="1" height="3"/>
                            </svg>
                            <span style={{
                              fontSize: 10, color: C.stone,
                              fontFamily: 'var(--font-sans)', textAlign: 'center',
                              lineHeight: 1.3,
                            }}>QR Code generated<br/>after event creation</span>
                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button disabled style={{
                              padding: '6px 14px', borderRadius: 6,
                              background: C.ivory, border: `1px solid ${C.border}`,
                              color: C.stone, fontSize: 11, fontWeight: 600,
                              cursor: 'not-allowed', opacity: 0.6,
                              fontFamily: 'var(--font-sans)',
                            }}>Download PNG</button>
                            <button disabled style={{
                              padding: '6px 14px', borderRadius: 6,
                              background: C.ivory, border: `1px solid ${C.border}`,
                              color: C.stone, fontSize: 11, fontWeight: 600,
                              cursor: 'not-allowed', opacity: 0.6,
                              fontFamily: 'var(--font-sans)',
                            }}>Download SVG</button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {isActive && m.key === 'sms' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <textarea
                            value={smsTemplate}
                            onChange={e => { e.stopPropagation(); setSmsTemplate(e.target.value); }}
                            onClick={e => e.stopPropagation()}
                            rows={3}
                            placeholder="Hey {name}, you're invited! RSVP at {url}"
                            style={{
                              width: '100%', boxSizing: 'border-box',
                              background: C.white, border: `1px solid ${C.border}`,
                              borderRadius: 8, padding: '10px 14px',
                              fontSize: 13, color: C.charcoal,
                              outline: 'none', fontFamily: 'var(--font-sans)',
                              resize: 'vertical',
                            }}
                          />
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {['{name}', '{url}'].map(v => (
                                <span key={v} style={{
                                  fontSize: 10, fontWeight: 600,
                                  background: 'rgba(184,148,79,0.08)',
                                  color: C.gold, borderRadius: 4,
                                  padding: '3px 8px', fontFamily: 'monospace',
                                }}>{v}</span>
                              ))}
                            </div>
                            <span style={{
                              fontSize: 10, color: smsSeg.segments > 1 ? C.error : C.stone,
                              fontFamily: 'var(--font-sans)',
                            }}>{smsSeg.length}/{smsSeg.perSegment} · {smsSeg.segments} SMS</span>
                          </div>

                          {/* UCS-2 (Arabic / emoji / accents) costs far more credits per guest. */}
                          {smsSeg.encoding === 'UCS-2' && (
                            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.25)', borderRadius: 8, padding: '8px 10px' }}>
                              <Icon name="warning" size={13} strokeWidth={1.6} style={{ flexShrink: 0, marginTop: 1 }} />
                              <span style={{ fontSize: 10, color: C.charcoal, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
                                <strong>Arabic / special characters detected.</strong> Each SMS segment now holds only <strong>70 characters</strong> instead of 160, so this message can cost up to <strong>3× the credits</strong> per guest.
                              </span>
                            </div>
                          )}

                          {/* Live credit balance */}
                          <div
                            onClick={e => e.stopPropagation()}
                            style={{
                              background: C.softBg, border: `1px solid ${C.border}`,
                              borderRadius: 12, padding: 14,
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Icon name="sentMail" size={17} strokeWidth={1.5} />
                                <div>
                                  <span style={{ fontSize: 11, color: C.stone, fontFamily: 'var(--font-sans)', display: 'block' }}>Available SMS credits <span style={{ color: C.gold, fontWeight: 700 }}>· this event</span></span>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: C.charcoal, fontFamily: 'var(--font-sans)' }}>
                                    {smsCreditsLoading && smsCredits === null ? '…' : (smsCredits ?? 0)}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); onRefreshCredits && onRefreshCredits(); }}
                                disabled={smsCreditsLoading}
                                style={{
                                  padding: '6px 12px', borderRadius: 8, background: C.white,
                                  border: `1px solid ${C.border}`, color: C.stone, fontSize: 11,
                                  fontWeight: 700, cursor: smsCreditsLoading ? 'wait' : 'pointer',
                                  fontFamily: 'var(--font-sans)',
                                }}>
                                {smsCreditsLoading ? 'Refreshing…' : '↻ Refresh'}
                              </button>
                            </div>

                            {smsEnabled ? (
                            <>
                            {/* Pack selector */}
                            <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                              {CREDIT_PACKS.map(p => {
                                const sel = creditQty === p;
                                return (
                                  <button key={p}
                                    onClick={(e) => { e.stopPropagation(); setCreditQty(p); }}
                                    style={{
                                      padding: '7px 14px', borderRadius: 8,
                                      border: sel ? `2px solid ${C.gold}` : `1.5px solid ${C.border}`,
                                      background: sel ? 'rgba(184,148,79,0.06)' : C.white,
                                      color: sel ? C.gold : C.charcoal, fontSize: 12, fontWeight: 700,
                                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                    }}>
                                    {p}
                                  </button>
                                );
                              })}
                              <input
                                type="number" min={50} max={50000} value={creditQty}
                                onClick={e => e.stopPropagation()}
                                onChange={(e) => setCreditQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                style={{
                                  width: 90, padding: '7px 10px', borderRadius: 8,
                                  border: `1.5px solid ${C.border}`, fontSize: 12, color: C.charcoal,
                                  fontFamily: 'var(--font-sans)', outline: 'none',
                                }}
                              />
                            </div>

                            <button
                              onClick={(e) => { e.stopPropagation(); onBuyCredits && onBuyCredits(creditQty); }}
                              disabled={buyingCredits || creditQty < 50}
                              style={{
                                marginTop: 12, width: '100%', height: 44,
                                background: (buyingCredits || creditQty < 50) ? '#C9C4BA' : 'linear-gradient(135deg, #B8944F, #a6833f)',
                                color: C.white, border: 'none', borderRadius: 10,
                                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
                                cursor: (buyingCredits || creditQty < 50) ? 'not-allowed' : 'pointer',
                              }}>
                              {buyingCredits
                                ? 'Opening checkout…'
                                : `Buy ${creditQty >= 50 ? creditQty : ''} Credits${estimatedCents != null ? ` — ~$${(estimatedCents / 100).toFixed(2)}` : ''}`}
                            </button>
                            <p style={{ fontSize: 10, color: C.stone, fontFamily: 'var(--font-sans)', margin: '8px 0 0', lineHeight: 1.5 }}>
                              {creditQty < 50 ? 'Minimum purchase is 50 credits.' : "Checkout opens in a new tab — finish there, then come back here and your balance updates automatically."}
                            </p>
                            </>
                            ) : (
                              <p style={{ fontSize: 11, color: C.stone, fontFamily: 'var(--font-sans)', margin: '14px 0 0', lineHeight: 1.6 }}>
                                SMS credit top-ups are temporarily unavailable. Your current balance still works, and an admin can grant credits if needed.
                              </p>
                            )}
                            {creditError && (
                              <p style={{ fontSize: 11, color: C.error, fontFamily: 'var(--font-sans)', margin: '8px 0 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="warning" size={12} strokeWidth={1.7} /> {creditError}</p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{
        borderTop: `1px solid ${C.border}`,
        marginTop: 32, paddingTop: 28,
      }}>
        <h3 style={{
          fontFamily: 'var(--font-serif)', fontSize: 20,
          fontWeight: 600, color: C.charcoal, margin: 0,
        }}>Ready to Launch</h3>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: 'rgba(184,148,79,0.08)',
            color: C.gold, borderRadius: 6,
            padding: '4px 10px', fontFamily: 'var(--font-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}><Icon name="palette" size={12} strokeWidth={1.8} /> Template configured</span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: 'rgba(59,155,109,0.06)',
            color: C.success, borderRadius: 6,
            padding: '4px 10px', fontFamily: 'var(--font-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}><Icon name="calendar" size={12} strokeWidth={1.8} /> Date set</span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: 'rgba(59,130,246,0.06)',
            color: '#3B82F6', borderRadius: 6,
            padding: '4px 10px', fontFamily: 'var(--font-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}><Icon name="rocket" size={12} strokeWidth={1.8} /> {Object.values(distributionMethods).filter(Boolean).length} method(s) selected</span>
        </div>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 12,
          color: C.stone, marginTop: 12, lineHeight: 1.5,
        }}>
          Your event will be created and ready for distribution. You can further customize
          settings, manage guest lists, and send campaigns from the dashboard.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.2)',
          borderRadius: 10, padding: '12px 16px', marginTop: 16,
          color: C.error, fontFamily: 'var(--font-sans)', fontSize: 13,
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
        }}><Icon name="warning" size={14} strokeWidth={1.6} /> {error}</div>
      )}

      {/* ═══ ACTION FOOTER ═══ */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${C.border}`,
        padding: '16px 24px', paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom) + 8px))', zIndex: 50,
        display: 'flex', justifyContent: 'center',
      }}>
        <div className="s3-footer-inner" style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', maxWidth: 860, width: '100%',
        }}>
          <button onClick={onBack} className="s3-footer-btn" style={{
            height: 48, padding: '0 24px',
            background: 'none', border: `1.5px solid ${C.charcoal}`,
            borderRadius: 12, fontFamily: 'var(--font-sans)',
            fontSize: 14, fontWeight: 700, color: C.charcoal,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.charcoal; e.currentTarget.style.color = C.white; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.charcoal; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            Back
          </button>

          <button onClick={onSubmit} disabled={submitting}
            className="s3-cta s3-footer-btn"
            style={{
              height: 56, padding: '0 40px',
              background: submitting ? '#B0B0B0' : 'linear-gradient(135deg, #B8944F, #a6833f)',
              color: C.white, border: 'none', borderRadius: 14,
              fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: submitting ? 'none' : '0 4px 20px rgba(184,148,79,0.35)',
              transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { if (!submitting) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(184,148,79,0.45)'; }}}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(184,148,79,0.35)'; }}
          >
            {/* Shimmer overlay */}
            {!submitting && <div className="s3-shimmer" />}

            {submitting ? (
              <>
                <div style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 's3-spin 0.6s linear infinite',
                }} />
                Creating Your Event...
              </>
            ) : (
              <><Icon name="sparkle" size={14} strokeWidth={1.6} /> Create Event</>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        /* Back (~107px) + the wide "Publish Event" CTA (~206px) + 48px padding
           overruns a 360px Android, and body{overflow-x:hidden} clips instead of
           scrolling — so the button that actually publishes the event fell off the
           screen. Stack full-width, primary on top (same as Stage2/StagePayment). */
        @media (max-width: 600px) {
          .s3-footer-inner { flex-direction: column-reverse !important; align-items: stretch !important; gap: 10px !important; }
          .s3-footer-btn { width: 100% !important; justify-content: center !important; }
          /* Clear the now-taller stacked footer so the last card isn't hidden behind it. */
          .s3-page { padding: 32px 16px 220px !important; }
        }
        .s3-shimmer {
          position: absolute; top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: s3-shimmerMove 2.5s ease-in-out infinite;
        }
        @keyframes s3-shimmerMove {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        @keyframes s3-spin {
          to { transform: rotate(360deg); }
        }
        .s3-cta:active {
          transform: scale(0.98) !important;
        }
      `}</style>
    </div>
  );
}
