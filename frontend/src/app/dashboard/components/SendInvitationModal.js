'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { isAccepted, isDeclined, isMaybe } from '../../utils/responseHelpers';
import { useModalA11y } from '../../hooks/useModalA11y';
import Icon from '../../components/icons/Icon';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF',
  softBg: '#FAFAF8', error: '#C45E5E', success: '#3B9B6D', indigo: '#6366F1',
};

/* ── Tab Pill ── */
function TabPill({ active, icon, label, count, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '12px 20px',
      background: active ? 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)' : COLORS.white,
      color: active ? COLORS.white : COLORS.stone,
      border: `1px solid ${active ? 'transparent' : COLORS.border}`,
      borderRadius: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
      fontSize: '13px', fontWeight: 700, transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      boxShadow: active ? '0 4px 16px rgba(184,148,79,0.3)' : 'none',
      flex: 1,
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.color = COLORS.gold; e.currentTarget.style.background = 'rgba(184,148,79,0.04)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.stone; e.currentTarget.style.background = COLORS.white; } }}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span style={{
          padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 800,
          background: active ? 'rgba(255,255,255,0.25)' : COLORS.ivory,
          color: active ? COLORS.white : COLORS.stone,
        }}>{count}</span>
      )}
    </button>
  );
}

/* ── Audience Filter Chip ── */
function FilterChip({ label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
      border: `1px solid ${active ? COLORS.gold : COLORS.border}`,
      background: active ? 'rgba(184,148,79,0.08)' : COLORS.white,
      color: active ? COLORS.gold : COLORS.stone,
      fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-sans)',
      transition: 'all 0.2s',
    }}>
      {active && <span style={{ fontSize: '10px', lineHeight: 1 }}>✓</span>}
      {label}
      <span style={{
        fontSize: '10px', fontWeight: 800, padding: '1px 7px', borderRadius: '10px',
        background: active ? COLORS.gold : COLORS.softBg,
        color: active ? COLORS.white : COLORS.stone,
      }}>{count}</span>
    </button>
  );
}

/* ── Guest Row (selectable) ── */
function GuestRow({ guest, selected, onToggle, channel }) {
  const hasContact = channel === 'email'
    ? (guest.email && guest.email !== '-')
    : (guest.phone && guest.phone !== '-');
  const yes = isAccepted(guest.response);
  const no = isDeclined(guest.response);
  const maybe = isMaybe(guest.response);
  const accentColor = yes ? COLORS.gold : no ? COLORS.error : maybe ? COLORS.indigo : COLORS.stone;

  const initials = guest.guest_name
    ? guest.guest_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div
      onClick={() => hasContact && onToggle(guest.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 14px', borderRadius: '10px',
        border: `1px solid ${selected ? COLORS.gold : COLORS.border}`,
        background: !hasContact ? 'rgba(119,115,106,0.04)' : selected ? 'rgba(184,148,79,0.04)' : COLORS.white,
        cursor: hasContact ? 'pointer' : 'default',
        opacity: hasContact ? 1 : 0.5,
        transition: 'all 0.2s',
      }}
    >
      {/* Checkbox */}
      <div style={{
        width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
        border: `2px solid ${selected ? COLORS.gold : COLORS.border}`,
        background: selected ? COLORS.gold : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s',
      }}>
        {selected && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={COLORS.white} strokeWidth="3.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Avatar */}
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
        background: `${accentColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '11px', color: accentColor, fontFamily: 'var(--font-sans)',
      }}>{initials}</div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: '12px', color: COLORS.charcoal, fontFamily: 'var(--font-sans)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{guest.guest_name}</div>
        <div style={{ fontSize: '10px', color: COLORS.stone, fontFamily: 'var(--font-sans)', marginTop: '2px' }}>
          {channel === 'email'
            ? (guest.email && guest.email !== '-' ? guest.email : 'No email')
            : (guest.phone && guest.phone !== '-' ? guest.phone : 'No phone')
          }
        </div>
      </div>

      {/* Status badge */}
      <span style={{
        padding: '2px 8px', borderRadius: '6px', fontSize: '8px', fontWeight: 700,
        background: `${accentColor}14`, color: accentColor,
        fontFamily: 'var(--font-sans)', textTransform: 'uppercase', flexShrink: 0,
      }}>{(guest.response || 'pending').toUpperCase()}</span>

      {/* Already-sent indicator — channel-specific (a guest emailed but never
          texted must still show as unsent on the SMS tab, and vice versa). */}
      {((channel === 'email' && guest.invitation_sent_email) || (channel === 'sms' && guest.invitation_sent_sms)) && (
        <span title={`${channel === 'email' ? 'Email' : 'SMS'} invitation already sent`} style={{
          fontSize: '10px', color: COLORS.success, fontWeight: 700,
        }}>✓ Sent</span>
      )}
    </div>
  );
}


export default function SendInvitationModal({ isOpen, onClose, rsvps, eventId, apiUrl, onSuccess }) {
  const [channel, setChannel] = useState('email'); // 'email' | 'sms'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [audienceFilter, setAudienceFilter] = useState('uninvited'); // 'all', 'uninvited', 'attending', 'pending', 'maybe', 'declined'
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  // Terms §5 consent attestation — required before any SMS send (backend enforces too).
  const [smsConsentAttested, setSmsConsentAttested] = useState(false);

  // Channel-specific "already invited" check — a guest emailed but never
  // texted (or vice versa) must still count as uninvited on the other
  // channel's tab, not disappear from its default "Not Invited" filter.
  const wasInvitedOnChannel = useCallback((r) => channel === 'email' ? !!r.invitation_sent_email : !!r.invitation_sent_sms, [channel]);

  // Filter guests based on channel availability, audience filter, and search query
  const filteredGuests = useMemo(() => {
    return rsvps.filter(r => {
      const hasContact = channel === 'email'
        ? (r.email && r.email !== '-')
        : (r.phone && r.phone !== '-');

      // Search match
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        (r.guest_name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Audience filter
      switch (audienceFilter) {
        case 'uninvited': return hasContact && !wasInvitedOnChannel(r);
        case 'attending': return hasContact && isAccepted(r.response);
        case 'pending': return hasContact && !isAccepted(r.response) && !isDeclined(r.response) && !isMaybe(r.response);
        case 'maybe': return hasContact && isMaybe(r.response);
        case 'declined': return hasContact && isDeclined(r.response);
        case 'no_contact': return !hasContact;
        default: return true; // 'all' - show everyone
      }
    });
  }, [rsvps, channel, audienceFilter, searchQuery, wasInvitedOnChannel]);

  // Counts for filter chips
  const counts = useMemo(() => {
    const hasContact = (r) => channel === 'email' ? (r.email && r.email !== '-') : (r.phone && r.phone !== '-');
    return {
      all: rsvps.length,
      uninvited: rsvps.filter(r => hasContact(r) && !wasInvitedOnChannel(r)).length,
      attending: rsvps.filter(r => hasContact(r) && isAccepted(r.response)).length,
      pending: rsvps.filter(r => hasContact(r) && !isAccepted(r.response) && !isDeclined(r.response) && !isMaybe(r.response)).length,
      maybe: rsvps.filter(r => hasContact(r) && isMaybe(r.response)).length,
      declined: rsvps.filter(r => hasContact(r) && isDeclined(r.response)).length,
      no_contact: rsvps.filter(r => !hasContact(r)).length,
    };
  }, [rsvps, channel, wasInvitedOnChannel]);

  // Email/SMS counts
  const emailCount = useMemo(() => rsvps.filter(r => r.email && r.email !== '-').length, [rsvps]);
  const smsCount = useMemo(() => rsvps.filter(r => r.phone && r.phone !== '-').length, [rsvps]);

  const toggleGuest = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const hasContact = (r) => channel === 'email' ? (r.email && r.email !== '-') : (r.phone && r.phone !== '-');
    const eligible = filteredGuests.filter(r => hasContact(r));
    setSelectedIds(new Set(eligible.map(r => r.id)));
  }, [filteredGuests, channel]);

  const deselectAll = useCallback(() => setSelectedIds(new Set()), []);

  const handleSend = useCallback(async () => {
    if (selectedIds.size === 0 || !eventId) return;
    if (channel === 'sms' && !smsConsentAttested) return;
    setSending(true);
    setResult(null);
    try {
      // One unified endpoint for every channel — the backend normalizes email's
      // sync counts and SMS's possibly-async dispatch into the same response shape.
      const body = channel === 'email'
        ? { channel: 'email', partyIds: Array.from(selectedIds) }
        : { channel: 'sms', messageTemplate: 'Hello {name}, you are invited to our event! RSVP now: {url}', guestIds: Array.from(selectedIds), consentAttested: true };

      const res = await fetch(`${apiUrl}/events/${eventId}/invitations/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const err = new Error(data.message || `Failed to send ${channel} invitations.`);
        err.code = data.error;
        throw err;
      }
      setResult({ success: true, ...data.data });
      // Attestation is per-launch (matching the campaign composer): a follow-up
      // SMS send must be re-confirmed, not inherited from the previous one.
      if (channel === 'sms') setSmsConsentAttested(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      setResult({ success: false, message: err.message, code: err.code });
    } finally {
      setSending(false);
    }
  }, [channel, selectedIds, eventId, apiUrl, onSuccess, smsConsentAttested]);

  // A11Y-9: shared focus-trap/initial-focus/focus-restore/scroll-lock/Escape hook.
  const dialogRef = useModalA11y(isOpen, { onClose });

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(25,27,30,0.55)', backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', animation: 'fadeIn 0.2s ease-out',
    }} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-invitation-modal-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          background: COLORS.white, borderRadius: '20px',
          width: '100%', maxWidth: '640px', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(184,148,79,0.1)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}>

        {/* ═══ Header ═══ */}
        <div style={{
          padding: '24px 28px 20px', borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 id="send-invitation-modal-title" style={{
              fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500,
              color: COLORS.charcoal, margin: 0, letterSpacing: '-0.01em',
            }}>Send Invitations</h2>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: '11px', color: COLORS.stone,
              marginTop: '4px',
            }}>Choose your channel and select guests to invite</p>
          </div>
          <button onClick={onClose} style={{
            width: '32px', height: '32px', borderRadius: '8px', border: 'none',
            background: COLORS.ivory, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#EDE7DB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = COLORS.ivory; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.stone} strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ═══ Channel Tabs ═══ */}
        <div style={{ padding: '16px 28px 0', display: 'flex', gap: '10px' }}>
          <TabPill
            active={channel === 'email'}
            onClick={() => { setChannel('email'); setSelectedIds(new Set()); setResult(null); }}
            count={emailCount}
            label="Email"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
          />
          <TabPill
            active={channel === 'sms'}
            onClick={() => { setChannel('sms'); setSelectedIds(new Set()); setResult(null); }}
            count={smsCount}
            label="SMS"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
          />
        </div>

        {/* ═══ Channel Info Banner ═══ */}
        <div style={{ padding: '12px 28px 0' }}>
          <div style={{
            padding: '10px 14px', borderRadius: '10px', fontSize: '11px', lineHeight: 1.6,
            fontFamily: 'var(--font-sans)',
            background: channel === 'email' ? 'rgba(59,155,109,0.06)' : 'rgba(99,102,241,0.06)',
            border: `1px solid ${channel === 'email' ? 'rgba(59,155,109,0.15)' : 'rgba(99,102,241,0.15)'}`,
            color: COLORS.stone,
          }}>
            {channel === 'email' ? (
              <>
                <strong style={{ color: COLORS.success, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="envelope" size={13} strokeWidth={1.7} /> Email Invitations</strong> — Sends a beautifully designed email with Accept / Decline / Maybe buttons. Each guest gets a unique personalized link. <em>Free with your plan.</em>
              </>
            ) : (
              <>
                <strong style={{ color: COLORS.indigo, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="chat" size={13} strokeWidth={1.7} /> SMS Invitations</strong> — Sends a text message with a unique RSVP link to each selected guest who has a phone number. Uses <strong>this event&apos;s</strong> SMS credit balance (each event has its own wallet). Arabic or emoji messages cost more credits per guest. <em>For advanced options, use the <Link href="/dashboard/campaigns" style={{ color: COLORS.indigo, fontWeight: 700 }}>Campaign Manager</Link>.</em>
              </>
            )}
          </div>
        </div>

        {/* ═══ Audience Filters ═══ */}
        <div style={{ padding: '14px 28px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <FilterChip label="Not Invited" count={counts.uninvited} active={audienceFilter === 'uninvited'} onClick={() => { setAudienceFilter('uninvited'); setSelectedIds(new Set()); }} />
            <FilterChip label="All" count={counts.all} active={audienceFilter === 'all'} onClick={() => { setAudienceFilter('all'); setSelectedIds(new Set()); }} />
            <FilterChip label="Pending" count={counts.pending} active={audienceFilter === 'pending'} onClick={() => { setAudienceFilter('pending'); setSelectedIds(new Set()); }} />
            <FilterChip label="Attending" count={counts.attending} active={audienceFilter === 'attending'} onClick={() => { setAudienceFilter('attending'); setSelectedIds(new Set()); }} />
            <FilterChip label="Maybe" count={counts.maybe} active={audienceFilter === 'maybe'} onClick={() => { setAudienceFilter('maybe'); setSelectedIds(new Set()); }} />
            <FilterChip label="No Contact" count={counts.no_contact} active={audienceFilter === 'no_contact'} onClick={() => { setAudienceFilter('no_contact'); setSelectedIds(new Set()); }} />
          </div>
        </div>

        {/* ═══ Search + Select All ═══ */}
        <div style={{
          padding: '12px 28px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.stone} strokeWidth="2" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" placeholder="Search guests..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 32px', borderRadius: '8px',
                border: `1px solid ${COLORS.border}`, fontSize: '12px', color: COLORS.charcoal,
                fontFamily: 'var(--font-sans)', outline: 'none', transition: 'border-color 0.2s',
                background: COLORS.white,
              }}
              onFocus={e => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={e => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>

          <button onClick={selectedIds.size === filteredGuests.filter(r => channel === 'email' ? (r.email && r.email !== '-') : (r.phone && r.phone !== '-')).length && selectedIds.size > 0 ? deselectAll : selectAll}
            style={{
              padding: '7px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
              border: `1px solid ${COLORS.border}`, background: COLORS.white, color: COLORS.gold,
              cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.background = 'rgba(184,148,79,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.background = COLORS.white; }}
          >
            {selectedIds.size === filteredGuests.filter(r => channel === 'email' ? (r.email && r.email !== '-') : (r.phone && r.phone !== '-')).length && selectedIds.size > 0 ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* ═══ Guest List ═══ */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0 28px 16px',
          display: 'flex', flexDirection: 'column', gap: '6px',
          minHeight: 0,
        }}>
          {filteredGuests.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px', color: COLORS.stone,
              fontSize: '13px', fontStyle: 'italic', fontFamily: 'var(--font-sans)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={COLORS.border} strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
              {audienceFilter === 'no_contact'
                ? `These guests don't have ${channel === 'email' ? 'an email address' : 'a phone number'}.`
                : `No guests match the current filter.`}
            </div>
          ) : (
            filteredGuests.map(guest => (
              <GuestRow
                key={guest.id}
                guest={guest}
                selected={selectedIds.has(guest.id)}
                onToggle={toggleGuest}
                channel={channel}
              />
            ))
          )}
        </div>

        {/* ═══ Result Banner ═══ */}
        {result && (() => {
          // EVENT_NOT_LIVE isn't a failure to fix here — it's a precondition (the
          // event must be paid + active first). Show it as an amber "heads-up"
          // instead of a red error so the organizer knows it's expected.
          const isNotLive = !result.success && result.code === 'EVENT_NOT_LIVE';
          const tone = result.success
            ? { bg: 'rgba(59,155,109,0.06)', bd: 'rgba(59,155,109,0.2)', fg: COLORS.success }
            : isNotLive
              ? { bg: 'rgba(184,148,79,0.08)', bd: 'rgba(184,148,79,0.28)', fg: '#8a6d2f' }
              : { bg: 'rgba(196,94,94,0.06)', bd: 'rgba(196,94,94,0.2)', fg: COLORS.error };
          return (
            <div style={{
              margin: '0 28px 12px', padding: '12px 16px', borderRadius: '10px',
              background: tone.bg, border: `1px solid ${tone.bd}`,
              fontSize: '12px', fontFamily: 'var(--font-sans)', lineHeight: 1.6, color: tone.fg,
            }}>
              {result.success ? (
                result.async ? (
                  <><strong>✓ SMS Queued</strong> — {result.message}</>
                ) : (
                  <>
                    <strong>{result.channel === 'email' ? '✓ Emails Sent' : '✓ SMS Sent'}</strong>
                    {' — '}{result.sent} sent
                    {result.failed > 0 && `, ${result.failed} failed`}
                    {result.skipped > 0 && `, ${result.skipped} skipped`}
                    {result.creditsUsed ? ` · ${result.creditsUsed} credits used` : ''}
                  </>
                )
              ) : isNotLive ? (
                <><strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="hourglass" size={12} strokeWidth={1.8} /> Event not live yet</strong> — {result.message}</>
              ) : (
                <><strong>Error:</strong> {result.message}</>
              )}
              {/* Per-recipient failures were computed server-side (email/qr
                  channels) but never surfaced — the organizer only ever saw an
                  aggregate "X failed" count with no way to know which guests to
                  follow up with manually. */}
              {Array.isArray(result.failures) && result.failures.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${tone.bd}` }}>
                  {result.failures.map((f, i) => {
                    const guest = rsvps.find(r => r.id === f.partyId);
                    return (
                      <div key={f.partyId || i} style={{ fontSize: '11px', marginTop: i === 0 ? 0 : '2px' }}>
                        <strong>{guest?.guest_name || 'Unknown guest'}:</strong> {f.reason || 'Unknown error'}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ Footer / Action ═══ */}
        <div style={{
          padding: '16px 28px 20px', borderTop: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
        }}>
          {/* Terms §5 consent attestation — SMS sends require it (backend rejects without). */}
          {channel === 'sms' && (
            <label style={{
              flexBasis: '100%', display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '10px 12px', borderRadius: '10px', background: 'rgba(99,102,241,0.05)',
              border: `1px solid ${COLORS.border}`, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={smsConsentAttested}
                onChange={e => setSmsConsentAttested(e.target.checked)}
                style={{ marginTop: '2px', width: '15px', height: '15px', accentColor: '#6366F1', flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '11px', color: COLORS.charcoal, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
                I confirm every selected guest has given prior consent to receive text messages about this event —
                for any numbers I added or imported myself, I obtained their express consent, as required by the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#6366F1', fontWeight: 700, textDecoration: 'underline' }}>Terms of Service</a>.
              </span>
            </label>
          )}
          <span style={{ fontSize: '12px', color: COLORS.stone, fontFamily: 'var(--font-sans)' }}>
            <strong style={{ color: COLORS.charcoal }}>{selectedIds.size}</strong> guest{selectedIds.size !== 1 ? 's' : ''} selected
          </span>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
              border: `1px solid ${COLORS.border}`, background: COLORS.white, color: COLORS.stone,
              cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.color = COLORS.charcoal; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.stone; }}
            >Cancel</button>

            <button
              onClick={handleSend}
              disabled={selectedIds.size === 0 || sending || (channel === 'sms' && !smsConsentAttested)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 22px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                background: (selectedIds.size === 0 || (channel === 'sms' && !smsConsentAttested))
                  ? COLORS.border
                  : channel === 'sms'
                    ? 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)'
                    : 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
                color: COLORS.white, border: 'none', cursor: (selectedIds.size === 0 || sending || (channel === 'sms' && !smsConsentAttested)) ? 'default' : 'pointer',
                fontFamily: 'var(--font-sans)', opacity: sending ? 0.7 : 1,
                boxShadow: (selectedIds.size > 0 && !(channel === 'sms' && !smsConsentAttested))
                  ? (channel === 'sms' ? '0 4px 14px rgba(99,102,241,0.3)' : '0 4px 14px rgba(184,148,79,0.3)')
                  : 'none',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {sending ? (
                <>
                  <span style={{
                    width: '14px', height: '14px', border: `2px solid rgba(255,255,255,0.3)`,
                    borderTopColor: COLORS.white, borderRadius: '50%',
                    display: 'inline-block', animation: 'spin 0.8s linear infinite',
                  }} />
                  Sending...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                  </svg>
                  {channel === 'sms'
                    ? `Send ${selectedIds.size > 0 ? `${selectedIds.size} SMS` : 'SMS'}`
                    : `Send ${selectedIds.size > 0 ? `${selectedIds.size} Email${selectedIds.size !== 1 ? 's' : ''}` : 'Emails'}`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
