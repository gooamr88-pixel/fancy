"use client";
import React from "react";
import Link from "next/link";
import Navbar from "../../components/landing/Navbar";
import FooterSection from "../../components/landing/FooterSection";
import GoldDivider from "../../components/GoldDivider";
import SolutionsInquiryForm from "../../components/landing/SolutionsInquiryForm";
import { usePublicPricing, tierGuestLine } from "../../utils/usePublicPricing";
import { useTestimonials } from "../../utils/useTestimonials";

const PAIN_POINTS = [
  {
    title: "Hundreds of guests, one spreadsheet",
    desc: "Company galas, conferences, and employee events regularly outgrow whatever guest list tool you started with.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "No visibility for stakeholders",
    desc: "Leadership wants a live headcount and dietary breakdown before the event — not a status update the morning after.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M18.7 8l-5.1 5.1-2.8-2.8L7 14" />
      </svg>
    ),
  },
  {
    title: "Slow, chaotic check-in at the door",
    desc: "A printed list and a clipboard doesn't scale past a few dozen arrivals — and it's the first impression of your event.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

const CAPABILITIES = [
  { title: "Unlimited-scale guest lists", desc: "CSV/Excel bulk import, dedup on email or phone, and pagination built for lists in the thousands, not the dozens." },
  { title: "Real-time attendance dashboard", desc: "Live accepted / declined / pending counts, meal and dietary breakdowns, and check-in progress — shareable with anyone who needs the number." },
  { title: "QR check-in at the door", desc: "Every confirmed guest gets a scannable entry pass; front-desk staff scan and go, no manual list lookup." },
  { title: "Seating & table management", desc: "Drag-and-drop floor plans with capacity validation, built for ballroom-scale events." },
  { title: "SMS reminders at volume", desc: "Bulk campaigns with delivery tracking, so a change in venue or timing reaches every invitee, not just the ones who check email." },
  { title: "Bulk export for reporting", desc: "Full guest, RSVP, and check-in data exports to CSV or Excel whenever your team needs it for finance or leadership reporting." },
];

const TRUST_POINTS = [
  { label: "Role-based access control", desc: "Give your team the exact level of dashboard access they need — organizer, admin, or view-only." },
  { label: "Full activity audit trail", desc: "Every guest edit, seating change, and check-in is logged with who did it and when." },
  { label: "Encrypted in transit", desc: "All traffic between your team, your guests, and our servers runs over HTTPS." },
];

function SectionEyebrow({ children }) {
  return (
    <div style={{ display: "inline-block", padding: "8px 24px", borderRadius: "100px", background: "rgba(184, 148, 79, 0.08)", border: "1px solid rgba(184, 148, 79, 0.15)", marginBottom: "24px" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "#B8944F", letterSpacing: "1.5px", textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}

export default function CorporateSolutionsPage() {
  const { tiers } = usePublicPricing();
  const enterpriseTier = (tiers || []).find((t) => t.is_custom) || null;
  // Real, admin-managed testimonials only (see /admin/cms) — spotlight
  // whichever real review is first in display order; render nothing if none
  // have been published yet, rather than show a fabricated placeholder.
  const { testimonials } = useTestimonials();
  const spotlight = testimonials && testimonials.length > 0 ? testimonials[0] : null;

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ════════════════════ HERO ════════════════════ */}
        <section style={{ background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)", padding: "100px 48px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />
          <div style={{ maxWidth: "760px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <SectionEyebrow>For Corporate &amp; Enterprise Teams</SectionEyebrow>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 700, color: "#191B1E", lineHeight: 1.15, marginBottom: "24px", letterSpacing: "-1px" }}>
              Company events, run{" "}<span style={{ color: "#B8944F" }}>like a company runs</span>
            </h1>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "19px", lineHeight: 1.7, color: "#5E5A52", maxWidth: "600px", margin: "0 auto 36px" }}>
              From an all-hands gala to a multi-day conference, Fancy RSVP gives your team a single dashboard for guest lists, RSVPs, seating, and check-in — at whatever scale your event actually is.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <a href="#talk-to-sales" className="btn-gold" style={{ padding: "15px 36px", fontSize: "15px", fontWeight: 700, borderRadius: "8px" }}>Talk to Sales</a>
              <Link href="/pricing" className="btn-outline" style={{ padding: "15px 36px", fontSize: "15px", fontWeight: 700, borderRadius: "8px" }}>See Pricing</Link>
            </div>
          </div>
        </section>

        {/* ════════════════════ PAIN POINTS ════════════════════ */}
        <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "80px 48px 40px" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "36px", fontWeight: 700, color: "#191B1E", marginBottom: "12px" }}>
              Familiar problems at company-event scale
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px" }} className="cs-grid-3">
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

        {/* ════════════════════ REAL TESTIMONIAL (admin-managed) ════════════════════ */}
        {spotlight && (
          <section style={{ background: "#191B1E", padding: "80px 48px" }}>
            <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "center" }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: "64px", color: "rgba(184,148,79,0.35)", lineHeight: 1, display: "block", marginBottom: "8px" }}>&ldquo;</span>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(20px, 3vw, 28px)", fontStyle: "italic", color: "#FFFFFF", lineHeight: 1.5, marginBottom: "28px" }}>
                {spotlight.quote}
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px" }}>
                {spotlight.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={spotlight.photo_url} alt={spotlight.name} style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "linear-gradient(135deg, #B8944F, #D7BE80)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontFamily: "var(--font-sans)", fontSize: "15px", fontWeight: 700 }}>
                    {spotlight.initials || spotlight.name?.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </div>
                )}
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{spotlight.name}</div>
                  {spotlight.role && <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "rgba(255,255,255,0.55)" }}>{spotlight.role}</div>}
                </div>
              </div>
              {spotlight.verify_url && (
                <a href={spotlight.verify_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: "16px", fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, color: "#D7BE80", textDecoration: "none" }}>
                  Verified Review ↗
                </a>
              )}
            </div>
          </section>
        )}

        {/* ════════════════════ CAPABILITIES ════════════════════ */}
        <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "100px 48px" }}>
          <GoldDivider variant="wide" />
          <div style={{ textAlign: "center", margin: "32px 0 56px" }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "38px", fontWeight: 700, color: "#191B1E", marginBottom: "12px" }}>
              Built for the scale of a company event
            </h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px", color: "#5E5A52", maxWidth: "560px", margin: "0 auto", lineHeight: 1.7 }}>
              Every feature below is available today — no separate enterprise build required.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px 40px" }} className="cs-grid-3">
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

        {/* ════════════════════ TRUST / SECURITY ════════════════════ */}
        <section style={{ background: "#F8F4EC", padding: "80px 48px" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "34px", fontWeight: 700, color: "#191B1E", marginBottom: "12px" }}>
                Your guest data, handled properly
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "28px" }} className="cs-grid-3">
              {TRUST_POINTS.map((t) => (
                <div key={t.label} style={{ background: "#FFFFFF", border: "1px solid #E8E2D6", borderRadius: "14px", padding: "26px 24px" }}>
                  <h4 style={{ fontFamily: "var(--font-sans)", fontSize: "14.5px", fontWeight: 700, color: "#191B1E", marginBottom: "8px" }}>{t.label}</h4>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "13.5px", color: "#5E5A52", lineHeight: 1.65, margin: 0 }}>{t.desc}</p>
                </div>
              ))}
            </div>
            <p style={{ textAlign: "center", fontFamily: "var(--font-sans)", fontSize: "13px", color: "#77736A", marginTop: "28px" }}>
              Read our full <Link href="/privacy" style={{ color: "#B8944F", fontWeight: 600 }}>Privacy Policy</Link> for how guest data is collected, stored, and protected.
            </p>
          </div>
        </section>

        {/* ════════════════════ ENTERPRISE TIER (live) ════════════════════ */}
        {enterpriseTier && (
          <section style={{ maxWidth: "800px", margin: "0 auto", padding: "100px 48px 40px", textAlign: "center" }}>
            <SectionEyebrow>Enterprise Plan</SectionEyebrow>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "32px", fontWeight: 700, color: "#191B1E", marginBottom: "16px" }}>
              {enterpriseTier.name}
            </h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", color: "#5E5A52", marginBottom: "28px", lineHeight: 1.7 }}>
              {enterpriseTier.description || "Custom-priced for large-scale corporate events, with volume guest counts and dedicated onboarding."}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 auto 32px", maxWidth: "480px", textAlign: "left" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", fontFamily: "var(--font-sans)", fontSize: "14.5px", color: "#191B1E" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="rgba(184,148,79,0.1)" /><path d="M5 8l2 2 4-4" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {tierGuestLine(enterpriseTier)}
              </li>
              {(enterpriseTier.features || []).map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", fontFamily: "var(--font-sans)", fontSize: "14.5px", color: "#191B1E" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="rgba(184,148,79,0.1)" /><path d="M5 8l2 2 4-4" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {f}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ════════════════════ INQUIRY FORM ════════════════════ */}
        <section id="talk-to-sales" style={{ maxWidth: "1100px", margin: "0 auto", padding: "60px 48px 120px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "56px", alignItems: "center" }} className="cs-form-grid">
            <div>
              <SectionEyebrow>Get Started</SectionEyebrow>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "34px", fontWeight: 700, color: "#191B1E", marginBottom: "16px", lineHeight: 1.25 }}>
                Let&apos;s plan your next company event
              </h2>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", color: "#5E5A52", lineHeight: 1.75 }}>
                Tell us the size and shape of your event — a leadership offsite, an all-hands, a client gala — and we&apos;ll help you find the right plan, including custom Enterprise pricing for high guest counts.
              </p>
            </div>
            <SolutionsInquiryForm
              segment="corporate"
              heading="Talk to Sales"
              description="For enterprise or high-volume events, we'll follow up with custom pricing."
              messagePlaceholder="Tell us about your event — type, date, expected attendance..."
              accentColor="#B8944F"
            />
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        @media (max-width: 900px) {
          .cs-form-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
        @media (max-width: 860px) {
          .cs-grid-3 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          section { padding-left: 20px !important; padding-right: 20px !important; padding-top: 56px !important; }
          h1 { line-height: 1.2 !important; }
          h2 { font-size: 28px !important; }
        }
        @media (max-width: 480px) {
          .btn-gold, .btn-outline { width: 100% !important; }
        }
      `}</style>
    </>
  );
}
