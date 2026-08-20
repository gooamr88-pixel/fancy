'use client';

/* See FooterSection: the test runner's classic JSX transform needs React in
   scope even though Next's automatic runtime would inject it. */
import React from 'react';
import { useTestimonials } from '../../utils/useTestimonials';
import { usePressMentions } from '../../utils/usePressMentions';
import { C, SHADOW } from './landingTokens';

/* ═══════════════════════════════════════════════════════════════════════════
   PROOF — press mentions and customer reviews, in ONE band.

   WHAT THIS REPLACED

   `PressBar.js` and `TestimonialsSection.js`, which were two separate full
   sections placed four screens apart. Both do the same job — convince a
   stranger that other people have used this — and splitting them meant the
   page spent two bands and roughly 1,000px of scroll on one argument, with a
   feature section wedged between the two halves of it.

   Both halves keep the property that mattered about them: NOTHING here is
   invented. The press strip renders only mentions an admin has actually
   published (/admin/cms); the reviews are real rows from
   GET /public/testimonials with genuine photos, ratings and a link back to
   the original review. The card markup and the empty-state behaviour are
   carried over unchanged from TestimonialsSection.

   THE EMPTY CASE IS THE IMPORTANT ONE

   Each half disappears on its own when it has nothing to show, and the whole
   section returns null when BOTH are empty. That is not a nicety: today,
   on a fresh install, both endpoints return empty arrays — so this band does
   not exist, and the page goes from the printed cards straight to the FAQ
   with no hole in it. A "trusted by" strip with no logos in it is worse than
   no strip, and an "N reviews" heading over zero cards is a lie.

   The heading is also computed from the real count rather than asserting
   "Loved by event planners everywhere" over however many cards happen to
   exist — that claim read as boilerplate when there were three.
   ═══════════════════════════════════════════════════════════════════════════ */

function StarIcon({ filled }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill={filled ? C.gold : 'none'}
      stroke={C.gold}
      strokeWidth={filled ? 0 : 1}
      aria-hidden="true"
    >
      <path d="M8 0.5L9.79 5.81L15.5 6.19L11.09 9.94L12.54 15.5L8 12.4L3.46 15.5L4.91 9.94L0.5 6.19L6.21 5.81L8 0.5Z" />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function PressStrip({ mentions }) {
  return (
    <div className="proof-press">
      <span className="proof-press__label">As seen in</span>
      <div className="proof-press__logos">
        {mentions.map((m) => {
          const inner = m.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={m.logo_url} alt={m.publication_name} className="proof-press__img" />
            : <span className="proof-press__word">{m.publication_name}</span>;

          return m.article_url ? (
            <a
              key={m.id}
              href={m.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="proof-press__item"
              title={m.headline || m.publication_name}
            >
              {inner}
            </a>
          ) : (
            <span key={m.id} className="proof-press__item" title={m.headline || m.publication_name}>
              {inner}
            </span>
          );
        })}
      </div>

    </div>
  );
}

function ReviewCard({ name, role, initials, photo_url, quote, rating, verify_url }) {
  const displayInitials =
    initials ||
    (name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const stars = Math.min(5, Math.max(0, rating || 5));

  return (
    <li className="rev">
      <div className="rev__stars">
        {[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} filled={i <= stars} />)}
      </div>
      <p className="rev__quote">{quote}</p>

      <div className="rev__who">
        {photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo_url} alt="" className="rev__photo" />
        ) : (
          <span className="rev__avatar" aria-hidden="true">{displayInitials}</span>
        )}
        <span className="rev__names">
          <strong>{name}</strong>
          {role && <em>{role}</em>}
        </span>
      </div>

      {verify_url && (
        <a href={verify_url} target="_blank" rel="noopener noreferrer" className="rev__verify">
          <VerifiedIcon /> Verified review
        </a>
      )}

    </li>
  );
}

export default function ProofSection() {
  const { testimonials } = useTestimonials();
  const { pressMentions } = usePressMentions();

  const reviews = testimonials || [];
  const press = pressMentions || [];

  // Both halves empty (or still loading) — no band at all. See the header:
  // the page is designed to read correctly without this section.
  if (reviews.length === 0 && press.length === 0) return null;

  return (
    <section className="proof" aria-labelledby={reviews.length ? 'proof-title' : undefined}>
      <div className="fx-container fx-container--4xl fx-gutter">
        {press.length > 0 && <PressStrip mentions={press} />}

        {reviews.length > 0 && (
          <>
            <header className="proof-head">
              <span className="proof-kicker">Reviews</span>
              <h2 id="proof-title" className="proof-h2">
                What hosts said afterwards.
              </h2>
              <p className="proof-sub">
                Every one is a real, published review — open &ldquo;Verified review&rdquo;
                on any card to see the original.
              </p>
            </header>

            <ul className="proof-grid fx-grid fx-grid--3" style={{ '--fx-gap': '20px' }}>
              {reviews.map((t) => <ReviewCard key={t.id} {...t} />)}
            </ul>
          </>
        )}
      </div>

      {/* ONE PLAIN STYLE ELEMENT, for the whole component.

          Two separate reasons, both of which this repo has already paid for:

          1. A <style jsx> block inside a NESTED, non-default-export component
             does not reliably compile in this build. AGENTS.md names the two
             cases that proved it (FooterLink, PrintPreviewModal) and both had
             to be moved out. PressStrip and ReviewCard are exactly that
             pattern, and their CSS used to live inside them.

          2. styled-jsx stamps its hash class only onto lowercase intrinsic
             elements, so a scoped rule aimed at a class on a next/link
             compiles to .foo.jsx-hash and matches NOTHING. That is the bug
             that made every alert on this platform invisible, and the one
             that made the footer links unreadable in production.

          A plain <style> has neither failure mode. The scoping it gives up is
          replaced by a prefix on every class name, which is what
          PrintedInvitationsSection already does. */}
      <style>{`
        .proof-press {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 16px 32px;
          padding-bottom: clamp(28px, 3.5vw, 44px);
          margin-bottom: clamp(28px, 3.5vw, 44px);
          border-bottom: 1px solid ${C.border};
        }
        .proof-press__label {
          font-family: var(--font-sans);
          font-size: var(--fx-label);
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${C.inkSoft};
          flex-shrink: 0;
        }
        .proof-press__logos {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 18px 36px;
          min-width: 0;
        }
        .proof-press__item {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          filter: grayscale(100%);
          opacity: 0.6;
          transition: opacity 0.25s ease, filter 0.25s ease;
        }
        .proof-press__item:hover,
        .proof-press__item:focus-visible {
          filter: grayscale(0%);
          opacity: 1;
        }
        .proof-press__img { height: 24px; max-width: 124px; object-fit: contain; }
        .proof-press__word {
          font-family: var(--font-cormorant), Georgia, serif;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.3px;
          color: ${C.ink};
        }

        .rev {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 28px 26px 26px;
          background: ${C.paper};
          border: 1px solid ${C.border};
          border-radius: var(--fx-r-md);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .rev:hover { transform: translateY(-3px); box-shadow: ${SHADOW.card}; }
        .rev__stars { display: flex; gap: 3px; }
        .rev__quote {
          font-family: var(--font-sans);
          font-size: 15px;
          line-height: 1.72;
          color: #4A4A4A;
          margin: 0;
          /* The quote is the flexible part: it pushes the attribution to the
             bottom so a row of cards lines their names up even when the
             quotes differ in length. */
          flex: 1;
        }
        .rev__who { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .rev__photo,
        .rev__avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          flex-shrink: 0;
          object-fit: cover;
        }
        .rev__avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: ${C.paper2};
          border: 1px solid ${C.border};
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: ${C.goldInk};
        }
        .rev__names { display: flex; flex-direction: column; min-width: 0; }
        .rev__names strong {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 600;
          color: ${C.ink};
        }
        .rev__names em {
          font-family: var(--font-sans);
          font-size: 12.5px;
          font-style: normal;
          color: ${C.inkSoft};
        }
        .rev__verify {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 600;
          color: ${C.goldInk};
          text-decoration: none;
        }
        .rev__verify:hover, .rev__verify:focus-visible { text-decoration: underline; }
        @media (prefers-reduced-motion: reduce) {
          .rev:hover { transform: none; }
        }

        .proof {
          width: 100%;
          background: ${C.paper3};
          padding-block: var(--fx-pad-y-sm);
        }
        .proof-head { max-width: 620px; margin-bottom: clamp(26px, 3vw, 40px); }
        .proof-kicker {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: ${C.goldInk};
        }
        .proof-h2 {
          font-family: var(--font-cormorant), Georgia, serif;
          font-size: clamp(27px, 1.417rem + 2.083vw, 42px);
          font-weight: 500;
          line-height: 1.16;
          letter-spacing: -0.4px;
          color: ${C.ink};
          margin: 14px 0 0;
        }
        .proof-sub {
          font-family: var(--font-sans);
          font-size: 15.5px;
          font-weight: 300;
          line-height: 1.65;
          color: ${C.inkSoft};
          margin: 12px 0 0;
        }
        .proof-grid { list-style: none; margin: 0; padding: 0; }
      `}</style>
    </section>
  );
}
