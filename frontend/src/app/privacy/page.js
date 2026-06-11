"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";

/* ═══════════════════════════════════════════════════════════
   Privacy Policy — Fancy RSVP
   Clean layout, TOC sidebar, 10 legal sections
   ═══════════════════════════════════════════════════════════ */

const sections = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: [
      "We collect information you provide directly when you create an account, set up events, or communicate with us. This includes:",
      "**Personal Identification Information:** Your name, email address, phone number, and billing address when you register for an account or subscribe to a paid plan.",
      "**Event Data:** Event details you create, including event names, dates, venues, guest lists, RSVP responses, seating arrangements, and any custom fields you configure.",
      "**Guest Information:** Names, email addresses, phone numbers, dietary preferences, and RSVP responses of guests you add to your events. You are responsible for obtaining appropriate consent from your guests before adding their information.",
      "**Payment Information:** When you subscribe to a paid plan, our payment processor (Stripe) collects and processes your payment card details. We do not store full credit card numbers on our servers.",
      "**Usage Data:** We automatically collect information about how you interact with our platform, including pages visited, features used, click patterns, session duration, and referring URLs.",
      "**Device Information:** Browser type and version, operating system, device identifiers, IP address, and screen resolution to ensure optimal performance and security.",
    ],
  },
  {
    id: "how-we-use-information",
    title: "2. How We Use Your Information",
    content: [
      "We use the information we collect to provide, maintain, and improve our services. Specifically, we use your data for the following purposes:",
      "**Service Delivery:** To create and manage your account, process your events, send RSVPs and reminders to your guests, and provide the features you've subscribed to.",
      "**Communication:** To send you service-related notices, including account verification, billing reminders, security alerts, and support responses. With your consent, we may also send marketing communications about new features and promotions.",
      "**Analytics & Improvement:** To understand how users interact with our platform, identify trends, diagnose technical issues, and develop new features that better serve our community.",
      "**Personalization:** To customize your experience, recommend templates, and tailor content to your event planning needs and preferences.",
      "**Security & Fraud Prevention:** To protect against unauthorized access, detect suspicious activity, and ensure the integrity of our platform and your data.",
      "**Legal Compliance:** To comply with applicable laws, regulations, legal processes, or governmental requests.",
    ],
  },
  {
    id: "data-sharing",
    title: "3. Data Sharing and Disclosure",
    content: [
      "We do not sell, rent, or trade your personal information to third parties for their marketing purposes. We may share your information in the following limited circumstances:",
      "**Service Providers:** We work with trusted third-party companies that perform services on our behalf, including cloud hosting (AWS), email delivery (SendGrid), payment processing (Stripe), and analytics (Mixpanel). These providers are contractually bound to protect your data and use it only as directed.",
      "**With Your Consent:** We may share your information when you explicitly authorize us to do so, such as when you choose to integrate with third-party applications or share event details publicly.",
      "**Event Guests:** When guests RSVP to your event, they can see the event details you've published. Hosts can see guest responses and contact information as part of their event management.",
      "**Legal Requirements:** We may disclose your information if required by law, subpoena, court order, or other legal process, or if we believe in good faith that disclosure is necessary to protect our rights, your safety, or the safety of others.",
      "**Business Transfers:** In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction. We will notify you of any such change and any choices you may have regarding your information.",
    ],
  },
  {
    id: "data-security",
    title: "4. Data Security",
    content: [
      "We take the security of your data seriously and implement industry-standard measures to protect it:",
      "**Encryption:** All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. Sensitive fields such as payment tokens receive additional encryption layers.",
      "**Access Controls:** We enforce strict role-based access controls, multi-factor authentication for administrative access, and regular access reviews to ensure only authorized personnel can access your data.",
      "**Infrastructure:** Our application is hosted on secure, SOC 2 Type II compliant infrastructure with redundant backups, automated failover, and continuous monitoring for threats.",
      "**Vulnerability Management:** We conduct regular penetration testing, automated vulnerability scanning, and participate in responsible disclosure programs. Security patches are applied promptly.",
      "**Incident Response:** We maintain a comprehensive incident response plan. In the event of a data breach that affects your personal information, we will notify you and relevant authorities within the timeframes required by applicable law.",
      "While we strive to protect your information, no method of electronic storage or transmission is 100% secure. We encourage you to use strong, unique passwords and enable two-factor authentication on your account.",
    ],
  },
  {
    id: "cookies",
    title: "5. Cookies and Tracking",
    content: [
      "We use cookies and similar tracking technologies to enhance your experience and gather analytics:",
      "**Essential Cookies:** Required for the platform to function properly, including authentication tokens, session management, and security features. These cannot be disabled.",
      "**Analytics Cookies:** Help us understand how you use our platform, which pages are most popular, and where users encounter issues. We use Mixpanel and Google Analytics for this purpose.",
      "**Preference Cookies:** Remember your settings, language preferences, and customizations so you don't have to reconfigure them each visit.",
      "**Marketing Cookies:** Used to track the effectiveness of our advertising campaigns and deliver relevant content. These are only placed with your explicit consent.",
      "You can manage cookie preferences through your browser settings or our cookie consent banner. Disabling certain cookies may impact your experience on our platform. We honor Do Not Track (DNT) signals sent by your browser.",
    ],
  },
  {
    id: "your-rights",
    title: "6. Your Rights (GDPR / CCPA)",
    content: [
      "Depending on your location, you may have the following rights regarding your personal data:",
      "**Right to Access:** You can request a copy of the personal data we hold about you. We will provide this in a commonly used, machine-readable format within 30 days.",
      "**Right to Rectification:** You can update or correct inaccurate personal data directly through your account settings, or by contacting our support team.",
      "**Right to Deletion:** You can request the deletion of your personal data. We will comply unless we are required to retain it for legal or legitimate business purposes.",
      "**Right to Data Portability:** You can export your event data, guest lists, and account information in standard formats (CSV, JSON) at any time from your dashboard.",
      "**Right to Object:** You can object to the processing of your data for direct marketing purposes. You can also object to processing based on legitimate interests, subject to our evaluation.",
      "**Right to Restrict Processing:** You can request that we limit how we use your data while we address a concern you've raised about its accuracy or our processing activities.",
      "**CCPA Specific Rights (California Residents):** You have the right to know what personal information is collected, disclosed, or sold; the right to delete personal information; the right to opt-out of the sale of personal information (we do not sell your data); and the right to non-discrimination for exercising your rights.",
      "To exercise any of these rights, email us at privacy@fancyrsvp.com or use the privacy controls in your account settings. We will respond within the legally required timeframe.",
    ],
  },
  {
    id: "data-retention",
    title: "7. Data Retention",
    content: [
      "We retain your personal data only for as long as necessary to fulfill the purposes described in this policy:",
      "**Active Accounts:** Your account data and event information are retained for the duration of your account's active status, plus a 30-day grace period after account closure.",
      "**Closed Accounts:** Upon account deletion, we permanently erase your personal data within 90 days, except where retention is required by law (e.g., financial records for tax compliance, which are retained for 7 years).",
      "**Guest Data:** Guest information associated with your events is deleted when you delete the event or close your account. Guests can also request their data be removed independently.",
      "**Backup Systems:** Data may persist in encrypted backup systems for up to 30 additional days after deletion from primary systems, after which it is permanently purged.",
      "**Anonymized Data:** We may retain anonymized, aggregated data indefinitely for analytics and platform improvement purposes. This data cannot be used to identify any individual.",
    ],
  },
  {
    id: "childrens-privacy",
    title: "8. Children's Privacy",
    content: [
      "Fancy RSVP is not intended for use by children under the age of 16. We do not knowingly collect personal information from children under 16 years of age.",
      "If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately at privacy@fancyrsvp.com. We will take prompt steps to delete such information from our systems.",
      "In cases where a minor's information is included as a guest in an event (e.g., children attending a wedding), the event organizer is responsible for obtaining appropriate parental consent before adding that information to our platform.",
    ],
  },
  {
    id: "changes",
    title: "9. Changes to This Policy",
    content: [
      "We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make changes:",
      "**Notification:** We will notify you of material changes via email and/or a prominent notice on our platform at least 14 days before the changes take effect.",
      "**Review Period:** You will have the opportunity to review the updated policy before it becomes effective. If you disagree with the changes, you may close your account before the effective date.",
      "**Version History:** We maintain a version history of this policy. Previous versions are available upon request by contacting our privacy team.",
      "Your continued use of our platform after the effective date of any changes constitutes your acceptance of the updated Privacy Policy.",
    ],
  },
  {
    id: "contact-us",
    title: "10. Contact Us",
    content: [
      "If you have any questions, concerns, or requests related to this Privacy Policy or our data practices, please contact us through any of the following channels:",
      "**Email:** privacy@fancyrsvp.com",
      "**Mail:** Fancy RSVP, Attn: Privacy Team, 350 Fifth Avenue, Suite 4800, New York, NY 10118, United States",
      "**Data Protection Officer:** For GDPR-related inquiries, contact our DPO at dpo@fancyrsvp.com",
      "We are committed to resolving any complaints about your privacy. If you feel we have not adequately addressed your concerns, you have the right to lodge a complaint with your local data protection supervisory authority.",
    ],
  },
];

function TOCLink({ section, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        background: "none",
        border: "none",
        textAlign: "left",
        padding: "8px 16px",
        fontFamily: "var(--font-sans)",
        fontSize: "13.5px",
        color: isActive ? "#B8944F" : "#5E5A52",
        fontWeight: isActive ? 600 : 400,
        cursor: "pointer",
        borderLeft: `2px solid ${isActive ? "#B8944F" : "transparent"}`,
        transition: "all 0.25s ease",
        lineHeight: 1.5,
        width: "100%",
      }}
    >
      {section.title}
    </button>
  );
}

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState(sections[0].id);

  useEffect(() => {
    const handleScroll = () => {
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 160 && rect.bottom > 160) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.offsetTop - 120;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const renderText = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} style={{ color: "#191B1E", fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ── Hero ── */}
        <section
          style={{
            background: "linear-gradient(180deg, #FAF7F0 0%, #FFFFFF 100%)",
            padding: "72px 24px 56px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#B8944F",
              display: "block",
              marginBottom: "16px",
            }}
          >
            Legal
          </span>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "44px",
              fontWeight: 700,
              color: "#191B1E",
              marginBottom: "16px",
              lineHeight: 1.2,
            }}
          >
            Privacy Policy
          </h1>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              color: "#5E5A52",
              lineHeight: 1.6,
              maxWidth: "520px",
              margin: "0 auto 20px",
            }}
          >
            Your privacy is important to us. This policy explains how Fancy RSVP collects, uses, and protects your personal information.
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              color: "#B8944F",
              fontWeight: 600,
            }}
          >
            Last Updated: June 1, 2026
          </p>
        </section>

        {/* ── Gold Divider ── */}
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "0 48px",
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, #E8E2D6)" }} />
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L12 8L18 10L12 12L10 18L8 12L2 10L8 8L10 2Z" fill="#D7BE80" />
          </svg>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, #E8E2D6, transparent)" }} />
        </div>

        {/* ── Content Area with Sidebar ── */}
        <section
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "56px 48px 80px",
          }}
        >
          <div className="privacy-layout">
            {/* Sidebar TOC */}
            <aside className="privacy-sidebar">
              <div
                style={{
                  position: "sticky",
                  top: "120px",
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  border: "1px solid #E8E2D6",
                  padding: "28px 8px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: "#B8944F",
                    padding: "0 16px",
                    marginBottom: "16px",
                  }}
                >
                  Table of Contents
                </p>
                {sections.map((section) => (
                  <TOCLink
                    key={section.id}
                    section={section}
                    isActive={activeSection === section.id}
                    onClick={() => scrollToSection(section.id)}
                  />
                ))}
              </div>
            </aside>

            {/* Main Content */}
            <div className="privacy-content">
              {sections.map((section, idx) => (
                <div
                  key={section.id}
                  id={section.id}
                  style={{
                    marginBottom: idx < sections.length - 1 ? "48px" : "0",
                    paddingBottom: idx < sections.length - 1 ? "48px" : "0",
                    borderBottom: idx < sections.length - 1 ? "1px solid #E8E2D6" : "none",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "24px",
                      fontWeight: 700,
                      color: "#191B1E",
                      marginBottom: "20px",
                      paddingLeft: "16px",
                      borderLeft: "3px solid #B8944F",
                    }}
                  >
                    {section.title}
                  </h2>
                  {section.content.map((para, i) => (
                    <p
                      key={i}
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "15px",
                        color: "#5E5A52",
                        lineHeight: 1.8,
                        marginBottom: i < section.content.length - 1 ? "14px" : "0",
                      }}
                    >
                      {renderText(para)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Related Links ── */}
        <section
          style={{
            background: "#FAF7F0",
            padding: "64px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "24px",
                fontWeight: 700,
                color: "#191B1E",
                marginBottom: "16px",
              }}
            >
              Related Documents
            </h3>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                color: "#5E5A52",
                lineHeight: 1.6,
                marginBottom: "28px",
              }}
            >
              Please also review our Terms of Service which govern your use of the Fancy RSVP platform.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/terms"
                className="btn-outline"
                style={{
                  padding: "12px 32px",
                  fontSize: "14px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  textDecoration: "none",
                }}
              >
                Terms of Service
              </Link>
              <Link
                href="/contact"
                className="btn-gold"
                style={{
                  padding: "12px 32px",
                  fontSize: "14px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  textDecoration: "none",
                }}
              >
                Contact Privacy Team
              </Link>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        .privacy-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 48px;
          align-items: start;
        }
        .privacy-sidebar {
          display: block;
        }
        .privacy-content {
          min-width: 0;
        }
        @media (max-width: 1024px) {
          .privacy-layout {
            grid-template-columns: 220px 1fr !important;
            gap: 32px !important;
          }
        }
        @media (max-width: 768px) {
          .privacy-layout {
            grid-template-columns: 1fr !important;
          }
          .privacy-sidebar {
            display: none !important;
          }
        }
        @media (max-width: 640px) {
          .privacy-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
