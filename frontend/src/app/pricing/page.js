"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import { usePublicPricing, formatTierPrice, tierCta, tierHref, tierGuestLine } from "../utils/usePublicPricing";
import PlanRecommender from "./PlanRecommender";

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
            fontFamily: "var(--font-serif)",
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
          marginBottom: "32px",
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

      {/* Divider */}
      <div
        style={{
          height: "1px",
          background: plan.highlight ? "rgba(255,255,255,0.1)" : "#E8E2D6",
          marginBottom: "28px",
        }}
      />

      <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1 }}>
        {plan.features.map((feat) => (
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
            fontFamily: "var(--font-serif)",
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
  const { tiers, error } = usePublicPricing();

  const plans = (tiers || []).map((tier) => {
    const { price, period } = formatTierPrice(tier);
    return {
      name: tier.name,
      price,
      period,
      description: tier.description,
      highlight: tier.recommended,
      badge: tier.recommended ? "Most Popular" : undefined,
      cta: tierCta(tier),
      href: tierHref(tier),
      features: [tierGuestLine(tier), ...(tier.features || [])],
    };
  });

  // The guest-cap FAQ is spliced in right after "Can I upgrade..." (index 1)
  // since it directly extends that answer — computed live, see buildGuestCapFaq.
  const guestCapFaq = buildGuestCapFaq(tiers);
  const allFaqData = guestCapFaq
    ? [...faqData.slice(0, 2), guestCapFaq, ...faqData.slice(2)]
    : faqData;

  // Comparison features are built dynamically from the loaded plans.
  const comparisonFeatures = (() => {
    const allFeatures = new Set();
    for (const plan of plans) {
      for (const f of (plan.features || [])) {
        allFeatures.add(f);
      }
    }
    return [...allFeatures].map(feature => {
      const row = { feature };
      for (const plan of plans) {
        row[plan.name] = (plan.features || []).includes(feature) ? '✓' : '—';
      }
      return row;
    });
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
                fontFamily: "var(--font-serif)",
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
            /* THE PLAN GRID, AND WHY A PRESET ALONE WAS NOT ENOUGH.
               This began as a hard repeat(plans.length, 1fr) with no fallback,
               which on a phone squeezed every tier into a sliver narrower than
               its own padding. .fx-grid fixed that: auto-fit reflows to fewer
               columns purely from available width, with no breakpoint to keep
               in sync with however many tiers pricing has this month. The
               modifier is still chosen from the live plan count and clamped to
               [2,6], the range globals.css defines presets for.
               What it did NOT fix, and the margin is 32 pixels. Measured at a
               1280px viewport: this section is fx-container--4xl (max-width
               1200) with fx-section's 48px of padding a side, so the grid's
               content box is 1104px, and the desktop column-gap resolves to
               32px. Four .fx-grid--4 columns need 4x260 + 3x32 = 1136. It
               misses by 32, auto-fit drops to three, and the fourth plan lands
               alone on a second row beside an empty two-thirds of the page —
               on every desktop, for every four-tier price list.
               So from 1024px up, where there is definitely room, the count is
               stated outright instead of inferred. minmax(0, 1fr) rather than
               1fr: a track's automatic minimum is its content's min-content
               width, and one long feature line would otherwise push the row
               wide again. Only up to four — five equal columns inside 1104px
               would be ~200px each, and below that auto-fit's judgement beats
               mine.
               `alignItems: start` is also gone. It left four cards of four
               different heights ending at four different points, which on a
               price list reads as a rendering fault rather than as content. */
            <div
              className={`fx-grid fx-grid--${Math.min(Math.max(plans.length, 2), 6)}${plans.length <= 4 ? " pricing-plan-grid" : ""}`}
              style={{ "--plan-count": plans.length }}
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
                  fontFamily: "var(--font-serif)",
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

            <div className="fx-scroll-x">
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
                  fontFamily: "var(--font-serif)",
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
                fontFamily: "var(--font-serif)",
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
        /* See the note at the grid: auto-fit misses four columns by 32px in
           this container, so the count is stated from 1024 up. Below that,
           .fx-grid's own auto-fit does the reflowing. */
        @media (min-width: 1024px) {
          .pricing-plan-grid {
            grid-template-columns: repeat(var(--plan-count), minmax(0, 1fr));
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

        /* A cut-off column header reads as a broken page, not as something
           you can swipe — say so, on the widths where the table actually
           overflows. */
        .cmp-swipe {
          font-family: var(--font-sans);
          font-size: 13px;
          color: #8A8579;
          text-align: center;
          margin: 0 0 12px;
        }
        .cmp-swipe::after {
          content: " \\2192";
        }
        @media (min-width: 768px) {
          .cmp-swipe {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
