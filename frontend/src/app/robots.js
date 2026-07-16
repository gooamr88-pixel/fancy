// Public robots.txt — nothing blocks compliance reviewers or crawlers from the
// marketing/legal/opt-in pages; only authenticated app surfaces are excluded.
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/admin/', '/checkin/', '/api/'],
      },
    ],
    sitemap: 'https://fancyrsvp.com/sitemap.xml',
  };
}
