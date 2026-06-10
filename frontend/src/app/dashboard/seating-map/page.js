'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const C = { gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC', champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF' };

export default function SeatingMapPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const [token, setToken] = useState('');
  const [eventId, setEventId] = useState('');
  const [tables, setTables] = useState([]);
  const [guests, setGuests] = useState([]);
  const [activeDragId, setActiveDragId] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [dragOverTableId, setDragOverTableId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('8');
  const [newTableShape, setNewTableShape] = useState('round');
  const canvasRef = useRef(null);

  const handleLogout = () => { localStorage.removeItem('auth_token'); localStorage.removeItem('org_id'); localStorage.removeItem('user_role'); localStorage.removeItem('active_event_id'); window.location.href = '/login'; };

  useEffect(() => { if (typeof window !== 'undefined') { const savedToken = localStorage.getItem('auth_token'); if (!savedToken) { router.push('/login'); return; } setToken(savedToken); const savedEventId = localStorage.getItem('active_event_id') || 'demo-event'; setEventId(savedEventId); } }, [router]);

  const loadLayoutData = useCallback(async () => {
    if (!eventId) return;
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const tablesRes = await fetch(`${API_URL}/events/${eventId}/tables`, { headers });
      const tablesData = await tablesRes.json();
      if (tablesData.success) setTables(tablesData.tables);
      const rsvpsRes = await fetch(`${API_URL}/events/${eventId}/rsvps`, { headers });
      const rsvpsData = await rsvpsRes.json();
      if (rsvpsData.success) {
        const formattedGuests = rsvpsData.rsvps.map(r => {
          const assignedTableId = r.seating_assignments && r.seating_assignments.length > 0 ? r.seating_assignments[0].table_id : '';
          return { id: r.id, guest_name: r.guest_name, party_size: r.party_size, response: r.response, tableId: assignedTableId };
        });
        setGuests(formattedGuests);
      }
      setError(null);
    } catch (err) { console.error('Failed to load layout data:', err); setError('Could not connect to backend. Verify your backend server is running on port 5000.'); }
    finally { setLoading(false); }
  }, [eventId, token]);

  useEffect(() => { if (!eventId) return; loadLayoutData(); }, [loadLayoutData, eventId]);

  const handlePointerDown = (e, tableId) => { e.preventDefault(); setActiveDragId(tableId); setSelectedTable(tables.find(t => t.id === tableId)); };
  const handleGuestDragStart = (e, guest) => { e.dataTransfer.setData('application/json', JSON.stringify({ rsvpId: guest.id, partySize: guest.party_size })); };
  const handleDragOver = (e, tableId) => { e.preventDefault(); if (dragOverTableId !== tableId) setDragOverTableId(tableId); };
  const handleDragLeave = () => { setDragOverTableId(null); };

  const handleGuestDrop = async (e, tableId) => {
    e.preventDefault(); setDragOverTableId(null);
    try {
      const rawData = e.dataTransfer.getData('application/json'); if (!rawData) return;
      const { rsvpId, partySize } = JSON.parse(rawData);
      const table = tables.find(t => t.id === tableId);
      if (table) { const remaining = table.max_capacity - table.occupied; if (partySize > remaining) { alert(`Warning: Table ${table.table_name} only has ${remaining} seats left, party size is ${partySize}.`); return; } }
      setLoading(true);
      const headers = { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) };
      const res = await fetch(`${API_URL}/events/${eventId}/seating/assign`, { method: 'POST', headers, body: JSON.stringify({ rsvpId, tableId }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Seating assignment failed.');
      await loadLayoutData();
      if (selectedTable && selectedTable.id === tableId) setSelectedTable(prev => prev ? { ...prev, occupied: prev.occupied + partySize } : null);
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const handleUnseatGuest = async (rsvpId) => {
    try {
      setLoading(true);
      const headers = { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) };
      const res = await fetch(`${API_URL}/events/${eventId}/seating/unassign`, { method: 'POST', headers, body: JSON.stringify({ rsvpId }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Unseating failed.');
      const guestPartySize = guests.find(g => g.id === rsvpId)?.party_size || 0;
      await loadLayoutData();
      setSelectedTable(prev => prev ? { ...prev, occupied: Math.max(0, prev.occupied - guestPartySize) } : null);
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const handlePointerMove = (e) => {
    if (!activeDragId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.round(x / 2) * 2; y = Math.round(y / 2) * 2;
    x = Math.max(0, Math.min(88, x)); y = Math.max(0, Math.min(88, y));
    setTables(prevTables => prevTables.map(t => t.id === activeDragId ? { ...t, position_x: x, position_y: y } : t));
    setHasChanges(true);
  };
  const handlePointerUp = () => { setActiveDragId(null); };

  const handleSaveLayout = async () => {
    if (!eventId) return; setLoading(true);
    try {
      const payload = tables.map(t => ({ id: t.id, x: t.position_x, y: t.position_y }));
      const res = await fetch(`${API_URL}/events/${eventId}/tables/positions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }, body: JSON.stringify({ tablePositions: payload }) });
      if (!res.ok) throw new Error('Failed to update table layout positions');
      const data = await res.json();
      if (data.success) { setHasChanges(false); alert('Table coordinates saved in backend successfully!'); loadLayoutData(); }
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddTable = async () => {
    if (!newTableName.trim() || !newTableCapacity || !eventId) { alert('Please fill in table name and capacity.'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/events/${eventId}/tables`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }, body: JSON.stringify({ tableName: newTableName, maxCapacity: parseInt(newTableCapacity), shape: newTableShape, x: 40, y: 40 }) });
      if (!res.ok) throw new Error('Failed to create table');
      const data = await res.json();
      if (data.success) { setShowAddModal(false); setNewTableName(''); loadLayoutData(); }
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDuplicateTable = async () => {
    if (!selectedTable || !eventId) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/events/${eventId}/tables`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }, body: JSON.stringify({ tableName: `${selectedTable.table_name} Copy`, maxCapacity: selectedTable.max_capacity, shape: selectedTable.shape, x: Math.min(88, selectedTable.position_x + 6), y: Math.min(88, selectedTable.position_y + 6) }) });
      if (!res.ok) throw new Error('Failed to duplicate table');
      const data = await res.json();
      if (data.success) loadLayoutData();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDeleteTable = async () => {
    if (!selectedTable || !eventId) return;
    if (selectedTableGuests.length > 0) { alert('This table has guest assignments. Unassign guests before deleting the table.'); return; }
    if (!confirm(`Are you sure you want to delete ${selectedTable.table_name}?`)) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/events/${eventId}/tables/${selectedTable.id}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!res.ok) { const errData = await res.json(); throw new Error(errData.message || 'Failed to delete table'); }
      const data = await res.json();
      if (data.success) { setSelectedTable(null); loadLayoutData(); }
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const selectedTableGuests = selectedTable ? guests.filter(g => g.tableId === selectedTable.id && g.response === 'yes') : [];
  const unassignedGuests = guests.filter(g => !g.tableId && g.response === 'yes');

  const btnBase = { padding: '8px 16px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s' };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: `3px solid ${C.border}`, borderTop: `3px solid ${C.gold}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: C.stone, fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 300 }}>Drawing seating layout canvas...</p>
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
          <button onClick={() => { setLoading(true); loadLayoutData(); }} style={{ ...btnBase, marginTop: '24px', background: C.gold, color: C.white }}>Retry Connection</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.white, color: C.charcoal, padding: '32px', userSelect: 'none', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', borderBottom: `1px solid ${C.border}`, paddingBottom: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link href="/dashboard" style={{ color: C.gold, fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>← Back to Dashboard</Link>
            <span style={{ color: C.border }}>|</span>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: C.stone, fontWeight: 700, letterSpacing: '0.1em' }}>Visual Planner</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 500, color: C.charcoal, marginTop: '4px' }}>Drag-and-Drop Seating Map</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {hasChanges && (<button onClick={handleSaveLayout} style={{ ...btnBase, background: C.gold, color: C.white }}>Save Layout Positions</button>)}
          <button onClick={handleLogout} style={{ ...btnBase, background: 'transparent', border: `1px solid ${C.border}`, color: C.stone }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFF1F2'; e.currentTarget.style.color = '#C45E5E'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.stone; }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '24px' }}>

        {/* Left: Unassigned Guests */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', height: '500px' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 500, borderBottom: `1px solid ${C.border}`, paddingBottom: '12px', marginBottom: '16px' }}>Unassigned Guests</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
            {unassignedGuests.length > 0 ? (
              unassignedGuests.map((g, idx) => (
                <div key={g.id} draggable="true" onDragStart={(e) => handleGuestDragStart(e, g)}
                  style={{ background: '#FAFAF8', padding: '12px', border: `1px solid ${C.border}`, borderRadius: '10px', cursor: 'grab', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)'; }}>
                  <div>
                    <span style={{ fontWeight: 600, color: C.charcoal, display: 'block', fontSize: '13px' }}>{g.guest_name}</span>
                    <span style={{ fontSize: '11px', color: C.stone, display: 'block', marginTop: '2px' }}>Party size: {g.party_size}</span>
                  </div>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.stone} strokeWidth={2}><path strokeLinecap="round" d="M4 8h16M4 16h16" /></svg>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '12px', color: C.stone, textAlign: 'center', padding: '32px 0' }}>All attending guests have been assigned to tables.</p>
            )}
          </div>
        </div>

        {/* Center: Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: C.white, padding: '10px 16px', borderRadius: '10px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: C.stone, fontWeight: 700 }}>Canvas Controls</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowAddModal(true)} style={{ ...btnBase, background: C.gold, color: C.white, padding: '6px 14px' }}>+ Add Table</button>
              {selectedTable && (
                <>
                  <button onClick={handleDuplicateTable} style={{ ...btnBase, background: C.white, border: `1px solid ${C.border}`, color: C.charcoal, padding: '6px 14px' }}>Duplicate</button>
                  <button onClick={handleDeleteTable} style={{ ...btnBase, background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', color: '#C45E5E', padding: '6px 14px' }}>Delete</button>
                </>
              )}
            </div>
          </div>

          <div ref={canvasRef} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
            style={{ width: '100%', height: '450px', background: C.ivory, border: `2px dashed ${C.border}`, borderRadius: '16px', position: 'relative', overflow: 'hidden',
              backgroundImage: 'radial-gradient(#E8E2D6 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            {tables.map(table => {
              const isSelected = selectedTable && selectedTable.id === table.id;
              const isRound = table.shape === 'round';
              const fillPercent = (table.occupied / table.max_capacity) * 100;
              const isDragOver = dragOverTableId === table.id;
              const isDraggingTable = activeDragId === table.id;

              return (
                <div key={table.id}
                  onPointerDown={(e) => handlePointerDown(e, table.id)}
                  onDragOver={(e) => handleDragOver(e, table.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleGuestDrop(e, table.id)}
                  style={{
                    position: 'absolute', left: `${table.position_x}%`, top: `${table.position_y}%`,
                    cursor: isDraggingTable ? 'grabbing' : 'grab', touchAction: 'none',
                    padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    borderRadius: isRound ? '50%' : '12px',
                    width: isRound ? '96px' : '128px', height: isRound ? '96px' : '80px',
                    border: isDragOver ? `2px solid ${C.gold}` : isDraggingTable ? `2px solid ${C.gold}` : isSelected ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
                    background: isDragOver ? 'rgba(184,148,79,0.08)' : C.white,
                    boxShadow: isDragOver ? `0 0 20px rgba(184,148,79,0.2)` : isDraggingTable ? '0 8px 24px rgba(0,0,0,0.1)' : isSelected ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
                    transform: isDragOver ? 'scale(1.1)' : isDraggingTable ? 'scale(1.05)' : 'scale(1)',
                    transition: activeDragId === table.id ? 'none' : 'all 0.2s ease',
                    userSelect: 'none',
                  }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: C.charcoal, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block', padding: '0 4px' }}>{table.table_name}</span>
                  <span style={{ fontSize: '9px', color: C.stone, marginTop: '4px' }}>{table.occupied} / {table.max_capacity} Seats</span>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', marginTop: '6px', border: `1px solid ${C.border}`, transition: 'background 0.3s', background: fillPercent >= 100 ? '#C45E5E' : fillPercent >= 80 ? C.champagne : C.gold }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Table Inspector */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', height: '500px' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 500, borderBottom: `1px solid ${C.border}`, paddingBottom: '12px', marginBottom: '16px' }}>Table Inspector</h3>

          {selectedTable ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 700, color: C.charcoal }}>{selectedTable.table_name}</h4>
                  <span style={{ fontSize: '10px', color: C.stone, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                    Shape: {selectedTable.shape} • Max: {selectedTable.max_capacity} seats
                  </span>
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '12px', flex: 1, overflowY: 'auto', maxHeight: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: C.stone, fontWeight: 700, display: 'block', marginBottom: '4px' }}>Seated Party Members:</span>
                  {selectedTableGuests.length > 0 ? (
                    selectedTableGuests.map(g => (
                      <div key={g.id} style={{ background: '#FAFAF8', padding: '10px', border: `1px solid #F0ECE3`, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: C.charcoal, display: 'block' }}>{g.guest_name}</span>
                          <span style={{ fontSize: '10px', color: C.stone, display: 'block', marginTop: '2px' }}>Party of {g.party_size}</span>
                        </div>
                        <button onClick={() => handleUnseatGuest(g.id)} style={{ padding: '4px 10px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color: '#C45E5E', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Unseat</button>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '12px', color: C.stone, fontStyle: 'italic' }}>No guests seated at this table yet.</p>
                  )}
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '12px' }}>
                <span style={{ fontSize: '11px', color: C.stone, fontWeight: 600 }}>Coordinates: X: {selectedTable.position_x}%, Y: {selectedTable.position_y}%</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: '12px', color: C.stone, lineHeight: 1.6, maxWidth: '160px' }}>Select a table shape from the canvas map to inspect guest seating lists.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Table Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(25,27,30,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, width: '100%', maxWidth: '440px', borderRadius: '16px', padding: '24px', boxShadow: '0 16px 48px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 500, color: C.charcoal }}>Add New Table</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: C.stone, fontWeight: 600, display: 'block', marginBottom: '4px' }}>Table Name</label>
                <input type="text" value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="e.g. Table 12"
                  style={{ width: '100%', boxSizing: 'border-box', background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: C.charcoal, outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: C.stone, fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max Capacity</label>
                  <input type="number" value={newTableCapacity} onChange={e => setNewTableCapacity(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: C.charcoal, outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: C.stone, fontWeight: 600, display: 'block', marginBottom: '4px' }}>Shape</label>
                  <select value={newTableShape} onChange={e => setNewTableShape(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: C.charcoal, outline: 'none', cursor: 'pointer' }}>
                    <option value="round">Round</option>
                    <option value="rectangular">Rectangular</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
              <button onClick={() => setShowAddModal(false)} style={{ ...btnBase, background: C.white, border: `1px solid ${C.border}`, color: C.stone }}>Cancel</button>
              <button onClick={handleAddTable} style={{ ...btnBase, background: C.gold, color: C.white }}>Create Table</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
