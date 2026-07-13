'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/apiClient';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
  success: '#3B9B6D',
};

const fmtCents = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCard({ label, value, sub }) {
  return (
    <div className="ref-stat-card" style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '20px 22px' }}>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: COLORS.charcoal, margin: 0, overflowWrap: 'break-word' }}>{value}</p>
      {sub && <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: COLORS.stone, margin: '4px 0 0' }}>{sub}</p>}
      <style jsx>{`
        @media (max-width: 480px) {
          .ref-stat-card { padding: 16px 18px !important; }
        }
      `}</style>
    </div>
  );
}

function CopyField({ value }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, background: COLORS.softBg,
      border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px',
    }}>
      <code style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: 13.5, color: COLORS.charcoal, wordBreak: 'break-all' }}>{value}</code>
      <button type="button" onClick={doCopy} style={{
        flexShrink: 0, border: 'none', borderRadius: 8, padding: '8px 16px',
        background: copied ? COLORS.success : COLORS.gold, color: COLORS.white,
        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

const STATUS_STYLE = {
  converted: { bg: 'rgba(59,155,109,0.10)', border: 'rgba(59,155,109,0.25)', color: COLORS.success, label: 'Converted — Rewarded' },
  pending: { bg: 'rgba(184,148,79,0.10)', border: 'rgba(184,148,79,0.25)', color: COLORS.gold, label: 'Pending' },
};

export default function ReferralsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiFetch('/referrals/me');
        if (cancelled) return;
        if (res.success) setData(res);
        else setError(res.message || 'Could not load your referral data.');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load your referral data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ height: 96, background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 14 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: COLORS.stone, margin: 0 }}>{error}</p>
      </div>
    );
  }

  const frontendBase = (process.env.NEXT_PUBLIC_FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const referralLink = data?.referralCode ? `${frontendBase}/register?ref=${data.referralCode}` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero: link + reward pitch */}
      <div className="ref-hero" style={{
        background: 'linear-gradient(135deg, #FFFDF7 0%, #FFFFFF 100%)',
        border: `2px solid ${COLORS.gold}`, borderRadius: 18, padding: 28,
        boxShadow: '0 8px 30px rgba(184,148,79,0.10)',
      }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 700, color: COLORS.gold, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Referral Program
        </span>
        <h2 className="ref-hero-heading" style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: COLORS.charcoal, margin: '6px 0 8px' }}>
          Give a fellow planner your link
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: COLORS.stone, margin: '0 0 20px', lineHeight: 1.6, maxWidth: 560 }}>
          {data?.programEnabled === false
            ? 'The referral program is currently paused — check back soon.'
            : `When someone signs up with your link and activates their first paid event, you get ${fmtCents(data?.rewardCents)} in credit automatically applied to your next event payment.`}
        </p>
        {referralLink && <CopyField value={referralLink} />}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }} className="ref-stats-grid">
        <StatCard label="Credit Balance" value={fmtCents(data?.creditBalanceCents)} sub="Applied automatically at checkout" />
        <StatCard label="People Referred" value={data?.referralCount ?? 0} />
        <StatCard label="Converted" value={data?.convertedCount ?? 0} sub="Became paying customers" />
      </div>

      {/* How it works */}
      <div className="ref-section" style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, color: COLORS.charcoal, margin: '0 0 16px' }}>How it works</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
          {[
            { n: '1', t: 'Share your link', d: 'Send your referral link to another organizer or planner.' },
            { n: '2', t: 'They activate an event', d: 'Once they sign up and pay for their first event, the referral counts.' },
            { n: '3', t: 'You get credit', d: `${fmtCents(data?.rewardCents)} lands in your balance and applies to your next payment.` },
          ].map((s) => (
            <div key={s.n} style={{ display: 'flex', gap: 12 }}>
              <div style={{
                flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: COLORS.gold, color: COLORS.white,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 700,
              }}>{s.n}</div>
              <div>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, color: COLORS.charcoal, margin: '0 0 4px' }}>{s.t}</p>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: COLORS.stone, margin: 0, lineHeight: 1.5 }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referred people */}
      <div className="ref-section" style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, color: COLORS.charcoal, margin: '0 0 16px' }}>People you&apos;ve referred</h3>
        {(!data?.referrals || data.referrals.length === 0) ? (
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: COLORS.stone, fontStyle: 'italic', margin: 0 }}>
            Nobody yet — share your link above to get started.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.referrals.map((r, i) => {
              const s = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                  padding: '12px 14px', background: COLORS.softBg, borderRadius: 10, border: `1px solid ${COLORS.border}`,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, color: COLORS.charcoal, margin: 0, overflowWrap: 'break-word' }}>{r.name || 'Organizer'}</p>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: COLORS.stone, margin: '2px 0 0' }}>Joined {formatDate(r.joinedAt)}</p>
                  </div>
                  <span style={{
                    flexShrink: 0, padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                    background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontFamily: 'var(--font-sans)',
                  }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Credit activity */}
      {data?.ledger?.length > 0 && (
        <div className="ref-section" style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, color: COLORS.charcoal, margin: '0 0 16px' }}>Credit activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.ledger.slice(0, 15).map((l) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: COLORS.charcoal, margin: 0 }}>
                    {l.type === 'earned' ? 'Referral reward earned' : l.type === 'redeemed' ? 'Applied to a payment' : l.type === 'admin_grant' ? 'Credit granted' : 'Credit adjusted'}
                  </p>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: COLORS.stone, margin: '2px 0 0' }}>{formatDate(l.createdAt)}</p>
                </div>
                <span style={{ flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: l.amountCents >= 0 ? COLORS.success : COLORS.stone }}>
                  {l.amountCents >= 0 ? '+' : '−'}{fmtCents(Math.abs(l.amountCents))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 480px) {
          .ref-stats-grid { grid-template-columns: 1fr !important; }
          .ref-hero { padding: 20px !important; border-radius: 14px !important; }
          .ref-hero-heading { font-size: 20px !important; }
          .ref-section { padding: 18px !important; }
        }
      `}</style>
    </div>
  );
}
