'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/apiClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        // Store non-sensitive display metadata only (auth is via httpOnly cookie)
        localStorage.setItem('org_id', data.organization.id);
        localStorage.setItem('user_role', data.user.role);
        
        // Redirect to organizer dashboard
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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
          }}>Organizer Login</h1>
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

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '10px',
              fontWeight: '700',
              color: '#77736A',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: '6px',
              fontFamily: 'var(--font-sans), Lato, sans-serif',
            }}>Email Address</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="organizer@example.com"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #E8E2D6',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                color: '#191B1E',
                fontSize: '14px',
                fontFamily: 'var(--font-sans), Lato, sans-serif',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#B8944F'}
              onBlur={e => e.target.style.borderColor = '#E8E2D6'}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label htmlFor="password" style={{
                fontSize: '10px',
                fontWeight: '700',
                color: '#77736A',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontFamily: 'var(--font-sans), Lato, sans-serif',
              }}>Password</label>
              <Link href="/forgot-password" style={{
                fontSize: '10px',
                fontWeight: '700',
                color: '#B8944F',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                textDecoration: 'none',
                fontFamily: 'var(--font-sans), Lato, sans-serif',
              }}>Forgot?</Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #E8E2D6',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                color: '#191B1E',
                fontSize: '14px',
                fontFamily: 'var(--font-sans), Lato, sans-serif',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                boxSizing: 'border-box',
              }}
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
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>

          <div style={{
            borderTop: '1px solid #E8E2D6',
            paddingTop: '24px',
            marginTop: '28px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#77736A',
            fontFamily: 'var(--font-sans), Lato, sans-serif',
          }}>
            <span>New host? </span>
            <Link href="/register" style={{
              color: '#B8944F',
              fontWeight: '700',
              textDecoration: 'none',
            }}>Create an account</Link>
          </div>
        </form>

      </div>
    </div>
  );
}
