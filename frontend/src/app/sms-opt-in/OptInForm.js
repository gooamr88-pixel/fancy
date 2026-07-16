'use client';

import { useState } from 'react';
import PhoneNumberInput from '../components/PhoneNumberInput';
import SmsConsentText from '../components/guest/SmsConsentText';
import { normalizeToE164 } from '../utils/phone';

/* Live SMS opt-in form — the interactive half of /sms-opt-in (the Twilio TFV
   opt-in URL). Mirrors Twilio's reference web-form opt-in: name, phone,
   unchecked consent checkbox with the canonical consent language
   (SmsConsentText — same component as every RSVP form), and a Submit that
   persists a timestamped, versioned consent record via
   POST /public/sms-opt-in. */

const GOLD = '#B8944F';
const INK = '#191B1E';
const BODY = '#5E5A52';
const LINE = '#E8E2D6';
const ERR = '#C45E5E';

export default function OptInForm() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || done) return;
    const normalized = normalizeToE164(phone);
    if (!normalized) {
      setError('Enter a valid phone number in international format (e.g. +1 555 123 4567).');
      return;
    }
    if (!consent) {
      setError('Please check the consent box to opt in to text messages.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/sms-opt-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim() || undefined, phone: normalized, consent: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Something went wrong — please try again.');
      }
      setDone(true);
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 8px' }}>
        <div
          style={{
            width: '52px', height: '52px', borderRadius: '50%', background: '#F0FDF4',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '19px', fontWeight: 600, color: INK, margin: '0 0 8px' }}>
          You&rsquo;re opted in
        </h3>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: BODY, lineHeight: 1.7, maxWidth: '440px', margin: '0 auto' }}>
          Your consent has been recorded. You&rsquo;ll only receive texts about Fancy RSVP events you&rsquo;re
          invited to. Reply <strong style={{ color: INK }}>STOP</strong> to any message to opt out, or{' '}
          <strong style={{ color: INK }}>HELP</strong> for help. (If you previously texted STOP, reply START
          to receive messages again.)
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="optin-name"
          style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: INK, marginBottom: '8px' }}
        >
          Full name <span style={{ fontWeight: 400, color: BODY }}>(optional)</span>
        </label>
        <input
          id="optin-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          maxLength={200}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px',
            border: `1px solid ${LINE}`, fontFamily: 'var(--font-sans)', fontSize: '15px',
            color: INK, background: '#FFFFFF', outline: 'none',
          }}
        />
      </div>

      <div style={{ marginBottom: '18px' }}>
        <label
          htmlFor="optin-phone"
          style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: INK, marginBottom: '8px' }}
        >
          Phone number <span style={{ color: ERR }}>*</span>
        </label>
        <PhoneNumberInput value={phone} onChange={(v) => { setPhone(v); if (error) setError(''); }} defaultCountry="us" />
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px',
          borderRadius: '12px', background: 'rgba(184, 148, 79, 0.05)',
          border: '1px solid rgba(184, 148, 79, 0.25)', marginBottom: '16px',
        }}
      >
        <input
          type="checkbox"
          id="optin-sms-consent"
          checked={consent}
          onChange={(e) => { setConsent(e.target.checked); if (error) setError(''); }}
          style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: GOLD, flexShrink: 0, cursor: 'pointer' }}
        />
        <label
          htmlFor="optin-sms-consent"
          style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: BODY, lineHeight: 1.7, cursor: 'pointer' }}
        >
          <SmsConsentText linkStyle={{ color: GOLD }} />
        </label>
      </div>

      {error && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: ERR, margin: '0 0 14px' }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: '12px 32px', borderRadius: '10px', border: 'none',
          background: submitting ? '#D7BE80' : GOLD, color: '#FFFFFF',
          fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700,
          cursor: submitting ? 'default' : 'pointer', transition: 'background 0.2s',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#A09A91', lineHeight: 1.6, margin: '14px 0 0' }}>
        Consent is not a condition of any purchase. You&rsquo;ll only receive texts for Fancy RSVP events
        you&rsquo;re invited to or host.
      </p>
    </form>
  );
}
