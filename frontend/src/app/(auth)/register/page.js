'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/apiClient';
import { getAuthErrorMessage } from '../../utils/authErrors';
import Toast from '../../components/Toast';

const EyeIcon = ({ show }) => show ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/></svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef(null);
  const googleInitRef = useRef(false);

  // OTP verification state
  const [otpStep, setOtpStep] = useState(false);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const otpRefs = useRef([]);

  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !orgName || !email || !password) {
      setToast({ message: 'Please fill in all fields to create your account.', kind: 'error' });
      return;
    }
    if (password.length < 8) {
      setToast({ message: 'Your password must be at least 8 characters long.', kind: 'error' });
      return;
    }

    setSubmitting(true);
    setToast(null);

    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, orgName, email, password })
      });

      if (data.success && data.requiresVerification) {
        setOtpStep(true);
      } else if (data.success) {
        // Success but no verification needed — store session data before redirect
        if (data.organization?.id) localStorage.setItem('org_id', data.organization.id);
        if (data.user?.role) localStorage.setItem('user_role', data.user.role);
        router.push('/dashboard');
      } else {
        setToast({ message: data.message || 'Registration failed. Please try again.', kind: 'error' });
      }
    } catch (err) {
      setToast({ message: getAuthErrorMessage(err, 'Registration failed. Please try again.'), kind: 'error' });
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
              setToast({ message: data.message || 'Google sign-up failed. Please try again.', kind: 'error' });
              setGoogleLoading(false);
            }
          } catch (err) {
            setToast({ message: getAuthErrorMessage(err, 'Google sign-up failed. Please try again.'), kind: 'error' });
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
        s.onload = () => setTimeout(initGoogle, 100);
        document.head.appendChild(s);
      } else {
        const check = setInterval(() => {
          if (window.google?.accounts?.id) { clearInterval(check); initGoogle(); }
        }, 200);
        const timeout = setTimeout(() => clearInterval(check), 10000);
        return () => { clearInterval(check); clearTimeout(timeout); };
      }
    }
    return () => {
      // Cleanup: no pending intervals to clear if Google loaded synchronously or via script onload
    };
  }, [router]);

  // Auto-focus first OTP input when entering OTP step
  useEffect(() => {
    if (otpStep) {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [otpStep]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newValues = [...otpValues];
    newValues[index] = value.slice(-1);
    setOtpValues(newValues);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newValues = [...otpValues];
    for (let j = 0; j < 6 && j < pasted.length; j++) {
      newValues[j] = pasted[j];
    }
    setOtpValues(newValues);
    const focusIdx = Math.min(pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otp = otpValues.join('');
    if (otp.length !== 6) return;

    setVerifying(true);
    setToast(null);

    try {
      const data = await apiFetch('/auth/verify-registration', {
        method: 'POST',
        body: JSON.stringify({ email, otp })
      });

      if (data.success) {
        localStorage.setItem('org_id', data.organization.id);
        localStorage.setItem('user_role', data.user.role);
        router.push('/dashboard');
      } else {
        setToast({ message: data.message || 'Verification failed. Please try again.', kind: 'error' });
      }
    } catch (err) {
      setToast({ message: getAuthErrorMessage(err, 'Verification failed. Please try again.'), kind: 'error' });
      setOtpValues(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };



  // ─── OTP Verification Screen ───
  if (otpStep) {
    return (
      <div className="auth-page">
        <Toast toast={toast} onClose={() => setToast(null)} />

        <div className="auth-image-panel">
          <div className="auth-image-overlay" />
          <div className="auth-image-content">
            <div className="auth-brand"><span className="auth-brand-fancy">Fancy</span><span className="auth-brand-rsvp">RSVP</span></div>
            <div className="auth-ornament">✦ ✦ ✦</div>
            <p className="auth-tagline">Almost There...</p>
            <div className="auth-shimmer" />
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-container otp-container">
            <div className="auth-mobile-logo"><span className="auth-brand-fancy">Fancy</span><span className="auth-brand-rsvp">RSVP</span></div>

            {/* OTP Icon */}
            <div className="auth-icon-circle otp-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h1 className="auth-heading">Verify Your Email</h1>
            <p className="auth-subtext">We sent a 6-digit code to <strong style={{ color: '#B8944F' }}>{email}</strong></p>

            <form onSubmit={handleVerifyOtp}>
              <div className="otp-row">
                {otpValues.map((val, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text" inputMode="numeric" maxLength={1}
                    value={val}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    autoComplete="one-time-code"
                    aria-label={`Digit ${i + 1} of 6`}
                    autoFocus={i === 0}
                    className={`otp-input ${val ? 'otp-filled' : ''}`}
                  />
                ))}
              </div>

              <button type="submit" disabled={verifying || otpValues.join('').length !== 6} className="auth-submit-btn">
                {verifying ? (
                  <span className="auth-spinner-row"><span className="auth-spinner" /> Verifying...</span>
                ) : 'Verify & Continue'}
              </button>
            </form>

            <p className="otp-resend">
              Didn't receive the code?{' '}
              <button type="button" className="otp-retry-btn"
                onClick={() => { setOtpValues(['', '', '', '', '', '']); setToast(null); otpRefs.current[0]?.focus(); }}>
                Clear & Retry
              </button>
            </p>
          </div>
        </div>

        <style jsx>{`${sharedStyles}
          .otp-container { text-align: center; }
          .otp-container .auth-icon-circle { margin: 0 auto 24px; }
          .otp-container .auth-heading { text-align: center; }
          .otp-container .auth-subtext { text-align: center; }
          .otp-icon { width: 64px; height: 64px; }
          .otp-row {
            display: flex; gap: 10px; justify-content: center; margin: 28px 0;
          }
          .otp-input {
            width: 52px; height: 60px; text-align: center;
            font-size: 24px; font-weight: 700; font-family: monospace;
            border: 2px solid #E8E2D6; border-radius: 12px;
            background: #FAFAF8; color: #191B1E; outline: none;
            transition: all 0.3s ease;
          }
          .otp-input:focus {
            border-color: #B8944F; background: #FFFFFF;
            box-shadow: 0 0 0 3px rgba(184,148,79,0.12);
          }
          .otp-filled {
            border-color: #B8944F; background: #FFFFFF;
            box-shadow: 0 0 0 3px rgba(184,148,79,0.08);
          }
          .otp-resend {
            color: #77736A; font-size: 13px; text-align: center; margin-top: 24px;
          }
          .otp-retry-btn {
            color: #B8944F; font-weight: 700; background: none; border: none;
            cursor: pointer; font-size: 13px; font-family: inherit;
            transition: color 0.2s;
          }
          .otp-retry-btn:hover { color: #a6833f; }
          @media (max-width: 640px) {
            .otp-input { width: 44px; height: 52px; font-size: 20px; }
          }
        `}</style>
      </div>
    );
  }

  // ─── Registration Form ───
  return (
    <div className="auth-page">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="auth-image-panel">
        <div className="auth-image-overlay" />
        <div className="auth-image-content">
          <div className="auth-brand"><span className="auth-brand-fancy">Fancy</span><span className="auth-brand-rsvp">RSVP</span></div>
          <div className="auth-ornament">✦ ✦ ✦</div>
          <p className="auth-tagline">Create Beautiful Events</p>
          <div className="auth-shimmer" />
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          <div className="auth-mobile-logo"><span className="auth-brand-fancy">Fancy</span><span className="auth-brand-rsvp">RSVP</span></div>

          {/* Icon */}
          <div className="auth-icon-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8.5" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="20" y1="8" x2="20" y2="14" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="23" y1="11" x2="17" y2="11" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="auth-heading">Create Your Account</h1>
          <p className="auth-subtext">Start planning your perfect event today</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field-grid">
              <div className="auth-field">
                <label htmlFor="name" className="auth-label">Full Name</label>
                <input id="name" type="text" required autoComplete="name"
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Julian Vance" className="auth-input" />
              </div>
              <div className="auth-field">
                <label htmlFor="orgName" className="auth-label">Organization</label>
                <input id="orgName" type="text" required
                  value={orgName} onChange={e => setOrgName(e.target.value)}
                  placeholder="Wedding Suite" className="auth-input" />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-email" className="auth-label">Email Address</label>
              <input id="reg-email" type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="host@example.com" className="auth-input" />
            </div>

            <div className="auth-field">
              <label htmlFor="reg-password" className="auth-label">Password</label>
              <div className="auth-password-wrapper">
                <input id="reg-password" type={showPassword ? 'text' : 'password'} required
                  autoComplete="new-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" className="auth-input" />
                <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <EyeIcon show={showPassword} />
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="auth-submit-btn">
              {submitting ? (
                <span className="auth-spinner-row"><span className="auth-spinner" /> Creating account...</span>
              ) : 'Create Account'}
            </button>
          </form>

          {/* OR Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(184, 148, 79, 0.2)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '1.5px' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(184, 148, 79, 0.2)' }} />
          </div>

          {/* Google Sign-Up — rendered natively by Google */}
          {googleLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <span className="auth-spinner-row"><span className="auth-spinner" /> Signing up with Google...</span>
            </div>
          )}
          <div ref={googleBtnRef} className="auth-google-container" style={{ display: googleLoading ? 'none' : 'flex' }} />

          <div className="auth-footer-divider" />
          <p className="auth-footer-text">
            Already hosting? <Link href="/login" className="auth-gold-link">Log In</Link>
          </p>
        </div>
      </div>

      <style jsx>{`${sharedStyles}
        .auth-field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 640px) {
          .auth-field-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

// ─── Shared Styles (used by both registration and OTP views) ───
const sharedStyles = `
  .auth-page {
    display: flex;
    min-height: 100vh;
    font-family: var(--font-sans), Lato, sans-serif;
  }
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
  .auth-tagline { font-family: var(--font-serif); font-size: 18px; font-weight: 400; font-style: italic; color: rgba(255,255,255,0.7); max-width: 280px; margin: 0 auto 24px; line-height: 1.5; }
  .auth-shimmer { width: 60px; height: 1px; margin: 0 auto; background: linear-gradient(90deg, transparent, #D7BE80, #B8944F, #D7BE80, transparent); background-size: 200% 100%; animation: shimmer 3s linear infinite; }

  .auth-form-panel {
    width: 50%; min-height: 100vh; background: #FFFFFF;
    display: flex; align-items: center; justify-content: center; padding: 48px 40px;
  }
  .auth-form-container {
    width: 100%; max-width: 420px;
    animation: authFadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .auth-mobile-logo { display: none; align-items: baseline; justify-content: center; gap: 6px; margin-bottom: 32px; }
  .auth-icon-circle {
    width: 52px; height: 52px; border-radius: 50%;
    background: rgba(184,148,79,0.06); border: 1px solid rgba(184,148,79,0.1);
    display: flex; align-items: center; justify-content: center; margin-bottom: 24px;
  }
  .auth-heading { font-family: var(--font-serif); font-size: 28px; font-weight: 500; color: #191B1E; margin: 0 0 8px; letter-spacing: -0.01em; }
  .auth-subtext { font-size: 14px; font-weight: 400; color: #77736A; margin: 0 0 32px; }
  .auth-form { display: flex; flex-direction: column; gap: 20px; }
  .auth-label { display: block; font-size: 11px; font-weight: 700; color: #77736A; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; font-family: var(--font-sans); }
  .auth-input {
    width: 100%; padding: 14px 16px; border: 1.5px solid #E8E2D6; border-radius: 10px;
    background: #FAFAF8; color: #191B1E; font-size: 14px; font-family: var(--font-sans);
    outline: none; transition: all 0.3s ease; box-sizing: border-box;
  }
  .auth-input:focus { border-color: #B8944F; background: #FFFFFF; box-shadow: 0 0 0 3px rgba(184,148,79,0.08); }
  .auth-input::placeholder { color: #B5B0A7; }
  .auth-password-wrapper { position: relative; }
  .auth-password-wrapper .auth-input { padding-right: 48px; }
  .auth-eye-btn { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; display: flex; opacity: 0.6; transition: opacity 0.2s; }
  .auth-eye-btn:hover { opacity: 1; }
  .auth-submit-btn {
    width: 100%; padding: 16px;
    background: linear-gradient(135deg, #B8944F 0%, #D7BE80 100%);
    color: #FFFFFF; border: none; border-radius: 10px;
    font-size: 14px; font-weight: 700; font-family: var(--font-sans);
    letter-spacing: 0.06em; cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); margin-top: 4px;
  }
  .auth-submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(184,148,79,0.3); }
  .auth-submit-btn:active:not(:disabled) { transform: translateY(0); }
  .auth-submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .auth-spinner-row { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .auth-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #FFFFFF; border-radius: 50%; animation: authSpin 0.6s linear infinite; }
  .auth-google-container {
    width: 100%; display: flex; justify-content: center; min-height: 44px;
  }
  .auth-google-container:empty::after {
    content: 'Loading Google Sign-In...';
    font-size: 13px; color: #999; display: flex; align-items: center; justify-content: center;
    width: 100%; height: 44px; border: 1px dashed rgba(184, 148, 79, 0.3); border-radius: 10px;
  }
  .auth-footer-divider { width: 40px; height: 1px; background: #E8E2D6; margin: 28px auto 20px; }
  .auth-footer-text { text-align: center; font-size: 13px; color: #77736A; margin: 0; }
  .auth-gold-link { color: #B8944F; font-weight: 700; text-decoration: none; transition: color 0.2s; }
  .auth-gold-link:hover { color: #a6833f; }

  @keyframes authFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes authFadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes authSpin { to { transform: rotate(360deg); } }

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
`;

