"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import HeroEnvelope from "./HeroEnvelope";

/* ═══════════════════════════════════════════════════════════════
   HeroSection — Fancy RSVP (Page 09 Brand Guide — Pixel Perfect)

   Layout from mockup (Desktop):
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │  BEAUTIFULLY DESIGNED                    ┌────────────────┐  │
   │  RSVP EXPERIENCES                        │                │  │
   │                                          │  Interactive   │  │
   │  Elegant RSVPs.                          │   Envelope     │  │
   │  Effortless Planning.                    │   Animation    │  │
   │                                          │                │  │
   │  The all-in-one RSVP and guest           └────────────────┘  │
   │  management platform for weddings                            │
   │  and special events.                                         │
   │                                                              │
   │  [Get Started]  [View Features]                              │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════════ */

export default function HeroSection() {
  const { isLoggedIn, loading } = useAuth();

  return (
    <>
      {/* ════════════════════════════════════════════
          HERO SECTION
          ════════════════════════════════════════════ */}
      <section
        id="hero"
        style={{
          width: "100%",
          background: "#FFFFFF",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle warm ivory gradient overlay at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "200px",
            background: "linear-gradient(to bottom, transparent, #F8F4EC)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "80px 48px 100px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "64px",
            alignItems: "center",
            position: "relative",
            zIndex: 2,
          }}
          className="hero-grid"
        >
          {/* ─── Left Column: Text Content ─── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "28px",
            }}
            className="animate-fade-in-up"
          >
            {/* Eyebrow Label */}
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "#B8944F",
              }}
            >
              Beautifully Designed RSVP Experiences
            </span>

            {/* Main Headline */}
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "52px",
                fontWeight: 500,
                lineHeight: 1.12,
                color: "#191B1E",
                letterSpacing: "-0.5px",
              }}
              className="hero-headline"
            >
              Elegant RSVPs.
              <br />
              Effortless Planning.
            </h1>

            {/* Subtext */}
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "17px",
                fontWeight: 300,
                lineHeight: 1.7,
                color: "#77736A",
                maxWidth: "440px",
              }}
            >
              The all-in-one RSVP and guest management platform for weddings and special events.
            </p>

            {/* CTA Buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginTop: "8px",
              }}
              className="hero-buttons"
            >
              <Link
                href={!loading && isLoggedIn ? "/dashboard" : "/register"}
                className="btn-gold"
                style={{
                  padding: "15px 36px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
                id="hero-cta-get-started"
              >
                {!loading && isLoggedIn ? "Go to Dashboard" : "Get Started"}
              </Link>
              <Link
                href="/features"
                className="btn-outline"
                style={{
                  padding: "15px 36px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
                id="hero-cta-view-features"
              >
                View Features
              </Link>
            </div>
          </div>

          {/* ─── Right Column: Interactive Card Preview ─── */}
          <HeroEnvelope />
        </div>
      </section>

      {/* ════════════════════════════════════════════
          OCCASIONS SECTION — "Perfect for Any Occasion"
          ════════════════════════════════════════════ */}
      <section
        id="occasions"
        style={{
          width: "100%",
          background: "#F8F4EC",
          padding: "80px 0",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "0 48px",
            textAlign: "center",
          }}
        >
          {/* Eyebrow */}
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#B8944F",
              display: "block",
              marginBottom: "12px",
            }}
          >
            Perfect for Any Occasion
          </span>

          {/* Section Title */}
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "36px",
              fontWeight: 500,
              color: "#191B1E",
              marginBottom: "56px",
              letterSpacing: "-0.3px",
            }}
          >
            Weddings, custom, and engagements.
          </h2>

          {/* Occasion Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "24px",
              maxWidth: "960px",
              margin: "0 auto",
            }}
            className="occasions-grid"
          >
            {[
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#D7BE80" strokeWidth="1" />
                    <path d="M14 28C14 28 16 24 20 24C24 24 26 28 26 28" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="15" cy="14" r="3" stroke="#B8944F" strokeWidth="1.2" fill="none" />
                    <circle cx="25" cy="14" r="3" stroke="#B8944F" strokeWidth="1.2" fill="none" />
                    <path d="M18 11L20 8L22 11" stroke="#D7BE80" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                ),
                title: "Weddings",
                desc: "Celebrate your big day with elegant RSVPs.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#D7BE80" strokeWidth="1" />
                    <path d="M13 27L15 25M18 22L27 13C28.1 11.9 28.1 10.1 27 9C25.9 7.9 24.1 7.9 23 9L14 18M14 18L12 24L18 22" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M25 8L27 10" stroke="#D7BE80" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                ),
                title: "Custom",
                desc: "Design custom event pages tailored to your style.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#D7BE80" strokeWidth="1" />
                    <path d="M15 16C15 13.2 17.2 11 20 11C21.6 11 22.8 11.8 23.5 12.6C24.2 11.8 25.4 11 27 11C29.8 11 32 13.2 32 16C32 20.8 24.2 25.2 23.5 25.2C22.8 25.2 15 20.8 15 16Z" stroke="#B8944F" strokeWidth="1.5" />
                    <path d="M8 19C8 16.8 9.8 15 12 15C13.3 15 14.2 15.6 14.8 16.3M14.8 26.2C14.2 26.2 8 22.8 8 19C8 18 8.3 17 9 16.2" stroke="#D7BE80" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                ),
                title: "Engagement",
                desc: "Announce the proposal with elegant engagement pages.",
              },
            ].map((card) => (
              <div key={card.title} className="occasion-card">
                <div style={{ marginBottom: "20px" }}>{card.icon}</div>
                <h3
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "#191B1E",
                    marginBottom: "10px",
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 300,
                    color: "#77736A",
                    lineHeight: 1.6,
                  }}
                >
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Responsive Styles ─── */}
      <style jsx>{`
        @media (max-width: 1024px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            padding: 48px 32px 64px !important;
            gap: 40px !important;
            text-align: center;
          }
          .hero-headline {
            font-size: 42px !important;
          }
          .hero-buttons {
            justify-content: center !important;
          }
          .occasions-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .hero-headline {
            font-size: 34px !important;
          }
          .hero-buttons {
            flex-direction: column !important;
            width: 100%;
          }
          .occasions-grid {
            grid-template-columns: 1fr !important;
            max-width: 360px !important;
          }
        }
      `}</style>
    </>
  );
}
