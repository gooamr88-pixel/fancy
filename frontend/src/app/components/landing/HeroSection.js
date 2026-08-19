"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import { useLandingStats, formatStatValue } from "../../utils/useLandingStats";
import { C, SHADOW } from "./landingTokens";

/* ═══════════════════════════════════════════════════════════════════════════
   THE HERO.

   WHAT CHANGED AND WHY

   1. It now says what the product IS. The old headline was "Elegant RSVPs.
      Effortless Planning." — a mood, not a sentence you could repeat to a
      friend. Nothing above the fold indicated that this thing holds a guest
      list, seats people, or runs a door. A visitor's first job is to decide
      "is this the category of thing I need", and the old hero did not answer
      it.

   2. The art is the PRODUCT, not a drawing of it. The right column used to be
      `HeroEnvelope` — a hand-built envelope animation that imitated the
      cinematic reveal without being it. It is now two real screenshots: the
      actual Velvet Ring invitation as a guest sees it on a phone, in front of
      the actual organizer dashboard. Both come out of the screenshot pipeline
      in test/shots, so a redesign of either cannot leave a stale picture on
      the front page.

   3. It absorbed SocialProofBar. Three animated counters used to occupy an
      entire 310px band of their own, four screens down, where they proved
      nothing to anyone who had already decided to leave. The same three
      numbers are now a single line under the buttons — read from the same
      `useLandingStats` hook, still real COUNT(*) values from the backend, but
      costing one line instead of a section. That is one whole band deleted.

   The counters do not animate any more, deliberately: an entrance animation on
   a number that is already visible on first paint reads as a gimmick, and it
   was the only reason this needed an IntersectionObserver.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The two screenshots. Produced by test/shots/landingShots.dump.jsx. */
const ART = {
  invitation: "/images/landing/hero-ring.webp",
  dashboard: "/images/landing/dash-overview.webp",
};

function TrustLine() {
  const { stats } = useLandingStats();

  return (
    <ul className="hero-trust">
      {stats.map((s) => (
        <li key={s.label}>
          <strong>{formatStatValue(s)}</strong>
          <span>{s.label}</span>
        </li>
      ))}

    </ul>
  );
}

/**
 * The product, photographed.
 *
 * The dashboard sits behind and to the side; the phone overlaps its lower-left
 * corner. That specific arrangement is the point of the picture — it says "the
 * guest gets that, you get this" in one glance, which is the sentence the old
 * page took two invented mockup sections and 1,918 lines to fail to say.
 *
 * `aspect-ratio` is declared on both images so the box reserves its height
 * before either file arrives — without it the headline jumps on load, and the
 * hero is the one place on the site where that is guaranteed to be noticed.
 */
function HeroArt() {
  return (
    <div className="hero-art">
      <figure className="hero-art__screen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ART.dashboard}
          alt="The Fancy RSVP organizer dashboard, showing live totals for guests invited, accepted, declined and still to reply."
          width={1120}
          height={860}
          fetchPriority="high"
        />
      </figure>

      <figure className="hero-art__phone">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ART.invitation}
          alt="A wedding invitation from Fancy RSVP as a guest sees it on their phone."
          width={468}
          height={1013}
          fetchPriority="high"
        />
      </figure>

    </div>
  );
}

export default function HeroSection() {
  const { isLoggedIn, loading } = useAuth();
  const signedIn = !loading && isLoggedIn;

  return (
    <section id="hero" className="hero">
      <div
        className="hero-grid fx-container fx-container--5xl fx-gutter fx-grid"
        style={{
          "--fx-col": "400px",
          "--fx-gap": "clamp(36px, 1.667rem + 2.5vw, 60px)",
        }}
      >
        {/* ─── The claim ─── */}
        <div className="hero-copy animate-fade-in-up">
          <span className="hero-eyebrow">RSVPs · Seating · Door check-in</span>

          {/* No <br>. It was there to force "Every guest, from the / invitation
              to the door." — but the copy column is about 560px at 1280, so
              the browser wrapped each of those halves AGAIN and the headline
              came out as four ragged lines. A max-width in ch lets it break
              where it actually fits at every width instead. */}
          <h1 className="hero-headline">
            Every guest, from the invitation to the door.
          </h1>

          <p className="hero-sub">
            Send an invitation your guests actually open, collect their replies,
            seat them, and scan them in on the night — all from one place.
          </p>

          <div className="hero-buttons">
            <Link
              href={signedIn ? "/dashboard" : "/register"}
              className="hero-btn hero-btn--gold"
              id="hero-cta-get-started"
            >
              {signedIn ? "Go to dashboard" : "Create your event"}
            </Link>
            <Link href="/pricing" className="hero-btn hero-btn--ghost" id="hero-cta-pricing">
              See pricing
            </Link>
          </div>

          <p className="hero-reassure">
            Free plan to start · No credit card · Pay once per event, not monthly
          </p>

          <TrustLine />
        </div>

        {/* ─── The product ─── */}
        <HeroArt />
      </div>


      {/* ONE PLAIN STYLE ELEMENT, for the whole component.

          Two separate reasons, both of which this repo has already paid for:

          1. A <style jsx> block inside a NESTED, non-default-export component
             does not reliably compile in this build. AGENTS.md names the two
             cases that proved it (FooterLink, PrintPreviewModal) and both had
             to be moved out. TrustLine and HeroArt in this file are exactly
             that pattern, and their CSS used to live inside them.

          2. styled-jsx stamps its hash class only onto lowercase intrinsic
             elements, so a scoped rule aimed at a class on a next/link
             compiles to .foo.jsx-hash and matches NOTHING. That is the bug
             that made every alert on this platform invisible, and the one
             that made the footer links unreadable in production.

          A plain <style> has neither failure mode. The scoping it gives up is
          replaced by a prefix on every class name, which is what
          PrintedInvitationsSection already does. */}
      <style>{`
        .hero-trust {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 10px 28px;
          margin: 4px 0 0;
          padding: 0;
          list-style: none;
        }
        .hero-trust li {
          display: flex;
          align-items: baseline;
          gap: 7px;
        }
        .hero-trust strong {
          font-family: var(--font-serif);
          font-size: 20px;
          font-weight: 600;
          color: ${C.charcoal};
          line-height: 1;
        }
        .hero-trust span {
          font-family: var(--font-sans);
          font-size: 12.5px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: ${C.stone};
        }

        .hero-art {
          position: relative;
          /* Reserves the composition's height at every width, so nothing
             below it moves when the two images decode. */
          aspect-ratio: 5 / 4;
          width: 100%;
          max-width: 620px;
          margin-inline: auto;
        }
        .hero-art__screen {
          position: absolute;
          inset-block-start: 0;
          inset-inline-end: 0;
          width: 88%;
          margin: 0;
          border-radius: 12px;
          overflow: hidden;
          background: ${C.white};
          box-shadow: ${SHADOW.device};
        }
        .hero-art__phone {
          position: absolute;
          inset-block-end: 0;
          inset-inline-start: 0;
          width: 30%;
          margin: 0;
          padding: 5px;
          border-radius: 18px;
          background: linear-gradient(150deg, #33363b, #191b1e 55%, #101214);
          box-shadow: 0 30px 60px -22px rgba(0, 0, 0, 0.55);
        }
        .hero-art figure img {
          display: block;
          width: 100%;
          height: auto;
        }
        /* The source file is 1120x860 — the same one the dashboard band shows
           in full. Cropped to 1120/700 from the TOP here, deliberately: at
           hero size this card is about 550px wide, where the lower half of
           that screenshot (the events list and the activity feed) is too
           small to read and only makes the top half smaller. */
        .hero-art__screen img {
          aspect-ratio: 1120 / 700;
          object-fit: cover;
          object-position: top center;
        }
        .hero-art__phone img {
          aspect-ratio: 390 / 844;
          object-fit: cover;
          border-radius: 14px;
        }

        /* Below the two-column breakpoint the overlap gets cramped and the
           phone starts covering the dashboard's own numbers, so the pair
           becomes a simple side-by-side row with no absolute positioning at
           all. Reset every offset explicitly: a leftover inset-inline-start on
           a static element is inert, but a leftover position:absolute
           collapses the parent.
           (No backticks in here. One inside a styled-jsx CSS comment ends the
           template literal and the file stops parsing — this exact line cost
           a build.) */
        @media (max-width: 1023.98px) {
          .hero-art {
            aspect-ratio: auto;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            gap: 16px;
            max-width: 560px;
          }
          .hero-art__screen,
          .hero-art__phone {
            position: static;
            width: auto;
            flex: 0 1 auto;
          }
          .hero-art__screen { flex-basis: 68%; min-width: 0; }
          .hero-art__phone { flex-basis: 26%; min-width: 0; }
        }

        /* On a PHONE the dashboard is dropped entirely and the invitation
           stands alone.

           Not a space saving — a legibility one. At 390px the row gave the
           dashboard 238px to render a 1120px-wide screenshot, which is not a
           picture of a dashboard, it is a grey rectangle with specks in it. A
           thumbnail nobody can read argues for nothing, and it made the hero
           look cheap, which is the one thing this page cannot afford.

           Nothing is lost: the dashboard gets a full-width, legible band of
           its own four screens down. And leading a phone with the thing a
           GUEST sees is the better story on the device guests actually use. */
        @media (max-width: 639.98px) {
          .hero-art__screen { display: none; }
          .hero-art { max-width: 240px; }
          .hero-art__phone { flex-basis: 100%; }
        }

        .hero {
          width: 100%;
          background: ${C.white};
          position: relative;
          overflow: hidden;
        }
        /* One warm wash bleeding up out of the next band, so the white hero
           and the ivory section under it read as one surface rather than two
           stacked rectangles. */
        .hero::after {
          content: "";
          position: absolute;
          inset-inline: 0;
          bottom: 0;
          height: 180px;
          background: linear-gradient(to bottom, transparent, ${C.ivory});
          pointer-events: none;
          z-index: 1;
        }
        .hero-grid {
          position: relative;
          z-index: 2;
          align-items: center;
          padding-top: var(--fx-pad-y-sm);
          padding-bottom: var(--fx-pad-y-sm);
        }
        .hero-copy {
          display: flex;
          flex-direction: column;
          gap: 22px;
          /* An .fx-grid track sizes to its content's min-content width unless
             told otherwise, and a long unbroken headline word would push this
             column past its share. */
          min-width: 0;
        }

        .hero-eyebrow {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          /* goldInk, not gold: this is small text on white, where #B8944F
             measures about 2.9:1 and fails AA. */
          color: ${C.goldInk};
        }
        .hero-headline {
          font-family: var(--font-serif);
          /* 60px at the top end, not 72. The copy column is about 560px wide
             at 1280, and 72px serif put four ragged lines in it. */
          font-size: clamp(34px, 1.583rem + 2.708vw, 60px);
          font-weight: 500;
          line-height: 1.08;
          letter-spacing: -0.8px;
          color: ${C.charcoal};
          /* A measure, so it breaks into two or three even lines instead of
             filling whatever width the grid happens to give it. */
          max-width: 15ch;
          margin: 0;
        }
        .hero-sub {
          font-family: var(--font-sans);
          font-size: 17px;
          font-weight: 300;
          line-height: 1.65;
          color: ${C.stone};
          max-width: 46ch;
          margin: 0;
        }
        .hero-buttons {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 14px;
          margin-top: 2px;
        }
        .hero-reassure {
          margin: -8px 0 0;
          font-family: var(--font-sans);
          font-size: 12.5px;
          color: ${C.stoneSoft};
        }

        /* The stacked layout is a typographic decision, not a consequence of
           the grid — .fx-grid has already collapsed to one column by here on
           its own — so it keeps its breakpoint. 1023.98px is where the two
           columns actually become one. */
        @media (max-width: 1023.98px) {
          .hero-grid { text-align: center; }
          .hero-copy { align-items: center; }
          .hero-sub { max-width: 52ch; }
          .hero-buttons { justify-content: center; }
        }
        /* 639.98, not 479.98. AGENTS.md allows exactly four breakpoint values
           and a fifth is never to be introduced — anything that wants to
           change at 480px folds into the < sm rule and has to be acceptable
           at 639px too. Full-width stacked buttons at 639px are: they are the
           only two actions on the screen. */
        @media (max-width: 639.98px) {
          .hero-buttons { flex-direction: column; align-items: stretch; width: 100%; }
        }

        .hero-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          /* --fx-touch, so the tap target clears 44px on a phone even though
             the padding alone would give 46px — it survives a font change. */
          min-height: var(--fx-touch);
          padding: 15px 32px;
          border-radius: 8px;
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .hero-btn--gold {
          background: linear-gradient(135deg, #d7be80 0%, #b8944f 100%);
          color: #191b1e;
          border: 1px solid #b8944f;
          box-shadow: 0 10px 26px -10px rgba(184, 148, 79, 0.7);
        }
        .hero-btn--gold:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px -10px rgba(184, 148, 79, 0.8);
        }
        .hero-btn--ghost {
          background: transparent;
          color: #191b1e;
          border: 1px solid #d9d3c6;
        }
        .hero-btn--ghost:hover { background: #f8f4ec; border-color: #b8944f; }
        @media (prefers-reduced-motion: reduce) {
          .hero-btn:hover { transform: none; }
        }
      `}</style>
    </section>
  );
}
