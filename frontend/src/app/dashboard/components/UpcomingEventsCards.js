'use client';

export default function UpcomingEventsCards({ upcomingEvents }) {
  const events = Array.isArray(upcomingEvents) ? upcomingEvents : [];
  const hasEvents = events.length > 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return { month: '---', day: '--' };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { month: '---', day: '--' };
      return {
        month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        day: d.getDate(),
      };
    } catch {
      return { month: '---', day: '--' };
    }
  };

  const getStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'published' || s === 'live') {
      return { background: '#F0F7F0', color: '#4A7C59', border: '1px solid #D4E8D4' };
    }
    if (s === 'draft') {
      return { background: '#F5F1EA', color: '#A09A91', border: '1px solid #E8E2D6' };
    }
    if (s === 'completed' || s === 'ended' || s === 'past') {
      return { background: '#EEF2F7', color: '#6B8EAE', border: '1px solid #D4DEE8' };
    }
    return { background: '#F5F1EA', color: '#A09A91', border: '1px solid #E8E2D6' };
  };

  const cardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 14,
    padding: 28,
  };

  const MapPinIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A9A5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 4 }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );

  const UsersIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 4 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

  if (!hasEvents) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
              Upcoming Events
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#A9A5A0', marginTop: 2 }}>
              Your next scheduled events
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
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="10" width="36" height="32" rx="4" stroke="#D7BE80" strokeWidth="2" fill="none" />
            <line x1="6" y1="20" x2="42" y2="20" stroke="#D7BE80" strokeWidth="2" />
            <line x1="16" y1="6" x2="16" y2="14" stroke="#D7BE80" strokeWidth="2" strokeLinecap="round" />
            <line x1="32" y1="6" x2="32" y2="14" stroke="#D7BE80" strokeWidth="2" strokeLinecap="round" />
            <rect x="14" y="26" width="6" height="5" rx="1" fill="#D7BE80" opacity="0.5" />
            <rect x="24" y="26" width="6" height="5" rx="1" fill="#D7BE80" opacity="0.3" />
            <rect x="14" y="34" width="6" height="5" rx="1" fill="#D7BE80" opacity="0.3" />
            <rect x="24" y="34" width="6" height="5" rx="1" fill="#D7BE80" opacity="0.2" />
          </svg>
          <div style={{ fontSize: 15, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
            No upcoming events
          </div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: '#A9A5A0' }}>
            Create an event to get started
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
            Upcoming Events
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#A9A5A0', marginTop: 2 }}>
            Your next scheduled events
          </div>
        </div>
        <div style={{
          background: '#F8F4EC',
          color: '#B8944F',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          borderRadius: 20,
          padding: '4px 12px',
          whiteSpace: 'nowrap',
        }}>
          {events.length} {events.length === 1 ? 'Event' : 'Events'}
        </div>
      </div>

      {/* Events List */}
      <div>
        {events.map((event, idx) => {
          const { month, day } = formatDate(event.date || event.startDate || event.start_date);
          const status = event.status || 'draft';
          const statusStyle = getStatusStyle(status);
          const guestCount = event.guestCount ?? event.guest_count ?? event.guests ?? 0;
          const location = event.location || event.venue || '';
          const title = event.title || event.name || 'Untitled Event';

          return (
            <div
              key={event.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 16,
                borderRadius: 12,
                background: '#FAFAF8',
                border: '1px solid #F0ECE3',
                marginBottom: idx < events.length - 1 ? 12 : 0,
                transition: 'all 0.25s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E8E2D6';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.04)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FAFAF8';
                e.currentTarget.style.borderColor = '#F0ECE3';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Date Block */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #B8944F, #D7BE80)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  opacity: 0.9,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  letterSpacing: '0.5px',
                }}>
                  {month}
                </div>
                <div style={{
                  fontSize: 22,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  lineHeight: 1.1,
                }}>
                  {day}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15,
                  fontFamily: 'var(--font-serif)',
                  color: '#191B1E',
                  fontWeight: 600,
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {title}
                </div>
                {location && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 12,
                    fontFamily: 'var(--font-sans)',
                    color: '#A9A5A0',
                    marginBottom: 2,
                  }}>
                    <MapPinIcon />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                  color: '#77736A',
                }}>
                  <UsersIcon />
                  <span>{guestCount} {guestCount === 1 ? 'Guest' : 'Guests'}</span>
                </div>
              </div>

              {/* Status Badge */}
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                borderRadius: 8,
                padding: '4px 10px',
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                ...statusStyle,
              }}>
                {status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
