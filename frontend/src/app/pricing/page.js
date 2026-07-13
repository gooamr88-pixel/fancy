"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import { usePublicPricing, formatTierPrice, tierCta, tierHref, tierGuestLine } from "../utils/usePublicPricing";

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
];

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
              transform: "translateY(-8px)",
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

      <div style={{ marginBottom: "12px", display: "flex", alignItems: "baseline", gap: "4px" }}>
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

      <Link
        href={plan.href || (plan.name === "Enterprise" ? "/contact" : "/register")}
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
        <section
          style={{
            background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
            padding: "100px 48px 80px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: "30px", right: "10%", width: "120px", height: "120px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />

          <div style={{ maxWidth: "700px", margin: "0 auto" }}>
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

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "19px",
                lineHeight: 1.7,
                color: "#5E5A52",
                maxWidth: "520px",
                margin: "0 auto",
              }}
            >
              No hidden fees. No surprises. Choose the plan that fits your event and start creating beautiful RSVPs today.
            </p>
          </div>
        </section>

        {/* ════════════════════ PRICING CARDS ════════════════════ */}
        <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 48px 100px" }}>
          <h2 className="sr-only">Pricing Plans</h2>
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
            <div
              className="pricing-grid"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${plans.length}, 1fr)`,
                gap: "28px",
                alignItems: "start",
              }}
            >
              {plans.map((plan) => (
                <PricingCard key={plan.name} plan={plan} />
              ))}
            </div>
          )}
        </section>

        {/* ════════════════════ COMPARISON TABLE ════════════════════ */}
        {plans.length > 0 && (
        <section style={{ background: "#F8F4EC", padding: "100px 48px" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
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

            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E8E2D6",
                overflow: "hidden",
                minWidth: `${(plans.length + 2) * 100}px`,
              }}
            >
              {/* Table Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `2fr repeat(${plans.length}, 1fr)`,
                  padding: "20px 32px",
                  background: "#191B1E",
                }}
              >
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>
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
                    padding: "16px 32px",
                    borderBottom: i < comparisonFeatures.length - 1 ? "1px solid #F0EBE2" : "none",
                    background: i % 2 === 0 ? "#FDFCF9" : "#FFFFFF",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#191B1E", fontWeight: 500 }}>
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
        <section style={{ padding: "100px 48px", background: "#FFFFFF" }}>
          <div style={{ maxWidth: "720px", margin: "0 auto" }}>
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
              {faqData.map((item, i) => (
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
        <section
          style={{
            background: "linear-gradient(135deg, #191B1E 0%, #2A2D32 100%)",
            padding: "100px 48px",
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
          <div style={{ position: "relative", zIndex: 1, maxWidth: "600px", margin: "0 auto" }}>
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
        @media (max-width: 1024px) {
          .pricing-grid {
            gap: 20px !important;
          }
        }
        @media (max-width: 768px) {
          .pricing-grid {
            grid-template-columns: 1fr !important;
            max-width: 440px !important;
            margin: 0 auto !important;
          }
        }
        @media (max-width: 640px) {
          section {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
        }
      `}</style>
    </>
  );
}
