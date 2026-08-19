import React from "react";
import Link from "next/link";
import { C, SHADOW } from "./landingTokens";
import { CHECKIN_SCREENS } from "../../utils/checkinApp";

/* ═══════════════════════════════════════════════════════════════════════════
   THE ORGANIZER'S SIDE — photographed, not drawn.

   WHAT THIS REPLACED

   `DashboardPreviewSection.js`: 1,029 lines / 39KB whose own header comment
   called it a "decorative mockup". It hand-built a browser chrome, a sidebar,
   an SVG donut, invented stat cards, a trend line with made-up points, and a
   seating chart at literal hardcoded coordinates (`{ x: 100, y: 90, r: 34 }`).

   Every one of those imitated a component that actually ships and works —
   `OrganizerOverview`, `OverviewStatCards`, `RsvpProgressDonut`,
   `RsvpTrendChart`, `SeatingManager`. We drew a worse copy of our own product
   and put it on the front page, where it was also the largest thing on the
   page and guaranteed to drift the moment anyone touched the real dashboard.

   Now every frame is a screenshot of the real component, produced by
   test/shots/landingShots.dump.jsx from the actual dashboard code with mocked
   API responses. Redesign the dashboard, re-run the script, and this section
   updates. Redesign it and DON'T re-run the script, and the screenshot is
   merely out of date rather than fictional — which is the failure mode you
   want, because it is the one somebody notices.

   The door-app frame is not regenerated here at all: it reads
   `CHECKIN_SCREENS` from utils/checkinApp.js, the same constant /checkin-app
   renders, so the two pages cannot show different versions of that app.

   Server Component: three images and some type.
   ═══════════════════════════════════════════════════════════════════════════ */

const SHOTS = {
  overview: {
    src: "/images/landing/dash-overview.webp",
    w: 1120,
    h: 860,
    alt:
      "The Fancy RSVP dashboard: total events and guests, an RSVP rate with accepted, declined and pending counts, and below them the organizer's upcoming events and a live feed of replies as they arrive.",
  },
  seating: {
    src: "/images/landing/dash-seating.webp",
    w: 760,
    h: 560,
    alt:
      "The seating plan: numbered round and oval tables with their chairs drawn in, a head table, and the venue's stage, dance floor, bar and entrance marked around them.",
  },
};

const POINTS = [
  {
    title: "Everything about the event, on one screen",
    body:
      "Who is coming, who has not replied, how many meals of each kind, and how the replies are trending — updated the moment a guest submits, with no refresh.",
  },
  {
    title: "Seating you arrange by dragging names",
    body:
      "Round tables, long tables, zones and a dance floor. It tracks remaining seats per table and refuses to overbook one, then lets each guest look up their own place.",
  },
  {
    title: "A door that works when the venue's wifi doesn't",
    body:
      "The Fancy Check-in tablet app holds the whole guest list on the device, so it keeps scanning through dead spots and syncs back once it reconnects.",
  },
];

export default function DashboardShowcaseSection() {
  const door = CHECKIN_SCREENS[0];

  return (
    <section className="dash" aria-labelledby="dash-title">
      <div className="fx-container fx-container--4xl fx-gutter">
        <header className="dash-head">
          <span className="dash-kicker">Your side of it</span>
          <h2 id="dash-title" className="dash-h2">
            The part your guests never see.
          </h2>
          <p className="dash-sub">
            These are screenshots of the actual dashboard, not illustrations of it.
          </p>
        </header>

        {/* ── The dashboard, full width ── */}
        <figure className="dash-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SHOTS.overview.src}
            alt={SHOTS.overview.alt}
            width={SHOTS.overview.w}
            height={SHOTS.overview.h}
            loading="lazy"
          />
        </figure>

        {/* ── Seating and the door, side by side ── */}
        <div className="dash-pair">
          <figure className="dash-frame dash-frame--wide">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SHOTS.seating.src}
              alt={SHOTS.seating.alt}
              width={SHOTS.seating.w}
              height={SHOTS.seating.h}
              loading="lazy"
            />
            <figcaption>Seating planner</figcaption>
          </figure>

          <figure className="dash-frame dash-frame--tablet">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={door.src} alt={door.alt} width={760} height={560} loading="lazy" />
            <figcaption>{door.caption}</figcaption>
          </figure>
        </div>

        {/* ── What each of them is for ── */}
        <ul className="dash-points fx-grid fx-grid--3" style={{ "--fx-gap": "clamp(24px, 3vw, 40px)" }}>
          {POINTS.map((p) => (
            <li key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>

        <div className="dash-cta">
          <Link href="/register" className="dash-btn">Start an event free</Link>
          <Link href="/checkin-app" className="dash-btn dash-btn--ghost">About the door app</Link>
        </div>
      </div>

      {/* A PLAIN style element — styled-jsx cannot be imported from a Server
          Component, and this band is three images and some type. Every class
          is prefixed "dash-". */}
      <style>{`
        .dash {
          width: 100%;
          background: ${C.ivory};
          padding-block: var(--fx-pad-y-sm);
        }
        .dash-head { max-width: 640px; margin-bottom: clamp(28px, 3.5vw, 44px); }
        .dash-kicker {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: ${C.goldInk};
        }
        .dash-h2 {
          font-family: var(--font-serif);
          font-size: clamp(27px, 1.417rem + 2.083vw, 42px);
          font-weight: 500;
          line-height: 1.16;
          letter-spacing: -0.4px;
          color: ${C.charcoal};
          margin: 14px 0 0;
        }
        .dash-sub {
          font-family: var(--font-sans);
          font-size: 15.5px;
          font-weight: 300;
          color: ${C.stone};
          margin: 12px 0 0;
        }

        .dash-hero {
          margin: 0;
          border-radius: var(--fx-r-md);
          overflow: hidden;
          background: ${C.white};
          box-shadow: ${SHADOW.device};
        }
        /* The full frame here, uncropped — this band is where the dashboard
           is the subject. The hero shows the same file cropped back to
           1120/700, because at hero size the lower half is unreadable. */
        .dash-hero img {
          display: block;
          width: 100%;
          height: auto;
          aspect-ratio: 1120 / 860;
          object-fit: cover;
          object-position: top center;
        }

        /* Two frames of equal weight. Plain flex rather than .fx-grid because
           they carry different aspect ratios and should stay the same HEIGHT,
           not the same width — a grid would give them equal tracks and leave
           the tablet frame with dead space above and below it. */
        .dash-pair {
          display: flex;
          flex-wrap: wrap;
          /* flex-start, not the default stretch. These two frames hold images
             of genuinely different proportions (760x560 and 1400x875), and
             stretching them to a shared height would leave the shorter one
             with a band of dead space under its caption. Ragged bottoms are
             the honest result of not cropping either picture. */
          align-items: flex-start;
          gap: clamp(16px, 2vw, 24px);
          margin-top: clamp(16px, 2vw, 24px);
        }
        .dash-frame {
          margin: 0;
          /* min-width:0 is what actually lets these shrink. A flex item sizes
             to its content's min-content width by default, and these images
             are 760px intrinsically — without it the row cannot narrow past
             1520px and overflows every phone. */
          min-width: 0;
          border-radius: var(--fx-r-md);
          overflow: hidden;
          background: ${C.white};
          box-shadow: ${SHADOW.card};
          border: 1px solid ${C.border};
        }
        .dash-frame--wide { flex: 1 1 340px; }
        .dash-frame--tablet { flex: 1 1 340px; }
        /* EACH FRAME KEEPS ITS OWN PROPORTIONS. A single shared aspect-ratio
           here (19/14, taken from the seating plan) cropped 15% off the sides
           of the door-app shot, which is 1400x875 — it cut the guest's
           surname off the left edge and the table number off the right, i.e.
           it removed the two things that screen exists to show. object-fit:
           cover does not warn you about that; it just quietly does it. */
        .dash-frame img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: cover;
        }
        .dash-frame--wide img { aspect-ratio: 760 / 560; }
        .dash-frame--tablet img { aspect-ratio: 1400 / 875; }
        .dash-frame figcaption {
          font-family: var(--font-sans);
          font-size: var(--fx-label);
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: ${C.stone};
          padding: 12px 16px 14px;
          border-top: 1px solid ${C.border};
        }

        .dash-points {
          list-style: none;
          margin: clamp(34px, 4.5vw, 56px) 0 0;
          padding: 0;
        }
        .dash-points h3 {
          font-family: var(--font-serif);
          font-size: 19px;
          font-weight: 600;
          line-height: 1.3;
          color: ${C.charcoal};
          margin: 0;
        }
        .dash-points p {
          font-family: var(--font-sans);
          font-size: 14.5px;
          font-weight: 300;
          line-height: 1.7;
          color: ${C.stone};
          margin: 9px 0 0;
        }

        .dash-cta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: clamp(30px, 3.5vw, 44px);
        }
        .dash-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: var(--fx-touch);
          padding: 13px 28px;
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
        .dash-btn:hover { transform: translateY(-1px); }
        .dash-btn--ghost {
          background: transparent;
          color: #191b1e;
          border: 1px solid #d9d3c6;
        }
        .dash-btn--ghost:hover { background: #ffffff; border-color: #b8944f; }
        @media (prefers-reduced-motion: reduce) {
          .dash-btn:hover { transform: none; }
        }
      `}</style>
    </section>
  );
}
