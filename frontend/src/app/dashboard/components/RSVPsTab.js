'use client';
import { toast } from '../../utils/toast';
import React, { useState, useMemo, useCallback } from 'react';
import { smsReachability, countReachable } from '../../utils/smsReachability';
import { isAccepted, isDeclined } from '../../utils/responseHelpers';
import EditGuestModal from './EditGuestModal';
import SmsBalanceBanner from './SmsBalanceBanner';

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
  rose: '#C45E5E',
  roseLight: '#FDF2F2',
  greenLight: '#F0FAF0',
  greenDark: '#3D7A3D',
  champagneLight: '#FFF9EE',
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const PAGE_SIZE = 10;

/* ── tiny SVG icons ─────────────────────────────────────────── */
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const TrashIcon = ({ color = COLORS.stone }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const PencilIcon = ({ color = COLORS.stone }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const MailIcon = ({ color = COLORS.stone }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 5L2 7" />
  </svg>
);

const TicketIcon = ({ color = COLORS.stone }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v14" />
  </svg>
);

/* Send an invitation by email — a paper plane, distinct from the envelope used
   for "resend the confirmation". The two sit next to each other in the same row,
   so they must not share a glyph. */
const SendIcon = ({ color = COLORS.stone }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4Z" />
  </svg>
);

/* Send an invitation by text. */
const ChatIcon = ({ color = COLORS.stone }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
  </svg>
);

const EmptyIcon = () => (
  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={COLORS.border} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
  </svg>
);

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.stone} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, pointerEvents: 'none' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ── helpers ─────────────────────────────────────────────────── */
function isPending(response) {
  return !isAccepted(response) && !isDeclined(response);
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function responseBadge(response) {
  if (isAccepted(response)) return { label: 'Accepted', bg: COLORS.greenLight, color: COLORS.greenDark, dot: COLORS.greenDark };
  if (isDeclined(response)) return { label: 'Declined', bg: COLORS.roseLight, color: COLORS.rose, dot: COLORS.rose };
  return { label: 'Pending', bg: COLORS.ivory, color: COLORS.stone, dot: COLORS.champagne };
}

/* ── sub-components ──────────────────────────────────────────── */

const SummaryCard = React.memo(function SummaryCard({ count, label, accent }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: '1 1 0',
        minWidth: 140,
        background: COLORS.white,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 12,
        padding: '20px 24px',
        transition: 'all 0.3s ease',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.06)' : 'none',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        cursor: 'default',
      }}
    >
      <span style={{
        display: 'block',
        fontSize: 28,
        fontWeight: 700,
        color: COLORS.charcoal,
        fontFamily: 'var(--font-sans)',
        letterSpacing: '-0.5px',
      }}>{count}</span>
      <span style={{
        display: 'block',
        fontSize: 10,
        fontWeight: 700,
        color: COLORS.stone,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginTop: 6,
        fontFamily: 'var(--font-sans)',
      }}>{label}</span>
    </div>
  );
});

/* ── main component ──────────────────────────────────────────── */
export default function RSVPsTab({
  rsvps = [], eventId, event, customFields, onRefresh,
  smsAddonActive = false, smsMaxPerSend = 0, onBuySms,
  // Balance figures for the banner. Supplied by the dashboard, which already
  // holds them for the sidebar — refetching here would put a second, slightly
  // different number on the same screen as the first.
  smsRemaining = 0, smsPurchased = 0, smsCoverage = null,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportSort, setExportSort] = useState('name'); // 'name' (A–Z) | 'table'
  const [resending, setResending] = useState(null); // `${rsvpId}:${type}` while a resend is in flight
  // `${rsvpId}:invite-${channel}` or `bulk:${channel}` while an invitation send
  // is in flight. Separate from `resending` so a per-guest spinner and a bulk
  // send can never disable each other's button.
  const [sending, setSending] = useState(null);
  const [editingGuest, setEditingGuest] = useState(null);

  // Party ids the organizer has ticked. A Set because every operation here is a
  // membership test, and the list can run to thousands of guests.
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  /* counts */
  const counts = useMemo(() => {
    const accepted = rsvps.filter(r => isAccepted(r.response)).length;
    const declined = rsvps.filter(r => isDeclined(r.response)).length;
    return { total: rsvps.length, accepted, declined, pending: rsvps.length - accepted - declined };
  }, [rsvps]);

  /* filtered + sorted */
  const processed = useMemo(() => {
    let list = [...rsvps];

    // search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(r =>
        (r.guest_name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      );
    }

    // filter
    if (filter === 'attending') list = list.filter(r => isAccepted(r.response));
    else if (filter === 'declined') list = list.filter(r => isDeclined(r.response));
    else if (filter === 'pending') list = list.filter(r => isPending(r.response));

    // sort
    if (sort === 'newest') list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    else if (sort === 'oldest') list.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    else if (sort === 'az') list.sort((a, b) => (a.guest_name || '').localeCompare(b.guest_name || ''));
    else if (sort === 'za') list.sort((a, b) => (b.guest_name || '').localeCompare(a.guest_name || ''));

    return list;
  }, [rsvps, search, filter, sort]);

  // Reset page when filters change — adjusted during render (like
  // RsvpWizard's prevLangParam) rather than in an effect, since this is a
  // "reset paginator when the filter key changes" case, and `page` is
  // otherwise independently mutable via the pager buttons below.
  const filterKey = `${search}|${filter}|${sort}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const paginated = processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Selection ──────────────────────────────────────────────────────────
     Everything below is derived from the CURRENT filter, not the whole list.
     Acting on what you are looking at is the entire point of selecting here —
     a "select all" that silently included rows a filter had hidden would send
     messages the organizer never saw. */
  const toggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const visibleIds = useMemo(() => processed.map((r) => r.id), [processed]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const everySelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
      // Only the rows the filter is currently showing are affected — a selection
      // made under a different filter is left alone rather than wiped.
      if (everySelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Resolved against the FULL list, so a selection survives changing the filter.
  const selectedGuests = useMemo(
    () => rsvps.filter((r) => selectedIds.has(r.id)),
    [rsvps, selectedIds],
  );
  const reach = useMemo(() => countReachable(selectedGuests), [selectedGuests]);

  // Warn before opening rather than after sending: the ramp-up cap is enforced
  // server-side and would otherwise surface as a 429 at the end of the flow.
  const overSendLimit = smsMaxPerSend > 0 && reach.reachable > smsMaxPerSend;

  /* export CSV */
  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Attending guest list, ordered by the user's chosen sort (name A–Z or by table).
      const res = await fetch(`${apiUrl}/events/${eventId}/rsvps/export?attending=true&sort=${exportSort}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attending-guests-by-${exportSort}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export error:', err);
      toast.error('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [eventId, exporting, exportSort]);

  /* export Excel */
  const handleExportExcel = useCallback(async () => {
    if (exportingExcel) return;
    setExportingExcel(true);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/rsvps/export-excel?attending=true&sort=${exportSort}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attending-guests-by-${exportSort}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Failed to export Excel file. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  }, [eventId, exportingExcel, exportSort]);

  /* resend confirmation or QR-ticket email */
  const handleResend = useCallback(async (rsvpId, type) => {
    const endpoint = type === 'qr' ? 'send-qr-ticket' : 'send-confirmation';
    setResending(`${rsvpId}:${type}`);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/notifications/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsvpId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to send email.');
      }
      toast.success(type === 'qr' ? 'QR ticket email sent.' : 'Confirmation email sent.');
    } catch (err) {
      toast.error(err.message || 'Failed to send email.');
    } finally {
      setResending(null);
    }
  }, [eventId]);

  /**
   * Send the INVITATION to a set of guests, by one channel.
   *
   * The one send path in this tab, used by both the bulk bar and the per-guest
   * buttons — a bulk send is just this with more ids. The modal that used to sit
   * between the organizer and this call is gone: it asked them to pick an
   * audience and tick a consent box they had already answered per guest, which
   * was three screens of friction in front of a decision they had already made
   * by ticking the rows.
   *
   * `channel` is the only discriminator; the server picks the wording. There is
   * no message box anywhere in this flow, deliberately — see the note on the
   * invitations route.
   */
  const handleSendInvitations = useCallback(async (partyIds, channel) => {
    const ids = Array.isArray(partyIds) ? partyIds : [partyIds];
    if (ids.length === 0) return;

    const key = ids.length === 1 ? `${ids[0]}:invite-${channel}` : `bulk:${channel}`;
    setSending(key);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/invitations/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, partyIds: ids }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Could not send the invitations.');
      }

      const d = data.data || data;
      // The server already grouped skip reasons into plain sentences. Surfacing
      // them is the difference between "12 of 15 sent" — which reads as a fault —
      // and "3 haven't agreed to receive texts", which reads as a fact the
      // organizer can act on.
      toast.success(d.message || `Invitation sent to ${d.sent ?? ids.length}.`);
      if (Array.isArray(d.breakdown) && d.breakdown.length > 0) {
        const worst = d.breakdown[0];
        toast(`${worst.count} not sent — ${worst.message.toLowerCase()}.`, { icon: 'ℹ️' });
      }
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Could not send the invitations.');
    } finally {
      setSending(null);
    }
  }, [apiUrl, eventId, onRefresh]);

  /* delete RSVP */
  const handleDelete = useCallback(async (rsvpId) => {
    if (!window.confirm('Are you sure you want to delete this RSVP? This action cannot be undone.')) return;
    setDeletingId(rsvpId);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/rsvps/${rsvpId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');
      onRefresh?.();
    } catch (err) {
      console.error('Delete RSVP error:', err);
      toast.error('Failed to delete this RSVP. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }, [eventId, onRefresh]);

  /* shared input / select style */
  const inputStyle = {
    padding: '9px 14px',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    outline: 'none',
    background: COLORS.white,
    color: COLORS.charcoal,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  };

  const selectWrapStyle = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── SMS status ───────────────────────────────────────
          Above everything, because the question it answers — "will I have
          enough messages for these people?" — is asked while looking at this
          list, and answering it anywhere else means answering it too late. */}
      <SmsBalanceBanner
        active={smsAddonActive}
        remaining={smsRemaining}
        purchased={smsPurchased}
        coverage={smsCoverage}
        topUpHref="/dashboard/campaigns"
      />

      {/* ── Summary Bar ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <SummaryCard count={counts.total} label="Total Responses" accent={COLORS.stone} />
        <SummaryCard count={counts.accepted} label="Accepted" accent={COLORS.gold} />
        <SummaryCard count={counts.declined} label="Declined" accent={COLORS.rose} />
        <SummaryCard count={counts.pending} label="Pending" accent={COLORS.champagne} />
      </div>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        background: COLORS.white,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: '16px 20px',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 36 }}
            onFocus={e => { e.target.style.borderColor = COLORS.gold; e.target.style.boxShadow = `0 0 0 3px ${COLORS.ivory}`; }}
            onBlur={e => { e.target.style.borderColor = COLORS.border; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Filter */}
        <div style={selectWrapStyle}>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ ...inputStyle, paddingRight: 30, appearance: 'none', cursor: 'pointer', minWidth: 130 }}
            onFocus={e => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={e => { e.target.style.borderColor = COLORS.border; }}
          >
            <option value="all">All Responses</option>
            <option value="attending">Attending</option>
            <option value="declined">Declined</option>
            <option value="pending">Pending</option>
          </select>
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
            <ChevronDown />
          </div>
        </div>

        {/* Sort */}
        <div style={selectWrapStyle}>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            style={{ ...inputStyle, paddingRight: 30, appearance: 'none', cursor: 'pointer', minWidth: 140 }}
            onFocus={e => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={e => { e.target.style.borderColor = COLORS.border; }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="az">Name A–Z</option>
            <option value="za">Name Z–A</option>
          </select>
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
            <ChevronDown />
          </div>
        </div>

        {/* Export attending guest list — choose ordering, then CSV or Excel */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={selectWrapStyle} title="Order of the exported attending guest list">
            <select
              value={exportSort}
              onChange={e => setExportSort(e.target.value)}
              style={{ ...inputStyle, paddingRight: 30, appearance: 'none', cursor: 'pointer', minWidth: 168 }}
              onFocus={e => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={e => { e.target.style.borderColor = COLORS.border; }}
            >
              <option value="name">Export order: Name (A–Z)</option>
              <option value="table">Export order: By Table</option>
            </select>
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
              <ChevronDown />
            </div>
          </div>
          <ExportButton exporting={exporting} onClick={handleExport} label="Export CSV" />
          <ExportButton exporting={exportingExcel} onClick={handleExportExcel} label="Export Excel" />
        </div>
      </div>

      {/* ── Table / Empty ────────────────────────────────────── */}
      {processed.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          background: COLORS.white,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
        }}>
          <EmptyIcon />
          <p style={{
            marginTop: 20,
            fontSize: 15,
            color: COLORS.stone,
            fontStyle: 'italic',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
          }}>
            {rsvps.length === 0
              ? 'No RSVPs received yet. Share your invitation link to start collecting responses.'
              : 'No responses match your current filters.'}
          </p>
        </div>
      ) : (
        <>
        {/* Action bar — appears on first selection.
            Wraps rather than scrolls: at 320px a nowrap row of a sentence plus
            three buttons would push the whole page sideways. */}
        {selectedIds.size > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
            justifyContent: 'space-between',
            background: COLORS.white, border: `1px solid ${COLORS.gold}`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 14,
          }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.charcoal, fontFamily: 'var(--font-sans)' }}>
                {selectedIds.size} selected
              </span>
              {/* The honest number. Selecting someone unreachable is allowed, so
                  the count has to say how many will actually get a text rather
                  than letting the selection imply they all will. */}
              <span style={{ display: 'block', fontSize: 11.5, color: COLORS.stone, marginTop: 2, fontFamily: 'var(--font-sans)' }}>
                {reach.reachable === reach.total
                  ? 'All of them can be texted.'
                  : `${reach.reachable} can be texted · ${reach.unreachable} cannot`}
              </span>
              {overSendLimit && (
                <span style={{ display: 'block', fontSize: 11.5, color: '#8A6D34', marginTop: 4, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                  You can text up to {smsMaxPerSend} at a time for now — send this group in smaller batches.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {/* The two send buttons. They go straight to the server now —
                  the modal that used to sit in between asked the organizer to
                  choose an audience they had already chosen by ticking rows,
                  and to attest consent they had already recorded per guest. */}
              <button
                type="button"
                onClick={() => (smsAddonActive
                  ? handleSendInvitations([...selectedIds], 'sms')
                  : onBuySms?.())}
                disabled={sending !== null || (smsAddonActive && reach.reachable === 0)}
                title={smsAddonActive
                  ? `Text the invitation to ${reach.reachable} of the ${selectedIds.size} selected`
                  : 'Text messaging is not switched on for this event yet.'}
                style={{
                  padding: '9px 18px', borderRadius: 9, border: 'none',
                  background: (smsAddonActive && reach.reachable === 0)
                    ? '#C9C4BA'
                    : 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
                  color: COLORS.white, fontSize: 12.5, fontWeight: 700,
                  cursor: sending !== null ? 'wait'
                    : (smsAddonActive && reach.reachable === 0) ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  opacity: sending !== null ? 0.7 : 1,
                }}
              >
                {sending === 'bulk:sms'
                  ? 'Texting…'
                  : smsAddonActive
                    ? `Text invitation${reach.reachable !== selectedIds.size ? ` (${reach.reachable})` : ''}`
                    : 'Add texting'}
              </button>
              <button
                type="button"
                onClick={() => handleSendInvitations([...selectedIds], 'email')}
                disabled={sending !== null}
                title={`Email the invitation to the ${selectedIds.size} selected`}
                style={{
                  padding: '9px 18px', borderRadius: 9,
                  border: `1px solid ${COLORS.border}`, background: 'transparent',
                  color: COLORS.charcoal, fontSize: 12.5, fontWeight: 700,
                  cursor: sending !== null ? 'wait' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  opacity: sending !== null ? 0.7 : 1,
                }}
              >
                {sending === 'bulk:email' ? 'Emailing…' : 'Email invitation'}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                style={{
                  padding: '9px 14px', borderRadius: 9, border: 'none',
                  background: 'transparent', color: COLORS.stone,
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div style={{
          background: COLORS.white,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Table on desktop, stacked cards on mobile — a raw table forced
              into overflow-x:auto is the classic mobile anti-pattern (every
              row needs two-directional scrolling to reach Actions). Both are
              rendered and toggled via CSS so there's no JS viewport check /
              hydration risk; RSVPRow and RSVPCard share the same row data. */}
          {/* minWidth grew from 720 to 880 with the select and Texting columns:
              left at 720 the columns squeeze instead of scrolling, and "Hasn't
              agreed to texts" wraps to three lines in a 60px cell. Below 640px
              this whole table is hidden and the cards below replace it. */}
          <div className="rsvps-table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
              <thead>
                <tr style={{ background: COLORS.softBg }}>
                  {/* Selects only what the current filter shows — see toggleAllVisible. */}
                  <th style={{
                    padding: '14px 8px 14px 20px', width: 40,
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all shown"
                      style={{ width: 15, height: 15, accentColor: COLORS.gold, cursor: 'pointer' }}
                    />
                  </th>
                  {['Guest', 'Party Size', 'Response', 'Meal', 'Time', 'Texting', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '14px 20px',
                      textAlign: i === 6 ? 'center' : 'left',
                      fontSize: 10,
                      fontWeight: 700,
                      color: COLORS.stone,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      fontFamily: 'var(--font-sans)',
                      borderBottom: `1px solid ${COLORS.border}`,
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((rsvp, idx) => (
                  <RSVPRow
                    key={rsvp.id || idx}
                    rsvp={rsvp}
                    isEven={idx % 2 === 0}
                    deletingId={deletingId}
                    onDelete={handleDelete}
                    resending={resending}
                    onResend={handleResend}
                    onEdit={setEditingGuest}
                    selected={selectedIds.has(rsvp.id)}
                    onToggleSelect={toggleOne}
                    sending={sending}
                    onSendInvitation={handleSendInvitations}
                    smsAddonActive={smsAddonActive}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="rsvps-cards-wrap" style={{ display: 'none', flexDirection: 'column', gap: 10, padding: 12 }}>
            {paginated.map((rsvp, idx) => (
              <RSVPCard
                key={rsvp.id || idx}
                rsvp={rsvp}
                deletingId={deletingId}
                onDelete={handleDelete}
                resending={resending}
                onResend={handleResend}
                onEdit={setEditingGuest}
                selected={selectedIds.has(rsvp.id)}
                onToggleSelect={toggleOne}
                sending={sending}
                onSendInvitation={handleSendInvitations}
                smsAddonActive={smsAddonActive}
              />
            ))}
          </div>

          <style jsx>{`
            @media (max-width: 639.98px) {
              .rsvps-table-wrap { display: none; }
              .rsvps-cards-wrap { display: flex !important; }
            }
          `}</style>

          {/* ── Footer / Pagination ───────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: `1px solid ${COLORS.border}`,
            background: COLORS.softBg,
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <span style={{
              fontSize: 12,
              color: COLORS.stone,
              fontFamily: 'var(--font-sans)',
            }}>
              Showing <b style={{ color: COLORS.charcoal }}>{Math.min((page - 1) * PAGE_SIZE + 1, processed.length)}–{Math.min(page * PAGE_SIZE, processed.length)}</b> of <b style={{ color: COLORS.charcoal }}>{processed.length}</b> responses
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <PageBtn label="‹" disabled={page === 1} onClick={() => setPage(p => p - 1)} />
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...'
                      ? <span key={`e${i}`} style={{ padding: '0 4px', fontSize: 12, color: COLORS.stone }}>…</span>
                      : <PageBtn key={p} label={String(p)} active={p === page} onClick={() => setPage(p)} />
                  )}
                <PageBtn label="›" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} />
              </div>
            )}
          </div>
        </div>
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

/* ── Table Row ───────────────────────────────────────────────── */
const RSVPRow = React.memo(function RSVPRow({ rsvp, isEven, deletingId, onDelete, resending, onResend, onEdit, selected, onToggleSelect, sending, onSendInvitation, smsAddonActive }) {
  const [hovered, setHovered] = useState(false);
  const badge = responseBadge(rsvp.response);
  const reach = smsReachability(rsvp);
  const reachability = reach;

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? COLORS.ivory : isEven ? COLORS.white : COLORS.softBg,
        transition: 'background 0.2s ease',
      }}
    >
      {/* Select. Never disabled, even when this guest cannot be texted: they may
          still be emailed from the same action bar, and hiding them would also
          hide how many of a selection are unreachable. */}
      <td style={{ padding: '14px 8px 14px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect(rsvp.id)}
          aria-label={`Select ${rsvp.guest_name || 'guest'}`}
          style={{ width: 15, height: 15, accentColor: COLORS.gold, cursor: 'pointer' }}
        />
      </td>

      {/* Guest */}
      <td style={{ padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
        <span style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: COLORS.charcoal,
          fontFamily: 'var(--font-sans)',
        }}>{rsvp.guest_name || '—'}</span>
        {rsvp.email && (
          <span style={{
            display: 'block',
            fontSize: 11,
            color: COLORS.stone,
            marginTop: 2,
            fontFamily: 'var(--font-sans)',
          }}>{rsvp.email}</span>
        )}
      </td>

      {/* Party Size */}
      <td style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${COLORS.border}`,
        fontSize: 13,
        color: COLORS.charcoal,
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
      }}>
        {rsvp.party_size ?? '—'}
      </td>

      {/* Response Badge */}
      <td style={{ padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 6,
          background: badge.bg,
          fontSize: 10,
          fontWeight: 700,
          color: badge.color,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontFamily: 'var(--font-sans)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.dot, flexShrink: 0 }} />
          {badge.label}
        </span>
      </td>

      {/* Meal */}
      <td style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${COLORS.border}`,
        fontSize: 13,
        color: COLORS.charcoal,
        fontFamily: 'var(--font-sans)',
      }}>
        {rsvp.meal || '—'}
      </td>

      {/* Time */}
      <td style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${COLORS.border}`,
        fontSize: 12,
        color: COLORS.stone,
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap',
      }}>
        {formatTime(rsvp.timestamp)}
      </td>

      {/* Texting — states WHY, not just yes/no. The same sentence appears in the
          message history afterwards, so the list and the log never disagree. */}
      <td style={{ padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
        <span
          title={reach.title}
          style={{
            display: 'inline-block', padding: '3px 9px', borderRadius: 100,
            background: reach.bg, color: reach.color,
            fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font-sans)',
            whiteSpace: 'nowrap',
          }}
        >
          {reach.label}
        </span>
      </td>

      {/* Actions */}
      <td style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${COLORS.border}`,
        textAlign: 'center',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <IconActionButton title="Edit guest" onClick={() => onEdit(rsvp)} icon={PencilIcon} />
          {/* Send this ONE guest their invitation, by either channel. The two
              buttons below them resend the confirmation and the entry pass —
              different messages, deliberately kept apart, because "invite them"
              and "send their pass again" are not the same intent. */}
          <InviteButton
            channel="email" rsvpId={rsvp.id} sending={sending} onSend={onSendInvitation}
            title="Email this guest their invitation"
          />
          <InviteButton
            channel="sms" rsvpId={rsvp.id} sending={sending} onSend={onSendInvitation}
            title={smsAddonActive
              ? (reachability?.reachable ? 'Text this guest their invitation' : `Cannot text — ${reachability?.label || 'no permission on file'}`)
              : 'Text messaging is not switched on for this event yet'}
            disabled={!smsAddonActive || !reachability?.reachable}
          />
          <ResendButton
            type="confirmation"
            rsvpId={rsvp.id}
            resending={resending}
            onResend={onResend}
            title="Resend confirmation email"
          />
          <ResendButton
            type="qr"
            rsvpId={rsvp.id}
            resending={resending}
            onResend={onResend}
            title="Send check-in QR pass to this guest"
          />
          <DeleteButton rsvpId={rsvp.id} deletingId={deletingId} onDelete={onDelete} />
        </div>
      </td>
    </tr>
  );
});

/* ── Mobile Card (same data/actions as RSVPRow, stacked instead of tabular) ── */
const RSVPCard = React.memo(function RSVPCard({ rsvp, deletingId, onDelete, resending, onResend, onEdit, selected, onToggleSelect, sending, onSendInvitation, smsAddonActive }) {
  const badge = responseBadge(rsvp.response);
  const reach = smsReachability(rsvp);
  return (
    <div style={{
      background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 12,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        {/* Selection is not a desktop-only feature — the table is hidden below
            640px and these cards replace it, so without this the whole workflow
            would vanish on a phone. */}
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect(rsvp.id)}
          aria-label={`Select ${rsvp.guest_name || 'guest'}`}
          style={{ width: 16, height: 16, accentColor: COLORS.gold, flexShrink: 0, marginTop: 3, cursor: 'pointer' }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: COLORS.charcoal, fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rsvp.guest_name || '—'}
          </span>
          <span style={{
            display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 100,
            background: reach.bg, color: reach.color,
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-sans)',
          }}>{reach.label}</span>
          {rsvp.email && (
            <span style={{ display: 'block', fontSize: 12, color: COLORS.stone, marginTop: 2, fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rsvp.email}
            </span>
          )}
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
          padding: '4px 12px', borderRadius: 6, background: badge.bg,
          fontSize: 10, fontWeight: 700, color: badge.color, textTransform: 'uppercase',
          letterSpacing: '0.06em', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.dot, flexShrink: 0 }} />
          {badge.label}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: COLORS.stone, fontFamily: 'var(--font-sans)' }}>
        <span>Party of {rsvp.party_size ?? '—'}</span>
        {rsvp.meal && <span>· {rsvp.meal}</span>}
        <span>· {formatTime(rsvp.timestamp)}</span>
      </div>

      {/* Identical actions to the desktop row, in the same order. The two views
          are one workflow rendered twice — a guest reachable on a laptop and not
          on a phone would be a bug, not a simplification. flexWrap because five
          buttons plus a delete do not fit 320px on one line. */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
        <IconActionButton title="Edit guest" onClick={() => onEdit(rsvp)} icon={PencilIcon} />
        <InviteButton
          channel="email" rsvpId={rsvp.id} sending={sending} onSend={onSendInvitation}
          title="Email this guest their invitation"
        />
        <InviteButton
          channel="sms" rsvpId={rsvp.id} sending={sending} onSend={onSendInvitation}
          title={smsAddonActive
            ? (reach.reachable ? 'Text this guest their invitation' : `Cannot text — ${reach.label || 'no permission on file'}`)
            : 'Text messaging is not switched on for this event yet'}
          disabled={!smsAddonActive || !reach.reachable}
        />
        <ResendButton type="confirmation" rsvpId={rsvp.id} resending={resending} onResend={onResend} title="Resend confirmation email" />
        <ResendButton type="qr" rsvpId={rsvp.id} resending={resending} onResend={onResend} title="Send check-in QR pass to this guest" />
        <DeleteButton rsvpId={rsvp.id} deletingId={deletingId} onDelete={onDelete} />
      </div>
    </div>
  );
});

/* ── Delete Button ───────────────────────────────────────────── */
function DeleteButton({ rsvpId, deletingId, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const isDeleting = deletingId === rsvpId;

  return (
    <button
      onClick={() => onDelete(rsvpId)}
      disabled={isDeleting}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Delete RSVP"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 8,
        border: 'none',
        cursor: isDeleting ? 'wait' : 'pointer',
        background: hovered ? COLORS.roseLight : 'transparent',
        transition: 'all 0.2s ease',
        opacity: isDeleting ? 0.4 : 1,
      }}
    >
      <TrashIcon color={hovered ? COLORS.rose : COLORS.stone} />
    </button>
  );
}

/* ── Generic Icon Action Button ──────────────────────────────── */
function IconActionButton({ title, onClick, icon: Icon }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 44, height: 44, borderRadius: 8, border: 'none',
        cursor: 'pointer', background: hovered ? COLORS.champagneLight : 'transparent',
        transition: 'all 0.2s ease',
      }}
    >
      <Icon color={hovered ? COLORS.gold : COLORS.stone} />
    </button>
  );
}

/* ── Send-Invitation Button ──────────────────────────────────────
 *
 * Deliberately shaped like ResendButton below, and deliberately NOT merged with
 * it. They look alike because they belong to the same row of controls, but they
 * mean different things — this one INVITES someone, that one re-sends a message
 * they were already sent. Collapsing them into one component with a mode flag
 * would make the next person adding a state have to work out which of two
 * unrelated intents they were changing.
 *
 * 44x44 to match the rest of the row: that is the minimum comfortable touch
 * target, and this row is six buttons wide on a phone.
 */
function InviteButton({ channel, rsvpId, sending, onSend, title, disabled = false }) {
  const [hovered, setHovered] = useState(false);
  const isBusy = sending === `${rsvpId}:invite-${channel}`;
  // Any send in flight locks the rest, so a double-tap on a slow connection
  // cannot bill an organizer twice for the same guest.
  const isBlocked = disabled || (sending !== null && !isBusy);
  const Icon = channel === 'sms' ? ChatIcon : SendIcon;

  return (
    <button
      onClick={() => !isBlocked && onSend(rsvpId, channel)}
      disabled={isBusy || isBlocked}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 8,
        border: 'none',
        cursor: isBusy ? 'wait' : isBlocked ? 'not-allowed' : 'pointer',
        background: hovered && !isBlocked ? COLORS.champagneLight : 'transparent',
        transition: 'all 0.2s ease',
        opacity: isBusy ? 0.4 : isBlocked ? 0.3 : 1,
      }}
    >
      <Icon color={hovered && !isBlocked ? COLORS.gold : COLORS.stone} />
    </button>
  );
}

/* ── Resend Button ───────────────────────────────────────────── */
function ResendButton({ type, rsvpId, resending, onResend, title }) {
  const [hovered, setHovered] = useState(false);
  const isBusy = resending === `${rsvpId}:${type}`;
  const Icon = type === 'qr' ? TicketIcon : MailIcon;

  return (
    <button
      onClick={() => onResend(rsvpId, type)}
      disabled={isBusy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 8,
        border: 'none',
        cursor: isBusy ? 'wait' : 'pointer',
        background: hovered ? COLORS.champagneLight : 'transparent',
        transition: 'all 0.2s ease',
        opacity: isBusy ? 0.4 : 1,
      }}
    >
      <Icon color={hovered ? COLORS.gold : COLORS.stone} />
    </button>
  );
}

/* ── Export Button ───────────────────────────────────────────── */
function ExportButton({ exporting, onClick, label = 'Export CSV' }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={exporting}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '9px 18px',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        color: COLORS.white,
        background: hovered ? COLORS.goldHover : COLORS.gold,
        border: 'none',
        borderRadius: 8,
        cursor: exporting ? 'wait' : 'pointer',
        transition: 'all 0.25s ease',
        boxShadow: hovered ? '0 4px 14px rgba(184,148,79,0.3)' : 'none',
        opacity: exporting ? 0.7 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      <DownloadIcon />
      {exporting ? 'Exporting…' : label}
    </button>
  );
}

/* ── Pagination Button ───────────────────────────────────────── */
function PageBtn({ label, active, disabled, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 30,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        fontFamily: 'var(--font-sans)',
        color: active ? COLORS.white : disabled ? COLORS.border : COLORS.charcoal,
        background: active ? COLORS.gold : hovered && !disabled ? COLORS.ivory : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.2s ease',
        padding: '0 6px',
      }}
    >
      {label}
    </button>
  );
}
