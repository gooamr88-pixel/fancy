"use client";

import React from "react";
import Link from "next/link";
import { TEMPLATES } from "../../utils/curatedTemplates";
import { CINEMATIC_KEYS } from "../templates/cinematic/cinematicThemes";
import { occasionPolicyFor } from "../../utils/eventOccasion";

/**
 * The invitations, as they actually render.
 *
 * WHY THIS SECTION EXISTS
 *
 * The most differentiated thing this platform makes — a guest taps a velvet
 * box, knocks on a carved door, or breaks a wax seal, and an invitation opens
 * on film — appeared on the homepage NOWHERE. The page led instead with two
 * hand-drawn mockups of a dashboard and a phone.
 *
 * WHY THE IMAGES ARE GENERATED, NOT DRAWN
 *
 * Every frame here is a screenshot of the real component rendering at a real
 * 390px phone width, produced by scripts/renderLandingShots.js from
 * VelvetBoxOpening / KnockDoorOpening / WaxEnvelopeOpening and their heroes.
 * Redesign a template, re-run the script, and this section cannot go on
 * showing an invitation that no longer exists. A hand-drawn approximation
 * silently would — which is exactly what it replaced.
 *
 * Name, tagline, palette and the "what it is for" badge all read from the SAME
 * sources the create-event picker reads (curatedTemplates.TEMPLATES and
 * occasionPolicyFor), so the homepage cannot advertise a template that the
 * wizard describes differently.
 */

const C = {
  ivory: "#F8F4EC",
  gold: "#B8944F",
  goldLight: "#E4CE9B",
};

/** Cover + hero, per template. Filenames follow the render script's output. */
const SHOTS = {
  ring: { cover: "/images/landing/cover-ring.webp", hero: "/images/landing/hero-ring.webp" },
  bab: { cover: "/images/landing/cover-bab.webp", hero: "/images/landing/hero-bab.webp" },
  swans: { cover: "/images/landing/cover-swans.webp", hero: "/images/landing/hero-swans.webp" },
};

/** What a guest actually does to open each one — the thing worth showing. */
const ARRIVAL = {
  ring: "They touch the box. It opens on film.",
  bab: "They knock three times. It answers.",
  swans: "They break the seal. The card rises out.",
};

function TemplateRow({ template, index }) {
  const shots = SHOTS[template.key];
  const policy = occasionPolicyFor(template.key);
  if (!shots) return null;

  return (
    <article className={`tss-row ${index % 2 === 1 ? "tss-row--flip" : ""}`}>
      {/* ── The invitation ── */}
      <div className="tss-art">
        <div className="tss-phone tss-phone--cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shots.cover}
            alt={`The ${template.label} invitation cover, as a guest first sees it on their phone.`}
            width={468}
            height={1013}
            loading="lazy"
          />
        </div>
        <div className="tss-phone tss-phone--hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shots.hero}
            alt={`The ${template.label} invitation once it has opened, showing the couple's names and the date.`}
            width={468}
            height={1013}
            loading="lazy"
          />
        </div>
      </div>

      {/* ── What it is ── */}
      <div className="tss-copy">
        <span className="tss-badge">{policy.label}</span>
        <h3 className="tss-name">{template.label}</h3>
        <p className="tss-tagline">{template.tagline}</p>
        <p className="tss-arrival">{ARRIVAL[template.key]}</p>
        <p className="tss-desc">{template.desc}</p>

        <div className="tss-palette" aria-hidden="true">
          {template.presets.map((p) => (
            <span key={p.name} title={p.name} style={{ background: p.primary }} />
          ))}
          <em>{template.presets.length} palettes</em>
        </div>
      </div>
    </article>
  );
}

export default function TemplatesShowcaseSection() {
  // The cinematic ones only. Custom Canvas has no photography by definition —
  // it is the organizer's own colours — so it has nothing to show here.
  const shown = TEMPLATES.filter((t) => CINEMATIC_KEYS.includes(t.key));

  return (
    <section className="tss" aria-labelledby="tss-title">
      <div aria-hidden className="tss-glow" />

      {/* --4xl (1200px), not --lg. .fx-container--lg is 720px — a READING
          measure — and this is an alternating two-column layout of photographs
          and copy. At 720px each row's art track was ~390px for two phones
          side by side, so both were pinned at their 220px cap with the copy
          crushed beside them, and the section ran ~2,400px tall to fit three
          of those. The wider measure makes each row SHORTER, which is most of
          this band's height saving. */}
      <div className="fx-container fx-container--4xl fx-gutter tss-inner">
        <header className="tss-head">
          <span className="tss-kicker">The invitations</span>
          <h2 id="tss-title" className="tss-title">
            Your guests don&apos;t get a link.<br />They get an arrival.
          </h2>
          <p className="tss-sub">
            Every invitation opens on film before it becomes a page — and every one of them
            is yours to fill in, in any language, for any occasion.
          </p>
        </header>

        <div className="tss-rows">
          {shown.map((t, i) => (
            <TemplateRow key={t.key} template={t} index={i} />
          ))}
        </div>

        <div className="tss-cta">
          {/* /templates does not exist. The place a visitor actually sees and
              picks these is step one of the wizard. */}
          <Link href="/register" className="tss-btn">See them in your own event</Link>
          <Link href="/features" className="tss-btn tss-btn--ghost">Everything else it does</Link>
        </div>
      </div>

      <style jsx>{`
        .tss {
          position: relative;
          overflow: hidden;
          background: linear-gradient(178deg, #14171a 0%, #191b1e 45%, #211e1a 100%);
          /* Was clamp(64px, 9vw, 118px) — 236px of vertical padding on a
             desktop, on the tallest section of the page. --fx-pad-y-sm is the
             band rhythm every other section on this page now uses. */
          padding-block: var(--fx-pad-y-sm);
        }
        /* One off-canvas warm light. A flat dark fill has no light in it, and
           these photographs are all lit from somewhere. */
        .tss-glow {
          position: absolute;
          inset-block: -20%;
          inset-inline-start: -15%;
          width: 70%;
          pointer-events: none;
          background: radial-gradient(ellipse at 35% 40%, rgba(184, 148, 79, 0.13), transparent 62%);
        }
        .tss-inner { position: relative; z-index: 1; }

        .tss-head { max-width: 660px; }
        .tss-kicker {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          color: ${C.goldLight};
        }
        .tss-title {
          font-family: var(--font-serif);
          font-weight: 400;
          font-size: clamp(30px, 5vw, 52px);
          line-height: 1.14;
          color: ${C.ivory};
          margin: 16px 0 0;
        }
        .tss-sub {
          margin: 18px 0 0;
          font-size: 17px;
          line-height: 1.75;
          color: rgba(248, 244, 236, 0.66);
        }

        .tss-rows {
          display: grid;
          gap: clamp(40px, 5vw, 68px);
          margin-top: clamp(30px, 3.5vw, 48px);
        }

        .tss-row {
          display: grid;
          gap: clamp(28px, 4vw, 56px);
          align-items: center;
        }
        /* A grid item takes its automatic minimum from its content's
           min-content size, and these images are 720px wide intrinsically —
           without this the track refuses to shrink and the row runs off the
           side of a phone. */
        .tss-row > * { min-width: 0; }

        @media (min-width: 1024px) {
          .tss-row { grid-template-columns: 1.1fr 0.9fr; }
          /* Alternating sides, so three rows do not read as a list. The ORDER
             is swapped rather than the direction, because reversing the grid
             would also reverse it for a screen reader. */
          .tss-row--flip .tss-art { order: 2; }
        }

        /* ── The two phones ── */
        .tss-art {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: center;
          gap: 14px;
        }
        .tss-phone {
          flex: 0 1 auto;
          /* 250px, up from 220px: the art track is ~630px wide inside the
             --4xl container instead of ~390px inside --lg, so the pair no
             longer has to be shrunk to fit beside the copy. The images are
             468px wide as shipped, so this is still comfortably past 2x. */
          width: min(46%, 250px);
          border-radius: 20px;
          padding: 6px;
          background: linear-gradient(150deg, #33363b, #191b1e 55%, #101214);
          box-shadow:
            0 36px 70px -26px rgba(0, 0, 0, 0.9),
            0 0 0 1px rgba(248, 244, 236, 0.07);
        }
        .tss-phone img {
          display: block;
          width: 100%;
          height: auto;
          aspect-ratio: 390 / 844;
          object-fit: cover;
          border-radius: 15px;
        }
        /* The opened invitation sits a little lower than the cover, so the
           pair reads as a sequence rather than as two unrelated pictures. */
        @media (min-width: 768px) {
          .tss-phone--hero { margin-top: 30px; }
        }

        /* ── The words ── */
        .tss-badge {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 999px;
          border: 1px solid rgba(184, 148, 79, 0.4);
          background: rgba(184, 148, 79, 0.1);
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: ${C.goldLight};
        }
        .tss-name {
          font-family: var(--font-serif);
          font-weight: 400;
          font-size: clamp(26px, 3.4vw, 36px);
          color: ${C.ivory};
          margin: 14px 0 0;
        }
        .tss-tagline {
          margin: 6px 0 0;
          font-family: var(--font-sans);
          font-size: 12.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(184, 148, 79, 0.85);
        }
        .tss-arrival {
          margin: 18px 0 0;
          font-family: var(--font-serif);
          font-size: clamp(17px, 2vw, 20px);
          line-height: 1.5;
          color: ${C.ivory};
        }
        .tss-desc {
          margin: 12px 0 0;
          font-size: 15px;
          line-height: 1.75;
          color: rgba(248, 244, 236, 0.6);
        }

        .tss-palette {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-top: 20px;
        }
        .tss-palette span {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          box-shadow: 0 0 0 1px rgba(248, 244, 236, 0.22);
        }
        .tss-palette em {
          font-family: var(--font-sans);
          font-size: 12px;
          font-style: normal;
          color: rgba(248, 244, 236, 0.45);
          margin-inline-start: 4px;
        }

        /* ── CTA ── */
        .tss-cta {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          justify-content: center;
          margin-top: clamp(34px, 4vw, 54px);
        }
      `}</style>

      {/* next/link never receives styled-jsx's hash class, so a scoped rule
          would compile and match nothing — the failure that made every alert
          on this platform invisible. */}
      <style jsx global>{`
        .tss-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 14px 30px;
          border-radius: 10px;
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          background: linear-gradient(135deg, #d7be80, #b8944f);
          color: #191b1e;
          border: 1px solid #b8944f;
          box-shadow: 0 10px 30px rgba(184, 148, 79, 0.26);
          transition: transform 0.18s ease, background 0.18s ease;
        }
        .tss-btn:hover { transform: translateY(-1px); }
        .tss-btn--ghost {
          background: rgba(248, 244, 236, 0.06);
          color: #f8f4ec;
          border: 1px solid rgba(248, 244, 236, 0.28);
          box-shadow: none;
        }
        .tss-btn--ghost:hover { background: rgba(248, 244, 236, 0.12); }
        @media (prefers-reduced-motion: reduce) {
          .tss-btn:hover { transform: none; }
        }
      `}</style>
    </section>
  );
}
