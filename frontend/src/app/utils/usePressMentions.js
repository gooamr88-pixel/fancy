'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Fetches the real, admin-managed "As Seen In" press mentions (published
 * only) that back the landing page's PressBar. Mirrors useTestimonials.js:
 * plain fetch (not publicApiFetch), since the endpoint intentionally
 * degrades to `{ success: false, pressMentions: [] }` on a backend error
 * (HTTP 200, see marketingController.getPublicPressMentions) — a landing-
 * page trust strip must never throw, it just renders nothing.
 */
export function usePressMentions() {
  const [pressMentions, setPressMentions] = useState(null); // null = still loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/public/press-mentions`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setPressMentions(Array.isArray(data.pressMentions) ? data.pressMentions : []);
      } catch {
        if (!cancelled) setPressMentions([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { pressMentions };
}
