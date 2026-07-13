"use client";
import React from "react";
import Link from "next/link";
import Navbar from "../../components/landing/Navbar";
import FooterSection from "../../components/landing/FooterSection";
import GoldDivider from "../../components/GoldDivider";
import SolutionsInquiryForm from "../../components/landing/SolutionsInquiryForm";

const PAIN_POINTS = [
  {
    title: "Your floor plan, reduced to a napkin sketch",
    desc: "Clients booking your space need a seating tool that actually matches your ballroom's real layout — not a generic grid.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><circle cx="15.5" cy="8.5" r="1.5" />
        <circle cx="8.5" cy="15.5" r="1.5" /><circle cx="15.5" cy="15.5" r="1.5" />
      </svg>
    ),
  },
  {
    title: "Front-of-house arrivals turn chaotic",
    desc: "A busy night with several hundred guests and a paper list at the door slows every arrival to a crawl.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
  },
  {
    title: "Every event you host looks different",
    desc: "Couples and companies booking your venue each bring their own invitations — there's no consistent, premium presentation of your space.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10C21 17 12 23 12 23S3 17 3 10C3 5.03 7.03 1 12 1S21 5.03 21 10Z" /><circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
];

const CAPABILITIES = [
  { title: "Floor plans that match your venue", desc: "Custom shapes, elements, and table layouts on a drag-and-drop canvas — build it once per room, reuse it for every booking." },
  { title: "QR check-in at every entrance", desc: "Guests scan in on arrival with no manual list lookup, so front-of-house keeps pace even at full capacity." },
  { title: "A premium invitation for every booking", desc: "Custom colors, fonts, and cover imagery per event, so each client's invitation reflects your venue's standard of presentation." },
  { title: "Live headcount for your events team", desc: "Real-time accepted / declined / pending counts and dietary breakdowns, so catering and staffing numbers are never a guess." },
  { title: "One dashboard for every booking", desc: "If you host recurring events — weddings every weekend, monthly galas — manage every one from a single organizer account." },
  { title: "Guest data exports for your records", desc: "CSV/Excel exports of guest lists and check-ins whenever your operations team needs them." },
];

function SectionEyebrow({ children }) {
  return (
    <div style={{ display: "inline-block", padding: "8px 24px", borderRadius: "100px", background: "rgba(184, 148, 79, 0.08)", border: "1px solid rgba(184, 148, 79, 0.15)", marginBottom: "24px" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "#B8944F", letterSpacing: "1.5px", textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}

export default function VenuesSolutionsPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ════════════════════ HERO ════════════════════ */}
        <section style={{ background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)", padding: "100px 48px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />
          <div style={{ maxWidth: "760px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <SectionEyebrow>For Venues &amp; Event Spaces</SectionEyebrow>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 700, color: "#191B1E", lineHeight: 1.15, marginBottom: "24px", letterSpacing: "-1px" }}>
              Match the guest experience to{" "}<span style={{ color: "#B8944F" }}>your venue</span>
            </h1>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "19px", lineHeight: 1.7, color: "#5E5A52", maxWidth: "600px", margin: "0 auto 36px" }}>
              Give every booking a seating chart shaped like your actual floor plan, a premium invitation, and fast QR check-in at the door — without your team building it from scratch each time.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <a href="#talk-to-sales" className="btn-gold" style={{ padding: "15px 36px", fontSize: "15px", fontWeight: 700, borderRadius: "8px" }}>Talk to Us</a>
              <Link href="/features" className="btn-outline" style={{ padding: "15px 36px", fontSize: "15px", fontWeight: 700, borderRadius: "8px" }}>See All Features</Link>
            </div>
          </div>
        </section>

        {/* ════════════════════ PAIN POINTS ════════════════════ */}
        <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "80px 48px 40px" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "36px", fontWeight: 700, color: "#191B1E", marginBottom: "12px" }}>
              What generic RSVP tools get wrong for a venue
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px" }} className="vs-grid-3">
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
              Built around how a venue actually operates
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px 40px" }} className="vs-grid-3">
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
              Give every booking your standard of polish
            </h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", color: "rgba(255,255,255,0.6)", marginBottom: "32px", lineHeight: 1.7 }}>
              Set up your first floor plan and see how it looks to an arriving guest — or talk to us if you host recurring, high-volume events.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/register" className="btn-gold" style={{ padding: "15px 36px", fontSize: "15px", fontWeight: 700, borderRadius: "8px" }}>Get Started</Link>
              <a href="#talk-to-sales" className="btn-ghost-gold">Talk to Us First</a>
            </div>
          </div>
        </section>

        {/* ════════════════════ INQUIRY FORM ════════════════════ */}
        <section id="talk-to-sales" style={{ maxWidth: "1100px", margin: "0 auto", padding: "100px 48px 120px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "56px", alignItems: "center" }} className="vs-form-grid">
            <div>
              <SectionEyebrow>Let&apos;s Talk</SectionEyebrow>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "34px", fontWeight: 700, color: "#191B1E", marginBottom: "16px", lineHeight: 1.25 }}>
                Hosting events at your venue regularly?
              </h2>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", color: "#5E5A52", lineHeight: 1.75 }}>
                Tell us about your space and typical event volume — we&apos;ll help you find the right plan, including volume pricing for venues hosting frequent events.
              </p>
            </div>
            <SolutionsInquiryForm
              segment="venues"
              heading="Talk to Our Team"
              description="Tell us about your venue and we'll follow up within one business day."
              messagePlaceholder="What's your typical capacity, and how many events do you host per month?"
              accentColor="#B8944F"
            />
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        @media (max-width: 900px) {
          .vs-form-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
        @media (max-width: 860px) {
          .vs-grid-3 { grid-template-columns: 1fr !important; }
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
