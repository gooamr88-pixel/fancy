import { Suspense } from "react";
import Navbar from "./components/landing/Navbar";
import HeroSection from "./components/landing/HeroSection";
import HowItWorksSection from "./components/landing/HowItWorksSection";
import TemplatesShowcaseSection from "./components/landing/TemplatesShowcaseSection";
import CapabilitiesSection from "./components/landing/CapabilitiesSection";
import DashboardShowcaseSection from "./components/landing/DashboardShowcaseSection";
import PrintedInvitationsSection from "./components/landing/PrintedInvitationsSection";
import ProofSection from "./components/landing/ProofSection";
import FaqCtaSection from "./components/landing/FaqCtaSection";
/* FAQS comes from faqContent.js, NOT from the section component. This file is
   a Server Component; importing a value from a 'use client' module gives you a
   client reference rather than the array, and the production build dies with
   "FAQS.map is not a function" at page-data collection. See faqContent.js. */
import { FAQS } from "./components/landing/faqContent";
import FooterSection from "./components/landing/FooterSection";
import LinkNoticeBanner from "./components/landing/LinkNoticeBanner";
import { safeJsonLdHtml } from "./utils/jsonLdSafe.mjs";

/* ═══════════════════════════════════════════════════════════════════════════
   THE HOMEPAGE.

   ── What this page used to be ────────────────────────────────────────────
   Thirteen bands, roughly 9,400px of desktop scroll and ~14,000px on a phone,
   of which about 1,900 lines were hand-drawn imitations of our own product:
   `DashboardPreviewSection` (1,029 lines, a fake dashboard) and
   `RSVPFlowSection` (889 lines, four fake phone screens). Both imitated
   components that actually ship and work.

   Worse than the length: the page never said what the product DOES. Thirteen
   real capabilities exist and it named none of them.

   ── What it is now ───────────────────────────────────────────────────────
   Nine bands, in a declared rhythm (see BAND_ORDER in landingTokens.js), each
   answering one question in the order a stranger asks them:

     1  hero          what is this, and what does it look like
     2  how it works  what would I actually do
     3  invitations   what does my guest get
     4  capabilities  what else is in it
     5  dashboard     what do I get
     6  printed       what else do you make
     7  proof         has anyone else done this
     8  faq + cta     my remaining objection, then the button
     9  footer        everything else

   Every screenshot is a photograph of the real component, produced by
   test/shots. Bands 6 and 7 render NOTHING until there is real data behind
   them, which is why the sequence has to read correctly with them absent —
   it does: 5 (warm) → 8 (dark) is still an alternation.

   ── Three things removed on purpose ──────────────────────────────────────
   • The "Perfect for Any Occasion" cards, which restated the occasion badges
     the invitations band already reads from `occasionPolicyFor`.
   • `SocialProofBar`, a whole 310px band for three numbers. The same three,
     from the same hook, are one line in the hero.
   • `ScrollReveal`. It server-rendered every section below the fold at
     `opacity: 0` and depended on an IntersectionObserver to bring them back,
     so a slow or failed hydration left the page blank below the hero — and it
     had no `prefers-reduced-motion` branch, so it animated regardless. Six
     observers for decoration was not a trade worth making.

   ── Code splitting was also removed, and that is not an oversight ────────
   The two dynamic() imports here existed because the sections they loaded
   were 39KB and 24KB of JavaScript that drew pictures. Their replacements are
   static markup around three <img> tags. Splitting them now would add a
   request and a loading placeholder to save nothing.
   ═══════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: 'Fancy RSVP — Invitations, RSVPs, seating and door check-in',
  description:
    'Send an invitation your guests actually open, collect their replies, seat them, and scan them in at the door — all from one place. Weddings, engagements and events.',
  openGraph: {
    title: 'Fancy RSVP — Invitations, RSVPs, seating and door check-in',
    description:
      'Digital invitations that open on film, live RSVP tracking, drag-and-drop seating, SMS, and a door scanner that works offline.',
    url: 'https://fancyrsvp.com',
    siteName: 'Fancy RSVP',
    type: 'website',
    images: [{ url: 'https://fancyrsvp.com/og-image.png', width: 1200, height: 630, alt: 'Fancy RSVP Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fancy RSVP — Invitations, RSVPs, seating and door check-in',
    description: 'Digital invitations, live RSVP tracking, seating and offline door check-in.',
    images: ['https://fancyrsvp.com/og-image.png'],
  },
  alternates: { canonical: 'https://fancyrsvp.com' },
};

const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Fancy RSVP',
  legalName: '16941460 Canada Corp.',
  alternateName: 'Via Marketing',
  url: 'https://fancyrsvp.com',
  logo: 'https://fancyrsvp.com/logo.png',
  email: 'info@fancyrsvp.com',
  description:
    'The all-in-one RSVP and guest management platform for weddings and special events. Owned and operated by 16941460 Canada Corp. o/a Via Marketing.',
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

/* Built from the SAME array the accordion renders, not typed out again. A
   hand-written copy of six answers beside a hand-written accordion is two
   sources of truth for the same sentences, and structured data that disagrees
   with the visible page is the kind Google penalises rather than ignores. */
const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export default function Home() {
  return (
    <div style={{ minHeight: "100dvh", background: "#FFFFFF" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(organizationLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdHtml(faqLd) }}
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
        {/* 1 · light — what is this */}
        <HeroSection />

        {/* 2 · warm — what would I do */}
        <HowItWorksSection />

        {/* 3 · dark — what my guest gets. Placed third rather than last
            because it is the most differentiated thing here, and on the old
            page it appeared nowhere at all. */}
        <TemplatesShowcaseSection />

        {/* 4 · light — what else is in it */}
        <CapabilitiesSection />

        {/* 5 · warm — what I get, in real screenshots */}
        <DashboardShowcaseSection />

        {/* 6 · light — the physical cards the same studio makes by hand, sold
            over WhatsApp rather than checkout. Renders nothing until an admin
            publishes a piece and leaves the homepage placement switched on. */}
        <PrintedInvitationsSection />

        {/* 7 · warm — press mentions and real reviews, both admin-managed.
            Renders nothing while both are empty, which is the state of a
            fresh install. */}
        <ProofSection />

        {/* 8 · dark — the last objection, then the button */}
        <FaqCtaSection />
      </main>

      {/* 9 · dark */}
      <FooterSection />
    </div>
  );
}
