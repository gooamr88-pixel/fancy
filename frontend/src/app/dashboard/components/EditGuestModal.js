'use client';

import React, { useState, useEffect, useRef } from 'react';
import { isAccepted, isDeclined, isMaybe } from '../../utils/responseHelpers';
import { normalizeToE164 } from '../../utils/phone';
import { findMealField } from '../../utils/mealField';

/** Normalize legacy response values to the canonical set the backend accepts. */
function normalizeResponse(response) {
  if (!response) return 'pending';
  if (isAccepted(response)) return 'yes';
  if (isDeclined(response)) return 'no';
  if (isMaybe(response)) return 'maybe';
  return 'pending';
}

/** Strip the '-' placeholder the dashboard uses for missing contact info. */
function cleanContact(val) {
  if (!val || val === '-') return '';
  return val;
}

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

/**
 * Organizer-facing modal to edit an existing guest/RSVP.
 * Uses the existing PATCH /events/:eventId/rsvps/:rsvpId endpoint (updateRSVP),
 * which expects camelCase fields.
 */
export default function EditGuestModal({ isOpen, onClose, eventId, event, customFields, rsvp, onGuestUpdated }) {
  const [formData, setFormData] = useState({
    guest_name: '', email: '', phone: '', party_size: 1, response: 'pending', notes: '', side: '', meal: '',
  });
  const [companions, setCompanions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  const mealField = findMealField(customFields);

  useEffect(() => {
    if (isOpen && rsvp) {
      setFormData({
        guest_name: rsvp.guest_name || '',
        email: cleanContact(rsvp.email),
        phone: cleanContact(rsvp.phone),
        party_size: rsvp.party_size || 1,
        response: normalizeResponse(rsvp.response),
        notes: rsvp.notes || '',
        side: rsvp.side || '',
        meal: rsvp.primary_meal || '',
      });
      // Real companion rows the organizer can now edit directly (previously
      // only a party-size number existed — extra companions were permanent
      // "Guest 2"-style placeholders with no email/phone/name fix-up path).
      const existingCompanions = (rsvp.guests || [])
        .filter((g) => !g.is_primary_contact)
        .map((g) => ({
          id: g.id,
          fullName: g.full_name || '',
          email: cleanContact(g.email),
          phone: cleanContact(g.phone),
          mealSelection: g.meal_selection || '',
        }));
      setCompanions(existingCompanions);
      setError('');
      setLoading(false);
      setTimeout(() => nameRef.current?.focus(), 120);
    }
  }, [isOpen, rsvp]);

  if (!isOpen || !rsvp) return null;

  const handleChange = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handlePartySizeChange = (e) => {
    const size = parseInt(e.target.value, 10);
    setFormData(prev => ({ ...prev, party_size: size }));
    setCompanions((prev) => {
      const wanted = Math.max(size - 1, 0);
      if (wanted === prev.length) return prev;
      if (wanted < prev.length) return prev.slice(0, wanted);
      const extra = Array.from({ length: wanted - prev.length }, () => ({ id: null, fullName: '', email: '', phone: '', mealSelection: '' }));
      return [...prev, ...extra];
    });
  };

  const handleCompanionChange = (idx, field) => (e) => {
    const value = e.target.value;
    setCompanions((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.guest_name.trim()) { setError('Guest name is required.'); return; }
    // Normalize phone to E.164 (US default) when provided; blank clears it.
    let normalizedPhone = '';
    if (formData.phone.trim()) {
      normalizedPhone = normalizeToE164(formData.phone);
      if (!normalizedPhone) { setError('Enter a valid phone number (e.g. +1 555 123 4567), or leave it blank.'); return; }
    }
    // Don't let a saved contact detail vanish without the organizer noticing —
    // Add Guest requires email/phone up front, so silently wiping them here
    // (a stray backspace, an accidental blur) was an easy way to lose them.
    if (rsvp.email && rsvp.email !== '-' && !formData.email.trim()) {
      if (!window.confirm("This guest already has an email on file. Save with the email removed?")) return;
    }
    if (rsvp.phone && rsvp.phone !== '-' && !formData.phone.trim()) {
      if (!window.confirm("This guest already has a phone number on file. Save with the phone removed?")) return;
    }

    const companionPayload = [];
    for (let i = 0; i < companions.length; i++) {
      const c = companions[i];
      let companionPhone = '';
      if ((c.phone || '').trim()) {
        companionPhone = normalizeToE164(c.phone);
        if (!companionPhone) { setError(`Enter a valid phone number for Guest #${i + 2}, or leave it blank.`); return; }
      }
      if ((c.email || '').trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) {
        setError(`Enter a valid email address for Guest #${i + 2}, or leave it blank.`);
        return;
      }
      companionPayload.push({
        fullName: (c.fullName || '').trim() || `Guest ${i + 2}`,
        email: c.email ? c.email.trim() : '',
        phone: companionPhone,
        mealSelection: c.mealSelection || '',
      });
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/rsvps/${rsvp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guestName: formData.guest_name.trim(),
          email: formData.email.trim(),
          phone: normalizedPhone,
          partySize: parseInt(formData.party_size, 10),
          response: formData.response,
          notes: formData.notes.trim(),
          side: formData.side || '',
          primaryGuestMeal: formData.meal || '',
          additionalGuests: companionPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed to update guest');
      onGuestUpdated?.();
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
        WebkitBackdropFilter: 'blur(6px)', animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.white, borderRadius: '16px', width: '100%', maxWidth: '500px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.12), 0 0 0 1px rgba(232,226,214,0.5)',
          animation: 'slideUp 0.25s ease', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: COLORS.charcoal, margin: 0,
          }}>Edit Guest</h2>
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div>
              <label style={labelStyle}>Guest Name *</label>
              <input ref={nameRef} value={formData.guest_name} onChange={handleChange('guest_name')}
                placeholder="Enter guest name" required style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input value={formData.email} onChange={handleChange('email')} type="email"
                  placeholder="email@example.com" style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                  onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input value={formData.phone} onChange={handleChange('phone')} type="tel"
                  placeholder="+1 (555) 000-0000" style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                  onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Party Size</label>
                <select value={formData.party_size} onChange={handlePartySizeChange} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Response</label>
                <select value={formData.response} onChange={handleChange('response')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="pending">⏳ Pending</option>
                  <option value="yes">✓ Accepted</option>
                  <option value="maybe">❓ Maybe</option>
                  <option value="no">✗ Declined</option>
                </select>
              </div>
            </div>

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

            {mealField && (
              <div>
                <label style={labelStyle}>{mealField.field_label}{mealField.is_required ? ' *' : ''}</label>
                <select value={formData.meal} onChange={handleChange('meal')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Not set</option>
                  {(mealField.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
              </div>
            )}

            {companions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={labelStyle}>Additional Guests</label>
                {companions.map((c, idx) => (
                  <div key={c.id || idx} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px',
                    padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.softBg,
                  }}>
                    <input value={c.fullName} onChange={handleCompanionChange(idx, 'fullName')}
                      placeholder={`Guest ${idx + 2} name`} style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                      onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
                    />
                    <input value={c.email} onChange={handleCompanionChange(idx, 'email')} type="email"
                      placeholder="Email (optional)" style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                      onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
                    />
                    <input value={c.phone} onChange={handleCompanionChange(idx, 'phone')} type="tel"
                      placeholder="Phone (optional)" style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                      onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={formData.notes} onChange={handleChange('notes')} rows={3}
                placeholder="Dietary restrictions, accessibility needs, etc." style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
                onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
              />
            </div>

            {formData.response === 'no' && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', background: COLORS.softBg, border: `1px solid ${COLORS.border}`,
                color: COLORS.stone, fontSize: '12px', fontFamily: 'var(--font-sans)',
              }}>
                Setting the response to “No” will remove this guest&apos;s table assignment.
              </div>
            )}

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA',
                color: '#C45E5E', fontSize: '13px', fontFamily: 'var(--font-sans)',
              }}>
                {error}
              </div>
            )}
          </div>

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
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
