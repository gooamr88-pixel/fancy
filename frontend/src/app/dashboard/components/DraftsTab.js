'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '../../utils/toast';
import Icon from '../../components/icons/Icon';

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

/* ═══ Confirmation Modal for Draft Deletion ═══ */
function ConfirmDeleteModal({ isOpen, onClose, onConfirm, event, isDeleting }) {
  // Typed confirmation only when a payment is on the line — EventSettings'
  // Danger Zone requires typing the exact event title before deleting a real
  // event, but this modal only ever required a single click, even for a
  // draft with a pending manual payment reference tied to it. A plain empty
  // draft stays a quick single-click delete (proportionate, not annoying).
  // Reset via remount (the parent keys this component on the target event's
  // id) rather than an effect that syncs state to a prop change.
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen || !event) return null;
  const pendingPay = getPendingPayment(event);
  const hasPendingPayment = !!pendingPay;
  const title = event.title || 'Untitled event';
  const confirmDisabled = isDeleting || (hasPendingPayment && confirmText.trim() !== title);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(25, 27, 30, 0.45)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'draftModalFadeIn 0.2s ease', padding: '16px', boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 18, width: '100%', maxWidth: 440,
          boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 0 0 1px rgba(232,226,214,0.5)',
          animation: 'draftModalSlideUp 0.25s ease', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '28px 28px 0', textAlign: 'center',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(196,94,94,0.08)', border: '1px solid rgba(196,94,94,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 24,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <h3 style={{
            fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600,
            color: C.charcoal, margin: '0 0 6px',
          }}>Delete Draft?</h3>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 13, color: C.stone,
            lineHeight: 1.6, margin: 0, maxWidth: 340, marginInline: 'auto',
          }}>
            Are you sure you want to delete <strong style={{ color: C.charcoal }}>&ldquo;{title}&rdquo;</strong>? This action cannot be undone.
          </p>
        </div>

        {/* Paid event / pending payment warning */}
        {hasPendingPayment && (
          <div style={{
            margin: '20px 28px 0', padding: '14px 16px', borderRadius: 12,
            background: 'rgba(212,160,74,0.06)', border: '1px solid rgba(212,160,74,0.20)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <Icon name="warning" size={17} color="#8a6d2f" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700,
                  color: '#8a6d2f', margin: '0 0 4px',
                }}>Pending Payment Detected</p>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11, color: C.stone,
                  lineHeight: 1.6, margin: 0,
                }}>
                  This event has a pending payment
                  {pendingPay.reference_number && <> (Ref: <code style={{ background: C.soft, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: C.gold }}>{pendingPay.reference_number}</code>)</>}.
                  Deleting it may affect your refund eligibility. Please contact <strong style={{ color: '#8a6d2f' }}>support@fancyrsvp.com</strong> before proceeding.
                </p>
              </div>
            </div>
          </div>
        )}

        {hasPendingPayment && (
          <div style={{ margin: '16px 28px 0' }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Type &ldquo;{title}&rdquo; to confirm
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={title}
              style={{
                width: '100%', height: 40, padding: '0 12px', borderRadius: 8,
                border: `1px solid ${C.border}`, fontFamily: 'var(--font-sans)', fontSize: 13,
                color: C.charcoal, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 10, padding: '24px 28px 28px',
          marginTop: 4,
        }}>
          <button
            onClick={onClose}
            disabled={isDeleting}
            style={{
              flex: 1, height: 44, borderRadius: 10,
              border: `1px solid ${C.border}`, background: C.white,
              color: C.stone, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (!isDeleting) { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.charcoal; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.stone; }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{
              flex: 1, height: 44, borderRadius: 10,
              border: 'none', background: confirmDisabled ? 'rgba(196,94,94,0.5)' : C.danger,
              color: C.white, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700,
              cursor: confirmDisabled ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
              boxShadow: confirmDisabled ? 'none' : '0 4px 14px rgba(196,94,94,0.25)',
            }}
            onMouseEnter={e => { if (!confirmDisabled) e.currentTarget.style.background = '#b34545'; }}
            onMouseLeave={e => { if (!confirmDisabled) e.currentTarget.style.background = C.danger; }}
          >
            {isDeleting && (
              <span style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: C.white, borderRadius: '50%', display: 'inline-block',
                animation: 'draftModalSpin 0.6s linear infinite',
              }} />
            )}
            {isDeleting ? 'Deleting…' : 'Delete Draft'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes draftModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes draftModalSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes draftModalSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/**
 * Dashboard → Drafts. Lists events the organizer started but hasn't activated yet
 * (status 'draft', unpaid), with one-click resume into the create-event wizard and
 * a safe delete. Filters from the events list the dashboard already loads.
 *
 * Events with a pending manual payment show a different "Pending Verification" badge
 * instead of a plain "Draft" label.
 */
export default function DraftsTab({ events = [], apiUrl, onRefresh }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(null);
  const [confirmEvent, setConfirmEvent] = useState(null); // event object to confirm deletion
  const drafts = (events || []).filter((e) => e && e.status === 'draft' && !e.is_paid);

  const continueDraft = (id) => {
    router.push(`/dashboard/create-event?draft=${encodeURIComponent(id)}`);
  };

  const handleDeleteClick = (ev) => {
    setConfirmEvent(ev);
  };

  const handleConfirmDelete = async () => {
    const ev = confirmEvent;
    if (!ev) return;
    setDeleting(ev.id);
    try {
      const res = await fetch(`${apiUrl}/events/${ev.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || 'Could not delete draft.');
      toast.success('Draft deleted.');
      setConfirmEvent(null);
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
        <Link href="/dashboard/create-event" style={goldBtn}>+ New Event</Link>
      </div>

      {drafts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 24px', background: C.soft, border: `1px dashed ${C.border}`, borderRadius: 16 }}>
          <Icon name="pencil" size={32} color="#B8944F" strokeWidth={1.3} />
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: C.stone, margin: '10px 0 18px' }}>
            No drafts yet. Start an event and choose <strong>Save as Draft</strong> to continue it later.
          </p>
          <Link href="/dashboard/create-event" style={goldBtn}>Create Your First Event</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {drafts.map((ev) => {
            const pendingPay = getPendingPayment(ev);
            const isPending = !!pendingPay;
            return (
            <div key={ev.id} style={{ background: C.white, border: `1px solid ${isPending ? 'rgba(184,148,79,0.35)' : C.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                {isPending ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 800,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: C.pending, background: 'rgba(212,160,74,0.10)',
                    border: '1px solid rgba(212,160,74,0.30)', padding: '3px 9px', borderRadius: 100,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.pending, animation: 'draft-pulse 2s ease-in-out infinite' }} />
                    Pending Payment
                  </span>
                ) : (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.gold, background: 'rgba(184,148,79,0.1)', border: '1px solid rgba(184,148,79,0.25)', padding: '3px 9px', borderRadius: 100 }}>Draft</span>
                )}
                {fmtDate(ev.updated_at) && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.stone }}>Edited {fmtDate(ev.updated_at)}</span>}
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: C.charcoal, margin: 0 }}>{ev.title || 'Untitled event'}</h3>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: C.stone, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {fmtDate(ev.event_date) && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="calendar" size={12} strokeWidth={1.7} /> {fmtDate(ev.event_date)}</span>}
                {ev.location_name && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="mapPin" size={12} strokeWidth={1.7} /> {ev.location_name}</span>}
                {ev.slug && <span style={{ wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="link" size={12} strokeWidth={1.7} style={{ flexShrink: 0 }} /> /{ev.slug}</span>}
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
                <button onClick={() => handleDeleteClick(ev)} disabled={deleting === ev.id}
                  style={{ height: 40, padding: '0 14px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.2)', borderRadius: 10, color: C.danger, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: deleting === ev.id ? 'not-allowed' : 'pointer' }}>
                  {deleting === ev.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal — keyed on the target event so its internal
          confirmText state resets via remount when a different draft is
          targeted, instead of an effect syncing state to a prop change. */}
      <ConfirmDeleteModal
        key={confirmEvent?.id || 'none'}
        isOpen={!!confirmEvent}
        onClose={() => setConfirmEvent(null)}
        onConfirm={handleConfirmDelete}
        event={confirmEvent}
        isDeleting={!!deleting}
      />

      <style>{`@keyframes draft-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
