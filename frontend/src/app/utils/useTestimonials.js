'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Fetches the real, admin-managed testimonials (published only) that back
 * the landing page's TestimonialsSection. Plain fetch rather than
 * publicApiFetch: the endpoint intentionally degrades to
 * `{ success: false, testimonials: [] }` on a backend error (HTTP 200, see
 * marketingController.getPublicTestimonials) so a landing-page decoration
 * never throws — it just renders nothing.
 */
export function useTestimonials() {
  const [testimonials, setTestimonials] = useState(null); // null = still loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/public/testimonials`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setTestimonials(Array.isArray(data.testimonials) ? data.testimonials : []);
      } catch {
        if (!cancelled) setTestimonials([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { testimonials };
}
