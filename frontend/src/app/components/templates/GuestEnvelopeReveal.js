"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import EnvelopeAnimation from "./EnvelopeAnimation";

/* ═══════════════════════════════════════════════════════════════
   GuestEnvelopeReveal — the live, full-screen invitation opening.

   This is the one-time premium reveal a REAL guest sees the first
   time they open their /[slug] link. It reuses the exact same
   EnvelopeAnimation + InvitationCard art as the editor preview, so
   the experience an organizer designs is what the guest receives.

   Behaviour (decided by the parent, EventPageClient):
     • shown once per event (localStorage), then never again
     • auto-skipped when the OS "reduce motion" setting is on
     • always skippable via the Skip control
     • a safety timer guarantees onComplete even if a tap is missed

   It renders as a fixed overlay ABOVE the event page, so the page
   markup (and every data-testid on it) is left completely untouched.
   ═══════════════════════════════════════════════════════════════ */

// Mirrors the editor's TEMPLATE_PREVIEW_MAP so the guest reveal matches
// the art the organizer saw while building (Stage1_TemplatesSimulator).
const TEMPLATE_PATTERN = {
  wedding: "serif",
  engagement: "luxury",
  corporate: "geo",
  birthday: "floral",
  gala: "minimal",
  custom: "organic",
};

const LINING_GRAD = {
  wedding: "goldGrad",
  engagement: "goldGrad",
  gala: "goldGrad",
  // burgundy/emerald linings exist too, but gold is the safe, universal default.
};

export default function GuestEnvelopeReveal({ event, onComplete }) {
  const [opened, setOpened] = useState(false);

  const colors = event?.custom_colors || {};
  const pattern = TEMPLATE_PATTERN[event?.template_type] || "serif";
  const theme = {
    primary: colors.primary || "#B8944F",
    secondary: colors.secondary || "#D7BE80",
    accent: colors.accent || "#191B1E",
    liningGradId: LINING_GRAD[event?.template_type] || "goldGrad",
  };

  const template = { pattern };

  // Safety net: if the open hand-off never fires (e.g. the guest never taps),
  // we don't trap them on the overlay forever. 12s is long enough to enjoy the
  // teaser, short enough to never feel stuck. The Skip control is the fast path.
  useEffect(() => {
    if (opened) return;
    const t = setTimeout(() => onComplete && onComplete(), 12000);
    return () => clearTimeout(t);
  }, [opened, onComplete]);

  const finish = () => {
    if (opened) return;
    setOpened(true);
    onComplete && onComplete();
  };

  return (
    <motion.div
      data-testid="guest-envelope-reveal"
      role="dialog"
      aria-label="Open your invitation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        // Warm, dim "salon" backdrop so the gold lining and card art glow.
        background:
          "radial-gradient(120% 90% at 50% 30%, #2A2118 0%, #191510 45%, #0E0B07 100%)",
        fontFamily: "var(--font-sans)",
        padding: "24px",
      }}
    >
      {/* Subtle vignette + grain for depth (CSS only — no per-frame JS) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(60% 50% at 50% 42%, rgba(184,148,79,0.10) 0%, transparent 70%)",
        }}
      />

      {/* Skip control — always available, never blocks the page underneath */}
      <button
        type="button"
        data-testid="guest-envelope-skip"
        onClick={finish}
        aria-label="Skip invitation animation"
        style={{
          position: "absolute",
          top: "max(18px, env(safe-area-inset-top))",
          right: "20px",
          zIndex: 2,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 16px",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.16)",
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: "rgba(255,255,255,0.7)",
          fontSize: "12px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          transition: "color 0.2s ease, background 0.2s ease, border-color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#FFFFFF";
          e.currentTarget.style.background = "rgba(255,255,255,0.12)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "rgba(255,255,255,0.7)";
          e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
        }}
      >
        Skip <span aria-hidden style={{ fontSize: "14px", lineHeight: 1 }}>›</span>
      </button>

      {/* Eyebrow + event title above the envelope */}
      <div style={{ position: "relative", textAlign: "center", marginBottom: "28px", maxWidth: "520px" }}>
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          style={{
            display: "block",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.42em",
            fontWeight: 700,
            color: theme.secondary,
            marginBottom: "12px",
            paddingLeft: "0.42em",
          }}
        >
          You&apos;re Invited
        </motion.span>
        {event?.title && (
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(22px, 6vw, 32px)",
              fontWeight: 500,
              lineHeight: 1.2,
              color: "#FBF6E9",
              margin: 0,
              textShadow: "0 2px 30px rgba(0,0,0,0.4)",
            }}
          >
            {event.title}
          </motion.h1>
        )}
      </div>

      {/* The envelope stage — fixed size; the card lift is bounded inside it.
          EnvelopeAnimation calls onOpenComplete once the card clears the pocket. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 90, damping: 16 }}
        style={{ position: "relative", width: 230, height: 300 }}
      >
        <EnvelopeAnimation
          template={template}
          theme={theme}
          onOpenComplete={finish}
        />
      </motion.div>
    </motion.div>
  );
}
