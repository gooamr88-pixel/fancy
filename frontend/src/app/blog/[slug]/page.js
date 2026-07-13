import { cache } from 'react';
import { notFound } from 'next/navigation';
import Navbar from '../../components/landing/Navbar';
import FooterSection from '../../components/landing/FooterSection';
import BlogPostClient from './BlogPostClient';
import { safeJsonLdHtml } from '../../utils/jsonLdSafe.mjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Cached within a single render so generateMetadata() and the page component
// share ONE backend call (mirrors [slug]/page.js's fetchEvent).
const fetchPost = cache(async (slug) => {
  try {
    const res = await fetch(`${API_URL}/public/blog/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.post || null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await fetchPost(slug);

  if (!post) {
    return { title: 'Article Not Found | Fancy RSVP' };
  }

  const title = `${post.meta_title || post.title} | Fancy RSVP Blog`;
  const description = post.meta_description || post.excerpt || `Read "${post.title}" on the Fancy RSVP blog.`;
  const canonicalUrl = `https://fancyrsvp.com/blog/${slug}`;
  const images = post.cover_image_url
    ? [{ url: post.cover_image_url, width: 1200, height: 630, alt: post.title }]
    : [{ url: 'https://fancyrsvp.com/og-image.png', width: 1200, height: 630, alt: 'Fancy RSVP' }];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Fancy RSVP',
      type: 'article',
      publishedTime: post.published_at || undefined,
      authors: post.author_name ? [post.author_name] : undefined,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((img) => img.url),
    },
    alternates: { canonical: canonicalUrl },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await fetchPost(slug);

  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.cover_image_url || undefined,
    datePublished: post.published_at || undefined,
    author: { '@type': 'Person', name: post.author_name },
    publisher: { '@type': 'Organization', name: 'Fancy RSVP', url: 'https://fancyrsvp.com' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://fancyrsvp.com/blog/${slug}` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(jsonLd) }}
      />
      <Navbar />
      <BlogPostClient post={post} />
      <FooterSection />
    </>
  );
}
