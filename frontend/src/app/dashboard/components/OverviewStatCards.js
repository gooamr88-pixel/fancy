'use client';

import React, { useState } from 'react';

/* ── SVG Icons ──────────────────────────────────────────────── */

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="3" width="16" height="15" rx="2.5" stroke="#B8944F" strokeWidth="1.4" />
      <path d="M2 8h16" stroke="#B8944F" strokeWidth="1.4" />
      <path d="M6 1.5v3" stroke="#B8944F" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14 1.5v3" stroke="#B8944F" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6.5" cy="12" r="1" fill="#B8944F" />
      <circle cx="10" cy="12" r="1" fill="#B8944F" />
      <circle cx="13.5" cy="12" r="1" fill="#B8944F" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="6.5" r="3" stroke="#B8944F" strokeWidth="1.3" />
      <path d="M1.5 17c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" stroke="#B8944F" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="14" cy="7" r="2.2" stroke="#B8944F" strokeWidth="1.2" />
      <path d="M14 11c2.5 0 4.5 2 4.5 4.5" stroke="#B8944F" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="#B8944F" strokeWidth="1.3" />
      <path d="M6.5 10.5l2.5 2.5 5-5" stroke="#B8944F" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="#B8944F" strokeWidth="1.3" />
      <path d="M10 5.5v5l3.5 2" stroke="#B8944F" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2l2.35 4.76 5.26.77-3.8 3.71.9 5.23L10 13.77l-4.71 2.5.9-5.23-3.8-3.71 5.26-.77L10 2z"
        stroke="#B8944F"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function RsvpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" stroke="#B8944F" strokeWidth="1.3" />
      <path d="M2.5 7.5L10 12l7.5-4.5" stroke="#B8944F" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Mini Progress Bar ──────────────────────────────────────── */

function MiniProgress({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: '#F0ECE3',
          overflow: 'hidden',
          marginBottom: 5,
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 3,
            background: color,
            width: `${pct}%`,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 9,
            color: color,
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 9,
            color: color,
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      </div>
    </div>
  );
}

/* ── Trend Arrow ────────────────────────────────────────────── */

function TrendIndicator({ accepted, total }) {
  const pct = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const isPositive = pct > 50;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginTop: 6,
        padding: '2px 8px',
        borderRadius: 8,
        background: isPositive ? '#F0F7F0' : '#FAF8F2',
      }}
    >
      {isPositive ? (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M6 9V3m0 0l-3 3m3-3l3 3" stroke="#4A7C59" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="2" fill="#A9A5A0" />
        </svg>
      )}
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 9,
          fontWeight: 700,
          color: isPositive ? '#4A7C59' : '#A9A5A0',
        }}
      >
        {isPositive ? '+5%' : 'Steady'}
      </span>
    </div>
  );
}

/* ── Single Stat Card ───────────────────────────────────────── */

function StatCard({ accent, icon, label, value, subtext, span, children }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: '#FFFFFF',
        border: `1px solid ${hovered ? '#D4CFC5' : '#E8E2D6'}`,
        borderRadius: 14,
        padding: '22px',
        paddingTop: 26,
        gridColumn: span ? `span ${span}` : undefined,
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 12px 32px rgba(184,148,79,0.08)'
          : '0 1px 3px rgba(0,0,0,0.02)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        cursor: 'default',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          borderRadius: '14px 14px 0 0',
          background: accent,
        }}
      />

      {/* Header: label + icon */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 10,
            fontWeight: 600,
            color: '#A9A5A0',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#F8F4EC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>

      {/* Value */}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 32,
          fontWeight: 700,
          color: '#191B1E',
          letterSpacing: '-0.5px',
          lineHeight: 1.1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>

      {/* Subtext */}
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          fontWeight: 400,
          color: '#77736A',
        }}
      >
        {subtext}
      </div>

      {/* Extra content (for RSVP Overview) */}
      {children}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */

export default function OverviewStatCards({
  totalEvents = 0,
  activeEvents = 0,
  totalGuests = 0,
  rsvpOverview = {},
  checkedIn = 0,
  notArrived = 0,
  totalGuestsAccepted = 0,
}) {
  const accepted = rsvpOverview.accepted || 0;
  const declined = rsvpOverview.declined || 0;
  const pending = rsvpOverview.pending || 0;
  const rsvpTotal = accepted + declined + pending;
  const acceptedPercent = rsvpTotal > 0 ? Math.round((accepted / rsvpTotal) * 100) : 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr',
        gap: 16,
      }}
    >
      {/* 1. Total Events */}
      <StatCard
        accent="linear-gradient(90deg, #B8944F, #D7BE80)"
        icon={<CalendarIcon />}
        label="Total Events"
        value={totalEvents}
        subtext={`${activeEvents} Active`}
      />

      {/* 2. Total Guests */}
      <StatCard
        accent="linear-gradient(90deg, #6B8EAE, #A3C1D9)"
        icon={<UsersIcon />}
        label="Total Guests"
        value={totalGuests}
        subtext="Invited"
      />

      {/* 3. RSVP Overview (spans 2 cols) */}
      <StatCard
        accent="linear-gradient(90deg, #B8944F, #D7BE80)"
        icon={<RsvpIcon />}
        label="RSVP Overview"
        value={`${acceptedPercent}%`}
        subtext="Accepted"
        span={2}
      >
        {/* Mini progress bars */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <MiniProgress label="Accepted" count={accepted} total={rsvpTotal} color="#B8944F" />
          <MiniProgress label="Declined" count={declined} total={rsvpTotal} color="#77736A" />
          <MiniProgress label="Pending" count={pending} total={rsvpTotal} color="#D7BE80" />
        </div>
        <TrendIndicator accepted={accepted} total={rsvpTotal} />
      </StatCard>

      {/* 4. Checked In */}
      <StatCard
        accent="linear-gradient(90deg, #4A7C59, #7AB08A)"
        icon={<CheckCircleIcon />}
        label="Checked In"
        value={checkedIn}
        subtext="Arrived"
      />

      {/* 5. Not Arrived */}
      <StatCard
        accent="linear-gradient(90deg, #C4956A, #E0B98E)"
        icon={<ClockIcon />}
        label="Not Arrived"
        value={notArrived}
        subtext="Pending arrival"
      />

      {/* 6. Confirmed */}
      <StatCard
        accent="linear-gradient(90deg, #8B7EC8, #B0A6D9)"
        icon={<StarIcon />}
        label="Confirmed"
        value={totalGuestsAccepted}
        subtext="Confirmed guests"
      />
    </div>
  );
}
