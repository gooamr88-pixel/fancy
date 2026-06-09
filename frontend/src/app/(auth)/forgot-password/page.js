'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const handleSubmit = async (e) => {
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
        throw new Error(data.message || 'Request failed.');
      }

      if (data.success) {
        setSubmitted(true);
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

        {/* Form Body */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <p className="text-xs text-muted-text leading-relaxed font-medium">
              Enter the email address registered to your host account. We will dispatch a password recovery link to you.
            </p>

            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/20 rounded-xl text-rose-800 dark:text-rose-300 text-sm flex items-start gap-2.5 animate-fade-in shadow-inner">
                <svg className="w-5 h-5 text-rose-600 dark:text-rose-455 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

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
              {submitting ? 'Sending link...' : 'Send Recovery Link'}
            </button>

            <div className="border-t border-card-border/60 pt-6 text-center text-xs text-muted-text font-medium">
              <span>Return to </span>
              <Link href="/login" className="text-brand-green hover:underline font-bold">Log In</Link>
            </div>
          </form>
        ) : (
          <div className="p-8 space-y-6 text-center">
            <span className="text-5xl block">✉️</span>
            <h2 className="text-xl font-bold text-stone-800 dark:text-stone-200">Recovery Email Dispatched</h2>
            <p className="text-xs text-muted-text leading-relaxed">
              If an account is registered with <strong className="text-foreground">{email}</strong>, a password reset link will arrive shortly.
            </p>
            <div className="border-t border-card-border/60 pt-6">
              <Link href="/login" className="text-brand-green hover:underline text-xs font-bold uppercase tracking-wider">
                Return to Login
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
