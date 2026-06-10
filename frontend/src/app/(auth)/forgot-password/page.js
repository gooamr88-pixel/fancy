'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & Reset, 3: Success
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  // Step 1: Request OTP Code
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to request OTP code.');
      }

      if (data.success) {
        setStep(2);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify OTP and Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp,
          newPassword,
          confirmPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password.');
      }

      if (data.success) {
        setStep(3);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 selection:bg-brand-green/20">
      
      {/* Floating Organic Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[-10%] w-[30rem] h-[30rem] rounded-full bg-emerald-100/30 dark:bg-emerald-950/15 filter blur-3xl animate-float-1"></div>
        <div className="absolute bottom-[10%] right-[-10%] w-[30rem] h-[30rem] rounded-full bg-amber-100/20 dark:bg-amber-900/10 filter blur-3xl animate-float-2"></div>
      </div>

      <div className="relative z-10 w-full max-w-md bg-card-bg border border-card-border/60 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
        
        {/* Header */}
        <div className="bg-stone-900 text-white p-8 text-center">
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-amber-500 font-bold block mb-2">Reset Password</span>
          <h1 className="font-serif text-2xl font-light tracking-wide">
            FANCY<span className="font-light text-amber-500/75 mx-1.5">|</span>RSVP
          </h1>
        </div>

        {/* Error alert container */}
        {error && (
          <div className="mx-8 mt-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/20 rounded-xl text-rose-800 dark:text-rose-300 text-sm flex items-start gap-2.5 animate-fade-in shadow-inner">
            <svg className="w-5 h-5 text-rose-600 dark:text-rose-455 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Request OTP Form */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="p-8 space-y-6">
            <p className="text-xs text-muted-text leading-relaxed font-medium">
              Enter your registered organizer email address. We will dispatch a 6-digit verification code to reset your password.
            </p>

            <div className="space-y-1">
              <label htmlFor="email" className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">Email Address</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="host@example.com"
                className="w-full px-4 py-3 border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-background text-foreground transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-brand-green hover:bg-brand-green-hover text-white rounded-xl font-bold tracking-wide transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50 border-b-2 border-emerald-700 mt-2"
            >
              {submitting ? 'Sending OTP Code...' : 'Request OTP Code'}
            </button>

            <div className="border-t border-card-border/60 pt-6 text-center text-xs text-muted-text font-medium">
              <span>Return to </span>
              <Link href="/login" className="text-brand-green hover:underline font-bold">Log In</Link>
            </div>
          </form>
        )}

        {/* Step 2: Enter OTP & New Password Form */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} className="p-8 space-y-5">
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/10 rounded-xl">
              <p className="text-xs text-emerald-800 dark:text-emerald-400 leading-relaxed font-medium">
                A verification code has been sent to <strong className="text-foreground">{email}</strong>. Please enter the OTP and set your new password below.
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="otp" className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">6-Digit OTP Code</label>
              <input
                id="otp"
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full px-4 py-3 border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-background text-foreground transition-all text-center tracking-widest font-mono text-lg font-bold"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="newPassword" className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">New Password</label>
              <input
                id="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-background text-foreground transition-all"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">Confirm New Password</label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-background text-foreground transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-brand-green hover:bg-brand-green-hover text-white rounded-xl font-bold tracking-wide transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50 border-b-2 border-emerald-700 mt-3"
            >
              {submitting ? 'Resetting Password...' : 'Reset Password'}
            </button>

            <div className="flex items-center justify-between border-t border-card-border/60 pt-5 text-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-muted-text hover:text-foreground font-semibold flex items-center gap-1 transition-colors"
              >
                ← Back
              </button>
              <Link href="/login" className="text-brand-green hover:underline font-bold">Return to Login</Link>
            </div>
          </form>
        )}

        {/* Step 3: Success Screen */}
        {step === 3 && (
          <div className="p-8 space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800/30 shadow-inner">
              <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-serif font-light text-stone-850 dark:text-stone-150">Password Updated</h2>
              <p className="text-xs text-muted-text leading-relaxed">
                Your password has been successfully updated on the remote database. You can now log in using your new credentials.
              </p>
            </div>
            <div className="border-t border-card-border/60 pt-6">
              <Link
                href="/login"
                className="w-full block py-3.5 bg-brand-green hover:bg-brand-green-hover text-white rounded-xl font-bold tracking-wide transition-all text-center border-b-2 border-emerald-700 shadow-md"
              >
                Log In Now
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
