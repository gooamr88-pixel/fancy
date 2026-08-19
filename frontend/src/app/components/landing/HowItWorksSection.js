import React from "react";
import Link from "next/link";
import { C } from "./landingTokens";

/* ═══════════════════════════════════════════════════════════════════════════
   THE WHOLE PRODUCT IN THREE SENTENCES.

   WHAT THIS REPLACED

   `RSVPFlowSection.js` — 889 lines that hand-drew four phone screens
   (`Screen1_InvitationLanding` … `Screen4_Confirmation`), complete with a
   fake notch, a fake status bar reading 9:41, and invented form fields. It
   described the GUEST's four taps in exhaustive visual detail and never
   mentioned the organizer at all, which is backwards: the person reading this
   page is the one deciding whether to buy, and they were shown four pictures
   of somebody else's experience.

   WHAT IT DOES INSTEAD

   Three steps, in the order the organizer lives them: build it, send it, run
   the night. Each is one sentence, because the details are two bands further
   down and on /features — this band's only job is that a visitor who reads
   nothing else on the page still knows what they would be buying.

   A Server Component: it holds no state, no observer, no animation. The old
   one shipped 24KB of client JavaScript to draw a picture.

   Deliberately no imagery. It sits between the invitations band and the
   capabilities grid, both of which are heavily visual; three more pictures
   here would make the middle of the page one long slideshow and add ~500px
   for nothing. Type and one rule per step is the compact form.
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
          <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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
          <span className="hiw-kicker">How it works</span>
          <h2 id="hiw-title" className="hiw-h2">
            Three steps, and you never open a spreadsheet.
          </h2>
        </header>

        {/* .fx-grid--3 walks 3 → 2 → 1 on its own from --fx-col, so this needs
            no breakpoints of its own. The 340px column means the third track
            drops out at roughly 1080px and the second at roughly 730px. */}
        <ol className="hiw-steps fx-grid fx-grid--3" style={{ "--fx-gap": "clamp(28px, 3vw, 44px)" }}>
          {STEPS.map((s) => <Step key={s.n} step={s} />)}
        </ol>
      </div>

      {/* A PLAIN style element, not <style jsx>.

          styled-jsx cannot be imported from a Server Component — Next fails
          the build outright — and making this a Client Component purely to get
          CSS scoping would ship JavaScript for a section that has no
          interactivity whatsoever. Every class here is prefixed `hiw-`, which
          is the same scoping guarantee by convention that the hash gave by
          machine, and it is what PrintedInvitationsSection already does.

          It also removes a trap rather than adding one: with styled-jsx, the
          `.hiw-link` rule had to live in a SEPARATE `global` block, because
          next/link never receives the scoping hash and a scoped rule on one
          matches nothing. Here there is no scoped/global distinction to get
          wrong. */}
      <style>{`
        .hiw {
          width: 100%;
          background: ${C.ivory};
          padding-block: var(--fx-pad-y-sm);
        }
        .hiw-head { max-width: 640px; margin-bottom: clamp(32px, 4vw, 52px); }
        .hiw-kicker {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: ${C.goldInk};
        }
        .hiw-h2 {
          font-family: var(--font-serif);
          font-size: clamp(27px, 1.417rem + 2.083vw, 42px);
          font-weight: 500;
          line-height: 1.16;
          letter-spacing: -0.4px;
          color: ${C.charcoal};
          margin: 14px 0 0;
        }
        .hiw-steps { list-style: none; margin: 0; padding: 0; }

        .hiw-step {
          position: relative;
          min-width: 0;
          padding-top: 26px;
          border-top: 1px solid ${C.border};
        }
        .hiw-n {
          font-family: var(--font-serif);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: ${C.goldInk};
        }
        .hiw-title {
          font-family: var(--font-serif);
          font-size: clamp(20px, 1.083rem + 0.625vw, 25px);
          font-weight: 500;
          line-height: 1.25;
          color: ${C.charcoal};
          margin: 12px 0 0;
        }
        .hiw-body {
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 300;
          line-height: 1.7;
          color: ${C.stone};
          margin: 10px 0 0;
        }
        .hiw-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 14px;
          font-family: var(--font-sans);
          font-size: 13.5px;
          font-weight: 600;
          text-decoration: none;
          color: ${C.goldInk};
          transition: gap 0.18s ease;
        }
        .hiw-link:hover { gap: 10px; }
        @media (prefers-reduced-motion: reduce) {
          .hiw-link:hover { gap: 6px; }
        }
      `}</style>
    </section>
  );
}
