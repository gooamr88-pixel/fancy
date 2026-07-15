import "./globals.css";
import { Cormorant_Garamond, EB_Garamond, Great_Vibes, Aref_Ruqaa, Playfair_Display, Montserrat, Dancing_Script } from 'next/font/google';
import ToastHost from './components/ToastHost';

/* ═══ Google Fonts — Formal Typography Stack ═══ */

/* HEADINGS: Classic engraved-invitation serif — for H1, H2, section titles */
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
});

/* BODY & BUTTONS: Formal serif body text */
const ebGaramond = EB_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
});

/* LOGO / BRAND MOMENTS: High-end luxury cursive script */
const greatVibes = Great_Vibes({
  subsets: ['latin', 'latin-ext'],
  weight: ['400'],
  variable: '--font-script',
  display: 'swap',
});

/* ARABIC CALLIGRAPHY: ornate display script for the invitation seal & titles */
const arefRuqaa = Aref_Ruqaa({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-aref',
  display: 'swap',
});

/* ═══ Additional heading fonts — the Custom template's "Heading Typography"
   picker (CustomBuilder.js) offers these alongside the three above, so
   organizers building a from-scratch page get real stylistic variety
   (a bold display serif, a true geometric sans, a second, more playful
   script) instead of only the three baked into the core brand stack. ═══ */
const playfairDisplay = Playfair_Display({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

const dancingScript = Dancing_Script({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dancing',
  display: 'swap',
});

export const metadata = {
  title: "Fancy RSVP — Elegant RSVPs. Effortless Planning.",
  description: "The all-in-one RSVP and guest management platform for weddings and special events. Create beautiful digital invitations with real-time tracking.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    // Was sitting unused in /public — iOS reaches for this specific file when
    // a guest/organizer adds the site to their home screen, otherwise it
    // falls back to a plain screenshot of the page as the "icon".
    apple: "/apple-touch-icon.png",
  },
  // MOB-13: lets "Add to Home Screen" open as a standalone app (own title,
  // no Safari chrome) instead of just bookmarking the URL.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fancy RSVP",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // MOB-13: tints the browser's own UI chrome (Android Chrome's address bar,
  // iOS Safari's toolbar in some contexts) to match the brand instead of
  // defaulting to plain white/grey — the one contrast-safe gold, not the
  // decorative --champagne-gold.
  themeColor: "#8A6D34",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${ebGaramond.variable} ${greatVibes.variable} ${arefRuqaa.variable} ${playfairDisplay.variable} ${montserrat.variable} ${dancingScript.variable}`}
    >
      <body>
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
