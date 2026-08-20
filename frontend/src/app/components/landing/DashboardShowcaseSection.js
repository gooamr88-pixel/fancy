import React from "react";
import { C, T, SHADOW, BEZEL } from "./landingTokens";
import { CHECKIN_SCREENS } from "../../utils/checkinApp";

/* ═══════════════════════════════════════════════════════════════════════════
   YOUR SIDE OF IT.

   Every image here is a photograph of the real component, produced by
   test/shots/landingShots.dump.jsx from the actual dashboard code with mocked
   data — so a redesign of the dashboard cannot leave a stale picture here.

   ── 2026-08-20: the screenshots are now PRESENTED, not just placed ────────

   The pictures were right and the presentation was wrong. Three raw crops,
   each with a 1px border, stacked down the band. That reads as screengrabs
   somebody pasted in — which is exactly what they were.

   The same pixels now sit in the chrome that matches what they are:

   · the dashboard in a BROWSER WINDOW, with a title bar and its own URL. The
     chrome is drawn in this page's palette rather than borrowed macOS grey, so
     it belongs to the design instead of looking like a stock mockup;
   · the seating plan as a smaller PLATE overlapping the window's lower-left
     corner at desktop, so the two read as one arrangement rather than two
     stacked pictures;
   · the door app in a TABLET BODY, because it is a physical thing standing at
     an entrance, and a flat rectangle loses that entirely.

   On a phone the overlap is dropped: at 342px of usable width an overlap just
   hides half of both images. Each object gets its own row and its own caption.

   A Server Component — no state, no client JavaScript.
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

/** A screenshot presented as a window rather than a rectangle. The URL in the
 *  bar is decorative and marked as such — it is not a link, and a screen reader
 *  announcing "fancyrsvp.com/dashboard" between the heading and the image would
 *  be noise. */
function BrowserFrame({ shot }) {
  return (
    <div className="dash-win">
      <div className="dash-win__bar" aria-hidden="true">
        <span className="dash-win__dot" />
        <span className="dash-win__dot" />
        <span className="dash-win__dot" />
        <span className="dash-win__url">fancyrsvp.com/dashboard</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot.src} alt={shot.alt} width={shot.w} height={shot.h} loading="lazy" />
    </div>
  );
}

export default function DashboardShowcaseSection() {
  const door = CHECKIN_SCREENS[0];

  return (
    <section className="dash" aria-labelledby="dash-title">
      <div className="fx-container fx-container--5xl fx-gutter">
        <header className="dash-head">
          <span className="dash-kicker">
            Your side of it
            <span aria-hidden="true" className="dash-kicker__rule" />
          </span>
          <span className="dash-numeral" aria-hidden="true">V</span>
          <h2 id="dash-title" className="dash-h2">
            The part your guests never see.
          </h2>
          <p className="dash-sub">
            These are screenshots of the actual dashboard, not illustrations of it.
          </p>
        </header>

        {/* ── the dashboard, with the seating plan overlapping it ── */}
        <div className="dash-stage">
          <span aria-hidden="true" className="dash-stage__glow" />

          <figure className="dash-stage__win">
            <BrowserFrame shot={SHOTS.overview} />
          </figure>

          <figure className="dash-stage__plate">
            <div className="dash-plate">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={SHOTS.seating.src}
                alt={SHOTS.seating.alt}
                width={SHOTS.seating.w}
                height={SHOTS.seating.h}
                loading="lazy"
              />
            </div>
            <figcaption className="dash-cap">The seating plan</figcaption>
          </figure>
        </div>

        {/* ── the door app, on its own, because it is a different device ── */}
        <div className="dash-door">
          <figure className="dash-door__art">
            <div className="dash-tablet">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={door.src} alt={door.alt} width={760} height={560} loading="lazy" />
            </div>
          </figure>
          <div className="dash-door__copy">
            <h3 className="dash-door__title">{POINTS[2].title}</h3>
            <p className="dash-door__body">{POINTS[2].body}</p>
            <p className="dash-cap dash-cap--left">Fancy Check-in — Android tablet</p>
          </div>
        </div>

        <ul className="dash-points fx-grid" style={{ "--fx-col": "280px", "--fx-gap": "clamp(28px, 3vw, 56px)" }}>
          {POINTS.slice(0, 2).map((p) => (
            <li key={p.title} className="dash-point">
              <h3 className="dash-point__title">{p.title}</h3>
              <p className="dash-point__body">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* A plain style element — styled-jsx cannot be imported from a Server
          Component. Classes are prefixed "dash-" instead.

          No backticks inside these CSS comments: one would terminate the
          template literal and produce a parse error. */}
      <style>{`
        .dash {
          width: 100%;
          background: ${C.paper};
          padding: 76px 0;
        }
        .dash-head {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          column-gap: 20px;
        }
        .dash-kicker {
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
        .dash-kicker__rule {
          display: block;
          flex: none;
          width: 28px;
          height: 1px;
          background: ${C.gold};
          opacity: 0.55;
        }
        .dash-numeral {
          font-family: ${T.display};
          font-style: italic;
          font-size: 13px;
          color: ${C.goldInk};
          opacity: 0.75;
        }
        .dash-h2 {
          grid-column: 1 / -1;
          font-family: ${T.display};
          font-weight: 300;
          font-size: 37px;
          line-height: 1.07;
          letter-spacing: -0.015em;
          color: ${C.ink};
          margin: 18px 0 0;
        }
        .dash-sub {
          grid-column: 1 / -1;
          font-size: 15.5px;
          font-weight: 300;
          line-height: 1.85;
          color: ${C.inkSoft};
          margin: 14px 0 0;
          max-width: 52ch;
        }

        /* ── the browser window ────────────────────────────────────────── */
        .dash-win {
          border-radius: 12px;
          overflow: hidden;
          background: ${C.paper};
          border: 1px solid ${C.border};
          box-shadow: ${SHADOW.window};
        }
        .dash-win__bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 12px;
          background: ${C.paper3};
          border-bottom: 1px solid ${C.border};
        }
        .dash-win__dot {
          display: block;
          flex: none;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #D6CEBE;
        }
        .dash-win__url {
          flex: 1 1 auto;
          min-width: 0;
          margin-left: 8px;
          display: flex;
          align-items: center;
          height: 20px;
          padding: 0 10px;
          border-radius: 999px;
          background: ${C.paper};
          border: 1px solid ${C.border};
          font-size: 9px;
          letter-spacing: 0.06em;
          color: ${C.inkSoft};
          opacity: 0.75;
          overflow: hidden;
          white-space: nowrap;
        }
        .dash-win img { display: block; width: 100%; height: auto; }

        /* ── the plate and the tablet ──────────────────────────────────── */
        .dash-plate {
          border: 1px solid ${C.border};
          background: ${C.paper};
          padding: 6px;
          box-shadow: ${SHADOW.lift};
        }
        .dash-plate img { display: block; width: 100%; height: auto; }

        .dash-tablet {
          border-radius: 16px;
          padding: 9px;
          background: ${BEZEL};
          box-shadow: ${SHADOW.device};
        }
        .dash-tablet img { display: block; width: 100%; height: auto; border-radius: 7px; }

        .dash-cap {
          margin: 14px 0 0;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: ${C.inkSoft};
          opacity: 0.72;
        }

        /* ── phone layout: no overlap, one object per row ──────────────── */
        .dash-stage {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 34px;
          margin-top: 38px;
        }
        .dash-stage__glow { display: none; }
        .dash-stage__win, .dash-stage__plate { margin: 0; }

        .dash-door {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 44px;
        }
        .dash-door__art { margin: 0; }
        .dash-door__title {
          font-family: ${T.display};
          font-size: 22px;
          font-weight: 400;
          line-height: 1.25;
          color: ${C.ink};
          margin: 0;
        }
        .dash-door__body {
          font-size: 13.5px;
          font-weight: 300;
          line-height: 1.78;
          color: ${C.inkSoft};
          margin: 8px 0 0;
        }
        .dash-cap--left { margin-top: 16px; }

        .dash-points {
          margin: 44px 0 0;
          padding: 0;
          list-style: none;
        }
        .dash-point {
          padding-top: 22px;
          border-top: 1px solid ${C.border};
          min-width: 0;
        }
        .dash-point__title {
          font-family: ${T.display};
          font-size: 22px;
          font-weight: 400;
          line-height: 1.25;
          color: ${C.ink};
          margin: 0;
        }
        .dash-point__body {
          font-size: 13.5px;
          font-weight: 300;
          line-height: 1.78;
          color: ${C.inkSoft};
          margin: 8px 0 0;
        }

        /* ── 768 and up: the composed stage ────────────────────────────── */
        @media (min-width: 768px) {
          .dash { padding: 128px 0; }
          .dash-kicker { font-size: 11px; letter-spacing: 0.38em; gap: 16px; }
          .dash-kicker__rule { width: 44px; }
          .dash-numeral { font-size: 15px; }
          .dash-h2 { font-size: 58px; margin-top: 22px; }
          .dash-sub { font-size: 18px; margin-top: 18px; }

          .dash-stage {
            display: block;
            margin-top: 58px;
            padding-bottom: 120px;
          }
          .dash-stage__glow {
            display: block;
            position: absolute;
            inset: -6% -10% 4% -10%;
            background: radial-gradient(ellipse at 55% 45%, rgba(169, 138, 78, 0.14), transparent 66%);
            pointer-events: none;
          }
          .dash-stage__win {
            position: relative;
            width: 84%;
            margin-left: auto;
          }
          .dash-stage__plate {
            position: absolute;
            left: 0;
            bottom: 0;
            width: 42%;
            z-index: 3;
          }
          .dash-win { border-radius: 15px; }
          .dash-win__bar { padding: 13px 18px; gap: 8px; }
          .dash-win__dot { width: 9px; height: 9px; }
          .dash-win__url { height: 26px; padding: 0 14px; font-size: 10px; margin-left: 12px; }
          .dash-plate { padding: 9px; }
          .dash-tablet { border-radius: 22px; padding: 14px; }
          .dash-tablet img { border-radius: 9px; }

          .dash-door {
            display: grid;
            grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
            gap: 64px;
            align-items: center;
            margin-top: 96px;
            padding-top: 64px;
            border-top: 1px solid ${C.border};
          }
          .dash-door__title { font-size: 34px; line-height: 1.16; letter-spacing: -0.01em; }
          .dash-door__body { font-size: 16px; line-height: 1.85; margin-top: 16px; max-width: 44ch; }
          .dash-cap--left { margin-top: 22px; }

          .dash-points { margin-top: 80px; }
          .dash-point { padding-top: 26px; }
          .dash-point__title { font-size: 24px; }
          .dash-point__body { font-size: 14.5px; line-height: 1.8; }
        }
      `}</style>
    </section>
  );
}
