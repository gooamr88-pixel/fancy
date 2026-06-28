'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// --- Counter Animation Config ---
// Fallback shown immediately and whenever the admin-configured values can't be
// fetched — kept in sync with super_admin_config.landing_stats' DB default.
const DEFAULT_STATS = [
  { target: 10000, suffix: '+', label: 'Events Created', decimals: 0 },
  { target: 50000, suffix: '+', label: 'Guests Managed', decimals: 0 },
  { target: 99.9, suffix: '%', label: 'Platform Uptime', decimals: 1 },
];

const ANIMATION_DURATION = 2000; // ms

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function formatNumber(num, decimals) {
  if (decimals > 0) {
    return num.toFixed(decimals);
  }
  return Math.floor(num).toLocaleString('en-US');
}

// --- Animated Stat Counter ---
function StatCounter({ target, suffix, label, decimals, shouldAnimate }) {
  const [displayValue, setDisplayValue] = useState(decimals > 0 ? '0.0' : '0');
  const animatedRef = useRef(false);

  useEffect(() => {
    if (!shouldAnimate || animatedRef.current) return;
    animatedRef.current = true;

    let startTime = null;
    let rafId;

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      const easedProgress = easeOutExpo(progress);
      const currentValue = easedProgress * target;

      setDisplayValue(formatNumber(currentValue, decimals));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(formatNumber(target, decimals));
      }
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [shouldAnimate, target, decimals]);

  return (
    <div style={{ textAlign: 'center', flex: '1 1 0', minWidth: '200px' }}>
      <div className="stat-number">
        <span className="stat-value">{displayValue}</span>
        <span className="stat-suffix">{suffix}</span>
      </div>
      <div className="stat-label">{label}</div>

      <style jsx>{`
        .stat-number {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 2px;
          margin-bottom: 12px;
        }
        .stat-value {
          font-family: var(--font-serif);
          font-size: 48px;
          font-weight: 700;
          color: #191B1E;
          line-height: 1;
        }
        .stat-suffix {
          font-family: var(--font-serif);
          font-size: 32px;
          font-weight: 700;
          color: #191B1E;
          line-height: 1;
        }
        .stat-label {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 600;
          color: #77736A;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        @media (max-width: 768px) {
          .stat-value {
            font-size: 36px;
          }
          .stat-suffix {
            font-size: 24px;
          }
        }
        @media (max-width: 480px) {
          .stat-value {
            font-size: 32px;
          }
          .stat-suffix {
            font-size: 22px;
          }
        }
      `}</style>
    </div>
  );
}

// --- Vertical Divider (desktop only) ---
function VerticalDivider() {
  return (
    <div className="vertical-divider" aria-hidden="true">
      <style jsx>{`
        .vertical-divider {
          width: 1px;
          height: 48px;
          background: linear-gradient(to bottom, transparent, #D7BE80, transparent);
          flex-shrink: 0;
          align-self: center;
        }
        @media (max-width: 768px) {
          .vertical-divider {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

// --- Horizontal Shimmer Divider (mobile only) ---
function HorizontalDivider() {
  return (
    <div className="horizontal-divider" aria-hidden="true">
      <style jsx>{`
        .horizontal-divider {
          display: none;
        }
        @media (max-width: 768px) {
          .horizontal-divider {
            display: block;
            width: 64px;
            height: 1px;
            background: linear-gradient(to right, transparent, #D7BE80, transparent);
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}

// --- Main Section ---
export default function SocialProofBar() {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [stats, setStats] = useState(DEFAULT_STATS);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    fetch(`${apiUrl}/public/landing-stats`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.stats) && data.stats.length) setStats(data.stats);
      })
      .catch(() => {}); // keep DEFAULT_STATS on any failure — never block the landing page on this
  }, []);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        background: '#F8F4EC',
        padding: '64px 24px',
        width: '100%',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px',
        }}
      >
        {/* Gold ornament */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '40px',
            fontSize: '10px',
            letterSpacing: '8px',
            color: '#D7BE80',
            lineHeight: '1',
            userSelect: 'none',
          }}
          aria-hidden="true"
        >
          ✦ ✦ ✦
        </div>

        {/* Stats row */}
        <div className="stats-row">
          {stats.map((stat, index) => (
            <div key={stat.label} className="stat-item-wrapper">
              {/* Horizontal divider above (mobile only, not for first) */}
              {index > 0 && <HorizontalDivider />}

              <div className="stat-and-divider">
                {/* Vertical divider before (desktop only, not for first) */}
                {index > 0 && <VerticalDivider />}

                <StatCounter
                  target={stat.target}
                  suffix={stat.suffix}
                  label={stat.label}
                  decimals={stat.decimals}
                  shouldAnimate={isVisible}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .stats-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
        }
        .stat-item-wrapper {
          display: contents;
        }
        .stat-and-divider {
          display: contents;
        }

        @media (max-width: 768px) {
          .stats-row {
            flex-direction: column;
            gap: 32px;
          }
          .stat-item-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 32px;
            width: 100%;
          }
          .stat-and-divider {
            display: contents;
          }
        }

        @media (min-width: 769px) {
          .stats-row {
            padding: 0 24px;
          }
        }
      `}</style>
    </section>
  );
}
