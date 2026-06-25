'use client';

import React, { useState } from 'react';
import UpgradeModal from './UpgradeModal';

const COLORS = {
  gold: '#B8944F', white: '#FFFFFF',
};

export default function FeatureGate({ isPaid, feature, children, onUpgrade }) {
  const [showModal, setShowModal] = useState(false);

  if (isPaid) {
    return children;
  }

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setShowModal(true);
        }}
        style={{
          position: 'relative',
          display: 'inline-flex',
          cursor: 'pointer',
          opacity: 0.85,
        }}
      >
        {/* Lock badge */}
        <div style={{
          position: 'absolute',
          top: -4,
          right: -4,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: COLORS.gold,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          boxShadow: '0 1px 4px rgba(184,148,79,0.35)',
        }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={COLORS.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        {/* Children with pointer events disabled */}
        <div style={{ pointerEvents: 'none' }}>
          {children}
        </div>
      </div>

      <UpgradeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        feature={feature}
        onUpgrade={() => {
          setShowModal(false);
          if (onUpgrade) onUpgrade();
        }}
      />
    </>
  );
}
