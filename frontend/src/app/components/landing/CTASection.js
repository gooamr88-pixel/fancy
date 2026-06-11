'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';

export default function CTASection() {
  const [primaryHovered, setPrimaryHovered] = useState(false);
  const [secondaryHovered, setSecondaryHovered] = useState(false);
  const { isLoggedIn, loading } = useAuth();

  const trustItems = [
    'No credit card required',
    'Free starter plan',
    'Setup in 2 minutes',
  ];

  return (
    <section
      style={{
        width: '100%',
        background: 'linear-gradient(135deg, #191B1E 0%, #2A2D32 50%, #191B1E 100%)',
        padding: '100px 48px',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="cta-section"
    >
      {/* ─── Top Shimmer Line ─── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, #D7BE80, #B8944F, #D7BE80, transparent)',
          backgroundSize: '200% 100%',
        }}
        className="shimmer-line"
      />

      {/* ─── Corner Ornament: Top-Left ─── */}
      <div
        style={{
          position: 'absolute',
          top: '32px',
          left: '32px',
          opacity: 0.15,
          pointerEvents: 'none',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path
            d="M24 4L28 20L44 24L28 28L24 44L20 28L4 24L20 20L24 4Z"
            fill="#D7BE80"
          />
          <circle cx="24" cy="24" r="3" fill="#D7BE80" />
        </svg>
      </div>

      {/* ─── Corner Ornament: Bottom-Right ─── */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          right: '32px',
          opacity: 0.15,
          pointerEvents: 'none',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path
            d="M24 4L28 20L44 24L28 28L24 44L20 28L4 24L20 20L24 4Z"
            fill="#D7BE80"
          />
          <circle cx="24" cy="24" r="3" fill="#D7BE80" />
        </svg>
      </div>

      {/* ─── Content ─── */}
      <div
        style={{
          maxWidth: '680px',
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Ornament */}
        <div
          style={{
            color: '#D7BE80',
            fontSize: '10px',
            letterSpacing: '8px',
            marginBottom: '24px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          ✦ ✦ ✦
        </div>

        {/* Heading */}
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 600,
            color: '#FFFFFF',
            lineHeight: 1.2,
            margin: 0,
          }}
          className="cta-heading"
        >
          Ready to Create Something Unforgettable?
        </h2>

        {/* Subtext */}
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '17px',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.7,
            marginTop: '20px',
            marginBottom: 0,
          }}
        >
          Join thousands of hosts who trust Fancy RSVP for their most important
          celebrations. Start free — upgrade when you're ready.
        </p>

        {/* Button Row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            marginTop: '40px',
          }}
          className="cta-buttons"
        >
          {/* Primary Button */}
          <Link
            href={!loading && isLoggedIn ? '/dashboard' : '/register'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 40px',
              background: 'linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              borderRadius: '8px',
              letterSpacing: '0.5px',
              textDecoration: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: primaryHovered ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: primaryHovered
                ? '0 12px 32px rgba(184,148,79,0.35)'
                : '0 4px 16px rgba(184,148,79,0.2)',
            }}
            onMouseEnter={() => setPrimaryHovered(true)}
            onMouseLeave={() => setPrimaryHovered(false)}
          >
            {!loading && isLoggedIn ? 'Go to Dashboard' : 'Get Started Free'}
          </Link>

          {/* Secondary Button */}
          <a
            href="/demo"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 40px',
              background: secondaryHovered
                ? 'rgba(255,255,255,0.05)'
                : 'transparent',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              borderRadius: '8px',
              letterSpacing: '0.5px',
              textDecoration: 'none',
              border: secondaryHovered
                ? '1.5px solid rgba(255,255,255,1)'
                : '1.5px solid rgba(255,255,255,0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={() => setSecondaryHovered(true)}
            onMouseLeave={() => setSecondaryHovered(false)}
          >
            View Live Demo
          </a>
        </div>

        {/* Trust Line */}
        <div
          style={{
            marginTop: '32px',
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '6px 20px',
          }}
          className="cta-trust"
        >
          {trustItems.map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: '#B8944F' }}>✓</span>{' '}
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Styles ─── */}
      <style jsx>{`
        .cta-heading {
          font-size: clamp(1.8rem, 4vw, 2.6rem);
        }

        /* Shimmer animation */
        .shimmer-line {
          animation: shimmer 3s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        /* Responsive: < 768px */
        @media (max-width: 768px) {
          .cta-section {
            padding: 80px 24px !important;
          }
        }

        /* Responsive: < 640px */
        @media (max-width: 640px) {
          .cta-section {
            padding: 80px 24px !important;
          }

          .cta-buttons {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .cta-buttons a {
            width: 100% !important;
            text-align: center;
          }

          .cta-trust {
            flex-direction: column !important;
            align-items: center !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </section>
  );
}
