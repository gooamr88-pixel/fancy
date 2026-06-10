'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !orgName || !email || !password) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, orgName, email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      if (data.success) {
        // Save session credentials
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('org_id', data.organization.id);
        localStorage.setItem('user_role', data.user.role);
        
        // Redirect to dashboard
        router.push('/dashboard');
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
        <div className="absolute top-[10%] right-[-10%] w-[30rem] h-[30rem] rounded-full bg-emerald-100/30 dark:bg-emerald-950/15 filter blur-3xl animate-float-1"></div>
        <div className="absolute bottom-[10%] left-[-10%] w-[30rem] h-[30rem] rounded-full bg-amber-100/20 dark:bg-amber-900/10 filter blur-3xl animate-float-2"></div>
      </div>

      <div className="relative z-10 w-full max-w-md bg-card-bg border border-card-border/60 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
        
        {/* Header */}
        <div className="bg-stone-900 text-white p-8 text-center">
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-amber-500 font-bold block mb-2">Create Host Account</span>
          <h1 className="font-serif text-2xl font-light tracking-wide">
            FANCY<span className="font-light text-amber-500/75 mx-1.5">|</span>RSVP
          </h1>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/20 rounded-xl text-rose-800 dark:text-rose-300 text-sm flex items-start gap-2.5 animate-fade-in shadow-inner">
              <svg className="w-5 h-5 text-rose-600 dark:text-rose-455 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="name" className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">Full Name</label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Julian Vance"
              className="w-full px-4 py-2.5 border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-background text-foreground transition-all"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="orgName" className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">Organization / Family Name</label>
            <input
              id="orgName"
              type="text"
              required
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="Vance-Sophia Wedding Suite"
              className="w-full px-4 py-2.5 border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-background text-foreground transition-all"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">Email Address</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="host@example.com"
              className="w-full px-4 py-2.5 border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-background text-foreground transition-all"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-background text-foreground transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-brand-green hover:bg-brand-green-hover text-white rounded-xl font-bold tracking-wide transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50 border-b-2 border-emerald-700 mt-2"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="border-t border-card-border/60 pt-4 text-center text-xs text-muted-text font-medium">
            <span>Already hosting? </span>
            <Link href="/login" className="text-brand-green hover:underline font-bold">Log In</Link>
          </div>
        </form>

      </div>
    </div>
  );
}
