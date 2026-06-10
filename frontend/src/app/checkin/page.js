'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const C = { gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC', champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF' };
const inputStyle = { width: '100%', boxSizing: 'border-box', background: C.white, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 16px', fontSize: '14px', color: C.charcoal, outline: 'none', fontFamily: 'var(--font-sans)', transition: 'border-color 0.25s ease' };

export default function CheckInPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [qrTokenInput, setQrTokenInput] = useState('');
  const [scanStatus, setScanStatus] = useState(null);
  const [totalArrivals, setTotalArrivals] = useState(0);
  const [checkInLogs, setCheckInLogs] = useState([]);
  const [showConfirmOverlay, setShowConfirmOverlay] = useState(false);
  const [overlayData, setOverlayData] = useState(null);
  const [token, setToken] = useState('');
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const router = useRouter();

  useEffect(() => { if (showConfirmOverlay) { const timer = setTimeout(() => setShowConfirmOverlay(false), 3200); return () => clearTimeout(timer); } }, [showConfirmOverlay]);

  const handleLogout = () => { localStorage.removeItem('auth_token'); localStorage.removeItem('org_id'); localStorage.removeItem('user_role'); localStorage.removeItem('active_event_id'); window.location.href = '/login'; };

  useEffect(() => { if (typeof window !== 'undefined') { const savedToken = localStorage.getItem('auth_token'); const savedEventId = localStorage.getItem('active_event_id'); if (!savedToken) { router.push('/login'); return; } setToken(savedToken); if (savedEventId) setEventId(savedEventId); } }, [router]);

  useEffect(() => { if (!token) return; const fetchEvents = async () => { try { const res = await fetch(`${API_URL}/events`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success && data.events.length > 0) { setEvents(data.events); if (!eventId) setEventId(data.events[0].id); } else { if (!eventId) setEventId('demo-event'); } } catch (err) { console.error('Failed to load events:', err); if (!eventId) setEventId('demo-event'); } }; fetchEvents(); }, [token, eventId]);

  const fetchCheckInSummary = useCallback(async () => {
    if (!eventId) return;
    try { const headers = token ? { 'Authorization': `Bearer ${token}` } : {}; const res = await fetch(`${API_URL}/events/${eventId}/stats`, { headers }); const data = await res.json(); if (data.success) { setTotalArrivals(data.stats.checkedInGuests); setError(null); } }
    catch (err) { console.error('Failed to connect to backend check-in:', err); setError('Could not connect to backend check-in server. Make sure port 5000 is running.'); }
    finally { setLoading(false); }
  }, [eventId, token]);

  useEffect(() => { if (eventId) fetchCheckInSummary(); }, [fetchCheckInSummary, eventId]);

  useEffect(() => { if (!eventId) return; if (!searchQuery.trim()) { setSearchResults([]); return; } const delaySearch = setTimeout(async () => { try { const headers = token ? { 'Authorization': `Bearer ${token}` } : {}; const res = await fetch(`${API_URL}/events/${eventId}/checkin/search?query=${searchQuery}`, { headers }); const data = await res.json(); if (data.success) setSearchResults(data.results); } catch (err) { console.error('Failed search fetch query:', err); } }, 300); return () => clearTimeout(delaySearch); }, [searchQuery, eventId, token]);

  const handleManualCheckIn = async (rsvpId) => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      const res = await fetch(`${API_URL}/events/${eventId}/checkin/manual`, { method: 'POST', headers, body: JSON.stringify({ rsvpId, checkedInBy: 'Tablet Front-Desk' }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Check-in failed');
      if (data.success) {
        setSelectedGuest(prev => prev ? { ...prev, isCheckedIn: true, checkedInAt: new Date().toLocaleTimeString() } : null);
        setCheckInLogs(logs => [{ rsvpId, guestName: data.guestName, partySize: data.partySize, tableName: data.tableName, checkedInAt: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }), method: 'manual_search' }, ...logs]);
        fetchCheckInSummary();
        setOverlayData({ type: 'success', guestName: data.guestName, partySize: data.partySize, tableName: data.tableName, message: 'Guest arrival verified. Welcome to the event!' });
        setShowConfirmOverlay(true);
      }
    } catch (err) { setOverlayData({ type: 'error', message: err.message }); setShowConfirmOverlay(true); }
  };

  const handleQRScan = useCallback(async (scannedToken) => {
    if (!scannedToken) return;
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      const res = await fetch(`${API_URL}/events/${eventId}/checkin/scan`, { method: 'POST', headers, body: JSON.stringify({ token: scannedToken, checkedInBy: 'Kiosk Camera' }) });
      const data = await res.json();
      if (!res.ok) { setScanStatus({ type: 'error', message: data.message || 'QR Ticket signature verification failed.' }); setOverlayData({ type: 'error', message: data.message || 'QR Ticket signature verification failed.' }); setShowConfirmOverlay(true); return; }
      if (data.success) {
        setScanStatus({ type: 'success', message: `${data.guestName} (${data.partySize} guests) checked in successfully at ${data.tableName}.` });
        setCheckInLogs(logs => [{ rsvpId: data.checkInData.rsvp_id, guestName: data.guestName, partySize: data.partySize, tableName: data.tableName, checkedInAt: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }), method: 'qr_scan' }, ...logs]);
        fetchCheckInSummary();
        setOverlayData({ type: 'success', guestName: data.guestName, partySize: data.partySize, tableName: data.tableName, message: 'QR Ticket credentials verified successfully!' });
        setShowConfirmOverlay(true);
      }
    } catch (err) { setScanStatus({ type: 'error', message: 'Could not connect to scanner backend service.' }); setOverlayData({ type: 'error', message: 'Could not connect to scanner backend service.' }); setShowConfirmOverlay(true); }
  }, [eventId, token, fetchCheckInSummary]);

  const handleQRScanSubmit = async (e) => { e.preventDefault(); if (!qrTokenInput.trim()) return; await handleQRScan(qrTokenInput); setQrTokenInput(''); };

  useEffect(() => { let html5QrcodeScanner; if (cameraActive) { import('html5-qrcode').then((module) => { const Html5QrcodeScanner = module.Html5QrcodeScanner; html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true }, false); html5QrcodeScanner.render(async (decodedText) => { await handleQRScan(decodedText); setCameraActive(false); }, () => {}); }).catch(err => console.error("Failed to load html5-qrcode:", err)); } return () => { if (html5QrcodeScanner) html5QrcodeScanner.clear().catch(err => console.error("Failed to clear scanner:", err)); }; }, [cameraActive, handleQRScan]);

  const cardStyle = { background: C.white, border: `1px solid ${C.border}`, padding: '24px', borderRadius: '12px' };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: `3px solid ${C.border}`, borderTop: `3px solid ${C.gold}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: C.stone, fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 300 }}>Loading check-in console...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', background: C.white, border: `1px solid ${C.border}`, padding: '48px 32px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: '48px' }}>🔌</span>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: '#C45E5E', marginTop: '12px' }}>Backend Connection Error</h2>
          <p style={{ color: C.stone, marginTop: '12px', fontSize: '13px', lineHeight: 1.7, fontWeight: 300 }}>{error}</p>
          <button onClick={() => { setLoading(true); fetchCheckInSummary(); }} style={{ marginTop: '24px', padding: '12px 24px', background: C.gold, color: C.white, border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Retry Connection</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', color: C.charcoal, padding: '32px', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', borderBottom: `1px solid ${C.border}`, paddingBottom: '24px', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: '13px', fontWeight: 600, color: C.gold, textDecoration: 'none' }}>← Back to Dashboard</Link>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 500, color: C.charcoal, marginTop: '4px' }}>Fancy RSVP Front-Desk Check-In</h1>
          <p style={{ fontSize: '12px', color: C.stone, marginTop: '4px' }}>Tablet Mode — Gate 1 Desk Kiosk (Connected to API)</p>
          {events.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active Event:</span>
              <select value={eventId} onChange={e => setEventId(e.target.value)}
                style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: C.charcoal, cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)' }}>
                {events.map(ev => (<option key={ev.id} value={ev.id}>{ev.title}</option>))}
              </select>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ ...cardStyle, padding: '12px 20px', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', color: C.stone, display: 'block', fontWeight: 600 }}>Total Checked-In</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: C.gold }}>{totalArrivals} Arrivals</span>
          </div>
          <button onClick={handleLogout} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer', color: C.stone, fontSize: '13px', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '6px' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFF1F2'; e.currentTarget.style.color = '#C45E5E'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.stone; }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Guest Search */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 500 }}>Guest Search & Check-In</h3>
            <div style={{ position: 'relative' }}>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search guest name..."
                style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
              {searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: C.white, border: `1px solid ${C.border}`, borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', overflow: 'hidden', zIndex: 20, maxHeight: '220px', overflowY: 'auto' }}>
                  {searchResults.map(guest => (
                    <div key={guest.id} onClick={() => { setSelectedGuest(guest); setSearchQuery(''); }}
                      style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.ivory}`, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.ivory} onMouseLeave={e => e.currentTarget.style.background = C.white}>
                      <div>
                        <span style={{ fontWeight: 600, color: C.charcoal, display: 'block', fontSize: '14px' }}>{guest.guestName}</span>
                        <span style={{ fontSize: '11px', color: C.stone }}>Party of {guest.partySize} • {guest.tableName}</span>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', background: guest.isCheckedIn ? 'rgba(184,148,79,0.1)' : C.ivory, color: guest.isCheckedIn ? C.gold : C.stone }}>
                        {guest.isCheckedIn ? 'Arrived' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Guest Detail */}
          {selectedGuest && (
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${C.border}`, paddingBottom: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '20px', fontWeight: 700, color: C.charcoal }}>{selectedGuest.guestName}</h4>
                  <span style={{ fontSize: '11px', color: C.stone }}>{selectedGuest.response.toUpperCase()} RESPONSE</span>
                </div>
                <span style={{ padding: '4px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: selectedGuest.isCheckedIn ? 'rgba(184,148,79,0.1)' : C.ivory, color: selectedGuest.isCheckedIn ? C.gold : C.stone, border: `1px solid ${selectedGuest.isCheckedIn ? 'rgba(184,148,79,0.2)' : C.border}` }}>
                  {selectedGuest.isCheckedIn ? '✅ Checked-In' : '⏳ Pending Arrival'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: C.ivory, padding: '16px', border: `1px solid ${C.border}`, borderRadius: '10px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, display: 'block', fontWeight: 700 }}>Assigned Table</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px', display: 'block', color: C.charcoal }}>{selectedGuest.tableName}</span>
                </div>
                <div style={{ background: C.ivory, padding: '16px', border: `1px solid ${C.border}`, borderRadius: '10px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, display: 'block', fontWeight: 700 }}>Total Party Size</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px', display: 'block', color: C.gold }}>{selectedGuest.partySize} people</span>
                </div>
              </div>
              {!selectedGuest.isCheckedIn && (
                <button disabled={selectedGuest.tableName === 'Unassigned'} onClick={() => handleManualCheckIn(selectedGuest.id)}
                  style={{ width: '100%', padding: '16px', background: C.gold, borderRadius: '10px', fontWeight: 700, fontSize: '15px', border: 'none', cursor: 'pointer', color: C.white, fontFamily: 'var(--font-sans)', opacity: selectedGuest.tableName === 'Unassigned' ? 0.5 : 1, transition: 'all 0.3s' }}
                  onMouseEnter={e => { if (selectedGuest.tableName !== 'Unassigned') e.target.style.background = C.goldHover; }}
                  onMouseLeave={e => e.target.style.background = C.gold}>
                  Confirm Check-In ({selectedGuest.partySize} guests)
                </button>
              )}
            </div>
          )}

          {/* QR Scanner */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 500 }}>QR Ticket Validation</h3>
            <p style={{ fontSize: '12px', color: C.stone, lineHeight: 1.6 }}>Verify credentials using device camera scanning or token string submission below.</p>
            <button type="button" onClick={() => setCameraActive(!cameraActive)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: cameraActive ? '#C45E5E' : C.gold, color: C.white, transition: 'all 0.3s' }}>
              {cameraActive ? '🛑 Stop Camera Scanner' : '📷 Open Camera Scanner'}
            </button>
            {cameraActive && (
              <div style={{ background: C.ivory, padding: '16px', border: `1px solid ${C.border}`, borderRadius: '10px', display: 'flex', justifyContent: 'center' }}>
                <div id="qr-reader" style={{ width: '100%', maxWidth: '360px', borderRadius: '8px', overflow: 'hidden' }} />
              </div>
            )}
            <form onSubmit={handleQRScanSubmit} style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
              <input type="text" value={qrTokenInput} onChange={e => setQrTokenInput(e.target.value)} placeholder="Or paste signed JWT token here..."
                style={{ ...inputStyle, flex: 1 }} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
              <button type="submit" style={{ padding: '12px 24px', background: C.gold, color: C.white, border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Verify</button>
            </form>
            {scanStatus && (
              <div style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${scanStatus.type === 'success' ? 'rgba(184,148,79,0.2)' : 'rgba(196,94,94,0.15)'}`, background: scanStatus.type === 'success' ? 'rgba(184,148,79,0.06)' : 'rgba(196,94,94,0.04)', color: scanStatus.type === 'success' ? C.gold : '#C45E5E', fontSize: '13px' }}>
                {scanStatus.type === 'success' ? '✓ Success: ' : '✕ Failed: '}{scanStatus.message}
              </div>
            )}
          </div>
        </div>

        {/* Right: Arrivals Feed */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: '500px', overflow: 'hidden' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 500, borderBottom: `1px solid ${C.border}`, paddingBottom: '12px' }}>Arrivals Feed</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '4px', marginTop: '12px' }}>
            {checkInLogs.length > 0 ? (
              checkInLogs.map((log, index) => (
                <div key={index} style={{ background: '#FAFAF8', padding: '12px', border: '1px solid #F0ECE3', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: C.charcoal, display: 'block', fontSize: '13px' }}>{log.guestName}</span>
                    <span style={{ fontSize: '11px', color: C.stone }}>Party of {log.partySize} • {log.tableName}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: C.stone, display: 'block' }}>{log.checkedInAt}</span>
                    <span style={{ fontSize: '9px', color: '#A09A91', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{log.method.replace('_', ' ')}</span>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '12px', color: C.stone, textAlign: 'center', padding: '80px 0' }}>No arrivals logged in this kiosk session yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Overlay */}
      {showConfirmOverlay && overlayData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(25,27,30,0.8)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: '440px', background: C.white, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '40px', boxShadow: '0 24px 60px rgba(0,0,0,0.15)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
            {overlayData.type === 'success' ? (
              <>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(184,148,79,0.1)', border: '1px solid rgba(184,148,79,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold }}>
                  <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, fontWeight: 800, display: 'block' }}>Verification Success</span>
                  <h3 style={{ fontSize: '24px', fontWeight: 900, color: C.charcoal, marginTop: '8px', fontFamily: 'var(--font-serif)' }}>{overlayData.guestName}</h3>
                  <p style={{ color: C.stone, fontSize: '13px', marginTop: '4px' }}>{overlayData.message}</p>
                </div>
                <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '16px 0' }}>
                  <div style={{ background: C.ivory, padding: '12px', borderRadius: '10px', border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, display: 'block', fontWeight: 700 }}>Party Size</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: C.gold, marginTop: '4px', display: 'block' }}>{overlayData.partySize} Guests</span>
                  </div>
                  <div style={{ background: C.ivory, padding: '12px', borderRadius: '10px', border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.stone, display: 'block', fontWeight: 700 }}>Assigned Seat</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: C.charcoal, marginTop: '4px', display: 'block' }}>{overlayData.tableName}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(196,94,94,0.08)', border: '1px solid rgba(196,94,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C45E5E' }}>
                  <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <div>
                  <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C45E5E', fontWeight: 800, display: 'block' }}>Verification Failure</span>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#C45E5E', marginTop: '8px' }}>Access Denied</h3>
                  <p style={{ color: C.stone, fontSize: '13px', marginTop: '8px', lineHeight: 1.6, maxWidth: '300px' }}>{overlayData.message}</p>
                </div>
              </>
            )}
            <button onClick={() => setShowConfirmOverlay(false)} style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: C.stone, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Tap to close screen</button>
            {overlayData.type === 'success' && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, height: '4px', background: C.gold, animation: 'shrink 3.2s linear forwards', width: '100%' }} />
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shrink { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </div>
  );
}
