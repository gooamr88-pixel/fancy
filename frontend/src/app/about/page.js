"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import GoldDivider from "../components/GoldDivider";

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

function ValueCard({ value }) {
  return (
    <div
      className="value-card"
      style={{
        background: "#FFFFFF",
        borderRadius: "16px",
        padding: "44px 32px 36px",
        textAlign: "center",
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

      <style jsx>{`
        .value-card {
          border: 1px solid #E8E2D6;
          transition: all 0.35s ease;
          transform: translateY(0);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
        }
        .value-card:hover,
        .value-card:focus-within {
          border-color: #D7BE80;
          transform: translateY(-6px);
          box-shadow: 0 16px 48px rgba(184, 148, 79, 0.12);
        }
      `}</style>
    </div>
  );
}

/* ─── Gold ornamental divider ─── */
export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>

        {/* ════════════ HERO ════════════ */}
        <section
          className="fx-section fx-section--tight-bottom"
          style={{
            background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
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

          <div className="fx-container fx-container--xl" style={{ position: "relative", zIndex: 1 }}>
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
              className="fx-container fx-container--md"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "19px",
                color: "#5E5A52",
                lineHeight: 1.75,
              }}
            >
              We believe every celebration deserves a first impression as
              memorable as the event itself. That&apos;s why we created Fancy RSVP —
              where elegance meets innovation.
            </p>
          </div>
        </section>

        {/* ════════════ MISSION ════════════ */}
        <section className="fx-section" style={{ background: "#FFFFFF" }}>
          {/* .fx-container and .fx-grid compose on one element — the former
              owns width/max-width/margin, the latter display/gap/columns.
              --fx-col 340px keeps this two-up until the available width
              drops below 2×340+gap, i.e. at roughly the same ~768px the
              old .mission-grid media query used, then it goes single
              column on its own with no breakpoint to maintain.
              --fx-gap is set explicitly because this section's 80px desktop
              gap is far from the 32px default; leaving it unset would have
              silently halved the space between the illustration and copy. */}
          <div
            className="fx-container fx-container--5xl fx-grid"
            style={{
              "--fx-col": "340px",
              "--fx-gap": "clamp(40px, 1.667rem + 4.167vw, 80px)",
              alignItems: "center",
            }}
          >
            {/* Left — Illustration */}
            {/* Padding was a flat 60px 48px around a fixed 200px SVG, giving
                this card a min-content width of 48+200+48 = 296px against
                the 280px available at a 320px viewport — it overflowed, and
                the guard clipped it rather than scrolling. Both halves are
                now fluid: the padding tapers and the SVG scales. */}
            <div
              style={{
                background: "linear-gradient(135deg, #F8F4EC 0%, #FFFFFF 100%)",
                borderRadius: "20px",
                border: "1px solid #E8E2D6",
                padding: "clamp(32px, 1.5rem + 3.75vw, 60px) clamp(20px, 0.667rem + 2.917vw, 48px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "360px",
              }}
            >
              <svg
                width="200"
                height="200"
                viewBox="0 0 200 200"
                fill="none"
                style={{ width: "100%", maxWidth: "200px", height: "auto" }}
              >
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
                Fancy RSVP was born from a simple frustration — why do RSVP
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
                We set out to build the most elegant event response platform we could — one that
                treats your guests to the same premium experience they&apos;ll enjoy at your celebration,
                from the first invitation to the final seating chart.
              </p>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  color: "#5E5A52",
                  lineHeight: 1.8,
                  padding: "16px 20px",
                  background: "#FAF7F0",
                  border: "1px solid #E8E2D6",
                  borderRadius: "12px",
                }}
              >
                Fancy RSVP is built and operated by <strong style={{ color: "#191B1E" }}>16941460 Canada
                Corp., operating as Via Marketing</strong>, based in Mississauga, Ontario, Canada — serving
                hosts across the United States and Canada.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════ VALUES ════════════ */}
        <section className="fx-section" style={{ background: "#F8F4EC" }}>
          <div className="fx-container fx-container--5xl">
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
                className="fx-container fx-container--sm"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                }}
              >
                The principles that guide every decision, every design, and every line of code we write.
              </p>
            </div>
            {/* Was repeat(4, 1fr) plus three media queries stepping it
                4→2→2→1. .fx-grid--4 does the whole ladder intrinsically:
                --fx-col 260px yields 4 tracks in a 1280px container and
                the browser drops to 3, 2 and 1 as the space runs out. */}
            <div className="fx-grid fx-grid--4">
              {values.map((v) => (
                <ValueCard key={v.title} value={v} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ CTA ════════════ */}
        <section
          className="fx-section"
          style={{
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
          <div className="fx-container fx-container--md" style={{ position: "relative", zIndex: 1 }}>
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

    </>
  );
}
