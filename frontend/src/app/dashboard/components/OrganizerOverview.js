'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/apiClient';
import OverviewStatCards from './OverviewStatCards';
import RsvpProgressDonut from './RsvpProgressDonut';
import RsvpTrendChart from './RsvpTrendChart';
import UpcomingEventsCards from './UpcomingEventsCards';
import RecentActivityFeed from './RecentActivityFeed';

const SHIMMER_KEYFRAMES = `
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

const shimmerStyle = {
  background: 'linear-gradient(90deg, #F0ECE3 25%, #FAF8F4 37%, #F0ECE3 63%)',
  backgroundSize: '800px 100%',
  animation: 'shimmer 1.6s ease infinite',
  borderRadius: 10,
};

function ShimmerBlock({ width, height, style }) {
  return (
    <div
      style={{
        ...shimmerStyle,
        width: width || '100%',
        height: height || 20,
        ...style,
      }}
    />
  );
}

function SkeletonWelcomeHeader() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 20,
        borderBottom: '1px solid #F0ECE3',
        marginBottom: 28,
      }}
    >
      <div>
        <ShimmerBlock width={220} height={24} style={{ marginBottom: 10 }} />
        <ShimmerBlock width={280} height={14} />
      </div>
      <ShimmerBlock width={180} height={14} />
    </div>
  );
}

function SkeletonStatCards() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr',
        gap: 16,
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E2D6',
            borderRadius: 14,
            padding: 22,
            gridColumn: i === 3 ? 'span 2' : undefined,
          }}
        >
          <ShimmerBlock width={60} height={10} style={{ marginBottom: 16 }} />
          <ShimmerBlock width={80} height={30} style={{ marginBottom: 10 }} />
          <ShimmerBlock width={50} height={12} />
        </div>
      ))}
    </div>
  );
}

function SkeletonChartCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {[1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E2D6',
            borderRadius: 14,
            padding: 28,
          }}
        >
          <ShimmerBlock width={160} height={18} style={{ marginBottom: 8 }} />
          <ShimmerBlock width={240} height={12} style={{ marginBottom: 24 }} />
          <ShimmerBlock height={180} />
        </div>
      ))}
    </div>
  );
}

function SkeletonBottomCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {[1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E2D6',
            borderRadius: 14,
            padding: 28,
          }}
        >
          <ShimmerBlock width={160} height={18} style={{ marginBottom: 8 }} />
          <ShimmerBlock width={200} height={12} style={{ marginBottom: 20 }} />
          {[1, 2, 3].map((j) => (
            <ShimmerBlock
              key={j}
              height={48}
              style={{ marginBottom: 12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SkeletonWelcomeHeader />
      <SkeletonStatCards />
      <SkeletonChartCards />
      <SkeletonBottomCards />
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      style={{ marginRight: 6, verticalAlign: 'middle', marginTop: -1 }}
    >
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="12"
        rx="2"
        stroke="#A9A5A0"
        strokeWidth="1.2"
        fill="none"
      />
      <path d="M1.5 6.5h13" stroke="#A9A5A0" strokeWidth="1.2" />
      <path d="M5 1v3" stroke="#A9A5A0" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 1v3" stroke="#A9A5A0" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="5" cy="9.5" r="0.8" fill="#A9A5A0" />
      <circle cx="8" cy="9.5" r="0.8" fill="#A9A5A0" />
      <circle cx="11" cy="9.5" r="0.8" fill="#A9A5A0" />
      <circle cx="5" cy="12" r="0.8" fill="#A9A5A0" />
      <circle cx="8" cy="12" r="0.8" fill="#A9A5A0" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 9v4m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="#B8944F"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 20,
        borderBottom: '1px solid #F0ECE3',
        marginBottom: 28,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 22,
            fontWeight: 700,
            color: '#191B1E',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          Dashboard Overview
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: '#77736A',
            margin: '6px 0 0 0',
            fontWeight: 400,
          }}
        >
          Real-time insights across all your events
        </p>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: '#A9A5A0',
          fontWeight: 400,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <CalendarIcon />
        {dateStr}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 420,
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D6',
          borderRadius: 16,
          padding: '48px 56px',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          maxWidth: 400,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FBF6EC, #F5EDDA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <WarningIcon />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 18,
            fontWeight: 600,
            color: '#191B1E',
            margin: '0 0 8px 0',
          }}
        >
          Unable to load dashboard
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: '#77736A',
            margin: '0 0 24px 0',
            lineHeight: 1.5,
          }}
        >
          {message || 'Something went wrong. Please try again.'}
        </p>
        <button
          onClick={onRetry}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: hovered ? '#a6833f' : '#B8944F',
            color: '#FFFFFF',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            borderRadius: 10,
            padding: '10px 28px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            letterSpacing: '0.03em',
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export default function OrganizerOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const styleInjected = useRef(false);

  useEffect(() => {
    if (!styleInjected.current) {
      const styleEl = document.createElement('style');
      styleEl.textContent = SHIMMER_KEYFRAMES;
      document.head.appendChild(styleEl);
      styleInjected.current = true;
      return () => {
        document.head.removeChild(styleEl);
      };
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/dashboard');
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    total_events = 0,
    active_events = 0,
    total_guests = 0,
    rsvp_overview = { accepted: 0, declined: 0, pending: 0 },
    checked_in = 0,
    not_arrived = 0,
    total_guests_accepted = 0,
    rsvp_trend = [],
    upcoming_events = [],
    recent_activity = [],
  } = data || {};

  return (
    <div style={{ padding: 0 }}>
      <WelcomeHeader />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Stat Cards Row */}
        <OverviewStatCards
          totalEvents={total_events}
          activeEvents={active_events}
          totalGuests={total_guests}
          rsvpOverview={rsvp_overview}
          checkedIn={checked_in}
          notArrived={not_arrived}
          totalGuestsAccepted={total_guests_accepted}
        />

        {/* Charts Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
          }}
        >
          <RsvpProgressDonut rsvpOverview={rsvp_overview} />
          <RsvpTrendChart rsvpTrend={rsvp_trend} />
        </div>

        {/* Bottom Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
          }}
        >
          <UpcomingEventsCards upcomingEvents={upcoming_events} />
          <RecentActivityFeed recentActivity={recent_activity} />
        </div>
      </div>
    </div>
  );
}
