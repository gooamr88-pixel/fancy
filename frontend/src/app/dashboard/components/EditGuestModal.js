'use client';

import React, { useState, useEffect, useRef } from 'react';
import { isAccepted, isDeclined, isMaybe } from '../../utils/responseHelpers';
import { normalizeToE164 } from '../../utils/phone';
import { findMealField } from '../../utils/mealField';
import CompanionMealCounter, { trimMealCounts } from '../../components/guest/rsvp/CompanionMealCounter';

/**
 * Guest categories (decision D-4). Must match GUEST_CATEGORIES in
 * backend/services/guestService.js — the server validates against its own list
 * and rejects anything else, so an addition here alone would surface as a
 * validation error rather than a new option.
 */
const GUEST_CATEGORIES = [
  { value: 'standard', label: 'Standard' },
  { value: 'vip', label: 'VIP' },
  { value: 'family', label: 'Family' },
];
import { sideLabel } from '../../utils/sideLabel';
import PhoneNumberInput from '../../components/PhoneNumberInput';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useConfirm } from '../../components/useConfirm';

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
  // Renders ABOVE this modal (z-index 2000) — see useConfirm.
  const [confirm, confirmDialog] = useConfirm();
  const [formData, setFormData] = useState({
    guest_name: '', email: '', phone: '', party_size: 1, response: 'pending', notes: '', side: '', meal: '', category: 'standard',
  });
  const [companions, setCompanions] = useState([]);
  // The party's companion meal tally. `dirty` gates whether it is sent at all:
  // an untouched counter must never overwrite what the guest chose, whatever
  // the modal happened to be prefilled with.
  const [companionMealCounts, setCompanionMealCounts] = useState({});
  const [mealCountsDirty, setMealCountsDirty] = useState(false);
  const setCompanionMealCount = (option, n) => {
    setMealCountsDirty(true);
    setCompanionMealCounts((prev) => {
      const next = { ...prev };
      if (n > 0) next[option] = n; else delete next[option];
      return next;
    });
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Organizer's confirmation that they hold this guest's SMS consent. Only
  // offered for a guest who has never recorded a decision of their own — see
  // canAttestSms below.
  const [smsConsentAttested, setSmsConsentAttested] = useState(false);
  const nameRef = useRef(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  const mealField = findMealField(customFields);

  // Prefill the form whenever the modal opens or the target rsvp record
  // changes (mirrors the previous `useEffect(..., [isOpen, rsvp])` — resetting
  // during render instead of in an effect avoids the setState-in-effect
  // cascading-render pattern).
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevRsvp, setPrevRsvp] = useState(rsvp);
  if (isOpen !== prevIsOpen || rsvp !== prevRsvp) {
    setPrevIsOpen(isOpen);
    setPrevRsvp(rsvp);
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
        // Read from the primary guest — the column lives on `guests`, and the
        // party's members always share a value because this dropdown writes it
        // to all of them.
        category: (rsvp.guests || []).find((g) => g.is_primary_contact)?.category
          || rsvp.category || 'standard',
      });
      // Never carried over between guests, and never pre-ticked from an existing
      // attestation — re-opening the modal must not silently re-affirm consent.
      setSmsConsentAttested(false);
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
        }));
      setCompanions(existingCompanions);
      setCompanionMealCounts(rsvp.companion_meal_counts || {});
      setMealCountsDirty(false);
      setError('');
      setLoading(false);
    }
  }

  // Imperative DOM focus is a legitimate effect side-effect (not derivable at
  // render time), so it stays in a real effect.
  useEffect(() => {
    if (isOpen && rsvp) {
      setTimeout(() => nameRef.current?.focus(), 120);
    }
  }, [isOpen, rsvp]);

  // A11Y-9: shared focus-trap/focus-restore/scroll-lock/Escape hook.
  const dialogRef = useModalA11y(isOpen, { onClose });

  if (!isOpen || !rsvp) return null;

  const handleChange = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handlePartySizeChange = (e) => {
    const size = parseInt(e.target.value, 10);
    setFormData(prev => ({ ...prev, party_size: size }));
    setCompanions((prev) => {
      const wanted = Math.max(size - 1, 0);
      if (wanted === prev.length) return prev;
      if (wanted < prev.length) return prev.slice(0, wanted);
      const extra = Array.from({ length: wanted - prev.length }, () => ({ id: null, fullName: '', email: '', phone: '' }));
      return [...prev, ...extra];
    });
    // Drop meals along with the companions they belonged to, so the counter
    // can't sit on a total for a group that no longer exists.
    setCompanionMealCounts((prev) => {
      const trimmed = trimMealCounts(prev, Math.max(size - 1, 0));
      if (trimmed !== prev) setMealCountsDirty(true);
      return trimmed;
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
    // ONE question, not two sequential native prompts. Clearing both used to
    // stack two dialogs an organizer had to dismiss in turn, each naming a
    // single field; asking once and listing what goes is the same guard with a
    // quarter of the friction — and it is a real dialog, like the rest of the
    // dashboard, rather than browser chrome layered over an open modal.
    const clearing = [];
    if (rsvp.email && rsvp.email !== '-' && !formData.email.trim()) clearing.push('email address');
    if (rsvp.phone && rsvp.phone !== '-' && !formData.phone.trim()) clearing.push('phone number');
    if (clearing.length > 0) {
      const ok = await confirm({
        title: clearing.length === 1
          ? `Save without their ${clearing[0]}?`
          : 'Save without their email address and phone number?',
        body: 'They are on file now and this removes them. Without a contact detail this guest cannot be sent their invitation or their entry pass.',
        confirmLabel: 'Save anyway',
        cancelLabel: 'Go back',
        tone: 'danger',
      });
      if (!ok) return;
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
      // No mealSelection: a companion has no dish of their own any more, the
      // party carries a tally instead (see companionMealCounts below).
      companionPayload.push({
        fullName: (c.fullName || '').trim() || `Guest ${i + 2}`,
        email: c.email ? c.email.trim() : '',
        phone: companionPhone,
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
          category: formData.category || 'standard',
          additionalGuests: companionPayload,
          // Sent ONLY once the organizer has actually touched the counter.
          // updateParty leaves the column alone when the key is absent, so an
          // untouched modal can never blank a tally the guest filled in.
          ...(mealCountsDirty ? { companionMealCounts: companionMealCounts } : {}),
          ...(smsConsentAttested ? { smsConsentAttested: true } : {}),
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

  // A consent decision exists for this party — either an opt-in (from the guest
  // or a previous attestation) or a recorded refusal. `sms_consent_at` is the
  // discriminator: it is stamped on every decision, including a "no", so its
  // absence is what "never asked" means.
  const smsDecided = !!(rsvp?.sms_consent || rsvp?.sms_consent_at);

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
        aria-labelledby="edit-guest-modal-title"
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
          <h2 id="edit-guest-modal-title" style={{
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
        {/* Scrolls internally so Save/Cancel stay reachable even when the
            on-screen keyboard shrinks the viewport, or with several
            companions filled in (MOB-12). */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div>
              <label style={labelStyle}>Guest Name *</label>
              <input ref={nameRef} value={formData.guest_name} onChange={handleChange('guest_name')}
                placeholder="Enter guest name" required style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
              />
            </div>

            <div className="eg-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                <PhoneNumberInput value={formData.phone} onChange={(val) => handleChange('phone')({ target: { value: val } })} />
              </div>
            </div>

            {/* SMS consent state for this guest.
                Three distinct cases, and conflating them would be wrong:
                • the guest already decided (either way) → read-only. Their own
                  choice is final; an organizer must not be offered a control
                  that appears to overturn it, because the backend would refuse
                  anyway (recordHostConsentAttestation's IS NULL guard).
                • no decision on record, phone present → offer the attestation.
                • no phone → nothing to say. */}
            {formData.phone.trim() && (
              smsDecided ? (
                <div style={{
                  padding: '10px 14px', borderRadius: '10px', background: COLORS.softBg,
                  border: `1px solid ${COLORS.border}`, fontSize: '11.5px', lineHeight: 1.6,
                  color: COLORS.stone, fontFamily: 'var(--font-sans)',
                }}>
                  {rsvp?.sms_consent
                    ? (rsvp?.sms_consent_method === 'host_attested'
                        ? 'SMS consent on file — you confirmed you obtained this guest’s consent. They can receive event texts.'
                        : 'SMS consent on file — this guest opted in themselves on their RSVP form. They can receive event texts.')
                    : 'This guest was shown the SMS consent box and chose not to opt in. Their decision can’t be overridden, so they’re excluded from all text messages.'}
                </div>
              ) : (
                <div style={{
                  padding: '12px 14px', borderRadius: '10px',
                  background: smsConsentAttested ? 'rgba(184,148,79,0.08)' : COLORS.softBg,
                  border: `1px solid ${smsConsentAttested ? COLORS.champagne : COLORS.border}`,
                  transition: 'background 0.2s, border-color 0.2s',
                }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={smsConsentAttested}
                      onChange={(e) => setSmsConsentAttested(e.target.checked)}
                      style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: COLORS.gold, flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12.5px', color: COLORS.charcoal, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
                      I confirm that I have obtained this recipient&apos;s consent to receive event-related SMS messages.
                    </span>
                  </label>
                  <p style={{
                    margin: '8px 0 0 26px', fontSize: '11.5px', lineHeight: 1.6,
                    color: COLORS.stone, fontFamily: 'var(--font-sans)',
                  }}>
                    {smsConsentAttested
                      ? 'Saving will record your confirmation with your name and the date, and this guest can then be included in SMS sends.'
                      : 'No SMS consent is on record for this guest, so they’re currently excluded from text messages.'}
                  </p>
                </div>
              )
            )}

            <div className="eg-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  <option value="pending">Pending</option>
                  <option value="yes">✓ Accepted</option>
                  <option value="maybe">Maybe</option>
                  <option value="no">✗ Declined</option>
                </select>
              </div>
            </div>

            {event?.track_guest_side && (
              <div>
                <label style={labelStyle}>{event?.event_type === 'wedding' ? 'Side' : "Partner's Side"}</label>
                <select value={formData.side} onChange={handleChange('side')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Not set</option>
                  <option value="partner1">{sideLabel('partner1', event)}</option>
                  <option value="partner2">{sideLabel('partner2', event)}</option>
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

            {/* Guest category (decision D-4, amendment A-16 item 6).
                One dropdown, applied to everyone in the party — a VIP arrives with
                their family and they are all VIPs at the door. `vip` is the value
                the check-in app keys its premium welcome off, which is why this is
                a fixed list and not free text. */}
            <div>
              <label style={labelStyle}>Category</label>
              <select value={formData.category} onChange={handleChange('category')} style={{ ...inputStyle, cursor: 'pointer' }}>
                {GUEST_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: COLORS.stone }}>
                Applies to everyone in this party. VIPs get a distinct welcome screen at check-in.
              </p>
            </div>

            {companions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={labelStyle}>Additional Guests</label>
                {companions.map((c, idx) => (
                  <div key={c.id || idx} className="eg-companion-row" style={{
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
                    <PhoneNumberInput value={c.phone} placeholder="Phone (optional)"
                      onChange={(val) => handleCompanionChange(idx, 'phone')({ target: { value: val } })} />
                  </div>
                ))}
              </div>
            )}

            {companions.length > 0 && mealField?.options?.length > 0 && (
              <CompanionMealCounter
                options={mealField.options}
                counts={companionMealCounts}
                onChange={setCompanionMealCount}
                companionCount={companions.length}
                required={false}
                accentColor={COLORS.gold}
              />
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
        @media (max-width: 639.98px) {
          .eg-row { grid-template-columns: 1fr !important; }
          .eg-companion-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {confirmDialog}
    </div>
  );
}
