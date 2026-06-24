'use client';
import { useState } from 'react';
import { toast } from '../../utils/toast';

const C = {
  gold: '#B8944F', charcoal: '#191B1E', white: '#FFFFFF',
  border: '#E8E2D6', stone: '#77736A', soft: '#FAF8F3', danger: '#C45E5E',
};

const goldBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: 40, padding: '0 18px', background: 'linear-gradient(135deg, #B8944F, #a6833f)',
  color: '#FFFFFF', border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
};

const fmtDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Dashboard → Drafts. Lists events the organizer started but hasn't activated yet
 * (status 'draft', unpaid), with one-click resume into the create-event wizard and
 * a safe delete. Filters from the events list the dashboard already loads.
 */
export default function DraftsTab({ events = [], apiUrl, onRefresh }) {
  const [deleting, setDeleting] = useState(null);
  const drafts = (events || []).filter((e) => e && e.status === 'draft' && !e.is_paid);

  const continueDraft = (id) => {
    if (typeof window !== 'undefined') window.location.href = `/dashboard/create-event?draft=${encodeURIComponent(id)}`;
  };

  const deleteDraft = async (ev) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete draft "${ev.title || 'Untitled event'}"? This can't be undone.`)) return;
    setDeleting(ev.id);
    try {
      const res = await fetch(`${apiUrl}/events/${ev.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || 'Could not delete draft.');
      toast.success('Draft deleted.');
      onRefresh && onRefresh(ev.id);
    } catch (err) {
      toast.error(err.message || 'Could not delete draft.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone, margin: 0, maxWidth: 560 }}>
          Events you&apos;ve started but not yet activated. Pick up right where you left off, or remove the ones you no longer need.
        </p>
        <a href="/dashboard/create-event" style={goldBtn}>+ New Event</a>
      </div>

      {drafts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 24px', background: C.soft, border: `1px dashed ${C.border}`, borderRadius: 16 }}>
          <div style={{ fontSize: 34 }}>📝</div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: C.stone, margin: '10px 0 18px' }}>
            No drafts yet. Start an event and choose <strong>Save as Draft</strong> to continue it later.
          </p>
          <a href="/dashboard/create-event" style={goldBtn}>Create Your First Event</a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {drafts.map((ev) => (
            <div key={ev.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.gold, background: 'rgba(184,148,79,0.1)', border: '1px solid rgba(184,148,79,0.25)', padding: '3px 9px', borderRadius: 100 }}>Draft</span>
                {fmtDate(ev.updated_at) && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.stone }}>Edited {fmtDate(ev.updated_at)}</span>}
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: C.charcoal, margin: 0 }}>{ev.title || 'Untitled event'}</h3>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {fmtDate(ev.event_date) && <span>📅 {fmtDate(ev.event_date)}</span>}
                {ev.location_name && <span>📍 {ev.location_name}</span>}
                {ev.slug && <span style={{ wordBreak: 'break-all' }}>🔗 /{ev.slug}</span>}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button onClick={() => continueDraft(ev.id)} style={{ ...goldBtn, flex: 1 }}>Continue setup</button>
                <button onClick={() => deleteDraft(ev)} disabled={deleting === ev.id}
                  style={{ height: 40, padding: '0 14px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.2)', borderRadius: 10, color: C.danger, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: deleting === ev.id ? 'not-allowed' : 'pointer' }}>
                  {deleting === ev.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
