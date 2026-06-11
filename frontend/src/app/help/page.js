"use client";
import React, { useState, useRef } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";

/* ═══════════════════════════════════════════════════════════
   Help Center — Fancy RSVP
   Search, category grid, FAQ accordion, contact CTA
   ═══════════════════════════════════════════════════════════ */

const categories = [
  {
    title: "Getting Started",
    count: 12,
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4L28 10V22L16 28L4 22V10L16 4Z" />
        <path d="M16 16L28 10" />
        <path d="M16 16V28" />
        <path d="M16 16L4 10" />
      </svg>
    ),
    desc: "Set up your account, create your first event, and customize your RSVP pages.",
  },
  {
    title: "RSVP Management",
    count: 18,
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="6" width="24" height="20" rx="2" />
        <path d="M4 12H28" />
        <path d="M12 12V26" />
        <path d="M8 16H10" />
        <path d="M8 20H10" />
        <path d="M16 16H20" />
        <path d="M16 20H24" />
      </svg>
    ),
    desc: "Track responses, send reminders, and manage your invitation workflows.",
  },
  {
    title: "Guest Lists",
    count: 14,
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="10" r="4" />
        <path d="M4 26C4 21.5817 7.58172 18 12 18" />
        <circle cx="22" cy="12" r="3" />
        <path d="M28 26C28 22.6863 25.3137 20 22 20C20.5 20 19.1 20.5 18 21.3" />
      </svg>
    ),
    desc: "Import, organize, and segment your guest lists for any occasion.",
  },
  {
    title: "Seating Charts",
    count: 9,
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="16" r="10" />
        <circle cx="16" cy="16" r="4" />
        <circle cx="16" cy="6" r="1.5" fill="#D7BE80" stroke="none" />
        <circle cx="24" cy="12" r="1.5" fill="#D7BE80" stroke="none" />
        <circle cx="24" cy="20" r="1.5" fill="#D7BE80" stroke="none" />
        <circle cx="16" cy="26" r="1.5" fill="#D7BE80" stroke="none" />
        <circle cx="8" cy="20" r="1.5" fill="#D7BE80" stroke="none" />
        <circle cx="8" cy="12" r="1.5" fill="#D7BE80" stroke="none" />
      </svg>
    ),
    desc: "Design interactive seating arrangements with drag-and-drop tools.",
  },
  {
    title: "Billing & Plans",
    count: 11,
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="8" width="24" height="18" rx="2" />
        <path d="M4 14H28" />
        <path d="M8 20H14" />
        <path d="M8 24H10" />
        <path d="M22 20H24" />
      </svg>
    ),
    desc: "Manage subscriptions, view invoices, and understand our pricing tiers.",
  },
  {
    title: "Account Settings",
    count: 8,
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="16" r="3" />
        <path d="M16 4V8" />
        <path d="M16 24V28" />
        <path d="M6.34 6.34L9.17 9.17" />
        <path d="M22.83 22.83L25.66 25.66" />
        <path d="M4 16H8" />
        <path d="M24 16H28" />
        <path d="M6.34 25.66L9.17 22.83" />
        <path d="M22.83 9.17L25.66 6.34" />
      </svg>
    ),
    desc: "Update your profile, security settings, and notification preferences.",
  },
];

const faqItems = [
  {
    q: "How do I create my first event?",
    a: "After signing up, navigate to your Dashboard and click the \"Create Event\" button. Follow the guided setup wizard — you'll choose a template, add event details (date, venue, dress code), and customize your RSVP page. The entire process takes less than 5 minutes.",
  },
  {
    q: "Can I customize the look of my RSVP page?",
    a: "Absolutely! Fancy RSVP offers a rich template gallery with professionally designed themes. You can customize colors, fonts, backgrounds, and add your own images. Premium plans unlock advanced CSS customization for pixel-perfect control over every element.",
  },
  {
    q: "How do guests respond to my invitation?",
    a: "Guests receive a beautifully designed email or SMS with a unique link to your RSVP page. They simply click the link, confirm their attendance, select meal preferences, and add any plus-ones — all without needing to create an account. You'll see responses in real-time on your dashboard.",
  },
  {
    q: "Is there a limit on the number of guests?",
    a: "Our Free plan supports up to 50 guests per event. The Professional plan expands this to 500 guests, and our Enterprise plan offers unlimited guests. All plans include real-time response tracking and guest list management tools.",
  },
  {
    q: "Can I send follow-up reminders to guests?",
    a: "Yes! You can schedule automated reminders via email or SMS for guests who haven't responded. Set custom timing (e.g., 2 weeks before, 1 week before) and personalize the message. Our smart send feature avoids duplicate notifications to guests who've already replied.",
  },
  {
    q: "How secure is my guest data?",
    a: "Security is our top priority. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We are GDPR and CCPA compliant, conduct regular security audits, and never sell or share your guest information with third parties. You can export or delete your data at any time.",
  },
];

function CategoryCard({ category, index, onCategoryClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="help-category-card"
      style={{
        background: hovered ? "#FFFDF8" : "#FFFFFF",
        border: `1px solid ${hovered ? "#D7BE80" : "#E8E2D6"}`,
        borderRadius: "16px",
        padding: "36px 28px",
        cursor: "pointer",
        transition: "all 0.35s ease",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 12px 40px rgba(184, 148, 79, 0.12)"
          : "0 2px 12px rgba(0, 0, 0, 0.04)",
        animationDelay: `${index * 80}ms`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onCategoryClick}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "14px",
          background: hovered
            ? "linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)"
            : "#FAF7F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
          transition: "all 0.35s ease",
        }}
      >
        <div style={{ filter: hovered ? "brightness(10)" : "none", transition: "filter 0.35s ease" }}>
          {category.icon}
        </div>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "18px",
          fontWeight: 600,
          color: "#191B1E",
          marginBottom: "8px",
        }}
      >
        {category.title}
      </h3>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          color: "#5E5A52",
          lineHeight: "1.6",
          marginBottom: "16px",
        }}
      >
        {category.desc}
      </p>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          fontWeight: 600,
          color: "#B8944F",
          letterSpacing: "0.3px",
        }}
      >
        {category.count} articles →
      </span>
    </div>
  );
}

function FAQItem({ item, isOpen, onToggle }) {
  return (
    <div
      style={{
        borderBottom: "1px solid #E8E2D6",
        overflow: "hidden",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "24px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "17px",
            fontWeight: 600,
            color: isOpen ? "#B8944F" : "#191B1E",
            transition: "color 0.3s ease",
            paddingRight: "24px",
          }}
        >
          {item.q}
        </span>
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            border: `1.5px solid ${isOpen ? "#B8944F" : "#E8E2D6"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.3s ease",
            background: isOpen ? "rgba(184, 148, 79, 0.08)" : "transparent",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke={isOpen ? "#B8944F" : "#5E5A52"}
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{
              transition: "transform 0.3s ease, stroke 0.3s ease",
              transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
            }}
          >
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
        </div>
      </button>
      <div
        style={{
          maxHeight: isOpen ? "300px" : "0",
          opacity: isOpen ? 1 : 0,
          transition: "max-height 0.4s ease, opacity 0.3s ease, padding 0.3s ease",
          paddingBottom: isOpen ? "24px" : "0",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            color: "#5E5A52",
            lineHeight: "1.75",
            paddingRight: "52px",
          }}
        >
          {item.a}
        </p>
      </div>
    </div>
  );
}

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef(null);

  const scrollToFaq = () => {
    const faqSection = document.getElementById("faq-section");
    if (faqSection) {
      faqSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const filteredCategories = categories.filter(
    (cat) =>
      cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFaq = faqItems.filter(
    (item) =>
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ── Hero Section ── */}
        <section
          style={{
            background: "linear-gradient(180deg, #FAF7F0 0%, #FFFFFF 100%)",
            padding: "80px 24px 64px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative elements */}
          <div style={{ position: "absolute", top: "20px", left: "10%", opacity: 0.06 }}>
            <svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="60" fill="#B8944F" /></svg>
          </div>
          <div style={{ position: "absolute", bottom: "10px", right: "8%", opacity: 0.05 }}>
            <svg width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#B8944F" /></svg>
          </div>

          <div style={{ maxWidth: "680px", margin: "0 auto", position: "relative", zIndex: 1 }}>
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
              Support Center
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
              Help Center
            </h1>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "18px",
                color: "#5E5A52",
                lineHeight: 1.6,
                marginBottom: "40px",
              }}
            >
              Find answers, explore guides, and get the support you need to create unforgettable events.
            </p>

            {/* Search Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                maxWidth: "560px",
                margin: "0 auto",
                background: "#FFFFFF",
                borderRadius: "12px",
                border: `2px solid ${searchFocused ? "#B8944F" : "#E8E2D6"}`,
                padding: "6px 8px 6px 20px",
                boxShadow: searchFocused
                  ? "0 8px 32px rgba(184, 148, 79, 0.12)"
                  : "0 4px 20px rgba(0, 0, 0, 0.06)",
                transition: "all 0.3s ease",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={searchFocused ? "#B8944F" : "#5E5A52"}
                strokeWidth="2"
                strokeLinecap="round"
                style={{ flexShrink: 0, transition: "stroke 0.3s ease" }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21L16.65 16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search for help articles, topics, or questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  padding: "14px 16px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  color: "#191B1E",
                  background: "transparent",
                }}
                ref={searchInputRef}
              />
              <button
                className="btn-gold"
                style={{
                  padding: "10px 24px",
                  fontSize: "14px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  flexShrink: 0,
                }}
                onClick={() => searchInputRef.current && searchInputRef.current.focus()}
              >
                Search
              </button>
            </div>
          </div>
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

        {/* ── Category Grid ── */}
        <section
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "64px 48px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "32px",
                fontWeight: 700,
                color: "#191B1E",
                marginBottom: "12px",
              }}
            >
              Browse by Category
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                color: "#5E5A52",
              }}
            >
              Explore our knowledge base organized by topic
            </p>
          </div>

          <div className="category-grid">
            {filteredCategories.map((cat, i) => (
              <CategoryCard key={cat.title} category={cat} index={i} onCategoryClick={scrollToFaq} />
            ))}
          </div>

          {filteredCategories.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", color: "#5E5A52" }}>
                No categories match your search. Try a different keyword.
              </p>
            </div>
          )}
        </section>

        {/* ── Popular Articles / FAQ ── */}
        <section
          id="faq-section"
          style={{
            background: "#FAF7F0",
            padding: "80px 24px",
          }}
        >
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "#B8944F",
                  display: "block",
                  marginBottom: "12px",
                }}
              >
                Popular Questions
              </span>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "32px",
                  fontWeight: 700,
                  color: "#191B1E",
                  marginBottom: "12px",
                }}
              >
                Frequently Asked Questions
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "16px",
                  color: "#5E5A52",
                }}
              >
                Quick answers to the questions we hear most often
              </p>
            </div>

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E8E2D6",
                padding: "8px 36px",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
              }}
            >
              {filteredFaq.map((item, i) => (
                <FAQItem
                  key={i}
                  item={item}
                  isOpen={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
              {filteredFaq.length === 0 && (
                <div style={{ padding: "32px 0", textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "15px", color: "#5E5A52" }}>
                    No questions match your search.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Contact Support CTA ── */}
        <section
          style={{
            padding: "80px 24px",
            textAlign: "center",
            background: "linear-gradient(180deg, #FFFFFF 0%, #FAF7F0 100%)",
          }}
        >
          <div style={{ maxWidth: "640px", margin: "0 auto" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 28px",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M28 15C28 21.627 22.627 27 16 27C14.2 27 12.5 26.6 10.9 25.9L4 28L6.1 21.1C5.4 19.5 5 17.8 5 16C5 9.373 10.373 4 17 4" />
                <path d="M22 4V12" />
                <path d="M18 8H26" />
              </svg>
            </div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "32px",
                fontWeight: 700,
                color: "#191B1E",
                marginBottom: "16px",
              }}
            >
              Still Need Help?
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                color: "#5E5A52",
                lineHeight: 1.7,
                marginBottom: "36px",
              }}
            >
              Our dedicated support team is here to assist you. Reach out via email, live chat, or schedule a call — we typically respond within 2 hours during business hours.
            </p>
            <div
              style={{
                display: "flex",
                gap: "16px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/contact"
                className="btn-gold"
                style={{
                  padding: "14px 36px",
                  fontSize: "15px",
                  fontWeight: 600,
                  borderRadius: "8px",
                }}
              >
                Contact Support
              </Link>
              <a
                href="mailto:support@fancyrsvp.com"
                className="btn-outline"
                style={{
                  padding: "14px 36px",
                  fontSize: "15px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  textDecoration: "none",
                }}
              >
                Email Us
              </a>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        .category-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        input::placeholder {
          color: #9E9A92;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 1024px) {
          .category-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .category-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 16px !important;
          }
        }
        @media (max-width: 640px) {
          .category-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
