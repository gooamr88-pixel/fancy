'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/apiClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setSubmitting(true);
    setError(null);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (data.success) {
        localStorage.setItem('org_id', data.organization.id);
        localStorage.setItem('user_role', data.user.role);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left Panel — Image */}
      <div className="auth-image-panel">
        <div className="auth-image-overlay" />
        <div className="auth-image-content">
          <div className="auth-brand">
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

          {error && (
            <div className="auth-error">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email" className="auth-label">Email Address</label>
              <input
                id="email" type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="organizer@example.com"
                className="auth-input"
              />
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
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input"
                />
                <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="auth-submit-btn">
              {submitting ? (
                <span className="auth-spinner-row"><span className="auth-spinner" /> Authenticating...</span>
              ) : 'Sign In'}
            </button>
          </form>

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
          align-items: baseline;
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
          align-items: baseline;
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

        /* ── Error ── */
        .auth-error {
          padding: 14px 16px;
          background: #FFF1F2;
          border: 1px solid #FECDD3;
          border-radius: 10px;
          color: #9F1239;
          font-size: 13px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 24px;
        }
        .auth-error svg { flex-shrink: 0; margin-top: 1px; }

        /* ── Form ── */
        .auth-form { display: flex; flex-direction: column; gap: 20px; }

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
          color: #B8944F;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          text-decoration: none;
          transition: color 0.2s;
        }
        .auth-forgot-link:hover { color: #a6833f; }

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
          background: linear-gradient(135deg, #B8944F 0%, #D7BE80 100%);
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
          color: #B8944F;
          font-weight: 700;
          text-decoration: none;
          transition: color 0.2s;
        }
        .auth-gold-link:hover { color: #a6833f; }

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
