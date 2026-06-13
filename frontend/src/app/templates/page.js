"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import MobilePreview from "../components/templates/MobilePreview";
import { motion, AnimatePresence } from "framer-motion";

const categories = ["All", "Classic", "Modern", "Rustic", "Luxury", "Minimal", "Floral"];

const themeColors = [
  { 
    id: "gold", 
    name: "Royale Gold", 
    primary: "#B8944F", 
    secondary: "#D7BE80", 
    accent: "#B8944F",
    gradient: "linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)",
    liningGradId: "goldGrad"
  },
  { 
    id: "emerald", 
    name: "Emerald Ivy", 
    primary: "#064E3B", 
    secondary: "#10B981", 
    accent: "#10B981",
    gradient: "linear-gradient(135deg, #064E3B 0%, #10B981 100%)",
    liningGradId: "emeraldGrad"
  },
  { 
    id: "burgundy", 
    name: "Burgundy Rose", 
    primary: "#722F37", 
    secondary: "#E89FB0", 
    accent: "#722F37",
    gradient: "linear-gradient(135deg, #722F37 0%, #E89FB0 100%)",
    liningGradId: "burgundyGrad"
  }
];

const templates = [
  {
    name: "Timeless Elegance",
    category: "Classic",
    description: "A refined design with serif typography, cream tones, and delicate gold borders that exude sophistication.",
    gradient: "linear-gradient(135deg, #F5E6D3 0%, #E8D5B7 30%, #D4C4A0 60%, #C9B896 100%)",
    accent: "#8B7355",
    pattern: "serif",
  },
  {
    name: "Urban Edge",
    category: "Modern",
    description: "Bold geometric patterns meet clean lines. A contemporary take on event invitations with a dark palette.",
    gradient: "linear-gradient(135deg, #2C3E50 0%, #34495E 30%, #4A6741 60%, #2C3E50 100%)",
    accent: "#1ABC9C",
    pattern: "geo",
  },
  {
    name: "Woodland Romance",
    category: "Rustic",
    description: "Warm earth tones and organic textures create a cozy, intimate feeling perfect for barn and garden events.",
    gradient: "linear-gradient(135deg, #D4A574 0%, #C4956A 30%, #A67B5B 60%, #8B6914 100%)",
    accent: "#6B4226",
    pattern: "organic",
  },
  {
    name: "Grand Affair",
    category: "Luxury",
    description: "Opulent gold accents, rich dark backgrounds, and premium typography for the most prestigious occasions.",
    gradient: "linear-gradient(135deg, #1A1A2E 0%, #16213E 30%, #0F3460 60%, #1A1A2E 100%)",
    accent: "#E6C200",
    pattern: "luxury",
  },
  {
    name: "Pure & Simple",
    category: "Minimal",
    description: "Clean whitespace, subtle grays, and thoughtful typography let your content breathe with quiet confidence.",
    gradient: "linear-gradient(135deg, #FAFAFA 0%, #F0F0F0 30%, #E8E8E8 60%, #F5F5F5 100%)",
    accent: "#333333",
    pattern: "minimal",
  },
  {
    name: "Garden Party",
    category: "Floral",
    description: "Lush botanical illustrations and soft watercolor blooms create a romantic, garden-inspired invitation suite.",
    gradient: "linear-gradient(135deg, #FDE1D3 0%, #E8B4B8 30%, #D4A0A7 60%, #F3D1DC 100%)",
    accent: "#8B4A6B",
    pattern: "floral",
  },
];

function TemplatePreview({ template }) {
  const { pattern, accent } = template;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Mock invitation card */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "70%",
          height: "72%",
          background: pattern === "minimal" ? "#FFFFFF" : "rgba(255,255,255,0.15)",
          borderRadius: "8px",
          border: `1px solid ${pattern === "minimal" ? "#E0E0E0" : "rgba(255,255,255,0.25)"}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          backdropFilter: "blur(4px)",
        }}
      >
        {/* Decorative top border */}
        <div
          style={{
            width: "40px",
            height: "2px",
            background: accent,
            marginBottom: "12px",
            borderRadius: "1px",
          }}
        />
        <div
          style={{
            fontFamily: "var(--font-script)",
            fontSize: "18px",
            color: pattern === "minimal" ? "#333" : "#FFFFFF",
            marginBottom: "6px",
            opacity: 0.9,
          }}
        >
          You're Invited
        </div>
        <div
          style={{
            width: "50px",
            height: "1px",
            background: pattern === "minimal" ? "#CCC" : "rgba(255,255,255,0.3)",
            marginBottom: "6px",
          }}
        />
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "10px",
            color: pattern === "minimal" ? "#666" : "rgba(255,255,255,0.7)",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          RSVP
        </div>
      </div>

      {/* Corner decorations for luxury/classic */}
      {(pattern === "luxury" || pattern === "serif") && (
        <>
          <svg style={{ position: "absolute", top: "12px", left: "12px" }} width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M0 12C0 5.373 5.373 0 12 0" stroke={accent} strokeWidth="0.8" opacity="0.5" />
            <path d="M0 6C0 2.686 2.686 0 6 0" stroke={accent} strokeWidth="0.5" opacity="0.3" />
          </svg>
          <svg style={{ position: "absolute", bottom: "12px", right: "12px", transform: "rotate(180deg)" }} width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M0 12C0 5.373 5.373 0 12 0" stroke={accent} strokeWidth="0.8" opacity="0.5" />
            <path d="M0 6C0 2.686 2.686 0 6 0" stroke={accent} strokeWidth="0.5" opacity="0.3" />
          </svg>
        </>
      )}

      {/* Geometric pattern for modern */}
      {pattern === "geo" && (
        <svg style={{ position: "absolute", bottom: "16px", left: "16px", opacity: 0.2 }} width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="0" y="0" width="16" height="16" stroke={accent} strokeWidth="0.8" />
          <rect x="20" y="20" width="16" height="16" stroke={accent} strokeWidth="0.8" />
          <line x1="0" y1="40" x2="40" y2="0" stroke={accent} strokeWidth="0.5" />
        </svg>
      )}

      {/* Floral dots decoration */}
      {pattern === "floral" && (
        <>
          <div style={{ position: "absolute", top: "20px", right: "24px", width: "8px", height: "8px", borderRadius: "50%", background: accent, opacity: 0.2 }} />
          <div style={{ position: "absolute", top: "32px", right: "16px", width: "5px", height: "5px", borderRadius: "50%", background: accent, opacity: 0.15 }} />
          <div style={{ position: "absolute", bottom: "24px", left: "20px", width: "6px", height: "6px", borderRadius: "50%", background: accent, opacity: 0.2 }} />
        </>
      )}
    </div>
  );
}

function TemplateCard({ template, onPreview, isSelected }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPreview(template)}
      style={{
        borderRadius: "16px",
        overflow: "hidden",
        border: isSelected 
          ? "2px solid #B8944F" 
          : hovered 
          ? "1.5px solid #B8944F" 
          : "1px solid #E8E2D6",
        transition: "all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        boxShadow: isSelected
          ? "0 12px 30px rgba(184,148,79,0.15), 0 4px 12px rgba(0,0,0,0.02)"
          : hovered
          ? "0 20px 60px rgba(184,148,79,0.12), 0 8px 24px rgba(0,0,0,0.04)"
          : "0 2px 12px rgba(0,0,0,0.03)",
        background: "#FFFFFF",
        cursor: "pointer",
        position: "relative",
      }}
    >
      {/* Preview area */}
      <div
        style={{
          height: "240px",
          background: template.gradient,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <TemplatePreview template={template} />

        {/* Hover overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: hovered ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0)",
            transition: "all 0.4s ease",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Card info */}
      <div style={{ padding: "24px 28px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "20px",
              fontWeight: 600,
              color: "#191B1E",
              margin: 0,
            }}
          >
            {template.name}
          </h3>
          <span
            style={{
              padding: "4px 14px",
              borderRadius: "100px",
              background: "rgba(184,148,79,0.08)",
              border: "1px solid rgba(184,148,79,0.15)",
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              fontWeight: 600,
              color: "#B8944F",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            {template.category}
          </span>
        </div>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "#5E5A52",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {template.description}
        </p>
      </div>

      {/* Action Buttons */}
      <div style={{ padding: "0 28px 24px", display: "flex", gap: "12px", zIndex: 10 }}>
        <Link 
          href="/register" 
          style={{ flex: 1, textDecoration: "none" }}
          onClick={(e) => {
            // Prevent bubbling to the card body onClick preview trigger
            e.stopPropagation();
          }}
        >
          <button 
            style={{
              width: "100%",
              backgroundColor: "#B8944F",
              color: "#FFFFFF",
              border: "none",
              padding: "10px 16px",
              borderRadius: "8px",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 12px rgba(184,148,79,0.2)",
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#a6833f"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#B8944F"}
          >
            Use Template
          </button>
        </Link>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPreview(template);
          }}
          style={{
            flex: 1,
            backgroundColor: "#FFFFFF",
            color: "#5E5A52",
            border: "1px solid #E8E2D6",
            padding: "10px 16px",
            borderRadius: "8px",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#F8F4EC";
            e.target.style.color = "#191B1E";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "#FFFFFF";
            e.target.style.color = "#5E5A52";
          }}
        >
          Live Preview
        </button>
      </div>
    </div>
  );
}

function GoldDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", margin: "0 auto", maxWidth: "280px" }}>
      <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, #D7BE80)" }} />
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L12 8L18 10L12 12L10 18L8 12L2 10L8 8Z" fill="#B8944F" opacity="0.5" />
      </svg>
      <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, #D7BE80, transparent)" }} />
    </div>
  );
}

export default function TemplatesPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [filterHover, setFilterHover] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [selectedThemeColor, setSelectedThemeColor] = useState(themeColors[0]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const filteredTemplates =
    activeCategory === "All"
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ════════════════════ HERO ════════════════════ */}
        <section
          style={{
            background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)",
            padding: "100px 48px 80px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", bottom: "-30px", left: "5%", width: "100px", height: "100px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />

          <div style={{ maxWidth: "700px", margin: "0 auto" }}>
            <div
              style={{
                display: "inline-block",
                padding: "8px 24px",
                borderRadius: "100px",
                background: "rgba(184, 148, 79, 0.08)",
                border: "1px solid rgba(184, 148, 79, 0.15)",
                marginBottom: "28px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#B8944F",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                }}
              >
                Template Gallery
              </span>
            </div>

            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "56px",
                fontWeight: 700,
                color: "#191B1E",
                lineHeight: 1.15,
                marginBottom: "24px",
                letterSpacing: "-1px",
              }}
            >
              Beautiful{" "}
              <span style={{ color: "#B8944F" }}>Templates</span>
            </h1>

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "19px",
                lineHeight: 1.7,
                color: "#5E5A52",
                maxWidth: "540px",
                margin: "0 auto",
              }}
            >
              Choose from our curated collection of designer templates, each crafted to make your event feel truly special.
            </p>
          </div>
        </section>

        {/* ════════════════════ FILTER & GALLERY ════════════════════ */}
        <section style={{ maxWidth: "1280px", margin: "0 auto", padding: "60px 24px 100px" }}>
          {/* Filter Buttons */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: "56px",
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                onMouseEnter={() => setFilterHover(cat)}
                onMouseLeave={() => setFilterHover(null)}
                style={{
                  padding: "10px 24px",
                  borderRadius: "100px",
                  border: activeCategory === cat ? "1.5px solid #B8944F" : "1px solid #E8E2D6",
                  background:
                    activeCategory === cat
                      ? "linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)"
                      : filterHover === cat
                      ? "rgba(184,148,79,0.04)"
                      : "#FFFFFF",
                  color: activeCategory === cat ? "#FFFFFF" : "#5E5A52",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: activeCategory === cat ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  letterSpacing: "0.3px",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <GoldDivider />

          {/* Theme Color Picker Section */}
          <div 
            style={{ 
              marginTop: "40px",
              marginBottom: "8px", 
              background: "#FFFFFF", 
              padding: "20px 24px", 
              borderRadius: "16px", 
              border: "1px solid #E8E2D6",
              boxShadow: "0 2px 8px rgba(0,0,0,0.015)"
            }}
          >
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "17px", fontWeight: 650, color: "#191B1E", margin: "0 0 4px" }}>
              Customize Invitation Theme Color
            </h3>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "12.5px", color: "#5E5A52", margin: "0 0 16px" }}>
              Choose a color preset to customize the envelope lining, card accents, and buttons in the live simulator.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              {themeColors.map((theme) => {
                const isActive = selectedThemeColor.id === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedThemeColor(theme)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 18px",
                      borderRadius: "100px",
                      border: isActive ? "2px solid #191B1E" : "1px solid #E8E2D6",
                      background: isActive ? "rgba(25,27,30,0.02)" : "#FFFFFF",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#191B1E"
                    }}
                  >
                    <span 
                      style={{ 
                        width: "12px", 
                        height: "12px", 
                        borderRadius: "50%", 
                        background: theme.gradient,
                        border: "1px solid rgba(0,0,0,0.1)"
                      }} 
                    />
                    {theme.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Responsive Layout with sticky preview simulator on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-14 items-start">
            {/* Left: Templates Gallery Grid */}
            <div className="lg:col-span-8">
              <div
                className="templates-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "28px",
                }}
              >
                {filteredTemplates.map((template) => (
                  <TemplateCard 
                    key={template.name} 
                    template={template} 
                    onPreview={(t) => {
                      setSelectedTemplate(t);
                      if (window.innerWidth < 1024) {
                        setIsPreviewModalOpen(true);
                      } else {
                        const previewEl = document.getElementById("sticky-preview-section");
                        if (previewEl) {
                          previewEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }
                      }
                    }}
                    isSelected={selectedTemplate.name === template.name}
                  />
                ))}
              </div>

              {/* Empty state */}
              {filteredTemplates.length === 0 && (
                <div style={{ textAlign: "center", padding: "80px 0" }}>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px", color: "#5E5A52" }}>
                    No templates found in this category.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Sticky Mobile Phone Preview Simulator */}
            <div 
              id="sticky-preview-section" 
              className="hidden lg:block lg:col-span-4 sticky top-24 flex flex-col items-center border border-[#E8E2D6] bg-[#FBF9F6] p-6 rounded-3xl"
            >
              <span className="text-[10px] font-bold uppercase tracking-[3px] mb-4 flex items-center gap-1.5" style={{ color: selectedThemeColor.accent }}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Preview Simulator
              </span>
              <MobilePreview template={selectedTemplate} theme={selectedThemeColor} />
              <p className="text-[11px] text-stone-400 font-sans mt-3 text-center max-w-[85%] leading-relaxed">
                Click <strong>&quot;Live Preview&quot;</strong> on any template card to load it here. Tap the envelope to test the unboxing flow.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════════════ HOW IT WORKS ════════════════════ */}
        <section style={{ background: "#F8F4EC", padding: "100px 48px" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "40px",
                  fontWeight: 700,
                  color: "#191B1E",
                  marginBottom: "16px",
                }}
              >
                How It{" "}
                <span style={{ color: "#B8944F" }}>Works</span>
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "17px",
                  color: "#5E5A52",
                  lineHeight: 1.7,
                }}
              >
                Three simple steps to a stunning event page.
              </p>
            </div>

            <div
              className="steps-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "48px",
              }}
            >
              {[
                {
                  step: "01",
                  title: "Choose a Template",
                  desc: "Browse our curated collection and select the template that matches your event's style and personality.",
                },
                {
                  step: "02",
                  title: "Customize Everything",
                  desc: "Personalize colors, fonts, images, and content. Our editor makes it easy to create something uniquely yours.",
                },
                {
                  step: "03",
                  title: "Share & Collect RSVPs",
                  desc: "Publish your event page and share it with guests. Watch RSVPs roll in with real-time tracking.",
                },
              ].map((item) => (
                <div key={item.step} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "48px",
                      fontWeight: 700,
                      color: "rgba(184,148,79,0.15)",
                      marginBottom: "16px",
                      lineHeight: 1,
                    }}
                  >
                    {item.step}
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
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      color: "#5E5A52",
                      lineHeight: 1.7,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════ CTA ════════════════════ */}
        <section
          style={{
            background: "linear-gradient(135deg, #191B1E 0%, #2A2D32 100%)",
            padding: "100px 48px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "500px",
              height: "500px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(184,148,79,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", zIndex: 1, maxWidth: "600px", margin: "0 auto" }}>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "44px",
                fontWeight: 700,
                color: "#FFFFFF",
                marginBottom: "20px",
                lineHeight: 1.2,
              }}
            >
              Create Your{" "}
              <span style={{ color: "#B8944F" }}>Dream Invitation</span>
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "18px",
                color: "rgba(255,255,255,0.6)",
                marginBottom: "40px",
                lineHeight: 1.7,
              }}
            >
              Start with a template and make it yours. Your event deserves to make a lasting first impression.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/register"
                className="btn-gold"
                style={{
                  padding: "16px 48px",
                  fontSize: "16px",
                  fontWeight: 700,
                  borderRadius: "8px",
                }}
              >
                Start Designing
              </Link>
              <Link
                href="/pricing"
                style={{
                  padding: "16px 48px",
                  fontSize: "16px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  border: "1px solid rgba(184,148,79,0.4)",
                  color: "#D7BE80",
                  textDecoration: "none",
                  fontFamily: "var(--font-sans)",
                  transition: "all 0.3s ease",
                }}
              >
                View Pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />

      {/* Floating Preview Modal Overlay (Mobile/Tablet Viewports) */}
      <AnimatePresence>
        {isPreviewModalOpen && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:hidden"
            style={{ pointerEvents: "auto" }}
          >
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/65 backdrop-blur-[4px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPreviewModalOpen(false)}
            />
            {/* Modal Body Container */}
            <motion.div
              className="relative z-10 w-full max-w-[340px] flex justify-center items-center"
              initial={{ scale: 0.9, opacity: 0, y: 55 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 55 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
            >
              {/* Close Button positioned above the phone mockup */}
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="absolute -top-11 right-2.5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center border border-white/25 cursor-pointer shadow-lg active:scale-95 transition-all text-xs font-bold"
              >
                ✕
              </button>
              <MobilePreview template={selectedTemplate} theme={selectedThemeColor} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @media (max-width: 1024px) {
          .templates-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .templates-grid {
            grid-template-columns: 1fr !important;
            max-width: 480px !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .steps-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
        }
        @media (max-width: 640px) {
          section {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
        }
      `}</style>
    </>
  );
}
