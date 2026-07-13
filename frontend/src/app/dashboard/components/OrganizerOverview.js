'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../utils/apiClient';
import OverviewStatCards from './OverviewStatCards';
import RsvpProgressDonut from './RsvpProgressDonut';
import RsvpTrendChart from './RsvpTrendChart';
import UpcomingEventsCards from './UpcomingEventsCards';
import RecentActivityFeed from './RecentActivityFeed';

/* ═══ CSS Animations ═══ */
const OV_STYLES_ID = 'organizer-overview-styles';
const GLOBAL_STYLES = `
@keyframes ov-shimmer {
  0% { background-position: -600px 0; }
  100% { background-position: 600px 0; }
}
@keyframes ov-fadeSlideUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ov-fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes ov-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes ov-gradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.ov-section {
  opacity: 0;
  animation: ov-fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.ov-charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.ov-bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
@media (max-width: 900px) {
  .ov-charts-grid,
  .ov-bottom-grid {
    grid-template-columns: 1fr;
  }
}
`;

/* ═══ Shimmer Skeleton Blocks ═══ */
function ShimmerBlock({ width, height, style, borderRadius }) {
  return (
    <div
      style={{
        width: width || '100%',
        height: height || 20,
        borderRadius: borderRadius || 10,
        background: 'linear-gradient(90deg, #F0ECE3 25%, #FAF8F4 37%, #F0ECE3 63%)',
        backgroundSize: '1200px 100%',
        animation: 'ov-shimmer 1.6s ease infinite',
        ...style,
      }}
    />
  );
}

/* ═══ Premium Loading Skeleton ═══ */
function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header skeleton */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 20, borderBottom: '1px solid #F0ECE3',
      }}>
        <div>
          <ShimmerBlock width={240} height={28} style={{ marginBottom: 10 }} />
          <ShimmerBlock width={300} height={14} />
        </div>
        <ShimmerBlock width={140} height={36} borderRadius={20} />
      </div>

      {/* Stat cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{
            background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: 16,
            padding: 24, position: 'relative', overflow: 'hidden',
          }}>
            <ShimmerBlock width={36} height={36} borderRadius={12} style={{ marginBottom: 16 }} />
            <ShimmerBlock width={60} height={10} style={{ marginBottom: 12 }} />
            <ShimmerBlock width={90} height={32} style={{ marginBottom: 10 }} />
            <ShimmerBlock width={70} height={12} />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {[1, 2].map((i) => (
          <div key={i} style={{
            background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: 16, padding: 28,
          }}>
            <ShimmerBlock width={160} height={18} style={{ marginBottom: 8 }} />
            <ShimmerBlock width={220} height={12} style={{ marginBottom: 28 }} />
            <ShimmerBlock height={200} borderRadius={12} />
          </div>
        ))}
      </div>

      {/* Bottom skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {[1, 2].map((i) => (
          <div key={i} style={{
            background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: 16, padding: 28,
          }}>
            <ShimmerBlock width={160} height={18} style={{ marginBottom: 8 }} />
            <ShimmerBlock width={200} height={12} style={{ marginBottom: 24 }} />
            {[1, 2, 3].map((j) => (
              <ShimmerBlock key={j} height={56} style={{ marginBottom: 12 }} borderRadius={12} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ Error State ═══ */
function ErrorState({ message, onRetry }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420,
      animation: 'ov-fadeIn 0.5s ease',
    }}>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: 20,
        padding: '56px 64px', textAlign: 'center',
        boxShadow: '0 8px 40px rgba(0,0,0,0.04), 0 0 0 1px rgba(232,226,214,0.3)',
        maxWidth: 420,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #FBF6EC, #F5EDDA)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 4px 16px rgba(184,148,79,0.12)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9v4m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#B8944F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600,
          color: '#191B1E', margin: '0 0 10px',
        }}>
          Unable to load dashboard
        </h2>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 13, color: '#77736A',
          margin: '0 0 28px', lineHeight: 1.6,
        }}>
          {message || 'Something went wrong. Please try again.'}
        </p>
        <button
          onClick={onRetry}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: hovered
              ? 'linear-gradient(135deg, #a6833f, #B8944F)'
              : 'linear-gradient(135deg, #B8944F, #D7BE80)',
            color: '#FFFFFF', fontFamily: 'var(--font-sans)',
            fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 12,
            padding: '12px 36px', cursor: 'pointer',
            transition: 'all 0.3s ease', letterSpacing: '0.03em',
            boxShadow: hovered
              ? '0 8px 24px rgba(184,148,79,0.35)'
              : '0 4px 16px rgba(184,148,79,0.2)',
            transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

/* ═══ Section Header ═══ */
function WelcomeHeader() {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  return (
    <div
      className="ov-section"
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 24, borderBottom: '1px solid #F0ECE3', marginBottom: 4,
        animationDelay: '0ms',
      }}
    >
      <div>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700,
          color: '#191B1E', margin: 0, lineHeight: 1.3,
        }}>
          Dashboard Overview
        </h1>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 13, color: '#77736A',
          margin: '6px 0 0', fontWeight: 400, letterSpacing: '0.01em',
        }}>
          Real-time insights across all your events
        </p>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#FAFAF8', border: '1px solid #E8E2D6',
        borderRadius: 20, padding: '8px 16px',
      }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="#B8944F" strokeWidth="1.2" fill="none" />
          <path d="M1.5 6.5h13" stroke="#B8944F" strokeWidth="1.2" />
          <path d="M5 1v3" stroke="#B8944F" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M11 1v3" stroke="#B8944F" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 12, color: '#77736A', fontWeight: 500,
        }}>
          {dateStr}
        </span>
      </div>
    </div>
  );
}

/* ═══ Check-In Kiosk Banner ═══ */
function CheckInBanner() {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="ov-section"
      style={{
        animationDelay: '50ms',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
        flexWrap: 'wrap',
        background: 'linear-gradient(135deg, #191B1E 0%, #2A2D33 100%)',
        borderRadius: 18, padding: '22px 28px',
        boxShadow: '0 8px 32px rgba(25,27,30,0.18)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, #D7BE80, #B8944F)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#191B1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
            Ready for guests to arrive?
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: '#B8B4A8', margin: '4px 0 0', lineHeight: 1.6 }}>
            Open the check-in kiosk to scan tickets or search guests by name at the door.
          </p>
        </div>
      </div>
      <Link
        href="/checkin"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0,
          padding: '11px 22px', borderRadius: 30, textDecoration: 'none',
          background: hovered ? 'linear-gradient(135deg, #a6833f, #B8944F)' : 'linear-gradient(135deg, #D7BE80, #B8944F)',
          color: '#191B1E', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
          transition: 'all 0.25s ease', transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow: hovered ? '0 8px 22px rgba(184,148,79,0.35)' : '0 4px 14px rgba(184,148,79,0.2)',
        }}
      >
        Open Check-In Kiosk
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </Link>
    </div>
  );
}

/* ═══ Main Component ═══ */
export default function OrganizerOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Keyed by id so a StrictMode remount (or multiple instances) doesn't drop the styles.
    if (!document.getElementById(OV_STYLES_ID)) {
      const styleEl = document.createElement('style');
      styleEl.id = OV_STYLES_ID;
      styleEl.textContent = GLOBAL_STYLES;
      document.head.appendChild(styleEl);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/dashboard');
      setData(res.dashboard || res);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { (async () => { await fetchData(); })(); }, []);

  if (loading) {
    return (
      <div style={{ padding: 0 }}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const {
    totalEvents = 0,
    activeEvents = 0,
    totalGuests = 0,
    rsvpOverview = { acceptedCount: 0, declinedCount: 0, pendingCount: 0 },
    checkedIn = 0,
    notArrived = 0,
    totalGuestsAccepted = 0,
    rsvpTrend = [],
    upcomingEvents = [],
    recentActivity = [],
  } = data || {};

  const rsvpOverviewMapped = {
    accepted: rsvpOverview.acceptedCount || 0,
    declined: rsvpOverview.declinedCount || 0,
    pending: rsvpOverview.pendingCount || 0,
  };

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Header ── */}
        <WelcomeHeader />

        {/* ── Check-In Kiosk CTA ── */}
        <CheckInBanner />

        {/* ── Stat Cards ── */}
        <div className="ov-section" style={{ animationDelay: '100ms' }}>
          <OverviewStatCards
            totalEvents={totalEvents}
            activeEvents={activeEvents}
            totalGuests={totalGuests}
            rsvpOverview={rsvpOverviewMapped}
            checkedIn={checkedIn}
            notArrived={notArrived}
            totalGuestsAccepted={totalGuestsAccepted}
          />
        </div>

        {/* ── Charts Row ── */}
        <div className="ov-section" style={{ animationDelay: '250ms' }}>
          <div className="ov-charts-grid">
            <RsvpProgressDonut rsvpOverview={rsvpOverviewMapped} />
            <RsvpTrendChart rsvpTrend={rsvpTrend} />
          </div>
        </div>

        {/* ── Bottom Row ── */}
        <div className="ov-section" style={{ animationDelay: '400ms' }}>
          <div className="ov-bottom-grid">
            <UpcomingEventsCards upcomingEvents={upcomingEvents} />
            <RecentActivityFeed recentActivity={recentActivity} />
          </div>
        </div>
      </div>
    </div>
  );
}
