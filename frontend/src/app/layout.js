import "./globals.css";
import { Outfit, Playfair_Display } from 'next/font/google';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata = {
  title: "Fancy RSVP - Premium Digital Invitations & RSVP Tracking",
  description: "Create and send premium online invitations with animated envelopes, built-in RSVP tracking, surveys, and background music.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${outfit.variable} ${playfair.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans text-foreground bg-background antialiased">{children}</body>
    </html>
  );
}

