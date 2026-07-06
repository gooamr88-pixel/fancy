"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import GoldDivider from "../components/GoldDivider";

/* ═══════════════════════════════════════════════════════════
   Careers Page — Fancy RSVP
   Hero · Perks · Open Positions · Culture · CTA
   ═══════════════════════════════════════════════════════════ */

const perks = [
  {
    title: "Remote First",
    desc: "Work from anywhere in the world. We believe great work happens wherever you're most inspired.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="12" stroke="#B8944F" strokeWidth="1.5" />
        <path d="M6 18h24M18 6c-4 4-4 20 0 24M18 6c4 4 4 20 0 24" stroke="#B8944F" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    title: "Health Benefits",
    desc: "Comprehensive medical, dental, and vision coverage for you and your family — because wellness matters.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <path d="M18 30S6 22 6 14a6 6 0 0112 0 6 6 0 0112 0c0 8-12 16-12 16Z" stroke="#B8944F" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    title: "Learning Budget",
    desc: "$2,000 annual learning stipend for courses, conferences, books, and anything that fuels your growth.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <path d="M6 14l12-6 12 6-12 6-12-6Z" stroke="#B8944F" strokeWidth="1.5" fill="none" />
        <path d="M6 14v8l12 6 12-6v-8" stroke="#B8944F" strokeWidth="1.5" fill="none" />
        <line x1="30" y1="14" x2="30" y2="26" stroke="#B8944F" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Flexible Hours",
    desc: "Set your own schedule. We measure outcomes, not hours — work when you're at your creative best.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="13" stroke="#B8944F" strokeWidth="1.5" />
        <path d="M18 10v8l5 5" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Team Events",
    desc: "Quarterly team retreats, monthly virtual gatherings, and an annual company-wide celebration.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="14" cy="12" r="4" stroke="#B8944F" strokeWidth="1.5" />
        <circle cx="24" cy="12" r="4" stroke="#B8944F" strokeWidth="1.5" />
        <path d="M6 28c0-4 3.5-8 8-8 1.5 0 2.8.4 4 1 1.2-.6 2.5-1 4-1 4.5 0 8 4 8 8" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Equity",
    desc: "Every team member receives stock options — when Fancy RSVP wins, we all win together.",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="6" y="18" width="6" height="12" rx="1" stroke="#B8944F" strokeWidth="1.5" />
        <rect x="15" y="12" width="6" height="18" rx="1" stroke="#B8944F" strokeWidth="1.5" />
        <rect x="24" y="6" width="6" height="24" rx="1" stroke="#B8944F" strokeWidth="1.5" />
      </svg>
    ),
  },
];

const positions = [
  {
    title: "Senior Frontend Engineer",
    department: "Engineering",
    location: "Remote (US / EU)",
    type: "Full-time",
    desc: "Build beautiful, performant user experiences with React and Next.js for our event management platform.",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote (Global)",
    type: "Full-time",
    desc: "Shape the future of event experiences through thoughtful design systems, prototyping, and user research.",
  },
  {
    title: "Growth Marketing Manager",
    department: "Marketing",
    location: "New York, NY / Remote",
    type: "Full-time",
    desc: "Drive user acquisition and brand awareness through data-driven campaigns across multiple channels.",
  },
  {
    title: "Backend Engineer",
    department: "Engineering",
    location: "Remote (US / EU)",
    type: "Full-time",
    desc: "Design and scale our API infrastructure using Node.js, PostgreSQL, and cloud-native architectures.",
  },
  {
    title: "Customer Success Lead",
    department: "Operations",
    location: "Remote (US)",
    type: "Full-time",
    desc: "Help our premium clients create extraordinary events by ensuring they get the most from our platform.",
  },
];

const cultureValues = [
  { title: "Craft Over Speed", desc: "We take the time to get things right. Quality is never compromised." },
  { title: "Radical Transparency", desc: "Open books, open doors. Every voice matters in shaping our direction." },
  { title: "Celebrate Everything", desc: "We practice what we preach — milestones big and small deserve recognition." },
  { title: "Grow Together", desc: "Mentorship, feedback, and continuous learning are part of our DNA." },
];

function PerkCard({ perk }) {
  return (
    <div
      className="perk-card"
      style={{
        background: "#FFFFFF",
        borderRadius: "16px",
        padding: "36px 28px",
        cursor: "default",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "14px",
          background: "rgba(184,148,79,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        {perk.icon}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          fontWeight: 600,
          color: "#191B1E",
          marginBottom: "10px",
        }}
      >
        {perk.title}
      </h3>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          color: "#5E5A52",
          lineHeight: 1.7,
        }}
      >
        {perk.desc}
      </p>

      <style jsx>{`
        .perk-card {
          border: 1px solid #E8E2D6;
          transition: all 0.35s ease;
          transform: translateY(0);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
        }
        .perk-card:hover,
        .perk-card:focus-within {
          border-color: #D7BE80;
          transform: translateY(-5px);
          box-shadow: 0 16px 48px rgba(184, 148, 79, 0.1);
        }
      `}</style>
    </div>
  );
}

function JobCard({ job }) {
  return (
    <div
      className="job-card"
      style={{
        background: "#FFFFFF",
        borderRadius: "14px",
        padding: "32px 36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "24px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: "260px" }}>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "20px",
            fontWeight: 600,
            color: "#191B1E",
            marginBottom: "8px",
          }}
        >
          {job.title}
        </h3>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "#5E5A52",
            lineHeight: 1.7,
            marginBottom: "12px",
          }}
        >
          {job.desc}
        </p>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[
            { icon: "📂", text: job.department },
            { icon: "📍", text: job.location },
            { icon: "⏰", text: job.type },
          ].map((meta) => (
            <span
              key={meta.text}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "#5E5A52",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span style={{ fontSize: "14px" }}>{meta.icon}</span>
              {meta.text}
            </span>
          ))}
        </div>
      </div>
      <a
        href={`mailto:careers@fancyrsvp.com?subject=${encodeURIComponent("Application: " + job.title)}`}
        className="btn-gold"
        style={{
          padding: "12px 32px",
          fontSize: "13px",
          borderRadius: "8px",
          whiteSpace: "nowrap",
          flexShrink: 0,
          textDecoration: "none",
        }}
      >
        Apply Now
      </a>

      <style jsx>{`
        .job-card {
          border: 1px solid #E8E2D6;
          transition: all 0.3s ease;
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
        }
        .job-card:hover,
        .job-card:focus-within {
          border-color: #D7BE80;
          transform: translateY(-3px);
          box-shadow: 0 12px 36px rgba(184, 148, 79, 0.1);
        }
      `}</style>
    </div>
  );
}

export default function CareersPage() {
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
          <div
            style={{
              position: "absolute",
              top: "-150px",
              right: "-100px",
              width: "500px",
              height: "500px",
              borderRadius: "50%",
              border: "1px solid rgba(184,148,79,0.08)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-120px",
              left: "-60px",
              width: "350px",
              height: "350px",
              borderRadius: "50%",
              border: "1px solid rgba(184,148,79,0.06)",
              pointerEvents: "none",
            }}
          />

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
              We&apos;re Hiring
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
              Join Our Team
            </h1>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "19px",
                color: "#5E5A52",
                lineHeight: 1.75,
                maxWidth: "640px",
                margin: "0 auto 36px",
              }}
            >
              Help us build the world&apos;s most beautiful event platform. We&apos;re looking for
              passionate people who believe great design and technology can bring people together.
            </p>
            <a
              href="#positions"
              className="btn-gold"
              style={{ padding: "16px 40px", fontSize: "15px", borderRadius: "8px" }}
            >
              View Open Positions
            </a>
          </div>
        </section>

        {/* ════════════ PERKS ════════════ */}
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
                Why You&apos;ll Love Working Here
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
                We invest in our people the way we invest in our product — with care, intention, and generosity.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "28px",
              }}
              className="perks-grid"
            >
              {perks.map((p) => (
                <PerkCard key={p.title} perk={p} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ OPEN POSITIONS ════════════ */}
        <section id="positions" style={{ padding: "100px 48px", background: "#F8F4EC" }}>
          <div style={{ maxWidth: "920px", margin: "0 auto" }}>
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
                Open Positions
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                }}
              >
                Find the role that&apos;s right for you.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {positions.map((job) => (
                <JobCard key={job.title} job={job} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ CULTURE ════════════ */}
        <section style={{ padding: "100px 48px", background: "#FFFFFF" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "80px",
                alignItems: "center",
              }}
              className="culture-grid"
            >
              {/* Left */}
              <div>
                <GoldDivider />
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                    fontWeight: 600,
                    color: "#191B1E",
                    marginTop: "8px",
                    marginBottom: "20px",
                  }}
                >
                  Our Culture
                </h2>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "16px",
                    color: "#5E5A52",
                    lineHeight: 1.8,
                    marginBottom: "32px",
                  }}
                >
                  We&apos;re a team of 85 people across 12 countries, united by a shared love
                  for creating beautiful things. Our culture is rooted in trust, creativity,
                  and a genuine commitment to each other&apos;s growth.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {cultureValues.map((v) => (
                    <div key={v.title} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#B8944F",
                          marginTop: "8px",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <h3
                          style={{
                            fontFamily: "var(--font-serif)",
                            fontSize: "17px",
                            fontWeight: 600,
                            color: "#191B1E",
                            marginBottom: "4px",
                          }}
                        >
                          {v.title}
                        </h3>
                        <p
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "14px",
                            color: "#5E5A52",
                            lineHeight: 1.6,
                          }}
                        >
                          {v.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — Illustration */}
              <div
                style={{
                  background: "linear-gradient(135deg, #F8F4EC 0%, #FFFFFF 100%)",
                  borderRadius: "20px",
                  border: "1px solid #E8E2D6",
                  padding: "60px 48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "400px",
                }}
              >
                <svg width="220" height="220" viewBox="0 0 220 220" fill="none">
                  {/* People illustration */}
                  <circle cx="70" cy="80" r="20" stroke="#B8944F" strokeWidth="1.5" fill="none" />
                  <circle cx="150" cy="80" r="20" stroke="#B8944F" strokeWidth="1.5" fill="none" />
                  <circle cx="110" cy="65" r="22" stroke="#D7BE80" strokeWidth="1.5" fill="none" />
                  {/* Bodies */}
                  <path d="M45 140c0-14 11-25 25-25s25 11 25 25" stroke="#B8944F" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <path d="M125 140c0-14 11-25 25-25s25 11 25 25" stroke="#B8944F" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <path d="M83 135c0-15 12-27 27-27s27 12 27 27" stroke="#D7BE80" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  {/* Connection lines */}
                  <path d="M90 80L120 65" stroke="#E8E2D6" strokeWidth="1" strokeDasharray="4 4" />
                  <path d="M130 80L140 65" stroke="#E8E2D6" strokeWidth="1" strokeDasharray="4 4" />
                  {/* Stars */}
                  <circle cx="40" cy="50" r="2" fill="#D7BE80" opacity="0.4" />
                  <circle cx="180" cy="45" r="3" fill="#D7BE80" opacity="0.3" />
                  <circle cx="110" cy="170" r="2" fill="#D7BE80" opacity="0.3" />
                  {/* Heart */}
                  <path d="M105 180c0 0-8-6-8-11a4 4 0 018 0 4 4 0 018 0c0 5-8 11-8 11Z" fill="#D7BE80" opacity="0.25" />
                </svg>
              </div>
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
              Don&apos;t See the Right Role?
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
              We&apos;re always looking for exceptional talent. Send us your resume and
              tell us how you&apos;d like to make an impact at Fancy RSVP.
            </p>
            <Link
              href="mailto:careers@fancyrsvp.com"
              className="btn-gold"
              style={{ padding: "16px 44px", fontSize: "15px", borderRadius: "8px" }}
            >
              Get in Touch
            </Link>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        @media (max-width: 1024px) {
          .perks-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .culture-grid {
            gap: 48px !important;
          }
        }
        @media (max-width: 768px) {
          .perks-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
          }
          .culture-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
        }
        @media (max-width: 640px) {
          .perks-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
