'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Same numbers the DB column defaults to (supabase/migrations/20260708000001_landing_stats.sql).
// Only used if the request fails outright — the real values always come from the backend.
export const FALLBACK_STATS = [
  { label: 'Events Created', target: 10000, suffix: '+', decimals: 0 },
  { label: 'Guests Managed', target: 50000, suffix: '+', decimals: 0 },
  { label: 'Platform Uptime', target: 99.9, suffix: '%', decimals: 1 },
];

/**
 * Fetches the landing-page stat counters. "Events Created" and "Guests
 * Managed" are a real COUNT(*) computed server-side, not admin-typed numbers
 * — only "Platform Uptime" stays admin-set (see backend/routes/publicRoutes.js
 * and the `source` field on each super_admin_config.landing_stats entry).
 * Mirrors usePressMentions.js: plain fetch, degrades to FALLBACK_STATS on any
 * error so the counters never block the landing page.
 */
export function useLandingStats() {
  const [stats, setStats] = useState(null); // null = still loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/public/landing-stats`);
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data.stats) && data.stats.length ? data.stats : FALLBACK_STATS;
        if (!cancelled) setStats(list);
      } catch {
        if (!cancelled) setStats(FALLBACK_STATS);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { stats: stats || FALLBACK_STATS };
}

// Formats a { target, suffix, decimals } stat entry into display text, e.g.
// "10,000+" or "99.9%" — for pages that show the number as static text
// rather than running SocialProofBar's animated counter.
export function formatStatValue({ target, suffix = '', decimals = 0 }) {
  const num = decimals > 0
    ? Number(target).toFixed(decimals)
    : Math.floor(Number(target)).toLocaleString('en-US');
  return `${num}${suffix}`;
}
