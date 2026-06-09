import "./globals.css";

export const metadata = {
  title: "Fancy RSVP - Premium Digital Invitations & RSVP Tracking",
  description: "Create and send premium online invitations with animated envelopes, built-in RSVP tracking, surveys, and background music.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans text-foreground bg-background antialiased">{children}</body>
    </html>
  );
}

