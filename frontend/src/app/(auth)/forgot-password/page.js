'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '12px 16px', background: '#FFFFFF',
  border: '1px solid #E8E2D6', borderRadius: '8px', fontSize: '14px', color: '#191B1E',
  outline: 'none', fontFamily: 'var(--font-sans)', transition: 'border-color 0.25s ease',
};

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`${apiUrl}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to request OTP code.');
      if (data.success) setStep(2);
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`${apiUrl}/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp, newPassword, confirmPassword }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password.');
      if (data.success) setStep(3);
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.06)' }}>

        {/* Header with Logo */}
        <div style={{ padding: '32px', textAlign: 'center', borderBottom: '1px solid #F0ECE3' }}>
          {/* Envelope icon */}
          <div style={{ width: '48px', height: '48px', background: 'rgba(184,148,79,0.08)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 7l10 7 10-7"/></svg>
          </div>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
            <span style={{ fontFamily: 'var(--font-script)', fontSize: '28px', fontWeight: 400, color: '#B8944F', lineHeight: 1 }}>Fancy</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: '#191B1E', letterSpacing: '3px', textTransform: 'uppercase', lineHeight: 1 }}>RSVP</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 500, color: '#191B1E', marginTop: '16px' }}>Reset Password</h1>
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin: '20px 24px 0', padding: '12px 16px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', borderRadius: '10px', color: '#C45E5E', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Request OTP */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{ fontSize: '13px', color: '#77736A', lineHeight: 1.7 }}>
              Enter your registered organizer email address. We will dispatch a 6-digit verification code to reset your password.
            </p>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>Email Address</label>
              <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="host@example.com"
                style={inputStyle} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
            </div>
            <button type="submit" disabled={submitting}
              style={{ width: '100%', padding: '14px', background: submitting ? '#D7BE80' : '#B8944F', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: submitting ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: submitting ? 0.7 : 1, transition: 'all 0.3s' }}>
              {submitting ? 'Sending OTP Code...' : 'Request OTP Code'}
            </button>
            <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '20px', textAlign: 'center', fontSize: '13px', color: '#77736A' }}>
              Return to <Link href="/login" style={{ color: '#B8944F', fontWeight: 700, textDecoration: 'none' }}>Log In</Link>
            </div>
          </form>
        )}

        {/* Step 2: OTP & New Password */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '14px', background: 'rgba(184,148,79,0.06)', border: '1px solid rgba(184,148,79,0.15)', borderRadius: '10px' }}>
              <p style={{ fontSize: '12px', color: '#77736A', lineHeight: 1.6 }}>
                A verification code has been sent to <strong style={{ color: '#191B1E' }}>{email}</strong>. Please enter the OTP and set your new password below.
              </p>
            </div>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>6-Digit OTP Code</label>
              <input id="otp" type="text" required maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="123456"
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.3em', fontFamily: 'monospace', fontSize: '18px', fontWeight: 700 }}
                onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
            </div>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>New Password</label>
              <input id="newPassword" type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••"
                style={inputStyle} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
            </div>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>Confirm New Password</label>
              <input id="confirmPassword" type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••"
                style={inputStyle} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
            </div>
            <button type="submit" disabled={submitting}
              style={{ width: '100%', padding: '14px', background: submitting ? '#D7BE80' : '#B8944F', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: submitting ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: submitting ? 0.7 : 1, transition: 'all 0.3s', marginTop: '4px' }}>
              {submitting ? 'Resetting Password...' : 'Reset Password'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F0ECE3', paddingTop: '16px', fontSize: '13px' }}>
              <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#77736A', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>← Back</button>
              <Link href="/login" style={{ color: '#B8944F', fontWeight: 700, textDecoration: 'none' }}>Return to Login</Link>
            </div>
          </form>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(184,148,79,0.08)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(184,148,79,0.2)' }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#B8944F" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 500, color: '#191B1E' }}>Password Updated</h2>
              <p style={{ fontSize: '13px', color: '#77736A', marginTop: '8px', lineHeight: 1.7 }}>
                Your password has been successfully updated. You can now log in using your new credentials.
              </p>
            </div>
            <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '20px', width: '100%' }}>
              <Link href="/login" style={{ display: 'block', width: '100%', padding: '14px', background: '#B8944F', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', textAlign: 'center', textDecoration: 'none', fontFamily: 'var(--font-sans)' }}>
                Log In Now
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
