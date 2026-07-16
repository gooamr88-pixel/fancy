"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";

/* ═══════════════════════════════════════════════════════════
   Contact — Fancy RSVP
   Form, info cards, social links, office section
   ═══════════════════════════════════════════════════════════ */

const contactCards = [
  {
    label: "Email Us",
    value: "info@fancyrsvp.com",
    detail: "We'll reply as soon as we can",
    href: "mailto:info@fancyrsvp.com",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 7L13.03 12.7C12.39 13.1 11.61 13.1 10.97 12.7L2 7" />
      </svg>
    ),
  },
  {
    label: "Message Us",
    value: "@viamarketing.ca",
    detail: "DM us on Instagram",
    href: "https://www.instagram.com/viamarketing.ca/",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    label: "Visit Us",
    value: "California",
    detail: "USA",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10C21 17 12 23 12 23S3 17 3 10C3 5.03 7.03 1 12 1S21 5.03 21 10Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    label: "Response Time",
    value: "Within one business day",
    detail: "Monday to Friday",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6V12L16 14" />
      </svg>
    ),
  },
];

const socialLinks = [
  {
    name: "Instagram",
    url: "https://www.instagram.com/viamarketing.ca/",
    icon: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="5" />
      </>
    ),
  },
  {
    name: "Facebook",
    url: "https://www.facebook.com/viamarketing.ca",
    icon: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" />,
  },
];

function ContactInfoCard({ card }) {
  return (
    <div
      className="contact-info-card"
      style={{
        display: "flex",
        gap: "16px",
        padding: "20px",
        borderRadius: "12px",
        cursor: "default",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          background: "#FAF7F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {card.icon}
      </div>
      <div>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#B8944F",
            marginBottom: "4px",
          }}
        >
          {card.label}
        </p>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "15px",
            fontWeight: 600,
            color: "#191B1E",
            marginBottom: "2px",
          }}
        >
          {card.href ? (
            <a
              href={card.href}
              target={card.href.startsWith("http") ? "_blank" : undefined}
              rel={card.href.startsWith("http") ? "noopener noreferrer" : undefined}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {card.value}
            </a>
          ) : (
            card.value
          )}
        </p>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "#5E5A52",
          }}
        >
          {card.detail}
        </p>
      </div>

      <style jsx>{`
        .contact-info-card {
          border: 1px solid #E8E2D6;
          background: #FFFFFF;
          transition: all 0.3s ease;
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }
        .contact-info-card:hover,
        .contact-info-card:focus-within {
          border-color: #D7BE80;
          background: #FFFDF8;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(184, 148, 79, 0.08);
        }
      `}</style>
    </div>
  );
}

function SocialLink({ link }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={link.name}
      className="social-link"
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        className="social-link-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#5E5A52"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {link.icon}
      </svg>

      <style jsx>{`
        .social-link {
          border: 1.5px solid #E8E2D6;
          background: transparent;
          transition: all 0.3s ease;
          transform: translateY(0);
        }
        .social-link:hover,
        .social-link:focus-visible {
          border-color: #B8944F;
          background: rgba(184, 148, 79, 0.08);
          transform: translateY(-2px);
        }
        .social-link-icon {
          transition: stroke 0.3s ease;
        }
        .social-link:hover .social-link-icon,
        .social-link:focus-visible .social-link-icon {
          stroke: #B8944F;
        }
      `}</style>
    </a>
  );
}

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [focusedField, setFocusedField] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
      const res = await fetch(`${apiUrl}/public/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Could not send your message. Please try again.");
      }
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      setSubmitError(err.message || "Could not send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (field) => ({
    width: "100%",
    padding: "14px 18px",
    borderRadius: "10px",
    border: `1.5px solid ${focusedField === field ? "#B8944F" : "#E8E2D6"}`,
    fontFamily: "var(--font-sans)",
    fontSize: "15px",
    color: "#191B1E",
    background: "#FFFFFF",
    outline: "none",
    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
    boxShadow: focusedField === field ? "0 0 0 3px rgba(184,148,79,0.08)" : "none",
    boxSizing: "border-box",
  });

  const labelStyle = {
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    fontWeight: 600,
    color: "#191B1E",
    display: "block",
    marginBottom: "8px",
    letterSpacing: "0.3px",
  };

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ── Hero ── */}
        <section
          style={{
            background: "linear-gradient(180deg, #FAF7F0 0%, #FFFFFF 100%)",
            padding: "80px 24px 64px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: "30px", right: "12%", opacity: 0.05 }}>
            <svg width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#B8944F" /></svg>
          </div>
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
            Contact
          </span>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(2rem, 6vw, 3rem)",
              fontWeight: 700,
              color: "#191B1E",
              marginBottom: "16px",
              lineHeight: 1.15,
            }}
          >
            Get in Touch
          </h1>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              color: "#5E5A52",
              lineHeight: 1.6,
              maxWidth: "540px",
              margin: "0 auto",
            }}
          >
            Have a question or suggestion? We&apos;d love to hear from you.
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

        {/* ── Two-Column Layout ── */}
        <section
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "64px 48px",
          }}
        >
          <div className="contact-grid">
            {/* Left: Form */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "20px",
                border: "1px solid #E8E2D6",
                padding: "44px 40px",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.04)",
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#191B1E",
                  marginBottom: "8px",
                }}
              >
                Send Us a Message
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  color: "#5E5A52",
                  marginBottom: "32px",
                  lineHeight: 1.6,
                }}
              >
                Fill out the form below and our team will get back to you within 24 hours.
              </p>

              {submitted && (
                <div
                  style={{
                    padding: "16px 20px",
                    background: "rgba(184, 148, 79, 0.08)",
                    borderRadius: "10px",
                    border: "1px solid #D7BE80",
                    marginBottom: "24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="10" fill="#B8944F" />
                    <path d="M6 10L9 13L14 7" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#B8944F", fontWeight: 600 }}>
                    Message sent successfully! We&apos;ll be in touch soon.
                  </span>
                </div>
              )}

              {submitError && (
                <div
                  style={{
                    padding: "16px 20px",
                    background: "rgba(196, 94, 94, 0.06)",
                    borderRadius: "10px",
                    border: "1px solid rgba(196, 94, 94, 0.35)",
                    marginBottom: "24px",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#C45E5E", fontWeight: 600 }}>
                    {submitError}
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-row" style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle} htmlFor="contact-name">Full Name</label>
                    <input
                      id="contact-name"
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={formData.name}
                      onChange={handleChange}
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Your full name"
                      required
                      style={inputStyle("name")}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle} htmlFor="contact-email">Email Address</label>
                    <input
                      id="contact-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="you@example.com"
                      required
                      style={inputStyle("email")}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle} htmlFor="contact-subject">Subject</label>
                  <select
                    id="contact-subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("subject")}
                    onBlur={() => setFocusedField(null)}
                    required
                    style={{
                      ...inputStyle("subject"),
                      appearance: "none",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%235E5A52' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 16px center",
                      paddingRight: "44px",
                      cursor: "pointer",
                      color: formData.subject ? "#191B1E" : "#9E9A92",
                    }}
                  >
                    <option value="" disabled>
                      Select a subject
                    </option>
                    <option value="general">General Inquiry</option>
                    <option value="support">Technical Support</option>
                    <option value="billing">Billing Question</option>
                    <option value="partnership">Partnership Opportunity</option>
                    <option value="feedback">Feedback & Suggestions</option>
                    <option value="enterprise">Enterprise Plans</option>
                  </select>
                </div>

                <div style={{ marginBottom: "28px" }}>
                  <label style={labelStyle} htmlFor="contact-message">Message</label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("message")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Tell us how we can help..."
                    required
                    rows="5"
                    style={{
                      ...inputStyle("message"),
                      resize: "vertical",
                      minHeight: "130px",
                      lineHeight: "1.6",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-gold"
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "16px",
                    fontSize: "15px",
                    fontWeight: 700,
                    borderRadius: "10px",
                    letterSpacing: "0.3px",
                    opacity: submitting ? 0.7 : 1,
                    cursor: submitting ? "default" : "pointer",
                  }}
                >
                  {submitted ? "✓ Sent!" : submitting ? "Sending…" : "Send Message"}
                </button>
              </form>
            </div>

            {/* Right: Info Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {contactCards.map((card) => (
                <ContactInfoCard key={card.label} card={card} />
              ))}

              {/* Social Links */}
              <div
                style={{
                  padding: "28px 20px",
                  borderRadius: "12px",
                  border: "1px solid #E8E2D6",
                  background: "#FFFFFF",
                  marginTop: "8px",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "#B8944F",
                    marginBottom: "16px",
                  }}
                >
                  Follow Us
                </p>
                <div style={{ display: "flex", gap: "12px" }}>
                  {socialLinks.map((link) => (
                    <SocialLink key={link.name} link={link} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Help Center CTA ── */}
        <section
          style={{
            padding: "80px 24px",
            textAlign: "center",
            background: "linear-gradient(180deg, #FFFFFF 0%, #FAF7F0 100%)",
          }}
        >
          <div style={{ maxWidth: "580px", margin: "0 auto" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="14" cy="14" r="11" />
                <path d="M10.5 10.5C10.5 8.567 12.067 7 14 7S17.5 8.567 17.5 10.5C17.5 12.5 14 13.5 14 15.5" />
                <circle cx="14" cy="19" r="0.5" fill="#FFFFFF" />
              </svg>
            </div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "30px",
                fontWeight: 700,
                color: "#191B1E",
                marginBottom: "12px",
              }}
            >
              Looking for Quick Answers?
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                color: "#5E5A52",
                lineHeight: 1.7,
                marginBottom: "32px",
              }}
            >
              Browse our comprehensive Help Center for guides, tutorials, and answers to frequently asked questions.
            </p>
            <Link
              href="/help"
              className="btn-outline"
              style={{
                padding: "14px 36px",
                fontSize: "15px",
                fontWeight: 600,
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              Visit Help Center →
            </Link>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        .contact-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 36px;
          align-items: start;
        }
        .form-row {
          display: flex;
          gap: 20px;
        }
        input::placeholder,
        textarea::placeholder {
          color: #9E9A92;
        }
        select {
          color: #191B1E;
        }
        @media (max-width: 1024px) {
          .contact-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 768px) {
          .contact-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .form-row {
            flex-direction: column !important;
            gap: 20px !important;
          }
        }
      `}</style>
    </>
  );
}
