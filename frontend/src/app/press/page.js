"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";

/* ═══════════════════════════════════════════════════════════
   Press Page — Fancy RSVP
   Hero · Press Kit · Media Mentions · Brand · Awards · Contact
   ═══════════════════════════════════════════════════════════ */

const mediaMentions = [
  {
    publication: "TechCrunch",
    headline: "Fancy RSVP Raises $12M to Reimagine Event Experiences",
    date: "March 2025",
    excerpt: "The luxury event-tech startup is using AI and premium design to transform how people RSVP to life's most important moments.",
    url: "https://techcrunch.com",
  },
  {
    publication: "Forbes",
    headline: "How Fancy RSVP Turned Wedding RSVPs Into a $50M Business",
    date: "January 2025",
    excerpt: "Co-founder Sarah Laurent shares how a frustrating wedding planning experience led to building the most elegant RSVP platform on the market.",
    url: "https://forbes.com",
  },
  {
    publication: "Vogue Business",
    headline: "The Digital Luxury Revolution in Event Planning",
    date: "November 2024",
    excerpt: "Fancy RSVP is among a new wave of startups bringing luxury brand sensibilities to previously overlooked digital touchpoints.",
    url: "https://voguebusiness.com",
  },
  {
    publication: "The Knot",
    headline: "Best RSVP Tools of 2025: Fancy RSVP Takes the Crown",
    date: "February 2025",
    excerpt: "Editors chose Fancy RSVP as the top digital RSVP solution for weddings, citing its stunning design and seamless guest experience.",
    url: "https://theknot.com",
  },
  {
    publication: "Product Hunt",
    headline: "#1 Product of the Day — Fancy RSVP 3.0 Launch",
    date: "April 2025",
    excerpt: "The latest version features AI-powered guest management, new premium templates, and multi-language support across 40+ countries.",
    url: "https://producthunt.com",
  },
];

const awards = [
  { title: "Best Event Tech Startup", org: "EventTech Awards 2025", icon: "🏆" },
  { title: "#1 Product of the Day", org: "Product Hunt", icon: "🥇" },
  { title: "Best UX Design", org: "Webby Awards 2024", icon: "✨" },
  { title: "Top 50 Startups to Watch", org: "Forbes 2025", icon: "🚀" },
];

const brandColors = [
  { name: "Champagne Gold", hex: "#B8944F", textColor: "#FFF" },
  { name: "Deep Charcoal", hex: "#191B1E", textColor: "#FFF" },
  { name: "Warm Ivory", hex: "#F8F4EC", textColor: "#191B1E" },
  { name: "Soft Champagne", hex: "#D7BE80", textColor: "#191B1E" },
  { name: "Muted Stone", hex: "#5E5A52", textColor: "#FFF" },
];

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

function MentionCard({ mention }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={mention.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        background: "#FFFFFF",
        border: `1px solid ${hovered ? "#D7BE80" : "#E8E2D6"}`,
        borderRadius: "16px",
        padding: "32px 28px",
        textDecoration: "none",
        transition: "all 0.35s ease",
        transform: hovered ? "translateY(-5px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 16px 48px rgba(184,148,79,0.1)"
          : "0 2px 12px rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "16px",
            fontWeight: 700,
            color: "#B8944F",
            letterSpacing: "0.5px",
          }}
        >
          {mention.publication}
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "#5E5A52",
            opacity: 0.7,
          }}
        >
          {mention.date}
        </span>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "19px",
          fontWeight: 600,
          color: "#191B1E",
          lineHeight: 1.35,
          marginBottom: "12px",
        }}
      >
        {mention.headline}
      </h3>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          color: "#5E5A52",
          lineHeight: 1.7,
        }}
      >
        {mention.excerpt}
      </p>
      <div
        style={{
          marginTop: "16px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 600,
            color: "#B8944F",
          }}
        >
          Read article
        </span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8M8 4l3 3-3 3" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </a>
  );
}

function DownloadCard({ title, desc, icon }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={`mailto:press@fancyrsvp.com?subject=${encodeURIComponent("Press Kit: " + title)}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        background: "#FFFFFF",
        border: `1px solid ${hovered ? "#D7BE80" : "#E8E2D6"}`,
        borderRadius: "14px",
        padding: "32px 28px",
        textAlign: "center",
        textDecoration: "none",
        transition: "all 0.35s ease",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 12px 36px rgba(184,148,79,0.1)"
          : "0 2px 8px rgba(0,0,0,0.02)",
        cursor: "pointer",
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
          margin: "0 auto 16px",
          fontSize: "24px",
        }}
      >
        {icon}
      </div>
      <h4
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "17px",
          fontWeight: 600,
          color: "#191B1E",
          marginBottom: "8px",
        }}
      >
        {title}
      </h4>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: "#5E5A52",
          lineHeight: 1.6,
          marginBottom: "16px",
        }}
      >
        {desc}
      </p>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          fontWeight: 700,
          color: "#B8944F",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v8M4 7l3 3 3-3" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 11h10" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Download
      </span>
    </a>
  );
}

export default function PressPage() {
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
              top: "-140px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "800px",
              height: "800px",
              borderRadius: "50%",
              border: "1px solid rgba(184,148,79,0.05)",
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
              Newsroom
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
              Press & Media
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
              News, resources, and brand assets for journalists, bloggers, and media partners covering Fancy RSVP.
            </p>
          </div>
        </section>

        {/* ════════════ PRESS KIT ════════════ */}
        <section style={{ padding: "80px 48px 100px", background: "#FFFFFF" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
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
                Press Kit
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                }}
              >
                Everything you need to tell the Fancy RSVP story.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "24px",
              }}
              className="press-kit-grid"
            >
              <DownloadCard
                title="Logo Package"
                desc="SVG, PNG, and EPS logos in all color variants and sizes."
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="#B8944F" strokeWidth="1.5"/>
                    <circle cx="9" cy="10" r="2" stroke="#B8944F" strokeWidth="1.2"/>
                    <path d="M3 16l5-4 3 3 4-5 6 6" stroke="#B8944F" strokeWidth="1.2" strokeLinejoin="round"/>
                  </svg>
                }
              />
              <DownloadCard
                title="Brand Guidelines"
                desc="Complete brand guide with typography, colors, and usage rules."
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4h16v16H4V4Z" stroke="#B8944F" strokeWidth="1.5" rx="2"/>
                    <line x1="8" y1="8" x2="16" y2="8" stroke="#B8944F" strokeWidth="1.2"/>
                    <line x1="8" y1="12" x2="14" y2="12" stroke="#B8944F" strokeWidth="1.2"/>
                    <line x1="8" y1="16" x2="12" y2="16" stroke="#B8944F" strokeWidth="1.2"/>
                  </svg>
                }
              />
              <DownloadCard
                title="Product Screenshots"
                desc="High-resolution screenshots of our platform and mobile apps."
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="4" width="20" height="14" rx="2" stroke="#B8944F" strokeWidth="1.5"/>
                    <line x1="12" y1="18" x2="12" y2="21" stroke="#B8944F" strokeWidth="1.5"/>
                    <line x1="8" y1="21" x2="16" y2="21" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                }
              />
              <DownloadCard
                title="Founder Photos"
                desc="Professional headshots and team photos for editorial use."
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="9" r="4" stroke="#B8944F" strokeWidth="1.5"/>
                    <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                }
              />
            </div>
          </div>
        </section>

        {/* ════════════ MEDIA MENTIONS ════════════ */}
        <section style={{ padding: "100px 48px", background: "#F8F4EC" }}>
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
                In the News
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                }}
              >
                Recent coverage of Fancy RSVP in the press.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {mediaMentions.map((m) => (
                <MentionCard key={m.headline} mention={m} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ BRAND GUIDELINES ════════════ */}
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
                Brand Guidelines
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                  maxWidth: "560px",
                  margin: "0 auto",
                }}
              >
                Please use these guidelines when featuring our brand in articles, blogs, or social media.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "48px",
                alignItems: "start",
              }}
              className="brand-grid"
            >
              {/* Logo Usage */}
              <div
                style={{
                  background: "#F8F4EC",
                  borderRadius: "20px",
                  border: "1px solid #E8E2D6",
                  padding: "48px 40px",
                }}
              >
                <h3
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "22px",
                    fontWeight: 600,
                    color: "#191B1E",
                    marginBottom: "24px",
                  }}
                >
                  Logo Usage
                </h3>
                {/* Logo preview */}
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "12px",
                    padding: "40px",
                    textAlign: "center",
                    marginBottom: "28px",
                    border: "1px solid #E8E2D6",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-script)",
                        fontSize: "36px",
                        color: "#B8944F",
                        lineHeight: 1,
                      }}
                    >
                      Fancy
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "28px",
                        fontWeight: 600,
                        color: "#191B1E",
                        letterSpacing: "4px",
                        textTransform: "uppercase",
                        lineHeight: 1,
                      }}
                    >
                      RSVP
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[
                    "Always maintain clear space around the logo equal to the height of the 'R' in RSVP",
                    "Do not stretch, distort, or change the logo colors",
                    "Use the dark version on light backgrounds, white version on dark backgrounds",
                    "Minimum size: 120px wide for digital, 1 inch for print",
                  ].map((rule, i) => (
                    <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginTop: "3px", flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="7" stroke="#B8944F" strokeWidth="1.2" />
                        <path d="M5 8l2 2 4-4" stroke="#B8944F" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#5E5A52", lineHeight: 1.6 }}>
                        {rule}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Color Palette */}
              <div
                style={{
                  background: "#F8F4EC",
                  borderRadius: "20px",
                  border: "1px solid #E8E2D6",
                  padding: "48px 40px",
                }}
              >
                <h3
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "22px",
                    fontWeight: 600,
                    color: "#191B1E",
                    marginBottom: "24px",
                  }}
                >
                  Color Palette
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {brandColors.map((c) => (
                    <div
                      key={c.hex}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        background: "#FFFFFF",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        border: "1px solid #E8E2D6",
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "10px",
                          background: c.hex,
                          flexShrink: 0,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        }}
                      />
                      <div>
                        <p
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "15px",
                            fontWeight: 600,
                            color: "#191B1E",
                            marginBottom: "2px",
                          }}
                        >
                          {c.name}
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "13px",
                            color: "#5E5A52",
                            fontVariant: "all-small-caps",
                            letterSpacing: "1px",
                          }}
                        >
                          {c.hex}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════ AWARDS ════════════ */}
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
                Awards & Recognition
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                }}
              >
                Honored to be recognized by the industry.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "24px",
              }}
              className="awards-grid"
            >
              {awards.map((award) => (
                <div
                  key={award.title}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E8E2D6",
                    borderRadius: "16px",
                    padding: "40px 24px",
                    textAlign: "center",
                    transition: "all 0.3s ease",
                  }}
                  className="award-card"
                >
                  <div style={{ fontSize: "40px", marginBottom: "16px" }}>{award.icon}</div>
                  <h4
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "17px",
                      fontWeight: 600,
                      color: "#191B1E",
                      marginBottom: "8px",
                      lineHeight: 1.3,
                    }}
                  >
                    {award.title}
                  </h4>
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "#B8944F",
                      fontWeight: 600,
                    }}
                  >
                    {award.org}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ PRESS CONTACT ════════════ */}
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
              Press Inquiries
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "17px",
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.7,
                marginBottom: "12px",
              }}
            >
              For interviews, media inquiries, and partnership opportunities, please reach out to our communications team.
            </p>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "18px",
                fontWeight: 600,
                color: "#D7BE80",
                marginBottom: "36px",
                letterSpacing: "0.5px",
              }}
            >
              press@fancyrsvp.com
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="mailto:press@fancyrsvp.com"
                className="btn-gold"
                style={{ padding: "16px 40px", fontSize: "15px", borderRadius: "8px" }}
              >
                Contact Press Team
              </Link>
              <a
                href="mailto:press@fancyrsvp.com?subject=Press%20Kit%20Request"
                className="btn-outline"
                style={{
                  padding: "16px 40px",
                  fontSize: "15px",
                  borderRadius: "8px",
                  borderColor: "rgba(255,255,255,0.25)",
                  color: "#FFFFFF",
                  textDecoration: "none",
                }}
              >
                Download Full Press Kit
              </a>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        .award-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 40px rgba(184,148,79,0.1);
          border-color: #D7BE80;
        }
        @media (max-width: 1024px) {
          .press-kit-grid,
          .awards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .press-kit-grid,
          .awards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 16px !important;
          }
          .brand-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
        }
        @media (max-width: 640px) {
          .press-kit-grid,
          .awards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
