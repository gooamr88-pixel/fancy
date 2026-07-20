// Sitemap of the public marketing/legal surface, plus every published blog
// post. Event pages are per-customer and deliberately excluded; the
// compliance-relevant URLs (/sms-opt-in, /privacy, /terms) are always present.
const BASE = 'https://fancyrsvp.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Individual /blog/[slug] posts were never listed here even after the real,
// admin-authored blog shipped — a real SEO-oriented blog needs its posts
// discoverable via the sitemap, not just linked from /blog. Best-effort:
// a fetch failure degrades to the static routes only, same as the blog
// pages' own fetch helpers.
async function fetchBlogSlugs() {
  try {
    const res = await fetch(`${API_URL}/public/blog`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []).map((p) => ({ slug: p.slug, publishedAt: p.published_at }));
  } catch {
    return [];
  }
}

export default async function sitemap() {
  const routes = [
    '',
    '/about',
    '/careers',
    '/contact',
    '/features',
    '/pricing',
    '/templates',
    '/integrations',
    '/help',
    '/blog',
    '/privacy',
    '/terms',
    '/sms-opt-in',
    '/solutions/planners',
    '/solutions/venues',
    '/solutions/corporate',
  ];
  const lastModified = new Date();
  const staticEntries = routes.map((path) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/sms-opt-in' || path === '/privacy' || path === '/terms' ? 0.8 : 0.6,
  }));

  const posts = await fetchBlogSlugs();
  const blogEntries = posts
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: p.publishedAt ? new Date(p.publishedAt) : lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    }));

  return [...staticEntries, ...blogEntries];
}
