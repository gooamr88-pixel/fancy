"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import MobilePreview from "../components/templates/MobilePreview";
import InvitationCard from "../components/templates/InvitationCard";
import { motion, AnimatePresence } from "framer-motion";

const categories = ["All", "Classic", "Modern", "Rustic", "Luxury", "Minimal", "Floral", "Wedding"];

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
  {
    name: "Tuscan Vineyard",
    category: "Wedding",
    description: "Parchment tones, an olive wax seal, and hand-lettered script for garden and villa weddings under the Italian sun.",
    gradient: "linear-gradient(135deg, #F8F3E6 0%, #E9E0C6 30%, #C9B896 60%, #6B7A4F 100%)",
    accent: "#6B7A4F",
    pattern: "tuscany",
  },
  {
    name: "Marrakesh Nights",
    category: "Wedding",
    description: "A jewel-toned riad evening — indigo night sky, zellige star motifs and a keyhole arch frame.",
    gradient: "linear-gradient(135deg, #1B2A4A 0%, #223257 50%, #D9A94E 100%)",
    accent: "#D9A94E",
    pattern: "marrakesh",
  },
  {
    name: "Kyoto Blossom",
    category: "Wedding",
    description: "Quiet, spacious Japanese minimalism — a single sakura branch and a hanko-stamp monogram.",
    gradient: "linear-gradient(135deg, #F7EFEE 0%, #EDDEDC 50%, #B23A48 100%)",
    accent: "#B23A48",
    pattern: "kyoto",
  },
  {
    name: "Nordic Frost",
    category: "Wedding",
    description: "Crisp Scandinavian minimalism — icy blue-greys and a single line-art pine.",
    gradient: "linear-gradient(135deg, #EFF3F5 0%, #DEE6EA 50%, #33495D 100%)",
    accent: "#33495D",
    pattern: "nordic",
  },
  {
    name: "Havana Sunset",
    category: "Wedding",
    description: "A vivid coral-to-turquoise postcard — palm silhouettes and a sunburst stamp for a joyful fiesta.",
    gradient: "linear-gradient(135deg, #FF9A6C 0%, #FF7A59 35%, #2EC4B6 100%)",
    accent: "#FF7A59",
    pattern: "havana",
  },
  {
    name: "Old Money Estate",
    category: "Wedding",
    description: "A crest, a pinstripe frame and small-caps typography — quietly formal heritage elegance.",
    gradient: "linear-gradient(135deg, #F3EEE1 0%, #E4DCC7 50%, #1B2A41 100%)",
    accent: "#1B2A41",
    pattern: "estate",
  },
  {
    name: "Rosé Atelier",
    category: "Wedding",
    description: "Dusty rose and champagne with a delicate ribbon-bow motif — modern French wedding-atelier chic.",
    gradient: "linear-gradient(135deg, #FBF6F2 0%, #F3E2DC 100%)",
    accent: "#C98A93",
    pattern: "roseAtelier",
  },
  {
    name: "Midnight Orchid",
    category: "Luxury",
    description: "Deep plum-black with a gilded orchid stem climbing one edge — dramatic, romantic luxury.",
    gradient: "linear-gradient(135deg, #1B1023 0%, #24132E 55%, #C9A24B 100%)",
    accent: "#C9A24B",
    pattern: "orchid",
  },
  {
    name: "Copper & Clay",
    category: "Rustic",
    description: "Warm sand and terracotta with a radiating sunburst motif — earthy, boho desert warmth.",
    gradient: "linear-gradient(135deg, #EDE0CB 0%, #E6D5B8 50%, #B5502F 100%)",
    accent: "#B5502F",
    pattern: "clay",
  },
  {
    name: "Alpine Pine",
    category: "Rustic",
    description: "Deep pine green with hand-drawn pine-branch corners — cozy winter lodge charm.",
    gradient: "linear-gradient(135deg, #22392F 0%, #1B2E25 100%)",
    accent: "#D9C9A3",
    pattern: "alpine",
  },
  {
    name: "Coastal Linen",
    category: "Minimal",
    description: "Seafoam and sand with a gentle wave-line motif and rope-knot divider — relaxed seaside elegance.",
    gradient: "linear-gradient(135deg, #E8F3EF 0%, #E8DCC3 100%)",
    accent: "#2B5F5A",
    pattern: "coastal",
  },
];

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
      {/* Preview area — the real InvitationCard art, so this gallery always
          matches what organizers actually get, with zero duplicated markup. */}
      <div
        style={{
          height: "240px",
          background: template.gradient,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "62%", aspectRatio: "210 / 290", borderRadius: "10px", overflow: "hidden", boxShadow: "0 14px 30px -12px rgba(0,0,0,0.35)" }}>
          <InvitationCard template={{ pattern: template.pattern }} theme={{ primary: template.accent, secondary: template.accent }} />
        </div>

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

  // Lock body scroll when mobile preview modal is open
  useEffect(() => {
    if (isPreviewModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isPreviewModalOpen]);

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
              className="hidden lg:block lg:col-span-4 sticky top-24"
            >
              <div className="flex flex-col items-center border border-[#E8E2D6] bg-[#FBF9F6] p-6 rounded-3xl inner-simulator-container">
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
            className="fixed inset-0 z-[100] bg-white lg:hidden flex flex-col"
            style={{ pointerEvents: "auto" }}
          >
            {/* Elegant Floating Close Button */}
            <button
              onClick={() => setIsPreviewModalOpen(false)}
              className="fixed top-4 right-4 z-[110] w-10 h-10 rounded-full bg-stone-900/40 hover:bg-stone-900/60 active:bg-stone-900/80 backdrop-blur-sm text-white flex items-center justify-center border border-white/20 cursor-pointer shadow-xl transition-all"
              aria-label="Close Preview"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Immersive full-screen mobile view screen */}
            <motion.div
              className="flex-1 w-full h-full relative overflow-hidden bg-white"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <MobilePreview template={selectedTemplate} theme={selectedThemeColor} isBare={true} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .inner-simulator-container {
          transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        /* Desktop Sticky Simulator Scale Adjustments to prevent bottom-cropping */
        @media (min-width: 1024px) and (max-height: 860px) {
          .inner-simulator-container {
            transform: scale(0.9);
            transform-origin: top center;
            margin-bottom: -50px;
          }
        }
        @media (min-width: 1024px) and (max-height: 770px) {
          .inner-simulator-container {
            transform: scale(0.8);
            transform-origin: top center;
            margin-bottom: -100px;
          }
        }
        @media (min-width: 1024px) and (max-height: 690px) {
          .inner-simulator-container {
            transform: scale(0.7);
            transform-origin: top center;
            margin-bottom: -150px;
          }
        }
        @media (min-width: 1024px) and (max-height: 620px) {
          .inner-simulator-container {
            transform: scale(0.6);
            transform-origin: top center;
            margin-bottom: -200px;
          }
        }

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
