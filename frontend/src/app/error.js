'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center bg-card-bg border border-card-border p-8 rounded-2xl shadow-xl">
        <span className="text-5xl">⚠️</span>
        <h2 className="text-xl font-bold mt-4 text-foreground">Something went wrong</h2>
        <p className="text-muted-text mt-2 text-sm leading-relaxed">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2 bg-brand-green hover:bg-brand-green-hover text-white text-sm rounded-lg font-bold transition"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-5 py-2 bg-sec-bg hover:bg-card-border text-foreground text-sm rounded-lg font-bold transition"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
