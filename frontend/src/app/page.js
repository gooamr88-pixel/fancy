import Navbar from "./components/landing/Navbar";
import HeroSection from "./components/landing/HeroSection";
import RSVPFlowSection from "./components/landing/RSVPFlowSection";
import DashboardPreviewSection from "./components/landing/DashboardPreviewSection";
import PricingSection from "./components/landing/PricingSection";
import FooterSection from "./components/landing/FooterSection";

export const metadata = {
  title: 'Fancy RSVP — Elegant RSVPs. Effortless Planning.',
  description: 'The all-in-one RSVP and guest management platform for weddings and special events. Create beautiful digital invitations with real-time tracking.',
  openGraph: {
    title: 'Fancy RSVP — Elegant RSVPs. Effortless Planning.',
    description: 'Create beautiful digital invitations with real-time RSVP tracking, seating management, and SMS campaigns.',
    url: 'https://fancyrsvp.com',
    siteName: 'Fancy RSVP',
    type: 'website',
    images: [{ url: 'https://fancyrsvp.com/og-image.png', width: 1200, height: 630, alt: 'Fancy RSVP Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fancy RSVP — Elegant RSVPs. Effortless Planning.',
    description: 'Create beautiful digital invitations with real-time RSVP tracking.',
    images: ['https://fancyrsvp.com/og-image.png'],
  },
  alternates: { canonical: 'https://fancyrsvp.com' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Fancy RSVP',
  url: 'https://fancyrsvp.com',
  logo: 'https://fancyrsvp.com/logo.png',
  description: 'The all-in-one RSVP and guest management platform for weddings and special events.',
  sameAs: [],
};

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main>
        <HeroSection />
        <RSVPFlowSection />
        <DashboardPreviewSection />
        <PricingSection />
      </main>
      <FooterSection />
    </div>
  );
}
