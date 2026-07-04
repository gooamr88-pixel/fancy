'use client';
import { toast } from '../../utils/toast';
import React, { useState, useMemo, useCallback } from 'react';
import { isAccepted, isDeclined } from '../../utils/responseHelpers';
import EditGuestModal from './EditGuestModal';

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
export default function RSVPsTab({ rsvps = [], eventId, event, customFields, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportSort, setExportSort] = useState('name'); // 'name' (A–Z) | 'table'
  const [resending, setResending] = useState(null); // `${rsvpId}:${type}` while a resend is in flight
  const [editingGuest, setEditingGuest] = useState(null);

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
        <div style={{
          background: COLORS.white,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ background: COLORS.softBg }}>
                  {['Guest', 'Party Size', 'Response', 'Meal', 'Time', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '14px 20px',
                      textAlign: i === 5 ? 'center' : 'left',
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
                  />
                ))}
              </tbody>
            </table>
          </div>

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
const RSVPRow = React.memo(function RSVPRow({ rsvp, isEven, deletingId, onDelete, resending, onResend, onEdit }) {
  const [hovered, setHovered] = useState(false);
  const badge = responseBadge(rsvp.response);

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? COLORS.ivory : isEven ? COLORS.white : COLORS.softBg,
        transition: 'background 0.2s ease',
      }}
    >
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

      {/* Actions */}
      <td style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${COLORS.border}`,
        textAlign: 'center',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <IconActionButton title="Edit guest" onClick={() => onEdit(rsvp)} icon={PencilIcon} />
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
            title="Resend QR ticket email (requires table assignment)"
          />
          <DeleteButton rsvpId={rsvp.id} deletingId={deletingId} onDelete={onDelete} />
        </div>
      </td>
    </tr>
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
        width: 32,
        height: 32,
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
        width: 32, height: 32, borderRadius: 8, border: 'none',
        cursor: 'pointer', background: hovered ? COLORS.champagneLight : 'transparent',
        transition: 'all 0.2s ease',
      }}
    >
      <Icon color={hovered ? COLORS.gold : COLORS.stone} />
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
        width: 32,
        height: 32,
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
