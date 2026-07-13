"use client";
import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import FooterSection from "../components/landing/FooterSection";
import MobilePreview from "../components/templates/MobilePreview";
import GoldDivider from "../components/GoldDivider";
import { TEMPLATES, TEMPLATE_PREVIEW_PATTERN } from "../utils/curatedTemplates";

/**
 * Real gallery — previously this page showed 16 hand-drawn "templates"
 * (Timeless Elegance, Marrakesh Nights, Kyoto Blossom...) that don't
 * correspond to anything a visitor can actually pick at signup: the real
 * event-creation wizard only ever offered three (see utils/curatedTemplates.js
 * — the 13 others are retired invitation-card patterns still rendered for
 * pre-existing events, not a choosable product). A visitor could fall for one
 * of those 13, click "Use Template," and land in a wizard where it doesn't
 * exist. This page now shows exactly the same three templates, the same
 * named color presets, and the same live MobilePreview simulator the wizard
 * itself uses — nothing here is a promise the product can't keep.
 */

// Mirrors Stage1_TemplatesSimulator.js's own getLiningGradId exactly, so the
// envelope lining here always matches what the wizard would actually render
// for the same template + preset.
function getLiningGradId(templateKey, presetIndex) {
  if (templateKey === "wedding") {
    return ["goldGrad", "emeraldGrad", "burgundyGrad"][presetIndex] || "goldGrad";
  }
  return "goldGrad";
}

function CheckItem({ children }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: "10px", fontFamily: "var(--font-sans)", fontSize: "14px", color: "#5E5A52", padding: "6px 0" }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="8" fill="rgba(184,148,79,0.1)" />
        <path d="M5 8l2 2 4-4" stroke="#B8944F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </li>
  );
}

function TemplateShowcase({ template, index }) {
  const [presetIdx, setPresetIdx] = useState(0);
  const preset = template.presets[presetIdx];
  const pattern = TEMPLATE_PREVIEW_PATTERN[template.key];
  const reversed = index % 2 === 1;

  const previewTemplate = { name: template.label, pattern, accent: preset.accent };
  const previewTheme = {
    id: `${template.key}-${preset.name.toLowerCase().replace(/\s+/g, "-")}`,
    primary: preset.primary,
    secondary: preset.secondary,
    accent: preset.accent,
    liningGradId: getLiningGradId(template.key, presetIdx),
  };

  return (
    <div className="tpl-showcase" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center", padding: "64px 0" }}>
      <div className="tpl-copy" style={{ order: reversed ? 2 : 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <span style={{ padding: "5px 16px", borderRadius: "100px", background: "rgba(184,148,79,0.08)", border: "1px solid rgba(184,148,79,0.2)", fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 700, color: "#B8944F", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {template.tier}
          </span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "#77736A", fontStyle: "italic" }}>{template.tagline}</span>
        </div>

        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 700, color: "#191B1E", marginBottom: "16px", lineHeight: 1.2 }}>
          {template.label}
        </h2>

        <p style={{ fontFamily: "var(--font-sans)", fontSize: "15.5px", color: "#5E5A52", lineHeight: 1.75, marginBottom: "24px" }}>
          {template.desc}
        </p>

        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
          {template.specs.map((s) => (
            <CheckItem key={s}>{s}</CheckItem>
          ))}
        </ul>

        {/* Real, selectable color presets — exactly what the wizard offers */}
        <div style={{ marginBottom: "32px" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, color: "#191B1E", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
            Color Presets
          </span>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {template.presets.map((p, i) => {
              const isActive = i === presetIdx;
              return (
                <button
                  key={p.name}
                  onClick={() => setPresetIdx(i)}
                  aria-pressed={isActive}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 16px", borderRadius: "100px",
                    border: isActive ? "2px solid #191B1E" : "1px solid #E8E2D6",
                    background: isActive ? "rgba(25,27,30,0.02)" : "#FFFFFF",
                    cursor: "pointer", transition: "all 0.25s ease",
                    fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 700, color: "#191B1E",
                  }}
                >
                  <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})`, border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0 }} />
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <Link href="/register" className="btn-gold" style={{ display: "inline-block", padding: "14px 36px", fontSize: "14.5px", fontWeight: 700, borderRadius: "8px" }}>
          Use {template.label}
        </Link>
      </div>

      <div className="tpl-preview" style={{ order: reversed ? 1 : 2, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "300px" }}>
          <MobilePreview template={previewTemplate} theme={previewTheme} />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .tpl-showcase { grid-template-columns: 1fr !important; gap: 40px !important; padding: 40px 0 !important; }
          .tpl-copy { order: 2 !important; }
          .tpl-preview { order: 1 !important; }
        }
        @media (max-width: 480px) {
          .tpl-showcase { gap: 28px !important; padding: 28px 0 !important; }
          .btn-gold { width: 100% !important; text-align: center !important; }
        }
      `}</style>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "78px" }}>
        {/* ════════════════════ HERO ════════════════════ */}
        <section style={{ background: "linear-gradient(180deg, #F8F4EC 0%, #FFFFFF 100%)", padding: "100px 48px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: "-30px", left: "5%", width: "100px", height: "100px", borderRadius: "50%", border: "1px solid rgba(184,148,79,0.08)", pointerEvents: "none" }} />
          <div style={{ maxWidth: "700px", margin: "0 auto" }}>
            <div style={{ display: "inline-block", padding: "8px 24px", borderRadius: "100px", background: "rgba(184, 148, 79, 0.08)", border: "1px solid rgba(184, 148, 79, 0.15)", marginBottom: "28px" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "#B8944F", letterSpacing: "1.5px", textTransform: "uppercase" }}>Template Gallery</span>
            </div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 700, color: "#191B1E", lineHeight: 1.15, marginBottom: "24px", letterSpacing: "-1px" }}>
              Beautiful <span style={{ color: "#B8944F" }}>Templates</span>
            </h1>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "19px", lineHeight: 1.7, color: "#5E5A52", maxWidth: "560px", margin: "0 auto" }}>
              Every template below is exactly what you get — the same live preview, the same color presets, the same editor you&apos;ll use after signing up.
            </p>
          </div>
        </section>

        {/* ════════════════════ TEMPLATE SHOWCASES ════════════════════ */}
        <section className="tpl-section-tight" style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 48px 40px" }}>
          <h2 className="sr-only">Browse Templates</h2>
          <GoldDivider variant="wide" />
          {TEMPLATES.map((template, i) => (
            <React.Fragment key={template.key}>
              <TemplateShowcase template={template} index={i} />
              {i < TEMPLATES.length - 1 && (
                <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #E8E2D6, transparent)" }} />
              )}
            </React.Fragment>
          ))}
        </section>

        {/* ════════════════════ HOW IT WORKS ════════════════════ */}
        <section style={{ background: "#F8F4EC", padding: "100px 48px" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "40px", fontWeight: 700, color: "#191B1E", marginBottom: "16px" }}>
                How It <span style={{ color: "#B8944F" }}>Works</span>
              </h2>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "17px", color: "#5E5A52", lineHeight: 1.7 }}>
                Three simple steps to a stunning event page.
              </p>
            </div>
            <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "48px" }}>
              {[
                { step: "01", title: "Choose a Template", desc: "Pick Wedding, Engagement, or start from a blank Custom Canvas — pick a color preset or fully customize it." },
                { step: "02", title: "Customize Everything", desc: "Personalize colors, fonts, images, and content. Our editor makes it easy to create something uniquely yours." },
                { step: "03", title: "Share & Collect RSVPs", desc: "Publish your event page and share it with guests. Watch RSVPs roll in with real-time tracking." },
              ].map((item) => (
                <div key={item.step} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "48px", fontWeight: 700, color: "rgba(184,148,79,0.15)", marginBottom: "16px", lineHeight: 1 }}>{item.step}</div>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 600, color: "#191B1E", marginBottom: "12px" }}>{item.title}</h3>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "15px", color: "#5E5A52", lineHeight: 1.7 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════ CTA ════════════════════ */}
        <section style={{ background: "linear-gradient(135deg, #191B1E 0%, #2A2D32 100%)", padding: "100px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(184,148,79,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1, maxWidth: "600px", margin: "0 auto" }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "44px", fontWeight: 700, color: "#FFFFFF", marginBottom: "20px", lineHeight: 1.2 }}>
              Create Your <span style={{ color: "#B8944F" }}>Dream Invitation</span>
            </h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "18px", color: "rgba(255,255,255,0.6)", marginBottom: "40px", lineHeight: 1.7 }}>
              Start with a template and make it yours. Your event deserves to make a lasting first impression.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/register" className="btn-gold" style={{ padding: "16px 48px", fontSize: "16px", fontWeight: 700, borderRadius: "8px" }}>
                Start Designing
              </Link>
              <Link href="/pricing" className="btn-ghost-gold">View Pricing</Link>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />

      <style jsx>{`
        .steps-grid { }
        @media (max-width: 768px) {
          .steps-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
        }
        @media (max-width: 640px) {
          section { padding-left: 20px !important; padding-right: 20px !important; padding-top: 56px !important; padding-bottom: 56px !important; }
          /* This section already has a deliberately tight 20/40px wrapper —
             the blanket 56px reduction above would INCREASE it, not shrink
             it, since each TemplateShowcase inside carries its own padding. */
          .tpl-section-tight { padding-top: 12px !important; padding-bottom: 24px !important; }
          h1 { line-height: 1.2 !important; }
          h2 { font-size: 28px !important; }
        }
        @media (max-width: 480px) {
          .btn-gold, .btn-ghost-gold { width: 100% !important; }
        }
      `}</style>
    </>
  );
}
