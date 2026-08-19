import dynamic from "next/dynamic";
import Navbar from "./components/landing/Navbar";
import HeroSection from "./components/landing/HeroSection";
import PressBar from "./components/landing/PressBar";
import SocialProofBar from "./components/landing/SocialProofBar";
import RSVPFlowSection from "./components/landing/RSVPFlowSection";
import TestimonialsSection from "./components/landing/TestimonialsSection";
import FAQSection from "./components/landing/FAQSection";
import CTASection from "./components/landing/CTASection";
import FooterSection from "./components/landing/FooterSection";
import PrintedInvitationsSection from "./components/landing/PrintedInvitationsSection";
import ScrollReveal from "./components/landing/ScrollReveal";
import LinkNoticeBanner from "./components/landing/LinkNoticeBanner";
import { safeJsonLdHtml } from "./utils/jsonLdSafe.mjs";
import { Suspense } from "react";

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

// Six full-bleed invitation screenshots. Split out for the same reason: they
// sit below the fold and must not delay the hero.
const TemplatesShowcaseSection = dynamic(() => import("./components/landing/TemplatesShowcaseSection"), {
  loading: () => <div style={{ minHeight: 700, background: "#191B1E" }} />,
});

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Fancy RSVP',
  legalName: '16941460 Canada Corp.',
  alternateName: 'Via Marketing',
  url: 'https://fancyrsvp.com',
  logo: 'https://fancyrsvp.com/logo.png',
  description: 'The all-in-one RSVP and guest management platform for weddings and special events. Owned and operated by 16941460 Canada Corp. o/a Via Marketing.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '2488 Selord Court',
    addressLocality: 'Mississauga',
    addressRegion: 'ON',
    postalCode: 'L5J 1P7',
    addressCountry: 'CA',
  },
  sameAs: [
    'https://viamarketing.ca',
    'https://www.instagram.com/viamarketing.ca/',
    'https://www.facebook.com/viamarketing.ca',
  ],
};

export default function Home() {
  return (
    <div style={{ minHeight: "100dvh", background: "#FFFFFF" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(jsonLd) }}
      />
      {/* Above the navbar, because a guest who arrived here from a dead
          invitation link is not browsing — they are looking for an answer, and
          it has to be the first thing on the page. Suspense keeps the rest of
          this page statically generated despite the client-side query read. */}
      <Suspense fallback={null}>
        <LinkNoticeBanner />
      </Suspense>
      <Navbar />
      <main>
        {/* Hero — no scroll reveal (above fold, loads immediately) */}
        <HeroSection />

        {/* The invitations themselves — real screenshots of the three
            cinematic templates rendering, placed high because they are the
            most differentiated thing here and appeared on this page nowhere. */}
        <ScrollReveal direction="up" duration={900} threshold={0.08}>
          <TemplatesShowcaseSection />
        </ScrollReveal>

        {/* As Seen In — real, admin-managed press mentions/trust badges
            (see /admin/cms). Renders nothing until at least one is published. */}
        <PressBar />

        {/* Social Proof — counters have their own IntersectionObserver */}
        <SocialProofBar />

        {/* RSVP Flow — phone mockups slide in */}
        <ScrollReveal direction="up" duration={900}>
          <RSVPFlowSection />
        </ScrollReveal>

        {/* Dashboard Preview — the showpiece */}
        <ScrollReveal direction="up" duration={900} threshold={0.08}>
          <DashboardPreviewSection />
        </ScrollReveal>

        {/* Printed Invitations — the physical cards the studio makes by hand,
            sold by WhatsApp rather than checkout (/printed-invitations).
            Placed after the product story rather than inside it: this is a
            second thing we make, not a feature of the first. Renders nothing
            until an admin publishes a piece and leaves the homepage placement
            switched on. */}
        <ScrollReveal direction="up" duration={900} threshold={0.08}>
          <PrintedInvitationsSection />
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
