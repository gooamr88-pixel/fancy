import { cache } from 'react';
import Navbar from '../components/landing/Navbar';
import FooterSection from '../components/landing/FooterSection';
import BlogListClient from './BlogListClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Cached within a single render so generateMetadata() and the page component
// share ONE backend call. Short revalidate window — this is a public,
// guest-agnostic listing, safe to cache briefly rather than hit the DB on
// every view (mirrors [slug]/page.js's own fetchEvent).
const fetchBlogPosts = cache(async () => {
  try {
    const res = await fetch(`${API_URL}/public/blog`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.posts || [];
  } catch {
    return [];
  }
});

export async function generateMetadata() {
  const title = 'Blog | Fancy RSVP';
  const description = 'Tips, trends, and inspiration for elegant events — from the Fancy RSVP team.';
  const canonicalUrl = 'https://fancyrsvp.com/blog';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Fancy RSVP',
      type: 'website',
      images: [{ url: 'https://fancyrsvp.com/og-image.png', width: 1200, height: 630, alt: 'Fancy RSVP' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: { canonical: canonicalUrl },
  };
}

export default async function BlogPage() {
  const posts = await fetchBlogPosts();

  return (
    <>
      <Navbar />
      <BlogListClient posts={posts} />
      <FooterSection />
    </>
  );
}
