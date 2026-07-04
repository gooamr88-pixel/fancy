"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";

/* ═══════════════════════════════════════════════════════════
   About Page — Fancy RSVP
   Our Story · Mission · Values · Team · Timeline · CTA
   ═══════════════════════════════════════════════════════════ */

const values = [
  {
    title: "Elegance",
    desc: "Every pixel, every interaction is crafted to reflect the sophistication your event deserves.",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path d="M20 4L23.5 14.5H34L25.5 21L29 32L20 25L11 32L14.5 21L6 14.5H16.5L20 4Z" stroke="#B8944F" strokeWidth="1.5" fill="none"/>
        <circle cx="20" cy="20" r="18" stroke="#E8E2D6" strokeWidth="1"/>
      </svg>
    ),
  },
  {
    title: "Innovation",
    desc: "We push the boundaries of digital event management with cutting-edge technology and design.",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="8" y="14" width="24" height="18" rx="3" stroke="#B8944F" strokeWidth="1.5"/>
        <path d="M14 14V10a6 6 0 0112 0v4" stroke="#B8944F" strokeWidth="1.5"/>
        <circle cx="20" cy="24" r="3" stroke="#B8944F" strokeWidth="1.5"/>
        <circle cx="20" cy="20" r="18" stroke="#E8E2D6" strokeWidth="1"/>
      </svg>
    ),
  },
  {
    title: "Simplicity",
    desc: "Complex event planning made beautifully simple — because your time matters as much as your guests'.",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="12" stroke="#B8944F" strokeWidth="1.5"/>
        <path d="M14 20L18 24L26 16" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="20" cy="20" r="18" stroke="#E8E2D6" strokeWidth="1"/>
      </svg>
    ),
  },
  {
    title: "Community",
    desc: "Built by event lovers, for event lovers. We celebrate the moments that bring people together.",
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="15" cy="16" r="4" stroke="#B8944F" strokeWidth="1.5"/>
        <circle cx="25" cy="16" r="4" stroke="#B8944F" strokeWidth="1.5"/>
        <path d="M8 30c0-4 3.5-7 7-7h2" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M32 30c0-4-3.5-7-7-7h-2" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="20" cy="20" r="18" stroke="#E8E2D6" strokeWidth="1"/>
      </svg>
    ),
  },
];

const team = [
  { initials: "SL", name: "Sarah Laurent", role: "Co-Founder & CEO", bio: "Former event planner turned tech visionary with 15 years in luxury hospitality." },
  { initials: "JC", name: "James Chen", role: "Co-Founder & CTO", bio: "Full-stack architect who previously built platforms at Airbnb and Stripe." },
  { initials: "EM", name: "Elena Martinez", role: "Head of Design", bio: "Award-winning designer specializing in luxury brand experiences and visual identity." },
  { initials: "DP", name: "David Park", role: "Head of Product", bio: "Product strategist passionate about creating tools that delight and empower users." },
];

const milestones = [
  { year: "2019", title: "The Spark", desc: "Fancy RSVP was born from a simple idea — what if RSVP experiences could be as elegant as the events they represent?" },
  { year: "2020", title: "First Launch", desc: "We launched our beta to 500 couples. The response was overwhelming — 98% satisfaction in the first month." },
  { year: "2021", title: "10,000 Events", desc: "Crossed the 10,000 event milestone. Partnerships with premium wedding venues across North America." },
  { year: "2023", title: "Series A", desc: "Raised $12M in Series A funding to expand our platform with AI-powered event planning tools." },
  { year: "2025", title: "Global Reach", desc: "Now serving 200,000+ events annually across 40 countries, with a team of 85 passionate creators." },
];

function ValueCard({ value }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF",
        border: `1px solid ${hovered ? "#D7BE80" : "#E8E2D6"}`,
        borderRadius: "16px",
        padding: "44px 32px 36px",
        textAlign: "center",
        transition: "all 0.35s ease",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 16px 48px rgba(184,148,79,0.12)"
          : "0 2px 12px rgba(0,0,0,0.03)",
        cursor: "default",
      }}
    >
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "center" }}>
        {value.icon}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "22px",
          fontWeight: 600,
          color: "#191B1E",
          marginBottom: "12px",
        }}
      >
        {value.title}
      </h3>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          color: "#5E5A52",
          lineHeight: 1.7,
        }}
      >
        {value.desc}
      </p>
    </div>
  );
}

function TeamCard({ member }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF",
        border: `1px solid ${hovered ? "#D7BE80" : "#E8E2D6"}`,
        borderRadius: "16px",
        padding: "40px 28px 32px",
        textAlign: "center",
        transition: "all 0.35s ease",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 12px 40px rgba(184,148,79,0.1)"
          : "0 2px 12px rgba(0,0,0,0.03)",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          boxShadow: "0 4px 16px rgba(184,148,79,0.25)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "24px",
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "1px",
          }}
        >
          {member.initials}
        </span>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          fontWeight: 600,
          color: "#191B1E",
          marginBottom: "4px",
        }}
      >
        {member.name}
      </h3>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          fontWeight: 600,
          color: "#B8944F",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          marginBottom: "14px",
        }}
      >
        {member.role}
      </p>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          color: "#5E5A52",
          lineHeight: 1.7,
        }}
      >
        {member.bio}
      </p>
    </div>
  );
}

/* ─── Gold ornamental divider ─── */
function GoldDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", padding: "12px 0" }}>
      <div style={{ width: "60px", height: "1px", background: "linear-gradient(90deg, transparent, #D7BE80)" }} />
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1L11 7H17L12 11L14 17L9 13L4 17L6 11L1 7H7L9 1Z" fill="#D7BE80" opacity="0.5" />
      </svg>
      <div style={{ width: "60px", height: "1px", background: "linear-gradient(90deg, #D7BE80, transparent)" }} />
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>

        {/* ════════════ HERO ════════════ */}
        <section
          style={{
            background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
            padding: "100px 48px 80px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative circle */}
          <div style={{
            position: "absolute", top: "-120px", right: "-120px",
            width: "400px", height: "400px", borderRadius: "50%",
            border: "1px solid rgba(184,148,79,0.1)", pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: "-80px", left: "-80px",
            width: "300px", height: "300px", borderRadius: "50%",
            border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none",
          }} />

          <div style={{ maxWidth: "800px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "#B8944F",
                marginBottom: "20px",
              }}
            >
              About Fancy RSVP
            </p>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
                fontWeight: 700,
                color: "#191B1E",
                marginBottom: "24px",
                lineHeight: 1.1,
              }}
            >
              Our Story
            </h1>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "19px",
                color: "#5E5A52",
                lineHeight: 1.75,
                maxWidth: "640px",
                margin: "0 auto",
              }}
            >
              We believe every celebration deserves a first impression as
              memorable as the event itself. That&apos;s why we created Fancy RSVP —
              where elegance meets innovation.
            </p>
          </div>
        </section>

        {/* ════════════ MISSION ════════════ */}
        <section style={{ padding: "100px 48px", background: "#FFFFFF" }}>
          <div
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "80px",
              alignItems: "center",
            }}
            className="mission-grid"
          >
            {/* Left — Illustration */}
            <div
              style={{
                background: "linear-gradient(135deg, #F8F4EC 0%, #FFFFFF 100%)",
                borderRadius: "20px",
                border: "1px solid #E8E2D6",
                padding: "60px 48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "360px",
              }}
            >
              <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                {/* Decorative envelope illustration */}
                <rect x="30" y="60" width="140" height="90" rx="8" stroke="#B8944F" strokeWidth="2" fill="none" />
                <path d="M30 68L100 120L170 68" stroke="#B8944F" strokeWidth="2" fill="none" strokeLinejoin="round" />
                <path d="M35 60L100 30L165 60" stroke="#D7BE80" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                <circle cx="100" cy="45" r="8" stroke="#D7BE80" strokeWidth="1" fill="none" />
                <path d="M96 45L100 49L104 41" stroke="#D7BE80" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                {/* Stars */}
                <circle cx="50" cy="40" r="2" fill="#D7BE80" opacity="0.4" />
                <circle cx="155" cy="35" r="3" fill="#D7BE80" opacity="0.3" />
                <circle cx="40" cy="130" r="2" fill="#D7BE80" opacity="0.3" />
                <circle cx="165" cy="120" r="2" fill="#D7BE80" opacity="0.4" />
                {/* Heart */}
                <path d="M92 160C92 160 80 150 80 143C80 138 84 135 88 137C90 138 92 140 92 140C92 140 94 138 96 137C100 135 104 138 104 143C104 150 92 160 92 160Z" fill="#D7BE80" opacity="0.3" />
              </svg>
            </div>

            {/* Right — Text */}
            <div>
              <GoldDivider />
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                  fontWeight: 600,
                  color: "#191B1E",
                  marginBottom: "20px",
                  marginTop: "8px",
                }}
              >
                Making Every Event Unforgettable
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "16px",
                  color: "#5E5A52",
                  lineHeight: 1.8,
                  marginBottom: "20px",
                }}
              >
                Founded in 2019, Fancy RSVP was born from a simple frustration — why do RSVP
                experiences feel like an afterthought when the invitation itself sets the tone for
                the entire event?
              </p>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "16px",
                  color: "#5E5A52",
                  lineHeight: 1.8,
                  marginBottom: "28px",
                }}
              >
                We set out to build the world&apos;s most elegant event response platform — one that
                treats your guests to the same premium experience they&apos;ll enjoy at your celebration.
                Today, we serve over 200,000 events annually across 40 countries.
              </p>
              <div style={{ display: "flex", gap: "40px" }}>
                {[
                  { num: "200K+", label: "Events Hosted" },
                  { num: "40+", label: "Countries" },
                  { num: "98%", label: "Satisfaction" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "28px",
                        fontWeight: 700,
                        color: "#B8944F",
                        lineHeight: 1,
                      }}
                    >
                      {stat.num}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                        color: "#5E5A52",
                        marginTop: "4px",
                      }}
                    >
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════ VALUES ════════════ */}
        <section style={{ padding: "100px 48px", background: "#F8F4EC" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "60px" }}>
              <GoldDivider />
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                  fontWeight: 600,
                  color: "#191B1E",
                  marginTop: "8px",
                  marginBottom: "16px",
                }}
              >
                Our Values
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  maxWidth: "560px",
                  margin: "0 auto",
                  lineHeight: 1.7,
                }}
              >
                The principles that guide every decision, every design, and every line of code we write.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "28px",
              }}
              className="values-grid"
            >
              {values.map((v) => (
                <ValueCard key={v.title} value={v} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ TEAM ════════════ */}
        <section style={{ padding: "100px 48px", background: "#FFFFFF" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "60px" }}>
              <GoldDivider />
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                  fontWeight: 600,
                  color: "#191B1E",
                  marginTop: "8px",
                  marginBottom: "16px",
                }}
              >
                Meet the Team
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  maxWidth: "560px",
                  margin: "0 auto",
                  lineHeight: 1.7,
                }}
              >
                A passionate crew of designers, engineers, and event enthusiasts building the future of celebrations.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "28px",
              }}
              className="team-grid"
            >
              {team.map((m) => (
                <TeamCard key={m.name} member={m} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ TIMELINE ════════════ */}
        <section style={{ padding: "100px 48px", background: "#F8F4EC" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <GoldDivider />
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                  fontWeight: 600,
                  color: "#191B1E",
                  marginTop: "8px",
                  marginBottom: "16px",
                }}
              >
                Our Journey
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                }}
              >
                From a spark of inspiration to a global platform.
              </p>
            </div>

            {/* Timeline */}
            <div style={{ position: "relative" }}>
              {/* Vertical line */}
              <div
                style={{
                  position: "absolute",
                  left: "28px",
                  top: "8px",
                  bottom: "8px",
                  width: "2px",
                  background: "linear-gradient(180deg, #D7BE80, #E8E2D6)",
                }}
                className="timeline-line"
              />
              {milestones.map((m, i) => (
                <div
                  key={m.year}
                  style={{
                    display: "flex",
                    gap: "28px",
                    marginBottom: i < milestones.length - 1 ? "44px" : "0",
                    position: "relative",
                  }}
                  className="timeline-item"
                >
                  {/* Dot */}
                  <div
                    style={{
                      width: "58px",
                      minWidth: "58px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "#B8944F",
                        border: "3px solid #F8F4EC",
                        boxShadow: "0 0 0 2px #D7BE80",
                        zIndex: 1,
                      }}
                    />
                  </div>
                  {/* Content */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E8E2D6",
                      borderRadius: "14px",
                      padding: "28px 32px",
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "12px",
                        fontWeight: 700,
                        letterSpacing: "2px",
                        color: "#B8944F",
                        textTransform: "uppercase",
                      }}
                    >
                      {m.year}
                    </span>
                    <h3
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "20px",
                        fontWeight: 600,
                        color: "#191B1E",
                        margin: "8px 0",
                      }}
                    >
                      {m.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "15px",
                        color: "#5E5A52",
                        lineHeight: 1.7,
                      }}
                    >
                      {m.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ CTA ════════════ */}
        <section
          style={{
            padding: "100px 48px",
            background: "linear-gradient(135deg, #191B1E 0%, #2a2d32 100%)",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative glow */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "600px",
              height: "600px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(184,148,79,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ maxWidth: "640px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <GoldDivider />
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
                fontWeight: 600,
                color: "#FFFFFF",
                marginTop: "8px",
                marginBottom: "20px",
              }}
            >
              Ready to Create Something Beautiful?
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "17px",
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.7,
                marginBottom: "36px",
              }}
            >
              Join thousands of hosts who trust Fancy RSVP to make their events
              unforgettable from the very first interaction.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/register"
                className="btn-gold"
                style={{ padding: "16px 40px", fontSize: "15px", borderRadius: "8px" }}
              >
                Get Started Free
              </Link>
              <Link
                href="/contact"
                className="btn-outline"
                style={{
                  padding: "16px 40px",
                  fontSize: "15px",
                  borderRadius: "8px",
                  borderColor: "rgba(255,255,255,0.25)",
                  color: "#FFFFFF",
                }}
              >
                Contact Us
              </Link>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        @media (max-width: 1024px) {
          .mission-grid {
            gap: 48px !important;
          }
          .values-grid,
          .team-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .mission-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .values-grid,
          .team-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
          }
          .timeline-line {
            left: 20px !important;
          }
        }
        @media (max-width: 640px) {
          .values-grid,
          .team-grid {
            grid-template-columns: 1fr !important;
          }
          .timeline-item {
            gap: 16px !important;
          }
        }
      `}</style>
    </>
  );
}
