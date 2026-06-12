'use client';
import React from 'react';

function getRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActionText(action, metadata) {
  switch (action) {
    case 'rsvp_submitted': {
      const resp = metadata?.response;
      if (resp === 'yes') return 'responded Accepts';
      if (resp === 'no') return 'responded Declines';
      return 'submitted RSVP';
    }
    case 'check_in':
      return 'checked in';
    case 'table_assigned':
      return 'was assigned a table';
    case 'sms_sent': {
      const count = metadata?.guest_count || metadata?.count;
      return count ? `Message sent to ${count} guests` : 'Message sent';
    }
    default:
      return action?.replace(/_/g, ' ') || 'performed an action';
  }
}

function getActionIcon(action, metadata) {
  switch (action) {
    case 'rsvp_submitted': {
      const resp = metadata?.response;
      if (resp === 'yes') {
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      }
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    }
    case 'check_in':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'table_assigned':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case 'sms_sent':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}

export default function RecentActivityFeed({ recentActivity }) {
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
        Recent Activity
      </h3>

      {!recentActivity || recentActivity.length === 0 ? (
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
          No recent activity
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentActivity.map((entry, idx) => {
              const isLast = idx === recentActivity.length - 1;
              const actionText = getActionText(entry.action, entry.metadata);
              const isSms = entry.action === 'sms_sent';

              return (
                <div
                  key={entry.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 0',
                    borderBottom: isLast ? 'none' : '1px solid #F5F1EA',
                  }}
                >
                  {/* Icon circle */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#F8F4EC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {getActionIcon(entry.action, entry.metadata)}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontFamily: 'var(--font-sans)',
                        color: '#191B1E',
                        lineHeight: 1.4,
                      }}
                    >
                      {isSms ? (
                        <span>{actionText}</span>
                      ) : (
                        <>
                          <span style={{ fontWeight: 700 }}>{entry.guest_name}</span>{' '}
                          <span style={{ fontWeight: 400 }}>{actionText}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#A9A5A0',
                      fontFamily: 'var(--font-sans)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getRelativeTime(entry.created_at)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* View All button */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: '#B8944F',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                padding: '6px 12px',
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
              View All Activity
            </button>
          </div>
        </>
      )}
    </div>
  );
}
