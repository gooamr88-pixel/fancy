import React from "react";
import Link from "next/link";
import { C, T } from "./landingTokens";
import {
  HOMEPAGE_CAPABILITIES,
  REMAINING_CAPABILITY_COUNT,
} from "./platformCapabilities";

/* ═══════════════════════════════════════════════════════════════════════════
   WHAT IS ACTUALLY IN IT.

   The homepage had no section like this at all: thirteen real capabilities
   exist and the old page named none of them. The list is read from
   platformCapabilities.js, the SAME array the /features page renders, so a
   capability can never be on one page and missing from the other.

   ── 2026-08-20: two changes, both about how it reads ──────────────────────

   1. NO MORE CARDS. It was eight boxes with a 1px border and an icon in each,
      which is the single most generic pattern on the marketing web. It is now
      an editorial list: a hairline above each row, the number in the display
      face's italic, and nothing enclosing anything. The icons went with the
      boxes — eight small glyphs in a list this dense is visual noise, and the
      titles are already the fastest thing to scan.

   2. THE HEADING MOVED BESIDE THE LIST. Left-aligned heading over a full-width
      grid left the right third of the section empty at desktop, which is what
      made the lower half of the page feel like it was running out. Heading and
      argument now sit in their own column and the list fills the rest.

   A Server Component: no state, no client JavaScript.
   ═══════════════════════════════════════════════════════════════════════════ */

function Capability({ capability, index }) {
  return (
    <li className="cap-row">
      {/* The numeral is positional, not part of the capability's identity, so
          it is generated here rather than stored in platformCapabilities. */}
      <span className="cap-n" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="cap-min0">
        <h3 className="cap-title">{capability.title}</h3>
        <p className="cap-short">{capability.short}</p>
      </div>
    </li>
  );
}

export default function CapabilitiesSection() {
  return (
    <section className="cap" aria-labelledby="cap-title">
      <div className="fx-container fx-container--5xl fx-gutter cap-split">
        <header className="cap-head">
          <span className="cap-kicker">
            Everything in one place
            <span aria-hidden="true" className="cap-kicker__rule" />
          </span>
          <span className="cap-numeral" aria-hidden="true">IV</span>

          <h2 id="cap-title" className="cap-h2">
            The parts you would otherwise stitch together yourself.
          </h2>

          <p className="cap-sub">
            A form builder, a guest list, a seating plan, a messaging system and
            a door scanner — built to know about each other, so a name you type
            once reaches all of them.
          </p>

          {REMAINING_CAPABILITY_COUNT > 0 && (
            <Link href="/features" className="cap-more-link">
              And {REMAINING_CAPABILITY_COUNT} more
              <svg width="16" height="8" viewBox="0 0 16 8" fill="none" aria-hidden="true">
                <path d="M0 4h14M11 1l3 3-3 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </header>

        {/* .fx-grid walks the columns down on its own from --fx-col, so this
            needs no breakpoint of its own. A FIXED two-column grid here would
            not fit a phone — see AGENTS.md on min-content width. */}
        <ul className="cap-list fx-grid" style={{ "--fx-col": "260px", "--fx-gap": "0 56px" }}>
          {HOMEPAGE_CAPABILITIES.map((c, i) => (
            <Capability key={c.title} capability={c} index={i} />
          ))}
        </ul>
      </div>

      {/* A plain style element — styled-jsx cannot be imported from a Server
          Component, and a scoped rule would never reach the next/link above.
          Classes are prefixed "cap-" instead.

          No backticks in these CSS comments: one would end the template
          literal and produce a parse error. */}
      <style>{`
        .cap {
          width: 100%;
          background: ${C.paper2};
          padding: 76px 0;
        }
        .cap-split {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .cap-head {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          column-gap: 20px;
        }
        .cap-kicker {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-family: ${T.label};
          font-size: 10px;
          letter-spacing: 0.30em;
          text-transform: uppercase;
          color: ${C.goldInk};
          white-space: nowrap;
        }
        .cap-kicker__rule {
          display: block;
          flex: none;
          width: 28px;
          height: 1px;
          background: ${C.gold};
          opacity: 0.55;
        }
        .cap-numeral {
          font-family: ${T.display};
          font-style: italic;
          font-size: 13px;
          color: ${C.goldInk};
          opacity: 0.75;
        }
        .cap-h2 {
          grid-column: 1 / -1;
          font-family: ${T.display};
          font-weight: 300;
          font-size: 37px;
          line-height: 1.07;
          letter-spacing: -0.015em;
          color: ${C.ink};
          margin: 18px 0 0;
        }
        .cap-sub {
          grid-column: 1 / -1;
          font-size: 15.5px;
          font-weight: 300;
          line-height: 1.85;
          color: ${C.inkSoft};
          margin: 14px 0 0;
          max-width: 52ch;
        }
        .cap-more-link {
          grid-column: 1 / -1;
          justify-self: start;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-top: 26px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: ${C.ink};
          text-decoration: none;
          border-bottom: 1px solid ${C.gold};
          padding-bottom: 8px;
          transition: color 0.3s ease, border-color 0.3s ease;
        }
        .cap-more-link:hover { color: ${C.goldInk}; border-color: ${C.goldInk}; }

        .cap-list {
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .cap-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          column-gap: 16px;
          padding: 19px 0;
          border-top: 1px solid ${C.border};
        }
        /* A grid child sizes to max-content unless told otherwise, so without
           this a long capability title would push the row wider than the
           column and the whole band would scroll sideways on a phone. */
        .cap-min0 { min-width: 0; }
        .cap-n {
          font-family: ${T.display};
          font-style: italic;
          font-size: 13px;
          color: ${C.goldInk};
          padding-top: 6px;
        }
        .cap-title {
          font-family: ${T.display};
          font-size: 22px;
          font-weight: 400;
          line-height: 1.2;
          letter-spacing: -0.005em;
          color: ${C.ink};
          margin: 0;
        }
        .cap-short {
          font-size: 13px;
          font-weight: 300;
          line-height: 1.7;
          color: ${C.inkSoft};
          margin: 5px 0 0;
        }

        @media (min-width: 768px) {
          .cap { padding: 128px 0; }
          .cap-split {
            display: grid;
            grid-template-columns: minmax(0, 0.72fr) minmax(0, 1.28fr);
            gap: 88px;
            align-items: start;
          }
          .cap-kicker { font-size: 11px; letter-spacing: 0.38em; gap: 16px; }
          .cap-kicker__rule { width: 44px; }
          .cap-numeral { font-size: 15px; }
          .cap-h2 { font-size: 58px; margin-top: 22px; }
          .cap-sub { font-size: 18px; margin-top: 18px; max-width: 38ch; }
          .cap-more-link { margin-top: 34px; }
          .cap-row { padding: 22px 0; column-gap: 20px; }
          .cap-n { font-size: 14px; }
          .cap-title { font-size: 23px; }
          .cap-short { font-size: 13.5px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cap-more-link { transition: none; }
        }
      `}</style>
    </section>
  );
}
