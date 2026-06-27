'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

export default function GuestRSVPResolverPage({ params }) {
  const resolvedParams = use(params);
  const guestId = resolvedParams.guestId;
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!guestId) return;

    async function resolveGuest() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
        const res = await fetch(`${apiUrl}/public/rsvp/guest/${guestId}`);
        if (!res.ok) {
          throw new Error('Guest invitation link is invalid or expired.');
        }
        const data = await res.json();
        if (data.success && data.data?.slug) {
          router.replace(`/${data.data.slug}/rsvp?g=${guestId}`);
        } else {
          throw new Error('Could not find event associated with this invitation.');
        }
      } catch (err) {
        setError(err.message);
      }
    }

    resolveGuest();
  }, [guestId, router]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', background: '#FFFFFF', border: '1px solid #E8E2D6', padding: '48px 32px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: '48px' }}>⚠️</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: '#C45E5E', marginTop: '12px' }}>Invalid Invitation Link</h1>
          <p style={{ color: '#77736A', marginTop: '12px', fontSize: '14px', lineHeight: 1.7, fontWeight: 300 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#77736A', fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 300 }}>Verifying invitation ticket...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
