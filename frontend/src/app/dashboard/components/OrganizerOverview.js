'use client';
import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/apiClient';
import OverviewStatCards from './OverviewStatCards';
import RsvpProgressDonut from './RsvpProgressDonut';
import RsvpTrendChart from './RsvpTrendChart';
import UpcomingEventsCards from './UpcomingEventsCards';
import RecentActivityFeed from './RecentActivityFeed';

/* ──────────────────────── Skeleton Helpers ──────────────────────── */
const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

function ShimmerBox({ width, height, borderRadius = '8px', style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #F0ECE3 25%, #F8F4EC 50%, #F0ECE3 75%)',
        backgroundSize: '800px 100%',
        animation: 'shimmer 1.8s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

function SkeletonStatCard() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E2D6',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <ShimmerBox width="60%" height="10px" style={{ marginBottom: '12px' }} />
      <ShimmerBox width="50%" height="28px" style={{ marginBottom: '8px' }} />
      <ShimmerBox width="40%" height="8px" />
    </div>
  );
}

function SkeletonStatCardWide() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E2D6',
        borderRadius: '12px',
        padding: '20px',
        gridColumn: 'span 2',
      }}
    >
      <ShimmerBox width="40%" height="10px" style={{ marginBottom: '12px' }} />
      <ShimmerBox width="30%" height="28px" style={{ marginBottom: '8px' }} />
      <ShimmerBox width="25%" height="8px" style={{ marginBottom: '12px' }} />
      <div style={{ display: 'flex', gap: '12px' }}>
        <ShimmerBox width="70px" height="8px" />
        <ShimmerBox width="70px" height="8px" />
        <ShimmerBox width="60px" height="8px" />
      </div>
    </div>
  );
}

function SkeletonChartCard({ height = '280px' }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E2D6',
        borderRadius: '12px',
        padding: '28px',
      }}
    >
      <ShimmerBox width="120px" height="14px" style={{ marginBottom: '20px' }} />
      <ShimmerBox width="100%" height={height} borderRadius="8px" />
    </div>
  );
}

function SkeletonListCard() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E2D6',
        borderRadius: '12px',
        padding: '28px',
      }}
    >
      <ShimmerBox width="140px" height="14px" style={{ marginBottom: '20px' }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
          <ShimmerBox width="32px" height="32px" borderRadius="50%" />
          <div style={{ flex: 1 }}>
            <ShimmerBox width="70%" height="12px" style={{ marginBottom: '6px' }} />
            <ShimmerBox width="45%" height="8px" />
          </div>
          <ShimmerBox width="40px" height="8px" />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────── Loading Skeleton ──────────────────────── */
function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stat cards row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr',
          gap: '16px',
        }}
      >
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCardWide />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <SkeletonChartCard height="200px" />
        <SkeletonChartCard height="200px" />
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <SkeletonChartCard height="120px" />
        <SkeletonListCard />
      </div>
    </div>
  );
}

/* ──────────────────────── Error State ──────────────────────── */
function ErrorState({ message, onRetry }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        background: '#FFFFFF',
        border: '1px solid #E8E2D6',
        borderRadius: '12px',
      }}
    >
      {/* Warning icon */}
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#F8F4EC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '16px',
          color: '#191B1E',
          marginBottom: '6px',
          fontWeight: 500,
        }}
      >
        Unable to load dashboard
      </p>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          color: '#77736A',
          marginBottom: '20px',
          textAlign: 'center',
          maxWidth: '360px',
        }}
      >
        {message || 'Something went wrong while fetching your dashboard data.'}
      </p>
      <button
        onClick={onRetry}
        style={{
          background: '#B8944F',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 24px',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#a6833f'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#B8944F'; }}
      >
        Try Again
      </button>
    </div>
  );
}

/* ──────────────────────── Main Component ──────────────────────── */
export default function OrganizerOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/dashboard');
      if (res?.success && res.dashboard) {
        setData(res.dashboard);
      } else {
        throw new Error('Invalid dashboard response.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Inject shimmer keyframes once
  useEffect(() => {
    const styleId = 'organizer-overview-shimmer';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = shimmerKeyframes;
      document.head.appendChild(styleEl);
    }
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchDashboard} />;
  }

  if (!data) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Row 1: Stat Cards */}
      <OverviewStatCards
        totalEvents={data.totalEvents}
        activeEvents={data.activeEvents}
        totalGuests={data.totalGuests}
        rsvpOverview={data.rsvpOverview}
        checkedIn={data.checkedIn}
        notArrived={data.notArrived}
        totalGuestsAccepted={data.totalGuestsAccepted}
      />

      {/* Row 2: Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <RsvpProgressDonut rsvpOverview={data.rsvpOverview} />
        <RsvpTrendChart rsvpTrend={data.rsvpTrend} />
      </div>

      {/* Row 3: Events + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <UpcomingEventsCards upcomingEvents={data.upcomingEvents} />
        <RecentActivityFeed recentActivity={data.recentActivity} />
      </div>
    </div>
  );
}
