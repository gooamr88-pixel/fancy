'use client';

import { useState, useEffect, useRef } from 'react';

const STATUS_CONFIG = {
  active: { accent: '#4A7C59', bg: '#F0F7F0', color: '#3D6B4A', glow: 'rgba(74,124,89,0.35)', label: 'Active' },
  published: { accent: '#4A7C59', bg: '#F0F7F0', color: '#3D6B4A', glow: 'rgba(74,124,89,0.35)', label: 'Published' },
  live: { accent: '#4A7C59', bg: '#F0F7F0', color: '#3D6B4A', glow: 'rgba(74,124,89,0.35)', label: 'Live' },
  paused: { accent: '#C4943A', bg: '#FDF8EE', color: '#9A7530', glow: 'rgba(196,148,58,0.35)', label: 'Paused' },
  draft: { accent: '#C4943A', bg: '#FDF8EE', color: '#9A7530', glow: 'rgba(196,148,58,0.35)', label: 'Draft' },
  completed: { accent: '#7B8FA3', bg: '#EEF2F7', color: '#5E7389', glow: 'rgba(123,143,163,0.35)', label: 'Completed' },
  ended: { accent: '#7B8FA3', bg: '#EEF2F7', color: '#5E7389', glow: 'rgba(123,143,163,0.35)', label: 'Ended' },
  past: { accent: '#7B8FA3', bg: '#EEF2F7', color: '#5E7389', glow: 'rgba(123,143,163,0.35)', label: 'Past' },
};
const DEFAULT_STATUS = { accent: '#A9A5A0', bg: '#F5F1EA', color: '#77736A', glow: 'rgba(169,165,160,0.25)', label: 'Unknown' };

function getStatusConfig(status) {
  return STATUS_CONFIG[(status || '').toLowerCase()] || DEFAULT_STATUS;
}

function formatEventDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${month} ${day}, ${year} · ${time}`;
  } catch {
    return null;
  }
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A9A5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A9A5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function UpcomingEventsCards({ upcomingEvents = [] }) {
  const events = Array.isArray(upcomingEvents) ? upcomingEvents.slice(0, 5) : [];
  const hasEvents = events.length > 0;
  const [visible, setVisible] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const styleRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (styleRef.current) return;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes uec-slideIn {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes uec-shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes uec-float {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(-8px); }
      }
      @keyframes uec-pulse {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.5; }
      }
      @keyframes uec-fadeIn {
        from { opacity: 0; transform: scale(0.96); }
        to   { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    styleRef.current = style;
    return () => {
      try { document.head.removeChild(style); } catch (e) {}
    };
  }, []);

  const cardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 16,
    padding: '28px 28px 24px',
    animation: visible ? 'uec-fadeIn 0.5s ease both' : 'none',
    opacity: visible ? 1 : 0,
  };

  if (!hasEvents) {
    return (
      <div style={cardStyle}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
            Upcoming Events
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#A9A5A0', marginTop: 3 }}>
            Your next scheduled events
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 20px',
          gap: 14,
        }}>
          <div style={{ animation: 'uec-float 3.5s ease-in-out infinite' }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <rect x="8" y="12" width="40" height="36" rx="6" stroke="#D7BE80" strokeWidth="1.8" fill="none" opacity="0.7" />
              <line x1="8" y1="24" x2="48" y2="24" stroke="#D7BE80" strokeWidth="1.8" opacity="0.5" />
              <line x1="20" y1="7" x2="20" y2="17" stroke="#D7BE80" strokeWidth="2" strokeLinecap="round" />
              <line x1="36" y1="7" x2="36" y2="17" stroke="#D7BE80" strokeWidth="2" strokeLinecap="round" />
              <rect x="16" y="30" width="7" height="5.5" rx="1.5" fill="#D7BE80" opacity="0.45" />
              <rect x="27" y="30" width="7" height="5.5" rx="1.5" fill="#D7BE80" opacity="0.3" />
              <rect x="16" y="39" width="7" height="5.5" rx="1.5" fill="#D7BE80" opacity="0.25" />
              <rect x="27" y="39" width="7" height="5.5" rx="1.5" fill="#D7BE80" opacity="0.15" />
              <circle cx="42" cy="40" r="9" fill="#F8F4EC" stroke="#D7BE80" strokeWidth="1.5" />
              <line x1="42" y1="36" x2="42" y2="41" stroke="#D7BE80" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="42" y1="41" x2="45" y2="43" stroke="#D7BE80" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600, letterSpacing: '-0.01em' }}>
            No upcoming events
          </div>
          <div style={{ fontSize: 12.5, fontFamily: 'var(--font-sans)', color: '#A9A5A0', textAlign: 'center', lineHeight: 1.5 }}>
            Create an event to get started
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
            Upcoming Events
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#A9A5A0', marginTop: 3 }}>
            Your next scheduled events
          </div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #F8F4EC, #F0EBDD)',
          color: '#B8944F',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          borderRadius: 20,
          padding: '5px 14px',
          whiteSpace: 'nowrap',
          border: '1px solid rgba(184,148,79,0.15)',
        }}>
          {events.length} {events.length === 1 ? 'Event' : 'Events'}
        </div>
      </div>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {events.map((event, idx) => {
          const status = event.status || 'draft';
          const cfg = getStatusConfig(status);
          const dateFormatted = formatEventDate(event.event_date || event.date || event.startDate || event.start_date);
          const guestCount = event.guestCount ?? event.guest_count ?? event.guests ?? 0;
          const location = event.location_name || event.location || event.venue || '';
          const title = event.title || event.name || 'Untitled Event';
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={event.id || idx}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'stretch',
                borderRadius: 12,
                background: isHovered ? '#FFFFFF' : '#FAFAF8',
                border: `1px solid ${isHovered ? '#E8E2D6' : '#F0ECE3'}`,
                overflow: 'hidden',
                cursor: 'pointer',
                transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: isHovered
                  ? `0 8px 24px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03), -4px 0 12px ${cfg.glow}`
                  : '0 1px 3px rgba(0,0,0,0.02)',
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: visible ? `uec-slideIn 0.5s ease both` : 'none',
                animationDelay: `${idx * 0.09 + 0.15}s`,
                opacity: visible ? undefined : 0,
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(-1)}
            >
              {/* Left Accent Border with Shimmer */}
              <div style={{
                width: 4,
                flexShrink: 0,
                background: isHovered
                  ? `linear-gradient(180deg, ${cfg.accent}, ${cfg.accent}88, ${cfg.accent})`
                  : cfg.accent,
                borderRadius: '4px 0 0 4px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: `linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)`,
                  backgroundSize: '100% 200%',
                  animation: 'uec-shimmer 2.5s ease-in-out infinite',
                }} />
              </div>

              {/* Card Content */}
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 18px',
              }}>
                {/* Event Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15,
                    fontFamily: 'var(--font-serif)',
                    color: '#191B1E',
                    fontWeight: 700,
                    marginBottom: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                  }}>
                    {title}
                  </div>

                  {/* Date row */}
                  {dateFormatted && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontFamily: 'var(--font-sans)',
                      color: '#77736A',
                      marginBottom: 5,
                    }}>
                      <CalendarIcon />
                      <span>{dateFormatted}</span>
                    </div>
                  )}

                  {/* Location row */}
                  {location && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontFamily: 'var(--font-sans)',
                      color: '#A9A5A0',
                      marginBottom: 5,
                    }}>
                      <MapPinIcon />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
                    </div>
                  )}

                  {/* Guest count badge */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11.5,
                    fontFamily: 'var(--font-sans)',
                    color: '#77736A',
                    background: '#F5F3EE',
                    borderRadius: 20,
                    padding: '3px 10px 3px 7px',
                    fontWeight: 500,
                  }}>
                    <UsersIcon />
                    <span>{guestCount} {guestCount === 1 ? 'guest' : 'guests'}</span>
                  </div>
                </div>

                {/* Status Pill */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  borderRadius: 20,
                  padding: '5px 12px',
                  textTransform: 'capitalize',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: cfg.bg,
                  color: cfg.color,
                  border: `1px solid ${cfg.accent}22`,
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: cfg.accent,
                    display: 'inline-block',
                    animation: status.toLowerCase() === 'active' || status.toLowerCase() === 'live' ? 'uec-pulse 2s ease-in-out infinite' : 'none',
                  }} />
                  {cfg.label || status}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
