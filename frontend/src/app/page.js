import { Suspense } from "react";
import Navbar from "./components/landing/Navbar";
import HeroSection from "./components/landing/HeroSection";
import HowItWorksSection from "./components/landing/HowItWorksSection";
import StatementSection from "./components/landing/StatementSection";
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
   Ten bands, in a declared rhythm (see BAND_ORDER in landingTokens.js), each
   answering one question in the order a stranger asks them:

     1  hero          what is this, and what does it look like
     2  invitations   what does my guest get
     3  statement     why should I care
     4  how it works  what would I actually do
     5  dashboard     what do I get
     6  capabilities  what else is in it
     7  printed       what else do you make
     8  proof         has anyone else done this
     9  faq + cta     my remaining objection, then the button
    10  footer        everything else

   Every screenshot is a photograph of the real component, produced by
   test/shots. Bands 7 and 8 render NOTHING until there is real data behind
   them, which is why the sequence has to read correctly with them absent —
   it does: 6 (warm) → 9 (light) → footer (deep) still alternates.

   ── The 2026-08-20 pass ──────────────────────────────────────────────────
   The page was correct and read as a template. Three things were behind that,
   and all three were structural rather than a matter of taste:

   • EVERY HEADING WAS SET IN A CAPITALS-ONLY FACE. `--font-serif` is Aboreto,
     which ships one weight and has no lowercase, so each headline was a whole
     sentence SHOUTED at a weight the browser had to fake. The display face is
     now Cormorant Garamond — already in the bundle, previously unused here.
   • TWO FULL DARK BANDS fought the invitation photography for attention. The
     page is now a warm paper scale with ONE ink block, the closing call to
     action, so the pictures carry all the colour.
   • THE SCREENSHOTS WERE PLACED, NOT PRESENTED — raw crops with a 1px border.
     They now sit in a browser window, a plate and a tablet body respectively.

   The invitations band also moved from third to second: the hero has just
   shown one invitation, so "what else is there" is the question actually
   being asked at that point in the scroll.

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
    <div style={{ minHeight: "100dvh", background: "#FCFBF8" }}>
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

        {/* 2 · warm — what my guest gets. Placed second rather than later
            because it is the most differentiated thing here, and because the
            hero has just shown one invitation: the question a reader has at
            that exact moment is "what else is there". */}
        <TemplatesShowcaseSection />

        {/* 3 · light — the printed pieces the same studio makes by hand, sold
            over WhatsApp rather than checkout. Renders nothing until an admin
            publishes a piece and leaves the homepage placement switched on.

            MOVED UP FROM SEVENTH (2026-08-21, at the owner's direction). It
            sat below four bands of software explanation, which put the
            highest-value order on the page behind the longest read. Here it
            answers the question the band above it just created: the reader has
            been shown three invitations and is looking at them — "can I hold
            one" is the next thought, not the seventh.

            It trades places with the statement band rather than displacing
            anything, so the light/warm alternation is untouched. The one cost:
            with no published products this band is absent, and invitations
            (warm) then meets how-it-works (warm) with no light band between
            them. That is a seam on a catalogue-less install, which is the
            state before anyone has anything to sell. */}
        <PrintedInvitationsSection />

        {/* 4 · warm — what would I actually do */}
        <HowItWorksSection />

        {/* 5 · light — what I get, in real screenshots */}
        <DashboardShowcaseSection />

        {/* 6 · warm — what else is in it */}
        <CapabilitiesSection />

        {/* 7 · light — one line, alone. The only band that argues rather than
            describes, and the reader's one place to stop before the proof and
            the closing question. */}
        <StatementSection />

        {/* 8 · deep — press mentions and real reviews, both admin-managed.
            Renders nothing while both are empty, which is the state of a
            fresh install — so the sequence has to read correctly with it
            absent, and it does: 7 (light) → 9 (light) still alternates against
            the deep footer below. */}
        <ProofSection />

        {/* 9 · light band holding the one ink block on the page */}
        <FaqCtaSection />
      </main>

      {/* 10 · deep */}
      <FooterSection />
    </div>
  );
}
