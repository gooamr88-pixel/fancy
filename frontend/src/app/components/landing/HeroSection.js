"use client";

import React from "react";
import Image from "next/image";

/* ═══════════════════════════════════════════════════════════════
   HeroSection — Fancy RSVP (Page 09 Brand Guide — Pixel Perfect)
   
   Layout from mockup (Desktop):
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │  BEAUTIFULLY DESIGNED                    ┌────────────────┐  │
   │  RSVP EXPERIENCES                        │                │  │
   │                                          │  Wedding Hero  │  │
   │  Elegant RSVPs.                          │    Photo       │  │
   │  Effortless Planning.                    │                │  │
   │                                          └────────────────┘  │
   │  The all-in-one RSVP and guest                               │
   │  management platform for weddings                            │
   │  and special events.                                         │
   │                                                              │
   │  [Get Started]  [View Features]                              │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
   
   Below Hero:
   ┌──────────────────────────────────────────────────────────────┐
   │         PERFECT FOR ANY OCCASION                             │
   │     Weddings, events, and more.                              │
   │  ┌──────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐          │
   │  │ 💍   │ │ 🥂       │ │ 🎀     │ │ 🏢           │          │
   │  │Wedd. │ │Engage.   │ │Showers │ │Corp. Events  │          │
   │  └──────┘ └──────────┘ └────────┘ └──────────────┘          │
   └──────────────────────────────────────────────────────────────┘
   
   Then Features:
   ┌──────────────────────────────────────────────────────────────┐
   │  POWERFUL FEATURES                                           │
   │  Everything you need          ┌─────────────────────────┐    │
   │  to host with confidence.     │  Dashboard Mockup       │    │
   │  • Custom RSVP forms...       │  + Invitation Image     │    │
   │  [Explore All Features]       └─────────────────────────┘    │
   └──────────────────────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════════ */

export default function HeroSection() {

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
    }
  };

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
              <a
                href="/register"
                className="btn-gold"
                style={{
                  padding: "15px 36px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "6px",
                }}
                id="hero-cta-get-started"
              >
                Get Started
              </a>
              <button
                onClick={() => scrollToSection("features")}
                className="btn-outline"
                style={{
                  padding: "15px 36px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "6px",
                }}
                id="hero-cta-view-features"
              >
                View Features
              </button>
            </div>
          </div>

          {/* ─── Right Column: Hero Image ─── */}
          <div
            style={{
              position: "relative",
              width: "100%",
              display: "flex",
              justifyContent: "flex-end",
            }}
            className="animate-slide-in-right"
          >
            <div
              style={{
                width: "100%",
                maxWidth: "560px",
                aspectRatio: "4 / 3",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 24px 60px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.04)",
                position: "relative",
              }}
            >
              <Image
                src="/images/hero-wedding.png"
                alt="Elegant wedding table setting with golden candelabras and white roses"
                fill
                style={{ objectFit: "cover" }}
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {/* Subtle gold gradient overlay at bottom of image */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "100px",
                  background: "linear-gradient(to top, rgba(248,244,236,0.4), transparent)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
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
            Weddings, events, and more.
          </h2>

          {/* Occasion Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
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
                    <path d="M14 26V18L20 14L26 18V26" stroke="#B8944F" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
                    <path d="M17 26V22H23V26" stroke="#B8944F" strokeWidth="1.2" fill="none" />
                    <circle cx="20" cy="11" r="1.5" fill="#D7BE80" />
                  </svg>
                ),
                title: "Engagements",
                desc: "Toast to love with beautiful event pages.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#D7BE80" strokeWidth="1" />
                    <rect x="13" y="15" width="14" height="12" rx="2" stroke="#B8944F" strokeWidth="1.5" fill="none" />
                    <path d="M16 15V13C16 11.3431 17.3431 10 19 10H21C22.6569 10 24 11.3431 24 13V15" stroke="#B8944F" strokeWidth="1.2" />
                    <path d="M17 20H23" stroke="#D7BE80" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                ),
                title: "Showers",
                desc: "Plan seamlessly and gather with ease.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="#D7BE80" strokeWidth="1" />
                    <rect x="12" y="13" width="16" height="14" rx="1.5" stroke="#B8944F" strokeWidth="1.5" fill="none" />
                    <line x1="12" y1="18" x2="28" y2="18" stroke="#B8944F" strokeWidth="1" />
                    <line x1="20" y1="18" x2="20" y2="27" stroke="#D7BE80" strokeWidth="0.8" />
                    <circle cx="16" cy="22" r="1" fill="#D7BE80" />
                    <circle cx="24" cy="22" r="1" fill="#D7BE80" />
                  </svg>
                ),
                title: "Corporate Events",
                desc: "Professional invitations for every occasion.",
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

      {/* ════════════════════════════════════════════
          FEATURES SECTION — "Powerful Features"
          ════════════════════════════════════════════ */}
      <section
        id="features"
        style={{
          width: "100%",
          background: "#FFFFFF",
          padding: "100px 0",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "0 48px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "64px",
            alignItems: "center",
          }}
          className="features-grid"
        >
          {/* ─── Left Column: Feature List ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Eyebrow */}
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
              Powerful Features
            </span>

            {/* Headline */}
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "38px",
                fontWeight: 500,
                color: "#191B1E",
                lineHeight: 1.2,
                letterSpacing: "-0.3px",
              }}
              className="features-headline"
            >
              Everything you need to host with confidence.
            </h2>

            {/* Feature Bullets */}
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                marginTop: "8px",
              }}
            >
              {[
                "Custom RSVP forms and event pages",
                "Guest list management and plus-ones",
                "Dietary preferences and meal selections",
                "Real-time tracking and smart analytics",
                "Seating charts and table arrangements",
                "Beautiful design, seamless experience",
              ].map((feature) => (
                <li
                  key={feature}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    fontWeight: 400,
                    color: "#191B1E",
                    lineHeight: 1.5,
                  }}
                >
                  {/* Gold checkmark bullet */}
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#B8944F",
                      flexShrink: 0,
                    }}
                  />
                  {feature}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => scrollToSection("pricing")}
              className="btn-gold"
              style={{
                padding: "14px 32px",
                fontSize: "14px",
                alignSelf: "flex-start",
                marginTop: "8px",
              }}
              id="features-cta-explore"
            >
              Explore All Features
            </button>
          </div>

          {/* ─── Right Column: Dashboard + Stationery Image ─── */}
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            {/* Dashboard mockup card */}
            <div
              style={{
                width: "100%",
                maxWidth: "480px",
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E8E2D6",
                padding: "28px",
                boxShadow: "0 16px 50px rgba(0,0,0,0.06)",
                position: "relative",
                zIndex: 2,
              }}
            >
              {/* Mini Dashboard Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "24px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid #E8E2D6",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#191B1E",
                  }}
                >
                  RSVP Overview
                </span>
              </div>

              {/* Stats Row */}
              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                {[
                  { label: "Accepted", value: "198", color: "#B8944F" },
                  { label: "Declined", value: "32", color: "#77736A" },
                  { label: "Pending", value: "20", color: "#D7BE80" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: stat.color,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                          fontWeight: 300,
                          color: "#77736A",
                        }}
                      >
                        {stat.label}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "#191B1E",
                        }}
                      >
                        {stat.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Donut Chart Placeholder */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "24px",
                }}
              >
                <div style={{ position: "relative", width: "120px", height: "120px" }}>
                  <svg viewBox="0 0 120 120" width="120" height="120">
                    {/* Background ring */}
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke="#E8E2D6"
                      strokeWidth="12"
                    />
                    {/* Accepted segment (79%) */}
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke="#B8944F"
                      strokeWidth="12"
                      strokeDasharray={`${0.79 * 2 * Math.PI * 48} ${2 * Math.PI * 48}`}
                      strokeDashoffset={2 * Math.PI * 48 * 0.25}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 1s ease" }}
                    />
                    {/* Declined segment (12.8%) */}
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke="#77736A"
                      strokeWidth="12"
                      strokeDasharray={`${0.128 * 2 * Math.PI * 48} ${2 * Math.PI * 48}`}
                      strokeDashoffset={2 * Math.PI * 48 * 0.25 - 0.79 * 2 * Math.PI * 48}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Center Text */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "24px",
                        fontWeight: 900,
                        color: "#191B1E",
                        lineHeight: 1,
                      }}
                    >
                      79%
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "10px",
                        fontWeight: 400,
                        color: "#77736A",
                        marginTop: "2px",
                      }}
                    >
                      Accepted
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#77736A",
                    letterSpacing: "0.5px",
                    marginBottom: "12px",
                    textTransform: "uppercase",
                  }}
                >
                  Recent Activity
                </div>
                {[
                  { name: "Taylor Guest", action: "responded", status: "Accepts", time: "2m ago" },
                  { name: "Jordan Lee", action: "responded", status: "Declines", time: "15m ago" },
                  { name: "Sam & Alex", action: "responded", status: "Accepts", time: "1h ago" },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: i < 2 ? "1px solid #F0ECE3" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background:
                            item.status === "Accepts" ? "#B8944F" : "#77736A",
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                          color: "#191B1E",
                        }}
                      >
                        <strong>{item.name}</strong>{" "}
                        <span style={{ color: "#77736A", fontWeight: 300 }}>
                          {item.action}
                        </span>{" "}
                        <span
                          style={{
                            color:
                              item.status === "Accepts" ? "#B8944F" : "#77736A",
                            fontWeight: 600,
                          }}
                        >
                          {item.status}
                        </span>
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "11px",
                        color: "#A09A91",
                        fontWeight: 300,
                      }}
                    >
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* RSVP Stationery Image — overlapping bottom-right */}
            <div
              style={{
                position: "absolute",
                bottom: "-40px",
                right: "-30px",
                width: "220px",
                height: "280px",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 16px 40px rgba(0,0,0,0.1)",
                zIndex: 1,
                transform: "rotate(3deg)",
              }}
              className="features-stationery-img"
            >
              <Image
                src="/images/rsvp-stationery.png"
                alt="Elegant RSVP stationery with gold wax seal"
                fill
                style={{ objectFit: "cover" }}
                sizes="220px"
              />
            </div>
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
          .features-grid {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
          .features-stationery-img {
            display: none !important;
          }
          .features-headline {
            font-size: 32px !important;
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
