"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import MobilePreview from "../components/templates/MobilePreview";
import { motion, AnimatePresence } from "framer-motion";

const categories = ["All", "Classic", "Modern", "Rustic", "Luxury", "Minimal", "Floral", "Vineyard"];

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
    category: "Vineyard",
    description: "Parchment tones, an olive wax seal, and hand-lettered script for garden and villa weddings under the Italian sun.",
    gradient: "linear-gradient(135deg, #F8F3E6 0%, #E9E0C6 30%, #C9B896 60%, #6B7A4F 100%)",
    accent: "#6B7A4F",
    pattern: "tuscany",
  },
];

function TemplatePreview({ template }) {
  const { pattern, accent } = template;
  
  switch (pattern) {
    case "serif":
      return (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "75%",
          height: "78%",
          background: "#FCFAF6",
          borderRadius: "6px",
          border: `2.5px double ${accent}`,
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 6px 16px rgba(0,0,0,0.06), inset 0 0 10px rgba(184,148,79,0.04)",
          fontFamily: "var(--font-serif)"
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            gap: "2px",
            marginTop: "2px"
          }}>
            <span style={{
              fontSize: "6px",
              fontFamily: "var(--font-sans)",
              border: `0.5px solid ${accent}`,
              borderRadius: "50%",
              width: "14px",
              height: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              color: accent
            }}>A&J</span>
            <span style={{ fontSize: "5px", textTransform: "uppercase", letterSpacing: "1px", color: accent, fontWeight: 600 }}>CELEBRATION</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <span style={{ fontFamily: "var(--font-script)", fontSize: "19px", color: accent, lineHeight: 1.1 }}>Aria & Julian</span>
            <span style={{ fontSize: "4.5px", fontFamily: "var(--font-sans)", letterSpacing: "0.5px", color: "#888", marginTop: "3px", textTransform: "uppercase" }}>REQUEST THE HONOR</span>
            <span style={{ fontSize: "5px", fontWeight: "bold", color: "#D7BE80", marginTop: "2px" }}>OCTOBER 24, 2026</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px", width: "100%" }}>
            <div style={{ width: "15px", height: "1px", background: `${accent}70` }} />
            <span style={{ fontSize: "4.5px", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888" }}>THE GRAND BALLROOM</span>
          </div>
        </div>
      );

    case "geo":
      return (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "75%",
          height: "78%",
          background: "#FAFBFD",
          borderRadius: "6px",
          border: "1px solid rgba(59,130,246,0.1)",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "0 6px 16px rgba(59,130,246,0.04)",
          fontFamily: "var(--font-sans)",
          overflow: "hidden"
        }}>
          <div style={{
            position: "absolute",
            top: "-15px",
            right: "-15px",
            width: "35px",
            height: "35px",
            borderRadius: "50%",
            border: "0.5px solid rgba(59,130,246,0.15)"
          }} />
          <div style={{
            position: "absolute",
            bottom: "-15px",
            left: "-15px",
            width: "40px",
            height: "40px",
            border: "0.5px solid rgba(59,130,246,0.1)",
            transform: "rotate(45deg)"
          }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.5px solid #EAECEF", paddingBottom: "4px", zIndex: 2 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "4px", color: "#888", fontWeight: 700, letterSpacing: "0.5px" }}>ANNUAL</span>
              <span style={{ fontSize: "6.5px", fontWeight: 900, letterSpacing: "0.5px", color: accent }}>SUMMIT PRO</span>
            </div>
            <span style={{ fontSize: "5px", background: "rgba(59,130,246,0.08)", color: "#2563EB", padding: "1px 4px", borderRadius: "100px", fontWeight: "bold" }}>NYC</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px", margin: "auto 0", zIndex: 2 }}>
            <span style={{ fontSize: "5px", color: "#3B82F6", fontWeight: "bold", letterSpacing: "1px" }}>SHAPING THE FUTURE</span>
            <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#1F2937", lineHeight: 1.1 }}>Technology &<br/>Innovation Summit</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "0.5px solid #EAECEF", paddingTop: "4px", zIndex: 2 }}>
            <span style={{ fontSize: "5px", color: "#9CA3AF" }}>OCTOBER 24, 2026</span>
            <span style={{ fontSize: "5px", fontFamily: "monospace", color: "#9CA3AF" }}>#SUM-2026</span>
          </div>
        </div>
      );

    case "organic":
      return (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "75%",
          height: "78%",
          background: "#FAF6EE",
          borderRadius: "6px",
          border: `1.5px solid ${accent}50`,
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 6px 16px rgba(139,115,85,0.04)",
          fontFamily: "var(--font-serif)"
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" style={{ opacity: 0.4, marginTop: "2px" }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          </svg>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", margin: "auto 0" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "5px", fontWeight: "bold", letterSpacing: "1px", color: "#8B7D6B" }}>CUSTOM CELEBRATION</span>
            <span style={{ fontFamily: "var(--font-script)", fontSize: "18px", color: accent, lineHeight: 1.1, margin: "2px 0" }}>Woodland Romance</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "5px", color: "#8B7D6B", letterSpacing: "0.5px" }}>PINE VALLEY CABIN, NY</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
            <span style={{ fontSize: "5px", fontWeight: "bold", color: "#C4956A", textTransform: "uppercase" }}>OCTOBER 24, 2026</span>
            <div style={{ width: "12px", height: "0.5px", background: `${accent}40` }} />
          </div>
        </div>
      );

    case "luxury":
      return (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "75%",
          height: "78%",
          background: "linear-gradient(135deg, #0B0F19 0%, #151B26 50%, #0D121F 100%)",
          borderRadius: "6px",
          border: "1.5px solid rgba(215,190,128,0.4)",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
          fontFamily: "var(--font-serif)"
        }}>
          <div style={{ position: "absolute", top: "4px", left: "4px", width: "8px", height: "8px", borderTop: "0.5px solid #D7BE80", borderLeft: "0.5px solid #D7BE80", opacity: 0.6 }} />
          <div style={{ position: "absolute", top: "4px", right: "4px", width: "8px", height: "8px", borderTop: "0.5px solid #D7BE80", borderRight: "0.5px solid #D7BE80", opacity: 0.6 }} />
          <div style={{ position: "absolute", bottom: "4px", left: "4px", width: "8px", height: "8px", borderBottom: "0.5px solid #D7BE80", borderLeft: "0.5px solid #D7BE80", opacity: 0.6 }} />
          <div style={{ position: "absolute", bottom: "4px", right: "4px", width: "8px", height: "8px", borderBottom: "0.5px solid #D7BE80", borderRight: "0.5px solid #D7BE80", opacity: 0.6 }} />

          <span style={{ fontSize: "5px", color: "#D7BE80", letterSpacing: "1.5px", fontWeight: "bold", textTransform: "uppercase", marginTop: "2px" }}>CELEBRATE WITH US</span>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", margin: "auto 0" }}>
            <span style={{ fontSize: "13.5px", fontWeight: 300, color: "#FFF", letterSpacing: "0.5px", fontFamily: "var(--font-serif)" }}>Sarah & Tom</span>
            <div style={{ width: "20px", height: "0.5px", background: "linear-gradient(90deg, transparent, #D7BE80, transparent)", margin: "4px 0" }} />
            <span style={{ fontSize: "5px", color: "#FAF9F6", letterSpacing: "1px" }}>OCTOBER 24, 2026</span>
          </div>

          <span style={{ fontSize: "4.5px", color: "#D7BE80", letterSpacing: "1px", textTransform: "uppercase" }}>FORMAL ATTIRE</span>
        </div>
      );

    case "minimal":
      return (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "75%",
          height: "78%",
          background: "#FAF9F5",
          borderRadius: "6px",
          border: "1px solid #DFD3C3",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "0 6px 16px rgba(0,0,0,0.03)",
          fontFamily: "var(--font-sans)"
        }}>
          <div style={{ position: "absolute", top: "3px", left: "3px", right: "3px", height: "0.5px", background: "#E5D8C6" }} />
          <div style={{ position: "absolute", bottom: "3px", left: "3px", right: "3px", height: "0.5px", background: "#E5D8C6" }} />

          <div style={{ display: "flex", justifySelf: "space-between", justifyContent: "space-between", width: "100%", fontSize: "4px", color: "#A69B8F", fontWeight: 700, letterSpacing: "1px", marginTop: "3px" }}>
            <span>EXHIBIT // L. VANCE</span>
            <span>№ 402</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", textAlign: "left", margin: "auto 0" }}>
            <span style={{ fontSize: "4.5px", color: "#999", letterSpacing: "1px" }}>RETROSPECTIVE</span>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: "14.5px", fontWeight: 300, color: "#111", lineHeight: 1.1, marginTop: "1px" }}>Leon<br/>Vance</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "0.5px solid #EEE", paddingTop: "3px", fontSize: "4px", color: "#A69B8F", width: "100%" }}>
            <span>PLAZA GALLERY, NY</span>
            <span style={{ fontWeight: "bold" }}>GALA PASS</span>
          </div>
        </div>
      );

    case "floral":
      return (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "75%",
          height: "78%",
          background: "linear-gradient(135deg, #FFF7F8 0%, #FFF3F5 100%)",
          borderRadius: "6px",
          border: `1.5px solid ${accent}30`,
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 6px 16px rgba(232,143,172,0.06)",
          fontFamily: "var(--font-serif)",
          overflow: "hidden"
        }}>
          <div style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            width: "18px",
            height: "18px",
            opacity: 0.3,
            borderBottomLeftRadius: "100%",
            background: accent
          }} />
          <div style={{
            position: "absolute",
            bottom: "-2px",
            left: "-2px",
            width: "18px",
            height: "18px",
            opacity: 0.3,
            borderTopRightRadius: "100%",
            background: accent
          }} />

          <span style={{ fontSize: "4.5px", color: accent, letterSpacing: "1px", fontWeight: "bold" }}>SWEETEST CELEBRATION</span>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", margin: "auto 0", zIndex: 2 }}>
            <span style={{ fontSize: "5.5px", color: "#5E5A52", letterSpacing: "0.5px" }}>LUCY&apos;S</span>
            <span style={{ fontFamily: "var(--font-script)", fontSize: "19px", color: accent, lineHeight: 1 }}>Garden Party</span>
            <span style={{ fontSize: "4.5px", color: "#5E5A52", letterSpacing: "0.5px", marginTop: "2px" }}>30TH BIRTHDAY</span>
          </div>

          <span style={{ fontSize: "5px", color: "#D7BE80", fontWeight: "bold" }}>OCTOBER 24, 2026</span>
        </div>
      );

    case "tuscany":
      return (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "75%",
          height: "78%",
          background: "linear-gradient(160deg, #F8F3E6 0%, #F1EAD6 45%, #E9E0C6 100%)",
          borderRadius: "6px",
          border: `1px solid ${accent}45`,
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 6px 16px rgba(107,122,79,0.06)",
          fontFamily: "var(--font-serif)"
        }}>
          {/* Diamond checkerboard accent */}
          <div style={{
            position: "absolute", top: "6px", right: "6px", width: "10px", height: "10px",
            transform: "rotate(45deg)", border: `0.5px solid ${accent}70`, opacity: 0.7,
            display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
          }}>
            <div style={{ background: accent }} /><div />
            <div /><div style={{ background: accent }} />
          </div>

          <div style={{
            width: "16px", height: "16px", borderRadius: "50%", marginTop: "3px",
            border: `1px solid ${accent}`, background: `${accent}10`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "5px", fontFamily: "var(--font-sans)", fontWeight: 700, color: accent }}>L&amp;O</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <span style={{ fontSize: "4.5px", fontFamily: "var(--font-sans)", letterSpacing: "1.5px", color: `${accent}CC`, textTransform: "uppercase" }}>Together with their families</span>
            <span style={{ fontFamily: "var(--font-script)", fontSize: "18px", color: accent, lineHeight: 1.1, marginTop: "2px" }}>Lujain &amp; Omar</span>
            <span style={{ fontSize: "5px", fontWeight: "bold", color: accent, marginTop: "3px", letterSpacing: "0.5px" }}>24 OCTOBER 2026</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px", width: "100%" }}>
            <div style={{ width: "15px", height: "1px", background: `${accent}50` }} />
            <span style={{ fontSize: "4.5px", fontFamily: "var(--font-sans)", fontStyle: "italic", color: "#8B8272" }}>VILLA ALMASA</span>
          </div>
        </div>
      );

    default:
      return (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "70%",
          height: "72%",
          background: "#FFFFFF",
          borderRadius: "8px",
          border: `1px solid ${accent}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}>
          <span style={{ fontSize: "10px", color: "#333" }}>You&apos;re Invited</span>
        </div>
      );
  }
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
