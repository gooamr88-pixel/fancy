'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { C, T } from '../components/landing/landingTokens';
import { priceOf, capacityOf, ctaOf, hrefOf, formatCount } from './pricingData';

/* ═══════════════════════════════════════════════════════════════════════════
   THE PLAN FINDER — "tell me the guest count, I will tell you the plan".

   Driven entirely by the live tiers: the same data the ladder above renders
   and the same data checkout charges against. Deliberately not a scarcity
   widget; the only persuasion here is removing the "which one is right for
   me?" friction with an answer that is honestly the CHEAPEST qualifying plan
   rather than the dearest.

   ── WHAT CHANGED, AND WHY IT MOVED ────────────────────────────────────────

   This used to sit between the hero and the prices, as a 40px-padded white
   card carrying its own heading, subheading, a slider, a number field and —
   the expensive part — a chip for every feature in the ladder. A full ladder
   is ~25 features, so at 440px that was an 824px wall inside a 1,671px card,
   before a visitor had reached a single price. On a phone the whole component
   measured roughly 1,300px: a screen and a half of form, first.

   Three changes, in the order they matter:

   1. It is now BELOW the prices, as a helper for someone the ladder did not
      settle, and PricingClient owns the heading around it. Anyone who already
      knows their guest count never has to touch it.
   2. The must-have chips are behind a disclosure, closed. The heading itself
      calls them optional; a wall of 25 optional controls is not a default.
   3. It is on the landing tokens rather than the retired palette.

   Plain <style>, not <style jsx>: the call to action is a next/link, and
   styled-jsx stamps its hash class only onto lowercase intrinsic elements, so
   a scoped rule aimed at .pr-btn would compile to .pr-btn.jsx-hash and match
   nothing at all. No backticks inside the CSS comments below.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PlanRecommender({ tiers }) {
  const [guestCount, setGuestCount] = useState(100);
  const [mustHave, setMustHave] = useState(new Set());
  const [showFeatures, setShowFeatures] = useState(false);

  const allFeatures = useMemo(() => {
    const set = new Set();
    for (const t of tiers || []) for (const f of t.features || []) set.add(f);
    return [...set];
  }, [tiers]);

  /* The slider's ceiling is the largest FIXED plan's real cap, never a
     hardcoded number that would drift the moment an admin edits pricing. Once
     dragged to the top the answer naturally falls to the quoted tier, so the
     slider never implies a hard ceiling on what the platform supports — only
     where fixed pricing stops and a conversation begins. */
  const largestFixedCap = useMemo(() => {
    const caps = (tiers || []).filter((t) => !t.is_custom && t.max_guests > 0).map((t) => t.max_guests);
    return caps.length ? Math.max(...caps) : 1000;
  }, [tiers]);

  /* Deep-links into the contact form with the subject and guest count already
     filled in, so somebody who has just told us their event is too big for a
     fixed plan does not have to repeat themselves in the message box. */
  const contactHref = useMemo(
    () => `/contact?subject=enterprise&guests=${encodeURIComponent(guestCount)}`,
    [guestCount],
  );

  const toggleFeature = (f) => {
    setMustHave((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  const { recommended, qualifyingCount, fallback } = useMemo(() => {
    const list = tiers || [];
    const required = [...mustHave];
    const qualifies = (t) => {
      const capOk = !(t.max_guests > 0) || t.max_guests >= guestCount;
      return capOk && required.every((f) => (t.features || []).includes(f));
    };
    const qualifying = list.filter(qualifies);
    const cheapestFixed = qualifying
      .filter((t) => !t.is_custom)
      .sort((a, b) => (a.price_cents || 0) - (b.price_cents || 0))[0];
    if (cheapestFixed) return { recommended: cheapestFixed, qualifyingCount: qualifying.length, fallback: false };
    const customTier = qualifying.find((t) => t.is_custom);
    if (customTier) return { recommended: customTier, qualifyingCount: qualifying.length, fallback: false };
    /* Nothing qualifies outright — fall back to the highest-capacity tier as
       the closest real option, FLAGGED, so the copy can be honest about it
       being an approximation rather than a guaranteed fit. */
    const closest = [...list].sort((a, b) => (b.max_guests || Infinity) - (a.max_guests || Infinity))[0] || null;
    return { recommended: closest, qualifyingCount: 0, fallback: true };
  }, [tiers, guestCount, mustHave]);

  if (!tiers || tiers.length === 0) return null;

  const price = recommended ? priceOf(recommended) : null;
  /* A free tier is usually NAMED "Free" and PRICED "Free", and printing both
     gave two near-identical display lines, which reads as a rendering fault
     rather than as a name above a price. String() on BOTH sides: price_label
     comes out of admin-editable JSONB with no type enforcement, and a numeric
     label would reach .trim() as a number and take the page down. */
  const priceRepeatsName = price
    && String(price.amount ?? '').trim().toLowerCase() === String(recommended.name ?? '').trim().toLowerCase();

  return (
    <div className="pr">
      <div className="pr-ask">
        <label className="pr-label" htmlFor="pr-guest-count">
          How many guests are you expecting?
        </label>

        <div className="pr-nums">
          <input
            id="pr-guest-count"
            className="pr-num"
            type="number"
            min="1"
            value={guestCount}
            onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value) || 1))}
          />
          <span className="pr-numnote">
            Type any number — above {formatCount(largestFixedCap)} we will quote you instead.
          </span>
        </div>

        <input
          className="pr-range"
          type="range"
          min="10"
          max={largestFixedCap}
          step="10"
          aria-label="Expected guest count"
          value={Math.min(guestCount, largestFixedCap)}
          onChange={(e) => setGuestCount(Number(e.target.value))}
        />
        <div className="pr-scale">
          <span>10</span>
          <span>{formatCount(largestFixedCap)}+</span>
        </div>

        {allFeatures.length > 0 && (
          <div className="pr-feat">
            {/* CLOSED BY DEFAULT — see the note at the top of this file for
                the measurement. Anything already ticked is summarised on the
                button, so a collapsed list can never hide an active filter
                and leave an answer that looks unexplained. */}
            <button
              type="button"
              className="pr-disclose"
              onClick={() => setShowFeatures((v) => !v)}
              aria-expanded={showFeatures}
            >
              {showFeatures ? 'Hide must-haves' : 'Add must-haves (optional)'}
              {mustHave.size > 0 && <span className="pr-count">{mustHave.size} chosen</span>}
            </button>

            {showFeatures && (
              <div className="pr-chips">
                {allFeatures.map((f) => {
                  const active = mustHave.has(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      className={`pr-chip${active ? ' is-on' : ''}`}
                      onClick={() => toggleFeature(f)}
                      aria-pressed={active}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── The answer ─────────────────────────────────────────────────── */}
      <div className="pr-answer">
        {recommended ? (
          <>
            <span className="pr-answer__label">
              {fallback ? 'Closest match' : 'Your plan'}
            </span>
            <h3 className="pr-answer__name">{recommended.name}</h3>
            {!priceRepeatsName && (
              <div className="pr-answer__price">
                <span className="pr-answer__amount">{price.amount}</span>
                <span className="pr-answer__per">{price.note}</span>
              </div>
            )}
            <p className="pr-answer__cap">
              Holds {capacityOf(recommended).value === 'Unlimited'
                ? 'as many guests as you need'
                : `up to ${capacityOf(recommended).value} guests`}
              {fallback && ' — our largest fixed plan'}
            </p>

            <Link
              href={(fallback || recommended.is_custom) ? contactHref : hrefOf(recommended)}
              className="pr-btn"
            >
              {fallback ? 'Talk to us' : ctaOf(recommended)}
            </Link>

            {/* The one place this ambiguity actually bites, answered in plain
                language exactly where it happens — never a silent charge. */}
            {fallback ? (
              <p className="pr-answer__note">
                That is more guests than any plan here holds. Nothing is charged automatically
                — <Link href={contactHref} className="pr-inline">tell us about the event</Link> and
                we will quote a plan sized to it before anything is billed.
              </p>
            ) : recommended.is_custom ? (
              <p className="pr-answer__note">
                Priced around your event. You will get a clear quote from a person before
                anything is charged.
              </p>
            ) : qualifyingCount > 1 && (
              <p className="pr-answer__note">
                {qualifyingCount - 1} other plan{qualifyingCount - 1 === 1 ? '' : 's'} would
                also cover this — it is just the cheapest that does.
              </p>
            )}
          </>
        ) : (
          <p className="pr-answer__note">
            Prices are not loading — <Link href="/contact" className="pr-inline">contact us</Link> and
            we will send them over.
          </p>
        )}
      </div>

      <style>{`
        .pr {
          display: flex;
          flex-direction: column;
          gap: 26px;
          margin-top: 30px;
          border: 1px solid ${C.border};
          background: ${C.paper};
          padding: 28px 22px 30px;
        }
        .pr-label {
          display: block;
          font-family: ${T.body};
          font-size: 13px;
          font-weight: 600;
          color: ${C.ink};
          margin-bottom: 12px;
        }
        .pr-nums { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
        .pr-num {
          width: 116px;
          flex: none;
          box-sizing: border-box;
          padding: 11px 13px;
          border: 1px solid ${C.border};
          background: ${C.paper};
          font-family: ${T.display};
          /* 16px MINIMUM, and this is the only text input on the page. iOS
             Safari zooms the whole page in when a focused field's text is
             under 16px and never zooms back out — one tap and the visitor is
             stranded at 1.3x with the prices off screen. */
          font-size: 21px;
          color: ${C.ink};
          outline: none;
        }
        .pr-num:focus { border-color: ${C.gold}; }
        .pr-numnote {
          font-family: ${T.body};
          font-size: 12px;
          font-weight: 300;
          line-height: 1.5;
          color: ${C.inkSoft};
          min-width: 0;
        }
        .pr-range {
          width: 100%;
          margin: 20px 0 0;
          accent-color: ${C.gold};
        }
        .pr-scale {
          display: flex;
          justify-content: space-between;
          font-family: ${T.body};
          font-size: 11px;
          color: ${C.inkSoft};
          margin-top: 4px;
        }

        .pr-feat { margin-top: 22px; border-top: 1px solid ${C.border}; padding-top: 6px; }
        .pr-disclose {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          padding: 0;
          background: none;
          border: 0;
          cursor: pointer;
          font-family: ${T.body};
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: ${C.goldInk};
          text-decoration: underline;
          text-underline-offset: 5px;
        }
        .pr-count {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: ${C.goldInk};
          border: 1px solid ${C.gold};
          border-radius: 999px;
          padding: 2px 9px;
          text-decoration: none;
        }
        .pr-chips { display: flex; flex-wrap: wrap; gap: 7px; padding: 4px 0 6px; }
        .pr-chip {
          padding: 7px 13px;
          border-radius: 999px;
          border: 1px solid ${C.border};
          background: ${C.paper};
          color: ${C.inkSoft};
          font-family: ${T.body};
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
        }
        .pr-chip.is-on {
          border-color: ${C.gold};
          background: ${C.paper3};
          color: ${C.goldInk};
        }

        .pr-answer {
          border: 1px solid ${C.border};
          background: ${C.paper2};
          padding: 26px 22px 28px;
          display: flex;
          flex-direction: column;
          /* Side by side this panel stretches to the height of the input
             column, which is driven by however many chips the tiers happen to
             produce. Centring costs nothing when it stacks on a phone, where
             the panel is only as tall as its contents. */
          justify-content: center;
        }
        .pr-answer__label {
          font-family: ${T.label};
          font-size: 10px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: ${C.goldInk};
        }
        .pr-answer__name {
          font-family: ${T.display};
          font-size: 30px;
          font-weight: 400;
          line-height: 1.1;
          color: ${C.ink};
          margin: 12px 0 0;
        }
        .pr-answer__price { display: flex; align-items: baseline; gap: 8px; margin-top: 8px; }
        .pr-answer__amount {
          font-family: ${T.display};
          font-size: 28px;
          color: ${C.ink};
        }
        .pr-answer__per {
          font-family: ${T.body};
          font-size: 11.5px;
          color: ${C.inkSoft};
        }
        .pr-answer__cap {
          font-family: ${T.body};
          font-size: 13px;
          font-weight: 300;
          line-height: 1.6;
          color: ${C.inkSoft};
          margin: 12px 0 0;
        }
        .pr-answer__note {
          font-family: ${T.body};
          font-size: 12px;
          font-weight: 300;
          line-height: 1.7;
          color: ${C.inkSoft};
          margin: 14px 0 0;
        }
        .pr-inline {
          color: ${C.ink};
          text-decoration: none;
          border-bottom: 1px solid ${C.gold};
        }
        .pr-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          margin-top: 20px;
          padding: 0 22px;
          border: 1px solid ${C.ink};
          background: ${C.ink};
          color: ${C.ivory};
          font-family: ${T.body};
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          text-decoration: none;
          text-align: center;
          transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease;
        }
        .pr-btn:hover { background: ${C.gold}; border-color: ${C.gold}; color: ${C.ink}; }

        /* Two columns only from 1024. At 768 each half is about 330px: the
           chips wrap one per line into a tall ragged column while the answer
           beside it, which is short, sits in a half-empty box. */
        @media (min-width: 1024px) {
          .pr {
            display: grid;
            grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
            gap: 36px;
            padding: 34px 32px 36px;
          }
        }
      `}</style>
    </div>
  );
}
