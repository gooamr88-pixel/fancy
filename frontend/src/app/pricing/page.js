"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

/**
 * Maps an admin-configured tier (from /payments/public-pricing) to this page's
 * card shape, so the pricing page, the landing section, the event-creation step,
 * and what's actually charged all stay in sync.
 */
function tierToPlan(tier) {
  let price;
  let period = "";
  if (tier.is_custom) {
    price = tier.price_label || "Custom";
  } else if (!tier.price_cents) {
    price = tier.price_label || "Free";
  } else {
    const dollars = tier.price_cents / 100;
    price = tier.price_label || `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
    period = "/ event";
  }

  const features = Array.isArray(tier.features) ? [...tier.features] : [];
  if (!tier.is_custom && tier.max_guests > 0 && !features.some((f) => /guest/i.test(f))) {
    features.unshift(`Up to ${tier.max_guests} guests`);
  }

  return {
    name: tier.name,
    price,
    period,
    description: tier.description || "",
    highlight: tier.recommended === true,
    badge: tier.recommended ? "Most Popular" : undefined,
    cta: tier.cta_label || (tier.is_custom ? "Contact Sales" : "Get Started"),
    features,
    href: tier.is_custom ? "/contact" : "/register",
  };
}

// Shown only if the pricing API is unreachable, so the page never renders empty.
const FALLBACK_PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "Perfect for small gatherings and personal events.",
    highlight: false,
    cta: "Get Started Free",
    features: [
      "Up to 50 guests",
      "1 event at a time",
      "Basic RSVP forms",
      "Email notifications",
      "Mobile responsive pages",
      "Basic analytics dashboard",
      "Community support",
      "Fancy RSVP branding",
    ],
  },
  {
    name: "Premium",
    price: "$29",
    period: "/ event",
    description: "Everything you need for elegant, memorable events.",
    highlight: true,
    badge: "Most Popular",
    cta: "Start Free Trial",
    features: [
      "Unlimited guests",
      "Up to 10 concurrent events",
      "Custom RSVP form builder",
      "Seating chart designer",
      "Meal & dietary tracking",
      "Real-time analytics & reports",
      "Custom themes & branding",
      "Priority email & chat support",
      "QR code check-in",
      "Guest export (CSV, PDF)",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For agencies, venues, and large-scale event planners.",
    highlight: false,
    cta: "Contact Sales",
    features: [
      "Unlimited everything",
      "White-label solution",
      "Custom integrations & API",
      "Dedicated account manager",
      "SSO & team management",
      "SLA guarantee (99.99%)",
      "Custom onboarding",
      "Phone & video support",
      "Advanced security & compliance",
      "Invoice billing",
    ],
  },
];

const faqData = [
  {
    question: "Can I switch plans at any time?",
    answer: "Absolutely. You can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, your current features remain active until the end of your billing cycle.",
  },
  {
    question: "Is there a free trial for Premium?",
    answer: "Yes! Every Premium plan comes with a 14-day free trial. No credit card required. You'll have full access to all Premium features during the trial period.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit and debit cards (Visa, Mastercard, American Express), as well as PayPal. Enterprise customers can pay via invoice with NET 30 terms.",
  },
  {
    question: "Can I get a refund if I'm not satisfied?",
    answer: "We offer a 30-day money-back guarantee on all paid plans. If you're not completely satisfied, contact our support team for a full refund — no questions asked.",
  },
  {
    question: "Do you offer discounts for nonprofits?",
    answer: "Yes! We offer a 50% discount for verified nonprofit organizations. Contact our sales team with your organization details and we'll set up your discounted account.",
  },
];

const comparisonFeatures = [
  { feature: "Number of Guests", starter: "50", premium: "Unlimited", enterprise: "Unlimited" },
  { feature: "Custom RSVP Forms", starter: "Basic", premium: "Advanced", enterprise: "Advanced + API" },
  { feature: "Seating Charts", starter: "—", premium: "✓", enterprise: "✓" },
  { feature: "Meal Tracking", starter: "—", premium: "✓", enterprise: "✓" },
  { feature: "Analytics", starter: "Basic", premium: "Advanced", enterprise: "Custom" },
  { feature: "Custom Branding", starter: "—", premium: "✓", enterprise: "White-label" },
  { feature: "Integrations", starter: "2", premium: "All", enterprise: "All + Custom" },
  { feature: "Support", starter: "Community", premium: "Priority", enterprise: "Dedicated" },
];

function PricingCard({ plan }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: plan.highlight ? "#191B1E" : "#FFFFFF",
        border: plan.highlight
          ? "2px solid #B8944F"
          : `1px solid ${hovered ? "#B8944F" : "#E8E2D6"}`,
        borderRadius: "20px",
        padding: plan.highlight ? "48px 36px" : "44px 36px",
        transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        transform: hovered ? "translateY(-8px)" : plan.highlight ? "translateY(-8px)" : "translateY(0)",
        boxShadow: plan.highlight
          ? "0 24px 80px rgba(184,148,79,0.2), 0 8px 32px rgba(0,0,0,0.08)"
          : hovered
          ? "0 20px 60px rgba(0,0,0,0.08)"
          : "0 2px 16px rgba(0,0,0,0.04)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
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
    </div>
  );
}

function FaqItem({ item, isOpen, onToggle }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: "1px solid #E8E2D6",
        transition: "background 0.3s ease",
        background: hovered ? "rgba(184,148,79,0.02)" : "transparent",
      }}
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
    </div>
  );
}

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState(0);
  const [plans, setPlans] = useState(FALLBACK_PLANS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/payments/public-pricing`);
        const data = await res.json();
        if (!cancelled && data?.success && Array.isArray(data.tiers) && data.tiers.length) {
          setPlans(data.tiers.map(tierToPlan));
        }
      } catch {
        // Keep the fallback plans on any network/parse error.
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
                fontSize: "56px",
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
          <div
            className="pricing-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "28px",
              alignItems: "start",
            }}
          >
            {plans.map((plan) => (
              <PricingCard key={plan.name} plan={plan} />
            ))}
          </div>
        </section>

        {/* ════════════════════ COMPARISON TABLE ════════════════════ */}
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

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E8E2D6",
                overflow: "hidden",
              }}
            >
              {/* Table Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  padding: "20px 32px",
                  background: "#191B1E",
                }}
              >
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Feature
                </div>
                {["Starter", "Premium", "Enterprise"].map((name) => (
                  <div
                    key={name}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: name === "Premium" ? "#D7BE80" : "rgba(255,255,255,0.5)",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      textAlign: "center",
                    }}
                  >
                    {name}
                  </div>
                ))}
              </div>

              {/* Table Rows */}
              {comparisonFeatures.map((row, i) => (
                <div
                  key={row.feature}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    padding: "16px 32px",
                    borderBottom: i < comparisonFeatures.length - 1 ? "1px solid #F0EBE2" : "none",
                    background: i % 2 === 0 ? "#FDFCF9" : "#FFFFFF",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#191B1E", fontWeight: 500 }}>
                    {row.feature}
                  </div>
                  {[row.starter, row.premium, row.enterprise].map((val, j) => (
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
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

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
                Can't find what you're looking for? Contact our support team.
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
