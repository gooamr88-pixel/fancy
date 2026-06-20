/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // HSTS (L2): enforce HTTPS for a year incl. subdomains (browsers ignore it on http/localhost in dev).
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // CSP (L2): existing policy hardened with object-src / base-uri / frame-ancestors
          // as defense-in-depth complementing the H2 JSON-LD escaping fix.
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' http://localhost:5000 https://*.supabase.co wss://*.supabase.co https://fancyrsvp.com https://accounts.google.com https://oauth2.googleapis.com https://maps.googleapis.com; frame-src 'self' https://accounts.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
