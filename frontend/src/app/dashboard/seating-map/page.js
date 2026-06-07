'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function SeatingMapPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [tables, setTables] = useState([]);
  const [guests, setGuests] = useState([]);

  const [activeDragId, setActiveDragId] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const canvasRef = useRef(null);

  const eventId = 'demo-event';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  // Load tables and guests from Express backend
  const loadLayoutData = async () => {
    try {
      // 1. Fetch tables
      const tablesRes = await fetch(`${apiUrl}/events/${eventId}/tables`);
      const tablesData = await tablesRes.json();
      if (tablesData.success) setTables(tablesData.tables);

      // 2. Fetch guests (RSVPs)
      const rsvpsRes = await fetch(`${apiUrl}/events/${eventId}/rsvps`);
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
  };

  useEffect(() => {
    loadLayoutData();
  }, []);

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
    setLoading(true);
    try {
      const payload = tables.map(t => ({
        id: t.id,
        x: t.position_x,
        y: t.position_y
      }));

      const res = await fetch(`${apiUrl}/events/${eventId}/tables/positions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tablePositions: payload })
      });

      if (!res.ok) throw new Error('Failed to update table layout positions');

      const data = await res.json();
      if (data.success) {
        setHasChanges(false);
        alert('Table coordinates saved in backend db.json successfully!');
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
          <p className="text-slate-450 mt-2 text-sm leading-relaxed">{error}</p>
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
              className="px-5 py-2.5 bg-emerald-600 font-bold text-sm rounded-xl hover:bg-emerald-500 transition shadow-lg shadow-emerald-950/20"
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
          <div className="bg-slate-900 p-2 rounded-xl text-center border border-slate-800">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Pointer Kiosk - Click to Inspect Table • Drag to Arrange Coordinates
            </span>
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
                  <span className="text-xs text-slate-500 font-bold block mb-1">Seated Party Members:</span>
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

    </div>
  );
}
