import Navbar from "./components/landing/Navbar";
import HeroSection from "./components/landing/HeroSection";
import SocialProofBar from "./components/landing/SocialProofBar";
import RSVPFlowSection from "./components/landing/RSVPFlowSection";
import FeaturesSection from "./components/landing/FeaturesSection";
import DashboardPreviewSection from "./components/landing/DashboardPreviewSection";
import TestimonialsSection from "./components/landing/TestimonialsSection";
import PricingSection from "./components/landing/PricingSection";
import FAQSection from "./components/landing/FAQSection";
import CTASection from "./components/landing/CTASection";
import FooterSection from "./components/landing/FooterSection";
import ScrollReveal from "./components/landing/ScrollReveal";

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
        {/* Hero — no scroll reveal (above fold, loads immediately) */}
        <HeroSection />

        {/* Social Proof — counters have their own IntersectionObserver */}
        <SocialProofBar />

        {/* RSVP Flow — phone mockups slide in */}
        <ScrollReveal direction="up" duration={900}>
          <RSVPFlowSection />
        </ScrollReveal>

        {/* Features — cards with staggered reveal handled internally */}
        <ScrollReveal direction="up" duration={800}>
          <FeaturesSection />
        </ScrollReveal>

        {/* Dashboard Preview — the showpiece */}
        <ScrollReveal direction="up" duration={900} threshold={0.08}>
          <DashboardPreviewSection />
        </ScrollReveal>

        {/* Testimonials — social proof */}
        <ScrollReveal direction="up" duration={800}>
          <TestimonialsSection />
        </ScrollReveal>

        {/* Pricing */}
        <ScrollReveal direction="up" duration={800}>
          <PricingSection />
        </ScrollReveal>

        {/* FAQ */}
        <ScrollReveal direction="up" duration={800}>
          <FAQSection />
        </ScrollReveal>

        {/* Final CTA */}
        <ScrollReveal direction="fade" duration={1000}>
          <CTASection />
        </ScrollReveal>
      </main>
      <FooterSection />
    </div>
  );
}
