"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import GoldDivider from "../components/GoldDivider";
import Icon from "../components/icons/Icon";
import { useLandingStats, formatStatValue } from "../utils/useLandingStats";

const features = [
  {
    title: "Custom RSVP Forms",
    description:
      "Design stunning invitation forms with our intuitive drag & drop builder. Choose from elegant field types, custom validations, and conditional logic to create the perfect guest experience — no coding required.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="6" width="36" height="36" rx="4" stroke="#B8944F" strokeWidth="1.5" />
        <rect x="12" y="14" width="24" height="4" rx="2" stroke="#D7BE80" strokeWidth="1.2" />
        <rect x="12" y="22" width="24" height="4" rx="2" stroke="#D7BE80" strokeWidth="1.2" />
        <rect x="12" y="30" width="16" height="4" rx="2" stroke="#D7BE80" strokeWidth="1.2" />
        <circle cx="36" cy="36" r="8" fill="#B8944F" opacity="0.12" />
        <path d="M33 36L35.5 38.5L39 33" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Guest Management",
    description:
      "Effortlessly track RSVPs, manage plus-ones, record dietary requirements, and organize guest lists with powerful filtering. Export guest data in one click and keep every detail at your fingertips.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="20" cy="16" r="6" stroke="#B8944F" strokeWidth="1.5" />
        <path d="M8 38c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="34" cy="14" r="4" stroke="#D7BE80" strokeWidth="1.2" />
        <path d="M38 32c0-4.418-2.686-8-6-8" stroke="#D7BE80" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M14 42h12" stroke="#B8944F" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Seating Charts",
    description:
      "Create interactive, drag-and-drop seating arrangements that update in real time. Visualize table layouts, manage group dynamics, and ensure every guest feels perfectly placed at your event.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="10" stroke="#B8944F" strokeWidth="1.5" />
        <circle cx="24" cy="14" r="2.5" fill="#D7BE80" />
        <circle cx="24" cy="34" r="2.5" fill="#D7BE80" />
        <circle cx="14" cy="24" r="2.5" fill="#D7BE80" />
        <circle cx="34" cy="24" r="2.5" fill="#D7BE80" />
        <circle cx="17" cy="17" r="2" fill="#B8944F" opacity="0.4" />
        <circle cx="31" cy="31" r="2" fill="#B8944F" opacity="0.4" />
        <circle cx="31" cy="17" r="2" fill="#B8944F" opacity="0.4" />
        <circle cx="17" cy="31" r="2" fill="#B8944F" opacity="0.4" />
        <rect x="20" y="20" width="8" height="8" rx="2" stroke="#B8944F" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: "Real-Time Analytics",
    description:
      "Monitor your event with a live dashboard featuring acceptance rates, response timelines, geographic breakdowns, and engagement metrics. Make data-driven decisions with beautiful, intuitive charts.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="28" width="6" height="12" rx="1" fill="#D7BE80" opacity="0.5" />
        <rect x="17" y="22" width="6" height="18" rx="1" fill="#D7BE80" opacity="0.7" />
        <rect x="26" y="16" width="6" height="24" rx="1" fill="#B8944F" opacity="0.6" />
        <rect x="35" y="10" width="6" height="30" rx="1" fill="#B8944F" opacity="0.85" />
        <path d="M8 8v32h34" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 30l8-8 6 4 10-14" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="38" cy="12" r="3" stroke="#B8944F" strokeWidth="1" fill="none" />
      </svg>
    ),
  },
  {
    title: "Meal Tracking",
    description:
      "Collect dietary preferences, allergies, and meal selections with smart forms that adapt to your menu. Generate kitchen-ready reports sorted by table, course, or dietary category — stress-free catering starts here.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <ellipse cx="24" cy="32" rx="14" ry="4" stroke="#B8944F" strokeWidth="1.5" />
        <path d="M10 32V28c0-2.21 6.268-4 14-4s14 1.79 14 4v4" stroke="#B8944F" strokeWidth="1.5" />
        <path d="M24 12v8" stroke="#D7BE80" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M20 10c0 3 4 5 4 8" stroke="#D7BE80" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M28 10c0 3-4 5-4 8" stroke="#D7BE80" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="24" cy="8" r="2" fill="#B8944F" opacity="0.3" />
      </svg>
    ),
  },
  {
    title: "Custom Themes",
    description:
      "Brand every touchpoint with your event's unique identity. Choose from curated designer templates or create your own with custom colors, typography, backgrounds, and animations that wow your guests.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="8" width="32" height="32" rx="4" stroke="#B8944F" strokeWidth="1.5" />
        <rect x="12" y="12" width="10" height="10" rx="2" fill="#B8944F" opacity="0.2" />
        <rect x="26" y="12" width="10" height="10" rx="2" fill="#D7BE80" opacity="0.3" />
        <rect x="12" y="26" width="10" height="10" rx="2" fill="#D7BE80" opacity="0.3" />
        <rect x="26" y="26" width="10" height="10" rx="2" fill="#B8944F" opacity="0.15" />
        <circle cx="17" cy="17" r="3" stroke="#B8944F" strokeWidth="1" />
        <path d="M28 14l6 6" stroke="#B8944F" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M34 14l-6 6" stroke="#B8944F" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "SMS Campaigns",
    description:
      "Reach every guest instantly with segmented bulk messaging and live delivery tracking. Credits are billed transparently per message and automatically refunded for anything that fails to deliver.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M40 24c0 8.837-7.163 16-16 16-2.761 0-5.361-.698-7.625-1.925L8 40l2.4-7.2C8.88 30.2 8 27.2 8 24 8 15.163 15.163 8 24 8s16 7.163 16 16z" stroke="#B8944F" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="17" cy="24" r="1.8" fill="#B8944F" />
        <circle cx="24" cy="24" r="1.8" fill="#B8944F" />
        <circle cx="31" cy="24" r="1.8" fill="#B8944F" />
        <path d="M32 12l3 3" stroke="#D7BE80" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M36 9l2 2" stroke="#D7BE80" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      </svg>
    ),
  },
  {
    title: "QR Check-In",
    description:
      "Every guest carries a personal, scannable ticket. Check them in with a camera scan or name search at the door, or let them arrive themselves — either way it syncs to your dashboard in real time.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="8" width="14" height="14" rx="2" stroke="#B8944F" strokeWidth="1.5" />
        <rect x="26" y="8" width="14" height="14" rx="2" stroke="#B8944F" strokeWidth="1.5" />
        <rect x="8" y="26" width="14" height="14" rx="2" stroke="#B8944F" strokeWidth="1.5" />
        <rect x="12" y="12" width="6" height="6" rx="1" fill="#B8944F" opacity="0.25" />
        <rect x="30" y="12" width="6" height="6" rx="1" fill="#B8944F" opacity="0.25" />
        <rect x="12" y="30" width="6" height="6" rx="1" fill="#B8944F" opacity="0.25" />
        <path d="M27 31l5 5 7-9" stroke="#D7BE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Bilingual Invitations",
    description:
      "Write your invitation title, description, and dress code in English and Arabic side by side. Guests get a genuine right-to-left layout, localized dates, and a one-tap language toggle.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="16" stroke="#B8944F" strokeWidth="1.5" />
        <ellipse cx="24" cy="24" rx="7" ry="16" stroke="#D7BE80" strokeWidth="1.2" />
        <path d="M8 24h32" stroke="#D7BE80" strokeWidth="1.2" />
        <path d="M10.5 16h27M10.5 32h27" stroke="#D7BE80" strokeWidth="1" opacity="0.6" />
      </svg>
    ),
  },
  {
    title: "Cinematic Invitation Reveal",
    description:
      "A tap-to-open wax seal sets the tone before guests even see your invite. It's a fully generated, personalized animation in your event's own colors and names — never a stock template.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M24 8l3.5 7.5L36 17l-6 6.5L31 32l-7-4-7 4 1-8.5L12 17l8.5-1.5L24 8z" stroke="#B8944F" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M18 32l-4 8 6-2 4 6 4-6 6 2-4-8" stroke="#D7BE80" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="24" cy="20" r="3" stroke="#B8944F" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: "Automated Reminders",
    description:
      "The platform emails itself — RSVP nudges as your deadline nears, event reminders that include each guest's table once seating is revealed, and an automatic final headcount plus post-event recap sent straight to you.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="12" width="26" height="20" rx="3" stroke="#B8944F" strokeWidth="1.5" />
        <path d="M6 14l13 10 13-10" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="34" cy="30" r="9" fill="#FDFCF9" stroke="#D7BE80" strokeWidth="1.5" />
        <path d="M34 25v5l3.5 2" stroke="#B8944F" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Referral Rewards",
    description:
      "Invite other hosts to Fancy RSVP and earn real account credit once they become a paying customer — tracked transparently in a ledger-based dashboard with your own referral code and live status on every referral.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="14" cy="24" r="6" stroke="#B8944F" strokeWidth="1.5" />
        <circle cx="34" cy="24" r="6" stroke="#B8944F" strokeWidth="1.5" />
        <path d="M20 20h10a4 4 0 0 1 4 4" stroke="#D7BE80" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M31 17l3 3-3 3" stroke="#D7BE80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M28 28H18a4 4 0 0 1-4-4" stroke="#D7BE80" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M17 31l-3-3 3-3" stroke="#D7BE80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  {
    title: "Private Seating Lookup",
    description:
      "Guests confirm their own seat with just their name and the last four digits of their phone number — no accounts, no guessing. Seating stays locked until your reveal time, and a search never confirms whether a name exists.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="20" cy="20" r="12" stroke="#B8944F" strokeWidth="1.5" />
        <path d="M29 29l9 9" stroke="#B8944F" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="15" y="17" width="10" height="8" rx="1.5" stroke="#D7BE80" strokeWidth="1.2" />
        <path d="M17 17v-2a3 3 0 0 1 6 0v2" stroke="#D7BE80" strokeWidth="1.2" fill="none" />
      </svg>
    ),
  },
];

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
        <section
          style={{
            background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
            padding: "100px 48px 80px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Background decorative circles */}
          <div style={{ position: "absolute", top: "-60px", left: "-60px", width: "200px", height: "200px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-40px", right: "-40px", width: "160px", height: "160px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.06)", pointerEvents: "none" }} />

          <div style={{ maxWidth: "780px", margin: "0 auto", position: "relative", zIndex: 1 }}>
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

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "19px",
                lineHeight: 1.7,
                color: "#5E5A52",
                maxWidth: "600px",
                margin: "0 auto",
              }}
            >
              From custom invitations to real-time analytics, Fancy RSVP gives you every tool
              to plan and manage your event with elegance and precision.
            </p>
          </div>
        </section>

        {/* ════════════════════ FEATURES GRID ════════════════════ */}
        <section
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "80px 48px 100px",
          }}
        >
          <div style={{ marginBottom: "60px" }}>
            <GoldDivider variant="wide" />
          </div>

          <h2 className="sr-only">Platform Features</h2>
          <div
            className="features-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "32px",
            }}
          >
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>
        </section>

        {/* ════════════════════ STATS BAR ════════════════════ */}
        <section
          style={{
            background: "#191B1E",
            padding: "64px 48px",
          }}
        >
          <div
            className="stats-grid"
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "40px",
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
        <section style={{ padding: "100px 48px", background: "#FFFFFF" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
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
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  maxWidth: "540px",
                  margin: "0 auto",
                  lineHeight: 1.7,
                }}
              >
                We obsess over every detail so you can focus on what matters — creating unforgettable moments.
              </p>
            </div>

            <div
              className="why-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "48px",
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
        <section
          style={{
            background: "linear-gradient(135deg, #191B1E 0%, #2A2D32 100%)",
            padding: "100px 48px",
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
                className="btn-gold features-cta-gold"
                style={{
                  padding: "16px 48px",
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
        @media (max-width: 1024px) {
          .features-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 24px !important;
          }
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .features-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
          .why-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 32px !important;
          }
        }
        @media (max-width: 640px) {
          section {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
        /* .btn-gold's own :hover already sets an identical, slightly heavier
           shadow (globals.css) — only the resting/base shadow needs a custom
           value here, so it's left to override on hover automatically. */
        .features-cta-gold {
          box-shadow: 0 4px 20px rgba(184, 148, 79, 0.2);
        }
      `}</style>
    </>
  );
}
