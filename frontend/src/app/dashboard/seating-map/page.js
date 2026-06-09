'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

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

  // Add Table states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('8');
  const [newTableShape, setNewTableShape] = useState('round');

  const canvasRef = useRef(null);

  // Auth and event initializer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('auth_token');
      if (!savedToken) {
        router.push('/login');
        return;
      }
      setTimeout(() => {
        setToken(savedToken);
        const savedEventId = localStorage.getItem('active_event_id') || 'demo-event';
        setEventId(savedEventId);
      }, 0);
    }
  }, [router]);

  // Load tables and guests from Express backend
  const loadLayoutData = useCallback(async () => {
    if (!eventId) return;
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      // 1. Fetch tables
      const tablesRes = await fetch(`${API_URL}/events/${eventId}/tables`, { headers });
      const tablesData = await tablesRes.json();
      if (tablesData.success) setTables(tablesData.tables);

      // 2. Fetch guests (RSVPs)
      const rsvpsRes = await fetch(`${API_URL}/events/${eventId}/rsvps`, { headers });
      const rsvpsData = await rsvpsRes.json();
      if (rsvpsData.success) {
        const formattedGuests = rsvpsData.rsvps.map(r => {
          const assignedTableId = r.seating_assignments && r.seating_assignments.length > 0 
            ? r.seating_assignments[0].table_id 
            : '';
          
          return {
            id: r.id,
            guest_name: r.guest_name,
            party_size: r.party_size,
            response: r.response,
            tableId: assignedTableId
          };
        });
        setGuests(formattedGuests);
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to load layout data:', err);
      setError('Could not connect to backend. Verify your backend server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => {
    if (!eventId) return;
    setTimeout(() => {
      loadLayoutData();
    }, 0);
  }, [loadLayoutData, eventId]);

  // Pointer drag event handlers
  const handlePointerDown = (e, tableId) => {
    e.preventDefault();
    setActiveDragId(tableId);
    setSelectedTable(tables.find(t => t.id === tableId));
  };

  const handlePointerMove = (e) => {
    if (!activeDragId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    
    // Calculate percentage coordinates
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    // Snap to grid (10px increments = ~2% steps on standard screens)
    x = Math.round(x / 2) * 2;
    y = Math.round(y / 2) * 2;

    // Constrain within borders
    x = Math.max(0, Math.min(88, x));
    y = Math.max(0, Math.min(88, y));

    setTables(prevTables => 
      prevTables.map(t => {
        if (t.id === activeDragId) {
          return { ...t, position_x: x, position_y: y };
        }
        return t;
      })
    );
    setHasChanges(true);
  };

  const handlePointerUp = () => {
    setActiveDragId(null);
  };

  // Save layout positions to the database using Express API
  const handleSaveLayout = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const payload = tables.map(t => ({
        id: t.id,
        x: t.position_x,
        y: t.position_y
      }));

      const res = await fetch(`${API_URL}/events/${eventId}/tables/positions`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ tablePositions: payload })
      });

      if (!res.ok) throw new Error('Failed to update table layout positions');

      const data = await res.json();
      if (data.success) {
        setHasChanges(false);
        alert('Table coordinates saved in backend successfully!');
        loadLayoutData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Canvas Actions: Add, Duplicate, Delete
  const handleAddTable = async () => {
    if (!newTableName.trim() || !newTableCapacity || !eventId) {
      alert('Please fill in table name and capacity.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/events/${eventId}/tables`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          tableName: newTableName,
          maxCapacity: parseInt(newTableCapacity),
          shape: newTableShape,
          x: 40,
          y: 40
        })
      });

      if (!res.ok) throw new Error('Failed to create table');
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewTableName('');
        loadLayoutData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateTable = async () => {
    if (!selectedTable || !eventId) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/events/${eventId}/tables`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          tableName: `${selectedTable.table_name} Copy`,
          maxCapacity: selectedTable.max_capacity,
          shape: selectedTable.shape,
          x: Math.min(88, selectedTable.position_x + 6),
          y: Math.min(88, selectedTable.position_y + 6)
        })
      });

      if (!res.ok) throw new Error('Failed to duplicate table');
      const data = await res.json();
      if (data.success) {
        loadLayoutData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!selectedTable || !eventId) return;

    if (selectedTableGuests.length > 0) {
      alert('This table has guest assignments. Unassign guests before deleting the table.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedTable.table_name}?`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/events/${eventId}/tables/${selectedTable.id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to delete table');
      }
      
      const data = await res.json();
      if (data.success) {
        setSelectedTable(null);
        loadLayoutData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Find guests assigned to selected table
  const selectedTableGuests = selectedTable 
    ? guests.filter(g => g.tableId === selectedTable.id && g.response === 'yes')
    : [];

  const unassignedGuests = guests.filter(g => !g.tableId && g.response === 'yes');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Drawing seating layout canvas...</p>
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
            onClick={() => { setLoading(true); loadLayoutData(); }} 
            className="mt-6 px-5 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs rounded-lg font-bold"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 select-none">
      
      {/* ─── Header ─── */}
      <div className="max-w-7xl mx-auto border-b border-slate-900 pb-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-amber-500 text-sm hover:underline">← Back to List</Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs uppercase text-slate-500 font-bold">Visual Planner</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Drag-and-Drop Seating Map</h1>
        </div>

        <div className="mt-4 md:mt-0 flex gap-3">
          {hasChanges && (
            <button 
              onClick={handleSaveLayout}
              className="px-5 py-2.5 bg-emerald-600 font-bold text-sm rounded-xl hover:bg-emerald-500 transition shadow-lg shadow-emerald-950/20 cursor-pointer text-white"
            >
              Save Layout Positions
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Column: Side List (Unassigned Guests) */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col h-[500px]">
          <h3 className="text-base font-bold border-b border-slate-800 pb-3 mb-4">Unassigned Guests</h3>
          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
            {unassignedGuests.length > 0 ? (
              unassignedGuests.map(g => (
                <div key={g.id} className="bg-slate-950 p-4 border border-slate-850 rounded-xl">
                  <span className="font-semibold text-slate-200 block text-sm">{g.guest_name}</span>
                  <span className="text-xs text-slate-550">Party size: {g.party_size}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-8">All attending guests have been assigned to tables.</p>
            )}
          </div>
        </div>

        {/* Center: Grid Canvas Map */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Canvas Controls</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-bold rounded-lg transition cursor-pointer text-white"
              >
                + Add Table
              </button>
              {selectedTable && (
                <>
                  <button
                    onClick={handleDuplicateTable}
                    className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs font-bold rounded-lg transition cursor-pointer text-slate-200"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={handleDeleteTable}
                    className="px-3 py-1.5 bg-rose-950/60 border border-rose-800/40 hover:bg-rose-900/40 text-rose-400 text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div
            ref={canvasRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-[450px] bg-slate-900 border-2 border-dashed border-slate-800 rounded-2xl relative overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]"
          >
            {tables.map(table => {
              const isSelected = selectedTable && selectedTable.id === table.id;
              const isRound = table.shape === 'round';
              const fillPercent = (table.occupied / table.max_capacity) * 100;
              
              return (
                <div
                  key={table.id}
                  onPointerDown={(e) => handlePointerDown(e, table.id)}
                  style={{
                    left: `${table.position_x}%`,
                    top: `${table.position_y}%`,
                    cursor: activeDragId === table.id ? 'grabbing' : 'grab',
                    touchAction: 'none'
                  }}
                  className={`absolute p-2 flex flex-col items-center justify-center transition-shadow shadow-md select-none ${isRound ? 'rounded-full w-24 h-24' : 'rounded-xl w-32 h-20'} ${isSelected ? 'border-2 border-amber-500 bg-slate-950 shadow-2xl' : 'border border-slate-750 bg-slate-850 hover:border-slate-500'}`}
                >
                  <span className="text-xs font-bold text-slate-100 truncate max-w-full block px-1">{table.table_name}</span>
                  
                  {/* Occupancy Fraction */}
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {table.occupied} / {table.max_capacity} Seats
                  </span>

                  {/* Tiny progress dot indicator */}
                  <div className="w-2.5 h-2.5 rounded-full mt-1.5 border border-slate-950" style={{ backgroundColor: fillPercent >= 100 ? '#ef4444' : fillPercent >= 80 ? '#f59e0b' : '#3b82f6' }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Table Inspector Panel */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col h-[500px]">
          <h3 className="text-base font-bold border-b border-slate-800 pb-3 mb-4">Table Inspector</h3>
          
          {selectedTable ? (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-bold text-slate-200">{selectedTable.table_name}</h4>
                  <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-1 block">
                    Shape: {selectedTable.shape} • Max: {selectedTable.max_capacity} seats
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-2 flex-1 overflow-y-auto max-h-[260px]">
                  <span className="text-xs text-slate-550 font-bold block mb-1">Seated Party Members:</span>
                  {selectedTableGuests.length > 0 ? (
                    selectedTableGuests.map(g => (
                      <div key={g.id} className="bg-slate-950 p-3 border border-slate-850 rounded-lg flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-200">{g.guest_name}</span>
                        <span className="text-[10px] text-slate-550">Party of {g.party_size}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-600 italic">No guests seated at this table yet.</p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <span className="text-xs text-slate-500 font-semibold">Coordinates: X: {selectedTable.position_x}%, Y: {selectedTable.position_y}%</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-650 flex-1 flex items-center justify-center">
              <p className="text-xs leading-relaxed max-w-[160px] mx-auto">Select a table shape from the canvas map to inspect guest seating lists.</p>
            </div>
          )}
        </div>

      </div>

      {/* Add Table Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Add New Table</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Table Name</label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value)}
                  placeholder="e.g. Table 12"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 bg-background text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Max Capacity</label>
                  <input
                    type="number"
                    value={newTableCapacity}
                    onChange={e => setNewTableCapacity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Shape</label>
                  <select
                    value={newTableShape}
                    onChange={e => setNewTableShape(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 bg-background text-foreground"
                  >
                    <option value="round">Round</option>
                    <option value="rectangular">Rectangular</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTable}
                className="px-4 py-2 bg-amber-600 text-xs font-bold rounded-lg hover:bg-amber-500 transition cursor-pointer text-white"
              >
                Create Table
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
