'use client';
import React from 'react';

const cardBase = {
  background: '#FFFFFF',
  border: '1px solid #E8E2D6',
  borderRadius: '12px',
  padding: '20px',
  transition: 'all 0.3s ease',
  cursor: 'default',
};

const labelStyle = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#77736A',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  fontFamily: 'var(--font-sans)',
  margin: 0,
};

const valueStyle = {
  fontSize: '28px',
  fontWeight: 600,
  color: '#191B1E',
  display: 'block',
  marginTop: '8px',
  fontFamily: 'var(--font-serif)',
  letterSpacing: '-0.5px',
};

const subtextStyle = {
  fontSize: '10px',
  color: '#77736A',
  display: 'block',
  marginTop: '4px',
  fontWeight: 400,
  fontFamily: 'var(--font-sans)',
};

function handleHoverIn(e) {
  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)';
  e.currentTarget.style.transform = 'translateY(-2px)';
}

function handleHoverOut(e) {
  e.currentTarget.style.boxShadow = 'none';
  e.currentTarget.style.transform = 'translateY(0)';
}

function StatCard({ label, value, subtext, children }) {
  return (
    <div
      style={cardBase}
      onMouseEnter={handleHoverIn}
      onMouseLeave={handleHoverOut}
    >
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
      {subtext && <span style={subtextStyle}>{subtext}</span>}
      {children}
    </div>
  );
}

export default function OverviewStatCards({
  totalEvents,
  activeEvents,
  totalGuests,
  rsvpOverview,
  checkedIn,
  notArrived,
  totalGuestsAccepted,
}) {
  const dotColors = {
    accepted: '#B8944F',
    declined: '#77736A',
    pending: '#D7BE80',
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr',
        gap: '16px',
      }}
    >
      {/* 1. Total Events */}
      <StatCard
        label="Total Events"
        value={totalEvents}
        subtext={`${activeEvents} Active`}
      />

      {/* 2. Total Guests */}
      <StatCard
        label="Total Guests"
        value={totalGuests}
        subtext="Invited"
      />

      {/* 3. RSVP Overview — spans 2 columns */}
      <div
        style={{
          ...cardBase,
          gridColumn: 'span 2',
        }}
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
      >
        <span style={labelStyle}>RSVP Overview</span>
        <span style={valueStyle}>{rsvpOverview.acceptedPercent}%</span>
        <span style={subtextStyle}>Accepted</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginTop: '10px',
            flexWrap: 'wrap',
          }}
        >
          {[
            { key: 'accepted', label: 'Accepted', count: rsvpOverview.acceptedCount },
            { key: 'declined', label: 'Declined', count: rsvpOverview.declinedCount },
            { key: 'pending', label: 'Pending', count: rsvpOverview.pendingCount },
          ].map((item) => (
            <span
              key={item.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10px',
                fontFamily: 'var(--font-sans)',
                color: '#77736A',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: dotColors[item.key],
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {item.label} {item.count}
            </span>
          ))}
        </div>
      </div>

      {/* 4. Checked In */}
      <StatCard
        label="Checked In"
        value={checkedIn}
        subtext="Arrived"
      />

      {/* 5. Not Arrived */}
      <StatCard
        label="Not Arrived"
        value={notArrived}
        subtext="Pending arrival"
      />

      {/* 6. Accepted Guests */}
      <StatCard
        label="Accepted"
        value={totalGuestsAccepted}
        subtext="Confirmed guests"
      />
    </div>
  );
}
