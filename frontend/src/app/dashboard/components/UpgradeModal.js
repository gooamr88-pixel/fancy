'use client';

import React from 'react';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

const FEATURE_TITLES = {
  add_guest: 'Guest Management',
  import_guests: 'Guest Import',
  seating_map: 'Seating Map',
  form_builder: 'Form Builder',
  sms_campaigns: 'SMS Campaigns',
};

const FEATURE_LIST = [
  '✦ Add individual guests manually',
  '✦ Import guest lists from CSV/Excel',
  '✦ Interactive seating map editor',
  '✦ Custom RSVP form builder',
  '✦ SMS campaign tools',
];

export default function UpgradeModal({ isOpen, onClose, feature, isPaid, onUpgrade }) {
  if (!isOpen) return null;

  const title = FEATURE_TITLES[feature] || 'Premium Feature';
  const needsUpgrade = !!isPaid; // Paid but feature not in tier → needs upgrade

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(25, 27, 30, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.white,
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.12)',
          maxWidth: '440px',
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Shimmer keyframes */}
        <style>{`
          @keyframes upgradeShimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          @keyframes lockGlow {
            0%, 100% { filter: drop-shadow(0 0 4px rgba(184,148,79,0.25)); }
            50% { filter: drop-shadow(0 0 12px rgba(184,148,79,0.5)); }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '32px 32px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}>
          {/* Lock icon with glow */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(215,190,128,0.15) 0%, rgba(184,148,79,0.15) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            animation: 'lockGlow 2.5s ease-in-out infinite',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <h3 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '20px',
            fontWeight: 600,
            color: COLORS.charcoal,
            margin: 0,
          }}>
            Unlock {title}
          </h3>

          <p style={{
            fontSize: '13px',
            color: COLORS.stone,
            lineHeight: 1.7,
            marginTop: 8,
            fontFamily: 'var(--font-sans)',
            maxWidth: 340,
          }}>
            {needsUpgrade
              ? `Your current plan does not include ${title}. Upgrade to a higher plan to unlock this feature and more.`
              : 'Complete your event payment to unlock all premium features and take full control of your event planning.'
            }
          </p>
        </div>

        {/* Feature list */}
        <div style={{
          padding: '20px 32px 0',
        }}>
          <div style={{
            background: COLORS.softBg,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '12px',
            padding: '16px 20px',
          }}>
            {FEATURE_LIST.map((item, i) => (
              <div key={i} style={{
                fontSize: '13px',
                color: COLORS.charcoal,
                fontFamily: 'var(--font-sans)',
                padding: '6px 0',
                lineHeight: 1.5,
                opacity: 0.85,
              }}>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '24px 32px 32px' }}>
          {/* CTA button with shimmer */}
          <button
            onClick={onUpgrade}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
              backgroundSize: '200% auto',
              color: COLORS.white,
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(184, 148, 79, 0.3)',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(184, 148, 79, 0.45)';
              e.currentTarget.style.background = 'linear-gradient(135deg, #D7BE80 0%, #B8944F 50%, #D7BE80 100%)';
              e.currentTarget.style.backgroundSize = '200% auto';
              e.currentTarget.style.animation = 'upgradeShimmer 1.8s linear infinite';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(184, 148, 79, 0.3)';
              e.currentTarget.style.background = 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)';
              e.currentTarget.style.animation = 'none';
            }}
          >
            {needsUpgrade ? 'Upgrade Plan' : 'Complete Payment & Activate'}
          </button>

          {/* Maybe Later */}
          <button
            onClick={onClose}
            style={{
              display: 'block',
              width: '100%',
              background: 'none',
              border: 'none',
              color: COLORS.stone,
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              padding: '12px 0 0',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.charcoal; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.stone; }}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
