'use client';
import React, { useState, useCallback } from 'react';
import Link from 'next/link';

const COLORS = {
  gold: '#B8944F',
  goldHover: '#a6833f',
  charcoal: '#191B1E',
  ivory: '#F8F4EC',
  champagne: '#D7BE80',
  stone: '#77736A',
  border: '#E8E2D6',
  white: '#FFFFFF',
  softBg: '#FAFAF8',
};

const STATUS_STYLES = {
  active: {
    background: 'rgba(72,160,100,0.10)',
    color: '#2F9356',
    border: '1px solid rgba(72,160,100,0.18)',
    label: 'Active',
  },
  paused: {
    background: 'rgba(210,160,60,0.10)',
    color: '#B08A1A',
    border: '1px solid rgba(210,160,60,0.18)',
    label: 'Paused',
  },
  completed: {
    background: 'rgba(107,142,174,0.10)',
    color: '#4A7A9B',
    border: '1px solid rgba(107,142,174,0.18)',
    label: 'Completed',
  },
};

/* ── helpers ─────────────────────────────────────────── */

function formatEventDate(dateStr, endDateStr) {
  if (!dateStr) return 'Date TBD';
  const d = new Date(dateStr);
  const dateOpts = { month: 'short', day: 'numeric', year: 'numeric' };
  const timeOpts = { hour: 'numeric', minute: '2-digit', hour12: true };
  const datePart = d.toLocaleDateString('en-US', dateOpts);
  const timePart = d.toLocaleTimeString('en-US', timeOpts);

  if (endDateStr) {
    const ed = new Date(endDateStr);
    const sameDay =
      d.getFullYear() === ed.getFullYear() &&
      d.getMonth() === ed.getMonth() &&
      d.getDate() === ed.getDate();
    if (sameDay) {
      return `${datePart} • ${timePart} — ${ed.toLocaleTimeString('en-US', timeOpts)}`;
    }
    return `${datePart} — ${ed.toLocaleDateString('en-US', dateOpts)}`;
  }
  return `${datePart} • ${timePart}`;
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  }
}

/* ── sub-components ──────────────────────────────────── */

const PinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const CalendarEmptyIcon = () => (
  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={COLORS.champagne} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const DashboardIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/* ── Event Card ──────────────────────────────────────── */

const EventCard = React.memo(function EventCard({ event, isActive, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  const status = STATUS_STYLES[event.status] || STATUS_STYLES.active;

  const handleCopyLink = useCallback(
    (e) => {
      e.stopPropagation();
      const url = `${window.location.origin}/${event.slug || event.id}`;
      copyToClipboard(url);
      setCopiedSlug(true);
      setTimeout(() => setCopiedSlug(false), 1800);
    },
    [event.slug, event.id],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(event.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(event.id);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: COLORS.white,
        border: `1px solid ${isActive ? COLORS.gold : COLORS.border}`,
        borderLeft: isActive ? `3px solid ${COLORS.gold}` : `1px solid ${isActive ? COLORS.gold : COLORS.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(.25,.8,.25,1)',
        boxShadow: hovered
          ? '0 10px 32px rgba(0,0,0,0.07), 0 2px 8px rgba(184,148,79,0.06)'
          : '0 1px 3px rgba(0,0,0,0.03)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        position: 'relative',
      }}
    >
      {/* Cover image / fallback gradient */}
      <div
        style={{
          width: '100px',
          minHeight: '120px',
          flexShrink: 0,
          background: event.cover_image_url
            ? `url(${event.cover_image_url}) center/cover no-repeat`
            : `linear-gradient(135deg, ${COLORS.ivory} 0%, ${COLORS.champagne} 50%, ${COLORS.gold} 100%)`,
          borderRadius: '12px 0 0 12px',
          position: 'relative',
        }}
      >
        {!event.cover_image_url && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: COLORS.white,
              fontSize: '26px',
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              textShadow: '0 1px 4px rgba(0,0,0,0.15)',
            }}
          >
            {event.title ? event.title.charAt(0).toUpperCase() : 'E'}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '6px',
          minWidth: 0,
        }}
      >
        {/* Top row: title + status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '17px',
              fontWeight: 600,
              color: COLORS.charcoal,
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '0.2px',
            }}
          >
            {event.title}
          </h3>

          <span
            style={{
              flexShrink: 0,
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '6px',
              fontSize: '9px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: status.background,
              color: status.color,
              border: status.border,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {status.label}
          </span>
        </div>

        {/* Date */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: COLORS.stone,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={COLORS.stone}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>{formatEventDate(event.date, event.end_date)}</span>
        </div>

        {/* Location */}
        {(event.location_name || event.location_address) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: COLORS.stone,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <PinIcon />
            <span
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {event.location_name}
              {event.location_name && event.location_address ? ' · ' : ''}
              {event.location_address}
            </span>
          </div>
        )}

        {/* Hover actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '6px',
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          <ActionButton icon={<DashboardIcon />} label="View Dashboard" onClick={(e) => { e.stopPropagation(); onSelect(event.id); }} />
          <ActionButton icon={<SettingsIcon />} label="Edit Settings" onClick={(e) => { e.stopPropagation(); onSelect(event.id); }} />
          <ActionButton
            icon={<CopyIcon />}
            label={copiedSlug ? 'Copied!' : 'Copy Link'}
            onClick={handleCopyLink}
            highlight={copiedSlug}
          />
        </div>
      </div>

      {/* Active indicator dot */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: COLORS.gold,
            boxShadow: '0 0 0 3px rgba(184,148,79,0.18)',
          }}
        />
      )}
    </div>
  );
});

/* ── small action button ─────────────────────────────── */

function ActionButton({ icon, label, onClick, highlight }) {
  const [hov, setHov] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: '6px',
        border: `1px solid ${highlight ? 'rgba(72,160,100,0.3)' : COLORS.border}`,
        background: highlight
          ? 'rgba(72,160,100,0.08)'
          : hov
            ? COLORS.ivory
            : COLORS.white,
        color: highlight ? '#2F9356' : hov ? COLORS.gold : COLORS.stone,
        fontSize: '10px',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Empty State ─────────────────────────────────────── */

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '96px',
          height: '96px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${COLORS.ivory} 0%, rgba(215,190,128,0.22) 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <CalendarEmptyIcon />
      </div>

      <h3
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '22px',
          fontWeight: 600,
          color: COLORS.charcoal,
          margin: '0 0 8px 0',
          letterSpacing: '0.3px',
        }}
      >
        No Events Yet
      </h3>

      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          color: COLORS.stone,
          maxWidth: '340px',
          lineHeight: 1.6,
          margin: '0 0 28px 0',
          fontStyle: 'italic',
        }}
      >
        Create your first event to begin managing invitations, RSVPs, and
        seating — all from one elegant dashboard.
      </p>

      <Link
        href="/dashboard/create-event"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 28px',
          borderRadius: '8px',
          background: COLORS.gold,
          color: COLORS.white,
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          textDecoration: 'none',
          letterSpacing: '0.3px',
          transition: 'all 0.25s ease',
          boxShadow: '0 2px 8px rgba(184,148,79,0.25)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = COLORS.goldHover;
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(184,148,79,0.35)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = COLORS.gold;
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(184,148,79,0.25)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <PlusIcon />
        Create Your First Event
      </Link>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────── */

export default function EventsTab({ events = [], activeEventId, onSelectEvent, onRefresh }) {
  const [refreshHovered, setRefreshHovered] = useState(false);
  const [createHovered, setCreateHovered] = useState(false);

  return (
    <div
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* ── Header ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: `1px solid #F0ECE3`,
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '20px',
              fontWeight: 600,
              color: COLORS.charcoal,
              margin: 0,
              letterSpacing: '0.3px',
            }}
          >
            Your Events
          </h2>

          {events.length > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '22px',
                height: '22px',
                padding: '0 7px',
                borderRadius: '20px',
                background: 'rgba(184,148,79,0.10)',
                color: COLORS.gold,
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                border: '1px solid rgba(184,148,79,0.18)',
              }}
            >
              {events.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              onMouseEnter={() => setRefreshHovered(true)}
              onMouseLeave={() => setRefreshHovered(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`,
                background: refreshHovered ? COLORS.ivory : COLORS.white,
                color: refreshHovered ? COLORS.gold : COLORS.stone,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Refresh events"
            >
              <RefreshIcon />
            </button>
          )}

          {/* Create event */}
          <Link
            href="/dashboard/create-event"
            onMouseEnter={() => setCreateHovered(true)}
            onMouseLeave={() => setCreateHovered(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 18px',
              borderRadius: '8px',
              background: createHovered ? COLORS.goldHover : COLORS.gold,
              color: COLORS.white,
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              textDecoration: 'none',
              letterSpacing: '0.3px',
              transition: 'all 0.25s ease',
              boxShadow: createHovered
                ? '0 4px 14px rgba(184,148,79,0.32)'
                : '0 2px 6px rgba(184,148,79,0.20)',
              transform: createHovered ? 'translateY(-1px)' : 'translateY(0)',
            }}
          >
            <PlusIcon />
            Create New Event
          </Link>
        </div>
      </div>

      {/* ── Event List / Empty State ───────────────── */}
      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {events.map((evt) => (
            <EventCard
              key={evt.id}
              event={evt}
              isActive={evt.id === activeEventId}
              onSelect={onSelectEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
