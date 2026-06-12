'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../utils/apiClient';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true); setError(null);
    try {
      const data = await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      if (data.success) {
        setStep(2);
        startResendCooldown();
      } else {
        setError(data.message || 'Failed to send reset code. Please try again.');
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('status 5')) setError('Server error. Please try again later.');
      else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) setError('Network error. Check your connection.');
      else setError(msg);
    } finally { setSubmitting(false); }
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      const data = await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      if (data.success) {
        setOtp('');
        startResendCooldown();
        setError(null);
      } else {
        setError(data.message || 'Failed to resend code.');
      }
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const data = await apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, newPassword, confirmPassword }) });
      if (data.success) {
        setStep(3);
      } else {
        // Make error messages user-friendly
        const msg = data.message || 'Password reset failed.';
        if (msg.includes('invalid or has expired')) setError('Invalid or expired code. Please request a new one.');
        else if (msg.includes('Too many attempts')) setError('Too many attempts. Please request a new code.');
        else setError(msg);
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('invalid or has expired')) setError('Invalid or expired code. Please request a new one.');
      else if (msg.includes('status 5')) setError('Server error. Please try again later.');
      else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) setError('Network error. Check your connection.');
      else setError(msg);
    } finally { setSubmitting(false); }
  };

  const EyeIcon = ({ show }) => show ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );

  /* Step progress dots */
  const StepDots = () => (
    <div className="step-dots">
      {[1, 2, 3].map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 && <div className={`step-line ${step > i ? 'step-line-active' : ''}`} />}
          <div className={`step-dot ${step >= s ? 'step-dot-active' : ''} ${step === s ? 'step-dot-current' : ''}`}>
            {step > s && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-image-panel">
        <div className="auth-image-overlay" />
        <div className="auth-image-content">
          <div className="auth-brand"><span className="auth-brand-fancy">Fancy</span><span className="auth-brand-rsvp">RSVP</span></div>
          <div className="auth-ornament">✦ ✦ ✦</div>
          <p className="auth-tagline">Your Events, Secured</p>
          <div className="auth-shimmer" />
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-container" key={step}>
          <div className="auth-mobile-logo"><span className="auth-brand-fancy">Fancy</span><span className="auth-brand-rsvp">RSVP</span></div>

          <StepDots />

          {/* ── Step 1: Request OTP ── */}
          {step === 1 && (
            <>
              <div className="auth-icon-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <h1 className="auth-heading">Reset Password</h1>
              <p className="auth-subtext">Enter your email to receive a verification code</p>

              {error && <div className="auth-error" role="alert"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span>{error}</span></div>}

              <form onSubmit={handleRequestOtp} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="fp-email" className="auth-label">Email Address</label>
                  <input id="fp-email" type="email" required value={email}
                    onChange={e => setEmail(e.target.value)} placeholder="host@example.com" className="auth-input" />
                </div>

                <button type="submit" disabled={submitting} className="auth-submit-btn">
                  {submitting ? (
                    <span className="auth-spinner-row"><span className="auth-spinner" /> Sending...</span>
                  ) : 'Send Verification Code'}
                </button>
              </form>

              <div className="auth-footer-divider" />
              <p className="auth-footer-text">Return to <Link href="/login" className="auth-gold-link">Log In</Link></p>
            </>
          )}

          {/* ── Step 2: OTP + New Password ── */}
          {step === 2 && (
            <>
              <div className="auth-icon-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5">
                  <path d="M22 10.5V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h12" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 8l10 6 10-6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 19l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <h1 className="auth-heading">Enter Verification Code</h1>

              <div className="info-banner">
                <p>Code sent to <strong style={{ color: '#191B1E' }}>{email}</strong></p>
              </div>

              {error && <div className="auth-error" role="alert"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span>{error}</span></div>}

              <form onSubmit={handleResetPassword} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="otp-input" className="auth-label">6-Digit OTP Code</label>
                  <input id="otp-input" type="text" required maxLength={6} value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="123456"
                    className="auth-input otp-single-input" />
                </div>

                <div className="auth-field">
                  <label htmlFor="new-password-input" className="auth-label">New Password</label>
                  <div className="auth-password-wrapper">
                    <input id="new-password-input" type={showNewPassword ? 'text' : 'password'} required value={newPassword}
                      onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="auth-input" />
                    <button type="button" className="auth-eye-btn" onClick={() => setShowNewPassword(!showNewPassword)} aria-label={showNewPassword ? 'Hide password' : 'Show password'}>
                      <EyeIcon show={showNewPassword} />
                    </button>
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="confirm-password-input" className="auth-label">Confirm New Password</label>
                  <div className="auth-password-wrapper">
                    <input id="confirm-password-input" type={showConfirmPassword ? 'text' : 'password'} required value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="auth-input" />
                    <button type="button" className="auth-eye-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                      <EyeIcon show={showConfirmPassword} />
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={submitting} className="auth-submit-btn">
                  {submitting ? (
                    <span className="auth-spinner-row"><span className="auth-spinner" /> Resetting...</span>
                  ) : 'Reset Password'}
                </button>
              </form>

              <div className="auth-footer-row">
                <button type="button" className="auth-back-btn" onClick={() => { setStep(1); setError(null); }}>← Back</button>
                <button
                  type="button"
                  className="auth-resend-btn"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <Link href="/login" className="auth-gold-link" style={{ fontSize: '13px' }}>Return to Login</Link>
              </div>
            </>
          )}

          {/* ── Step 3: Success ── */}
          {step === 3 && (
            <div className="success-container">
              <div className="success-circle">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#B8944F" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h1 className="auth-heading" style={{ textAlign: 'center' }}>Password Updated</h1>
              <p className="auth-subtext" style={{ textAlign: 'center', maxWidth: '320px', margin: '0 auto 32px' }}>
                Your password has been successfully reset. You can now sign in with your new credentials.
              </p>

              <Link href="/login" className="auth-submit-btn success-link">
                Sign In Now
              </Link>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .auth-page {
          display: flex; min-height: 100vh;
          font-family: var(--font-sans), Lato, sans-serif;
        }

        /* ── Left Panel ── */
        .auth-image-panel {
          position: relative; width: 50%; min-height: 100vh;
          background: url('/images/auth-bg.png') center/cover no-repeat;
          display: flex; align-items: center; justify-content: center;
        }
        .auth-image-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(25,27,30,0.75) 0%, rgba(25,27,30,0.45) 100%);
        }
        .auth-image-content {
          position: relative; z-index: 1; text-align: center;
          animation: authFadeIn 1s ease 0.2s both;
        }
        .auth-brand { display: flex; align-items: baseline; justify-content: center; gap: 8px; margin-bottom: 16px; }
        .auth-brand-fancy { font-family: var(--font-script); font-size: 48px; font-weight: 400; color: #FFFFFF; line-height: 1; }
        .auth-brand-rsvp { font-family: var(--font-serif); font-size: 32px; font-weight: 600; color: #FFFFFF; letter-spacing: 4px; text-transform: uppercase; line-height: 1; }
        .auth-ornament { color: #D7BE80; font-size: 10px; letter-spacing: 8px; margin-bottom: 20px; }
        .auth-tagline { font-family: var(--font-serif); font-size: 18px; font-style: italic; color: rgba(255,255,255,0.7); max-width: 280px; margin: 0 auto 24px; line-height: 1.5; }
        .auth-shimmer { width: 60px; height: 1px; margin: 0 auto; background: linear-gradient(90deg, transparent, #D7BE80, #B8944F, #D7BE80, transparent); background-size: 200% 100%; animation: shimmer 3s linear infinite; }

        /* ── Right Panel ── */
        .auth-form-panel {
          width: 50%; min-height: 100vh; background: #FFFFFF;
          display: flex; align-items: center; justify-content: center; padding: 48px 40px;
        }
        .auth-form-container {
          width: 100%; max-width: 420px;
          animation: authFadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .auth-mobile-logo { display: none; align-items: baseline; justify-content: center; gap: 6px; margin-bottom: 32px; }

        /* ── Step Dots ── */
        .step-dots {
          display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 32px;
        }
        .step-dot {
          width: 10px; height: 10px; border-radius: 50%;
          border: 2px solid #E8E2D6; background: transparent;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s ease; flex-shrink: 0;
        }
        .step-dot-active { border-color: #B8944F; background: #B8944F; }
        .step-dot-current { width: 12px; height: 12px; box-shadow: 0 0 0 4px rgba(184,148,79,0.15); }
        .step-line { width: 40px; height: 2px; background: #E8E2D6; transition: background 0.3s; }
        .step-line-active { background: #B8944F; }

        /* ── Icon ── */
        .auth-icon-circle {
          width: 52px; height: 52px; border-radius: 50%;
          background: rgba(184,148,79,0.06); border: 1px solid rgba(184,148,79,0.1);
          display: flex; align-items: center; justify-content: center; margin-bottom: 24px;
        }

        /* ── Typography ── */
        .auth-heading { font-family: var(--font-serif); font-size: 28px; font-weight: 500; color: #191B1E; margin: 0 0 8px; }
        .auth-subtext { font-size: 14px; color: #77736A; margin: 0 0 28px; }

        /* ── Info Banner ── */
        .info-banner {
          padding: 14px 16px; background: rgba(184,148,79,0.04);
          border-left: 3px solid #B8944F; border-radius: 0 10px 10px 0;
          margin-bottom: 24px;
        }
        .info-banner p { font-size: 13px; color: #77736A; margin: 0; line-height: 1.6; }

        /* ── Error ── */
        .auth-error { padding: 14px 16px; background: #FFF1F2; border: 1px solid #FECDD3; border-radius: 10px; color: #9F1239; font-size: 13px; display: flex; align-items: flex-start; gap: 10px; margin-bottom: 24px; }
        .auth-error svg { flex-shrink: 0; margin-top: 1px; }

        /* ── Form ── */
        .auth-form { display: flex; flex-direction: column; gap: 20px; }
        .auth-label { display: block; font-size: 11px; font-weight: 700; color: #77736A; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; font-family: var(--font-sans); }
        .auth-input {
          width: 100%; padding: 14px 16px; border: 1.5px solid #E8E2D6; border-radius: 10px;
          background: #FAFAF8; color: #191B1E; font-size: 14px; font-family: var(--font-sans);
          outline: none; transition: all 0.3s ease; box-sizing: border-box;
        }
        .auth-input:focus { border-color: #B8944F; background: #FFFFFF; box-shadow: 0 0 0 3px rgba(184,148,79,0.08); }
        .auth-input::placeholder { color: #B5B0A7; }
        .otp-single-input { text-align: center; letter-spacing: 0.3em; font-family: monospace; font-size: 18px; font-weight: 700; }
        .auth-password-wrapper { position: relative; }
        .auth-password-wrapper .auth-input { padding-right: 48px; }
        .auth-eye-btn { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; display: flex; opacity: 0.6; transition: opacity 0.2s; }
        .auth-eye-btn:hover { opacity: 1; }

        /* ── Button ── */
        .auth-submit-btn {
          width: 100%; padding: 16px;
          background: linear-gradient(135deg, #B8944F 0%, #D7BE80 100%);
          color: #FFFFFF; border: none; border-radius: 10px;
          font-size: 14px; font-weight: 700; font-family: var(--font-sans);
          letter-spacing: 0.06em; cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); margin-top: 4px;
          display: block; text-align: center; text-decoration: none;
        }
        .auth-submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(184,148,79,0.3); }
        .auth-submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .auth-spinner-row { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .auth-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #FFFFFF; border-radius: 50%; animation: authSpin 0.6s linear infinite; }

        /* ── Footer ── */
        .auth-footer-divider { width: 40px; height: 1px; background: #E8E2D6; margin: 28px auto 20px; }
        .auth-footer-text { text-align: center; font-size: 13px; color: #77736A; margin: 0; }
        .auth-gold-link { color: #B8944F; font-weight: 700; text-decoration: none; transition: color 0.2s; }
        .auth-gold-link:hover { color: #a6833f; }
        .auth-footer-row { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #E8E2D6; font-size: 13px; }
        .auth-back-btn { background: none; border: none; color: #77736A; font-weight: 600; cursor: pointer; font-family: var(--font-sans); font-size: 13px; transition: color 0.2s; padding: 0; }
        .auth-back-btn:hover { color: #191B1E; }
        .auth-resend-btn { background: none; border: 1px solid rgba(184,148,79,0.3); color: #B8944F; font-weight: 600; cursor: pointer; font-family: var(--font-sans); font-size: 13px; transition: all 0.2s; padding: 8px 16px; border-radius: 8px; }
        .auth-resend-btn:hover:not(:disabled) { background: rgba(184,148,79,0.08); border-color: #B8944F; }
        .auth-resend-btn:disabled { opacity: 0.5; cursor: not-allowed; color: #999; border-color: rgba(184,148,79,0.15); }

        /* ── Success ── */
        .success-container { text-align: center; }
        .success-circle {
          width: 72px; height: 72px; border-radius: 50%;
          background: rgba(184,148,79,0.08); border: 2px solid rgba(184,148,79,0.2);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 28px;
          animation: successPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .success-link { display: block; }

        /* ── Animations ── */
        @keyframes authFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes authFadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes authSpin { to { transform: rotate(360deg); } }
        @keyframes successPop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .auth-page { flex-direction: column; }
          .auth-image-panel { display: none; }
          .auth-form-panel { width: 100%; min-height: 100vh; background: linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 40%); padding: 40px 24px; }
          .auth-mobile-logo { display: flex; }
          .auth-mobile-logo .auth-brand-fancy { color: #B8944F; font-size: 36px; }
          .auth-mobile-logo .auth-brand-rsvp { color: #191B1E; font-size: 24px; letter-spacing: 3px; }
          .auth-heading { font-size: 24px; }
          .auth-form-container { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
