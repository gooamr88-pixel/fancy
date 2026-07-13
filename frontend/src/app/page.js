import dynamic from "next/dynamic";
import Navbar from "./components/landing/Navbar";
import HeroSection from "./components/landing/HeroSection";
import PressBar from "./components/landing/PressBar";
import SocialProofBar from "./components/landing/SocialProofBar";
import RSVPFlowSection from "./components/landing/RSVPFlowSection";
import FeaturesSection from "./components/landing/FeaturesSection";
import TestimonialsSection from "./components/landing/TestimonialsSection";
import FAQSection from "./components/landing/FAQSection";
import CTASection from "./components/landing/CTASection";
import FooterSection from "./components/landing/FooterSection";
import ScrollReveal from "./components/landing/ScrollReveal";
import { safeJsonLdHtml } from "./utils/jsonLdSafe.mjs";

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

// Below-the-fold decorative mockup (~1,000 lines) — code-split out of the
// homepage's initial bundle rather than shipped eagerly with the above-fold sections.
const DashboardPreviewSection = dynamic(() => import("./components/landing/DashboardPreviewSection"), {
  loading: () => <div style={{ minHeight: 900, background: "#F8F4EC" }} />,
});

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Fancy RSVP',
  url: 'https://fancyrsvp.com',
  logo: 'https://fancyrsvp.com/logo.png',
  description: 'The all-in-one RSVP and guest management platform for weddings and special events.',
  sameAs: [
    'https://www.instagram.com/viamarketing.ca/',
    'https://www.facebook.com/viamarketing.ca',
    'https://twitter.com/viamarketingca',
  ],
};

export default function Home() {
  return (
    <div style={{ minHeight: "100dvh", background: "#FFFFFF" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(jsonLd) }}
      />
      <Navbar />
      <main>
        {/* Hero — no scroll reveal (above fold, loads immediately) */}
        <HeroSection />

        {/* As Seen In — real, admin-managed press mentions/trust badges
            (see /admin/cms). Renders nothing until at least one is published. */}
        <PressBar />

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
