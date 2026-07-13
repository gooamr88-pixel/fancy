"use client";
import React from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import GoldDivider from "../components/GoldDivider";

const AUDIENCES = [
  {
    key: "planners",
    href: "/solutions/planners",
    eyebrow: "Professional Planners",
    title: "For Event Planners",
    desc: "One dashboard for every client's event — branded invitations, seating charts, and cross-event insights.",
    bullets: ["Manage unlimited active client events", "Fully brandable per event", "Aggregated insights across your roster"],
    color: "#B8944F",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
  {
    key: "venues",
    href: "/solutions/venues",
    eyebrow: "Venues & Event Spaces",
    title: "For Venues",
    desc: "Floor plans shaped like your real space, premium invitations for every booking, and fast QR check-in at the door.",
    bullets: ["Custom floor plans per room", "QR check-in at every entrance", "Consistent, premium presentation"],
    color: "#6B8EAE",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><circle cx="15.5" cy="8.5" r="1.5" />
        <circle cx="8.5" cy="15.5" r="1.5" /><circle cx="15.5" cy="15.5" r="1.5" />
      </svg>
    ),
  },
  {
    key: "corporate",
    href: "/solutions/corporate",
    eyebrow: "Corporate & Enterprise",
    title: "For Corporate Teams",
    desc: "Run company galas, conferences, and employee events at scale — with real-time dashboards leadership can actually see.",
    bullets: ["Guest lists in the thousands", "Real-time attendance dashboard", "Enterprise plan with custom pricing"],
    color: "#4A7C59",
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

// Same figures shown on the homepage's SocialProofBar — deliberately not a new,
// separately-invented set of numbers.
const STATS = [
  { value: "10,000+", label: "Events Created" },
  { value: "50,000+", label: "Guests Managed" },
  { value: "99.9%", label: "Platform Uptime" },
];

function AudienceCard({ audience }) {
  return (
    <Link
      href={audience.href}
      className="aud-card"
      style={{
        display: "block",
        background: "#FFFFFF",
        border: "1px solid #E8E2D6",
        borderRadius: "20px",
        padding: "40px 32px",
        textDecoration: "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="aud-accent" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: audience.color }} />
      <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: `${audience.color}14`, display: "flex", alignItems: "center", justifyContent: "center", color: audience.color, marginBottom: "24px" }}>
        {audience.icon}
      </div>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: audience.color, display: "block", marginBottom: "10px" }}>
        {audience.eyebrow}
      </span>
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#191B1E", marginBottom: "12px" }}>
        {audience.title}
      </h3>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14.5px", color: "#5E5A52", lineHeight: 1.7, marginBottom: "20px" }}>
        {audience.desc}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
        {audience.bullets.map((b) => (
          <li key={b} style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "13.5px", color: "#5E5A52", padding: "4px 0" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill={`${audience.color}1A`} /><path d="M4.2 7l2 2 3.6-3.6" stroke={audience.color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {b}
          </li>
        ))}
      </ul>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 700, color: audience.color, display: "inline-flex", alignItems: "center", gap: "6px" }}>
        Explore
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
      </span>

      <style jsx>{`
        .aud-card { transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94); box-shadow: 0 2px 12px rgba(0,0,0,0.03); }
        .aud-card:hover, .aud-card:focus-visible { transform: translateY(-6px); box-shadow: 0 20px 60px rgba(0,0,0,0.08); border-color: ${audience.color}; }
        .aud-accent { opacity: 0; transition: opacity 0.3s ease; }
        .aud-card:hover .aud-accent, .aud-card:focus-visible .aud-accent { opacity: 1; }
        @media (max-width: 480px) {
          .aud-card { padding: 28px 22px !important; }
        }
      `}</style>
    </Link>
  );
}

export default function SolutionsHubPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ════════════════════ HERO ════════════════════ */}
        <section style={{ background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)", padding: "100px 48px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />
          <div style={{ maxWidth: "700px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <div style={{ display: "inline-block", padding: "8px 24px", borderRadius: "100px", background: "rgba(184, 148, 79, 0.08)", border: "1px solid rgba(184, 148, 79, 0.15)", marginBottom: "28px" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "#B8944F", letterSpacing: "1.5px", textTransform: "uppercase" }}>Solutions</span>
            </div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 700, color: "#191B1E", lineHeight: 1.15, marginBottom: "24px", letterSpacing: "-1px" }}>
              Built for every kind of{" "}<span style={{ color: "#B8944F" }}>host</span>
            </h1>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "19px", lineHeight: 1.7, color: "#5E5A52", maxWidth: "560px", margin: "0 auto" }}>
              From a single couple&apos;s wedding to a 400-guest corporate gala, Fancy RSVP scales to how you actually plan events — solo, professionally, or at a venue you run.
            </p>
          </div>
        </section>

        {/* ════════════════════ AUDIENCE CARDS ════════════════════ */}
        <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "60px 48px 100px" }}>
          <GoldDivider variant="wide" />
          <div style={{ marginTop: "48px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "28px" }} className="sh-grid-3">
            {AUDIENCES.map((a) => (
              <AudienceCard key={a.key} audience={a} />
            ))}
          </div>
        </section>

        {/* ════════════════════ TRUST BAND ════════════════════ */}
        <section style={{ background: "#F8F4EC", padding: "72px 48px" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: "40px", textAlign: "center" }}>
            {STATS.map((s) => (
              <div key={s.label}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "40px", fontWeight: 700, color: "#191B1E", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "#77736A", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: "8px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════ CTA ════════════════════ */}
        <section style={{ padding: "100px 48px", textAlign: "center" }}>
          <div style={{ maxWidth: "540px", margin: "0 auto" }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "32px", fontWeight: 700, color: "#191B1E", marginBottom: "16px" }}>
              Not sure which fits your team?
            </h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", color: "#5E5A52", marginBottom: "32px", lineHeight: 1.7 }}>
              Tell us what you&apos;re planning and we&apos;ll point you to the right plan — no pressure, no sales script.
            </p>
            <Link href="/contact" className="btn-gold" style={{ padding: "15px 40px", fontSize: "15px", fontWeight: 700, borderRadius: "8px" }}>
              Get in Touch
            </Link>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        @media (max-width: 900px) {
          .sh-grid-3 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          section { padding-left: 20px !important; padding-right: 20px !important; padding-top: 56px !important; padding-bottom: 56px !important; }
          h1 { line-height: 1.2 !important; }
          h2 { font-size: 26px !important; }
        }
        @media (max-width: 480px) {
          .btn-gold { width: 100% !important; }
        }
      `}</style>
    </>
  );
}
