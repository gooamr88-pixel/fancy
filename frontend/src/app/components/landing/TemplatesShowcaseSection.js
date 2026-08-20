import React from "react";
import Link from "next/link";
import { TEMPLATES } from "../../utils/curatedTemplates";
import { CINEMATIC_KEYS } from "../templates/cinematic/cinematicThemes";
import { occasionPolicyFor } from "../../utils/eventOccasion";
import { C, T, SHADOW, BEZEL } from "./landingTokens";

/* ═══════════════════════════════════════════════════════════════════════════
   THE INVITATIONS.

   The most differentiated thing this product has, and the old homepage showed
   it nowhere at all. Every picture is a real screenshot of the shipping
   template, produced by test/shots — never an artist's impression.

   The occasion badge is read from `occasionPolicyFor`, the same function the
   wizard and the guest page use, so the homepage cannot advertise a template
   for an occasion the product would refuse.

   ── 2026-08-20: three changes ─────────────────────────────────────────────

   1. IT KEPT ITS OWN PALETTE. There was a private `const C = { ivory, gold,
      goldLight }` at the top of this file — the third copy of the brand
      colours in the tree, and the exact drift landingTokens.js exists to
      prevent. It now imports the shared one.

   2. THE BAND IS NO LONGER DARK. Two full-dark bands were competing with the
      photography they existed to show; on paper, the invitations are the only
      saturated thing in view and they carry the whole section.

   3. ALTERNATING ROWS BECAME THREE PLATES. The flip-flop layout read well but
      ran ~2,400px tall for three items. As a three-up grid they read as plates
      in a catalogue, each numbered and closed with a hairline, in about a
      third of the height.

   A Server Component: no state, no client JavaScript.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The opened hero shot per template. The cover (sealed) art is used by the
 *  hero band, not here — three sealed envelopes in a row say less than three
 *  opened invitations do. */
const SHOTS = {
  ring: "/images/landing/hero-ring.webp",
  bab: "/images/landing/hero-bab.webp",
  swans: "/images/landing/hero-swans.webp",
};

/** What a guest actually does to open each one — the thing worth showing. */
const ARRIVAL = {
  ring: "They touch the box. It opens on film.",
  bab: "They knock three times. It answers.",
  swans: "They break the seal. The card rises out.",
};

/** Lowercase roman, to pair with the section numeral without competing. */
const PLATE_NUMERAL = ["i", "ii", "iii", "iv", "v"];

function TemplatePlate({ template, index }) {
  const policy = occasionPolicyFor(template.key);
  const shot = SHOTS[template.key];

  return (
    <li className="tss-plate">
      <div className="tss-device">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot}
          alt={`The ${template.label} invitation as a guest sees it: ${template.tagline}`}
          width={468}
          height={1013}
          loading="lazy"
        />
      </div>

      <div className="tss-namerow">
        <h3 className="tss-name">{template.label}</h3>
        <span className="tss-numeral" aria-hidden="true">
          {PLATE_NUMERAL[index] || index + 1}
        </span>
      </div>

      <p className="tss-arrival">{ARRIVAL[template.key]}</p>
      <p className="tss-desc">{template.desc}</p>
      <span className="tss-badge">{policy.label}</span>
    </li>
  );
}

export default function TemplatesShowcaseSection() {
  // The cinematic ones only. Custom Canvas has no photography by definition —
  // it is the organizer's own colours — so it has nothing to show here.
  const shown = TEMPLATES.filter((t) => CINEMATIC_KEYS.includes(t.key));

  return (
    <section id="invitations" className="tss" aria-labelledby="tss-title">
      {/* --5xl, not --lg. .fx-container--lg is 720px, a READING measure, and
          this is a three-column gallery of photographs. */}
      <div className="fx-container fx-container--5xl fx-gutter">
        <header className="tss-head">
          <span className="tss-kicker">
            The invitations
            <span aria-hidden="true" className="tss-kicker__rule" />
          </span>
          <span className="tss-secnum" aria-hidden="true">I</span>
          <h2 id="tss-title" className="tss-title">Three ways to open a door.</h2>
          <p className="tss-sub">
            Each one is filmed, not animated — and every one of them is yours to
            fill in, in any language, for any occasion.
          </p>
        </header>

        {/* .fx-grid walks 3 → 2 → 1 from --fx-col with no breakpoints of its
            own. A fixed three-column grid could not fit a phone — see
            AGENTS.md on min-content width. */}
        <ul className="tss-plates fx-grid" style={{ "--fx-col": "290px", "--fx-gap": "clamp(44px, 3vw, 40px)" }}>
          {shown.map((t, i) => (
            <TemplatePlate key={t.key} template={t} index={i} />
          ))}
        </ul>

        <div className="tss-cta">
          {/* /templates does not exist. The place a visitor actually sees and
              picks these is step one of the wizard. */}
          <Link href="/register" className="tss-btn tss-btn--ghost">See them in your own event</Link>
        </div>
      </div>

      {/* A plain style element — styled-jsx cannot be imported from a Server
          Component, and a scoped rule would never attach to the next/link
          above. Classes are prefixed "tss-" instead.

          No backticks inside these CSS comments: one would end the template
          literal and produce a parse error. */}
      <style>{`
        .tss {
          width: 100%;
          background: ${C.paper2};
          padding: 76px 0;
        }
        .tss-head {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          column-gap: 20px;
        }
        .tss-kicker {
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
        .tss-kicker__rule {
          display: block;
          flex: none;
          width: 28px;
          height: 1px;
          background: ${C.gold};
          opacity: 0.55;
        }
        .tss-secnum {
          font-family: ${T.display};
          font-style: italic;
          font-size: 13px;
          color: ${C.goldInk};
          opacity: 0.75;
        }
        .tss-title {
          grid-column: 1 / -1;
          font-family: ${T.display};
          font-weight: 300;
          font-size: 37px;
          line-height: 1.07;
          letter-spacing: -0.015em;
          color: ${C.ink};
          margin: 18px 0 0;
        }
        .tss-sub {
          grid-column: 1 / -1;
          font-size: 15.5px;
          font-weight: 300;
          line-height: 1.85;
          color: ${C.inkSoft};
          margin: 14px 0 0;
          max-width: 52ch;
        }

        .tss-plates {
          margin: 40px 0 0;
          padding: 0;
          list-style: none;
        }
        .tss-plate { min-width: 0; }

        /* The invitation as an object: a dark bezel, a long shadow, and a faint
           edge so it does not read as a pasted rectangle. */
        .tss-device {
          border-radius: 22px;
          padding: 5px;
          background: ${BEZEL};
          box-shadow: ${SHADOW.device};
        }
        .tss-device img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 17px;
        }

        .tss-namerow {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 14px;
          margin-top: 22px;
          padding-bottom: 12px;
          border-bottom: 1px solid ${C.border};
        }
        .tss-name {
          font-family: ${T.display};
          font-size: 29px;
          font-weight: 400;
          line-height: 1.12;
          letter-spacing: -0.01em;
          color: ${C.ink};
          margin: 0;
          min-width: 0;
        }
        .tss-numeral {
          flex: none;
          font-family: ${T.display};
          font-style: italic;
          font-size: 14px;
          color: ${C.goldInk};
          opacity: 0.8;
        }
        .tss-arrival {
          font-family: ${T.display};
          font-size: 18.5px;
          font-style: italic;
          line-height: 1.4;
          color: ${C.goldInk};
          margin: 14px 0 0;
        }
        .tss-desc {
          font-size: 13.5px;
          font-weight: 300;
          line-height: 1.78;
          color: ${C.inkSoft};
          margin: 10px 0 0;
        }
        .tss-badge {
          display: inline-block;
          margin-top: 14px;
          font-size: 9px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: ${C.inkSoft};
          opacity: 0.7;
        }

        .tss-cta {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 40px;
        }
        .tss-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 56px;
          font-family: ${T.body};
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          white-space: nowrap;
          text-decoration: none;
          border-radius: 0;
          transition: background 0.35s ease, color 0.35s ease, border-color 0.35s ease;
        }
        .tss-btn--ghost {
          background: ${C.paper};
          color: ${C.ink};
          border: 1px solid ${C.border};
        }
        .tss-btn--ghost:hover { background: ${C.ink}; border-color: ${C.ink}; color: ${C.paper}; }

        @media (min-width: 768px) {
          .tss { padding: 128px 0; }
          .tss-kicker { font-size: 11px; letter-spacing: 0.38em; gap: 16px; }
          .tss-kicker__rule { width: 44px; }
          .tss-secnum { font-size: 15px; }
          .tss-title { font-size: 58px; margin-top: 22px; }
          .tss-sub { font-size: 18px; margin-top: 18px; }
          .tss-plates { margin-top: 64px; }
          .tss-device { border-radius: 26px; padding: 6px; }
          .tss-device img { border-radius: 21px; }
          .tss-namerow { margin-top: 28px; padding-bottom: 14px; }
          .tss-name { font-size: 33px; }
          .tss-numeral { font-size: 15px; }
          .tss-arrival { font-size: 20px; margin-top: 16px; }
          .tss-desc { font-size: 14px; }
          .tss-badge { margin-top: 16px; }
          .tss-cta { flex-direction: row; margin-top: 56px; }
          .tss-btn { min-height: 60px; padding: 0 40px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .tss-btn { transition: none; }
        }
      `}</style>
    </section>
  );
}
