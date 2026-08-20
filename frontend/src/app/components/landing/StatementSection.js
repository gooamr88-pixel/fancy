import React from "react";
import { C, T } from "./landingTokens";

/* ═══════════════════════════════════════════════════════════════════════════
   ONE LINE, ALONE.

   WHY A BAND THAT SAYS ALMOST NOTHING EARNS ITS PLACE

   Every other band on this page is working: naming a capability, showing a
   screenshot, answering an objection. Nine of those in a row read as a
   catalogue no matter how well each one is set, because the reader never gets
   a moment to stop.

   This is that moment. It sits between the invitations (which are pictures)
   and how-it-works (which is instructions), and it is the only place on the
   page that states the argument rather than the features. Space used
   confidently is the cheapest luxury signal there is; a page that cannot
   afford to leave a screen almost empty is telling you what its budget was.

   A Server Component with no imports beyond the tokens — it holds no state and
   ships no JavaScript.

   The two hairlines above and below are 1px and 34/48px tall. They are what
   stop the line reading as a stray paragraph: without them it looks like copy
   somebody forgot to finish, and with them it reads as a pull quote.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function StatementSection() {
  return (
    <section className="stmt">
      <div className="fx-container fx-container--4xl fx-gutter stmt-inner">
        <span aria-hidden="true" className="stmt-rule" />
        <p className="stmt-line">
          An invitation is the first thing a guest holds of your evening.{" "}
          <em>It should behave like it.</em>
        </p>
        <span aria-hidden="true" className="stmt-rule" />
      </div>

      {/* A plain style element, for the reasons documented in
          HowItWorksSection: styled-jsx cannot be imported from a Server
          Component, and every class here is prefixed "stmt-" instead.

          No backticks inside these CSS comments — one would end the template
          literal and produce a parse error rather than a style bug. */}
      <style>{`
        .stmt {
          width: 100%;
          background: ${C.paper};
          padding: 62px 0;
        }
        .stmt-inner { text-align: center; }
        .stmt-rule {
          display: block;
          width: 1px;
          height: 34px;
          background: ${C.border};
          margin: 0 auto;
        }
        .stmt-line {
          font-family: ${T.display};
          font-weight: 300;
          font-size: 27px;
          line-height: 1.35;
          letter-spacing: -0.01em;
          color: ${C.ink};
          margin: 28px auto;
          max-width: 100%;
          text-wrap: pretty;
        }
        .stmt-line em {
          font-style: italic;
          color: ${C.gold};
        }

        @media (min-width: 768px) {
          .stmt { padding: 114px 0; }
          .stmt-rule { height: 48px; }
          .stmt-line {
            font-size: 42px;
            margin: 40px auto;
            max-width: 20ch;
          }
        }
      `}</style>
    </section>
  );
}
