// Static sitemap of the public marketing/legal surface. Event pages are
// per-customer and deliberately excluded; the compliance-relevant URLs
// (/sms-opt-in, /privacy, /terms) are always present.
const BASE = 'https://fancyrsvp.com';

export default function sitemap() {
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
  return routes.map((path) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/sms-opt-in' || path === '/privacy' || path === '/terms' ? 0.8 : 0.6,
  }));
}
