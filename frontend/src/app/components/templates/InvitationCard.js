"use client";

import React from "react";
import Icon from "../icons/Icon";

/* ═══════════════════════════════════════════════════════════════
   InvitationCard — pure presentational invitation artwork.

   Each pattern renders a DRAMATICALLY different visual design.
   The cards render at ~260×380px.
   ═══════════════════════════════════════════════════════════════ */
const FONT_CLASS = {
  serif: "font-serif", sans: "font-sans", script: "font-script",
  display: "font-display", minimal: "font-minimal", whimsical: "font-whimsical",
};
const SCRIPT_FONTS = new Set(["script", "whimsical"]);

export default function InvitationCard({ template, theme, guestName, config, data }) {
  const accentColor = theme?.primary || "#B8944F";
  const lightAccentColor = theme?.secondary || "#D7BE80";
  const pattern = template?.pattern;
  const name = guestName || "Sarah & John";
  // Real event data (guest-facing pages) overrides the demo placeholder copy
  // below. Callers that don't pass `data` (the organizer simulator, the
  // marketing showcase) keep rendering the original curated demo content.
  const d = data || {};

  switch (pattern) {
    /* ──────────────────────────────────────────────────────────
       CUSTOM — Builder-driven functional card
       ────────────────────────────────────────────────────────── */
    case "custom": {
      const cfg = config || {};
      const headingClass = FONT_CLASS[cfg.headingFont] || "font-serif";
      const OCCASION_PHRASE = { graduation: "our graduation", farewell: "our farewell" };
      const occasionPhrase = OCCASION_PHRASE[cfg.occasionType] || (cfg.occasionType === "other" ? cfg.occasionLabel : null);
      const eyebrow = occasionPhrase ? `We are inviting you to ${occasionPhrase}` : "You are invited";
      return (
        <div
          className="w-full h-full flex flex-col select-none relative overflow-hidden rounded"
          style={{ background: cfg.background || "#FAF8F5", border: `1.5px solid ${accentColor}30`, color: accentColor }}
        >
          {/* Corner ornaments */}
          {[
            { top: 6, left: 6, borderTop: `1.5px solid ${accentColor}50`, borderLeft: `1.5px solid ${accentColor}50` },
            { top: 6, right: 6, borderTop: `1.5px solid ${accentColor}50`, borderRight: `1.5px solid ${accentColor}50` },
            { bottom: 6, left: 6, borderBottom: `1.5px solid ${accentColor}50`, borderLeft: `1.5px solid ${accentColor}50` },
            { bottom: 6, right: 6, borderBottom: `1.5px solid ${accentColor}50`, borderRight: `1.5px solid ${accentColor}50` },
          ].map((s, i) => (
            <div key={i} className="absolute w-5 h-5 pointer-events-none" style={s} />
          ))}

          {cfg.coverImageUrl ? (
            <div className="w-full h-[38%] relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.coverImageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${cfg.background || "#FAF8F5"} 10%, transparent 70%)` }} />
            </div>
          ) : (
            <div className="w-full h-2.5 shrink-0" style={{ background: `linear-gradient(90deg, ${accentColor}, ${lightAccentColor}, ${accentColor})` }} />
          )}

          <div className="flex-1 flex flex-col items-center justify-center text-center px-5 gap-2.5">
            <span className="text-[7px] uppercase tracking-[3px] font-sans font-semibold" style={{ color: `${accentColor}88` }}>{eyebrow}</span>
            <span className={`${headingClass} leading-tight`} style={{ color: accentColor, fontSize: SCRIPT_FONTS.has(cfg.headingFont) ? 30 : 20 }}>
              {cfg.headline || "You're Invited"}
            </span>
            {/* Flourish divider */}
            <svg width="70" height="10" viewBox="0 0 70 10" fill="none" style={{ opacity: 0.5 }}>
              <path d="M0 5 Q17 0 35 5 Q53 10 70 5" stroke={accentColor} strokeWidth="0.8" fill="none" />
              <circle cx="35" cy="5" r="1.5" fill={accentColor} opacity="0.5" />
            </svg>
            <span className="text-[8.5px] font-bold tracking-[1.5px]" style={{ color: lightAccentColor }}>{d.dateLine || "YOUR EVENT DATE"}</span>
            <span className="text-[7.5px] italic text-stone-500">{d.venueLine || "Your venue name"}</span>

            {cfg.sections && typeof cfg.sections === "object" && !Array.isArray(cfg.sections) && Object.entries(cfg.sections).filter(([, v]) => v).map(([key, ], i) => (
              <span key={i} className="text-[7px] text-stone-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
            ))}
          </div>

          {cfg.ctaLabel && (
            <div className="flex items-center justify-center pb-2 shrink-0">
              <span className="text-[7.5px] font-bold uppercase tracking-[2px] px-4 py-1.5 rounded-full" style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}>
                {cfg.ctaLabel}
              </span>
            </div>
          )}

          <div className="flex flex-col items-center gap-0.5 pb-4 shrink-0">
            <span className="text-[6.5px] uppercase tracking-[2px] font-sans" style={{ color: `${accentColor}80` }}>Reserved for</span>
            <span className={`${headingClass} text-lg`} style={{ color: accentColor }}>{name}</span>
          </div>
        </div>
      );
    }

    /* ──────────────────────────────────────────────────────────
       SERIF — Royale Wedding · Full classical wedding card
       Cream/ivory, double border, ornamental filigree corners,
       monogram, damask background, layered ornate design
       ────────────────────────────────────────────────────────── */
    case "serif":
      return (
        <div
          className="w-full h-full flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
          style={{
            background: "#FCFAF6",
            color: accentColor,
            boxShadow: `inset 0 0 30px ${accentColor}08`,
            padding: "14px 16px",
          }}
        >
          {/* Damask pattern background — subtle repeating motif */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.035 }}>
            <svg width="100%" height="100%">
              <defs>
                <pattern id="ic-damask" x="0" y="0" width="44" height="44" patternUnits="userSpaceOnUse">
                  <path d="M22 0 Q28 11 22 22 Q16 11 22 0Z" fill={accentColor} />
                  <path d="M0 22 Q11 28 22 22 Q11 16 0 22Z" fill={accentColor} />
                  <path d="M44 22 Q33 28 22 22 Q33 16 44 22Z" fill={accentColor} />
                  <path d="M22 44 Q28 33 22 22 Q16 33 22 44Z" fill={accentColor} />
                  <circle cx="22" cy="22" r="2" fill={accentColor} opacity="0.5" />
                  <circle cx="0" cy="0" r="1.5" fill={accentColor} opacity="0.3" />
                  <circle cx="44" cy="0" r="1.5" fill={accentColor} opacity="0.3" />
                  <circle cx="0" cy="44" r="1.5" fill={accentColor} opacity="0.3" />
                  <circle cx="44" cy="44" r="1.5" fill={accentColor} opacity="0.3" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#ic-damask)" />
            </svg>
          </div>

          {/* Outer thick decorative border */}
          <div className="absolute pointer-events-none" style={{ inset: 4, border: `2px solid ${accentColor}55` }} />
          {/* Inner thin border — double border frame effect. A restrained two-line
              frame reads as premium/editorial; a third stacked pinstripe here
              previously made the card feel over-decorated rather than refined. */}
          <div className="absolute pointer-events-none" style={{ inset: 8, border: `0.7px solid ${accentColor}28` }} />

          {/* Corner filigree ornaments — curling vine designs */}
          {[
            { top: 4, left: 4, rotate: "0deg" },
            { top: 4, right: 4, rotate: "90deg" },
            { bottom: 4, right: 4, rotate: "180deg" },
            { bottom: 4, left: 4, rotate: "270deg" },
          ].map((pos, i) => (
            <svg key={i} width="36" height="36" viewBox="0 0 40 40" className="absolute pointer-events-none" style={{ ...pos, transform: `rotate(${pos.rotate})`, opacity: 0.55 }}>
              {/* Main curling vine */}
              <path d="M3 3 Q3 12 8 18 Q14 24 22 26" fill="none" stroke={accentColor} strokeWidth="0.7" />
              <path d="M3 3 Q12 3 18 8 Q24 14 26 22" fill="none" stroke={accentColor} strokeWidth="0.7" />
              {/* Inner curl detail */}
              <path d="M5 5 Q5 10 9 14 Q13 18 18 20" fill="none" stroke={accentColor} strokeWidth="0.45" opacity="0.6" />
              <path d="M5 5 Q10 5 14 9 Q18 13 20 18" fill="none" stroke={accentColor} strokeWidth="0.45" opacity="0.6" />
              {/* Tiny leaf sprouts off the vine */}
              <path d="M8 14 Q5 12 6 9" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.5" />
              <path d="M14 8 Q12 5 9 6" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.5" />
              <path d="M14 20 Q11 18 12 14" fill="none" stroke={accentColor} strokeWidth="0.35" opacity="0.4" />
              <path d="M20 14 Q18 11 14 12" fill="none" stroke={accentColor} strokeWidth="0.35" opacity="0.4" />
              {/* Dot accent at corner vertex */}
              <circle cx="3" cy="3" r="1.5" fill={accentColor} opacity="0.45" />
              {/* Tiny flourish dots along curve */}
              <circle cx="10" cy="16" r="0.7" fill={accentColor} opacity="0.3" />
              <circle cx="16" cy="10" r="0.7" fill={accentColor} opacity="0.3" />
            </svg>
          ))}

          {/* Monogram circle */}
          <div className="relative z-10 flex flex-col items-center gap-1 mt-1">
            <div
              className="w-[32px] h-[32px] rounded-full flex items-center justify-center font-sans text-[9px] font-bold tracking-wider"
              style={{ border: `1.5px solid ${accentColor}`, color: accentColor, background: `${accentColor}08` }}
            >{d.monogram || "A&J"}</div>
            <span className="text-[7px] uppercase tracking-[4px] font-semibold" style={{ color: `${accentColor}90` }}>{d.celebrationLabel || "The Marriage Celebration"}</span>
          </div>

          {/* Main content — all invitation details (names, date, time, venue) live
              here, near the top of the card right under the monogram, rather than
              vertically centered — the fixed mt/mb (instead of my-auto) leaves the
              outer flex's justify-between to push the guest-name block down to the
              bottom instead of pulling these details toward the middle. */}
          <div className="flex flex-col items-center text-center mt-2 mb-auto relative z-10 gap-1 px-2">
            <span className="text-[7.5px] tracking-[2.5px] font-sans font-light uppercase text-stone-400">{d.honorLine1 || "Request the honor of your presence"}</span>
            <span className="text-[7.5px] tracking-[2.5px] font-sans font-light uppercase text-stone-400">{d.honorLine2 || "at the marriage of"}</span>

            <span className="font-script text-[33px] leading-tight px-1 mt-1" style={{ color: accentColor }}>{d.names || "Aria & Julian"}</span>

            {/* Ornamental flourish divider — elaborate symmetrical */}
            <svg width="120" height="16" viewBox="0 0 120 16" className="my-1" style={{ opacity: 0.6 }}>
              {/* Left swirl */}
              <path d="M8 8 Q14 3 22 5 Q30 7 38 5 Q44 3 50 6 L60 8" fill="none" stroke={accentColor} strokeWidth="0.7" />
              {/* Right swirl — mirror */}
              <path d="M112 8 Q106 3 98 5 Q90 7 82 5 Q76 3 70 6 L60 8" fill="none" stroke={accentColor} strokeWidth="0.7" />
              {/* Under-curves for depth */}
              <path d="M18 8 Q26 12 36 10 Q44 8 50 10 L60 8" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.35" />
              <path d="M102 8 Q94 12 84 10 Q76 8 70 10 L60 8" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.35" />
              {/* Center diamond */}
              <path d="M60 4 L64 8 L60 12 L56 8 Z" fill={`${accentColor}25`} stroke={accentColor} strokeWidth="0.5" />
              <circle cx="60" cy="8" r="1.2" fill={accentColor} opacity="0.7" />
              {/* Terminal dots */}
              <circle cx="8" cy="8" r="1" fill={accentColor} opacity="0.4" />
              <circle cx="112" cy="8" r="1" fill={accentColor} opacity="0.4" />
            </svg>

            <span className="text-[10px] font-bold tracking-[2px]" style={{ color: lightAccentColor }}>{d.dateLine || "SATURDAY, OCTOBER 24, 2026"}</span>
            {(d.ceremonyLine || d.receptionLine) && (
              <span className="text-[7.5px] tracking-wide leading-relaxed font-sans text-stone-500 max-w-[92%]">
                {d.ceremonyLine && <>Ceremony: <strong className="text-stone-700 font-semibold">{d.ceremonyLine}</strong></>}
                {d.ceremonyLine && d.receptionLine && <br />}
                {d.receptionLine && <>Reception: <strong className="text-stone-700 font-semibold">{d.receptionLine}</strong></>}
              </span>
            )}
            <span className="text-[8px] tracking-wide leading-relaxed font-sans text-stone-500 max-w-[92%] flex flex-row items-baseline justify-center gap-1 flex-wrap">
              {d.venueName || d.venueAddress ? (
                <>
                  {d.venueName && <strong className="text-stone-700 font-semibold">{d.venueName}</strong>}
                  {d.venueAddress && <span>· {d.venueAddress}</span>}
                </>
              ) : (
                <>At four o&apos;clock in the afternoon<br /><strong className="text-stone-700 font-semibold">The Grand Ballroom</strong> · Plaza Hotel, New York</>
              )}
            </span>

            {/* Adults-only notice — one of the "invitation details" that belongs
                on the card itself; shown by default for this pattern (wedding +
                the engagement reskin), hideable per-event via d.noKidsNotice. */}
            {d.noKidsNotice !== false && (
              <span className="text-[6.5px] font-sans font-bold uppercase tracking-[2px] mt-1" style={{ color: `${accentColor}80` }}>
                {d.noKidsText || "No Kids Allowed"}
              </span>
            )}
          </div>

          {/* Guest name at bottom */}
          <div className="relative z-10 flex flex-col items-center gap-0.5 mb-1">
            <span className="text-[6.5px] uppercase tracking-[2.5px] font-sans font-semibold" style={{ color: `${accentColor}70` }}>Invite Issued To:</span>
            <span className="font-script text-2xl leading-none" style={{ color: accentColor }}>{name}</span>
          </div>

          {/* Bottom gradient line */}
          <div className="w-16 h-[1.5px] relative z-10" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       GEO — Conference Pass · Bold tech conference badge
       White, geometric, bold asymmetric, dot grid, monospace
       ────────────────────────────────────────────────────────── */
    case "geo":
      return (
        <div
          className="w-full h-full flex flex-col justify-between text-[#0F172A] font-sans select-none relative overflow-hidden rounded"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            padding: "14px 16px 14px",
          }}
        >
          {/* Bold accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[6px]" style={{ background: `linear-gradient(90deg, ${accentColor}, ${lightAccentColor || accentColor})` }} />

          {/* Geometric dot grid background */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }}>
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: `radial-gradient(circle, ${accentColor} 1px, transparent 1px)`,
              backgroundSize: "18px 18px",
            }} />
          </div>

          {/* Decorative geometric shapes */}
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full pointer-events-none" style={{ border: `1.5px solid ${accentColor}12` }} />
          <div className="absolute -bottom-14 -left-14 w-36 h-36 rounded-full pointer-events-none" style={{ border: `1px solid ${accentColor}08` }} />
          <svg className="absolute top-12 right-4 pointer-events-none" width="22" height="22" viewBox="0 0 22 22" style={{ opacity: 0.12 }}>
            <rect x="2" y="2" width="18" height="18" fill="none" stroke={accentColor} strokeWidth="1.5" transform="rotate(45 11 11)" />
          </svg>
          <svg className="absolute bottom-20 left-3 pointer-events-none" width="16" height="16" viewBox="0 0 16 16" style={{ opacity: 0.08 }}>
            <circle cx="8" cy="8" r="7" fill="none" stroke={accentColor} strokeWidth="1" />
            <circle cx="8" cy="8" r="3" fill="none" stroke={accentColor} strokeWidth="0.5" />
          </svg>

          {/* Header */}
          <div className="flex items-center justify-between pt-3 relative z-10">
            <span className="text-[6.5px] font-bold tracking-[2.5px] uppercase text-slate-400">{d.eyebrow || "Annual Conference"}</span>
            <span className="text-[7px] font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: accentColor }}>{d.badge || "NYC '26"}</span>
          </div>

          {/* Main content — bold asymmetric layout */}
          <div className="flex flex-col gap-1.5 my-auto relative z-10">
            <span className="text-[7.5px] tracking-[3px] uppercase font-extrabold" style={{ color: accentColor }}>{d.subtitle || "Shaping the future"}</span>
            <h4 className="text-[22px] font-extrabold leading-[1.05] tracking-tight text-slate-900">
              {d.headline || (<>Technology &amp;<br />Innovation Summit</>)}
            </h4>
            {/* Accent line connector */}
            <div className="flex items-center gap-2 my-1">
              <div className="h-[2.5px] w-10" style={{ background: accentColor }} />
              <div className="h-[2.5px] w-4" style={{ background: `${accentColor}40` }} />
              <div className="h-[2.5px] w-1.5" style={{ background: `${accentColor}20` }} />
            </div>
            <span className="text-[9px] font-semibold text-slate-500">{d.dateLine || "Saturday · October 24, 2026"}</span>
          </div>

          {/* Schedule block */}
          <div className="flex flex-col gap-2.5 rounded-lg p-3 relative z-10" style={{ background: `${accentColor}06`, border: `1px solid ${accentColor}15` }}>
            {(d.agenda || [["09:00", "Opening Keynote"], ["11:30", "AI & Cloud Panel"], ["14:30", "Hands-on Workshops"]]).map(([time, label]) => (
              <div key={time} className="flex items-center justify-between text-[7.5px]">
                <span className="font-mono text-slate-400 font-medium">{time}</span>
                <span className="font-semibold text-slate-700">{label}</span>
              </div>
            ))}
          </div>

          {/* Footer — badge style */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 relative z-10">
            <div className="flex flex-col">
              <span className="text-[6px] uppercase tracking-[2px] text-slate-400 font-bold">Attendee Pass</span>
              <span className="text-[11px] font-bold text-slate-900">{name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-mono text-slate-300">{d.passCode || "#SUM-2026"}</span>
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}25` }}>
                <div className="w-2 h-2" style={{ background: accentColor, borderRadius: 1 }} />
              </div>
            </div>
          </div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       ORGANIC — Woodland Romance · Warm rustic botanical
       Paper texture, fern/leaf SVGs, earthy, spacious, natural
       STRUCTURALLY different: left-aligned, organic flow layout
       ────────────────────────────────────────────────────────── */
    case "organic":
      return (
        <div
          className="w-full h-full flex flex-col rounded select-none relative overflow-hidden font-serif"
          style={{
            background: "linear-gradient(175deg, #F8F4EB 0%, #F5F0E2 35%, #F0EADA 65%, #F2ECDD 100%)",
            border: `1.5px solid #C8B88A35`,
            color: "#6B5D3E",
            padding: "16px 18px 14px",
          }}
        >
          {/* Watercolor wash border — soft colored edges */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `
              linear-gradient(to right, #8B7D5A0D, transparent 18%, transparent 82%, #8B7D5A0D),
              linear-gradient(to bottom, #8B7D5A08, transparent 15%, transparent 85%, #8B7D5A08)
            `,
          }} />
          {/* Extra warm wash in corners */}
          <div className="absolute top-0 left-0 w-24 h-24 pointer-events-none" style={{
            background: "radial-gradient(ellipse at top left, #D4C9A815, transparent 70%)",
          }} />
          <div className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none" style={{
            background: "radial-gradient(ellipse at bottom right, #D4C9A815, transparent 70%)",
          }} />

          {/* Detailed fern — top-left corner */}
          <svg className="absolute -top-2 -left-2 pointer-events-none" width="80" height="100" viewBox="0 0 80 100" style={{ opacity: 0.16 }}>
            {/* Main stem */}
            <path d="M8 95 Q10 60 22 35 Q30 18 42 5" fill="none" stroke="#6B5D3E" strokeWidth="1" />
            {/* Left leaflets */}
            <path d="M12 80 Q4 70 6 60 Q12 68 16 74Z" fill="#6B5D3E" opacity="0.7" />
            <path d="M15 68 Q6 56 8 46 Q14 54 18 62Z" fill="#6B5D3E" opacity="0.65" />
            <path d="M18 56 Q10 44 14 34 Q18 42 22 50Z" fill="#6B5D3E" opacity="0.6" />
            <path d="M22 44 Q16 34 20 24 Q22 32 26 40Z" fill="#6B5D3E" opacity="0.55" />
            <path d="M28 34 Q22 24 26 16 Q28 24 32 30Z" fill="#6B5D3E" opacity="0.5" />
            <path d="M34 24 Q30 16 34 8 Q34 16 38 22Z" fill="#6B5D3E" opacity="0.4" />
            {/* Right leaflets */}
            <path d="M14 76 Q24 68 28 58 Q22 66 16 72Z" fill="#6B5D3E" opacity="0.6" />
            <path d="M18 64 Q28 54 30 44 Q24 54 20 60Z" fill="#6B5D3E" opacity="0.55" />
            <path d="M22 52 Q30 42 34 32 Q28 42 24 48Z" fill="#6B5D3E" opacity="0.5" />
            <path d="M26 40 Q34 30 38 22 Q32 30 28 36Z" fill="#6B5D3E" opacity="0.45" />
            {/* Midrib veins */}
            <path d="M13 78 L8 68" fill="none" stroke="#6B5D3E" strokeWidth="0.3" opacity="0.4" />
            <path d="M16 66 L10 54" fill="none" stroke="#6B5D3E" strokeWidth="0.3" opacity="0.35" />
            <path d="M20 54 L14 42" fill="none" stroke="#6B5D3E" strokeWidth="0.3" opacity="0.3" />
          </svg>

          {/* Detailed fern — bottom-right corner */}
          <svg className="absolute -bottom-2 -right-2 pointer-events-none" width="80" height="100" viewBox="0 0 80 100" style={{ opacity: 0.14, transform: "rotate(180deg)" }}>
            <path d="M8 95 Q10 60 22 35 Q30 18 42 5" fill="none" stroke="#6B5D3E" strokeWidth="1" />
            <path d="M12 80 Q4 70 6 60 Q12 68 16 74Z" fill="#6B5D3E" opacity="0.7" />
            <path d="M15 68 Q6 56 8 46 Q14 54 18 62Z" fill="#6B5D3E" opacity="0.65" />
            <path d="M18 56 Q10 44 14 34 Q18 42 22 50Z" fill="#6B5D3E" opacity="0.6" />
            <path d="M22 44 Q16 34 20 24 Q22 32 26 40Z" fill="#6B5D3E" opacity="0.55" />
            <path d="M14 76 Q24 68 28 58 Q22 66 16 72Z" fill="#6B5D3E" opacity="0.6" />
            <path d="M18 64 Q28 54 30 44 Q24 54 20 60Z" fill="#6B5D3E" opacity="0.55" />
            <path d="M22 52 Q30 42 34 32 Q28 42 24 48Z" fill="#6B5D3E" opacity="0.5" />
          </svg>

          {/* Small eucalyptus sprig — top-right */}
          <svg className="absolute top-2 right-4 pointer-events-none" width="40" height="55" viewBox="0 0 40 55" style={{ opacity: 0.2 }}>
            <path d="M20 50 Q18 30 22 10" fill="none" stroke="#6B5D3E" strokeWidth="0.7" />
            <ellipse cx="15" cy="18" rx="5" ry="8" fill="#6B5D3E" opacity="0.3" transform="rotate(-25 15 18)" />
            <ellipse cx="27" cy="24" rx="5" ry="8" fill="#6B5D3E" opacity="0.25" transform="rotate(20 27 24)" />
            <ellipse cx="14" cy="34" rx="4.5" ry="7" fill="#6B5D3E" opacity="0.2" transform="rotate(-20 14 34)" />
            <ellipse cx="26" cy="40" rx="4" ry="6.5" fill="#6B5D3E" opacity="0.18" transform="rotate(15 26 40)" />
          </svg>

          {/* "Together with their families" — left aligned, organic feel */}
          <div className="text-[7px] uppercase tracking-[3px] font-sans font-medium text-stone-400 mt-5 relative z-10">Together with their families</div>

          {/* Spacious organic center — more breathing room */}
          <div className="flex flex-col items-start mt-auto mb-2 relative z-10 pl-1">
            <span className="text-[7px] tracking-[2px] uppercase font-sans text-stone-400 mb-1">invite you to celebrate the wedding of</span>
            <span className="font-script text-[32px] leading-[1.1]" style={{ color: "#6B5D3E" }}>{d.names || "Mia & Noah"}</span>
          </div>

          {/* Botanical sprig divider — hand-drawn feel */}
          <svg width="100%" height="18" viewBox="0 0 180 18" className="relative z-10 my-1" style={{ opacity: 0.35 }}>
            {/* Left branch */}
            <path d="M20 9 L70 9" fill="none" stroke="#6B5D3E" strokeWidth="0.5" />
            {/* Right branch */}
            <path d="M110 9 L160 9" fill="none" stroke="#6B5D3E" strokeWidth="0.5" />
            {/* Center leaf cluster */}
            <path d="M90 4 Q86 7 90 10 Q94 7 90 4Z" fill="#6B5D3E" opacity="0.4" />
            <path d="M90 9 Q84 6 80 3" fill="none" stroke="#6B5D3E" strokeWidth="0.6" />
            <path d="M90 9 Q96 6 100 3" fill="none" stroke="#6B5D3E" strokeWidth="0.6" />
            <path d="M82 5 Q80 2 76 1" fill="none" stroke="#6B5D3E" strokeWidth="0.4" />
            <path d="M98 5 Q100 2 104 1" fill="none" stroke="#6B5D3E" strokeWidth="0.4" />
            {/* Tiny leaves on the horizontal lines */}
            <path d="M40 9 Q38 5 34 4" fill="none" stroke="#6B5D3E" strokeWidth="0.35" />
            <path d="M50 9 Q52 5 56 4" fill="none" stroke="#6B5D3E" strokeWidth="0.35" />
            <path d="M130 9 Q128 5 124 4" fill="none" stroke="#6B5D3E" strokeWidth="0.35" />
            <path d="M140 9 Q142 5 146 4" fill="none" stroke="#6B5D3E" strokeWidth="0.35" />
            {/* Leaf shapes */}
            <path d="M36 6 Q34 4 36 3 Q38 4 36 6Z" fill="#6B5D3E" opacity="0.25" />
            <path d="M54 6 Q56 4 54 3 Q52 4 54 6Z" fill="#6B5D3E" opacity="0.25" />
            <path d="M126 6 Q124 4 126 3 Q128 4 126 6Z" fill="#6B5D3E" opacity="0.25" />
            <path d="M144 6 Q146 4 144 3 Q142 4 144 6Z" fill="#6B5D3E" opacity="0.25" />
          </svg>

          {/* Date & venue — centered, earthy tones */}
          <div className="flex flex-col items-center text-center relative z-10 gap-0.5 mb-auto">
            <span className="text-[9px] font-semibold tracking-[1.5px] text-stone-600">{d.dateLine || "OCTOBER 24, 2026 · 4 PM"}</span>
            <span className="text-[8px] italic text-stone-500 mt-0.5">{d.venueLine || "Pine Valley Cabin · Catskills, NY"}</span>
          </div>

          {/* Guest name — warm and inviting */}
          <div className="flex flex-col items-center gap-0.5 relative z-10 mt-2">
            <span className="text-[6.5px] uppercase tracking-[2.5px] font-sans text-stone-400">We&apos;d love for you to join</span>
            <span className="font-script text-[20px] leading-tight" style={{ color: "#6B5D3E" }}>{name}</span>
          </div>

          {/* Bottom tagline */}
          <div className="text-[6.5px] uppercase tracking-[3px] font-sans text-stone-400 text-center relative z-10 mt-2">
            Celebrate under the pines
          </div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       LUXURY — Eternal Love · Dark glamorous Art Deco
       Dark background, gold shimmer, metallic text, cinematic,
       geometric Art Deco brackets, diamond motifs
       ────────────────────────────────────────────────────────── */
    case "luxury":
      return (
        <div
          className="w-full h-full flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
          style={{
            background: "linear-gradient(165deg, #0B0F19 0%, #111827 25%, #151B26 50%, #0F1420 75%, #0D121F 100%)",
            border: `1px solid ${lightAccentColor}25`,
            color: "#fff",
            padding: "14px 16px",
            boxShadow: `inset 0 0 40px rgba(0,0,0,0.4), 0 0 20px ${lightAccentColor}06`,
          }}
        >
          {/* Shimmer sweep overlay */}
          <div className="ic-shimmer absolute inset-0 pointer-events-none z-20" />

          {/* Radial spotlight behind center */}
          <div className="absolute pointer-events-none" style={{
            top: "35%", left: "50%", transform: "translate(-50%, -50%)",
            width: "90%", height: "55%",
            background: `radial-gradient(ellipse, ${lightAccentColor}0C 0%, transparent 60%)`,
          }} />

          {/* Subtle star field dots */}
          {[
            { top: "12%", left: "18%", s: 1.2 }, { top: "8%", right: "25%", s: 0.8 },
            { top: "22%", right: "12%", s: 1 }, { bottom: "18%", left: "22%", s: 0.9 },
            { bottom: "12%", right: "18%", s: 1.1 }, { top: "45%", left: "8%", s: 0.7 },
          ].map((p, i) => (
            <div key={i} className="absolute rounded-full pointer-events-none" style={{
              top: p.top, bottom: p.bottom, left: p.left, right: p.right,
              width: p.s, height: p.s,
              background: lightAccentColor, opacity: 0.2,
            }} />
          ))}

          {/* Art Deco corner brackets — a single clean L-stroke, a corner diamond,
              and a dot. Previously each corner stacked six overlapping paths
              (stepped inner bracket, diagonal accent, two stepped details) plus
              a separate inner frame — busy enough to read as cluttered rather
              than the restrained, confident look real Art Deco luxury pieces
              go for. One clear line reads as more premium than six faint ones. */}
          {[
            { top: 6, left: 6, rotate: "0deg" },
            { top: 6, right: 6, rotate: "90deg" },
            { bottom: 6, right: 6, rotate: "180deg" },
            { bottom: 6, left: 6, rotate: "270deg" },
          ].map((pos, i) => (
            <svg key={i} width="30" height="30" viewBox="0 0 30 30" className="absolute pointer-events-none z-10" style={{ ...pos, transform: `rotate(${pos.rotate})`, opacity: 0.7 }}>
              <path d="M2 18 L2 2 L18 2" fill="none" stroke={lightAccentColor} strokeWidth="0.8" />
              <path d="M2 2 L4 0 L6 2 L4 4 Z" fill={lightAccentColor} opacity="0.3" />
              <circle cx="2" cy="2" r="0.8" fill={lightAccentColor} opacity="0.55" />
            </svg>
          ))}

          {/* Header */}
          <div className="text-[7px] uppercase tracking-[4.5px] font-sans font-semibold mt-2 text-center relative z-10" style={{ color: `${lightAccentColor}CC` }}>
            The Engagement Of
          </div>

          {/* Main content */}
          <div className="flex flex-col items-center text-center my-auto relative z-10 gap-1">
            {/* Metallic gradient text effect */}
            <span
              className="font-serif font-light text-[24px] tracking-wide text-transparent bg-clip-text leading-tight"
              style={{ backgroundImage: `linear-gradient(105deg, #E8D5A3, ${lightAccentColor}, #FBF6E9, ${lightAccentColor}, #E8D5A3)` }}
            >
              {d.names || "Sophia & Thomas"}
            </span>

            {/* Diamond motif divider — signature luxury element */}
            <div className="flex items-center gap-2.5 my-3">
              <span className="w-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${lightAccentColor}70)` }} />
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ opacity: 0.85 }}>
                <path d="M8 1 L15 8 L8 15 L1 8 Z" fill="none" stroke={lightAccentColor} strokeWidth="0.6" />
                <path d="M8 3 L13 8 L8 13 L3 8 Z" fill={`${lightAccentColor}18`} stroke={lightAccentColor} strokeWidth="0.3" />
                <path d="M8 5 L11 8 L8 11 L5 8 Z" fill={`${lightAccentColor}10`} stroke={lightAccentColor} strokeWidth="0.2" opacity="0.6" />
                <circle cx="8" cy="8" r="1" fill={lightAccentColor} opacity="0.7" />
              </svg>
              <span className="w-8 h-px" style={{ background: `linear-gradient(90deg, ${lightAccentColor}70, transparent)` }} />
            </div>

            <span className="text-[8px] tracking-[3px] font-sans uppercase" style={{ color: `${lightAccentColor}DD` }}>{d.dateLine || "October 24, 2026"}</span>
            <span className="text-[7.5px] font-sans font-light text-slate-400 max-w-[88%] leading-relaxed mt-2">
              {d.venueLine ? (
                <strong className="text-white font-medium">{d.venueLine}</strong>
              ) : (
                <>An evening of champagne &amp; celebration<br /><strong className="text-white font-medium">The Penthouse Pavilion</strong></>
              )}
            </span>
          </div>

          {/* Guest name */}
          <div className="flex flex-col items-center gap-1 relative z-10">
            <span className="text-[6.5px] uppercase tracking-[2.5px] font-sans" style={{ color: "rgba(255,255,255,0.30)" }}>Reserved For</span>
            <span className="font-serif italic text-[15px] tracking-wide" style={{ color: lightAccentColor }}>{name}</span>
          </div>

          {/* Bottom accent — "Black Tie" tag */}
          <div className="flex items-center gap-3 relative z-10 mt-1">
            <span className="w-6 h-px" style={{ background: `${lightAccentColor}30` }} />
            <span className="text-[7px] uppercase tracking-[3.5px] font-sans font-bold" style={{ color: `${lightAccentColor}80` }}>{d.dressCode || "Black Tie"}</span>
            <span className="w-6 h-px" style={{ background: `${lightAccentColor}30` }} />
          </div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       MINIMAL — Editorial Gala · Ultra-clean Swiss editorial
       Off-white, dot-grid, strong typography, perforated ticket
       ────────────────────────────────────────────────────────── */
    case "minimal":
      return (
        <div
          className="w-full h-full flex flex-col justify-between text-[#1A1A1A] font-sans select-none relative rounded"
          style={{
            background: "#FBFAF7",
            border: "1px solid #E8E2D8",
            padding: "20px 18px",
          }}
        >
          {/* Subtle dot-grid texture */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06 }}>
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "radial-gradient(circle, #999 0.4px, transparent 0.4px)",
              backgroundSize: "12px 12px",
            }} />
          </div>

          {/* Header */}
          <div className="flex justify-between items-center relative z-10">
            <span className="text-[7px] font-bold tracking-[3.5px] text-stone-400 uppercase">{d.eyebrow || "The Annual Gala"}</span>
            <span className="text-[7px] text-stone-400 font-mono">{d.badge || "№ 024"}</span>
          </div>

          {/* Main content — large confident serif typography */}
          <div className="my-auto flex flex-col text-left relative z-10">
            <span className="text-[7.5px] tracking-[5px] uppercase text-stone-400 font-light">An Evening Of</span>
            <span className="font-serif text-[30px] font-light tracking-tight text-[#111] leading-[1.02] mt-2">
              {d.headline || (<>Art &amp;<br />Philanthropy</>)}
            </span>
            {/* Editorial rule line */}
            <div className="w-14 h-[1.5px] bg-stone-800 my-4" />
            <span className="text-[7.5px] text-stone-500 font-light uppercase tracking-[2.5px]">{d.venueLine || "The Metropolitan · New York"}</span>
            <span className="text-[7.5px] text-stone-500 font-light uppercase tracking-[2.5px] mt-0.5">{d.dateLine || "October 24 · 7:00 PM"}</span>
          </div>

          {/* Perforated line — ticket stub effect */}
          <div className="w-full my-2 relative z-10" style={{
            borderBottom: "1.5px dashed #D5CFC5",
          }} />

          {/* Footer — refined ticket stub */}
          <div className="flex justify-between items-end relative z-10">
            <div className="flex flex-col">
              <span className="text-[6px] uppercase tracking-[2px] text-stone-400 font-bold">Admit</span>
              <span className="font-serif text-[14px] italic text-[#111]">{name}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className="text-[7px] font-bold tracking-[2.5px] uppercase px-3 py-1"
                style={{
                  color: lightAccentColor,
                  border: `1.5px solid ${lightAccentColor}55`,
                }}
              >GALA</span>
            </div>
          </div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       FLORAL — Garden Party · Lush botanical romance
       Soft pink, rose/peony SVGs, scattered petals, whimsical
       ────────────────────────────────────────────────────────── */
    case "floral":
      return (
        <div
          className="w-full h-full flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
          style={{
            background: "linear-gradient(155deg, #FFF8F9 0%, #FFF3F5 30%, #FFECF0 55%, #FFF5F7 100%)",
            border: `1.5px solid ${accentColor}30`,
            color: accentColor,
            boxShadow: `inset 0 0 25px ${accentColor}05`,
            padding: "14px 16px",
          }}
        >
          {/* Floral SVG — top-right: rose/peony shape */}
          <svg className="absolute -top-3 -right-3 pointer-events-none" width="75" height="75" viewBox="0 0 75 75" style={{ opacity: 0.2 }}>
            {/* Outer petals */}
            <ellipse cx="48" cy="24" rx="12" ry="9" fill={accentColor} opacity="0.2" transform="rotate(-15 48 24)" />
            <ellipse cx="48" cy="24" rx="9" ry="12" fill={accentColor} opacity="0.2" transform="rotate(30 48 24)" />
            <ellipse cx="48" cy="24" rx="11" ry="8" fill={accentColor} opacity="0.18" transform="rotate(60 48 24)" />
            <ellipse cx="48" cy="24" rx="8" ry="11" fill={accentColor} opacity="0.18" transform="rotate(-45 48 24)" />
            {/* Inner petals */}
            <ellipse cx="48" cy="24" rx="6" ry="4" fill={accentColor} opacity="0.15" transform="rotate(15 48 24)" />
            <ellipse cx="48" cy="24" rx="4" ry="6" fill={accentColor} opacity="0.15" transform="rotate(-30 48 24)" />
            {/* Center */}
            <circle cx="48" cy="24" r="3" fill={accentColor} opacity="0.25" />
            <circle cx="48" cy="24" r="1.5" fill={accentColor} opacity="0.35" />
            {/* Leaves */}
            <path d="M48 35 Q42 44 34 50 Q40 42 48 35Z" fill={accentColor} opacity="0.22" />
            <path d="M48 35 Q56 42 62 50 Q54 44 48 35Z" fill={accentColor} opacity="0.18" />
            <path d="M36 45 Q32 50 26 52" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.3" />
          </svg>

          {/* Floral SVG — bottom-left */}
          <svg className="absolute -bottom-3 -left-3 pointer-events-none" width="65" height="65" viewBox="0 0 65 65" style={{ opacity: 0.17, transform: "scaleX(-1)" }}>
            <ellipse cx="32" cy="32" rx="10" ry="7" fill={accentColor} opacity="0.2" transform="rotate(20 32 32)" />
            <ellipse cx="32" cy="32" rx="7" ry="10" fill={accentColor} opacity="0.2" transform="rotate(-25 32 32)" />
            <ellipse cx="32" cy="32" rx="9" ry="6" fill={accentColor} opacity="0.18" transform="rotate(55 32 32)" />
            <circle cx="32" cy="32" r="4" fill={accentColor} opacity="0.2" />
            <circle cx="32" cy="32" r="2" fill={accentColor} opacity="0.3" />
            <path d="M32 42 Q28 48 22 52 Q26 46 32 42Z" fill={accentColor} opacity="0.18" />
            <path d="M32 42 Q38 46 44 52 Q38 48 32 42Z" fill={accentColor} opacity="0.15" />
          </svg>

          {/* Scattered petal accents */}
          {[
            { top: "14%", left: "10%", size: 3.5, opacity: 0.14, rot: 25 },
            { top: "72%", right: "14%", size: 4, opacity: 0.12, rot: 65 },
            { top: "42%", left: "6%", size: 3, opacity: 0.1, rot: 110 },
            { top: "24%", right: "20%", size: 2.5, opacity: 0.1, rot: 155 },
            { top: "58%", right: "8%", size: 2, opacity: 0.08, rot: 200 },
            { top: "82%", left: "30%", size: 2.5, opacity: 0.09, rot: 45 },
          ].map((p, i) => (
            <div key={i} className="absolute rounded-full pointer-events-none" style={{
              top: p.top, left: p.left, right: p.right,
              width: p.size * 2, height: p.size,
              background: accentColor, opacity: p.opacity,
              transform: `rotate(${p.rot}deg)`,
              borderRadius: "50%",
            }} />
          ))}

          <div className="text-[7px] uppercase tracking-[3.5px] font-sans font-semibold text-center text-stone-500 relative z-10 mt-2">You&apos;re invited to a</div>

          <div className="flex flex-col items-center text-center my-auto relative z-10">
            <span className="font-script text-[34px] leading-none" style={{ color: accentColor }}>{d.headline || "Garden Party"}</span>
            <span className="text-[7.5px] tracking-[2px] uppercase font-sans text-stone-500 mt-2">{d.subtitle || "In celebration of Lucy's 30th"}</span>

            {/* Floral vine divider */}
            <div className="flex items-center gap-2 my-3">
              <span className="w-7 h-px" style={{ background: `${accentColor}40` }} />
              <svg width="18" height="14" viewBox="0 0 18 14" style={{ opacity: 0.5 }}>
                {/* Flower */}
                <circle cx="9" cy="7" r="2.5" fill={accentColor} opacity="0.25" />
                <circle cx="9" cy="7" r="1.2" fill={accentColor} opacity="0.4" />
                <ellipse cx="6" cy="5.5" rx="1.5" ry="2.5" fill={accentColor} opacity="0.15" transform="rotate(-30 6 5.5)" />
                <ellipse cx="12" cy="5.5" rx="1.5" ry="2.5" fill={accentColor} opacity="0.15" transform="rotate(30 12 5.5)" />
                {/* Vine */}
                <path d="M2 7 Q5 4 9 7 Q13 10 16 7" fill="none" stroke={accentColor} strokeWidth="0.5" />
                <path d="M4 4 Q6 2 8 4" fill="none" stroke={accentColor} strokeWidth="0.35" opacity="0.4" />
                <path d="M10 4 Q12 2 14 4" fill="none" stroke={accentColor} strokeWidth="0.35" opacity="0.4" />
              </svg>
              <span className="w-7 h-px" style={{ background: `${accentColor}40` }} />
            </div>

            <span className="text-[9px] font-bold tracking-[1.5px] text-stone-600">{d.dateLine || "SATURDAY · OCTOBER 24, 2026"}</span>
            <span className="text-[8px] italic text-stone-500 mt-1">{d.venueLine || "The Rose Terrace · Plaza Hotel"}</span>
          </div>

          <div className="flex flex-col items-center gap-0.5 relative z-10">
            <span className="text-[6.5px] uppercase tracking-[2px] font-sans" style={{ color: `${accentColor}60` }}>Reserved for</span>
            <span className="font-script text-xl" style={{ color: accentColor }}>{name}</span>
          </div>

          <div className="text-[7px] font-sans font-bold uppercase tracking-[2.5px] relative z-10 mt-1" style={{ color: `${lightAccentColor}90` }}>{d.replyBy || "Kindly reply by Sept 15"}</div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       TUSCANY — Tuscan Vineyard · Romantic countryside stationery
       Cream parchment, olive frame, checkerboard accent patch,
       swan wax seal, script names — vintage Italian keepsake feel
       ────────────────────────────────────────────────────────── */
    case "tuscany": {
      // A real cover photo (the couple's own engagement shot) upgrades the card
      // to a "Save the Date" photo layout — the illustrated wax-seal version
      // below is the fallback for organizers who haven't uploaded one yet.
      if (d.coverImageUrl) {
        return (
          <div
            className="w-full h-full flex flex-col select-none relative overflow-hidden rounded font-serif"
            style={{ background: accentColor }}
          >
            <div className="w-full relative shrink-0" style={{ height: "58%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.coverImageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${accentColor} 2%, transparent 40%)` }} />
              <div
                className="absolute rounded-full flex items-center justify-center"
                style={{ bottom: -16, left: "50%", transform: "translateX(-50%)", width: 32, height: 32, background: "#FFFFFF", border: `1.5px solid ${accentColor}`, boxShadow: "0 4px 10px rgba(0,0,0,0.25)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 15 Q4 9 8.5 8 Q11 7.5 11 10 Q11 6.5 14.5 6.5 Q19 6.5 19 11 Q19 16 12 19 Q6.5 16.5 4 15Z" fill={accentColor} opacity="0.85" />
                </svg>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-4 pb-3 gap-1.5" style={{ color: "#FBF6EC" }}>
              <span className="text-[7px] uppercase tracking-[3.5px] font-sans font-semibold" style={{ color: `${lightAccentColor}` }}>Save the Date</span>
              <span className="font-script text-[22px] leading-tight" style={{ color: "#FBF6EC" }}>{d.names || "Lujain & Omar"}</span>
              <div className="w-8 h-px my-0.5" style={{ background: `${lightAccentColor}80` }} />
              <span className="text-[8px] font-bold tracking-[1.5px]" style={{ color: lightAccentColor }}>{d.dateLine || "SATURDAY · 24 OCTOBER 2026"}</span>
              {d.venueLine && <span className="text-[7px] italic opacity-80">{d.venueLine}</span>}
              <div className="mt-auto pt-2 flex flex-col items-center gap-0.5" style={{ borderTop: `1px solid ${lightAccentColor}30`, width: "100%" }}>
                <span className="text-[6px] uppercase tracking-[2px] font-sans opacity-60">Kindly reply for</span>
                <span className="font-script text-base" style={{ color: lightAccentColor }}>{name}</span>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div
          className="w-full h-full flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
          style={{
            background: "linear-gradient(165deg, #F8F3E6 0%, #F1EAD6 40%, #E9E0C6 75%, #F2ECDA 100%)",
            color: accentColor,
            padding: "16px 16px 12px",
          }}
        >
          {/* Outer + inner hairline frame — pressed-stationery feel */}
          <div className="absolute pointer-events-none" style={{ inset: 6, border: `1px solid ${accentColor}35` }} />
          <div className="absolute pointer-events-none" style={{ inset: 9, border: `0.5px solid ${accentColor}18` }} />

          {/* Diamond checkerboard accent patch — top-right corner */}
          <div
            className="absolute pointer-events-none grid grid-cols-2 grid-rows-2"
            style={{ top: 14, right: 14, width: 22, height: 22, transform: "rotate(45deg)", border: `1px solid ${accentColor}60`, opacity: 0.7 }}
          >
            <div style={{ background: accentColor }} />
            <div style={{ background: "transparent" }} />
            <div style={{ background: "transparent" }} />
            <div style={{ background: accentColor }} />
          </div>

          {/* Wax seal — two swans forming a heart, monogram beneath */}
          <div className="relative z-10 flex flex-col items-center mt-2 gap-1.5">
            <div
              className="rounded-full flex items-center justify-center"
              style={{ width: 38, height: 38, background: `${accentColor}12`, border: `1.5px solid ${accentColor}`, boxShadow: `inset 0 0 6px ${accentColor}35` }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 15 Q4 9 8.5 8 Q11 7.5 11 10 Q11 6.5 14.5 6.5 Q19 6.5 19 11 Q19 16 12 19 Q6.5 16.5 4 15Z" fill={accentColor} opacity="0.78" />
              </svg>
            </div>
            <span className="text-[6px] uppercase tracking-[3px] font-sans font-semibold" style={{ color: `${accentColor}95` }}>{d.monogram || "L & O"}</span>
          </div>

          {/* Main content */}
          <div className="flex flex-col items-center text-center relative z-10 gap-1.5 px-2 my-auto">
            <span className="text-[6.5px] tracking-[2.5px] font-sans uppercase" style={{ color: `${accentColor}85` }}>Together with their families</span>
            <span className="font-script text-[27px] leading-tight mt-0.5" style={{ color: accentColor }}>{d.names || "Lujain & Omar"}</span>
            <svg width="66" height="9" viewBox="0 0 66 9" style={{ opacity: 0.55 }}>
              <path d="M0 4.5 Q16 0 33 4.5 Q50 9 66 4.5" fill="none" stroke={accentColor} strokeWidth="0.7" />
              <circle cx="33" cy="4.5" r="1.2" fill={accentColor} opacity="0.5" />
            </svg>
            <span className="text-[7px] tracking-wide font-sans leading-relaxed max-w-[92%]" style={{ color: `${accentColor}CC` }}>
              {d.eyebrowLine || "kindly invite you to celebrate their wedding"}
            </span>
            <span className="text-[9px] font-bold tracking-[1.5px] mt-1" style={{ color: accentColor }}>{d.dateLine || "SATURDAY · 24 OCTOBER 2026"}</span>
            <span className="text-[7.5px] italic" style={{ color: `${accentColor}99` }}>{d.venueLine || "Villa Almasa · Cairo"}</span>
          </div>

          {/* Guest name */}
          <div className="flex flex-col items-center gap-0.5 relative z-10 mb-1">
            <span className="text-[6px] uppercase tracking-[2px] font-sans" style={{ color: `${accentColor}70` }}>Kindly reply for</span>
            <span className="font-script text-lg" style={{ color: accentColor }}>{name}</span>
          </div>
        </div>
      );
    }

    /* ──────────────────────────────────────────────────────────
       MARRAKESH — Marrakesh Nights · Moroccan riad evening
       ────────────────────────────────────────────────────────── */
    case "marrakesh":
      return (
        <div className="w-full h-full flex select-none relative overflow-hidden font-serif" style={{ background: "linear-gradient(165deg, #1B2A4A 0%, #182440 100%)", color: "#F3E7D3" }}>
          {/* Left third — keyhole-arch monogram panel (asymmetric, not centered) */}
          <div className="w-[34%] flex flex-col items-center justify-center relative shrink-0" style={{ background: "rgba(217,169,78,0.08)", borderInlineEnd: `1px solid ${lightAccentColor}30` }}>
            <div className="absolute" style={{ inset: 10, border: `1px solid ${lightAccentColor}35`, borderRadius: "50% 50% 4px 4px / 30% 30% 4px 4px" }} />
            {[{ top: 4, left: 4 }, { bottom: 4, right: 4 }].map((pos, i) => (
              <svg key={i} width="14" height="14" viewBox="0 0 18 18" className="absolute pointer-events-none" style={{ ...pos, opacity: 0.5 }}>
                <path d="M9 0 L11 6 L18 6 L12.5 10 L14.5 18 L9 13.5 L3.5 18 L5.5 10 L0 6 L7 6 Z" fill="none" stroke={lightAccentColor} strokeWidth="0.6" />
              </svg>
            ))}
            <span className="text-[13px] font-sans font-bold relative z-10" style={{ color: lightAccentColor }}>{d.monogram || "L&K"}</span>
          </div>
          {/* Right two-thirds — left-aligned content block */}
          <div className="flex-1 flex flex-col justify-between p-3">
            <span className="text-[6.5px] uppercase tracking-[3px] font-sans" style={{ color: `${lightAccentColor}CC` }}>An Evening Under the Stars</span>
            <div className="flex flex-col gap-1">
              <span className="font-script text-[19px] leading-tight" style={{ color: lightAccentColor }}>{d.names || "Layla & Karim"}</span>
              <span className="text-[7.5px] font-bold tracking-[1px]">{d.dateLine || "SATURDAY · 24 OCTOBER 2026"}</span>
              <span className="text-[6.5px] italic opacity-70">{d.venueLine || "Riad Al Fassia · Marrakesh"}</span>
            </div>
            <span className="text-[5.5px] uppercase tracking-[2px] opacity-55">Reserved for {name}</span>
          </div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       KYOTO — Kyoto Blossom · Japanese minimalism, sakura & hanko
       ────────────────────────────────────────────────────────── */
    case "kyoto":
      return (
        <div
          className="w-full h-full flex flex-col select-none relative overflow-hidden font-serif"
          style={{ background: "#F7EFEE", color: "#2B2B2B", padding: "16px 14px" }}
        >
          <svg className="absolute -top-2 -left-4 pointer-events-none" width="140" height="120" viewBox="0 0 140 120" style={{ opacity: 0.22 }}>
            <path d="M0 10 Q40 20 70 55 Q95 82 130 95" fill="none" stroke="#7A6A63" strokeWidth="1" />
            {[[20, 22], [45, 38], [68, 58], [90, 72], [112, 86]].map(([cx, cy], i) => (
              <g key={i}>
                <circle cx={cx} cy={cy} r="3.2" fill={accentColor} opacity="0.5" />
                <circle cx={cx - 3} cy={cy - 2} r="2.2" fill={accentColor} opacity="0.35" />
                <circle cx={cx + 3} cy={cy - 1} r="2.2" fill={accentColor} opacity="0.35" />
              </g>
            ))}
          </svg>
          <div className="absolute flex items-center justify-center" style={{ top: 14, right: 14, width: 22, height: 22, borderRadius: 4, background: accentColor, opacity: 0.9 }}>
            <span className="text-[7px] font-sans font-bold" style={{ color: "#FBF6EC" }}>{(d.monogram || "L&O").slice(0, 2)}</span>
          </div>
          <div className="flex-1 flex flex-col justify-center items-start pl-3 gap-2 relative z-10">
            <span className="text-[6.5px] uppercase tracking-[3px] font-sans" style={{ color: "#8A7B73" }}>You are cordially invited</span>
            <span className="font-script text-[26px] leading-tight" style={{ color: accentColor }}>{d.names || "Lujain & Omar"}</span>
            <div className="w-10 h-px" style={{ background: "#2B2B2B30" }} />
            <span className="text-[8.5px] font-bold tracking-[1px]">{d.dateLine || "24 October 2026"}</span>
            <span className="text-[7.5px] italic" style={{ color: "#8A7B73" }}>{d.venueLine || "Heian Garden Hall"}</span>
          </div>
          <div className="flex flex-col items-start pl-3 gap-0.5 relative z-10 pb-1">
            <span className="text-[6px] uppercase tracking-[2px] font-sans" style={{ color: "#A69A93" }}>Kindly reply for</span>
            <span className="font-script text-lg" style={{ color: accentColor }}>{name}</span>
          </div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       NORDIC — Nordic Frost · Scandinavian minimal, line-art pine
       ────────────────────────────────────────────────────────── */
    case "nordic":
      return (
        <div className="w-full h-full flex select-none relative overflow-hidden font-sans" style={{ background: "#EFF3F5", color: "#33495D" }}>
          {/* Boarding-pass layout: main zone + perforated stub, not a centered stack */}
          <div className="flex-1 flex flex-col justify-between p-3 pl-4">
            <span className="text-[6.5px] uppercase tracking-[3px]" style={{ color: "#7C93A3" }}>Together Forever</span>
            <div className="flex flex-col gap-1.5">
              <span className="font-serif text-[18px] font-light tracking-tight leading-tight">{d.names || "Lujain & Omar"}</span>
              <span className="text-[8px] font-semibold tracking-[1px]">{d.dateLine || "24.10.2026"}</span>
              <span className="text-[7px] opacity-60">{d.venueLine || "Fjordhus · Oslo"}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[5.5px] uppercase tracking-[2px] opacity-45">Reserved for</span>
              <span className="text-[10px] font-serif italic">{name}</span>
            </div>
          </div>
          <div style={{ borderInlineStart: "1.5px dashed #B7C4CC" }} />
          <div className="flex flex-col items-center justify-center gap-2" style={{ width: "26%", background: "#E4EBEE" }}>
            <svg width="14" height="18" viewBox="0 0 30 26" style={{ opacity: 0.55 }}>
              <path d="M15 2 L15 24 M15 2 L8 9 M15 2 L22 9 M15 10 L9 16 M15 10 L21 16" stroke={accentColor} strokeWidth="1.3" fill="none" />
            </svg>
            <span className="text-[6px] font-bold tracking-[2px]" style={{ writingMode: "vertical-rl", color: `${accentColor}90` }}>WINTER · 2026</span>
          </div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       HAVANA — Havana Sunset · Tropical retro postcard
       ────────────────────────────────────────────────────────── */
    case "havana":
      return (
        <div className="w-full h-full flex select-none relative overflow-hidden font-serif" style={{ background: "#FFF8ED" }}>
          {/* Postcard split: vivid photo panel + cream text panel with a postmark */}
          <div className="w-[40%] relative shrink-0" style={{ background: "linear-gradient(165deg, #FF9A6C 0%, #FF7A59 45%, #2EC4B6 100%)" }}>
            <svg className="absolute bottom-0 left-0 pointer-events-none" width="60" height="55" viewBox="0 0 70 60" style={{ opacity: 0.32 }}>
              <path d="M5 60 Q8 40 20 30 Q10 28 2 20 Q14 22 22 28 Q18 16 22 6 Q26 18 24 30 Q34 22 44 20 Q34 28 26 32 Q20 40 18 60Z" fill="#0B3B36" />
            </svg>
            <span className="absolute top-2 left-2"><Icon name="sun" size={11} color="#FFF8ED" strokeWidth={1.6} /></span>
          </div>
          <div className="flex-1 flex flex-col justify-between p-3" style={{ color: "#7A3B2E" }}>
            <span className="text-[6.5px] uppercase tracking-[3px] font-sans font-semibold opacity-70">Fiesta de Amor</span>
            <div className="flex flex-col gap-1">
              <span className="font-script text-[20px] leading-tight" style={{ color: "#E8623D" }}>{d.names || "Lujain & Omar"}</span>
              <span className="text-[8px] font-bold tracking-[1px]">{d.dateLine || "OCT 24, 2026"}</span>
              <span className="text-[7px] italic opacity-70">{d.venueLine || "Casa de la Playa · Havana"}</span>
            </div>
            <div className="self-end flex flex-col items-center justify-center rounded-full" style={{ width: 34, height: 34, border: "1.5px dashed rgba(232,98,61,0.5)" }}>
              <span className="text-[5px] font-sans font-bold text-center leading-none" style={{ color: "#E8623D" }}>RSVP<br />{(name || "GUEST").split(" ")[0]}</span>
            </div>
          </div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       ESTATE — Old Money Estate · Preppy crest & pinstripe
       ────────────────────────────────────────────────────────── */
    case "estate":
      return (
        <div
          className="w-full h-full flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
          style={{ background: "#F3EEE1", color: "#1B2A41", padding: "14px 16px" }}
        >
          <div className="absolute pointer-events-none" style={{ inset: 5, border: `2px solid ${accentColor}` }} />
          <div className="absolute pointer-events-none" style={{ inset: 9, border: `0.5px solid ${accentColor}80` }} />
          <div className="relative z-10 flex flex-col items-center mt-3 gap-1">
            <svg width="30" height="34" viewBox="0 0 30 34">
              <path d="M15 2 L27 7 V17 Q27 28 15 32 Q3 28 3 17 V7 Z" fill="none" stroke={accentColor} strokeWidth="1" />
              <text x="15" y="21" textAnchor="middle" fontSize="9" fontFamily="serif" fill={accentColor}>{(d.monogram || "L&O").slice(0, 3)}</text>
            </svg>
          </div>
          <div className="flex flex-col items-center text-center my-auto gap-1.5 relative z-10 px-2">
            <span className="text-[6.5px] uppercase tracking-[3px]" style={{ color: `${accentColor}90` }}>The Wedding Celebration Of</span>
            <span className="text-[19px] tracking-wide" style={{ fontVariant: "small-caps" }}>{d.names || "Lujain & Omar"}</span>
            <div className="flex items-center gap-2 my-1">
              <span className="w-6 h-px" style={{ background: accentColor }} />
              <span className="w-1 h-1 rotate-45" style={{ background: accentColor }} />
              <span className="w-6 h-px" style={{ background: accentColor }} />
            </div>
            <span className="text-[8.5px] font-bold tracking-[1.5px]">{d.dateLine || "SATURDAY · OCTOBER 24, 2026"}</span>
            <span className="text-[7.5px] italic" style={{ color: `${accentColor}90` }}>{d.venueLine || "Ashworth Hall · Hampshire"}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 relative z-10 mb-2">
            <span className="text-[6px] uppercase tracking-[2px]" style={{ color: `${accentColor}80` }}>Reserved for</span>
            <span className="text-sm tracking-wide" style={{ fontVariant: "small-caps" }}>{name}</span>
          </div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       HERITAGE ARCH — Full-page multi-day wedding site, temple arch
       ────────────────────────────────────────────────────────── */
    case "heritageArch":
      return (
        <div
          className="w-full h-full flex flex-col items-center justify-between select-none relative overflow-hidden font-serif"
          style={{ background: "#F7F1E4", color: "#3A2A22", padding: "16px 16px 14px" }}
        >
          <div className="relative z-10 flex flex-col items-center mt-2 gap-1">
            <svg width="34" height="42" viewBox="0 0 34 42">
              <path d="M4 40 L4 20 Q4 10 10 6 L17 1 L24 6 Q30 10 30 20 L30 40" fill="none" stroke={accentColor} strokeWidth="1.2" />
              <path d="M8 40 L8 21 Q8 13 12.5 9.5 L17 6 L21.5 9.5 Q26 13 26 21 L26 40" fill="none" stroke={accentColor} strokeWidth="0.5" opacity="0.45" />
            </svg>
          </div>
          <div className="flex flex-col items-center text-center my-auto gap-1.5 relative z-10 px-2">
            <span className="text-[6.5px] uppercase tracking-[3px] font-sans font-semibold" style={{ color: `${accentColor}99` }}>A Two-Day Celebration</span>
            <span className="italic text-[19px] leading-tight mt-1" style={{ color: accentColor }}>{d.names || "Mohammed & Leila"}</span>
            <div className="flex items-center gap-1.5 my-1 px-2.5 py-1 rounded-full" style={{ border: `1px solid ${accentColor}50` }}>
              <span className="text-[5.5px] font-sans font-bold tracking-[1.5px] uppercase" style={{ color: accentColor }}>Day One</span>
              <span className="w-0.5 h-0.5 rounded-full shrink-0" style={{ background: accentColor }} />
              <span className="text-[5.5px] font-sans font-bold tracking-[1.5px] uppercase" style={{ color: accentColor }}>Day Two</span>
            </div>
            <span className="text-[8.5px] font-bold tracking-[1.5px]">{d.dateLine || "OCTOBER 24–25, 2026"}</span>
            <span className="text-[7.5px] italic" style={{ color: `${accentColor}90` }}>{d.venueLine || "Oceanfront Beach House · Miami"}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 relative z-10 mb-1">
            <span className="text-[6px] uppercase tracking-[2px]" style={{ color: `${accentColor}80` }}>Reserved for</span>
            <span className="text-sm italic">{name}</span>
          </div>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       ROSE ATELIER — Modern French chic, ribbon & script
       ────────────────────────────────────────────────────────── */
    case "roseAtelier": {
      // A tall minimal "perfume label" — small-caps type, no cursive script,
      // to read distinctly from the other centered/script-name treatments.
      const namesParts = (d.names || "Lujain & Omar").split(" & ");
      return (
        <div className="w-full h-full flex flex-col items-center justify-center select-none relative overflow-hidden font-serif" style={{ background: "linear-gradient(180deg, #FBF6F2 0%, #F7EBE6 100%)", color: "#8A5A5F", padding: "20px 18px" }}>
          <svg width="26" height="16" viewBox="0 0 34 20" style={{ opacity: 0.65, marginBottom: 14 }}>
            <path d="M17 10 C10 0 0 4 8 10 C0 16 10 20 17 10 C24 20 34 16 26 10 C34 4 24 0 17 10Z" fill="none" stroke={accentColor} strokeWidth="0.6" />
          </svg>
          <span className="text-[7px] uppercase tracking-[5px]" style={{ color: `${accentColor}90` }}>Le Mariage De</span>
          <span className="text-[15px] tracking-[3px] uppercase mt-3 leading-relaxed text-center">{namesParts[0]}{namesParts[1] ? <><br />&amp; {namesParts[1]}</> : null}</span>
          <div className="w-8 h-px my-3" style={{ background: accentColor, opacity: 0.4 }} />
          <span className="text-[8px] tracking-[2px] uppercase">{d.dateLine || "24 Octobre 2026"}</span>
          <span className="text-[7px] italic opacity-60 mt-1">{d.venueLine || "Château de Fleurs · Paris"}</span>
          <span className="text-[6px] uppercase tracking-[2px] opacity-50 mt-auto pt-4">Au nom de {name}</span>
        </div>
      );
    }

    /* ──────────────────────────────────────────────────────────
       ORCHID — Midnight Orchid · Moody botanical luxury
       ────────────────────────────────────────────────────────── */
    case "orchid":
      return (
        <div className="w-full h-full flex flex-col justify-end select-none relative overflow-hidden font-serif" style={{ background: "linear-gradient(170deg, #1B1023 0%, #24132E 55%, #180D20 100%)", color: "#EADCF0", padding: "16px" }}>
          {/* Bottom-anchored, asymmetric — the vine runs diagonally along the right edge */}
          <svg className="absolute top-0 right-0 pointer-events-none" width="60" height="200" viewBox="0 0 60 200" style={{ opacity: 0.4 }}>
            <path d="M52 0 Q60 50 42 90 Q56 120 40 160 Q50 180 38 200" fill="none" stroke={lightAccentColor} strokeWidth="0.8" />
            {[40, 100, 150].map((y, i) => (
              <ellipse key={i} cx={i % 2 === 0 ? 47 : 34} cy={y} rx="9" ry="6" fill={lightAccentColor} opacity="0.4" transform={`rotate(${i * 40} ${i % 2 === 0 ? 47 : 34} ${y})`} />
            ))}
          </svg>
          <span className="text-[6.5px] uppercase tracking-[4px] relative z-10 mb-2" style={{ color: `${lightAccentColor}AA` }}>An Intimate Evening</span>
          <span className="font-script text-[23px] leading-tight relative z-10 max-w-[75%]" style={{ color: lightAccentColor }}>{d.names || "Lujain & Omar"}</span>
          <span className="text-[8px] font-bold tracking-[1.5px] mt-2 relative z-10" style={{ color: lightAccentColor }}>{d.dateLine || "SATURDAY · OCTOBER 24, 2026"}</span>
          <span className="text-[7px] italic opacity-65 relative z-10">{d.venueLine || "The Orchid House · London"}</span>
          <div className="w-full h-px my-2.5 relative z-10" style={{ background: `${lightAccentColor}30` }} />
          <span className="text-[6px] uppercase tracking-[2px] opacity-50 relative z-10 pb-1">Reserved for {name}</span>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       CLAY — Copper & Clay · Desert boho, sunburst motif
       ────────────────────────────────────────────────────────── */
    case "clay":
      return (
        <div className="w-full h-full flex flex-col items-center justify-center select-none relative overflow-hidden font-serif" style={{ background: "linear-gradient(165deg, #EDE0CB 0%, #E6D5B8 100%)", color: "#7A4A32", padding: "14px" }}>
          {/* Sun-medallion centerpiece — names live INSIDE the sunburst, not below it */}
          <div className="relative flex items-center justify-center" style={{ width: 116, height: 116 }}>
            <svg width="116" height="116" viewBox="0 0 116 116" className="absolute inset-0">
              <circle cx="58" cy="58" r="40" fill="none" stroke={accentColor} strokeWidth="1" opacity="0.5" />
              {Array.from({ length: 16 }).map((_, i) => {
                const a = (i * 22.5) * Math.PI / 180;
                const x1 = 58 + 42 * Math.cos(a), y1 = 58 + 42 * Math.sin(a), x2 = 58 + 52 * Math.cos(a), y2 = 58 + 52 * Math.sin(a);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accentColor} strokeWidth="1" opacity="0.55" />;
              })}
            </svg>
            <div className="flex flex-col items-center text-center relative z-10 px-2">
              <span className="font-script text-[17px] leading-tight" style={{ color: accentColor }}>{d.names || "Lujain & Omar"}</span>
              <span className="text-[7px] font-bold tracking-[1px] mt-1">{d.dateLine || "OCT 24"}</span>
            </div>
          </div>
          <span className="text-[6.5px] uppercase tracking-[3px] mt-3" style={{ color: `${accentColor}90` }}>Together Under the Sun</span>
          <span className="text-[7px] italic opacity-70 mt-1">{d.venueLine || "Desert Rose Ranch · Marrakesh"}</span>
          <span className="text-[6px] uppercase tracking-[2px] opacity-55 mt-3">Reserved for {name}</span>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       ALPINE — Alpine Pine · Cozy winter lodge
       ────────────────────────────────────────────────────────── */
    case "alpine":
      return (
        <div className="w-full h-full flex flex-col items-center justify-between select-none relative overflow-hidden font-serif" style={{ background: "linear-gradient(165deg, #22392F 0%, #1B2E25 100%)", color: "#F5F1E6", padding: "14px" }}>
          <span className="text-[6.5px] uppercase tracking-[3px] mt-1" style={{ color: `${lightAccentColor}CC` }}>A Winter Celebration</span>
          {/* Cottage-window frame with draping pine boughs — a framed portrait, not a corner-bracketed stack */}
          <div className="relative flex items-center justify-center my-1" style={{ width: 98, height: 108 }}>
            <div className="absolute inset-0" style={{ border: `1.5px solid ${lightAccentColor}70`, borderRadius: "50% 50% 8px 8px / 35% 35% 8px 8px" }} />
            <svg className="absolute -top-3 -left-3" width="44" height="38" viewBox="0 0 20 24" style={{ opacity: 0.6 }}>
              <path d="M10 0 L4 10 H8 L2 18 H8 L8 24 M10 0 L16 10 H12 L18 18 H12 L12 24" fill="none" stroke={lightAccentColor} strokeWidth="0.9" />
            </svg>
            <svg className="absolute -top-3 -right-3 scale-x-[-1]" width="44" height="38" viewBox="0 0 20 24" style={{ opacity: 0.6 }}>
              <path d="M10 0 L4 10 H8 L2 18 H8 L8 24 M10 0 L16 10 H12 L18 18 H12 L12 24" fill="none" stroke={lightAccentColor} strokeWidth="0.9" />
            </svg>
            <div className="flex flex-col items-center text-center px-3 relative z-10">
              <span className="font-script text-[19px]" style={{ color: lightAccentColor }}>{d.names || "Lujain & Omar"}</span>
              <span className="text-[7px] font-bold tracking-[1px] mt-1">{d.dateLine || "DEC 12, 2026"}</span>
            </div>
          </div>
          <span className="text-[7px] italic opacity-70">{d.venueLine || "Pine Ridge Lodge · Aspen"}</span>
          <span className="text-[6px] uppercase tracking-[2px] opacity-55 mb-1">Reserved for {name}</span>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       COASTAL — Coastal Linen · Relaxed seaside wedding
       ────────────────────────────────────────────────────────── */
    case "coastal":
      return (
        <div className="w-full h-full flex flex-col items-center justify-between select-none relative overflow-hidden font-serif" style={{ background: "linear-gradient(165deg, #E8F3EF 0%, #E8DCC3 100%)", color: "#2B5F5A", padding: "14px" }}>
          <span className="text-[6.5px] uppercase tracking-[3px] mt-1" style={{ color: `${accentColor}90` }}>Two Souls, One Shore</span>
          {/* Porthole window — a ring frame, not a corner motif */}
          <div className="relative flex items-center justify-center my-1 rounded-full" style={{ width: 100, height: 100, border: `4px solid ${accentColor}22`, boxShadow: `inset 0 0 0 2px ${accentColor}` }}>
            <div className="flex flex-col items-center text-center px-2">
              <span className="font-script text-[17px]" style={{ color: accentColor }}>{d.names || "Lujain & Omar"}</span>
              <span className="text-[7px] font-bold tracking-[1px] mt-1">{d.dateLine || "JUNE 20, 2026"}</span>
            </div>
          </div>
          <span className="text-[7px] italic opacity-70">{d.venueLine || "Driftwood Point · Cape Cod"}</span>
          <svg width="90%" height="12" viewBox="0 0 100 12" style={{ opacity: 0.55 }} preserveAspectRatio="none">
            <path d="M0 6 Q12 0 25 6 T50 6 T75 6 T100 6" fill="none" stroke={accentColor} strokeWidth="1" />
          </svg>
          <span className="text-[6px] uppercase tracking-[2px] opacity-55 mb-1">Reserved for {name}</span>
        </div>
      );

    /* ──────────────────────────────────────────────────────────
       DEFAULT — Clean fallback card
       ────────────────────────────────────────────────────────── */
    default:
      return (
        <div className="w-full h-full p-5 flex flex-col items-center justify-between rounded select-none relative overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #FCFAF6 0%, #F8F4EC 100%)",
            border: `1.5px solid ${accentColor}30`,
            color: accentColor,
          }}
        >
          {/* Accent gradient bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${accentColor}, ${lightAccentColor}, ${accentColor})` }} />

          {/* Subtle corner brackets */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t border-l pointer-events-none" style={{ borderColor: `${accentColor}30` }} />
          <div className="absolute top-3 right-3 w-4 h-4 border-t border-r pointer-events-none" style={{ borderColor: `${accentColor}30` }} />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l pointer-events-none" style={{ borderColor: `${accentColor}30` }} />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r pointer-events-none" style={{ borderColor: `${accentColor}30` }} />

          <span className="text-[7.5px] uppercase tracking-[3.5px] font-sans text-stone-400 mt-3">You are invited</span>

          <div className="flex flex-col items-center my-auto text-center gap-2">
            <span className="font-script text-[30px] my-1" style={{ color: accentColor }}>Aria &amp; Julian</span>
            {/* Simple flourish */}
            <svg width="60" height="8" viewBox="0 0 60 8" style={{ opacity: 0.4 }}>
              <path d="M0 4 Q15 1 30 4 Q45 7 60 4" fill="none" stroke={accentColor} strokeWidth="0.7" />
              <circle cx="30" cy="4" r="1" fill={accentColor} opacity="0.5" />
            </svg>
            <span className="text-[8.5px] font-sans text-stone-500">Saturday · October 24, 2026</span>
            <span className="text-[7.5px] italic text-stone-400">The Grand Ballroom · New York</span>
          </div>

          <div className="flex flex-col items-center gap-0.5 mb-2">
            <span className="text-[6.5px] uppercase tracking-[2px] font-sans" style={{ color: `${accentColor}70` }}>Reserved for</span>
            <span className="font-script text-xl" style={{ color: accentColor }}>{name}</span>
          </div>
        </div>
      );
  }
}

/* ═══════════════════════════════════════════════════════════════
   CSS injection for the luxury card shimmer animation
   ═══════════════════════════════════════════════════════════════ */
if (typeof document !== "undefined") {
  const id = "ic-shimmer-styles";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .ic-shimmer {
        background: linear-gradient(115deg, transparent 25%, rgba(215,190,128,0.15) 45%, rgba(255,245,220,0.10) 50%, rgba(215,190,128,0.15) 55%, transparent 75%);
        background-size: 250% 100%;
        animation: ic-shimmer-sweep 4s ease-in-out infinite;
      }
      @keyframes ic-shimmer-sweep {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }
}
