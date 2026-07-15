'use client';

import React, { useState, useEffect, useRef } from 'react';
import { normalizeToE164 } from '../../utils/phone';
import { findMealField } from '../../utils/mealField';
import PhoneNumberInput from '../../components/PhoneNumberInput';
import { toast } from '../../utils/toast';
import { useModalA11y } from '../../hooks/useModalA11y';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

export default function AddGuestModal({ isOpen, onClose, eventId, event, customFields, onGuestAdded }) {
  const [formData, setFormData] = useState({
    guest_name: '', email: '', phone: '', party_size: 1, response: '', notes: '', side: '', meal: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  const mealField = findMealField(customFields);

  // Reset the form whenever the modal transitions open (mirrors the previous
  // `useEffect(..., [isOpen])` — resetting during render instead of in an
  // effect avoids the extra "commit stale state, then immediately re-render"
  // cycle a setState-in-effect would cause).
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setFormData({ guest_name: '', email: '', phone: '', party_size: 1, response: '', notes: '', side: '', meal: '' });
      setError('');
      setLoading(false);
    }
  }

  // Imperative DOM focus is a legitimate effect side-effect (not derivable at
  // render time), so it stays in a real effect.
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nameRef.current?.focus(), 120);
    }
  }, [isOpen]);

  // A11Y-9: shared focus-trap/focus-restore/scroll-lock/Escape hook. The
  // nameRef effect above still owns which field gets focus first (more
  // precise than the hook's generic fallback); this adds what was missing —
  // Tab no longer escapes to the page behind the overlay, and Escape closes.
  const dialogRef = useModalA11y(isOpen, { onClose });

  if (!isOpen) return null;

  const handleChange = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.guest_name.trim()) { setError('Guest name is required.'); return; }
    if (!formData.email.trim()) { setError('Email address is required.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) { setError('Please enter a valid email address.'); return; }
    // Phone is required so the guest can receive SMS invitations; normalize to
    // E.164 (US default) before sending.
    const normalizedPhone = normalizeToE164(formData.phone);
    if (!normalizedPhone) {
      setError(formData.phone.trim()
        ? 'Enter a valid phone number (e.g. +1 555 123 4567).'
        : 'A phone number is required so this guest can receive SMS invitations.');
      return;
    }
    // Every guest added here must carry a real RSVP response — an organizer
    // adding someone by hand already knows whether they're coming, so there's
    // no legitimate "no answer yet" case the way there is for a guest who
    // hasn't opened their invitation. Leaving this on a silent "Pending"
    // default meant guests could sit in the list indefinitely with no actual
    // answer recorded.
    if (!['yes', 'no', 'maybe'].includes(formData.response)) {
      setError('Please select this guest’s response.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/rsvps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guestName: formData.guest_name.trim(),
          email: formData.email.trim(),
          phone: normalizedPhone,
          partySize: parseInt(formData.party_size, 10),
          response: formData.response,
          notes: formData.notes.trim() || undefined,
          side: formData.side || undefined,
          primaryGuestMeal: formData.meal || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add guest');
      const invitation = data.data?.invitation;
      if (invitation?.attempted) {
        if (invitation.sent) {
          toast.success(`Invitation emailed to ${invitation.email}.`);
        } else {
          toast.error(`Guest added, but the invitation email to ${invitation.email} couldn't be sent.`);
        }
      }
      onGuestAdded?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: COLORS.stone,
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', fontFamily: 'var(--font-sans)',
  };
  const inputStyle = {
    width: '100%', padding: '10px 14px', border: `1px solid ${COLORS.border}`, borderRadius: '8px',
    fontSize: '14px', fontFamily: 'var(--font-sans)', color: COLORS.charcoal,
    background: COLORS.white, outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(25, 27, 30, 0.45)', backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)', animation: 'fadeIn 0.2s ease', padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-guest-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.white, borderRadius: '16px', width: '100%', maxWidth: '500px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.12), 0 0 0 1px rgba(232,226,214,0.5)',
          animation: 'slideUp 0.25s ease', overflow: 'hidden',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
        }}>
          <h2 id="add-guest-modal-title" style={{
            fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: COLORS.charcoal, margin: 0,
          }}>Add Guest</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: COLORS.ivory,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLORS.stone, transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EDE8DD'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.ivory; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form — scrolls internally so Save/Cancel stay reachable even when
            the on-screen keyboard shrinks the viewport (MOB-12). */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Guest Name */}
            <div>
              <label style={labelStyle}>Guest Name *</label>
              <input ref={nameRef} value={formData.guest_name} onChange={handleChange('guest_name')}
                placeholder="Enter guest name" required style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
              />
            </div>

            {/* Email & Phone row */}
            <div className="ag-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Email *</label>
                <input value={formData.email} onChange={handleChange('email')} type="email"
                  placeholder="email@example.com" required style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                  onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone *</label>
                <PhoneNumberInput value={formData.phone} required
                  onChange={(val) => handleChange('phone')({ target: { value: val } })} />
              </div>
            </div>

            {/* Party Size & Response row */}
            <div className="ag-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Party Size</label>
                <select value={formData.party_size} onChange={handleChange('party_size')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Response *</label>
                <select value={formData.response} onChange={handleChange('response')} required style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="" disabled>Select a response</option>
                  <option value="yes">✓ Yes</option>
                  <option value="no">✗ No</option>
                  <option value="maybe">? Maybe</option>
                </select>
              </div>
            </div>

            {/* Side (Groom's/Bride's, only when the event tracks it) */}
            {event?.track_guest_side && (
              <div>
                <label style={labelStyle}>{event?.event_type === 'wedding' ? 'Side' : "Partner's Side"}</label>
                <select value={formData.side} onChange={handleChange('side')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Not set</option>
                  <option value="partner1">{event?.event_type === 'wedding' ? "Groom's Side" : "Partner 1's Side"}</option>
                  <option value="partner2">{event?.event_type === 'wedding' ? "Bride's Side" : "Partner 2's Side"}</option>
                </select>
              </div>
            )}

            {/* Meal (only when the event has a configured meal field) */}
            {mealField && (
              <div>
                <label style={labelStyle}>{mealField.field_label}{mealField.is_required ? ' *' : ''}</label>
                <select value={formData.meal} onChange={handleChange('meal')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Not set</option>
                  {(mealField.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={formData.notes} onChange={handleChange('notes')} rows={3}
                placeholder="Dietary restrictions, accessibility needs, etc." style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
                onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA',
                color: '#C45E5E', fontSize: '13px', fontFamily: 'var(--font-sans)',
              }}>
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${COLORS.border}` }}>
            <button type="button" onClick={onClose}
              style={{
                padding: '10px 20px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
                background: COLORS.white, color: COLORS.stone, fontSize: '13px', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.ivory; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.white; }}
            >Cancel</button>
            <button type="submit" disabled={loading}
              style={{
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                background: loading ? COLORS.champagne : COLORS.gold, color: COLORS.white,
                fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)',
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = COLORS.goldHover; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = COLORS.gold; }}
            >
              {loading && (
                <span style={{
                  width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: COLORS.white, borderRadius: '50%', display: 'inline-block',
                  animation: 'spin 0.6s linear infinite',
                }} />
              )}
              {loading ? 'Adding…' : 'Add Guest'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .ag-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
