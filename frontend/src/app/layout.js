import "./globals.css";
import { Cormorant_Garamond, Lato } from 'next/font/google';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

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
      className={`${cormorant.variable} ${lato.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
