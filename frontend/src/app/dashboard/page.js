'use client';
import { toast } from '../utils/toast';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { logout, apiFetch } from '../utils/apiClient';
import LogoutModal from '../components/LogoutModal';
import { useIsClient } from '../utils/useIsClient';
import Icon from '../components/icons/Icon';
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
import EventsTab from './components/EventsTab';
import DraftsTab from './components/DraftsTab';
import ShareTab from './components/ShareTab';
import RSVPsTab from './components/RSVPsTab';
import GuestsTab from './components/GuestsTab';
import FeatureGate from './components/FeatureGate';
import OrganizerOverview from './components/OrganizerOverview';
import OrganizerProfile from './components/OrganizerProfile';
import ReferralsTab from './components/ReferralsTab';
import SendInvitationModal from './components/SendInvitationModal';

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
  { key: 'drafts', label: 'Drafts', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
  )},
  { key: 'share', label: 'Share & QR', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
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
  { key: 'campaigns', label: 'SMS Campaigns', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
  )},
  { key: 'referrals', label: 'Referrals', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
  )},
  { key: 'profile', label: 'Profile', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/></svg>
  )},
  { key: 'settings', label: 'Settings', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  )},
];

function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: COLORS.ivory }}>
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

/* ═══════════════════════════════════════════════
   HTML escaping for safe interpolation in document.write()
   ═══════════════════════════════════════════════ */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeCoverUrl(url) {
  if (!url) return 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?q=80&w=2070';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?q=80&w=2070';
    }
    return encodeURI(url);
  } catch {
    return 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?q=80&w=2070';
  }
}

/* ═══════════════════════════════════════════════
   Local QR code renderer (replaces external qrserver.com API)
   ═══════════════════════════════════════════════ */
function QRCodeDisplay({ url, size = 200 }) {
  const [src, setSrc] = React.useState('');
  React.useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: size }).then(dataUrl => {
      if (!cancelled) setSrc(dataUrl);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [url, size]);
  if (!src) return <div style={{ width: size, height: size, background: COLORS.softBg, border: `1px solid ${COLORS.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 11, color: COLORS.stone }}>Loading QR…</span></div>;
  return (
    <div style={{ background: COLORS.softBg, border: `1px solid ${COLORS.border}`, padding: 16, borderRadius: 12, display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
      <img src={src} alt="Event QR Code" style={{ width: size, height: size, display: 'block' }} />
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // isClient gates the localStorage read until we're past hydration (SSR has
  // no localStorage). authChecked is derived from it — it's never set
  // independently anywhere else, so no separate state is needed (mirrors
  // seating-map/page.js's and checkin/page.js's fix for this same pattern).
  const isClient = useIsClient();
  const orgId = isClient ? localStorage.getItem('org_id') : null;
  const authChecked = isClient && !!orgId;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState({
    invitedParties: 0, attendingParties: 0, attendingGuests: 0,
    declinedParties: 0, declinedGuests: 0, pendingParties: 0,
    pendingGuests: 0, totalExpectedGuests: 0, checkedInGuests: 0,
    seatingAssignedGuests: 0, mealSummary: {}
  });

  const [tables, setTables] = useState([]);
  const [rsvps, setRsvps] = useState([]);
  // Read inside the silent 20s realtime poll to diff against incoming data
  // without making loadDashboardData depend on (and re-create per) rsvps.
  const rsvpsRef = useRef([]);
  useEffect(() => { rsvpsRef.current = rsvps; }, [rsvps]);
  const [customFields, setCustomFields] = useState([]);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResponse, setFilterResponse] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSendInvitationModal, setShowSendInvitationModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrModalTab, setQrModalTab] = useState('qr');
  const [copyTooltip, setCopyTooltip] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [forcePasswordReset, setForcePasswordReset] = useState(false);


  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  // The redirect is a genuine imperative side effect (navigation); it no
  // longer also carries the authChecked state update, which is now a plain
  // derived value above. Super-admin status is validated server-side during
  // data load (see below).
  useEffect(() => {
    if (isClient && !orgId) router.push('/login');
  }, [isClient, orgId, router]);

  /* ═══ Deep-link to a tab (e.g. ?tab=drafts after "Save as Draft") + toast ═══ */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Wrapped in an IIFE (same technique used elsewhere in this pass) so none
    // of these setState calls are bare top-level statements in the effect body.
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const saved = params.get('saved');
      const forceReset = params.get('forceReset');
      if (tab) setActiveTab(tab);
      if (saved === 'draft') toast.success('Draft saved — finish it any time from Drafts.');
      // forcePasswordReset only ever renders inside OrganizerProfile, which only
      // mounts when activeTab === 'profile' (default tab is 'overview') — without
      // this, a user linked in via ?forceReset=1 never actually saw the prompt
      // unless they happened to click into Profile themselves.
      if (forceReset === '1') { setForcePasswordReset(true); setActiveTab('profile'); }
      if (tab || saved || forceReset) {
        params.delete('tab'); params.delete('saved'); params.delete('forceReset');
        const qs = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
      }
    })();
  }, []);

  // Pulled out to a stable callback (not just an inline effect function) so the
  // "Retry Connection" screen's button can call it directly — previously that
  // button always called loadDashboardData(), which immediately no-ops when
  // eventId is empty, so a fetchEvents-stage outage left Retry as a permanent
  // no-op with zero feedback.
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsResult, profileResult] = await Promise.allSettled([
        apiFetch('/events'),
        apiFetch('/auth/profile')
      ]);

      const data = eventsResult.status === 'fulfilled' ? eventsResult.value : null;
      const profileData = profileResult.status === 'fulfilled' ? profileResult.value : null;

      if (profileData?.success && profileData.profile) {
        setIsSuperAdmin(!!profileData.profile.isSuperAdmin);
      }

      if (data && data.success) {
        if (data.events.length > 0) {
          setEvents(data.events);
          // Prefer the event passed back from a Stripe return (?event=…) or the last
          // active event, so the user lands on the section they were working in —
          // not always the first event.
          const params = new URLSearchParams(window.location.search);
          const returnedId = params.get('event');
          const storedId = localStorage.getItem('active_event_id');
          const preferred = [returnedId, storedId].find(id => id && data.events.some(e => e.id === id));
          setEventId(preferred || data.events[0].id);
          setError(null);
        } else {
          // Genuinely zero events (new account) — a normal empty state, not a
          // failure, so this must NOT show the "Backend Connection Error" screen.
          setEvents([]);
          setEventId('');
          setError(null);
          setLoading(false);
        }
        return true;
      }
      // Same failure class as loadDashboardData below — previously this branch
      // silently showed an empty-events UI with no indication anything failed.
      setError(data?.message || 'Could not connect to backend server. Make sure the backend server is running on port 5000.');
      setLoading(false);
      return false;
    } catch (err) {
      setError('Could not connect to backend server. Make sure the backend server is running on port 5000.');
      setLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => { await fetchEvents(); })();
  }, [authChecked, fetchEvents]);

  useEffect(() => {
    if (eventId && typeof window !== 'undefined') localStorage.setItem('active_event_id', eventId);
  }, [eventId]);

  /* ═══ Return from Stripe Checkout when paying for an EXISTING event from the
     Events section. Land on the Events tab (never the creation wizard), keep the
     paid event selected, synchronously confirm the session, and clean the URL. ═══ */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment !== 'success' && payment !== 'cancelled') return;

    // Wrapped in one IIFE (same technique used elsewhere in this pass) so none
    // of these setState calls are bare top-level statements in the effect body.
    (async () => {
      setActiveTab('events');
      const returnedId = params.get('event');
      if (returnedId) localStorage.setItem('active_event_id', returnedId); // fetchEvents selects it

      const sessionId = params.get('session_id');
      // Strip the payment params so a refresh doesn't replay this handler.
      window.history.replaceState({}, '', window.location.pathname);

      if (payment === 'success' && sessionId) {
        // Confirm the payment synchronously, THEN re-fetch events so the UI
        // reflects the updated is_paid / tier state (the webhook remains the backstop).
        // Reuses the shared fetchEvents() (rather than duplicating the fetch here)
        // so this path gets the same session-expiry handling and unified error
        // state as every other event load — `returnedId` was already persisted to
        // localStorage above, so fetchEvents' own preference logic still picks it.
        try {
          await apiFetch(`/payments/verify?session_id=${encodeURIComponent(sessionId)}`);
        } catch { /* non-fatal — the webhook will reconcile the event status */ }
        const ok = await fetchEvents();
        if (ok) toast.success('Payment confirmed successfully!');
      }
    })();
  }, [fetchEvents]);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // "Latest request wins" guard: switching events quickly, or a 20s realtime
  // poll (useRealtimeRSVPs) overlapping a manual switch, could previously let
  // an OLDER, slower response land after a newer one and silently overwrite
  // the correct data with stale data — there was no cancellation of any kind.
  // Bumped and checked inside this same callback (not via a separate
  // ref-syncing effect) so a stale call's results are simply discarded.
  const loadRequestIdRef = useRef(0);

  const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
    if (!eventId) return;
    const requestId = ++loadRequestIdRef.current;
    // Background refreshes (the 20s realtime poll, tab-refocus) must never
    // blow away the rendered dashboard with the full skeleton — only the
    // very first load, and explicit user-triggered refetches, show it.
    if (!silent) setLoading(true);
    try {

      const [statsResult, tablesResult, rsvpsResult, fieldsResult, profileResult] = await Promise.allSettled([
        apiFetch(`/events/${eventId}/stats`),
        apiFetch(`/events/${eventId}/tables`),
        apiFetch(`/events/${eventId}/rsvps`),
        apiFetch(`/events/${eventId}/fields`),
        apiFetch('/auth/profile'),
      ]);

      // A newer load already started while these were in flight — applying
      // this response now would overwrite the newer (correct) data on screen.
      if (loadRequestIdRef.current !== requestId) return;

      const statsData = statsResult.status === 'fulfilled' ? statsResult.value : null;
      const tablesData = tablesResult.status === 'fulfilled' ? tablesResult.value : null;
      const rsvpsData = rsvpsResult.status === 'fulfilled' ? rsvpsResult.value : null;
      const fieldsData = fieldsResult.status === 'fulfilled' ? fieldsResult.value : null;
      const profileData = profileResult.status === 'fulfilled' ? profileResult.value : null;

      // Server-validated super-admin check (FIX H12: replaces localStorage check)
      if (profileData?.success && profileData.profile) {
        setIsSuperAdmin(!!profileData.profile.isSuperAdmin);
      } else {
        setIsSuperAdmin(false);
      }

      if (statsData?.success) setStats(statsData.stats);
      if (tablesData?.success) setTables(tablesData.tables);
      if (fieldsData?.success) setCustomFields(fieldsData.fields || []);
      if (rsvpsData?.success) {
        const formattedGuests = (rsvpsData.data?.rsvps || []).map(r => {
          const assignedTableId = r.seating_assignments && r.seating_assignments.length > 0 ? r.seating_assignments[0].table_id : '';
          const party = r.guests || [];
          const primary = party.find(g => g.is_primary_contact) || party[0] || {};
          // Name-attributed so a party of 2+ with different meals is legible
          // ("John: Chicken, Guest 2: Fish") instead of an ambiguous
          // comma-joined blob with no way to tell whose meal is whose.
          const guestMeals = party.filter(g => g.meal_selection)
            .map(g => `${g.full_name}: ${g.meal_selection}`).join(', ') || '-';
          // Channel-specific — previously a single flag conflated all channels,
          // so a guest only ever emailed would silently disappear from the
          // SMS tab's default "Not Invited" filter (and vice versa), meaning
          // an organizer relying on that filter could permanently miss
          // sending them the other channel.
          const invitedSentStatuses = ['sent', 'delivered', 'opened', 'responded'];
          const invitations = r.invitations || [];
          const wasInvitedEmail = invitations.some(i => i.channel === 'email' && invitedSentStatuses.includes(i.status));
          const wasInvitedSms = invitations.some(i => i.channel === 'sms' && invitedSentStatuses.includes(i.status));
          return {
            id: r.id, guest_name: r.label, party_size: party.length || 1, response: r.response,
            email: primary.email || '-', phone: primary.phone || '-', tableId: assignedTableId, meal: guestMeals,
            primary_meal: primary.meal_selection || null,
            invitation_sent: wasInvitedEmail || wasInvitedSms,
            invitation_sent_email: wasInvitedEmail,
            invitation_sent_sms: wasInvitedSms,
            // Full per-companion details so the organizer sees everyone in the party.
            guests: party,
            // Custom-question answers (e.g. song requests, dietary preferences) the
            // party head answered during RSVP — labels resolved against customFields.
            customAnswers: r.custom_answers || [],
            notes: r.notes || '',
            side: r.side || null,
            timestamp: r.created_at || null
          };
        });
        // The 20s realtime poll previously swapped the whole list in silently —
        // rows could reorder under a scrolling thumb with zero warning. Surface
        // a toast naming how many responses are actually new instead.
        if (silent) {
          const prevIds = new Set(rsvpsRef.current.map((g) => g.id));
          const newCount = formattedGuests.filter((g) => !prevIds.has(g.id)).length;
          if (newCount > 0) {
            toast.success(`${newCount} new response${newCount > 1 ? 's' : ''}`);
          }
        }
        setRsvps(formattedGuests);
      }
      setError(null);
    } catch (err) {
      if (loadRequestIdRef.current !== requestId) return;
      setError('Could not connect to backend server. Make sure the backend server is running on port 5000.');
    } finally {
      if (loadRequestIdRef.current === requestId && !silent) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { if (!eventId) return; (async () => { await loadDashboardData(); })(); }, [loadDashboardData, eventId]);

  const handleCreateTable = useCallback(async (e) => {
    e.preventDefault();
    if (!newTableName.trim() || !eventId) return;
    try {
      const data = await apiFetch(`/events/${eventId}/tables`, {
        method: 'POST',
        body: JSON.stringify({ tableName: newTableName, maxCapacity: parseInt(newTableCapacity) })
      });
      if (data.success) { setNewTableName(''); setNewTableCapacity(10); loadDashboardData(); }
    } catch (err) { toast.error(err.message); }
  }, [eventId, newTableName, newTableCapacity, loadDashboardData]);

  const handleUpdateTable = useCallback(async (tableId, updates) => {
    if (!eventId) return;
    try {
      const data = await apiFetch(`/events/${eventId}/tables/${tableId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      if (data.success) {
        loadDashboardData();
      }
    } catch (err) {
      toast.error(err.message);
    }
  }, [eventId, loadDashboardData]);

  const handleAssignTable = useCallback(async (rsvpId, targetTableId) => {
    const guest = rsvps.find(g => g.id === rsvpId);
    if (!guest || !eventId) return;
    const oldTableId = guest.tableId;
    try {
      if (!oldTableId) {
        await apiFetch(`/events/${eventId}/seating/assign`, { method: 'POST', body: JSON.stringify({ rsvpId, tableId: targetTableId }) });
      } else if (!targetTableId) {
        await apiFetch(`/events/${eventId}/seating/unassign`, { method: 'POST', body: JSON.stringify({ rsvpId }) });
      } else {
        await apiFetch(`/events/${eventId}/seating/reassign`, { method: 'POST', body: JSON.stringify({ rsvpId, newTableId: targetTableId }) });
      }
      loadDashboardData();
    } catch (err) { toast.error(err.message); }
  }, [eventId, rsvps, loadDashboardData]);

  const handleRealtimeRefresh = useCallback(() => {
    loadDashboardData({ silent: true });
  }, [loadDashboardData]);

  useRealtimeRSVPs(eventId, handleRealtimeRefresh);

  const totalSeatedCountText = useMemo(() => `${stats.seatingAssignedGuests} / ${stats.attendingGuests}`, [stats.seatingAssignedGuests, stats.attendingGuests]);

  if (!authChecked) return <DashboardSkeleton />;
  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', background: COLORS.white, border: `1px solid ${COLORS.border}`, padding: '48px 32px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <Icon name="plug" size={44} color="#C45E5E" strokeWidth={1.3} />
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: '#C45E5E', marginTop: '12px' }}>Backend Connection Error</h2>
          <p style={{ color: COLORS.stone, marginTop: '12px', fontSize: '13px', lineHeight: 1.7, fontWeight: 300 }}>{error}</p>
          {/* Retry re-runs whichever load actually failed — previously this always
              called loadDashboardData(), which no-ops when eventId is still empty
              (a fetchEvents-stage outage), making Retry a permanent dead click. */}
          <button onClick={() => { eventId ? loadDashboardData() : fetchEvents(); }} id="retry-connection-btn"
            style={{ marginTop: '24px', padding: '12px 28px', background: COLORS.gold, color: COLORS.white, border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const activeEvent = events.find(e => e.id === eventId);
  // Drafts live exclusively in the Drafts tab; everything else counts as a real event.
  const draftCount = events.filter(e => e && e.status === 'draft' && !e.is_paid).length;
  const liveCount = events.length - draftCount;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.white, fontFamily: 'var(--font-sans)' }}>

      {/* The old top-left floating hamburger lived here. It was removed: it was a
          detached white chip overlapping the sticky glass top-bar (and forcing a
          72px padding hack to avoid the title), AND it was redundant — the bottom
          tab bar's "More" opens the very same drawer from a far better thumb
          position (see the tab bar's own comment below). The drawer is now closed
          via the X in its header or by tapping the overlay. */}

      {/* ═══ SIDEBAR OVERLAY (mobile) ═══ */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ display: 'none', position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.3)' }}
          className="sidebar-overlay"
        />
      )}

      {/* ═══ MOBILE BOTTOM TAB BAR ═══
          The off-canvas sidebar drawer costs two taps to reach any section
          (open hamburger, then tap) and the hamburger itself sits top-left —
          the worst spot for one-handed thumb reach. This surfaces the 4
          highest-frequency destinations plus "More" (opens the same drawer,
          everything else still lives there) within one thumb's reach. */}
      <nav className="dashboard-bottom-tabbar" aria-label="Primary">
        {[
          { key: 'overview', label: 'Home', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
          { key: 'guests', label: 'Guests', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
          { key: 'rsvps', label: 'RSVPs', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
          { key: 'seating', label: 'Seating', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
        ].map(item => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
              aria-current={isActive ? 'page' : undefined}
              className="dashboard-bottom-tab"
              style={{ color: isActive ? COLORS.gold : COLORS.stone }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="More navigation options"
          className="dashboard-bottom-tab"
          style={{ color: COLORS.stone }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          <span>More</span>
        </button>
      </nav>

      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside className="dashboard-sidebar" style={{
        width: '240px', minHeight: '100vh', background: COLORS.white, borderRight: `1px solid ${COLORS.border}`,
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, zIndex: 50,
        transition: 'transform 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          {/* Mobile-only dismiss for the off-canvas drawer (desktop keeps the
              sidebar permanently docked, so it has nothing to close). */}
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation menu"
            className="sidebar-close"
            style={{
              display: 'none', order: 2, width: '36px', height: '36px', flexShrink: 0,
              borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.white,
              cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.charcoal} strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <svg
              width="24"
              height="20"
              viewBox="0 0 38 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0 }}
            >
              <rect x="2" y="8" width="34" height="22" rx="2" stroke="#B8944F" strokeWidth="2" fill="none" />
              <path d="M2 10L19 22L36 10" stroke="#B8944F" strokeWidth="2" fill="none" strokeLinejoin="round" />
              <path d="M4 8L19 0L34 8" stroke="#B8944F" strokeWidth="2" fill="none" strokeLinejoin="round" />
            </svg>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontFamily: 'var(--font-script)', fontSize: '26px', fontWeight: 400, color: COLORS.gold, lineHeight: 1 }}>Fancy</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: COLORS.charcoal, letterSpacing: '1.5px', textTransform: 'uppercase', lineHeight: 1 }}>RSVP</span>
            </div>
          </Link>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sidebarNav.map(item => {
            const isActive = activeTab === item.key;
            return (
              <button key={item.key} data-testid={`tab-${item.key}`} onClick={() => {
                if (item.key === 'campaigns') {
                  router.push('/dashboard/campaigns');
                } else {
                  setActiveTab(item.key);
                  setSidebarOpen(false);
                }
              }}
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
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.key === 'drafts' && draftCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: '18px', height: '18px', padding: '0 6px', borderRadius: '9px',
                    background: isActive ? COLORS.gold : 'rgba(184, 148, 79, 0.14)',
                    color: isActive ? COLORS.white : COLORS.gold,
                    fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-sans)', lineHeight: 1,
                  }}>{draftCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: Log Out */}
        <div style={{ padding: '16px 12px', borderTop: `1px solid ${COLORS.border}` }}>
          <button onClick={() => setShowLogoutModal(true)} aria-label="Log out" style={{
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

        {/* Top Bar — sticky glassmorphism container */}
        <div
          className="top-bar"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            padding: '16px 32px',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(184, 148, 79, 0.15)',
            boxShadow: '0 4px 20px rgba(25, 27, 30, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            transition: 'all 0.3s ease',
          }}
        >
          {(activeTab === 'overview' || activeTab === 'events' || activeTab === 'drafts' || activeTab === 'profile' || activeTab === 'referrals') ? (
            /* ── Overview / Events / Drafts / Profile: clean header, no event-specific controls ── */
            <>
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '24px',
                  fontWeight: 500,
                  color: COLORS.charcoal,
                  margin: 0,
                  letterSpacing: '-0.01em'
                }}>
                  {activeTab === 'overview' ? 'Dashboard Overview' : activeTab === 'drafts' ? 'Drafts' : activeTab === 'profile' ? 'Organizer Profile' : activeTab === 'referrals' ? 'Referrals' : 'Your Events'}
                </h1>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  color: COLORS.stone,
                  margin: '4px 0 0 0',
                  fontWeight: 400
                }}>
                  {activeTab === 'overview'
                    ? 'Aggregated insights across all your events'
                    : activeTab === 'drafts'
                      ? `${draftCount} draft${draftCount !== 1 ? 's' : ''} waiting to be finished`
                      : activeTab === 'profile'
                        ? 'Your account and organization details'
                        : activeTab === 'referrals'
                          ? 'Earn credit by referring other organizers'
                          : `You have ${liveCount} event${liveCount !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isSuperAdmin && (
                  <Link href="/admin" id="btn-open-super-admin" style={{
                    padding: '10px 18px',
                    background: COLORS.charcoal,
                    color: COLORS.champagne,
                    border: '1px solid rgba(184, 148, 79, 0.35)',
                    borderRadius: '30px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    Super Admin
                  </Link>
                )}
                <Link href="/dashboard/create-event" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
                  color: COLORS.white,
                  border: 'none',
                  borderRadius: '30px',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-sans)',
                  textDecoration: 'none',
                  boxShadow: '0 4px 15px rgba(184, 148, 79, 0.25)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(184, 148, 79, 0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(184, 148, 79, 0.25)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Create Event
                </Link>
              </div>
            </>
          ) : (
            /* ── Event-specific tabs: show event name, selector, and action buttons ── */
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h1 style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '26px',
                    fontWeight: 500,
                    color: COLORS.charcoal,
                    margin: 0,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                  }}>
                    {activeEvent?.title || 'Select an Event'}
                  </h1>
                  
                  {activeEvent && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      background: activeEvent.status === 'active' ? 'rgba(34, 197, 94, 0.08)' : activeEvent.status === 'paused' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(119, 115, 106, 0.08)',
                      border: `1px solid ${activeEvent.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : activeEvent.status === 'paused' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(119, 115, 106, 0.2)'}`,
                      borderRadius: '20px',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: activeEvent.status === 'active' ? '#22C55E' : activeEvent.status === 'paused' ? '#F59E0B' : '#77736A',
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '0.5px',
                    }}>
                      <span className="status-dot" style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: activeEvent.status === 'active' ? '#22C55E' : activeEvent.status === 'paused' ? '#F59E0B' : '#77736A',
                        boxShadow: activeEvent.status === 'active' ? '0 0 8px #22C55E' : activeEvent.status === 'paused' ? '0 0 8px #F59E0B' : 'none',
                        animation: activeEvent.status === 'active' ? 'pulse 2s infinite' : 'none',
                      }} />
                      {activeEvent.status}
                    </div>
                  )}
                </div>

                {events.length > 1 && (
                  <div style={{ position: 'relative', display: 'inline-block', width: 'fit-content' }}>
                    <select
                      value={eventId}
                      onChange={e => setEventId(e.target.value)}
                      style={{
                        background: 'rgba(184, 148, 79, 0.04)',
                        border: '1px solid rgba(184, 148, 79, 0.18)',
                        borderRadius: '30px',
                        padding: '5px 28px 5px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: COLORS.gold,
                        fontFamily: 'var(--font-sans)',
                        cursor: 'pointer',
                        outline: 'none',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184, 148, 79, 0.08)'; e.currentTarget.style.borderColor = COLORS.gold; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(184, 148, 79, 0.04)'; e.currentTarget.style.borderColor = 'rgba(184, 148, 79, 0.18)'; }}
                    >
                      {events.map(ev => (<option key={ev.id} value={ev.id} style={{ color: COLORS.charcoal }}>{ev.title}</option>))}
                    </select>
                    <svg width="8" height="6" viewBox="0 0 10 6" fill="none" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <path d="M1 1L5 5L9 1" stroke={COLORS.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Action Buttons Group */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {isSuperAdmin && (
                  <Link href="/admin" id="btn-open-super-admin" style={{
                    padding: '8px 16px',
                    background: COLORS.charcoal,
                    color: COLORS.champagne,
                    border: '1px solid rgba(184, 148, 79, 0.35)',
                    borderRadius: '30px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    Super Admin
                  </Link>
                )}

                <Link
                  href="/checkin"
                  id="btn-open-checkin"
                  style={{
                    padding: '9px 18px',
                    background: 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
                    color: COLORS.white,
                    border: 'none',
                    borderRadius: '30px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: 'var(--font-sans)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 15px rgba(184, 148, 79, 0.25)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(184, 148, 79, 0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(184, 148, 79, 0.25)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Check-In
                </Link>

                <FeatureGate tierFeatures={activeEvent?.tier_features} isPaid={!!activeEvent?.is_paid} feature="seating_map" onUpgrade={() => { setActiveTab('events'); }}>
                <Link
                  href="/dashboard/seating-map"
                  id="btn-open-seating-map"
                  style={{
                    padding: '9px 18px',
                    background: COLORS.charcoal,
                    color: COLORS.white,
                    border: 'none',
                    borderRadius: '30px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: 'var(--font-sans)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 15px rgba(25, 27, 30, 0.12)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(25, 27, 30, 0.25)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(25, 27, 30, 0.12)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
                  Open Seating Map
                </Link>
                </FeatureGate>

                <div className="action-btn-divider" style={{ width: '1px', height: '20px', background: COLORS.border, margin: '0 4px' }} />

                {activeTab === 'guests' && (
                  <FeatureGate tierFeatures={activeEvent?.tier_features} isPaid={!!activeEvent?.is_paid} feature="import_guests_csv" onUpgrade={() => { setActiveTab('events'); }}>
                  <button
                    onClick={() => setShowImportModal(true)}
                    id="btn-import-csv"
                    style={{
                      padding: '8px 16px',
                      background: COLORS.white,
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.stone,
                      borderRadius: '30px',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-sans)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.color = COLORS.gold; e.currentTarget.style.background = 'rgba(184, 148, 79, 0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.stone; e.currentTarget.style.background = COLORS.white; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Import CSV
                  </button>
                  </FeatureGate>
                )}

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/${activeEvent?.slug || ''}`;
                      navigator.clipboard.writeText(url).then(() => {
                        setCopyTooltip(true);
                        setTimeout(() => setCopyTooltip(false), 1800);
                      }).catch(() => {});
                    }}
                    id="btn-copy-link"
                    style={{
                      padding: '8px 16px',
                      background: COLORS.white,
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.stone,
                      borderRadius: '30px',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-sans)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.color = COLORS.gold; e.currentTarget.style.background = 'rgba(184, 148, 79, 0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.stone; e.currentTarget.style.background = COLORS.white; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    Copy Link
                  </button>
                  {copyTooltip && (
                    <span style={{
                      position: 'absolute',
                      top: '-36px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: COLORS.charcoal,
                      color: COLORS.white,
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-sans)',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                    }}>COPIED!</span>
                  )}
                </div>

                <button
                  onClick={() => { setQrModalTab('qr'); setShowQRModal(true); }}
                  id="btn-show-qr"
                  style={{
                    padding: '8px 16px',
                    background: COLORS.white,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.stone,
                    borderRadius: '30px',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.color = COLORS.gold; e.currentTarget.style.background = 'rgba(184, 148, 79, 0.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.stone; e.currentTarget.style.background = COLORS.white; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 7h2v2H7zm0 8h2v2H7zm8-8h2v2h-2z" /><path d="M12 7h1v1h-1zm0 2h1v1h-1zm2-2h1v1h-1zm0 2h1v1h-1zm-2 4h1v1h-1zm2 0h1v1h-1zm-2 2h1v1h-1zm2 0h1v1h-1zm-4 2h1v1h-1zm2 0h1v1h-1z" /></svg>
                  QR Code
                </button>

                {activeTab === 'rsvps' && (
                  <button
                    onClick={async () => {
                      try {
                        const blob = await apiFetch(`/events/${eventId}/rsvps/export`);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'guest-list.csv'; a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) { toast.error(err.message); }
                    }}
                    id="btn-export-excel"
                    style={{
                      padding: '8px 16px',
                      background: COLORS.white,
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.stone,
                      borderRadius: '30px',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-sans)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.color = COLORS.gold; e.currentTarget.style.background = 'rgba(184, 148, 79, 0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.stone; e.currentTarget.style.background = COLORS.white; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Export Sheet
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="content-container" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>

          {activeTab === 'profile' ? (
            <OrganizerProfile events={events} forcePasswordReset={forcePasswordReset} onPasswordReset={() => setForcePasswordReset(false)} />
          ) : activeTab === 'referrals' ? (
            <ReferralsTab />
          ) : activeTab === 'settings' ? (
            <EventSettings eventId={eventId} event={activeEvent} onEventUpdated={(updated) => {
              setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, ...updated } : ev));
            }} onEventDeleted={(deletedId) => {
              setEvents(prev => {
                const remaining = prev.filter(ev => ev.id !== deletedId);
                setEventId(remaining[0]?.id || '');
                return remaining;
              });
              setActiveTab('overview');
            }} />
          ) : activeTab === 'form-builder' ? (
            <FeatureGate
              tierFeatures={activeEvent?.tier_features}
              feature="rsvp_custom_fields"
              isPaid={!!activeEvent?.is_paid || !!activeEvent?.manual_override}
              onUpgrade={() => setActiveTab('events')}
              wrapperStyle={{ display: 'flex', width: '100%' }}
            >
              <FormBuilder eventId={eventId} />
            </FeatureGate>
          ) : activeTab === 'events' ? (
            <EventsTab
              events={events}
              activeEventId={eventId}
              onSelectEvent={(id, tab) => { setEventId(id); setActiveTab(tab || 'overview'); }}
              onRefresh={loadDashboardData}
            />
          ) : activeTab === 'drafts' ? (
            <DraftsTab
              events={events}
              apiUrl={apiUrl}
              onRefresh={(deletedId) => { if (deletedId) setEvents(prev => prev.filter(e => e.id !== deletedId)); }}
            />
          ) : activeTab === 'share' ? (
            <ShareTab event={activeEvent} />
          ) : activeTab === 'rsvps' ? (
            <RSVPsTab rsvps={rsvps} eventId={eventId} event={activeEvent} customFields={customFields} onRefresh={loadDashboardData} />
          ) : activeTab === 'guests' ? (
            <GuestsTab
              rsvps={rsvps}
              tables={tables}
              customFields={customFields}
              eventId={eventId}
              event={activeEvent}
              onAssignTable={handleAssignTable}
              onRefresh={loadDashboardData}
              onOpenAddGuest={() => setShowAddGuestModal(true)}
              onOpenImport={() => setShowImportModal(true)}
              onOpenSendInvitations={() => setShowSendInvitationModal(true)}
              isPaid={!!activeEvent?.is_paid || !!activeEvent?.manual_override}
              tierFeatures={activeEvent?.tier_features}
              onUpgrade={() => setActiveTab('events')}
            />
          ) : activeTab === 'seating' ? (
            /* ═══ SEATING TAB ═══ */
            <FeatureGate
              tierFeatures={activeEvent?.tier_features}
              feature="seating_map"
              isPaid={!!activeEvent?.is_paid || !!activeEvent?.manual_override}
              onUpgrade={() => setActiveTab('events')}
              wrapperStyle={{ display: 'flex', width: '100%' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                {eventId && (<>
                  <div className="seating-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                    <TableForm tables={tables} newTableName={newTableName} setNewTableName={setNewTableName} newTableCapacity={newTableCapacity} setNewTableCapacity={setNewTableCapacity} onCreateTable={handleCreateTable} onUpdateTable={handleUpdateTable} />
                    <ErrorBoundary><SeatingManager rsvps={rsvps} tables={tables} searchQuery={searchQuery} setSearchQuery={setSearchQuery} filterResponse={filterResponse} setFilterResponse={setFilterResponse} onAssignTable={handleAssignTable} /></ErrorBoundary>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Link href="/dashboard/seating-map" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      padding: '10px 24px', background: COLORS.gold, color: COLORS.white, borderRadius: '8px',
                      fontSize: '13px', fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-sans)',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                      Open Full Seating Map
                    </Link>
                  </div>
                </>)}
                {!eventId && (
                  <div style={{ textAlign: 'center', padding: '48px', background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '12px' }}>
                    <p style={{ color: COLORS.stone, fontSize: '14px', fontStyle: 'italic' }}>Select or create an event first to manage seating.</p>
                  </div>
                )}
              </div>
            </FeatureGate>
          ) : (
            /* ═══ OVERVIEW TAB (default) ═══ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <ErrorBoundary>
                <OrganizerOverview />
              </ErrorBoundary>
            </div>
          )}
        </div>
      </main>

      {/* ═══ MODALS ═══ */}
      <AddGuestModal
        isOpen={showAddGuestModal}
        onClose={() => setShowAddGuestModal(false)}
        eventId={eventId}
        event={activeEvent}
        customFields={customFields}
        onGuestAdded={loadDashboardData}
      />
      <ImportGuestsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        eventId={eventId}
        event={activeEvent}
        onImportComplete={loadDashboardData}
      />
      <SendInvitationModal
        isOpen={showSendInvitationModal}
        onClose={() => setShowSendInvitationModal(false)}
        rsvps={rsvps}
        eventId={eventId}
        apiUrl={apiUrl}
        onSuccess={loadDashboardData}
      />

      {/* ═══ QR CODE MODAL ═══ */}
      {showQRModal && activeEvent && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(25,27,30,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'relative', background: COLORS.white, border: `1px solid ${COLORS.border}`, width: '100%', maxWidth: 420, borderRadius: 16, padding: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>

            <button
              onClick={() => setShowQRModal(false)}
              aria-label="Close"
              style={{
                position: 'absolute', top: 12, right: 12,
                width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: COLORS.softBg,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: COLORS.stone, transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#EDE8DD'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.softBg; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', gap: '8px', background: COLORS.softBg, padding: '4px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
              <button
                type="button"
                onClick={() => setQrModalTab('qr')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: qrModalTab === 'qr' ? COLORS.white : 'transparent',
                  color: qrModalTab === 'qr' ? COLORS.charcoal : COLORS.stone,
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.2s',
                  boxShadow: qrModalTab === 'qr' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                QR Code Only
              </button>
              <button
                type="button"
                onClick={() => setQrModalTab('card')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: qrModalTab === 'card' ? COLORS.white : 'transparent',
                  color: qrModalTab === 'card' ? COLORS.charcoal : COLORS.stone,
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.2s',
                  boxShadow: qrModalTab === 'card' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Invitation Card
              </button>
            </div>

            {qrModalTab === 'qr' ? (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.charcoal, fontFamily: 'var(--font-serif)', margin: 0 }}>Event QR Code</h3>
                <p style={{ fontSize: 12, color: COLORS.stone, margin: '0 0 8px 0', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                  Scan this code to go directly to the RSVP page of your event
                </p>
                
                <QRCodeDisplay url={`${window.location.origin}/${activeEvent.slug}`} size={200} />
                
                <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 8 }}>
                  <button
                    onClick={async () => {
                      try {
                        const dataUrl = await QRCode.toDataURL(`${window.location.origin}/${activeEvent.slug}`, { width: 500 });
                        const res = await fetch(dataUrl);
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${activeEvent.slug}-qrcode.png`;
                        link.click();
                        window.URL.revokeObjectURL(url);
                      } catch (err) {
                        toast.error('Failed to download QR code. Please try again.');
                      }
                    }}
                    style={{ flex: 1, padding: '10px', background: COLORS.gold, color: COLORS.white, fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = COLORS.goldHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = COLORS.gold; }}
                  >
                    Download PNG
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const svgString = await QRCode.toString(`${window.location.origin}/${activeEvent.slug}`, { type: 'svg', width: 500 });
                        const blob = new Blob([svgString], { type: 'image/svg+xml' });
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${activeEvent.slug}-qrcode.svg`;
                        link.click();
                        window.URL.revokeObjectURL(url);
                      } catch (err) {
                        toast.error('Failed to download QR code. Please try again.');
                      }
                    }}
                    style={{ flex: 1, padding: '10px', background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.gold, fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = COLORS.softBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    Download SVG
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.charcoal, fontFamily: 'var(--font-serif)', margin: 0 }}>Printable Invitation</h3>
                <p style={{ fontSize: 12, color: COLORS.stone, margin: '0 0 8px 0', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                  Preview of your event&apos;s printable/downloadable invitation card
                </p>
                
                {/* Printable Card Preview */}
                <div style={{
                  width: '100%',
                  background: COLORS.white,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '320px',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    height: '110px',
                    backgroundImage: `url(${sanitizeCoverUrl(activeEvent.cover_image_url)})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    width: '100%'
                  }} />
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: COLORS.charcoal, fontFamily: 'var(--font-serif)', margin: 0 }}>
                      {activeEvent.title}
                    </h4>
                    <p style={{ fontSize: '11px', color: COLORS.stone, margin: 0, fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>
                      <strong>Date:</strong> {activeEvent.event_date ? new Date(activeEvent.event_date).toLocaleDateString() : 'N/A'}<br/>
                      <strong>Venue:</strong> {activeEvent.location_name || 'TBA'}
                    </p>
                    <div style={{ background: COLORS.softBg, border: `1px solid ${COLORS.border}`, padding: 8, borderRadius: 8, marginTop: 8 }}>
                      <QRCodeDisplay url={`${window.location.origin}/${activeEvent.slug}`} size={100} />
                    </div>
                    <span style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '2px', color: COLORS.gold, fontWeight: 700, marginTop: 4 }}>
                      Scan to RSVP
                    </span>
                  </div>
                </div>

                <div style={{ width: '100%', marginTop: 8 }}>
                  <button
                    onClick={async () => {
                      const printWindow = window.open('', '_blank');
                      const qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/${activeEvent.slug}`, { width: 300 });
                      const coverUrl = sanitizeCoverUrl(activeEvent.cover_image_url);
                      const dateFormatted = activeEvent.event_date ? new Date(activeEvent.event_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
                      const timeFormatted = activeEvent.event_date ? new Date(activeEvent.event_date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';

                      const safeTitle = escapeHtml(activeEvent.title);
                      const safeLocationName = escapeHtml(activeEvent.location_name) || 'TBA';
                      const safeLocationAddress = escapeHtml(activeEvent.location_address);
                      const safeDateFormatted = escapeHtml(dateFormatted);
                      const safeTimeFormatted = escapeHtml(timeFormatted);

                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Print Invitation Card - ${safeTitle}</title>
                            <style>
                              body {
                                font-family: sans-serif;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                min-height: 100vh;
                                margin: 0;
                                background-color: #fafafa;
                              }
                              .card {
                                width: 420px;
                                background: #ffffff;
                                border: 1px solid #e8e2d6;
                                border-radius: 16px;
                                overflow: hidden;
                                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                                text-align: center;
                                padding-bottom: 24px;
                              }
                              .cover {
                                width: 100%;
                                height: 200px;
                                background-image: url('${coverUrl}');
                                background-size: cover;
                                background-position: center;
                              }
                              .content {
                                padding: 24px;
                              }
                              .title {
                                font-family: serif;
                                font-size: 24px;
                                margin: 0 0 12px 0;
                                color: #191b1e;
                              }
                              .details {
                                font-size: 13px;
                                color: #77736a;
                                margin: 6px 0;
                                line-height: 1.5;
                              }
                              .qr-container {
                                margin: 20px 0;
                                display: inline-block;
                                padding: 12px;
                                background: #fafaf8;
                                border: 1px solid #e8e2d6;
                                border-radius: 12px;
                              }
                              .qr-image {
                                width: 150px;
                                height: 150px;
                                display: block;
                              }
                              .scan-text {
                                font-size: 11px;
                                text-transform: uppercase;
                                letter-spacing: 2px;
                                color: #b8944f;
                                font-weight: bold;
                                margin-top: 8px;
                              }
                              @media print {
                                body {
                                  background: none;
                                }
                                .card {
                                  box-shadow: none;
                                  border: none;
                                }
                              }
                            </style>
                          </head>
                          <body>
                            <div class="card">
                              <div class="cover"></div>
                              <div class="content">
                                <h1 class="title">${safeTitle}</h1>
                                <p class="details"><strong>Date:</strong> ${safeDateFormatted} at ${safeTimeFormatted}</p>
                                <p class="details"><strong>Venue:</strong> ${safeLocationName}</p>
                                <p class="details">${safeLocationAddress}</p>
                                <div class="qr-container">
                                  <img class="qr-image" src="${qrDataUrl}" alt="RSVP QR Code" />
                                </div>
                                <div class="scan-text">Scan to RSVP</div>
                              </div>
                            </div>
                            <script>
                              window.onload = function() {
                                window.print();
                              }
                            </script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }}
                    style={{ width: '100%', padding: '10px', background: COLORS.gold, color: COLORS.white, fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = COLORS.goldHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = COLORS.gold; }}
                  >
                    Print / Save as PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .dashboard-bottom-tabbar {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 55;
          background: ${COLORS.white};
          border-top: 1px solid ${COLORS.border};
          padding: 6px 4px max(6px, env(safe-area-inset-bottom));
          justify-content: space-around;
          align-items: stretch;
          box-shadow: 0 -4px 16px rgba(0,0,0,0.04);
        }
        .dashboard-bottom-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          flex: 1;
          min-height: 48px;
          padding: 4px;
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: 600;
        }
        @media (max-width: 1024px) {
          .sidebar-close { display: flex !important; }
          .sidebar-overlay { display: block !important; }
          .dashboard-sidebar { transform: ${sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'}; }
          main { margin-left: 0 !important; padding-bottom: calc(60px + env(safe-area-inset-bottom)) !important; }
          /* Was padding-left:72px to dodge the old floating hamburger; that button
             is gone, so the header title gets the full width back. */
          .top-bar { padding-left: 16px !important; padding-right: 16px !important; }
          .content-container { padding: 16px !important; }
          .dashboard-bottom-tabbar { display: flex !important; }
          .action-btn-divider { display: none !important; }
        }
        @media (max-width: 900px) {
          .seating-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={logout} />
    </div>
  );
}
