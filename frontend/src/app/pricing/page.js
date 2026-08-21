"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import { usePublicPricing, formatTierPrice, tierCta, tierHref, tierGuestLine } from "../utils/usePublicPricing";
import PlanRecommender from "./PlanRecommender";
import { planColumns } from "./planColumns";
/* The DISPLAY face, shared with the homepage.
   These headings used to be `var(--font-serif)`, which is ABORETO — a
   capitals-only face with a single weight. "Simple, transparent pricing"
   therefore rendered as SIMPLE, TRANSPARENT PRICING, three shouted lines deep
   on a phone, while the homepage next door had moved to Cormorant Garamond.
   Same product, two typographic systems, one screen apart. */
import { T } from "../components/landing/landingTokens";

const faqData = [
  {
    question: "How does billing work?",
    answer: "Each plan is a one-time fee per event, not a recurring subscription — pick the plan that fits that event's guest count and features, pay once, and it's active for that event.",
  },
  {
    question: "Can I upgrade an event to a higher plan later?",
    answer: "Yes — from your event's payment settings you can upgrade to a higher tier at any time. You're only charged the difference between your current plan and the new one, and the upgrade takes effect immediately.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit and debit cards via Stripe. If card payments aren't available for your account, manual/bank-transfer payment methods configured by our team are offered as an alternative.",
  },
  {
    question: "Can I get a refund if I'm not satisfied?",
    answer: "Reach out to our support team and we'll review your situation — refunds are handled case-by-case rather than automatically.",
  },
  {
    question: "Do you offer custom pricing for nonprofits or large organizations?",
    answer: "Contact our sales team with your organization's details — we review nonprofit and high-volume requests individually rather than through a fixed discount.",
  },
  {
    /**
     * Two things this answer is careful NOT to claim.
     *
     * It does not name a tier: the plans above are loaded live from the pricing
     * API and an admin can move `checkin_app` between tiers in Admin → Config at
     * any time, so a hardcoded plan name here would silently go stale — the same
     * trap buildGuestCapFaq below exists to avoid. Pointing at the feature list
     * is safe because that list IS the registry label for whatever an admin
     * assigned (getPublicPricing maps feature keys through getFeatureByKey).
     *
     * And it does not promise the browser scanner as a universal fallback.
     * /checkin looks ungated because the page loads for anyone, but its two real
     * actions are not: backend/routes/checkinRoutes.js puts requireFeature on
     * both `qr_checkin` and `manual_checkin`, so on a plan without them the page
     * opens and then 403s the moment somebody scans a guest at the door. That is
     * a promise this page must not make on a purchase decision.
     */
    question: "Is there an app for checking guests in at the door?",
    answer: "Yes — Fancy Check-in is a dedicated Android tablet app that turns any device into a door scanner. It holds your whole guest list on the device, so it keeps scanning through a venue's dead spots with no internet at all, and syncs back to your dashboard once it reconnects. There is also a browser-based scanner that runs on any device with a connection. Check the feature list above to see which plans include each one.",
    link: { href: "/checkin-app", label: "See how the door app works" },
  },
];

/**
 * Answers the single most ambiguous pricing question: what actually happens
 * once an event's guest count exceeds the largest plan — is there a hidden
 * overage fee, or is upgrading mandatory? Computed from the REAL live tiers
 * (never a hardcoded tier name or guest number, which would silently drift
 * the moment an admin edits pricing) so this can never contradict the cards
 * rendered above it. There is no overage-billing mechanism anywhere in this
 * product — the only two real outcomes are "upgrade to a higher tier" (price
 * difference only) or "this needs a custom/Enterprise quote" — so the answer
 * states both plainly instead of leaving the visitor to guess.
 */
function buildGuestCapFaq(tiers) {
  if (!tiers || tiers.length === 0) return null;
  const fixedTiers = tiers.filter((t) => !t.is_custom);
  const largestFixed = [...fixedTiers].sort((a, b) => (b.max_guests || 0) - (a.max_guests || 0))[0];
  if (!largestFixed) return null;
  const customTier = tiers.find((t) => t.is_custom);
  const capLine = tierGuestLine(largestFixed);
  const noFeeSentence = "To be direct: there is no automatic per-guest overage fee anywhere on this platform — you are never charged extra without explicitly choosing to.";

  if (customTier) {
    return {
      question: `My event has more guests than ${largestFixed.name} allows — do I get billed extra, or do I have to move to ${customTier.name}?`,
      answer: `${noFeeSentence} Once an event reaches its plan's guest cap (${capLine} on ${largestFixed.name}), new RSVPs are simply paused until you upgrade — and upgrading only ever charges the difference between your current plan and the new one (see "Can I upgrade..." above). If your guest count will exceed every fixed plan, that's exactly what ${customTier.name} is for: a custom quote sized to your event, with the guest cap and price agreed before you commit. Select "${tierCta(customTier)}" on the ${customTier.name} card above to start that conversation.`,
    };
  }
  return {
    question: `My event has more guests than ${largestFixed.name} allows — do I get billed extra?`,
    answer: `${noFeeSentence} Once an event reaches its plan's guest cap (${capLine} on ${largestFixed.name}, our largest available plan), new RSVPs are simply paused until you upgrade to a higher plan — upgrading only ever charges the price difference from your current plan (see "Can I upgrade..." above). If your event will exceed even our largest plan, contact us and we'll work out the right plan for it.`,
  };
}

// Comparison features are now built dynamically from the loaded plans.

/* How many feature lines a CARD prints before deferring to the table.
   Six, because the card's list is already a DELTA over the tier below it and
   six is the point past which the tallest card starts setting a height the
   short ones cannot fill: Premium adds nine over Classic while Enterprise+
   adds one over Enterprise, and equal-height cards turn that gap into white
   space. Capping shortens the tallest card, which shortens every hole in the
   row with it. */
const CARD_FEATURE_CAP = 6;

function PricingCard({ plan }) {
  return (
    <div
      className={`pricing-card${plan.highlight ? " pricing-card-highlight" : ""}`}
      style={{
        background: plan.highlight ? "#191B1E" : "#FFFFFF",
        borderRadius: "20px",
        padding: plan.highlight ? "48px 36px" : "44px 36px",
        transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...(plan.highlight
          ? {
              border: "2px solid #B8944F",
              // The -8px "floating above its neighbours" lift only means
              // something when there ARE side-by-side neighbours — moved to
              // .pricing-card-highlight below, gated to hover-capable
              // pointers, precisely because that's the same condition under
              // which .fx-grid is actually laying these out in a row rather
              // than stacking them. Left inline and unconditional, this lift
              // shifted the recommended card up into the card ABOVE it in
              // every single-column mobile stack — an overlap, not a "raised
              // card" effect, on every phone.
              boxShadow: "0 24px 80px rgba(184,148,79,0.2), 0 8px 32px rgba(0,0,0,0.08)",
            }
          : {}),
      }}
    >
      {/* Gold shimmer for highlighted card */}
      {plan.highlight && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: "linear-gradient(90deg, transparent, #B8944F, #D7BE80, #B8944F, transparent)",
          }}
        />
      )}

      {plan.badge && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            padding: "6px 16px",
            borderRadius: "100px",
            background: "linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)",
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          {plan.badge}
        </div>
      )}

      <h3
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: plan.highlight ? "#D7BE80" : "#B8944F",
          marginBottom: "16px",
        }}
      >
        {plan.name}
      </h3>

      {/* flexWrap + a nowrap period, together: four cards in a row are 252px
          wide, and "/ event" was breaking between the slash and the word —
          the price read "$249 /" with "event" orphaned on the next line.
          Wrapping the whole period instead keeps it a phrase wherever it
          lands, and wrap (rather than flex-shrink: 0) means it drops to a
          second line rather than overflowing a card that clips. */}
      <div style={{ marginBottom: "12px", display: "flex", alignItems: "baseline", gap: "4px", flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: T.display,
            fontSize: "52px",
            fontWeight: 700,
            color: plan.highlight ? "#FFFFFF" : "#191B1E",
            lineHeight: 1,
          }}
        >
          {plan.price}
        </span>
        {plan.period && (
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              color: plan.highlight ? "rgba(255,255,255,0.5)" : "#5E5A52",
              whiteSpace: "nowrap",
            }}
          >
            {plan.period}
          </span>
        )}
      </div>

      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          color: plan.highlight ? "rgba(255,255,255,0.5)" : "#5E5A52",
          lineHeight: 1.6,
          marginBottom: "32px",
        }}
      >
        {plan.description}
      </p>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          background: plan.highlight ? "rgba(255,255,255,0.1)" : "#E8E2D6",
          marginBottom: "28px",
        }}
      />

      {/* Set in the display face and not shouted: this line is the reason the
          list below is short, so it has to read as a sentence rather than as
          another label. */}
      {plan.inheritsFrom && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13.5px",
            fontStyle: "italic",
            lineHeight: 1.5,
            color: plan.highlight ? "rgba(255,255,255,0.62)" : "#5E5A52",
            margin: "0 0 16px",
          }}
        >
          Everything in {plan.inheritsFrom}, plus:
        </p>
      )}

      {/* flex: 1 makes this list absorb whatever height the row has spare, so
          the call to action below it sits on the card's floor in every card of
          a row. That is the fix for the desktop defect: the cards are equal
          height by design (a ragged bottom under a price ladder reads as a
          rendering fault), and the spare height used to fall BELOW the last
          feature with nothing under it — Enterprise+ adds exactly one feature
          over Enterprise, so its card was one line of text and ~350px of
          white. The space is the same; it is now padding above a button
          rather than a hole at the bottom of a card. */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1 }}>
        {plan.features.slice(0, CARD_FEATURE_CAP).map((feat) => (
          <li
            key={feat}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              color: plan.highlight ? "rgba(255,255,255,0.75)" : "#5E5A52",
              lineHeight: 1.5,
              padding: "8px 0",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="8" fill={plan.highlight ? "rgba(184,148,79,0.2)" : "rgba(184,148,79,0.1)"} />
              <path d="M5 8l2 2 4-4" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {feat}
          </li>
        ))}
      </ul>

      {/* Nothing is hidden, only deferred: the full matrix is the comparison
          table directly below, which is what that table is for. Without this
          line a capped list would quietly under-sell the tier. */}
      {plan.features.length > CARD_FEATURE_CAP && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: plan.highlight ? "rgba(255,255,255,0.55)" : "#5E5A52",
            margin: "10px 0 0",
          }}
        >
          + {plan.features.length - CARD_FEATURE_CAP} more — see the full comparison below
        </p>
      )}

      {/* `plan.href` is already computed by tierHref() from is_custom — the
          property that actually means "this one is quoted by sales". The
          fallback used to hardcode the NAME "Enterprise", so renaming that
          plan silently pointed its call-to-action at /register and dropped
          every enterprise lead into self-serve signup. */}
      <Link
        href={plan.href || "/register"}
        className={plan.highlight ? "btn-gold" : "btn-outline"}
        style={{
          display: "block",
          textAlign: "center",
          padding: "14px 32px",
          fontSize: "15px",
          fontWeight: 700,
          borderRadius: "10px",
          marginTop: "28px",
          ...(plan.highlight
            ? {}
            : {
                border: "1.5px solid #B8944F",
                color: "#B8944F",
                textDecoration: "none",
                fontFamily: "var(--font-sans)",
                background: "transparent",
                transition: "all 0.3s ease",
              }),
        }}
      >
        {plan.cta}
      </Link>

      <style jsx>{`
        .pricing-card:not(.pricing-card-highlight) {
          border: 1px solid #E8E2D6;
          transform: translateY(0);
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.04);
        }
        .pricing-card:not(.pricing-card-highlight):hover,
        .pricing-card:not(.pricing-card-highlight):focus-within {
          border-color: #B8944F;
          transform: translateY(-8px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
        }
        /* (hover: hover) rather than a width breakpoint on purpose: .fx-grid
           collapses to one column at a width that depends on how many plans
           are loaded (--fx-col varies by the fx-grid--N picked in the JS
           above), so there is no single pixel threshold to hardcode here
           that stays correct for every possible plan count. Hover capability
           is what the lift is actually FOR — a raised card reads as "pick me
           out of the row beside it," which only means something on the
           pointer-driven, side-by-side layout a real mouse implies in the
           first place. Every touch device — where cards are always stacked,
           regardless of how many there are — skips it entirely. */
        @media (hover: hover) and (pointer: fine) {
          .pricing-card-highlight {
            transform: translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
}

function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div
      className="faq-item-row"
      style={{ borderBottom: "1px solid #E8E2D6" }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "24px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontFamily: T.display,
            fontSize: "18px",
            fontWeight: 600,
            color: "#191B1E",
          }}
        >
          {item.question}
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
            flexShrink: 0,
            marginLeft: "16px",
          }}
        >
          <path d="M5 8l5 5 5-5" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div
          style={{
            padding: "0 0 24px",
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            color: "#5E5A52",
            lineHeight: 1.7,
            maxWidth: "680px",
          }}
        >
          {item.answer}
          {/* Optional "and here is the thing itself" link. An answer that names
              a product a visitor cannot then go and look at is half an answer,
              and this FAQ is the last thing read before the pricing decision. */}
          {item.link && (
            <Link href={item.link.href} style={{ display: "inline-block", marginTop: "12px", fontWeight: 700, color: "#B8944F", textDecoration: "none" }}>
              {item.link.label} →
            </Link>
          )}
        </div>
      )}

      <style jsx>{`
        .faq-item-row {
          transition: background 0.3s ease;
          background: transparent;
        }
        .faq-item-row:hover,
        .faq-item-row:focus-within {
          background: rgba(184, 148, 79, 0.02);
        }
      `}</style>
    </div>
  );
}

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState(0);
  /** Phone comparison: the rows every plan shares start collapsed. */
  const [showCommon, setShowCommon] = useState(false);
  const { tiers, error } = usePublicPricing();

  /* ─────────────────────────────────────────────────────────────────────
     EACH CARD LISTS WHAT IT ADDS, NOT EVERYTHING IT HAS.

     Tier features are CUMULATIVE — an admin ticks the full set on each tier
     in /admin/config, so a four-tier ladder is 5 → 12 → 19 → 25 features and
     every card restated everything the cards above it had already listed. On
     a desktop, side by side, that is a comparison. Stacked on a phone it is
     the same list four times: 61 bullets, and the plan section measured
     5,694px of a 10,020px page at 440px — roughly six full iPhone screens of
     mostly repetition.

     So each card now shows "Everything in <previous>, plus" and only its
     DELTA. The full matrix has not gone anywhere; it is the comparison table
     directly below, which is what that table is for.

     THE SUPERSET CHECK IS NOT DECORATION. Nothing in the product enforces
     that a higher tier contains a lower one — the admin ticks each tier
     independently, and an ordinary mistake (or a deliberately odd ladder)
     can leave Enterprise missing something Signature has. Printing
     "Everything in Signature" there would be a false claim on a pricing
     page. When the containment does not hold, the card falls back to its
     full list, which is always true. */
  const rawTiers = tiers || [];
  const plans = rawTiers.map((tier, i) => {
    const { price, period } = formatTierPrice(tier);
    const own = tier.features || [];
    const prev = i > 0 ? rawTiers[i - 1] : null;
    const prevFeatures = prev ? (prev.features || []) : [];

    const isSuperset = prevFeatures.length > 0
      && prevFeatures.every((f) => own.includes(f));
    const shown = isSuperset ? own.filter((f) => !prevFeatures.includes(f)) : own;

    return {
      name: tier.name,
      price,
      period,
      description: tier.description,
      highlight: tier.recommended,
      badge: tier.recommended ? "Most Popular" : undefined,
      cta: tierCta(tier),
      href: tierHref(tier),
      inheritsFrom: isSuperset ? prev.name : null,
      /** What the CARD lists: the delta, under an "Everything in X" line. */
      features: [tierGuestLine(tier), ...shown],
      /** What the TABLE compares: everything this tier actually includes.
       *
       *  These have to stay separate. The comparison table below builds its
       *  matrix by testing `includes(feature)` per plan, so handing it the
       *  delta would mark a tier as NOT having the features it inherits —
       *  rendering a diagonal of ticks in a field of dashes and telling a
       *  customer that Signature does not include the RSVP forms it plainly
       *  does. The card is a summary; the table is the claim. */
      allFeatures: [tierGuestLine(tier), ...own],
    };
  });

  // The guest-cap FAQ is spliced in right after "Can I upgrade..." (index 1)
  // since it directly extends that answer — computed live, see buildGuestCapFaq.
  const guestCapFaq = buildGuestCapFaq(tiers);
  const allFaqData = guestCapFaq
    ? [...faqData.slice(0, 2), guestCapFaq, ...faqData.slice(2)]
    : faqData;

  // Comparison features are built dynamically from the loaded plans.
  // `allFeatures`, NOT `features` — see the note where plans is built. The
  // card's list is a delta and would make every inherited feature read as
  // absent here.
  const comparisonFeatures = (() => {
    const everyFeature = new Set();
    for (const plan of plans) {
      for (const f of (plan.allFeatures || [])) {
        everyFeature.add(f);
      }
    }
    return [...everyFeature].map(feature => {
      const row = { feature };
      for (const plan of plans) {
        row[plan.name] = (plan.allFeatures || []).includes(feature) ? '✓' : '—';
      }
      return row;
    });
  })();

  /**
   * The same rows, split for the phone list: the ones that DIFFER between
   * plans, and the ones every plan shares.
   *
   * Computed here rather than in the markup so the toggle's label can say how
   * many are hidden without counting them twice. A row nobody has (every plan
   * "—") counts as differing, because "no plan includes this" is information;
   * a row everybody has is not.
   */
  const mobileRows = (() => {
    const differing = [];
    const common = [];
    for (const row of comparisonFeatures) {
      const included = plans.filter((p) => row[p.name] === '✓');
      if (plans.length > 0 && included.length === plans.length) common.push(row);
      else differing.push({ ...row, included });
    }
    return { differing, common };
  })();

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ════════════════════ HERO ════════════════════ */}
        <section className="fx-section fx-section--tight-bottom"
          style={{
            background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: "30px", right: "10%", width: "120px", height: "120px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />

          <div className="fx-container fx-container--lg" >
            <div
              style={{
                display: "inline-block",
                padding: "8px 24px",
                borderRadius: "100px",
                background: "rgba(184, 148, 79, 0.08)",
                border: "1px solid rgba(184, 148, 79, 0.15)",
                marginBottom: "28px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#B8944F",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                }}
              >
                Pricing Plans
              </span>
            </div>

            <h1
              style={{
                fontFamily: T.display,
                fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
                fontWeight: 700,
                color: "#191B1E",
                lineHeight: 1.15,
                marginBottom: "24px",
                letterSpacing: "-1px",
              }}
            >
              Simple, Transparent{" "}
              <span style={{ color: "#B8944F" }}>Pricing</span>
            </h1>

            <p className="fx-container fx-container--sm"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "19px",
                lineHeight: 1.7,
                color: "#5E5A52",
              }}
            >
              No hidden fees. No surprises. Choose the plan that fits your event and start creating beautiful RSVPs today.
            </p>
          </div>
        </section>

        {/* ════════════════════ PRICING CARDS ════════════════════ */}
        <section className="fx-container fx-container--4xl fx-section fx-section--flush-top">
          <h2 className="sr-only">Pricing Plans</h2>
          {plans.length > 0 && <PlanRecommender tiers={tiers} />}
          {tiers === null && !error && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "15px", color: "#5E5A52", textAlign: "center" }}>
              Loading plans…
            </p>
          )}
          {(error || (tiers && plans.length === 0)) && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "15px", color: "#5E5A52", textAlign: "center" }}>
              Pricing is temporarily unavailable. Please{" "}
              <Link href="/contact" style={{ color: "#B8944F" }}>contact us</Link> or check back shortly.
            </p>
          )}
          {plans.length > 0 && (
            /* THE PLAN GRID — STATED AT EVERY WIDTH, NOT INFERRED.
               Every layout on this grid is now written down, because the two
               that were left to auto-fit were both wrong, and both were wrong
               in a way that depended on how many tiers an admin happened to
               have configured that month.
               1. THE PHONE. The class used to carry an .fx-grid--N preset
                  picked from plans.length, and each preset sets a different
                  --fx-col: four plans give 260px, six give 160px. Inside a
                  390px phone's 346px of content that is one card per row at
                  four plans and TWO at six — about 155px each, where "Get
                  Started Free" takes three lines and the word ENTERPRISE
                  breaks across two. The screenshot harness was written with
                  four tiers and production runs six, so nothing here had ever
                  rendered what the organizer was looking at.
               2. THE DESKTOP. Measured at 1280: this section is
                  fx-container--4xl (max-width 1200) with fx-section's 48px a
                  side, so the grid box is 1104px and the column-gap resolves
                  to 32. Four .fx-grid--4 columns need 4x260 + 3x32 = 1136 and
                  miss by 32, which orphaned the fourth plan on its own row.
                  That was fixed for four tiers by stating the count from 1024
                  up — but the fix was gated on plans.length <= 4, so at six
                  tiers the same page laid out five across and orphaned
                  Bespoke exactly as before.
               planColumns() below decides the desktop row; the phone and the
               tablet no longer get a vote. minmax(0, 1fr) rather than 1fr
               throughout: a track's automatic minimum is its content's
               min-content width, and one long feature line would otherwise
               push the row wide again.
               `alignItems: start` is also gone. It left four cards of four
               different heights ending at four different points, which on a
               price list reads as a rendering fault rather than as content. */
            <div
              className="fx-grid pricing-plan-grid"
              style={{ "--plan-cols": planColumns(plans.length) }}
            >
              {plans.map((plan) => (
                <PricingCard key={plan.name} plan={plan} />
              ))}
            </div>
          )}
        </section>

        {/* ════════════════════ COMPARISON TABLE ════════════════════ */}
        {plans.length > 0 && (
        <section className="fx-section" style={{ background: "#F8F4EC" }}>
          <div className="fx-container fx-container--xl" >
            <div style={{ textAlign: "center", marginBottom: "56px" }}>
              <h2
                style={{
                  fontFamily: T.display,
                  fontSize: "40px",
                  fontWeight: 700,
                  color: "#191B1E",
                  marginBottom: "16px",
                }}
              >
                Compare{" "}
                <span style={{ color: "#B8944F" }}>Plans</span>
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                }}
              >
                See exactly what you get with each plan.
              </p>
            </div>

            {/* globals.css's own .fx-scroll-x comment names this exact table
                as one of the two things it exists for — a feature-comparison
                table's columns genuinely cannot reflow/wrap the way cards
                can, so this is the one place on the page a horizontal
                scroll port is the correct answer, not a bug. It was already
                scrolling via a hand-written overflowX before this, just
                missing max-width:100% (nothing capped this port to its
                container, only the auto-scroll itself) and
                overscroll-behavior-x (without it, swiping past the last
                column on iOS/Android triggers the browser's own back-
                navigation instead of just stopping). */}
            <p className="cmp-swipe" aria-hidden="true">
              Swipe the table sideways to see every plan
            </p>

            {/* ── THE PHONE VERSION ──────────────────────────────────────────
                Below 768 the table is replaced outright rather than scrolled.

                Measured at 390px the grid showed 1.8 of its 5 columns — the
                third plan's name was cut mid-word — so reading one row meant
                swiping sideways and back, per row, for twenty-five rows. That
                is a scroll port working exactly as designed and a comparison
                nobody can actually make.

                Here each feature names the plans that include it. It is
                shorter than a row of ticks, it needs no header to decode, and
                "which plans have this?" is answered by reading rather than by
                counting columns.

                Both versions render and CSS picks one: no JS, no hydration
                mismatch, and the desktop table stays exactly as it was. */}
            {/* THE ROWS THAT DIFFER COME FIRST — and by default, alone.
                A feature every plan includes cannot help anyone choose
                between them, and with a real ladder those are the MAJORITY of
                rows: at 440px five of the first six read "Every plan", so the
                differences a visitor came for started a screen and a half
                down. They are still available, one tap away, because "what do
                I get at all?" is a fair second question — just not the one
                this table is for. */}
            <ul className="cmp-mobile">
              {mobileRows.differing.map((row) => (
                <li key={row.feature} className="cmp-m-row">
                  <span className="cmp-m-feature">{row.feature}</span>
                  {row.included.length === 0 ? (
                    <span className="cmp-m-none">Not included on any plan</span>
                  ) : (
                    <span className="cmp-m-plans">
                      {row.included.map((p) => (
                        <span
                          key={p.name}
                          className={`cmp-m-plan${p.highlight ? " is-rec" : ""}`}
                        >
                          {p.name}
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              ))}

              {showCommon && mobileRows.common.map((row) => (
                <li key={row.feature} className="cmp-m-row">
                  <span className="cmp-m-feature">{row.feature}</span>
                  <span className="cmp-m-all">Every plan</span>
                </li>
              ))}

              {mobileRows.common.length > 0 && (
                <li className="cmp-m-row cmp-m-toggle">
                  <button type="button" onClick={() => setShowCommon((v) => !v)} aria-expanded={showCommon}>
                    {showCommon
                      ? "Hide what every plan includes"
                      : `Show ${mobileRows.common.length} more on every plan`}
                  </button>
                </li>
              )}
            </ul>

            <div className="fx-scroll-x cmp-wide">
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E8E2D6",
                /* NO overflow:hidden here, deliberately. It used to be, to
                   clip the dark header into the rounded corners — but an
                   ancestor with a non-visible overflow BECOMES the scrollport
                   for any position:sticky inside it, and this one never
                   scrolls, so the sticky feature column below was completely
                   inert: measured at 390px it slid to -207px, i.e. straight
                   off the screen, exactly like a static cell. The corners are
                   rounded by the header and the last row themselves instead. */
                minWidth: `${(plans.length + 2) * 100}px`,
              }}
            >
              {/* Table Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `2fr repeat(${plans.length}, 1fr)`,
                  /* The row's own start padding moves ONTO the sticky cell
                     (below), so that when the cell is stuck to the edge of the
                     scroll port it still carries its 32px inset instead of
                     printing text flush against the table border. */
                  paddingBlock: "20px",
                  paddingInlineStart: 0,
                  paddingInlineEnd: "32px",
                  background: "#191B1E",
                  borderRadius: "16px 16px 0 0",
                }}
              >
                <div className="cmp-feature" style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase", background: "#191B1E", paddingInlineStart: "32px", paddingInlineEnd: "12px" }}>
                  Feature
                </div>
                {plans.map((plan) => (
                  <div
                    key={plan.name}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: plan.highlight ? "#D7BE80" : "rgba(255,255,255,0.5)",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      textAlign: "center",
                    }}
                  >
                    {plan.name}
                  </div>
                ))}
              </div>

              {/* Table Rows */}
              {comparisonFeatures.map((row, i) => (
                <div
                  key={row.feature}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `2fr repeat(${plans.length}, 1fr)`,
                    paddingBlock: "16px",
                    paddingInlineStart: 0,
                    paddingInlineEnd: "32px",
                    borderBottom: i < comparisonFeatures.length - 1 ? "1px solid #F0EBE2" : "none",
                    background: i % 2 === 0 ? "#FDFCF9" : "#FFFFFF",
                    ...(i === comparisonFeatures.length - 1 ? { borderRadius: "0 0 16px 16px" } : {}),
                  }}
                >
                  {/* The sticky cell repeats its row's own striping — a
                      transparent one lets the scrolling columns slide
                      visibly underneath it. */}
                  <div className="cmp-feature" style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#191B1E", fontWeight: 500, background: i % 2 === 0 ? "#FDFCF9" : "#FFFFFF", paddingInlineStart: "32px", paddingInlineEnd: "12px" }}>
                    {row.feature}
                  </div>
                  {plans.map((plan, j) => {
                    const val = row[plan.name] || '—';
                    return (
                      <div
                        key={j}
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "14px",
                          color: val === "—" ? "#CCCCCC" : val === "✓" ? "#B8944F" : "#5E5A52",
                          textAlign: "center",
                          fontWeight: val === "✓" ? 700 : 400,
                        }}
                      >
                        {val}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            </div>
          </div>
        </section>
        )}

        {/* ════════════════════ FAQ ════════════════════ */}
        <section className="fx-section" style={{ background: "#FFFFFF" }}>
          <div className="fx-container fx-container--lg" >
            <div style={{ textAlign: "center", marginBottom: "56px" }}>
              <h2
                style={{
                  fontFamily: T.display,
                  fontSize: "40px",
                  fontWeight: 700,
                  color: "#191B1E",
                  marginBottom: "16px",
                }}
              >
                Frequently Asked{" "}
                <span style={{ color: "#B8944F" }}>Questions</span>
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                }}
              >
                {"Can't find what you're looking for? Contact our support team."}
              </p>
            </div>

            <div style={{ borderTop: "1px solid #E8E2D6" }}>
              {allFaqData.map((item, i) => (
                <FaqItem
                  key={i}
                  item={item}
                  isOpen={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════ CTA ════════════════════ */}
        <section className="fx-section"
          style={{
            background: "linear-gradient(135deg, #191B1E 0%, #2A2D32 100%)",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "500px",
              height: "500px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(184,148,79,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div className="fx-container fx-container--sm" style={{ position: "relative", zIndex: 1 }}>
            <h2
              style={{
                fontFamily: T.display,
                fontSize: "44px",
                fontWeight: 700,
                color: "#FFFFFF",
                marginBottom: "20px",
                lineHeight: 1.2,
              }}
            >
              Start Planning Your{" "}
              <span style={{ color: "#B8944F" }}>Perfect Event</span>
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "18px",
                color: "rgba(255,255,255,0.6)",
                marginBottom: "40px",
                lineHeight: 1.7,
              }}
            >
              Try Fancy RSVP free for 14 days. No credit card required.
            </p>
            <Link
              href="/register"
              className="btn-gold"
              style={{
                padding: "16px 56px",
                fontSize: "16px",
                fontWeight: 700,
                borderRadius: "8px",
              }}
            >
              Get Started Free
            </Link>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        /* THE PLAN ROW AT EVERY WIDTH — see the long note at the grid itself.
           .fx-grid's auto-fit is overridden here from the phone up, because
           what it chose depended on the .fx-grid--N preset, which depended on
           how many tiers pricing has this month. A price list is the one grid
           on this site whose column count must not be an accident.

           ONE card per row on a phone. Two ~155px columns is what six tiers
           produced, and at that width the plan NAME breaks mid-word. Full
           width also puts every feature line and both call-to-action labels on
           a single line, which no amount of type-shrinking would have achieved
           inside half a 390px screen. */
        .pricing-plan-grid {
          grid-template-columns: minmax(0, 1fr);
        }
        /* 640: two cards are 300px+ here, wider than the 260px the card was
           drawn against. */
        @media (min-width: 640px) {
          .pricing-plan-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1024px) {
          .pricing-plan-grid {
            grid-template-columns: repeat(var(--plan-cols), minmax(0, 1fr));
          }
        }

        /* ── The comparison table's first column stays put ────────────────
           The table is the one thing on this page that legitimately cannot
           reflow, so it lives in a scroll port. But scrolling it moved the
           FEATURE NAME off screen too, leaving a grid of ticks and dashes
           with nothing to say what any row was — you could see that Signature
           had a tick, but not what it had a tick FOR. Pinning the first
           column makes the port usable instead of merely present.

           Each sticky cell needs its own opaque background or the scrolling
           columns show through it — and NOTHING between it and .fx-scroll-x
           may set a non-visible overflow, which is why the table card no
           longer clips (see the note there). Both halves are pinned by
           test/pricingResponsive.test.jsx. */
        .cmp-feature {
          position: sticky;
          inset-inline-start: 0;
          z-index: 1;
        }

        /* ── which comparison shows ──────────────────────────────────────
           Phone gets the list; 768 and up gets the table. The swipe hint goes
           with the table, and is now never shown on the widths that used to
           need it — because those widths no longer have a table to swipe. */
        .cmp-swipe,
        .cmp-wide {
          display: none;
        }
        .cmp-swipe::after {
          content: " \\2192";
        }

        .cmp-mobile {
          list-style: none;
          margin: 0;
          padding: 0;
          border: 1px solid #E8E2D6;
          border-radius: 16px;
          overflow: hidden;
          background: #FFFFFF;
        }
        .cmp-m-row {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 14px 16px;
        }
        .cmp-m-row + .cmp-m-row {
          border-top: 1px solid #F0EBE2;
        }
        .cmp-m-row:nth-child(odd) {
          background: #FDFCF9;
        }
        .cmp-m-feature {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 600;
          color: #191B1E;
          line-height: 1.35;
        }
        .cmp-m-plans {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .cmp-m-plan {
          font-family: var(--font-sans);
          font-size: 11px;
          letter-spacing: 0.04em;
          color: #5E5A52;
          background: #F8F4EC;
          border: 1px solid #E8E2D6;
          border-radius: 999px;
          padding: 3px 10px;
          white-space: nowrap;
        }
        /* The recommended plan is marked here too. Without it the chip row
           gives no clue which plan the page is steering toward, which the
           table communicated with a gold column header. */
        .cmp-m-plan.is-rec {
          color: #8A6D34;
          border-color: rgba(184, 148, 79, 0.45);
          background: rgba(184, 148, 79, 0.08);
          font-weight: 600;
        }
        .cmp-m-all,
        .cmp-m-none {
          font-family: var(--font-sans);
          font-size: 12px;
          color: #5E5A52;
        }
        .cmp-m-all {
          color: #8A6D34;
        }
        .cmp-m-toggle {
          padding: 0;
        }
        .cmp-m-toggle button {
          width: 100%;
          /* 44px: a control shorter than this is a control people miss. */
          min-height: 48px;
          padding: 0 16px;
          background: none;
          border: 0;
          text-align: start;
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #8A6D34;
        }

        @media (min-width: 768px) {
          .cmp-mobile {
            display: none;
          }
          .cmp-wide {
            display: block;
          }
          /* Still overflows between 768 and roughly 1100 with four plans, so
             the hint comes back exactly where the swipe is real. */
          .cmp-swipe {
            display: block;
            font-family: var(--font-sans);
            font-size: 13px;
            color: #8A8579;
            text-align: center;
            margin: 0 0 12px;
          }
        }
        @media (min-width: 1280px) {
          .cmp-swipe {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
