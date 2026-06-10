import "./globals.css";
import { Playfair_Display, Lato } from 'next/font/google';
import localFont from 'next/font/local';

/* ═══ Google Fonts — Luxury Typography Stack ═══ */

/* HEADINGS: Elegant Serif Display — for H1, H2, section titles */
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

/* BODY & BUTTONS: Clean premium Sans-Serif */
const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-lato',
  display: 'swap',
});

export const metadata = {
  title: "Fancy RSVP — Elegant RSVPs. Effortless Planning.",
  description: "The all-in-one RSVP and guest management platform for weddings and special events. Create beautiful digital invitations with real-time tracking.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${lato.variable}`}
    >
      <head>
        {/* LOGO SCRIPT FONT: High-end luxury cursive — Great Vibes via Google Fonts CDN */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
