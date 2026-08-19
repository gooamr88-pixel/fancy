import React from "react";
import Link from "next/link";
import { C, SHADOW } from "./landingTokens";
import {
  HOMEPAGE_CAPABILITIES,
  REMAINING_CAPABILITY_COUNT,
} from "./platformCapabilities";

/* ═══════════════════════════════════════════════════════════════════════════
   WHAT'S IN THE BOX.

   WHY THIS SECTION IS NEW

   The homepage had no section like this at all. Thirteen real capabilities
   ship — seating charts, a door app that works offline, SMS with per-message
   refunds, right-to-left Arabic invitations, automatic reminders — and the
   front page named exactly none of them. It went from a hero, to occasion
   cards, to a hand-drawn dashboard, to testimonials. A visitor could read the
   whole thing and still not know whether this product does seating.

   The eight shown here are not typed out again: they come from
   platformCapabilities.js, the SAME array the /features page renders. Adding a
   capability puts it in front of visitors instead of only in the deep page
   nobody clicks, and retiring one takes it off the front page in the same
   commit rather than three months later.

   The "and N more" count is computed, not written, so it cannot go stale — a
   hardcoded "and 5 more" is wrong the first time anyone adds a feature, and
   wrong in the direction that makes the page look neglected.

   Server Component. No state, no effects, no client JavaScript.
   ═══════════════════════════════════════════════════════════════════════════ */

function CapabilityCard({ capability }) {
  return (
    <li className="cap-card">
      <span className="cap-icon" aria-hidden="true">{capability.icon}</span>
      <h3 className="cap-title">{capability.title}</h3>
      <p className="cap-short">{capability.short}</p>
    </li>
  );
}

export default function CapabilitiesSection() {
  return (
    <section className="cap" aria-labelledby="cap-title">
      <div className="fx-container fx-container--4xl fx-gutter">
        <header className="cap-head">
          <span className="cap-kicker">Everything in one place</span>
          <h2 id="cap-title" className="cap-h2">
            The parts you would otherwise stitch together yourself.
          </h2>
          <p className="cap-sub">
            A form builder, a guest list, a seating plan, a messaging system and a
            door scanner — built to know about each other, so a name you type once
            reaches all of them.
          </p>
        </header>

        {/* --fx-col 250px, arrived at by MEASURING rather than by dividing
            1200 by four. .fx-gutter sits on the same element as
            .fx-container--4xl, so the 48px desktop gutter comes OUT of the
            1200px, leaving 1104px of content: floor((1104 + 20) / (250 + 20))
            = 4 tracks. At 268px it worked out to 3, which left the eight
            cards as 3 + 3 + 2 with an orphan row. Below 1280 it steps
            4 → 3 → 2 → 1 on its own, no breakpoints. */}
        <ul className="cap-grid fx-grid" style={{ "--fx-col": "250px", "--fx-gap": "20px" }}>
          {HOMEPAGE_CAPABILITIES.map((c) => (
            <CapabilityCard key={c.key} capability={c} />
          ))}
        </ul>

        <div className="cap-more">
          <Link href="/features" className="cap-more-link">
            {REMAINING_CAPABILITY_COUNT > 0
              ? `And ${REMAINING_CAPABILITY_COUNT} more — see every feature`
              : "See every feature in detail"}
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

      {/* A PLAIN style element — styled-jsx cannot be imported from a Server
          Component, and this section has no interactivity to justify making it
          a Client one. Every class is prefixed `cap-`.

          Note what that also fixed: the icon rule was written `.cap-icon
          :global(svg)`, because styled-jsx would otherwise refuse to reach an
          SVG it did not itself render. In plain CSS a descendant selector is
          just a descendant selector. */}
      <style>{`
        .cap {
          width: 100%;
          background: ${C.white};
          padding-block: var(--fx-pad-y-sm);
        }
        .cap-card {
          min-width: 0;
          padding: 26px 24px 28px;
          border: 1px solid ${C.border};
          border-radius: var(--fx-r-md);
          background: ${C.white};
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .cap-card:hover {
          border-color: ${C.goldSoft};
          box-shadow: ${SHADOW.card};
          transform: translateY(-2px);
        }
        /* The icons are 48x48 SVGs; scaling them down here keeps the card
           compact without regenerating thirteen pieces of artwork. */
        .cap-icon { display: block; width: 38px; height: 38px; }
        .cap-icon svg { width: 100%; height: 100%; display: block; }
        .cap-title {
          font-family: var(--font-serif);
          font-size: 18px;
          font-weight: 600;
          line-height: 1.3;
          color: ${C.charcoal};
          margin: 16px 0 0;
        }
        .cap-short {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 300;
          line-height: 1.62;
          color: ${C.stone};
          margin: 8px 0 0;
        }
        .cap-head { max-width: 660px; margin-bottom: clamp(30px, 3.5vw, 46px); }
        .cap-kicker {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: ${C.goldInk};
        }
        .cap-h2 {
          font-family: var(--font-serif);
          font-size: clamp(27px, 1.417rem + 2.083vw, 42px);
          font-weight: 500;
          line-height: 1.16;
          letter-spacing: -0.4px;
          color: ${C.charcoal};
          margin: 14px 0 0;
        }
        .cap-sub {
          font-family: var(--font-sans);
          font-size: 16px;
          font-weight: 300;
          line-height: 1.7;
          color: ${C.stone};
          margin: 14px 0 0;
        }
        .cap-grid { list-style: none; margin: 0; padding: 0; }
        .cap-more { margin-top: 28px; }
        .cap-more-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: var(--fx-touch);
          font-family: var(--font-sans);
          font-size: 14.5px;
          font-weight: 600;
          text-decoration: none;
          color: ${C.goldInk};
          transition: gap 0.18s ease;
        }
        .cap-more-link:hover { gap: 11px; }
        /* On a PHONE the eight cards become eight compact ROWS — icon beside
           the words instead of above them.

           Stacked as tall cards they ran about 1,040px, which is two and a
           half phone screens for what is meant to be a scannable list, and
           "the page is too long" was the brief. Laid out this way the same
           eight take roughly 700px and read faster, because the eye follows
           one left edge instead of eight.

           Done in CSS on the existing markup, with no second component and no
           duplicated JSX for the two shapes. */
        @media (max-width: 639.98px) {
          .cap-card {
            display: grid;
            grid-template-columns: 34px minmax(0, 1fr);
            column-gap: 14px;
            align-items: start;
            padding: 18px 16px 20px;
          }
          .cap-icon {
            grid-row: 1 / span 2;
            width: 34px;
            height: 34px;
            margin-top: 2px;
          }
          .cap-title { margin: 0; font-size: 17px; }
          .cap-short { margin: 5px 0 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cap-card:hover { transform: none; }
          .cap-more-link:hover { gap: 7px; }
        }
      `}</style>
    </section>
  );
}
