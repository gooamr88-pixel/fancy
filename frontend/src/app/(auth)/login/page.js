'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/apiClient';
import { getAuthErrorMessage } from '../../utils/authErrors';
import Toast from '../../components/Toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState(null);
  // A11Y-8: the toast alone never told sighted or screen-reader users WHICH
  // field was wrong — only that submission failed. Field-level state drives
  // aria-invalid/aria-describedby plus a visible inline message per field.
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef(null);
  const googleInitRef = useRef(false);
  const pollIntervalRef = useRef(null);
  const pollTimeoutRef = useRef(null);

  const router = useRouter();

  // Surface *why* the user landed back on login when a protected page or API
  // call bounced them here for an expired/missing session (middleware.ts,
  // apiClient.js) — previously a silent redirect with no explanation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'expired') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast({ message: 'Your session has expired. Please sign in again.', kind: 'error' });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!email) errors.email = 'Email is required.';
    if (!password) errors.password = 'Password is required.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setToast({ message: 'Please enter both your email and password.', kind: 'error' });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setToast(null);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (data.success) {
        localStorage.setItem('org_id', data.organization.id);
        localStorage.setItem('user_role', data.user.role);
        router.push(data.user.mustResetPassword ? '/dashboard?tab=profile&forceReset=1' : '/dashboard');
      } else {
        setToast({ message: data.message || 'Login failed. Please try again.', kind: 'error' });
      }
    } catch (err) {
      setToast({ message: getAuthErrorMessage(err, 'Login failed. Please try again.'), kind: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Load Google Sign-In on mount
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || googleInitRef.current) return;
    googleInitRef.current = true;

    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setGoogleLoading(true);
          setToast(null);
          try {
            const data = await apiFetch('/auth/google', {
              method: 'POST',
              body: JSON.stringify({ credential: response.credential })
            });
            if (data.success) {
              localStorage.setItem('org_id', data.organization.id);
              localStorage.setItem('user_role', data.user.role);
              setGoogleLoading(false);
              router.push('/dashboard');
            } else {
              setToast({ message: data.message || 'Google sign-in failed. Please try again.', kind: 'error' });
              setGoogleLoading(false);
            }
          } catch (err) {
            setToast({ message: getAuthErrorMessage(err, 'Google sign-in failed. Please try again.'), kind: 'error' });
            setGoogleLoading(false);
          }
        },
        ux_mode: 'popup',
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        locale: 'en',
        width: googleBtnRef.current.offsetWidth || 360,
      });
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const existing = document.getElementById('gsi-script');
      if (!existing) {
        const s = document.createElement('script');
        s.id = 'gsi-script';
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = () => {
          pollTimeoutRef.current = setTimeout(initGoogle, 100);
        };
        document.head.appendChild(s);
      } else {
        pollIntervalRef.current = setInterval(() => {
          if (window.google?.accounts?.id) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            initGoogle();
          }
        }, 200);
        pollTimeoutRef.current = setTimeout(() => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }, 10000);
      }
    }
    return () => {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
    };
  }, [router]);

  return (
    <div className="auth-page">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Left Panel — Image */}
      <div className="auth-image-panel">
        <div className="auth-image-overlay" />
        <div className="auth-image-content">
          <div className="auth-brand">
            <svg
              width="38"
              height="32"
              viewBox="0 0 38 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0 }}
            >
              <rect x="2" y="8" width="34" height="22" rx="2" stroke="#FFFFFF" strokeWidth="2" fill="none" />
              <path d="M2 10L19 22L36 10" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinejoin="round" />
              <path d="M4 8L19 0L34 8" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinejoin="round" />
            </svg>
            <span className="auth-brand-fancy">Fancy</span>
            <span className="auth-brand-rsvp">RSVP</span>
          </div>
          <div className="auth-ornament">✦ ✦ ✦</div>
          <p className="auth-tagline">Elegant RSVPs. Effortless Planning.</p>
          <div className="auth-shimmer" />
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="auth-form-panel">
        <div className="auth-form-container">

          {/* Mobile Logo */}
          <div className="auth-mobile-logo">
            <svg
              width="30"
              height="25"
              viewBox="0 0 38 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0 }}
            >
              <rect x="2" y="8" width="34" height="22" rx="2" stroke="#B8944F" strokeWidth="2" fill="none" />
              <path d="M2 10L19 22L36 10" stroke="#B8944F" strokeWidth="2" fill="none" strokeLinejoin="round" />
              <path d="M4 8L19 0L34 8" stroke="#B8944F" strokeWidth="2" fill="none" strokeLinejoin="round" />
            </svg>
            <span className="auth-brand-fancy">Fancy</span>
            <span className="auth-brand-rsvp">RSVP</span>
          </div>

          {/* Icon */}
          <div className="auth-icon-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 7l10 7 10-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="auth-heading">Welcome Back</h1>
          <p className="auth-subtext">Sign in to your organizer dashboard</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email" className="auth-label">Email Address</label>
              <input
                id="email" type="email" required autoComplete="email"
                value={email} onChange={e => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined })); }}
                placeholder="organizer@example.com"
                className="auth-input"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                style={fieldErrors.email ? { borderColor: '#DC2626' } : undefined}
              />
              {fieldErrors.email && <span id="email-error" role="alert" className="auth-field-error">{fieldErrors.email}</span>}
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="password" className="auth-label">Password</label>
                <Link href="/forgot-password" className="auth-forgot-link">Forgot?</Link>
              </div>
              <div className="auth-password-wrapper">
                <input
                  id="password" type={showPassword ? 'text' : 'password'} required
                  autoComplete="current-password"
                  value={password} onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined })); }}
                  placeholder="••••••••"
                  className="auth-input"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  style={fieldErrors.password ? { borderColor: '#DC2626' } : undefined}
                />
                <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && <span id="password-error" role="alert" className="auth-field-error">{fieldErrors.password}</span>}
            </div>

            <button type="submit" disabled={submitting} className="auth-submit-btn">
              {submitting ? (
                <span className="auth-spinner-row"><span className="auth-spinner" /> Authenticating...</span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* OR Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(184, 148, 79, 0.2)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted-stone)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(184, 148, 79, 0.2)' }} />
          </div>

          {/* Google Sign-In — rendered natively by Google */}
          {googleLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <span className="auth-spinner-row"><span className="auth-spinner" /> Signing in with Google...</span>
            </div>
          )}
          <div ref={googleBtnRef} className="auth-google-container" style={{ display: googleLoading ? 'none' : 'flex' }} />

          <div className="auth-footer-divider" />
          <p className="auth-footer-text">
            New host? <Link href="/register" className="auth-gold-link">Create an account</Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        .auth-page {
          display: flex;
          min-height: 100vh;
          font-family: var(--font-sans), Lato, sans-serif;
        }

        /* ── Left Image Panel ── */
        .auth-image-panel {
          position: relative;
          width: 50%;
          min-height: 100vh;
          background: url('/images/auth-bg.png') center/cover no-repeat;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .auth-image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(25,27,30,0.75) 0%, rgba(25,27,30,0.45) 100%);
        }
        .auth-image-content {
          position: relative;
          z-index: 1;
          text-align: center;
          animation: authFadeIn 1s ease 0.2s both;
        }
        .auth-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        .auth-brand-fancy {
          font-family: var(--font-script);
          font-size: 48px;
          font-weight: 400;
          color: #FFFFFF;
          line-height: 1;
        }
        .auth-brand-rsvp {
          font-family: var(--font-serif);
          font-size: 32px;
          font-weight: 600;
          color: #FFFFFF;
          letter-spacing: 4px;
          text-transform: uppercase;
          line-height: 1;
        }
        .auth-ornament {
          color: #D7BE80;
          font-size: 10px;
          letter-spacing: 8px;
          margin-bottom: 20px;
        }
        .auth-tagline {
          font-family: var(--font-serif);
          font-size: 18px;
          font-weight: 400;
          font-style: italic;
          color: rgba(255,255,255,0.7);
          max-width: 280px;
          margin: 0 auto 24px;
          line-height: 1.5;
        }
        .auth-shimmer {
          width: 60px;
          height: 1px;
          margin: 0 auto;
          background: linear-gradient(90deg, transparent, #D7BE80, #B8944F, #D7BE80, transparent);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }

        /* ── Right Form Panel ── */
        .auth-form-panel {
          width: 50%;
          min-height: 100vh;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
        }
        .auth-form-container {
          width: 100%;
          max-width: 400px;
          animation: authFadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* ── Mobile Logo (hidden on desktop) ── */
        .auth-mobile-logo {
          display: none;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-bottom: 32px;
        }

        /* ── Icon Circle ── */
        .auth-icon-circle {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(184,148,79,0.06);
          border: 1px solid rgba(184,148,79,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }

        /* ── Heading ── */
        .auth-heading {
          font-family: var(--font-serif);
          font-size: 28px;
          font-weight: 500;
          color: #191B1E;
          margin: 0 0 8px;
          letter-spacing: -0.01em;
        }
        .auth-subtext {
          font-size: 14px;
          font-weight: 400;
          color: #77736A;
          margin: 0 0 32px;
        }

        /* ── Form ── */
        .auth-form { display: flex; flex-direction: column; gap: 20px; }
        .auth-field-error {
          display: block;
          font-size: 12px;
          color: #DC2626;
          margin-top: 6px;
        }

        .auth-field {}
        .auth-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #77736A;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
          font-family: var(--font-sans);
        }
        .auth-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .auth-label-row .auth-label { margin-bottom: 0; }
        .auth-forgot-link {
          font-size: 11px;
          font-weight: 700;
          color: var(--gold-cta);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          text-decoration: none;
          transition: color 0.2s;
        }
        .auth-forgot-link:hover { color: var(--gold-cta-hover); }

        .auth-input {
          width: 100%;
          padding: 14px 16px;
          border: 1.5px solid #E8E2D6;
          border-radius: 10px;
          background: #FAFAF8;
          color: #191B1E;
          font-size: 14px;
          font-family: var(--font-sans);
          outline: none;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }
        .auth-input:focus {
          border-color: #B8944F;
          background: #FFFFFF;
          box-shadow: 0 0 0 3px rgba(184,148,79,0.08);
        }
        .auth-input::placeholder { color: #B5B0A7; }

        .auth-password-wrapper {
          position: relative;
        }
        .auth-password-wrapper .auth-input {
          padding-right: 48px;
        }
        .auth-eye-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        .auth-eye-btn:hover { opacity: 1; }

        /* ── Submit Button ── */
        .auth-submit-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, var(--gold-cta) 0%, var(--gold-cta-hover) 100%);
          color: #FFFFFF;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          font-family: var(--font-sans);
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin-top: 4px;
        }
        .auth-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(184,148,79,0.3);
        }
        .auth-submit-btn:active:not(:disabled) { transform: translateY(0); }
        .auth-submit-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .auth-spinner-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .auth-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #FFFFFF;
          border-radius: 50%;
          animation: authSpin 0.6s linear infinite;
        }

        /* ── Google Button ── */
        .auth-google-container {
          width: 100%;
          display: flex;
          justify-content: center;
          min-height: 44px;
        }
        .auth-google-container:empty::after {
          content: 'Loading Google Sign-In...';
          font-size: 13px;
          color: var(--muted-stone);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 44px;
          border: 1px dashed rgba(184, 148, 79, 0.3);
          border-radius: 10px;
        }

        /* ── Footer ── */
        .auth-footer-divider {
          width: 40px;
          height: 1px;
          background: #E8E2D6;
          margin: 28px auto 20px;
        }
        .auth-footer-text {
          text-align: center;
          font-size: 13px;
          color: #77736A;
          margin: 0;
        }
        .auth-gold-link {
          color: var(--gold-cta);
          font-weight: 700;
          text-decoration: none;
          transition: color 0.2s;
        }
        .auth-gold-link:hover { color: var(--gold-cta-hover); }

        /* ── Animations ── */
        @keyframes authFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes authFadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes authSpin {
          to { transform: rotate(360deg); }
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .auth-page { flex-direction: column; }
          .auth-image-panel { display: none; }
          .auth-form-panel {
            width: 100%;
            min-height: 100vh;
            background: linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 40%);
            padding: 40px 24px;
          }
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
