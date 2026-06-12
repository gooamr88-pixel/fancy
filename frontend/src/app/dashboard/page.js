'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../utils/apiClient';
import { useRealtimeRSVPs } from './hooks/useRealtimeRSVPs';
import StatMetricsCard from './components/StatMetricsCard';
import LiveActivityFeed from './components/LiveActivityFeed';
import ResponsiveChartBoard from './components/ResponsiveChartBoard';
import SeatingManager from './components/SeatingManager';
import TableForm from './components/TableForm';
import FormBuilder from './components/FormBuilder';
import AddGuestModal from './components/AddGuestModal';
import ImportGuestsModal from './components/ImportGuestsModal';
import EventSettings from './components/EventSettings';
import ErrorBoundary from '../components/ErrorBoundary';

/* ═══════════════════════════════════════════════
   Brand Design Tokens
   ═══════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════
   Sidebar Navigation Items
   ═══════════════════════════════════════════════ */
const sidebarNav = [
  { key: 'overview', label: 'Dashboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  )},
  { key: 'events', label: 'Events', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  )},
  { key: 'rsvps', label: 'RSVPs', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
  )},
  { key: 'guests', label: 'Guests', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  { key: 'seating', label: 'Seating', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
  )},
  { key: 'form-builder', label: 'Form Builder', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  )},
  { key: 'settings', label: 'Settings', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  )},
];

function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.ivory }}>
      {/* Sidebar skeleton */}
      <div style={{ width: '240px', background: COLORS.white, borderRight: `1px solid ${COLORS.border}`, padding: '24px' }}>
        <div style={{ width: '120px', height: '24px', background: COLORS.border, borderRadius: '8px', marginBottom: '48px' }} />
        {[...Array(7)].map((_, i) => (
          <div key={i} style={{ width: '100%', height: '36px', background: COLORS.ivory, borderRadius: '8px', marginBottom: '8px' }} />
        ))}
      </div>
      {/* Content skeleton */}
      <div style={{ flex: 1, padding: '32px' }}>
        <div style={{ width: '300px', height: '32px', background: COLORS.border, borderRadius: '8px', marginBottom: '32px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: '96px', background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '12px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState({
    invitedParties: 0, attendingParties: 0, attendingGuests: 0,
    declinedParties: 0, declinedGuests: 0, pendingParties: 0,
    pendingGuests: 0, totalExpectedGuests: 0, checkedInGuests: 0,
    seatingAssignedGuests: 0, mealSummary: {}
  });

  const [tables, setTables] = useState([]);
  const [rsvps, setRsvps] = useState([]);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResponse, setFilterResponse] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [copyTooltip, setCopyTooltip] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);


  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const orgId = localStorage.getItem('org_id');
      if (!orgId) { router.push('/login'); return; }
      setIsSuperAdmin(localStorage.getItem('user_role') === 'super_admin');
      setAuthChecked(true);
    }
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${apiUrl}/events`, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.events.length > 0) { setEvents(data.events); setEventId(data.events[0].id); }
        else { setEventId(''); }
      } catch (err) { setEventId(''); }
    };
    fetchEvents();
  }, [authChecked, apiUrl]);

  useEffect(() => {
    if (eventId && typeof window !== 'undefined') localStorage.setItem('active_event_id', eventId);
  }, [eventId]);

  const handleLogout = logout;

  const loadDashboardData = useCallback(async () => {
    if (!eventId) return;
    try {

      const statsRes = await fetch(`${apiUrl}/events/${eventId}/stats`, { credentials: 'include' });
      const statsData = await statsRes.json();
      const tablesRes = await fetch(`${apiUrl}/events/${eventId}/tables`, { credentials: 'include' });
      const tablesData = await tablesRes.json();
      const rsvpsRes = await fetch(`${apiUrl}/events/${eventId}/rsvps`, { credentials: 'include' });
      const rsvpsData = await rsvpsRes.json();

      if (statsData.success) setStats(statsData.stats);
      if (tablesData.success) setTables(tablesData.tables);
      if (rsvpsData.success) {
        const formattedGuests = rsvpsData.rsvps.map(r => {
          const assignedTableId = r.seating_assignments && r.seating_assignments.length > 0 ? r.seating_assignments[0].table_id : '';
          const guestMeals = r.rsvp_guests?.map(rg => rg.meal_selection).filter(Boolean).join(', ') || '-';
          return {
            id: r.id, guest_name: r.guest_name, party_size: r.party_size, response: r.response,
            email: r.email || '-', phone: r.phone || '-', tableId: assignedTableId, meal: guestMeals,
            timestamp: r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Earlier'
          };
        });
        setRsvps(formattedGuests);
      }
      setError(null);
    } catch (err) {
      setError('Could not connect to backend server. Make sure the backend server is running on port 5000.');
    } finally { setLoading(false); }
  }, [apiUrl, eventId]);

  useEffect(() => { if (!eventId) return; loadDashboardData(); }, [loadDashboardData, eventId]);

  const handleCreateTable = useCallback(async (e) => {
    e.preventDefault();
    if (!newTableName.trim() || !eventId) return;
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tableName: newTableName, maxCapacity: parseInt(newTableCapacity) })
      });
      if (!res.ok) throw new Error('Failed to create table');
      const data = await res.json();
      if (data.success) { setNewTableName(''); setNewTableCapacity(10); loadDashboardData(); }
    } catch (err) { alert(err.message); }
  }, [apiUrl, eventId, newTableName, newTableCapacity, loadDashboardData]);

  const handleAssignTable = useCallback(async (rsvpId, targetTableId) => {
    const guest = rsvps.find(g => g.id === rsvpId);
    if (!guest || !eventId) return;
    const oldTableId = guest.tableId;
    try {
      let res;
      const headers = { 'Content-Type': 'application/json' };
      if (!oldTableId) {
        res = await fetch(`${apiUrl}/events/${eventId}/seating/assign`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ rsvpId, tableId: targetTableId }) });
      } else if (!targetTableId) {
        res = await fetch(`${apiUrl}/events/${eventId}/seating/unassign`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ rsvpId }) });
      } else {
        res = await fetch(`${apiUrl}/events/${eventId}/seating/reassign`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ rsvpId, newTableId: targetTableId }) });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Seat assignment failed');
      loadDashboardData();
    } catch (err) { alert(err.message); }
  }, [apiUrl, eventId, rsvps, loadDashboardData]);

  const handleRealtimeRsvp = useCallback((payload) => {
    if (payload.eventType === 'INSERT') {
      const r = payload.new;
      const isYes = r.response === 'yes' || r.response === 'Accepted';
      const formatted = {
        id: r.id, guest_name: r.guest_name, party_size: r.party_size, response: r.response,
        email: r.email || '-', phone: r.phone || '-', tableId: '', meal: r.meal || '-', timestamp: 'Just now'
      };
      setRsvps(prev => [formatted, ...prev]);
      setStats(prev => {
        const isNo = r.response === 'no' || r.response === 'Declined';
        const newAttending = isYes ? prev.attendingGuests + r.party_size : prev.attendingGuests;
        const newDeclined = isNo ? prev.declinedGuests + r.party_size : prev.declinedGuests;
        const newPending = (!isYes && !isNo) ? prev.pendingGuests - r.party_size : prev.pendingGuests;
        const newMealSummary = { ...prev.mealSummary };
        if (isYes && r.meal && r.meal !== 'None') { newMealSummary[r.meal] = (newMealSummary[r.meal] || 0) + 1; }
        return { ...prev, invitedParties: prev.invitedParties + 1, attendingGuests: newAttending, declinedGuests: newDeclined, pendingGuests: Math.max(0, newPending), mealSummary: newMealSummary };
      });
    } else { loadDashboardData(); }
  }, [loadDashboardData]);

  useRealtimeRSVPs(eventId, handleRealtimeRsvp);

  const totalSeatedCountText = useMemo(() => `${stats.seatingAssignedGuests} / ${stats.attendingGuests}`, [stats.seatingAssignedGuests, stats.attendingGuests]);

  if (!authChecked) return <DashboardSkeleton />;
  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', background: COLORS.white, border: `1px solid ${COLORS.border}`, padding: '48px 32px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: '48px' }}>🔌</span>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: '#C45E5E', marginTop: '12px' }}>Backend Connection Error</h2>
          <p style={{ color: COLORS.stone, marginTop: '12px', fontSize: '13px', lineHeight: 1.7, fontWeight: 300 }}>{error}</p>
          <button onClick={() => { setLoading(true); loadDashboardData(); }} id="retry-connection-btn"
            style={{ marginTop: '24px', padding: '12px 28px', background: COLORS.gold, color: COLORS.white, border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const activeEvent = events.find(e => e.id === eventId);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.white, fontFamily: 'var(--font-sans)' }}>

      {/* ═══ MOBILE HAMBURGER TOGGLE ═══ */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle navigation menu"
        style={{
          display: 'none', position: 'fixed', top: '16px', left: '16px', zIndex: 60,
          width: '40px', height: '40px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
          background: COLORS.white, cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
        className="sidebar-toggle"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.charcoal} strokeWidth="2">
          {sidebarOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
        </svg>
      </button>

      {/* ═══ SIDEBAR OVERLAY (mobile) ═══ */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ display: 'none', position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.3)' }}
          className="sidebar-overlay"
        />
      )}

      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside className="dashboard-sidebar" style={{
        width: '240px', minHeight: '100vh', background: COLORS.white, borderRight: `1px solid ${COLORS.border}`,
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, zIndex: 50,
        transition: 'transform 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: '6px', textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-script)', fontSize: '26px', fontWeight: 400, color: COLORS.gold, lineHeight: 1 }}>Fancy</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: COLORS.charcoal, letterSpacing: '2.5px', textTransform: 'uppercase', lineHeight: 1 }}>RSVP</span>
          </Link>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sidebarNav.map(item => {
            const isActive = activeTab === item.key;
            return (
              <button key={item.key} onClick={() => setActiveTab(item.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                  borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: isActive ? COLORS.ivory : 'transparent',
                  color: isActive ? COLORS.gold : COLORS.stone,
                  borderLeft: isActive ? `3px solid ${COLORS.gold}` : '3px solid transparent',
                  fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#FDFCF9'; e.currentTarget.style.color = COLORS.charcoal; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLORS.stone; } }}
              >
                <span style={{ display: 'flex', width: '18px', height: '18px' }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom: Log Out */}
        <div style={{ padding: '16px 12px', borderTop: `1px solid ${COLORS.border}` }}>
          <button onClick={handleLogout} aria-label="Log out" style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', width: '100%',
            background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 400, color: COLORS.stone,
            transition: 'all 0.2s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFF1F2'; e.currentTarget.style.color = '#C45E5E'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLORS.stone; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log Out
          </button>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <main style={{ flex: 1, marginLeft: '240px', minHeight: '100vh', background: '#FAFAF8' }}>

        {/* Top Bar */}
        <div style={{
          padding: '20px 32px', background: COLORS.white, borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 500, color: COLORS.charcoal }}>
              {activeEvent?.title || 'Dashboard'}
            </h1>
            {events.length > 1 && (
              <select value={eventId} onChange={e => setEventId(e.target.value)}
                style={{ marginTop: '4px', background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '6px', padding: '4px 8px', fontSize: '11px', color: COLORS.charcoal, fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none' }}>
                {events.map(ev => (<option key={ev.id} value={ev.id}>{ev.title}</option>))}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {isSuperAdmin && (
              <Link href="/admin" id="btn-open-super-admin" style={{
                padding: '8px 16px', background: COLORS.ivory, color: COLORS.gold, border: `1px solid ${COLORS.border}`,
                borderRadius: '8px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-sans)',
              }}>Super Admin</Link>
            )}
            <button onClick={() => setShowAddGuestModal(true)} id="btn-add-guest" style={{
              padding: '8px 16px', background: COLORS.gold, color: COLORS.white, border: 'none',
              borderRadius: '8px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.goldHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.gold; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Guest
            </button>
            <button onClick={() => setShowImportModal(true)} id="btn-import-csv" style={{
              padding: '8px 16px', background: COLORS.white, border: `1px solid ${COLORS.border}`, color: COLORS.stone,
              borderRadius: '8px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.color = COLORS.gold; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.stone; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import CSV
            </button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => {
                const url = `${window.location.origin}/${activeEvent?.slug || ''}`;
                navigator.clipboard.writeText(url).then(() => {
                  setCopyTooltip(true);
                  setTimeout(() => setCopyTooltip(false), 1800);
                }).catch(() => {});
              }} id="btn-copy-link" style={{
                padding: '8px 16px', background: COLORS.white, border: `1px solid ${COLORS.border}`, color: COLORS.stone,
                borderRadius: '8px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)',
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.color = COLORS.gold; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.stone; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Copy Link
              </button>
              {copyTooltip && (
                <span style={{
                  position: 'absolute', top: '-32px', left: '50%', transform: 'translateX(-50%)',
                  background: COLORS.charcoal, color: COLORS.white, padding: '4px 12px', borderRadius: '6px',
                  fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}>Copied!</span>
              )}
            </div>
            <button onClick={async () => {
              try {
                const res = await fetch(`${apiUrl}/events/${eventId}/rsvps/export`, { credentials: 'include' });
                if (!res.ok) throw new Error('Export failed');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'guest-list.csv'; a.click();
                URL.revokeObjectURL(url);
              } catch (err) { alert(err.message); }
            }} id="btn-export-excel" style={{
              padding: '8px 16px', background: COLORS.white, border: `1px solid ${COLORS.border}`, color: COLORS.stone,
              borderRadius: '8px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.2s', cursor: 'pointer',
            }}>Export Sheet</button>
            <Link href="/dashboard/seating-map" id="btn-open-seating-map" style={{
              padding: '8px 16px', background: COLORS.gold, color: COLORS.white, borderRadius: '8px',
              fontSize: '12px', fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
            }}>Open Seating Map</Link>
          </div>
        </div>

        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>

          {activeTab === 'settings' ? (
            <EventSettings eventId={eventId} event={activeEvent} onEventUpdated={(updated) => {
              setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, ...updated } : ev));
            }} />
          ) : activeTab === 'form-builder' ? (
            <FormBuilder eventId={eventId} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

              {eventId && (<>
              {/* KPI Metrics Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                <StatMetricsCard label="Total Invited" value={`${stats.invitedParties} parties`} subtext="Event campaigns reached" accentColor="slate"
                  icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>} />
                <StatMetricsCard label="Confirmed Yes" value={`${stats.attendingGuests} guests`} subtext="Acceptance count" accentColor="green"
                  icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
                <StatMetricsCard label="Declined" value={`${stats.declinedGuests} guests`} subtext="Regret count" accentColor="rose"
                  icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
                <StatMetricsCard label="Arrivals" value={`${stats.checkedInGuests} checked-in`} subtext="Active attendees present" accentColor="amber"
                  icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 13l4 4L19 7"/></svg>} />
                <StatMetricsCard label="Seating Allocated" value={totalSeatedCountText} subtext="Assigned tables progress" accentColor="blue"
                  icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16"/></svg>} />
              </div>

              {/* Charts & Activity Feed */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <ErrorBoundary><ResponsiveChartBoard stats={stats} /></ErrorBoundary>
                <ErrorBoundary><LiveActivityFeed rsvps={rsvps} /></ErrorBoundary>
              </div>

              {/* Seating & Tables */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                <TableForm tables={tables} newTableName={newTableName} setNewTableName={setNewTableName} newTableCapacity={newTableCapacity} setNewTableCapacity={setNewTableCapacity} onCreateTable={handleCreateTable} />
                <ErrorBoundary><SeatingManager rsvps={rsvps} tables={tables} searchQuery={searchQuery} setSearchQuery={setSearchQuery} filterResponse={filterResponse} setFilterResponse={setFilterResponse} onAssignTable={handleAssignTable} /></ErrorBoundary>
              </div>
              </>)}

              {!eventId && activeTab === 'overview' && (
                <div style={{ textAlign: 'center', padding: '64px 24px', background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '16px' }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🎉</span>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 500, color: '#191B1E', marginBottom: '8px' }}>Welcome to Fancy RSVP!</h2>
                  <p style={{ fontSize: '14px', color: '#77736A', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>Create your first event to start managing RSVPs, seating, and check-ins.</p>
                  <a href="/dashboard/create-event" style={{ display: 'inline-block', padding: '12px 28px', background: '#B8944F', color: '#FFFFFF', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none', fontFamily: 'var(--font-sans)' }}>+ Create Your First Event</a>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ═══ MODALS ═══ */}
      <AddGuestModal
        isOpen={showAddGuestModal}
        onClose={() => setShowAddGuestModal(false)}
        eventId={eventId}
        onGuestAdded={loadDashboardData}
      />
      <ImportGuestsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        eventId={eventId}
        onImportComplete={loadDashboardData}
      />

      <style jsx>{`
        @media (max-width: 1024px) {
          .sidebar-toggle { display: flex !important; }
          .sidebar-overlay { display: block !important; }
          .dashboard-sidebar { transform: ${sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'}; }
          main { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
