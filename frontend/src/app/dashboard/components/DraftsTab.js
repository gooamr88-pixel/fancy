'use client';
import { useState } from 'react';
import { toast } from '../../utils/toast';

const C = {
  gold: '#B8944F', charcoal: '#191B1E', white: '#FFFFFF',
  border: '#E8E2D6', stone: '#77736A', soft: '#FAF8F3', danger: '#C45E5E',
  success: '#3B9B6D', pending: '#D4A04A',
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

/** Check if an event has a pending cash/manual payment awaiting admin verification */
const getPendingPayment = (ev) => {
  const payments = ev?.event_payments;
  if (!Array.isArray(payments)) return null;
  return payments.find(p => p && p.status === 'pending' && p.payment_method === 'cash_manual') || null;
};

/**
 * Dashboard → Drafts. Lists events the organizer started but hasn't activated yet
 * (status 'draft', unpaid), with one-click resume into the create-event wizard and
 * a safe delete. Filters from the events list the dashboard already loads.
 *
 * Events with a pending manual payment show a different "Pending Verification" badge
 * instead of a plain "Draft" label.
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
          {drafts.map((ev) => {
            const pendingPay = getPendingPayment(ev);
            const isPending = !!pendingPay;
            return (
            <div key={ev.id} style={{ background: C.white, border: `1px solid ${isPending ? 'rgba(184,148,79,0.35)' : C.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                {isPending ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 800,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: C.pending, background: 'rgba(212,160,74,0.10)',
                    border: '1px solid rgba(212,160,74,0.30)', padding: '3px 9px', borderRadius: 100,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.pending, animation: 'draft-pulse 2s ease-in-out infinite' }} />
                    Pending Verification
                  </span>
                ) : (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.gold, background: 'rgba(184,148,79,0.1)', border: '1px solid rgba(184,148,79,0.25)', padding: '3px 9px', borderRadius: 100 }}>Draft</span>
                )}
                {fmtDate(ev.updated_at) && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.stone }}>Edited {fmtDate(ev.updated_at)}</span>}
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: C.charcoal, margin: 0 }}>{ev.title || 'Untitled event'}</h3>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {fmtDate(ev.event_date) && <span>📅 {fmtDate(ev.event_date)}</span>}
                {ev.location_name && <span>📍 {ev.location_name}</span>}
                {ev.slug && <span style={{ wordBreak: 'break-all' }}>🔗 /{ev.slug}</span>}
              </div>

              {/* Pending payment info */}
              {isPending && pendingPay.reference_number && (
                <div style={{
                  background: 'rgba(59,155,109,0.05)', border: '1px solid rgba(59,155,109,0.20)',
                  borderRadius: 8, padding: '8px 10px',
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.stone }}>Ref:</span>
                  <code style={{ background: C.soft, padding: '2px 8px', borderRadius: 5, color: C.gold, fontWeight: 700, fontSize: 12 }}>{pendingPay.reference_number}</code>
                  {pendingPay.tier_name && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: C.stone, marginLeft: 'auto' }}>{pendingPay.tier_name}</span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button onClick={() => continueDraft(ev.id)} style={{ ...goldBtn, flex: 1 }}>Continue setup</button>
                <button onClick={() => deleteDraft(ev)} disabled={deleting === ev.id}
                  style={{ height: 40, padding: '0 14px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.2)', borderRadius: 10, color: C.danger, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: deleting === ev.id ? 'not-allowed' : 'pointer' }}>
                  {deleting === ev.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes draft-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
