"use client";

import React from "react";
import InvitationCard from "./InvitationCard";

/* ═══════════════════════════════════════════════════════════════
   InvitationShowcase — a decorative "premium SaaS visual" that frames
   the real InvitationCard art in an elegant panel. Used as an aside on
   content-heavy pages (Terms / Privacy) so they feel crafted rather
   than purely textual.

   Purely presentational and aria-hidden (it's decoration, not legal
   content). Reuses InvitationCard, so it always reflects the real
   product art with zero duplication.
   ═══════════════════════════════════════════════════════════════ */
export default function InvitationShowcase({
  pattern = "serif",
  theme,
  eyebrow = "Crafted with Fancy",
  caption = "Every invitation, designed to feel unforgettable.",
  style,
}) {
  const resolvedTheme = theme || { primary: "#B8944F", secondary: "#D7BE80" };

  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        borderRadius: "18px",
        border: "1px solid #ECE4D6",
        background: "linear-gradient(165deg, #FFFDF8 0%, #FAF4E9 100%)",
        padding: "20px 18px 22px",
        boxShadow: "0 10px 34px -16px rgba(184,148,79,0.45), 0 2px 10px rgba(0,0,0,0.03)",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Soft gold glow accent */}
      <div
        style={{
          position: "absolute",
          top: "-40px",
          right: "-40px",
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(215,190,128,0.28) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <span
        style={{
          display: "block",
          fontFamily: "var(--font-sans)",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: resolvedTheme.primary,
          marginBottom: "14px",
        }}
      >
        {eyebrow}
      </span>

      {/* The card art, sized to the panel width (portrait invitation ratio) */}
      <div
        style={{
          width: "100%",
          aspectRatio: "210 / 290",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 14px 30px -12px rgba(25,27,30,0.35)",
          transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <InvitationCard template={{ pattern }} theme={resolvedTheme} />
      </div>

      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "13px",
          fontStyle: "italic",
          lineHeight: 1.5,
          color: "#77736A",
          margin: "16px 4px 0",
          textAlign: "center",
        }}
      >
        {caption}
      </p>
    </div>
  );
}
