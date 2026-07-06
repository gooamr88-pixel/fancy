'use client';

import React, { useState, useEffect, useCallback } from 'react';

const C = {
  gold: '#B8944F', goldHover: '#a6833f',
  charcoal: '#191B1E', ivory: '#F8F4EC',
  stone: '#77736A', border: '#E8E2D6',
  white: '#FFFFFF', softBg: '#FAFAF8',
  error: '#C45E5E', success: '#3B9B6D',
};

/**
 * Step 4 — Table Setup.
 * Organizers define tables and per-table capacities up front (unlimited tables).
 * Actual seat assignment happens later in the dashboard once guests RSVP.
 * Reuses the existing /events/:eventId/tables endpoints.
 */
export default function StageTables({ apiUrl, eventId, onContinue, onBack }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const loadTables = useCallback(async () => {
    if (!eventId) { setLoading(false); return; }
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/tables`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setTables(data.tables || []);
    } catch {
      setError('Could not load tables.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, eventId]);

  useEffect(() => { (async () => { await loadTables(); })(); }, [loadTables]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const cap = parseInt(capacity, 10);
    if (!name.trim()) { setError('Enter a table name.'); return; }
    if (!cap || cap < 1) { setError('Capacity must be at least 1.'); return; }
    setAdding(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tableName: name.trim(), maxCapacity: cap }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to add table.');
      setName('');
      setCapacity(10);
      await loadTables();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (tableId) => {
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/tables/${tableId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to delete table.');
      await loadTables();
    } catch (err) {
      setError(err.message);
    }
  };

  const totalSeats = tables.reduce((sum, t) => sum + (t.max_capacity || 0), 0);

  const inputStyle = {
    height: 46, padding: '0 14px', fontSize: 14, fontFamily: 'var(--font-sans)',
    border: `1.5px solid ${C.border}`, borderRadius: 10, outline: 'none',
    background: C.white, color: C.charcoal, boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '40px 24px 140px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.15)',
          borderRadius: 20, padding: '5px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, color: C.gold, fontWeight: 600, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Step 4 — Tables
          </span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: C.charcoal, margin: 0 }}>
          Set Up Your Tables
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: C.stone, margin: '8px 0 0' }}>
          Add tables and their capacities now. You can assign guests to tables later from the dashboard, once RSVPs come in.
        </p>
      </div>

      {/* Add table form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 24 }}>
        <div style={{ flex: '2 1 240px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-sans)' }}>Table name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Table 1, VIP Table" style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-sans)' }}>Capacity</label>
          <input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} style={inputStyle} />
        </div>
        <button type="submit" disabled={adding} style={{
          height: 46, padding: '0 22px', background: adding ? '#C9C4BA' : C.gold,
          color: C.white, border: 'none', borderRadius: 10,
          fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
          cursor: adding ? 'not-allowed' : 'pointer',
        }}>
          {adding ? 'Adding…' : '+ Add Table'}
        </button>
      </form>

      {error && (
        <div style={{
          background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.2)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          color: C.error, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
        }}>⚠️ {error}</div>
      )}

      {/* Table list */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', background: C.white }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px', borderBottom: `1px solid ${C.border}`, background: C.softBg,
        }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: C.charcoal }}>
            {tables.length} table{tables.length === 1 ? '' : 's'}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone }}>
            {totalSeats} total seats
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.stone, fontFamily: 'var(--font-sans)', fontSize: 13 }}>Loading…</div>
        ) : tables.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.stone, fontFamily: 'var(--font-sans)', fontSize: 13, fontStyle: 'italic' }}>
            No tables yet. Add your first table above — or skip and set them up later.
          </div>
        ) : (
          tables.map((t) => (
            <div key={t.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
            }}>
              <div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: C.charcoal }}>{t.table_name}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, marginLeft: 10 }}>
                  {t.max_capacity} seats
                </span>
              </div>
              <button onClick={() => handleDelete(t.id)} title="Delete table" style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
                cursor: 'pointer', color: C.stone, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,94,94,0.1)'; e.currentTarget.style.color = C.error; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.stone; }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${C.border}`, padding: '16px 24px', paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom) + 8px))', zIndex: 50,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 860, width: '100%' }}>
          <button onClick={onBack} style={{
            height: 48, padding: '0 24px', background: 'none',
            border: `1.5px solid ${C.charcoal}`, borderRadius: 12,
            fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, color: C.charcoal,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back
          </button>

          <button onClick={onContinue} style={{
            height: 52, padding: '0 32px',
            background: 'linear-gradient(135deg, #B8944F, #a6833f)',
            color: C.white, border: 'none', borderRadius: 14,
            fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {tables.length === 0 ? 'Skip for now' : 'Continue'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
