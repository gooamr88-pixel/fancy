"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import GoldDivider from "../components/GoldDivider";
import Icon from "../components/icons/Icon";
import { useLandingStats, formatStatValue } from "../utils/useLandingStats";
/* The list itself moved to components/landing/platformCapabilities.js. It was
   declared here, which made this page the ONLY place on the site that knew
   what the product does — the homepage named none of these. Both pages now
   render the same array; see that file's header. */
import { CAPABILITIES as features } from "../components/landing/platformCapabilities";

function FeatureCard({ feature, index }) {
  return (
    <div
      className="feature-card"
      style={{
        borderRadius: "16px",
        padding: "40px 36px",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle gold corner accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "80px",
          height: "80px",
          background: "linear-gradient(135deg, transparent 50%, rgba(184, 148, 79, 0.04) 50%)",
          borderRadius: "0 16px 0 0",
        }}
      />

      <div
        className="feature-icon-box"
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        {feature.icon}
      </div>

      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "22px",
          fontWeight: 600,
          color: "#191B1E",
          marginBottom: "14px",
          letterSpacing: "-0.2px",
        }}
      >
        {feature.title}
      </h3>

      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          lineHeight: "1.7",
          color: "#5E5A52",
          margin: 0,
        }}
      >
        {feature.description}
      </p>

      {/* Only rendered for a feature that has somewhere deeper to go. */}
      {feature.link && (
        <Link
          href={feature.link.href}
          className="feature-card-link"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "18px",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 700,
            color: "#B8944F",
            textDecoration: "none",
          }}
        >
          {feature.link.label}
          <span aria-hidden>&rarr;</span>
        </Link>
      )}

      {/* Bottom gold line accent on hover */}
      <div
        className="feature-bottom-line"
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          height: "2px",
          background: "linear-gradient(90deg, transparent, #B8944F, transparent)",
          borderRadius: "2px",
        }}
      />

      <style jsx>{`
        .feature-card {
          background: #FDFCF9;
          border: 1px solid #E8E2D6;
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          transform: translateY(0);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
        }
        .feature-card:hover,
        .feature-card:focus-within {
          background: #FFFFFF;
          border-color: #B8944F;
          transform: translateY(-6px);
          box-shadow: 0 20px 60px rgba(184, 148, 79, 0.12), 0 8px 24px rgba(0, 0, 0, 0.04);
        }
        .feature-icon-box {
          background: linear-gradient(135deg, rgba(184,148,79,0.06) 0%, rgba(215,190,128,0.04) 100%);
          transition: background 0.4s ease;
        }
        .feature-card:hover .feature-icon-box,
        .feature-card:focus-within .feature-icon-box {
          background: linear-gradient(135deg, rgba(184,148,79,0.12) 0%, rgba(215,190,128,0.08) 100%);
        }
        .feature-bottom-line {
          width: 0%;
          transition: width 0.4s ease;
        }
        .feature-card:hover .feature-bottom-line,
        .feature-card:focus-within .feature-bottom-line {
          width: 60%;
        }
      `}</style>
    </div>
  );
}

export default function FeaturesPage() {
  const { stats } = useLandingStats();
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ════════════════════ HERO SECTION ════════════════════ */}
        <section className="fx-section fx-section--tight-bottom"
          style={{
            background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Background decorative circles */}
          <div style={{ position: "absolute", top: "-60px", left: "-60px", width: "200px", height: "200px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-40px", right: "-40px", width: "160px", height: "160px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.06)", pointerEvents: "none" }} />

          <div className="fx-container fx-container--lg" style={{ position: "relative", zIndex: 1 }}>
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
                Everything You Need
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
              Powerful{" "}
              <span style={{ color: "#B8944F" }}>Features</span>
            </h1>

            <p className="fx-container fx-container--sm"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "19px",
                lineHeight: 1.7,
                color: "#5E5A52",
              }}
            >
              From custom invitations to real-time analytics, Fancy RSVP gives you every tool
              to plan and manage your event with elegance and precision.
            </p>
          </div>
        </section>

        {/* ════════════════════ FEATURES GRID ════════════════════ */}
        <section className="fx-container fx-container--4xl fx-section"
          >
          <div style={{ marginBottom: "60px" }}>
            <GoldDivider variant="wide" />
          </div>

          <h2 className="sr-only">Platform Features</h2>
          <div
            className="features-grid fx-grid fx-grid--2"
            style={{ "--fx-gap": "32px",
}}
          >
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>
        </section>

        {/* ════════════════════ STATS BAR ════════════════════ */}
        <section className="fx-section fx-section--sm"
          style={{
            background: "#191B1E",
          }}
        >
          <div
            className="fx-container fx-container--4xl stats-grid fx-grid fx-grid--3"
            style={{ "--fx-gap": "40px",
textAlign: "center",
            }}
          >
            {stats.map((stat) => (
              <div key={stat.label}>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "42px",
                    fontWeight: 700,
                    color: "#B8944F",
                    marginBottom: "8px",
                  }}
                >
                  {formatStatValue(stat)}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════ WHY CHOOSE US ════════════════════ */}
        <section className="fx-section" style={{ background: "#FFFFFF" }}>
          <div className="fx-container fx-container--4xl" >
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "40px",
                  fontWeight: 700,
                  color: "#191B1E",
                  marginBottom: "16px",
                }}
              >
                Why Event Planners{" "}
                <span style={{ color: "#B8944F" }}>Love Us</span>
              </h2>
              <p className="fx-container fx-container--sm"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                }}
              >
                We obsess over every detail so you can focus on what matters — creating unforgettable moments.
              </p>
            </div>

            <div
              className="why-grid fx-grid fx-grid--3"
              style={{ "--fx-gap": "48px",
}}
            >
              {[
                {
                  title: "Enterprise-Grade Security",
                  desc: "256-bit SSL encryption, GDPR compliance, and SOC 2 certification protect every guest's data.",
                  icon: "lock",
                },
                {
                  title: "White-Glove Support",
                  desc: "Dedicated account managers for premium clients with 24/7 priority support and onboarding.",
                  icon: "handshake",
                },
                {
                  title: "Lightning Fast",
                  desc: "Built on a globally distributed edge network for sub-200ms response times worldwide.",
                  icon: "lightning",
                },
              ].map((item) => (
                <div key={item.title} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: "20px",
                    }}
                  >
                    <Icon name={item.icon} size={36} color="#B8944F" strokeWidth={1.2} />
                  </div>
                  <h3
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "20px",
                      fontWeight: 600,
                      color: "#191B1E",
                      marginBottom: "12px",
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      color: "#5E5A52",
                      lineHeight: 1.7,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════ CTA SECTION ════════════════════ */}
        <section className="fx-section"
          style={{
            background: "linear-gradient(135deg, #191B1E 0%, #2A2D32 100%)",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Gold glow background */}
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
              Ready to Get{" "}
              <span style={{ color: "#B8944F" }}>Started</span>?
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
              Join thousands of event planners who trust Fancy RSVP to deliver beautiful, seamless guest experiences.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/register"
                className="fx-section fx-section--xs btn-gold features-cta-gold"
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  letterSpacing: "0.3px",
                }}
              >
                Start Free Trial
              </Link>
              <Link href="/pricing" className="btn-ghost-gold">
                View Pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        /* .btn-gold's own :hover already sets an identical, slightly heavier
           shadow (globals.css) — only the resting/base shadow needs a custom
           value here, so it's left to override on hover automatically. */
        :global(.features-cta-gold) {
          box-shadow: 0 4px 20px rgba(184, 148, 79, 0.2);
        }
      `}</style>
    </>
  );
}
