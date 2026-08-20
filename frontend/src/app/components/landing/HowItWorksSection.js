import React from "react";
import Link from "next/link";
import { C, T } from "./landingTokens";

/* ═══════════════════════════════════════════════════════════════════════════
   THE WHOLE PRODUCT IN THREE SENTENCES.

   WHAT THIS REPLACED

   `RSVPFlowSection.js` — 889 lines that hand-drew four phone screens, complete
   with a fake notch, a fake status bar reading 9:41, and invented form fields.
   It described the GUEST's four taps in exhaustive visual detail and never
   mentioned the organizer at all, which is backwards: the person reading this
   page is the one deciding whether to buy.

   WHAT IT DOES INSTEAD

   Three steps, in the order the organizer lives them: build it, send it, run
   the night. Each is one sentence, because the details are two bands further
   down and on /features.

   A Server Component: no state, no observer, no animation. The old one shipped
   24KB of client JavaScript to draw a picture.

   Deliberately no imagery. It sits between two heavily visual bands, and three
   more pictures here would make the middle of the page one long slideshow.

   ── 2026-08-20 ────────────────────────────────────────────────────────────
   Restyled onto the paper palette and Cormorant. The step numerals are set in
   the display face's ITALIC rather than in the body sans, which is the whole
   difference between a numbered list and a numbered list that looks composed.
   ═══════════════════════════════════════════════════════════════════════════ */

const STEPS = [
  {
    n: "01",
    title: "Build the invitation",
    body:
      "Pick a template, drop in your names, date and venue, and choose what the RSVP form should ask — meals, plus-ones, anything else you need. In English, Arabic, or both.",
    link: { href: "/features", label: "What you can ask for" },
  },
  {
    n: "02",
    title: "Send it and watch the replies",
    body:
      "Import your guest list, then send by email or SMS — each guest gets their own link. Replies land on your dashboard as they happen, and reminders go out on their own as the deadline nears.",
    link: { href: "/pricing", label: "What's included" },
  },
  {
    n: "03",
    title: "Seat them, then run the door",
    body:
      "Arrange tables by dragging names onto them, and let guests look up their own seat. On the night, scan tickets at the door from a tablet that keeps working with no internet at all.",
    link: { href: "/checkin-app", label: "See the door app" },
  },
];

function Step({ step }) {
  return (
    <li className="hiw-step">
      <span className="hiw-n" aria-hidden="true">{step.n}</span>
      <h3 className="hiw-title">{step.title}</h3>
      <p className="hiw-body">{step.body}</p>
      <Link href={step.link.href} className="hiw-link">
        {step.link.label}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </li>
  );
}

export default function HowItWorksSection() {
  return (
    <section className="hiw" aria-labelledby="hiw-title">
      <div className="fx-container fx-container--4xl fx-gutter">
        <header className="hiw-head">
          <span className="hiw-kicker">
            How it works
            <span aria-hidden="true" className="hiw-kicker__rule" />
          </span>
          {/* The roman numeral is the editorial device that says the page was
              composed rather than assembled. Decorative, so it is hidden. */}
          <span className="hiw-numeral" aria-hidden="true">IV</span>
          <h2 id="hiw-title" className="hiw-h2">
            Three steps, and you never open a spreadsheet.
          </h2>
        </header>

        {/* .fx-grid--3 walks 3 → 2 → 1 on its own from --fx-col, so this needs
            no breakpoints of its own. */}
        <ol className="hiw-steps fx-grid fx-grid--3" style={{ "--fx-gap": "clamp(28px, 3vw, 64px)" }}>
          {STEPS.map((s) => <Step key={s.n} step={s} />)}
        </ol>
      </div>

      {/* A PLAIN style element, not <style jsx>.

          styled-jsx cannot be imported from a Server Component — Next fails the
          build outright — and making this a Client Component purely to get CSS
          scoping would ship JavaScript for a section with no interactivity.
          Every class here is prefixed "hiw-", which is the same scoping
          guarantee by convention that the hash gave by machine.

          It also removes a trap: with styled-jsx the .hiw-link rule had to live
          in a SEPARATE global block, because next/link never receives the
          scoping hash and a scoped rule on one matches nothing.

          No backticks in the comments below — inside this template literal one
          would terminate the string and produce a parse error. */}
      <style>{`
        .hiw {
          width: 100%;
          background: ${C.paper2};
          padding: 76px 0;
        }
        .hiw-head {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          column-gap: 20px;
          max-width: 660px;
        }
        .hiw-kicker {
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
        .hiw-kicker__rule {
          display: block;
          flex: none;
          width: 28px;
          height: 1px;
          background: ${C.gold};
          opacity: 0.55;
        }
        .hiw-numeral {
          font-family: ${T.display};
          font-style: italic;
          font-size: 13px;
          color: ${C.gold};
          opacity: 0.75;
        }
        .hiw-h2 {
          grid-column: 1 / -1;
          font-family: ${T.display};
          font-weight: 300;
          font-size: 37px;
          line-height: 1.07;
          letter-spacing: -0.015em;
          color: ${C.ink};
          margin: 18px 0 0;
        }

        .hiw-steps {
          margin: 30px 0 0;
          padding: 0;
          list-style: none;
        }
        .hiw-step {
          padding: 26px 0;
          border-top: 1px solid ${C.border};
          min-width: 0;
        }
        .hiw-n {
          font-family: ${T.display};
          font-style: italic;
          font-size: 15px;
          color: ${C.goldInk};
        }
        .hiw-title {
          font-family: ${T.display};
          font-size: 26px;
          font-weight: 400;
          line-height: 1.18;
          letter-spacing: -0.01em;
          color: ${C.ink};
          margin: 10px 0 0;
        }
        .hiw-body {
          font-size: 13.5px;
          font-weight: 300;
          line-height: 1.8;
          color: ${C.inkSoft};
          margin: 10px 0 0;
        }
        .hiw-link {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          margin-top: 16px;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${C.ink};
          text-decoration: none;
          border-bottom: 1px solid ${C.gold};
          padding-bottom: 6px;
          transition: color 0.3s ease, border-color 0.3s ease;
        }
        .hiw-link:hover { color: ${C.goldInk}; border-color: ${C.goldInk}; }

        @media (min-width: 768px) {
          .hiw { padding: 128px 0; }
          .hiw-kicker { font-size: 11px; letter-spacing: 0.38em; gap: 16px; }
          .hiw-kicker__rule { width: 44px; }
          .hiw-numeral { font-size: 15px; }
          .hiw-h2 { font-size: 58px; margin-top: 22px; }
          .hiw-steps { margin-top: 60px; }
          .hiw-step { padding: 30px 0 0; }
          .hiw-title { font-size: 30px; margin-top: 12px; }
          .hiw-body { font-size: 14.5px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hiw-link { transition: none; }
        }
      `}</style>
    </section>
  );
}
