'use client';
import React from 'react';

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getStatusStyle(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active') {
    return { background: '#F0F7F0', color: '#4A7C59' };
  }
  if (s === 'draft') {
    return { background: '#F5F1EA', color: '#A09A91' };
  }
  if (s === 'completed') {
    return { background: '#EEF2F7', color: '#6B8EAE' };
  }
  return { background: '#F5F1EA', color: '#77736A' };
}

export default function UpcomingEventsCards({ upcomingEvents }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E2D6',
        borderRadius: '12px',
        padding: '28px',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '16px',
          fontWeight: 600,
          color: '#191B1E',
          margin: '0 0 20px 0',
        }}
      >
        Upcoming Events
      </h3>

      {!upcomingEvents || upcomingEvents.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 0',
            fontSize: '13px',
            color: '#77736A',
            fontStyle: 'italic',
            fontFamily: 'var(--font-sans)',
          }}
        >
          No upcoming events
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
        >
          {upcomingEvents.map((event) => {
            const statusStyle = getStatusStyle(event.status);
            return (
              <div
                key={event.id}
                style={{
                  minWidth: '200px',
                  background: '#FFFFFF',
                  border: '1px solid #E8E2D6',
                  borderLeft: '3px solid #B8944F',
                  borderRadius: '10px',
                  padding: '16px',
                  transition: 'all 0.3s ease',
                  cursor: 'default',
                  flex: '0 0 auto',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.05)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Title */}
                <div
                  style={{
                    fontSize: '14px',
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 600,
                    color: '#191B1E',
                    marginBottom: '6px',
                    lineHeight: 1.3,
                  }}
                >
                  {event.title}
                </div>

                {/* Date */}
                <div
                  style={{
                    fontSize: '12px',
                    fontFamily: 'var(--font-sans)',
                    color: '#77736A',
                    marginBottom: '4px',
                  }}
                >
                  {formatDate(event.event_date)}
                </div>

                {/* Location */}
                {event.location_name && (
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-sans)',
                      color: '#A9A5A0',
                      marginBottom: '12px',
                    }}
                  >
                    {event.location_name}
                  </div>
                )}

                {/* Bottom row: pills */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Guest count pill */}
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: '20px',
                      background: '#F8F4EC',
                      color: '#B8944F',
                      fontSize: '10px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {event.guestCount} Guests
                  </span>

                  {/* Status badge */}
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: '20px',
                      background: statusStyle.background,
                      color: statusStyle.color,
                      fontSize: '10px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-sans)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {event.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
