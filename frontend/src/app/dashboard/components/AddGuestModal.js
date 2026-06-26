'use client';

import React, { useState, useEffect, useRef } from 'react';
import { normalizeToE164 } from '../../utils/phone';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

export default function AddGuestModal({ isOpen, onClose, eventId, onGuestAdded }) {
  const [formData, setFormData] = useState({
    guest_name: '', email: '', phone: '', party_size: 1, response: 'pending', notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  useEffect(() => {
    if (isOpen) {
      setFormData({ guest_name: '', email: '', phone: '', party_size: 1, response: 'pending', notes: '' });
      setError('');
      setLoading(false);
      setTimeout(() => nameRef.current?.focus(), 120);
    }
  }, [isOpen]);

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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add guest');
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                <input value={formData.phone} onChange={handleChange('phone')} type="tel"
                  placeholder="+1 (555) 000-0000" required style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                  onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
                />
              </div>
            </div>

            {/* Party Size & Response row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Party Size</label>
                <select value={formData.party_size} onChange={handleChange('party_size')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Response</label>
                <select value={formData.response} onChange={handleChange('response')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="pending">⏳ Pending</option>
                  <option value="yes">✓ Yes</option>
                  <option value="no">✗ No</option>
                </select>
              </div>
            </div>

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
      `}</style>
    </div>
  );
}
