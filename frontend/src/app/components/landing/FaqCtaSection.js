'use client';

/* See FooterSection: the test runner's classic JSX transform needs React in
   scope even though Next's automatic runtime would inject it. */
import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { C, ON_DARK } from './landingTokens';
import { FAQS } from './faqContent';

/* ═══════════════════════════════════════════════════════════════════════════
   THE LAST BAND — answers, then the ask.

   WHAT THIS REPLACED

   `FAQSection.js` (light, ~800px) followed by `CTASection.js` (dark, ~500px):
   two full bands, ~1,300px, for what is one moment in the page — the point
   where a reader has stopped learning and is deciding. Splitting them put a
   background change between the last objection and the button that answers
   it.

   TWO REAL CHANGES BEYOND MERGING

   1. The accordion is `<details>` / `<summary>`, not React state. The old one
      held an `openIndex` in `useState` and rebuilt aria-expanded by hand.
      Native disclosure gives the same behaviour with correct semantics, works
      before hydration and without JavaScript at all, and is what a search
      crawler reads. The only thing lost is "exactly one open at a time",
      which nobody asked for and which hides the answer you just opened when
      you open another.

   2. The questions live in `faqContent.js`, so page.js can emit FAQPage
      structured data from the SAME array that renders here. A hand-written
      JSON-LD block beside a hand-written accordion is two copies of six
      answers, and they drift. They are in a separate module rather than
      exported from this one because this one is a Client Component — see the
      note above the re-export below, and faqContent.js itself.

   ═══════════════════════════════════════════════════════════════════════════ */

/* The questions live in faqContent.js, a module with no 'use client'.
   They were exported from HERE, and page.js — a Server Component — imported
   them to build the FAQPage JSON-LD. That fails the production build outright
   ("FAQS.map is not a function"): a Server Component importing from a client
   module receives client REFERENCES, not values. Re-exported so existing
   importers of this file keep working. */
export { FAQS } from './faqContent';

function Faq({ item, index }) {
  return (
    <details className="faq-item" open={index === 0}>
      <summary>
        <span className="faq-q">{item.q}</span>
        <span className="faq-mark" aria-hidden="true" />
      </summary>
      <div className="faq-a">
        <p>{item.a}</p>
        {item.link && (
          <Link href={item.link.href} className="faq-a-link">{item.link.label}</Link>
        )}
      </div>


    </details>
  );
}

export default function FaqCtaSection() {
  const { isLoggedIn, loading } = useAuth();
  const signedIn = !loading && isLoggedIn;

  return (
    <section className="fc" aria-labelledby="fc-faq-title">
      <div aria-hidden="true" className="fc-shimmer" />
      <div aria-hidden="true" className="fc-glow" />

      <div className="fx-container fx-container--4xl fx-gutter fc-inner">
        {/* ── Answers ── */}
        <div className="fc-faq">
          <span className="fc-kicker">Before you ask</span>
          <h2 id="fc-faq-title" className="fc-h2">Questions we get.</h2>

          <div className="fc-list">
            {FAQS.map((item, i) => <Faq key={item.q} item={item} index={i} />)}
          </div>

          <p className="fc-more">
            Something not covered?{' '}
            <Link href="/help" className="fc-inline-link">Help centre</Link>
            {' · '}
            <Link href="/contact" className="fc-inline-link">Talk to us</Link>
          </p>
        </div>

        {/* ── The ask ── */}
        <aside className="fc-cta">
          <span className="fc-orn" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 38 32" fill="none">
              <rect x="2" y="8" width="34" height="22" rx="2" stroke={C.goldSoft} strokeWidth="1.6" />
              <path d="M2 10L19 22L36 10" stroke={C.goldSoft} strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M4 8L19 0L34 8" stroke={C.goldSoft} strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>

          <h2 className="fc-cta-title">Start with your first event.</h2>
          <p className="fc-cta-body">
            Build it, see exactly how it will look to a guest, and only pay when
            you are ready to send it.
          </p>

          <div className="fc-cta-actions">
            <Link href={signedIn ? '/dashboard' : '/register'} className="fc-btn">
              {signedIn ? 'Go to dashboard' : 'Create your event'}
            </Link>
            <Link href="/pricing" className="fc-btn fc-btn--ghost">See pricing</Link>
          </div>

          <ul className="fc-assure">
            <li>Free plan to start</li>
            <li>No credit card</li>
            <li>One-off price per event</li>
          </ul>
        </aside>
      </div>


      {/* ONE PLAIN STYLE ELEMENT, for the whole component.

          Two separate reasons, both of which this repo has already paid for:

          1. A <style jsx> block inside a NESTED, non-default-export component
             does not reliably compile in this build. AGENTS.md names the two
             cases that proved it (FooterLink, PrintPreviewModal) and both had
             to be moved out. The nested Faq component is exactly that
             pattern, and its CSS used to live inside it.

          2. styled-jsx stamps its hash class only onto lowercase intrinsic
             elements, so a scoped rule aimed at a class on a next/link
             compiles to .foo.jsx-hash and matches NOTHING. That is the bug
             that made every alert on this platform invisible, and the one
             that made the footer links unreadable in production.

          A plain <style> has neither failure mode. The scoping it gives up is
          replaced by a prefix on every class name, which is what
          PrintedInvitationsSection already does. */}
      <style>{`
        .faq-item {
          border-bottom: 1px solid ${ON_DARK.hairline};
        }
        .faq-item summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          /* --fx-touch guarantees the row stays tappable even if the question
             wraps to one short line at 320px. */
          min-height: var(--fx-touch);
          padding: 20px 0;
          cursor: pointer;
          list-style: none;
        }
        /* Safari draws its own disclosure triangle through a pseudo-element
           that list-style:none alone does not remove. */
        .faq-item summary::-webkit-details-marker { display: none; }
        .faq-item summary:focus-visible {
          outline: 2px solid ${C.goldSoft};
          outline-offset: 3px;
          border-radius: 4px;
        }
        .faq-q {
          font-family: var(--font-serif);
          font-size: clamp(16.5px, 0.958rem + 0.26vw, 19px);
          font-weight: 500;
          line-height: 1.4;
          color: ${ON_DARK.title};
          min-width: 0;
        }
        /* A plus that becomes a minus. Two bars, one rotated; the open state
           un-rotates it. Cheaper than swapping two icons and it animates. */
        .faq-mark {
          position: relative;
          flex-shrink: 0;
          width: 16px;
          height: 16px;
        }
        .faq-mark::before,
        .faq-mark::after {
          content: "";
          position: absolute;
          inset-inline: 0;
          top: 50%;
          height: 1.5px;
          background: ${C.goldSoft};
          transition: transform 0.22s ease;
        }
        .faq-mark::after { transform: rotate(90deg); }
        .faq-item[open] .faq-mark::after { transform: rotate(0deg); }

        .faq-a { padding: 0 0 22px; max-width: 68ch; }
        .faq-a p {
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 300;
          line-height: 1.78;
          color: ${ON_DARK.body};
          margin: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .faq-mark::before, .faq-mark::after { transition: none; }
        }

        .faq-a-link {
          display: inline-block;
          margin-top: 10px;
          font-family: var(--font-sans);
          font-size: 13.5px;
          font-weight: 600;
          color: #e4ce9b;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .faq-a-link:hover { color: #ffffff; }

        .fc {
          position: relative;
          width: 100%;
          overflow: hidden;
          background: linear-gradient(178deg, #14171a 0%, ${C.charcoal} 45%, #211e1a 100%);
          padding-block: var(--fx-pad-y-sm);
        }
        .fc-shimmer {
          position: absolute;
          inset-inline: 0;
          top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, ${C.goldSoft}, ${C.gold}, ${C.goldSoft}, transparent);
        }
        .fc-glow {
          position: absolute;
          inset-block: -25%;
          inset-inline-end: -10%;
          width: 55%;
          pointer-events: none;
          background: radial-gradient(ellipse at 60% 50%, rgba(184, 148, 79, 0.14), transparent 64%);
        }
        .fc-inner {
          position: relative;
          z-index: 1;
          display: grid;
          gap: clamp(40px, 5vw, 72px);
          align-items: start;
        }
        /* Answers get the wider track; the ask is a panel, not a column of
           reading. Two columns from lg up only: at 768px the 1.35fr track is
           about 400px, which wraps most of these questions onto three lines.
           1024px is one of the four allowed breakpoints; 900px, which is what
           this wanted, is not, and AGENTS.md is explicit that a fifth value is
           never introduced. */
        @media (min-width: 1024px) {
          .fc-inner { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); }
        }
        .fc-faq { min-width: 0; }

        .fc-kicker {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: ${C.goldSoft};
        }
        .fc-h2 {
          font-family: var(--font-serif);
          font-size: clamp(27px, 1.417rem + 2.083vw, 42px);
          font-weight: 500;
          line-height: 1.16;
          letter-spacing: -0.4px;
          color: ${ON_DARK.title};
          margin: 14px 0 22px;
        }
        .fc-list { border-top: 1px solid ${ON_DARK.hairline}; }
        .fc-more {
          margin: 22px 0 0;
          font-family: var(--font-sans);
          font-size: 14px;
          color: ${ON_DARK.muted};
        }

        /* ── The panel ── */
        .fc-cta {
          min-width: 0;
          padding: clamp(28px, 3.5vw, 40px);
          border: 1px solid rgba(184, 148, 79, 0.28);
          border-radius: var(--fx-r-lg);
          background: linear-gradient(160deg, rgba(184, 148, 79, 0.12), rgba(248, 244, 236, 0.03));
          /* Sticks alongside the answers on a tall desktop viewport. Safe
             here because nothing between this and the section root sets
             overflow — a single overflow:hidden on any ancestor makes
             position:sticky silently inert, which is exactly how the pricing
             table lost its pinned column. .fc itself DOES set overflow:hidden
             for the glow, but it is the containing block's SCROLLPORT that
             matters, and that is the page. */
          position: sticky;
          top: 96px;
        }
        @media (max-width: 1023.98px) {
          .fc-cta { position: static; }
        }
        .fc-orn { display: block; }
        .fc-cta-title {
          font-family: var(--font-serif);
          font-size: clamp(23px, 1.25rem + 1.04vw, 30px);
          font-weight: 500;
          line-height: 1.2;
          color: ${ON_DARK.title};
          margin: 18px 0 0;
        }
        .fc-cta-body {
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 300;
          line-height: 1.7;
          color: ${ON_DARK.body};
          margin: 12px 0 0;
        }
        .fc-cta-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 24px;
        }
        .fc-assure {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 16px;
          margin: 20px 0 0;
          padding: 0;
          list-style: none;
        }
        .fc-assure li {
          font-family: var(--font-sans);
          font-size: 12.5px;
          color: ${ON_DARK.muted};
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .fc-assure li::before {
          content: "";
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: ${C.gold};
          flex-shrink: 0;
        }

        .fc-inline-link {
          color: #e4ce9b;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .fc-inline-link:hover { color: #ffffff; }
        .fc-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: var(--fx-touch);
          padding: 13px 26px;
          border-radius: 8px;
          font-family: var(--font-sans);
          font-size: 14.5px;
          font-weight: 600;
          text-decoration: none;
          background: linear-gradient(135deg, #d7be80, #b8944f);
          color: #191b1e;
          border: 1px solid #b8944f;
          transition: transform 0.18s ease, background 0.18s ease;
        }
        .fc-btn:hover { transform: translateY(-1px); }
        .fc-btn--ghost {
          background: rgba(248, 244, 236, 0.06);
          color: #f8f4ec;
          border: 1px solid rgba(248, 244, 236, 0.28);
        }
        .fc-btn--ghost:hover { background: rgba(248, 244, 236, 0.12); }
        @media (prefers-reduced-motion: reduce) {
          .fc-btn:hover { transform: none; }
        }
      `}</style>
    </section>
  );
}
