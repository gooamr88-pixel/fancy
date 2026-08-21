'use client';

import React from 'react';
import Link from 'next/link';
import { C, T, ON_INK } from '../components/landing/landingTokens';
import PlanRecommender from './PlanRecommender';
import { buildLadder } from './pricingData';

/* ═══════════════════════════════════════════════════════════════════════════
   /pricing — the visible half.

   ── WHY THIS WAS REBUILT RATHER THAN ADJUSTED ─────────────────────────────

   The homepage was rebuilt on 2026-08-20 onto components/landing/
   landingTokens.js: a warm paper scale, 1px hairlines, Cormorant Garamond for
   headings, Aboreto for tracked micro-labels ONLY, and exactly one ink block
   used as punctuation. This page never moved. It hardcoded #FFFFFF, #F8F4EC,
   #E8E2D6, #B8944F and #191B1E, drew 20px-radius cards with pill badges and
   80px gold glows, and painted TWO full-dark surfaces. Clicking Home →
   Pricing in the nav changed the brand. Everything below is on the tokens.

   ── THE THREE STRUCTURAL DECISIONS ────────────────────────────────────────

   1. PRICES BEFORE THE PLAN FINDER. The finder used to sit between the hero
      and the plans: on a phone that is roughly 1,300px — a screen and a half
      of slider, number field and a seven-row chip wall — before a single
      price. The first question a stranger has is what it costs, and the page
      answered with a form. It is now a helper BELOW the prices, for someone
      the ladder did not settle.

   2. A LADDER, NOT A CARD GRID. See buildLadder() in pricingData.js for the
      arithmetic. Short version: a card grid must answer "how many across?"
      for a tier count an admin controls, that answer has been wrong twice,
      and equal-height cards turn an uneven ladder into holes — Enterprise+
      was a $599 price above ONE line of text and ~250px of white.

   3. CAPACITY IS A NUMBER, NOT A TICK. The single worst defect on the old
      page: the guest cap was injected into each tier's feature list, so the
      comparison table's first row read "Up to 100 guests — tick under Free,
      dash under all five paid plans", telling a customer the $299 plan could
      not hold 100 guests. Six rows were like that. Capacity and the event
      allowance are now value rows carrying each plan's own number.

   ── PLAIN <style>, NOT <style jsx> ────────────────────────────────────────

   styled-jsx stamps its hash class only onto lowercase intrinsic elements, so
   any rule aimed at a class on a next/link compiles to .pp-btn.jsx-hash and
   matches NOTHING. Every call to action in the ladder is a Link. This is the
   bug that made this platform's alerts invisible in production; FaqCtaSection
   carries the same note. Classes are prefixed "pp-".

   No backticks inside these CSS comments: one ends the template literal and
   the file stops parsing.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Section kicker: a tracked micro-label and a short rule. The one job
 *  Aboreto is good at — it has no lowercase, so it never gets a sentence. */
function Kicker({ children }) {
  return (
    <span className="pp-kicker">
      {children}
      <span aria-hidden="true" className="pp-kicker__rule" />
    </span>
  );
}

/** One plan. A row, not a card — see the note above. */
function PlanRow({ plan }) {
  return (
    <li className={`pp-row${plan.recommended ? ' is-rec' : ''}`}>
      <div className="pp-row__id">
        <span className="pp-row__name">{plan.name}</span>
        {plan.recommended && <span className="pp-row__flag">Most chosen</span>}
        {plan.description && <p className="pp-row__desc">{plan.description}</p>}
        {/* THE CAP NOBODY WAS TOLD ABOUT.
            `max_events` (0 = unlimited) is re-checked in four places on the
            payment path and REFUSES to publish an event with "You've reached
            the maximum number of events (N) allowed on the 'X' plan." It was
            stored, enforced, and stripped by the public endpoint, so the one
            page promising no surprises was the only surface that could not
            mention it. Printed only when a plan actually sets one — most are
            unlimited, and saying so on every row is noise, not disclosure. */}
        {!plan.events.unlimited && (
          <p className="pp-row__limit">
            Covers {plan.events.value} {plan.events.unit}
          </p>
        )}
      </div>

      {/* The number people actually buy on, set in the display face at the
          size that says so. It used to be tick-bullet number one, identical
          in weight to "Email notifications". */}
      <div className={`pp-row__cap${plan.capacity.unlimited ? ' is-unl' : ''}`}>
        <span className="pp-row__capnum">{plan.capacity.value}</span>
        <span className="pp-row__capunit">{plan.capacity.unit}</span>
      </div>

      <div className="pp-row__price">
        <span className="pp-row__amount">{plan.price.amount}</span>
        <span className="pp-row__per">{plan.price.note}</span>
      </div>

      {/* WHAT IT ADDS, IN WORDS RATHER THAN SET ARITHMETIC.
          The old card asked the reader to hold "Everything in Enterprise+,
          plus:" in their head and subtract. This names the step. */}
      <div className="pp-row__adds">
        {plan.adds.length > 0 ? (
          <>
            <span className="pp-row__addslabel">
              {plan.inheritsFrom ? `Everything in ${plan.inheritsFrom}, and` : 'Includes'}
            </span>
            <span className="pp-row__addslist">
              {plan.named.join(' · ')}
              {plan.moreCount > 0 && ` · and ${plan.moreCount} more`}
            </span>
          </>
        ) : (
          <span className="pp-row__addslabel">
            {plan.inheritsFrom ? `Everything in ${plan.inheritsFrom}, with room for more guests` : 'The essentials'}
          </span>
        )}
      </div>

      <div className="pp-row__go">
        <Link href={plan.href} className={`pp-btn${plan.recommended ? ' pp-btn--ink' : ''}`}>
          {plan.cta}
        </Link>
      </div>
    </li>
  );
}

function Faq({ item, index }) {
  return (
    /* <details>, not a useState openIndex. The native element is keyboard
       accessible, announces its own state and works before hydration; the old
       hand-rolled version was the second accordion on this site doing the same
       job two different ways. */
    <details className="pp-faq" open={index === 0}>
      <summary>
        <span className="pp-faq__q">{item.q}</span>
        <span className="pp-faq__mark" aria-hidden="true" />
      </summary>
      <div className="pp-faq__a">
        <p>{item.a}</p>
        {item.link && (
          <Link href={item.link.href} className="pp-faq__link">{item.link.label}</Link>
        )}
      </div>
    </details>
  );
}

export default function PricingClient({ tiers, faqs, unavailable }) {
  const plans = buildLadder(tiers);
  const hasPlans = plans.length > 0;

  return (
    <main className="pp">
      {/* ─────────────────────── THE PROMISE ─────────────────────── */}
      <section className="pp-band pp-band--hero" aria-labelledby="pp-title">
        <div className="fx-container fx-container--3xl fx-gutter">
          <Kicker>Pricing</Kicker>
          <h1 id="pp-title" className="pp-h1">
            One price per event.<br />
            <em>Paid once.</em>
          </h1>
          <p className="pp-lede">
            There is no monthly subscription here and nothing renews. Pick the plan that
            fits the event you are planning, pay for it once, and it stays yours for that event.
          </p>
          {/* The three facts that answer "how does this work" before anyone
              scrolls. Same three the homepage hero makes, in the same words,
              because a visitor arriving from it must not be told something
              different one click later. */}
          <ul className="pp-assure">
            <li>Free plan to start</li>
            <li>No card until you publish</li>
            <li>No fee per guest</li>
          </ul>
        </div>
      </section>

      {/* ─────────────────────── THE LADDER ─────────────────────── */}
      <section className="pp-band pp-band--plans" aria-labelledby="pp-plans-title">
        <div className="fx-container fx-container--5xl fx-gutter">
          <h2 id="pp-plans-title" className="sr-only">Plans</h2>

          {unavailable || !hasPlans ? (
            <p className="pp-empty">
              Our prices are not loading at the moment. Please{' '}
              <Link href="/contact" className="pp-inline">contact us</Link>{' '}
              and we will send them straight over, or try again shortly.
            </p>
          ) : (
            <>
              <div className="pp-ladder__head" aria-hidden="true">
                <span>Plan</span>
                <span>Guests</span>
                <span>Price</span>
                <span>What it adds</span>
                <span />
              </div>
              <ol className="pp-ladder">
                {plans.map((plan) => <PlanRow key={plan.key} plan={plan} />)}
              </ol>
              <p className="pp-ladder__note">
                Every plan is for one event. Need a bigger one later? Move that event up a
                plan and pay only the difference.
              </p>
            </>
          )}
        </div>
      </section>

      {/* ─────────────────────── THE HELPER ─────────────────────── */}
      {hasPlans && (
        <section className="pp-band pp-band--finder" aria-labelledby="pp-finder-title">
          <div className="fx-container fx-container--4xl fx-gutter">
            <Kicker>Still deciding</Kicker>
            <h2 id="pp-finder-title" className="pp-h2">Tell us the guest count.</h2>
            <p className="pp-sub">
              We will point at the cheapest plan that genuinely covers it — not the dearest one.
            </p>
            <PlanRecommender tiers={tiers} />
          </div>
        </section>
      )}

      {/* ─────────────────────── QUESTIONS, THEN THE ASK ─────────────────────── */}
      <section className="pp-band pp-band--faq" aria-labelledby="pp-faq-title">
        <div className="fx-container fx-container--5xl fx-gutter">
          <div className="pp-faqwrap">
            <div className="pp-faqcol">
              <Kicker>Before you buy</Kicker>
              <h2 id="pp-faq-title" className="pp-h2">The awkward questions.</h2>
              <div className="pp-faqlist">
                {faqs.map((item, i) => <Faq key={item.q} item={item} index={i} />)}
              </div>
            </div>

            <aside className="pp-aside">
              <span className="pp-aside__label">Not on the list</span>
              <h3 className="pp-aside__t">Ask a person instead.</h3>
              <p className="pp-aside__b">
                Send us the guest count, the venue and the date. We will tell you which plan
                fits — or that you do not need a paid one yet.
              </p>
              <div className="pp-aside__go">
                <Link href="/contact" className="pp-btn pp-btn--ink">Talk to us</Link>
                <a href="mailto:info@fancyrsvp.com" className="pp-btn">Email instead</a>
              </div>
              <p className="pp-aside__n">Typically answered the same working day.</p>
            </aside>
          </div>

          {/* The ONE dark surface on this page. As a block inside a paper band
              it reads as punctuation; as a full-bleed band it read as a theme
              switch, and there used to be two of them. */}
          <div className="pp-cta">
            <div className="pp-cta__in">
              <span className="pp-orn" aria-hidden="true">
                <svg width="34" height="29" viewBox="0 0 38 32" fill="none">
                  <rect x="2" y="8" width="34" height="22" stroke={C.gold} strokeWidth="1.3" />
                  <path d="M2 10L19 22L36 10" stroke={C.gold} strokeWidth="1.3" strokeLinejoin="round" />
                  <path d="M4 8L19 0L34 8" stroke={C.gold} strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="pp-cta__t">Build it before you buy it.</h2>
              {/* THE OLD LINE HERE WAS "Try Fancy RSVP free for 14 days. No
                  credit card required." There is no trial in this product and
                  never has been: the model is a free plan plus a one-off fee
                  per event, which is what the homepage hero says. It was the
                  largest type on the page, under a heading promising no
                  surprises, and it was not true. */}
              <p className="pp-cta__b">
                Make your event, see exactly what a guest will see, and only pay when you are
                ready to send it out.
              </p>
              <div className="pp-cta__go">
                <Link href="/register" className="pp-btn pp-btn--ivory">Create your event</Link>
                <Link href="/features" className="pp-btn pp-btn--onink">See what it does</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .pp { width: 100%; background: ${C.paper}; }
        .pp-band { width: 100%; }
        .pp-band--hero    { background: ${C.paper}; padding: 84px 0 40px; }
        .pp-band--plans   { background: ${C.paper}; padding: 0 0 76px; }
        .pp-band--finder  { background: ${C.paper}; padding: 76px 0; }
        .pp-band--faq     { background: ${C.paper2}; padding: 76px 0 84px; }

        /* ── shared type ──────────────────────────────────────────────── */
        .pp-kicker {
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
        .pp-kicker__rule {
          display: block;
          flex: none;
          width: 28px;
          height: 1px;
          background: ${C.gold};
          opacity: 0.55;
        }
        .pp-h1 {
          font-family: ${T.display};
          font-weight: 300;
          font-size: clamp(38px, 6.4vw, 62px);
          line-height: 1.04;
          letter-spacing: -0.02em;
          color: ${C.ink};
          margin: 20px 0 0;
        }
        .pp-h1 em { font-style: italic; color: ${C.gold}; }
        .pp-h2 {
          font-family: ${T.display};
          font-weight: 300;
          font-size: clamp(28px, 3.4vw, 37px);
          line-height: 1.08;
          letter-spacing: -0.015em;
          color: ${C.ink};
          margin: 18px 0 0;
        }
        .pp-lede, .pp-sub {
          font-family: ${T.body};
          font-weight: 300;
          color: ${C.inkSoft};
          margin: 18px 0 0;
          max-width: 60ch;
        }
        .pp-lede { font-size: 16px; line-height: 1.72; }
        .pp-sub  { font-size: 14px; line-height: 1.7; }
        .pp-inline {
          color: ${C.ink};
          text-decoration: none;
          border-bottom: 1px solid ${C.gold};
        }
        .pp-empty {
          font-family: ${T.body};
          font-size: 15px;
          font-weight: 300;
          line-height: 1.7;
          color: ${C.inkSoft};
          border: 1px solid ${C.border};
          background: ${C.paper2};
          padding: 28px 24px;
          margin: 0;
        }

        .pp-assure {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 26px;
          list-style: none;
          margin: 26px 0 0;
          padding: 0;
          font-family: ${T.body};
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: ${C.inkSoft};
        }
        .pp-assure li { display: flex; align-items: center; gap: 9px; }
        .pp-assure li::before {
          content: "";
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${C.gold};
          flex: none;
        }

        /* ── THE LADDER ───────────────────────────────────────────────────
           One row per plan. There is no column-count rule anywhere in here,
           and that is the point: the count of tiers is admin-editable, and
           every previous layout on this page derived itself from it and broke
           the next time it changed. */
        .pp-ladder__head { display: none; }
        .pp-ladder {
          list-style: none;
          margin: 0;
          padding: 0;
          border-top: 1px solid ${C.border};
        }
        .pp-row {
          display: grid;
          /* 12px, not 4: below 640 this is a single stacked column, and at 4px
             the price sat directly under the guest count with no more
             separation than the two halves of one line. */
          gap: 12px 24px;
          padding: 26px 0;
          border-bottom: 1px solid ${C.border};
          align-items: center;
        }
        .pp-row__go { margin-top: 4px; }
        /* The recommended plan is marked with paper and a gold hairline, not
           with a lift. The old highlight carried transform: translateY(-8px),
           which on any stacked layout moved it INTO the plan above it. */
        .pp-row.is-rec {
          background: ${C.paper2};
          box-shadow: inset 2px 0 0 ${C.gold};
          padding-inline: 18px;
        }
        .pp-row__name {
          font-family: ${T.label};
          font-size: 11px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: ${C.ink};
        }
        .pp-row__flag {
          display: inline-block;
          margin-inline-start: 10px;
          font-family: ${T.body};
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${C.goldInk};
          border: 1px solid ${C.gold};
          border-radius: 999px;
          padding: 2px 9px;
          white-space: nowrap;
        }
        .pp-row__desc {
          font-family: ${T.body};
          font-size: 13px;
          font-weight: 300;
          line-height: 1.5;
          color: ${C.inkSoft};
          margin: 7px 0 0;
        }
        .pp-row__limit {
          font-family: ${T.body};
          font-size: 11.5px;
          font-weight: 500;
          line-height: 1.4;
          color: ${C.goldInk};
          margin: 6px 0 0;
        }
        .pp-row__cap { display: flex; align-items: baseline; gap: 7px; }
        .pp-row__capnum {
          font-family: ${T.display};
          font-size: 34px;
          font-weight: 400;
          line-height: 1;
          color: ${C.ink};
        }
        .pp-row__capunit {
          font-family: ${T.body};
          font-size: 12px;
          font-weight: 400;
          color: ${C.inkSoft};
        }
        /* "Unlimited" is a nine-letter WORD where every other plan prints a
           numeral. At the numeral size it measured about 190px in a 150px
           track and ran straight into the price beside it — on the quoted
           tier, whose row is the one a large customer reads. */
        .pp-row__cap.is-unl .pp-row__capnum { font-size: 19px; font-style: italic; }
        .pp-row__price { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .pp-row__amount {
          font-family: ${T.display};
          font-size: 34px;
          font-weight: 400;
          line-height: 1;
          color: ${C.ink};
        }
        .pp-row__per {
          font-family: ${T.body};
          font-size: 11.5px;
          font-weight: 400;
          color: ${C.inkSoft};
          white-space: nowrap;
        }
        .pp-row__adds { min-width: 0; }
        .pp-row__addslabel {
          display: block;
          font-family: ${T.body};
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: ${C.goldInk};
        }
        .pp-row__addslist {
          display: block;
          font-family: ${T.body};
          font-size: 13px;
          font-weight: 300;
          line-height: 1.55;
          color: ${C.inkSoft};
          margin-top: 5px;
        }
        .pp-ladder__note {
          font-family: ${T.body};
          font-size: 13px;
          font-weight: 300;
          line-height: 1.7;
          color: ${C.inkSoft};
          margin: 22px 0 0;
          max-width: 62ch;
        }

        /* ── buttons ──────────────────────────────────────────────────── */
        .pp-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          /* 48, not 44: this is the number the rest of the site settled on
             for a control a thumb has to find. */
          min-height: 48px;
          padding: 0 22px;
          font-family: ${T.body};
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          text-decoration: none;
          text-align: center;
          white-space: nowrap;
          cursor: pointer;
          border: 1px solid ${C.ink};
          background: transparent;
          color: ${C.ink};
          transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
        }
        .pp-btn:hover { background: ${C.ink}; color: ${C.ivory}; }
        .pp-btn--ink { background: ${C.ink}; color: ${C.ivory}; }
        .pp-btn--ink:hover { background: ${C.gold}; border-color: ${C.gold}; color: ${C.ink}; }
        .pp-btn--ivory { background: ${C.ivory}; border-color: ${C.ivory}; color: ${C.ink}; }
        .pp-btn--ivory:hover { background: ${C.gold}; border-color: ${C.gold}; }
        .pp-btn--onink { border-color: ${ON_INK.hairline}; color: ${C.ivory}; }
        .pp-btn--onink:hover { background: ${ON_INK.hairline}; color: ${C.ivory}; }

        /* ── the questions ────────────────────────────────────────────── */
        .pp-faqwrap { display: flex; flex-direction: column; gap: 40px; }
        .pp-faqlist { margin-top: 26px; }
        .pp-faq { border-top: 1px solid ${C.border}; }
        .pp-faq:last-child { border-bottom: 1px solid ${C.border}; }
        .pp-faq summary {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 19px 0;
          cursor: pointer;
          list-style: none;
        }
        .pp-faq summary::-webkit-details-marker { display: none; }
        .pp-faq__q {
          font-family: ${T.display};
          font-size: 20px;
          font-weight: 400;
          line-height: 1.3;
          color: ${C.ink};
          min-width: 0;
        }
        .pp-faq__mark { position: relative; flex: none; width: 14px; height: 14px; margin-top: 6px; }
        .pp-faq__mark::before, .pp-faq__mark::after {
          content: "";
          position: absolute;
          background: ${C.gold};
        }
        .pp-faq__mark::before { left: 0; top: 6.5px; width: 14px; height: 1px; }
        .pp-faq__mark::after {
          left: 6.5px; top: 0; width: 1px; height: 14px;
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .pp-faq[open] .pp-faq__mark::after { opacity: 0; transform: rotate(90deg); }
        .pp-faq__a { padding: 0 0 20px; }
        .pp-faq__a p {
          font-family: ${T.body};
          font-size: 13.5px;
          font-weight: 300;
          line-height: 1.8;
          color: ${C.inkSoft};
          margin: 0;
          max-width: 66ch;
        }
        .pp-faq__link {
          display: inline-block;
          margin-top: 12px;
          font-family: ${T.body};
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${C.ink};
          text-decoration: none;
          border-bottom: 1px solid ${C.gold};
          padding-bottom: 5px;
        }

        .pp-aside {
          border: 1px solid ${C.border};
          background: ${C.paper};
          padding: 30px 24px 32px;
          align-self: start;
        }
        .pp-aside__label {
          font-family: ${T.label};
          font-size: 10px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: ${C.goldInk};
        }
        .pp-aside__t {
          font-family: ${T.display};
          font-size: 24px;
          font-weight: 400;
          line-height: 1.22;
          color: ${C.ink};
          margin: 14px 0 0;
        }
        .pp-aside__b {
          font-family: ${T.body};
          font-size: 13.5px;
          font-weight: 300;
          line-height: 1.75;
          color: ${C.inkSoft};
          margin: 12px 0 0;
        }
        .pp-aside__go { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
        .pp-aside__n {
          font-family: ${T.body};
          font-size: 11.5px;
          font-weight: 300;
          color: ${C.inkSoft};
          margin: 14px 0 0;
        }

        /* ── the ask ──────────────────────────────────────────────────── */
        .pp-cta {
          position: relative;
          margin-top: 56px;
          background: ${C.ink};
          overflow: hidden;
        }
        .pp-cta__in { padding: 54px 26px 58px; text-align: center; }
        .pp-orn { display: inline-block; margin-bottom: 20px; }
        .pp-cta__t {
          font-family: ${T.display};
          font-weight: 300;
          font-size: clamp(28px, 4vw, 40px);
          line-height: 1.1;
          letter-spacing: -0.015em;
          color: ${ON_INK.title};
          margin: 0;
        }
        .pp-cta__b {
          font-family: ${T.body};
          font-size: 14px;
          font-weight: 300;
          line-height: 1.75;
          color: ${ON_INK.body};
          margin: 16px auto 0;
          max-width: 52ch;
        }
        .pp-cta__go {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
          margin-top: 28px;
        }

        /* THE LADDER IS THE ONLY THING THAT REFLOWS, SO IT IS THE ONLY THING
           WITH BREAKPOINTS. Two, not four: 640 splits a row into two lines and
           1024 puts it on one. Everything else on this page is a single
           reading column that needs no width rule at all. */

        /* ═══ 640 ═══════════════════════════════════════════════════════ */
        @media (min-width: 640px) {
          /* The ladder gets its two-column shape: identity and the two
             numbers on one line, the delta and the button under them. */
          .pp-row {
            grid-template-columns: minmax(0, 1fr) auto auto;
            grid-template-areas:
              "id   cap   price"
              "adds adds  go";
            gap: 18px 22px;
          }
          .pp-row__id    { grid-area: id; }
          .pp-row__cap   { grid-area: cap; justify-content: flex-end; }
          .pp-row__price { grid-area: price; justify-content: flex-end; text-align: end; }
          .pp-row__adds  { grid-area: adds; }
          .pp-row__go    { grid-area: go; justify-self: end; }
        }

        /* ═══ 1024 — the ladder becomes one line ═══════════════════════ */
        @media (min-width: 1024px) {
          .pp-ladder__head {
            display: grid;
            grid-template-columns: minmax(0, 1.4fr) 150px 140px minmax(0, 1.45fr) 176px;
            gap: 24px;
            padding: 0 0 10px;
            font-family: ${T.label};
            font-size: 9.5px;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: ${C.inkSoft};
          }
          .pp-row {
            /* 150 and 140, measured: "3,000" plus its unit needs about 137px at
               this size, and 132 let it lean into the price column. */
            grid-template-columns: minmax(0, 1.4fr) 150px 140px minmax(0, 1.45fr) 176px;
            grid-template-areas: "id cap price adds go";
            gap: 24px;
            padding: 24px 0;
          }
          .pp-row.is-rec { padding-inline: 16px; margin-inline: -16px; }
          .pp-row__cap, .pp-row__price { justify-content: flex-start; text-align: start; }
          .pp-row__go { justify-self: stretch; }
          .pp-btn { width: 100%; }
          .pp-aside__go .pp-btn, .pp-cta__go .pp-btn { width: auto; }

          .pp-faqwrap {
            display: grid;
            grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
            gap: 56px;
          }
        }
      `}</style>
    </main>
  );
}
