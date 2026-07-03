'use client';

import React, { useState, useMemo, useCallback, memo } from 'react';
import { toast } from '../../utils/toast';
import { isAccepted, isDeclined, isMaybe } from '../../utils/responseHelpers';
import { findMealField } from '../../utils/mealField';
import FeatureGate from './FeatureGate';
import EditGuestModal from './EditGuestModal';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

const PAGE_SIZE = 20;
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/* ── Stat Mini Card ── */
function StatMini({ icon, value, label, accent }) {
  return (
    <div style={{
      background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '12px',
      padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
      borderLeft: `3px solid ${accent}`, transition: 'box-shadow 0.25s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.05)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        background: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 800, color: COLORS.charcoal, fontFamily: 'var(--font-sans)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '10px', fontWeight: 600, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px', fontFamily: 'var(--font-sans)' }}>{label}</div>
      </div>
    </div>
  );
}

/* ── Guest Card ── */
const GuestCard = memo(function GuestCard({ guest, tables, onAssignTable, customFields, event, onEdit, onDelete, deleting }) {
  const [expanded, setExpanded] = useState(false);
  const yes = isAccepted(guest.response);
  const no = isDeclined(guest.response);
  const maybe = isMaybe(guest.response);
  const accentColor = yes ? COLORS.gold : no ? '#C45E5E' : maybe ? '#6366F1' : COLORS.stone;

  const initials = guest.guest_name
    ? guest.guest_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  // Companions the guest brought (guests). The primary guest is included in
  // that table, so a party of N typically has N rows; surface them all.
  const party = Array.isArray(guest.guests) ? guest.guests : [];

  // Custom-question answers the party head gave during RSVP — resolve each
  // field_id against the event's field definitions to show a human label.
  // The meal field is excluded here since it's already shown via meal_selection.
  const mealField = findMealField(customFields);
  const customAnswers = (guest.customAnswers || [])
    .filter((a) => !mealField || a.field_id !== mealField.id)
    .map((a) => ({
      label: (customFields || []).find((f) => f.id === a.field_id)?.field_label || 'Question',
      value: a.answer_value,
    }))
    .filter((a) => a.value !== null && a.value !== undefined && String(a.value).trim() !== '');

  const hasDetails = party.length > 0 || (guest.notes && guest.notes.trim()) || customAnswers.length > 0;

  return (
    <div style={{
      background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '12px',
      padding: '20px', borderLeft: `3px solid ${accentColor}`,
      transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)', display: 'flex', gap: '14px',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Avatar */}
      <div style={{
        width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
        background: yes ? 'rgba(184,148,79,0.12)' : no ? 'rgba(196,94,94,0.1)' : maybe ? 'rgba(99,102,241,0.1)' : 'rgba(119,115,106,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '14px', color: accentColor, fontFamily: 'var(--font-sans)',
      }}>{initials}</div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: Name + Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px', color: COLORS.charcoal, fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {guest.guest_name}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {event?.track_guest_side && guest.side && (
              <span style={{
                padding: '2px 10px', borderRadius: '6px', fontSize: '9px', fontWeight: 700,
                background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontFamily: 'var(--font-sans)',
              }}>
                {event?.event_type === 'wedding'
                  ? (guest.side === 'partner1' ? "Groom's Side" : "Bride's Side")
                  : (guest.side === 'partner1' ? "Partner 1's Side" : "Partner 2's Side")}
              </span>
            )}
            <span style={{
              padding: '2px 10px', borderRadius: '6px', fontSize: '9px', fontWeight: 700,
              background: yes ? 'rgba(184,148,79,0.1)' : no ? 'rgba(196,94,94,0.08)' : maybe ? 'rgba(99,102,241,0.1)' : 'rgba(119,115,106,0.1)',
              color: accentColor, fontFamily: 'var(--font-sans)', textTransform: 'uppercase',
            }}>
              {(guest.response || 'pending').toUpperCase()}
            </span>
            <button onClick={() => onEdit(guest)} title="Edit guest" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px',
              borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.stone,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = COLORS.ivory; e.currentTarget.style.color = COLORS.gold; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLORS.stone; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </button>
            <button onClick={() => onDelete(guest.id)} title="Delete guest" disabled={deleting} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px',
              borderRadius: '6px', border: 'none', background: 'transparent', cursor: deleting ? 'wait' : 'pointer',
              color: COLORS.stone, opacity: deleting ? 0.4 : 1,
            }}
              onMouseEnter={e => { if (!deleting) { e.currentTarget.style.background = 'rgba(196,94,94,0.08)'; e.currentTarget.style.color = '#C45E5E'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLORS.stone; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
            </button>
          </span>
        </div>

        {/* Row 2: Contact Info */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '11px', color: COLORS.stone, fontFamily: 'var(--font-sans)', marginBottom: '8px' }}>
          {guest.email && guest.email !== '-' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              {guest.email}
            </span>
          )}
          {guest.phone && guest.phone !== '-' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              {guest.phone}
            </span>
          )}
        </div>

        {/* Row 3: Party + Meal + Table */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Party Size */}
          <span style={{
            padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 600,
            background: COLORS.ivory, color: COLORS.stone, fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            {guest.party_size} {guest.party_size === 1 ? 'guest' : 'guests'}
          </span>

          {/* Meal */}
          {guest.meal && guest.meal !== '-' && (
            <span style={{
              padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 600,
              background: COLORS.ivory, color: COLORS.stone, fontFamily: 'var(--font-sans)',
              maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '4px',
            }} title={guest.meal}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>
              {guest.meal}
            </span>
          )}

          {/* Table Assignment */}
          {yes && (
            <select
              value={guest.tableId || ''}
              onChange={e => onAssignTable(guest.id, e.target.value)}
              style={{
                padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600,
                border: `1px solid ${COLORS.border}`, background: COLORS.white, color: COLORS.charcoal,
                fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={e => { e.target.style.borderColor = COLORS.border; }}
              aria-label={`Assign table for ${guest.guest_name}`}
            >
              <option value="">No Table</option>
              {tables.map(t => {
                const isCurrent = t.id === guest.tableId;
                const remaining = t.max_capacity - t.occupied;
                return (
                  <option key={t.id} value={t.id} disabled={!isCurrent && remaining < guest.party_size}>
                    {t.table_name} ({isCurrent ? 'Current' : `${remaining} left`})
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Row 4: Party member details (expandable) */}
        {hasDetails && (
          <div style={{ marginTop: '10px', borderTop: `1px dashed ${COLORS.border}`, paddingTop: '8px' }}>
            <button onClick={() => setExpanded(v => !v)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: '11px', fontWeight: 700, color: COLORS.gold, fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              {expanded ? '▾' : '▸'} {party.length > 0 ? `${party.length} party member${party.length === 1 ? '' : 's'}` : 'Details'}
            </button>

            {expanded && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {party.map((p, i) => (
                  <div key={p.id || i} style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px',
                    background: COLORS.softBg, border: `1px solid ${COLORS.border}`, borderRadius: '8px', padding: '7px 10px',
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.charcoal, fontFamily: 'var(--font-sans)' }}>
                      {p.full_name || 'Unnamed guest'}
                    </span>
                    {p.is_primary_contact && <span style={{ fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.gold, background: 'rgba(184,148,79,0.12)', padding: '2px 6px', borderRadius: '4px' }}>Primary</span>}
                    {p.meal_selection && (
                      <span style={{ fontSize: '10px', color: COLORS.stone, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>
                        {p.meal_selection}
                      </span>
                    )}
                    {p.dietary_notes && (
                      <span style={{ fontSize: '10px', color: '#C45E5E', fontFamily: 'var(--font-sans)', fontStyle: 'italic' }} title="Dietary notes">
                        ⚠ {p.dietary_notes}
                      </span>
                    )}
                  </div>
                ))}
                {guest.notes && guest.notes.trim() && (
                  <div style={{ fontSize: '11px', color: COLORS.stone, fontFamily: 'var(--font-sans)', background: COLORS.softBg, border: `1px solid ${COLORS.border}`, borderRadius: '8px', padding: '7px 10px' }}>
                    <strong style={{ color: COLORS.charcoal }}>Note: </strong>{guest.notes}
                  </div>
                )}
                {customAnswers.map((a, i) => (
                  <div key={i} style={{ fontSize: '11px', color: COLORS.stone, fontFamily: 'var(--font-sans)', background: COLORS.softBg, border: `1px solid ${COLORS.border}`, borderRadius: '8px', padding: '7px 10px' }}>
                    <strong style={{ color: COLORS.charcoal }}>{a.label}: </strong>{Array.isArray(a.value) ? a.value.join(', ') : a.value}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Main Component ── */
export default function GuestsTab({ rsvps, tables, customFields, eventId, event, onAssignTable, onRefresh, onOpenAddGuest, onOpenImport, onOpenSendInvitations, isPaid, tierFeatures, onUpgrade }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editingGuest, setEditingGuest] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleDeleteGuest = useCallback(async (guestId) => {
    if (!window.confirm('Are you sure you want to delete this guest? This action cannot be undone.')) return;
    setDeletingId(guestId);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/rsvps/${guestId}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || 'Delete failed');
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Failed to delete this guest. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }, [eventId, onRefresh]);

  const counts = useMemo(() => {
    const total = rsvps.reduce((sum, r) => sum + (r.party_size || 1), 0);
    const acceptedRsvps = rsvps.filter(r => isAccepted(r.response));
    const seated = acceptedRsvps.filter(r => r.tableId).reduce((sum, r) => sum + (r.party_size || 1), 0);
    return {
      total,
      parties: rsvps.length,
      invited: rsvps.filter(r => r.invitation_sent).length,
      accepted: acceptedRsvps.length,
      declined: rsvps.filter(r => isDeclined(r.response)).length,
      maybe: rsvps.filter(r => isMaybe(r.response)).length,
      pending: rsvps.filter(r => !isAccepted(r.response) && !isDeclined(r.response) && !isMaybe(r.response)).length,
      seated,
    };
  }, [rsvps]);

  const filtered = useMemo(() => {
    return rsvps.filter(r => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        (r.guest_name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      switch (filter) {
        case 'attending': return isAccepted(r.response);
        case 'declined': return isDeclined(r.response);
        case 'maybe': return isMaybe(r.response);
        case 'pending': return !isAccepted(r.response) && !isDeclined(r.response) && !isMaybe(r.response);
        case 'seated': return isAccepted(r.response) && !!r.tableId;
        case 'unseated': return isAccepted(r.response) && !r.tableId;
        default: return true;
      }
    });
  }, [rsvps, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp rather than reset-via-effect: keeps this correct even when the list
  // shrinks out from under the current page (e.g. a delete or a data reload)
  // without a setState-in-effect render cascade.
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (!eventId) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '16px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.ivory}, ${COLORS.champagne}20)`, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLORS.champagne} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: COLORS.charcoal, marginBottom: '8px' }}>No Event Selected</h3>
        <p style={{ fontSize: '13px', color: COLORS.stone, fontStyle: 'italic' }}>Select or create an event to manage guests.</p>
      </div>
    );
  }

  const inputStyle = {
    background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '8px',
    padding: '9px 14px', fontSize: '12px', color: COLORS.charcoal, outline: 'none',
    fontFamily: 'var(--font-sans)', transition: 'border-color 0.25s ease',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 500, color: COLORS.charcoal, margin: 0 }}>Guest Management</h2>
          <p style={{ fontSize: '11px', color: COLORS.stone, fontFamily: 'var(--font-sans)', marginTop: '4px' }}>Manage your event's guest list, seating, and preferences</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <FeatureGate tierFeatures={tierFeatures} isPaid={isPaid} feature="add_guest_manual" onUpgrade={onUpgrade}>
          <button onClick={onOpenAddGuest} style={{
            padding: '9px 18px', background: COLORS.gold, color: COLORS.white, border: 'none',
            borderRadius: '8px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)',
            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = COLORS.goldHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = COLORS.gold; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Guest
          </button>
          </FeatureGate>
          <FeatureGate tierFeatures={tierFeatures} isPaid={isPaid} feature="import_guests_csv" onUpgrade={onUpgrade}>
          <button onClick={onOpenImport} style={{
            padding: '9px 18px', background: COLORS.white, color: COLORS.stone, border: `1px solid ${COLORS.border}`,
            borderRadius: '8px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)',
            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.color = COLORS.gold; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.stone; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import CSV
          </button>
          </FeatureGate>
          {onOpenSendInvitations && (
            <button onClick={onOpenSendInvitations} title="Send invitations via Email or SMS" style={{
              padding: '9px 18px', background: 'linear-gradient(135deg, #191B1E 0%, #2d2f34 100%)', color: COLORS.white, border: 'none',
              borderRadius: '8px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 2px 10px rgba(25,27,30,0.18)',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(25,27,30,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(25,27,30,0.18)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              Send Invitations
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <StatMini accent={COLORS.gold} value={counts.total} label="Total Guests"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>} />
        <StatMini accent="#0EA5E9" value={counts.invited} label="Invitations Sent"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} />
        <StatMini accent="#22C55E" value={counts.accepted} label="Accepted"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>} />
        <StatMini accent="#C45E5E" value={counts.declined} label="Declined"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>} />
        <StatMini accent="#6366F1" value={counts.maybe} label="Maybe"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
        <StatMini accent="#77736A" value={counts.pending} label="Pending"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.stone} strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text" placeholder="Search by name or email..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ ...inputStyle, width: '100%', paddingLeft: '34px' }}
            onFocus={e => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={e => { e.target.style.borderColor = COLORS.border; }}
          />
        </div>
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="all">All Guests</option>
          <option value="attending">Accepted</option>
          <option value="declined">Declined</option>
          <option value="maybe">Maybe</option>
          <option value="pending">Pending</option>
          <option value="seated">Seated</option>
          <option value="unseated">Unseated</option>
        </select>
        <span style={{ fontSize: '11px', color: COLORS.stone, fontFamily: 'var(--font-sans)' }}>
          {filtered.length} of {rsvps.length} shown
        </span>
      </div>

      {/* Guest Cards Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '12px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.border} strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block' }}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <p style={{ color: COLORS.stone, fontSize: '13px', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
            {search || filter !== 'all' ? 'No guests match your search or filter.' : 'No guests added yet.'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {paginated.map(guest => (
              <GuestCard
                key={guest.id} guest={guest} tables={tables} onAssignTable={onAssignTable}
                customFields={customFields} event={event}
                onEdit={setEditingGuest} onDelete={handleDeleteGuest} deleting={deletingId === guest.id}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{
                padding: '6px 12px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, background: COLORS.white,
                color: safePage === 1 ? COLORS.border : COLORS.charcoal, fontSize: '12px', fontFamily: 'var(--font-sans)',
                cursor: safePage === 1 ? 'default' : 'pointer',
              }}>‹ Prev</button>
              <span style={{ fontSize: '12px', color: COLORS.stone, fontFamily: 'var(--font-sans)', padding: '0 8px' }}>
                Page {safePage} of {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{
                padding: '6px 12px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, background: COLORS.white,
                color: safePage === totalPages ? COLORS.border : COLORS.charcoal, fontSize: '12px', fontFamily: 'var(--font-sans)',
                cursor: safePage === totalPages ? 'default' : 'pointer',
              }}>Next ›</button>
            </div>
          )}
        </>
      )}

      <EditGuestModal
        isOpen={!!editingGuest}
        onClose={() => setEditingGuest(null)}
        eventId={eventId}
        event={event}
        customFields={customFields}
        rsvp={editingGuest}
        onGuestUpdated={onRefresh}
      />
    </div>
  );
}
