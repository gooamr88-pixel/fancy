'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

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

  // Confirmation Overlay states
  const [showConfirmOverlay, setShowConfirmOverlay] = useState(false);
  const [overlayData, setOverlayData] = useState(null);

  // Auto-dismiss confirmation overlay
  useEffect(() => {
    if (showConfirmOverlay) {
      const timer = setTimeout(() => {
        setShowConfirmOverlay(false);
      }, 3200);
      return () => clearTimeout(timer);
    }
  }, [showConfirmOverlay]);

  // Auth & dynamic event switcher state
  const [token, setToken] = useState('');
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('org_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('active_event_id');
    window.location.href = '/login';
  };

  // Auth gate check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('auth_token');
      const savedEventId = localStorage.getItem('active_event_id');
      if (!savedToken) {
        router.push('/login');
        return;
      }
      setToken(savedToken);
      if (savedEventId) {
        setEventId(savedEventId);
      }
    }
  }, [router]);

  // Load available events
  useEffect(() => {
    if (!token) return;

    const fetchEvents = async () => {
      try {
        const res = await fetch(`${API_URL}/events`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.events.length > 0) {
          setEvents(data.events);
          if (!eventId) {
            setEventId(data.events[0].id);
          }
        } else {
          if (!eventId) {
            setEventId('demo-event');
          }
        }
      } catch (err) {
        console.error('Failed to load events:', err);
        if (!eventId) {
          setEventId('demo-event');
        }
      }
    };

    fetchEvents();
  }, [token, eventId]);

  // Fetch check-in dashboard counters
  const fetchCheckInSummary = useCallback(async () => {
    if (!eventId) return;
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${API_URL}/events/${eventId}/stats`, { headers });
      const data = await res.json();
      if (data.success) {
        setTotalArrivals(data.stats.checkedInGuests);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to connect to backend check-in:', err);
      setError('Could not connect to backend check-in server. Make sure port 5000 is running.');
    } finally {
      setLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => {
    if (eventId) {
      fetchCheckInSummary();
    }
  }, [fetchCheckInSummary, eventId]);

  // Search autocomplete guest rows dynamically from backend
  useEffect(() => {
    if (!eventId) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delaySearch = setTimeout(async () => {
      try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${API_URL}/events/${eventId}/checkin/search?query=${searchQuery}`, { headers });
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.results);
        }
      } catch (err) {
        console.error('Failed search fetch query:', err);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery, eventId, token]);

  // Handle manual check-in submit
  const handleManualCheckIn = async (rsvpId) => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      const res = await fetch(`${API_URL}/events/${eventId}/checkin/manual`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rsvpId, checkedInBy: 'Tablet Front-Desk' })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Check-in failed');
      }

      if (data.success) {
        setSelectedGuest(prev => prev ? { ...prev, isCheckedIn: true, checkedInAt: new Date().toLocaleTimeString() } : null);
        
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

        fetchCheckInSummary();

        // Trigger gorgeous confirmation overlay!
        setOverlayData({
          type: 'success',
          guestName: data.guestName,
          partySize: data.partySize,
          tableName: data.tableName,
          message: 'Guest arrival verified. Welcome to the event!'
        });
        setShowConfirmOverlay(true);
      }
    } catch (err) {
      setOverlayData({
        type: 'error',
        message: err.message
      });
      setShowConfirmOverlay(true);
    }
  };

  // Scanned QR code ticket processing
  const handleQRScan = useCallback(async (scannedToken) => {
    if (!scannedToken) return;

    try {
      const headers = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      const res = await fetch(`${API_URL}/events/${eventId}/checkin/scan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: scannedToken, checkedInBy: 'Kiosk Camera' })
      });

      const data = await res.json();

      if (!res.ok) {
        setScanStatus({ type: 'error', message: data.message || 'QR Ticket signature verification failed.' });
        setOverlayData({
          type: 'error',
          message: data.message || 'QR Ticket signature verification failed.'
        });
        setShowConfirmOverlay(true);
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

        // Trigger gorgeous confirmation overlay!
        setOverlayData({
          type: 'success',
          guestName: data.guestName,
          partySize: data.partySize,
          tableName: data.tableName,
          message: 'QR Ticket credentials verified successfully!'
        });
        setShowConfirmOverlay(true);
      }
    } catch (err) {
      setScanStatus({ type: 'error', message: 'Could not connect to scanner backend service.' });
      setOverlayData({
        type: 'error',
        message: 'Could not connect to scanner backend service.'
      });
      setShowConfirmOverlay(true);
    }
  }, [eventId, token, fetchCheckInSummary]);

  // Handle QR code validation simulation
  const handleQRScanSubmit = async (e) => {
    e.preventDefault();
    if (!qrTokenInput.trim()) return;
    await handleQRScan(qrTokenInput);
    setQrTokenInput('');
  };

  // Setup/Tear-down html5-qrcode camera scanner client-side
  useEffect(() => {
    let html5QrcodeScanner;
    
    if (cameraActive) {
      import('html5-qrcode').then((module) => {
        const Html5QrcodeScanner = module.Html5QrcodeScanner;
        
        html5QrcodeScanner = new Html5QrcodeScanner(
          "qr-reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true
          },
          /* verbose= */ false
        );
        
        html5QrcodeScanner.render(
          async (decodedText) => {
            await handleQRScan(decodedText);
            // Stop scanning on success
            setCameraActive(false);
          },
          () => {
            // Quietly ignore scanner frame mismatch errors
          }
        );
      }).catch(err => {
        console.error("Failed to load html5-qrcode:", err);
      });
    }

    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(err => console.error("Failed to clear scanner:", err));
      }
    };
  }, [cameraActive, handleQRScan]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 animate-pulse">
        <div className="max-w-7xl mx-auto border-b border-slate-900 pb-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="h-6 w-32 bg-slate-800 rounded mb-2"></div>
            <div className="h-8 w-64 bg-slate-800 rounded"></div>
          </div>
          <div className="h-16 w-32 bg-slate-800 rounded mt-4 sm:mt-0"></div>
        </div>
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-32 bg-slate-900 border border-slate-800 rounded-2xl"></div>
            <div className="h-48 bg-slate-900 border border-slate-800 rounded-2xl"></div>
          </div>
          <div className="h-96 bg-slate-900 border border-slate-800 rounded-2xl"></div>
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
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard" className="text-xs font-semibold text-amber-500 hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Fancy RSVP Front-Desk Check-In</h1>
          <p className="text-sm text-slate-400 mt-1">Tablet Mode — Gate 1 Desk Kiosk (Connected to API)</p>
          {events.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Event:</span>
              <select
                value={eventId}
                onChange={e => setEventId(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-center">
            <span className="text-xs text-slate-400 block font-semibold">Total Checked-In</span>
            <span className="text-lg font-black text-amber-500">
              {totalArrivals} Arrivals
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
            title="Sign out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
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
                      className="px-4 py-3 hover:bg-slate-850/60 cursor-pointer flex justify-between items-center border-b border-slate-850/50 bg-slate-900"
                    >
                      <div>
                        <span className="font-semibold text-slate-200 block">{guest.guestName}</span>
                        <span className="text-xs text-slate-500">Party of {guest.partySize} • {guest.tableName}</span>
                      </div>
                      <div>
                        {guest.isCheckedIn ? (
                          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">Arrived</span>
                        ) : (
                          <span className="text-xs text-slate-400 bg-slate-855 px-2 py-0.5 rounded-full">Pending</span>
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
                  className="w-full py-4 bg-emerald-600 rounded-xl font-bold text-base hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer"
                >
                  Confirm Check-In ({selectedGuest.partySize} guests)
                </button>
              )}
            </div>
          )}

          {/* 3. Camera QR Code Scanner */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold">QR Ticket Validation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Verify credentials using device camera scanning or token string submission below.
            </p>
            
            <div className="flex flex-col gap-4">
              <button 
                type="button"
                onClick={() => setCameraActive(!cameraActive)}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${cameraActive ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
              >
                {cameraActive ? (
                  <span>🛑 Stop Camera Scanner</span>
                ) : (
                  <span>📷 Open Camera Scanner</span>
                )}
              </button>

              {cameraActive && (
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl shadow-inner flex justify-center">
                  <div id="qr-reader" className="w-full max-w-sm rounded-lg overflow-hidden"></div>
                </div>
              )}
            </div>
            
            <form onSubmit={handleQRScanSubmit} className="flex gap-3 pt-2">
              <input
                type="text"
                value={qrTokenInput}
                onChange={e => setQrTokenInput(e.target.value)}
                placeholder="Or paste signed JWT token here..."
                className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <button 
                type="submit"
                className="bg-amber-600 px-6 rounded-xl text-sm font-semibold hover:bg-amber-500 transition cursor-pointer"
              >
                Verify
              </button>
            </form>

            {scanStatus && (
              <div className={`p-4 rounded-xl border text-sm ${scanStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-rose-500/10 border-rose-500/25 text-rose-400'}`}>
                {scanStatus.type === 'success' ? '🟢 Success: ' : '🔴 Failed: '}
                {scanStatus.message}
              </div>
            )}
          </div>

        </div>

        {/* Right Panel: Live Logs */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col h-[500px] overflow-hidden">
          <h3 className="text-lg font-bold border-b border-slate-800 pb-3">Arrivals Feed</h3>
          
          <div className="space-y-3 overflow-y-auto flex-1 pr-1 mt-3">
            {checkInLogs.length > 0 ? (
              checkInLogs.map((log, index) => (
                <div key={index} className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex justify-between items-center bg-slate-950">
                  <div>
                    <span className="font-semibold text-slate-200 block text-sm">{log.guestName}</span>
                    <span className="text-xs text-slate-500">Party of {log.partySize} • {log.tableName}</span>
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

      {/* ─── Kiosk Check-In Confirmation Overlay ─── */}
      {showConfirmOverlay && overlayData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center gap-6 overflow-hidden">
            
            {overlayData.type === 'success' ? (
              <>
                {/* Glowing Green Success Ring */}
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-brand-green animate-ring-pulse">
                  <svg className="w-10 h-10 animate-draw-check" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] tracking-[0.2em] uppercase text-emerald-400 font-extrabold block">Verification Success</span>
                  <h3 className="text-2xl font-black text-slate-100">{overlayData.guestName}</h3>
                  <p className="text-slate-400 text-sm font-medium">{overlayData.message}</p>
                </div>

                {/* Details layout */}
                <div className="w-full grid grid-cols-2 gap-4 border-t border-b border-slate-800/60 py-4 my-2">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                    <span className="text-[9px] uppercase tracking-wider text-slate-550 block font-bold">Party Size</span>
                    <span className="text-lg font-bold text-amber-500 mt-1 block">{overlayData.partySize} Guests</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                    <span className="text-[9px] uppercase tracking-wider text-slate-550 block font-bold">Assigned Seat</span>
                    <span className="text-lg font-bold text-slate-200 mt-1 block">{overlayData.tableName}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Glowing Red Error Ring */}
                <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] tracking-[0.2em] uppercase text-rose-500 font-extrabold block">Verification Failure</span>
                  <h3 className="text-xl font-bold text-rose-500">Access Denied</h3>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-xs">{overlayData.message}</p>
                </div>
              </>
            )}

            {/* Tap to close prompt */}
            <button 
              onClick={() => setShowConfirmOverlay(false)}
              className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-350 font-bold transition cursor-pointer"
            >
              Tap to close screen
            </button>

            {/* Shrinking bottom progress timer bar */}
            {overlayData.type === 'success' && (
              <div className="absolute bottom-0 left-0 h-1.5 bg-emerald-500 animate-progress-shrink" />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
