"use client";
import React from "react";
import Link from "next/link";
import Navbar from "../../components/landing/Navbar";
import FooterSection from "../../components/landing/FooterSection";
import GoldDivider from "../../components/GoldDivider";
import SolutionsInquiryForm from "../../components/landing/SolutionsInquiryForm";

const PAIN_POINTS = [
  {
    title: "Every client wants their own brand",
    desc: "A cookie-cutter template doesn't work when each event needs its own colors, fonts, and invitation design.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
  {
    title: "Juggling multiple events at once",
    desc: "Switching between spreadsheets for five different clients' guest lists is where mistakes happen.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /><path d="M8 2v4" /><path d="M16 2v4" />
      </svg>
    ),
  },
  {
    title: "Clients want to see progress themselves",
    desc: "Instead of a weekly status email, clients expect to check RSVP numbers and seating whenever they want.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

const CAPABILITIES = [
  { title: "One dashboard, every client's event", desc: "Manage as many active events as you need from a single organizer account — each with its own guests, RSVPs, and settings." },
  { title: "Fully brandable invitations", desc: "Custom colors, fonts, and cover imagery per event, so every client's invitation looks like it was designed just for them." },
  { title: "Aggregated cross-event insights", desc: "A single overview dashboard rolls up RSVP rates, guest totals, and check-ins across every event you're running." },
  { title: "Drag-and-drop seating charts", desc: "Build and adjust floor plans per venue, with capacity validation so you never overbook a table." },
  { title: "CSV/Excel guest import & export", desc: "Bring an existing client guest list in seconds, and export clean reports whenever they ask for one." },
  { title: "Custom RSVP questionnaires", desc: "Meal choices, dietary needs, plus-ones, and any custom question your client's event actually needs." },
];

function SectionEyebrow({ children }) {
  return (
    <div style={{ display: "inline-block", padding: "8px 24px", borderRadius: "100px", background: "rgba(184, 148, 79, 0.08)", border: "1px solid rgba(184, 148, 79, 0.15)", marginBottom: "24px" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "#B8944F", letterSpacing: "1.5px", textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}

export default function PlannersSolutionsPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ════════════════════ HERO ════════════════════ */}
        <section style={{ background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)", padding: "100px 48px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />
          <div style={{ maxWidth: "760px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <SectionEyebrow>For Professional Event Planners</SectionEyebrow>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 700, color: "#191B1E", lineHeight: 1.15, marginBottom: "24px", letterSpacing: "-1px" }}>
              Every client, its own{" "}<span style={{ color: "#B8944F" }}>beautiful RSVP</span>
            </h1>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "19px", lineHeight: 1.7, color: "#5E5A52", maxWidth: "600px", margin: "0 auto 36px" }}>
              Run every client&apos;s guest list, seating chart, and RSVP tracking from one dashboard — with an invitation design that always looks like theirs, never like a template.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <a href="#talk-to-sales" className="btn-gold" style={{ padding: "15px 36px", fontSize: "15px", fontWeight: 700, borderRadius: "8px" }}>Talk to Us</a>
              <Link href="/templates" className="btn-outline" style={{ padding: "15px 36px", fontSize: "15px", fontWeight: 700, borderRadius: "8px" }}>Browse Templates</Link>
            </div>
          </div>
        </section>

        {/* ════════════════════ PAIN POINTS ════════════════════ */}
        <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "80px 48px 40px" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "36px", fontWeight: 700, color: "#191B1E", marginBottom: "12px" }}>
              The parts of planning that shouldn&apos;t be this hard
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px" }} className="ps-grid-3">
            {PAIN_POINTS.map((p) => (
              <div key={p.title} style={{ background: "#FFFFFF", border: "1px solid #E8E2D6", borderRadius: "16px", padding: "32px 28px" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(184,148,79,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#B8944F", marginBottom: "20px" }}>
                  {p.icon}
                </div>
                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "19px", fontWeight: 600, color: "#191B1E", marginBottom: "10px" }}>{p.title}</h3>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "14.5px", color: "#5E5A52", lineHeight: 1.7, margin: 0 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════ CAPABILITIES ════════════════════ */}
        <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "80px 48px 100px" }}>
          <GoldDivider variant="wide" />
          <div style={{ textAlign: "center", margin: "32px 0 56px" }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "38px", fontWeight: 700, color: "#191B1E", marginBottom: "12px" }}>
              Everything you need per client, per event
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px 40px" }} className="ps-grid-3">
            {CAPABILITIES.map((c) => (
              <div key={c.title} style={{ display: "flex", gap: "14px" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: "3px" }}>
                  <circle cx="10" cy="10" r="10" fill="rgba(184,148,79,0.12)" />
                  <path d="M6 10l3 3 5-5" stroke="#B8944F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <h4 style={{ fontFamily: "var(--font-sans)", fontSize: "15.5px", fontWeight: 700, color: "#191B1E", marginBottom: "6px" }}>{c.title}</h4>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#5E5A52", lineHeight: 1.65, margin: 0 }}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════ CTA BAND ════════════════════ */}
        <section style={{ background: "linear-gradient(135deg, #191B1E 0%, #2A2D32 100%)", padding: "80px 48px", textAlign: "center" }}>
          <div style={{ maxWidth: "620px", margin: "0 auto" }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "34px", fontWeight: 700, color: "#FFFFFF", marginBottom: "16px", lineHeight: 1.25 }}>
              Bring your next client on board
            </h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", color: "rgba(255,255,255,0.6)", marginBottom: "32px", lineHeight: 1.7 }}>
              Create an account and set up your first branded event in minutes — or talk to us first if you&apos;re managing a high volume of events.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/register" className="btn-gold" style={{ padding: "15px 36px", fontSize: "15px", fontWeight: 700, borderRadius: "8px" }}>Get Started</Link>
              <a href="#talk-to-sales" className="btn-ghost-gold">Talk to Us First</a>
            </div>
          </div>
        </section>

        {/* ════════════════════ INQUIRY FORM ════════════════════ */}
        <section id="talk-to-sales" style={{ maxWidth: "1100px", margin: "0 auto", padding: "100px 48px 120px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "56px", alignItems: "center" }} className="ps-form-grid">
            <div>
              <SectionEyebrow>Let&apos;s Talk</SectionEyebrow>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "34px", fontWeight: 700, color: "#191B1E", marginBottom: "16px", lineHeight: 1.25 }}>
                Managing several events a season?
              </h2>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", color: "#5E5A52", lineHeight: 1.75 }}>
                Tell us about your client roster and typical event size — we&apos;ll help you find the right plan, including volume pricing for planners running multiple events at once.
              </p>
            </div>
            <SolutionsInquiryForm
              segment="planners"
              heading="Talk to Our Team"
              description="Tell us about your business and we'll follow up within one business day."
              messagePlaceholder="How many events do you typically run at once, and what kind?"
              accentColor="#B8944F"
            />
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        @media (max-width: 900px) {
          .ps-form-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
        @media (max-width: 860px) {
          .ps-grid-3 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          section { padding-left: 20px !important; padding-right: 20px !important; padding-top: 56px !important; }
          h1 { line-height: 1.2 !important; }
          h2 { font-size: 28px !important; }
        }
        @media (max-width: 480px) {
          .btn-gold, .btn-outline, .btn-ghost-gold { width: 100% !important; }
        }
      `}</style>
    </>
  );
}
