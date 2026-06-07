'use client';

import React, { useState, useEffect } from 'react';

export default function CheckInPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);
  
  // Simulated QR Token scanner state
  const [qrTokenInput, setQrTokenInput] = useState('');
  const [scanStatus, setScanStatus] = useState(null); 
  const [totalArrivals, setTotalArrivals] = useState(0);
  
  // Local list of checked-in guests
  const [checkInLogs, setCheckInLogs] = useState([]);

  const eventId = 'demo-event';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  // Fetch check-in dashboard counters
  const fetchCheckInSummary = async () => {
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/stats`);
      const data = await res.json();
      if (data.success) {
        setTotalArrivals(data.stats.checkedInGuests);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to connect to backend check-in:', err);
      setError('Could not connect to backend check-in server. Make sure port 5000 is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckInSummary();
  }, []);

  // Search autocomplete guest rows dynamically from backend
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delaySearch = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl}/events/${eventId}/checkin/search?query=${searchQuery}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.results);
        }
      } catch (err) {
        console.error('Failed search fetch query:', err);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Handle manual check-in submit
  const handleManualCheckIn = async (rsvpId) => {
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/checkin/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsvpId, checkedInBy: 'Tablet Front-Desk' })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Check-in failed');
      }

      if (data.success) {
        // Toggle selected guest UI card state
        setSelectedGuest(prev => prev ? { ...prev, isCheckedIn: true, checkedInAt: new Date().toLocaleTimeString() } : null);
        
        // Append log
        setCheckInLogs(logs => [
          {
            rsvpId,
            guestName: data.guestName,
            partySize: data.partySize,
            tableName: data.tableName,
            checkedInAt: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            method: 'manual_search'
          },
          ...logs
        ]);

        // Refresh stats
        fetchCheckInSummary();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle QR code validation simulation
  const handleQRScanSubmit = async (e) => {
    e.preventDefault();
    if (!qrTokenInput.trim()) return;

    try {
      // Direct post to checkin scan endpoint in backend
      const res = await fetch(`${apiUrl}/events/${eventId}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: qrTokenInput, checkedInBy: 'QR Scanner' })
      });

      const data = await res.json();

      if (!res.ok) {
        setScanStatus({ type: 'error', message: data.message || 'QR Ticket signature verification failed.' });
        return;
      }

      if (data.success) {
        setScanStatus({ 
          type: 'success', 
          message: `${data.guestName} (${data.partySize} guests) checked in successfully at ${data.tableName}.` 
        });

        // Append log
        setCheckInLogs(logs => [
          {
            rsvpId: data.checkInData.rsvp_id,
            guestName: data.guestName,
            partySize: data.partySize,
            tableName: data.tableName,
            checkedInAt: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            method: 'qr_scan'
          },
          ...logs
        ]);

        // Refresh stats
        fetchCheckInSummary();
        setQrTokenInput('');
      }
    } catch (err) {
      setScanStatus({ type: 'error', message: 'Could not connect to scanner backend service.' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Opening check-in kiosk...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
          <span className="text-4xl">🔌</span>
          <h2 className="text-xl font-bold mt-4 text-rose-500">Backend Connection Error</h2>
          <p className="text-slate-455 mt-2 text-sm leading-relaxed">{error}</p>
          <button 
            onClick={() => { setLoading(true); fetchCheckInSummary(); }} 
            className="mt-6 px-5 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs rounded-lg font-bold"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 selection:bg-slate-800">
      
      {/* ─── Header ─── */}
      <div className="max-w-7xl mx-auto border-b border-slate-900 pb-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fancy RSVP Front-Desk Check-In</h1>
          <p className="text-sm text-slate-400 mt-1">Tablet Mode — Gate 1 Desk Kiosk (Connected to API)</p>
        </div>
        <div className="mt-4 sm:mt-0 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-center">
          <span className="text-xs text-slate-400 block font-semibold">Total Checked-In</span>
          <span className="text-lg font-black text-amber-500">
            {totalArrivals} Arrivals
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Autocomplete Lookup Panel */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold">Guest Search & Check-In</h3>
            
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search guest name..."
                className="w-full bg-slate-950 border border-slate-855 rounded-xl px-4 py-3 text-base text-slate-200 focus:outline-none focus:border-amber-500"
              />
              
              {/* Autocomplete Dropdown list */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-20 max-h-[220px] overflow-y-auto">
                  {searchResults.map(guest => (
                    <div
                      key={guest.id}
                      onClick={() => { setSelectedGuest(guest); setSearchQuery(''); }}
                      className="px-4 py-3 hover:bg-slate-850/60 cursor-pointer flex justify-between items-center border-b border-slate-850/50"
                    >
                      <div>
                        <span className="font-semibold text-slate-200 block">{guest.guestName}</span>
                        <span className="text-xs text-slate-500">Party of {guest.partySize} • {guest.tableName}</span>
                      </div>
                      <div>
                        {guest.isCheckedIn ? (
                          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">Arrived</span>
                        ) : (
                          <span className="text-xs text-slate-400 bg-slate-850 px-2 py-0.5 rounded-full">Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Verification Display Panel */}
          {selectedGuest && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
              <div className="flex justify-between items-start border-b border-slate-850 pb-4">
                <div>
                  <h4 className="text-xl font-bold text-slate-100">{selectedGuest.guestName}</h4>
                  <span className="text-xs text-slate-500">{selectedGuest.response.toUpperCase()} RESPONSE</span>
                </div>
                <div>
                  {selectedGuest.isCheckedIn ? (
                    <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
                      ✅ Checked-In
                    </span>
                  ) : (
                    <span className="bg-slate-855 text-slate-400 px-3 py-1 rounded-full text-xs font-bold border border-slate-800">
                      ⏳ Pending Arrival
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl">
                  <span className="text-xs uppercase tracking-wider text-slate-500 block">Assigned Table</span>
                  <span className="text-xl font-bold mt-1 block text-slate-200">{selectedGuest.tableName}</span>
                </div>
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl">
                  <span className="text-xs uppercase tracking-wider text-slate-500 block">Total Party Size</span>
                  <span className="text-xl font-bold mt-1 block text-amber-500">{selectedGuest.partySize} people</span>
                </div>
              </div>

              {!selectedGuest.isCheckedIn && (
                <button
                  disabled={selectedGuest.tableName === 'Unassigned'}
                  onClick={() => handleManualCheckIn(selectedGuest.id)}
                  className="w-full py-4 bg-emerald-600 rounded-xl font-bold text-base hover:bg-emerald-500 transition disabled:opacity-50"
                >
                  Confirm Check-In ({selectedGuest.partySize} guests)
                </button>
              )}
            </div>
          )}

          {/* 3. QR code scanner simulation */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold">Simulate QR Scanner</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Paste or type the signed QR ticket token JWT below to verify the credential.
            </p>
            
            <form onSubmit={handleQRScanSubmit} className="flex gap-3">
              <input
                type="text"
                value={qrTokenInput}
                onChange={e => setQrTokenInput(e.target.value)}
                placeholder="Paste signed JWT token here..."
                className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <button 
                type="submit"
                className="bg-amber-600 px-6 rounded-xl text-sm font-semibold hover:bg-amber-500 transition"
              >
                Scan Ticket
              </button>
            </form>

            {scanStatus && (
              <div className={`p-4 rounded-xl border text-sm ${scanStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : scanStatus.type === 'already_checked_in' ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : 'bg-rose-500/10 border-rose-500/25 text-rose-400'}`}>
                {scanStatus.type === 'success' ? '🟢 Success: ' : scanStatus.type === 'already_checked_in' ? '🟡 Already Scanned: ' : '🔴 Failed: '}
                {scanStatus.message}
              </div>
            )}
          </div>

        </div>

        {/* Right Panel: Live Logs */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col h-[500px] overflow-hidden">
          <h3 className="text-lg font-bold border-b border-slate-800 pb-3">Arrivals Feed</h3>
          
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            {checkInLogs.length > 0 ? (
              checkInLogs.map((log, index) => (
                <div key={index} className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-slate-200 block text-sm">{log.guestName}</span>
                    <span className="text-xs text-slate-550">Party of {log.partySize} • {log.tableName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">{log.checkedInAt}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">{log.method.replace('_', ' ')}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-600 text-center py-20">No arrivals logged in this kiosk session yet.</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
