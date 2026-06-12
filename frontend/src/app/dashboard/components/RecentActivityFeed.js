'use client';

import { useState, useEffect, useRef } from 'react';

function getRelativeTime(ts) {
  if (!ts) return '';
  const now = new Date();
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ACTION_CONFIG = {
  rsvp_submitted: { dot: '#B8944F', bg: '#F8F4EC', color: '#B8944F', text: 'submitted an RSVP', icon: 'envelope' },
  rsvp: { dot: '#B8944F', bg: '#F8F4EC', color: '#B8944F', text: 'submitted an RSVP', icon: 'envelope' },
  guest_checked_in: { dot: '#4A7C59', bg: '#F0F7F0', color: '#4A7C59', text: 'checked in', icon: 'check' },
  check_in: { dot: '#4A7C59', bg: '#F0F7F0', color: '#4A7C59', text: 'checked in', icon: 'check' },
  checked_in: { dot: '#4A7C59', bg: '#F0F7F0', color: '#4A7C59', text: 'checked in', icon: 'check' },
  table_assigned: { dot: '#8B6FC0', bg: '#F5F0FA', color: '#8B6FC0', text: 'was assigned to a table', icon: 'grid' },
};
const DEFAULT_ACTION = { dot: '#77736A', bg: '#F5F1EA', color: '#77736A', text: 'performed an action', icon: 'bell' };

function getActionConfig(action) {
  return ACTION_CONFIG[(action || '').toLowerCase()] || {
    ...DEFAULT_ACTION,
    text: action ? action.replace(/_/g, ' ') : DEFAULT_ACTION.text,
  };
}

function ActionIcon({ type, color, size = 14 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

  if (type === 'envelope') {
    return (
      <svg {...props}>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <polyline points="22,4 12,13 2,4" />
      </svg>
    );
  }
  if (type === 'check') {
    return (
      <svg {...props}>
        <polyline points="20 6 9 17 4 12" />
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
  // bell default
  return (
    <svg {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function RecentActivityFeed({ recentActivity = [] }) {
  const activities = Array.isArray(recentActivity) ? recentActivity.slice(0, 10) : [];
  const hasActivity = activities.length > 0;
  const [visible, setVisible] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const styleRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (styleRef.current) return;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes raf-slideIn {
        from { opacity: 0; transform: translateX(-20px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes raf-fadeIn {
        from { opacity: 0; transform: scale(0.97); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes raf-livePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: 0.5; transform: scale(1.4); }
      }
      @keyframes raf-float {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50%      { transform: translateY(-6px) rotate(2deg); }
      }
      @keyframes raf-dotPop {
        0%   { transform: scale(0); }
        60%  { transform: scale(1.3); }
        100% { transform: scale(1); }
      }
      @keyframes raf-lineGrow {
        from { transform: scaleY(0); }
        to   { transform: scaleY(1); }
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
    animation: visible ? 'raf-fadeIn 0.5s ease both' : 'none',
    opacity: visible ? 1 : 0,
  };

  if (!hasActivity) {
    return (
      <div style={cardStyle}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
            Recent Activity
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#A9A5A0', marginTop: 3 }}>
            Latest actions across your events
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
          <div style={{ animation: 'raf-float 4s ease-in-out infinite' }}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="20" stroke="#D7BE80" strokeWidth="1.5" fill="none" opacity="0.6" />
              <circle cx="26" cy="26" r="13" stroke="#D7BE80" strokeWidth="1" fill="none" opacity="0.3" />
              <line x1="26" y1="16" x2="26" y2="27" stroke="#D7BE80" strokeWidth="2" strokeLinecap="round" />
              <line x1="26" y1="27" x2="33" y2="31" stroke="#D7BE80" strokeWidth="2" strokeLinecap="round" />
              <circle cx="26" cy="26" r="2.5" fill="#D7BE80" opacity="0.7" />
              {/* Small decorative dots */}
              <circle cx="26" cy="10" r="1.5" fill="#D7BE80" opacity="0.5" />
              <circle cx="42" cy="26" r="1.5" fill="#D7BE80" opacity="0.5" />
              <circle cx="26" cy="42" r="1.5" fill="#D7BE80" opacity="0.5" />
              <circle cx="10" cy="26" r="1.5" fill="#D7BE80" opacity="0.5" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600, letterSpacing: '-0.01em' }}>
            No recent activity
          </div>
          <div style={{ fontSize: 12.5, fontFamily: 'var(--font-sans)', color: '#A9A5A0', textAlign: 'center', lineHeight: 1.5 }}>
            Activity will appear here as guests interact
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
            Recent Activity
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#A9A5A0', marginTop: 3 }}>
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
            animation: 'raf-livePulse 2s ease-in-out infinite',
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

      {/* Timeline Feed */}
      <div style={{ position: 'relative', paddingLeft: 28 }}>
        {/* Vertical timeline line with gradient */}
        <div style={{
          position: 'absolute',
          left: 7,
          top: 6,
          bottom: 6,
          width: 2,
          background: 'linear-gradient(180deg, #B8944F 0%, #D7BE80 40%, rgba(215,190,128,0.2) 85%, transparent 100%)',
          borderRadius: 2,
          transformOrigin: 'top',
          animation: visible ? 'raf-lineGrow 0.8s ease-out both' : 'none',
          animationDelay: '0.2s',
        }} />

        {activities.map((activity, idx) => {
          const action = activity.action || activity.type || '';
          const config = getActionConfig(action);
          const guestName = activity.guest_name || activity.guestName || activity.name || '';
          const timestamp = activity.created_at || activity.timestamp || activity.createdAt || activity.time || '';
          const isHovered = hoveredIdx === idx;
          const isLast = idx === activities.length - 1;

          return (
            <div
              key={activity.id || idx}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '12px 14px 12px 16px',
                marginBottom: isLast ? 0 : 2,
                borderRadius: 10,
                background: isHovered ? 'rgba(248,244,236,0.6)' : 'transparent',
                transition: 'all 0.25s ease',
                cursor: 'default',
                animation: visible ? 'raf-slideIn 0.45s ease both' : 'none',
                animationDelay: `${idx * 0.07 + 0.25}s`,
                opacity: visible ? undefined : 0,
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(-1)}
            >
              {/* Timeline Dot */}
              <div style={{
                position: 'absolute',
                left: -24,
                top: 16,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#FFFFFF',
                border: `2.5px solid ${config.dot}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                boxShadow: isHovered ? `0 0 0 4px ${config.dot}18` : 'none',
                transition: 'box-shadow 0.3s ease',
                animation: visible ? 'raf-dotPop 0.4s ease both' : 'none',
                animationDelay: `${idx * 0.07 + 0.35}s`,
              }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: config.dot,
                }} />
              </div>

              {/* Icon Circle */}
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: config.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: `1px solid ${config.dot}15`,
                transition: 'transform 0.2s ease',
                transform: isHovered ? 'scale(1.08)' : 'scale(1)',
              }}>
                <ActionIcon type={config.icon} color={config.color} size={15} />
              </div>

              {/* Text Content */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <div style={{
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.55,
                  color: '#555',
                }}>
                  {guestName ? (
                    <>
                      <span style={{ fontWeight: 700, color: '#191B1E' }}>{guestName}</span>
                      {' '}
                      <span>{config.text}</span>
                    </>
                  ) : (
                    <span style={{ color: '#444' }}>{config.text}</span>
                  )}
                </div>
                {/* Timestamp below text */}
                <div style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-sans)',
                  color: '#C4C0B9',
                  fontWeight: 500,
                  marginTop: 3,
                }}>
                  {getRelativeTime(timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
