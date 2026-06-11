'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/apiClient';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // OTP verification state
  const [otpStep, setOtpStep] = useState(false);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const otpRefs = useRef([]);

  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !orgName || !email || !password) return;

    setSubmitting(true);
    setError(null);

    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, orgName, email, password })
      });

      if (data.success && data.requiresVerification) {
        // Transition to OTP input screen
        setOtpStep(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newValues = [...otpValues];
    newValues[index] = value.slice(-1); // Single digit
    setOtpValues(newValues);

    // Auto-advance to next input
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
    if (pasted.length === 6) {
      setOtpValues(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otp = otpValues.join('');
    if (otp.length !== 6) return;

    setVerifying(true);
    setError(null);

    try {
      const data = await apiFetch('/auth/verify-registration', {
        method: 'POST',
        body: JSON.stringify({ email, otp })
      });

      if (data.success) {
        // Auth cookie was set by the server — store display metadata
        localStorage.setItem('org_id', data.organization.id);
        localStorage.setItem('user_role', data.user.role);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message);
      setOtpValues(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '11px 16px',
    border: '1px solid #E8E2D6',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    color: '#191B1E',
    fontSize: '14px',
    fontFamily: 'var(--font-sans), Lato, sans-serif',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '10px',
    fontWeight: '700',
    color: '#77736A',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: '6px',
    fontFamily: 'var(--font-sans), Lato, sans-serif',
  };

  // ─── OTP Verification Screen ───
  if (otpStep) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#F8F4EC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans), Lato, sans-serif',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E2D6',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: '#FFFFFF',
            padding: '36px 32px 24px',
            textAlign: 'center',
            borderBottom: '1px solid #E8E2D6',
          }}>
            <div style={{
              width: '56px', height: '56px', margin: '0 auto 16px',
              borderRadius: '50%', background: 'rgba(184,148,79,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{
              fontFamily: 'var(--font-serif), Cormorant Garamond, serif',
              fontSize: '24px', fontWeight: '400', color: '#191B1E',
              margin: 0, letterSpacing: '0.01em',
            }}>Verify Your Email</h1>
            <p style={{ color: '#77736A', fontSize: '13px', marginTop: '8px', lineHeight: 1.6 }}>
              We sent a 6-digit code to <strong style={{ color: '#191B1E' }}>{email}</strong>
            </p>
          </div>

          {/* OTP Form */}
          <form onSubmit={handleVerifyOtp} style={{ padding: '32px' }}>
            {error && (
              <div style={{
                padding: '14px 16px', backgroundColor: '#FFF1F2', border: '1px solid #FECDD3',
                borderRadius: '8px', color: '#9F1239', fontSize: '13px',
                display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '24px',
              }}>
                <svg style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '1px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '28px' }}>
              {otpValues.map((val, i) => (
                <input
                  key={i}
                  ref={el => otpRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={val}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  autoFocus={i === 0}
                  style={{
                    width: '48px', height: '56px', textAlign: 'center',
                    fontSize: '22px', fontWeight: '700', fontFamily: 'monospace',
                    border: '1px solid #E8E2D6', borderRadius: '10px',
                    color: '#191B1E', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxShadow: val ? '0 0 0 2px rgba(184,148,79,0.15)' : 'none',
                    borderColor: val ? '#B8944F' : '#E8E2D6',
                  }}
                  onFocus={e => e.target.style.borderColor = '#B8944F'}
                  onBlur={e => { if (!val) e.target.style.borderColor = '#E8E2D6'; }}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={verifying || otpValues.join('').length !== 6}
              style={{
                width: '100%', padding: '14px',
                backgroundColor: '#B8944F', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-sans), Lato, sans-serif',
                letterSpacing: '0.06em',
                cursor: verifying ? 'not-allowed' : 'pointer',
                opacity: (verifying || otpValues.join('').length !== 6) ? 0.55 : 1,
                transition: 'background-color 0.2s ease, opacity 0.2s ease',
              }}
              onMouseEnter={e => { if (!verifying) e.target.style.backgroundColor = '#a6833f'; }}
              onMouseLeave={e => { if (!verifying) e.target.style.backgroundColor = '#B8944F'; }}
            >
              {verifying ? 'Verifying...' : 'Verify & Continue'}
            </button>

            <p style={{ color: '#77736A', fontSize: '12px', textAlign: 'center', marginTop: '20px', lineHeight: 1.6 }}>
              Didn't receive the code?{' '}
              <button
                type="button"
                onClick={() => { setOtpStep(false); setOtpValues(['', '', '', '', '', '']); setError(null); }}
                style={{ color: '#B8944F', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}
              >
                Try again
              </button>
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ─── Registration Form ───
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F8F4EC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'var(--font-sans), Lato, sans-serif',
    }}>

      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E8E2D6',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        
        {/* Header */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '36px 32px 24px',
          textAlign: 'center',
          borderBottom: '1px solid #E8E2D6',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke="#B8944F" strokeWidth="1.5" fill="none" />
              <path d="M2 7l10 7 10-7" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{
                fontFamily: 'var(--font-script)',
                fontSize: '28px',
                fontWeight: 400,
                color: '#B8944F',
                letterSpacing: '0.02em',
              }}>Fancy</span>
              <span style={{
                fontFamily: 'var(--font-serif), Cormorant Garamond, serif',
                fontSize: '22px',
                fontWeight: '600',
                color: '#191B1E',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}>RSVP</span>
            </div>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-serif), Cormorant Garamond, serif',
            fontSize: '24px',
            fontWeight: '400',
            color: '#191B1E',
            margin: 0,
            letterSpacing: '0.01em',
          }}>Create Account</h1>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
          {error && (
            <div style={{
              padding: '14px 16px',
              backgroundColor: '#FFF1F2',
              border: '1px solid #FECDD3',
              borderRadius: '8px',
              color: '#9F1239',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginBottom: '24px',
            }}>
              <svg style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '1px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="name" style={labelStyle}>Full Name</label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Julian Vance"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#B8944F'}
              onBlur={e => e.target.style.borderColor = '#E8E2D6'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="orgName" style={labelStyle}>Organization / Family Name</label>
            <input
              id="orgName"
              type="text"
              required
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="Vance-Sophia Wedding Suite"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#B8944F'}
              onBlur={e => e.target.style.borderColor = '#E8E2D6'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="email" style={labelStyle}>Email Address</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="host@example.com"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#B8944F'}
              onBlur={e => e.target.style.borderColor = '#E8E2D6'}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#B8944F'}
              onBlur={e => e.target.style.borderColor = '#E8E2D6'}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#B8944F',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              fontFamily: 'var(--font-sans), Lato, sans-serif',
              letterSpacing: '0.06em',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.55 : 1,
              transition: 'background-color 0.2s ease, opacity 0.2s ease',
            }}
            onMouseEnter={e => { if (!submitting) e.target.style.backgroundColor = '#a6833f'; }}
            onMouseLeave={e => { if (!submitting) e.target.style.backgroundColor = '#B8944F'; }}
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>

          <div style={{
            borderTop: '1px solid #E8E2D6',
            paddingTop: '20px',
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#77736A',
            fontFamily: 'var(--font-sans), Lato, sans-serif',
          }}>
            <span>Already hosting? </span>
            <Link href="/login" style={{
              color: '#B8944F',
              fontWeight: '700',
              textDecoration: 'none',
            }}>Log In</Link>
          </div>
        </form>

      </div>
    </div>
  );
}
