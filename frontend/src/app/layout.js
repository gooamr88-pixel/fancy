import "./globals.css";
import { Aboreto, Google_Sans, Great_Vibes, Aref_Ruqaa, Playfair_Display, Montserrat, Dancing_Script, Mrs_Saint_Delafield, Amiri, El_Messiri, Reem_Kufi, Tajawal, Cormorant_Garamond } from 'next/font/google';
import ToastHost from './components/ToastHost';

/* ═══ Google Fonts — Core Brand Typography Stack ═══
   Primary display (Aboreto) and secondary (Google Sans) are the platform's
   OWN chrome — landing pages, the dashboard, guest-page UI shell. They are
   NOT the only fonts organizers can pick for their invitation card text:
   FontPicker.js exposes a much larger catalogue (still including Cormorant
   Garamond and EB Garamond, the previous pair) for that per-event choice,
   which is unrelated to the brand's own default.
   Also deliberately untouched here: InvitationReveal.js's envelope and
   GuestPassGenerator.js's ticket both hard-code their own font stack rather
   than reading --font-serif/--font-sans, specifically so a change to the
   platform's brand typography (like this one) can never alter those two
   purpose-built layouts out from under them. */

/* HEADINGS / DISPLAY: Aboreto — an engraved, small-caps-like display face.
   Google Fonts ships it in a single weight (400, normal only); the many
   fontWeight: 600/700 requests already scattered through the app's inline
   styles still work, they just render as the browser's own synthetic bold
   rather than a true bold cut — the expected way to use a single-weight
   display face, not a regression. */
const aboreto = Aboreto({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  variable: '--font-heading',
  display: 'swap',
});

/* BODY & BUTTONS: Google Sans, self-hosted the same way as every other font
   here. Confirmed present in next/font's own Google Fonts metadata (the exact
   family "Google Sans", not a same-named lookalike) before wiring it in —
   next/font/google only ever resolves names that are actually published on
   fonts.google.com, so this is the real, openly-licensed family. */
const googleSans = Google_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
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

/* INVITATION REVEAL: the envelope's copperplate script. Declared here so it is
   SELF-HOSTED with the rest of the stack — InvitationReveal.js used to pull it
   from fonts.googleapis.com at mount time, which put a third-party host on the
   critical path of the first thing a guest ever sees. */
const mrsSaintDelafield = Mrs_Saint_Delafield({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-delafield',
  display: 'swap',
});

/* ═══ Cinematic templates (Velvet Ring, Door of Joy) ═══
   These two invitation templates are Arabic-first and their look rests on a
   purpose-picked Arabic type pairing — an ornate calligraphic face for the
   couple's names, a naskh for the verse, a kufi/geometric for section labels
   and a humanist sans for body copy. Aref Ruqaa (above) already covers the
   first role.

   SELF-HOSTED, like every other face here, and that is the whole point: the
   original templates pulled these from fonts.googleapis.com at render time.
   See the note in [slug]/EventPageClient.js — that host is blackholed in
   several countries and by many corporate proxies, a blackholed host hangs
   rather than fails, and a <link rel=stylesheet> blocks rendering while it is
   pending. Loading them here means the invitation cannot freeze on a font.

   Weights are trimmed to exactly what the openings and heroes use; adding a
   weight is cheap, but shipping the full family is not. */
const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-amiri',
  display: 'swap',
});

const elMessiri = El_Messiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-messiri',
  display: 'swap',
});

const reemKufi = Reem_Kufi({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-reem',
  display: 'swap',
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
});

/* The Latin accent word ("Engagement") set above the couple's names on the
   Velvet Ring hero — the one piece of Latin type in an otherwise Arabic
   composition, so it gets an italic old-style serif rather than borrowing one
   of the Arabic faces' Latin cuts. */
const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
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
      className={`${aboreto.variable} ${googleSans.variable} ${greatVibes.variable} ${arefRuqaa.variable} ${playfairDisplay.variable} ${montserrat.variable} ${dancingScript.variable} ${mrsSaintDelafield.variable} ${amiri.variable} ${elMessiri.variable} ${reemKufi.variable} ${tajawal.variable} ${cormorantGaramond.variable}`}
    >
      <body>
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
