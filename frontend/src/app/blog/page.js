"use client";
import React, { useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import GoldDivider from "../components/GoldDivider";

/* ═══════════════════════════════════════════════════════════
   Blog Page — Fancy RSVP
   Featured Article · Article Grid · Newsletter
   ═══════════════════════════════════════════════════════════ */

const categories = ["All", "Wedding Planning", "Event Tips", "Product Updates", "Inspiration"];

const featuredArticle = {
  category: "Wedding Planning",
  title: "The Ultimate Guide to a Stress-Free Wedding RSVP Experience",
  excerpt:
    "From crafting the perfect invitation to managing guest responses with grace — everything you need to know about modern wedding RSVPs in 2025.",
  date: "June 5, 2025",
  readTime: "12 min read",
  author: "Sarah Laurent",
};

const articles = [
  {
    category: "Event Tips",
    title: "10 Secrets to Hosting an Unforgettable Gala Evening",
    excerpt: "Discover the insider strategies that luxury event planners use to create evenings your guests will talk about for years.",
    date: "May 28, 2025",
    readTime: "8 min read",
    author: "Elena Martinez",
  },
  {
    category: "Product Updates",
    title: "Introducing Smart Guest Analytics — Know Your Audience",
    excerpt: "Our newest feature gives you real-time insights into guest responses, dietary preferences, and attendance patterns.",
    date: "May 20, 2025",
    readTime: "5 min read",
    author: "James Chen",
  },
  {
    category: "Inspiration",
    title: "Destination Weddings: RSVP Etiquette Across Cultures",
    excerpt: "A beautifully curated guide to navigating RSVP customs for international celebrations — from Tokyo to Tuscany.",
    date: "May 14, 2025",
    readTime: "10 min read",
    author: "David Park",
  },
  {
    category: "Wedding Planning",
    title: "How to Write RSVP Cards That Guests Actually Respond To",
    excerpt: "The art and science of crafting invitation language that drives timely responses while maintaining elegance.",
    date: "May 8, 2025",
    readTime: "7 min read",
    author: "Sarah Laurent",
  },
  {
    category: "Inspiration",
    title: "Color Palettes of 2025: Trends in Event Design",
    excerpt: "From muted earth tones to bold jewel accents — the color trends shaping the most stylish celebrations this year.",
    date: "April 30, 2025",
    readTime: "6 min read",
    author: "Elena Martinez",
  },
  {
    category: "Event Tips",
    title: "The Digital vs. Paper RSVP Debate: Finding the Balance",
    excerpt: "How modern couples are blending traditional elegance with digital convenience for a seamless guest experience.",
    date: "April 22, 2025",
    readTime: "9 min read",
    author: "David Park",
  },
];

const categoryColors = {
  "Wedding Planning": { bg: "rgba(184,148,79,0.1)", text: "#B8944F" },
  "Event Tips": { bg: "rgba(94,90,82,0.08)", text: "#5E5A52" },
  "Product Updates": { bg: "rgba(25,27,30,0.06)", text: "#191B1E" },
  "Inspiration": { bg: "rgba(215,190,128,0.15)", text: "#a07f3f" },
};

function ArticleCard({ article }) {
  const colors = categoryColors[article.category] || categoryColors["Event Tips"];

  return (
    <div
      className="article-card"
      style={{
        background: "#FFFFFF",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Thumbnail area */}
      <div
        style={{
          height: "180px",
          background: `linear-gradient(135deg, #F8F4EC 0%, #FFFFFF 50%, ${colors.bg} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.25 }}>
          <rect x="8" y="12" width="48" height="40" rx="4" stroke="#B8944F" strokeWidth="1.5" />
          <path d="M8 18L32 36L56 18" stroke="#B8944F" strokeWidth="1.5" />
          <line x1="8" y1="16" x2="56" y2="16" stroke="#E8E2D6" strokeWidth="1" />
        </svg>
        {/* Category badge */}
        <span
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            background: colors.bg,
            color: colors.text,
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.5px",
            padding: "5px 12px",
            borderRadius: "20px",
            textTransform: "uppercase",
          }}
        >
          {article.category}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: "28px 24px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
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
          {article.title}
        </h3>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "#5E5A52",
            lineHeight: 1.7,
            marginBottom: "20px",
            flex: 1,
          }}
        >
          {article.excerpt}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #F0ECE4",
            paddingTop: "16px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "#5E5A52",
            }}
          >
            {article.date}
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              fontWeight: 600,
              color: "#B8944F",
            }}
          >
            {article.readTime}
          </span>
        </div>
        <Link
          href="/register?from=blog"
          aria-label={`Read full article: ${article.title}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 700,
            color: "#B8944F",
            textDecoration: "none",
            marginTop: "16px",
            transition: "color 0.2s ease",
          }}
        >
          Read Full Article →
        </Link>
      </div>

      <style jsx>{`
        .article-card {
          border: 1px solid #E8E2D6;
          transition: all 0.35s ease;
          transform: translateY(0);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
        }
        .article-card:hover,
        .article-card:focus-within {
          border-color: #D7BE80;
          transform: translateY(-6px);
          box-shadow: 0 16px 48px rgba(184, 148, 79, 0.12);
        }
      `}</style>
    </div>
  );
}

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [emailValue, setEmailValue] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = useCallback(() => {
    if (!emailValue.trim()) return;
    setSubscribed(true);
  }, [emailValue]);

  const filteredArticles =
    activeCategory === "All"
      ? articles
      : articles.filter((a) => a.category === activeCategory);

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>

        {/* ════════════ HERO ════════════ */}
        <section
          style={{
            background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
            padding: "100px 48px 60px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-100px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "700px",
              height: "700px",
              borderRadius: "50%",
              border: "1px solid rgba(184,148,79,0.06)",
              pointerEvents: "none",
            }}
          />
          <div style={{ maxWidth: "700px", margin: "0 auto", position: "relative", zIndex: 1 }}>
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
              Stories & Insights
            </p>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
                fontWeight: 700,
                color: "#191B1E",
                marginBottom: "20px",
                lineHeight: 1.1,
              }}
            >
              The Fancy Blog
            </h1>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "19px",
                color: "#5E5A52",
                lineHeight: 1.75,
              }}
            >
              Tips, trends, and inspiration for elegant events
            </p>
          </div>
        </section>

        {/* ════════════ FEATURED ════════════ */}
        <section style={{ padding: "40px 48px 80px", background: "#FFFFFF" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div
              style={{
                borderRadius: "20px",
                overflow: "hidden",
                background: "linear-gradient(135deg, #191B1E 0%, #2a2d32 60%, #3a3226 100%)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                minHeight: "400px",
                position: "relative",
              }}
              className="featured-grid"
            >
              {/* Left — Visual */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "48px",
                  position: "relative",
                }}
              >
                {/* Large decorative element */}
                <div style={{ position: "relative" }}>
                  <svg width="220" height="220" viewBox="0 0 220 220" fill="none">
                    <circle cx="110" cy="110" r="100" stroke="rgba(184,148,79,0.15)" strokeWidth="1" />
                    <circle cx="110" cy="110" r="70" stroke="rgba(184,148,79,0.1)" strokeWidth="1" />
                    <rect x="60" y="80" width="100" height="70" rx="6" stroke="#B8944F" strokeWidth="1.5" fill="none" opacity="0.6" />
                    <path d="M60 86L110 122L160 86" stroke="#B8944F" strokeWidth="1.5" fill="none" opacity="0.6" />
                    <text x="110" y="60" textAnchor="middle" fill="#D7BE80" fontSize="14" fontFamily="serif" fontWeight="600" letterSpacing="2" opacity="0.5">FEATURED</text>
                  </svg>
                </div>
              </div>

              {/* Right — Content */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  padding: "56px 56px 56px 0",
                }}
                className="featured-content"
              >
                <span
                  style={{
                    display: "inline-block",
                    background: "rgba(184,148,79,0.15)",
                    color: "#D7BE80",
                    fontFamily: "var(--font-sans)",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    padding: "5px 14px",
                    borderRadius: "20px",
                    textTransform: "uppercase",
                    marginBottom: "20px",
                    alignSelf: "flex-start",
                  }}
                >
                  {featuredArticle.category}
                </span>
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
                    fontWeight: 600,
                    color: "#FFFFFF",
                    lineHeight: 1.3,
                    marginBottom: "16px",
                  }}
                >
                  {featuredArticle.title}
                </h2>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    color: "rgba(255,255,255,0.6)",
                    lineHeight: 1.7,
                    marginBottom: "28px",
                  }}
                >
                  {featuredArticle.excerpt}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "20px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {featuredArticle.date}
                  </span>
                  <span
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.2)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "#D7BE80",
                      fontWeight: 600,
                    }}
                  >
                    {featuredArticle.readTime}
                  </span>
                </div>
                <Link
                  href="/register?from=blog"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#B8944F",
                    textDecoration: "none",
                    marginTop: "24px",
                    padding: "12px 28px",
                    borderRadius: "8px",
                    border: "1.5px solid rgba(184,148,79,0.4)",
                    alignSelf: "flex-start",
                    transition: "all 0.3s ease",
                    background: "transparent",
                  }}
                >
                  Read More →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════ FILTERS + GRID ════════════ */}
        <section style={{ padding: "0 48px 100px", background: "#FFFFFF" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            {/* Category filters */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "48px",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    fontWeight: activeCategory === cat ? 700 : 500,
                    color: activeCategory === cat ? "#FFFFFF" : "#5E5A52",
                    background: activeCategory === cat
                      ? "linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)"
                      : "#F8F4EC",
                    border: "none",
                    padding: "10px 22px",
                    borderRadius: "24px",
                    cursor: "pointer",
                    transition: "all 0.25s ease",
                    letterSpacing: "0.3px",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Articles grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "28px",
              }}
              className="articles-grid"
            >
              {filteredArticles.map((article, i) => (
                <ArticleCard key={i} article={article} />
              ))}
            </div>

            {filteredArticles.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "16px", color: "#5E5A52" }}>
                  No articles in this category yet. Check back soon!
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ════════════ NEWSLETTER ════════════ */}
        <section
          style={{
            padding: "100px 48px",
            background: "linear-gradient(135deg, #F8F4EC 0%, #FFF 100%)",
          }}
        >
          <div
            style={{
              maxWidth: "680px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <GoldDivider />
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                fontWeight: 600,
                color: "#191B1E",
                marginTop: "8px",
                marginBottom: "16px",
              }}
            >
              Stay Inspired
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "17px",
                color: "#5E5A52",
                lineHeight: 1.7,
                marginBottom: "36px",
              }}
            >
              Get our best articles, event tips, and product updates delivered
              straight to your inbox. No spam, just inspiration.
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                maxWidth: "480px",
                margin: "0 auto",
              }}
              className="newsletter-form"
            >
              <input
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                style={{
                  flex: 1,
                  padding: "15px 20px",
                  borderRadius: "10px",
                  border: `1.5px solid ${emailFocused ? "#B8944F" : "#E8E2D6"}`,
                  background: "#FFFFFF",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  color: "#191B1E",
                  outline: "none",
                  transition: "border-color 0.25s ease",
                }}
              />
              <button
                className="btn-gold"
                onClick={handleSubscribe}
                disabled={subscribed}
                style={{
                  padding: "15px 32px",
                  fontSize: "14px",
                  borderRadius: "10px",
                  whiteSpace: "nowrap",
                  opacity: subscribed ? 0.8 : 1,
                  cursor: subscribed ? "default" : "pointer",
                }}
              >
                {subscribed ? "Subscribed! ✓" : "Subscribe"}
              </button>
            </div>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "#5E5A52",
                marginTop: "16px",
                opacity: 0.6,
              }}
            >
              Join 12,000+ event enthusiasts. Unsubscribe anytime.
            </p>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        @media (max-width: 1024px) {
          .articles-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .featured-grid {
            grid-template-columns: 1fr !important;
          }
          .featured-content {
            padding: 32px 32px 40px 32px !important;
          }
          .articles-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
          }
        }
        @media (max-width: 640px) {
          .articles-grid {
            grid-template-columns: 1fr !important;
          }
          .newsletter-form {
            flex-direction: column !important;
          }
        }
      `}</style>
    </>
  );
}
