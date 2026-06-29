import "./globals.css";
import { Playfair_Display, Lato, Great_Vibes, Aref_Ruqaa } from 'next/font/google';
import ToastHost from './components/ToastHost';

/* ═══ Google Fonts — Luxury Typography Stack ═══ */

/* HEADINGS: Elegant Serif Display — for H1, H2, section titles */
const playfair = Playfair_Display({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

/* BODY & BUTTONS: Clean premium Sans-Serif */
const lato = Lato({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-lato',
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

export const metadata = {
  title: "Fancy RSVP — Elegant RSVPs. Effortless Planning.",
  description: "The all-in-one RSVP and guest management platform for weddings and special events. Create beautiful digital invitations with real-time tracking.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${lato.variable} ${greatVibes.variable} ${arefRuqaa.variable}`}
    >
      <body>
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
