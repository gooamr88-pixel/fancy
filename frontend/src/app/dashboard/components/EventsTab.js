'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';

/* ═══ Design Tokens ═══ */
const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

const STATUS_CONFIG = {
  active: { bg: 'rgba(74,124,89,0.08)', color: '#3A8B55', border: 'rgba(74,124,89,0.20)', label: 'Active', dot: '#4A7C59', glow: 'rgba(74,124,89,0.30)' },
  live: { bg: 'rgba(74,124,89,0.08)', color: '#3A8B55', border: 'rgba(74,124,89,0.20)', label: 'Live', dot: '#4A7C59', glow: 'rgba(74,124,89,0.30)' },
  paused: { bg: 'rgba(210,160,60,0.08)', color: '#B08A1A', border: 'rgba(210,160,60,0.18)', label: 'Paused', dot: '#D2A03C', glow: 'rgba(210,160,60,0.25)' },
  draft: { bg: 'rgba(210,160,60,0.08)', color: '#B08A1A', border: 'rgba(210,160,60,0.18)', label: 'Draft', dot: '#D2A03C', glow: 'rgba(210,160,60,0.25)' },
  completed: { bg: 'rgba(107,142,174,0.08)', color: '#4A7A9B', border: 'rgba(107,142,174,0.18)', label: 'Completed', dot: '#6B8EAE', glow: 'rgba(107,142,174,0.25)' },
  ended: { bg: 'rgba(107,142,174,0.08)', color: '#4A7A9B', border: 'rgba(107,142,174,0.18)', label: 'Ended', dot: '#6B8EAE', glow: 'rgba(107,142,174,0.25)' },
};

const GRADIENTS = [
  'linear-gradient(135deg, #B8944F, #D7BE80)',
  'linear-gradient(135deg, #6B8EAE, #A3C1D9)',
  'linear-gradient(135deg, #8B7EC8, #B0A6D9)',
  'linear-gradient(135deg, #4A7C59, #7AB08A)',
  'linear-gradient(135deg, #C4787A, #E0A6A8)',
  'linear-gradient(135deg, #C4956A, #E0B98E)',
];

/* ═══ CSS ═══ */
const STYLES_ID = 'events-tab-premium-styles';
const CSS = `
@keyframes evtFadeSlideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes evtPulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--pulse-color, rgba(74,124,89,0.35)); }
  50% { box-shadow: 0 0 0 6px var(--pulse-color, rgba(74,124,89,0)); }
}
@keyframes evtShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes evtEmptyFloat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}
@keyframes evtCountUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes evtGradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.evt-card {
  position: relative;
  display: flex;
  align-items: stretch;
  background: #FFFFFF;
  border: 1px solid #E8E2D6;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(.25,.8,.25,1);
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}
.evt-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(0,0,0,0.08), 0 4px 12px rgba(184,148,79,0.08);
  border-color: rgba(184,148,79,0.3);
}
.evt-card[data-active="true"] {
  border-color: #B8944F;
  box-shadow: 0 4px 20px rgba(184,148,79,0.12);
}
.evt-card[data-active="true"]:hover {
  box-shadow: 0 16px 48px rgba(184,148,79,0.15), 0 4px 12px rgba(184,148,79,0.1);
}
.evt-card-cover {
  width: 110px;
  min-height: 140px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.evt-card-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(0,0,0,0.08) 100%);
  pointer-events: none;
}
.evt-card-actions {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.25s ease, transform 0.25s ease;
  pointer-events: none;
}
.evt-card:hover .evt-card-actions {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.evt-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid #E8E2D6;
  background: #FFFFFF;
  color: #77736A;
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.evt-action-btn:hover {
  background: #F8F4EC;
  color: #B8944F;
  border-color: rgba(184,148,79,0.3);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(184,148,79,0.1);
}
.evt-action-btn[data-highlight="true"] {
  background: rgba(74,124,89,0.06);
  border-color: rgba(74,124,89,0.25);
  color: #3A8B55;
}
.evt-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: 10px;
  background: linear-gradient(135deg, #B8944F, #D7BE80);
  background-size: 200% 200%;
  animation: evtGradientShift 4s ease infinite;
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-sans);
  text-decoration: none;
  letter-spacing: 0.3px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(184,148,79,0.25);
  border: none;
  cursor: pointer;
}
.evt-create-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(184,148,79,0.35);
}
@media (max-width: 640px) {
  .evt-card-cover {
    width: 80px;
    min-height: 110px;
  }
  .evt-card-meta {
    flex-direction: column;
    gap: 4px !important;
  }
}
`;

/* ═══ Helpers ═══ */
function formatEventDate(dateStr, endDateStr) {
  if (!dateStr) return 'Date TBD';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Date TBD';
  const dateOpts = { month: 'short', day: 'numeric', year: 'numeric' };
  const timeOpts = { hour: 'numeric', minute: '2-digit', hour12: true };
  const datePart = d.toLocaleDateString('en-US', dateOpts);
  const timePart = d.toLocaleTimeString('en-US', timeOpts);

  if (endDateStr) {
    const ed = new Date(endDateStr);
    if (!isNaN(ed.getTime())) {
      const sameDay = d.toDateString() === ed.toDateString();
      if (sameDay) return `${datePart} · ${timePart} — ${ed.toLocaleTimeString('en-US', timeOpts)}`;
      return `${datePart} — ${ed.toLocaleDateString('en-US', dateOpts)}`;
    }
  }
  return `${datePart} · ${timePart}`;
}

function getRelativeDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Past';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `In ${days} days`;
  if (days <= 30) return `In ${Math.ceil(days / 7)} weeks`;
  return null;
}

function copyToClipboard(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text);
}

/* ═══ Icons ═══ */
const CalendarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const PinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const DashboardIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/* ═══ Event Card ═══ */
const EventCard = React.memo(function EventCard({ event, index, isActive, onSelect }) {
  const [copiedSlug, setCopiedSlug] = useState(false);
  const status = STATUS_CONFIG[event.status] || STATUS_CONFIG.active;
  const gradient = GRADIENTS[index % GRADIENTS.length];

  const handleCopyLink = useCallback((e) => {
    e.stopPropagation();
    copyToClipboard(`${window.location.origin}/${event.slug || event.id}`);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 1800);
  }, [event.slug, event.id]);

  const eventDate = event.event_date || event.date;
  const relDate = getRelativeDate(eventDate);
  const isActiveStatus = ['active', 'live'].includes(event.status);

  return (
    <div
      className="evt-card"
      data-active={isActive}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(event.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(event.id); }}
      style={{ animation: `evtFadeSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) ${index * 0.08}s both` }}
    >
      {/* Cover / Avatar */}
      <div className="evt-card-cover" style={{
        background: event.cover_image_url
          ? `url(${event.cover_image_url}) center/cover no-repeat`
          : gradient,
      }}>
        {!event.cover_image_url && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', fontSize: 32, fontFamily: 'var(--font-serif)',
            fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            {event.title ? event.title.charAt(0).toUpperCase() : 'E'}
          </div>
        )}

        {/* Active indicator glow ring on cover */}
        {isActive && (
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            width: 8, height: 8, borderRadius: '50%', background: COLORS.gold,
            boxShadow: `0 0 0 3px rgba(184,148,79,0.25)`,
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1, padding: '16px 20px', display: 'flex',
        flexDirection: 'column', justifyContent: 'center', gap: 6, minWidth: 0,
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{
            fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600,
            color: COLORS.charcoal, margin: 0, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.2px',
          }}>
            {event.title}
          </h3>

          {/* Status pill */}
          <span style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 20,
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            background: status.bg, color: status.color, border: `1px solid ${status.border}`,
            fontFamily: 'var(--font-sans)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: status.dot,
              boxShadow: isActiveStatus ? `0 0 0 2px ${status.glow}` : 'none',
              animation: isActiveStatus ? 'evtPulse 2s ease-in-out infinite' : 'none',
              '--pulse-color': status.glow,
            }} />
            {status.label}
          </span>
        </div>

        {/* Date + Location meta */}
        <div className="evt-card-meta" style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 2 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, color: COLORS.stone, fontFamily: 'var(--font-sans)',
          }}>
            <CalendarIcon />
            <span>{formatEventDate(eventDate, event.end_date)}</span>
            {relDate && (
              <span style={{
                padding: '1px 8px', borderRadius: 10,
                background: relDate === 'Today' ? 'rgba(74,124,89,0.08)' : 'rgba(184,148,79,0.08)',
                color: relDate === 'Today' ? '#3A8B55' : COLORS.gold,
                fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                fontFamily: 'var(--font-sans)',
              }}>
                {relDate}
              </span>
            )}
          </div>

          {(event.location_name || event.location_address) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, color: COLORS.stone, fontFamily: 'var(--font-sans)',
              overflow: 'hidden',
            }}>
              <PinIcon />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {event.location_name || event.location_address}
              </span>
            </div>
          )}
        </div>

        {/* Guest count if available */}
        {(event.guest_count > 0 || event.guestCount > 0) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: COLORS.stone, fontFamily: 'var(--font-sans)', marginTop: 1,
          }}>
            <UsersIcon />
            <span>{event.guest_count || event.guestCount} guests</span>
          </div>
        )}

        {/* Hover action buttons */}
        <div className="evt-card-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <button className="evt-action-btn" onClick={(e) => { e.stopPropagation(); onSelect(event.id); }}>
            <DashboardIcon /> View Dashboard
          </button>
          <button className="evt-action-btn" onClick={(e) => { e.stopPropagation(); onSelect(event.id); }}>
            <SettingsIcon /> Settings
          </button>
          <button
            className="evt-action-btn"
            data-highlight={copiedSlug ? "true" : "false"}
            onClick={handleCopyLink}
          >
            <CopyIcon /> {copiedSlug ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
});

/* ═══ Empty State ═══ */
function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '64px 24px', textAlign: 'center',
    }}>
      <div style={{ animation: 'evtEmptyFloat 3s ease-in-out infinite', marginBottom: 28 }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="36" stroke="#E8E2D6" strokeWidth="1.5" strokeDasharray="4 3" />
          <rect x="24" y="22" width="32" height="36" rx="4" fill="#F8F4EC" stroke="#D7BE80" strokeWidth="1.2" />
          <line x1="30" y1="18" x2="30" y2="26" stroke="#D7BE80" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="50" y1="18" x2="50" y2="26" stroke="#D7BE80" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="24" y1="32" x2="56" y2="32" stroke="#D7BE80" strokeWidth="1" />
          <circle cx="33" cy="40" r="2" fill="#B8944F" opacity="0.5" />
          <circle cx="40" cy="40" r="2" fill="#B8944F" opacity="0.7" />
          <circle cx="47" cy="40" r="2" fill="#B8944F" opacity="0.5" />
          <circle cx="33" cy="48" r="2" fill="#D7BE80" opacity="0.4" />
          <circle cx="40" cy="48" r="2" fill="#D7BE80" opacity="0.4" />
          <path d="M60 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#B8944F" opacity="0.3" />
          <path d="M18 56l0.6 1.8 1.8 0.6-1.8 0.6-0.6 1.8-0.6-1.8-1.8-0.6 1.8-0.6z" fill="#D7BE80" opacity="0.4" />
        </svg>
      </div>

      <h3 style={{
        fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600,
        color: COLORS.charcoal, margin: '0 0 8px', letterSpacing: '0.3px',
      }}>
        No Events Yet
      </h3>
      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: 13, color: COLORS.stone,
        maxWidth: 340, lineHeight: 1.65, margin: '0 0 32px',
      }}>
        Create your first event to begin managing invitations, RSVPs, and seating — all from one elegant dashboard.
      </p>
      <Link href="/dashboard/create-event" className="evt-create-btn">
        <PlusIcon /> Create Your First Event
      </Link>
    </div>
  );
}

/* ═══ Main Component ═══ */
export default function EventsTab({ events = [], activeEventId, onSelectEvent, onRefresh }) {
  const [refreshHovered, setRefreshHovered] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById(STYLES_ID)) {
      const el = document.createElement('style');
      el.id = STYLES_ID;
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);

  return (
    <div style={{
      background: COLORS.white, border: `1px solid ${COLORS.border}`,
      borderRadius: 16, padding: 28,
      display: 'flex', flexDirection: 'column', gap: 24,
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #F0ECE3', paddingBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700,
            color: COLORS.charcoal, margin: 0, letterSpacing: '-0.01em',
          }}>
            Your Events
          </h2>
          {events.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 26, height: 26, padding: '0 8px', borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(184,148,79,0.10), rgba(215,190,128,0.10))',
              color: COLORS.gold, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
              border: '1px solid rgba(184,148,79,0.18)',
              animation: 'evtCountUp 0.5s ease both',
            }}>
              {events.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onRefresh && (
            <button
              onClick={onRefresh}
              onMouseEnter={() => setRefreshHovered(true)}
              onMouseLeave={() => setRefreshHovered(false)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                background: refreshHovered ? COLORS.ivory : COLORS.white,
                color: refreshHovered ? COLORS.gold : COLORS.stone,
                cursor: 'pointer', transition: 'all 0.25s ease',
                transform: refreshHovered ? 'rotate(45deg)' : 'rotate(0)',
              }}
              title="Refresh events"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}

          <Link href="/dashboard/create-event" className="evt-create-btn">
            <PlusIcon /> Create Event
          </Link>
        </div>
      </div>

      {/* ── Event List ── */}
      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.map((evt, i) => (
            <EventCard
              key={evt.id}
              event={evt}
              index={i}
              isActive={evt.id === activeEventId}
              onSelect={onSelectEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
