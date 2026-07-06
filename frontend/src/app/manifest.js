/**
 * App Router manifest convention — Next.js auto-serves this at
 * /manifest.webmanifest and links it in <head>, no metadata.manifest field
 * needed. Wires up the icon-192/icon-512/icon-transparent-512 assets that
 * were already sitting in /public unused, and lets guests/organizers add
 * Fancy RSVP to their home screen as a standalone app instead of a bare tab.
 */
export default function manifest() {
  return {
    name: 'Fancy RSVP — Elegant RSVPs. Effortless Planning.',
    short_name: 'Fancy RSVP',
    description: 'The all-in-one RSVP and guest management platform for weddings and special events.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8F4EC',
    theme_color: '#8A6D34',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-transparent-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
