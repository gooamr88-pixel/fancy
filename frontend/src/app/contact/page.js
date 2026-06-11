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
    value: "support@fancyrsvp.com",
    detail: "We reply within 2 hours",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 7L13.03 12.7C12.39 13.1 11.61 13.1 10.97 12.7L2 7" />
      </svg>
    ),
  },
  {
    label: "Call Us",
    value: "+1 (888) 274-RSVP",
    detail: "Mon – Fri, 9am – 6pm ET",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92V19.92C22 20.48 21.56 20.93 21 20.97C20.17 21.03 19.33 21 18.5 20.88C15.61 20.37 12.89 19.12 10.59 17.27L10.24 16.97C8.15 15.22 6.47 13.09 5.27 10.69L5.13 10.42C4.39 8.82 3.92 7.1 3.78 5.33C3.74 4.77 4.19 4.3 4.75 4.26L7.77 4.03C8.21 4 8.62 4.29 8.74 4.71L9.53 7.44C9.64 7.82 9.5 8.23 9.18 8.45L7.88 9.32C9.09 11.87 11.16 13.93 13.71 15.14L14.58 13.84C14.8 13.52 15.21 13.38 15.59 13.49L18.32 14.28C18.74 14.4 19.03 14.81 19 15.25" />
      </svg>
    ),
  },
  {
    label: "Visit Us",
    value: "350 Fifth Avenue, Suite 4800",
    detail: "New York, NY 10118",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10C21 17 12 23 12 23S3 17 3 10C3 5.03 7.03 1 12 1S21 5.03 21 10Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    label: "Business Hours",
    value: "Monday – Friday",
    detail: "9:00 AM – 6:00 PM ET",
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
    name: "Twitter",
    icon: <path d="M22 4s-1.3.8-3 1.2A4.8 4.8 0 0 0 12 8v1A10.5 10.5 0 0 1 3 4s-4 9 5 13a11.6 11.6 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.1-.9A7.7 7.7 0 0 0 22 4Z" />,
  },
  {
    name: "Instagram",
    icon: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="5" />
      </>
    ),
  },
  {
    name: "LinkedIn",
    icon: (
      <>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </>
    ),
  },
  {
    name: "Facebook",
    icon: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" />,
  },
];

function ContactInfoCard({ card }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        padding: "20px",
        borderRadius: "12px",
        border: `1px solid ${hovered ? "#D7BE80" : "#E8E2D6"}`,
        background: hovered ? "#FFFDF8" : "#FFFFFF",
        transition: "all 0.3s ease",
        cursor: "default",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(184,148,79,0.08)" : "0 2px 8px rgba(0,0,0,0.03)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
          {card.value}
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
    </div>
  );
}

function SocialLink({ link }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href="#"
      aria-label={link.name}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        border: `1.5px solid ${hovered ? "#B8944F" : "#E8E2D6"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s ease",
        background: hovered ? "rgba(184, 148, 79, 0.08)" : "transparent",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={hovered ? "#B8944F" : "#5E5A52"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "stroke 0.3s ease" }}
      >
        {link.icon}
      </svg>
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
  const [focusedField, setFocusedField] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
    setFormData({ name: "", email: "", subject: "", message: "" });
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
              fontSize: "48px",
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
            Have a question, suggestion, or just want to say hello? We'd love to hear from you.
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
                    Message sent successfully! We'll be in touch soon.
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-row" style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Full Name</label>
                    <input
                      type="text"
                      name="name"
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
                    <label style={labelStyle}>Email Address</label>
                    <input
                      type="email"
                      name="email"
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
                  <label style={labelStyle}>Subject</label>
                  <select
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
                  <label style={labelStyle}>Message</label>
                  <textarea
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
                  style={{
                    width: "100%",
                    padding: "16px",
                    fontSize: "15px",
                    fontWeight: 700,
                    borderRadius: "10px",
                    letterSpacing: "0.3px",
                  }}
                >
                  {submitted ? "✓ Sent!" : "Send Message"}
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

        {/* ── Office / Map Section ── */}
        <section
          style={{
            background: "#FAF7F0",
            padding: "80px 24px",
          }}
        >
          <div
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
              padding: "0 24px",
            }}
          >
            <div className="office-grid">
              {/* Map Placeholder */}
              <div
                style={{
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid #E8E2D6",
                  background: "#FFFFFF",
                  minHeight: "320px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(135deg, #F8F4EC 0%, #EDEAE3 100%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "16px",
                  }}
                >
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <circle cx="28" cy="24" r="18" stroke="#D7BE80" strokeWidth="1" fill="none" />
                    <circle cx="28" cy="24" r="8" stroke="#B8944F" strokeWidth="1.5" fill="none" />
                    <circle cx="28" cy="24" r="2" fill="#B8944F" />
                    <path d="M28 42L28 50" stroke="#D7BE80" strokeWidth="1" />
                    <circle cx="28" cy="52" r="2" fill="#D7BE80" />
                  </svg>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 600, color: "#191B1E", marginBottom: "4px" }}>
                      Our Headquarters
                    </p>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#5E5A52" }}>
                      350 Fifth Avenue, New York
                    </p>
                  </div>
                </div>
              </div>

              {/* Office Info */}
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    color: "#B8944F",
                    display: "block",
                    marginBottom: "16px",
                  }}
                >
                  Our Office
                </span>
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "30px",
                    fontWeight: 700,
                    color: "#191B1E",
                    marginBottom: "16px",
                    lineHeight: 1.25,
                  }}
                >
                  Come Say Hello
                </h2>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "16px",
                    color: "#5E5A52",
                    lineHeight: 1.7,
                    marginBottom: "28px",
                  }}
                >
                  We'd love to meet you in person! Our doors are always open for a coffee and a chat about how Fancy RSVP can elevate your next event. Schedule a visit or just drop by during business hours.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {[
                    { label: "Address", value: "350 Fifth Avenue, Suite 4800, New York, NY 10118" },
                    { label: "Phone", value: "+1 (888) 274-RSVP" },
                    { label: "Hours", value: "Monday – Friday, 9:00 AM – 6:00 PM ET" },
                  ].map((item) => (
                    <div key={item.label} style={{ display: "flex", gap: "12px" }}>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700, color: "#B8944F", minWidth: "70px" }}>
                        {item.label}
                      </span>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#191B1E" }}>
                        {item.value}
                      </span>
                    </div>
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
        .office-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
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
          .office-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
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
