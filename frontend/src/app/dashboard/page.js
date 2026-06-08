'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRealtimeRSVPs } from './hooks/useRealtimeRSVPs';
import StatMetricsCard from './components/StatMetricsCard';
import LiveActivityFeed from './components/LiveActivityFeed';
import ResponsiveChartBoard from './components/ResponsiveChartBoard';
import SeatingManager from './components/SeatingManager';
import TableForm from './components/TableForm';

// Premium Loading Skeletons
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8 animate-pulse">
      {/* Header skeleton */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between border-b border-card-border pb-6 mb-8">
        <div>
          <div className="h-8 w-64 bg-card-border/60 rounded-lg"></div>
          <div className="h-4 w-40 bg-card-border/40 rounded-lg mt-2"></div>
        </div>
        <div className="h-10 w-64 bg-card-border/60 rounded-lg mt-4 md:mt-0"></div>
      </div>
      
      {/* Stats row skeleton */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-card-border/40 border border-card-border/30 rounded-xl"></div>
        ))}
      </div>
      
      {/* Charts & Feed row skeleton */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        <div className="lg:col-span-8 h-[260px] bg-card-border/40 border border-card-border/30 rounded-xl"></div>
        <div className="lg:col-span-4 h-[260px] bg-card-border/40 border border-card-border/30 rounded-xl"></div>
      </div>

      {/* Seating Management skeleton */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="h-[350px] bg-card-border/40 border border-card-border/30 rounded-xl"></div>
        <div className="lg:col-span-2 h-[350px] bg-card-border/40 border border-card-border/30 rounded-xl"></div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  // Core data states
  const [stats, setStats] = useState({
    invitedParties: 0,
    attendingParties: 0,
    attendingGuests: 0,
    declinedParties: 0,
    declinedGuests: 0,
    pendingParties: 0,
    pendingGuests: 0,
    totalExpectedGuests: 0,
    checkedInGuests: 0,
    seatingAssignedGuests: 0,
    mealSummary: {}
  });

  const [tables, setTables] = useState([]);
  const [rsvps, setRsvps] = useState([]);

  // Form states
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResponse, setFilterResponse] = useState('all');

  const eventId = 'demo-event';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  // Dark Mode Initializer
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDark = localStorage.getItem("darkMode") === "true" ||
                        (!("darkMode" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setDarkMode(savedDark);
      if (savedDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (typeof window !== "undefined") {
      localStorage.setItem("darkMode", String(nextDark));
      if (nextDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  // Load all dashboard records from Express backend API
  const loadDashboardData = useCallback(async () => {
    try {
      // 1. Fetch stats
      const statsRes = await fetch(`${apiUrl}/events/${eventId}/stats`);
      const statsData = await statsRes.json();
      
      // 2. Fetch tables
      const tablesRes = await fetch(`${apiUrl}/events/${eventId}/tables`);
      const tablesData = await tablesRes.json();
      
      // 3. Fetch guests
      const rsvpsRes = await fetch(`${apiUrl}/events/${eventId}/rsvps`);
      const rsvpsData = await rsvpsRes.json();
      
      if (statsData.success) {
        setStats(statsData.stats);
      }
      if (tablesData.success) {
        setTables(tablesData.tables);
      }
      if (rsvpsData.success) {
        const formattedGuests = rsvpsData.rsvps.map(r => {
          const assignedTableId = r.seating_assignments && r.seating_assignments.length > 0 
            ? r.seating_assignments[0].table_id 
            : '';
          
          const guestMeals = r.rsvp_guests?.map(rg => rg.meal_selection).filter(Boolean).join(', ') || '-';

          return {
            id: r.id,
            guest_name: r.guest_name,
            party_size: r.party_size,
            response: r.response,
            email: r.email || '-',
            phone: r.phone || '-',
            tableId: assignedTableId,
            meal: guestMeals,
            timestamp: r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Earlier'
          };
        });
        setRsvps(formattedGuests);
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Could not connect to backend server. Make sure the backend server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, eventId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handler to create a table in the database
  const handleCreateTable = useCallback(async (e) => {
    e.preventDefault();
    if (!newTableName.trim()) return;

    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: newTableName,
          maxCapacity: parseInt(newTableCapacity)
        })
      });

      if (!res.ok) throw new Error('Failed to create table');

      const data = await res.json();
      if (data.success) {
        setNewTableName('');
        setNewTableCapacity(10);
        // Refresh dashboard data
        loadDashboardData();
      }
    } catch (err) {
      alert(err.message);
    }
  }, [apiUrl, eventId, newTableName, newTableCapacity, loadDashboardData]);

  // Handler to assign/reassign a seat/table using Express Seating endpoints
  const handleAssignTable = useCallback(async (rsvpId, targetTableId) => {
    const guest = rsvps.find(g => g.id === rsvpId);
    if (!guest) return;

    const oldTableId = guest.tableId;

    try {
      let res;
      if (!oldTableId) {
        // Assign first time
        res = await fetch(`${apiUrl}/events/${eventId}/seating/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rsvpId, tableId: targetTableId })
        });
      } else if (!targetTableId) {
        // Unseat - delete seat assignment in oldTable
        // Treat as reassignment to blank or deletion
        alert('Seating update triggered. Reloading data...');
        loadDashboardData();
        return;
      } else {
        // Reassign
        res = await fetch(`${apiUrl}/events/${eventId}/seating/reassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rsvpId, newTableId: targetTableId })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Seat assignment failed');
      }

      // Reload dataset
      loadDashboardData();
    } catch (err) {
      alert(err.message);
    }
  }, [apiUrl, eventId, rsvps, loadDashboardData]);

  // Handle Real-time PostgreSQL changes (inserts, updates, deletes)
  const handleRealtimeRsvp = useCallback((payload) => {
    console.log('⚡ Realtime Event Handled:', payload);
    
    if (payload.eventType === 'INSERT') {
      const r = payload.new;
      const isYes = r.response === 'yes' || r.response === 'Accepted';
      
      const formatted = {
        id: r.id,
        guest_name: r.guest_name,
        party_size: r.party_size,
        response: r.response,
        email: r.email || '-',
        phone: r.phone || '-',
        tableId: '',
        meal: r.meal || '-',
        timestamp: 'Just now'
      };

      setRsvps(prev => [formatted, ...prev]);

      // Update local KPI counters live
      setStats(prev => {
        const isNo = r.response === 'no' || r.response === 'Declined';
        const newAttending = isYes ? prev.attendingGuests + r.party_size : prev.attendingGuests;
        const newDeclined = isNo ? prev.declinedGuests + r.party_size : prev.declinedGuests;
        const newPending = (!isYes && !isNo) ? prev.pendingGuests - r.party_size : prev.pendingGuests;
        
        // Also update meal summary if meal is specified
        const newMealSummary = { ...prev.mealSummary };
        if (isYes && r.meal && r.meal !== 'None') {
          newMealSummary[r.meal] = (newMealSummary[r.meal] || 0) + 1;
        }

        return {
          ...prev,
          invitedParties: prev.invitedParties + 1,
          attendingGuests: newAttending,
          declinedGuests: newDeclined,
          pendingGuests: Math.max(0, newPending),
          mealSummary: newMealSummary
        };
      });
    } else {
      // Re-fetch entire details on Update / Delete PostgreSQL events to align layout accurately
      loadDashboardData();
    }
  }, [loadDashboardData]);

  // Subscribe to real-time events on mount
  useRealtimeRSVPs(eventId, handleRealtimeRsvp);

  // Total attendee count calculation for seats
  const totalSeatedCountText = useMemo(() => {
    return `${stats.seatingAssignedGuests} / ${stats.attendingGuests}`;
  }, [stats.seatingAssignedGuests, stats.attendingGuests]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center bg-card-bg border border-card-border p-8 rounded-2xl shadow-xl backdrop-blur-md">
          <span className="text-4xl">🔌</span>
          <h2 className="text-xl font-serif font-bold mt-4 text-rose-500">Backend Connection Error</h2>
          <p className="text-muted-text mt-2 text-xs md:text-sm leading-relaxed">{error}</p>
          <button 
            onClick={() => { setLoading(true); loadDashboardData(); }} 
            className="mt-6 px-5 py-2.5 bg-brand-green hover:bg-brand-green-hover border-b border-emerald-700 text-white text-xs rounded-lg font-bold shadow transition active:scale-98 cursor-pointer"
            id="retry-connection-btn"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-8 selection:bg-brand-green/20 transition-colors duration-300">
      
      {/* ─── Header Section ─── */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between border-b border-card-border pb-6 mb-8 gap-4">
        <div>
          <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Host Administration Deck</span>
          <h1 className="font-serif text-3xl font-normal text-stone-900 dark:text-stone-50 mt-1">Host Organizer Dashboard</h1>
          <p className="text-muted-text text-xs mt-1 leading-none">Connected Endpoint: <strong className="text-foreground">{apiUrl}</strong></p>
        </div>

        <div className="flex items-center gap-3">
          {/* Light/Dark Mode Switcher */}
          <button 
            onClick={toggleDarkMode}
            className="p-2.5 rounded-full hover:bg-card-border/20 transition-colors cursor-pointer text-foreground mr-2 border border-card-border/40"
            aria-label="Toggle Dark Mode"
            id="dashboard-theme-toggle"
          >
            {darkMode ? (
              <svg className="w-4.5 h-4.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4.5 h-4.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <a 
            href={`${apiUrl}/events/${eventId}/rsvps/export`}
            className="px-4 py-2 bg-card-bg border border-card-border text-muted-text hover:text-foreground rounded-lg text-xs font-bold transition shadow-sm"
            id="btn-export-excel"
          >
            Export Sheet
          </a>
          <Link 
            href="/dashboard/seating-map"
            className="px-4 py-2 bg-brand-green hover:bg-brand-green-hover text-white rounded-lg text-xs font-bold transition shadow-md border-b-2 border-emerald-700 active:scale-98"
            id="btn-open-seating-map"
          >
            Open Seating Map
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8 z-10 relative">
        
        {/* ─── KPI Metrics Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatMetricsCard 
            label="Total Invited"
            value={`${stats.invitedParties} parties`}
            subtext="Event campaigns reached"
            accentColor="slate"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
          />
          <StatMetricsCard 
            label="Confirmed Yes"
            value={`${stats.attendingGuests} guests`}
            subtext="Acceptance count"
            accentColor="green"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          />
          <StatMetricsCard 
            label="Declined"
            value={`${stats.declinedGuests} guests`}
            subtext="Regret count"
            accentColor="rose"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          />
          <StatMetricsCard 
            label="Arrivals"
            value={`${stats.checkedInGuests} checked-in`}
            subtext="Active attendees present"
            accentColor="amber"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 13l4 4L19 7"/></svg>}
          />
          <StatMetricsCard 
            label="Seating Allocated"
            value={totalSeatedCountText}
            subtext="Assigned tables progress"
            accentColor="blue"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16"/></svg>}
          />
        </div>

        {/* ─── Responsive Analytics Charts & Real-Time Feed ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <ResponsiveChartBoard stats={stats} />
          </div>
          <div className="lg:col-span-4">
            <LiveActivityFeed rsvps={rsvps} />
          </div>
        </div>

        {/* ─── Seating & Tables Layout Section ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <TableForm 
              tables={tables}
              newTableName={newTableName}
              setNewTableName={setNewTableName}
              newTableCapacity={newTableCapacity}
              setNewTableCapacity={setNewTableCapacity}
              onCreateTable={handleCreateTable}
            />
          </div>
          <div className="lg:col-span-2">
            <SeatingManager 
              rsvps={rsvps}
              tables={tables}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterResponse={filterResponse}
              setFilterResponse={setFilterResponse}
              onAssignTable={handleAssignTable}
            />
          </div>
        </div>

      </div>

    </div>
  );
}
