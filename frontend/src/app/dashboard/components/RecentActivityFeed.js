'use client';

import { useEffect, useRef } from 'react';

function getRelativeTime(ts) {
  if (!ts) return '';
  const now = new Date();
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActionConfig(action, rsvpStatus, metadata) {
  const a = (action || '').toLowerCase();
  const rs = (rsvpStatus || '').toLowerCase();

  if (a === 'rsvp_submitted' || a === 'rsvp') {
    if (rs === 'yes' || rs === 'accepted' || rs === 'attending') {
      return {
        bg: '#F0F7F0',
        color: '#4A7C59',
        text: 'accepted the invitation',
        icon: 'check',
      };
    }
    if (rs === 'no' || rs === 'declined') {
      return {
        bg: '#FDF2F2',
        color: '#C0736A',
        text: 'declined the invitation',
        icon: 'x',
      };
    }
    return {
      bg: '#F8F4EC',
      color: '#B8944F',
      text: 'submitted RSVP',
      icon: 'check',
    };
  }
  if (a === 'check_in' || a === 'checked_in') {
    return {
      bg: '#F0F4F8',
      color: '#6B8EAE',
      text: 'checked in at the event',
      icon: 'user-check',
    };
  }
  if (a === 'sms_sent' || a === 'campaign_sent') {
    const count = metadata?.count || metadata?.recipientCount || '';
    return {
      bg: '#F8F4EC',
      color: '#B8944F',
      text: count ? `Message sent to ${count} guests` : 'Message campaign sent',
      icon: 'message',
      noGuest: true,
    };
  }
  if (a === 'table_assigned') {
    return {
      bg: '#F5F0FA',
      color: '#8B7EC8',
      text: 'was assigned to a table',
      icon: 'grid',
    };
  }
  return {
    bg: '#F8F4EC',
    color: '#B8944F',
    text: action ? action.replace(/_/g, ' ') : 'performed an action',
    icon: 'info',
  };
}

function ActionIcon({ type, color }) {
  const s = { width: 18, height: 18 };
  const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

  if (type === 'check') {
    return (
      <svg {...props}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (type === 'x') {
    return (
      <svg {...props}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  if (type === 'user-check') {
    return (
      <svg {...props}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <polyline points="17 11 19 13 23 9" />
      </svg>
    );
  }
  if (type === 'message') {
    return (
      <svg {...props}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  if (type === 'grid') {
    return (
      <svg {...props}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }
  // info default
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export default function RecentActivityFeed({ recentActivity }) {
  const styleInjected = useRef(false);

  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes live-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.3); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      try { document.head.removeChild(style); } catch (e) {}
    };
  }, []);

  const activities = Array.isArray(recentActivity) ? recentActivity : [];
  const hasActivity = activities.length > 0;

  const cardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 14,
    padding: 28,
  };

  if (!hasActivity) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
              Recent Activity
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#A9A5A0', marginTop: 2 }}>
              Latest actions across your events
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          gap: 10,
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="#D7BE80" strokeWidth="1.5" fill="none" />
            <line x1="20" y1="12" x2="20" y2="21" stroke="#D7BE80" strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="21" x2="26" y2="25" stroke="#D7BE80" strokeWidth="2" strokeLinecap="round" />
            <circle cx="20" cy="20" r="2" fill="#D7BE80" />
          </svg>
          <div style={{ fontSize: 14, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
            No recent activity
          </div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: '#A9A5A0' }}>
            Activity will appear here as guests interact
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
            Recent Activity
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#A9A5A0', marginTop: 2 }}>
            Latest actions across your events
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#4A7C59',
            display: 'inline-block',
            animation: 'live-pulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 11,
            fontFamily: 'var(--font-sans)',
            color: '#4A7C59',
            fontWeight: 600,
          }}>
            Live
          </span>
        </div>
      </div>

      {/* Activity List */}
      <div>
        {activities.map((activity, idx) => {
          const action = activity.action || activity.type || '';
          const rsvpStatus = activity.rsvpStatus || activity.rsvp_status || activity.status || '';
          const metadata = activity.metadata || activity.meta || {};
          const config = getActionConfig(action, rsvpStatus, metadata);
          const guestName = activity.guestName || activity.guest_name || activity.name || '';
          const timestamp = activity.timestamp || activity.created_at || activity.createdAt || activity.time || '';
          const isLast = idx === activities.length - 1;

          return (
            <div
              key={activity.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 0',
                borderBottom: isLast ? 'none' : '1px solid #F5F1EA',
                transition: 'all 0.2s ease',
                borderRadius: 0,
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(248,244,236,0.5)';
                e.currentTarget.style.marginLeft = '-8px';
                e.currentTarget.style.marginRight = '-8px';
                e.currentTarget.style.paddingLeft = '8px';
                e.currentTarget.style.paddingRight = '8px';
                e.currentTarget.style.borderRadius = '8px';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.marginLeft = '0';
                e.currentTarget.style.marginRight = '0';
                e.currentTarget.style.paddingLeft = '0';
                e.currentTarget.style.paddingRight = '0';
                e.currentTarget.style.borderRadius = '0';
              }}
            >
              {/* Avatar/Icon */}
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: config.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ActionIcon type={config.icon} color={config.color} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.5,
                  color: '#555',
                }}>
                  {config.noGuest ? (
                    <span>{config.text}</span>
                  ) : (
                    <>
                      <span style={{ fontWeight: 700, color: '#191B1E' }}>{guestName}</span>
                      {' '}
                      <span>{config.text}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <div style={{
                fontSize: 11,
                fontFamily: 'var(--font-sans)',
                color: '#C4C0B9',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {getRelativeTime(timestamp)}
              </div>
            </div>
          );
        })}
      </div>

      {/* View All Button */}
      <div style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px solid #F0ECE3',
        textAlign: 'center',
      }}>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: '#B8944F',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            padding: '4px 8px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
            e.currentTarget.style.color = '#a6833f';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
            e.currentTarget.style.color = '#B8944F';
          }}
        >
          View All Activity →
        </button>
      </div>
    </div>
  );
}
